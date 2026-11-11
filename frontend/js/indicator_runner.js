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
    if (!code.trim()) { this.onStatus('Chưa có indicator'); return; }
    this.onStatus('Đang nạp script…');
    const worker = new Worker('js/indicator_worker.js');
    this.worker = worker;
    this.timeout = setTimeout(() => this.fail('Script khởi tạo quá 4 giây; đã dừng để giữ giao diện hoạt động.'), 4000);
    worker.onmessage = ({ data }) => {
      if (this.worker !== worker) return;
      clearTimeout(this.timeout);
      if (data.type === 'error') { this.fail(data.error); return; }
      if (data.type === 'ready') {
        this.name=data.name; this.defaults=data.defaults; this.inputs=data.inputs||[];
        this.chart.setIndicatorLegend?.(data.name);
        this.settings = { ...data.defaults, ...this.settings };
        this.ready = true;
        this.schedule();
        return;
      }
      this.busy = false;
      if (data.id === this.revision) {
        try {
          this.validate(data.result);
          this.lastResult=data.result;this.applyView();
          this.onStatus(`${data.elapsed.toFixed(0)} ms · ${this.chart.bars.length} nến${data.result.warnings?.length ? ' · '+data.result.warnings.join('; ') : ''}`);
        } catch (error) { this.fail(error.message); return; }
      }
      if (this.pending) { this.pending = false; this.schedule(); }
    };
    worker.onerror = error => this.fail(error.message || 'Indicator worker bị lỗi');
    worker.postMessage({ type: 'init', code });
  }

  applyView() {
    if(!this.lastResult)return;
    const result=this.lastResult,v=this.view||{},visible=v.visibility?.[this.chart.currentTimeframe]!==false;
    this.chart.applyIndicatorResult({...result,
      drawings:visible&&v.overlay!==false?result.drawings:[],
      pane:visible&&v.pane!==false?result.pane:null,
      tables:visible&&v.tables!==false?(result.tables||[]).filter(t=>v.pane!==false||!t.pane):[],
      series:visible?result.series:[],candleColors:visible&&v.candleColors!==false?result.candleColors:[]});
  }

  schedule() {
    if (!this.worker || !this.ready) return;
    this.revision++;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.run(), 100);
  }

  run() {
    if (!this.worker || !this.ready) return;
    if (this.busy) { this.pending = true; return; }
    if (!this.chart.bars.length) { this.onStatus('Đang chờ dữ liệu'); return; }
    this.busy = true;
    this.timeout = setTimeout(() => this.fail('Tính indicator quá 4 giây; đã dừng. Script vẫn được lưu.'), 4000);
    const context = { ...this.getContext(), settings: this.settings, symbol: this.chart.symbol, timeframe: this.chart.currentTimeframe, metadata: this.chart.metadata,
      timeframeSeconds: this.chart.tfSeconds, now: Date.now()/1000, sessionMode:this.chart.sessionMode, replay:!!this.chart.replayMode };
    this.worker.postMessage({ type: 'run', id: this.revision, bars: this.chart.bars, context });
  }

  validate(result) {
    if ((result.series?.length || 0) > 30 || (result.drawings?.length || 0) > 2000) throw new Error('Indicator vượt giới hạn 30 series / 2000 hình.');
    for (const series of result.series || []) {
      if (!['line', 'histogram'].includes(series.type || 'line') || !Array.isArray(series.data)) throw new Error('Series chưa hỗ trợ hoặc dữ liệu không hợp lệ.');
      let previous = -Infinity;
      for (const point of series.data) {
        if (!Number.isFinite(point.time) || point.time <= previous || !Number.isFinite(point.value)) throw new Error('Series phải có time tăng dần và value hữu hạn.');
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
  }

  fail(message) {
    this.stop();
    this.onStatus(`Lỗi: ${message}`);
  }

  stop() {
    clearTimeout(this.timeout);
    clearTimeout(this.debounce);
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.busy = false;
    this.pending = false;
    this.revision++;
  }
}
