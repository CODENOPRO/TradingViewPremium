document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const saved = Workspace.read('terminal_workspace_v1', {}) || {};
  const colors = { bg: '#c2baae', grid: '#a8a194', bodyUp: '#e8e4dc', borderUp: '#211f1d', wickUp: '#211f1d', bodyDown: '#211f1d', borderDown: '#211f1d', wickDown: '#211f1d', textColor: '#202020', ...(Workspace.read('tv_candle_config', {}) || {}) };
  const symbols = ['NQ1!', 'ES1!', 'YM1!', 'CL1!'];
  const cache = new Map();
  let bridge = { state: 'connecting', symbols: [] };
  let socket, reconnect, retry = 1000, preloadRequested = false;
  let connectionAttempt = 0;
  const pendingNative=new Map();
  const requestNative=requirement=>{
    if(!requirement||!symbols.includes(requirement.symbol)||!TF_MAP[requirement.timeframe]||requirement.timeframe==='12h')return;
    const key=requirement.symbol+':'+requirement.timeframe;
    if(pendingNative.has(key))return;pendingNative.set(key,requirement);
    if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({action:'request_native',charts:[requirement]}));
  };
  for(let i=4;i<=16;i++){const node=$('box-1').cloneNode(true);node.id=`box-${i}`;node.hidden=true;node.style.display='none';node.classList.remove('active');$('chart-grid').appendChild(node);}
  let features,replay,paperPanel;
  const charts = Array.from({length:16},(_,i)=>['NQ1!','ES1!','YM1!'][i%3]).map((symbol, i) => {
    const Engine=window.TERMINAL_ENGINE_V5?ChartEngineV5:ChartEngine;
    const c = new Engine($(`box-${i + 1}`), symbols.includes(saved.charts?.[i]?.symbol) ? saved.charts[i].symbol : symbol, colors);
    c.id = `box-${i + 1}`;
    c.currentTimeframe = TF_MAP[saved.charts?.[i]?.timeframe] ? saved.charts[i].timeframe : '1m';
    c.tfSeconds = TF_MAP[c.currentTimeframe];
    c.savedRange = saved.charts?.[i]?.range;
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
    saveTimer = setTimeout(() => Workspace.write('terminal_workspace_v1', { active: active.id, layout: grid.className, charts: charts.map(c => ({ symbol: c.symbol, timeframe: c.currentTimeframe, range: c.savedRange || c.chart.timeScale().getVisibleLogicalRange() })) }), 250);
  }
  function toast(message, type = 'info') {
    const isAlert=type==='alert'||type==='error';
    const el=document.createElement('div');el.className=`tv-toast ${type}`;el.setAttribute('role',isAlert?'alert':'status');el.setAttribute('aria-live',isAlert?'assertive':'polite');
    if(isAlert){
      const icon=document.createElement('span');icon.className='tv-toast-icon';icon.setAttribute('aria-hidden','true');icon.textContent='!';
      const text=document.createElement('span');text.className='tv-toast-message';text.textContent=ui(message);
      const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='tv-toast-dismiss';dismiss.setAttribute('aria-label',ui('Dismiss notification'));dismiss.textContent='×';dismiss.onclick=()=>el.remove();
      el.append(icon,text,dismiss);
    }else el.textContent=ui(message);
    $('toast-container').appendChild(el);if(type!=='alert'||active?.appearance?.hideToasts!==false)setTimeout(()=>el.remove(),5000);
  }
  window.showToast = toast;
  window.addEventListener('storage-error', event => toast(event.detail, 'alert'));
  function showModal(id) {
    const modal = $(id); modal.classList.add('show'); modal.opener = document.activeElement;
    modal.querySelector('input, textarea, select, button')?.focus();
  }
  function closeModal(modal) {
    if(!modal.classList.contains('show'))return;
    modal.classList.remove('show');
    if (modal.id === 'indicator-modal') modal.dispatchEvent(new Event('close'));
    if(modal.id==='symbol-modal'){
      const input=$('symbol-search-input');
      input.setAttribute('aria-expanded','false');
      input.removeAttribute('aria-activedescendant');
    }
    modal.opener?.focus({preventScroll:true});
  }
  function bindDialogToggle(button, modal, open, close = () => closeModal(modal)) {
    button.setAttribute('aria-haspopup', 'dialog');
    if (modal.id) button.setAttribute('aria-controls', modal.id);
    if (button.tagName !== 'BUTTON') {
      button.setAttribute('role', 'button');
      button.tabIndex = 0;
      button.addEventListener('keydown', event => {
        if (!['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        if (!event.repeat) button.click();
      });
    }
    button.addEventListener('click', () => {
      if (modal.classList.contains('show')) close();
      else open();
    });
    // A modal backdrop can sit above its trigger even while the icon stays visible.
    modal.addEventListener('click', event => {
      if (event.target !== modal || event.detail === 0 || !modal.classList.contains('show')) return;
      const {left, right, top, bottom} = button.getBoundingClientRect();
      if (event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom) return;
      event.stopImmediatePropagation();
      close();
    }, true);
  }
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
      if(active.symbolBadge?.getAttribute('src')){
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
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.toggle('active', b.dataset.tf === active.currentTimeframe));
    const bar = active.replayMode ? active.bars?.at(-1) : cache.get(active.symbol)?.['1m']?.at(-1);
    const tradePrice = active.replayMode ? (paperPanel?.paper?.quotes?.get(active.symbol)?.price ?? bar?.close) : bar?.close;
    const text = Number.isFinite(tradePrice) ? tradePrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—';
    $('price-buy').textContent = text; $('price-sell').textContent = text;
    $('trade-spread').textContent = 'LAST';
    $('btn-trade-buy').classList.toggle('unavailable', !Number.isFinite(tradePrice) || (!active.replayMode&&!live(active.symbol)));
    $('btn-trade-sell').classList.toggle('unavailable', !Number.isFinite(tradePrice) || (!active.replayMode&&!live(active.symbol)));
    document.title = `${active.symbol} · Trading Terminal`;
  }
  function activate(chart) {
    active = chart; window.currentActiveChart = chart;
    document.querySelector('.tv-trade-pill').hidden=chart.appearance?.buySell===false;
    charts.forEach(c => c.container.classList.toggle('active', c === chart));
    updateHeader(); saveWorkspace();if(desktop){desktop.hoverBar=null;desktop.signature='';desktop.refresh();}
  }
  for (const chart of charts) {
    chart.container.tabIndex = 0;
    chart.container.addEventListener('focus', () => {
      if (chart !== active) activate(chart);
    });
    chart.container.addEventListener('pointerdown', event => {
      if (!event.target.closest('button, input, select, textarea, a, [contenteditable], [role="button"]')) {
        chart.container.focus({ preventScroll: true });
      }
      activate(chart);
    });
    chart.container.addEventListener('chart-activate', () => activate(chart));
    chart.onIndicatorDataRequired=requestNative;
    chart.onPreviousDayDataRequired=()=>{
      if(!cache.get(chart.symbol)?.D?.length)requestNative({symbol:chart.symbol,timeframe:'D'});
    };
    chart.chart.timeScale().subscribeVisibleLogicalRangeChange(() => { saveWorkspace(); });
  }
  let qtMode = null;
  try {
    if (typeof QTMode === 'function') {
      qtMode = new QTMode({
        charts,
        getActive: () => active,
        getMarkets: () => replay?.running ? replay.markets(cache) : cache,
        isReplay: () => !!replay?.running,
        requestNative,
        toast
      });
      window.qtMode = qtMode;
      qtMode.mountTopbar($('btn-indicator'));
    }
  } catch (err) {
    console.error('[QTMode] initialization failed:', err);
  }
  activate(active);
  const changeTimeframe=tf=>{
    if(tf==='12h')return toast('Nguồn TradingView hiện chặn custom interval 12h; các chart khác vẫn cập nhật.','alert');
    if(tf==='6h')requestNative({symbol:active.symbol,timeframe:'6h'});
    (sync.options.interval ? features.visibleCharts() : [active]).forEach(c => c.setTimeframe(tf));
    replay?.refresh();features?.subscribe();
    updateHeader(); saveWorkspace();
  };
  const supportedTimeframes = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', 'D', 'W', '1M', '3M'].filter(tf => Object.hasOwn(TF_MAP, tf));
  const savedFavourites = Workspace.read('terminal_timeframe_favourites_v1', ['1m', '5m', '15m', '1h', '4h', 'D', 'W']);
  let favourites = Array.isArray(savedFavourites) ? [...new Set(savedFavourites.filter(tf => supportedTimeframes.includes(tf)))] : [];
  const timeframeMenu = $('timeframe-menu');
  const timeframeMenuButton = $('timeframe-menu-button');
  function timeframeButton(tf, onSelect) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tf-btn';
    button.dataset.tf = tf;
    button.textContent = tf;
    button.classList.toggle('active', tf === active.currentTimeframe);
    button.onclick = onSelect;
    return button;
  }
  function renderFavourites() {
    $('timeframe-favourites').replaceChildren(...favourites.map(tf => timeframeButton(tf, () => changeTimeframe(tf))));
    desktop?.fitToolbar?.();
  }
  for (const tf of supportedTimeframes) {
    const row = document.createElement('div');
    row.className = 'timeframe-option';
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'timeframe-favourite';
    star.innerHTML = TerminalIcons.svg('star');
    star.setAttribute('aria-label', 'Favourite ' + tf);
    const updateStar = () => {
      const selected = favourites.includes(tf);
      star.setAttribute('aria-pressed', String(selected));
      star.title = (selected ? 'Remove from favourites: ' : 'Add to favourites: ') + tf;
    };
    updateStar();
    star.onclick = () => {
      const next = favourites.includes(tf) ? favourites.filter(item => item !== tf) : [...favourites, tf];
      if (!Workspace.write('terminal_timeframe_favourites_v1', next)) return;
      favourites = next;
      updateStar();
      renderFavourites();
    };
    row.append(timeframeButton(tf, () => { changeTimeframe(tf); timeframeMenu.hidePopover(); }), star);
    timeframeMenu.append(row);
    $('timeframe-suggestions').append(timeframeButton(tf, () => {
      changeTimeframe(tf);
      closeModal($('timeframe-input-modal'));
    }));
  }
  timeframeMenu.addEventListener('beforetoggle', event => {
    if (event.newState !== 'open') return;
    const rect = timeframeMenuButton.getBoundingClientRect();
    timeframeMenu.style.left = Math.max(8, Math.min(rect.left, innerWidth - 188)) + 'px';
    timeframeMenu.style.top = rect.bottom + 6 + 'px';
    timeframeMenu.style.maxHeight = Math.max(80, innerHeight - rect.bottom - 14) + 'px';
  });
  renderFavourites();
  const timeframeInput = $('timeframe-input');
  function showTimeframeError(show) {
    $('timeframe-input-error').hidden = $('timeframe-suggestions').hidden = !show;
    timeframeInput.setAttribute('aria-invalid', String(show));
  }
  timeframeInput.oninput = () => showTimeframeError(false);
  timeframeInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      $('timeframe-input-form').requestSubmit();
    }
  });
  $('timeframe-input-form').onsubmit = event => {
    event.preventDefault();
    const rawTf = timeframeInput.value.trim();
    const match = /^(?:(\d+)\s*([mhdw]?)|([dw]))$/i.exec(rawTf);
    const amount = match?.[3] ? 1 : Number(match?.[1]);
    const unit = match?.[3] || match?.[2] || '';
    const suffix = unit === 'M' ? 'M' : unit.toLowerCase();
    const tf = !match ? '' : /^[dw]$/.test(suffix)
      ? (amount === 1 ? suffix.toUpperCase() : amount + suffix.toUpperCase())
      : amount + (suffix || 'm');
    if (!supportedTimeframes.includes(tf)) return showTimeframeError(true);
    changeTimeframe(tf);
    closeModal($('timeframe-input-modal'));
  };
  document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => drawing.setTool(button.dataset.tool)));
  const renderSyncButton=()=>{$('btn-sync').innerHTML=TerminalIcons.svg('link')+`<span>Sync: ${sync.syncEnabled?'ON':'OFF'}</span>`;$('btn-sync').setAttribute('aria-pressed',String(sync.syncEnabled));};
  renderSyncButton();
  $('btn-sync').addEventListener('click', () => {sync.toggleSync($('btn-sync'));renderSyncButton();});
  const layoutPopover = $('layout-popover');
  const layoutButton = $('btn-layout');
  function positionLayoutPopover() {
    const rawAnchor = layoutButton.getBoundingClientRect();
    const anchor = rawAnchor.width ? rawAnchor : (document.querySelector('.toolbar-more')?.getBoundingClientRect() || rawAnchor);
    const width = layoutPopover.offsetWidth;
    const left = Math.max(8, Math.min(anchor.right - width, innerWidth - width - 8));
    layoutPopover.style.left = left + 'px';
    layoutPopover.style.setProperty('--layout-top', Math.ceil(anchor.bottom + 8) + 'px');
  }
  layoutButton.addEventListener('click', event => {
    event.stopPropagation();
    if (layoutPopover.classList.toggle('show')) positionLayoutPopover();
  });
  window.addEventListener('resize', () => {
    if (layoutPopover.classList.contains('show')) positionLayoutPopover();
  });
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
    if(chart.appearance&&(chart.appearance.lastDayChange||chart.appearance.prevDayLine!=='Hidden'))chart.onPreviousDayDataRequired();
    chart.setData(data['1m'] || []);
    for (const [tf, bars] of Object.entries(data)) if (TF_MAP[tf] && tf !== '1m') chart.setHtfData(tf, bars);
    if (chart.savedRange && chart.bars.length) {
      const rawSpan = Number(chart.savedRange.to) - Number(chart.savedRange.from);
      const span = Number.isFinite(rawSpan) && rawSpan >= 20 && rawSpan <= 1000 ? rawSpan : 85;
      const to = chart.bars.length - 1 + (chart.appearance?.rightMargin ?? 10);
      chart.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, to - span), to });
      chart.savedRange = null;
    }
  }
  function changeSymbol(c,symbol){drawing.saveDrawings(c);c.runner.stop();c.clearCustomSeries();c.symbol=symbol;c.clearData();drawing.loadDrawings(c);hydrate(c);c.runner.restart();}
  const symbolInput = $('symbol-search-input');
  const symbolOptions=[...$('symbol-search-results').querySelectorAll('.symbol-item')];
  let highlightedSymbol=null;
  function highlightSymbol(option,scroll=false){
    highlightedSymbol=option||null;
    for(const item of symbolOptions)item.setAttribute('aria-selected',String(item===highlightedSymbol));
    if(highlightedSymbol){
      symbolInput.setAttribute('aria-activedescendant',highlightedSymbol.id);
      if(scroll)highlightedSymbol.scrollIntoView({block:'nearest'});
    }else symbolInput.removeAttribute('aria-activedescendant');
  }
  function filterSymbols() {
    const query = symbolInput.value.trim().toLowerCase();
    const matches=[];
    for(const item of symbolOptions){
      item.hidden=!item.querySelector('.symbol-info').textContent.toLowerCase().includes(query);
      if(!item.hidden)matches.push(item);
    }
    $('symbol-result-count').textContent=TerminalLanguage.language==='vi'?matches.length+' mã':matches.length+(matches.length===1?' symbol':' symbols');
    $('symbol-search-empty').hidden=matches.length>0;
    highlightSymbol(matches.find(item=>item.dataset.sym===active.symbol)||matches[0]);
  }
  function openSymbolSearch(query = '') {
    showModal('symbol-modal');
    symbolInput.value = query;
    symbolInput.setAttribute('aria-expanded','true');
    for(const option of symbolOptions)option.querySelector('.symbol-current').hidden=option.dataset.sym!==active.symbol;
    filterSymbols();
    symbolInput.focus();
  }
  bindDialogToggle($('btn-symbol-search'), $('symbol-modal'), () => openSymbolSearch());
  symbolInput.addEventListener('input', filterSymbols);
  symbolInput.addEventListener('keydown', event => {
    if(event.isComposing)return;
    if(event.key==='Enter'){
      event.preventDefault();
      highlightedSymbol?.click();
    }else if(['ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();
      const matches=symbolOptions.filter(item=>!item.hidden);
      if(!matches.length)return;
      const index=matches.indexOf(highlightedSymbol);
      const offset=event.key==='ArrowDown'?1:-1;
      highlightSymbol(matches[(index+offset+matches.length)%matches.length],true);
    }
  });
  symbolOptions.forEach(item => item.addEventListener('click', () => {
    drawing.saveDrawings(active); drawing.setTool('crosshair');
    drawing.editor.clear(); active.runner.stop(); active.clearCustomSeries(); active.symbol = item.dataset.sym; active.clearData();
    drawing.loadDrawings(active); hydrate(active);refreshAlertLines();renderPaper();
    active.runner.restart();
    if(sync.options.symbol)for(const c of features.visibleCharts()){if(c!==active)changeSymbol(c,active.symbol);}
    features?.subscribe();replay?.refresh();
    closeModal($('symbol-modal')); updateHeader(); saveWorkspace();
  }));

  // QT Mode replaces generic IndicatorLibrary (keep #indicator-modal hidden for PaperPanel observer)

  function replayNext(){replay?.step(1);}

  // Price alerts survive reload; cross compares both sides of the threshold.
  let alerts = Workspace.read('terminal_alerts_v1', []);
  if (!Array.isArray(alerts)) alerts = [];
  alerts=alerts.filter(a=>a&&Number.isFinite(a.price)&&symbols.includes(a.symbol)).map(a=>({...a,id:a.id||crypto.randomUUID()}));
  Workspace.write('terminal_alerts_v1',alerts);
  const previousPrices = new Map();let alertEdit=null;
  function openAlert(chart,price,id=null){
    activate(chart);const existing=alerts.find(a=>a.id===id);
    const sym=existing?.symbol||chart.symbol;
    const lastPx=cache.get(sym)?.['1m']?.at(-1)?.close ?? chart.bars?.at(-1)?.close;
    const tick=cache.get(sym)?.metadata?.tickSize||chart.metadata.tickSize||.01;
    alertEdit={id:existing?.id,symbol:sym,chart,tick,lastPx};
    $('alert-sym-label').textContent=Number.isFinite(lastPx) ? `${sym} · ${lastPx.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : sym;
    $('alert-price-input').value=existing?.price??(Number.isFinite(price)?price:(lastPx??''));
    $('alert-price-input').step=alertEdit.tick;$('alert-condition').value=existing?.condition||'cross';
    let quickWrap=$('alert-quick-steps');
    if(!quickWrap){
      quickWrap=document.createElement('div');
      quickWrap.id='alert-quick-steps';
      quickWrap.className='alert-quick-steps';
      for(const delta of [-50,-20,-10,0,10,20,50]){
        const chip=document.createElement('button');
        chip.type='button';
        chip.className='alert-step-chip'+(delta===0?' is-now':'');
        chip.textContent=delta===0?ui('Giá hiện tại'):(delta>0?`+${delta}`:String(delta));
        chip.onclick=()=>{
          const base=delta===0?(alertEdit?.lastPx??Number($('alert-price-input').value)):(Number($('alert-price-input').value)||alertEdit?.lastPx||0);
          if(!Number.isFinite(base))return;
          $('alert-price-input').value=AlertPrice.round(delta===0?base:base+delta,alertEdit?.tick||.01);
          $('alert-price-input').focus();
        };
        quickWrap.appendChild(chip);
      }
      $('alert-price-input').closest('.setting-row')?.after(quickWrap);
      $('alert-price-input').addEventListener('keydown',ev=>{
        if(ev.key==='Enter'){ev.preventDefault();$('btn-save-alert').click();}
      });
    }
    $('btn-save-alert').textContent=ui(existing?'Lưu cảnh báo':'Đặt Cảnh Báo');$('btn-delete-alert').hidden=!existing;$('alert-modal-title').textContent=ui(existing?'Chỉnh cảnh báo giá':'Tạo cảnh báo giá');$('alert-rearm-row').hidden=!existing?.triggered;$('alert-rearm').checked=false;showModal('alert-modal');$('alert-price-input').focus();
  }
  function saveAlerts(next){if(!Workspace.write('terminal_alerts_v1',next))return false;alerts=next;refreshAlertLines();return true;}
  function removeAlert(id){return saveAlerts(alerts.filter(a=>a.id!==id));}
  $('btn-delete-alert').addEventListener('click',()=>{if(alertEdit?.id&&removeAlert(alertEdit.id))closeModal($('alert-modal'));});
  function updateAlert(id,price,original){
    const a=alerts.find(a=>a.id===id);if(!a||a.price!==original)return toast('Alert đã đổi; bỏ thao tác kéo.','alert');
    saveAlerts(alerts.map(a=>a.id===id?{...a,price}:a));
  }
  charts.forEach(c=>c.alertOverlay=new AlertChartControls(c,{getAlerts:()=>alerts,canDrag:()=>drawing.activeTool==='crosshair',update:updateAlert,remove:removeAlert,edit:(id,chart)=>openAlert(chart,undefined,id)}));
  if ($('btn-alert')) bindDialogToggle($('btn-alert'), $('alert-modal'), () => openAlert(active));
  charts.forEach(chart=>chart.onPricePlus=price=>{activate(chart);openAlert(chart,price);});
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
  const paper = new PaperTrading(Workspace.read('terminal_paper_v1', { accounts: [], active: null }) || { accounts: [], active: null }, state => Workspace.write('terminal_paper_v1', state));
  paperPanel=new PaperPanel({paper,charts,getActive:()=>active,isLive:live,isReplay:()=>!!replay?.running,toast,onToggle:()=>{desktop?.syncRailActive?.();desktop?.fitToolbar?.();}});
  function renderPaper(){paperPanel.render();}
  $('create-account').addEventListener('click',()=>paperPanel.action(()=>{paperPanel.paper.create($('account-name').value,Number($('account-balance').value),Number($('account-margin')?.value||0));closeModal($('account-modal'));}));
  $('btn-trade-buy').addEventListener('click',()=>paperPanel.quickMarket('buy'));
  $('btn-trade-sell').addEventListener('click',()=>paperPanel.quickMarket('sell'));

  function toggleIndicator(chart){qtMode?.toggleChart(chart);}
  charts.forEach(c=>c.onIndicatorToggle=()=>toggleIndicator(c));

  // Settings and scale controls.
  const appearanceStore=Workspace.read('terminal_chart_settings_v1',{})||{};
  const oldProfiles=structuredClone(appearanceStore);
  for (const chart of charts) {
    const profile = ChartAppearance.desktopProfile(appearanceStore[chart.id], colors, chart.symbol);
    if (profile.desktopVersion < 2) {
      profile.buySell = true;
    }
    if (profile.desktopVersion < 3 && profile.fontSize === 12) profile.fontSize = 10;
    if (profile.desktopVersion < 4) profile.bracketPnl = true;
    if (profile.desktopVersion < 5) { profile.executionMarks = true; profile.executionLabels = true; profile.alignment = 'Right'; }
    profile.desktopVersion = 5;
    appearanceStore[chart.id] = profile;
    ChartAppearance.apply(chart, profile);
  }
  if(JSON.stringify(oldProfiles)!==JSON.stringify(appearanceStore)){
    const backupKey='terminal_desktop_appearance_before_v1';
    if(Workspace.read(backupKey,null)||Workspace.write(backupKey,{profiles:oldProfiles,legacyColors:colors}))Workspace.write('terminal_chart_settings_v1',appearanceStore);
  }
  const chartSettings=new ChartSettings(()=>active,(chart,settings,applyAll=false)=>{
    const {symbol, timeframe, session, ...appearance} = settings;
    const targets = applyAll ? charts : [chart];
    const next = {...Workspace.read('terminal_chart_settings_v1', {})};
    for (const target of targets) {
      next[target.id] = structuredClone({ ...appearance, desktopVersion: 5 });
    }
    if (!Workspace.write('terminal_chart_settings_v1', next)) return false;
    Object.assign(appearanceStore, next);
    for (const target of targets) ChartAppearance.apply(target, next[target.id]);
    document.querySelector('.tv-trade-pill').hidden = active.appearance.buySell === false;
    updateHeader();
    return true;
  },settings=>paperPanel.previewExecution(settings),theme=>setDockTheme(theme),settings=>paperPanel.unlockExecutionAudio(settings));
  bindDialogToggle($('btn-settings'), chartSettings.modal, () => chartSettings.open(), () => chartSettings.cancel());
  charts.forEach(c=>c.onChartSettings=()=>{activate(c);chartSettings.open();});
  desktop=new DesktopShell({
    charts,
    getActive:()=>active,
    getMarkets:()=>cache,
    getAlerts:()=>alerts,
    drawing,
    onIndicatorToggle:toggleIndicator,
    onSymbol:symbol=>document.querySelector(`.symbol-item[data-sym="${symbol}"]`)?.click(),
    onAlertEdit:id=>{const a=alerts.find(a=>a.id===id);if(a)openAlert(charts.find(c=>c.symbol===a.symbol)||active,undefined,id);},
    onAlertRemove:idOrIdx=>{
      const next=typeof idOrIdx==='string'?alerts.filter(a=>a.id!==idOrIdx):alerts.filter((_,i)=>i!==idOrIdx);
      saveAlerts(next);
    },
    onAlertCreate:(symbol,rawPrice,condition='cross')=>{
      const sym=symbols.includes(symbol)?symbol:active.symbol;
      const num=Number(rawPrice);
      if(!Number.isFinite(num)||num<=0){toast('Nhập giá hợp lệ','alert');return false;}
      const tick=cache.get(sym)?.metadata?.tickSize||active.metadata.tickSize||.01;
      const val=AlertPrice.round(num,tick);
      if(saveAlerts([...alerts,{id:crypto.randomUUID(),symbol:sym,price:val,condition,triggered:false}])){
        toast(`Đã đặt cảnh báo ${sym} @ ${val.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`);
        return true;
      }
      return false;
    },
    onAlertRearm:id=>{
      saveAlerts(alerts.map(a=>a.id===id?{...a,triggered:false}:a));
      toast('Đã bật lại cảnh báo giá');
    },
    onAlertClearTriggered:()=>{
      saveAlerts(alerts.filter(a=>!a.triggered));
    },
    onAlertDialog:()=>openAlert(active),
    onPaperToggle:()=>paperPanel.open(!$('paper-panel').classList.contains('open'))
  });
  const themeButton = $('dock-theme');
  const themeKey = 'terminal_dock_theme_v1';
  function setDockTheme(theme,persist=true) {
    const preset=window.TerminalThemes?.find(item=>item.id===theme)||window.TerminalThemes?.find(item=>item.id==='light');
    if(!preset)return false;
    if(persist&&!Workspace.write(themeKey,preset.id))return false;
    const light=preset.mode==='light',root=document.documentElement;
    root.dataset.dockTheme=preset.mode;root.dataset.uiTheme=preset.id;
    for(const [key,value] of Object.entries(preset.colors))root.style.setProperty('--'+key,value);
    themeButton.innerHTML = light
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 14a8.8 8.8 0 0 1-10.9-10.9A9 9 0 1 0 20.8 14Z"/></svg>';
    themeButton.setAttribute('aria-pressed', String(light));
    themeButton.title=ui(light?'Chuyển sang tối':'Chuyển sang sáng');themeButton.setAttribute('aria-label',themeButton.title);themeButton.dataset.themeName=preset.name;
    return true;
  }
  function toggleDockTheme() {
    const next=document.documentElement.dataset.dockTheme==='light'?'dark':'light';setDockTheme(next);
  }
  setDockTheme(Workspace.read(themeKey,'light'),false);
  themeButton.addEventListener('click', toggleDockTheme);

  const dock = $('left-sidebar');
  for (const button of dock.querySelectorAll('button[title]')) {
    if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', button.title);
    button.removeAttribute('title');
  }
  const dockMotion = matchMedia('(hover: hover) and (min-width: 920px)');
  function installDockMotion(dock, selector, vertical = false) {
    const mainAxis = vertical ? ['offsetHeight','offsetTop','clientTop','scrollTop'] : ['offsetWidth','offsetLeft','clientLeft','scrollLeft'];
    let frame=0, pointerPosition=0, geometry=null;
    const invalidate=()=>{geometry=null;};
    new ResizeObserver(invalidate).observe(dock);
    new MutationObserver(invalidate).observe(dock,{childList:true,subtree:true});
    window.addEventListener('resize',invalidate);
    function resetDockMotion() {
      cancelAnimationFrame(frame);
      frame=0;
      for (const tool of dock.querySelectorAll(selector)) tool.style.removeProperty('transform');
      dock.style.removeProperty('--dock-grow-scale');
      dock.style.removeProperty('--dock-grow-shift');
    }
    function toolOffset(tool, [, offset, border, scroll]) {
      // Layout offsets stay stable while the tools themselves are transformed.
      let position = 0;
      for (let node = tool; node && node !== dock;) {
        position += node[offset];
        node = node.offsetParent;
        if (node) position += node[border] - node[scroll];
      }
      return position;
    }
    function drawDock() {
      frame=0;
      if(!dockMotion.matches||document.hidden||document.body.classList.contains('reduce-motion'))return;
      const bounds=dock.getBoundingClientRect();
      const rawExtent=vertical?dock.offsetHeight:dock.offsetWidth;
      const dockScale=rawExtent>0?((vertical?bounds.height:bounds.width)/rawExtent):1;
      if(!geometry){
        const tools = [...dock.querySelectorAll(selector)].filter(tool => tool[mainAxis[0]]).map(tool => ({
          tool,
          size: tool[mainAxis[0]],
          center: toolOffset(tool, mainAxis) + tool[mainAxis[0]] / 2
        }));
        geometry = {
          tools,
          extent: rawExtent + 2
        };
      }
      const pointer=(pointerPosition-(vertical?bounds.top:bounds.left))/(dockScale||1);
      let expansion = 0;
      const tools = geometry.tools.map(tool => {
        const proximity = Math.max(0, 1 - Math.abs(pointer - tool.center) / 95);
        const scale = 1 + .55 * proximity;
        const growth = tool.size * (scale - 1);
        const displacement = expansion + growth / 2;
        expansion += growth;
        return { ...tool, scale, displacement, lift: -(scale - 1) * 12 };
      });
      if (!tools.length) return;
      const rightIndex = tools.findIndex(({ center }) => center >= pointer);
      const right = tools[rightIndex];
      const left = tools[rightIndex - 1];
      let anchor = (right || tools.at(-1)).displacement;
      if (left && right) {
        const fraction = (pointer - left.center) / (right.center - left.center);
        anchor = left.displacement + fraction * (right.displacement - left.displacement);
      }
      dock.style.setProperty('--dock-grow-scale', (1+expansion/geometry.extent).toFixed(4));
      dock.style.setProperty('--dock-grow-shift', (expansion/2-anchor).toFixed(2)+'px');
      for (const { tool, scale, displacement, lift } of tools) {
        const shift = displacement - anchor;
        const translation = vertical ? `${lift}px, ${shift}px` : `${shift}px, ${lift}px`;
        const transform=`translate(${translation}) scale(${scale.toFixed(4)})`;
        if(tool.style.transform!==transform)tool.style.transform=transform;
      }
    }
    dock.addEventListener('pointerenter',invalidate);
    dock.addEventListener('pointermove',event=>{
      if(!dockMotion.matches||event.pointerType==='touch'||document.body.classList.contains('reduce-motion'))return;
      pointerPosition=vertical?event.clientY:event.clientX;
      if(!frame)frame=requestAnimationFrame(drawDock);
    });
    dock.addEventListener('pointerleave',resetDockMotion);
    dockMotion.addEventListener('change', resetDockMotion);
  }
  installDockMotion(dock, '.tool-btn');
  const rightDock = $('right-sidebar');
  for (const button of rightDock.querySelectorAll('button[title]')) button.removeAttribute('title');

  for (const [toolbar, label] of [[dock, 'Keep drawing tools open'], [rightDock, 'Keep chart panels open']]) {
    const storageKey = 'terminal_dock_pinned_' + toolbar.id;
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'dock-pin';
    pin.setAttribute('aria-label', ui(label));
    pin.setAttribute('aria-controls', toolbar.id);
    pin.setAttribute('aria-pressed', String(Workspace.read(storageKey, true) !== false));
    pin.addEventListener('click', () => {
      const pinned = pin.getAttribute('aria-pressed') === 'true';
      pin.setAttribute('aria-pressed', String(!pinned));
      Workspace.write(storageKey, !pinned);
    });
    const edge = toolbar.parentElement;
    pin.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') edge.setAttribute('data-dock-hover', '');
    });
    edge.addEventListener('pointerleave', () => edge.removeAttribute('data-dock-hover'));
    edge.addEventListener('pointercancel', () => edge.removeAttribute('data-dock-hover'));
    toolbar.before(pin);
  }

  const commandDialog = $('dock-command-dialog');
  const commandQuery = $('dock-command-query');
  const commandResults = $('dock-command-results');
  const commandActions = [
    [ui('Change symbol'), () => $('btn-symbol-search').click()],
    [ui('Chart Settings'), () => chartSettings.open()],
    [ui('Toolbar scale'), () => { chartSettings.tab = 'Toolbars'; chartSettings.open(); }],
    [ui('Toggle light / dark theme'), toggleDockTheme],
    ...[[ui('Watchlist'),'watch'],[ui('Alerts'),'alerts']].map(([label,key]) => [label, () => document.querySelector('#right-sidebar [data-panel='+key+']')?.click()]),
    [ui('Layers & data'), () => desktop.open('objects')],
    [ui('Calendar'), () => $('edge-calendar')?.click()],
    [ui('Music'), () => $('edge-music')?.click()],
    [ui('QT Mode · Toggle'), () => $('btn-indicator')?.click()],
    [ui('QT Mode · Settings (Quantaibay)'), () => qtMode?.openSettings(active)],
    ['Layout', () => $('btn-layout')?.click()],
    ['Alerts', () => openAlert(active)],
    ['Replay', () => $('btn-replay').click()],
    ['Paper Trading', () => paperPanel.open(!$('paper-panel').classList.contains('open'))],
    ...[...document.querySelectorAll('.symbol-item')].map(item =>
      [item.dataset.sym, () => item.click()]),
    ...supportedTimeframes.map(tf => ['Timeframe ' + tf, () => changeTimeframe(tf)]),
    ...[...document.querySelectorAll('#left-sidebar [data-tool]')].map(tool =>
      [tool.getAttribute('aria-label') || tool.dataset.tool, () => tool.click()])
  ];
  function renderCommands() {
    const query = commandQuery.value.trim().toLowerCase();
    const buttons = commandActions.filter(([label]) => label.toLowerCase().includes(query)).map(([label, run]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = ui(label);
      button.onclick = () => { commandDialog.close(); run(); };
      return button;
    });
    commandResults.replaceChildren(...buttons);
    if (!buttons.length) commandResults.textContent = ui('No commands found');
  }
  function openCommands() {
    if (commandDialog.open || document.querySelector('.modal.show')) return;
    commandQuery.value = '';
    renderCommands();
    commandDialog.showModal();
    commandQuery.focus();
  }
  commandQuery.addEventListener('input', renderCommands);
  commandDialog.addEventListener('click', event => {
    if (event.target === commandDialog) commandDialog.close();
  });
  commandDialog.addEventListener('keydown', event => {
    const buttons = [...commandResults.querySelectorAll('button')];
    if (event.key === 'Enter' && event.target === commandQuery) {
      event.preventDefault();
      buttons[0]?.click();
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowUp' && index <= 0) commandQuery.focus();
    else buttons[Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))]?.focus();
  });
  window.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.code !== 'KeyK') return;
    if (event.target.closest('textarea, [contenteditable], .studio-editing')) return;
    event.preventDefault();
    if (commandDialog.open) commandDialog.close(); else openCommands();
  });
  new ToolbarClusters(()=>$('btn-settings').click(),()=>{desktop.fitToolbar?.();charts.forEach(c=>c.positionSymbolBadge());});
  const contextMenu=new ChartContextMenu({charts,drawing,desktop,activate,openAlert,chartSettings,paperPanel,sync,toast});
  drawing.editor.onAlert=(chart,price)=>openAlert(chart,price);
  drawing.editor.onCopy=d=>{contextMenu.copyDrawing(d);toast(ui('Copied drawing'));};
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { document.querySelectorAll('.modal.show:not(#settings-modal)').forEach(closeModal); $('layout-popover').classList.remove('show'); }
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    const key = event.key.toLowerCase();
    if (event.altKey && !event.ctrlKey && !event.metaKey && key === 'r') { event.preventDefault(); sync.syncEnabled ? sync.resetAllCharts() : active.resetView(); }
    else if (event.altKey && !event.ctrlKey && !event.metaKey && key === 'a') { event.preventDefault(); openAlert(active); }
    else if (event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && key === 't') {
      event.preventDefault();
      const bar = cache.get(active.symbol)?.['1m']?.at(-1);
      $('paper-panel')?.dispatchEvent(new CustomEvent('paper-new-ticket', { detail: { price: bar?.close ?? '' } }));
    }
    else if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === 'c' && drawing.editor.drawing && !window.getSelection?.()?.toString()) {
      event.preventDefault();
      contextMenu.copyDrawing(drawing.editor.drawing);
      toast(ui('Copied drawing'));
    }
    else if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === 'v' && contextMenu.clipboard) {
      event.preventDefault();
      contextMenu.pasteClipboard(active, null);
    }
    else if (event.key === 'F10') { event.preventDefault(); replayNext(); }
    else if (!event.defaultPrevented && !event.isComposing && !event.repeat &&
      !event.ctrlKey && !event.metaKey && !event.altKey &&
      event.target === active.container && !document.querySelector('.modal.show, #timeframe-menu:popover-open')) {
      if (/^[a-z]$/i.test(event.key)) {
        event.preventDefault();
        openSymbolSearch(event.key);
      } else if (/^\d$/.test(event.key)) {
        event.preventDefault();
        showModal('timeframe-input-modal');
        timeframeInput.value = event.key;
        showTimeframeError(false);
        timeframeInput.focus();
      }
    }
  });

  function statusText() {
    const stale=bridge.state==='connected'&&Date.now()/1000-bridge.last_update>5,now=Date.now()/1000;
    const inSession=TerminalTime.activeSession(now,active.metadata),sourceError=(bridge.sources||[]).find(s=>s.symbol===active.symbol&&s.timeframe===active.currentTimeframe&&s.error);
    const status=$('connection-status');
    const loading=bridge.native_loading;
    const isLoading=bridge.state==='connected'&&loading?.state==='loading'&&!loading?.quick;
    const isWaiting=loading?.state==='waiting'&&['connecting','connected'].includes(bridge.state);
    const ring=status.querySelector('.dock-load-ring');
    const label=$('connection-status-text');
    status.dataset.state=isLoading?'loading':isWaiting?'waiting':sourceError?'disconnected':stale&&inSession?'stale':bridge.state;
    const ringValue = ring.querySelector('.dock-load-value');
    const fill = status.dataset.state==='connected'?100:isWaiting||status.dataset.state==='connecting'||isLoading?24:0;
    const message = bridge.state==='connected'&&!sourceError&&!isLoading&&!isWaiting?'Connected':'Connecting';
    if(label.textContent!==message)label.textContent=message;
    if(isLoading){
      const completed=loading.completed?.length||0;
      const total=completed+(loading.remaining?.length||0)+1;
      const loadFill=Math.max(4,completed/total*100);
      status.setAttribute('aria-description',`${loading.timeframe} · ${completed}/${total}`);
      const dash=`${loadFill} 100`;
      if(ringValue.getAttribute('stroke-dasharray')!==dash)ringValue.setAttribute('stroke-dasharray',dash);
    }else{
      status.setAttribute('aria-description',sourceError?.error||bridge.message||'');
      const dash=`${fill} 100`;
      if(ringValue.getAttribute('stroke-dasharray')!==dash)ringValue.setAttribute('stroke-dasharray',dash);
    }
    charts.forEach(c=>{const source=(bridge.sources||[]).find(s=>s.symbol===c.symbol&&s.timeframe===c.currentTimeframe);c.marketLive=bridge.state==='connected'&&source&&!source.error&&now-source.updated<8;const closed=!TerminalTime.activeSession(now,c.metadata);c.sourceBadge.hidden=c.marketLive||(closed&&bridge.state==='connected'&&!source?.error)||c.replayMode;c.sourceBadge.textContent=source?.error?`${c.symbol} · ${ui('source error')}`:`${c.symbol} · ${c.bars.length?ui('cached data'):ui('waiting for source')}`;c.sourceBadge.title=source?.error||'';if(c.symbolBadge)c.symbolBadge.title=c.marketLive?`${c.symbol} · Live`:closed?ui('Session closed'):c.sourceBadge.textContent;if(c.appearance?.marketStatus)c.updateLegend(c.bars.at(-1));if(!c.container.hidden)c.updateCountdown?.();});
    updateHeader();desktop?.refresh();
  }
  function receive(message) {
    if (message.type === 'native_request_error') { for (const key of message.rejected || []) pendingNative.delete(key); toast(message.error || 'Khung dữ liệu không hỗ trợ native', 'alert'); return; }
    if (message.type === 'bridge_status') {
      bridge=message;
      if(!preloadRequested&&socket?.readyState===WebSocket.OPEN){
        socket.send(JSON.stringify({action:'startup_native'}));
        preloadRequested=true;
      }
      if(!replay?.running){
        let quoteUpdated=false,needsTicketRefresh=false;
        for(const s of symbols){
          if(!live(s))continue;
          const src=bridge.sources?.find(item=>item.symbol===s&&item.timeframe==='1m');
          const px=Number.isFinite(src?.close)&&src.close>0?src.close:cache.get(s)?.['1m']?.at(-1)?.close;
          if(!Number.isFinite(px)||px<=0)continue;
          const prev=paper.quotes.get(s);
          if(!prev||prev.price!==px){paper.tick(s,px);checkAlerts(s,px);quoteUpdated=true;}
          else{if(Date.now()-prev.received>3500)needsTicketRefresh=true;paper.quotes.set(s,{price:px,received:Date.now()});}
        }
        if(quoteUpdated||needsTicketRefresh)renderPaper(quoteUpdated);
      }
      statusText();
      return;
    }
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
      if(data.metadata&&c.metadata!==data.metadata){c.metadata=data.metadata;c.regularBarsByTf=null;}
      if(c.container.hidden){if(tf!=='1m')c.htfData[tf]=data[tf];continue;}
      if (tf === '1m' && type === 'tick') c.updateBar(message.bar);
      else if (tf === '1m') c.setData(data[tf]);
      else c.setHtfData(tf, data[tf]);
      if (c.savedRange && c.bars.length) {
        const rawSpan = Number(c.savedRange.to) - Number(c.savedRange.from);
        const span = Number.isFinite(rawSpan) && rawSpan >= 20 && rawSpan <= 1000 ? rawSpan : 85;
        const to = c.bars.length - 1 + (c.appearance?.rightMargin ?? 10);
        c.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, to - span), to });
        c.savedRange = null;
      }
    }
    // All indicators can depend on other symbols, even when no chart displays those symbols.
    charts.filter(c => c.symbol !== symbol&&!c.container.hidden).forEach(c => c.runner.schedule());
    const inActiveReplay = !!(replay?.running && charts.some(c => c.replayMode && c.symbol === symbol));
    if (tf === '1m' && type === 'tick' && live(symbol)) {
      paper.tick(symbol, message.bar.close);
      if (!inActiveReplay) checkAlerts(symbol, message.bar.close);
      if (!replay?.running) renderPaper();
    }
    if (tf === '1m' && type === 'history' && message.source === 'live' && live(symbol) && data[tf].length) {
      paper.quotes.set(symbol, { price: data[tf].at(-1).close, received: Date.now() });
      if (!replay?.running) renderPaper();
    }
    replay?.refresh();updateHeader();
  }
  async function connect(refreshSource = false) {
    const attempt = ++connectionAttempt;
    clearTimeout(reconnect);
    socket?.close();
    socket = null;

    function scheduleReconnect() {
      reconnect = setTimeout(() => connect(refreshSource), retry);
      retry = Math.min(retry * 2, 15000);
    }
    if (location.protocol === 'file:') {
      bridge = { state: 'backend_error', symbols: [], message: 'Hãy chạy start_terminal.bat để mở qua http://localhost:3000' };
      statusText();
      toast('Đang mở trực tiếp file index.html (file://). Hãy chạy start_terminal.bat để mở http://localhost:3000.', 'alert');
      return;
    }
    let port;
    try {
      const response=await fetch('/health',{signal:AbortSignal.timeout(3000),cache:'no-store'});
      if(!response.ok)throw Error(response.status===404?'Backend cũ ở cổng này; chạy lại start_terminal.bat.':`Backend HTTP ${response.status}`);
      port=BridgeProtocol.health(await response.json()).ws_port;
    } catch (error) {
      if (attempt !== connectionAttempt) return;
      bridge = { state: 'backend_error', symbols: [], message: error.message || 'Không kết nối được backend' };
      statusText();
      scheduleReconnect();
      return;
    }
    if (attempt !== connectionAttempt) return;
    const wsHost = location.hostname === 'localhost' ? '127.0.0.1' : location.hostname || '127.0.0.1';
    const connection = socket = new WebSocket(`ws://${wsHost}:${port}`);
    window.terminalWs = connection;
    connection.onopen = () => {
      if (attempt !== connectionAttempt) return;
      retry = 1000;
      features?.subscribe();
      if (refreshSource) {
        connection.send(JSON.stringify({ action: 'refresh' }));
        refreshSource = false;
      }
      for (const requirement of pendingNative.values()) {
        connection.send(JSON.stringify({ action: 'request_native', charts: [requirement] }));
      }
    };
    connection.onmessage = event => {
      if (attempt !== connectionAttempt) return;
      try { receive(JSON.parse(event.data)); }
      catch (error) { console.error(error); toast(`Dữ liệu không hợp lệ: ${error.message}`, 'alert'); }
    };
    connection.onerror = () => connection.close();
    connection.onclose = () => {
      if (attempt !== connectionAttempt) return;
      bridge = { ...bridge, state: 'disconnected' };
      statusText();
      scheduleReconnect();
    };
  }
  features = new TerminalFeatures({charts,desktop,sync,drawing,activate,getActive:()=>active,getReplay:()=>replay,hydrate,saveWorkspace,updateHeader,chartSettings,changeSymbol,subscribe:()=>{
    if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({action:'subscribe',charts:features.visibleCharts().map(c=>({symbol:c.symbol,timeframe:c.currentTimeframe}))}));
  }});
  if (desktop && features?.companions) {
    desktop.companions = features.companions;
    features.companions.desktop = desktop;
    desktop.syncRailActive();
  }
  document.addEventListener('pointerdown', event => {
    const hasDesktopOpen = !!desktop?.mode;
    const hasCompanionOpen = !!features?.companions?.open;
    if (!hasDesktopOpen && !hasCompanionOpen) return;
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest('#desktop-panel, .companion-panel, #right-sidebar, .edge-panel-dock, .modal, dialog, .protocol-lightbox, .chart-context-menu, .tv-toast')) {
      return;
    }
    if (hasDesktopOpen) desktop.open(null);
    if (hasCompanionOpen) features.companions.closeDocked();
  });
  const replayPaper=new ReplayPaper({Paper:PaperTrading,read:()=>Workspace.read('terminal_paper_replay_v1',null),save:state=>Workspace.write('terminal_paper_replay_v1',state)});
  paperPanel.exportReplay=()=>{const blob=new Blob([JSON.stringify(replayPaper.saved,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='paper-replay-sessions.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  let paperReplayClock=null;
  replay = new TerminalReplay({charts,getCharts:()=>features.visibleCharts(),getActive:()=>active,toast,saveWorkspace,onChange:session=>{
    try{paperPanel.replayBlocked=false;if(session.running&&paperReplayClock!=null&&session.clock<paperReplayClock){for(const c of charts)c.paperOverlay?.cancel();paperPanel.reset();paperPanel.closeModal.classList.remove('show');}paperReplayClock=session.running?session.clock:null;if(session.running){replayPaper.seek(session.clock,session.targets.map(c=>({symbol:c.symbol,bars:c.rawBars})));paperPanel.setPaper(replayPaper.paper);}else{replayPaper.leave();paperPanel.setPaper(paper);}renderPaper();updateHeader();}catch(error){paperPanel.replayBlocked=true;session.pause();paperPanel.render();toast(error.message,'alert');}
  }});
  function confirmReloadChartData() {
    return new Promise(resolve => {
      if (typeof HTMLDialogElement !== 'function' || !document.createElement('dialog').showModal) {
        resolve(typeof confirm === 'function' ? confirm('Tắt và bật lại TradingView Desktop để tải lại dữ liệu từ đầu?') : true);
        return;
      }
      const dialog = document.createElement('dialog');
      dialog.className = 'paper-order-confirmation';
      dialog.setAttribute('aria-label', 'Xác nhận tải lại dữ liệu');
      const message = document.createElement('p');
      message.textContent = 'Tắt và bật lại TradingView Desktop để tải lại dữ liệu từ đầu?';
      const form = document.createElement('form');
      form.method = 'dialog';
      for (const [text, value, cls] of [['Hủy', 'cancel', 'btn-secondary'], ['Tải lại', 'confirm', 'btn-primary']]) {
        const button = document.createElement('button');
        button.type = 'submit'; button.value = value; button.textContent = text; button.className = cls;
        form.append(button);
      }
      dialog.append(message, form);
      document.body.append(dialog);
      dialog.addEventListener('close', () => {
        const ok = dialog.returnValue === 'confirm';
        dialog.remove();
        resolve(ok);
      }, { once: true });
      dialog.showModal();
    });
  }
  $('reload-chart-data').addEventListener('click', async () => {
    if (!(await confirmReloadChartData())) return;
    retry = 1000;
    preloadRequested = false;
    pendingNative.clear();
    bridge = { state: 'connecting', symbols: [], message: 'Đang tắt và mở lại TradingView Desktop…' };
    statusText();
    try {
      await fetch('/api/restart-tv', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    } catch {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'restart_tv' }));
      }
    }
    void connect(false);
  });
  const timezoneButton = $('live-tz');
  const timezoneMenu = $('clock-timezone-menu');
  const timezoneOptions = $('clock-timezone-options');
  const timezoneOffsets = new Map();
  if (timezoneButton && timezoneMenu && timezoneOptions) {
    for (const [zone, label] of chartTimezones) {
      const option = document.createElement('button');
      option.type = 'button';
      option.dataset.zone = zone;
      const name = document.createElement('span');
      name.textContent = ui(label);
      const offset = document.createElement('span');
      offset.className = 'clock-timezone-offset';
      timezoneOffsets.set(zone, offset);
      option.append(name, offset);
      option.addEventListener('click', () => {
        if (!chartSettings.onCommit(active, { ...active.appearance, timezone: zone })) return;
        timezoneMenu.hidePopover();
        timezoneButton.focus();
        updateVisibleChrome();
      });
      timezoneOptions.appendChild(option);
    }
    function placeTimezoneMenu() {
      const anchor = $('dock-market-status').getBoundingClientRect();
      const width = Math.min(300, window.innerWidth - 24);
      const right = Math.min(window.innerWidth - width - 12, Math.max(12, window.innerWidth - anchor.right));
      timezoneMenu.style.setProperty('--tz-top', Math.ceil(anchor.bottom) + 10 + 'px');
      timezoneMenu.style.setProperty('--tz-right', right + 'px');
    }
    timezoneMenu.addEventListener('beforetoggle', event => {
      const opening = event.newState === 'open';
      timezoneButton.setAttribute('aria-expanded', String(opening));
      if (!opening) return;
      placeTimezoneMenu();
      const activeZone = active.appearance?.timezone || 'America/New_York';
      const date = replay?.running ? new Date(replay.clock * 1000) : new Date();
      for (const option of timezoneOptions.children) {
        const zone = option.dataset.zone;
        option.setAttribute('aria-pressed', String(zone === activeZone));
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(date);
        const offset = parts.find(part => part.type === 'timeZoneName')?.value || 'GMT';
        timezoneOffsets.get(zone).textContent = offset === 'GMT' ? 'UTC+00:00' : offset.replace('GMT', 'UTC');
      }
    });
    window.addEventListener('resize', () => {
      if (timezoneMenu.matches(':popover-open')) placeTimezoneMenu();
    });
  }
  refreshAlertLines();connect();
  function updateVisibleChrome(){
    document.documentElement.toggleAttribute('data-page-hidden',document.hidden);
    if(document.hidden)return;
    const zone = active.appearance?.timezone || 'America/New_York';
    const time = replay?.running ? replay.clock * 1000 : Date.now();
    const clock=$('live-clock');
    const displayTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).format(new Date(time));
    clock.innerHTML=displayTime.slice(0,5)+'<span class="dock-sec">'+displayTime.slice(5)+'</span>';
    const [hh,mm,ss]=displayTime.split(':').map(Number),face=clock.closest('.dock-clock');
    if(face){const acc=(k,t)=>{face._a??={};const p=face._a[k]??t,v=p+((t-p+540)%360-180);face._a[k]=v;return v+'deg';};
      face.style.setProperty('--h',acc('h',hh%12*30+mm/2));face.style.setProperty('--m',acc('m',mm*6+ss/10));face.style.setProperty('--s',acc('s',ss*6));}
    const tzLabel=$('live-tz');
    if(tzLabel){try{tzLabel.textContent=new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'short'}).formatToParts(new Date(time)).find(p=>p.type==='timeZoneName')?.value||'';}catch{tzLabel.textContent='';}}
    clock.dateTime=displayTime;
    clock.title=zone;
    statusText();
  }
  updateVisibleChrome();
  setInterval(updateVisibleChrome,1000);
  document.addEventListener('visibilitychange',updateVisibleChrome);
  window.addEventListener('beforeunload', () => {
    clearTimeout(saveTimer);
    Workspace.write('terminal_workspace_v1', { active: active.id, layout: grid.className, charts: charts.map(c => ({ symbol: c.symbol, timeframe: c.currentTimeframe, range: c.savedRange || c.chart.timeScale().getVisibleLogicalRange() })) });
    // Drawings are saved on mutation; an older open tab must not overwrite them on unload.
    charts.forEach(c => c.runner.stop());replay?.persist();
  });
});
