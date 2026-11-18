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
    if (!saved.v3 && Array.isArray(QuantaibayEngine.TRUE_OPEN_ITEMS)) {
      for (const it of QuantaibayEngine.TRUE_OPEN_ITEMS) {
        const id = it.id;
        if (it.tier === 1 && rawSettings.tr90 === false && rawSettings[id] === undefined) rawSettings[id] = false;
        if (rawSettings.trCol !== undefined && rawSettings[id + '_col'] === undefined) rawSettings[id + '_col'] = rawSettings.trCol;
        if (rawSettings.trCol !== undefined && rawSettings[id + '_txt'] === undefined) rawSettings[id + '_txt'] = rawSettings.trCol;
        if (rawSettings.trStyleIn !== undefined && rawSettings[id + '_st'] === undefined) rawSettings[id + '_st'] = rawSettings.trStyleIn;
        if (rawSettings.trWid !== undefined && rawSettings[id + '_wid'] === undefined) rawSettings[id + '_wid'] = rawSettings.trWid;
        if (rawSettings.trShowLbl !== undefined && rawSettings[id + '_lbl'] === undefined) rawSettings[id + '_lbl'] = rawSettings.trShowLbl;
        if (rawSettings.trLblPos !== undefined && rawSettings[id + '_pos'] === undefined) rawSettings[id + '_pos'] = rawSettings.trLblPos;
        if (rawSettings.trLblVert !== undefined && rawSettings[id + '_vert'] === undefined) rawSettings[id + '_vert'] = rawSettings.trLblVert;
        if (rawSettings.trLblSizeIn !== undefined && rawSettings[id + '_sz'] === undefined) rawSettings[id + '_sz'] = rawSettings.trLblSizeIn;
        if (rawSettings.trMaxKeep !== undefined && rawSettings[id + '_keep'] === undefined) rawSettings[id + '_keep'] = rawSettings.trMaxKeep;
      }
    }
    this.enabled = saved.enabled !== false;
    this.settings = { ...QuantaibayEngine.DEFAULTS, ...rawSettings };
    this.visibility = { ...(saved.visibility || {}) };
    this.chartHidden = new Set(Array.isArray(saved.chartHidden) ? saved.chartHidden : []);

    this._raf = 0;
    this._dirtyCharts = new Set();
    this._chartMeta = new WeakMap();
    this.palette = null;
    this.paletteTarget = null;

    this._injectStyles();
    this._buildModal();
    this._bindCharts();
    if (!saved.v2 || !saved.v3) this._writeStorage();
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
      v3: true,
      enabled: this.enabled,
      settings: this.settings,
      visibility: this.visibility,
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
        width: 610px;
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
      .qt-tabs {
        display: flex;
        gap: 20px;
        padding: 0 20px;
        border-bottom: 1px solid #2a2e39;
        background: #1e222d;
      }
      .qt-tabs button {
        padding: 10px 2px;
        background: transparent;
        color: #868993;
        border: 0;
        border-bottom: 2px solid transparent;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
      }
      .qt-tabs button.active {
        color: #ffffff;
        border-bottom-color: #2962ff;
      }
      .qt-settings-body {
        overflow-y: auto;
        min-height: 240px;
        max-height: 64vh;
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
      .qt-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .qt-chip {
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid #303544;
        background: #161a25;
        color: #94a3b8;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all .14s ease;
      }
      .qt-chip:hover {
        color: #e2e8f0;
        border-color: #475569;
      }
      .qt-chip.active {
        background: rgba(41, 98, 255, 0.22);
        border-color: rgba(82, 140, 255, 0.65);
        color: #93c5fd;
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
      .qt-to-bulk {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        margin: 6px 0 10px;
        background: rgba(41, 98, 255, 0.08);
        border: 1px solid rgba(82, 140, 255, 0.28);
        border-radius: 8px;
        font-size: 12px;
        color: #cbd5e1;
      }
      .qt-to-bulk-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .qt-to-mini-btn {
        padding: 4px 8px;
        border-radius: 5px;
        border: 1px solid #363c4e;
        background: #161a25;
        color: #cbd5e1;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .qt-to-mini-btn:hover {
        border-color: #64748b;
        color: #ffffff;
      }
      .qt-to-mini-btn.primary {
        background: rgba(41, 98, 255, 0.25);
        border-color: rgba(82, 140, 255, 0.6);
        color: #93c5fd;
      }
      .qt-to-card {
        background: #161a25;
        border: 1px solid #2b3040;
        border-radius: 8px;
        padding: 8px 11px;
        margin-bottom: 8px;
        transition: border-color .14s, opacity .14s;
      }
      .qt-to-card:hover {
        border-color: #3b4258;
      }
      .qt-to-card.is-off {
        opacity: 0.52;
      }
      .qt-to-line-row, .qt-to-lbl-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 10px;
      }
      .qt-to-lbl-row {
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px dashed rgba(255, 255, 255, 0.07);
        font-size: 12px;
        color: #94a3b8;
      }
      .qt-to-lbl-row.is-off .qt-to-ctrls {
        opacity: 0.45;
      }
      .qt-to-title {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
      }
      .qt-to-code {
        font-weight: 700;
        font-size: 13px;
        color: #f1f5f9;
        letter-spacing: 0.02em;
      }
      .qt-to-sub {
        font-size: 11.5px;
        color: #7c8599;
      }
      .qt-to-ctrls {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .qt-to-ctrls select, .qt-to-bulk select,
      .qt-to-ctrls input[type="number"] {
        background: #11151f;
        border: 1px solid #323848;
        border-radius: 5px;
        color: #e2e8f0;
        padding: 4px 6px;
        font-size: 12px;
        height: 28px;
      }
      .qt-to-ctrls input[type="number"] {
        width: 52px;
        text-align: center;
      }
      .qt-to-keep-wrap {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11.5px;
        color: #8b93a7;
      }
      .qt-to-title input[type="checkbox"] {
        width: 15px;
        height: 15px;
        accent-color: #2962ff;
        cursor: pointer;
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
    // Clone node to strip any legacy IndicatorLibrary click listeners cleanly
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

    // Remove old #btn-indicator-settings if present and mount clean #btn-qt-settings
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

    // Keep #indicator-modal hidden/inert in DOM instead of removing it, because PaperPanel
    // attaches a MutationObserver to document.getElementById('indicator-modal') on startup.
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
    // Keep #indicator-modal hidden/inert in DOM instead of removing it, because PaperPanel
    // attaches a MutationObserver to document.getElementById('indicator-modal') on startup.
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
      // Disable any legacy IndicatorCollection workers so only QT Mode runs
      try { chart.runner?.stop?.(); } catch {}
      chart.clearCustomSeries?.();

      // Create dedicated Cycle Table overlay layer (no corner indicator legend pill)
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

      // Fast O(k) Q-label Y pinning + spanning HTF True Open X pinning on scroll/zoom without recalculating SSMT
      chart.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        const meta = this._chartMeta.get(chart);
        if (!meta || !chart.bars?.length || (!meta.qLabels?.length && !meta.trLabels?.length)) return;
        if (meta.qLabels?.length) QuantaibayEngine.pinQLabels(meta.qLabels, chart.bars, range, meta.labelPadPct);
        if (meta.trLabels?.length) QuantaibayEngine.pinTrueOpenLabels?.(meta.trLabels, chart.bars, range, chart.tfSeconds);
        chart.renderDrawings();
      });
    }
  }

  scheduleAll() {
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

  _activeVisibility() {
    return this._previewVisibility || this.visibility;
  }

  renderChart(chart) {
    const meta = this._chartMeta.get(chart);
    if (!meta) return;
    const s = this._activeSettings();
    const vis = this._activeVisibility();
    const tfAllowed = vis[chart.currentTimeframe] !== false;
    const showOnChart = this.enabled && !this.chartHidden.has(chart.id) && tfAllowed;

    if (!showOnChart || !chart.bars?.length) {
      chart.indicatorDrawings = [];
      if (meta.candleColorSig) {
        meta.candleColorSig = '';
        chart.indicatorCandleColors = new Map();
        chart.renderCandleData?.();
      }
      meta.qLabels = [];
      meta.trLabels = [];
      meta.tableLayer.replaceChildren();
      chart.renderDrawings();
      return;
    }

    const rawMarkets = this.getMarkets();
    const marketsObj = rawMarkets instanceof Map ? Object.fromEntries(rawMarkets) : (rawMarkets || {});
    const logicalRange = chart.chart.timeScale().getVisibleLogicalRange();
    const chartBg = chart.appearance?.bg || chart.appearance?.background || chart.config?.bg || '#c2baae';
    const sessionMode = chart.appearance?.sessionMode || 'ETH';

    // Request 6h / D / peer HTF native/derived data if needed and missing
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
      meta.candleColorSig = nextSig;
      chart.indicatorCandleColors = new Map(nextColors.map(x => [x.time, x.color]));
      chart.renderCandleData?.();
    }

    meta.qLabels = out.qLabels || [];
    meta.trLabels = out.trLabels || [];
    meta.labelPadPct = out.labelPadPct ?? 8;
    chart.indicatorDrawings = out.drawings;
    this._renderTables(meta.tableLayer, out.tables, chart);
    chart.renderDrawings();
  }

  _renderTables(layer, tables, chart) {
    layer.replaceChildren();
    if (!tables?.length) return;
    const axisRight = (chart.chart?.priceScale?.('right')?.width?.() || 65) + 8;
    const axisBottom = (chart.chart?.timeScale?.().height?.() || 26) + 8;

    // Clear floating topbar dock when chart sits at the top edge of viewport
    let topInset = 10;
    const topbar = document.getElementById('topbar');
    if (topbar && !topbar.hidden) {
      const tbRect = topbar.getBoundingClientRect();
      const chRect = chart.container.getBoundingClientRect();
      if (tbRect.height > 0 && chRect.top < tbRect.bottom + 4 && tbRect.bottom - chRect.top < 110) {
        topInset = Math.max(10, Math.ceil(tbRect.bottom - chRect.top + 8));
      }
    }

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
        <div class="qt-tabs" role="tablist">
          <button type="button" role="tab" data-qt-tab="inputs" class="active">Inputs</button>
          <button type="button" role="tab" data-qt-tab="style">Style & Colors</button>
          <button type="button" role="tab" data-qt-tab="visibility">Visibility</button>
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
      if (this.currentTab === 'visibility') {
        this._previewVisibility = {};
      } else {
        this._previewSettings = { ...QuantaibayEngine.DEFAULTS };
      }
      this._renderTab(this.currentTab);
      this.scheduleAll();
    };

    for (const btn of modal.querySelectorAll('[data-qt-tab]')) {
      btn.onclick = () => this._renderTab(btn.dataset.qtTab);
    }

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

    // Capture-phase Escape handler ensures pressing Escape anywhere while QT Settings is open
    // cleanly reverts _previewSettings instead of leaking draft state via global closeModal
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
    this._previewVisibility = { ...this.visibility };
    this.modal.querySelector('.qt-settings-error').textContent = '';
    this.modal.classList.add('show');
    this._renderTab(this.currentTab || 'inputs');
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
    this._previewVisibility = null;
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
      this.visibility = { ...this._previewVisibility };
      this._previewSettings = null;
      this._previewVisibility = null;
      this._writeStorage();
      this._closePalette();
      this.modal.classList.remove('show');
      this.scheduleAll();
      this.opener?.focus?.({ preventScroll: true });
    } catch (err) {
      this.modal.querySelector('.qt-settings-error').textContent = err.message;
    }
  }

  _renderTab(tab) {
    this.currentTab = tab;
    this._closePalette();
    for (const b of this.modal.querySelectorAll('[data-qt-tab]')) {
      const sel = b.dataset.qtTab === tab;
      b.classList.toggle('active', sel);
      b.setAttribute('aria-selected', String(sel));
    }
    const body = this.modal.querySelector('.qt-settings-body');
    body.replaceChildren();

    if (tab === 'inputs') {
      const sticky = document.createElement('div');
      sticky.className = 'qt-filter-sticky';
      const search = document.createElement('input');
      search.type = 'search';
      search.className = 'qt-search';
      search.placeholder = 'Tìm nhanh setting (SSMT, AMDX, True Open, PSP, Table...)';
      sticky.appendChild(search);

      const categories = [
        ['all', 'Tất cả', null],
        ['general', 'General', new Set(['General'])],
        ['ssmt', 'SSMT', new Set(['SSMT Display', 'SSMT Style'])],
        ['cycle', 'Cycles & Q', new Set(['Cycle Lines / Q Labels', 'AMDX / XAMD'])],
        ['trueopen', 'True Open', new Set(['True Open', 'True Open Style'])],
        ['psp', 'PSP', new Set(['Advanced PSP'])],
        ['table', 'Cycle Table', new Set(['Cycle Table'])]
      ];
      let activeCat = this._activeInputCat || 'all';
      const chips = document.createElement('div');
      chips.className = 'qt-chips';
      const list = document.createElement('div');

      const renderFiltered = () => {
        const q = search.value.trim().toLowerCase();
        const catEntry = categories.find(c => c[0] === activeCat) || categories[0];
        const baseFields = catEntry[2]
          ? QuantaibayEngine.INPUT_SCHEMA.filter(f => catEntry[2].has(f.group))
          : QuantaibayEngine.INPUT_SCHEMA;
        list.replaceChildren();
        this._renderSchemaFields(list, baseFields, q);
      };

      for (const [id, title] of categories) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'qt-chip' + (id === activeCat ? ' active' : '');
        chip.textContent = title;
        chip.onclick = () => {
          activeCat = id;
          this._activeInputCat = id;
          for (const c of chips.children) c.classList.toggle('active', c === chip);
          renderFiltered();
        };
        chips.appendChild(chip);
      }
      sticky.appendChild(chips);
      body.append(sticky, list);
      renderFiltered();
      search.oninput = renderFiltered;
    } else if (tab === 'style') {
      // Focused view of all colors, line styles, widths, sizes, and master layer switches
      const styleGroups = new Set(['SSMT Style', 'Cycle Lines / Q Labels', 'Cycle Table', 'True Open', 'Advanced PSP']);
      const styleFields = QuantaibayEngine.INPUT_SCHEMA.filter(f =>
        styleGroups.has(f.group) || ['showSsmt', 'showSsmtTxt', 'useAMDX'].includes(f.key)
      );
      this._renderSchemaFields(body, styleFields, '');
    } else {
      const head = document.createElement('div');
      head.className = 'qt-group-heading';
      head.textContent = 'Hiển thị QT Mode theo khung thời gian';
      body.appendChild(head);
      const tfs = typeof MarketData !== 'undefined' ? Object.keys(MarketData.durations) : ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', 'D', 'W'];
      for (const tf of tfs) {
        const row = document.createElement('label');
        row.className = 'qt-row';
        const span = document.createElement('span');
        span.textContent = tf;
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = this._previewVisibility[tf] !== false;
        chk.onchange = () => {
          this._previewVisibility[tf] = chk.checked;
          this.scheduleAll();
        };
        row.append(span, chk);
        body.appendChild(row);
      }
    }
  }

  _renderSchemaFields(container, fields, query) {
    const toItems = QuantaibayEngine.TRUE_OPEN_ITEMS || [];
    const toMap = new Map(toItems.map(it => [it.id, it]));
    const filtered = query
      ? fields.filter(f => {
          const it = f.toItem ? toMap.get(f.toItem) : null;
          const extra = it ? `${it.code} ${it.label} ${it.short}` : '';
          return `${f.label} ${f.group} ${f.key} ${extra}`.toLowerCase().includes(query);
        })
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
      if (field.toItem) {
        const matchedIds = new Set();
        while (i < filtered.length && filtered[i].group === curGroup && filtered[i].toItem) {
          matchedIds.add(filtered[i].toItem);
          i++;
        }
        this._renderTrueOpenSection(container, toItems.filter(it => matchedIds.has(it.id)), !query);
      } else if (field.inline && !query) {
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

  _renderTrueOpenSection(container, items, showBulkBar = true) {
    const target = this._previewSettings;
    const wrap = document.createElement('div');

    const rerenderSection = () => {
      const fresh = document.createElement('div');
      this._renderTrueOpenSection(fresh, items, showBulkBar);
      wrap.replaceWith(...fresh.childNodes);
    };

    if (showBulkBar && items.length > 1) {
      const bulk = document.createElement('div');
      bulk.className = 'qt-to-bulk';
      const title = document.createElement('span');
      title.innerHTML = '<strong>Đồng bộ nhanh</strong> <span style="opacity:.75">(áp dụng cho tất cả True Open)</span>';

      const actions = document.createElement('div');
      actions.className = 'qt-to-bulk-actions';

      const btnAllOn = document.createElement('button');
      btnAllOn.type = 'button';
      btnAllOn.className = 'qt-to-mini-btn';
      btnAllOn.textContent = 'Bật hết';
      btnAllOn.onclick = () => {
        for (const it of items) target[it.id] = true;
        this.scheduleAll();
        rerenderSection();
      };

      const btnAllOff = document.createElement('button');
      btnAllOff.type = 'button';
      btnAllOff.className = 'qt-to-mini-btn';
      btnAllOff.textContent = 'Tắt hết';
      btnAllOff.onclick = () => {
        for (const it of items) target[it.id] = false;
        this.scheduleAll();
        rerenderSection();
      };

      let bulkColor = target[items[0].id + '_col'] ?? '#2962ffff';
      const bulkColorBtn = document.createElement('button');
      bulkColorBtn.type = 'button';
      bulkColorBtn.className = 'chart-color tv-indi-color';
      bulkColorBtn.title = 'Chọn màu chung cho tất cả True Open';
      const bulkSwatch = document.createElement('span');
      bulkSwatch.style.background = QuantaibayEngine.parseColor(bulkColor).css;
      bulkColorBtn.appendChild(bulkSwatch);
      bulkColorBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this._openCustomColorPopover(bulkColorBtn, bulkSwatch, () => bulkColor, ({ hexAlpha }) => {
          bulkColor = hexAlpha;
          for (const it of items) {
            target[it.id + '_col'] = hexAlpha;
            target[it.id + '_txt'] = hexAlpha;
          }
          this.scheduleAll();
          for (const sw of wrap.querySelectorAll('[data-to-swatch]')) {
            sw.style.background = QuantaibayEngine.parseColor(hexAlpha).css;
          }
        }, 'All True Open');
      };

      const bulkStyle = document.createElement('select');
      bulkStyle.title = 'Đổi kiểu đường cho tất cả True Open';
      for (const [val, txt] of [['', 'Kiểu chung…'], ['Solid', '━━ Solid'], ['Dashed', '┅┅ Dashed'], ['Dotted', '┈┈ Dotted']]) {
        bulkStyle.add(new Option(txt, val));
      }
      bulkStyle.onchange = () => {
        if (!bulkStyle.value) return;
        for (const it of items) target[it.id + '_st'] = bulkStyle.value;
        this.scheduleAll();
        rerenderSection();
      };

      const bulkVert = document.createElement('select');
      bulkVert.title = 'Đổi vị trí nhãn cho tất cả True Open';
      for (const [val, txt] of [['', 'Vị trí chữ…'], ['Above', 'Above'], ['On line', 'On line'], ['Below', 'Below']]) {
        bulkVert.add(new Option(txt, val));
      }
      bulkVert.onchange = () => {
        if (!bulkVert.value) return;
        for (const it of items) target[it.id + '_vert'] = bulkVert.value;
        this.scheduleAll();
        rerenderSection();
      };

      actions.append(btnAllOn, btnAllOff, bulkColorBtn, bulkStyle, bulkVert);
      bulk.append(title, actions);
      wrap.appendChild(bulk);
    }

    const mkSelect = (key, opts, title) => {
      const sel = document.createElement('select');
      sel.dataset.inputKey = key;
      if (title) sel.title = title;
      for (const entry of opts) {
        const [v, t] = Array.isArray(entry) ? entry : [entry, entry];
        sel.add(new Option(String(t), String(v)));
      }
      sel.value = String(target[key] ?? QuantaibayEngine.DEFAULTS[key]);
      sel.onchange = () => {
        target[key] = key.endsWith('_wid') ? Number(sel.value) : sel.value;
        this.scheduleAll();
      };
      return sel;
    };

    for (const it of items) {
      const id = it.id;
      const card = document.createElement('div');
      card.className = 'qt-to-card' + (target[id] === false ? ' is-off' : '');
      card.dataset.toCard = id;

      // ---- Row 1: Enable + Title | Line Color + Line Style + Width + Keep ----
      const lineRow = document.createElement('div');
      lineRow.className = 'qt-to-line-row';

      const titleLbl = document.createElement('label');
      titleLbl.className = 'qt-to-title';
      const chkEn = document.createElement('input');
      chkEn.type = 'checkbox';
      chkEn.dataset.inputKey = id;
      chkEn.checked = target[id] !== false;
      chkEn.onchange = () => {
        target[id] = chkEn.checked;
        card.classList.toggle('is-off', !chkEn.checked);
        this.scheduleAll();
      };
      const codeEl = document.createElement('span');
      codeEl.className = 'qt-to-code';
      codeEl.textContent = it.code;
      const subEl = document.createElement('span');
      subEl.className = 'qt-to-sub';
      subEl.textContent = it.short;
      titleLbl.append(chkEn, codeEl, subEl);

      const lineCtrls = document.createElement('div');
      lineCtrls.className = 'qt-to-ctrls';

      let txtSwatchRef = null;
      const lineColorBtn = document.createElement('button');
      lineColorBtn.type = 'button';
      lineColorBtn.className = 'chart-color tv-indi-color';
      lineColorBtn.dataset.inputKey = id + '_col';
      lineColorBtn.title = `${it.code} — Màu đường kẻ`;
      lineColorBtn.setAttribute('aria-label', `${it.code} Line Color`);
      const lineSwatch = document.createElement('span');
      lineSwatch.dataset.toSwatch = id + '_col';
      lineSwatch.style.background = QuantaibayEngine.parseColor(target[id + '_col'] ?? QuantaibayEngine.DEFAULTS[id + '_col']).css;
      lineColorBtn.appendChild(lineSwatch);
      lineColorBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this._openCustomColorPopover(
          lineColorBtn,
          lineSwatch,
          () => target[id + '_col'] ?? QuantaibayEngine.DEFAULTS[id + '_col'],
          ({ hexAlpha, css }) => {
            const prevLine = target[id + '_col'] ?? QuantaibayEngine.DEFAULTS[id + '_col'];
            const prevTxt = target[id + '_txt'] ?? QuantaibayEngine.DEFAULTS[id + '_txt'];
            target[id + '_col'] = hexAlpha;
            if (String(prevTxt).toLowerCase() === String(prevLine).toLowerCase()) {
              target[id + '_txt'] = hexAlpha;
              if (txtSwatchRef) txtSwatchRef.style.background = css;
            }
            this.scheduleAll();
          },
          `${it.code} Line`
        );
      };

      const styleSel = mkSelect(id + '_st', [['Solid', '━━ Solid'], ['Dashed', '┅┅ Dashed'], ['Dotted', '┈┈ Dotted']], `${it.code} — Kiểu đường (Solid / Dashed / Dotted)`);
      const widSel = mkSelect(id + '_wid', [[1, '1px'], [2, '2px'], [3, '3px'], [4, '4px'], [5, '5px']], `${it.code} — Độ dày đường`);

      const keepWrap = document.createElement('label');
      keepWrap.className = 'qt-to-keep-wrap';
      keepWrap.title = `${it.code} — Số chu kỳ giữ lại (1 = chỉ hiện chu kỳ đang chạy)`;
      keepWrap.textContent = 'Giữ';
      const keepInp = document.createElement('input');
      keepInp.type = 'number';
      keepInp.min = '1';
      keepInp.max = '100';
      keepInp.step = '1';
      keepInp.dataset.inputKey = id + '_keep';
      keepInp.value = String(target[id + '_keep'] ?? QuantaibayEngine.DEFAULTS[id + '_keep']);
      keepInp.oninput = () => {
        const v = Number(keepInp.value);
        target[id + '_keep'] = v;
        if (Number.isFinite(v) && v >= 1) this.scheduleAll();
      };
      keepWrap.appendChild(keepInp);

      lineCtrls.append(lineColorBtn, styleSel, widSel, keepWrap);
      lineRow.append(titleLbl, lineCtrls);

      // ---- Row 2: Show Label | Text Color + Horizontal + Vertical + Font Size ----
      const lblRow = document.createElement('div');
      lblRow.className = 'qt-to-lbl-row' + (target[id + '_lbl'] === false ? ' is-off' : '');

      const lblToggle = document.createElement('label');
      lblToggle.className = 'qt-to-title';
      const chkLbl = document.createElement('input');
      chkLbl.type = 'checkbox';
      chkLbl.dataset.inputKey = id + '_lbl';
      chkLbl.checked = target[id + '_lbl'] !== false;
      chkLbl.onchange = () => {
        target[id + '_lbl'] = chkLbl.checked;
        lblRow.classList.toggle('is-off', !chkLbl.checked);
        this.scheduleAll();
      };
      const lblSpan = document.createElement('span');
      lblSpan.textContent = `Hiện chữ "${it.code}"`;
      lblToggle.append(chkLbl, lblSpan);

      const lblCtrls = document.createElement('div');
      lblCtrls.className = 'qt-to-ctrls';

      const txtColorBtn = document.createElement('button');
      txtColorBtn.type = 'button';
      txtColorBtn.className = 'chart-color tv-indi-color';
      txtColorBtn.dataset.inputKey = id + '_txt';
      txtColorBtn.title = `${it.code} — Màu chữ riêng`;
      txtColorBtn.setAttribute('aria-label', `${it.code} Text Color`);
      const txtSwatch = document.createElement('span');
      txtSwatch.dataset.toSwatch = id + '_txt';
      txtSwatch.style.background = QuantaibayEngine.parseColor(target[id + '_txt'] ?? QuantaibayEngine.DEFAULTS[id + '_txt']).css;
      txtColorBtn.appendChild(txtSwatch);
      txtSwatchRef = txtSwatch;
      txtColorBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this._openColorPopover(txtColorBtn, txtSwatch, id + '_txt', `${it.code} Text`);
      };

      const posSel = mkSelect(id + '_pos', [['Left', 'Trái (Left)'], ['Mid', 'Giữa (Mid)'], ['Right', 'Phải (Right)']], `${it.code} — Vị trí ngang của chữ`);
      const vertSel = mkSelect(id + '_vert', [['Above', 'Trên (Above)'], ['On line', 'Đè dây (On line)'], ['Below', 'Dưới (Below)']], `${it.code} — Vị trí dọc của chữ`);
      const szSel = mkSelect(id + '_sz', ['Tiny', 'Small', 'Normal', 'Large'], `${it.code} — Cỡ chữ`);

      lblCtrls.append(txtColorBtn, posSel, vertSel, szSel);
      lblRow.append(lblToggle, lblCtrls);

      card.append(lineRow, lblRow);
      wrap.appendChild(card);
    }

    container.appendChild(wrap);
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
