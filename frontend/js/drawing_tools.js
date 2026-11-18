class DrawingManager {
  constructor() {
    this.activeTool = 'crosshair';
    this.magnetEnabled = false;
    this.magnetMode = 'strong';
    this.drawingsLocked = false;
    this.drawingsHidden = false;
    this.drawingState = null;
    this.lastPointer = null;
    this.measureSession = null;

    this.undoStacks = new Map();
    this.redoStacks = new Map();
    this.editor = new DrawingEditor(this);
    this.initHotkeys();
    const magnet=Workspace.read('terminal_magnet_v1',{});this.magnetEnabled=!!magnet.enabled;this.magnetMode=magnet.mode==='weak'?'weak':'strong';this.updateMagnetButtons();
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
        window.currentActiveChart.drawings = (window.currentActiveChart.drawings || []).filter(d => d.locked);
        window.currentActiveChart.renderDrawings();
        this.saveDrawings(window.currentActiveChart);
      }
      return;
    }

    if (tool === 'magnet') {
      this.setMagnet(!this.magnetEnabled);
      return;
    }

    if (this.measureSession) this.clearMeasure();
    if (this.drawingState?.chart) {
      this.drawingState.chart.drawings = this.drawingState.chart.drawings.filter(d => !d.isTemp);
      this.drawingState.chart.renderDrawings();
    }
    if (tool !== 'crosshair') this.editor.clear();
    if (tool === 'position') this.positionSide = 'long';
    else if (tool === 'short_position') this.positionSide = 'short';
    this.activeTool = tool;
    for(const chart of window.charts||[]){chart.container.style.cursor='';chart.container.style.removeProperty('--drawing-cursor');for(const button of chart.alertOverlay?.buttons.values()||[])button.style.pointerEvents=tool==='crosshair'?'auto':'none';}
    this.drawingState = null;
    this.lastPointer = null;

    document.querySelectorAll('.tool-btn, .ft-btn').forEach(btn => {
      if (btn.dataset.tool === 'magnet' || btn.dataset.tool === 'lock' || btn.dataset.tool === 'eye') return;
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  updateMagnetButtons(){
    document.querySelectorAll('.tool-btn[data-tool="magnet"], .ft-btn[data-tool="magnet"]').forEach(btn=>{
      btn.classList.toggle('active',this.magnetEnabled);btn.setAttribute('aria-pressed',String(this.magnetEnabled));
      const label = `Magnet: ${this.magnetEnabled?'On':'Off'} · ${this.magnetMode==='weak'?'Weak':'Strong'} (Ctrl: temporary toggle)`;
      if (btn.closest?.('#left-sidebar')) btn.setAttribute('aria-label', label);
      else btn.title = label;
    });
  }
  setMagnet(enabled,mode=this.magnetMode){this.magnetEnabled=!!enabled;this.magnetMode=mode==='weak'?'weak':'strong';this.updateMagnetButtons();Workspace.write('terminal_magnet_v1',{enabled:this.magnetEnabled,mode:this.magnetMode});}
  snapPoint(chart,time,price,event={}){
    const temporary=!!(event.ctrlKey||event.metaKey);
    if(this.magnetEnabled===temporary)return {time,price};
    const rect=chart.container?.getBoundingClientRect();
    const pixel=rect&&Number.isFinite(event.clientX)?{x:event.clientX-rect.left,y:event.clientY-rect.top}:null;
    return chart.snapToBar(time,price,temporary?'strong':this.magnetMode,pixel);
  }

  bindMagnetCrosshair(chart){
    let pointer=null,updating=false;
    chart.container.addEventListener('mousemove',event=>{
      if(event.target.closest('button,input,select,.indicator-tables')){pointer=null;return;}
      const rect=chart.container.getBoundingClientRect();
      pointer={x:event.clientX-rect.left,y:event.clientY-rect.top,ctrlKey:event.ctrlKey,metaKey:event.metaKey};
    },true);
    chart.container.addEventListener('mouseleave',()=>{pointer=null;chart.chart.clearCrosshairPosition();});
    chart.chart.subscribeCrosshairMove(param=>{
      if(updating||!pointer||!param.point||param.paneIndex>0||chart.container.hidden)return;
      if(pointer.x<0||pointer.x>=chart.container.clientWidth-(chart.chart.priceScale('right').width()||65)||pointer.y<0||pointer.y>=chart.plotBottom)return;
      const temporary=!!(pointer.ctrlKey||pointer.metaKey);
      if(this.magnetEnabled===temporary)return;
      const time=chart.coordinateToTime(pointer.x),price=chart.coordinateToPrice(pointer.y);
      const snapped=chart.snapToBar(time,price,temporary?'strong':this.magnetMode,pointer);
      if(!Number.isFinite(snapped.time)||!Number.isFinite(snapped.price))return;
      // Native Normal mode supplies free movement outside the weak snap radius.
      if(snapped.time===time&&snapped.price===price)return;
      updating=true;
      try{chart.chart.setCrosshairPosition(snapped.price,snapped.time,chart.series);}finally{updating=false;}
    });
  }

  toggleLock() {
    this.drawingsLocked = !this.drawingsLocked;
    const charts = window.charts || (window.currentActiveChart ? [window.currentActiveChart] : []);
    charts.forEach(c => { c.drawingsLocked = this.drawingsLocked; c.renderDrawings(); });

    document.querySelectorAll('.tool-btn[data-tool="lock"], .ft-btn[data-tool="lock"]').forEach(btn => {
      btn.classList.toggle('active', this.drawingsLocked);
    });

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

  }

  resolvePoint(chartEngine, clientX, clientY, event = {}, anchor = null) {
    const rect = chartEngine.container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    let time = chartEngine.coordinateToTime(x);
    let price = chartEngine.coordinateToPrice(y);
    if (time === null || !Number.isFinite(price)) return null;

    ({ time, price } = this.snapPoint(chartEngine, time, price, {
      clientX, clientY, ctrlKey: event.ctrlKey, metaKey: event.metaKey
    }));
    if (anchor && event.shiftKey && this.activeTool === 'line') {
      return DrawingModel.constrainLinePoint(chartEngine, anchor, { time, price }, { x, y });
    }
    return { time, price };
  }

  updatePreview(chartEngine, clientX, clientY, event = {}) {
    if (!this.drawingState || this.drawingState.chart !== chartEngine || this.drawingsLocked) return;
    const anchor = this.drawingState.step === 2 ? this.drawingState.p1 : null;
    const point = this.resolvePoint(chartEngine, clientX, clientY, event, anchor);
    if (!point) return;

    if (this.drawingState.step === 3) {
      const [p1, p2] = this.drawingState.points;
      chartEngine.drawings = chartEngine.drawings.filter(d => !d.isTemp);
      chartEngine.drawings.push({ id: 'temp', isTemp: true, type: 'position', p1, p2: p2 || point, p3: point, ...DrawingModel.defaults('position') });
      chartEngine.renderDrawings();
      return;
    }

    chartEngine.drawings = chartEngine.drawings.filter(d => !d.isTemp);
    chartEngine.drawings.push({
      id: 'temp',
      isTemp: true,
      type: this.activeTool,
      p1: this.drawingState.p1,
      p2: point,
      color: '#2962ff',
      fillColor: 'rgba(41, 98, 255, 0.2)',
      borderColor: '#2962ff'
    });
    chartEngine.renderDrawings();
  }

  bindChart(chartEngine) {
    const container = chartEngine.container;
    this.editor.bind(chartEngine);
    this.loadDrawings(chartEngine);
    this.bindMagnetCrosshair(chartEngine);
    this.bindBrush(chartEngine);
    this.bindMeasure(chartEngine);

    container.addEventListener('click', (e) => {
      if (e.target.closest('button, input, select, .indicator-tables') || this.activeTool === 'crosshair' || this.activeTool==='brush' || this.activeTool==='measure' || this.drawingsLocked) return;
      if (this.drawingState?.chart !== chartEngine) this.drawingState = null;

      const anchor = this.drawingState?.step === 2 ? this.drawingState.p1 : null;
      const point = this.resolvePoint(chartEngine, e.clientX, e.clientY, e, anchor);
      if (!point) return;
      const { time, price } = point;

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

      if(this.activeTool==='position'||this.activeTool==='short_position'){
        const idx=DrawingModel.logicalIndex(chartEngine,time)??0;
        const rightTime=DrawingModel.timeAt(chartEngine,idx+12)||time+(chartEngine.tfSeconds||60)*12;
        const vis=chartEngine.chart?.timeScale?.().getVisibleLogicalRange?.();
        const from=Math.max(0,Math.floor(vis?.from??0)),to=Math.min((chartEngine.bars?.length||1)-1,Math.ceil(vis?.to??((chartEngine.bars?.length||1)-1)));
        let hi=-Infinity,lo=Infinity;
        for(let i=from;i<=to;i++){const b=chartEngine.bars?.[i];if(b){if(b.high>hi)hi=b.high;if(b.low<lo)lo=b.low;}}
        const span=Number.isFinite(hi)&&Number.isFinite(lo)&&hi>lo?(hi-lo)*0.12:Math.max(Math.abs(price)*0.002,(chartEngine.metadata?.tickSize||0.25)*20);
        const tick=chartEngine.metadata?.tickSize;
        const snapTick=v=>Number.isFinite(tick)&&tick>0?Math.round(v/tick)*tick:v;
        const isShort=this.activeTool==='short_position'||this.positionSide==='short';
        const p1={time,price};
        const p2={time:rightTime,price:snapTick(isShort?price-span*2:price+span*2)};
        const p3={time:rightTime,price:snapTick(isShort?price+span:price-span)};
        const newDrawing={id:crypto.randomUUID(),type:'position',p1,p2,p3,...DrawingModel.defaults('position'),side:isShort?'short':'long'};
        chartEngine.drawings=chartEngine.drawings.filter(d=>!d.isTemp);
        chartEngine.drawings.push(newDrawing);
        this.editor.select(chartEngine,newDrawing);
        this.saveDrawings(chartEngine);
        this.drawingState=null;
        this.setTool('crosshair');
        chartEngine.renderDrawings();
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
        this.lastPointer = null;
        this.setTool('crosshair');
        chartEngine.renderDrawings();
      }
    });

    container.addEventListener('mousemove', (e) => {
      if (!this.drawingState || this.drawingState.chart !== chartEngine || this.drawingsLocked) return;
      this.lastPointer = { chart: chartEngine, clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, metaKey: e.metaKey };
      this.updatePreview(chartEngine, e.clientX, e.clientY, e);
    });
  }

  bindBrush(chart){
    const node=chart.container;let stroke;
    const finish=(event,cancel=false)=>{
      if(!stroke)return;const current=stroke;stroke=null;
      chart.drawings=chart.drawings.filter(d=>d!==current.drawing);chart.chart.applyOptions({handleScroll:{pressedMouseMove:current.scroll}});
      if(node.hasPointerCapture(current.pointer))node.releasePointerCapture(current.pointer);
      if(!cancel&&current.drawing.points.length>1&&current.symbol===chart.symbol){
        const d=current.drawing;delete d.isTemp;chart.drawings.push(d);this.saveDrawings(chart);this.setTool('crosshair');this.editor.select(chart,d);
      }
      chart.renderDrawings();
    };
    node.addEventListener('pointerdown',event=>{
      if(this.activeTool!=='brush'||this.drawingsLocked||event.button!==0||event.target.closest('button,input,select,.indicator-tables'))return;
      const r=node.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
      if(x<0||x>=node.clientWidth-(chart.chart.priceScale('right').width()||65)||y<0||y>=chart.plotBottom)return;
      const p=DrawingModel.fromPixel(chart,x,y,true);if(!p)return;
      event.preventDefault();event.stopImmediatePropagation();node.dispatchEvent(new CustomEvent('chart-activate'));
      const d={...DrawingModel.defaults('brush'),type:'brush',id:crypto.randomUUID(),isTemp:true,p1:{...p},points:[p],width:2};
      stroke={drawing:d,pointer:event.pointerId,symbol:chart.symbol,x,y,scroll:chart.chart.options().handleScroll.pressedMouseMove};chart.drawings.push(d);
      chart.chart.applyOptions({handleScroll:{pressedMouseMove:false}});node.setPointerCapture(event.pointerId);
    },true);
    node.addEventListener('pointermove',event=>{
      if(!stroke)return;if(this.activeTool!=='brush'||this.drawingsLocked||stroke.symbol!==chart.symbol)return finish(event,true);
      event.preventDefault();event.stopImmediatePropagation();const r=node.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
      if(x<0||x>=node.clientWidth-(chart.chart.priceScale('right').width()||65)||y<0||y>=chart.plotBottom||Math.hypot(x-stroke.x,y-stroke.y)<2||stroke.drawing.points.length>=8192)return;
      const p=DrawingModel.fromPixel(chart,x,y,true);if(!p)return;stroke.drawing.points.push(p);stroke.x=x;stroke.y=y;chart.renderDrawings();
    },true);
    node.addEventListener('pointerup',event=>{if(stroke){event.preventDefault();event.stopImmediatePropagation();finish(event);}},true);
    node.addEventListener('pointercancel',event=>finish(event,true),true);
    node.addEventListener('lostpointercapture',event=>finish(event,true),true);
    window.addEventListener('blur',event=>finish(event,true));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')finish(event,true);});
  }

  clearMeasure() {
    const s = this.measureSession;
    if (!s) return;
    this.measureSession = null;
    if (s.scroll != null) s.chart.chart.applyOptions({ handleScroll: { pressedMouseMove: s.scroll } });
    if (s.pointerId != null && s.chart.container.hasPointerCapture?.(s.pointerId)) {
      s.chart.container.releasePointerCapture(s.pointerId);
    }
    s.chart.drawings = (s.chart.drawings || []).filter(d => d.id !== 'temp_measure');
    s.chart.renderDrawings();
  }

  bindMeasure(chart) {
    const node = chart.container;
    const inPlot = (clientX, clientY) => {
      const r = node.getBoundingClientRect(), x = clientX - r.left, y = clientY - r.top;
      return x >= 0 && x < node.clientWidth - (chart.chart.priceScale('right').width() || 65) && y >= 0 && y < chart.plotBottom;
    };
    const renderMeasure = (p1, p2) => {
      chart.drawings = (chart.drawings || []).filter(d => d.id !== 'temp_measure');
      chart.drawings.push({ ...DrawingModel.defaults('measure'), id: 'temp_measure', isTemp: true, type: 'measure', p1, p2 });
      chart.renderDrawings();
    };
    node.addEventListener('pointerdown', e => {
      if (e.button !== 0 || this.drawingsLocked || e.target.closest('button, input, select, .indicator-tables, .drawing-toolbar')) return;
      if (this.measureSession?.phase === 'locked') {
        this.clearMeasure();
        if (this.activeTool === 'measure' && !e.shiftKey) {
          this.setTool('crosshair');
          return;
        }
        if (!e.shiftKey && this.activeTool !== 'measure') return;
      }
      if (this.measureSession?.phase === 'aiming' && this.measureSession.chart === chart) {
        const p2 = this.resolvePoint(chart, e.clientX, e.clientY, e);
        if (p2) { this.measureSession.p2 = p2; renderMeasure(this.measureSession.p1, p2); }
        this.measureSession.phase = 'locked';
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      const isShiftMeasure = e.shiftKey && !this.drawingState && (this.activeTool === 'crosshair' || this.activeTool === 'measure');
      if (!isShiftMeasure && this.activeTool !== 'measure') return;
      if (!inPlot(e.clientX, e.clientY)) return;
      const p1 = this.resolvePoint(chart, e.clientX, e.clientY, e);
      if (!p1) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      node.dispatchEvent(new CustomEvent('chart-activate'));
      const scroll = chart.chart.options().handleScroll.pressedMouseMove;
      chart.chart.applyOptions({ handleScroll: { pressedMouseMove: false } });
      node.setPointerCapture?.(e.pointerId);
      this.measureSession = { chart, p1, p2: p1, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, scroll, phase: 'dragging', moved: false };
      renderMeasure(p1, p1);
    }, true);

    node.addEventListener('pointermove', e => {
      const s = this.measureSession;
      if (!s || s.chart !== chart || (s.phase !== 'dragging' && s.phase !== 'aiming')) return;
      if (s.phase === 'dragging' && Math.hypot(e.clientX - s.startX, e.clientY - s.startY) >= 4) s.moved = true;
      const p2 = this.resolvePoint(chart, e.clientX, e.clientY, e);
      if (!p2) return;
      s.p2 = p2;
      renderMeasure(s.p1, p2);
    }, true);

    const endDrag = e => {
      const s = this.measureSession;
      if (!s || s.chart !== chart || s.phase !== 'dragging') return;
      if (s.scroll != null) chart.chart.applyOptions({ handleScroll: { pressedMouseMove: s.scroll } });
      s.scroll = null;
      if (s.pointerId != null && node.hasPointerCapture?.(s.pointerId)) node.releasePointerCapture(s.pointerId);
      s.pointerId = null;
      s.phase = s.moved ? 'locked' : 'aiming';
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    node.addEventListener('pointerup', endDrag, true);
    node.addEventListener('pointercancel', () => this.clearMeasure(), true);
  }

  initHotkeys() {
    document.addEventListener('pointerdown', e => {
      if (this.measureSession?.phase !== 'locked') return;
      if (this.measureSession.chart.container.contains(e.target)) return;
      this.clearMeasure();
      if (this.activeTool === 'measure') this.setTool('crosshair');
    }, true);
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      const chart = window.currentActiveChart;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && chart && !this.drawingsLocked) {
        e.preventDefault(); this.historyStep(chart, e.shiftKey); return;
      }
      if (e.key === 'Escape') {
        if (this.measureSession) {
          this.clearMeasure();
          if (this.activeTool === 'measure') this.setTool('crosshair');
        }
        if (this.drawingState) {
          if (window.currentActiveChart) {
            window.currentActiveChart.drawings = window.currentActiveChart.drawings.filter(d => !d.isTemp);
            window.currentActiveChart.renderDrawings();
          }
          this.drawingState = null;
          this.lastPointer = null;
          this.setTool('crosshair');
        }
      }
    });
    for (const type of ['keydown', 'keyup']) {
      window.addEventListener(type, (e) => {
        if (e.key !== 'Shift' || (type === 'keydown' && e.repeat) || !this.drawingState || this.activeTool !== 'line' || this.lastPointer?.chart !== this.drawingState.chart) return;
        this.updatePreview(this.lastPointer.chart, this.lastPointer.clientX, this.lastPointer.clientY, {
          ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: type === 'keydown' || e.shiftKey
        });
      });
    }
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
