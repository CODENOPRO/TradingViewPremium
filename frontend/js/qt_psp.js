/* Quantaibay Feature Module 3 — Advanced PSP (Adaptive Triad/Dyad Peer Candle Crack). */
const QTPsp = (() => {
  const Core = typeof QTCore !== 'undefined' ? QTCore : (typeof require === 'function' ? require('./qt_core.js') : null);
  if (!Core) return { computeAdvancedPsp: () => ({ candleColors: [], drawings: [] }) };
  const { parseColor, sizePx, tfToSeconds, getSeriesForRow } = Core;

  function computeAdvancedPsp({ bars, tf, chartSec, triad, ownShort, markets, sessionMode, cutoffTime, s }) {
    const candleColors = [];
    const drawings = [];
    const pspVisOk = s.usePsp && bars.length > 0 && chartSec >= tfToSeconds(s.pspVisLimit);
    if (!pspVisOk) return { candleColors, drawings };

    const showIcons = s.pspMode === 'Icons Only' || s.pspMode === 'Both';
    const showBody = s.pspMode === 'Body Only' || s.pspMode === 'Both';
    const peer1Sym = triad[1] && triad[1] !== ownShort ? triad[1] : null;
    const peer2Sym = triad[2] && triad[2] !== ownShort ? triad[2] : null;

    if ((!showIcons && !showBody) || (!peer1Sym && !peer2Sym)) {
      return { candleColors, drawings };
    }

    const p1Bars = (s.pspShowSmt1 !== false && peer1Sym) ? getSeriesForRow(markets, peer1Sym, tf, sessionMode, cutoffTime) : [];
    const p2Bars = (s.pspShowSmt2 !== false && peer2Sym) ? getSeriesForRow(markets, peer2Sym, tf, sessionMode, cutoffTime) : [];
    const mapP1 = new Map();
    const mapP2 = new Map();
    for (let i = 0; i < p1Bars.length; i++) mapP1.set(p1Bars[i].time, p1Bars[i]);
    for (let i = 0; i < p2Bars.length; i++) mapP2.set(p2Bars[i].time, p2Bars[i]);

    const cBullIcon = parseColor(s.pspBullClr, '#3292e0').css;
    const cBearIcon = parseColor(s.pspBearClr, '#d83939').css;
    const cBullBody = parseColor(s.pspBullBody, '#2195f3').css;
    const cBearBody = parseColor(s.pspBearBody, '#dd455c').css;
    const pspPx = sizePx(s.pspSizeStr === 'Auto' ? 'Small' : s.pspSizeStr, 10);
    const maxMarkers = Math.max(10, Number(s.maxPspBars) || 30);
    const pspLabels = [];

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const mDir = b.close > b.open ? 1 : b.close < b.open ? -1 : 0;
      if (mDir === 0) continue;

      const c1 = mapP1.get(b.time);
      const c2 = mapP2.get(b.time);
      let c1Dir = c1 ? (c1.close > c1.open ? 1 : c1.close < c1.open ? -1 : 0) : 0;
      let c2Dir = c2 ? (c2.close > c2.open ? 1 : c2.close < c2.open ? -1 : 0) : 0;
      if (s.pspInv1) c1Dir = -c1Dir;
      if (s.pspInv2) c2Dir = -c2Dir;

      const crack1 = s.pspShowSmt1 !== false && c1 !== undefined && c1Dir !== 0 && mDir !== c1Dir;
      const crack2 = s.pspShowSmt2 !== false && c2 !== undefined && c2Dir !== 0 && mDir !== c2Dir;

      if (crack1 || crack2) {
        const isBull = mDir === 1;
        if (showBody) {
          candleColors.push({ time: b.time, color: isBull ? cBullBody : cBearBody });
        }
        if (showIcons) {
          pspLabels.push({
            type: 'text',
            _qtPspIcon: true,
            p1: { time: b.time, price: isBull ? b.low : b.high },
            text: isBull ? s.pspBullShape : s.pspBearShape,
            labelBg: null,
            textStyle: {
              pine: true,
              placement: isBull ? 'below' : 'above',
              color: isBull ? cBullIcon : cBearIcon,
              size: pspPx,
              horizontal: 'center',
              vertical: 'inside'
            }
          });
          if (pspLabels.length > maxMarkers) pspLabels.shift();
        }
      }
    }

    if (pspLabels.length) drawings.push(...pspLabels);
    return { candleColors, drawings };
  }

  return { computeAdvancedPsp };
})();

if (typeof window !== 'undefined') window.QTPsp = QTPsp;
if (typeof module !== 'undefined') module.exports = QTPsp;
