class IndicatorRunner {
  constructor(chart, getContext, onStatus) {
    this.chart = chart;
    this.getContext = getContext;
    this.onStatus = onStatus;
    this.revision = 0;
    this.busy = false;
  }

  load(code, settings = {}, view = {}) {
    this.stop();
    this.chart.clearCustomSeries();
    this.code = code;
    this.lastResult=null;
    this.settings = settings;
    this.view=view;
    this.workerBarsState=null;
    this.runtime=/^\s*(?:\/\/\s*@version|indicator\s*\()/m.test(code)?'pine6':'js';
    // Panning and zooming emit many viewport events. Preserve viewport-aware
    // scripts, but do not rerun indicators that cannot observe those changes.
    this.usesViewport=/\b(?:context\s*\.\s*)?viewport\b/.test(code);
    // Market caches can contain several deep OHLC histories. Transfer them to
    // the Worker only when source code can consume a peer/market series.
    this.usesMarkets=/\b(?:markets|peerBars)\b/.test(code);
    this.usesClock=/\btimenow\b/.test(code);
    if (!code.trim()) { this.onStatus('Chưa có indicator'); return; }
    this.onStatus('Đang nạp script…');
    const worker = new Worker('js/indicator_worker.js');
    this.worker = worker;
    const initBudget=this.runtime==='pine6'?20000:4000;
    this.timeout = setTimeout(() => this.fail(`Script khởi tạo quá ${initBudget/1000} giây; đã dừng, code vẫn được lưu.`), initBudget);
    worker.onmessage = ({ data }) => {
      if (this.worker !== worker) return;
      clearTimeout(this.timeout);
      if (data.type === 'error') { this.fail(data.error); return; }
      if(data.type==='data_required'){
        this.busy=false;
        if(data.id!==this.revision)return;
        const scope=[this.chart.symbol,this.chart.currentTimeframe,this.chart.sessionMode,!!this.chart.replayMode].join('|');
        if(scope!==this.runScope){this.pending=false;this.schedule();return;}
        this.pending=false;this.dataRequirement=data.requirement;this.dataRequirementScope=scope;this.lastDispatchKey=null;
        this.onStatus(data.error);this.chart.onIndicatorDataRequired?.(data.requirement);return;
      }
      if (data.type === 'ready') {
        this.name=data.name; this.defaults=data.defaults; this.inputs=data.inputs||[];this.runtime=data.runtime||'js';
        this.usesViewport=typeof data.usesViewport==='boolean'?data.usesViewport:this.usesViewport;
        this.usesMarkets=typeof data.usesMarkets==='boolean'?data.usesMarkets:this.usesMarkets;
        this.chart.setIndicatorLegend?.(data.name);
        this.settings = { ...data.defaults, ...this.settings };
        this.ready = true;
        this.initElapsed=data.initElapsed;
        this.onStatus('Đã nạp · đang chờ/tính dữ liệu…');
        this.schedule();
        // Pine's timenow is a live value. Keep that behavior isolated to the
        // scripts that actually reference it so ordinary indicators stay idle.
        if(this.usesClock&&typeof setInterval==='function')this.clockTimer=setInterval(()=>this.schedule(),1000);
        return;
      }
      this.busy = false;
      const scope=[this.chart.symbol,this.chart.currentTimeframe,this.chart.sessionMode,!!this.chart.replayMode].join('|');
      if (data.id === this.revision&&this.runScope===scope&&(!this.chart.replayMode||this.runEndTime<=this.chart.bars.at(-1)?.time)) {
        try {
          this.validate(data.result);
          const renderStart=Date.now();this.lastResult=data.result;this.applyView();const renderElapsed=Date.now()-renderStart;
          if(data.result.name){this.name=data.result.name;this.chart.setIndicatorLegend?.(this.name);}
          this.onStatus(`${this.runtime==='pine6'?'Pine v6 · ':''}${data.elapsed.toFixed(0)} ms tính${data.result.cached?' cache':''} · ${renderElapsed} ms gửi vẽ · ${data.barsCount??this.chart.bars.length} nến${data.result.warnings?.length ? ' · '+data.result.warnings.join('; ') : ''}`);
        } catch (error) { this.fail(error.message); return; }
      }
      if (this.pending) { this.pending = false; this.schedule(); }
    };
    worker.onerror = error => this.fail(error.message || 'Indicator worker bị lỗi');
    worker.postMessage({ type: 'init', code });
  }

  applyView() {
    if(!this.lastResult)return;
    const result=this.lastResult,v=this.view||{},visible=v.hidden!==true&&v.visibility?.[this.chart.currentTimeframe]!==false;
    if(!this.chart.indicatorStack&&this.chart.container?.dataset)this.chart.container.dataset.indicatorHidden=String(!!v.hidden);
    this.chart.applyIndicatorResult({...result,
      drawings:visible&&v.overlay!==false?result.drawings:[],
      paints:visible&&v.overlay!==false?result.paints:[],
      pane:visible&&v.pane!==false?result.pane:null,
      tables:visible&&v.tables!==false?(result.tables||[]).filter(t=>v.pane!==false||!t.pane):[],
      series:visible?result.series:[],candleColors:visible&&v.candleColors!==false?result.candleColors:[]});
  }

  schedule(options = {}) {
    if (!this.worker || !this.ready) return;
    if (options.viewport && !this.usesViewport) return;
    if(this.debounce)return;
    this.debounce = setTimeout(() => {this.debounce=null;this.run();}, 100);
  }

  run() {
    if (!this.worker || !this.ready) return;
    if (this.busy) { this.pending = true; return; }
    if(this.dataRequirement){
      const scope=[this.chart.symbol,this.chart.currentTimeframe,this.chart.sessionMode,!!this.chart.replayMode].join('|');
      if(scope!==this.dataRequirementScope)this.dataRequirement=null;
    }
    if(this.dataRequirement){
      const {symbol,timeframe}=this.dataRequirement;
      const available=this.getContext({markets:true,viewport:false})?.markets?.[symbol]?.[timeframe];
      if(!available?.length)return;
      this.dataRequirement=null;this.lastDispatchKey=null;
    }
    if (!this.chart.bars.length) { this.onStatus('Đang chờ dữ liệu'); return; }
    const bars=this.chart.bars,tail=bars.at(-1),visibleRange=this.usesViewport?this.chart.chart.timeScale().getVisibleRange():null;
    const dataRevision=Number.isFinite(this.chart.dataRevision)?this.chart.dataRevision:`${bars.length}:${tail?.time}:${tail?.open}:${tail?.high}:${tail?.low}:${tail?.close}:${tail?.volume}`;
    const dispatchKey=JSON.stringify([dataRevision,this.chart.symbol,this.chart.currentTimeframe,this.chart.sessionMode,!!this.chart.replayMode,this.settings,visibleRange,this.usesClock?Math.floor(Date.now()/1000):null]);
    if(dispatchKey===this.lastDispatchKey)return;
    this.lastDispatchKey=dispatchKey;this.busy = true;
    this.revision++;this.runScope=[this.chart.symbol,this.chart.currentTimeframe,this.chart.sessionMode,!!this.chart.replayMode].join('|');this.runEndTime=this.chart.bars.at(-1).time;
    const runBudget=this.runtime==='pine6'?25000:4000;
    this.timeout = setTimeout(() => this.fail(`Tính indicator quá ${runBudget/1000} giây; đã dừng. Script vẫn được lưu.`), runBudget);
    const supplied=this.getContext({markets:this.usesMarkets,viewport:this.usesViewport})||{};
    const {markets,viewport:contextViewport,...shared}=supplied;
    const context = { ...shared, ...(this.usesMarkets?{markets}:{}), ...(this.usesViewport?{viewport:contextViewport}:{}), settings: this.settings, symbol: this.chart.symbol, timeframe: this.chart.currentTimeframe, metadata: this.chart.metadata,
      timeframeSeconds: this.chart.tfSeconds, now: this.chart.replayMode?this.chart.replayClock:Date.now()/1000, dataRevision, sessionMode:this.chart.sessionMode || 'ETH', replay:!!this.chart.replayMode };
    const currentBars=this.chart.bars;
    const state=this.workerBarsState;
    let barsPayload;
    if(!state) barsPayload={mode:'replace',values:currentBars};
    else if(state.revision===dataRevision) barsPayload={mode:'keep'};
    else if(this.chart.dataUpdateKind==='tail'&&state.firstTime===currentBars[0]?.time&&currentBars.length>=state.length){
      const start=Math.max(0,state.length-1);barsPayload={mode:'tail',start,values:currentBars.slice(start)};
    } else barsPayload={mode:'replace',values:currentBars};
    this.workerBarsState={revision:dataRevision,length:currentBars.length,firstTime:currentBars[0]?.time};
    this.worker.postMessage({ type: 'run', id: this.revision, bars:barsPayload, context });
  }

  validate(result) {
    const allSeries=[...(result.series||[]),...(result.pane?.series||[])];
    if (allSeries.length > 30 || (result.drawings?.length || 0) > 2000) throw new Error('Indicator vượt giới hạn 30 series / 2000 hình.');
    if(allSeries.reduce((n,s)=>n+(s.data?.length||0),0)>300000)throw Error('Indicator vượt giới hạn 300.000 plot points.');
    for (const series of allSeries) {
      const type=series.type||'line';
      if (!['line', 'histogram','area','candle','bar'].includes(type) || !Array.isArray(series.data)) throw new Error('Series chưa hỗ trợ hoặc dữ liệu không hợp lệ.');
      let previous = -Infinity;
      for (const point of series.data) {
        const validValue=(type==='candle'||type==='bar')?(point.open===undefined||['open','high','low','close'].every(k=>Number.isFinite(point[k]))):(point.value===undefined||Number.isFinite(point.value));
        if (!Number.isFinite(point.time) || point.time <= previous || !validValue) throw new Error('Series phải có time tăng dần và value hữu hạn.');
        previous = point.time;
      }
    }
    if (result.pane && (!Number.isFinite(result.pane.min) || !Number.isFinite(result.pane.max) || result.pane.max <= result.pane.min || !Array.isArray(result.pane.drawings) || result.pane.drawings.length > 2000)) throw new Error('Pane indicator không hợp lệ.');
    if(result.candleColors && (!Array.isArray(result.candleColors) || result.candleColors.some(x=>!Number.isFinite(x.time)||typeof x.color!=='string'))) throw new Error('Màu nến indicator không hợp lệ.');
    for (const drawing of [...(result.drawings || []), ...(result.pane?.drawings || [])]) {
      if (!['line', 'box', 'hline', 'text', 'fib', 'position', 'measure'].includes(drawing.type) || !drawing.p1 || !Number.isFinite(drawing.p1.time) || !Number.isFinite(drawing.p1.price)) throw new Error('Hình indicator không hợp lệ.');
      if (drawing.type !== 'text' && drawing.type !== 'hline' && (!drawing.p2 || !Number.isFinite(drawing.p2.time) || !Number.isFinite(drawing.p2.price))) throw new Error('Hình thiếu điểm kết thúc.');
    }
    if ((result.tables?.length || 0) > 10 || (result.tables || []).some(t => !Array.isArray(t.rows) || t.rows.length > 100 || t.rows.some(row => !Array.isArray(row) || row.length > 30))) throw new Error('Bảng indicator không hợp lệ.');
    for(const descriptor of [result,result.pane].filter(Boolean)){
      if((descriptor.paints?.length||0)>100)throw Error('Quá nhiều Pine paint layers.');
      if((descriptor.paints||[]).reduce((n,p)=>n+(p.data?.length||0)+(p.top?.length||0)+(p.bottom?.length||0)+(p.points?.length||0),0)>200000)throw Error('Pine paint vượt 200.000 points.');
      for(const paint of descriptor.paints||[]){
        if(!['background','fill','shape','quad','polyline'].includes(paint.type))throw Error('Pine paint type chưa hỗ trợ.');
        for(const values of [paint.data,paint.top,paint.bottom].filter(Boolean))if(!Array.isArray(values)||values.length>100000||values.some(p=>!Number.isFinite(p.time)))throw Error('Pine paint points không hợp lệ.');
        if(paint.points&&(!Array.isArray(paint.points)||paint.points.length>50000||paint.points.some(p=>!Number.isFinite(p.time)||!Number.isFinite(p.price))))throw Error('Pine paint polygon không hợp lệ.');
      }
    }
  }

  fail(message) {
    this.stop();
    this.onStatus(`Lỗi: ${message}`);
  }

  stop() {
    clearTimeout(this.timeout);
    clearTimeout(this.debounce);
    if(typeof clearInterval==='function')clearInterval(this.clockTimer);
    this.clockTimer=null;
    this.debounce=null;
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.busy = false;
    this.pending = false;
    // A new worker must always receive an initial calculation, even if the
    // chart happens to be in the exact same state as the previous worker.
    this.lastDispatchKey = null;
    this.workerBarsState = null;
    this.dataRequirement = null;
    this.revision++;
  }
}
