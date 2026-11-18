/* Quantaibay Feature Module 1 — Cycle Vertical Lines, Q / AMDX Labels & Multi-TF True Open. */
const QTCyclesTrueOpen = (() => {
  const Core = typeof QTCore !== 'undefined' ? QTCore : (typeof require === 'function' ? require('./qt_core.js') : null);
  if (!Core) return { pinQLabels() {}, pinTrueOpenLabels() {}, computeCyclesAndTrueOpen: () => ({ drawings: [], qLabelMeta: [], trLabelMeta: [] }) };
  const {
    DAY_SEC, HOUR_SEC, MIN_SEC, ROW_KEYS, ROW_SEC,
    parseColor, themeColor, sizePx, lineStyleNorm, sessionStart,
    createAmdxTracker, formatQLabel, getSeriesForRow, snapToChartBar, firstBarAtOrAfter
  } = Core;

  function pinQLabels(qLabels, bars, logicalRange, labelPadPct = 8) {
    if (!qLabels?.length || !bars?.length) return;
    let fromIdx = 0;
    let toIdx = bars.length - 1;
    if (logicalRange && Number.isFinite(logicalRange.from) && Number.isFinite(logicalRange.to)) {
      fromIdx = Math.max(0, Math.floor(logicalRange.from));
      toIdx = Math.min(bars.length - 1, Math.ceil(logicalRange.to));
    } else {
      fromIdx = Math.max(0, bars.length - 85);
    }
    if (fromIdx > toIdx) {
      fromIdx = Math.max(0, bars.length - 85);
      toIdx = bars.length - 1;
    }
    let visHi = -Infinity;
    let visLo = Infinity;
    for (let i = fromIdx; i <= toIdx; i++) {
      const b = bars[i];
      if (b.high > visHi) visHi = b.high;
      if (b.low < visLo) visLo = b.low;
    }
    if (!Number.isFinite(visLo) || !Number.isFinite(visHi)) return;
    const pinY = visLo - (visHi - visLo) * (Number(labelPadPct) || 0) / 100;
    for (let i = 0; i < qLabels.length; i++) {
      qLabels[i].p1.price = pinY;
    }
  }

  function pinTrueOpenLabels(trLabels, bars, logicalRange, chartSec = 60) {
    if (!trLabels?.length || !bars?.length) return;
    const step = chartSec || 60;
    let leftIdx = Math.max(0, bars.length - 85);
    let rightIdx = bars.length - 1;
    if (logicalRange && Number.isFinite(logicalRange.from) && Number.isFinite(logicalRange.to)) {
      leftIdx = Math.max(0, Math.min(bars.length - 1, Math.ceil(logicalRange.from) + 1));
      rightIdx = Math.max(0, Math.min(bars.length - 1, Math.floor(logicalRange.to)));
    }
    const visLeftT = bars[leftIdx].time;
    const visRightT = (logicalRange && Number.isFinite(logicalRange.to) && logicalRange.to >= bars.length)
      ? bars[bars.length - 1].time + (logicalRange.to - (bars.length - 1)) * step
      : bars[rightIdx].time;

    for (let i = 0; i < trLabels.length; i++) {
      const lb = trLabels[i];
      const sp = lb._qtTrueOpenSpan;
      if (!sp) continue;
      if (sp.pos === 'Left') {
        lb.p1.time = (sp.x1 < visLeftT && sp.x2 > visLeftT + step * 2) ? visLeftT : sp.x1;
      } else if (sp.pos === 'Right') {
        lb.p1.time = (sp.x2 > visRightT && sp.x1 < visRightT - step * 2) ? Math.max(sp.x1, visRightT - step) : sp.x2;
      } else {
        const a = Math.max(sp.x1, visLeftT);
        const b = Math.min(sp.x2, visRightT);
        lb.p1.time = a < b ? Math.trunc((a + b) / 2) : Math.trunc((sp.x1 + sp.x2) / 2);
      }
    }
  }

  function computeCyclesAndTrueOpen({
    bars, chartSec, tfKey, m1UseMid, ownShort, markets,
    sessionMode, cutoffTime, visibleLogicalRange, darkBg, s, evalCycle
  }) {
    if (!bars.length) return { drawings: [], qLabelMeta: [], trLabelMeta: [] };

    const stepChartAmdx = createAmdxTracker(s.rangeMode === 'Whole Previous Cycle');
    const vLines = [];
    const qLabels = [];
    const trLines = [];
    const trLabels = [];
    const qLabelMeta = [];
    const trLabelMeta = [];

    const cVLine = themeColor(s, 'lineColor', darkBg, '#000000');
    const cOpenLine = themeColor(s, 'cycOpenColor', darkBg, '#2962ff');
    const cQText = themeColor(s, 'qColor', darkBg, '#363a45');
    const qFontPx = sizePx(s.qSizeInput, 11);
    const cycOpenStyle = lineStyleNorm(s.cycOpenStyle);

    let prevSeg = null;
    let prevBarMid = null;
    let prevIsX = false;
    let prevUseLetters = false;
    let curLbl = null;
    let curStartIdx = null;
    let q1Lbl = null;
    let q1LblCyc = null;

    const pushVLine = (tSec, isOpen, refBar) => {
      const col = isOpen ? cOpenLine : cVLine;
      vLines.push({
        type: 'line',
        axis: 'vertical',
        p1: { time: tSec, price: refBar.low },
        p2: { time: tSec, price: refBar.high },
        borderColor: col.hex,
        strokeOpacity: col.opacity,
        width: isOpen ? s.cycOpenWidth : s.lineWidth,
        lineStyle: isOpen ? cycOpenStyle : 'dotted',
        extend: 'both'
      });
      if (vLines.length > s.maxVL) vLines.shift();
    };

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const prevBar = i > 0 ? bars[i - 1] : null;
      const { qMid: cQMid, qNum: cQNum, segStart: cSeg, extra: cExtra } = evalCycle(b.time, tfKey);
      const { isX: cIsX, haveRef: cHave, cycId: cCyc } = stepChartAmdx(b, cQNum, cSeg);

      if (s.showCycLines && cSeg !== null && (i === 0 || cSeg !== prevSeg)) {
        const lineTime = (tfKey === 60 && m1UseMid && i > 0)
          ? b.time
          : (prevBar && cSeg > prevBar.time && cSeg <= b.time ? b.time : cSeg);
        pushVLine(lineTime, cQNum === 1, b);
      }
      if (s.showCycLines && cExtra !== null && cQNum === 4 && b.time >= cExtra && (!prevBar || prevBar.time < cExtra)) {
        pushVLine(prevBar && cExtra > prevBar.time && cExtra <= b.time ? b.time : cExtra, true, b);
      }

      const useLetters = !!(s.useAMDX && cHave);
      const barMid = b.time + chartSec / 2;

      if (s.showQLabels) {
        if (cSeg !== null && prevSeg !== null && cSeg !== prevSeg) {
          if (curLbl && curStartIdx !== null) {
            const midIdx = Math.round((curStartIdx + i - 1) / 2);
            curLbl.p1.time = bars[Math.max(0, Math.min(bars.length - 1, midIdx))].time;
          }
          curLbl = null;
          curStartIdx = i;
        } else if (cSeg !== null && curStartIdx === null) {
          curStartIdx = i;
        }

        const hit = cQMid !== null && cQNum !== null && cQNum >= 1 && cQNum <= 4
          && barMid >= cQMid && prevBarMid !== null && prevBarMid < cQMid;

        if (hit) {
          const newLbl = {
            type: 'text',
            _qtQLabel: true,
            p1: { time: b.time, price: b.low },
            text: formatQLabel(tfKey, cQNum, cIsX, useLetters, s.showSub),
            labelBg: null,
            textStyle: {
              pine: true,
              placement: 'center',
              color: cQText.css,
              size: qFontPx,
              horizontal: 'center',
              vertical: 'inside'
            }
          };
          qLabels.push(newLbl);
          if (qLabels.length > s.maxQL) qLabels.shift();
          curLbl = newLbl;
          if (cQNum === 1) {
            q1Lbl = newLbl;
            q1LblCyc = cCyc;
          }
        }

        if (q1Lbl && cCyc !== null && cCyc === q1LblCyc && (cIsX !== prevIsX || useLetters !== prevUseLetters)) {
          q1Lbl.text = formatQLabel(tfKey, 1, cIsX, useLetters, s.showSub);
        }
      }

      prevSeg = cSeg;
      prevBarMid = barMid;
      prevIsX = cIsX;
      prevUseLetters = useLetters;
    }

    // Unified Multi-TF True Open (TMCO, 90m [TAO/TLO/TNY AM/TNY PM], TDO, TWO, TMO, TQO, TYO)
    const TR_SPANS = [4050, 16200, 64800, 259200, 1814400, 5896800, 23414400];
    const tierOn = [!!s.trTMCO, !!s.tr90, !!s.trTDO, !!s.trTWO, !!s.trTMO, !!s.trTQO, !!s.trTYO];
    const firstChartT = bars[0].time;
    const lastChartT = bars[bars.length - 1].time;
    const maxFutureT = lastChartT + chartSec * 45;

    const trCol = themeColor(s, 'trCol', darkBg, '#2962ff');
    const trLineStyle = lineStyleNorm(s.trStyleIn);
    const trWidth = Math.max(1, Math.min(5, Number(s.trWid) || 1));
    const trShowLbl = !!s.trShowLbl;
    const trFontPx = sizePx(s.trLblSizeIn, 11);
    const trPos = s.trLblPos || 'Left';
    const trVert = s.trLblVert || 'Above';
    const trKeep = Math.max(1, Number(s.trMaxKeep) || 16);

    let placement = 'center', horizontal = 'center';
    if (trVert === 'Above') {
      placement = 'above';
      horizontal = trPos === 'Left' ? 'left' : trPos === 'Right' ? 'right' : 'center';
    } else if (trVert === 'Below') {
      placement = 'below';
      horizontal = trPos === 'Left' ? 'left' : trPos === 'Right' ? 'right' : 'center';
    } else {
      placement = trPos === 'Left' ? 'label_left' : trPos === 'Right' ? 'label_right' : 'center';
      horizontal = trPos === 'Left' ? 'left' : trPos === 'Right' ? 'right' : 'center';
    }

    for (let r = 6; r >= 0; r--) {
      if (!tierOn[r] || TR_SPANS[r] < chartSec * 2) continue;
      let srcBars = getSeriesForRow(markets, ownShort, ROW_KEYS[r], sessionMode, cutoffTime);
      if (r === 5 && srcBars.length) {
        const h4 = getSeriesForRow(markets, ownShort, '4h', sessionMode, cutoffTime);
        if (h4.length && h4[0].time < srcBars[0].time) {
          const cut = srcBars[0].time;
          srcBars = [...h4.filter(b => b.time < cut), ...srcBars];
        }
      }
      if (!srcBars.length && ROW_SEC[r] >= chartSec) srcBars = bars;
      if (!srcBars.length) continue;

      const cs = ROW_SEC[r];
      let pQ = null;
      let pSeg = null;
      const found = [];

      for (let i = 0; i < srcBars.length; i++) {
        const b = srcBars[i];
        const { qNum: cQNum, segStart: cSeg, extra: cExtra, sess: cSess } = evalCycle(b.time, cs);
        const q2Start = cQNum === 2 && i > 0 && pQ !== null && (pQ !== 2 || cSeg !== pSeg);
        if (q2Start) {
          let endT = null, txt = '';
          if (r === 0) {
            endT = cSeg + Math.trunc(67.5 * MIN_SEC);
            txt = 'TMCO';
          } else if (r === 1) {
            const blk = ((Math.floor((b.time - cSess) / (6 * HOUR_SEC)) % 4) + 4) % 4;
            txt = blk === 0 ? 'TAO' : blk === 1 ? 'TLO' : blk === 2 ? 'TNY AM' : 'TNY PM';
            endT = cSeg + 270 * MIN_SEC;
          } else if (r === 2) {
            endT = cSeg + 18 * HOUR_SEC;
            txt = 'TDO';
          } else if (r === 3) {
            endT = sessionStart(cSeg + 3 * DAY_SEC + 3 * HOUR_SEC, s.tz);
            txt = 'TWO';
          } else if (r === 4) {
            endT = sessionStart(cSeg + 21 * DAY_SEC + 3 * HOUR_SEC, s.tz);
            txt = 'TMO';
          } else if (r === 5) {
            endT = cSeg + Math.trunc(68.25 * DAY_SEC);
            txt = 'TQO';
          } else if (r === 6) {
            endT = cExtra;
            txt = 'TYO';
          }
          if (endT !== null) {
            found.push({ startT: b.time, endT, price: b.open, txt });
            if (found.length > trKeep) found.shift();
          }
        }
        pQ = cQNum;
        pSeg = cSeg;
      }

      found.sort((a, b) => b.startT - a.startT);
      const onLineLbl = trShowLbl && trVert === 'On line';

      for (let j = 0; j < found.length; j++) {
        const it = found[j];
        if (it.endT < firstChartT || it.startT >= lastChartT + chartSec) continue;
        const x1 = it.startT <= firstChartT
          ? firstChartT
          : cs < chartSec
            ? snapToChartBar(bars, it.startT, chartSec)
            : firstBarAtOrAfter(bars, it.startT);
        const x2 = it.endT <= lastChartT
          ? snapToChartBar(bars, it.endT, chartSec)
          : Math.min(it.endT, maxFutureT);
        if (x2 <= x1) continue;

        const isActive = it.endT > lastChartT;
        const lineOpacity = (!isActive && r <= 1)
          ? Math.max(28, Math.round(trCol.opacity * (r === 0 ? 0.5 : 0.68)))
          : trCol.opacity;
        const txtOpacity = (!isActive && r <= 1)
          ? Math.max(28, Math.round(trCol.opacity * (r === 0 ? 0.55 : 0.72)))
          : trCol.opacity;
        const lblCss = (!isActive && r <= 1)
          ? parseColor(trCol.hex + Math.round((txtOpacity / 100) * 255).toString(16).padStart(2, '0')).css
          : trCol.css;

        trLines.push({
          type: 'line',
          _qtTrueOpen: true,
          _qtTier: r,
          _qtTrActive: isActive,
          p1: { time: x1, price: it.price },
          p2: { time: x2, price: it.price },
          borderColor: trCol.hex,
          strokeOpacity: lineOpacity,
          width: trWidth,
          lineStyle: trLineStyle,
          ...(onLineLbl ? {
            text: it.txt,
            textStyle: {
              inlineOnLine: true,
              inlinePos: trPos === 'Left' ? 'left' : trPos === 'Right' ? 'right' : 'center',
              color: lblCss,
              size: trFontPx
            }
          } : {})
        });

        if (trShowLbl && !onLineLbl) {
          const lx = trPos === 'Left' ? x1 : trPos === 'Right' ? x2 : Math.trunc((x1 + x2) / 2);
          const lbl = {
            type: 'text',
            _qtTrueOpenOnLine: false,
            _qtTier: r,
            _qtTrActive: isActive,
            _qtTrueOpenSpan: { x1, x2, pos: trPos },
            p1: { time: lx, price: it.price },
            text: it.txt,
            labelBg: null,
            textStyle: {
              pine: true,
              placement,
              color: lblCss,
              size: trFontPx,
              horizontal,
              vertical: 'inside'
            }
          };
          trLabels.push(lbl);
          trLabelMeta.push(lbl);
        }
      }
    }

    pinQLabels(qLabels, bars, visibleLogicalRange, s.labelPadPct);
    pinTrueOpenLabels(trLabels, bars, visibleLogicalRange, chartSec);
    for (const lb of qLabels) qLabelMeta.push(lb);

    return {
      drawings: [...vLines, ...trLines, ...trLabels, ...qLabels],
      qLabelMeta,
      trLabelMeta
    };
  }

  return {
    computeCyclesAndTrueOpen,
    pinQLabels,
    pinTrueOpenLabels
  };
})();

if (typeof window !== 'undefined') window.QTCyclesTrueOpen = QTCyclesTrueOpen;
if (typeof module !== 'undefined') module.exports = QTCyclesTrueOpen;
