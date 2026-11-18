/* Local desktop chrome. Panels use the existing chart, ledger and drawing stores. */
class DesktopShell {
  static latestRange(chart) {
    if(!chart.bars.length)return null;
    const previous=chart.chart.timeScale().getVisibleLogicalRange(),span=previous&&previous.to>previous.from?previous.to-previous.from:100;
    const to=chart.bars.length-1+(chart.appearance?.rightMargin??10);
    return {from:to-span,to};
  }
  static icon(name) {
    const paths={watch:'M4 3h16v18l-8-4-8 4z',alerts:'M12 8v5l3 2M5 4L2 7m17-3 3 3M4 13a8 8 0 1 0 16 0 8 8 0 1 0-16 0',objects:'M2 8l10-6 10 6-10 6zM2 13l10 6 10-6M2 18l10 6 10-6',editor:'M8 5L2 12l6 7m8-14 6 7-6 7',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',lock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4',close:'M5 5l14 14M19 5L5 19',settings:'M4 4h16v16H4zM8 8h8v8H8z',arrow:'M4 12h16m-6-6 6 6-6 6',line:'M4 20L20 4M2 18l4 4M18 2l4 4',hline:'M2 12h20M5 9v6',fib:'M3 4h18M3 10h13M3 16h18M3 22h9',box:'M4 4h16v16H4zM2 2h4v4H2zM18 18h4v4h-4z',position:'M4 4h12v7H4zM8 11h12v9H8zM2 4h20',text:'M4 5V3h16v2M12 3v18M8 21h8',brush:'M5 18c-3 0-3 4-3 4s5 0 5-3l13-13-3-3z',keep:'M3 14l11-11 7 7-11 11H3zM15 14v8m-4-4h8'};
    paths.chart='M3 4v16h18M7 15l4-5 4 2 5-6';
    paths.paper='M4 9h16l-4-4M20 15H4l4 4';
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.objects}"/></svg>`;
  }
  constructor({charts,getActive,getMarkets,getAlerts,onAlertRemove,onAlertEdit,onAlertCreate,onAlertRearm,onAlertClearTriggered,onAlertDialog,onPaperToggle,onSymbol,onIndicatorToggle,drawing}) {
    Object.assign(this,{charts,getActive,getMarkets,getAlerts,onAlertRemove,onAlertEdit,onAlertCreate,onAlertRearm,onAlertClearTriggered,onAlertDialog,onPaperToggle,onSymbol,onIndicatorToggle,drawing});
    this.alertFilter='all';
    this._alertCond='cross';
    this._alertDraftSym='';
    this._alertDraftPrice='';
    const $=id=>document.getElementById(id);
    this.root=document.createElement('aside');this.root.id='desktop-panel';this.root.hidden=true;this.root.setAttribute('aria-label','Chart side panel');
    this.root.innerHTML='<div class="desktop-panel-header"><div class="desktop-panel-tabs" role="tablist"></div><button class="desktop-panel-close" aria-label="Close side panel">×</button></div><div class="desktop-panel-content"></div>';
    this.content=this.root.querySelector('.desktop-panel-content');this.tabs=this.root.querySelector('.desktop-panel-tabs');
    this.root.querySelector('.desktop-panel-close').onclick=()=>this.open(null);
    this.root.onkeydown=e=>{if(e.key==='Escape'){this.open(null);$('btn-layout')?.focus();}};
    this.rail=document.createElement('nav');this.rail.id='right-sidebar';this.rail.setAttribute('aria-label','Chart panels');
    for(const [key,label] of [['chart','Biểu đồ'],['watch','Theo dõi'],['alerts','Cảnh báo'],['paper','Paper Trading']]){
      const b=this.button(label,key,()=>{
        if(key==='paper'){
          this.onPaperToggle?.();
        }else if(key==='chart'){
          this.companions?.closeDocked?.();
          this.open(null);
        }else{
          this.open(this.mode===key?null:key);
        }
        $('layout-popover')?.classList.remove('show');
      });
      b.dataset.panel=key;b.dataset.dockLabel=ui(label);this.rail.appendChild(b);
    }
    const edgeDock=document.createElement('div');
    edgeDock.className='edge-panel-dock';
    edgeDock.appendChild(this.rail);
    $('app-body').appendChild(this.root);
    document.body.appendChild(edgeDock);
    const spread=$('trade-spread'),size=document.createElement('input'),center=document.createElement('div');
    center.className='trade-center';spread.before(center);center.appendChild(spread);size.id='trade-inline-qty';size.type='number';size.min='1';size.step='1';size.value=$('order-qty').value;size.setAttribute('aria-label','Order quantity');
    size.oninput=()=>{$('order-qty').value=size.value;};$('order-qty').addEventListener('input',()=>{size.value=$('order-qty').value;});center.appendChild(size);
    for(const id of ['btn-trade-buy','btn-trade-sell']){const b=$(id);b.setAttribute('role','button');b.tabIndex=0;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click();}};}
    // Keep existing event handlers and IDs when moving controls into their desktop positions.
    const right=document.querySelector('.topbar-right');right.prepend($('btn-sync'));
    this.installTools();
    for(const c of charts){
      const go=this.button('Scroll to the most recent bar','arrow',()=>{const range=DesktopShell.latestRange(c);if(range)c.chart.timeScale().setVisibleLogicalRange(range);});go.className='chart-go-realtime';go.hidden=true;c.container.appendChild(go);c.goRealtimeButton=go;
      c.chart.subscribeCrosshairMove(p=>{if(c!==this.getActive())return;const bar=p.seriesData?.get(c.series);this.hoverBar=bar?{...bar,time:p.time}:null;if(this.mode==='objects'&&this.objectTab==='data')this.renderData();});
      c.chart.timeScale().subscribeVisibleLogicalRangeChange(()=>this.updateRealtime(c));

    }
    const panel=Workspace.read('terminal_desktop_panel_v1',{});this.objectTab=panel.objectTab==='data'?'data':'tree';
    this.open(['watch','objects','alerts'].includes(panel.mode)?panel.mode:null,false);
    this.installToolbarOverflow();
  }
  installToolbarOverflow(){
    const left=document.querySelector('.topbar-left'),right=document.querySelector('.topbar-right'),header=document.getElementById('topbar');
    const menu=document.createElement('div');menu.className='toolbar-overflow';menu.hidden=true;menu.setAttribute('role','menu');document.body.appendChild(menu);
    const more=document.createElement('button');more.type='button';more.className='btn-icon toolbar-more';more.textContent='⋯';more.hidden=true;more.setAttribute('aria-label','More toolbar actions');more.setAttribute('aria-expanded','false');left.appendChild(more);
    const nodes=[document.getElementById('btn-alert'),document.getElementById('btn-replay'),document.getElementById('btn-layout')].filter(Boolean);
    const items=nodes.map(node=>{const anchor=document.createComment('toolbar-position');node.before(anchor);if(node.tagName==='BUTTON')node.dataset.overflowLabel=node.getAttribute('aria-label')||node.textContent.trim()||node.title;return {node,anchor};});
    const close=(focus=false)=>{menu.hidden=true;more.setAttribute('aria-expanded','false');if(focus)more.focus();};
    more.onclick=()=>{if(!menu.hidden){close();return;}menu.hidden=false;more.setAttribute('aria-expanded','true');const rect=more.getBoundingClientRect();menu.style.left=Math.max(6,Math.min(innerWidth-menu.offsetWidth-6,rect.right-menu.offsetWidth))+'px';menu.style.top=(rect.bottom+4)+'px';menu.querySelector('button:not([disabled])')?.focus();};
    menu.onclick=e=>{if(e.target.closest('button'))close();};
    menu.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const buttons=[...menu.querySelectorAll('button:not([disabled])')],index=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();}};
    document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!more.contains(e.target))close();});
    this.fitToolbar=()=>{
      if(document.fullscreenElement)return;
      close();for(const {node,anchor}of items)anchor.after(node);more.hidden=true;
      if(left.hidden||!header.clientWidth)return;
      const stacked=typeof matchMedia==='function'&&matchMedia('(max-width: 719px)').matches;
      const scale=Math.max(.5,parseFloat(typeof getComputedStyle==='function'?getComputedStyle(document.documentElement).getPropertyValue('--toolbar-scale'):'')||1);
      if(stacked||!header.getBoundingClientRect||!right?.getBoundingClientRect){
        left.style.maxWidth='';left.style.marginLeft='';
      }else{
        const hRect=header.getBoundingClientRect(),rRect=right.getBoundingClientRect();
        const freeVisual=Math.max(0,(rRect.width?rRect.left:hRect.right)-hRect.left-12);
        left.style.maxWidth=Math.max(120,Math.floor(freeVisual/scale))+'px';
        left.style.marginLeft='0px';
      }
      if(left.scrollWidth>left.clientWidth+1){
        more.hidden=false;
        for(const {node}of items){menu.appendChild(node);if(left.scrollWidth<=left.clientWidth+1)break;}
      }
      if(!stacked&&header.getBoundingClientRect&&right?.getBoundingClientRect){
        const hRect=header.getBoundingClientRect(),rRect=right.getBoundingClientRect();
        const span=Math.max(0,(rRect.width?rRect.left:hRect.right)-hRect.left);
        const visualW=left.offsetWidth*scale;
        const idealCenter=(hRect.width-visualW)/2;
        const margin=hRect.width>=1800&&idealCenter+visualW+48<=span?idealCenter:(span-visualW)/2;
        left.style.marginLeft=Math.max(0,Math.min(Math.max(0,span-visualW-12),Math.round(margin)))+'px';
      }
    };
    this.toolbarObserver=new ResizeObserver(()=>{cancelAnimationFrame(this.toolbarFrame);this.toolbarFrame=requestAnimationFrame(this.fitToolbar);});this.toolbarObserver.observe(header);this.toolbarObserver.observe(right);const statusPill=document.getElementById('dock-market-status');if(statusPill)this.toolbarObserver.observe(statusPill);this.fitToolbar();
  }
  button(label,icon,action){const b=document.createElement('button');b.type='button';b.title=ui(label);b.setAttribute('aria-label',ui(label));b.innerHTML=DesktopShell.icon(icon);b.onclick=action;return b;}
  installTools(){
    const rail=document.getElementById('left-sidebar');
    for(const node of rail.querySelectorAll('.tool-separator'))node.remove();
    for(const key of ['crosshair','line','box','text','fib','position','measure','brush','magnet','lock','eye','trash']){
      const b=rail.querySelector(`[data-tool="${key}"]`);if(!b)continue;
      const importedIcon={crosshair:'crosshair',line:'trend',box:'rectangle',text:'text',fib:'fib',position:'forecast',measure:'ruler',brush:'brush',magnet:'magnet',lock:'lock',eye:'eye',trash:'trash'}[key];
      if(importedIcon)b.innerHTML=TerminalIcons.svg(importedIcon);
      rail.appendChild(b);
      if(key==='line'){
        const h=this.button('Horizontal line','hline',()=>this.drawing.setTool('hline'));h.className='tool-btn';h.dataset.tool='hline';h.innerHTML=TerminalIcons.svg('horizontal');rail.appendChild(h);
      }
      if(key==='measure'||key==='box'){const divider=document.createElement('div');divider.className='tool-separator';rail.appendChild(divider);}
      if(key==='magnet'){
        const group=document.createElement('div');group.className='magnet-tool-group';b.before(group);group.appendChild(b);
        const menu=document.createElement('div');menu.className='magnet-menu';menu.hidden=true;menu.setAttribute('role','menu');
        const closeMenu=()=>{menu.hidden=true;b.setAttribute('aria-expanded','false');};
        const showMenu=()=>{menu.hidden=!menu.hidden;b.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden){const rect=group.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,rect.left))+'px';menu.style.top=Math.max(8,rect.top-menu.offsetHeight-8)+'px';}};
        b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');
        b.addEventListener('keydown', e => {if(e.key==='ArrowDown'){e.preventDefault();if(menu.hidden)showMenu();menu.querySelector('button').focus();}});b.oncontextmenu=e=>{e.preventDefault();showMenu();};
        for(const [mode,label] of [['weak','Weak magnet'],['strong','Strong magnet'],['off','Off']]){const option=document.createElement('button');option.type='button';option.textContent=label;option.setAttribute('role','menuitem');option.onclick=()=>{this.drawing.setMagnet(mode!=='off',mode==='off'?this.drawing.magnetMode:mode);closeMenu();b.focus();};menu.appendChild(option);}
        document.body.appendChild(menu);document.addEventListener('click',e=>{if(!group.contains(e.target)&&!menu.contains(e.target))closeMenu();});menu.onkeydown=e=>{if(e.key==='Escape'){closeMenu();b.focus();}};
      }
    }
  }
  syncRailActive(){
    const compOpen=!!this.companions?.open;
    const paperOpen=typeof document!=='undefined'&&!!document.getElementById('paper-panel')?.classList.contains('open');
    const mode=this.mode;
    this.rail?.querySelectorAll('[data-panel]').forEach(b=>{
      const p=b.dataset.panel;
      if(p==='paper'){
        b.classList.toggle('active',paperOpen);
        b.setAttribute('aria-expanded',String(paperOpen));
        return;
      }
      const isChart=p==='chart';
      const active=isChart?(!mode&&!compOpen&&!paperOpen):(p===mode);
      b.classList.toggle('active',active);
      if(isChart)b.setAttribute('aria-current',String(active));
      else if(p!=='editor')b.setAttribute('aria-expanded',String(p===mode));
    });
  }
  open(mode,persist=true){
    if(mode&&this.companions?.open)this.companions.toggle(this.companions.open,false);
    this.mode=mode;this.root.dataset.mode=mode||'';this.signature='';this.hoverBar=null;this.root.hidden=!mode;this.content.replaceChildren();this.tabs.replaceChildren();
    this.syncRailActive();
    if(persist)Workspace.write('terminal_desktop_panel_v1',{mode,objectTab:this.objectTab||'tree'});
    if(!mode)return;
    if(mode==='objects')for(const [key,label] of [['tree','Object tree'],['data','Data window']]){
      const b=document.createElement('button');b.type='button';b.textContent=ui(label);b.setAttribute('role','tab');b.dataset.objectTab=key;b.onclick=()=>{this.objectTab=key;Workspace.write('terminal_desktop_panel_v1',{mode:this.mode,objectTab:key});this.signature='';this.refresh();};this.tabs.appendChild(b);
    }else if(mode==='alerts'){
      const wrap=document.createElement('div');
      wrap.className='alerts-panel-head';
      wrap.innerHTML=`<span class="alerts-head-icon" aria-hidden="true">${DesktopShell.icon('alerts')}</span><h2>${ui('Cảnh báo giá')}</h2><span id="alerts-head-count" class="alerts-head-count" hidden>0</span>`;
      this.tabs.appendChild(wrap);
    }else{
      const h=document.createElement('h2');h.textContent=ui('Danh sách theo dõi');this.tabs.appendChild(h);
    }
    this.objectTab||='tree';this.refresh();
  }
  refresh(){
    for(const c of this.charts)this.updateRealtime(c);
    const allAlerts=this.getAlerts?.()||[];
    const activeAlertCount=allAlerts.filter(a=>!a.triggered).length;
    const alertRailBtn=this.rail?.querySelector('[data-panel="alerts"]');
    if(alertRailBtn){
      if(activeAlertCount>0)alertRailBtn.dataset.badge=String(activeAlertCount);
      else delete alertRailBtn.dataset.badge;
    }
    if(!this.mode)return;
    const active=this.getActive(),activeKey=[active.id,active.symbol,active.currentTimeframe].join(':');
    if(this.activeKey!==activeKey){this.activeKey=activeKey;this.hoverBar=null;this.signature='';}
    if(this.mode==='watch')this.renderWatchlist();
    else if(this.mode==='alerts')this.renderAlerts();
    else{this.tabs.querySelectorAll('[data-object-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.objectTab===this.objectTab)));this.objectTab==='data'?this.renderData():this.renderTree();}
  }
  updateRealtime(c){
    const range=c.chart.timeScale().getVisibleLogicalRange();
    const last=c.bars.length-1,emptyRange=range&&(range.from>last||range.to<0);
    c.goRealtimeButton.hidden=!range||!c.bars.length||!emptyRange&&range.to>=last||!!c.replayMode;
    c.goRealtimeButton.style.bottom=`${(c.paneHeight||0)+35}px`;
  }
  heading(text){const h=document.createElement('h3');h.textContent=text;this.content.appendChild(h);}
  renderWatchlist(){
    const markets=this.getMarkets();
    const selected=this.getActive().symbol;
    const instruments=[
      ['NQ1!','Nasdaq 100','nasdaq-100'],
      ['ES1!','S&P 500','s-and-p-500'],
      ['YM1!','Dow Jones','dow-30'],
      ['CL1!','Dầu WTI',null]
    ].map(([symbol,name,icon])=>({symbol,name,icon,close:markets.get(symbol)?.['1m']?.at(-1)?.close}));
    const signature=JSON.stringify([selected,instruments.map(({close})=>close)]);
    if(signature===this.signature)return;
    this.signature=signature;
    const focusSymbol=document.activeElement?.dataset.watchSymbol;
    const list=document.createElement('div');
    list.className='watch-list';
    const labels=document.createElement('div');
    labels.className='watch-head';
    for(const text of ['Mã','Giá cuối']){
      const label=document.createElement('span');label.textContent=ui(text);labels.append(label);
    }
    list.append(labels);
    for(const {symbol,name,icon,close} of instruments){
      const row=document.createElement('button');
      row.type='button';row.className='watch-row';row.dataset.watchSymbol=symbol;
      row.classList.toggle('selected',symbol===selected);
      if(symbol===selected)row.setAttribute('aria-current','true');
      row.onclick=()=>this.onSymbol(symbol);
      const badge=document.createElement('span');badge.className='watch-badge';badge.setAttribute('aria-hidden','true');
      if(icon){
        const image=document.createElement('img');image.src='assets/symbols/'+icon+'.svg';image.alt='';badge.append(image);
      }else badge.textContent='CL';
      const identity=document.createElement('span');identity.className='watch-identity';
      const ticker=document.createElement('strong');ticker.textContent=symbol;
      const description=document.createElement('small');description.textContent=name;
      identity.append(ticker,description);
      const value=document.createElement('span');value.className='watch-value';value.textContent=Number.isFinite(close)?close.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
      row.append(badge,identity,value);list.append(row);
    }
    const note=document.createElement('p');
    note.className='watch-source';
    note.textContent=ui(instruments.some(({close})=>Number.isFinite(close))?'Nguồn giá · TradingView':'Đang chờ dữ liệu giá');
    this.content.replaceChildren(list,note);
    if(focusSymbol)[...list.querySelectorAll('.watch-row')].find(row=>row.dataset.watchSymbol===focusSymbol)?.focus({preventScroll:true});
  }
  renderTree(){
    const c=this.getActive(),entries=c.runner?.entries||[],signature=JSON.stringify([c.id,c.symbol,c.currentTimeframe,entries.map(e=>[e.record.id,e.name,e.record.view,e.record.enabled]),c.drawings]);if(this.signature===signature)return;this.signature=signature;this.content.replaceChildren();this.heading(`${c.symbol} · ${c.metadata.exchange||''} · ${c.currentTimeframe}`);
    for(const entry of entries){const row=document.createElement('div');row.className='object-row';const title=document.createElement('button');title.textContent=entry.name||entry.record.name;title.onclick=()=>{c.runner.select(entry.record.id);c.onIndicatorSettings?.();};const eye=this.button(entry.record.view?.hidden?'Show indicator':'Hide indicator','eye',()=>{c.runner.toggle(entry.record.id);this.signature='';this.refresh();});const remove=this.button('Remove indicator','close',()=>{c.runner.remove(entry.record.id);this.signature='';this.refresh();});row.classList.toggle('object-hidden',!!entry.record.view?.hidden);row.append(title,eye,remove);this.content.appendChild(row);}
    for(const value of c.drawings.filter(d=>!d.isTemp).slice().reverse()){
      const row=document.createElement('div');row.className='object-row';row.classList.toggle('object-hidden',!!value.hidden);
      const select=document.createElement('button');select.textContent=value.title||DrawingModel.names[value.type]||value.type;select.title=value.text||select.textContent;select.onclick=()=>{this.drawing.setTool('crosshair');this.drawing.editor.select(c,value);this.drawing.editor.open();};
      const eye=this.button(value.hidden?'Show drawing':'Hide drawing','eye',()=>{value.hidden=!value.hidden;if(value.hidden)this.drawing.editor.clear();this.drawing.saveDrawings(c);c.renderDrawings();this.signature='';this.refresh();});
      const lock=this.button(value.locked?'Unlock drawing':'Lock drawing','lock',()=>{value.locked=!value.locked;this.drawing.saveDrawings(c);c.renderDrawings();this.signature='';this.refresh();});lock.classList.toggle('active',!!value.locked);row.append(select,eye,lock);this.content.appendChild(row);
    }
    if(!c.drawings.some(d=>!d.isTemp)&&!entries.length){const p=document.createElement('p');p.className='desktop-panel-note';p.textContent='No drawings or indicators on this chart.';this.content.appendChild(p);}
  }
  renderData(){
    const c=this.getActive(),bar=this.hoverBar||c.bars.at(-1);this.content.replaceChildren();this.heading(`${c.symbol} · ${c.currentTimeframe}`);if(!bar)return;
    const formatter=ChartAppearance.formatters(c.appearance);const rows=[['Date / Time',formatter.full(bar.time)],['Open',bar.open],['High',bar.high],['Low',bar.low],['Close',bar.close],['Volume',bar.volume??c.bars.find(b=>b.time===bar.time)?.volume??'—']];
    const index=c.bars.findIndex(b=>b.time===bar.time),previous=c.bars[index-1]?.close;if(previous!==undefined)rows.push(['Change',bar.close-previous]);
    for(const [label,value] of rows){const row=document.createElement('div');row.className='data-window-row';const name=document.createElement('span');name.textContent=label;const data=document.createElement('span');data.textContent=typeof value==='number'?value.toLocaleString('en-US',{maximumFractionDigits:8}):String(value);row.append(name,data);this.content.appendChild(row);}
    const entries=c.runner?.entries||[];
    for(const entry of entries){const result=entry.runner.lastResult,plots=[...(result?.series||[]),...(result?.pane?.series||[])];if(!plots.length)continue;this.heading(entry.name||entry.record.name);for(const series of plots){const value=series.data.find(p=>p.time===bar.time)?.value;const row=document.createElement('p');row.className='data-window-row';row.textContent=`${series.title||series.type}: ${value??'—'}`;this.content.appendChild(row);}}

  }
  _syncAlertLiveMetrics(){
    const markets=this.getMarkets?.();
    const active=this.getActive?.();
    if(!markets||!active)return;
    const fmt=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const curPx=markets.get(active.symbol)?.['1m']?.at(-1)?.close ?? active.bars?.at(-1)?.close;
    const liveBtn=this.content.querySelector('#alerts-live-px');
    if(liveBtn&&Number.isFinite(curPx)){
      liveBtn.textContent=fmt(curPx);
      liveBtn.dataset.price=String(curPx);
    }
    for(const distEl of this.content.querySelectorAll('[data-alert-dist]')){
      const sym=distEl.dataset.sym;
      const target=Number(distEl.dataset.target);
      const mktPx=markets.get(sym)?.['1m']?.at(-1)?.close;
      if(Number.isFinite(mktPx)&&Number.isFinite(target)){
        const diff=target-mktPx;
        distEl.textContent=`${diff>=0?'+':''}${diff.toFixed(2)} pts`;
      }
    }
  }
  renderAlerts(){
    const alerts=this.getAlerts()||[];
    const active=this.getActive();
    const markets=this.getMarkets();
    const sym=active?.symbol||'NQ1!';
    const tick=markets.get(sym)?.metadata?.tickSize||active?.metadata?.tickSize||0.25;
    const curPx=markets.get(sym)?.['1m']?.at(-1)?.close ?? active?.bars?.at(-1)?.close;
    const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';

    const activeCnt=alerts.filter(a=>!a.triggered).length;
    const trigCnt=alerts.length-activeCnt;
    const headBadge=this.tabs.querySelector('#alerts-head-count');
    if(headBadge){
      headBadge.hidden=alerts.length===0;
      headBadge.textContent=activeCnt>0?`${activeCnt} đang canh`:`${trigCnt} đã khớp`;
    }

    const signature=JSON.stringify([sym,this.alertFilter,alerts]);
    if(signature===this.signature){
      this._syncAlertLiveMetrics();
      return;
    }
    this.signature=signature;

    if(this._alertDraftSym!==sym){
      this._alertDraftSym=sym;
      this._alertDraftPrice=Number.isFinite(curPx)?String(curPx):'';
    }

    this.content.replaceChildren();
    const shell=document.createElement('div');
    shell.className='alerts-hub';

    // 1. Inline Quick-Alert Composer Card
    const comp=document.createElement('div');
    comp.className='alerts-composer';

    const compTop=document.createElement('div');
    compTop.className='alerts-comp-top';
    const symChip=document.createElement('span');
    symChip.className='alerts-sym-pill';
    symChip.textContent=sym;

    const liveBtn=document.createElement('button');
    liveBtn.type='button';
    liveBtn.id='alerts-live-px';
    liveBtn.className='alerts-live-px';
    liveBtn.title='Bấm để điền giá thị trường hiện tại';
    liveBtn.dataset.price=Number.isFinite(curPx)?String(curPx):'';
    liveBtn.textContent=Number.isFinite(curPx)?fmt(curPx):'—';

    const modalBtn=document.createElement('button');
    modalBtn.type='button';
    modalBtn.className='alerts-expand-btn';
    modalBtn.title='Mở hộp thoại chi tiết (Alt + A)';
    modalBtn.setAttribute('aria-label','Open full alert dialog');
    modalBtn.textContent='Alt+A ↗';
    modalBtn.onclick=()=>this.onAlertDialog?this.onAlertDialog():document.getElementById('btn-alert')?.click();

    compTop.append(symChip,liveBtn,modalBtn);

    const condRow=document.createElement('div');
    condRow.className='alerts-cond-seg';
    const condDefs=[
      ['cross','⇅ Cắt qua'],
      ['greater','↗ Vượt ≥'],
      ['less','↘ Thấp ≤']
    ];
    for(const [val,txt] of condDefs){
      const b=document.createElement('button');
      b.type='button';
      b.className='alerts-cond-btn'+(this._alertCond===val?' active':'');
      b.textContent=txt;
      b.onclick=()=>{
        this._alertCond=val;
        for(const c of condRow.children)c.classList.toggle('active',c===b);
      };
      condRow.appendChild(b);
    }

    const inputRow=document.createElement('div');
    inputRow.className='alerts-input-row';
    const priceIn=document.createElement('input');
    priceIn.type='number';
    priceIn.step=String(tick);
    priceIn.className='alerts-price-in';
    priceIn.placeholder='Nhập mức giá cảnh báo…';
    priceIn.setAttribute('aria-label','Alert target price');
    priceIn.value=this._alertDraftPrice||(Number.isFinite(curPx)?String(curPx):'');
    priceIn.oninput=()=>{this._alertDraftPrice=priceIn.value;};

    const addBtn=document.createElement('button');
    addBtn.type='button';
    addBtn.className='desktop-add-alert';
    addBtn.textContent='+ Đặt báo';
    const submitQuick=()=>{
      if(this.onAlertCreate){
        if(this.onAlertCreate(sym,Number(priceIn.value),this._alertCond)){
          this.signature='';
          this.refresh();
        }
      }else{
        this.onAlertDialog?this.onAlertDialog():document.getElementById('btn-alert')?.click();
      }
    };
    addBtn.onclick=submitQuick;
    priceIn.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();submitQuick();}
    });
    liveBtn.onclick=()=>{
      const px=Number(liveBtn.dataset.price);
      if(Number.isFinite(px)){priceIn.value=String(px);this._alertDraftPrice=String(px);priceIn.focus();}
    };
    inputRow.append(priceIn,addBtn);

    const stepRow=document.createElement('div');
    stepRow.className='alerts-step-row';
    for(const d of [-50,-20,-10,0,10,20,50]){
      const chip=document.createElement('button');
      chip.type='button';
      chip.className='alerts-step-btn'+(d===0?' is-now':'');
      chip.textContent=d===0?'Hiện tại':(d>0?`+${d}`:String(d));
      chip.onclick=()=>{
        const latest=Number(liveBtn.dataset.price)||curPx;
        const base=d===0?latest:(Number(priceIn.value)||latest);
        if(!Number.isFinite(base))return;
        const nextVal=typeof AlertPrice!=='undefined'?AlertPrice.round(d===0?base:base+d,tick):Number((d===0?base:base+d).toFixed(2));
        priceIn.value=String(nextVal);
        this._alertDraftPrice=String(nextVal);
        priceIn.focus();
      };
      stepRow.appendChild(chip);
    }

    comp.append(compTop,condRow,inputRow,stepRow);
    shell.appendChild(comp);

    // 2. Filter Bar (when alerts exist)
    if(alerts.length>0){
      const filterBar=document.createElement('div');
      filterBar.className='alerts-filter-bar';
      const tabsWrap=document.createElement('div');
      tabsWrap.className='alerts-filter-tabs';
      for(const [fKey,fLbl] of [['all',`Tất cả (${alerts.length})`],['active',`Đang canh (${activeCnt})`],['triggered',`Đã khớp (${trigCnt})`]]){
        const fb=document.createElement('button');
        fb.type='button';
        fb.className='alerts-filter-btn'+(this.alertFilter===fKey?' active':'');
        fb.textContent=fLbl;
        fb.onclick=()=>{this.alertFilter=fKey;this.signature='';this.refresh();};
        tabsWrap.appendChild(fb);
      }
      filterBar.appendChild(tabsWrap);
      if(trigCnt>0&&this.onAlertClearTriggered){
        const clr=document.createElement('button');
        clr.type='button';
        clr.className='alerts-clear-trig';
        clr.title='Xóa toàn bộ cảnh báo đã khớp';
        clr.textContent='Dọn đã khớp';
        clr.onclick=()=>{this.onAlertClearTriggered();this.signature='';this.refresh();};
        filterBar.appendChild(clr);
      }
      shell.appendChild(filterBar);
    }

    // 3. Alert Cards or Compact Empty State
    const visibleAlerts=alerts
      .map((alert,index)=>({alert,index}))
      .filter(({alert})=>this.alertFilter==='active'?!alert.triggered:this.alertFilter==='triggered'?!!alert.triggered:true)
      .reverse();

    if(visibleAlerts.length>0){
      const list=document.createElement('div');
      list.className='alerts-card-list';
      const condText=c=>c==='greater'?'↗ Vượt lên ≥':c==='less'?'↘ Giảm xuống ≤':'⇅ Cắt qua';

      for(const {alert,index} of visibleAlerts){
        const card=document.createElement('div');
        card.className=`alert-list-row alert-card is-${alert.condition||'cross'}${alert.triggered?' is-triggered':''}`;

        const main=document.createElement('div');
        main.className='alert-card-main';
        main.tabIndex=0;
        main.setAttribute('role','button');
        main.title='Bấm để chỉnh sửa cảnh báo';
        main.onclick=()=>this.onAlertEdit?.(alert.id);
        main.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.onAlertEdit?.(alert.id);}};

        const topLine=document.createElement('div');
        topLine.className='alert-card-top';
        const sBadge=document.createElement('span');
        sBadge.className='alert-card-sym';
        sBadge.textContent=alert.symbol;
        const pVal=document.createElement('strong');
        pVal.className='alert-card-price';
        pVal.textContent=fmt(alert.price);
        topLine.append(sBadge,pVal);

        const botLine=document.createElement('div');
        botLine.className='alert-card-meta';
        const cTag=document.createElement('span');
        cTag.className='alert-card-cond';
        cTag.textContent=condText(alert.condition);

        const distTag=document.createElement('span');
        distTag.className='alert-card-dist';
        distTag.dataset.alertDist='1';
        distTag.dataset.sym=alert.symbol;
        distTag.dataset.target=String(alert.price);
        const symPx=markets.get(alert.symbol)?.['1m']?.at(-1)?.close;
        if(Number.isFinite(symPx)){
          const diff=alert.price-symPx;
          distTag.textContent=`${diff>=0?'+':''}${diff.toFixed(2)} pts`;
        }

        const stTag=document.createElement('span');
        stTag.className='alert-card-status'+(alert.triggered?' triggered':' active');
        stTag.textContent=alert.triggered?'✓ Đã khớp':'● Đang canh';

        botLine.append(cTag,distTag,stTag);
        main.append(topLine,botLine);

        const actions=document.createElement('div');
        actions.className='alert-card-actions';
        if(alert.triggered&&this.onAlertRearm){
          const rearm=document.createElement('button');
          rearm.type='button';
          rearm.className='alert-act-btn rearm';
          rearm.title='Bật canh lại cảnh báo này';
          rearm.setAttribute('aria-label','Rearm alert');
          rearm.textContent='↻';
          rearm.onclick=e=>{e.stopPropagation();this.onAlertRearm(alert.id);this.signature='';this.refresh();};
          actions.appendChild(rearm);
        }
        const remove=this.button('Xóa cảnh báo','close',()=>{
          this.onAlertRemove(alert.id??index);
          this.signature='';
          this.refresh();
        });
        remove.classList.add('alert-act-btn','remove');
        actions.appendChild(remove);

        card.append(main,actions);
        list.appendChild(card);
      }
      shell.appendChild(list);
    } else {
      const empty=document.createElement('div');
      empty.className='alerts-empty-card';
      empty.innerHTML=`
        <div class="alerts-empty-icon" aria-hidden="true">${DesktopShell.icon('alerts')}</div>
        <strong class="alerts-empty-title">${alerts.length?'Không có cảnh báo ở mục này':'Chưa có cảnh báo giá'}</strong>
        <p class="desktop-panel-note">Nhập nhanh mức giá ở trên, nhấn <kbd>Alt</kbd>+<kbd>A</kbd> hoặc chuột phải vào biểu đồ để đặt báo động.</p>
      `;
      shell.appendChild(empty);
    }

    this.content.appendChild(shell);
  }
}
if(typeof module!=='undefined')module.exports=DesktopShell;
