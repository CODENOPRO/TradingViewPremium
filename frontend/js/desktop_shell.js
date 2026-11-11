/* Local desktop chrome. Panels use the existing chart, ledger and drawing stores. */
class DesktopShell {
  static latestRange(chart) {
    if(!chart.bars.length)return null;
    const previous=chart.chart.timeScale().getVisibleLogicalRange(),span=previous&&previous.to>previous.from?previous.to-previous.from:100;
    const to=chart.bars.length-1+(chart.appearance?.rightMargin??10);
    return {from:to-span,to};
  }
  static icon(name) {
    const paths={watch:'M4 3h16v18l-8-4-8 4z',alerts:'M12 8v5l3 2M5 4L2 7m17-3 3 3M4 13a8 8 0 1 0 16 0 8 8 0 1 0-16 0',objects:'M2 8l10-6 10 6-10 6zM2 13l10 6 10-6M2 18l10 6 10-6',editor:'M8 5L2 12l6 7m8-14 6 7-6 7',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',lock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4',close:'M5 5l14 14M19 5L5 19',settings:'M4 4h16v16H4zM8 8h8v8H8z',arrow:'M4 12h16m-6-6 6 6-6 6',line:'M4 20L20 4M2 18l4 4M18 2l4 4',hline:'M2 12h20M5 9v6',fib:'M3 4h18M3 10h13M3 16h18M3 22h9',box:'M4 4h16v16H4zM2 2h4v4H2zM18 18h4v4h-4z',position:'M4 4h12v7H4zM8 11h12v9H8zM2 4h20',text:'M4 5V3h16v2M12 3v18M8 21h8',keep:'M3 14l11-11 7 7-11 11H3zM15 14v8m-4-4h8'};
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.objects}"/></svg>`;
  }
  constructor({charts,getActive,getMarkets,getAlerts,onAlertRemove,onSymbol,onIndicatorToggle,drawing}) {
    Object.assign(this,{charts,getActive,getMarkets,getAlerts,onAlertRemove,onSymbol,onIndicatorToggle,drawing});
    const $=id=>document.getElementById(id);
    this.root=document.createElement('aside');this.root.id='desktop-panel';this.root.hidden=true;this.root.setAttribute('aria-label','Chart side panel');
    this.root.innerHTML='<div class="desktop-panel-header"><div class="desktop-panel-tabs" role="tablist"></div><button class="desktop-panel-close" aria-label="Close side panel">×</button></div><div class="desktop-panel-content"></div>';
    this.content=this.root.querySelector('.desktop-panel-content');this.tabs=this.root.querySelector('.desktop-panel-tabs');
    this.root.querySelector('.desktop-panel-close').onclick=()=>this.open(null);
    this.root.onkeydown=e=>{if(e.key==='Escape'){const mode=this.mode;this.open(null);this.rail.querySelector(`[data-panel="${mode}"]`)?.focus();}};
    this.rail=document.createElement('nav');this.rail.id='right-sidebar';this.rail.setAttribute('aria-label','Chart panels');
    for(const [key,label] of [['watch','Watchlist'],['alerts','Alerts panel'],['objects','Object tree and data window'],['editor','Indicator editor']]){
      const b=this.button(label,key,()=>key==='editor'?$('btn-indicator').click():this.open(this.mode===key?null:key));b.dataset.panel=key;this.rail.appendChild(b);
    }
    $('app-body').append(this.root,this.rail);
    const spread=$('trade-spread'),size=document.createElement('input'),center=document.createElement('div');
    center.className='trade-center';spread.before(center);center.appendChild(spread);size.id='trade-inline-qty';size.type='number';size.min='1';size.step='1';size.value=$('order-qty').value;size.setAttribute('aria-label','Order quantity');
    size.oninput=()=>{$('order-qty').value=size.value;};$('order-qty').addEventListener('input',()=>{size.value=$('order-qty').value;});center.appendChild(size);
    for(const id of ['btn-trade-buy','btn-trade-sell']){const b=$(id);b.setAttribute('role','button');b.tabIndex=0;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click();}};}
    // Keep existing event handlers and IDs when moving controls into their desktop positions.
    const footer=document.createElement('div');footer.id='desktop-footer';
    const editor=this.button('Indicator editor','editor',()=>$('btn-indicator').click());editor.append('Indicator Editor');
    footer.append(editor,$('btn-paper'));$('content-wrapper').appendChild(footer);
    const meta=document.querySelector('.bottom-meta');meta.appendChild($('session-mode'));$('session-mode').title='Chart session: RTH / ETH';
    $('layout-popover').appendChild($('btn-sync'));$('btn-sync').classList.add('layout-sync');
    $('btn-refresh-htf').classList.add('footer-refresh');footer.appendChild($('btn-refresh-htf'));
    this.undo=this.button('Undo drawing','arrow',()=>{this.drawing.historyStep(this.getActive(),false);this.signature='';this.refresh();});this.undo.className='btn-icon desktop-undo';
    this.redo=this.button('Redo drawing','arrow',()=>{this.drawing.historyStep(this.getActive(),true);this.signature='';this.refresh();});this.redo.className='btn-icon';
    document.querySelector('.topbar-left').append(this.undo,this.redo);
    this.installTools();
    for(const c of charts){
      const go=this.button('Scroll to the most recent bar','arrow',()=>{const range=DesktopShell.latestRange(c);if(range)c.chart.timeScale().setVisibleLogicalRange(range);});go.className='chart-go-realtime';go.hidden=true;c.container.appendChild(go);c.goRealtimeButton=go;
      c.chart.subscribeCrosshairMove(p=>{if(c!==this.getActive())return;const bar=p.seriesData?.get(c.series);this.hoverBar=bar?{...bar,time:p.time}:null;if(this.mode==='objects'&&this.objectTab==='data')this.renderData();});
      c.chart.timeScale().subscribeVisibleLogicalRangeChange(()=>this.updateRealtime(c));
      const controls=document.createElement('div');controls.className='chart-window-controls';
      const properties=this.button('Chart settings','settings',()=>c.onChartSettings?.());
      const expand=this.button('Maximize chart','box',()=>{const grid=$('chart-grid'),expanded=grid.dataset.expanded===c.id;grid.dataset.expanded=expanded?'':c.id;expand.setAttribute('aria-label',expanded?'Maximize chart':'Restore charts');expand.title=expanded?'Maximize chart':'Restore charts';});
      controls.append(properties,expand);c.container.appendChild(controls);
    }
    const panel=Workspace.read('terminal_desktop_panel_v1',{});this.objectTab=panel.objectTab==='data'?'data':'tree';
    this.open(['watch','objects','alerts'].includes(panel.mode)?panel.mode:null,false);
  }
  button(label,icon,action){const b=document.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=DesktopShell.icon(icon);b.onclick=action;return b;}
  installTools(){
    const rail=document.getElementById('left-sidebar');
    for(const node of rail.querySelectorAll('.tool-separator'))node.remove();
    for(const key of ['crosshair','line','fib','position','box','text','measure','magnet','lock','eye','trash']){
      const b=rail.querySelector(`[data-tool="${key}"]`);if(!b)continue;
      if(['line','fib','position','box','text'].includes(key))b.innerHTML=DesktopShell.icon(key);
      rail.appendChild(b);
      if(key==='line'){
        const h=this.button('Horizontal line','hline',()=>this.drawing.setTool('hline'));h.className='tool-btn';h.dataset.tool='hline';rail.appendChild(h);
      }
      if(key==='measure'||key==='text'){const divider=document.createElement('div');divider.className='tool-separator';rail.appendChild(divider);}
      if(key==='magnet'){
        const keep=this.button('Stay in drawing mode','keep',()=>{this.drawing.keepDrawing=!this.drawing.keepDrawing;keep.classList.toggle('active',this.drawing.keepDrawing);keep.setAttribute('aria-pressed',String(this.drawing.keepDrawing));});keep.className='tool-btn';keep.setAttribute('aria-pressed','false');rail.appendChild(keep);
      }
    }
  }
  open(mode,persist=true){
    this.mode=mode;this.signature='';this.hoverBar=null;this.root.hidden=!mode;this.content.replaceChildren();this.tabs.replaceChildren();
    this.rail.querySelectorAll('[data-panel]').forEach(b=>{b.classList.toggle('active',b.dataset.panel===mode);b.setAttribute('aria-expanded',String(b.dataset.panel===mode));});
    if(persist)Workspace.write('terminal_desktop_panel_v1',{mode,objectTab:this.objectTab||'tree'});
    if(!mode)return;
    if(mode==='objects')for(const [key,label] of [['tree','Object tree'],['data','Data window']]){
      const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('role','tab');b.dataset.objectTab=key;b.onclick=()=>{this.objectTab=key;Workspace.write('terminal_desktop_panel_v1',{mode:this.mode,objectTab:key});this.signature='';this.refresh();};this.tabs.appendChild(b);
    }else{const h=document.createElement('strong');h.textContent=mode==='watch'?'Watchlist':'Alerts';this.tabs.appendChild(h);}
    this.objectTab||='tree';this.refresh();
  }
  refresh(){
    for(const c of this.charts)this.updateRealtime(c);
    const key=this.drawing.storageKey(this.getActive());this.undo.disabled=(this.drawing.undoStacks.get(key)?.length||0)<2;this.redo.disabled=!this.drawing.redoStacks.get(key)?.length;
    if(!this.mode)return;
    const active=this.getActive(),activeKey=[active.id,active.symbol,active.currentTimeframe].join(':');
    if(this.activeKey!==activeKey){this.activeKey=activeKey;this.hoverBar=null;this.signature='';}
    if(this.mode==='watch')this.renderWatchlist();
    else if(this.mode==='alerts')this.renderAlerts();
    else{this.tabs.querySelectorAll('[data-object-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.objectTab===this.objectTab)));this.objectTab==='data'?this.renderData():this.renderTree();}
  }
  updateRealtime(c){
    const range=c.chart.timeScale().getVisibleLogicalRange();
    c.goRealtimeButton.hidden=!range||!c.bars.length||range.to>=c.bars.length-1||!!c.replayMode;
    c.goRealtimeButton.style.bottom=`${(c.paneHeight||0)+35}px`;
  }
  heading(text){const h=document.createElement('h3');h.textContent=text;this.content.appendChild(h);}
  renderWatchlist(){
    const markets=this.getMarkets(),signature=JSON.stringify([...markets].map(([symbol,data])=>[symbol,data['1m']?.at(-1),this.getActive().symbol]));if(signature===this.signature)return;this.signature=signature;
    const focusSymbol=document.activeElement?.dataset.watchSymbol;this.content.replaceChildren();
    const labels=document.createElement('div');labels.className='watch-head';labels.textContent='Symbol                         Last';this.content.appendChild(labels);
    for(const symbol of ['NQ1!','ES1!','YM1!','CL1!']){const data=markets.get(symbol),bar=data?.['1m']?.at(-1);const b=document.createElement('button');b.className='watch-row';b.dataset.watchSymbol=symbol;b.classList.toggle('selected',symbol===this.getActive().symbol);b.onclick=()=>this.onSymbol(symbol);const name=document.createElement('span');name.textContent=symbol;const value=document.createElement('span');value.textContent=bar?bar.close.toLocaleString('en-US',{minimumFractionDigits:2}):'—';b.append(name,value);this.content.appendChild(b);if(focusSymbol===symbol)b.focus({preventScroll:true});}
    const note=document.createElement('p');note.className='desktop-panel-note';note.textContent='Last trade · dữ liệu đang tải từ TradingView';this.content.appendChild(note);
  }
  renderTree(){
    const c=this.getActive(),script=Workspace.read(`indicator_${c.id}`,null),signature=JSON.stringify([c.id,c.symbol,c.currentTimeframe,c.runner?.name,c.runner?.view?.hidden,c.drawings]);if(this.signature===signature)return;this.signature=signature;this.content.replaceChildren();this.heading(`${c.symbol} · ${c.metadata.exchange||''} · ${c.currentTimeframe}`);
    if(script?.code){const row=document.createElement('div');row.className='object-row';const title=document.createElement('button');title.textContent=c.runner?.name||script.name;title.onclick=()=>c.onIndicatorSettings?.();const eye=this.button(c.runner?.view?.hidden?'Show indicator':'Hide indicator','eye',()=>{this.onIndicatorToggle(c);this.signature='';this.refresh();});row.classList.toggle('object-hidden',!!c.runner?.view?.hidden);row.append(title,eye);this.content.appendChild(row);}
    for(const value of c.drawings.filter(d=>!d.isTemp).slice().reverse()){
      const row=document.createElement('div');row.className='object-row';row.classList.toggle('object-hidden',!!value.hidden);
      const select=document.createElement('button');select.textContent=DrawingModel.names[value.type]||value.type;select.title=value.text||select.textContent;select.onclick=()=>{this.drawing.setTool('crosshair');this.drawing.editor.select(c,value);this.drawing.editor.open();};
      const eye=this.button(value.hidden?'Show drawing':'Hide drawing','eye',()=>{value.hidden=!value.hidden;if(value.hidden)this.drawing.editor.clear();this.drawing.saveDrawings(c);c.renderDrawings();this.signature='';this.refresh();});
      const lock=this.button(value.locked?'Unlock drawing':'Lock drawing','lock',()=>{value.locked=!value.locked;this.drawing.saveDrawings(c);c.renderDrawings();this.signature='';this.refresh();});lock.classList.toggle('active',!!value.locked);row.append(select,eye,lock);this.content.appendChild(row);
    }
    if(!c.drawings.some(d=>!d.isTemp)&&!script?.code){const p=document.createElement('p');p.className='desktop-panel-note';p.textContent='No drawings or indicators on this chart.';this.content.appendChild(p);}
  }
  renderData(){
    const c=this.getActive(),bar=this.hoverBar||c.bars.at(-1);this.content.replaceChildren();this.heading(`${c.symbol} · ${c.currentTimeframe}`);if(!bar)return;
    const formatter=ChartAppearance.formatters(c.appearance);const rows=[['Date / Time',formatter.full(bar.time)],['Open',bar.open],['High',bar.high],['Low',bar.low],['Close',bar.close],['Volume',bar.volume??c.bars.find(b=>b.time===bar.time)?.volume??'—']];
    const index=c.bars.findIndex(b=>b.time===bar.time),previous=c.bars[index-1]?.close;if(previous!==undefined)rows.push(['Change',bar.close-previous]);
    for(const [label,value] of rows){const row=document.createElement('div');row.className='data-window-row';const name=document.createElement('span');name.textContent=label;const data=document.createElement('span');data.textContent=typeof value==='number'?value.toLocaleString('en-US',{maximumFractionDigits:8}):String(value);row.append(name,data);this.content.appendChild(row);}
    const result=c.runner?.lastResult;if(result?.series?.length){this.heading(c.runner.name||'Indicator');for(const series of result.series){const value=series.data.find(p=>p.time===bar.time)?.value;const row=document.createElement('p');row.className='data-window-row';row.textContent=`${series.title||series.type}: ${value??'—'}`;this.content.appendChild(row);}}
  }
  renderAlerts(){
    const alerts=this.getAlerts(),signature=JSON.stringify(alerts);if(signature===this.signature)return;this.signature=signature;this.content.replaceChildren();
    const create=document.createElement('button');create.className='desktop-add-alert';create.textContent='+ Create alert';create.onclick=()=>document.getElementById('btn-alert').click();this.content.appendChild(create);
    for(const [index,alert] of alerts.entries()){const row=document.createElement('div');row.className='alert-list-row';const label=document.createElement('span');label.textContent=`${alert.symbol} · ${alert.price}\n${alert.condition} · ${alert.triggered?'Triggered':'Active'}`;const remove=this.button('Remove alert','close',()=>{this.onAlertRemove(index);this.signature='';this.refresh();});row.append(label,remove);this.content.appendChild(row);}
    if(!alerts.length){const p=document.createElement('p');p.className='desktop-panel-note';p.textContent='No price alerts yet.';this.content.appendChild(p);}
  }
}
if(typeof module!=='undefined')module.exports=DesktopShell;
