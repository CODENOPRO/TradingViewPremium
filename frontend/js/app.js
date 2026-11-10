document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const saved = Workspace.read('terminal_workspace_v1', {});
  const colors = { bg: '#c2baae', grid: '#a8a194', bodyUp: '#e8e4dc', borderUp: '#211f1d', wickUp: '#211f1d', bodyDown: '#211f1d', borderDown: '#211f1d', wickDown: '#211f1d', textColor: '#202020', ...Workspace.read('tv_candle_config', {}) };
  const symbols = ['NQ1!', 'ES1!', 'YM1!', 'CL1!'];
  const cache = new Map();
  let bridge = { state: 'connecting', symbols: [] };
  let socket, reconnect, retry = 1000, replayTimer, replayChart;
  const charts = ['NQ1!', 'ES1!', 'YM1!'].map((symbol, i) => {
    const c = new ChartEngine($(`box-${i + 1}`), symbols.includes(saved.charts?.[i]?.symbol) ? saved.charts[i].symbol : symbol, colors);
    c.id = `box-${i + 1}`;
    c.currentTimeframe = TF_MAP[saved.charts?.[i]?.timeframe] ? saved.charts[i].timeframe : '1m';
    c.tfSeconds = TF_MAP[c.currentTimeframe];
    c.savedRange = saved.charts?.[i]?.range;
    c.sessionMode = saved.charts?.[i]?.sessionMode === 'RTH' ? 'RTH' : 'ETH';
    return c;
  });
  window.charts = charts;
  const sync = new SyncController();
  window.syncCtrl = sync;
  charts.forEach(c => sync.register(c));
  const drawing = new DrawingManager();
  window.drawingMgr = drawing;
  charts.forEach(c => drawing.bindChart(c));
  const grid = $('chart-grid');
  if ([...document.querySelectorAll('.layout-icon-btn')].some(b => b.dataset.layout === saved.layout)) grid.className = saved.layout;
  let active = charts.find(c => c.id === saved.active) || charts[0];
  let saveTimer;
  function saveWorkspace() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => Workspace.write('terminal_workspace_v1', { active: active.id, layout: grid.className, charts: charts.map(c => ({ symbol: c.symbol, timeframe: c.currentTimeframe, sessionMode: c.sessionMode, range: c.savedRange || c.chart.timeScale().getVisibleLogicalRange() })) }), 250);
  }
  function toast(message, type = 'info') {
    const el = document.createElement('div'); el.className = `tv-toast ${type}`; el.textContent = message;
    $('toast-container').appendChild(el); setTimeout(() => el.remove(), 5000);
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
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal); });
    modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal(modal));
  });
  function live(symbol) {
    const bar = cache.get(symbol)?.['1m']?.at(-1);
    return !!bar && Math.abs(Date.now() / 1000 - bar.time) < 180 && bridge.state === 'connected' && Date.now() / 1000 - bridge.last_update < 5 && bridge.symbols?.some(item => item.symbol === symbol && item.timeframe === '1m');
  }
  function updateHeader() {
    $('active-symbol-title').textContent = active.symbol;
    $('session-mode').value = active.sessionMode;
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.toggle('active', b.dataset.tf === active.currentTimeframe));
    const bar = cache.get(active.symbol)?.['1m']?.at(-1);
    const text = bar ? bar.close.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—';
    $('price-buy').textContent = text; $('price-sell').textContent = text;
    $('trade-spread').textContent = 'LAST';
    $('btn-trade-buy').classList.toggle('unavailable', !bar || !live(active.symbol) || active.replayMode);
    $('btn-trade-sell').classList.toggle('unavailable', !bar || !live(active.symbol) || active.replayMode);
    document.title = `${active.symbol} · Trading Terminal`;
    $('indicator-status').textContent = active.indicatorStatus || 'Chưa có indicator';
  }
  function activate(chart) {
    active = chart; window.currentActiveChart = chart;
    chart.container.appendChild(document.querySelector('.tv-trade-pill'));
    charts.forEach(c => c.container.classList.toggle('active', c === chart));
    updateHeader(); saveWorkspace();
  }
  for (const chart of charts) {
    chart.container.addEventListener('pointerdown', () => activate(chart));
    chart.container.addEventListener('chart-activate', () => activate(chart));
    chart.sessionMode ||= 'ETH';
    chart.runner = new IndicatorRunner(chart, () => ({ markets: Object.fromEntries(cache), viewport: chart.chart.timeScale().getVisibleRange() }), message => {
      chart.indicatorStatus = message; if (chart === active) $('indicator-status').textContent = message;
    });
    chart.onDataChange = () => chart.runner.schedule();
    chart.chart.timeScale().subscribeVisibleLogicalRangeChange(() => { saveWorkspace(); chart.runner.schedule(); });
    const script = Workspace.read(`indicator_${chart.id}`, null);
    if (script?.code) chart.runner.load(script.code, script.settings);
  }
  activate(active);
  document.querySelectorAll('.tf-btn').forEach(button => button.addEventListener('click', () => {
    stopReplay();
    (sync.syncEnabled ? charts : [active]).forEach(c => c.setTimeframe(button.dataset.tf));
    updateHeader(); saveWorkspace();
  }));
  $('session-mode').addEventListener('change', event => {
    stopReplay(); active.sessionMode = event.target.value; active.renderCurrentTimeframe(); saveWorkspace();
    if (active.sessionMode === 'RTH') toast(active.metadata.sessionRegular ? 'RTH dùng lịch phiên từ TradingView; lịch sử giới hạn theo nến 1m đã tải.' : 'Đang chờ metadata phiên RTH từ TradingView.');
  });
  document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => drawing.setTool(button.dataset.tool)));
  document.querySelectorAll('.range-btn').forEach(button => button.addEventListener('click', () => (sync.syncEnabled ? charts : [active]).forEach(c => c.setRange(button.textContent))));
  $('btn-sync').addEventListener('click', () => sync.toggleSync($('btn-sync')));
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
    chart.metadata = data.metadata || {};
    chart.setData(data['1m'] || []);
    for (const [tf, bars] of Object.entries(data)) if (TF_MAP[tf] && tf !== '1m') chart.setHtfData(tf, bars);
    if (chart.savedRange && chart.bars.length) { chart.chart.timeScale().setVisibleLogicalRange(chart.savedRange); chart.savedRange = null; }
  }
  $('btn-symbol-search').addEventListener('click', () => { showModal('symbol-modal'); $('symbol-search-input').value = ''; $('symbol-search-input').focus(); });
  $('symbol-search-input').addEventListener('input', event => document.querySelectorAll('.symbol-item').forEach(el => { el.hidden = !el.textContent.toLowerCase().includes(event.target.value.toLowerCase()); }));
  document.querySelectorAll('.symbol-item').forEach(item => item.addEventListener('click', () => {
    stopReplay(); drawing.saveDrawings(active); drawing.setTool('crosshair');
    drawing.editor.clear(); active.runner.stop(); active.clearCustomSeries(); active.symbol = item.dataset.sym; active.clearData();
    drawing.loadDrawings(active); hydrate(active);
    const script = Workspace.read(`indicator_${active.id}`, null); if (script?.code) active.runner.load(script.code, script.settings);
    closeModal($('symbol-modal')); updateHeader(); saveWorkspace();
  }));

  // The script editor stays empty until the user imports or writes a script.
  $('btn-indicator').addEventListener('click', () => {
    const script = Workspace.read(`indicator_${active.id}`, {}) || {};
    $('indicator-name').value = script.name || '';
    $('indicator-code').value = script.code || '';
    $('indicator-settings').value = JSON.stringify(script.settings || {}, null, 2);
    showModal('indicator-modal');
  });
  $('indicator-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('File vượt 2 MB', 'alert'); return; }
    $('indicator-code').value = await file.text(); $('indicator-name').value = file.name.replace(/\.[^.]+$/, ''); event.target.value = '';
  });
  $('apply-indicator').addEventListener('click', () => {
    try {
      const settings = JSON.parse($('indicator-settings').value || '{}');
      if (!settings || Array.isArray(settings) || typeof settings !== 'object') throw new Error('Settings cần là JSON object.');
      const script = { name: $('indicator-name').value.trim() || 'Custom indicator', code: $('indicator-code').value, settings };
      if (!Workspace.write(`indicator_${active.id}`, script)) return;
      active.runner.load(script.code, script.settings); closeModal($('indicator-modal'));
    } catch (error) { toast(error.message, 'alert'); }
  });
  $('remove-indicator').addEventListener('click', () => {
    active.runner.stop(); active.clearCustomSeries(); Workspace.write(`indicator_${active.id}`, null);
    active.indicatorStatus = 'Chưa có indicator'; updateHeader(); closeModal($('indicator-modal'));
  });

  // Replay owns its display slice. Live data continues in the cache without entering replay.
  function replayDraw() {
    if (!replayChart) return;
    replayChart.renderCurrentTimeframe(false);
    $('replay-position').textContent = `${replayChart.symbol} · ${replayChart.replayIndex}/${replayChart.getBarsForTimeframe(replayChart.currentTimeframe).length}`;
  }
  function stopReplay() {
    clearInterval(replayTimer); replayTimer = null;
    if (replayChart) { replayChart.replayMode = false; replayChart.renderCurrentTimeframe(false); }
    replayChart = null; $('replay-toolbar').classList.remove('show'); $('btn-replay-play').textContent = '▶ Play';
  }
  $('btn-replay').addEventListener('click', () => {
    if (replayChart) { stopReplay(); return; }
    if (active.bars.length < 2) return toast('Chưa đủ nến để replay', 'alert');
    replayChart = active; active.replayMode = true; active.replayIndex = Math.max(1, active.bars.length - 25);
    $('replay-toolbar').classList.add('show'); replayDraw(); updateHeader();
  });
  function replayNext() {
    if (!replayChart) return;
    replayChart.replayIndex = Math.min(replayChart.replayIndex + 1, replayChart.getBarsForTimeframe(replayChart.currentTimeframe).length); replayDraw();
  }
  $('btn-replay-prev').addEventListener('click', () => { if (replayChart) { replayChart.replayIndex = Math.max(1, replayChart.replayIndex - 1); replayDraw(); } });
  $('btn-replay-next').addEventListener('click', replayNext);
  $('btn-replay-exit').addEventListener('click', () => { stopReplay(); updateHeader(); });
  $('btn-replay-play').addEventListener('click', () => {
    if (replayTimer) { clearInterval(replayTimer); replayTimer = null; $('btn-replay-play').textContent = '▶ Play'; }
    else { replayTimer = setInterval(replayNext, 600); $('btn-replay-play').textContent = 'Ⅱ Pause'; }
  });

  // Price alerts survive reload; cross compares both sides of the threshold.
  let alerts = Workspace.read('terminal_alerts_v1', []);
  if (!Array.isArray(alerts)) alerts = [];
  const previousPrices = new Map();
  $('btn-alert').addEventListener('click', () => { $('alert-sym-label').textContent = active.symbol; $('alert-price-input').value = cache.get(active.symbol)?.['1m']?.at(-1)?.close || ''; showModal('alert-modal'); });
  $('btn-save-alert').addEventListener('click', () => {
    const price = Number($('alert-price-input').value); if (!Number.isFinite(price) || !$('alert-price-input').value) return toast('Nhập giá hợp lệ', 'alert');
    alerts.push({ symbol: active.symbol, price, condition: $('alert-condition').value, triggered: false });
    Workspace.write('terminal_alerts_v1', alerts); closeModal($('alert-modal')); toast('Đã lưu cảnh báo giá');
  });
  function checkAlerts(symbol, price) {
    const previous = previousPrices.get(symbol); previousPrices.set(symbol, price);
    for (const alert of alerts) {
      if (alert.symbol !== symbol || alert.triggered) continue;
      const hit = alert.condition === 'greater' ? price >= alert.price : alert.condition === 'less' ? price <= alert.price : previous !== undefined && previous !== price && ((previous < alert.price && price >= alert.price) || (previous > alert.price && price <= alert.price));
      if (hit) { alert.triggered = true; toast(`${symbol} chạm ${alert.price}`, 'alert'); Workspace.write('terminal_alerts_v1', alerts); }
    }
  }

  // Local paper accounts use user-selected margin. No broker connection.
  const paper = new PaperTrading(Workspace.read('terminal_paper_v1', { accounts: [], active: null }), state => Workspace.write('terminal_paper_v1', state));
  function renderPaper() {
    const select = $('paper-account'); const value = paper.state.active;
    select.replaceChildren();
    if (!paper.state.accounts.length) select.add(new Option('Tạo tài khoản demo', ''));
    paper.state.accounts.forEach(a => select.add(new Option(a.name, a.id)));
    select.value = value || '';
    const a = paper.account;
    $('paper-balance').textContent = a ? `Balance $${a.balance.toFixed(2)} · Equity $${paper.equity().toFixed(2)} · Free margin $${(paper.equity() - paper.usedMargin()).toFixed(2)}` : 'Chưa có tài khoản';
    const list = $('paper-positions'); list.replaceChildren();
    for (const p of a?.positions || []) {
      const row = document.createElement('div'); row.className = 'paper-row';
      const label = document.createElement('span'); label.textContent = `${p.side.toUpperCase()} ${p.qty} ${p.symbol} @ ${p.price.toFixed(2)}${p.sl ? ' · SL ' + p.sl : ''}${p.tp ? ' · TP ' + p.tp : ''}`;
      const close = document.createElement('button'); close.textContent = 'Đóng'; close.addEventListener('click', () => { try { paper.close(p.id); renderPaper(); } catch (e) { toast(e.message, 'alert'); } });
      row.append(label, close); list.appendChild(row);
    }
    for (const order of a?.orders || []) {
      const row = document.createElement('div'); row.className = 'paper-row'; row.textContent = `${order.type.toUpperCase()} ${order.side.toUpperCase()} ${order.qty} ${order.symbol} @ ${order.price}`;
      const cancel = document.createElement('button'); cancel.textContent = 'Hủy'; cancel.addEventListener('click', () => { paper.cancel(order.id); renderPaper(); }); row.appendChild(cancel); list.appendChild(row);
    }
    charts.forEach(c => { c.positions = (a?.positions || []).filter(p => p.symbol === c.symbol).map(p => ({ ...p, type: p.side })); c.renderDrawings(); });
  }
  $('paper-account').addEventListener('change', event => { paper.state.active = event.target.value; paper.save(); renderPaper(); });
  $('btn-new-account').addEventListener('click', () => showModal('account-modal'));
  $('create-account').addEventListener('click', () => { try { paper.create($('account-name').value, Number($('account-balance').value), Number($('account-margin').value)); closeModal($('account-modal')); renderPaper(); } catch (e) { toast(e.message, 'alert'); } });
  $('btn-paper').addEventListener('click', () => $('paper-panel').classList.toggle('open'));
  function place(side) {
    try {
      if (!live(active.symbol) || active.replayMode) throw new Error('Chờ giá live; không đặt lệnh trong replay hoặc khi mất nguồn.');
      const optional = id => $(id).value.trim() ? Number($(id).value) : null;
      paper.place({ symbol: active.symbol, side, qty: Number($('order-qty').value), type: $('order-type').value, price: optional('order-price'), sl: optional('order-sl'), tp: optional('order-tp') }, active.metadata);
      $('paper-panel').classList.add('open'); renderPaper(); toast('Đã gửi lệnh mô phỏng');
    } catch (error) { toast(error.message, 'alert'); }
  }
  $('btn-trade-buy').addEventListener('click', () => place('buy'));
  $('btn-trade-sell').addEventListener('click', () => place('sell'));
  renderPaper();

  // Settings and scale controls.
  const colorInputs = { 'body-up': 'bodyUp', 'body-down': 'bodyDown', 'border-up': 'borderUp', 'border-down': 'borderDown', 'wick-up': 'wickUp', 'wick-down': 'wickDown', bg: 'bg', grid: 'grid' };
  $('btn-settings').addEventListener('click', () => { Object.entries(colorInputs).forEach(([id, key]) => $(`set-${id}`).value = colors[key]); showModal('settings-modal'); });
  $('save-settings').addEventListener('click', () => {
    Object.entries(colorInputs).forEach(([id, key]) => colors[key] = $(`set-${id}`).value);
    Workspace.write('tv_candle_config', colors);
    charts.forEach(c => { c.config = { ...colors }; c.chart.applyOptions({ layout: { background: { color: colors.bg } }, grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } } }); c.series.applyOptions({ upColor: colors.bodyUp, downColor: colors.bodyDown, borderUpColor: colors.borderUp, borderDownColor: colors.borderDown, wickUpColor: colors.wickUp, wickDownColor: colors.wickDown }); });
    closeModal($('settings-modal'));
  });
  document.querySelectorAll('.scale-toggle').forEach(button => button.addEventListener('click', () => {
    if (button.textContent.trim() === 'auto') active.chart.priceScale('right').applyOptions({ autoScale: true });
    else { const mode = button.textContent.trim() === '%' ? LightweightCharts.PriceScaleMode.Percentage : LightweightCharts.PriceScaleMode.Logarithmic; active.chart.priceScale('right').applyOptions({ mode: button.classList.contains('active') ? 0 : mode }); document.querySelectorAll('.scale-toggle').forEach(b => { if (b !== button) b.classList.remove('active'); }); button.classList.toggle('active'); }
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { document.querySelectorAll('.modal.show').forEach(closeModal); $('layout-popover').classList.remove('show'); }
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.altKey && event.key.toLowerCase() === 'r') { event.preventDefault(); sync.syncEnabled ? sync.resetAllCharts() : active.resetView(); }
    if (event.key === 'F10') { event.preventDefault(); replayNext(); }
  });

  function statusText() {
    const stale = bridge.state === 'connected' && Date.now() / 1000 - bridge.last_update > 5;
    $('connection-status').dataset.state = stale ? 'stale' : bridge.state;
    $('connection-status').textContent = stale ? 'Nguồn chậm · dữ liệu cũ' : bridge.state === 'connected' ? 'TradingView · đã kết nối' : bridge.state === 'connecting' ? 'Đang kết nối…' : 'Mất nguồn · dữ liệu đã lưu';
    $('connection-status').title = bridge.message || '';
    updateHeader();
  }
  function receive(message) {
    if (message.type === 'bridge_status') { bridge = message; statusText(); return; }
    if (message.type === 'htf_history') { for (const [tf, data] of Object.entries(message.data || {})) for (const [symbol, bars] of Object.entries(data)) receive({ type: 'history', symbol, timeframe: tf, bars }); return; }
    const { symbol, type } = message, tf = message.timeframe || '1m';
    if (!symbols.includes(symbol) || !TF_MAP[tf] || !['history', 'tick'].includes(type)) return;
    const data = cache.get(symbol) || {};
    if (message.metadata) data.metadata = message.metadata;
    if (type === 'history') data[tf] = MarketData.clean(message.bars);
    else data[tf] = MarketData.clean([...(data[tf] || []), message.bar]).slice(-1500);
    cache.set(symbol, data);
    for (const c of charts.filter(c => c.symbol === symbol)) {
      c.metadata = data.metadata || c.metadata;
      if (tf === '1m' && type === 'tick') c.updateBar(message.bar);
      else if (tf === '1m') c.setData(data[tf]);
      else c.setHtfData(tf, data[tf]);
      if (c.savedRange && c.bars.length) { c.chart.timeScale().setVisibleLogicalRange(c.savedRange); c.savedRange = null; }
    }
    // All indicators can depend on other symbols, even when no chart displays those symbols.
    charts.filter(c => c.symbol !== symbol).forEach(c => c.runner.schedule());
    if (tf === '1m' && type === 'tick' && live(symbol)) { paper.tick(symbol, message.bar.close); checkAlerts(symbol, message.bar.close); renderPaper(); }
    if (tf === '1m' && type === 'history' && message.source === 'live' && live(symbol) && data[tf].length) { paper.quotes.set(symbol, { price: data[tf].at(-1).close, received: Date.now() }); renderPaper(); }
    updateHeader();
  }
  async function connect() {
    clearTimeout(reconnect);
    let port = 8080;
    try { const response = await fetch('/health', { signal: AbortSignal.timeout(3000) }); const health = await response.json(); port = health.ws_port || port; } catch { /* Old bridge compatibility; status stays disconnected until data arrives. */ }
    socket = new WebSocket(`ws://${location.hostname || 'localhost'}:${port}`);
    window.terminalWs = socket;
    socket.onopen = () => { retry = 1000; };
    socket.onmessage = event => { try { receive(JSON.parse(event.data)); } catch (error) { console.error(error); toast(`Dữ liệu không hợp lệ: ${error.message}`, 'alert'); } };
    socket.onerror = () => socket.close();
    socket.onclose = () => { bridge = { ...bridge, state: 'disconnected' }; statusText(); reconnect = setTimeout(connect, retry); retry = Math.min(retry * 2, 15000); };
  }
  $('btn-refresh-htf').addEventListener('click', () => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ action: 'refresh' })); else toast('Backend chưa kết nối', 'alert'); });
  connect();
  setInterval(() => { $('live-clock').textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()) + ' New York'; statusText(); }, 1000);
  window.addEventListener('beforeunload', () => {
    clearTimeout(saveTimer);
    Workspace.write('terminal_workspace_v1', { active: active.id, layout: grid.className, charts: charts.map(c => ({ symbol: c.symbol, timeframe: c.currentTimeframe, sessionMode: c.sessionMode, range: c.savedRange || c.chart.timeScale().getVisibleLogicalRange() })) });
    // Drawings are saved on mutation; an older open tab must not overwrite them on unload.
    charts.forEach(c => c.runner.stop());
  });
});
