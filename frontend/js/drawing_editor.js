class DrawingEditor {
  constructor(manager) {
    this.manager=manager;
    this.toolbar=document.createElement('div');this.toolbar.className='drawing-toolbar';this.toolbar.hidden=true;this.toolbar.setAttribute('role','toolbar');this.toolbar.setAttribute('aria-label','Drawing toolbar');
    this.toolbar.innerHTML=`<span class="drawing-grip">⠿</span><label title="Border / line color"><input type="color" data-quick="borderColor" aria-label="Drawing border color"></label><label title="Background color"><input type="color" data-quick="fillColor" aria-label="Drawing fill color"></label><button data-action="text" title="Text">T</button><select data-quick="width" aria-label="Drawing line width">${[1,2,3,4,5].map(n=>`<option value="${n}">${n}px</option>`).join('')}</select><select data-quick="lineStyle" aria-label="Drawing line style"><option value="solid">━━</option><option value="dashed">┅┅</option><option value="dotted">····</option></select><span class="toolbar-divider"></span><button data-action="settings" title="Settings" aria-label="Drawing settings">⚙</button><button data-action="duplicate" title="Clone" aria-label="Clone drawing">⧉</button><button data-action="lock" title="Lock / Unlock" aria-label="Lock drawing"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></button><button data-action="delete" title="Remove" aria-label="Remove drawing">×</button><button data-action="more" title="More" aria-label="More drawing actions">···</button><div class="drawing-more" hidden><button data-action="front">Bring to front</button><button data-action="back">Send to back</button><button data-action="template">Template…</button></div>`;
    document.body.appendChild(this.toolbar);
    this.settings=new DrawingSettings(this);
    this.toolbar.querySelectorAll('[data-quick]').forEach(input=>input.addEventListener('change',()=>{
      if(!this.drawing)return;
      const draft=DrawingModel.normalize(this.drawing);draft[input.dataset.quick]=input.dataset.quick==='width'?Number(input.value):input.value;
      if(input.dataset.quick==='borderColor')draft.color=input.value;
      this.commit(draft);
    }));
    this.toolbar.addEventListener('click',event=>{
      const action=event.target.closest('[data-action]')?.dataset.action;if(!action||!this.drawing)return;
      if(action==='settings'||action==='text')this.open(action==='text'?'text':'style');
      else if(action==='template'){this.open('style');this.settings.root.querySelector('#drawing-template').focus();}
      else if(action==='more')this.toolbar.querySelector('.drawing-more').hidden=!this.toolbar.querySelector('.drawing-more').hidden;
      else if(action==='delete')this.remove();
      else if(action==='lock')this.commit({...this.drawing,locked:!this.drawing.locked});
      else if(action==='duplicate'){
        const draft=structuredClone(this.drawing);draft.id=crypto.randomUUID();draft.locked=false;
        const c=this.selection.chart;draft.p1.time=DrawingModel.timeAt(c,DrawingModel.logicalIndex(c,draft.p1.time)+2);
        if(draft.p2)draft.p2.time=DrawingModel.timeAt(c,DrawingModel.logicalIndex(c,draft.p2.time)+2);
        c.drawings.push(draft);this.manager.saveDrawings(c);this.select(c,draft);
      } else if(action==='front'||action==='back'){
        const c=this.selection.chart,d=this.drawing;c.drawings=c.drawings.filter(item=>item.id!==d.id);action==='front'?c.drawings.push(d):c.drawings.unshift(d);this.manager.saveDrawings(c);c.renderDrawings();
      }
    });
    document.addEventListener('keydown',event=>{
      if(event.target.closest('input,textarea,select,[contenteditable]'))return;
      if(event.key==='Escape'){this.cancelDrag();this.clear();}
      if((event.key==='Delete'||event.key==='Backspace')&&this.drawing){event.preventDefault();event.stopPropagation();this.remove();}
    },true);
    window.addEventListener('resize',()=>this.placeToolbar());
    window.addEventListener('blur',()=>this.cancelDrag());
  }
  get drawing(){return this.selection?.chart.drawings.find(d=>d.id===this.selection.id);}
  select(chart,drawing){this.selection={chart,id:drawing.id};this.toolbar.hidden=false;this.toolbar.querySelector('.drawing-more').hidden=true;this.updateToolbar();chart.renderDrawings();}
  updateToolbar(){
    if(!this.drawing)return this.clear();
    const d=DrawingModel.normalize(this.drawing);
    for(const input of this.toolbar.querySelectorAll('[data-quick]'))input.value=input.type==='color'?DrawingModel.hex(d[input.dataset.quick]):d[input.dataset.quick];
    this.toolbar.querySelector('[data-quick="fillColor"]').parentElement.hidden=!['box','measure','position'].includes(d.type);
    this.toolbar.querySelector('[data-action="lock"]').classList.toggle('active',!!d.locked);this.placeToolbar();
  }
  placeToolbar(){if(!this.selection)return;const rect=this.selection.chart.container.getBoundingClientRect();const width=Math.min(480,window.innerWidth-24);this.toolbar.style.left=`${Math.max(12,Math.min(window.innerWidth-width-12,rect.left+rect.width/2-width/2))}px`;this.toolbar.style.top=`${Math.max(50,Math.min(window.innerHeight-50,rect.top+75))}px`;}
  clear(){const chart=this.selection?.chart;this.selection=null;this.toolbar.hidden=true;if(chart){chart.drawingPreview=null;chart.renderDrawings();}}
  preview(draft){if(!this.selection)return;this.selection.chart.drawingPreview=draft;this.selection.chart.renderDrawings();}
  commit(value){
    if(!this.selection)return;
    const c=this.selection.chart,index=c.drawings.findIndex(d=>d.id===this.selection.id);if(index<0)return;
    c.drawings[index]=DrawingModel.normalize(structuredClone(value));c.drawingPreview=null;this.manager.saveDrawings(c);this.updateToolbar();c.renderDrawings();
  }
  remove(){if(!this.drawing)return;if(this.drawing.locked||this.manager.drawingsLocked)return window.showToast?.('Mở khóa bản vẽ trước khi xóa.','alert');const c=this.selection.chart;c.drawings=c.drawings.filter(d=>d.id!==this.selection.id);this.manager.saveDrawings(c);this.clear();}
  open(tab='style'){if(this.drawing)this.settings.open(this.selection.chart,this.drawing,tab);}
  find(chart,x,y){if(chart.drawingsHidden)return null;for(let i=chart.drawings.length-1;i>=0;i--){const d=chart.drawings[i];if(d.isTemp)continue;const handle=DrawingModel.hit(chart,d,x,y);if(handle)return {drawing:d,handle};}return null;}
  bind(chart){
    chart.container.addEventListener('pointerdown',event=>{
      if(event.button!==0||this.manager.activeTool!=='crosshair'||event.target.closest('button,input,select,.indicator-tables,.tv-trade-pill,.chart-nav-controls'))return;
      const rect=chart.container.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
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
      if(!this.drag||this.drag.chart!==chart)return;
      const rect=chart.container.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      if(Math.hypot(x-this.drag.startX,y-this.drag.startY)<3&&!this.drag.changed)return;
      const point=DrawingModel.fromPixel(chart,x,y);if(!point)return;
      event.preventDefault();event.stopImmediatePropagation();
      const {original,start,handle}=this.drag,d=structuredClone(original);
      if(handle==='p1'||handle==='p2')d[handle]=point;
      else if(handle==='p1x_p2y'){d.p1.time=point.time;d.p2.price=point.price;}
      else if(handle==='p2x_p1y'){d.p2.time=point.time;d.p1.price=point.price;}
      else {const delta=Math.round(DrawingModel.logicalIndex(chart,point.time)-DrawingModel.logicalIndex(chart,start.time));for(const key of original.p2?['p1','p2']:['p1']){d[key].time=DrawingModel.timeAt(chart,DrawingModel.logicalIndex(chart,original[key].time)+delta);d[key].price=original[key].price+point.price-start.price;}}
      this.drag.changed=true;this.drag.draft=d;this.preview(d);
    },true);
    chart.container.addEventListener('pointerup',event=>{
      if(!this.drag||this.drag.chart!==chart)return;event.preventDefault();event.stopImmediatePropagation();
      const draft=this.drag.changed?this.drag.draft:null;this.cancelDrag();if(draft)this.commit(draft);
    },true);
    chart.container.addEventListener('pointercancel',()=>this.cancelDrag(),true);
    chart.container.addEventListener('dblclick',event=>{
      if(this.manager.activeTool!=='crosshair'||event.target.closest('button,input,select'))return;
      const rect=chart.container.getBoundingClientRect(),hit=this.find(chart,event.clientX-rect.left,event.clientY-rect.top);
      if(hit){event.preventDefault();event.stopImmediatePropagation();this.select(chart,hit.drawing);this.open();}
    },true);
    chart.container.addEventListener('contextmenu',event=>{
      const rect=chart.container.getBoundingClientRect(),hit=this.find(chart,event.clientX-rect.left,event.clientY-rect.top);
      if(hit){event.preventDefault();this.select(chart,hit.drawing);this.toolbar.querySelector('.drawing-more').hidden=false;}
    });
  }
  cancelDrag(){if(!this.drag)return;const {chart,pointer}=this.drag;this.drag=null;if(chart.container.hasPointerCapture(pointer))chart.container.releasePointerCapture(pointer);chart.chart.applyOptions({handleScroll:{pressedMouseMove:true}});chart.drawingPreview=null;chart.renderDrawings();}
  renderHandles(chart,ctx){
    if(this.selection?.chart!==chart)return;
    const d=chart.drawingPreview||this.drawing;
    if(!d){this.clear();return;}
    if(chart.drawingsHidden||!DrawingModel.visible(d,chart.currentTimeframe)){this.toolbar.hidden=true;return;}
    this.toolbar.hidden=false;
    const g=DrawingModel.geometry(chart,d);if(!g)return;
    const points=[g.a];if(d.p2)points.push(g.b);if(d.type==='box')points.push({x:g.a.x,y:g.b.y},{x:g.b.x,y:g.a.y});
    ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle=d.locked||this.manager.drawingsLocked?'#777':'#2962ff';ctx.lineWidth=2;ctx.setLineDash([]);
    points.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.stroke();});ctx.restore();this.placeToolbar();
  }
}
