const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const MarketData = require('../frontend/js/market_data.js');
const PaperTrading = require('../frontend/js/paper_trading.js');
const bar = (time, volume = 5) => ({ time, open: 100, high: 102, low: 99, close: 101, volume });
const metadata = { timezone: 'America/Chicago', session: '1700-1600' };

test('DST changes session UTC anchor, not exchange opening hour', () => {
  for (const day of ['2026-03-06', '2026-03-09', '2026-10-30', '2026-11-02']) {
    const time = Date.parse(day + 'T18:00:00Z') / 1000;
    const open = MarketData.bucket(time, 'D', metadata);
    assert.equal(MarketData.parts(open, metadata.timezone).hour, 17);
    assert.ok(time >= open);
    assert.ok(time - open < 25 * 3600);
  }
});

test('RTH metadata honors early close, holiday and DST without hardcoded UTC offset', () => {
  const meta = { ...metadata, sessionRegular: { session: '0830-1515', corrections: '0830-1215:20261127;dayoff:20260403' }, holidays: '20261225' };
  assert.equal(MarketData.inRegularSession(bar(Date.parse('2026-11-27T18:14:00Z') / 1000), meta), true);
  assert.equal(MarketData.inRegularSession(bar(Date.parse('2026-11-27T18:15:00Z') / 1000), meta), false);
  assert.equal(MarketData.inRegularSession(bar(Date.parse('2026-12-25T16:00:00Z') / 1000), meta), false);
  assert.equal(MarketData.inRegularSession(bar(Date.parse('2026-04-03T15:00:00Z') / 1000), meta), false);
});

test('HTF volume does not double count repeated updates with partial minute history', () => {
  const ctx = vm.createContext({ MarketData });
  vm.runInContext(fs.readFileSync('frontend/js/chart_engine.js', 'utf8') + '\nthis.Engine=ChartEngine;', ctx);
  const engine = Object.create(ctx.Engine.prototype);
  const start = MarketData.bucket(Date.parse('2026-11-10T15:02:00Z') / 1000, '5m', metadata);
  Object.assign(engine, { metadata, rawBars: [bar(start + 60, 5)], htfData: { '5m': [bar(start, 100)] }, htfBaselines: { '5m': new Map([[start + 60, 5]]) } });
  engine.rawBars[0].volume = 7;
  assert.equal(engine.getBarsForTimeframe('5m')[0].volume, 102);
  assert.equal(engine.getBarsForTimeframe('5m')[0].volume, 102);
  engine.rawBars.push(bar(start + 120, 3));
  assert.equal(engine.getBarsForTimeframe('5m')[0].volume, 105);
});

test('paper margin rejects oversized trades and persists account equity after stop', () => {
  let persisted;
  const paper = new PaperTrading(undefined, value => persisted = JSON.parse(JSON.stringify(value)));
  paper.create('Test', 1000, 10);
  paper.tick('NQ1!', 100);
  const meta = { pointValue: 20 };
  assert.throws(() => paper.place({ symbol: 'NQ1!', side: 'buy', type: 'market', qty: 6 }, meta), /margin/);
  paper.place({ symbol: 'NQ1!', side: 'buy', type: 'market', qty: 1, sl: 99, tp: 102 }, meta);
  assert.equal(paper.usedMargin(), 200);
  paper.tick('NQ1!', 99);
  assert.equal(paper.account.balance, 980);
  assert.equal(paper.account.positions.length, 0);
  const restored = new PaperTrading(persisted);
  assert.equal(restored.account.balance, 980);
  assert.equal(restored.account.history.at(-1).reason, 'stop-loss');
});

test('paper pending orders run across accounts and restore active selection', () => {
  const paper = new PaperTrading();
  const a = paper.create('A', 10000, 10);
  paper.tick('ES1!', 100);
  paper.place({ symbol: 'ES1!', side: 'buy', type: 'limit', qty: 1, price: 99 }, { pointValue: 50 });
  const b = paper.create('B', 10000, 10);
  paper.tick('ES1!', 98);
  assert.equal(a.positions.length, 1);
  assert.equal(a.orders.length, 0);
  assert.equal(paper.account.id, b.id);
  assert.equal(a.positions[0].price, 98);
});

test('JS worker contract works independently; a host without importScripts fails Pine explicitly', async () => {
  const messages = [];
  const context = vm.createContext({ self: { postMessage: m => messages.push(m) }, performance });
  vm.runInContext(fs.readFileSync('frontend/js/indicator_worker.js', 'utf8'), context);
  await context.self.onmessage({ data: { type: 'init', code: '//@version=6\nindicator("test")' } });
  assert.match(messages.pop().error, /Pine/);
  await context.self.onmessage({ data: { type: 'init', code: 'function calculate(bars) { return {tables:[{title:"Count",rows:[[bars.length]]}]}; }' } });
  assert.equal(messages.pop().type, 'ready');
  await context.self.onmessage({ data: { type: 'run', id: 1, bars: [bar(60)], context: {} } });
  assert.equal(messages[0].result.tables[0].rows[0][0], 1);
});
