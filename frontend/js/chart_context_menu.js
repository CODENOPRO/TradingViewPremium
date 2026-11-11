/* One context menu per workspace; actions reuse the existing controllers. */
class ChartContextMenu {
  static clickedPoint(chart,x,y) {
    if(y<0||y>chart.plotHeight-26||x<0||x>chart.container.clientWidth-65)return null;
    const time=chart.coordinateToTime(x),raw=chart.coordinateToPrice(y),tick=chart.metadata.tickSize;
    if(!Number.isFinite(time)||!Number.isFinite(raw))return null;
    const price=Number.isFinite(tick)&&tick>0?Math.round(raw/tick)*tick:raw;
    return {time,price};
  }
  constructor({charts,drawing,desktop,activate,openAlert}) {
    Object.assign(this,{drawing,desktop,activate,openAlert});
    this.root=document.createElement('div');this.root.className='chart-context-menu';this.root.hidden=true;this.root.setAttribute('role','menu');this.root.setAttribute('aria-label','Chart context menu');document.body.appendChild(this.root);
    for(const chart of charts)chart.container.addEventListener('contextmenu',event=>{
      if(event.target.closest('input,textarea,select,button,.indicator-tables'))return;
      event.preventDefault();event.stopPropagation();const rect=chart.container.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      this.open(chart,x,y,event.clientX,event.clientY);
    });
    document.addEventListener('pointerdown',e=>{if(!this.root.contains(e.target))this.close();},true);
    window.addEventListener('resize',()=>this.close());window.addEventListener('blur',()=>this.close());
    window.addEventListener('keydown',e=>{
      if(this.root.hidden)return;
      if(!['Escape','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
      e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape'){this.close(true);return;}
      const items=[...this.root.querySelectorAll('button')].filter(b=>!b.disabled),index=items.indexOf(document.activeElement);
      const next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();
    },true);
  }
  close(focus=false){this.root.hidden=true;if(focus)this.opener?.focus();}
  item(label,action,shortcut='',disabled=false){
    const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.disabled=disabled;
    const text=document.createElement('span');text.textContent=label;button.appendChild(text);if(shortcut){const key=document.createElement('kbd');key.textContent=shortcut;button.appendChild(key);}
    button.onclick=async()=>{try{await action();this.close();}catch(error){this.status.textContent=error.message;}};this.root.appendChild(button);
  }
  divider(){const line=document.createElement('div');line.className='chart-context-divider';line.setAttribute('role','separator');this.root.appendChild(line);}
  open(chart,x,y,clientX,clientY){
    this.opener=document.activeElement;this.activate(chart);this.root.replaceChildren();const point=ChartContextMenu.clickedPoint(chart,x,y),hit=this.drawing.editor.find(chart,x,y);
    this.drawing.editor.toolbar.querySelector('.drawing-more').hidden=true;
    const run=action=>()=>{this.drawing.editor.select(chart,hit.drawing);this.drawing.editor.toolbar.querySelector(`[data-action="${action}"]`).click();};
    if(hit){
      this.drawing.editor.select(chart,hit.drawing);
      this.item('Settings…',()=>this.drawing.editor.open(),'');
      this.item('Text…',()=>this.drawing.editor.open('text'));
      this.item(hit.drawing.locked?'Unlock':'Lock',run('lock'));
      this.item('Clone',run('duplicate'));
      this.divider();this.item('Bring to front',run('front'));this.item('Send to back',run('back'));
      this.divider();this.item('Remove',run('delete'),'Delete',!!hit.drawing.locked||this.drawing.drawingsLocked);
    }else{
      this.item('Reset chart view',()=>chart.resetView(),'Alt R');
      if(point){
        const value=point.price.toLocaleString('en-US',{maximumFractionDigits:8});
        this.item(`Copy price ${value}`,async()=>{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable in this browser.');await navigator.clipboard.writeText(String(point.price));});
        this.divider();this.item(`Add alert on ${chart.symbol} at ${value}…`,()=>this.openAlert(chart,point.price),'Alt A');
        this.item('Trade…',()=>{document.getElementById('order-price').value=point.price;document.getElementById('paper-panel').classList.add('open');});
        this.item('Add text note…',()=>{const note={...DrawingModel.defaults('text'),id:crypto.randomUUID(),type:'text',p1:point,text:''};chart.drawings.push(note);this.drawing.saveDrawings(chart);this.drawing.editor.select(chart,note);this.drawing.editor.open('text');});
      }
      this.divider();this.item('Object tree…',()=>{this.desktop.objectTab='tree';this.desktop.open('objects');});
      this.item('Data window…',()=>{this.desktop.objectTab='data';this.desktop.open('objects');});
      this.item(this.drawing.drawingsHidden?'Show drawings':'Hide drawings',()=>this.drawing.toggleEye());
      this.item(this.drawing.drawingsLocked?'Unlock drawings':'Lock drawings',()=>this.drawing.toggleLock());
      this.divider();this.item('Remove drawings',()=>this.drawing.setTool('trash'),'',this.drawing.drawingsLocked||!chart.drawings.length);
      this.item('Settings…',()=>chart.onChartSettings?.());
    }
    this.status=document.createElement('div');this.status.className='chart-context-status';this.status.setAttribute('role','alert');this.root.appendChild(this.status);
    this.root.hidden=false;const rect=this.root.getBoundingClientRect();this.root.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,clientX))+'px';this.root.style.top=Math.max(8,Math.min(innerHeight-rect.height-8,clientY))+'px';this.root.querySelector('button:not([disabled])')?.focus();
  }
}
if(typeof module!=='undefined')module.exports=ChartContextMenu;
