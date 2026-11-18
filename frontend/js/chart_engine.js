const TF_MAP = MarketData.durations;
const CHART_CLOCK = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false});
const CHART_DATE = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',month:'short',day:'numeric'});
const CHART_DATETIME = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});

class ChartEngine {
  static rebaseRange(oldBars,newBars,range,tfSeconds){
    if(!range||!oldBars.length||!newBars.length)return range;
    if(range.to>=oldBars.length-1){const delta=newBars.length-oldBars.length;return {from:range.from+delta,to:range.to+delta};}
    const before={bars:oldBars,tfSeconds},after={bars:newBars,tfSeconds};
    return {from:DrawingModel.logicalIndex(after,DrawingModel.timeAt(before,range.from)),to:DrawingModel.logicalIndex(after,DrawingModel.timeAt(before,range.to))};
  }
  get plotHeight() { return this.container.clientHeight-(this.paneHeight||0); }
  get plotBottom() {
    return Math.max(0, this.plotHeight - (this.chart?.timeScale().height?.() ?? 26));
  }
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
    this.dataRevision = 0;
    this.dataUpdateKind = 'replace';
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
        attributionLogo:false,
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
        vertLine: { labelVisible: false, color: '#434651', style: LightweightCharts.LineStyle.Dashed, width: 1 },
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
    this.series = this.addSeries('Candlestick',{
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

    this.symbolBadge=document.createElement('img');this.symbolBadge.className='chart-symbol-badge';
    this.symbolBadge.draggable=false;this.updateSymbolBadge();this.container.appendChild(this.symbolBadge);
    this.setupScaleControls();
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(()=>this.applyPriceRatio());
    this.series.attachPrimitive?.({
      paneViews:()=>[{
        zOrder:()=> 'bottom',
        renderer:()=>({draw:target=>target.useMediaCoordinateSpace(({context,mediaSize})=>this.drawEthBackground(context,mediaSize))})
      }]
    });

    // Double click to reset view
    this.container.addEventListener('dblclick', (e) => {
      // Only reset if clicked inside chart area, not on buttons
      if (!e.defaultPrevented && !e.target.closest('button,input,select,.chart-nav-controls,.chart-legend,.indicator-legend,.indicator-pane-header')) {
        this.resetView();
      }
    });
  }

  setupScaleControls(){
    this.scaleControls=document.createElement('div');
    this.scaleControls.className='chart-scale-modes';
    for(const [label,title,option] of [['A','Auto scale','autoScale'],['L','Logarithmic scale','mode']]){
      const button=document.createElement('button');
      button.type='button';
      button.textContent=label;
      button.title=title;
      button.setAttribute('aria-label',title);
      button.onclick=()=>{
        const scale=this.series.priceScale(),options=scale.options();
        scale.applyOptions({[option]:option==='mode'?(options.mode===1?0:1):!options.autoScale});
        this.updateScaleControls();
      };
      this.scaleControls.append(button);
    }
    this.currencyLabel=document.createElement('span');
    this.currencyLabel.className='chart-scale-currency';
    this.pricePlus=document.createElement('button');
    this.pricePlus.type='button';
    this.pricePlus.className='chart-price-plus';
    this.pricePlus.textContent='+';
    this.pricePlus.setAttribute('aria-label','Add alert at cursor price');
    this.pricePlus.hidden=true;
    this.pricePlus.onpointerenter=()=>{this.pointerOnPricePlus=true;};
    this.pricePlus.onpointerleave=()=>{this.pointerOnPricePlus=false;this.pricePlus.hidden=true;};
    this.pricePlus.onclick=()=>this.onPricePlus?.(this.pricePlusValue);
    this.container.append(this.scaleControls,this.currencyLabel,this.pricePlus);
    this.chart.subscribeCrosshairMove(({point})=>{
      if(this.pointerOnPricePlus)return;
      const price=point?this.coordinateToPrice(point.y):null;
      const height=this.plotBottom;
      this.pricePlus.hidden=!this.appearance?.plusButton||!point||!Number.isFinite(price)||point.y>=height;
      if(this.pricePlus.hidden)return;
      const tick=this.metadata?.tickSize;
      this.pricePlusValue=tick>0?Math.round(price/tick)*tick:price;
      this.pricePlus.style.top=Math.max(0,Math.min(height-24,point.y-12))+'px';
    });
  }

  updateScaleControls(){
    if(!this.scaleControls||!this.appearance)return;
    const visibility=this.appearance.scaleModes;
    this.scaleControls.dataset.visibility=visibility||'Hidden';
    this.currencyLabel.dataset.visibility=this.appearance.currencyUnit||'Hidden';
    this.currencyLabel.textContent=this.metadata?.currencyCode||this.metadata?.currency||'USD';
    const options=this.series.priceScale().options();
    this.scaleControls.children[0].setAttribute('aria-pressed',String(options.autoScale));
    this.scaleControls.children[1].setAttribute('aria-pressed',String(options.mode===1));
    if(!this.appearance.plusButton)this.pricePlus.hidden=true;
  }

  applyPriceRatio(){
    const appearance=this.appearance;
    const scale=this.series.priceScale();
    if(!appearance?.priceRatio){
      if(this.priceRatioRestore!==undefined){
        scale.applyOptions({autoScale:this.priceRatioRestore});
        this.priceRatioRestore=undefined;
      }
      return;
    }
    if(!this.bars.length||!scale.setVisibleRange||!scale.getVisibleRange||scale.options().mode!==0)return;
    const spacing=this.chart.timeScale().options().barSpacing;
    const margins=scale.options().scaleMargins;
    const height=(this.plotBottom)*(1-margins.top-margins.bottom);
    if(!(spacing>0&&height>0))return;
    const current=scale.getVisibleRange();
    if(!current)return;
    const span=appearance.priceUnitsPerBar*height/spacing;
    if(!Number.isFinite(span)||span<=0||Math.abs(current.to-current.from-span)/span<.001)return;
    if(this.priceRatioRestore===undefined)this.priceRatioRestore=scale.options().autoScale;
    const middle=(current.from+current.to)/2;
    scale.setVisibleRange({from:middle-span/2,to:middle+span/2});
  }

  drawEthBackground(ctx,size){
    const color=this.appearance?.ethBackground;
    if(!color||color==='transparent'||this.appearance.sessionMode==='RTH'||this.tfSeconds>=86400||!this.metadata?.sessionRegular?.session)return;
    const scale=this.chart.timeScale(),range=scale.getVisibleLogicalRange();
    if(!range)return;
    const step=scale.options().barSpacing;
    ctx.save();
    ctx.fillStyle=color;
    const from=Math.max(0,Math.floor(range.from)),to=Math.min(this.bars.length-1,Math.ceil(range.to));
    for(let i=from;i<=to;i++){
      if(MarketData.inRegularSession(this.bars[i],this.metadata))continue;
      const x=scale.timeToCoordinate(this.bars[i].time);
      if(x!==null)ctx.fillRect(x-step/2,0,step,size.height);
    }
    ctx.restore();
  }

  addSeries(type,options,paneIndex=0) {
    return typeof this.chart.addSeries==='function'?this.chart.addSeries(LightweightCharts[type+'Series'],options,paneIndex):this.chart['add'+type+'Series'](options);
  }

  updateSymbolBadge(){
    if(!this.symbolBadge)return;
    const file={'NQ1!':'nasdaq-100','ES1!':'s-and-p-500','YM1!':'dow-30'}[this.symbol];
    this.symbolBadge.hidden=!file||this.appearance?.logo===false;this.symbolBadge.alt=this.symbol;this.symbolBadge.title=this.symbol;
    if(file)this.symbolBadge.src='assets/symbols/'+file+'.svg';
  }

  positionSymbolBadge(){
    if(!this.symbolBadge)return;
    const rect=this.container.getBoundingClientRect(),size=28;
    const axisInset=(this.chart?.timeScale().height?.()||20)+10;
    let bottom=rect.height-this.plotHeight+axisInset,left=10;
    const overlaps=box=>box&&box.width>0&&box.height>0&&rect.left+left<box.right&&rect.left+left+size>box.left&&rect.bottom-bottom>box.top&&rect.bottom-bottom-size<box.bottom;
    const sidebar=document.getElementById('left-sidebar')?.getBoundingClientRect();
    if(overlaps(sidebar))left=Math.max(left,sidebar.right-rect.left+8);
    for(const selector of ['.bottom-ranges','.bottom-meta']){const lower=document.querySelector(selector)?.getBoundingClientRect();if(overlaps(lower))bottom=Math.max(bottom,rect.bottom-lower.top+6);}
    left=Math.max(4,Math.min(left,rect.width-65-size-4));bottom=Math.min(bottom,Math.max(4,rect.height-size-4));
    if(this.symbolBadge.style.bottom!==bottom+'px')this.symbolBadge.style.bottom=bottom+'px';
    if(this.symbolBadge.style.left!==left+'px')this.symbolBadge.style.left=left+'px';
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
    this.initOverlayScaleSync();

    // Redraw drawings on every scroll / zoom / time range change
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      this.renderDrawings();
      this.renderIndicatorPane();
    });

    this.resizeOverlay();
  }

  initOverlayScaleSync() {
    if(typeof this.series.attachPrimitive!=='function')return;
    // Run after the native chart has applied its current price/time transform.
    // Price-axis drags do not emit visibleLogicalRange changes or crosshair
    // events, so an external canvas cannot stay aligned from those alone.
    // This primitive follows native draw frames; it has no idle RAF loop and
    // never recalculates indicators or changes saved price/time anchors.
    const view={zOrder:()=> 'top',renderer:()=>({draw:()=>{
      this.renderDrawings();
    }})};
    this.overlayScaleSync={paneViews:()=>[view]};
    this.series.attachPrimitive(this.overlayScaleSync);
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
    if(this.indicatorStack&&rect.width>0&&rect.height>0){this.indicatorStack.resize(rect);return;}
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
    // Rendering the active timeframe already emits a data invalidation.
    // For an inactive timeframe, still invalidate request.* consumers once.
    if (this.currentTimeframe === tf) this.renderCurrentTimeframe(false);
    else {
      if(tf==='D'&&this.appearance&&(this.appearance.lastDayChange||this.appearance.prevDayLine!=='Hidden')){
        this.updateLegend(this.bars.at(-1));
        this.renderDrawings();
      }
      this.dataUpdateKind = 'keep'; this.dataRevision++; this.onDataChange?.();
    }
  }

  displaySessionMetadata(tf=this.currentTimeframe){
    const regular=this.metadata?.sessionRegular;
    if(this.appearance?.sessionMode!=='RTH'||!regular?.session||TF_MAP[tf]>=86400)return this.metadata;
    return {...this.metadata,session:regular.session,sessionCorrections:regular.corrections,sessionType:'RTH'};
  }

  getBarsForTimeframe(tf) {
    if(this.appearance?.sessionMode==='RTH'&&this.metadata?.sessionRegular?.session&&TF_MAP[tf]<86400){
      if(this.regularBarsSource!==this.rawBars||!this.regularBarsByTf)this.regularBarsByTf=new Map();
      this.regularBarsSource=this.rawBars;
      if(!this.regularBarsByTf.has(tf)){
        const minutes=this.rawBars.filter(bar=>MarketData.inRegularSession(bar,this.metadata));
        const regular=this.displaySessionMetadata(tf);
        this.regularBarsByTf.set(tf,MarketData.aggregate(minutes,tf,regular));
      }
      return this.regularBarsByTf.get(tf).slice();
    }
    if (tf === '1m') return this.rawBars.map(b => ({ ...b }));
    return (this.htfData[tf] || []).map(b => ({ ...b }));
  }

  renderCurrentTimeframe(reset = true) {
    const previous = this.chart.timeScale().getVisibleLogicalRange();
    const previousBars=this.bars;
    const available = this.getBarsForTimeframe(this.currentTimeframe);
    if(this.replayMode&&Number.isFinite(this.replayClock))this.replayIndex=TerminalTime.closedIndex(available,this.currentTimeframe,this.displaySessionMetadata(),this.replayClock);
    this.bars = this.replayMode ? available.slice(0, this.replayIndex) : available;
    this.renderCandleData();
    if (reset && this.bars.length) this.resetView();
    else if (previous) this.chart.timeScale().setVisibleLogicalRange(ChartEngine.rebaseRange(previousBars,this.bars,previous,this.tfSeconds));
    this.updateLegend(this.bars[this.bars.length - 1]);
    this.container.dataset.empty = this.bars.length ? '' : ui('Không có dữ liệu cho mã/khung này');
    this.renderDrawings();
    this.dataUpdateKind = 'replace';
    this.dataRevision++;this.onDataChange?.();
  }

  renderCandleData(){
    const bars=this.replayPreview?this.getBarsForTimeframe(this.currentTimeframe):this.bars;
    this.series.setData(this.appearance?ChartAppearance.candleData(this,bars):bars);
  }

  setTimeframe(tf) {
    if (!TF_MAP[tf]) return;
    const visible=this.appearance?.keepLeft?this.chart.timeScale().getVisibleRange():null;
    this.currentTimeframe = tf;
    this.tfSeconds = TF_MAP[tf];
    this.renderCurrentTimeframe();
    if(visible&&this.bars.length){const from=this.bars.findIndex(b=>b.time>=visible.from),range=this.chart.timeScale().getVisibleLogicalRange();if(from>=0&&range)this.chart.timeScale().setVisibleLogicalRange({from,to:from+range.to-range.from});}
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
    this.regularBarsByTf=null;
    if (this.replayMode) return;
    if(this.appearance?.sessionMode==='RTH'&&this.metadata?.sessionRegular?.session&&this.tfSeconds<86400){
      this.renderCurrentTimeframe(false);
      return;
    }
    const next = this.getBarsForTimeframe(this.currentTimeframe);
    const last = this.bars[this.bars.length - 1];
    const tail = next[next.length - 1];
    const historical = last && bar.time < last.time;
    this.bars = next;
    if (tail && (!last || tail.time >= last.time) && !historical) this.series.update(this.appearance?ChartAppearance.candleData(this,next.slice(-2)).at(-1):tail);
    else this.series.setData(this.appearance?ChartAppearance.candleData(this,next):next);
    this.updateLegend(tail);
    this.renderDrawings();
    this.dataUpdateKind=historical?'replace':'tail';
    this.dataRevision++;this.onDataChange?.();
  }

  clearData() {
    this.updateSymbolBadge();
    this.rawBars = [];
    this.bars = [];
    this.htfData = {};
    this.htfBaselines = {};
    this.replayMode = false;
    this.series.setData([]);
    this.dataUpdateKind = 'replace';
    this.dataRevision++;
    this.container.querySelector('.chart-legend').textContent = this.symbol;
    this.renderDrawings();
  }

  clearCustomSeries() {
    if(this.pinePaintPrimitive){this.series.detachPrimitive(this.pinePaintPrimitive);this.pinePaintPrimitive=null;this.pinePaintUpdate=null;}
    this.indicatorPaints=[];
    for (const series of this.customSeries) this.chart.removeSeries(series);
    this.customSeries = [];
    this.indicatorDrawings = [];
    const hadCandleColors=!!this.indicatorCandleColors?.size;
    this.indicatorCandleColors=new Map();
    if(hadCandleColors)this.series.setData(this.appearance?ChartAppearance.candleData(this,this.bars):this.bars);
    this.indicatorPane = null;
    this.paneCanvas?.remove(); this.paneCanvas=null;
    this.paneHeader?.remove();this.paneHeader=null;this.paneSeparator?.remove();this.paneSeparator=null;
    this.indicatorLegend?.remove();this.indicatorLegend=null;
    this.indicatorTables?.replaceChildren();
    this.resize();
  }

  applyIndicatorResult(result) {
    this.indicatorPaints=result.paints||[];
    if(this.indicatorPaints.length&&!this.pinePaintPrimitive&&typeof this.series.attachPrimitive==='function'){
      this.pinePaintPrimitive={attached:({requestUpdate})=>{this.pinePaintUpdate=requestUpdate;},paneViews:()=>[{zOrder:()=> 'bottom',renderer:()=>({draw:target=>target.useMediaCoordinateSpace(scope=>PinePainter.draw(scope.context,this,{paints:this.indicatorPaints},scope.mediaSize.width+65,scope.mediaSize.height))})}]};
      this.series.attachPrimitive(this.pinePaintPrimitive);
    }
    this.pinePaintUpdate?.();
    // Keep series instances across ticks; rebuilding them also resets scale state.
    const descriptors=result.series || [];
    if(this.customSeries.length!==descriptors.length || this.customSeries.some((s,i)=>s._indicatorType!==(descriptors[i].type||'line'))) {
      for(const series of this.customSeries)this.chart.removeSeries(series);
      this.customSeries=[];
    }
    descriptors.forEach((descriptor,i) => {
      const kind=descriptor.type||'line';
      const options = (kind==='candle'||kind==='bar')
        ? { title: descriptor.title || '', priceLineVisible: false, lastValueVisible: false }
        : { color: descriptor.color || '#2962ff', lineWidth: Math.max(1, Math.min(4, Math.round(descriptor.width || 1))),
            title: descriptor.title || '', priceLineVisible: false, lastValueVisible: false,
            lineStyle:descriptor.lineStyle==='dashed'?2:descriptor.lineStyle==='dotted'?1:0,lineType:descriptor.step?1:0,
            ...(descriptor.markersOnly?{lineVisible:false,pointMarkersVisible:true,pointMarkersRadius:Math.max(2,Math.round(descriptor.width||2))}:{}) };
      if(kind==='area')Object.assign(options,{lineColor:options.color,topColor:options.color,bottomColor:'transparent'});
      const seriesType=kind==='histogram'?'Histogram':kind==='area'?'Area':kind==='candle'?'Candlestick':kind==='bar'?'Bar':'Line';
      const series = this.customSeries[i] || this.addSeries(seriesType,options);
      series._indicatorType=kind; series.applyOptions({...options,lastValueVisible:this.appearance?.indicatorValues==='Value'});
      series.setData(descriptor.data);
      this.customSeries[i]=series;
    });
    this.indicatorDrawings = result.drawings || [];
    if(result.candleColors?.length || this.indicatorCandleColors?.size) {
      this.indicatorCandleColors=new Map((result.candleColors||[]).map(x=>[x.time,x.color]));
      this.series.setData(this.appearance?ChartAppearance.candleData(this,this.bars):this.bars.map(b=>this.indicatorCandleColors.has(b.time)?{...b,color:this.indicatorCandleColors.get(b.time)}:b));
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
    let panel = this.indicatorTables;
    if (!panel) { panel = document.createElement('div'); panel.className = 'indicator-tables'; this.indicatorTables=panel;this.container.appendChild(panel); }
    panel.replaceChildren();
    const groups=new Map();
    for (const descriptor of result.tables || []) {
      const position=String(descriptor.position||'Top Right').toLowerCase().replaceAll('_',' '),key=position+':'+!!descriptor.pane+':'+(descriptor.paneId||'');
      if(!groups.has(key)) {
        const group=document.createElement('div');group.className='indicator-table-group';
        if(descriptor.pane) {group.classList.add('pane-table-group');group.style.maxHeight='calc(var(--indicator-pane-height, 70px) - 30px)';group.style.overflow='auto';group.style.pointerEvents='auto';}
        group.style[position.includes('left')?'left':'right']=position.includes('left')?'6px':'76px';
        if(position.includes('bottom'))group.style.bottom=descriptor.pane?'4px':'calc(var(--indicator-pane-height, 0px) + 30px)';
        else group.style.top=position.includes('middle')?'40%':descriptor.pane?'calc(100% - var(--indicator-pane-height, 0px) + 26px)':'6px';
        const host=this.indicatorStack?.hosts.get(descriptor.paneId);
        if(descriptor.pane&&host){const bottom=parseFloat(host.paneCanvas?.style.bottom)||0,height=host.paneHeight||70;group.style.maxHeight=Math.max(0,height-28)+'px';group.style.top='auto';group.style.bottom=position.includes('bottom')?(bottom+4)+'px':'auto';if(!position.includes('bottom'))group.style.top=(this.container.clientHeight-bottom-height+26)+'px';}
        panel.appendChild(group);groups.set(key,group);
      }
      const table = document.createElement('table');
      if (descriptor.bgcolor) table.style.background = descriptor.bgcolor;
      if (descriptor.frameWidth && descriptor.frameColor) table.style.border = `${descriptor.frameWidth}px solid ${descriptor.frameColor}`;
      if (descriptor.title) { const caption = table.createCaption(); caption.textContent = descriptor.title; }
      for (const row of descriptor.rows || []) {
        const tr = table.insertRow();
        for (const value of row) { const td = tr.insertCell(); td.textContent = String(value && typeof value==='object' ? value.text??'' : value??''); if(value?.color)td.style.color=value.color;if(value?.background)td.style.background=value.background;if(value?.align)td.style.textAlign=value.align;if(value?.size)td.style.fontSize=Math.max(8,Math.min(72,value.size))+'px';if(value?.bold)td.style.fontWeight='700';if(value?.italic)td.style.fontStyle='italic';if(value?.fontFamily==='monospace')td.style.fontFamily='Consolas, "Courier New", monospace';if(descriptor.borderWidth===0)td.style.border='none';else if(descriptor.borderColor)td.style.borderColor=descriptor.borderColor; }
      }
      for(const merge of (descriptor.merges||[]).slice(0,3000)){if(![merge.startRow,merge.endRow,merge.startCol,merge.endCol].every(Number.isInteger)||merge.startRow<0||merge.startCol<0||merge.endRow<merge.startRow||merge.endCol<merge.startCol||merge.endRow>=table.rows.length||merge.endCol>=30)continue;const cell=table.rows[merge.startRow]?.cells[merge.startCol];if(!cell)continue;cell.colSpan=merge.endCol-merge.startCol+1;cell.rowSpan=merge.endRow-merge.startRow+1;for(let r=merge.startRow;r<=merge.endRow;r++)for(let c=merge.startCol;c<=merge.endCol;c++)if(r!==merge.startRow||c!==merge.startCol){const covered=table.rows[r]?.cells[c];if(covered)covered.hidden=true;}}
      groups.get(key).appendChild(table);
    }
    this.renderDrawings();
    if(hadPane!==!!this.indicatorPane)this.resize();else this.renderIndicatorPane();
  }

  renderIndicatorPane() {
    if(this.indicatorStack){this.indicatorStack.redraw();return;}
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
    if(pane.series?.length||pane.paints?.length)PinePainter.draw(ctx,adapter,pane,width,height);
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
      const eye=document.createElement('button');eye.type='button';eye.className='indicator-eye';eye.textContent='◉';eye.title='Hide / show indicator';eye.setAttribute('aria-label','Hide or show indicator');eye.onclick=e=>{e.stopPropagation();this.onIndicatorToggle?.();};legend.insertBefore(eye,settings);
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
    const controls = [
      ['.btn-zoom-out', () => this.zoomOut()],
      ['.btn-zoom-in', () => this.zoomIn()],
      ['.btn-scroll-left', () => this.scrollLeft()],
      ['.btn-scroll-right', () => this.scrollRight()],
      ['.btn-reset', () => this.resetView()]
    ];
    for (const [selector, action] of controls) {
      this.container.querySelector(selector)?.addEventListener('click', event => {
        event.stopPropagation();
        if (window.syncCtrl) window.syncCtrl.runLocalNavigation(this, action);
        else action();
      });
    }
  }

  resetView() {
    this.chart.priceScale('right').applyOptions({ autoScale: true });
    this.updateScaleControls();
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
    const label = document.createElement('span');
    label.className = 'chart-crosshair-time';
    label.hidden = true;
    label.setAttribute('aria-hidden', 'true');
    this.container.append(label);
    const timeScale = this.chart.timeScale();
    this.chart.subscribeCrosshairMove((param) => {
      const axisHeight = timeScale.height();
      label.hidden = !param?.point || !Number.isFinite(param.time) || axisHeight === 0;
      if (!label.hidden) {
        const formatter = this.chart.options().localization.timeFormatter;
        label.textContent = formatter(param.time);
        const half = label.offsetWidth / 2;
        const width = timeScale.width();
        label.style.left = Math.max(half, Math.min(width - half, param.point.x)) + 'px';
        label.style.bottom = Math.max(0, (axisHeight - label.offsetHeight) / 2) + 'px';
      }
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
    const s=this.appearance,precision=s?.precision==='Default'||!s?2:Number(s.precision),format=n=>Number(n).toFixed(precision);
    legendEl.replaceChildren();legendEl.style.color=s?.textColor||this.config.textColor;
    const add=(text,className)=>{const span=document.createElement('span');span.className=className||'';span.textContent=text;legendEl.appendChild(span);};
    if(s?.title!==false){const description=this.metadata?.description||this.symbol;const title=s?.titleMode==='Name'?description:s?.titleMode==='Name and ticker'?description+' · '+this.symbol:this.symbol;add(`${title} · ${this.currentTimeframe}`,'legend-symbol');}
    if(s?.marketStatus&&this.metadata?.session){
      const now=this.replayMode?this.replayClock:Date.now()/1000;
      add(TerminalTime.activeSession(now,this.metadata)?'● Open':'○ Closed','legend-market');
    }
    legendEl.hidden=!legendEl.childElementCount;
    if(!bar)return;
    const index=this.bars.findIndex(b=>b.time===bar.time),previous=this.bars[index-1]?.close??bar.open;
    const diff=bar.close-previous,diffPct=previous?diff/previous*100:0;
    if(s?.chartValues!==false)add(`O ${format(bar.open)}  H ${format(bar.high)}  L ${format(bar.low)}  C ${format(bar.close)}`,'legend-ohlc');
    if(s?.barChange!==false)add(`${diff>=0?'+':''}${format(diff)} (${diffPct.toFixed(2)}%)`,diff>=0?'price-up':'price-down');
    if(s?.volume)add(`Vol ${Number(bar.volume||0).toLocaleString('en-US')}`,'legend-volume');
    const close=s?.lastDayChange?this.previousDayClose(bar.time):null;
    if(Number.isFinite(close)&&close!==0){
      const change=bar.close-close;
      add(`Day ${change>=0?'+':''}${format(change)} (${(100*change/close).toFixed(2)}%)`,change>=0?'price-up':'price-down');
    }
    legendEl.hidden=!legendEl.childElementCount;
  }

  previousDayClose(time){
    const daily=this.htfData.D||[];
    if(!this.metadata?.timezone||this.tfSeconds>86400)return null;
    if(this.currentTimeframe==='D')return daily.findLast(bar=>bar.time<time)?.close;
    const start=MarketData.bucket(time,'D',this.metadata);
    const date=MarketData.parts(start,this.metadata.timezone);
    const session=(this.metadata.session||'').match(/^(\d{4})-(\d{4})/);
    const overnight=session&&session[1]>=session[2]?1:0;
    const cutoff=Date.UTC(date.year,date.month-1,date.day+overnight)/1000;
    return daily.findLast(bar=>bar.time<cutoff)?.close;
  }

  updateCountdown(){
    const a=this.appearance,visible=a?.symbolLine?.toLowerCase().includes('value')??true;
    const showName=a?.symbolLine?.toLowerCase().includes('name');
    if((!a?.countdown&&!showName&&a?.symbolValueMode!=='Raw price')||!visible){this.countdownLabel?.remove();this.countdownLabel=null;return;}
    if(!this.countdownLabel){const el=document.createElement('div');el.className='chart-countdown';el.innerHTML='<span class="axis-price"></span><span class="axis-countdown"></span>';this.container.appendChild(el);this.countdownLabel=el;}
    this.series.applyOptions({lastValueVisible:false});
    const b=this.bars.at(-1),now=this.replayMode?this.replayClock:Date.now()/1000;
    const metadata=this.displaySessionMetadata();
    const raw=metadata.sessionType==='RTH'&&this.appearance?.sessionMode==='RTH'?this.getBarsForTimeframe(this.currentTimeframe):this.currentTimeframe==='1m'?this.rawBars:this.htfData[this.currentTimeframe]||[];
    let lo=0,hi=raw.length;while(lo<hi){const mid=(lo+hi)>>1;if(raw[mid].time<=now)lo=mid+1;else hi=mid;}
    // Read timestamps only for the in-progress interval; Replay price/indicators stay closed-bar only.
    const current=raw[lo-1],session=TerminalTime.activeSession(now,metadata),seconds=current?Math.max(0,Math.ceil(TerminalTime.end({time:current.time},this.currentTimeframe,metadata)-now)):0;
    const label=this.countdownLabel,y=b?this.series.priceToCoordinate(b.close):null;label.hidden=!b||y===null||y<0||y>this.plotBottom;
    if(!b)return;label.querySelector('.axis-price').textContent=(showName?this.symbol+' ':'')+this.series.priceFormatter().format(b.close);
    const timer=label.querySelector('.axis-countdown');timer.hidden=!a.countdown||!session||seconds<=0;timer.textContent=timer.hidden?'':TerminalTime.format(seconds);
    label.style.background=a.symbolLineColor||'#211f1d';label.style.color=TerminalFeatures.contrast(a.symbolLineColor||'#211f1d');
    label.style.fontSize=(a.fontSize ?? 10)+'px';
    this.positionCountdown();
  }
  positionCountdown(){
    const label = this.countdownLabel;
    const bar = this.bars?.at(-1);
    if (!label || !bar) return;
    const y = this.series.priceToCoordinate(bar.close);
    label.hidden = y === null || y < 0 || y > this.plotBottom;
    if (label.hidden) return;
    label.style.width = (this.chart.priceScale('right').width() || 44) + 'px';
    label.style.top = Math.max(0, Math.min(this.plotBottom - label.offsetHeight, y - label.offsetHeight / 2)) + 'px';
  }

  // MAGNET HELPER (SNAP TO CANDLE OHLC)
  snapToBar(time,price,mode='strong',pixel=null) {
    if(!this.bars?.length||!Number.isFinite(time)||!Number.isFinite(price))return {time,price};
    let lo=0,hi=this.bars.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(this.bars[mid].time<time)lo=mid+1;else hi=mid;}
    const next=this.bars[lo],prior=this.bars[Math.max(0,lo-1)];
    const bar=Math.abs(next.time-time)<Math.abs(prior.time-time)?next:prior;
    const y=this.series.priceToCoordinate(price);if(y===null)return {time,price};
    let closest=price,distance=Infinity;
    for(const candidate of [bar.open,bar.high,bar.low,bar.close]){const at=this.series.priceToCoordinate(candidate);if(at===null)continue;const delta=Math.abs(at-y);if(delta<distance){closest=candidate;distance=delta;}}
    if(mode==='weak'){
      const x=pixel?.x??this.chart.timeScale().logicalToCoordinate(DrawingModel.logicalIndex(this,time));
      const barX=this.chart.timeScale().logicalToCoordinate(DrawingModel.logicalIndex(this,bar.time));
      if(x===null||barX===null||Math.hypot(x-barX,distance)>8)return {time,price};
    }
    if(!Number.isFinite(distance))return {time,price};
    return {time:bar.time,price:closest};
  }
  snapToOHLC(time,price){return this.snapToBar(time,price).price;}

  // DRAWINGS RENDERING
  renderDrawings({includePaper=true}={}) {
    this.positionSymbolBadge();
    this.positionCountdown();
    if (!this.overlayCtx) return;
    const ctx = this.overlayCtx;
    const rect = this.container.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    if(this.appearance)ChartAppearance.draw(this,ctx,rect);
    this.alertOverlay?.draw(ctx,rect);
    if(includePaper&&this.paperOverlay)this.paperOverlay.draw(ctx,rect);
    else if(includePaper) {
    // 1. Render Active Paper Positions (Entry line + Live PnL)
    if (this.appearance?.positions!==false && this.positions && this.positions.length) {
      const currentPrice = this.bars.length ? this.bars[this.bars.length - 1].close : 0;
      for (const pos of this.positions) {
        const y = this.series.priceToCoordinate(pos.price);
        if (y !== null && y >= 0 && y <= this.plotBottom) {
          const isBuy = pos.type === 'buy';
          const pnlPoints = isBuy ? (currentPrice - pos.price) : (pos.price - currentPrice);
          const pnlUsd = (pnlPoints * pos.pointValue * pos.qty).toFixed(2);
          const isProfit = pnlPoints >= 0;

          // Dashed Position line
          ctx.strokeStyle = isBuy ? '#2962ff' : '#f23645';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(this.appearance?.extendedLines===false?8:0, y);
          ctx.lineTo(this.appearance?.extendedLines===false?180:rect.width-65, y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Position Badge
          ctx.fillStyle = isBuy ? '#2962ff' : '#f23645';
          const badgeX=this.appearance?.alignment==='Right'?Math.max(8,rect.width-250):8;
          ctx.fillRect(badgeX, y - 10, 85, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`${pos.type.toUpperCase()} ${pos.qty} @ ${pos.price.toFixed(2)}`, badgeX+4, y + 4);

          // PnL Badge
          ctx.fillStyle = isProfit ? '#089981' : '#f23645';
          if(this.appearance?.pnl!==false){ctx.fillRect(badgeX+90, y - 10, 80, 20);
          ctx.fillStyle = '#ffffff';
          const value=this.appearance?.pnlUnit==='Ticks'?`${(pnlPoints/(this.metadata.tickSize||1)).toFixed(1)} ticks`:this.appearance?.pnlUnit==='Percentage'?`${(pnlPoints/pos.price*100).toFixed(2)}%`:`$${pnlUsd}`;
          ctx.fillText(`${isProfit ? '+' : ''}${value}`, badgeX+95, y + 4);}
        }
      }
    }

    if(this.appearance?.positions!==false)for(const order of this.pendingOrders||[]){const y=this.series.priceToCoordinate(order.price);if(y!==null&&y>=0&&y<this.plotBottom){ctx.strokeStyle='#e6a23c';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(this.appearance?.extendedLines===false?180:rect.width-this.chart.priceScale('right').width(),y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#e6a23c';ctx.font='11px Arial';ctx.fillText(`${order.type} ${order.side} ${order.qty} @ ${order.price}`,this.appearance?.alignment==='Right'?Math.max(8,rect.width-250):8,y-5);}}
    }
    ctx.save();
    const rightAxisW = this.chart?.priceScale?.('right')?.width?.() || 65;
    ctx.beginPath(); ctx.rect(0, 0, Math.max(0, rect.width - rightAxisW), Math.max(0, rect.height - (this.paneHeight||0) - 26)); ctx.clip();
    this._qtSsmtDrawn = [];
    this._qtTrBoxes = [];
    this._qtQBoxes = [];
    const drawings = [...(this.indicatorDrawings || []), ...(this.drawingsHidden ? [] : this.drawings || [])];
    for (const original of drawings) {
      const value = this.drawingPreview && original.id && this.drawingPreview.id === original.id ? this.drawingPreview : original;
      DrawingModel.draw(ctx, this, value);
    }
    window.drawingMgr?.editor.renderHandles(this, ctx);
    ctx.restore();
  }

  saveSnapshot(){
    if(!this.overlayCanvas||typeof this.chart.takeScreenshot!=='function')return;
    const screenshot=this.chart.takeScreenshot(true);
    const context=screenshot.getContext('2d');
    if(!context)return;
    const includePaper=this.appearance?.snapshotOrders!==false;
    if(!includePaper)this.renderDrawings({includePaper:false});
    try{
      context.drawImage(this.overlayCanvas,0,0,screenshot.width,screenshot.width*this.container.clientHeight/this.container.clientWidth);
    }finally{
      if(!includePaper)this.renderDrawings();
    }
    screenshot.toBlob(blob=>{
      if(!blob)return;
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;
      link.download=this.symbol+'-'+this.currentTimeframe+'.png';
      link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
  }

  // COORDINATE HELPERS FOR DRAWING MANAGER
  coordinateToPrice(y) {
    if(y<0||y>this.plotBottom)return null;
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
