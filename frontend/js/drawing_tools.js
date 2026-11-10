class DrawingManager {
  constructor() {
    this.activeTool = 'crosshair';
    this.magnetEnabled = false;
    this.drawingsLocked = false;
    this.drawingsHidden = false;
    this.drawingState = null;

    this.undoStacks = new Map();
    this.redoStacks = new Map();
    this.editor = new DrawingEditor(this);
    this.initHotkeys();
  }

  setTool(tool) {
    if (tool === 'lock') {
      this.toggleLock();
      return;
    }

    if (tool === 'eye') {
      this.toggleEye();
      return;
    }

    if (tool === 'trash') {
      if (this.drawingsLocked) {
        if (typeof showToast === 'function') showToast('⚠️ Bản vẽ đang bị khóa!', 'error');
        return;
      }
      if (window.currentActiveChart) {
        window.currentActiveChart.drawings = [];
        window.currentActiveChart.renderDrawings();
        this.saveDrawings(window.currentActiveChart);
        if (typeof showToast === 'function') showToast('🗑 Đã xóa toàn bộ hình vẽ trên chart', 'info');
      }
      return;
    }

    if (tool === 'magnet') {
      this.magnetEnabled = !this.magnetEnabled;
      document.querySelectorAll('.tool-btn[data-tool="magnet"], .ft-btn[data-tool="magnet"]').forEach(btn => {
        btn.classList.toggle('active', this.magnetEnabled);
      });
      if (typeof showToast === 'function') {
        showToast(this.magnetEnabled ? '🧲 Nam châm hút râu nến: BẬT' : '🧲 Nam châm: TẮT', 'info');
      }
      return;
    }

    if (this.drawingState?.chart) {
      this.drawingState.chart.drawings = this.drawingState.chart.drawings.filter(d => !d.isTemp);
      this.drawingState.chart.renderDrawings();
    }
    if (tool !== 'crosshair') this.editor.clear();
    this.activeTool = tool;
    this.drawingState = null;

    document.querySelectorAll('.tool-btn, .ft-btn').forEach(btn => {
      if (btn.dataset.tool === 'magnet' || btn.dataset.tool === 'lock' || btn.dataset.tool === 'eye') return;
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  toggleLock() {
    this.drawingsLocked = !this.drawingsLocked;
    const charts = window.charts || (window.currentActiveChart ? [window.currentActiveChart] : []);
    charts.forEach(c => { c.drawingsLocked = this.drawingsLocked; c.renderDrawings(); });

    document.querySelectorAll('.tool-btn[data-tool="lock"], .ft-btn[data-tool="lock"]').forEach(btn => {
      btn.classList.toggle('active', this.drawingsLocked);
    });
    if (typeof showToast === 'function') {
      showToast(this.drawingsLocked ? '🔒 Đã KHÓA toàn bộ bản vẽ' : '🔓 Đã MỞ KHÓA bản vẽ', 'info');
    }
  }

  toggleEye() {
    this.drawingsHidden = !this.drawingsHidden;
    const charts = window.charts || (window.currentActiveChart ? [window.currentActiveChart] : []);
    charts.forEach(c => {
      c.drawingsHidden = this.drawingsHidden;
      c.renderDrawings();
    });

    document.querySelectorAll('.tool-btn[data-tool="eye"], .ft-btn[data-tool="eye"]').forEach(btn => {
      btn.classList.toggle('active', this.drawingsHidden);
    });
    if (typeof showToast === 'function') {
      showToast(this.drawingsHidden ? '👁 Đã ẨN tất cả bản vẽ' : '👁 Đã HIỆN tất cả bản vẽ', 'info');
    }
  }

  bindChart(chartEngine) {
    const container = chartEngine.container;
    this.editor.bind(chartEngine);
    this.loadDrawings(chartEngine);

    container.addEventListener('click', (e) => {
      if (e.target.closest('button, input, select, .indicator-tables') || this.activeTool === 'crosshair' || this.drawingsLocked) return;
      if (this.drawingState?.chart !== chartEngine) this.drawingState = null;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let time = chartEngine.coordinateToTime(x);
      let price = chartEngine.coordinateToPrice(y);
      if (!time || !price) return;

      if (this.magnetEnabled) {
        price = chartEngine.snapToOHLC(time, price);
      }

      // Horizontal Line: 1-click drop
      if (this.activeTool === 'hline') {
        chartEngine.drawings.push({
          id: 'draw_' + Date.now(),
          type: 'hline',
          p1: { time, price },
          color: '#2962ff'
        });
        this.saveDrawings(chartEngine);
        chartEngine.renderDrawings();
        this.setTool('crosshair');
        return;
      }

      if (this.activeTool === 'text') {
        const note = { ...DrawingModel.defaults('text'), id: crypto.randomUUID(), type: 'text', p1: { time, price }, text: 'Text' };
        chartEngine.drawings.push(note); this.saveDrawings(chartEngine);
        this.setTool('crosshair'); this.editor.select(chartEngine, note); this.editor.open('text');
        return;
      }

      // 2-point tools (line, box, fib, position, measure)
      if (!this.drawingState) {
        this.drawingState = {
          step: 2,
          chart: chartEngine,
          p1: { time, price }
        };
      } else if (this.drawingState.step === 2) {
        const p2 = { time, price };
        const newDrawing = {
          id: 'draw_' + Date.now(),
          type: this.activeTool,
          p1: this.drawingState.p1,
          p2: p2,
          ...DrawingModel.defaults(this.activeTool)
        };

        chartEngine.drawings = chartEngine.drawings.filter(d => !d.isTemp);
        chartEngine.drawings.push(newDrawing);
        this.editor.select(chartEngine, newDrawing);
        this.saveDrawings(chartEngine);

        this.drawingState = null;
        this.setTool('crosshair');
        chartEngine.renderDrawings();
      }
    });

    container.addEventListener('mousemove', (e) => {
      if (!this.drawingState || this.drawingState.chart !== chartEngine || this.drawingState.step !== 2 || this.drawingsLocked) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let time = chartEngine.coordinateToTime(x);
      let price = chartEngine.coordinateToPrice(y);
      if (!time || !price) return;

      if (this.magnetEnabled) {
        price = chartEngine.snapToOHLC(time, price);
      }

      chartEngine.drawings = chartEngine.drawings.filter(d => !d.isTemp);
      chartEngine.drawings.push({
        id: 'temp',
        isTemp: true,
        type: this.activeTool,
        p1: this.drawingState.p1,
        p2: { time, price },
        color: '#2962ff',
        fillColor: 'rgba(41, 98, 255, 0.2)',
        borderColor: '#2962ff'
      });
      chartEngine.renderDrawings();
    });
  }

  initHotkeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      const chart = window.currentActiveChart;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && chart && !this.drawingsLocked) {
        e.preventDefault(); this.historyStep(chart, e.shiftKey); return;
      }
      if (e.key === 'Escape') {
        if (this.drawingState) {
          if (window.currentActiveChart) {
            window.currentActiveChart.drawings = window.currentActiveChart.drawings.filter(d => !d.isTemp);
            window.currentActiveChart.renderDrawings();
          }
          this.drawingState = null;
          this.setTool('crosshair');
        }
      }
    });
  }

  saveDrawings(chartEngine) {
    const valid = chartEngine.drawings.filter(d => !d.isTemp);
    const key = this.storageKey(chartEngine);
    const encoded = JSON.stringify(valid);
    const stack = this.undoStacks.get(key) || ['[]'];
    if (stack.at(-1) !== encoded) { stack.push(encoded); if (stack.length > 100) stack.shift(); this.undoStacks.set(key, stack); this.redoStacks.set(key, []); }
    Workspace.write(key, valid);
  }

  storageKey(chart) { return 'drawings_' + chart.id + '_' + chart.symbol; }

  historyStep(chart, redo) {
    const key = this.storageKey(chart);
    const stack = this.undoStacks.get(key) || ['[]'];
    const future = this.redoStacks.get(key) || [];
    if (redo && future.length) stack.push(future.pop());
    else if (!redo && stack.length > 1) future.push(stack.pop());
    else return;
    chart.drawings = JSON.parse(stack.at(-1));
    this.undoStacks.set(key, stack); this.redoStacks.set(key, future);
    Workspace.write(key, chart.drawings); chart.renderDrawings();
  }

  loadDrawings(chartEngine) {
    const key = this.storageKey(chartEngine);
    const legacy = Workspace.read('drawings_' + chartEngine.symbol, []);
    const values = Workspace.read(key, legacy);
    chartEngine.drawings = Array.isArray(values) ? values.filter(d => d && d.p1 && Number.isFinite(d.p1.time) && Number.isFinite(d.p1.price) && !d.isTemp) : [];
    this.undoStacks.set(key, [JSON.stringify(chartEngine.drawings)]);
    this.redoStacks.set(key, []);
    chartEngine.renderDrawings();
  }
}
