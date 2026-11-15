document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const saved = Workspace.read('terminal_workspace_v1', {});
  const colors = { bg: '#c2baae', grid: '#a8a194', bodyUp: '#e8e4dc', borderUp: '#211f1d', wickUp: '#211f1d', bodyDown: '#211f1d', borderDown: '#211f1d', wickDown: '#211f1d', textColor: '#202020', ...Workspace.read('tv_candle_config', {}) };
  const symbols = ['NQ1!', 'ES1!', 'YM1!', 'CL1!'];
  const cache = new Map();
  let bridge = { state: 'connecting', symbols: [] };
  let socket, reconnect, retry = 1000,preloadRequested=false;
  const pendingNative=new Map();
  const requestNative=requirement=>{
    const key=requirement.symbol+':'+requirement.timeframe;
    if(pendingNative.has(key))return;pendingNative.set(key,requirement);
    if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({action:'request_native',charts:[requirement]}));
  };
  for(let i=4;i<=16;i++){const node=$('box-1').cloneNode(true);node.id=`box-${i}`;node.classList.remove('active');$('chart-grid').appendChild(node);}
  let features,replay;
  const charts = Array.from({length:16},(_,i)=>['NQ1!','ES1!','YM1!'][i%3]).map((symbol, i) => {
    const Engine=window.TERMINAL_ENGINE_V5?ChartEngineV5:ChartEngine;
    const c = new Engine($(`box-${i + 1}`), symbols.includes(saved.charts?.[i]?.symbol) ? saved.charts[i].symbol : symbol, colors);
    c.id = `box-${i + 1}`;
    c.currentTimeframe = TF_MAP[saved.charts?.[i]?.timeframe] ? saved.charts[i].timeframe : '1m';
    c.tfSeconds = TF_MAP[c.currentTimeframe];
    c.savedRange = saved.charts?.[i]?.range;
    c.sessionMode = saved.charts?.[i]?.sessionMode === 'RTH' ? 'RTH' : 'ETH';
    const badge=document.createElement('span');badge.className='chart-data-status';badge.hidden=true;c.container.appendChild(badge);c.sourceBadge=badge;
    return c;
  });
  window.charts = charts;
  if(window.TERMINAL_ENGINE_V5){
    const badge=document.createElement('a');badge.className='v5-preview-badge';badge.textContent='v5 · vùng thử';badge.href='line-tools-lab.html';badge.title='Mở trang thử Rectangle/Fib/Position';document.querySelector('header').appendChild(badge);
  }
  const sync = new SyncController();
  window.syncCtrl = sync;
  charts.forEach(c => sync.register(c));
  const drawing = new DrawingManager();
  window.drawingMgr = drawing;
  charts.forEach(c => drawing.bindChart(c));
  const grid = $('chart-grid');
  if ([...document.querySelectorAll('.layout-icon-btn')].some(b => b.dataset.layout === saved.layout)) grid.className = saved.layout;
  let active = charts.find(c => c.id === saved.active) || charts[0];
  let saveTimer,desktop;
  function saveWorkspace() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => Workspace.write('terminal_workspace_v1', { active: active.id, layout: grid.className, charts: charts.map(c => ({ symbol: c.symbol, timeframe: c.currentTimeframe, sessionMode: c.sessionMode, range: c.savedRange || c.chart.timeScale().getVisibleLogicalRange() })) }), 250);
  }
  function toast(message, type = 'info') {
    const el = document.createElement('div'); el.className = `tv-toast ${type}`; el.textContent = message;
    $('toast-container').appendChild(el); if(type!=='alert'||active?.appearance?.hideToasts!==false)setTimeout(() => el.remove(), 5000); else {el.tabIndex=0;el.title='Click to dismiss';el.onclick=()=>el.remove();el.onkeydown=e=>{if(e.key==='Enter')el.remove();};}
  }
  window.showToast = toast;
  window.addEventListener('storage-error', event => toast(event.detail, 'alert'));
  function showModal(id) {
    const modal = $(id); modal.classList.add('show'); modal.dataset.opener = document.activeElement?.id || '';
    modal.querySelector('input, textarea, select, button')?.focus();
  }
  function closeModal(modal) { modal.classList.remove('show'); $(modal.dataset.opener)?.focus(); }
  document.querySelectorAll('.modal').forEach(modal => {
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
    modal.addEventListener('click', event => { if (modal.id!=='settings-modal' && event.target === modal) closeModal(modal); });
    if(modal.id!=='settings-modal')modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal(modal));
  });
  function live(symbol) {
    const bar = cache.get(symbol)?.['1m']?.at(-1);
    return !!bar && Math.abs(Date.now() / 1000 - bar.time) < 180 && bridge.state === 'connected' && bridge.sources?.some(item => item.symbol === symbol && item.timeframe === '1m' && Date.now()/1000-item.updated<8);
  }
  function updateHeader() {
    for(const c of charts){c.container.setAttribute('role','region');c.container.setAttribute('aria-label',`${c.symbol} · ${c.currentTimeframe} · ${c.replayMode?'Replay':'Live'}`);}
    $('active-symbol-title').textContent = active.symbol;
    const badge=$('btn-symbol-search').querySelector('.badge-circle');
    if(badge.dataset.symbol!==active.symbol){
      badge.dataset.symbol=active.symbol;
      if(active.symbolBadge&&!active.symbolBadge.hidden){
        const icon=active.symbolBadge.cloneNode(false);
        icon.removeAttribute('class');
        icon.removeAttribute('style');
        icon.alt='';
        badge.replaceChildren(icon);
      }else{
        badge.textContent=active.symbol==='CL1!'?'OIL':active.symbol.slice(0,2);
      }
    }
    replay?.updateTimeframe();
    $('session-mode').value = active.sessionMode;
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.toggle('active', b.dataset.tf === active.currentTimeframe));
    $('timeframe-quick').value=active.currentTimeframe;
    const bar = cache.get(active.symbol)?.['1m']?.at(-1);
    const text = bar ? bar.close.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—';
    $('price-buy').textContent = text; $('price-sell').textContent = text;
    $('trade-spread').textContent = 'LAST';
    $('btn-trade-buy').classList.toggle('unavailable', !bar || (!active.replayMode&&!live(active.symbol)));
    $('btn-trade-sell').classList.toggle('unavailable', !bar || (!active.replayMode&&!live(active.symbol)));
    document.title = `${active.symbol} · Trading Terminal`;
    $('timezone-quick').value = active.appearance?.timezone || 'America/New_York';
  }
  function activate(chart) {
    active = chart; window.currentActiveChart = chart;
    chart.container.appendChild(document.querySelector('.tv-trade-pill'));
    document.querySelector('.tv-trade-pill').hidden=chart.appearance?.buySell===false;
    charts.forEach(c => c.container.classList.toggle('active', c === chart));
    updateHeader(); saveWorkspace();if(desktop){desktop.hoverBar=null;desktop.signature='';desktop.refresh();}
  }
  const indicatorSettings=new IndicatorSettings((chart,settings,view,id)=>{
    const entry=chart.runner.entries.find(e=>e.record.id===id);
    return !!entry&&chart.runner.update(id,{settings,view});
  });
  let indicatorLibrary;
  const indicatorSettingsButton=document.createElement('button');indicatorSettingsButton.id='btn-indicator-settings';indicatorSettingsButton.className='btn-icon';indicatorSettingsButton.textContent='⚙';indicatorSettingsButton.title='Indicator settings';indicatorSettingsButton.setAttribute('aria-label','Active indicator settings');
  $('btn-indicator').after(indicatorSettingsButton);indicatorSettingsButton.onclick=()=>indicatorSettings.open(active);
  for (const chart of charts) {
    chart.onIndicatorSettings=()=>{activate(chart);indicatorSettings.open(chart);};
    chart.container.addEventListener('pointerdown', () => activate(chart));
    chart.container.addEventListener('chart-activate', () => activate(chart));
    chart.sessionMode ||= 'ETH';
    chart.onIndicatorDataRequired=requestNative;
    chart.runner = new IndicatorCollection(chart, options => ({
      ...(options?.markets?{markets:replay?.running?replay.markets(cache):Object.fromEntries(cache)}:{}),
      ...(options?.viewport?{viewport:chart.chart.timeScale().getVisibleRange()}:{}),
    }), (message,instanceId) => {
    chart.indicatorStatus = message; indicatorLibrary?.report(message,chart,instanceId);
    });
    chart.onDataChange = () => chart.runner.schedule();
    chart.chart.timeScale().subscribeVisibleLogicalRangeChange(() => { saveWorkspace(); chart.runner.schedule({viewport:true}); });
    chart.onIndicatorEdit=id=>{activate(chart);indicatorLibrary.open(chart,id);};
  }
  activate(active);
  const changeTimeframe=tf=>{
    if(tf==='12h')return toast('Nguồn TradingView hiện chặn custom interval 12h; các chart khác vẫn cập nhật.','alert');
    if(tf==='6h')requestNative({symbol:active.symbol,timeframe:'6h'});
    (sync.options.interval ? features.visibleCharts() : [active]).forEach(c => c.setTimeframe(tf));
    replay?.refresh();features?.subscribe();
    updateHeader(); saveWorkspace();
  };
  document.querySelectorAll('.tf-btn').forEach(button => button.addEventListener('click', () => changeTimeframe(button.dataset.tf)));
  $('timeframe-quick').addEventListener('change',event=>changeTimeframe(event.target.value));
  $('session-mode').addEventListener('change', event => {
    stopReplay(); active.sessionMode = event.target.value; active.renderCurrentTimeframe(); saveWorkspace();
    if (active.sessionMode === 'RTH') toast(active.metadata.sessionRegular ? 'RTH dùng lịch phiên từ TradingView; lịch sử giới hạn theo nến 1m đã tải.' : 'Đang chờ metadata phiên RTH từ TradingView.');
  });
  document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => drawing.setTool(button.dataset.tool)));
  const renderSyncButton=()=>{$('btn-sync').innerHTML=TerminalIcons.svg('link')+`<span>Sync: ${sync.syncEnabled?'ON':'OFF'}</span>`;$('btn-sync').setAttribute('aria-pressed',String(sync.syncEnabled));};
  renderSyncButton();
  $('btn-sync').addEventListener('click', () => {sync.toggleSync($('btn-sync'));renderSyncButton();});
  $('btn-layout').addEventListener('click', event => { event.stopPropagation(); $('layout-popover').classList.toggle('show'); });
  document.querySelectorAll('.layout-icon-btn').forEach(button => button.addEventListener('click', () => {
    grid.className = button.dataset.layout;
    document.querySelectorAll('.layout-icon-btn').forEach(b => b.classList.toggle('active', b === button));
    $('layout-popover').classList.remove('show'); saveWorkspace();
  }));
  document.addEventListener('click', event => { if (!event.target.closest('#layout-popover, #btn-layout')) $('layout-popover').classList.remove('show'); });
  $('btn-fullscreen').addEventListener('click', () => {
    (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(error => toast(error.message, 'alert'));
  });

  // Symbol changes restore independent data and drawings; labels never relabel old candles.
  function hydrate(chart) {
    const data = cache.get(chart.symbol) || {};
    if(replay?.running&&replay.targets?.includes(chart)){chart.replayMode=true;chart.replayClock=replay.clock;}
    chart.metadata = data.metadata || {};
    chart.setData(data['1m'] || []);
    for (const [tf, bars] of Object.entries(data)) if (TF_MAP[tf] && tf !== '1m') chart.setHtfData(tf, bars);
    if (chart.savedRange && chart.bars.length) { chart.chart.timeScale().setVisibleLogicalRange(chart.savedRange); chart.savedRange = null; }
  }
  function changeSymbol(c,symbol){drawing.saveDrawings(c);c.runner.stop();c.clearCustomSeries();c.symbol=symbol;c.clearData();drawing.loadDrawings(c);hydrate(c);c.runner.restart();}
  $('btn-symbol-search').addEventListener('click', () => { showModal('symbol-modal'); $('symbol-search-input').value = ''; $('symbol-search-input').focus(); });
  $('symbol-search-input').addEventListener('input', event => document.querySelectorAll('.symbol-item').forEach(el => { el.hidden = !el.textContent.toLowerCase().includes(event.target.value.toLowerCase()); }));
  document.querySelectorAll('.symbol-item').forEach(item => item.addEventListener('click', () => {
    drawing.saveDrawings(active); drawing.setTool('crosshair');
    drawing.editor.clear(); active.runner.stop(); active.clearCustomSeries(); active.symbol = item.dataset.sym; active.clearData();
    drawing.loadDrawings(active); hydrate(active);refreshAlertLines();renderPaper();
    active.runner.restart();
    if(sync.options.symbol)for(const c of features.visibleCharts()){if(c!==active)changeSymbol(c,active.symbol);}
    features?.subscribe();replay?.refresh();
    closeModal($('symbol-modal')); updateHeader(); saveWorkspace();
  }));

  indicatorLibrary=new IndicatorLibrary({getChart:()=>active,openSettings:(chart,id)=>{chart.runner.select(id);indicatorSettings.open(chart);},onChange:()=>{updateHeader();if(desktop){desktop.signature='';desktop.refresh();}}});
  indicatorLibrary.migrate(charts);
  $('btn-indicator').addEventListener('click',()=>indicatorLibrary.open());

  function stopReplay(){replay?.stop();}
  function replayNext(){replay?.step(1);}

  // Price alerts survive reload; cross compares both sides of the threshold.
  let alerts = Workspace.read('terminal_alerts_v1', []);
  if (!Array.isArray(alerts)) alerts = [];
  alerts=alerts.filter(a=>a&&Number.isFinite(a.price)&&symbols.includes(a.symbol)).map(a=>({...a,id:a.id||crypto.randomUUID()}));
  Workspace.write('terminal_alerts_v1',alerts);
  const previousPrices = new Map();let alertEdit=null;
  function openAlert(chart,price,id=null){
    activate(chart);const existing=alerts.find(a=>a.id===id);alertEdit={id:existing?.id,symbol:existing?.symbol||chart.symbol,chart,tick:cache.get(existing?.symbol||chart.symbol)?.metadata?.tickSize||chart.metadata.tickSize||.01};
    $('alert-sym-label').textContent=alertEdit.symbol;$('alert-price-input').value=existing?.price??(Number.isFinite(price)?price:(cache.get(chart.symbol)?.['1m']?.at(-1)?.close??''));
    $('alert-price-input').step=alertEdit.tick;$('alert-condition').value=existing?.condition||'cross';
    $('btn-save-alert').textContent=existing?'Lưu cảnh báo':'Đặt Cảnh Báo';$('btn-delete-alert').hidden=!existing;$('alert-modal-title').textContent=existing?'Chỉnh cảnh báo giá':'Tạo cảnh báo giá';$('alert-rearm-row').hidden=!existing?.triggered;$('alert-rearm').checked=false;showModal('alert-modal');
  }
  function saveAlerts(next){if(!Workspace.write('terminal_alerts_v1',next))return false;alerts=next;refreshAlertLines();return true;}
  function removeAlert(id){return saveAlerts(alerts.filter(a=>a.id!==id));}
  $('btn-delete-alert').addEventListener('click',()=>{if(alertEdit?.id&&removeAlert(alertEdit.id))closeModal($('alert-modal'));});
  function updateAlert(id,price,original){
    const a=alerts.find(a=>a.id===id);if(!a||a.price!==original)return toast('Alert đã đổi; bỏ thao tác kéo.','alert');
    saveAlerts(alerts.map(a=>a.id===id?{...a,price}:a));
  }
  charts.forEach(c=>c.alertOverlay=new AlertChartControls(c,{getAlerts:()=>alerts,canDrag:()=>drawing.activeTool==='crosshair',update:updateAlert,remove:removeAlert,edit:(id,chart)=>openAlert(chart,undefined,id)}));
  $('btn-alert').addEventListener('click',()=>openAlert(active));
  $('btn-save-alert').addEventListener('click',()=>{
    const price=Number($('alert-price-input').value);if(!alertEdit||!Number.isFinite(price)||!$('alert-price-input').value)return toast('Nhập giá hợp lệ','alert');
    const value=AlertPrice.round(price,alertEdit.tick),condition=$('alert-condition').value;
    const existing=alerts.find(a=>a.id===alertEdit.id);if(alertEdit.id&&!existing)return toast('Alert đã bị xóa.','alert');
    const next=existing?alerts.map(a=>a.id===existing.id?{...a,price:value,condition,triggered:$('alert-rearm').checked?false:a.triggered}:a):[...alerts,{id:crypto.randomUUID(),symbol:alertEdit.symbol,price:value,condition,triggered:false}];
    if(saveAlerts(next)){closeModal($('alert-modal'));toast('Đã lưu cảnh báo giá');}
  });
  function refreshAlertLines(){charts.forEach(c=>{c.priceAlerts=alerts.filter(a=>a.symbol===c.symbol);c.renderDrawings();});desktop?.refresh();}
  function checkAlerts(symbol,price){
    const previous=previousPrices.get(symbol);previousPrices.set(symbol,price);
    const dragging=new Set(charts.map(c=>c.alertOverlay?.drag?.id));
    const next=alerts.map(a=>{
      if(a.symbol!==symbol||a.triggered||dragging.has(a.id)||!AlertPrice.crossed(a,previous,price))return a;
      toast(`${symbol} chạm ${a.price}`,'alert');return {...a,triggered:true};
    });
    if(next.some((a,i)=>a!==alerts[i]))saveAlerts(next);
  }

  // Local accounts retain the existing storage key and legacy positions.
  const paper = new PaperTrading(Workspace.read('terminal_paper_v1', { accounts: [], active: null }), state => Workspace.write('terminal_paper_v1', state));
  const paperPanel=new PaperPanel({paper,charts,getActive:()=>active,isLive:live,isReplay:()=>!!replay?.running,toast});
  function renderPaper(){paperPanel.render();}
  $('create-account').addEventListener('click',()=>paperPanel.action(()=>{paperPanel.paper.create($('account-name').value,Number($('account-balance').value),Number($('account-margin').value));closeModal($('account-modal'));}));
  $('btn-paper').addEventListener('click',()=>paperPanel.open(!$('paper-panel').classList.contains('open')));
  $('btn-trade-buy').addEventListener('click',()=>paperPanel.submit('buy'));
  $('btn-trade-sell').addEventListener('click',()=>paperPanel.submit('sell'));

  function toggleIndicator(chart){chart.runner.toggle();}
  charts.forEach(c=>c.onIndicatorToggle=()=>toggleIndicator(c));

  // Settings and scale controls.
  const appearanceStore=Workspace.read('terminal_chart_settings_v1',{});
  const oldProfiles=structuredClone(appearanceStore);
  charts.forEach(c=>{const profile=ChartAppearance.desktopProfile(appearanceStore[c.id],colors,c.symbol);appearanceStore[c.id]=profile;ChartAppearance.apply(c,profile);});
  if(JSON.stringify(oldProfiles)!==JSON.stringify(appearanceStore)){
    const backupKey='terminal_desktop_appearance_before_v1';
    if(Workspace.read(backupKey,null)||Workspace.write(backupKey,{profiles:oldProfiles,legacyColors:colors}))Workspace.write('terminal_chart_settings_v1',appearanceStore);
  }
  const chartSettings=new ChartSettings(()=>active,(chart,settings)=>{
    const next={...Workspace.read('terminal_chart_settings_v1',{}),[chart.id]:settings};
    if(!Workspace.write('terminal_chart_settings_v1',next))return false;
    Object.assign(appearanceStore,next);ChartAppearance.apply(chart,settings);
    if(chart.sessionMode!==settings.session){stopReplay();chart.sessionMode=settings.session;chart.renderCurrentTimeframe();saveWorkspace();}
    updateHeader();return true;
  });
  $('btn-settings').addEventListener('click',()=>chartSettings.open());
  charts.forEach(c=>c.onChartSettings=()=>{activate(c);chartSettings.open();});
  $('timezone-quick').addEventListener('change',event=>{
    const settings={...active.appearance,timezone:event.target.value,session:active.sessionMode};
    if(chartSettings.onCommit(active,settings)===false)event.target.value=active.appearance?.timezone||'America/New_York';
    updateHeader();
  });
  desktop=new DesktopShell({charts,getActive:()=>active,getMarkets:()=>cache,getAlerts:()=>alerts,drawing,onIndicatorToggle:toggleIndicator,onSymbol:symbol=>document.querySelector(`.symbol-item[data-sym="${symbol}"]`)?.click(),onAlertEdit:id=>{const a=alerts.find(a=>a.id===id);if(a)openAlert(charts.find(c=>c.symbol===a.symbol)||active,undefined,id);},onAlertRemove:index=>saveAlerts(alerts.filter((_,i)=>i!==index))});
  new ToolbarClusters(()=>chartSettings.open(),()=>{desktop.fitToolbar?.();charts.forEach(c=>c.positionSymbolBadge());});
  new ChartContextMenu({charts,drawing,desktop,activate,openAlert});
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { document.querySelectorAll('.modal.show:not(#settings-modal)').forEach(closeModal); $('layout-popover').classList.remove('show'); }
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.altKey && event.key.toLowerCase() === 'r') { event.preventDefault(); sync.syncEnabled ? sync.resetAllCharts() : active.resetView(); }
    if (event.altKey && event.key.toLowerCase() === 'a') { event.preventDefault(); openAlert(active); }
    if (event.key === 'F10') { event.preventDefault(); replayNext(); }
  });

  function statusText() {
    const stale=bridge.state==='connected'&&Date.now()/1000-bridge.last_update>5,now=Date.now()/1000;
    const inSession=TerminalTime.activeSession(now,active.metadata),sourceError=(bridge.sources||[]).find(s=>s.symbol===active.symbol&&s.timeframe===active.currentTimeframe&&s.error);
    $('connection-status').dataset.state=sourceError?'disconnected':stale&&inSession?'stale':bridge.state;
    const loading=bridge.native_loading;
    $('connection-status').textContent=loading?.state==='loading'?`Đang nạp ${loading.timeframe} · ${(loading.completed?.length||0)+1}/${(loading.completed?.length||0)+(loading.remaining?.length||0)+1}`:bridge.state==='backend_error'?bridge.message:active.currentTimeframe==='6h'?'6h ghép 1h · dữ liệu đã lưu':sourceError?'Lỗi nguồn · dữ liệu đã lưu':bridge.state==='connected'&&!inSession?'Nghỉ phiên · giữ giá cuối':stale?'Nguồn gián đoạn · dữ liệu đã lưu':bridge.state==='connected'?'TradingView · đã kết nối':bridge.state==='connecting'?'Đang kết nối…':'Mất nguồn · dữ liệu đã lưu';
    $('connection-status').title=active.currentTimeframe==='6h'?'6h ghép từ nến native 1h, căn theo phiên nguồn':sourceError?.error||bridge.message||'';
    charts.forEach(c=>{const source=(bridge.sources||[]).find(s=>s.symbol===c.symbol&&s.timeframe===c.currentTimeframe);c.marketLive=bridge.state==='connected'&&source&&!source.error&&now-source.updated<8;const closed=!TerminalTime.activeSession(now,c.metadata);c.sourceBadge.hidden=c.marketLive||(closed&&bridge.state==='connected'&&!source?.error)||c.replayMode;c.sourceBadge.textContent=source?.error?`${c.symbol} · lỗi nguồn`:`${c.symbol} · ${c.bars.length?'dữ liệu đã lưu':'chờ nguồn'}`;c.sourceBadge.title=source?.error||'';if(c.symbolBadge)c.symbolBadge.title=c.marketLive?`${c.symbol} · Live`:closed?'Nghỉ phiên':c.sourceBadge.textContent;if(c.appearance?.marketStatus)c.updateLegend(c.bars.at(-1));if(!c.container.hidden)c.updateCountdown?.();});
    updateHeader();desktop?.refresh();
  }
  function receive(message) {
    if (message.type === 'bridge_status') { bridge = message;if(!preloadRequested&&socket?.readyState===WebSocket.OPEN){preloadRequested=true;if(!['loading','waiting'].includes(bridge.native_loading?.state))socket.send(JSON.stringify({action:'preload_native'}));} statusText(); return; }
    if (message.type === 'htf_history') { for (const [tf, data] of Object.entries(message.data || {})) for (const [symbol, bars] of Object.entries(data)) receive({ type: 'history', symbol, timeframe: tf, bars }); return; }
    const { symbol, type } = message, tf = message.timeframe || '1m';
    if (!symbols.includes(symbol) || !TF_MAP[tf] || !['history', 'tick'].includes(type)) return;
    const data = cache.get(symbol) || {};
    if (message.metadata) data.metadata = message.metadata;
    const previousBars=data[tf];
    data[tf]=BridgeProtocol.bars(previousBars,message);
    if(data[tf]?.length)pendingNative.delete(symbol+':'+tf);
    cache.set(symbol, data);
    if(data[tf]===previousBars)return;
    if(replay)replay.marketVersion=(replay.marketVersion||0)+1;
    for (const c of charts.filter(c => c.symbol === symbol)) {
      c.metadata = data.metadata || c.metadata;
      if(c.container.hidden){if(tf==='1m')c.rawBars=data[tf];else c.htfData[tf]=data[tf];continue;}
      if (tf === '1m' && type === 'tick') c.updateBar(message.bar);
      else if (tf === '1m') c.setData(data[tf]);
      else c.setHtfData(tf, data[tf]);
      if (c.savedRange && c.bars.length) { c.chart.timeScale().setVisibleLogicalRange(c.savedRange); c.savedRange = null; }
    }
    // All indicators can depend on other symbols, even when no chart displays those symbols.
    charts.filter(c => c.symbol !== symbol&&!c.container.hidden).forEach(c => c.runner.schedule());
    if (tf === '1m' && type === 'tick' && live(symbol)) { paper.tick(symbol, message.bar.close); checkAlerts(symbol, message.bar.close); renderPaper(); }
    if (tf === '1m' && type === 'history' && message.source === 'live' && live(symbol) && data[tf].length) { paper.quotes.set(symbol, { price: data[tf].at(-1).close, received: Date.now() }); renderPaper(); }
    replay?.refresh();updateHeader();
  }
  async function connect() {
    clearTimeout(reconnect);
    let port;
    try {
      const response=await fetch('/health',{signal:AbortSignal.timeout(3000),cache:'no-store'});
      if(!response.ok)throw Error(response.status===404?'Backend cũ ở cổng này; chạy lại start_terminal.bat.':`Backend HTTP ${response.status}`);
      port=BridgeProtocol.health(await response.json()).ws_port;
    }catch(error){bridge={state:'backend_error',symbols:[],message:error.message||'Không kết nối được backend'};statusText();reconnect=setTimeout(connect,retry);retry=Math.min(retry*2,15000);return;}
    const wsHost=location.hostname==='localhost'?'127.0.0.1':location.hostname||'127.0.0.1';
    socket = new WebSocket(`ws://${wsHost}:${port}`);
    window.terminalWs = socket;
    socket.onopen = () => { retry = 1000;features?.subscribe();for(const requirement of pendingNative.values())socket.send(JSON.stringify({action:'request_native',charts:[requirement]})); };
    socket.onmessage = event => { try { receive(JSON.parse(event.data)); } catch (error) { console.error(error); toast(`Dữ liệu không hợp lệ: ${error.message}`, 'alert'); } };
    socket.onerror = () => socket.close();
    socket.onclose = () => { bridge = { ...bridge, state: 'disconnected' }; statusText(); reconnect = setTimeout(connect, retry); retry = Math.min(retry * 2, 15000); };
  }
  $('btn-refresh-htf').addEventListener('click', () => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ action: 'refresh' })); else toast('Backend chưa kết nối', 'alert'); });
  features = new TerminalFeatures({charts,sync,drawing,activate,getActive:()=>active,getReplay:()=>replay,hydrate,saveWorkspace,updateHeader,chartSettings,changeSymbol,subscribe:()=>{
    if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({action:'subscribe',charts:features.visibleCharts().map(c=>({symbol:c.symbol,timeframe:c.currentTimeframe}))}));
  }});
  const replayPaper=new ReplayPaper({Paper:PaperTrading,read:()=>Workspace.read('terminal_paper_replay_v1',null),save:state=>Workspace.write('terminal_paper_replay_v1',state)});
  paperPanel.exportReplay=()=>{const blob=new Blob([JSON.stringify(replayPaper.saved,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='paper-replay-sessions.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  let paperReplayClock=null;
  replay = new TerminalReplay({charts,getCharts:()=>features.visibleCharts(),getActive:()=>active,toast,saveWorkspace,onChange:session=>{
    try{paperPanel.replayBlocked=false;if(session.running&&paperReplayClock!=null&&session.clock<paperReplayClock){for(const c of charts)c.paperOverlay?.cancel();paperPanel.reset();paperPanel.closeModal.classList.remove('show');}paperReplayClock=session.running?session.clock:null;if(session.running){replayPaper.seek(session.clock,session.targets.map(c=>({symbol:c.symbol,bars:c.getBarsForTimeframe('1m')})));paperPanel.setPaper(replayPaper.paper);}else{replayPaper.leave();paperPanel.setPaper(paper);}renderPaper();updateHeader();}catch(error){paperPanel.replayBlocked=true;session.pause();paperPanel.render();toast(error.message,'alert');}
  }});
  refreshAlertLines();connect();
  setInterval(() => { const zone=active.appearance?.timezone||'America/New_York';$('live-clock').textContent = new Intl.DateTimeFormat('en-US', { timeZone:zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12:active.appearance?.hourFormat==='12-hours' }).format(new Date((replay?.running?replay.clock:Date.now()/1000)*1000))+' '+zone.split('/').at(-1).replaceAll('_',' ');statusText(); }, 1000);
  window.addEventListener('beforeunload', () => {
    clearTimeout(saveTimer);
    Workspace.write('terminal_workspace_v1', { active: active.id, layout: grid.className, charts: charts.map(c => ({ symbol: c.symbol, timeframe: c.currentTimeframe, sessionMode: c.sessionMode, range: c.savedRange || c.chart.timeScale().getVisibleLogicalRange() })) });
    // Drawings are saved on mutation; an older open tab must not overwrite them on unload.
    charts.forEach(c => c.runner.stop());replay?.persist();
  });
});
