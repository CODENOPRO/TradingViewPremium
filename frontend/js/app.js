document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const saved = Workspace.read('terminal_workspace_v1', {});
  const colors = { bg: '#c2baae', grid: '#a8a194', bodyUp: '#e8e4dc', borderUp: '#211f1d', wickUp: '#211f1d', bodyDown: '#211f1d', borderDown: '#211f1d', wickDown: '#211f1d', textColor: '#202020', ...Workspace.read('tv_candle_config', {}) };
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
  for(let i=4;i<=16;i++){const node=$('box-1').cloneNode(true);node.id=`box-${i}`;node.classList.remove('active');$('chart-grid').appendChild(node);}
  let features,replay;
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
    if(modal.id==='symbol-modal'){
      const input=$('symbol-search-input');
      input.setAttribute('aria-expanded','false');
      input.removeAttribute('aria-activedescendant');
    }
    modal.opener?.focus({preventScroll:true});
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
    const bar = cache.get(active.symbol)?.['1m']?.at(-1);
    const text = bar ? bar.close.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—';
    $('price-buy').textContent = text; $('price-sell').textContent = text;
    $('trade-spread').textContent = 'LAST';
    $('btn-trade-buy').classList.toggle('unavailable', !bar || (!active.replayMode&&!live(active.symbol)));
    $('btn-trade-sell').classList.toggle('unavailable', !bar || (!active.replayMode&&!live(active.symbol)));
    document.title = `${active.symbol} · Trading Terminal`;
  }
  function activate(chart) {
    active = chart; window.currentActiveChart = chart;
    document.querySelector('.tv-trade-pill').hidden=chart.appearance?.buySell===false;
    charts.forEach(c => c.container.classList.toggle('active', c === chart));
    updateHeader(); saveWorkspace();if(desktop){desktop.hoverBar=null;desktop.signature='';desktop.refresh();}
  }
  const indicatorSettings=new IndicatorSettings((chart,settings,view,id)=>{
    const entry=chart.runner.entries.find(e=>e.record.id===id);
    return !!entry&&chart.runner.update(id,{settings,view});
  });
  let indicatorLibrary;
  const indicatorSettingsButton=document.createElement('button');indicatorSettingsButton.id='btn-indicator-settings';indicatorSettingsButton.className='btn-icon';indicatorSettingsButton.textContent='⚙';indicatorSettingsButton.title=ui('Indicator settings');indicatorSettingsButton.setAttribute('aria-label',ui('Active indicator settings'));
  $('btn-indicator').after(indicatorSettingsButton);indicatorSettingsButton.onclick=()=>indicatorSettings.open(active);
  for (const chart of charts) {
    chart.onIndicatorSettings=()=>{activate(chart);indicatorSettings.open(chart);};
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
    const match = /^(\d+)\s*([mhdw]?)$/i.exec(timeframeInput.value.trim());
    const amount = Number(match?.[1]);
    const unit = match?.[2] || '';
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
    const anchor = layoutButton.getBoundingClientRect();
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
    if (chart.savedRange && chart.bars.length) { chart.chart.timeScale().setVisibleLogicalRange(chart.savedRange); chart.savedRange = null; }
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
  $('btn-symbol-search').addEventListener('click', () => openSymbolSearch());
  $('btn-symbol-search').addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openSymbolSearch();
  });
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

  indicatorLibrary=new IndicatorLibrary({getChart:()=>active,openSettings:(chart,id)=>{chart.runner.select(id);indicatorSettings.open(chart);},onChange:()=>{updateHeader();if(desktop){desktop.signature='';desktop.refresh();}}});
  indicatorLibrary.migrate(charts);
  $('btn-indicator').addEventListener('click',()=>indicatorLibrary.open());

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
  $('btn-alert').addEventListener('click',()=>openAlert(active));
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
  const paper = new PaperTrading(Workspace.read('terminal_paper_v1', { accounts: [], active: null }), state => Workspace.write('terminal_paper_v1', state));
  const paperPanel=new PaperPanel({paper,charts,getActive:()=>active,isLive:live,isReplay:()=>!!replay?.running,toast});
  function renderPaper(){paperPanel.render();}
  $('create-account').addEventListener('click',()=>paperPanel.action(()=>{paperPanel.paper.create($('account-name').value,Number($('account-balance').value),Number($('account-margin').value));closeModal($('account-modal'));}));
  $('btn-trade-buy').addEventListener('click',()=>paperPanel.submit('buy'));
  $('btn-trade-sell').addEventListener('click',()=>paperPanel.submit('sell'));

  function toggleIndicator(chart){chart.runner.toggle();}
  charts.forEach(c=>c.onIndicatorToggle=()=>toggleIndicator(c));

  // Settings and scale controls.
  const appearanceStore=Workspace.read('terminal_chart_settings_v1',{});
  const oldProfiles=structuredClone(appearanceStore);
  for (const chart of charts) {
    const profile = ChartAppearance.desktopProfile(appearanceStore[chart.id], colors, chart.symbol);
    if (profile.desktopVersion < 2) {
      profile.buySell = true;
    }
    if (profile.desktopVersion < 3 && profile.fontSize === 12) profile.fontSize = 10;
    profile.desktopVersion = 3;
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
      next[target.id] = structuredClone({ ...appearance, desktopVersion: 3 });
    }
    if (!Workspace.write('terminal_chart_settings_v1', next)) return false;
    Object.assign(appearanceStore, next);
    for (const target of targets) ChartAppearance.apply(target, next[target.id]);
    document.querySelector('.tv-trade-pill').hidden = active.appearance.buySell === false;
    updateHeader();
    return true;
  },settings=>paperPanel.previewExecution(settings),theme=>setDockTheme(theme),settings=>paperPanel.unlockExecutionAudio(settings));
  $('btn-settings').addEventListener('click',()=>chartSettings.open());
  charts.forEach(c=>c.onChartSettings=()=>{activate(c);chartSettings.open();});
  desktop=new DesktopShell({charts,getActive:()=>active,getMarkets:()=>cache,getAlerts:()=>alerts,drawing,onIndicatorToggle:toggleIndicator,onSymbol:symbol=>document.querySelector(`.symbol-item[data-sym="${symbol}"]`)?.click(),onAlertEdit:id=>{const a=alerts.find(a=>a.id===id);if(a)openAlert(charts.find(c=>c.symbol===a.symbol)||active,undefined,id);},onAlertRemove:index=>saveAlerts(alerts.filter((_,i)=>i!==index))});
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
      if(!geometry){
        const bounds=dock.getBoundingClientRect();
        const tools = [...dock.querySelectorAll(selector)].filter(tool => tool[mainAxis[0]]).map(tool => ({
          tool,
          size: tool[mainAxis[0]],
          center: toolOffset(tool, mainAxis) + tool[mainAxis[0]] / 2
        }));
        geometry = {
          tools,
          start: vertical ? bounds.top : bounds.left,
          extent: (vertical ? bounds.height : bounds.width) + 2
        };
      }
      const pointer=pointerPosition-geometry.start;
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
  installDockMotion(rightDock, ':scope > button, .edge-handle', true);

  for (const [toolbar, label] of [[dock, 'Keep drawing tools open'], [rightDock, 'Keep chart panels open']]) {
    const storageKey = 'terminal_dock_pinned_' + toolbar.id;
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'dock-pin';
    pin.setAttribute('aria-label', ui(label));
    pin.setAttribute('aria-controls', toolbar.id);
    pin.setAttribute('aria-pressed', String(Workspace.read(storageKey, false) === true));
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
    [ui('Đổi mã'), () => $('btn-symbol-search').click()],
    [ui('Cài đặt · Chart Settings'), () => chartSettings.open()],
    ['Đổi giao diện sáng tối', toggleDockTheme],
    ...[['Theo dõi','watch'],['Cảnh báo','alerts'],['Script','editor']].map(([label,key]) => [label, () => document.querySelector('#right-sidebar [data-panel='+key+']')?.click()]),
    [ui('Lớp & dữ liệu'), () => desktop.open('objects')],
    ['Lịch', () => $('edge-calendar')?.click()],
    ['Nhạc', () => $('edge-music')?.click()],
    ['Indicators', () => $('btn-indicator').click()],
    ['Layout', () => $('btn-layout').click()],
    ['Alerts', () => $('btn-alert').click()],
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
    if (!buttons.length) commandResults.textContent = 'Không tìm thấy lệnh';
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
  new ToolbarClusters(()=>chartSettings.open(),()=>{desktop.fitToolbar?.();charts.forEach(c=>c.positionSymbolBadge());});
  const contextMenu=new ChartContextMenu({charts,drawing,desktop,activate,openAlert,chartSettings,paperPanel,sync,toast});
  drawing.editor.onAlert=(chart,price)=>openAlert(chart,price);
  drawing.editor.onCopy=d=>{contextMenu.copyDrawing(d);toast('Đã sao chép đối tượng');};
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
      toast('Đã sao chép đối tượng');
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
    const isLoading=bridge.state==='connected'&&loading?.state==='loading';
    const isWaiting=loading?.state==='waiting'&&['connecting','connected'].includes(bridge.state);
    const ring=status.querySelector('.dock-load-ring');
    const label=$('connection-status-text');
    status.dataset.state=isLoading?'loading':isWaiting?'waiting':sourceError?'disconnected':stale&&inSession?'stale':bridge.state;
    const ringValue = ring.querySelector('.dock-load-value');
    let fill=status.dataset.state==='connected'?100:isWaiting||status.dataset.state==='connecting'?24:0;
    let message='Mất kết nối';
    if(isLoading)message=(TerminalLanguage.language==='vi'?'Nạp ':'Loading ')+loading.timeframe;
    else if(isWaiting)message='Chờ nguồn…';
    else if(sourceError)message='Lỗi nguồn';
    else if(bridge.state==='connecting')message='Đang kết nối…';
    else if(bridge.state==='connected'){
      if(!inSession)message='Nghỉ phiên';
      else if(stale)message='Gián đoạn';
      else message=active.currentTimeframe==='6h'?'6h · giá đã lưu':'TradingView';
    }
    message=ui(message);
    if(label.textContent!==message)label.textContent=message;
    if(isLoading){
      const completed=loading.completed?.length||0;
      const total=completed+(loading.remaining?.length||0)+1;
      fill=Math.max(4,completed/total*100);
      status.setAttribute('aria-description',`${message} · ${completed}/${total}`);
    }else{
      status.setAttribute('aria-description',sourceError?.error||bridge.message||'');
    }
    const dash=`${fill} 100`;
    if(ringValue.getAttribute('stroke-dasharray')!==dash)ringValue.setAttribute('stroke-dasharray',dash);
    charts.forEach(c=>{const source=(bridge.sources||[]).find(s=>s.symbol===c.symbol&&s.timeframe===c.currentTimeframe);c.marketLive=bridge.state==='connected'&&source&&!source.error&&now-source.updated<8;const closed=!TerminalTime.activeSession(now,c.metadata);c.sourceBadge.hidden=c.marketLive||(closed&&bridge.state==='connected'&&!source?.error)||c.replayMode;c.sourceBadge.textContent=source?.error?`${c.symbol} · lỗi nguồn`:`${c.symbol} · ${c.bars.length?'dữ liệu đã lưu':'chờ nguồn'}`;c.sourceBadge.title=source?.error||'';if(c.symbolBadge)c.symbolBadge.title=c.marketLive?`${c.symbol} · Live`:closed?'Nghỉ phiên':c.sourceBadge.textContent;if(c.appearance?.marketStatus)c.updateLegend(c.bars.at(-1));if(!c.container.hidden)c.updateCountdown?.();});
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
  async function connect(refreshSource = false) {
    const attempt = ++connectionAttempt;
    clearTimeout(reconnect);
    socket?.close();
    socket = null;

    function scheduleReconnect() {
      reconnect = setTimeout(() => connect(refreshSource), retry);
      retry = Math.min(retry * 2, 15000);
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
  features = new TerminalFeatures({charts,sync,drawing,activate,getActive:()=>active,getReplay:()=>replay,hydrate,saveWorkspace,updateHeader,chartSettings,changeSymbol,subscribe:()=>{
    if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({action:'subscribe',charts:features.visibleCharts().map(c=>({symbol:c.symbol,timeframe:c.currentTimeframe}))}));
  }});
  const replayPaper=new ReplayPaper({Paper:PaperTrading,read:()=>Workspace.read('terminal_paper_replay_v1',null),save:state=>Workspace.write('terminal_paper_replay_v1',state)});
  paperPanel.exportReplay=()=>{const blob=new Blob([JSON.stringify(replayPaper.saved,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='paper-replay-sessions.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  let paperReplayClock=null;
  replay = new TerminalReplay({charts,getCharts:()=>features.visibleCharts(),getActive:()=>active,toast,saveWorkspace,onChange:session=>{
    try{paperPanel.replayBlocked=false;if(session.running&&paperReplayClock!=null&&session.clock<paperReplayClock){for(const c of charts)c.paperOverlay?.cancel();paperPanel.reset();paperPanel.closeModal.classList.remove('show');}paperReplayClock=session.running?session.clock:null;if(session.running){replayPaper.seek(session.clock,session.targets.map(c=>({symbol:c.symbol,bars:c.rawBars})));paperPanel.setPaper(replayPaper.paper);}else{replayPaper.leave();paperPanel.setPaper(paper);}renderPaper();updateHeader();}catch(error){paperPanel.replayBlocked=true;session.pause();paperPanel.render();toast(error.message,'alert');}
  }});
  $('reload-chart-data').addEventListener('click', () => {
    retry = 1000;
    bridge = { state: 'connecting', symbols: [] };
    statusText();
    if (socket?.readyState === WebSocket.OPEN) {
      features?.subscribe();
      socket.send(JSON.stringify({ action: 'refresh' }));
    } else {
      void connect(true);
    }
  });
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
    clock.textContent=displayTime;
    clock.dateTime=displayTime;
    clock.title=zone;
    statusText();
  }
  setInterval(updateVisibleChrome,1000);
  document.addEventListener('visibilitychange',updateVisibleChrome);
  window.addEventListener('beforeunload', () => {
    clearTimeout(saveTimer);
    Workspace.write('terminal_workspace_v1', { active: active.id, layout: grid.className, charts: charts.map(c => ({ symbol: c.symbol, timeframe: c.currentTimeframe, range: c.savedRange || c.chart.timeScale().getVisibleLogicalRange() })) });
    // Drawings are saved on mutation; an older open tab must not overwrite them on unload.
    charts.forEach(c => c.runner.stop());replay?.persist();
  });
});
