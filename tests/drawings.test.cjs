const test = require('node:test');
const assert = require('node:assert/strict');
const DrawingModel = require('../frontend/js/drawing_model.js');

test('visibility is independent for minute/hour/day intervals and does not mutate saved settings', () => {
  const shape = DrawingModel.normalize({type:'box', p1:{time:60,price:1}, p2:{time:120,price:2}});
  shape.visibility.minutes.min=5;
  assert.equal(DrawingModel.visible(shape,'1m'),false);
  assert.equal(DrawingModel.visible(shape,'5m'),true);
  assert.equal(DrawingModel.visible(shape,'1h'),true);
  shape.visibility.hours.enabled=false;
  assert.equal(DrawingModel.visible(shape,'4h'),false);
  assert.equal(DrawingModel.visible(shape,'D'),true);
  const snapshot = JSON.stringify(shape);
  DrawingModel.normalize(shape);
  assert.equal(JSON.stringify(shape),snapshot);
});

test('coordinates follow actual loaded bar indices across session gaps', () => {
  const chart = {tfSeconds:60,bars:[{time:60},{time:120},{time:3600}]};
  assert.equal(DrawingModel.timeAt(chart,2),3600);
  assert.equal(DrawingModel.timeAt(chart,3),3660);
  assert.equal(DrawingModel.logicalIndex(chart,3600),2);
  assert.equal(DrawingModel.logicalIndex(chart,3660),3);
});

test('rectangle mixed corners resize the correct point; invisible shapes cannot be selected', () => {
  const chart = { currentTimeframe:'1m', tfSeconds:60,bars:[{time:60},{time:120}],
    chart:{timeScale:()=>({logicalToCoordinate:index=>index*100})},series:{priceToCoordinate:price=>price*10} };
  const shape=DrawingModel.normalize({type:'box',p1:{time:60,price:1},p2:{time:120,price:5}});
  assert.equal(DrawingModel.hit(chart,shape,0,50),'p1x_p2y');
  assert.equal(DrawingModel.hit(chart,shape,100,10),'p2x_p1y');
  shape.visibility.minutes.enabled=false;
  assert.equal(DrawingModel.hit(chart,shape,0,50),null);
  shape.visibility.minutes.enabled=true;shape.hidden=true;
  assert.equal(DrawingModel.hit(chart,shape,0,50),null);
  assert.equal(DrawingModel.normalize(shape).hidden,true);
  shape.hidden=false;assert.equal(DrawingModel.hit(chart,shape,0,50),'p1x_p2y');
});

test('position upgrades legacy entry/target drawings with an explicit stop, keeps all three handles, and hides stats text when deselected',()=>{
  const chart={currentTimeframe:'1m',tfSeconds:60,plotHeight:200,container:{clientWidth:400,clientHeight:200},bars:[{time:60,close:105},{time:120,close:110}],chart:{timeScale:()=>({logicalToCoordinate:i=>i*100})},series:{priceToCoordinate:p=>p}};
  const position=DrawingModel.normalize({id:'pos1',type:'position',p1:{time:60,price:100},p2:{time:120,price:120},riskReward:2,alwaysShowStats:true});
  assert.equal(position.alwaysShowStats,false,'Legacy un-migrated position drawing resets alwaysShowStats to false');
  assert.deepEqual(position.p3,{time:120,price:90});
  const g=DrawingModel.geometry(chart,position);
  assert.equal(DrawingModel.hit(chart,position,g.c.x,g.c.y),'p3');

  const texts=[];
  const ctx={save(){},restore(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillRect(){},rect(){},fill(){},measureText:t=>({width:t.length*6}),fillText:t=>texts.push(t)};
  global.window={drawingMgr:{editor:{drawing:null}}};
  DrawingModel.draw(ctx,chart,position);
  assert.equal(texts.length,0,'Deselected position drawing must not render stats text pills');

  global.window={drawingMgr:{editor:{drawing:{id:'pos1'}}}};
  DrawingModel.draw(ctx,chart,position);
  assert.ok(texts.length>=3,'Selected position drawing renders stats pills and price labels');
  delete global.window;
});

test('DrawingSettings adapts tabs, labels, coordinates and defaults to each drawing tool type', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const ctx = vm.createContext({ DrawingModel, Workspace: { read: (_, d) => d, write: () => true } });
  vm.runInContext(fs.readFileSync('frontend/js/drawing_settings.js', 'utf8') + ';this.Settings = DrawingSettings;', ctx);
  const proto = ctx.Settings.prototype;
  assert.deepEqual([...proto.tabsFor('box')], ['style', 'text', 'coordinates', 'visibility']);
  assert.deepEqual([...proto.tabsFor('text')], ['text', 'coordinates', 'visibility']);
  assert.deepEqual([...proto.tabsFor('fib')], ['style', 'coordinates', 'visibility']);
  assert.deepEqual([...proto.tabsFor('position')], ['style', 'coordinates', 'visibility']);
  const pos = DrawingModel.normalize({ type: 'position', p1: { time: 60, price: 100 }, p2: { time: 120, price: 120 }, riskReward: 2 });
  assert.equal(pos.profitColor, '#089981');
  assert.equal(pos.stopColor, '#f23645');
  assert.equal(pos.lineStyle, 'dashed');
  assert.equal(DrawingModel.normalize({ type: 'box', p1: { time: 60, price: 1 }, p2: { time: 120, price: 2 }, title: 'OB' }).title, 'OB');
});

test('constrainLinePoint snaps Trend Line to horizontal, vertical and 45-degree angles and vertical extend draws upright', () => {
  const chart = {
    currentTimeframe: '1m',
    tfSeconds: 60,
    plotHeight: 226,
    container: { clientHeight: 226, clientWidth: 465 },
    bars: [{ time: 60 }, { time: 120 }, { time: 180 }, { time: 240 }],
    chart: { timeScale: () => ({ logicalToCoordinate: i => i * 50, coordinateToLogical: x => x / 50 }) },
    series: { priceToCoordinate: p => 200 - p, coordinateToPrice: y => 200 - y }
  };
  const anchor = { time: 60, price: 100 }; // pixel (0, 100)
  // Horizontal snap (small dy: target pixel (100, 115) -> angle ~8.5 deg -> 0 deg)
  const horiz = DrawingModel.constrainLinePoint(chart, anchor, { time: 180, price: 85 }, { x: 100, y: 115 });
  assert.deepEqual(horiz, { time: 180, price: 100 });
  // Vertical snap (small dx: target pixel (12, 40) -> angle ~ -78.7 deg -> -90 deg)
  const vert = DrawingModel.constrainLinePoint(chart, anchor, { time: 60, price: 160 }, { x: 12, y: 40 });
  assert.deepEqual(vert, { time: 60, price: 160 });
  // 45-degree diagonal snap (target pixel (100, 180) -> proj onto 45 deg => dx == dy)
  const diag = DrawingModel.constrainLinePoint(chart, anchor, { time: 180, price: 20 }, { x: 100, y: 180 });
  const dp = DrawingModel.point(chart, diag);
  assert.equal(diag.time, 180);
  assert.ok(Math.abs(diag.price - 10) < 1e-9);
  assert.ok(Math.abs(dp.y - 190) < 1e-9);

  // Vertical line with extend:'both' stays upright instead of dividing by .001
  const segments = [];
  const ctx = {
    save() {}, restore() {}, setLineDash() {}, beginPath() {}, stroke() {},
    moveTo(x, y) { segments.push(['M', x, y]); },
    lineTo(x, y) { segments.push(['L', x, y]); }
  };
  DrawingModel.draw(ctx, chart, { type: 'line', p1: { time: 120, price: 80 }, p2: { time: 120, price: 140 }, extend: 'both' });
  assert.deepEqual(segments, [['M', 50, 0], ['L', 50, 200]]);
});

test('Shift constrains Trend Line while drawing (including keydown/keyup) and while dragging endpoints', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const winListeners = {};
  const chartListeners = {};
  const makeEl = () => ({
    className: '', hidden: false, innerHTML: '', value: '', parentElement: { hidden: false },
    style: { setProperty() {}, removeProperty() {} },
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {}, appendChild() {}, querySelector: () => makeEl(), querySelectorAll: () => [],
    addEventListener() {}, focus() {}, dispatchEvent() {}
  });
  const container = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 465, height: 226 }),
    clientWidth: 465, clientHeight: 226, hidden: false, style: { setProperty() {}, removeProperty() {} },
    addEventListener(name, fn) { (chartListeners[name] ||= []).push(fn); },
    setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {}, dispatchEvent() {}
  };
  const ch = {
    id: 'c1', symbol: 'NQ1!', currentTimeframe: '1m', tfSeconds: 60, plotHeight: 226,
    container, drawings: [],
    bars: [{ time: 60 }, { time: 120 }, { time: 180 }, { time: 240 }],
    chart: {
      timeScale: () => ({ logicalToCoordinate: i => i * 50, coordinateToLogical: x => x / 50 }),
      priceScale: () => ({ width: () => 65 }),
      subscribeCrosshairMove() {}, clearCrosshairPosition() {}, applyOptions() {}, options: () => ({ handleScroll: { pressedMouseMove: true } })
    },
    series: { priceToCoordinate: p => 200 - p, coordinateToPrice: y => 200 - y },
    coordinateToTime: x => DrawingModel.timeAt(ch, x / 50),
    coordinateToPrice: y => (y < 0 || y > 200 ? null : 200 - y),
    snapToBar: (t, p) => ({ time: t, price: p }),
    renderDrawings() {}
  };
  const context = vm.createContext({
    DrawingModel,
    structuredClone,
    CustomEvent: function (name) { this.type = name; },
    DrawingSettings: function () { return { root: makeEl(), open() {} }; },
    Workspace: { read: (_, d) => d, write: () => true },
    crypto: { randomUUID: () => 'uuid-1' },
    document: { body: makeEl(), createElement: makeEl, querySelectorAll: () => [], addEventListener() {} },
    window: { addEventListener(name, fn) { (winListeners[name] ||= []).push(fn); } }
  });
  vm.runInContext(
    fs.readFileSync('frontend/js/drawing_editor.js', 'utf8') + '\n' +
    fs.readFileSync('frontend/js/drawing_tools.js', 'utf8') + '\nthis.Manager = DrawingManager;',
    context
  );
  const mgr = new context.Manager();
  mgr.bindChart(ch);
  mgr.setTool('line');
  const fireChart = (name, ev) => chartListeners[name].forEach(fn => fn({ target: { closest: () => null }, preventDefault() {}, stopImmediatePropagation() {}, ...ev }));
  const fireWin = (name, ev) => winListeners[name]?.forEach(fn => fn({ target: { closest: () => null }, ...ev }));

  // Click p1 at (0, 100) => time: 60, price: 100
  fireChart('click', { clientX: 0, clientY: 100, shiftKey: false });
  // Move to (100, 112) without Shift -> temp p2 is off-horizontal (price 88)
  fireChart('mousemove', { clientX: 100, clientY: 112, shiftKey: false });
  assert.equal(ch.drawings.find(d => d.isTemp).p2.price, 88);
  // Press Shift without moving pointer -> temp immediately snaps horizontal (price 100)
  fireWin('keydown', { key: 'Shift', shiftKey: true, repeat: false, target: { closest: () => null } });
  assert.equal(ch.drawings.find(d => d.isTemp).p2.price, 100);
  // Release Shift without moving pointer -> temp returns to free position (price 88)
  fireWin('keyup', { key: 'Shift', shiftKey: false });
  assert.equal(ch.drawings.find(d => d.isTemp).p2.price, 88);
  // Click p2 while holding Shift -> committed drawing has exact horizontal p2.price === p1.price
  fireChart('click', { clientX: 100, clientY: 115, shiftKey: true });
  assert.equal(ch.drawings.length, 1);
  assert.equal(ch.drawings[0].p1.price, 100);
  assert.equal(ch.drawings[0].p2.price, 100);
  assert.equal(ch.drawings[0].p2.time, 180);

  // Drag handle p2 diagonally with Shift disabled first, then Shift enabled -> constrains to p1
  fireChart('pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  fireChart('pointermove', { clientX: 150, clientY: 90, shiftKey: false });
  assert.equal(ch.drawingPreview.p2.price, 110);
  fireWin('keydown', { key: 'Shift', shiftKey: true, repeat: false });
  assert.equal(ch.drawingPreview.p2.price, 100);
  fireChart('pointerup', { clientX: 150, clientY: 90, shiftKey: true });
  assert.equal(ch.drawings[0].p2.time, 240);
  assert.equal(ch.drawings[0].p2.price, 100);

  // Separate Long ('position') and Short ('short_position') tools place 1-click positions with opposite TP/SL sides
  ch.drawings = [];
  mgr.setTool('position');
  fireChart('click', { clientX: 50, clientY: 100, shiftKey: false });
  assert.equal(ch.drawings.length, 1);
  assert.equal(ch.drawings[0].side, 'long');
  assert.ok(ch.drawings[0].p2.price > ch.drawings[0].p1.price);
  assert.ok(ch.drawings[0].p3.price < ch.drawings[0].p1.price);

  mgr.setTool('short_position');
  fireChart('click', { clientX: 100, clientY: 100, shiftKey: false });
  assert.equal(ch.drawings.length, 2);
  assert.equal(ch.drawings[1].side, 'short');
  assert.ok(ch.drawings[1].p2.price < ch.drawings[1].p1.price);
  assert.ok(ch.drawings[1].p3.price > ch.drawings[1].p1.price);
});

test('ChartContextMenu.pasteDrawing translates coordinates to target point while preserving box dimensions', () => {
  const ChartContextMenu = require('../frontend/js/chart_context_menu.js');
  const ch = {
    tfSeconds: 60,
    bars: [{ time: 60 }, { time: 120 }, { time: 180 }, { time: 240 }, { time: 300 }],
    drawings: []
  };
  const src = DrawingModel.normalize({ id: 'orig', type: 'box', p1: { time: 60, price: 100 }, p2: { time: 120, price: 120 }, locked: true, hidden: true, fillColor: '#22c55e' });
  const pasted = ChartContextMenu.pasteDrawing(ch, src, { time: 180, price: 150 }, DrawingModel);
  assert.notEqual(pasted.id, 'orig');
  assert.equal(pasted.locked, false);
  assert.equal(pasted.hidden, false);
  assert.deepEqual(pasted.p1, { time: 180, price: 150 });
  assert.deepEqual(pasted.p2, { time: 240, price: 170 });
  assert.equal(pasted.fillColor, '#22c55e');
});

test('DrawingEditor renders TradingView toolbar controls, toggles per-tool visibility, lock, alert and width popover', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const makeNode = (tag = 'div') => {
    const classes = new Set();
    const attrs = {};
    const node = {
      tagName: tag.toUpperCase(),
      style: {},
      dataset: {},
      children: [],
      listeners: {},
      className: '',
      hidden: false,
      textContent: '',
      _html: '',
      set innerHTML(v) { this._html = String(v); },
      get innerHTML() { return this._html; },
      classList: {
        add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        toggle: (n, force) => (force === undefined ? (classes.has(n) ? (classes.delete(n), false) : (classes.add(n), true)) : (force ? (classes.add(n), true) : (classes.delete(n), false))),
        contains: n => classes.has(n)
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return attrs[k] ?? null; },
      removeAttribute(k) { delete attrs[k]; },
      append(...items) { items.forEach(it => node.appendChild(it)); },
      appendChild(child) { node.children.push(child); return child; },
      remove() { node.removed = true; },
      contains(target) { return target === node || node.children.includes(target); },
      addEventListener(type, fn) { (node.listeners[type] ||= []).push(fn); },
      getBoundingClientRect() { return { left: 100, top: 100, bottom: 138, width: 420, height: 38 }; },
      closest() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
    return node;
  };
  const bySel = new Map();
  const selList = [
    '.drawing-grip', '[data-action="template"]', '[data-tb-pop="borderColor"]', '[data-tb-pop="fillColor"]',
    '[data-tb-pop="textColor"]', '[data-tb-pop="width"]', '[data-tb-pop="lineStyle"]',
    '[data-action="settings"]', '[data-action="alert"]', '[data-action="lock"]',
    '[data-action="delete"]', '[data-action="more"]', '.drawing-more',
    '[data-swatch-bar="borderColor"]', '[data-swatch-bar="fillColor"]', '[data-swatch-bar="textColor"]',
    '[data-width-label]', '[data-width-line]', '[data-style-line]', '[data-lock-shackle]'
  ];
  for (const s of selList) bySel.set(s, makeNode());
  bySel.get('[data-action="lock"]').querySelector = s => bySel.get(s) || null;
  const toolbarKeys = new Set();
  const body = makeNode('body');
  const ctx = vm.createContext({
    DrawingModel,
    DrawingSettings: class { open() {} },
    Workspace: { read: (_, d) => d, write: () => true },
    structuredClone,
    Option: function(text, value) { return { text, value }; },
    window: { innerWidth: 1280, innerHeight: 800, addEventListener() {} },
    document: {
      body,
      createElement(tag) {
        const el = makeNode(tag);
        if (!toolbarKeys.size && tag === 'div') {
          toolbarKeys.add('toolbar');
          el.querySelector = s => bySel.get(s) || null;
          el.querySelectorAll = () => [];
        }
        return el;
      },
      createTextNode(t) { return { textContent: t }; },
      addEventListener() {},
      getElementById() { return null; }
    }
  });
  vm.runInContext(fs.readFileSync('frontend/js/drawing_editor.js', 'utf8') + ';this.Editor = DrawingEditor;', ctx);
  const manager = { activeTool: 'crosshair', chartList: [], drawingsLocked: false, saveDrawings() {} };
  const editor = new ctx.Editor(manager);
  const html = editor.toolbar.innerHTML;
  const expectedOrder = [
    'class="drawing-grip"', 'data-action="template"', 'data-tb-pop="borderColor"', 'data-tb-pop="fillColor"',
    'data-tb-pop="textColor"', 'data-tb-pop="width"', 'data-tb-pop="lineStyle"',
    'data-action="settings"', 'data-action="alert"', 'data-action="lock"',
    'data-action="delete"', 'data-action="more"', 'class="drawing-more"'
  ];
  let cursor = -1;
  for (const token of expectedOrder) {
    const pos = html.indexOf(token);
    assert.ok(pos > cursor, `expected toolbar token ${token} in order`);
    cursor = pos;
  }

  const ch = {
    container: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 400 }) },
    drawings: [
      DrawingModel.normalize({ id: 'b1', type: 'box', p1: { time: 60, price: 100 }, p2: { time: 120, price: 120 }, width: 2, borderColor: '#f23645', fillColor: '#22c55e', fillOpacity: 40 }),
      DrawingModel.normalize({ id: 'l1', type: 'line', p1: { time: 60, price: 100 }, p2: { time: 120, price: 110 }, locked: true }),
      DrawingModel.normalize({ id: 't1', type: 'text', p1: { time: 60, price: 100 }, text: 'Note' })
    ],
    renderDrawings() {}
  };

  editor.select(ch, ch.drawings[0]);
  assert.equal(bySel.get('[data-tb-pop="borderColor"]').hidden, false);
  assert.equal(bySel.get('[data-tb-pop="fillColor"]').hidden, false);
  assert.equal(bySel.get('[data-tb-pop="textColor"]').hidden, false);
  assert.equal(bySel.get('[data-tb-pop="width"]').hidden, false);
  assert.equal(bySel.get('[data-tb-pop="lineStyle"]').hidden, false);
  assert.equal(bySel.get('[data-width-label]').textContent, '2px');
  assert.equal(bySel.get('[data-lock-shackle]').getAttribute('d'), 'M8.5 10.5V7.2a3.5 3.5 0 0 1 6.7-1.4');
  assert.equal(bySel.get('[data-action="lock"]').classList.contains('active'), false);

  let alertCall = null;
  editor.onAlert = (chart, price) => { alertCall = { chart, price }; };
  const alertTarget = { dataset: { action: 'alert' }, closest: s => (s === '[data-action]' ? alertTarget : null) };
  for (const fn of editor.toolbar.listeners.click || []) fn({ target: alertTarget, stopPropagation() {} });
  assert.deepEqual(alertCall, { chart: ch, price: 110 });

  editor.toggleTbPopover(bySel.get('[data-tb-pop="width"]'), 'width');
  assert.ok(editor.tbPopover);
  const w3Btn = editor.tbPopover.children.find(c => c.innerHTML.includes('<span>3px</span>'));
  assert.ok(w3Btn);
  w3Btn.onclick();
  assert.equal(ch.drawings[0].width, 3);
  assert.equal(bySel.get('[data-width-label]').textContent, '3px');
  assert.equal(editor.tbPopover, null);

  editor.toggleTbPopover(bySel.get('[data-tb-pop="lineStyle"]'), 'lineStyle');
  assert.ok(editor.tbPopover);
  const dashBtn = editor.tbPopover.children.find(c => c.innerHTML.includes('<span>Dashed</span>'));
  assert.ok(dashBtn);
  dashBtn.onclick();
  assert.equal(ch.drawings[0].lineStyle, 'dashed');
  assert.equal(editor.tbPopover, null);

  editor.select(ch, ch.drawings[1]);
  assert.equal(bySel.get('[data-tb-pop="fillColor"]').hidden, true);
  assert.equal(bySel.get('[data-tb-pop="borderColor"]').hidden, false);
  assert.equal(bySel.get('[data-action="lock"]').classList.contains('active'), true);
  assert.equal(bySel.get('[data-lock-shackle]').getAttribute('d'), 'M8.5 10.5V7.2a3.5 3.5 0 0 1 7 0v3.3');

  editor.select(ch, ch.drawings[2]);
  assert.equal(bySel.get('[data-tb-pop="borderColor"]').hidden, true);
  assert.equal(bySel.get('[data-tb-pop="fillColor"]').hidden, true);
  assert.equal(bySel.get('[data-tb-pop="width"]').hidden, true);
  assert.equal(bySel.get('[data-tb-pop="lineStyle"]').hidden, true);
  assert.equal(bySel.get('[data-tb-pop="textColor"]').hidden, false);
});
