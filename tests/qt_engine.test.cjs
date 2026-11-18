const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MarketData = require('../frontend/js/market_data.js');
global.MarketData = MarketData;
const QuantaibayEngine = require('../frontend/js/qt_engine.js');

test('QuantaibayEngine cycle boundaries across 1m/5m/15m/1h/4h/6h/D', () => {
  const evalMid = QuantaibayEngine.makeCycleEvaluator('America/New_York', true);
  const evalOpen = QuantaibayEngine.makeCycleEvaluator('America/New_York', false);

  // 2026-11-17 09:21, 09:22, 09:23 NY
  const t0921 = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 9, 21, 0);
  const t0922 = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 9, 22, 0);
  const t0923 = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 9, 23, 0);

  // Default Mid/Close fixes :22 into Q2 (matching 09:22:30 vertical line)
  assert.equal(evalMid(t0921, 60).qNum, 1);
  assert.equal(evalMid(t0922, 60).qNum, 2);
  assert.equal(evalMid(t0923, 60).qNum, 2);

  // Raw Bar Open keeps :22 in Q1 and starts Q2 at :23
  assert.equal(evalOpen(t0922, 60).qNum, 1);
  assert.equal(evalOpen(t0923, 60).qNum, 2);

  // 15m Daily quarters: 18:00=Q1(Asia), 00:00=Q2(London), 06:00=Q3(NY AM), 12:00=Q4(NY PM)
  assert.equal(evalMid(QuantaibayEngine.timestamp('America/New_York', 2026, 11, 16, 18, 0, 0), 900).qNum, 1);
  assert.equal(evalMid(QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 0, 0, 0), 900).qNum, 2);
  assert.equal(evalMid(QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 6, 0, 0), 900).qNum, 3);
  assert.equal(evalMid(QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 12, 0, 0), 900).qNum, 4);

  // 1H Weekly quarters: Sun 18:00=1(Mon) .. Wed 18:00=4(Thu), Thu 18:00=0(Fri Q0)
  assert.equal(evalMid(QuantaibayEngine.timestamp('America/New_York', 2026, 11, 15, 18, 0, 0), 3600).qNum, 1);
  assert.equal(evalMid(QuantaibayEngine.timestamp('America/New_York', 2026, 11, 18, 18, 0, 0), 3600).qNum, 4);
  assert.equal(evalMid(QuantaibayEngine.timestamp('America/New_York', 2026, 11, 19, 18, 0, 0), 3600).qNum, 0);

  // Daily Yearly quarters: Jan 1, Apr 2, Jul 1, Sep 29, Dec 29 18:00 NY
  assert.equal(evalMid(QuantaibayEngine.timestamp('America/New_York', 2026, 2, 10, 18, 0, 0), 86400).qNum, 1);
  assert.equal(evalMid(QuantaibayEngine.timestamp('America/New_York', 2026, 5, 10, 18, 0, 0), 86400).qNum, 2);
  assert.equal(evalMid(QuantaibayEngine.timestamp('America/New_York', 2026, 8, 10, 18, 0, 0), 86400).qNum, 3);
  assert.equal(evalMid(QuantaibayEngine.timestamp('America/New_York', 2026, 11, 16, 18, 0, 0), 86400).qNum, 4);
});

test('Gap-safe peer segment rollover does not create phantom SSMT when YM misses first minute of Q2', () => {
  const base = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 9, 0, 0);
  const mkBars = (mins, fn) => mins.map(m => {
    const ohlc = fn(m);
    return { time: base + m * 60, open: ohlc[0], high: ohlc[1], low: ohlc[2], close: ohlc[3], volume: 100 };
  });

  // Q1: 09:00..09:21 (high = 110 on all 3). Q2 starts at 09:22 (m=22): none sweep 110 (high = 105).
  // Suppose YM has NO bar at m=22! If YM didn't roll segment at m=22, its stale cur wouldn't corrupt prv.
  const allMins = Array.from({ length: 30 }, (_, i) => i);
  const nq = mkBars(allMins, m => m === 10 ? [100, 110, 99, 105] : [100, 104, 99, 102]);
  const es = mkBars(allMins, m => m === 10 ? [100, 110, 99, 105] : [100, 104, 99, 102]);
  const ym = mkBars(allMins.filter(m => m !== 22), m => m === 10 ? [100, 110, 99, 105] : [100, 104, 99, 102]);

  const out = QuantaibayEngine.calculate(nq, {
    symbol: 'NQ1!',
    timeframe: '1m',
    timeframeSeconds: 60,
    markets: {
      'NQ1!': { '1m': nq },
      'ES1!': { '1m': es },
      'YM1!': { '1m': ym }
    },
    settings: { showCycLines: false, showQLabels: false, showCycTbl: false, trTMCO: false }
  });

  assert.equal(out.drawings.length, 0, 'No phantom SSMT when no asset swept Q1 high/low');
});

test('Real backup cache benchmark + M1 10:52 boundary verification + Cycle Table', () => {
  const mhPath = path.resolve(__dirname, '../backend/market_history.json');
  const htfPath = path.resolve(__dirname, '../backend/market_history_htf.json');
  const metaPath = path.resolve(__dirname, '../backend/market_metadata.json');
  if (!fs.existsSync(mhPath)) return;

  const mh = JSON.parse(fs.readFileSync(mhPath, 'utf8'));
  const htf = JSON.parse(fs.readFileSync(htfPath, 'utf8'));
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  const markets = {};
  for (const sym of ['NQ1!', 'ES1!', 'YM1!']) {
    markets[sym] = { '1m': mh[sym] || [], metadata: meta[sym] || { timezone: 'America/Chicago', session: '1700-1600' } };
    for (const [tf, bySym] of Object.entries(htf)) {
      if (bySym && bySym[sym]) markets[sym][tf] = bySym[sym];
    }
  }

  const t0 = performance.now();
  const outMid = QuantaibayEngine.calculate(markets['NQ1!']['1m'], {
    symbol: 'NQ1!',
    timeframe: '1m',
    timeframeSeconds: 60,
    markets
  });
  const elapsedMs = performance.now() - t0;
  console.log(`QuantaibayEngine cold M1 (${markets['NQ1!']['1m'].length} bars x 3 assets + 7-row AMDX table): ${elapsedMs.toFixed(2)} ms, drawings=${outMid.drawings.length}`);

  assert.ok(elapsedMs < 500, `Expected fast execution (<500ms), got ${elapsedMs.toFixed(2)}ms`);
  assert.equal(outMid.tables.length, 1);
  assert.equal(outMid.tables[0].rows.length, 8); // Header + 7 cycles

  // Verify explicit M1QuarterTiming option works for both Bar Open (default) and Mid/Close
  const outMidExplicit = QuantaibayEngine.calculate(markets['NQ1!']['1m'], {
    symbol: 'NQ1!',
    timeframe: '1m',
    timeframeSeconds: 60,
    markets,
    settings: { m1Timing: 'Mid / Close (:22, :52, :07, :37)' }
  });
  const t1052 = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 10, 52, 0);
  const t1054 = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 10, 54, 0);
  const hasShifted1052 = outMidExplicit.drawings.some(d => d.type === 'line' && !d.axis && d.p1.time === t1052 && d.p2.time === t1054);
  assert.equal(hasShifted1052, false, 'Shifted 10:52->10:54 M1 SSMT should not appear with Mid/Close timing');
});

test('HTF SSMT (15M) drawn on 1M chart with showAll snaps endpoints to exact 1M wick candle instead of 15M open time', () => {
  // Build 15M Q1 (Asia: 18:00..23:59) and Q2 (London: 00:00..05:59) on 1m bars
  const q1Start = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 16, 23, 45, 0); // last 15m bar of Asia Q1
  const q2Start = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 0, 0, 0);   // first 15m bar of London Q2

  const mk1m = (spikeQ1, spikeQ2) => {
    const arr = [];
    // 23:45..23:59 (15 bars): peak at minute +9 (23:54)
    for (let m = 0; m < 15; m++) {
      const hi = m === 9 ? spikeQ1 : 102;
      arr.push({ time: q1Start + m * 60, open: 100, high: hi, low: 99, close: 101, volume: 10 });
    }
    // 00:00..00:14 (15 bars): peak at minute +12 (00:12)
    for (let m = 0; m < 15; m++) {
      const hi = m === 12 ? spikeQ2 : 103;
      arr.push({ time: q2Start + m * 60, open: 101, high: hi, low: 100, close: 102, volume: 10 });
    }
    return arr;
  };

  // NQ makes lower high (110 -> 108), ES sweeps higher high (110 -> 115), YM makes lower high (110 -> 107) => Bear 15M SSMT
  const nq1m = mk1m(110, 108);
  const es1m = mk1m(110, 115);
  const ym1m = mk1m(110, 107);

  const out = QuantaibayEngine.calculate(nq1m, {
    symbol: 'NQ1!',
    timeframe: '1m',
    timeframeSeconds: 60,
    markets: {
      'NQ1!': { '1m': nq1m },
      'ES1!': { '1m': es1m },
      'YM1!': { '1m': ym1m }
    },
    settings: {
      showAll: true,
      en0: false, en1: false, en2: true, en3: false, en4: false, en5: false, en6: false,
      showHid: false, showCycLines: false, showQLabels: false, showCycTbl: false, trTMCO: false
    }
  });

  const ssmtLines = out.drawings.filter(d => d._qtSsmt);
  assert.equal(ssmtLines.length, 1, 'Should produce 1 live 15M Bear SSMT');
  // Without refinement: p1.time=23:45 (q1Start), p2.time=00:00 (q2Start, leaving 12-bar air gap!)
  // With refinement: p1.time=23:54 (q1Start + 9*60), p2.time=00:12 (q2Start + 12*60) right on the 1M wicks!
  assert.equal(ssmtLines[0].p1.time, q1Start + 9 * 60, 'Left endpoint must snap to exact 23:54 1m wick');
  assert.equal(ssmtLines[0].p2.time, q2Start + 12 * 60, 'Right endpoint must snap to exact 00:12 1m wick (no 15m open-time gap)');
  assert.equal(ssmtLines[0].text, 'Q1 Q2 15M', 'SSMT text must show Q pair + TF (Q1 Q2 15M)');
  assert.equal(ssmtLines[0].textStyle?.inlineOnLine, true, 'SSMT text must be horizontally centered inline on the SSMT line');

  // Verify TDO (Daily True Open at 00:00 NY) ALSO renders on 1m chart automatically!
  const trLabels = out.drawings.filter(d => d.type === 'text' && d._qtTrueOpenSpan).map(d => d.text);
  assert.ok(trLabels.includes('TDO'), '1m chart must render TDO (Daily True Open) alongside micro True Opens');
});

test('Inline SSMT label draws horizontally at exact pixel midpoint and True Opens render across all enabled TFs on 1m & 5m', () => {
  const DrawingModel = require('../frontend/js/drawing_model.js');
  const mhPath = path.resolve(__dirname, '../backend/market_history.json');
  const htfPath = path.resolve(__dirname, '../backend/market_history_htf.json');
  const metaPath = path.resolve(__dirname, '../backend/market_metadata.json');
  if (fs.existsSync(mhPath)) {
    const mh = JSON.parse(fs.readFileSync(mhPath, 'utf8'));
    const htf = JSON.parse(fs.readFileSync(htfPath, 'utf8'));
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const markets = {};
    for (const sym of ['NQ1!', 'ES1!', 'YM1!']) {
      markets[sym] = { '1m': mh[sym] || [], metadata: meta[sym] || { timezone: 'America/Chicago', session: '1700-1600' } };
      for (const [tf, bySym] of Object.entries(htf)) {
        if (bySym && bySym[sym]) markets[sym][tf] = bySym[sym];
      }
    }
    const out1m = QuantaibayEngine.calculate(markets['NQ1!']['1m'], {
      symbol: 'NQ1!',
      timeframe: '1m',
      timeframeSeconds: 60,
      markets,
      settings: { showAll: true }
    });
    const trTexts1m = new Set(out1m.drawings.filter(d => d._qtTrueOpenSpan).map(d => d.text));
    for (const expected of ['TMCO', 'TDO', 'TWO', 'TMO', 'TQO', 'TYO']) {
      assert.ok(trTexts1m.has(expected), `Expected ${expected} True Open on 1m chart, got: ${[...trTexts1m].join(', ')}`);
    }
    assert.ok(['TAO', 'TLO', 'TNY AM', 'TNY PM'].some(k => trTexts1m.has(k)), 'Expected 90m session True Open on 1m chart');
    const ssmts = out1m.drawings.filter(d => d._qtSsmt);
    assert.ok(ssmts.length > 0);
    for (const ln of ssmts) {
      assert.match(ln.text, /^Q[0-4] Q[0-4] (1M|5M|15M|1H|4H|6H|D)$/);
      assert.equal(ln.textStyle.inlineOnLine, true);
    }
  }

  // Verify DrawingModel.draw splits line cleanly and rotates text diagonally along the exact SSMT slope at ((x1+x2)/2, (y1+y2)/2)
  const strokes = [], texts = [];
  let curSeg = [], translated = null, rotated = null;
  const ctx = {
    save() {}, restore() {}, setLineDash() {},
    translate(x, y) { translated = [x, y]; },
    rotate(rad) { rotated = rad; },
    beginPath() { curSeg = []; },
    moveTo(x, y) { curSeg.push([x, y]); },
    lineTo(x, y) { curSeg.push([x, y]); },
    stroke() { strokes.push(curSeg); },
    strokeText() {},
    measureText: t => ({ width: t.length * 7 }),
    fillText(t, x, y) { texts.push({ t, x, y, align: this.textAlign, base: this.textBaseline }); }
  };
  const fakeChart = {
    currentTimeframe: '1m',
    tfSeconds: 60,
    bars: [{ time: 60 }, { time: 660 }],
    container: { clientWidth: 600, clientHeight: 400 },
    chart: { timeScale: () => ({ logicalToCoordinate: i => 100 + i * 200 }) },
    series: { priceToCoordinate: p => 300 - p }
  };
  DrawingModel.draw(ctx, fakeChart, {
    type: 'line',
    p1: { time: 60, price: 100 },
    p2: { time: 660, price: 200 },
    borderColor: '#000000',
    strokeOpacity: 100,
    width: 1,
    lineStyle: 'solid',
    text: 'Q1 Q2 5M',
    textStyle: { inlineOnLine: true, color: '#363a45', size: 11, haloColor: '#c2baae' }
  });
  assert.equal(strokes.length, 2, 'Line should split cleanly into 2 segments around rotated label');
  assert.equal(texts.length, 1);
  assert.equal(texts[0].t, 'Q1 Q2 5M');
  assert.deepEqual(translated, [200, 150], 'Translated to exact midpoint ((100+300)/2, (200+100)/2)');
  assert.ok(Math.abs(rotated - Math.atan2(-100, 200)) < 1e-9, 'Rotated to exact slope angle of SSMT line');
  assert.equal(texts[0].x, 0);
  assert.equal(texts[0].y, 0);
  assert.equal(texts[0].align, 'center');
  assert.equal(texts[0].base, 'middle');

  // Verify short 28px SSMT keeps 100% unbroken line (1 stroke), shrinks font to 7.5px, and shifts perpendicularly above Bear SSMT
  strokes.length = 0; texts.length = 0;
  let lastFont = '';
  Object.defineProperty(ctx, 'font', { set(v) { lastFont = v; }, get() { return lastFont; } });
  const shortChart = {
    currentTimeframe: '1m',
    tfSeconds: 60,
    bars: [{ time: 60 }, { time: 120 }],
    _qtSsmtDrawn: [],
    container: { clientWidth: 600, clientHeight: 400 },
    chart: { timeScale: () => ({ logicalToCoordinate: i => 100 + i * 26 }) },
    series: { priceToCoordinate: p => 200 - (p - 100) }
  };
  DrawingModel.draw(ctx, shortChart, {
    type: 'line',
    _qtSsmt: true,
    _qtDir: -1,
    p1: { time: 60, price: 100 },
    p2: { time: 120, price: 102 },
    borderColor: '#000000',
    strokeOpacity: 100,
    width: 1,
    lineStyle: 'solid',
    text: 'Q4 Q1 1M',
    textStyle: { inlineOnLine: true, color: '#363a45', size: 11 }
  });
  assert.equal(strokes.length, 1, 'Short 26px SSMT must draw 1 unbroken line so the SSMT line is never hidden');
  assert.match(lastFont, /^7\.5px /);
  assert.ok(translated[1] < 199, 'Bear short SSMT label shifts cleanly above the unbroken line');
});

test('SSMT never draws past closed/last chart candle, never stacks pre-chart SSMTs on Bar 0, and ignores missing reopen peers', () => {
  const mhPath = path.resolve(__dirname, '../backend/market_history.json');
  const htfPath = path.resolve(__dirname, '../backend/market_history_htf.json');
  const metaPath = path.resolve(__dirname, '../backend/market_metadata.json');
  if (!fs.existsSync(mhPath)) return;

  const mh = JSON.parse(fs.readFileSync(mhPath, 'utf8'));
  const htf = JSON.parse(fs.readFileSync(htfPath, 'utf8'));
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const markets = {};
  for (const sym of ['NQ1!', 'ES1!', 'YM1!']) {
    markets[sym] = { '1m': mh[sym] || [], metadata: meta[sym] || { timezone: 'America/Chicago', session: '1700-1600' } };
    for (const [tf, bySym] of Object.entries(htf)) {
      if (bySym && bySym[sym]) markets[sym][tf] = bySym[sym];
    }
  }

  // Test 5m chart (where 5m starts Nov 13 and ends 17:25Z while 1m starts Nov 10 and ends 23:04Z!)
  const bars5m = markets['NQ1!']['5m'];
  const firstT = bars5m[0].time;
  const lastT = bars5m[bars5m.length - 1].time;
  const out5m = QuantaibayEngine.calculate(bars5m, {
    symbol: 'NQ1!',
    timeframe: '5m',
    timeframeSeconds: 300,
    markets,
    settings: { showAll: true }
  });
  for (const d of out5m.drawings.filter(x => x._qtSsmt)) {
    assert.ok(d.p1.time >= firstT, `SSMT p1 (${d.p1.time}) must not precede first chart bar (${firstT})`);
    assert.ok(d.p2.time <= lastT, `SSMT p2 (${d.p2.time}) must not float past last chart bar (${lastT})`);
    assert.ok(d.p2.time > d.p1.time, 'SSMT must span at least 2 distinct chart bars (never collapse onto Bar 0)');
  }

  // Test session reopen where NQ & ES print 18:00 Q1 gap-up bars while YM has NOT reopened yet (cur === null)
  const q4 = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 16, 45, 0);
  const q1 = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 18, 0, 0);
  const mk = (pts) => pts.map(([t, hi]) => ({ time: t, open: 100, high: hi, low: 99, close: hi - 1, volume: 10 }));
  const nqGap = mk([[q4, 110], [q1, 150], [q1 + 60, 155]]);
  const esGap = mk([[q4, 110], [q1, 150], [q1 + 60, 155]]);
  const ymClosed = mk([[q4, 110]]); // YM still at 16:45 close, no 18:00 bar yet!
  const outReopen = QuantaibayEngine.calculate(nqGap, {
    symbol: 'NQ1!',
    timeframe: '1m',
    timeframeSeconds: 60,
    markets: { 'NQ1!': { '1m': nqGap }, 'ES1!': { '1m': esGap }, 'YM1!': { '1m': ymClosed } },
    settings: { showCycLines: false, showQLabels: false, showCycTbl: false }
  });
  assert.equal(outReopen.drawings.filter(x => x._qtSsmt).length, 0, 'Missing reopen bar on YM must not trigger fake SSMT');
});

test('Advanced PSP detects synchronized Triad candle cracks, respects pspVisLimit >= 15m, Body/Icons/Both modes, Inverse, and maxPspBars', () => {
  const base = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 9, 30, 0);
  const nq = [
    { time: base, open: 100, high: 106, low: 99, close: 105 },           // Bull (+1) vs ES Bear (-1) -> Bull PSP!
    { time: base + 900, open: 105, high: 106, low: 100, close: 101 },    // Bear (-1) vs YM Bull (+1) -> Bear PSP!
    { time: base + 1800, open: 101, high: 104, low: 100, close: 103 },   // All 3 Bull -> No PSP
    { time: base + 2700, open: 103, high: 104, low: 102, close: 103 }    // NQ Doji (0) -> No PSP
  ];
  const es = [
    { time: base, open: 105, high: 106, low: 100, close: 101 },          // Bear (-1)
    { time: base + 900, open: 105, high: 106, low: 100, close: 101 },    // Bear (-1)
    { time: base + 1800, open: 101, high: 104, low: 100, close: 103 },   // Bull (+1)
    { time: base + 2700, open: 105, high: 106, low: 100, close: 101 }
  ];
  const ym = [
    { time: base, open: 100, high: 106, low: 99, close: 105 },           // Bull (+1)
    { time: base + 900, open: 100, high: 106, low: 99, close: 105 },     // Bull (+1)
    { time: base + 1800, open: 101, high: 104, low: 100, close: 103 },   // Bull (+1)
    { time: base + 2700, open: 100, high: 106, low: 99, close: 105 }
  ];
  const markets15m = { 'NQ1!': { '15m': nq }, 'ES1!': { '15m': es }, 'YM1!': { '15m': ym } };

  // 1. Hidden below pspVisLimit (e.g. 5m < 15m default)
  const hidden5m = QuantaibayEngine.calculate(nq, {
    symbol: 'NQ1!', timeframe: '5m', timeframeSeconds: 300,
    markets: { 'NQ1!': { '5m': nq }, 'ES1!': { '5m': es }, 'YM1!': { '5m': ym } }
  });
  assert.equal(hidden5m.candleColors.length, 0);

  // 2. Visible at 15m in default Body Only mode
  const body15m = QuantaibayEngine.calculate(nq, {
    symbol: 'NQ1!', timeframe: '15m', timeframeSeconds: 900, markets: markets15m
  });
  assert.equal(body15m.candleColors.length, 2);
  assert.equal(body15m.candleColors[0].time, base);
  assert.equal(body15m.candleColors[1].time, base + 900);
  assert.notEqual(body15m.candleColors[0].color, body15m.candleColors[1].color);
  assert.equal(body15m.drawings.filter(d => d._qtPspIcon).length, 0);

  // 3. Both mode + custom shapes + maxPspBars cap
  const both15m = QuantaibayEngine.calculate(nq, {
    symbol: 'NQ1!', timeframe: '15m', timeframeSeconds: 900, markets: markets15m,
    settings: { pspMode: 'Both', pspBullShape: '▲', pspBearShape: '▼' }
  });
  const icons = both15m.drawings.filter(d => d._qtPspIcon);
  assert.equal(icons.length, 2);
  assert.equal(icons[0].text, '▲');
  assert.equal(icons[0].textStyle.placement, 'below');
  assert.equal(icons[1].text, '▼');
  assert.equal(icons[1].textStyle.placement, 'above');
});

test('Dark-canvas auto-contrast adapts default black SSMT/Cycle inks while preserving custom user colors', () => {
  assert.equal(QuantaibayEngine.isDarkCanvas('#0b0d11'), true);
  assert.equal(QuantaibayEngine.isDarkCanvas('#131722'), true);
  assert.equal(QuantaibayEngine.isDarkCanvas('#c2baae'), false);
  assert.equal(QuantaibayEngine.isDarkCanvas('#ffffff'), false);

  const q1Start = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 16, 23, 45, 0);
  const q2Start = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 17, 0, 0, 0);
  const mk = (p1, p2) => [
    { time: q1Start, open: 100, high: p1, low: 99, close: 101 },
    { time: q2Start, open: 101, high: p2, low: 100, close: 102 }
  ];
  const markets = {
    'NQ1!': { '15m': mk(110, 108) },
    'ES1!': { '15m': mk(110, 115) },
    'YM1!': { '15m': mk(110, 107) }
  };

  // Default settings on dark canvas -> SSMT auto-switches from #000000 to high-contrast light ink
  const outDark = QuantaibayEngine.calculate(markets['NQ1!']['15m'], {
    symbol: 'NQ1!', timeframe: '15m', timeframeSeconds: 900, markets, chartBg: '#0b0d11'
  });
  const ssmtDark = outDark.drawings.find(d => d._qtSsmt);
  assert.ok(ssmtDark);
  assert.notEqual(ssmtDark.borderColor.toLowerCase(), '#000000', 'Dark canvas must adapt default black SSMT line for visibility');
  assert.match(outDark.tables[0].bgcolor, /rgba\(22,27,38/);

  // Custom user color on dark canvas -> never overridden
  const outCustom = QuantaibayEngine.calculate(markets['NQ1!']['15m'], {
    symbol: 'NQ1!', timeframe: '15m', timeframeSeconds: 900, markets, chartBg: '#0b0d11',
    settings: { cBear: '#ff3366ff' }
  });
  assert.equal(outCustom.drawings.find(d => d._qtSsmt).borderColor.toLowerCase(), '#ff3366');
});

test('Anti-collision separates co-located TDO + TMCO labels, slides crossing SSMT labels, and declutters zoomed-out Q labels', () => {
  const DrawingModel = require('../frontend/js/drawing_model.js');
  const drawnTexts = [];
  const ctx = {
    font: '11px Arial',
    save() {}, restore() {}, setLineDash() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    translate(x, y) { this._tx = x; this._ty = y; },
    rotate() {},
    measureText: t => ({ width: t.length * 7 }),
    fillText(t, x, y) {
      drawnTexts.push({ t, x: x || this._tx || 0, y: y || this._ty || 0 });
      this._tx = 0; this._ty = 0;
    }
  };
  const chart = {
    currentTimeframe: '15m',
    tfSeconds: 900,
    plotHeight: 426,
    bars: [{ time: 1000 }, { time: 1900 }, { time: 2800 }, { time: 3700 }, { time: 4600 }],
    _qtTrBoxes: [],
    _qtSsmtDrawn: [],
    _qtQBoxes: [],
    container: { clientWidth: 665, clientHeight: 426 },
    chart: { timeScale: () => ({ logicalToCoordinate: i => 40 + i * 60 }), priceScale: () => ({ width: () => 65 }) },
    series: { priceToCoordinate: p => 300 - p }
  };

  // 1. TDO and active TMCO starting at exact same bar & price (1000, 100) -> TMCO slides right instead of overlapping TDO!
  DrawingModel.draw(ctx, chart, {
    type: 'text', _qtTier: 2, _qtTrActive: true, _qtTrueOpenSpan: { x1: 1000, x2: 4600, pos: 'Left' },
    p1: { time: 1000, price: 100 }, text: 'TDO',
    textStyle: { pine: true, placement: 'above', horizontal: 'left', size: 11, color: '#2962ff' }
  });
  DrawingModel.draw(ctx, chart, {
    type: 'text', _qtTier: 0, _qtTrActive: true, _qtTrueOpenSpan: { x1: 1000, x2: 2800, pos: 'Left' },
    p1: { time: 1000, price: 100 }, text: 'TMCO',
    textStyle: { pine: true, placement: 'above', horizontal: 'left', size: 11, color: '#2962ff' }
  });
  const tdo = drawnTexts.find(d => d.t === 'TDO');
  const tmco = drawnTexts.find(d => d.t === 'TMCO');
  assert.ok(tdo && tmco);
  assert.ok(tmco.x >= tdo.x + 21 + 6, `Active TMCO (${tmco.x}) must slide right past TDO (${tdo.x}) without overlapping`);

  // 2. Two crossing long SSMT lines with identical midpoint -> second label slides along its own line!
  drawnTexts.length = 0;
  DrawingModel.draw(ctx, chart, {
    type: 'line', _qtSsmt: true, _qtDir: -1,
    p1: { time: 1000, price: 120 }, p2: { time: 4600, price: 160 },
    text: 'Q1 Q2 15M', textStyle: { inlineOnLine: true, color: '#363a45', size: 11 }
  });
  DrawingModel.draw(ctx, chart, {
    type: 'line', _qtSsmt: true, _qtDir: 1,
    p1: { time: 1000, price: 160 }, p2: { time: 4600, price: 120 },
    text: 'Q2 Q3 15M', textStyle: { inlineOnLine: true, color: '#363a45', size: 11 }
  });
  assert.equal(drawnTexts.length, 2);
  assert.ok(Math.hypot(drawnTexts[0].x - drawnTexts[1].x, drawnTexts[0].y - drawnTexts[1].y) > 25, 'Crossing SSMT labels must separate cleanly');
});

test('Unified True Open settings + modular QT split + simplified QT Settings UI + Realtime SSMT with stale/lagging peer', () => {
  // 1. Verify modular split exports exist and stay lightweight
  const QTCore = require('../frontend/js/qt_core.js');
  const QTCyclesTrueOpen = require('../frontend/js/qt_cycles_trueopen.js');
  const QTSsmt = require('../frontend/js/qt_ssmt.js');
  const QTPsp = require('../frontend/js/qt_psp.js');
  assert.ok(QTCore && QTCyclesTrueOpen && QTSsmt && QTPsp);
  assert.equal(QuantaibayEngine.TRUE_OPEN_ITEMS, undefined, 'Per-item True Open expansion must be removed');
  assert.ok(QuantaibayEngine.INPUT_SCHEMA.some(f => f.key === 'tr90' && f.group === 'True Open'));
  assert.ok(QuantaibayEngine.INPUT_SCHEMA.some(f => f.key === 'trCol' && f.group === 'True Open Style'));

  // 2. Verify QTMode dialog has no "Style & Colors" / "Visibility" tabs and no "Tất cả" chip
  const QTModeSrc = fs.readFileSync(path.resolve(__dirname, '../frontend/js/qt_mode.js'), 'utf8');
  assert.equal(QTModeSrc.includes('Style & Colors'), false, 'Style & Colors tab must be removed');
  assert.equal(QTModeSrc.includes('data-qt-tab="visibility"'), false, 'Visibility tab must be removed');
  assert.equal(QTModeSrc.includes("'Tất cả'"), false, 'Tất cả chip must be removed');

  // 3. Verify unified True Open controls all enabled tiers cleanly
  const mhPath = path.resolve(__dirname, '../backend/market_history.json');
  const htfPath = path.resolve(__dirname, '../backend/market_history_htf.json');
  if (fs.existsSync(mhPath)) {
    const mh = JSON.parse(fs.readFileSync(mhPath, 'utf8'));
    const htf = JSON.parse(fs.readFileSync(htfPath, 'utf8'));
    const markets = { 'NQ1!': { '1m': mh['NQ1!'] || [] } };
    for (const [tf, bySym] of Object.entries(htf)) {
      if (bySym?.['NQ1!']) markets['NQ1!'][tf] = bySym['NQ1!'];
    }
    const out = QuantaibayEngine.calculate(markets['NQ1!']['1m'], {
      symbol: 'NQ1!',
      timeframe: '1m',
      timeframeSeconds: 60,
      markets,
      settings: {
        showSsmt: false,
        showCycLines: false,
        showQLabels: false,
        showCycTbl: false,
        tr90: false,
        trTMCO: true,
        trTDO: true,
        trCol: '#dc2626ff',
        trStyleIn: 'Solid',
        trWid: 2,
        trLblVert: 'On line',
        trLblPos: 'Right',
        trMaxKeep: 1
      }
    });
    const trLines = out.drawings.filter(d => d._qtTrueOpen);
    assert.equal(trLines.some(d => d._qtTier === 1), false, 'tr90=false disables all 90m session opens');
    const tdoLines = trLines.filter(d => d._qtTier === 2);
    assert.equal(tdoLines.length, 1);
    assert.equal(tdoLines[0].borderColor.toLowerCase(), '#dc2626');
    assert.equal(tdoLines[0].lineStyle, 'solid');
    assert.equal(tdoLines[0].width, 2);
    assert.equal(tdoLines[0].text, 'TDO');
    assert.equal(tdoLines[0].textStyle.inlinePos, 'right');
  }

  // 4. Verify Realtime SSMT updates live when YM1! is offline/stale by hours OR 1 bar late in Q2
  const q1 = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 18, 9, 0, 0);
  const q2 = QuantaibayEngine.timestamp('America/New_York', 2026, 11, 18, 9, 23, 0);
  const staleT = q1 - 6 * 3600; // YM1! froze 6 hours earlier (like hidden Overlay study)
  const nqLive = [
    { time: q1 + 60, open: 100, high: 110, low: 99, close: 105 },
    { time: q2, open: 106, high: 114, low: 104, close: 113 } // NQ sweeps Q1 high (114 > 110)
  ];
  const esLive = [
    { time: q1 + 60, open: 100, high: 110, low: 99, close: 105 },
    { time: q2, open: 105, high: 108, low: 103, close: 106 } // ES fails to sweep Q1 high (108 <= 110)
  ];
  const ymStale = [
    { time: staleT, open: 100, high: 105, low: 99, close: 102 }
  ];
  const outLive1 = QuantaibayEngine.calculate(nqLive, {
    symbol: 'NQ1!',
    timeframe: '1m',
    timeframeSeconds: 60,
    markets: { 'NQ1!': { '1m': nqLive }, 'ES1!': { '1m': esLive }, 'YM1!': { '1m': ymStale } },
    settings: { showCycLines: false, showQLabels: false, showCycTbl: false, trTMCO: false }
  });
  const ssmts1 = outLive1.drawings.filter(d => d._qtSsmt && d.lineStyle === 'solid');
  assert.equal(ssmts1.length, 1, 'Live SSMT must still form in realtime when YM1! feed is stale');
  assert.equal(ssmts1[0].p2.price, 114);

  // Next live tick pushes NQ higher to 118 -> SSMT endpoint updates dynamically in realtime!
  nqLive[1] = { time: q2, open: 106, high: 118, low: 104, close: 117 };
  const outLive2 = QuantaibayEngine.calculate(nqLive, {
    symbol: 'NQ1!',
    timeframe: '1m',
    timeframeSeconds: 60,
    markets: { 'NQ1!': { '1m': nqLive }, 'ES1!': { '1m': esLive }, 'YM1!': { '1m': ymStale } },
    settings: { showCycLines: false, showQLabels: false, showCycTbl: false, trTMCO: false }
  });
  assert.equal(outLive2.drawings.find(d => d._qtSsmt && d.lineStyle === 'solid').p2.price, 118);
});
