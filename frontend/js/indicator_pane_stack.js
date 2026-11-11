/* Each instance owns its scale/view, while all panes share the chart's time axis. */
class IndicatorPaneStack {
  constructor(chart){this.chart=chart;this.hosts=new Map();}
  remove(id){const h=this.hosts.get(id);if(!h)return;h.native?.destroy();h.paneCanvas?.remove();h.paneHeader?.remove();h.paneSeparator?.remove();this.hosts.delete(id);}
  set(panes){
    const changed=panes.length!==this.hosts.size||panes.some(p=>!this.hosts.has(p.id));
    for(const id of this.hosts.keys())if(!panes.some(p=>p.id===id))this.remove(id);
    for(const {id,descriptor} of panes){
      let h=this.hosts.get(id);
      if(!h){
        const parent=this.chart;
        h=Object.create(ChartEngine.prototype);
        Object.assign(h,{id:parent.id+':'+id,container:parent.container,chart:parent.chart,series:parent.series,config:parent.config,
          indicatorPane:descriptor,renderDrawings:()=>parent.renderDrawings(),resize:()=>parent.resize(),onIndicatorSettings:()=>this.onSettings?.(id)});
        for(const key of ['bars','tfSeconds','currentTimeframe'])Object.defineProperty(h,key,{get:()=>parent[key]});
        this.hosts.set(id,h);
        if(parent.container.dataset.chartEngine==='v5'){
          h.addSeries=(type,options)=>parent.addSeries(type,options,parent.chart.panes().length);
          h.native=new NativeCyclePane(h);
        }else{
          h.paneCanvas=document.createElement('canvas');h.paneCanvas.className='indicator-pane';h.paneCanvas.dataset.indicatorId=id;
          Object.assign(h.paneCanvas.style,{position:'absolute',left:'0',pointerEvents:'auto',zIndex:'16'});parent.container.appendChild(h.paneCanvas);
          h.setupIndicatorPane();
          // Resize uses the owning instance rather than a global chart pane.
          h.savePaneView=()=>{Workspace.write('indicator_pane_'+h.id,h.paneView);parent.resize();};
        }
      }
      h.indicatorPane=descriptor;
      if(h.native)h.native.set(descriptor);
      else {h.paneHeader.querySelector('.pane-title').textContent=descriptor.title||'Indicator';h.paneCanvas.setAttribute('aria-label',descriptor.title||'Indicator pane');}
    }
    if(changed)this.chart.resize();else this.redraw();
  }
  resize(rect){
    const parent=this.chart,hosts=[...this.hosts.values()];
    if(parent.container.dataset.chartEngine==='v5'){
      parent.chart.applyOptions({width:rect.width,height:rect.height});
      for(const h of hosts)h.native.size();
      parent.paneHeight=hosts.reduce((n,h)=>n+(h.paneHeight||0),0);parent.resizeOverlay();return;
    }
    const desired=hosts.map(h=>h.paneView.collapsed?24:h.paneView.maximized?Math.max(56,rect.height-60):Math.max(56,rect.height*(h.paneView.ratio??.3)));
    const total=desired.reduce((a,b)=>a+b,0),budget=Math.max(0,rect.height-70),factor=total>budget?budget/total:1;
    parent.paneHeight=total*factor;parent.container.style.setProperty('--indicator-pane-height',parent.paneHeight+'px');
    parent.container.dataset.paneMaximized='false';parent.container.dataset.paneCollapsed='false';
    parent.chart.applyOptions({width:rect.width,height:Math.max(50,rect.height-parent.paneHeight)});
    let bottom=0;
    for(let i=hosts.length-1;i>=0;i--){const h=hosts[i];h.paneHeight=desired[i]*factor;h.paneCanvas.style.bottom=bottom+'px';h.paneHeader.style.bottom=(bottom+h.paneHeight-24)+'px';h.paneSeparator.style.bottom=(bottom+h.paneHeight-3)+'px';h.renderIndicatorPane();bottom+=h.paneHeight;}
    parent.resizeOverlay();
  }
  redraw(){for(const h of this.hosts.values())h.native?h.native.invalidate?.():h.renderIndicatorPane();}
}
