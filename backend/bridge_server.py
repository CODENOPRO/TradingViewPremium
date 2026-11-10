"""Local TradingView memory bridge. Never changes the source chart's resolution."""
import asyncio
import copy
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
import os
from pathlib import Path
import threading
import time
from urllib.request import urlopen

import websockets
from market_store import MarketStore, RESOLUTIONS, SYMBOLS

ROOT = Path(__file__).resolve().parent
HTTP_PORT = int(os.getenv('TERMINAL_HTTP_PORT', '3000'))
WS_PORT = int(os.getenv('TERMINAL_WS_PORT', '8080'))
CDP_PORT = int(os.getenv('TERMINAL_CDP_PORT', '9222'))
store = MarketStore(os.getenv('TERMINAL_DATA_DIR', str(ROOT)))
clients = set()
refresh = asyncio.Event()
status = {'type': 'bridge_status', 'state': 'connecting', 'last_update': None,
          'message': 'Đang kết nối TradingView', 'symbols': []}

# Symbol metadata is authoritative; titles and sds_N indexes are not symbols.
SNAPSHOT_JS = r'''(() => {
  const collection = window._exposed_chartWidgetCollection;
  if (!collection) throw new Error('TradingView chart collection unavailable');
  const widget = collection.activeChartWidget.value();
  const result = [];
  for (const source of widget.model().dataSources()) {
    try {
      const info = source.symbolInfo?.();
      const resolution = source.interval?.();
      if (!info || !resolution) continue;
      const symbol = String(info.name || info.ticker || '').split(':').pop();
      if (!['NQ1!', 'ES1!', 'YM1!', 'CL1!'].includes(symbol)) continue;
      const bars = source.data?.()?.bars?.() || source.bars?.();
      if (!bars || !bars.size()) continue;
      const output = [];
      const append = value => {
        if (value && value.length >= 5) output.push({time:value[0],open:value[1],high:value[2],low:value[3],close:value[4],volume:value[5] || 0});
      };
      if (__FULL__) bars.each((index,value) => { append(value); });
      else append(bars.valueAt(bars.lastIndex()));
      result.push({symbol, resolution, bars:output, metadata:{
        exchange:info.exchange || info.listed_exchange || '', description:info.description || symbol,
        timezone:info.timezone, session:info.session,
        tickSize:info.minmov / info.pricescale, pointValue:info.pointvalue,
        sessionRegular:(info.subsessions || []).filter(s => s.id === 'us_regular').map(s => ({session:s.session, corrections:s['session-correction'] || ''}))[0] || null,
        holidays:info.session_holidays || ''
      }});
    } catch (error) { result.push({error:String(error)}); }
  }
  return result;
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


def set_status(state, message, **fields):
    status.update(state=state, message=message, **fields)
    publish(status)


async def poll_source():
    delay = 1
    while True:
        reader = None
        try:
            target = await asyncio.to_thread(discover_target)
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
                    available = []
                    for entry in values or []:
                        if entry.get('error'):
                            logging.warning('Source extraction: %s', entry['error'])
                            continue
                        symbol = entry.get('symbol')
                        tf = RESOLUTIONS.get(str(entry.get('resolution')))
                        if symbol not in SYMBOLS or not tf:
                            continue
                        available.append({'symbol': symbol, 'timeframe': tf})
                        store.metadata[symbol] = entry.get('metadata', {})
                        changed = store.merge(symbol, tf, entry.get('bars', []))
                        if full:
                            publish({'type': 'history', 'symbol': symbol, 'timeframe': tf,
                                     'bars': store.data[tf][symbol], 'metadata': store.metadata[symbol], 'source': 'live'})
                        else:
                            for bar in changed:
                                publish({'type': 'tick', 'symbol': symbol, 'timeframe': tf, 'bar': bar})
                    if not available:
                        raise RuntimeError('Chart chưa có nến NQ/ES/YM/CL với metadata hợp lệ')
                    set_status('connected', 'TradingView · đang nhận dữ liệu', symbols=available,
                               last_update=time.time())
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
            set_status('disconnected', str(exc), symbols=[])
        finally:
            if reader:
                reader.cancel()
                await asyncio.gather(reader, return_exceptions=True)
        await asyncio.sleep(delay)
        delay = min(delay * 2, 15)


async def frontend_ws_handler(socket):
    queue = asyncio.Queue(maxsize=64)

    async def send_loop():
        try:
            while True:
                message = await queue.get()
                if message is None:
                    await socket.close(code=1013, reason='Client too slow; reconnect for snapshot')
                    return
                await asyncio.wait_for(socket.send(message), timeout=5)
        except Exception as exc:
            logging.warning('Frontend send failed: %s', exc)
            await socket.close(code=1011, reason='Send failed; reconnect for snapshot')

    sender = None
    try:
        queue.put_nowait(json.dumps(status))
        for tf, symbols in store.data.items():
            for symbol, bars in symbols.items():
                if bars:
                    queue.put_nowait(json.dumps({'type': 'history', 'symbol': symbol, 'timeframe': tf,
                                                'bars': bars, 'metadata': store.metadata.get(symbol), 'source': 'cache'}))
        clients.add(queue)
        sender = asyncio.create_task(send_loop())
        async for raw in socket:
            try:
                request = json.loads(raw)
                if not isinstance(request, dict):
                    raise ValueError('Expected an object')
                if request.get('action') in ('refresh', 'refresh_htf'):
                    refresh.set()
                elif request.get('action') == 'ping':
                    queue.put_nowait(json.dumps({'type': 'pong', 'time': time.time()}))
            except (ValueError, TypeError, asyncio.QueueFull):
                await socket.close(code=1008, reason='Invalid request')
                break
    finally:
        clients.discard(queue)
        if sender:
            sender.cancel()
            await asyncio.gather(sender, return_exceptions=True)


class HTTPHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            body = json.dumps({**status, 'ws_port': WS_PORT}).encode()
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
            await asyncio.to_thread(store.save, copy.deepcopy(store.data), copy.deepcopy(store.metadata))
        except OSError:
            logging.exception('Could not persist market data')


async def main():
    store.load()
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
                tasks.append(asyncio.create_task(poll_source()))
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
