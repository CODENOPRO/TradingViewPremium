const TF_MAP = MarketData.durations;
const CHART_CLOCK = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false});
const CHART_DATE = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',month:'short',day:'numeric'});
const CHART_DATETIME = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});

class ChartEngine {
  get plotHeight() { return this.container.clientHeight-(this.paneHeight||0); }
  constructor(container, symbol, config = {}) {
    this.container = container;
    this.symbol = symbol;

    // Exact Theme matching TradingView
    this.config = Object.assign({
      bg: '#c2baae',
      grid: '#a8a194',
      bodyUp: '#e8e4dc',
      borderUp: '#211f1d',
      wickUp: '#211f1d',
      bodyDown: '#211f1d',
      borderDown: '#211f1d',
      wickDown: '#211f1d',
      textColor: '#202020'
    }, config);

    this.rawBars = [];
    this.bars = [];
    this.htfData = { 'W': [], 'D': [], '4h': [], '1h': [], '15m': [], '5m': [], '1m': [] };
    this.currentTimeframe = '1m';
    this.tfSeconds = 60;
    this.drawings = [];
    this.drawingsHidden = false;
    this.drawingsLocked = false;
    this.metadata = {};
    this.htfBaselines = {};
    this.onDataChange = null;
    this.customSeries = [];
    this.positions = [];

    // 1. Initialize Lightweight Charts instance
    this.initChart();

    // 2. Initialize Overlay Canvas for Trendlines, Boxes, Fib, Measure, etc.
    this.initDrawingOverlay();

    // 3. Navigation Controls
    this.initNavControls();

    // 4. Legend updates on crosshair move
    this.initLegendListener();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  initChart() {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width || 400;
    const height = rect.height || 300;

    this.chart = LightweightCharts.createChart(this.container, {
      width: width,
      height: height,
      layout: {
        background: { type: 'solid', color: this.config.bg },
        textColor: this.config.textColor,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif'
      },
      localization: { timeFormatter: time => CHART_DATETIME.format(new Date(time * 1000)) },
      grid: {
        vertLines: { color: this.config.grid, style: LightweightCharts.LineStyle.Dotted },
        horzLines: { color: this.config.grid, style: LightweightCharts.LineStyle.Dotted }
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: '#434651', style: LightweightCharts.LineStyle.Dashed, width: 1 },
        horzLine: { color: '#434651', style: LightweightCharts.LineStyle.Dashed, width: 1 }
      },
      rightPriceScale: {
        borderColor: '#a8a194',
        scaleMargins: { top: 0.1, bottom: 0.15 },
        autoScale: true,
        mode: LightweightCharts.PriceScaleMode.Normal
      },
      timeScale: {
        borderColor: '#a8a194',
        tickMarkFormatter: time => typeof time === 'number' ? (this.tfSeconds >= 86400 ? CHART_DATE : CHART_CLOCK).format(new Date(time * 1000)) : '',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true }, // Native axis dragging on both axes!
        mouseWheel: true,
        pinch: true
      },
      watermark: {
        visible: false,
        fontSize: 34,
        horzAlign: 'left',
        vertAlign: 'bottom',
        color: 'rgba(0, 0, 0, 0.08)',
        text: 'TradingView'
      }
    });

    // Add Candlestick Series
    this.series = this.chart.addCandlestickSeries({
      upColor: this.config.bodyUp,
      downColor: this.config.bodyDown,
      borderUpColor: this.config.borderUp,
      borderDownColor: this.config.borderDown,
      wickUpColor: this.config.wickUp,
      wickDownColor: this.config.wickDown,
      priceLineColor: '#211f1d',
      priceLineStyle: LightweightCharts.LineStyle.Dashed,
      priceLineWidth: 1
    });

    // Double click to reset view
    this.container.addEventListener('dblclick', (e) => {
      // Only reset if clicked inside chart area, not on buttons
      if (!e.target.closest('.chart-nav-controls') && !e.target.closest('.chart-legend')) {
        this.resetView();
      }
    });
  }

  initDrawingOverlay() {
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.className = 'drawing-canvas';
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.top = '0';
    this.overlayCanvas.style.left = '0';
    this.overlayCanvas.style.width = '100%';
    this.overlayCanvas.style.height = '100%';
    this.overlayCanvas.style.pointerEvents = 'none';
    this.overlayCanvas.style.zIndex = '15';
    this.container.appendChild(this.overlayCanvas);

    this.overlayCtx = this.overlayCanvas.getContext('2d');

    // Redraw drawings on every scroll / zoom / time range change
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      this.renderDrawings();
      this.renderIndicatorPane();
    });

    this.resizeOverlay();
  }

  resizeOverlay() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.overlayCanvas.width = rect.width * dpr;
    this.overlayCanvas.height = rect.height * dpr;
    this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.overlayCtx.scale(dpr, dpr);
    this.renderDrawings();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const view=this.paneView||{};
      this.paneHeight = this.indicatorPane ? view.collapsed?24:view.maximized?rect.height:Math.max(24,Math.min(Math.max(56,rect.height*(view.ratio??.3)),rect.height-80)) : 0;
      this.container.style.setProperty('--indicator-pane-height',this.paneHeight+'px');
      this.container.style.setProperty('--pane-background',this.config.bg);
      this.container.dataset.paneCollapsed=String(!!view.collapsed);
      this.container.dataset.paneMaximized=String(!!view.maximized);
      this.chart.applyOptions({ width: rect.width, height: Math.max(50,rect.height-this.paneHeight) });
      if(this.paneHeader)this.paneHeader.style.bottom=(this.paneHeight-24)+'px';
      if(this.paneSeparator)this.paneSeparator.style.bottom=(this.paneHeight-3)+'px';
      this.resizeOverlay();
      this.renderIndicatorPane();
    }
  }

  // Histories are independent; live 1m replacements never add the same volume twice.
  setHtfData(tf, values) {
    this.htfData[tf] = MarketData.clean(values);
    this.htfBaselines[tf] = new Map(this.rawBars.map(b => [b.time, b.volume]));
    if (this.currentTimeframe === tf) this.renderCurrentTimeframe(false);
    this.onDataChange?.();
  }

  getBarsForTimeframe(tf) {
    if (this.sessionMode === 'RTH') {
      const filtered = this.rawBars.filter(b => MarketData.inRegularSession(b, this.metadata));
      return MarketData.aggregate(filtered, tf, { ...this.metadata, session: this.metadata.sessionRegular?.session, sessionType: 'RTH' });
    }
    if (tf === '1m') return this.rawBars.map(b => ({ ...b }));
    const direct = this.htfData[tf] || [];
    if (!direct.length) return MarketData.aggregate(this.rawBars, tf, this.metadata);
    const result = direct.map(b => ({ ...b }));
    const last = result[result.length - 1];
    const tail = this.rawBars.filter(b => b.time >= last.time);
    const aggregate = MarketData.aggregate(tail, tf, this.metadata);
    const baseline = this.htfBaselines[tf] || new Map();
    for (const bar of aggregate) {
      if (bar.time === last.time) {
        // With full minute coverage, recompute; otherwise use only changes since the HTF snapshot.
        const complete = tail.length && tail[0].time === last.time;
        if (complete) Object.assign(last, bar);
        else {
          last.high = Math.max(last.high, bar.high);
          last.low = Math.min(last.low, bar.low);
          last.close = bar.close;
          last.volume = Math.max(0, last.volume + tail.filter(b => MarketData.bucket(b.time, tf, this.metadata) === last.time)
            .reduce((sum, b) => sum + b.volume - (baseline.get(b.time) || 0), 0));
        }
      } else if (bar.time > last.time) result.push(bar);
    }
    return result;
  }

  renderCurrentTimeframe(reset = true) {
    const previous = this.chart.timeScale().getVisibleLogicalRange();
    const available = this.getBarsForTimeframe(this.currentTimeframe);
    this.bars = this.replayMode ? available.slice(0, this.replayIndex) : available;
    this.series.setData(this.bars);
    if (reset && this.bars.length) this.resetView();
    else if (previous) this.chart.timeScale().setVisibleLogicalRange(previous);
    this.updateLegend(this.bars[this.bars.length - 1]);
    this.container.dataset.empty = this.bars.length ? '' : 'Không có dữ liệu cho mã/khung này';
    this.renderDrawings();
    this.onDataChange?.();
  }

  setTimeframe(tf) {
    if (!TF_MAP[tf]) return;
    this.currentTimeframe = tf;
    this.tfSeconds = TF_MAP[tf];
    this.replayMode = false;
    this.renderCurrentTimeframe();
  }

  setData(values) {
    const wasEmpty = !this.rawBars.length;
    this.rawBars = MarketData.clean(values);
    this.htfData['1m'] = this.rawBars;
    this.renderCurrentTimeframe(wasEmpty);
  }

  updateBar(value) {
    const bar = MarketData.clean([value])[0];
    if (!bar) return;
    const index = this.rawBars.findIndex(b => b.time >= bar.time);
    if (index < 0) this.rawBars.push(bar);
    else if (this.rawBars[index].time === bar.time) this.rawBars[index] = bar;
    else this.rawBars.splice(index, 0, bar);
    this.htfData['1m'] = this.rawBars;
    if (this.replayMode) return;
    const next = this.getBarsForTimeframe(this.currentTimeframe);
    const last = this.bars[this.bars.length - 1];
    const tail = next[next.length - 1];
    const historical = last && bar.time < last.time;
    this.bars = next;
    if (tail && (!last || tail.time >= last.time) && !historical) this.series.update(tail);
    else this.series.setData(next);
    this.updateLegend(tail);
    this.renderDrawings();
    this.onDataChange?.();
  }

  clearData() {
    this.rawBars = [];
    this.bars = [];
    this.htfData = {};
    this.htfBaselines = {};
    this.replayMode = false;
    this.series.setData([]);
    this.container.querySelector('.chart-legend').textContent = this.symbol;
    this.renderDrawings();
  }

  clearCustomSeries() {
    for (const series of this.customSeries) this.chart.removeSeries(series);
    this.customSeries = [];
    this.indicatorDrawings = [];
    if(this.indicatorCandleColors?.size) this.series.setData(this.bars);
    this.indicatorCandleColors=new Map();
    this.indicatorPane = null;
    this.paneCanvas?.remove(); this.paneCanvas=null;
    this.paneHeader?.remove();this.paneHeader=null;this.paneSeparator?.remove();this.paneSeparator=null;
    this.indicatorLegend?.remove();this.indicatorLegend=null;
    this.container.querySelector('.indicator-tables')?.replaceChildren();
    this.resize();
  }

  applyIndicatorResult(result) {
    // Keep series instances across ticks; rebuilding them also resets scale state.
    const descriptors=result.series || [];
    if(this.customSeries.length!==descriptors.length || this.customSeries.some((s,i)=>s._indicatorType!==(descriptors[i].type||'line'))) {
      for(const series of this.customSeries)this.chart.removeSeries(series);
      this.customSeries=[];
    }
    descriptors.forEach((descriptor,i) => {
      const options = { color: descriptor.color || '#2962ff', lineWidth: Math.max(1, Math.min(4, Math.round(descriptor.width || 1))),
        title: descriptor.title || '', priceLineVisible: false, lastValueVisible: false };
      const series = this.customSeries[i] || (descriptor.type === 'histogram' ? this.chart.addHistogramSeries(options) : this.chart.addLineSeries(options));
      series._indicatorType=descriptor.type||'line'; series.applyOptions(options);
      series.setData(descriptor.data);
      this.customSeries[i]=series;
    });
    this.indicatorDrawings = result.drawings || [];
    if(result.candleColors?.length || this.indicatorCandleColors?.size) {
      this.indicatorCandleColors=new Map((result.candleColors||[]).map(x=>[x.time,x.color]));
      this.series.setData(this.bars.map(b=>this.indicatorCandleColors.has(b.time)?{...b,color:this.indicatorCandleColors.get(b.time)}:b));
    }
    const hadPane=!!this.indicatorPane;
    this.indicatorPane=result.pane||null;
    if(this.indicatorPane&&!this.paneCanvas) {
      this.paneCanvas=document.createElement('canvas');this.paneCanvas.className='indicator-pane';
      this.paneCanvas.setAttribute('role','img');
      Object.assign(this.paneCanvas.style,{position:'absolute',bottom:'0',left:'0',pointerEvents:'auto',zIndex:'16'});
      this.container.appendChild(this.paneCanvas);
      this.setupIndicatorPane();
    } else if(!this.indicatorPane&&this.paneCanvas) {
      this.paneCanvas.remove();this.paneCanvas=null;this.paneHeader?.remove();this.paneHeader=null;this.paneSeparator?.remove();this.paneSeparator=null;
    }
    if(this.paneCanvas)this.paneCanvas.setAttribute('aria-label',this.indicatorPane.title||'Indicator pane');
    let panel = this.container.querySelector('.indicator-tables');
    if (!panel) { panel = document.createElement('div'); panel.className = 'indicator-tables'; this.container.appendChild(panel); }
    panel.replaceChildren();
    const groups=new Map();
    for (const descriptor of result.tables || []) {
      const position=String(descriptor.position||'Top Right').toLowerCase().replaceAll('_',' '),key=position+':'+!!descriptor.pane;
      if(!groups.has(key)) {
        const group=document.createElement('div');group.className='indicator-table-group';
        if(descriptor.pane) {group.classList.add('pane-table-group');group.style.maxHeight='calc(var(--indicator-pane-height, 70px) - 30px)';group.style.overflow='auto';group.style.pointerEvents='auto';}
        group.style[position.includes('left')?'left':'right']=position.includes('left')?'6px':'76px';
        if(position.includes('bottom'))group.style.bottom=descriptor.pane?'4px':'calc(var(--indicator-pane-height, 0px) + 30px)';
        else group.style.top=position.includes('middle')?'40%':descriptor.pane?'calc(100% - var(--indicator-pane-height, 0px) + 26px)':'6px';
        panel.appendChild(group);groups.set(key,group);
      }
      const table = document.createElement('table');
      if (descriptor.title) { const caption = table.createCaption(); caption.textContent = descriptor.title; }
      for (const row of descriptor.rows || []) {
        const tr = table.insertRow();
        for (const value of row) { const td = tr.insertCell(); td.textContent = String(value && typeof value==='object' ? value.text??'' : value??''); if(value?.color)td.style.color=value.color; }
      }
      groups.get(key).appendChild(table);
    }
    this.renderDrawings();
    if(hadPane!==!!this.indicatorPane)this.resize();else this.renderIndicatorPane();
  }

  renderIndicatorPane() {
    if(!this.paneCanvas||!this.indicatorPane)return;
    const width=this.container.clientWidth,height=this.paneHeight||70,dpr=window.devicePixelRatio||1;
    this.paneCanvas.width=width*dpr;this.paneCanvas.height=height*dpr;
    this.paneCanvas.style.width=width+'px';this.paneCanvas.style.height=height+'px';
    const ctx=this.paneCanvas.getContext('2d'), pane=this.indicatorPane;
    ctx.scale(dpr,dpr);ctx.fillStyle=this.config.bg;ctx.fillRect(0,0,width,height);
    ctx.strokeStyle=this.config.grid;ctx.beginPath();ctx.moveTo(0,.5);ctx.lineTo(width,.5);ctx.stroke();
    if(this.paneView?.collapsed)return;
    const scale=this.paneView?.scale||1,offset=this.paneView?.offset||0,range=pane.max-pane.min,usable=Math.max(1,height-28);
    const y=value=>24+usable/2-(value-(pane.min+pane.max)/2-offset)*scale*usable/range;
    ctx.save();ctx.beginPath();ctx.rect(0,24,Math.max(0,width-65),height-24);ctx.clip();
    const adapter={bars:this.bars,tfSeconds:this.tfSeconds,currentTimeframe:this.currentTimeframe,chart:this.chart,container:this.container,
      series:{priceToCoordinate:y}};
    for(const drawing of pane.drawings)DrawingModel.draw(ctx,adapter,drawing);
    ctx.restore();
    ctx.fillStyle=this.config.textColor;ctx.font='10px Arial';ctx.textAlign='left';
    for(let i=0;i<=4;i++){const value=pane.min+range*i/4,at=y(value);if(at>=29&&at<height-3)ctx.fillText(value.toFixed(0),width-59,at+3);}
  }

  setIndicatorLegend(name) {
    if(!this.indicatorLegend){
      const legend=document.createElement('div');legend.className='indicator-legend';this.indicatorLegend=legend;this.container.appendChild(legend);
      const title=document.createElement('span');title.className='indicator-title';legend.appendChild(title);
      const settings=document.createElement('button');settings.type='button';settings.textContent='⚙';settings.title='Indicator settings';settings.setAttribute('aria-label','Indicator settings');
      settings.onclick=event=>{event.stopPropagation();this.onIndicatorSettings?.();};legend.appendChild(settings);
      legend.ondblclick=()=>this.onIndicatorSettings?.();
    }
    this.indicatorLegend.querySelector('.indicator-title').textContent=name.replace(/ · JavaScript.*$/,'');
  }

  savePaneView() {Workspace.write('indicator_pane_'+this.id,this.paneView);}

  setupIndicatorPane() {
    this.paneView ||= {...{ratio:.3,scale:1,offset:0,collapsed:false,maximized:false},...Workspace.read('indicator_pane_'+this.id,{})};
    const header=document.createElement('div');header.className='indicator-pane-header';this.paneHeader=header;
    const name=document.createElement('button');name.type='button';name.className='pane-title';name.textContent=this.indicatorPane.title||'Cycle';name.onclick=()=>this.onIndicatorSettings?.();header.appendChild(name);
    for(const [text,title,action] of [
      ['⚙','Cycle indicator settings',()=>this.onIndicatorSettings?.()],
      ['↺','Reset cycle scale',()=>{this.paneView.scale=1;this.paneView.offset=0;this.renderIndicatorPane();this.savePaneView();}],
      ['−','Collapse cycle pane',()=>{this.paneView.collapsed=!this.paneView.collapsed;this.paneView.maximized=false;this.resize();this.savePaneView();}],
      ['□','Maximize cycle pane',()=>{this.paneView.maximized=!this.paneView.maximized;this.paneView.collapsed=false;this.resize();this.savePaneView();}]
    ]) {const b=document.createElement('button');b.type='button';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.onclick=e=>{e.stopPropagation();action();};header.appendChild(b);}
    const activate=()=>this.container.dispatchEvent(new CustomEvent('chart-activate'));
    header.onpointerdown=e=>{activate();e.stopPropagation();};this.container.appendChild(header);
    const divider=document.createElement('div');divider.className='indicator-pane-divider';divider.setAttribute('role','separator');divider.setAttribute('aria-orientation','horizontal');divider.setAttribute('aria-label','Resize cycle pane');divider.tabIndex=0;this.paneSeparator=divider;this.container.appendChild(divider);
    let resizeStart;
    divider.onpointerdown=e=>{activate();e.preventDefault();e.stopPropagation();resizeStart={y:e.clientY,height:this.paneHeight};divider.setPointerCapture(e.pointerId);};
    divider.onpointermove=e=>{if(!resizeStart)return;this.paneView.ratio=Math.min(.85,Math.max(.1,(resizeStart.height+resizeStart.y-e.clientY)/this.container.clientHeight));this.paneView.collapsed=false;this.paneView.maximized=false;this.resize();};
    divider.onpointerup=divider.onpointercancel=()=>{resizeStart=null;this.savePaneView();};
    divider.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();this.paneView.ratio=Math.min(.85,Math.max(.1,(this.paneHeight+(e.key==='ArrowUp'?12:-12))/this.container.clientHeight));this.paneView.collapsed=false;this.resize();this.savePaneView();};
    let drag;
    const canvas=this.paneCanvas;
    canvas.onpointerdown=e=>{
      if(e.button!==0||this.paneView.collapsed)return;activate();e.preventDefault();e.stopPropagation();
      drag={x:e.clientX,y:e.clientY,offset:this.paneView.offset,scale:this.paneView.scale,range:this.chart.timeScale().getVisibleLogicalRange(),axis:e.offsetX>=this.container.clientWidth-65};canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointermove=e=>{
      if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(drag.axis)this.paneView.scale=Math.max(.2,Math.min(8,drag.scale*Math.exp(-dy/100)));
      else {
        this.paneView.offset=drag.offset+dy*(this.indicatorPane.max-this.indicatorPane.min)/(drag.scale*Math.max(1,this.paneHeight-28));
        if(drag.range){const delta=dx*(drag.range.to-drag.range.from)/Math.max(1,this.container.clientWidth-65);this.chart.timeScale().setVisibleLogicalRange({from:drag.range.from-delta,to:drag.range.to-delta});}
      }
      this.renderIndicatorPane();
    };
    canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;this.savePaneView();};
    canvas.ondblclick=()=>this.onIndicatorSettings?.();
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();e.stopPropagation();
      if(e.offsetX>=this.container.clientWidth-65||e.shiftKey){this.paneView.scale=Math.max(.2,Math.min(8,this.paneView.scale*Math.exp(-e.deltaY/500)));this.renderIndicatorPane();this.savePaneView();}
      else {const r=this.chart.timeScale().getVisibleLogicalRange();if(!r)return;const factor=Math.exp(Math.max(-1,Math.min(1,e.deltaY/500))),width=Math.max(5,Math.min(5000,(r.to-r.from)*factor)),anchor=Math.min(1,e.offsetX/Math.max(1,this.container.clientWidth-65)),at=r.from+anchor*(r.to-r.from);this.chart.timeScale().setVisibleLogicalRange({from:at-anchor*width,to:at+(1-anchor)*width});}
    },{passive:false});
  }

  // NAVIGATION & ZOOM CONTROLS
  initNavControls() {
    const btnZoomOut = this.container.querySelector('.btn-zoom-out');
    const btnZoomIn = this.container.querySelector('.btn-zoom-in');
    const btnScrollLeft = this.container.querySelector('.btn-scroll-left');
    const btnScrollRight = this.container.querySelector('.btn-scroll-right');
    const btnReset = this.container.querySelector('.btn-reset');

    if (btnZoomOut) btnZoomOut.addEventListener('click', (e) => { e.stopPropagation(); this.zoomOut(); });
    if (btnZoomIn) btnZoomIn.addEventListener('click', (e) => { e.stopPropagation(); this.zoomIn(); });
    if (btnScrollLeft) btnScrollLeft.addEventListener('click', (e) => { e.stopPropagation(); this.scrollLeft(); });
    if (btnScrollRight) btnScrollRight.addEventListener('click', (e) => { e.stopPropagation(); this.scrollRight(); });
    if (btnReset) btnReset.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.syncCtrl && window.syncCtrl.syncEnabled) {
        window.syncCtrl.resetAllCharts();
      } else {
        this.resetView();
      }
    });
  }

  resetView() {
    this.chart.priceScale('right').applyOptions({ autoScale: true });
    this.chart.timeScale().resetTimeScale();
    if (this.bars && this.bars.length > 0) {
      const lastIdx = this.bars.length - 1;
      this.chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, lastIdx - 75),
        to: lastIdx + 10
      });
    } else {
      try { this.chart.timeScale().scrollToRealTime(); } catch(e) {}
    }
    this.renderDrawings();
  }

  setRange(rangeStr) {
    if (!this.bars || !this.bars.length) return;
    const lastBar = this.bars[this.bars.length - 1];
    const now = lastBar.time;
    let fromTime = 0;

    switch (rangeStr) {
      case '1D':
        fromTime = now - 86400;
        break;
      case '5D':
        fromTime = now - 5 * 86400;
        break;
      case '1M':
        fromTime = now - 30 * 86400;
        break;
      case '3M':
        fromTime = now - 90 * 86400;
        break;
      case '6M':
        fromTime = now - 180 * 86400;
        break;
      case 'YTD': {
        const d = new Date(now * 1000);
        fromTime = Math.floor(new Date(d.getFullYear(), 0, 1).getTime() / 1000);
        break;
      }
      case '1Y':
        fromTime = now - 365 * 86400;
        break;
      case '5Y':
        fromTime = now - 5 * 365 * 86400;
        break;
      case 'ALL':
        this.chart.timeScale().fitContent();
        return;
      default:
        fromTime = now - 86400;
    }

    const firstIdx = this.bars.findIndex(b => b.time >= fromTime);
    if (firstIdx !== -1) {
      const lastIdx = this.bars.length - 1;
      this.chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, firstIdx - 2),
        to: lastIdx + 5
      });
    } else {
      this.chart.timeScale().fitContent();
    }
  }

  goToDate(targetTimeSec) {
    if (!this.bars || !this.bars.length) return;
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < this.bars.length; i++) {
      const diff = Math.abs(this.bars[i].time - targetTimeSec);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    this.chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, closestIdx - 35),
      to: closestIdx + 35
    });
  }

  zoomIn() {
    const range = this.chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const span = range.to - range.from;
    const newSpan = span * 0.8;
    const center = (range.from + range.to) / 2;
    this.chart.timeScale().setVisibleLogicalRange({ from: center - newSpan / 2, to: center + newSpan / 2 });
  }

  zoomOut() {
    const range = this.chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const span = range.to - range.from;
    const newSpan = span * 1.25;
    const center = (range.from + range.to) / 2;
    this.chart.timeScale().setVisibleLogicalRange({ from: center - newSpan / 2, to: center + newSpan / 2 });
  }

  scrollLeft() {
    const range = this.chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const shift = (range.to - range.from) * 0.25;
    this.chart.timeScale().setVisibleLogicalRange({ from: range.from - shift, to: range.to - shift });
  }

  scrollRight() {
    const range = this.chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const shift = (range.to - range.from) * 0.25;
    this.chart.timeScale().setVisibleLogicalRange({ from: range.from + shift, to: range.to + shift });
  }

  // LEGEND
  initLegendListener() {
    this.chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        if (this.bars.length > 0) {
          this.updateLegend(this.bars[this.bars.length - 1]);
        }
        return;
      }
      const barData = param.seriesData.get(this.series);
      if (barData) {
        this.updateLegend(barData);
      }
    });
  }

  updateLegend(bar) {
    const legendEl = this.container.querySelector('.chart-legend');
    if (!legendEl) return;
    if (!bar) { legendEl.textContent = this.symbol + ' · Chưa có dữ liệu'; return; }

    const diff = bar.close - bar.open;
    const diffPct = (diff / bar.open) * 100;
    const isUp = diff >= 0;
    const diffStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} (${diffPct.toFixed(2)}%)`;

    legendEl.innerHTML = `
      <span class="legend-symbol">${this.symbol} · ${this.currentTimeframe} · ${this.sessionMode || 'ETH'}</span>
      <span class="legend-ohlc">
        <span class="legend-title">O</span><span>${bar.open.toFixed(2)}</span>
        <span class="legend-title">H</span><span>${bar.high.toFixed(2)}</span>
        <span class="legend-title">L</span><span>${bar.low.toFixed(2)}</span>
        <span class="legend-title">C</span><span>${bar.close.toFixed(2)}</span>
        <span class="${isUp ? 'price-up' : 'price-down'}">${diffStr}</span>
      </span>
    `;
  }

  // MAGNET HELPER (SNAP TO CANDLE OHLC)
  snapToOHLC(time, price) {
    if (!this.bars || !this.bars.length) return price;
    // Find closest bar to time
    let closestBar = null;
    let minDiff = Infinity;
    for (const b of this.bars) {
      const d = Math.abs(b.time - time);
      if (d < minDiff) {
        minDiff = d;
        closestBar = b;
      }
    }
    if (!closestBar) return price;

    const candidates = [closestBar.open, closestBar.high, closestBar.low, closestBar.close];
    let closestPrice = price;
    let minPriceDiff = Infinity;
    for (const c of candidates) {
      const pd = Math.abs(c - price);
      if (pd < minPriceDiff) {
        minPriceDiff = pd;
        closestPrice = c;
      }
    }
    return closestPrice;
  }

  // DRAWINGS RENDERING
  renderDrawings() {
    if (!this.overlayCtx) return;
    const ctx = this.overlayCtx;
    const rect = this.container.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 1. Render Active Paper Positions (Entry line + Live PnL)
    if (this.positions && this.positions.length) {
      const currentPrice = this.bars.length ? this.bars[this.bars.length - 1].close : 0;
      for (const pos of this.positions) {
        const y = this.series.priceToCoordinate(pos.price);
        if (y !== null && y >= 0 && y <= rect.height) {
          const isBuy = pos.type === 'buy';
          const pnlPoints = isBuy ? (currentPrice - pos.price) : (pos.price - currentPrice);
          const pnlUsd = (pnlPoints * pos.pointValue * pos.qty).toFixed(2);
          const isProfit = pnlPoints >= 0;

          // Dashed Position line
          ctx.strokeStyle = isBuy ? '#2962ff' : '#f23645';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(rect.width - 55, y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Position Badge
          ctx.fillStyle = isBuy ? '#2962ff' : '#f23645';
          ctx.fillRect(8, y - 10, 85, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`${pos.type.toUpperCase()} ${pos.qty} @ ${pos.price.toFixed(2)}`, 12, y + 4);

          // PnL Badge
          ctx.fillStyle = isProfit ? '#089981' : '#f23645';
          ctx.fillRect(98, y - 10, 80, 20);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${isProfit ? '+' : ''}$${pnlUsd}`, 103, y + 4);
        }
      }
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, Math.max(0, rect.width - 65), Math.max(0, rect.height - (this.paneHeight||0) - 26)); ctx.clip();
    const drawings = [...(this.indicatorDrawings || []), ...(this.drawingsHidden ? [] : this.drawings || [])];
    for (const original of drawings) {
      const value = this.drawingPreview && original.id && this.drawingPreview.id === original.id ? this.drawingPreview : original;
      DrawingModel.draw(ctx, this, value);
    }
    window.drawingMgr?.editor.renderHandles(this, ctx);
    ctx.restore();
  }

  // COORDINATE HELPERS FOR DRAWING MANAGER
  coordinateToPrice(y) {
    if(y<0||y>this.plotHeight-26)return null;
    return this.series.coordinateToPrice(y);
  }

  coordinateToTime(x) {
    return DrawingModel.timeAt(this, this.chart.timeScale().coordinateToLogical(x));
  }

  priceToCoordinate(price) {
    return this.series.priceToCoordinate(price);
  }

  timeToCoordinate(time) {
    return this.chart.timeScale().timeToCoordinate(time);
  }
}
