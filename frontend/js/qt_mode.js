/* QT Mode Controller & Settings UI — Auto-runs QuantaibayEngine on all charts.
 * Drop-in replacement for generic Indicator Library/Editor.
 */
class QTMode {
  constructor(options = {}) {
    this.charts = options.charts || [];
    this.getActive = options.getActive || (() => this.charts[0]);
    this.getMarkets = options.getMarkets || (() => new Map());
    this.isReplay = options.isReplay || (() => false);
    this.requestNative = options.requestNative || (() => {});
    this.toast = options.toast || (() => {});
    this.storageKey = options.storageKey || 'terminal_qt_mode_v1';

    const saved = this._readStorage();
    const rawSettings = { ...(saved.settings || {}) };
    if (!saved.v2) {
      delete rawSettings.showSsmtTxt;
      if (rawSettings.lblClr === '#787b86cc') delete rawSettings.lblClr;
    }
    // Clean any obsolete per-item keys from v3 while keeping unified settings
    const validKeys = new Set(Object.keys(QuantaibayEngine.DEFAULTS));
    for (const k of Object.keys(rawSettings)) {
      if (!validKeys.has(k)) delete rawSettings[k];
    }

    this.enabled = saved.enabled !== false;
    this.settings = { ...QuantaibayEngine.DEFAULTS, ...rawSettings };
    this.chartHidden = new Set(Array.isArray(saved.chartHidden) ? saved.chartHidden : []);

    this._raf = 0;
    this._tickTimer = 0;
    this._dirtyCharts = new Set();
    this._chartMeta = new WeakMap();
    this.palette = null;
    this.paletteTarget = null;

    this._injectStyles();
    this._buildModal();
    this._bindCharts();
    if (!saved.v2 || saved.v3) this._writeStorage();
  }

  _readStorage() {
    if (typeof Workspace !== 'undefined' && Workspace.read) {
      return Workspace.read(this.storageKey, {}) || {};
    }
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) || '{}') || {};
    } catch {
      return {};
    }
  }

  _writeStorage() {
    const payload = {
      v2: true,
      enabled: this.enabled,
      settings: this.settings,
      chartHidden: [...this.chartHidden]
    };
    if (typeof Workspace !== 'undefined' && Workspace.write) {
      return Workspace.write(this.storageKey, payload);
    }
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  _injectStyles() {
    if (typeof document === 'undefined' || document.getElementById('qt-mode-styles')) return;
    const style = document.createElement('style');
    style.id = 'qt-mode-styles';
    style.textContent = `
      #topbar #btn-indicator.qt-mode-pill {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        gap: 5px;
        padding: 0 9px !important;
        width: auto !important;
        min-width: 48px;
        height: 32px;
        border-radius: 8px;
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.03em;
        color: var(--text, #334155) !important;
        background: rgba(120, 123, 134, 0.12);
        border: 1px solid rgba(120, 123, 134, 0.24);
        transition: background .15s, color .15s, border-color .15s, box-shadow .15s;
      }
      #topbar #btn-indicator.qt-mode-pill > span {
        display: inline !important;
      }
      #topbar #btn-indicator.qt-mode-pill .qt-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #94a3b8;
        transition: background .15s, box-shadow .15s;
      }
      #topbar #btn-indicator.qt-mode-pill.active {
        color: #1d4ed8 !important;
        background: rgba(41, 98, 255, 0.14);
        border-color: rgba(41, 98, 255, 0.42);
      }
      [data-dock-theme="dark"] #topbar #btn-indicator.qt-mode-pill.active {
        color: #93c5fd !important;
        background: rgba(41, 98, 255, 0.22);
        border-color: rgba(96, 165, 250, 0.48);
      }
      #topbar #btn-indicator.qt-mode-pill.active .qt-dot {
        background: #2563eb;
        box-shadow: 0 0 7px rgba(37, 99, 235, 0.75);
      }
      [data-dock-theme="dark"] #topbar #btn-indicator.qt-mode-pill.active .qt-dot {
        background: #38bdf8;
        box-shadow: 0 0 8px rgba(56, 189, 248, 0.85);
      }
      #topbar #btn-qt-settings {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 32px;
        min-width: 32px;
        height: 32px;
        padding: 0;
        border-radius: 8px;
        color: var(--text, #334155) !important;
        background: transparent;
      }
      #topbar #btn-qt-settings:hover {
        background: rgba(120, 123, 134, 0.14);
      }
      .qt-settings-dialog {
        width: 590px;
        max-width: calc(100vw - 24px);
        max-height: calc(100vh - 36px);
        display: flex;
        flex-direction: column;
        border-radius: 12px;
        background: #1e222d;
        border: 1px solid #363a45;
        color: #d1d4dc;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65);
      }
      .qt-settings-dialog .modal-header {
        padding: 16px 20px 12px;
        border-bottom: 1px solid #2a2e39;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .qt-settings-title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .qt-settings-badge {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 4px;
        background: rgba(41, 98, 255, 0.2);
        color: #82aaff;
        border: 1px solid rgba(41, 98, 255, 0.4);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .qt-settings-body {
        overflow-y: auto;
        min-height: 240px;
        max-height: 66vh;
        padding: 0 20px 18px;
      }
      .qt-filter-sticky {
        position: sticky;
        top: 0;
        z-index: 4;
        background: #1e222d;
        padding: 12px 0 8px;
        border-bottom: 1px solid #2a2e39;
        margin-bottom: 6px;
      }
      .qt-search {
        width: 100%;
        padding: 8px 12px;
        margin-bottom: 8px;
        background: #131722;
        border: 1px solid #363a45;
        border-radius: 7px;
        color: #e2e8f0;
        font-size: 12.5px;
        outline: none;
        transition: border-color .15s, box-shadow .15s;
      }
      .qt-search:focus {
        border-color: #2962ff;
        box-shadow: 0 0 0 2px rgba(41, 98, 255, 0.22);
      }
      .qt-group-heading {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #8b93a7;
        margin: 16px 0 6px;
        padding-bottom: 5px;
        border-bottom: 1px solid #2a2e39;
      }
      .qt-group-heading:first-child {
        margin-top: 8px;
      }
      .qt-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 36px;
        padding: 4px 8px;
        margin: 0 -8px;
        border-radius: 6px;
        font-size: 13px;
        color: #d1d4dc;
        transition: background .12s;
      }
      .qt-row:hover {
        background: rgba(255, 255, 255, 0.035);
      }
      .qt-inline-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px 16px;
        min-height: 38px;
        padding: 5px 8px;
        margin: 0 -8px;
        border-radius: 6px;
      }
      .qt-inline-row:hover {
        background: rgba(255, 255, 255, 0.035);
      }
      .qt-inline-item {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 13px;
        color: #d1d4dc;
        cursor: pointer;
      }
      .qt-row select, .qt-inline-item select,
      .qt-row input[type="number"], .qt-inline-item input[type="number"],
      .qt-row input[type="text"] {
        background: #131722;
        border: 1px solid #363a45;
        border-radius: 6px;
        color: #e0e3eb;
        padding: 5px 8px;
        font-size: 12.5px;
      }
      .qt-row select { min-width: 195px; max-width: 260px; }
      .qt-inline-item select { min-width: 96px; }
      .qt-row input[type="number"] { width: 88px; }
      .qt-inline-item input[type="number"] { width: 64px; }
      .qt-row input[type="checkbox"], .qt-inline-item input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: #2962ff;
        cursor: pointer;
      }
      .tv-indi-popover {
        position: fixed !important;
        z-index: 10020 !important;
        max-height: calc(100vh - 16px);
        overflow-y: auto;
      }
      .qt-settings-error {
        color: #f23645;
        font-size: 12px;
        padding: 0 20px 6px;
        min-height: 18px;
      }
      .qt-settings-error:empty { display: none; }
      .qt-settings-dialog .modal-footer {
        padding: 12px 20px;
        border-top: 1px solid #2a2e39;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .qt-defaults-btn { margin-right: auto; }
      .qt-table-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 22;
      }
      .qt-cycle-table-wrap {
        position: absolute;
        pointer-events: auto;
        cursor: pointer;
        border-radius: 8px;
        overflow: hidden;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
        transition: box-shadow .15s, transform .15s;
      }
      .qt-cycle-table-wrap:hover {
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
      }
      .qt-cycle-table {
        border-collapse: collapse;
        font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Arial, sans-serif;
        line-height: 1.25;
        font-variant-numeric: tabular-nums;
      }
      .qt-cycle-table tr:first-child td {
        font-size: 9.5px !important;
        text-transform: uppercase;
        letter-spacing: 0.055em;
        opacity: 0.78;
        padding-top: 4px;
        padding-bottom: 4px;
      }
      .qt-cycle-table td {
        padding: 3px 9px;
        white-space: nowrap;
      }
      .qt-cycle-table td:last-child {
        min-width: 42px;
      }
      .indicator-legend {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  mountTopbar(indicatorButton) {
    if (!indicatorButton) return;
    this.toggleButton = indicatorButton;
    const cleanBtn = indicatorButton.cloneNode(false);
    cleanBtn.className = 'btn-icon qt-mode-pill';
    cleanBtn.id = indicatorButton.id;
    cleanBtn.title = 'QT Mode (Quantaibay Auto) — Bấm để Bật / Tắt';
    cleanBtn.setAttribute('aria-label', 'Toggle QT Mode');
    cleanBtn.innerHTML = '<i class="qt-dot" aria-hidden="true"></i><span>QT</span>';
    indicatorButton.replaceWith(cleanBtn);
    this.toggleButton = cleanBtn;

    cleanBtn.addEventListener('click', e => {
      e.stopPropagation();
      this.setEnabled(!this.enabled);
    });

    document.getElementById('btn-indicator-settings')?.remove();
    document.getElementById('btn-qt-settings')?.remove();
    const gear = document.createElement('button');
    gear.type = 'button';
    gear.id = 'btn-qt-settings';
    gear.className = 'btn-icon';
    gear.title = 'QT Mode Settings (Quantaibay)';
    gear.setAttribute('aria-label', 'QT Mode Settings');
    gear.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    cleanBtn.after(gear);
    this.settingsButton = gear;
    gear.addEventListener('click', e => {
      e.stopPropagation();
      if (this.modal.classList.contains('show')) this.cancelSettings();
      else this.openSettings(this.getActive());
    });

    const legacyModal = document.getElementById('indicator-modal');
    if (legacyModal) {
      legacyModal.classList.remove('show');
      legacyModal.hidden = true;
    }

    this._syncTopbarButton();
  }

  _syncTopbarButton() {
    if (!this.toggleButton) return;
    this.toggleButton.classList.toggle('active', this.enabled);
    this.toggleButton.setAttribute('aria-pressed', String(this.enabled));
  }

  setEnabled(next) {
    this.enabled = !!next;
    const legacyModal = document.getElementById('indicator-modal');
    if (legacyModal) {
      legacyModal.classList.remove('show');
      legacyModal.hidden = true;
    }

    this._syncTopbarButton();
    this._writeStorage();
    this.scheduleAll();
  }

  toggleChart(chart) {
    if (!chart) return;
    if (this.chartHidden.has(chart.id)) this.chartHidden.delete(chart.id);
    else this.chartHidden.add(chart.id);
    this._writeStorage();
    this.schedule(chart);
  }

  _bindCharts() {
    for (const chart of this.charts) {
      try { chart.runner?.stop?.(); } catch {}
      chart.clearCustomSeries?.();

      chart.container.querySelector('.indicator-legend')?.remove();
      const tableLayer = document.createElement('div');
      tableLayer.className = 'qt-table-layer';
      chart.container.appendChild(tableLayer);

      this._chartMeta.set(chart, { tableLayer, qLabels: [], trLabels: [], labelPadPct: 8, candleColorSig: '' });

      const self = this;
      chart.runner = {
        ready: true,
        get entries() {
          const hidden = !self.enabled || self.chartHidden.has(chart.id);
          return [{
            name: 'Quantaibay (QT Mode)',
            record: { id: 'qt', name: 'Quantaibay (QT Mode)', enabled: self.enabled, view: { hidden } }
          }];
        },
        schedule: () => self.schedule(chart),
        stop: () => {},
        restart: () => self.schedule(chart),
        toggle: () => self.toggleChart(chart),
        remove: () => self.toggleChart(chart),
        select: () => {}
      };

      chart.onIndicatorSettings = () => this.openSettings(chart);
      chart.onIndicatorToggle = () => this.toggleChart(chart);
      chart.onDataChange = () => this.schedule(chart);

      const syncPins = range => {
        const meta = this._chartMeta.get(chart);
        if (!meta || !chart.bars?.length || (!meta.qLabels?.length && !meta.trLabels?.length)) return false;
        const r = range ?? chart.chart.timeScale().getVisibleLogicalRange?.();
        const rKey = r && Number.isFinite(r.from) && Number.isFinite(r.to)
          ? `${r.from}:${r.to}:${chart.bars.length}:${meta.labelPadPct}:${chart.tfSeconds}`
          : '';
        if (rKey && meta.lastPinKey === rKey) return false;
        meta.lastPinKey = rKey;
        if (meta.qLabels?.length) QuantaibayEngine.pinQLabels(meta.qLabels, chart.bars, r, meta.labelPadPct);
        if (meta.trLabels?.length) QuantaibayEngine.pinTrueOpenLabels?.(meta.trLabels, chart.bars, r, chart.tfSeconds);
        return true;
      };
      chart.onBeforeRenderDrawings = () => { syncPins(); };
      chart.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (syncPins(range)) chart.renderDrawings();
      });
    }
  }

  scheduleAll() {
    this._settingsRev = (this._settingsRev || 0) + 1;
    for (const chart of this.charts) {
      if (!chart.container.hidden) this._dirtyCharts.add(chart);
    }
    this._flushSchedule();
  }

  schedule(chart) {
    if (!chart || chart.container.hidden) return;
    this._dirtyCharts.add(chart);
    this._flushSchedule();
  }

  _flushSchedule() {
    if (this._raf) return;
    const run = () => {
      this._raf = 0;
      if (typeof requestAnimationFrame === 'function') {
        const next = this._dirtyCharts.values().next().value;
        if (!next) return;
        this._dirtyCharts.delete(next);
        this.renderChart(next);
        if (this._dirtyCharts.size) this._flushSchedule();
        return;
      }
      const batch = [...this._dirtyCharts];
      this._dirtyCharts.clear();
      for (const chart of batch) this.renderChart(chart);
    };
    if (typeof requestAnimationFrame === 'function') this._raf = requestAnimationFrame(run);
    else run();
  }

  _activeSettings() {
    return this._previewSettings || this.settings;
  }

  renderChart(chart) {
    const meta = this._chartMeta.get(chart);
    if (!meta) return;
    const s = this._activeSettings();
    const showOnChart = this.enabled && !this.chartHidden.has(chart.id);

    if (!showOnChart || !chart.bars?.length) {
      chart.indicatorDrawings = [];
      if (meta.candleColorSig) {
        meta.candleColorSig = '';
        chart.indicatorCandleColors = new Map();
        chart.renderCandleData?.();
      }
      meta.qLabels = [];
      meta.trLabels = [];
      meta.lastPinKey = '';
      meta.tableSig = '';
      meta.tableLayer.replaceChildren();
      chart.renderDrawings();
      return;
    }

    const rawMarkets = this.getMarkets();
    const marketsObj = rawMarkets instanceof Map ? Object.fromEntries(rawMarkets) : (rawMarkets || {});
    const scopeKey = `${chart.symbol}|${chart.currentTimeframe}|${chart.bars.length}|${!!(chart.replayMode || this.isReplay())}|${this._settingsRev || 0}|${this._previewSettings ? 1 : 0}`;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!this._previewSettings && meta.lastScope === scopeKey && meta.lastCalcAt && (nowMs - meta.lastCalcAt) < 1000) {
      if (!meta.deferredTimer && typeof setTimeout === 'function') {
        meta.deferredTimer = setTimeout(() => {
          meta.deferredTimer = 0;
          this.schedule(chart);
        }, Math.max(50, 1000 - (nowMs - meta.lastCalcAt)));
      }
      return;
    }
    if (meta.deferredTimer) { clearTimeout(meta.deferredTimer); meta.deferredTimer = 0; }
    meta.lastScope = scopeKey;
    meta.lastCalcAt = nowMs;

    const logicalRange = chart.chart.timeScale().getVisibleLogicalRange();
    const chartBg = chart.appearance?.bg || chart.appearance?.background || chart.config?.bg || '#c2baae';
    const sessionMode = chart.appearance?.sessionMode || 'ETH';

    if (marketsObj[chart.symbol]?.['1m']?.length) {
      if ((s.showCycTbl || s.trTQO || (s.showSsmt && s.en5 && (s.showAll || chart.currentTimeframe === '6h'))) && !marketsObj[chart.symbol]?.['6h']?.length) {
        this.requestNative({ symbol: chart.symbol, timeframe: '6h' });
      }
      if ((s.showCycTbl || s.trTYO || (s.showSsmt && s.en6 && (s.showAll || chart.currentTimeframe === 'D'))) && !marketsObj[chart.symbol]?.D?.length) {
        this.requestNative({ symbol: chart.symbol, timeframe: 'D' });
      }
      if (s.usePsp && chart.tfSeconds >= QuantaibayEngine.tfToSeconds(s.pspVisLimit) && chart.currentTimeframe !== '1m') {
        for (const peer of QuantaibayEngine.resolveTriad(chart.symbol, s).slice(1)) {
          if (!marketsObj[peer]?.[chart.currentTimeframe]?.length) {
            this.requestNative({ symbol: peer, timeframe: chart.currentTimeframe });
          }
        }
      }
    }

    const out = QuantaibayEngine.calculate(chart.bars, {
      symbol: chart.symbol,
      timeframe: chart.currentTimeframe,
      timeframeSeconds: chart.tfSeconds,
      sessionMode,
      replay: chart.replayMode || this.isReplay(),
      settings: s,
      markets: marketsObj,
      metadata: chart.metadata,
      visibleLogicalRange: logicalRange,
      chartBg
    });

    const nextColors = out.candleColors || [];
    let hash = 2166136261;
    for (let i = 0; i < nextColors.length; i++) {
      const item = nextColors[i];
      hash = Math.imul(hash ^ (item.time | 0), 16777619);
      const str = item.color;
      for (let c = 0; c < str.length; c++) hash = Math.imul(hash ^ str.charCodeAt(c), 16777619);
    }
    const nextSig = nextColors.length ? `${chart.symbol}:${chart.currentTimeframe}:${nextColors.length}:${hash >>> 0}` : '';
    if (nextSig !== meta.candleColorSig) {
      const tailB = chart.bars[chart.bars.length - 1];
      const prevMap = chart.indicatorCandleColors;
      const nextMap = new Map(nextColors.map(x => [x.time, x.color]));
      chart.indicatorCandleColors = nextMap;
      let onlyTailChanged = false;
      if (tailB && prevMap instanceof Map && Math.abs(nextMap.size - prevMap.size) <= 1 && typeof chart.series?.update === 'function' && !chart.replayPreview) {
        onlyTailChanged = true;
        for (const [t, c] of nextMap) {
          if (t !== tailB.time && prevMap.get(t) !== c) { onlyTailChanged = false; break; }
        }
        if (onlyTailChanged) {
          for (const [t, c] of prevMap) {
            if (t !== tailB.time && nextMap.get(t) !== c) { onlyTailChanged = false; break; }
          }
        }
      }
      meta.candleColorSig = nextSig;
      if (onlyTailChanged && typeof ChartAppearance !== 'undefined') {
        const item = chart.appearance ? ChartAppearance.candleData(chart, chart.bars.slice(-2)).at(-1) : (nextMap.has(tailB.time) ? { ...tailB, color: nextMap.get(tailB.time) } : tailB);
        if (item) chart.series.update(item);
      } else {
        chart.renderCandleData?.();
      }
    }

    meta.qLabels = out.qLabels || [];
    meta.trLabels = out.trLabels || [];
    meta.labelPadPct = out.labelPadPct ?? 8;
    meta.lastPinKey = '';
    chart.indicatorDrawings = out.drawings;
    this._renderTables(meta.tableLayer, out.tables, chart, meta);
    chart.renderDrawings();
  }

  _renderTables(layer, tables, chart, meta) {
    if (!tables?.length) {
      if (!meta || meta.tableSig !== '') {
        if (meta) meta.tableSig = '';
        layer.replaceChildren();
      }
      return;
    }
    const axisRight = (chart.chart?.priceScale?.('right')?.width?.() || 65) + 8;
    const axisBottom = (chart.chart?.timeScale?.().height?.() || 26) + 8;

    let topInset = 10;
    const topbar = document.getElementById('topbar');
    if (topbar && !topbar.hidden) {
      const tbRect = topbar.getBoundingClientRect();
      const chRect = chart.container.getBoundingClientRect();
      if (tbRect.height > 0 && chRect.top < tbRect.bottom + 4 && tbRect.bottom - chRect.top < 110) {
        topInset = Math.max(10, Math.ceil(tbRect.bottom - chRect.top + 8));
      }
    }

    const sig = `${axisRight}|${axisBottom}|${topInset}|${JSON.stringify(tables)}`;
    if (meta && meta.tableSig === sig && layer.childElementCount === tables.length) return;
    if (meta) meta.tableSig = sig;
    layer.replaceChildren();

    for (const desc of tables) {
      const wrap = document.createElement('div');
      wrap.className = 'qt-cycle-table-wrap';
      wrap.title = 'Double-click để chỉnh cài đặt Cycle Table';
      wrap.ondblclick = e => { e.stopPropagation(); this.openSettings(chart); };

      const pos = String(desc.position || 'top_right').toLowerCase();
      let tx = '0', ty = '0';
      if (pos.includes('left')) wrap.style.left = '10px';
      else if (pos.includes('center')) { wrap.style.left = `calc((100% - ${axisRight}px) / 2)`; tx = '-50%'; }
      else wrap.style.right = axisRight + 'px';

      if (pos.includes('bottom')) wrap.style.bottom = axisBottom + 'px';
      else if (pos.includes('middle')) { wrap.style.top = `calc((100% - ${axisBottom}px) / 2)`; ty = '-50%'; }
      else wrap.style.top = topInset + 'px';

      if (tx !== '0' || ty !== '0') wrap.style.transform = `translate(${tx}, ${ty})`;

      const tbl = document.createElement('table');
      tbl.className = 'qt-cycle-table';
      if (desc.bgcolor) tbl.style.background = desc.bgcolor;
      if (desc.frameWidth && desc.frameColor) wrap.style.border = `${desc.frameWidth}px solid ${desc.frameColor}`;

      const rows = desc.rows || [];
      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const tr = tbl.insertRow();
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
          const cell = row[cIdx];
          const td = tr.insertCell();
          td.textContent = String(cell?.text ?? '');
          if (cell?.color) td.style.color = cell.color;
          if (cell?.background) td.style.background = cell.background;
          if (cell?.align) td.style.textAlign = cell.align;
          if (cell?.size && rIdx > 0) td.style.fontSize = cell.size + 'px';
          if (cell?.bold) td.style.fontWeight = '700';
          if (desc.borderWidth && desc.borderColor && rIdx > 0) {
            td.style.borderTop = `${desc.borderWidth}px solid ${desc.borderColor}`;
          }
          if (desc.borderWidth && desc.borderColor && cIdx > 0) {
            td.style.borderLeft = `${desc.borderWidth}px solid ${desc.borderColor}`;
          }
        }
      }
      wrap.appendChild(tbl);
      layer.appendChild(wrap);
    }
  }

  // ==================== SETTINGS DIALOG ====================
  _buildModal() {
    if (typeof document === 'undefined') return;
    const modal = document.createElement('div');
    modal.id = 'qt-settings-modal';
    modal.className = 'modal qt-settings-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Quantaibay QT Mode Settings');
    modal.innerHTML = `
      <div class="modal-content qt-settings-dialog">
        <div class="modal-header">
          <div class="qt-settings-title-wrap">
            <span>Quantaibay</span>
            <span class="qt-settings-badge">QT Mode</span>
          </div>
          <button type="button" class="modal-close qt-close" aria-label="Close QT settings">×</button>
        </div>
        <div class="qt-settings-body"></div>
        <div class="qt-settings-error" role="alert"></div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary qt-defaults-btn">Defaults</button>
          <button type="button" class="btn-secondary qt-cancel-btn">Cancel</button>
          <button type="button" class="btn-primary qt-ok-btn">Ok</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this.modal = modal;

    modal.querySelector('.qt-close').onclick = () => this.cancelSettings();
    modal.querySelector('.qt-cancel-btn').onclick = () => this.cancelSettings();
    modal.querySelector('.qt-ok-btn').onclick = () => this.applySettings();
    modal.querySelector('.qt-defaults-btn').onclick = () => {
      this._previewSettings = { ...QuantaibayEngine.DEFAULTS };
      this._renderBody();
      this.scheduleAll();
    };

    const body = modal.querySelector('.qt-settings-body');
    body.addEventListener('scroll', () => this._positionPalette(), { passive: true });
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', () => {
        this._positionPalette();
        this.scheduleAll();
      });
    }

    modal.addEventListener('click', e => {
      if (this.palette && !this.palette.contains(e.target) && !e.target.closest?.('.tv-indi-color')) {
        this._closePalette();
      }
      if (e.target === modal) this.cancelSettings();
    });

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !this.modal?.classList.contains('show')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (this.palette) {
        if (typeof ColorPicker === 'undefined' || !ColorPicker.closeActiveSub(this.palette)) this._closePalette();
        return;
      }
      this.cancelSettings();
    }, true);
  }

  openSettings(chart) {
    this.targetChart = chart || this.getActive();
    this.opener = document.activeElement;
    this._previewSettings = { ...this.settings };
    this.modal.querySelector('.qt-settings-error').textContent = '';
    this.modal.classList.add('show');
    this._renderBody();
    const firstInput = this.modal.querySelector('.qt-search, .qt-close');
    if (firstInput?.focus) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => firstInput.focus({ preventScroll: true }));
      else firstInput.focus({ preventScroll: true });
    }
  }

  _closePalette() {
    this._paletteObserver?.disconnect?.();
    this._paletteObserver = null;
    this.palette?.remove();
    this.palette = null;
    this.paletteTarget?.classList.remove('active');
    this.paletteTarget = null;
  }

  _positionPalette() {
    if (!this.palette || !this.paletteTarget || typeof window === 'undefined') return;
    const r = this.paletteTarget.getBoundingClientRect();
    if (!r.width && !r.height) { this._closePalette(); return; }
    const pw = this.palette.offsetWidth || 248;
    const ph = this.palette.offsetHeight || 290;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;
    this.palette.style.left = Math.max(8, Math.min(vw - pw - 8, r.left)) + 'px';
    this.palette.style.top = (r.bottom + 6 + ph <= vh - 8 ? r.bottom + 6 : Math.max(8, Math.min(vh - ph - 8, r.top - ph - 6))) + 'px';
  }

  cancelSettings() {
    this._closePalette();
    this._previewSettings = null;
    this.modal.classList.remove('show');
    this.scheduleAll();
    this.opener?.focus?.({ preventScroll: true });
  }

  applySettings() {
    try {
      for (const f of QuantaibayEngine.INPUT_SCHEMA) {
        const v = this._previewSettings[f.key];
        if (f.type === 'int' || f.type === 'float') {
          if (!Number.isFinite(v) || (f.type === 'int' && !Number.isInteger(v))
              || (f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) {
            throw new Error(`Giá trị không hợp lệ ở "${f.label}" (${f.min} – ${f.max})`);
          }
        }
      }
      this.settings = { ...this._previewSettings };
      this._previewSettings = null;
      this._writeStorage();
      this._closePalette();
      this.modal.classList.remove('show');
      this.scheduleAll();
      this.opener?.focus?.({ preventScroll: true });
    } catch (err) {
      this.modal.querySelector('.qt-settings-error').textContent = err.message;
    }
  }

  _renderBody() {
    this._closePalette();
    const body = this.modal.querySelector('.qt-settings-body');
    body.replaceChildren();

    const sticky = document.createElement('div');
    sticky.className = 'qt-filter-sticky';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'qt-search';
    search.placeholder = 'Tìm nhanh setting (SSMT, AMDX, True Open, PSP, Table...)';
    sticky.appendChild(search);

    const categories = [
      ['general', 'General', new Set(['General'])],
      ['ssmt', 'SSMT', new Set(['SSMT Display', 'SSMT Style'])],
      ['cycle', 'Cycles & Q', new Set(['Cycle Lines / Q Labels', 'AMDX / XAMD'])],
      ['trueopen', 'True Open', new Set(['True Open', 'True Open Style'])],
      ['psp', 'PSP', new Set(['Advanced PSP'])],
      ['table', 'Cycle Table', new Set(['Cycle Table'])]
    ];
    let activeCat = categories.some(c => c[0] === this._activeInputCat) ? this._activeInputCat : 'general';
    this._activeInputCat = activeCat;
    const ICONS = {
      general: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
      ssmt: '<path d="M3 17l5-6 4 3 5-8 4 5"/><path d="M3 21h18" opacity=".45"/>',
      cycle: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
      trueopen: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
      psp: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5" opacity=".6"/>',
      table: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18M9 10v10M15 10v10"/>'
    };
    const tabs = document.createElement('div');
    tabs.className = 'qt-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Nhóm cài đặt QT');
    const thumb = document.createElement('span');
    thumb.className = 'qt-tab-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    tabs.appendChild(thumb);
    const list = document.createElement('div');

    const placeThumb = (animate = true) => {
      const el = tabs.querySelector('.qt-tab.active');
      if (!el || !el.offsetWidth) return;
      if (!animate) thumb.style.transition = 'none';
      thumb.style.width = el.offsetWidth + 'px';
      thumb.style.transform = `translateX(${el.offsetLeft}px)`;
      if (!animate) { void thumb.offsetWidth; thumb.style.transition = ''; }
      const l = el.offsetLeft, r = l + el.offsetWidth;
      if (l < tabs.scrollLeft + 8) tabs.scrollTo({ left: Math.max(0, l - 12), behavior: animate ? 'smooth' : 'auto' });
      else if (r > tabs.scrollLeft + tabs.clientWidth - 8) tabs.scrollTo({ left: r - tabs.clientWidth + 12, behavior: animate ? 'smooth' : 'auto' });
    };

    const renderFiltered = () => {
      const q = search.value.trim().toLowerCase();
      const catEntry = categories.find(c => c[0] === activeCat) || categories[0];
      const baseFields = q
        ? QuantaibayEngine.INPUT_SCHEMA
        : QuantaibayEngine.INPUT_SCHEMA.filter(f => catEntry[2].has(f.group));
      list.replaceChildren();
      this._renderSchemaFields(list, baseFields, q);
      tabs.classList.toggle('is-searching', !!q);
    };

    const tabEls = [];
    for (const [id, title, groups] of categories) {
      const count = QuantaibayEngine.INPUT_SCHEMA.filter(f => groups.has(f.group)).length;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'qt-tab' + (id === activeCat ? ' active' : '');
      tab.id = 'qt-tab-' + id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', id === activeCat ? 'true' : 'false');
      tab.tabIndex = id === activeCat ? 0 : -1;
      tab.innerHTML = `<svg class="qt-tab-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id] || ''}</svg><span class="qt-tab-label"></span><em class="qt-tab-count"></em>`;
      tab.querySelector('.qt-tab-label').textContent = title;
      tab.querySelector('.qt-tab-count').textContent = count;
      tab.onclick = () => {
        activeCat = id;
        this._activeInputCat = id;
        for (const t of tabEls) {
          const on = t === tab;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
        }
        placeThumb(true);
        renderFiltered();
      };
      tab.onkeydown = e => {
        const i = tabEls.indexOf(tab);
        let n = -1;
        if (e.key === 'ArrowRight') n = (i + 1) % tabEls.length;
        else if (e.key === 'ArrowLeft') n = (i - 1 + tabEls.length) % tabEls.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabEls.length - 1;
        if (n < 0) return;
        e.preventDefault();
        tabEls[n].focus();
        tabEls[n].click();
      };
      tabEls.push(tab);
      tabs.appendChild(tab);
    }
    tabs.addEventListener('pointermove', e => {
      const r = tabs.getBoundingClientRect();
      tabs.style.setProperty('--mx', (e.clientX - r.left + tabs.scrollLeft) + 'px');
    }, { passive: true });
    sticky.appendChild(tabs);
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => placeThumb(false)).observe(tabs);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => placeThumb(false));
    body.append(sticky, list);
    renderFiltered();
    search.oninput = renderFiltered;
  }

  _renderSchemaFields(container, fields, query) {
    const filtered = query
      ? fields.filter(f => `${f.label} ${f.group} ${f.key}`.toLowerCase().includes(query))
      : fields;

    let curGroup = null;
    let i = 0;
    while (i < filtered.length) {
      const field = filtered[i];
      if (field.group !== curGroup) {
        curGroup = field.group;
        const h = document.createElement('div');
        h.className = 'qt-group-heading';
        h.textContent = curGroup;
        container.appendChild(h);
      }
      if (field.inline && !query) {
        const inlineKey = field.inline;
        const row = document.createElement('div');
        row.className = 'qt-inline-row';
        while (i < filtered.length && filtered[i].group === curGroup && filtered[i].inline === inlineKey) {
          row.appendChild(this._createControl(filtered[i], true));
          i++;
        }
        container.appendChild(row);
      } else {
        container.appendChild(this._createControl(field, false));
        i++;
      }
    }
  }

  _createControl(descriptor, compact) {
    const { key, type, label, tooltip, options, min, max, step } = descriptor;
    const target = this._previewSettings;
    const val = target[key] ?? QuantaibayEngine.DEFAULTS[key];

    const wrap = document.createElement('label');
    wrap.className = compact ? 'qt-inline-item' : 'qt-row';
    if (tooltip) wrap.title = tooltip;

    const text = document.createElement('span');
    text.textContent = label;

    if (type === 'color') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chart-color tv-indi-color';
      btn.dataset.inputKey = key;
      btn.setAttribute('aria-label', label);
      const swatch = document.createElement('span');
      swatch.style.background = QuantaibayEngine.parseColor(val).css;
      btn.appendChild(swatch);
      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this._openColorPopover(btn, swatch, key, label);
      };
      wrap.append(text, btn);
      return wrap;
    }

    if (options?.length) {
      const sel = document.createElement('select');
      sel.dataset.inputKey = key;
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = String(opt);
        o.textContent = String(opt);
        sel.appendChild(o);
      }
      sel.value = String(val);
      sel.onchange = () => {
        target[key] = sel.value;
        this.scheduleAll();
      };
      wrap.append(text, sel);
      return wrap;
    }

    const inp = document.createElement('input');
    inp.dataset.inputKey = key;
    if (type === 'bool') {
      inp.type = 'checkbox';
      inp.checked = !!val;
      inp.onchange = () => {
        target[key] = inp.checked;
        this.scheduleAll();
      };
      if (compact) wrap.append(inp, text);
      else wrap.append(text, inp);
      return wrap;
    }

    inp.type = (type === 'int' || type === 'float') ? 'number' : 'text';
    inp.value = String(val ?? '');
    if (inp.type === 'number') {
      inp.step = step ?? (type === 'int' ? 1 : 'any');
      if (min !== undefined) inp.min = min;
      if (max !== undefined) inp.max = max;
    }
    inp.oninput = () => {
      const next = (type === 'int' || type === 'float') ? Number(inp.value) : inp.value;
      target[key] = next;
      if (Number.isFinite(next) || (type !== 'int' && type !== 'float')) this.scheduleAll();
    };
    wrap.append(text, inp);
    return wrap;
  }

  _openColorPopover(button, swatch, key, label) {
    this._openCustomColorPopover(
      button,
      swatch,
      () => this._previewSettings[key] ?? QuantaibayEngine.DEFAULTS[key],
      ({ hexAlpha }) => {
        this._previewSettings[key] = hexAlpha;
        this.scheduleAll();
      },
      label
    );
  }

  _openCustomColorPopover(button, swatch, getValue, onValueChange, label) {
    if (this.palette && this.paletteTarget === button) {
      this._closePalette();
      return;
    }
    this._closePalette();
    const pop = document.createElement('div');
    pop.className = 'tv-style-popover tv-indi-popover';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', label + ' color');
    this.palette = pop;
    this.paletteTarget = button;
    button.classList.add('active');

    const current = getValue();
    if (typeof ColorPicker !== 'undefined' && ColorPicker.mount) {
      ColorPicker.mount(pop, {
        value: current,
        showOpacity: true,
        onChange: ({ hexAlpha, css }) => {
          swatch.style.background = css;
          onValueChange({ hexAlpha, css });
        }
      });
    } else {
      const parsed = QuantaibayEngine.parseColor(current);
      const cInp = document.createElement('input');
      cInp.type = 'color';
      cInp.value = parsed.hex;
      cInp.oninput = () => {
        const hexAlpha = cInp.value + 'ff';
        swatch.style.background = cInp.value;
        onValueChange({ hexAlpha, css: cInp.value });
      };
      pop.appendChild(cInp);
    }

    this.modal.appendChild(pop);
    this._positionPalette();
    if (typeof ResizeObserver !== 'undefined') {
      this._paletteObserver = new ResizeObserver(() => this._positionPalette());
      this._paletteObserver.observe(pop);
    }
  }
}

if (typeof window !== 'undefined') window.QTMode = QTMode;
if (typeof module !== 'undefined') module.exports = QTMode;
