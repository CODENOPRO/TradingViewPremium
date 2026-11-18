class DrawingEditor {
  static tbSvg(d, fill = false) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${fill ? `<path d="${d}" fill="currentColor" stroke="none"/>` : `<path d="${d}"/>`}</svg>`;
  }

  constructor(manager) {
    this.manager=manager;
    this.tbPopover=null;
    this.tbPopoverKey=null;
    this.manualPos=typeof Workspace!=='undefined'?Workspace.read('terminal_drawing_toolbar_pos_v1',null):null;
    this.toolbar=document.createElement('div');this.toolbar.className='drawing-toolbar';this.toolbar.hidden=true;this.toolbar.setAttribute('role','toolbar');this.toolbar.setAttribute('aria-label','Drawing toolbar');
    this.toolbar.innerHTML=`<button type="button" class="drawing-grip" title="Drag toolbar (double-click to reset)" aria-label="Drag drawing toolbar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="17" r="1.2" fill="currentColor"/><circle cx="15" cy="17" r="1.2" fill="currentColor"/></svg></button>`
      + `<button type="button" class="tv-tb-btn" data-action="template" title="Templates" aria-label="Drawing templates">${DrawingEditor.tbSvg('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 13.5v7M13.5 17h7')}</button>`
      + `<button type="button" class="tv-tb-btn tv-tb-color" data-tb-pop="borderColor" title="Line / Border color" aria-label="Drawing border color">${DrawingEditor.tbSvg('M16 4l4 4L9 19H5v-4L16 4zM13.5 6.5l4 4')}<span class="tv-tb-swatch"><i data-swatch-bar="borderColor"></i></span></button>`
      + `<button type="button" class="tv-tb-btn tv-tb-color" data-tb-pop="fillColor" title="Background color" aria-label="Drawing fill color">${DrawingEditor.tbSvg('M12 4.5 5.5 11a1.8 1.8 0 0 0 0 2.6l3.4 3.4a1.8 1.8 0 0 0 2.6 0L18 10.5 12 4.5zM9.5 7 12 3.5M6.2 17.5c0 .9-.7 1.7-1.5 1.7s-1.5-.8-1.5-1.7c0-.9 1.5-2.6 1.5-2.6s1.5 1.7 1.5 2.6z')}<span class="tv-tb-swatch"><i data-swatch-bar="fillColor"></i></span></button>`
      + `<button type="button" class="tv-tb-btn tv-tb-color" data-tb-pop="textColor" title="Text color & style" aria-label="Drawing text style">${DrawingEditor.tbSvg('M5.2 4.5h13.6v2.5h-1.6V5.8h-4.4v12.4h2v1.4H9.2v-1.4h2V5.8H6.8V7H5.2z')}<span class="tv-tb-swatch"><i data-swatch-bar="textColor"></i></span></button>`
      + `<button type="button" class="tv-tb-btn tv-tb-wide" data-tb-pop="width" title="Line thickness" aria-label="Drawing line width"><svg class="tv-tb-line-preview" viewBox="0 0 20 12" aria-hidden="true"><line data-width-line x1="1" y1="6" x2="19" y2="6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg><span data-width-label>1px</span></button>`
      + `<button type="button" class="tv-tb-btn tv-tb-line" data-tb-pop="lineStyle" title="Line style" aria-label="Drawing line style"><svg class="tv-tb-style-preview" viewBox="0 0 24 12" aria-hidden="true"><line data-style-line x1="2" y1="6" x2="22" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>`
      + `<button type="button" class="tv-tb-btn" data-action="settings" title="Settings" aria-label="Drawing settings">${DrawingEditor.tbSvg('M12 3.2 19.6 7.6v8.8L12 20.8l-7.6-4.4V7.6zM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z')}</button>`
      + `<button type="button" class="tv-tb-btn" data-action="alert" title="Add alert" aria-label="Add alert on drawing">${DrawingEditor.tbSvg('M11.5 9.8v2.7l1.8 1M6.3 6 4.2 8M16.7 6l2.1 2M18 15v5M15.5 17.5h5M17.2 12a5.8 5.8 0 1 0-5.7 6.3')}</button>`
      + `<button type="button" class="tv-tb-btn" data-action="lock" title="Lock / Unlock" aria-label="Lock drawing"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10.5" width="12" height="9" rx="1.8"/><path d="M12 14.5v1.5"/><path data-lock-shackle d="M8.5 10.5V7.2a3.5 3.5 0 0 1 6.7-1.4"/></svg></button>`
      + `<button type="button" class="tv-tb-btn" data-action="anchor" title="Anchor" aria-label="Anchor text" hidden>${DrawingEditor.tbSvg('M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0v14m-7-5a7 7 0 0 0 14 0m-14 0H3m16 0h2M8.5 10h7')}</button>`
      + `<button type="button" class="tv-tb-btn" data-action="delete" title="Remove" aria-label="Remove drawing">${DrawingEditor.tbSvg('M5 6.5h14M9.5 6.5V4.5h5v2M7.5 6.5l.8 12a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9l.8-12')}</button>`
      + `<button type="button" class="tv-tb-btn" data-action="more" title="More" aria-label="More drawing actions"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="17.5" cy="12" r="1.4"/></svg></button>`
      + `<div class="drawing-more" hidden><button type="button" data-action="front">Bring to front</button><button type="button" data-action="back">Send to back</button><div class="chart-context-divider"></div><button type="button" data-action="duplicate">Clone</button><button type="button" data-action="copy">Copy</button><div class="chart-context-divider"></div><button type="button" data-action="hide">Hide</button><button type="button" data-action="template">Template…</button></div>`;
    document.body.appendChild(this.toolbar);
    this.settings=new DrawingSettings(this);
    this.bindToolbarGrip();
    this.toolbar.addEventListener('click',event=>{
      const popBtn=event.target.closest?.('[data-tb-pop]');
      if(popBtn&&this.drawing){
        event.stopPropagation();
        this.toolbar.querySelector('.drawing-more').hidden=true;
        this.toggleTbPopover(popBtn,popBtn.dataset.tbPop);
        return;
      }
      const action=event.target.closest?.('[data-action]')?.dataset.action;if(!action||!this.drawing)return;
      this.closeTbPopover();
      if(action==='settings'||action==='text')this.open(action==='text'?'text':'style');
      else if(action==='template'){
        this.toolbar.querySelector('.drawing-more').hidden=true;
        const trigger=event.target.closest?.('[data-action="template"]');
        if(this.settings.openTemplateMenu)this.settings.openTemplateMenu(trigger,{drawing:this.drawing,direct:true,prefer:'below'});
        else this.open('style');
      }
      else if(action==='alert'){
        const d=this.drawing,c=this.selection.chart;
        const price=d.type==='hline'||!d.p2?d.p1?.price:(d.p1.price+d.p2.price)/2;
        const tick=c.metadata?.tickSize;
        const rounded=Number.isFinite(tick)&&tick>0?Math.round(price/tick)*tick:price;
        if(this.onAlert)this.onAlert(c,rounded);
        else document.getElementById('btn-alert')?.click();
      }
      else if(action==='copy'){this.toolbar.querySelector('.drawing-more').hidden=true;this.onCopy?.(this.drawing);}
      else if(action==='hide'){this.toolbar.querySelector('.drawing-more').hidden=true;this.commit({...this.drawing,hidden:true});this.clear();}
      else if(action==='more')this.toolbar.querySelector('.drawing-more').hidden=!this.toolbar.querySelector('.drawing-more').hidden;
      else if(action==='delete')this.remove();
      else if(action==='lock')this.commit({...this.drawing,locked:!this.drawing.locked});
      else if(action==='anchor'){
        const d=structuredClone(this.drawing),c=this.selection.chart;
        if(!d.anchored){
          const g=DrawingModel.geometry(c,d);
          if(g){d.anchored=true;d.anchorX=g.a.x;d.anchorY=g.a.y;}
        }else{
          d.anchored=false;
          if(Number.isFinite(d.anchorX)&&Number.isFinite(d.anchorY)){
            const p=DrawingModel.fromPixel(c,d.anchorX,d.anchorY);
            if(p)d.p1=p;
          }
        }
        this.commit(d);
      }
      else if(action==='duplicate'){
        const draft=structuredClone(this.drawing);draft.id=crypto.randomUUID();draft.locked=false;
        const c=this.selection.chart;draft.p1.time=DrawingModel.timeAt(c,DrawingModel.logicalIndex(c,draft.p1.time)+2);
        if(draft.points){draft.points=draft.points.map(p=>({...p,time:DrawingModel.timeAt(c,DrawingModel.logicalIndex(c,p.time)+2,true)}));draft.p1={...draft.points[0]};}
        if(draft.p2)draft.p2.time=DrawingModel.timeAt(c,DrawingModel.logicalIndex(c,draft.p2.time)+2);
        if(draft.p3)draft.p3.time=DrawingModel.timeAt(c,DrawingModel.logicalIndex(c,draft.p3.time)+2);
        c.drawings.push(draft);this.manager.saveDrawings(c);this.select(c,draft);
      } else if(action==='front'||action==='back'){
        const c=this.selection.chart,d=this.drawing;c.drawings=c.drawings.filter(item=>item.id!==d.id);action==='front'?c.drawings.push(d):c.drawings.unshift(d);this.manager.saveDrawings(c);c.renderDrawings();
      }
    });
    document.addEventListener('pointerdown',event=>{
      if(this.tbPopover&&!this.tbPopover.contains(event.target)&&!event.target.closest?.('[data-tb-pop]'))this.closeTbPopover();
    },true);
    document.addEventListener('keydown',event=>{
      if(event.target.closest?.('input,textarea,select,[contenteditable]'))return;
      if(event.key==='Escape'){if(this.tbPopover){if(typeof ColorPicker==='undefined'||!ColorPicker.closeActiveSub(this.tbPopover))this.closeTbPopover();return;}this.cancelDrag();this.clear();}
      if((event.key==='Delete'||event.key==='Backspace')&&this.drawing){event.preventDefault();event.stopPropagation();this.remove();}
    },true);
    window.addEventListener('resize',()=>{this.closeTbPopover();this.placeToolbar();});
    window.addEventListener('blur',()=>{this.closeTbPopover();this.cancelDrag();});
    for(const type of ['keydown','keyup']){
      window.addEventListener(type,event=>{
        if(event.key!=='Shift'||(type==='keydown'&&event.repeat)||!this.drag?.lastPointer||this.drag.original.type!=='line'||(this.drag.handle!=='p1'&&this.drag.handle!=='p2'))return;
        this.applyDrag({...this.drag.lastPointer,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:type==='keydown'||event.shiftKey});
      });
    }
  }
  bindToolbarGrip(){
    const grip=this.toolbar.querySelector('.drawing-grip');
    if(!grip?.addEventListener)return;
    let drag=null;
    grip.addEventListener('dblclick',()=>{this.manualPos=null;if(typeof Workspace!=='undefined')Workspace.write('terminal_drawing_toolbar_pos_v1',null);this.placeToolbar();});
    grip.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      e.preventDefault();e.stopPropagation();this.closeTbPopover();
      const rect=this.toolbar.getBoundingClientRect();
      drag={pointerId:e.pointerId,dx:e.clientX-rect.left,dy:e.clientY-rect.top};
      grip.setPointerCapture?.(e.pointerId);
    });
    grip.addEventListener('pointermove',e=>{
      if(!drag)return;
      const w=this.toolbar.offsetWidth||420,h=this.toolbar.offsetHeight||38;
      this.manualPos={left:Math.max(8,Math.min(window.innerWidth-w-8,e.clientX-drag.dx)),top:Math.max(44,Math.min(window.innerHeight-h-8,e.clientY-drag.dy))};
      this.placeToolbar();
    });
    const end=e=>{
      if(!drag)return;
      if(e?.pointerId!=null&&grip.hasPointerCapture?.(e.pointerId))grip.releasePointerCapture(e.pointerId);
      drag=null;
      if(this.manualPos&&typeof Workspace!=='undefined')Workspace.write('terminal_drawing_toolbar_pos_v1',this.manualPos);
    };
    grip.addEventListener('pointerup',end);
    grip.addEventListener('pointercancel',end);
  }
  closeTbPopover(){
    this.tbPopover?.remove();this.tbPopover=null;this.tbPopoverKey=null;
    this.toolbar.querySelectorAll?.('[data-tb-pop].active')?.forEach(b=>b.classList.remove('active'));
  }
  toggleTbPopover(anchor,key){
    const same=this.tbPopoverKey===key;
    this.closeTbPopover();
    if(same||!this.drawing)return;
    const d=DrawingModel.normalize(this.drawing);
    const pop=document.createElement('div');
    pop.className='tv-style-popover tv-tb-popover';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label',anchor.getAttribute('aria-label')||key);
    const commitPatch=patch=>{
      if(!this.drawing)return;
      const next=DrawingModel.normalize({...this.drawing,...patch,textStyle:{...d.textStyle,...(patch.textStyle||{})}});
      this.commit(next);
    };
    if(key==='width'){
      pop.classList.add('tv-tb-list-pop');
      for(const w of [1,2,3,4,5]){
        const b=document.createElement('button');b.type='button';b.className='tv-tb-list-item';
        b.setAttribute('aria-pressed',String(Number(d.width)===w));
        b.innerHTML=`<svg viewBox="0 0 54 12" aria-hidden="true"><line x1="2" y1="6" x2="52" y2="6" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"/></svg><span>${w}px</span>`;
        b.onclick=()=>{commitPatch({width:w});this.closeTbPopover();};
        pop.appendChild(b);
      }
    }else if(key==='lineStyle'){
      pop.classList.add('tv-tb-list-pop');
      for(const [val,label,dash] of [['solid','Solid','none'],['dashed','Dashed','6,4'],['dotted','Dotted','2,3']]){
        const b=document.createElement('button');b.type='button';b.className='tv-tb-list-item';
        b.setAttribute('aria-pressed',String(d.lineStyle===val));
        b.innerHTML=`<svg viewBox="0 0 54 12" aria-hidden="true"><line x1="2" y1="6" x2="52" y2="6" stroke="currentColor" stroke-width="1.6" stroke-dasharray="${dash}" stroke-linecap="round"/></svg><span>${label}</span>`;
        b.onclick=()=>{commitPatch({lineStyle:val});this.closeTbPopover();};
        pop.appendChild(b);
      }
    }else{
      const currentHex=DrawingModel.hex(key==='textColor'?d.textStyle?.color:(key==='fillColor'?d.fillColor:d.borderColor)).toLowerCase();
      const applyColor=hex=>{
        if(key==='borderColor')commitPatch({borderColor:hex,color:hex});
        else if(key==='fillColor')commitPatch({fillColor:hex,fillEnabled:true});
        else commitPatch({textStyle:{color:hex}});
      };
      const hasOpacity=key==='borderColor'||key==='fillColor';
      const opKey=key==='borderColor'?'strokeOpacity':'fillOpacity';
      if(typeof ColorPicker!=='undefined'){
        ColorPicker.mount(pop,{
          value:currentHex,
          opacity:hasOpacity?(d[opKey]??100):100,
          showOpacity:hasOpacity,
          onColor:hex=>applyColor(hex),
          onOpacity:op=>commitPatch({[opKey]:op})
        });
      }else{
        const palette=typeof DrawingSettings!=='undefined'&&DrawingSettings.PALETTE?DrawingSettings.PALETTE:['#ffffff','#e8e4dc','#c2baae','#787b86','#211f1d','#000000','#f23645','#ff9800','#089981','#2962ff'];
        const grid=document.createElement('div');grid.className='tv-palette-grid';
        for(const c of palette){
          const sw=document.createElement('button');sw.type='button';sw.className='tv-palette-swatch'+(c.toLowerCase()===currentHex?' selected':'');
          sw.style.backgroundColor=c;sw.setAttribute('aria-label',c);
          sw.onclick=()=>{applyColor(c);grid.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));sw.classList.add('selected');};
          grid.appendChild(sw);
        }
        pop.appendChild(grid);
      }
      if(key==='fillColor'){
        const vis=document.createElement('label');vis.className='tv-tb-pop-check';
        const cb=document.createElement('input');cb.type='checkbox';cb.checked=d.fillEnabled!==false;
        cb.onchange=()=>commitPatch({fillEnabled:cb.checked});
        vis.append(cb,document.createTextNode('Background visible'));
        pop.appendChild(vis);
      }
      if(key==='textColor'){
        const bar=document.createElement('div');bar.className='tv-pop-row tv-tb-text-quick';
        const size=document.createElement('select');size.setAttribute('aria-label','Text size');
        for(const n of [10,12,14,16,18,20,24,28,32])size.add(new Option(String(n),String(n)));
        size.value=String(d.textStyle?.size||12);
        size.onchange=()=>commitPatch({textStyle:{size:Number(size.value)}});
        const mkFmt=(label,prop)=>{const b=document.createElement('button');b.type='button';b.className='tv-format-btn';b.innerHTML=prop==='bold'?'<strong>B</strong>':'<em>I</em>';b.setAttribute('aria-pressed',String(!!d.textStyle?.[prop]));b.setAttribute('aria-label',label);b.onclick=()=>{const cur=!!DrawingModel.normalize(this.drawing).textStyle?.[prop];b.setAttribute('aria-pressed',String(!cur));commitPatch({textStyle:{[prop]:!cur}});};return b;};
        const edit=document.createElement('button');edit.type='button';edit.className='tv-tb-edit-text';edit.textContent='Edit text…';
        edit.onclick=()=>{this.closeTbPopover();this.open('text');};
        bar.append(size,mkFmt('Bold','bold'),mkFmt('Italic','italic'),edit);
        pop.appendChild(bar);
      }
    }
    document.body.appendChild(pop);
    anchor.classList.add('active');
    this.tbPopover=pop;this.tbPopoverKey=key;
    const rect=anchor.getBoundingClientRect(),popRect=pop.getBoundingClientRect();
    const left=Math.max(8,Math.min(window.innerWidth-(popRect.width||220)-8,rect.left));
    const top=rect.bottom+6+(popRect.height||220)<=window.innerHeight-8?rect.bottom+6:Math.max(8,rect.top-(popRect.height||220)-6);
    pop.style.left=left+'px';pop.style.top=top+'px';
  }
  get drawing(){return this.selection?.chart.drawings.find(d=>d.id===this.selection.id);}
  select(chart,drawing){this.closeTbPopover();this.multiSelection=null;this.selection={chart,id:drawing.id};this.toolbar.hidden=false;this.toolbar.querySelector('.drawing-more').hidden=true;this.updateToolbar();chart.renderDrawings();}
  updateToolbar(){
    if(!this.drawing)return this.clear();
    const d=DrawingModel.normalize(this.drawing);
    const isTextOnly=d.type==='text';
    const setHidden=(sel,hide)=>{const el=this.toolbar.querySelector(sel);if(el)el.hidden=hide;};
    setHidden('[data-tb-pop="borderColor"]',isTextOnly);
    setHidden('[data-tb-pop="fillColor"]',!['box','measure','brush'].includes(d.type));
    setHidden('[data-tb-pop="textColor"]',!['box','line','hline','vline','text'].includes(d.type));
    setHidden('[data-tb-pop="width"]',isTextOnly);
    setHidden('[data-tb-pop="lineStyle"]',isTextOnly||d.type==='brush');
    setHidden('[data-action="anchor"]',!isTextOnly);
    this.toolbar.querySelector('[data-action="anchor"]')?.classList?.toggle('active',!!d.anchored);
    const setSwatch=(key,val)=>{const el=this.toolbar.querySelector(`[data-swatch-bar="${key}"]`);if(el?.style)el.style.background=val;};
    setSwatch('borderColor',DrawingModel.rgba(d.borderColor,d.strokeOpacity??100));
    setSwatch('fillColor',d.fillEnabled===false?'transparent':DrawingModel.rgba(d.fillColor,d.fillOpacity??32));
    setSwatch('textColor',d.textStyle?.color||'#ffffff');
    const wLabel=this.toolbar.querySelector('[data-width-label]');if(wLabel)wLabel.textContent=(d.width||1)+'px';
    const wLine=this.toolbar.querySelector('[data-width-line]');wLine?.setAttribute?.('stroke-width',String(Math.max(1,Math.min(4,d.width||1))));
    const sLine=this.toolbar.querySelector('[data-style-line]');
    if(sLine?.setAttribute){
      const dash=d.lineStyle==='dashed'?'5,3':d.lineStyle==='dotted'?'2,2.5':'';
      if(dash)sLine.setAttribute('stroke-dasharray',dash);else sLine.removeAttribute?.('stroke-dasharray');
    }
    const lockBtn=this.toolbar.querySelector('[data-action="lock"]');
    lockBtn.classList.toggle('active',!!d.locked);
    lockBtn.querySelector?.('[data-lock-shackle]')?.setAttribute?.('d',d.locked?'M8.5 10.5V7.2a3.5 3.5 0 0 1 7 0v3.3':'M8.5 10.5V7.2a3.5 3.5 0 0 1 6.7-1.4');
    this.placeToolbar();
  }
  placeToolbar(){
    if(!this.selection)return;
    const rect=this.selection.chart.container.getBoundingClientRect();
    const width=this.toolbar.offsetWidth||Math.min(420,window.innerWidth-24);
    const height=this.toolbar.offsetHeight||38;
    const minLeft=12;
    const left=this.manualPos?this.manualPos.left:rect.left+rect.width/2-width/2;
    const top=this.manualPos?this.manualPos.top:rect.top+75;
    this.toolbar.style.left=`${Math.max(minLeft,Math.min(window.innerWidth-width-12,left))}px`;
    this.toolbar.style.top=`${Math.max(46,Math.min(window.innerHeight-height-12,top))}px`;
  }
  clear(){this.closeInline?.(true);this.closeTbPopover();const chart=this.selection?.chart||this.multiSelection?.chart||this.marquee?.chart;this.selection=null;this.multiSelection=null;this.marquee=null;this.toolbar.hidden=true;if(chart){chart.drawingPreview=null;chart.renderDrawings();}}
  preview(draft){if(!this.selection)return;this.selection.chart.drawingPreview=draft;this.selection.chart.renderDrawings();}
  commit(value){
    if(!this.selection)return;
    const c=this.selection.chart,index=c.drawings.findIndex(d=>d.id===this.selection.id);if(index<0)return;
    c.drawings[index]=DrawingModel.normalize(structuredClone(value));c.drawingPreview=null;this.manager.saveDrawings(c);this.updateToolbar();c.renderDrawings();
  }
  remove(){
    if(this.multiSelection?.ids?.size){
      if(this.manager.drawingsLocked)return window.showToast?.(typeof ui==='function'?ui('Unlock drawing before deleting.'):'Unlock drawing before deleting.','alert');
      const c=this.multiSelection.chart,ids=this.multiSelection.ids;
      const before=c.drawings.length;
      c.drawings=c.drawings.filter(d=>!ids.has(d.id)||d.locked);
      if(c.drawings.length===before)return window.showToast?.(typeof ui==='function'?ui('Unlock drawing before deleting.'):'Unlock drawing before deleting.','alert');
      this.manager.saveDrawings(c);this.clear();return;
    }
    if(!this.drawing)return;if(this.drawing.locked||this.manager.drawingsLocked)return window.showToast?.(typeof ui==='function'?ui('Unlock drawing before deleting.'):'Unlock drawing before deleting.','alert');const c=this.selection.chart;c.drawings=c.drawings.filter(d=>d.id!==this.selection.id);this.manager.saveDrawings(c);this.clear();
  }
  open(tab='style'){if(this.drawing)this.settings.open(this.selection.chart,this.drawing,tab);}
  find(chart,x,y){if(chart.drawingsHidden||y>chart.plotBottom)return null;for(let i=chart.drawings.length-1;i>=0;i--){const d=chart.drawings[i];if(d.isTemp)continue;const handle=DrawingModel.hit(chart,d,x,y);if(handle)return {drawing:d,handle};}return null;}
  cursor(chart,hit){
    if(!hit)return '';
    if(hit.drawing.locked||this.manager.drawingsLocked)return 'not-allowed';
    if(hit.drawing.type==='vline')return 'ew-resize';
    if(hit.handle==='body')return 'move';
    if(hit.handle.endsWith('_time'))return 'ew-resize';
    if(hit.handle.endsWith('_price')||hit.drawing.type==='hline')return 'ns-resize';
    const g=DrawingModel.geometry(chart,hit.drawing);if(!g)return 'move';
    const same=(g.a.x-g.b.x)*(g.a.y-g.b.y)>=0;
    return ['p1x_p2y','p2x_p1y'].includes(hit.handle)?(same?'nesw-resize':'nwse-resize'):(same?'nwse-resize':'nesw-resize');
  }
  bind(chart){
    chart.container.addEventListener('pointerdown',event=>{
      if(event.button!==0||this.manager.activeTool!=='crosshair'||event.target.closest('button,input,select,textarea,.indicator-tables,.tv-trade-pill,.chart-nav-controls'))return;
      const rect=chart.container.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      if(event.ctrlKey||event.metaKey){
        event.preventDefault();event.stopImmediatePropagation();chart.container.dispatchEvent(new CustomEvent('chart-activate'));
        this.selection=null;this.multiSelection=null;this.toolbar.hidden=true;
        this.marquee={chart,startX:x,startY:y,x,y,pointer:event.pointerId};
        chart.chart.applyOptions({handleScroll:{pressedMouseMove:false}});chart.container.setPointerCapture(event.pointerId);
        chart.renderDrawings();
        return;
      }
      const hit=this.find(chart,x,y);
      if(!hit){this.clear();return;}
      event.preventDefault();event.stopImmediatePropagation();chart.container.dispatchEvent(new CustomEvent('chart-activate'));
      this.select(chart,hit.drawing);
      if(hit.drawing.locked||this.manager.drawingsLocked)return;
      const start=DrawingModel.fromPixel(chart,x,y);if(!start)return;
      this.drag={chart,handle:hit.handle,start,original:structuredClone(hit.drawing),pointer:event.pointerId,startX:x,startY:y};
      chart.chart.applyOptions({handleScroll:{pressedMouseMove:false}});chart.container.setPointerCapture(event.pointerId);
    },true);
    chart.container.addEventListener('pointermove',event=>{
      if(this.marquee?.chart===chart){
        const rect=chart.container.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
        this.marquee.x=x;this.marquee.y=y;
        const box={left:Math.min(this.marquee.startX,x),right:Math.max(this.marquee.startX,x),top:Math.min(this.marquee.startY,y),bottom:Math.max(this.marquee.startY,y)};
        const ids=new Set();
        if(!chart.drawingsHidden){
          for(const d of chart.drawings)if(!d.isTemp&&DrawingModel.inRect?.(chart,d,box))ids.add(d.id);
        }
        this.multiSelection=ids.size?{chart,ids}:null;
        chart.renderDrawings();
        event.preventDefault();event.stopImmediatePropagation();
        return;
      }
      if(!this.drag||this.drag.chart!==chart){
        if(this.manager.activeTool==='crosshair'&&!event.target.closest('button,input,select,.indicator-tables')){
          const rect=chart.container.getBoundingClientRect();const cursor=this.cursor(chart,this.find(chart,event.clientX-rect.left,event.clientY-rect.top));chart.container.style.cursor=cursor;if(cursor)chart.container.style.setProperty('--drawing-cursor',cursor);else chart.container.style.removeProperty('--drawing-cursor');
        }return;
      }
      this.drag.lastPointer={clientX:event.clientX,clientY:event.clientY,ctrlKey:event.ctrlKey,metaKey:event.metaKey};
      if(!this.applyDrag(event))return;
      event.preventDefault();event.stopImmediatePropagation();
    },true);
    const finishMarquee=()=>{
      if(!this.marquee||this.marquee.chart!==chart)return false;
      const {pointer}=this.marquee;this.marquee=null;
      if(chart.container.hasPointerCapture(pointer))chart.container.releasePointerCapture(pointer);
      chart.chart.applyOptions({handleScroll:{pressedMouseMove:true}});
      const ids=this.multiSelection?.ids;
      if(ids?.size===1){
        const single=chart.drawings.find(d=>ids.has(d.id));
        if(single){this.select(chart,single);return true;}
      }else if(ids?.size>1){
        const first=chart.drawings.find(d=>ids.has(d.id));
        if(first){this.selection={chart,id:first.id};this.toolbar.hidden=false;this.toolbar.querySelector('.drawing-more').hidden=true;this.updateToolbar();chart.renderDrawings();return true;}
      }
      this.clear();return true;
    };
    chart.container.addEventListener('pointerup',event=>{
      if(finishMarquee()){event.preventDefault();event.stopImmediatePropagation();return;}
      if(!this.drag||this.drag.chart!==chart)return;event.preventDefault();event.stopImmediatePropagation();
      if(this.drag.changed&&Number.isFinite(event.clientX))this.applyDrag(event);
      const draft=this.drag.changed?this.drag.draft:null;this.cancelDrag();if(draft)this.commit(draft);
    },true);
    chart.container.addEventListener('pointercancel',()=>{if(!finishMarquee())this.cancelDrag();},true);
    chart.container.addEventListener('lostpointercapture',()=>{if(!finishMarquee())this.cancelDrag();},true);
    chart.container.addEventListener('pointerleave',()=>{if(!this.drag){chart.container.style.cursor='';chart.container.style.removeProperty('--drawing-cursor');}});
    chart.container.addEventListener('dblclick',event=>{
      if(this.manager.activeTool!=='crosshair'||event.target.closest('button,input,select,textarea'))return;
      const rect=chart.container.getBoundingClientRect(),hit=this.find(chart,event.clientX-rect.left,event.clientY-rect.top);
      if(hit){
        event.preventDefault();event.stopImmediatePropagation();this.select(chart,hit.drawing);
        if(hit.drawing.type==='text'&&!hit.drawing.locked&&!this.manager.drawingsLocked)this.editInline(chart,hit.drawing,false);
        else this.open();
      }
    },true);
  }
  applyDrag(input){
    if(!this.drag)return false;
    const {chart,handle,original,start}=this.drag;
    const rect=chart.container.getBoundingClientRect(),x=input.clientX-rect.left,y=input.clientY-rect.top;
    if(Math.hypot(x-this.drag.startX,y-this.drag.startY)<3&&!this.drag.changed)return false;
    let d=structuredClone(original);
    if(d.type==='text'&&d.anchored){
      const baseX=Number.isFinite(original.anchorX)?original.anchorX:this.drag.startX;
      const baseY=Number.isFinite(original.anchorY)?original.anchorY:this.drag.startY;
      d.anchorX=baseX+(x-this.drag.startX);
      d.anchorY=baseY+(y-this.drag.startY);
      this.drag.changed=true;this.drag.draft=d;this.preview(d);
      return true;
    }
    let point=DrawingModel.fromPixel(chart,x,y);if(!point)return false;
    if(handle!=='body')point=this.manager.snapPoint(chart,point.time,point.price,input);
    if(input.shiftKey&&original.type==='line'&&(handle==='p1'||handle==='p2')){
      const anchor=handle==='p1'?original.p2:original.p1;
      point=DrawingModel.constrainLinePoint(chart,anchor,point,{x,y});
    }
    if(d.type==='position'){
      const isLong=d.side==='short'?false:(d.side==='long'?true:d.p2.price>=d.p1.price);
      const tick=chart.metadata?.tickSize||0.0001;
      if(handle==='p1_right'){d.p2.time=point.time;if(d.p3)d.p3.time=point.time;}
      else if(handle==='p2_price'){d.p2.price=isLong?Math.max(d.p1.price+tick,point.price):Math.min(d.p1.price-tick,point.price);}
      else if(handle==='p3_price'&&d.p3){d.p3.price=isLong?Math.min(d.p1.price-tick,point.price):Math.max(d.p1.price+tick,point.price);}
      else if(handle==='p1'){d.p1=point;if(d.p2)d.p2.price=isLong?Math.max(point.price+tick,d.p2.price):Math.min(point.price-tick,d.p2.price);if(d.p3)d.p3.price=isLong?Math.min(point.price-tick,d.p3.price):Math.max(point.price+tick,d.p3.price);}
      else if(handle==='p2'){d.p2.time=point.time;if(d.p3)d.p3.time=point.time;d.p2.price=isLong?Math.max(d.p1.price+tick,point.price):Math.min(d.p1.price-tick,point.price);}
      else if(handle==='p3'&&d.p3){d.p3.time=point.time;if(d.p2)d.p2.time=point.time;d.p3.price=isLong?Math.min(d.p1.price-tick,point.price):Math.max(d.p1.price+tick,point.price);}
      else {const delta=Math.round(DrawingModel.logicalIndex(chart,point.time)-DrawingModel.logicalIndex(chart,start.time));for(const key of original.p3?['p1','p2','p3']:['p1','p2']){d[key].time=DrawingModel.timeAt(chart,DrawingModel.logicalIndex(chart,original[key].time)+delta);d[key].price=original[key].price+point.price-start.price;}}
    }
    else if(handle==='p1'||handle==='p2'||handle==='p3')d[handle]=point;
    else if(handle==='p1x_p2y'){d.p1.time=point.time;d.p2.price=point.price;}
    else if(handle==='p2x_p1y'){d.p2.time=point.time;d.p1.price=point.price;}
    else if(['p1_time','p2_time','p1_price','p2_price'].includes(handle))d=DrawingModel.resizeBox(original,handle,point);
    else {const delta=Math.round(DrawingModel.logicalIndex(chart,point.time)-DrawingModel.logicalIndex(chart,start.time));for(const key of original.p3?['p1','p2','p3']:original.p2?['p1','p2']:['p1']){d[key].time=DrawingModel.timeAt(chart,DrawingModel.logicalIndex(chart,original[key].time)+delta);d[key].price=original[key].price+point.price-start.price;}}
    if(d.type==='brush'&&original.points&&handle==='body'){
      const delta=Math.round(DrawingModel.logicalIndex(chart,point.time)-DrawingModel.logicalIndex(chart,start.time));
      d.points=original.points.map(p=>({time:DrawingModel.timeAt(chart,DrawingModel.logicalIndex(chart,p.time)+delta,true),price:p.price+point.price-start.price}));
      d.p1={...d.points[0]};
    }
    this.drag.changed=true;this.drag.draft=d;this.preview(d);
    return true;
  }
  editInline(chart,drawing,isNew=false){
    this.closeInline(true);
    const g=DrawingModel.geometry(chart,drawing);if(!g)return;
    const st=drawing.textStyle||{},sz=st.size||14,pad=sz/6,lh=sz*1.25;
    const originalText=drawing.text||'';
    drawing._editingInline=true;chart.renderDrawings();
    const ta=document.createElement('textarea');
    ta.className='tv-inline-text-editor';
    ta.value=originalText;
    ta.spellcheck=false;
    ta.style.cssText=`position:absolute;left:${g.a.x-pad}px;top:${g.a.y-pad}px;z-index:30;margin:0;padding:${pad}px;box-sizing:border-box;border:1.5px solid #2962ff;border-radius:2px;outline:none;resize:none;overflow:hidden;min-width:60px;font:${st.italic?'italic ':''}${st.bold?'bold ':''}${sz}px/${lh}px -apple-system,BlinkMacSystemFont,"Trebuchet MS",Roboto,Ubuntu,sans-serif;color:${st.color||'#2962ff'};background:${st.fillBackground?DrawingModel.rgba(st.backgroundColor||'#2962ff',st.backgroundOpacity??25):'transparent'};white-space:${st.wordWrap?'pre-wrap':'pre'};`;
    const syncSize=()=>{
      if(st.wordWrap){
        ta.style.width=((st.wordWrapWidth||200)+pad*2)+'px';
      }else{
        ta.style.width='1px';
        ta.style.width=Math.max(60,ta.scrollWidth+4)+'px';
      }
      ta.style.height='1px';
      ta.style.height=Math.max(lh+pad*2,ta.scrollHeight)+'px';
    };
    const cleanup=(commit)=>{
      if(!this.inlineEdit)return;
      const cur=this.inlineEdit;this.inlineEdit=null;
      delete cur.drawing._editingInline;
      cur.ta.remove();
      if(commit){
        const next=cur.ta.value;
        if(!next.trim()){
          cur.chart.drawings=cur.chart.drawings.filter(d=>d.id!==cur.drawing.id);
          this.manager.saveDrawings(cur.chart);
          if(this.selection?.id===cur.drawing.id){this.selection=null;this.toolbar.hidden=true;}
        }else{
          cur.drawing.text=next;
          this.manager.saveDrawings(cur.chart);
        }
      }else if(cur.isNew){
        cur.chart.drawings=cur.chart.drawings.filter(d=>d.id!==cur.drawing.id);
        this.manager.saveDrawings(cur.chart);
        if(this.selection?.id===cur.drawing.id){this.selection=null;this.toolbar.hidden=true;}
      }else{
        cur.drawing.text=cur.originalText;
      }
      cur.chart.renderDrawings();
    };
    this.inlineEdit={chart,drawing,ta,isNew,originalText,cleanup};
    for(const ev of ['pointerdown','mousedown','click','dblclick'])ta.addEventListener(ev,e=>e.stopPropagation());
    ta.addEventListener('input',syncSize);
    ta.addEventListener('keydown',e=>{
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();cleanup(false);}
      else if(e.key==='Enter'&&(!e.shiftKey||e.ctrlKey||e.metaKey)){e.preventDefault();cleanup(true);}
    });
    ta.addEventListener('blur',()=>cleanup(true));
    chart.container.appendChild(ta);
    syncSize();
    ta.focus();
    if(isNew&&originalText==='Text')ta.select();
  }
  closeInline(commit=true){this.inlineEdit?.cleanup?.(commit);}
  cancelDrag(){if(!this.drag)return;const {chart,pointer}=this.drag;this.drag=null;if(chart.container.hasPointerCapture(pointer))chart.container.releasePointerCapture(pointer);chart.chart.applyOptions({handleScroll:{pressedMouseMove:true}});chart.drawingPreview=null;chart.renderDrawings();}
  renderHandles(chart,ctx){
    if(this.marquee?.chart===chart){
      const x=Math.min(this.marquee.startX,this.marquee.x),y=Math.min(this.marquee.startY,this.marquee.y);
      const w=Math.abs(this.marquee.x-this.marquee.startX),h=Math.abs(this.marquee.y-this.marquee.startY);
      ctx.save();ctx.fillStyle='rgba(41, 98, 255, 0.12)';ctx.strokeStyle='#2962ff';ctx.lineWidth=1;ctx.setLineDash([4,3]);
      ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.restore();
    }
    if(this.multiSelection?.chart===chart&&this.multiSelection.ids.size>1){
      for(const d of chart.drawings){
        if(!this.multiSelection.ids.has(d.id)||chart.drawingsHidden||!DrawingModel.visible(d,chart.currentTimeframe))continue;
        const g=DrawingModel.geometry(chart,d);if(!g)continue;
        const pts=d.type==='brush'&&d.points?.length?(d.points.length>1?[DrawingModel.point(chart,d.points[0]),DrawingModel.point(chart,d.points.at(-1))]:[DrawingModel.point(chart,d.points[0])]):d.p2?[g.a,g.b]:[g.a];
        ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle=d.locked||this.manager.drawingsLocked?'#777':'#2962ff';ctx.lineWidth=2;ctx.setLineDash([]);
        pts.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.stroke();});ctx.restore();
      }
      if(this.selection?.chart===chart)this.placeToolbar();
      return;
    }
    if(this.selection?.chart!==chart)return;
    const d=chart.drawingPreview||this.drawing;
    if(!d){this.clear();return;}
    if(chart.drawingsHidden||!DrawingModel.visible(d,chart.currentTimeframe)){this.toolbar.hidden=true;return;}
    this.toolbar.hidden=false;
    const g=DrawingModel.geometry(chart,d);if(!g)return;
    let points;
    if(d.type==='brush'&&d.points?.length){
      const first=DrawingModel.point(chart,d.points[0]),last=DrawingModel.point(chart,d.points[d.points.length-1]);
      points=d.points.length>1?[first,last]:[first];
    } else if(d.type==='position'&&g.c){
      points=DrawingModel.positionHandles(g);
    } else {
      points=[g.a];
      if(d.p2)points.push(g.b);
      if(d.type==='box')points.push({x:g.a.x,y:g.b.y},{x:g.b.x,y:g.a.y});
    }
    ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle=d.locked||this.manager.drawingsLocked?'#777':'#2962ff';ctx.lineWidth=2;ctx.setLineDash([]);
    if(d.type==='text'){
      const st=d.textStyle||{},sz=st.size||14,pad=sz/6,lh=sz*1.25;
      ctx.font=`${st.italic?'italic ':''}${st.bold?'bold ':''}${sz}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;
      const lines=String(d.text||'Text').split('\n');
      const maxW=Math.max(st.wordWrap?(st.wordWrapWidth||200):0,lines.reduce((m,l)=>Math.max(m,ctx.measureText?ctx.measureText(l).width:l.length*sz*0.6),0));
      ctx.lineWidth=1.5;ctx.strokeRect(g.a.x-pad,g.a.y-pad,maxW+pad*2,lines.length*lh+pad*2);
      ctx.lineWidth=2;
    }
    points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.stroke();});ctx.restore();this.placeToolbar();
    if(d.type==='box'){
      ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle=d.locked||this.manager.drawingsLocked?'#777':'#2962ff';ctx.lineWidth=1.5;ctx.setLineDash([]);
      for(const p of DrawingModel.boxEdges(g)){ctx.fillRect(p.x-4,p.y-4,8,8);ctx.strokeRect(p.x-4,p.y-4,8,8);}ctx.restore();
    }
  }
}
