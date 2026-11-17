"""Local TradingView memory bridge. Never changes the source chart's resolution."""
import asyncio
import copy
import ctypes
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
import os
import subprocess
from pathlib import Path
import threading
import time
from urllib.request import urlopen
from urllib.parse import urlencode, parse_qs, urlsplit

import websockets
from websockets.sync.client import connect as sync_connect
from market_store import MarketStore, RESOLUTIONS, SYMBOLS
from companion_services import EconomicCalendar, music_metadata, resolve_music_share, MusicProviderError
from native_warmup import NativeWarmup, NATIVE_INTERVALS, SourceChanged
from derived_history import aggregate_six_hour

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv('TERMINAL_DATA_DIR', str(ROOT)))
HTTP_PORT = int(os.getenv('TERMINAL_HTTP_PORT', '3000'))
WS_PORT = int(os.getenv('TERMINAL_WS_PORT', '8080'))
CDP_PORT = int(os.getenv('TERMINAL_CDP_PORT', '9222'))
store = MarketStore(str(DATA_DIR))
calendar_service = EconomicCalendar(history_path=DATA_DIR / 'calendar_cache.json')
clients = set()
refresh = asyncio.Event()
reconnect_source = asyncio.Event()
status = {'type': 'bridge_status', 'state': 'connecting', 'last_update': None,
          'message': 'Đang kết nối TradingView', 'symbols': [],
          'service': 'trading-terminal', 'protocol_version': 2, 'pid': os.getpid()}
history_progress = {}
subscriptions = {}
native_warmup = None
pending_native = []
pending_startup = False
startup_preloaded = False
source_updates = {}
source_config = Path(os.getenv('TERMINAL_DATA_DIR', str(ROOT))) / 'source_requests.json'
try:
    last_requests = json.loads(source_config.read_text(encoding='utf-8'))
    last_requests = {(s, tf) for s, tf in last_requests if s in SYMBOLS and tf in RESOLUTIONS.values()}
except (OSError, ValueError, TypeError):
    last_requests = set()

# Read actual chart state, including manual/unmarked charts. Never navigate a user's chart.
SOURCE_INFO_JS = r'''(() => {
 const c=window._exposed_chartWidgetCollection;if(!c)return null;
 const widgets=typeof c.getAll==='function'?c.getAll():[c.activeChartWidget.value()];
 const charts=[];
 for(const widget of widgets){
   for(const series of widget?.model()?.dataSources()||[]){
     const overlay=series.metaInfo?.()?.id==='Overlay@tv-basicstudies';
     const info=series.symbolInfo?.()||(overlay?series._symbolSourceSymbolInfo?.value?.():null);
     const symbol=info?.name||info?.ticker,resolution=series?.interval?.();
     if(symbol&&resolution&&(!overlay||String(series.symbol()).split(':').pop()===String(symbol).split(':').pop()))charts.push({symbol:String(symbol).split(':').pop(),resolution:String(resolution)});
   }
 }
 return charts.length?charts:null;
})()'''

# Use TradingView's native Overlay (the same OHLC pane as Compare -> New pane).
# This operation is idempotent and never changes the user's main symbol/interval.
ENSURE_PANES_JS = r'''(async () => {
 const widget=window._exposed_chartWidgetCollection?.activeChartWidget.value();
 if(!widget)throw Error('TradingView chart not ready');
 if(window.__terminalPaneSetup)return {pending:true};
 window.__terminalPaneSetup=true;
 try{
   const model=widget.model(),main=model.mainSeries();
   const info=main.symbolInfo();if(!info)throw Error('Main symbol not resolved');
   const supported=['NQ1!','ES1!','YM1!'];
   const primary=String(info.name||info.ticker).split(':').pop();
   if(!supported.includes(primary))throw Error('Open an NQ/ES/YM chart as the single source');
   const created=[];
   for(const symbol of supported){
     const exists=model.dataSources().some(s=>{
       if(s===main)return String(info.name||info.ticker).split(':').pop()===symbol;
       return s.metaInfo?.()?.id==='Overlay@tv-basicstudies'&&String(s.symbol?.()).split(':').pop()===symbol;
     });
     if(exists)continue;
     const study=await widget.addOverlayStudy((symbol==='YM1!'?'CBOT_MINI:':'CME_MINI:')+symbol,false,true);
     if(!study)throw Error('TradingView did not allow a native pane for '+symbol);
     study.properties?.()?.childs?.()?.style?.setValue?.(1);
     created.push({symbol,id:study.id()});
   }
   return {created,resolution:String(main.interval())};
 }finally{window.__terminalPaneSetup=false;}
})()'''


def is_chart_target(target):
    url = urlsplit(target.get('url', ''))
    return (target.get('type') == 'page' and url.scheme == 'https'
            and url.hostname in ('www.tradingview.com', 'tradingview.com')
            and url.path.startswith('/chart/') and bool(target.get('webSocketDebuggerUrl')))


def source_pairs(target):
    if not is_chart_target(target):
        return set()
    values = evaluate_target(target, SOURCE_INFO_JS)
    if not isinstance(values, list):
        raise RuntimeError('TradingView chart metadata is not ready')
    return {(v.get('symbol'), RESOLUTIONS.get(v.get('resolution'))) for v in values if v.get('symbol') in SYMBOLS and v.get('resolution') in RESOLUTIONS}


def evaluate_target(target, expression):
    with sync_connect(target['webSocketDebuggerUrl'], open_timeout=3, close_timeout=1, max_size=20 * 1024 * 1024) as connection:
        connection.send(json.dumps({'id':1, 'method':'Runtime.evaluate', 'params':{'expression':expression, 'returnByValue':True, 'awaitPromise':True}}))
        while True:
            response = json.loads(connection.recv(timeout=15))
            if response.get('id') == 1:
                result=response.get('result', {})
                if response.get('error') or result.get('exceptionDetails'):
                    raise RuntimeError(str(response.get('error') or result['exceptionDetails']))
                return result.get('result', {}).get('value')


def enqueue_native(timeframes,priority=False):
    timeframes=['1h' if tf=='6h' else tf for tf in timeframes]
    if native_warmup:
        native_warmup.request(timeframes,priority)
    else:
        pending_native.extend(tf for tf in timeframes if tf in NATIVE_INTERVALS and tf not in pending_native)


def enqueue_startup():
    global pending_startup, startup_preloaded
    if native_warmup is None:
        pending_startup = True
        return
    native_warmup.request_startup(initial=not startup_preloaded)
    startup_preloaded = True


async def native_warmup_loop():
    global native_warmup, pending_startup
    target=None
    async def evaluate(expression):
        return await asyncio.to_thread(evaluate_target,target,expression)
    async def read():
        return await evaluate("String(window._exposed_chartWidgetCollection.activeChartWidget.value().model().mainSeries().interval())")
    async def change(expected,resolution):
        expression='''(async () => {
        const w=window._exposed_chartWidgetCollection.activeChartWidget.value();
        const interval=()=>{const raw=String(w.model().mainSeries().interval());return raw==='1D'?'D':raw==='1W'?'W':raw;};
        if(interval()!==__EXPECTED__)return 'changed';
        w.setResolution(__RESOLUTION__);
        for(let n=0;n<40;n++){
          const current=interval();
          if(current===__RESOLUTION__)return 'ready';
          if(current!==__EXPECTED__)return 'changed';
          await new Promise(resolve=>setTimeout(resolve,100));
        }
        return 'timeout';})()'''
        result=await evaluate(expression.replace('__EXPECTED__',json.dumps(expected)).replace('__RESOLUTION__',json.dumps(resolution)))
        if result=='changed':
            raise SourceChanged('Source interval changed by user')
        if result!='ready':
            raise RuntimeError('TradingView chưa chuyển được sang khung '+resolution)
    async def snapshot():
        return await evaluate(SNAPSHOT_JS.replace('__FULL__','true')) or []
    async def history():
        available=memory_available()
        return await evaluate(HISTORY_JS.replace('__ALLOW__','true' if available is None or available>2*1024**3 else 'false'))
    def accept(entries):
        for entry in entries:
            symbol=entry.get('symbol');tf=RESOLUTIONS.get(str(entry.get('resolution')))
            if symbol not in SYMBOLS or not tf:continue
            store.metadata[symbol]=entry.get('metadata',{})
            changed=store.merge(symbol,tf,entry.get('bars',[]))
            if changed:publish({'type':'history','symbol':symbol,'timeframe':tf,'bars':changed,'metadata':store.metadata[symbol],'source':'cache'})
            if tf=='1h':refresh_six_hour(symbol)
    def report(value):
        status['native_loading']=value;publish(status)
    native_warmup=NativeWarmup(read,change,snapshot,history,accept,report)
    if pending_native:
        native_warmup.request(pending_native[:]);pending_native.clear()
    if pending_startup:
        pending_startup=False
        enqueue_startup()
    while True:
        await native_warmup.wake.wait();native_warmup.wake.clear()
        try:
            while native_warmup.queue:
                with_targets=await asyncio.to_thread(lambda:json.load(urlopen(f'http://localhost:{CDP_PORT}/json/list',timeout=3)))
                target=next((t for t in with_targets if t.get('id')==status.get('source_target') and is_chart_target(t)),None)
                if not target:
                    report({'state':'waiting','message':'Đang chờ tab TradingView nguồn sẵn sàng'});await asyncio.sleep(3);continue
                try:
                    await asyncio.to_thread(evaluate_target,target,ENSURE_PANES_JS)
                except RuntimeError as error:
                    logging.warning('Native preload will use available panes: %s',error)
                await native_warmup.cycle()
                await asyncio.to_thread(store.save, snapshot_market_data(), snapshot_metadata())
                refresh.set()
        except asyncio.CancelledError:raise
        except Exception as error:
            logging.exception('Native history preload')
            report({'state':'error','message':str(error)});native_warmup.queue.clear()

def remember_requests():
    global last_requests
    if subscriptions:
        last_requests = set().union(*subscriptions.values())
        try:
            temporary = source_config.with_suffix('.tmp')
            temporary.write_text(json.dumps(sorted(last_requests)), encoding='utf-8')
            temporary.replace(source_config)
        except OSError:
            logging.exception('Could not persist source configuration')



def validate_subscription(charts):
    if not isinstance(charts, list) or len(charts) > 16:
        raise ValueError('Invalid chart subscriptions')
    result = set()
    for chart in charts:
        if not isinstance(chart, dict) or chart.get('symbol') not in SYMBOLS or chart.get('timeframe') not in RESOLUTIONS.values():
            raise ValueError('Invalid symbol/timeframe')
        result.add((chart['symbol'], chart['timeframe']))
    return result


def requested_pairs():
    wanted = set().union(*subscriptions.values()) if subscriptions else last_requests
    return {pair for pair in wanted if pair[1] not in ('6h', '12h')}


def source_marker(target):
    url = urlsplit(target.get('url', ''))
    if url.scheme != 'https' or url.hostname not in ('www.tradingview.com', 'tradingview.com') or not url.path.startswith('/chart/'):
        return None
    key = parse_qs(url.query).get('terminal_live', [None])[0]
    if not key or ':' not in key:
        return None
    symbol, tf = key.rsplit(':', 1)
    return key if symbol in SYMBOLS and tf in RESOLUTIONS.values() else None


def memory_available():
    if os.name != 'nt':
        return None
    class Memory(ctypes.Structure):
        _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong)] + [(name, ctypes.c_ulonglong) for name in
            ('total', 'available', 'total_page', 'available_page', 'total_virtual', 'available_virtual', 'extended')]
    memory = Memory()
    memory.length = ctypes.sizeof(memory)
    return memory.available if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)) else None


HISTORY_JS = r'''(() => {
 const w=window._exposed_chartWidgetCollection?.activeChartWidget.value();
 if(!w)return null;
 const s=w.model().mainSeries(), bars=s.bars();
 if(!bars?.size())return null;
 const symbol=String(s.symbolInfo()?.name||'').split(':').pop(), resolution=String(s.interval());
 const key=symbol+':'+resolution, now=Date.now();
 const state=window.__terminalHistoryState ||= {};
 const p=state[key] ||= {count:0,growth:now,request:0};
 if(p.count!==bars.size()){p.count=bars.size();p.growth=now;}
 const loading=s.isLoading(), available=s.requestMoreDataAvailable();
 const stalled=!!p.request && now-p.growth>45000 && !loading;
 const complete=!loading && (!available || stalled || !__ALLOW__);
 if(!complete && !loading && available && now-p.request>3000){s.requestMoreData(5000);p.request=now;}
 return {symbol,resolution,count:bars.size(),complete,loading:s.isLoading(),reason:!__ALLOW__?'memory':stalled?'stalled':!available?'source_limit':'loading'};
})()'''

# Symbol metadata is authoritative; titles and sds_N indexes are not symbols.
SNAPSHOT_JS = r'''(() => {
  const collection = window._exposed_chartWidgetCollection;
  if (!collection) throw new Error('TradingView chart collection unavailable');
  const widgets = typeof collection.getAll === 'function' ? collection.getAll() : [collection.activeChartWidget.value()];
  const result = new Map();
  for (const widget of widgets) for (const source of widget.model().dataSources()) {
    try {
      const overlay = source.metaInfo?.()?.id === 'Overlay@tv-basicstudies';
      if (source.isLoading?.() || overlay && (source._studyModified || typeof source.status === 'function' && source.status()?.type !== 2)) continue;
      const info = source.symbolInfo?.() || (overlay ? source._symbolSourceSymbolInfo?.value?.() : null);
      const resolution = source.interval?.();
      if (!info || !resolution) continue;
      const symbol = String(info.name || info.ticker || '').split(':').pop();
      if (!['NQ1!', 'ES1!', 'YM1!', 'CL1!'].includes(symbol)) continue;
      if (overlay && String(source.symbol?.()).split(':').pop() !== symbol) continue;
      const data = source.data?.();
      const bars = data?.bars?.() || source.bars?.() || (overlay ? data : null);
      if (!bars || !bars.size()) continue;
      const output = [];
      const append = value => {
        if (value && value.length >= 5) output.push({time:value[0],open:value[1],high:value[2],low:value[3],close:value[4],volume:value[5] || 0});
      };
      if (__FULL__) bars.each((index,value) => { append(value); });
      else append(bars.valueAt(bars.lastIndex()));
      const entry = {symbol, resolution, bars:output, metadata:{
        exchange:info.exchange || info.listed_exchange || '', description:info.description || symbol,
        timezone:info.timezone, session:info.session,
        sessionCorrections:info.corrections || info['session-correction'] || info.session_correction || '',
        tickSize:info.minmov / info.pricescale, pointValue:info.pointvalue,
        sessionRegular:(info.subsessions || []).filter(s => s.id === 'us_regular').map(s => ({session:s.session, corrections:s['session-correction'] || ''}))[0] || null,
        holidays:info.session_holidays || ''
      }};
      const key = symbol + ':' + resolution, previous = result.get(key);
      const last = output.at(-1)?.time ?? -1, priorLast = previous?.bars.at(-1)?.time ?? -1;
      if (!previous || last > priorLast || last === priorLast && output.length > previous.bars.length) result.set(key, entry);
    } catch (error) { result.set('error:' + result.size, {error:String(error)}); }
  }
  return [...result.values()];
})()'''


def discover_target():
    with urlopen(f'http://localhost:{CDP_PORT}/json', timeout=3) as response:
        targets = json.load(response)
    return next((t['webSocketDebuggerUrl'] for t in targets if t.get('type') == 'page'
                 and 'tradingview.com/chart/' in t.get('url', '')), None)


class CDPConnection:
    def __init__(self, socket):
        self.socket = socket
        self.pending = {}
        self.sequence = 0

    async def read(self):
        try:
            async for raw in self.socket:
                value = json.loads(raw)
                future = self.pending.get(value.get('id'))
                if future and not future.done():
                    if 'error' in value:
                        future.set_exception(RuntimeError(str(value['error'])))
                    else:
                        future.set_result(value.get('result', {}))
        finally:
            for future in self.pending.values():
                if not future.done():
                    future.set_exception(ConnectionError('CDP disconnected'))

    async def evaluate(self, expression):
        self.sequence += 1
        request_id = self.sequence
        future = asyncio.get_running_loop().create_future()
        self.pending[request_id] = future
        try:
            await self.socket.send(json.dumps({'id': request_id, 'method': 'Runtime.evaluate',
                                              'params': {'expression': expression, 'returnByValue': True}}))
            result = await asyncio.wait_for(future, timeout=6)
            if result.get('exceptionDetails'):
                raise RuntimeError(str(result['exceptionDetails']))
            return result.get('result', {}).get('value')
        finally:
            self.pending.pop(request_id, None)


def publish(message):
    encoded = json.dumps(message, allow_nan=False)
    for queue in list(clients):
        try:
            queue.put_nowait(encoded)
        except asyncio.QueueFull:
            clients.discard(queue)
            while not queue.empty():
                queue.get_nowait()
            queue.put_nowait(None)


def refresh_six_hour(symbol):
    try:
        values,skipped=aggregate_six_hour(store.data['1h'].get(symbol,[]),store.metadata.get(symbol,{}))
        changed=store.merge(symbol,'6h',values)
        status.setdefault('derived_timeframes',{})['6h']={'from':'1h','alignment':'source session','skipped_buckets':skipped}
        if changed:publish({'type':'history','symbol':symbol,'timeframe':'6h','bars':changed,'metadata':store.metadata.get(symbol,{}),'source':'derived','derived_from':'1h'})
    except (KeyError,ValueError) as error:
        logging.warning('6h from native 1h %s: %s',symbol,error)


def set_status(state, message, **fields):
    status.update(state=state, message=message, **fields)
    publish(status)


async def poll_source(source_url=None, expected=None):
    delay = 1
    while True:
        reader = None
        try:
            target = source_url or await asyncio.to_thread(discover_target)
            if not target:
                raise ConnectionError('Không tìm thấy chart TradingView đang mở')
            async with websockets.connect(target, max_size=20 * 1024 * 1024,
                                          open_timeout=5, close_timeout=2) as socket:
                cdp = CDPConnection(socket)
                reader = asyncio.create_task(cdp.read())
                next_full = 0
                delay = 1
                while True:
                    full = refresh.is_set() or time.monotonic() >= next_full
                    refresh.clear()
                    values = await cdp.evaluate(SNAPSHOT_JS.replace('__FULL__', 'true' if full else 'false'))
                    if source_url and full:
                        available_memory = memory_available()
                        try:
                            progress = await cdp.evaluate(HISTORY_JS.replace('__ALLOW__', 'true' if available_memory is None or available_memory > 2 * 1024**3 else 'false'))
                        except RuntimeError:
                            progress = None
                        if progress:
                            if progress.get('count') != history_progress.get(source_url, {}).get('count'):
                                next_full = 0
                            history_progress[source_url] = progress
                    available = []
                    for entry in values or []:
                        if entry.get('error'):
                            logging.warning('Source extraction: %s', entry['error'])
                            continue
                        symbol = entry.get('symbol')
                        tf = RESOLUTIONS.get(str(entry.get('resolution')))
                        if symbol not in SYMBOLS or not tf:
                            continue
                        if expected and (symbol, tf) != expected:
                            continue
                        last_bar = entry.get('bars', [])[-1] if entry.get('bars') else {}
                        source_updates[symbol+':'+tf] = {'symbol':symbol,'timeframe':tf,'updated':time.time(),
                            'last_bar_time':last_bar.get('time'),'close':last_bar.get('close'),'volume':last_bar.get('volume')}
                        available.append({'symbol': symbol, 'timeframe': tf})
                        store.metadata[symbol] = entry.get('metadata', {})
                        changed = store.merge(symbol, tf, entry.get('bars', []))
                        if tf=='1h' and changed:refresh_six_hour(symbol)
                        if full and changed:
                            publish({'type': 'history', 'symbol': symbol, 'timeframe': tf,
                                     'bars': changed, 'metadata': store.metadata[symbol], 'source': 'live'})
                        else:
                            for bar in changed:
                                publish({'type': 'tick', 'symbol': symbol, 'timeframe': tf, 'bar': bar})
                    if not available:
                        raise RuntimeError('Chart chưa có nến NQ/ES/YM/CL với metadata hợp lệ')
                    combined = [item for item in status.get('symbols', [])
                                if (item['symbol'],item['timeframe']) not in {(item['symbol'],item['timeframe']) for item in available}]
                    set_status('connected', 'TradingView · đang nhận dữ liệu', symbols=combined + available,
                               last_update=time.time(), sources=list(source_updates.values()))
                    if full:
                        next_full = time.monotonic() + 20
                    try:
                        await asyncio.wait_for(refresh.wait(), timeout=1)
                    except asyncio.TimeoutError:
                        pass
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logging.warning('TradingView connection: %s', exc)
            if expected:
                key = ':'.join(expected)
                source_updates[key] = {**source_updates.get(key, {}), 'symbol': expected[0], 'timeframe': expected[1], 'updated': 0, 'error': str(exc)}
                set_status(status['state'], 'Một nguồn TradingView gián đoạn', sources=list(source_updates.values()))
            if expected is None:
                set_status('disconnected', str(exc) or 'TradingView không phản hồi', symbols=[])
        finally:
            if reader:
                reader.cancel()
                await asyncio.gather(reader, return_exceptions=True)
        await asyncio.sleep(delay)
        delay = min(delay * 2, 15)


def select_single_source(targets, previous_url=None):
    """Choose one real chart, prefer a stable unmarked tab with NQ and peer panes."""
    candidates=[]
    for target in targets:
        if not is_chart_target(target):
            continue
        try:
            pairs=source_pairs(target)
        except Exception:
            if target['webSocketDebuggerUrl']==previous_url:
                return target, None
            continue
        if not any(symbol in ('NQ1!','ES1!','YM1!') for symbol, _ in pairs):
            continue
        score=(target['webSocketDebuggerUrl']==previous_url, source_marker(target) is None,
               len({symbol for symbol,_ in pairs}), any(symbol=='NQ1!' for symbol,_ in pairs))
        candidates.append((score,target,pairs))
    if not candidates:
        return None, set()
    _,target,pairs=max(candidates,key=lambda item:item[0])
    return target,pairs


async def automatic_sources():
    """One CDP reader for one TradingView tab with three native price sources."""
    worker=None
    current_url=None
    retry_setup=0
    try:
        while True:
            if reconnect_source.is_set():
                reconnect_source.clear()
                if worker:
                    worker.cancel()
                    await asyncio.gather(worker, return_exceptions=True)
                    worker = None
                source_updates.clear()
                history_progress.clear()
                retry_setup = 0
                set_status('connecting', 'Đang kết nối lại TradingView', symbols=[],
                           sources=[], source_target=None, last_update=None, source_setup_error=None)
            try:
                def discover():
                    with urlopen(f'http://localhost:{CDP_PORT}/json/list',timeout=3) as response:
                        return json.load(response)
                targets=await asyncio.to_thread(discover)
                target,pairs=await asyncio.to_thread(select_single_source,targets,current_url)
                if target:
                    url=target['webSocketDebuggerUrl']
                    if url!=current_url or worker is None or worker.done():
                        if worker:
                            worker.cancel()
                            await asyncio.gather(worker,return_exceptions=True)
                        source_updates.clear()
                        history_progress.clear()
                        current_url=url
                        worker=asyncio.create_task(poll_source(url))
                    if pairs is not None:
                        native_symbols={symbol for symbol,_ in pairs}
                        missing={'NQ1!','ES1!','YM1!'}-native_symbols
                        if subscriptions and missing and time.monotonic()>=retry_setup:
                            retry_setup=time.monotonic()+30
                            try:
                                await asyncio.to_thread(evaluate_target,target,ENSURE_PANES_JS)
                                refresh.set()
                            except Exception as error:
                                logging.warning('Native peer panes: %s',error)
                                status['source_setup_error']=str(error)
                        elif not missing:
                            status.pop('source_setup_error',None)
                        status.update(source_mode='single-tab-panes',source_target=target.get('id'),
                                      native_timeframes=sorted({tf for _,tf in pairs}),
                                      source_note='Native panes share the TradingView tab interval; other chart intervals use saved native history.')
                        # A single-tab Overlay inherits the main interval. Report missing
                        # live pairs truthfully; never open tabs or relabel/aggregate candles.
                        for symbol,tf in requested_pairs()-pairs:
                            source_updates[symbol+':'+tf]={'symbol':symbol,'timeframe':tf,'updated':0,
                                'error':'Nguồn một tab đang dùng khung '+', '.join(sorted({t for _,t in pairs}))+'. Đổi khung trong tab TradingView để tải native; web giữ dữ liệu đã lưu.'}
                        for key in list(source_updates):
                            item=source_updates[key]
                            if item.get('error') and ((item['symbol'],item['timeframe']) in pairs or (item['symbol'],item['timeframe']) not in requested_pairs()):
                                del source_updates[key]
                elif not worker or worker.done():
                    set_status('connecting','Mở một tab TradingView NQ/ES/YM để lấy dữ liệu ba pane')
            except Exception as error:
                logging.exception('Single-tab source discovery')
                if not worker or worker.done():
                    set_status('disconnected', f'Không kết nối được TradingView: {error}', symbols=[])
            try:
                await asyncio.wait_for(reconnect_source.wait(), timeout=3)
            except asyncio.TimeoutError:
                pass
    finally:
        if worker:
            worker.cancel()
            await asyncio.gather(worker,return_exceptions=True)


def snapshot_market_data():
    return {tf: {symbol: list(bars) for symbol, bars in symbols.items()} for tf, symbols in store.data.items()}


def snapshot_metadata():
    return {symbol: copy.deepcopy(meta) for symbol, meta in store.metadata.items()}


def encode_initial_snapshot(status_snapshot, data_snapshot, metadata_snapshot):
    frames = [json.dumps(status_snapshot)]
    for tf, symbols in data_snapshot.items():
        for symbol, bars in symbols.items():
            if bars:
                frames.append(json.dumps({'type': 'history', 'symbol': symbol, 'timeframe': tf,
                                          'bars': bars, 'metadata': metadata_snapshot.get(symbol), 'source': 'cache'}))
    return frames


async def frontend_ws_handler(socket):
    queue = asyncio.Queue(maxsize=256)

    async def send_loop():
        try:
            while True:
                message = await queue.get()
                if message is None:
                    await socket.close(code=1013, reason='Client too slow; reconnect for snapshot')
                    return
                await asyncio.wait_for(socket.send(message), timeout=5)
        except websockets.exceptions.ConnectionClosedOK:
            return
        except Exception as exc:
            logging.warning('Frontend send failed: %s', exc)
            await socket.close(code=1011, reason='Send failed; reconnect for snapshot')

    sender = None
    try:
        frames = await asyncio.to_thread(encode_initial_snapshot, copy.deepcopy(status), snapshot_market_data(), snapshot_metadata())
        for frame in frames:
            queue.put_nowait(frame)
        clients.add(queue)
        sender = asyncio.create_task(send_loop())
        async for raw in socket:
            try:
                request = json.loads(raw)
                if not isinstance(request, dict):
                    raise ValueError('Expected an object')
                if request.get('action') == 'subscribe':
                    subscriptions[id(socket)] = validate_subscription(request.get('charts', []))
                    remember_requests()
                elif request.get('action') == 'preload_native':
                    enqueue_native(list(NATIVE_INTERVALS))
                elif request.get('action') == 'startup_native':
                    enqueue_startup()
                elif request.get('action') == 'request_native':
                    requested = request.get('charts', [])
                    if not isinstance(requested, list) or len(requested) > 16:
                        queue.put_nowait(json.dumps({'type': 'native_request_error', 'error': 'Invalid native request list'}))
                        continue
                    valid_tfs, rejected = [], []
                    for item in requested:
                        if not isinstance(item, dict):
                            rejected.append(str(item))
                            continue
                        sym, tf = item.get('symbol'), item.get('timeframe')
                        if sym in SYMBOLS and (tf in NATIVE_INTERVALS or tf == '6h'):
                            valid_tfs.append(tf)
                        else:
                            rejected.append(f'{sym}:{tf}')
                    if valid_tfs:
                        enqueue_native(valid_tfs, priority=True)
                    if rejected:
                        queue.put_nowait(json.dumps({'type': 'native_request_error', 'rejected': rejected,
                                                     'error': f'Khung/mã chưa hỗ trợ native: {", ".join(rejected)}'}))
                elif request.get('action') == 'refresh':
                    if os.getenv('TERMINAL_OFFLINE') == '1':
                        queue.put_nowait(json.dumps(status))
                    else:
                        reconnect_source.set()
                elif request.get('action') == 'refresh_htf':
                    refresh.set()
                elif request.get('action') == 'ping':
                    queue.put_nowait(json.dumps({'type': 'pong', 'time': time.time()}))
            except (ValueError, TypeError, asyncio.QueueFull):
                await socket.close(code=1008, reason='Invalid request')
                break
    finally:
        subscriptions.pop(id(socket),None)
        if subscriptions:
            remember_requests()
        clients.discard(queue)
        if sender:
            sender.cancel()
            await asyncio.gather(sender, return_exceptions=True)


class HTTPHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path)
        if path.path in ('/api/calendar', '/api/music/metadata', '/api/music/resolve'):
            retry_after=None
            try:
                if path.path == '/api/calendar':
                    result = calendar_service.get()
                else:
                    params = parse_qs(path.query)
                    url = params.get('url', [''])[0]
                    if len(url) > 2048:
                        raise ValueError('Link too long')
                    result = ({'url': resolve_music_share(url)} if path.path.endswith('/resolve')
                              else music_metadata(url, fresh_embed=params.get('embed') == ['1']))
                code = 200
            except MusicProviderError as exc:
                result,code={'error':str(exc)},exc.status
                retry_after=exc.retry_after
            except ValueError as exc:
                result, code = {'error': str(exc)}, 400
            except Exception:
                result, code = {'error': 'Provider unavailable; try its full link'}, 502
            body = json.dumps(result).encode()
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            if path.path.startswith('/api/music/'):self.send_header('Cache-Control','no-store')
            if retry_after:self.send_header('Retry-After',str(retry_after))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == '/health':

            counts = {symbol: len(bars) for symbol, bars in dict(store.data['1m']).items()}
            body = json.dumps({**status, 'ws_port': WS_PORT, 'cached_1m': counts,
                'blocked_timeframes': {'12h':'Requires custom interval entitlement'}, 'cache': {'mode':'ram', 'disk_backup':True, 'free_bytes':memory_available()},
                'history_loading':list(history_progress.values()),
                'coverage': {tf: {symbol: len(bars) for symbol, bars in values.items()} for tf, values in store.data.items()}}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *_args):
        pass


async def save_loop():
    while True:
        await asyncio.sleep(20)
        try:
            await asyncio.to_thread(store.save, snapshot_market_data(), snapshot_metadata())
        except OSError:
            logging.exception('Could not persist market data')


async def main():
    store.load()
    for symbol in SYMBOLS:
        if store.data['1h'].get(symbol):refresh_six_hour(symbol)
    handler = partial(HTTPHandler, directory=str(ROOT.parent / 'frontend'))
    server = ThreadingHTTPServer(('127.0.0.1', HTTP_PORT), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    tasks = []
    try:
        async with websockets.serve(frontend_ws_handler, '127.0.0.1', WS_PORT,
                                    max_size=8192, ping_interval=20, ping_timeout=15, close_timeout=2,
                                    origins=[None, f'http://localhost:{HTTP_PORT}', f'http://127.0.0.1:{HTTP_PORT}']):
            logging.info('Terminal http://localhost:%s · WebSocket %s', HTTP_PORT, WS_PORT)
            tasks.append(asyncio.create_task(save_loop()))
            if os.getenv('TERMINAL_OFFLINE') == '1':
                set_status('disconnected', 'Offline · dữ liệu đã lưu')
            else:
                if os.name == 'nt':
                    await asyncio.to_thread(subprocess.run, ['powershell', '-NoProfile',
                        '-ExecutionPolicy', 'Bypass', '-File', str(ROOT / 'launch_tv.ps1')],
                        creationflags=subprocess.CREATE_NO_WINDOW, timeout=30, check=False)
                tasks.append(asyncio.create_task(automatic_sources()))
                tasks.append(asyncio.create_task(native_warmup_loop()))
            await asyncio.Event().wait()
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await asyncio.to_thread(server.shutdown)
        server.server_close()
        store.save()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
