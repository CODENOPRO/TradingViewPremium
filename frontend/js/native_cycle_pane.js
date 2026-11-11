/* v5 preview: rendering uses a native series primitive, native scales and separators. */
class NativeCyclePane {
  constructor(engine) {
    this.engine=engine;
    this.view={ratio:.3,collapsed:false,maximized:false,...Workspace.read('indicator_native_pane_'+engine.id,{})};
    this.series=engine.addSeries('Line',{color:'transparent',lineVisible:false,crosshairMarkerVisible:false,lastValueVisible:false,priceLineVisible:false,
      priceFormat:{type:'price',precision:0,minMove:1},autoscaleInfoProvider:()=>({priceRange:{minValue:this.descriptor?.min??0,maxValue:this.descriptor?.max??100}})},1);
    this.pane=this.series.getPane();
    this.primitive={
      attached:({requestUpdate})=>{this.invalidate=requestUpdate;},
      detached:()=>{this.invalidate=null;},
      paneViews:()=>[{zOrder:()=> 'normal',renderer:()=>({draw:target=>target.useMediaCoordinateSpace(scope=>this.draw(scope.context,scope.mediaSize))})}]
    };
    this.series.attachPrimitive(this.primitive);
    this.header=document.createElement('div');this.header.className='indicator-pane-header native-cycle-header';
    for(const [text,label,action] of [
      ['Cycle','Cycle indicator settings',()=>engine.onIndicatorSettings?.()],
      ['⚙','Native cycle settings',()=>engine.onIndicatorSettings?.()],
      ['↺','Reset native cycle scale',()=>this.resetScale()],
      ['−','Collapse native cycle pane',()=>{this.view.collapsed=!this.view.collapsed;this.view.maximized=false;this.size();this.persist();}],
      ['□','Expand native cycle pane',()=>{this.view.maximized=!this.view.maximized;this.view.collapsed=false;this.size();this.persist();}]
    ]) {const button=document.createElement('button');button.type='button';button.textContent=text;button.title=label;button.setAttribute('aria-label',label);button.onclick=e=>{e.stopPropagation();action();};this.header.appendChild(button);}
    this.header.firstChild.className='pane-title';engine.container.appendChild(this.header);
    // Native mouse separator remains exposed. This overlay only provides keyboard resize.
    this.keyboardDivider=document.createElement('div');this.keyboardDivider.className='native-pane-keyboard-divider';this.keyboardDivider.tabIndex=0;this.keyboardDivider.setAttribute('role','separator');this.keyboardDivider.setAttribute('aria-label','Resize native cycle pane');this.keyboardDivider.setAttribute('aria-orientation','horizontal');engine.container.appendChild(this.keyboardDivider);
    this.keyboardDivider.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();this.view.collapsed=false;this.pane.setHeight(Math.max(32,this.pane.getHeight()+(e.key==='ArrowUp'?12:-12)));this.geometry();this.persist(true);};
    // Persist after the native widget has laid out its new height, not the old height
    // returned immediately after setHeight() or a separator drag.
    this.observer=new ResizeObserver(()=>{this.geometry();this.persist(true);});
    this.saveLater=()=>{clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>this.persist(true),150);};
    engine.container.addEventListener('pointerup',this.saveLater);
    engine.container.addEventListener('wheel',this.saveLater,{passive:true});
  }

  set(descriptor) {
    this.descriptor=descriptor;this.header.firstChild.textContent=descriptor.title||'Cycle';
    // No artificial future bars: these anchors share the chart's existing time domain.
    this.series.setData(this.engine.bars.map(b=>({time:b.time,value:(descriptor.min+descriptor.max)/2})));
    if(!this.initialized){this.initialized=true;this.size();this.resetScale(this.view.range);}
    this.invalidate?.();this.geometry();
  }

  resetScale(range) {
    if(!this.descriptor)return;
    const {min,max}=this.descriptor,extra=(max-min)*.15;
    this.series.priceScale().applyOptions({autoScale:false});
    const valid=range&&Number.isFinite(range.from)&&Number.isFinite(range.to)&&range.to>range.from;
    this.series.priceScale().setVisibleRange(valid?range:{from:min-extra,to:max+extra});
    this.invalidate?.();this.persist();
  }

  size() {
    const total=this.engine.container.clientHeight-this.engine.chart.timeScale().height();
    const height=this.view.collapsed?32:this.view.maximized?total-32:Math.max(80,Math.min(total-65,total*this.view.ratio));
    this.pane.setHeight(height);this.geometry();
  }

  geometry() {
    if(this.destroyed)return;
    const engine=this.engine,row=this.pane.getHTMLElement(),rect=row?.getBoundingClientRect(),parent=engine.container.getBoundingClientRect();if(!rect)return;
    if(!this.observed){
      this.observer.observe(row);this.observed=true;this.row=row;
      this.doubleClick=e=>{e.stopPropagation();const r=row.getBoundingClientRect();if(e.clientX-r.left<r.width-65){e.preventDefault();engine.onIndicatorSettings?.();}};
      row.addEventListener('dblclick',this.doubleClick);
    }
    const top=rect.top-parent.top,height=this.pane.getHeight(),axis=engine.chart.timeScale().height();
    engine.paneHeight=height;
    if(this.marginHeight!==height){this.marginHeight=height;this.series.priceScale().applyOptions({scaleMargins:{top:Math.min(.6,26/Math.max(1,height)),bottom:.04}});}
    engine.container.style.setProperty('--indicator-pane-height',(height+axis)+'px');engine.container.style.setProperty('--pane-background',engine.config.bg);
    engine.container.dataset.paneCollapsed=String(!!this.view.collapsed);engine.container.dataset.paneMaximized=String(!!this.view.maximized);
    this.header.style.top=top+'px';this.header.style.bottom='auto';this.keyboardDivider.style.top=(top-3)+'px';
    engine.container.dataset.cyclePane='native-v5';this.invalidate?.();engine.renderDrawings();
  }

  draw(ctx,size) {
    if(!this.descriptor||this.view.collapsed||this.destroyed)return;
    ctx.save();ctx.beginPath();ctx.rect(0,24,size.width,Math.max(0,size.height-24));ctx.clip();
    const e=this.engine,adapter={bars:e.bars,tfSeconds:e.tfSeconds,currentTimeframe:e.currentTimeframe,chart:e.chart,container:{clientWidth:size.width+65},series:this.series};
    for(const drawing of this.descriptor.drawings)DrawingModel.draw(ctx,adapter,drawing);
    ctx.restore();
  }

  persist(measure=false) {
    if(this.destroyed)return;
    if(measure&&!this.view.collapsed&&!this.view.maximized){const total=this.engine.container.clientHeight-this.engine.chart.timeScale().height();this.view.ratio=Math.max(.1,Math.min(.85,this.pane.getHeight()/Math.max(1,total)));}
    this.view.range=this.series.priceScale().getVisibleRange();Workspace.write('indicator_native_pane_'+this.engine.id,this.view);
  }

  destroy() {
    this.destroyed=true;clearTimeout(this.saveTimer);this.observer.disconnect();
    this.row?.removeEventListener('dblclick',this.doubleClick);
    this.engine.container.removeEventListener('pointerup',this.saveLater);this.engine.container.removeEventListener('wheel',this.saveLater);
    this.header.remove();this.keyboardDivider.remove();this.series.detachPrimitive(this.primitive);this.engine.chart.removeSeries(this.series);
    this.engine.container.dataset.cyclePane='';this.engine.container.dataset.paneMaximized='false';
  }
}

class ChartEngineV5 extends ChartEngine {
  get plotHeight(){return this.chart?this.chart.panes()[0].getHeight()+this.chart.timeScale().height():this.container.clientHeight;}
  initChart(){super.initChart();this.container.dataset.chartEngine='v5';this.chart.applyOptions({layout:{panes:{enableResize:true,separatorColor:'#8b8377',separatorHoverColor:'#2962ff80'}}});}
  resize(){const r=this.container.getBoundingClientRect();if(r.width<=0||r.height<=0)return;this.chart.applyOptions({width:r.width,height:r.height});this.nativeCycle?.size();this.resizeOverlay();}
  renderIndicatorPane(){this.nativeCycle?.invalidate?.();}
  clearCustomSeries(){this.nativeCycle?.destroy();this.nativeCycle=null;this.paneHeight=0;super.clearCustomSeries();}
  applyIndicatorResult(result){
    super.applyIndicatorResult({...result,pane:null});
    if(result.pane){if(!this.nativeCycle)this.nativeCycle=new NativeCyclePane(this);this.nativeCycle.set(result.pane);}
    else if(this.nativeCycle){this.nativeCycle.destroy();this.nativeCycle=null;this.paneHeight=0;this.container.style.setProperty('--indicator-pane-height','0px');this.resize();}
  }
}
