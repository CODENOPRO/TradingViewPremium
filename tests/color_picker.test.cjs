const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ColorPicker = require('../frontend/js/color_picker.js');
const DrawingModel = require('../frontend/js/drawing_model.js');
const { ChartAppearance } = require('../frontend/js/chart_settings.js');

function createDomStub(storeData = {}) {
  const store = { ...storeData };
  const Workspace = {
    read(k, d) { return k in store ? JSON.parse(JSON.stringify(store[k])) : d; },
    write(k, v) { store[k] = JSON.parse(JSON.stringify(v)); return true; }
  };

  function makeEl(tag = 'div') {
    const classes = new Set();
    const attrs = {};
    const listeners = {};
    let _text = '';
    let _html = '';
    const el = {
      tagName: String(tag).toUpperCase(),
      style: {},
      dataset: {},
      children: [],
      get firstChild() { return el.children[0] || null; },
      listeners,
      classList: {
        add: (...names) => names.filter(Boolean).forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        toggle: (n, force) => (force === undefined ? (classes.has(n) ? (classes.delete(n), false) : (classes.add(n), true)) : (force ? (classes.add(n), true) : (classes.delete(n), false))),
        contains: n => classes.has(n)
      },
      set className(v) { classes.clear(); String(v || '').split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
      get className() { return [...classes].join(' '); },
      set textContent(v) { _text = String(v ?? ''); },
      get textContent() { return _text; },
      set innerHTML(v) { _html = String(v ?? ''); },
      get innerHTML() { return _html; },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return attrs[k] ?? null; },
      removeAttribute(k) { delete attrs[k]; },
      append(...nodes) { for (const n of nodes) el.appendChild(n); },
      appendChild(n) {
        if (!n) return n;
        n.parentNode = el;
        el.children.push(n);
        return n;
      },
      prepend(...nodes) { el.children.unshift(...nodes); },
      replaceChildren(...nodes) { el.children = []; el.append(...nodes); },
      remove() {
        el.isConnected = false;
        if (el.parentNode) el.parentNode.children = el.parentNode.children.filter(c => c !== el);
      },
      contains(target) {
        if (target === el) return true;
        return el.children.some(c => typeof c.contains === 'function' && c.contains(target));
      },
      closest(sel) {
        let cur = el;
        while (cur) {
          if (matches(cur, sel)) return cur;
          cur = cur.parentNode;
        }
        return null;
      },
      addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
      removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter(f => f !== fn); },
      dispatchEvent(type, ev = {}) {
        const event = { target: el, currentTarget: el, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...ev };
        for (const fn of [...(listeners[type] || [])]) fn(event);
      },
      getBoundingClientRect() { return el._rect || { left: 100, top: 100, right: 280, bottom: 284, width: 180, height: 184 }; },
      focus() {},
      select() {},
      add(opt) { (el.options ||= []).push(opt); },
      querySelector(sel) {
        const hit = findAll(el, sel)[0];
        if (hit) return hit;
        if (_html || el._isStub) {
          el._stub ||= new Map();
          if (!el._stub.has(sel)) {
            const st = makeEl();
            st._isStub = true;
            el._stub.set(sel, st);
          }
          return el._stub.get(sel);
        }
        return null;
      },
      querySelectorAll(sel) { return findAll(el, sel); }
    };
    el.isConnected = true;
    return el;
  }

  function matches(el, sel) {
    return sel.split(',').some(part => {
      const s = part.trim();
      if (!s) return false;
      if (s.startsWith('.')) return el.classList?.contains(s.slice(1));
      if (s.startsWith('#')) return el.id === s.slice(1);
      const attrMatch = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(s);
      if (attrMatch) {
        const actual = el.getAttribute?.(attrMatch[1]);
        return attrMatch[2] === undefined ? actual !== null : actual === attrMatch[2];
      }
      return el.tagName?.toLowerCase() === s.toLowerCase();
    });
  }

  function findAll(root, sel, out = []) {
    for (const c of root.children || []) {
      if (matches(c, sel)) out.push(c);
      findAll(c, sel, out);
    }
    return out;
  }

  const body = makeEl('body');
  const winListeners = {};
  const docListeners = {};
  const window = {
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener(type, fn) { (winListeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { winListeners[type] = (winListeners[type] || []).filter(f => f !== fn); }
  };
  const document = {
    body,
    createElement: makeEl,
    createTextNode: t => ({ tagName: '#TEXT', textContent: String(t), children: [] }),
    addEventListener(type, fn) { (docListeners[type] ||= []).push(fn); },
    getElementById(id) { return findAll(body, '#' + id)[0] || null; }
  };
  return { Workspace, store, makeEl, document, window, Option: function(t, v) { return { text: t, value: v }; } };
}

test('ColorPicker hex/HSV/RGBA conversions handle coral #f77c80, edge colors and opacity formats accurately', () => {
  for (const hex of ['#f77c80', '#ffffff', '#000000', '#089981', '#2962ff', '#fbc02d']) {
    const hsv = ColorPicker.hexToHsv(hex);
    assert.equal(ColorPicker.hsvToHex(hsv.h, hsv.s, hsv.v), hex);
  }
  assert.deepEqual(ColorPicker.parseColor('#f77c80'), { hex: '#f77c80', opacity: 100 });
  assert.deepEqual(ColorPicker.parseColor('#f77c8080'), { hex: '#f77c80', opacity: 50 });
  assert.deepEqual(ColorPicker.parseColor('rgba(247, 124, 128, 0.35)'), { hex: '#f77c80', opacity: 35 });
  assert.deepEqual(ColorPicker.parseColor('transparent'), { hex: '#000000', opacity: 0 });
  assert.equal(ColorPicker.toCss('#f77c80', 100), '#f77c80');
  assert.equal(ColorPicker.toCss('#f77c80', 50), 'rgba(247, 124, 128, 0.5)');
  assert.equal(ColorPicker.toHexAlpha('#2962ff', 100), '#2962ff');
  assert.equal(ColorPicker.toHexAlpha('#2962ff', 50), '#2962ff80');
});

test('ColorPicker persists deduplicated custom swatches capped cleanly at 19 items', () => {
  const { Workspace } = createDomStub();
  for (let i = 1; i <= 21; i++) {
    const hex = '#' + i.toString(16).padStart(2, '0') + '1122';
    ColorPicker.addCustomColor(hex, Workspace);
  }
  const list = ColorPicker.listCustomColors(Workspace);
  assert.equal(list.length, 19);
  assert.equal(list[0], '#031122');
  assert.equal(list.at(-1), '#151122');

  ColorPicker.addCustomColor('#F77C80', Workspace);
  assert.equal(ColorPicker.listCustomColors(Workspace).at(-1), '#f77c80');
  ColorPicker.removeCustomColor('#f77c80', Workspace);
  assert.equal(ColorPicker.listCustomColors(Workspace).includes('#f77c80'), false);
});

test('ColorPicker.mount toggles + custom HSV panel, drags SV/Hue, and Add saves swatch cleanly', () => {
  const env = createDomStub();
  globalThis.window = env.window;
  globalThis.document = env.document;
  try {
    const pop = env.makeEl('div');
    const updates = [];
    ColorPicker.mount(pop, {
      value: '#2962ff',
      opacity: 80,
      showOpacity: true,
      storage: env.Workspace,
      onChange: u => updates.push(u)
    });
    assert.equal(pop.querySelectorAll('.tv-palette-swatch').length, 60);
    const addBtn = pop.querySelector('.tv-cp-add-btn');
    assert.ok(addBtn);
    assert.equal(pop.querySelector('.tv-cp-panel'), null);

    addBtn.onclick({ stopPropagation() {} });
    const panel = pop.querySelector('.tv-cp-panel');
    assert.ok(panel);
    assert.equal(addBtn.getAttribute('aria-expanded'), 'true');
    const hexInput = panel.querySelector('.tv-cp-hex-input');
    assert.equal(hexInput.value, '#2962ff');

    // Drag SV square to top-right (S=1, V=1) and Hue bar to middle (cyan ~180deg)
    const svBox = panel.querySelector('.tv-cp-sv');
    svBox.dispatchEvent('pointerdown', { button: 0, clientX: 280, clientY: 100 });
    const hueBox = panel.querySelector('.tv-cp-hue');
    hueBox.dispatchEvent('pointerdown', { button: 0, clientX: 105, clientY: 192 });
    assert.equal(updates.at(-1).hex, '#00ffff');

    // Type #f77c80 and click Add -> saves custom swatch and closes panel
    hexInput.value = '#f77c80';
    hexInput.oninput();
    assert.equal(updates.at(-1).hex, '#f77c80');
    panel.querySelector('.tv-cp-submit').onclick({ stopPropagation() {} });
    assert.equal(pop.querySelector('.tv-cp-panel'), null);
    assert.equal(addBtn.getAttribute('aria-expanded'), 'false');
    assert.equal(ColorPicker.listCustomColors(env.Workspace).includes('#f77c80'), true);
    assert.equal(pop.querySelectorAll('.tv-cp-custom-item').length, 1);

    // Reopen panel then close via ColorPicker.closeActiveSub
    addBtn.onclick({ stopPropagation() {} });
    assert.ok(pop.querySelector('.tv-cp-panel'));
    assert.equal(ColorPicker.closeActiveSub(pop), true);
    assert.equal(pop.querySelector('.tv-cp-panel'), null);
    assert.equal(ColorPicker.closeActiveSub(pop), false);
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});

test('ChartSettings and IndicatorSettings mount unified ColorPicker with custom + Add panel', () => {
  const env = createDomStub();
  const modalChart = env.makeEl('div');
  modalChart.id = 'settings-modal';
  modalChart.innerHTML = '';
  const dlg = env.makeEl('div');
  dlg.className = 'chart-settings-dialog';
  const hdr = env.makeEl('div'); hdr.className = 'modal-header';
  const nav = env.makeEl('div'); nav.className = 'chart-settings-nav';
  const body = env.makeEl('div'); body.className = 'chart-settings-body';
  const err = env.makeEl('p'); err.className = 'chart-settings-error';
  const closeBtn = env.makeEl('button'); closeBtn.id = 'close-settings';
  const cancelBtn = env.makeEl('button'); cancelBtn.id = 'cancel-settings';
  const saveBtn = env.makeEl('button'); saveBtn.id = 'save-settings';
  const tplBtn = env.makeEl('button'); tplBtn.id = 'chart-template';
  dlg.append(hdr, nav, body, err, closeBtn, cancelBtn, saveBtn, tplBtn);
  modalChart.appendChild(dlg);
  env.document.body.appendChild(modalChart);

  const ctx = vm.createContext({
    ChartAppearance,
    DrawingModel,
    Workspace: env.Workspace,
    innerWidth: 1280,
    innerHeight: 800,
    Option: env.Option,
    window: env.window,
    document: env.document,
    structuredClone,
    MarketData: { durations: { '1m': 60, D: 86400 } }
  });
  vm.runInContext(
    fs.readFileSync('frontend/js/color_picker.js', 'utf8') + '\n' +
    fs.readFileSync('frontend/js/chart_settings.js', 'utf8') + '\n' +
    fs.readFileSync('frontend/js/indicator_settings.js', 'utf8') + '\n' +
    'this.CP = ColorPicker; this.CS = ChartSettings; this.IS = IndicatorSettings;',
    ctx
  );

  // ChartSettings color picker updates draft & saves custom swatch
  const previewCharts = [];
  const fakeChart = {
    symbol: 'NQ1!',
    sessionMode: 'ETH',
    appearance: ChartAppearance.desktopProfile(null, {}, 'NQ1!'),
    container: env.makeEl('div'),
    chart: { applyOptions() {}, timeScale: () => ({ applyOptions() {} }) },
    series: { applyOptions() {}, setData() {} },
    customSeries: new Map(),
    bars: [],
    updateLegend() {},
    renderDrawings() {},
    renderIndicatorPane() {}
  };
  const cs = new ctx.CS(() => fakeChart, (_c, next) => previewCharts.push(next));
  cs.chart = fakeChart;
  cs.draft = { ...fakeChart.appearance };
  cs.original = { ...fakeChart.appearance };
  const colorBtn = cs.color('bg', 'Background');
  cs.openPalette(colorBtn, 'bg');
  assert.ok(cs.palette.querySelector('.tv-cp-add-btn'));
  cs.palette.querySelector('.tv-cp-add-btn').onclick({ stopPropagation() {} });
  const hexIn = cs.palette.querySelector('.tv-cp-hex-input');
  hexIn.value = '#f77c80';
  hexIn.oninput();
  cs.palette.querySelector('.tv-cp-submit').onclick({ stopPropagation() {} });
  assert.equal(cs.draft.bg, '#f77c80');
  assert.equal(colorBtn.children[0].style.background, '#f77c80');
  assert.equal(ctx.CP.listCustomColors(env.Workspace).includes('#f77c80'), true);

  // IndicatorSettings renders button swatch instead of raw <input type="color"> and shares custom colors
  const is = new ctx.IS(() => {});
  const indiBody = env.makeEl('div'); indiBody.className = 'indi-settings-body';
  const draft = { line_col: '#2962ff' };
  is.field(indiBody, { key: 'line_col', label: 'Line Color', type: 'color' }, draft);
  const swatchBtn = indiBody.querySelector('.tv-indi-color');
  assert.ok(swatchBtn);
  swatchBtn.onclick({ stopPropagation() {} });
  assert.ok(is.palette);
  // Previously saved #f77c80 appears in IndicatorSettings custom swatch row
  const savedItem = is.palette.querySelector('.tv-cp-custom-item').querySelector('.tv-palette-swatch');
  assert.ok(savedItem);
  assert.equal(savedItem.dataset.hex, '#f77c80');
  savedItem.onclick();
  assert.equal(draft.line_col, '#f77c80');

  // DrawingSettings & DrawingEditor also mount ColorPicker cleanly with shared saved custom swatches
  vm.runInContext(
    fs.readFileSync('frontend/js/drawing_settings.js', 'utf8') + '\n' +
    fs.readFileSync('frontend/js/drawing_editor.js', 'utf8') + '\n' +
    'this.DS = DrawingSettings; this.DE = DrawingEditor;',
    ctx
  );
  const de = new ctx.DE({ activeTool: 'crosshair', chartList: [], drawingsLocked: false, saveDrawings() {} });
  const drawChart = {
    container: env.makeEl('div'),
    drawings: [DrawingModel.normalize({ id: 'b1', type: 'box', p1: { time: 60, price: 100 }, p2: { time: 120, price: 120 } })],
    renderDrawings() {}
  };
  de.select(drawChart, drawChart.drawings[0]);
  de.toggleTbPopover(env.makeEl('button'), 'fillColor');
  assert.ok(de.tbPopover.querySelector('.tv-cp-add-btn'));
  assert.equal(de.tbPopover.querySelector('.tv-cp-custom-item').querySelector('.tv-palette-swatch').dataset.hex, '#f77c80');

  const ds = new ctx.DS(de);
  ds.chart = drawChart;
  ds.draft = structuredClone(drawChart.drawings[0]);
  const borderPill = ds.pills.get('border');
  ds.togglePopover(borderPill.btn, borderPill.spec);
  assert.ok(ds.popover.querySelector('.tv-cp-add-btn'));
  assert.equal(ds.popover.querySelector('.tv-cp-custom-item').querySelector('.tv-palette-swatch').dataset.hex, '#f77c80');
});
