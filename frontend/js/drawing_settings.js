class DrawingSettings {
  static PALETTE = [
    '#ffffff', '#e0e3eb', '#b2b5be', '#9598a1', '#787b86', '#5d606b', '#434651', '#2a2e39', '#1e222d', '#000000',
    '#f23645', '#ff9800', '#fbc02d', '#4caf50', '#089981', '#00bcd4', '#2962ff', '#673ab7', '#9c27b0', '#e91e63',
    '#fccbcd', '#ffe0b2', '#fff9c4', '#c8e6c9', '#ace5dc', '#b2ebf2', '#bbd9fb', '#d1c4e9', '#e1bee7', '#f8bbd0',
    '#f77c80', '#ffb74d', '#fff176', '#81c784', '#66d3c1', '#4dd0e1', '#5b9cf6', '#9575cd', '#ba68c8', '#f06292',
    '#cc2936', '#e65100', '#f9a825', '#2e7d32', '#067361', '#00838f', '#1848cc', '#512da8', '#7b1fa2', '#c2185b',
    '#801922', '#8a3100', '#8d6e00', '#1b5e20', '#03453a', '#004d54', '#0c3299', '#311b92', '#4a148c', '#880e4f'
  ];

  static STROKE_SPECS = [
    { id: 'border', label: 'Border', types: 'box,line,hline,fib,position,measure,brush', colorPath: 'borderColor', opacityPath: 'strokeOpacity', widthPath: 'width', stylePath: 'lineStyle', syncColor: true },
    { id: 'middleLine', label: 'Middle line', types: 'box', checkPath: 'middleLine.enabled', colorPath: 'middleLine.color', opacityPath: 'middleLine.opacity', widthPath: 'middleLine.width', stylePath: 'middleLine.style' },
    { id: 'fill', label: 'Background', types: 'box,measure', checkPath: 'fillEnabled', colorPath: 'fillColor', opacityPath: 'fillOpacity' },
    { id: 'profit', label: 'Profit zone', types: 'position', colorPath: 'profitColor', opacityPath: 'profitOpacity' },
    { id: 'stop', label: 'Stop zone', types: 'position', colorPath: 'stopColor', opacityPath: 'stopOpacity' },
    { id: 'text', label: '', types: 'box,line,hline,text', colorPath: 'textStyle.color' }
  ];

  constructor(editor) {
    this.editor = editor;
    this.pills = new Map();
    this.root = document.createElement('div');
    this.root.className = 'modal drawing-settings';
    this.root.id = 'drawing-settings';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');

    const pillHtml = id => {
      const s = DrawingSettings.STROKE_SPECS.find(x => x.id === id);
      const cls = s.widthPath ? 'tv-pill-btn tv-pill-stroke' : 'tv-pill-btn tv-pill-color';
      const lineSvg = s.widthPath ? '<svg class="tv-stroke-preview" viewBox="0 0 36 14" aria-hidden="true"><line x1="2" y1="7" x2="34" y2="7" stroke="currentColor" stroke-linecap="round"/></svg>' : '';
      return `<button type="button" class="${cls}" data-pill="${id}" aria-haspopup="dialog" aria-label="${s.label || 'Text color'}"><span class="tv-swatch"><span class="tv-swatch-fill"></span></span>${lineSvg}</button>`;
    };
    const tvRow = (labelHtml, controlHtml, types) => `<div data-types="${types}" class="tv-row"><div class="tv-row-label">${labelHtml}</div><div class="tv-row-ctrl">${controlHtml}</div></div>`;
    const check = (label, path) => `<label class="drawing-check"><input data-field="${path}" type="checkbox"><span>${label}</span></label>`;
    const selectOpts = options => options.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    const visRows = Object.entries(DrawingModel.groups).map(([k, max]) =>
      `<div class="visibility-row"><label><input type="checkbox" data-field="visibility.${k}.enabled">${k[0].toUpperCase() + k.slice(1)}</label>${max === 1 ? '' : `<input aria-label="${k} minimum" type="number" data-field="visibility.${k}.min" min="1" max="${max}"><div class="visibility-sliders"><input aria-label="${k} range start" type="range" data-mirror="visibility.${k}.min" min="1" max="${max}"><input aria-label="${k} range end" type="range" data-mirror="visibility.${k}.max" min="1" max="${max}"></div><input aria-label="${k} maximum" type="number" data-field="visibility.${k}.max" min="1" max="${max}">`}</div>`
    ).join('');

    this.root.innerHTML = `<div class="modal-content drawing-dialog">
      <div class="modal-header">
        <div class="drawing-title-wrap">
          <span id="drawing-settings-title"></span>
          <input id="drawing-title-input" type="text" maxlength="64" aria-label="Drawing name" hidden>
          <button type="button" id="drawing-rename" class="drawing-rename-btn" title="Rename" aria-label="Rename drawing"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        </div>
        <button type="button" class="modal-close" aria-label="Đóng setting hình"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="drawing-tabs" role="tablist">${['Style', 'Text', 'Coordinates', 'Visibility'].map((tab, i) => `<button type="button" role="tab" data-tab="${tab.toLowerCase()}" aria-selected="${i === 0}">${tab}</button>`).join('')}</div>
      <div class="modal-body drawing-panel" data-panel="style">
        ${tvRow('<span>Extend</span>', `<select data-field="extend" aria-label="Extend">${selectOpts([['none', "Don't extend"], ['left', 'Extend left'], ['right', 'Extend right'], ['both', 'Extend both']])}</select>`, 'box,line,fib')}
        ${tvRow('<span id="drawing-stroke-label">Border</span>', pillHtml('border'), 'box,line,hline,fib,position,measure,brush')}
        ${tvRow('<label class="tv-check-label"><input data-field="middleLine.enabled" type="checkbox"><span>Middle line</span></label>', pillHtml('middleLine'), 'box')}
        ${tvRow('<label class="tv-check-label"><input data-field="fillEnabled" type="checkbox"><span>Background</span></label>', pillHtml('fill'), 'box,measure')}
        ${tvRow('<span>Profit zone</span>', pillHtml('profit'), 'position')}
        ${tvRow('<span>Stop zone</span>', pillHtml('stop'), 'position')}
        ${tvRow('<span>Position side</span>', `<select data-field="side" aria-label="Position side">${selectOpts([['long', 'Long'], ['short', 'Short']])}</select>`, 'position')}
        ${tvRow('<span>Account size</span>', '<input type="number" step="any" min="1" data-field="accountSize" aria-label="Account size">', 'position')}
        ${tvRow('<span>Risk</span>', `<div class="tv-align-pair"><input type="number" step="any" min="0.01" data-field="risk" aria-label="Risk"><select data-field="riskDisplayMode" aria-label="Risk display mode">${selectOpts([['money', 'Money ($)'], ['percents', 'Percent (%)']])}</select></div>`, 'position')}
        ${tvRow('<span>Stats display</span>', `<div class="drawing-line-stats">${check('Always show stats', 'alwaysShowStats')}${check('Compact stats', 'compact')}${check('Price labels', 'showPriceLabels')}</div>`, 'position')}
        ${tvRow('<span>Levels</span>', '<input id="drawing-levels" type="text" placeholder="0, 0.236, 0.382, 0.5, 0.618, 0.786, 1">', 'fib')}
        <div data-types="line" class="drawing-stats-group"><div class="tv-section-label">Stats</div><div class="drawing-line-stats">${check('Price range', 'stats.price')}${check('Percent change', 'stats.percent')}${check('Bars range', 'stats.bars')}${check('Date / time range', 'stats.time')}${check('Middle point', 'stats.middle')}</div></div>
      </div>
      <div class="modal-body drawing-panel" data-panel="text" hidden>
        <div class="drawing-text-toolbar">
          ${pillHtml('text')}
          <select data-field="textStyle.size" aria-label="Text size">${[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map(n => `<option value="${n}">${n}</option>`).join('')}</select>
          <button type="button" class="tv-format-btn" data-toggle="textStyle.bold" aria-pressed="false" aria-label="Bold"><strong>B</strong></button>
          <button type="button" class="tv-format-btn" data-toggle="textStyle.italic" aria-pressed="false" aria-label="Italic"><em>I</em></button>
        </div>
        <textarea id="drawing-text" aria-label="Drawing text" placeholder="Add text" spellcheck="false"></textarea>
        ${tvRow('<span>Text alignment</span>', `<div class="tv-align-pair"><select data-field="textStyle.vertical" data-types="box,line,hline" aria-label="Vertical alignment">${selectOpts([['inside', 'Inside'], ['above', 'Above'], ['below', 'Below']])}</select><select data-field="textStyle.horizontal" aria-label="Horizontal alignment">${selectOpts([['left', 'Left'], ['center', 'Center'], ['right', 'Right']])}</select></div>`, 'box,line,hline,text')}
      </div>
      <div class="modal-body drawing-panel" data-panel="coordinates" hidden><p class="editor-help">Bar index theo nến đang tải; thời gian của điểm được lưu cố định.</p><div id="drawing-points"></div></div>
      <div class="modal-body drawing-panel" data-panel="visibility" hidden>${visRows}</div>
      <p id="drawing-settings-error" role="alert"></p>
      <div class="modal-footer">
        <button type="button" id="drawing-template" class="tv-template-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="Drawing template"><span>Template</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg></button>
        <button type="button" id="drawing-cancel" class="btn-secondary">Cancel</button>
        <button type="button" id="drawing-apply" class="btn-primary">Ok</button>
      </div>
    </div>`;

    document.body.appendChild(this.root);
    for (const spec of DrawingSettings.STROKE_SPECS) {
      const btn = this.root.querySelector(`[data-pill="${spec.id}"]`);
      this.pills.set(spec.id, { btn, spec });
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.togglePopover(btn, spec);
      });
    }
    this.bindEvents();
  }

  bindEvents() {
    this.root.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => this.tab(button.dataset.tab)));
    this.root.querySelectorAll('[data-field]').forEach(input => input.addEventListener('input', () => this.preview()));
    this.root.querySelectorAll('[data-mirror]').forEach(input => input.addEventListener('input', () => {
      this.root.querySelector(`[data-field="${input.dataset.mirror}"]`).value = input.value;
      this.preview();
    }));
    this.root.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => {
      const next = !this.value(button.dataset.toggle);
      this.assign(button.dataset.toggle, next);
      button.setAttribute('aria-pressed', String(next));
      this.preview();
    }));
    this.root.querySelector('#drawing-text').addEventListener('input', () => this.preview());
    this.root.querySelector('#drawing-levels').addEventListener('input', () => this.preview());
    this.root.querySelector('#drawing-cancel').addEventListener('click', () => this.cancel());
    this.root.querySelector('.modal-close').addEventListener('click', () => this.cancel());
    this.root.addEventListener('click', event => {
      if (this.popover && !this.popover.contains(event.target) && !event.target.closest('.tv-pill-btn')) this.closePopover();
      if (event.target === this.root) this.cancel();
    });
    this.root.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (this.popover) {
          if (typeof ColorPicker === 'undefined' || !ColorPicker.closeActiveSub(this.popover)) this.closePopover();
          return;
        }
        if (!this.root.querySelector('#drawing-title-input').hidden) { this.finishRename(false); return; }
        this.cancel();
      }
      if (event.key === 'Tab') {
        const items = [...this.root.querySelectorAll('input,button,select,textarea')].filter(el => el.getClientRects().length && !el.disabled);
        if (!items.length) return;
        if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
        else if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
      }
    });
    this.root.querySelector('#drawing-apply').addEventListener('click', () => {
      try { this.read(); this.editor.commit(this.draft); this.hide(); } catch (error) { this.error(error.message); }
    });

    const renameBtn = this.root.querySelector('#drawing-rename'), titleInput = this.root.querySelector('#drawing-title-input');
    renameBtn.addEventListener('click', () => {
      this.root.querySelector('#drawing-settings-title').hidden = true;
      renameBtn.hidden = true;
      titleInput.value = this.draft.title || '';
      titleInput.placeholder = DrawingModel.names[this.draft.type] || this.draft.type;
      titleInput.hidden = false;
      titleInput.focus();
      titleInput.select();
    });
    titleInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.finishRename(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.finishRename(false); }
    });
    titleInput.addEventListener('blur', () => { if (!titleInput.hidden) this.finishRename(true); });

    this.root.querySelector('#drawing-template').addEventListener('click', event => {
      event.stopPropagation();
      this.openTemplateMenu(event.currentTarget, { drawing: this.draft, direct: false });
    });
  }

  templateMenuOptions(drawing, direct = false) {
    if (typeof TemplateMenu === 'undefined' || !drawing) return null;
    const applyStyle = (style, isDefault = false) => {
      const target = direct ? drawing : this.draft;
      const next = TemplateMenu.applyDrawingStyle(DrawingModel, target, style, isDefault);
      if (direct) {
        this.editor.commit(next);
      } else {
        this.draft = next;
        this.fill();
        this.editor.preview(this.draft);
      }
    };
    return {
      saveLabel: 'Save as…',
      defaultLabel: 'Apply default',
      getItems: () => TemplateMenu.listDrawingTemplates(Workspace, drawing.type),
      onSaveAs: () => {
        if (!direct) {
          try { this.read(); } catch (error) { this.error(error.message); return; }
        }
        const source = direct ? drawing : this.draft;
        TemplateMenu.openSaveDialog({
          title: `Save ${DrawingModel.names[source.type] || source.type} template`,
          opener: direct ? null : this.root.querySelector('#drawing-template'),
          onSave: name => TemplateMenu.saveDrawingTemplate(Workspace, source.type, name, source)
        });
      },
      onDefault: () => applyStyle(DrawingModel.defaults(drawing.type), true),
      onApply: item => applyStyle(item.data, false),
      onDelete: item => TemplateMenu.deleteDrawingTemplate(Workspace, drawing.type, item.name)
    };
  }

  openTemplateMenu(anchor, { drawing = this.draft, direct = false, prefer = 'above' } = {}) {
    const opts = this.templateMenuOptions(drawing, direct);
    if (opts) TemplateMenu.openPopup({ anchor, prefer, ...opts });
  }

  finishRename(apply) {
    const titleEl = this.root.querySelector('#drawing-settings-title'), renameBtn = this.root.querySelector('#drawing-rename'), input = this.root.querySelector('#drawing-title-input');
    if (input.hidden) return;
    if (apply) {
      this.draft.title = input.value.trim();
      titleEl.textContent = this.draft.title || DrawingModel.names[this.draft.type] || this.draft.type;
      this.preview();
    }
    input.hidden = true;
    titleEl.hidden = false;
    renameBtn.hidden = false;
  }

  tabsFor(type) {
    if (type === 'text') return ['text', 'coordinates', 'visibility'];
    if (['box', 'line', 'hline'].includes(type)) return ['style', 'text', 'coordinates', 'visibility'];
    return ['style', 'coordinates', 'visibility'];
  }

  value(path) { return path.split('.').reduce((value, key) => value?.[key], this.draft); }
  assign(path, value) { const keys = path.split('.'); let target = this.draft; for (const key of keys.slice(0, -1)) target = target[key]; target[keys.at(-1)] = value; }

  syncPill(pillEntry) {
    const { btn, spec } = pillEntry;
    const color = DrawingModel.hex(this.value(spec.colorPath));
    const opacity = spec.opacityPath ? Number(this.value(spec.opacityPath) ?? 100) : 100;
    btn.querySelector('.tv-swatch-fill').style.background = DrawingModel.rgba(color, opacity);
    const line = btn.querySelector('.tv-stroke-preview line');
    if (line) {
      const width = Math.max(1, Math.min(5, Number(this.value(spec.widthPath) || 1)));
      const style = this.value(spec.stylePath) || 'solid';
      line.setAttribute('stroke-width', String(width));
      line.setAttribute('stroke-dasharray', style === 'dashed' ? '5 4' : style === 'dotted' ? '1.5 3.5' : 'none');
    }
  }

  togglePopover(button, spec) {
    if (this.popover && this.popoverTarget === button) { this.closePopover(); return; }
    this.closePopover();
    this.popoverTarget = button;
    button.classList.add('active');
    const pop = document.createElement('div');
    pop.className = 'tv-style-popover';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', (spec.label || 'Style') + ' options');

    const currentHex = DrawingModel.hex(this.value(spec.colorPath)).toLowerCase();
    const setColor = hex => {
      this.assign(spec.colorPath, hex);
      if (spec.syncColor) this.draft.color = hex;
      this.syncPill(this.pills.get(spec.id));
      this.preview();
    };
    if (typeof ColorPicker !== 'undefined') {
      ColorPicker.mount(pop, {
        value: currentHex,
        opacity: spec.opacityPath ? Number(this.value(spec.opacityPath) ?? 100) : 100,
        showOpacity: Boolean(spec.opacityPath),
        onColor: hex => setColor(hex),
        onOpacity: op => {
          this.assign(spec.opacityPath, op);
          this.syncPill(this.pills.get(spec.id));
          this.preview();
        }
      });
    } else {
      const grid = document.createElement('div');
      grid.className = 'tv-palette-grid';
      for (const c of DrawingSettings.PALETTE) {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'tv-palette-swatch';
        sw.style.background = c;
        sw.setAttribute('aria-label', c);
        if (c === currentHex) sw.classList.add('selected');
        sw.onclick = () => {
          setColor(c);
          grid.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
          sw.classList.add('selected');
        };
        grid.appendChild(sw);
      }
      pop.appendChild(grid);
    }

    if (spec.widthPath) {
      const row = document.createElement('div');
      row.className = 'tv-pop-row';
      const lbl = document.createElement('span');
      lbl.textContent = 'Thickness';
      const seg = document.createElement('div');
      seg.className = 'tv-seg-group';
      const curW = Number(this.value(spec.widthPath) || 1);
      for (const w of [1, 2, 3, 4, 5]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(w === curW));
        b.setAttribute('aria-label', w + 'px');
        b.innerHTML = `<svg viewBox="0 0 22 12" aria-hidden="true"><line x1="2" y1="6" x2="20" y2="6" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"/></svg>`;
        b.onclick = () => {
          this.assign(spec.widthPath, w);
          seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          this.syncPill(this.pills.get(spec.id));
          this.preview();
        };
        seg.appendChild(b);
      }
      row.append(lbl, seg);
      pop.appendChild(row);
    }

    if (spec.stylePath) {
      const row = document.createElement('div');
      row.className = 'tv-pop-row';
      const lbl = document.createElement('span');
      lbl.textContent = 'Line style';
      const seg = document.createElement('div');
      seg.className = 'tv-seg-group';
      const curS = this.value(spec.stylePath) || 'solid';
      for (const [val, title, dash] of [['solid', 'Solid', 'none'], ['dashed', 'Dashed', '4 3'], ['dotted', 'Dotted', '1.5 2.5']]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(val === curS));
        b.setAttribute('aria-label', title);
        b.innerHTML = `<svg viewBox="0 0 28 12" aria-hidden="true"><line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" stroke-width="2" stroke-dasharray="${dash}" stroke-linecap="round"/></svg>`;
        b.onclick = () => {
          this.assign(spec.stylePath, val);
          seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          this.syncPill(this.pills.get(spec.id));
          this.preview();
        };
        seg.appendChild(b);
      }
      row.append(lbl, seg);
      pop.appendChild(row);
    }

    this.root.appendChild(pop);
    this.popover = pop;
    const rect = button.getBoundingClientRect();
    const popW = pop.offsetWidth || 244, popH = pop.offsetHeight || 260;
    const left = Math.max(8, Math.min(window.innerWidth - popW - 8, rect.left));
    const top = rect.bottom + 6 + popH <= window.innerHeight - 8 ? rect.bottom + 6 : Math.max(8, rect.top - popH - 6);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  closePopover() {
    this.popover?.remove();
    this.popover = null;
    this.popoverTarget?.classList.remove('active');
    this.popoverTarget = null;
  }

  open(chart, drawing, tab = 'style') {
    this.closePopover();
    this.chart = chart;
    this.draft = structuredClone(DrawingModel.normalize(drawing));
    this.error('');
    this.root.querySelector('#drawing-title-input').hidden = true;
    this.root.querySelector('#drawing-settings-title').hidden = false;
    this.root.querySelector('#drawing-rename').hidden = false;
    this.root.querySelector('#drawing-settings-title').textContent = this.draft.title || DrawingModel.names[drawing.type] || drawing.type;

    const strokeLabels = { box: 'Border', measure: 'Border', line: 'Line', hline: 'Line', fib: 'Trend line', position: 'Entry line', brush: 'Stroke' };
    this.root.querySelector('#drawing-stroke-label').textContent = strokeLabels[drawing.type] || 'Border / Line';

    const allowedTabs = this.tabsFor(drawing.type);
    this.root.querySelectorAll('[data-tab]').forEach(btn => { btn.hidden = !allowedTabs.includes(btn.dataset.tab); });
    this.root.querySelectorAll('[data-types]').forEach(el => { el.hidden = !el.dataset.types.split(',').includes(drawing.type); });

    const points = this.root.querySelector('#drawing-points');
    points.replaceChildren();
    const pointKeys = drawing.type === 'position' && this.draft.p3 ? ['p1', 'p2', 'p3'] : drawing.p2 ? ['p1', 'p2'] : ['p1'];
    const pointLabels = drawing.type === 'position'
      ? { p1: '#1 Entry (price, bar)', p2: '#2 Target (price, bar)', p3: '#3 Stop (price, bar)' }
      : drawing.type === 'hline' ? { p1: '#1 (price)' }
      : { p1: '#1 (price, bar)', p2: '#2 (price, bar)' };
    for (const key of pointKeys) {
      const row = document.createElement('div');
      row.className = 'coordinate-row' + (drawing.type === 'hline' ? ' coordinate-single' : '');
      const label = document.createElement('label');
      label.textContent = pointLabels[key] || key;
      const price = document.createElement('input');
      price.type = 'number'; price.step = 'any'; price.dataset.point = key; price.dataset.coordinate = 'price';
      price.setAttribute('aria-label', key + ' price');
      const bar = document.createElement('input');
      bar.type = 'number'; bar.step = '1'; bar.dataset.point = key; bar.dataset.coordinate = 'bar';
      bar.setAttribute('aria-label', key + ' bar');
      if (drawing.type === 'hline') bar.hidden = true;
      row.append(label, price, bar);
      points.appendChild(row);
      price.addEventListener('input', () => this.preview());
      bar.addEventListener('input', () => this.preview());
    }

    const startTab = allowedTabs.includes(tab) ? tab : allowedTabs[0];
    this.fill();
    this.templates();
    this.tab(startTab);
    this.root.classList.add('show');
    this.root.querySelector(`[data-tab="${startTab}"]`).focus();
  }

  fill() {
    this.root.querySelectorAll('[data-field]').forEach(input => {
      const value = this.value(input.dataset.field);
      if (input.type === 'checkbox') input.checked = !!value;
      else {
        if (input.tagName === 'SELECT' && value !== undefined && ![...input.options].some(o => o.value === String(value))) {
          input.add(new Option(String(value), String(value)));
        }
        input.value = value ?? '';
      }
    });
    this.root.querySelectorAll('[data-toggle]').forEach(btn => btn.setAttribute('aria-pressed', String(!!this.value(btn.dataset.toggle))));
    for (const pill of this.pills.values()) this.syncPill(pill);
    this.root.querySelectorAll('[data-mirror]').forEach(input => input.value = this.value(input.dataset.mirror));
    this.root.querySelector('#drawing-text').value = this.draft.text || '';
    this.root.querySelector('#drawing-levels').value = this.draft.levels.join(', ');
    this.root.querySelectorAll('[data-point]').forEach(input => {
      const point = this.draft[input.dataset.point];
      if (!point) return;
      input.value = input.dataset.coordinate === 'price' ? point.price : Number(DrawingModel.logicalIndex(this.chart, point.time)?.toFixed(3));
      input.dataset.original = input.value;
    });
  }

  read() {
    this.root.querySelectorAll('[data-field]').forEach(input => {
      const isNum = input.type === 'number' || input.type === 'range' || input.dataset.field === 'textStyle.size';
      const value = input.type === 'checkbox' ? input.checked : isNum ? Number(input.value) : input.value;
      if (isNum && (!input.value || !Number.isFinite(value))) throw new Error('Thông số vượt giới hạn.');
      if ((input.type === 'number' || input.type === 'range') && (value < Number(input.min) || value > Number(input.max))) throw new Error('Thông số vượt giới hạn.');
      this.assign(input.dataset.field, value);
    });
    for (const [name, rule] of Object.entries(this.draft.visibility)) if (rule.min > rule.max) throw new Error(`${name}: minimum phải ≤ maximum.`);
    this.draft.text = this.root.querySelector('#drawing-text').value;
    const levels = this.root.querySelector('#drawing-levels').value.split(',').map(value => Number(value.trim()));
    if (!levels.length || levels.length > 30 || levels.some(value => !Number.isFinite(value))) throw new Error('Fib levels không hợp lệ.');
    this.draft.levels = levels;
    const brushAnchor = this.draft.type === 'brush' ? { ...this.draft.p1 } : null;
    this.root.querySelectorAll('[data-point]').forEach(input => {
      if (input.hidden) return;
      const value = Number(input.value);
      if (!input.value || !Number.isFinite(value)) throw new Error('Tọa độ không hợp lệ.');
      const point = this.draft[input.dataset.point];
      if (!point || input.value === input.dataset.original) return;
      if (input.dataset.coordinate === 'price') point.price = value;
      else {
        const time = DrawingModel.timeAt(this.chart, value);
        if (time === null || time <= 0) throw new Error('Bar không hợp lệ.');
        point.time = time;
      }
    });
    if (brushAnchor && this.draft.points) {
      const delta = DrawingModel.logicalIndex(this.chart, this.draft.p1.time) - DrawingModel.logicalIndex(this.chart, brushAnchor.time),
        price = this.draft.p1.price - brushAnchor.price;
      this.draft.points = this.draft.points.map(p => ({ time: DrawingModel.timeAt(this.chart, DrawingModel.logicalIndex(this.chart, p.time) + delta, true), price: p.price + price }));
    }
    this.root.querySelectorAll('[data-mirror]').forEach(input => input.value = this.value(input.dataset.mirror));
  }

  preview() { try { this.read(); this.error(''); this.editor.preview(this.draft); } catch (error) { this.error(error.message); } }
  templates() {
    if (typeof TemplateMenu !== 'undefined') TemplateMenu.closePopup();
    const trigger = this.root.querySelector('#drawing-template');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }
  tab(name) {
    this.closePopover();
    this.root.querySelectorAll('[data-tab]').forEach(button => {
      const selected = button.dataset.tab === name;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    this.root.querySelectorAll('[data-panel]').forEach(panel => panel.hidden = panel.dataset.panel !== name);
  }
  error(message) { this.root.querySelector('#drawing-settings-error').textContent = message; }
  hide() {
    if (typeof TemplateMenu !== 'undefined') TemplateMenu.closePopup();
    this.closePopover();
    this.finishRename(false);
    this.root.classList.remove('show');
    this.editor.preview(null);
    this.editor.toolbar.querySelector('[data-action="settings"]')?.focus();
  }
  cancel() { this.hide(); }
}
