/* Quantaibay (QT Cycle + AMDX + True Open + SSMT + PSP) — Lightweight Orchestrator.
 * Composes modular feature files: qt_core.js, qt_cycles_trueopen.js, qt_ssmt.js, qt_psp.js.
 */
const QuantaibayEngine = (() => {
  const req = p => (typeof require === 'function' ? require(p) : null);
  const Core = typeof QTCore !== 'undefined' ? QTCore : req('./qt_core.js');
  const Cycles = typeof QTCyclesTrueOpen !== 'undefined' ? QTCyclesTrueOpen : req('./qt_cycles_trueopen.js');
  const Ssmt = typeof QTSsmt !== 'undefined' ? QTSsmt : req('./qt_ssmt.js');
  const Psp = typeof QTPsp !== 'undefined' ? QTPsp : req('./qt_psp.js');
  if (!Core || !Cycles || !Ssmt || !Psp) {
    return {
      name: 'Quantaibay',
      DEFAULTS: {},
      INPUT_SCHEMA: [],
      TIMEZONES: ['America/New_York'],
      ASSET_OPTIONS: ['AUTO'],
      parseColor: () => ({ css: '#787b86', hexAlpha: '#787b86ff' }),
      isDarkCanvas: () => false,
      tfToSeconds: () => 60,
      resolveTriad: sym => [sym],
      parts: () => ({ year: 2026, month: 1, day: 1, hour: 0, minute: 0 }),
      timestamp: () => 0,
      sessionStart: t => t,
      makeCycleEvaluator: () => () => ({}),
      calculate: () => ({ name: 'Quantaibay', triad: [], drawings: [], candleColors: [], qLabels: [], trLabels: [], labelPadPct: 8, tables: [], warnings: [] }),
      pinQLabels() {},
      pinTrueOpenLabels() {}
    };
  }

  const {
    DEFAULTS, INPUT_SCHEMA, TIMEZONES, ASSET_OPTIONS,
    parseColor, isDarkCanvas, tfToSeconds, shortSym, resolveTriad,
    parts, timestamp, sessionStart, makeCycleEvaluator
  } = Core;

  function calculate(chartBars, context = {}) {
    const rawIn = context.settings || {};
    const s = { ...DEFAULTS, ...rawIn };
    const bars = Array.isArray(chartBars) ? chartBars : [];
    const tf = context.timeframe || '1m';
    const isWeekly = tf === 'W' || tf === '1W';
    const isDaily = tf === 'D' || tf === '1D';
    const chartSec = context.timeframeSeconds || ({
      '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '12h': 43200,
      D: 86400, W: 604800, '1M': 2592000, '3M': 7776000
    }[tf] || 60);

    const tfKey = (isDaily || isWeekly) ? 86400 : chartSec;
    const chartRow = chartSec === 60 ? 0
      : chartSec === 300 ? 1
      : chartSec === 900 ? 2
      : chartSec === 3600 ? 3
      : chartSec === 14400 ? 4
      : chartSec === 21600 ? 5
      : (chartSec === 86400 || isWeekly) ? 6
      : -1;

    const m1UseMid = s.m1Timing !== 'Bar Open (:23, :53, :08, :38)';
    const evalCycle = makeCycleEvaluator(s.tz, m1UseMid);
    const triad = resolveTriad(context.symbol || 'NQ1!', s);
    const markets = { ...(context.markets || {}) };
    const ownShort = shortSym(context.symbol || 'NQ1!');
    if (!markets[ownShort] && bars.length) {
      markets[ownShort] = { [tf]: bars, metadata: context.metadata || {} };
    }

    const sessionMode = context.sessionMode || 'ETH';
    const cutoffTime = bars.length
      ? (context.replay ? bars[bars.length - 1].time : bars[bars.length - 1].time + chartSec - 1)
      : undefined;
    const darkBg = isDarkCanvas(context.chartBg);

    const cycOut = Cycles.computeCyclesAndTrueOpen({
      bars,
      chartSec,
      tfKey,
      m1UseMid,
      ownShort,
      markets,
      sessionMode,
      cutoffTime,
      visibleLogicalRange: context.visibleLogicalRange,
      darkBg,
      s,
      evalCycle
    });

    const ssmtOut = Ssmt.computeSsmtAndTable({
      bars,
      chartSec,
      chartRow,
      triad,
      markets,
      sessionMode,
      cutoffTime,
      darkBg,
      s,
      evalCycle
    });

    const pspOut = Psp.computeAdvancedPsp({
      bars,
      tf,
      chartSec,
      triad,
      ownShort,
      markets,
      sessionMode,
      cutoffTime,
      s
    });

    return {
      name: 'Quantaibay',
      triad,
      drawings: [...cycOut.drawings, ...ssmtOut.drawings, ...pspOut.drawings],
      candleColors: pspOut.candleColors,
      qLabels: cycOut.qLabelMeta,
      trLabels: cycOut.trLabelMeta,
      labelPadPct: s.labelPadPct,
      tables: ssmtOut.tables,
      warnings: []
    };
  }

  return {
    name: 'Quantaibay',
    DEFAULTS,
    INPUT_SCHEMA,
    TIMEZONES,
    ASSET_OPTIONS,
    parseColor,
    isDarkCanvas,
    tfToSeconds,
    resolveTriad,
    parts,
    timestamp,
    sessionStart,
    makeCycleEvaluator,
    calculate,
    pinQLabels: Cycles.pinQLabels,
    pinTrueOpenLabels: Cycles.pinTrueOpenLabels
  };
})();

if (typeof window !== 'undefined') window.QuantaibayEngine = QuantaibayEngine;
if (typeof module !== 'undefined') module.exports = QuantaibayEngine;
