/* Quantaibay Feature Module 2 — Realtime Multi-Asset SSMT Engine & AMDX Cycle Table. */
const QTSsmt = (() => {
  const Core = typeof QTCore !== 'undefined' ? QTCore : require('./qt_core.js');
  const {
    DAY_SEC, HOUR_SEC, TFN, ROW_KEYS, ROW_SEC,
    themeColor, sizePx, lineStyleNorm, sessionStart, wkStart, wkNext,
    createAmdxTracker, getSeriesForRow, snapToChartBar
  } = Core;

  // Refine an HTF pivot timestamp onto the exact LTF chart candle inside [htfTime, htfEnd)
  function refineHtfPivotTime(chartBars, htfTime, htfEnd, htfBar, dir, hid) {
    if (!chartBars.length) return htfTime;
    let lo = 0, hi = chartBars.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (chartBars[mid].time < htfTime) lo = mid + 1;
      else hi = mid;
    }
    if (lo >= chartBars.length || chartBars[lo].time >= htfEnd) return htfTime;

    let endIdx = lo;
    while (endIdx + 1 < chartBars.length && chartBars[endIdx + 1].time < htfEnd) {
      endIdx++;
    }

    if (hid) {
      if (htfBar) {
        if (dir === -1) return htfBar.close >= htfBar.open ? chartBars[endIdx].time : chartBars[lo].time;
        return htfBar.close <= htfBar.open ? chartBars[endIdx].time : chartBars[lo].time;
      }
      let bestT = chartBars[lo].time;
      let bestV = dir === -1 ? Math.max(chartBars[lo].open, chartBars[lo].close) : Math.min(chartBars[lo].open, chartBars[lo].close);
      for (let i = lo + 1; i <= endIdx; i++) {
        const v = dir === -1 ? Math.max(chartBars[i].open, chartBars[i].close) : Math.min(chartBars[i].open, chartBars[i].close);
        if (dir === -1 ? v >= bestV : v <= bestV) { bestV = v; bestT = chartBars[i].time; }
      }
      return bestT;
    }

    let bestT = chartBars[lo].time;
    let bestV = dir === -1 ? chartBars[lo].high : chartBars[lo].low;
    for (let i = lo + 1; i <= endIdx; i++) {
      const v = dir === -1 ? chartBars[i].high : chartBars[i].low;
      if (dir === -1 ? v >= bestV : v <= bestV) {
        bestV = v;
        bestT = chartBars[i].time;
      }
    }
    return bestT;
  }

  function computeRowSsmtAndCode(r, cs, triad, markets, settings, evalCycle, needSsmt, needTable, sessionMode, cutoffTime) {
    const tfKey = ROW_KEYS[r];
    const barsA = getSeriesForRow(markets, triad[0], tfKey, sessionMode, cutoffTime);
    if (!barsA.length) return { ssmts: [], code: null };

    let tableCode = null;
    if (needTable) {
      const stepAmdx = createAmdxTracker(settings.rangeMode === 'Whole Previous Cycle');
      let lastQ = null, lastRes = null;
      for (let i = 0; i < barsA.length; i++) {
        const b = barsA[i];
        const cyc = evalCycle(b.time, cs);
        lastQ = cyc.qNum;
        lastRes = stepAmdx(b, cyc.qNum, cyc.segStart);
      }
      if (lastQ !== null && lastQ !== undefined && lastRes) {
        tableCode = lastQ * 4 + (lastRes.isX ? 2 : 0) + (lastRes.haveRef ? 1 : 0);
      }
    }

    if (!needSsmt) return { ssmts: [], code: tableCode };

    const barsB = getSeriesForRow(markets, triad[1], tfKey, sessionMode, cutoffTime);
    const barsC = getSeriesForRow(markets, triad[2], tfKey, sessionMode, cutoffTime);

    const lastBarTime = barsA[barsA.length - 1].time;
    const cutSec = r <= 3 ? wkStart(lastBarTime, settings.tz) - 2 * DAY_SEC : -Infinity;

    const sliceFrom = (arr, minT) => {
      if (minT === -Infinity || !arr.length) return arr;
      let lo = 0, hi = arr.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid].time < minT) lo = mid + 1;
        else hi = mid;
      }
      return lo > 0 ? arr.slice(lo) : arr;
    };

    const sA = sliceFrom(barsA, cutSec);
    const sB = sliceFrom(barsB, cutSec);
    const sC = sliceFrom(barsC, cutSec);
    if (!sA.length || (!sB.length && !sC.length)) return { ssmts: [], code: tableCode };

    const activeAssets = [sA.length > 0, sB.length > 0, sC.length > 0];
    const lastTimes = [
      sA.length ? sA[sA.length - 1].time : -Infinity,
      sB.length ? sB[sB.length - 1].time : -Infinity,
      sC.length ? sC[sC.length - 1].time : -Infinity
    ];
    const maxLastTime = Math.max(lastTimes[0], lastTimes[1], lastTimes[2]);
    const staleGap = Math.max(cs * 2, 600);

    const mapA = new Map(), mapB = new Map(), mapC = new Map();
    const timeSet = new Set();
    for (let i = 0; i < sA.length; i++) { mapA.set(sA[i].time, sA[i]); timeSet.add(sA[i].time); }
    for (let i = 0; i < sB.length; i++) { mapB.set(sB[i].time, sB[i]); timeSet.add(sB[i].time); }
    for (let i = 0; i < sC.length; i++) { mapC.set(sC[i].time, sC[i]); timeSet.add(sC[i].time); }
    const timeline = Array.from(timeSet).sort((a, b) => a - b);
    const maps = [mapA, mapB, mapC];

    const segState = [0, 1, 2].map(() => ({
      last: null,
      cq: null,
      pq: null,
      c: [null, null, null, null],
      p: [null, null, null, null],
      ct: [null, null, null, null],
      pt: [null, null, null, null]
    }));

    let live = [];
    let cycId = 0;
    let nextWeekReset = 0;

    const capOld = () => {
      let oldCnt = 0;
      for (let i = 0; i < live.length; i++) if (live[i].old) oldCnt++;
      let excess = oldCnt - settings.maxRow;
      if (excess > 0) {
        let i = 0;
        while (excess > 0 && i < live.length) {
          if (live[i].old) { live.splice(i, 1); excess--; }
          else i++;
        }
      }
    };

    for (let step = 0; step < timeline.length; step++) {
      const t = timeline[step];
      const { qNum: q, segStart: ss } = evalCycle(t, cs);

      // An asset whose feed stopped > staleGap behind the live stream is offline at t -> clean Dyad fallback
      const online = [
        activeAssets[0] && !(t > lastTimes[0] && maxLastTime - lastTimes[0] > staleGap),
        activeAssets[1] && !(t > lastTimes[1] && maxLastTime - lastTimes[1] > staleGap),
        activeAssets[2] && !(t > lastTimes[2] && maxLastTime - lastTimes[2] > staleGap)
      ];
      const onlineCount = (online[0] ? 1 : 0) + (online[1] ? 1 : 0) + (online[2] ? 1 : 0);

      for (let a = 0; a < 3; a++) {
        const st = segState[a];
        if (ss !== null && (st.last === null || st.last !== ss)) {
          st.p = [st.c[0], st.c[1], st.c[2], st.c[3]];
          st.pt = [st.ct[0], st.ct[1], st.ct[2], st.ct[3]];
          st.pq = st.cq;
          st.c = [null, null, null, null];
          st.ct = [null, null, null, null];
          st.cq = q;
          st.last = ss;
        }
        const bar = maps[a].get(t);
        if (bar) {
          const bh = Math.max(bar.open, bar.close);
          const bl = Math.min(bar.open, bar.close);
          if (st.c[0] === null || bar.high >= st.c[0]) { st.c[0] = bar.high; st.ct[0] = t; }
          if (st.c[1] === null || bar.low <= st.c[1]) { st.c[1] = bar.low; st.ct[1] = t; }
          if (st.c[2] === null || bh >= st.c[2]) { st.c[2] = bh; st.ct[2] = t; }
          if (st.c[3] === null || bl <= st.c[3]) { st.c[3] = bl; st.ct[3] = t; }
        }
      }

      if (t >= nextWeekReset) {
        nextWeekReset = wkNext(t, settings.tz);
        if (r <= 3) {
          live = [];
          cycId = 0;
        }
      }

      const barA = mapA.get(t);
      if (q !== null && ss !== null) {
        if (q === 1 && ss !== cycId) {
          cycId = ss;
          for (let i = 0; i < live.length; i++) live[i].old = true;
          capOld();
        }

        if (barA && online[0] && onlineCount >= 2) {
          for (let k = 0; k < 4; k++) {
            const hid = k >= 2;
            const dr = k % 2 === 0 ? -1 : 1; // -1 bear, 1 bull
            if ((hid && !settings.showHid) || (!hid && !settings.showNorm)) continue;
            const f = (dr === -1 ? 0 : 1) + (hid ? 2 : 0);
            let swept = 0;
            let notSwept = 0;
            let allHavePrev = true;
            for (let a = 0; a < 3; a++) {
              if (!online[a]) continue;
              const prv = segState[a].p[f];
              if (prv === null) { allHavePrev = false; break; }
              const cur = segState[a].c[f];
              if (cur === null) continue;
              if (dr === -1 ? cur > prv : cur < prv) swept++;
              else notSwept++;
            }
            if (allHavePrev && (swept + notSwept) >= 2 && swept >= 1 && notSwept >= 1
                && !live.some(o => o.dir === dr && o.hid === hid && o.seg === ss)) {
              const rf = [0, 1, 2].map(a => segState[a].p[f]);
              const lt = [0, 1, 2].map(a => {
                const cur = segState[a].c[f];
                return cur !== null && rf[a] !== null && (dr === -1 ? cur > rf[a] : cur < rf[a]);
              });
              const q1 = segState[0].pq !== null && segState[0].pq !== undefined ? segState[0].pq : (((q + 2) % 4) + 1);
              live.push({
                dir: dr, hid, seg: ss, q1, q2: q, ref: rf, lat: lt, old: false,
                onlineMask: [online[0], online[1], online[2]],
                onlineCount,
                tx1: null, py1: null, tx2: null, py2: null
              });
            }
          }
        }
      }

      for (let i = live.length - 1; i >= 0; i--) {
        const o = live[i];
        const f = (o.dir === -1 ? 0 : 1) + (o.hid ? 2 : 0);
        let nl = 0;
        const mask = o.onlineMask || online;
        const needSweeps = o.onlineCount || onlineCount;
        for (let a = 0; a < 3; a++) {
          if (!mask[a]) continue;
          const cur = segState[a].c[f];
          const rv = o.ref[a];
          if (!o.lat[a] && cur !== null && rv !== null && (o.dir === -1 ? cur > rv : cur < rv)) {
            o.lat[a] = true;
          }
          if (o.lat[a]) nl++;
        }
        if (nl >= needSweeps) {
          live.splice(i, 1);
          continue;
        }
        if (ss !== null && o.seg === ss && segState[0].c[f] !== null && segState[0].p[f] !== null) {
          o.tx1 = segState[0].pt[f];
          o.py1 = segState[0].p[f];
          o.tx2 = segState[0].ct[f];
          o.py2 = segState[0].c[f];
        }
      }
    }

    return { ssmts: live, code: tableCode, mapA };
  }

  function buildCycleTable(rowCodes, s, darkBg) {
    if (!s.showCycTbl) return [];
    const cTxt = themeColor(s, 'cyTblText', darkBg, '#2a2e45').css;
    const cBg = themeColor(s, 'cyTblBg', darkBg, '#e0e0e0').css;
    const cHi = themeColor(s, 'cyTblHi', darkBg, '#ff9800').css;
    const cFrm = themeColor(s, 'cyTblFrame', darkBg, '#787b86').css;
    const tblFontPx = sizePx(s.cyTblSizeIn, 11);

    const decodePhase = code => {
      if (code === null || code === undefined || !Number.isFinite(code)) return '-';
      const qn = Math.trunc(code / 4);
      const ix = (code % 4) >= 2;
      const hr = (code % 2) === 1;
      if (qn === 0) return 'Q0';
      if (!hr || qn < 1 || qn > 4) return '-';
      return (ix ? 'XAMD' : 'AMDX')[qn - 1];
    };

    const cell = (text, bg = cBg, bold = false, align = 'center') => ({
      text,
      color: cTxt,
      background: bg,
      align,
      size: tblFontPx,
      bold
    });

    const rows = [
      [cell('Cycle', cBg, true, 'left'), cell('Phase', cBg, true, 'center')],
      ...[
        ['Yearly', 6],
        ['Quarterly', 5],
        ['Monthly', 4],
        ['Weekly', 3],
        ['Daily', 2],
        ['90 Min', 1],
        ['Micro', 0]
      ].map(([name, idx]) => {
        const ph = decodePhase(rowCodes[idx]);
        return [cell(name, cBg, false, 'left'), cell(ph, ph === 'D' ? cHi : cBg, ph !== '-', 'center')];
      })
    ];

    return [{
      id: 'qt-cycle-table',
      position: s.cycPos,
      bgcolor: cBg,
      borderWidth: 1,
      borderColor: cFrm,
      frameWidth: 1,
      frameColor: cFrm,
      rows
    }];
  }

  function computeSsmtAndTable({
    bars, chartSec, chartRow, triad, markets, sessionMode, cutoffTime, darkBg, s, evalCycle
  }) {
    const rowOn = [s.en0, s.en1, s.en2, s.en3, s.en4, s.en5, s.en6];
    const rowDr = rowOn.map((on, i) => !!(s.showSsmt && on && (s.showAll || i === chartRow)));
    const rowCodes = new Array(7).fill(null);

    const cBull = themeColor(s, 'cBull', darkBg, '#000000');
    const cBear = themeColor(s, 'cBear', darkBg, '#000000');
    const cHBull = themeColor(s, 'cHBull', darkBg, '#000000');
    const cHBear = themeColor(s, 'cHBear', darkBg, '#000000');
    const cSsmtLbl = themeColor(s, 'lblClr', darkBg, '#363a45');
    const ssmtLblPx = sizePx(s.lblSizeIn, 11);
    const stNorm = lineStyleNorm(s.stN);
    const stHid = lineStyleNorm(s.stH);
    const chartFirstT = bars.length ? bars[0].time : 0;
    const chartLastT = bars.length ? bars[bars.length - 1].time : 0;
    const chartEndT = chartLastT + chartSec;
    const ssmtBySegment = new Map();

    for (let r = 0; r < 7; r++) {
      const wantSsmt = rowDr[r];
      const wantTbl = !!s.showCycTbl;
      if (!wantSsmt && !wantTbl) continue;

      const { ssmts, code, mapA } = computeRowSsmtAndCode(
        r, ROW_SEC[r], triad, markets, s, evalCycle,
        wantSsmt, wantTbl, sessionMode, cutoffTime
      );
      rowCodes[r] = code;

      if (wantSsmt && ssmts.length && bars.length) {
        const snapSubBar = ROW_SEC[r] < chartSec;
        const refineSuperBar = ROW_SEC[r] > chartSec;
        const htfEndOf = t => r === 6 ? sessionStart(t + 27 * HOUR_SEC, s.tz) : t + ROW_SEC[r];

        for (let i = 0; i < ssmts.length; i++) {
          const o = ssmts[i];
          let hideH = false;
          if (o.hid && s.showNorm) {
            for (let j = 0; j < ssmts.length; j++) {
              const p = ssmts[j];
              if (!p.hid && p.dir === o.dir && p.seg === o.seg && (s.showOld || !p.old)) {
                hideH = true;
                break;
              }
            }
          }
          const want = !hideH
            && (o.hid ? s.showHid : s.showNorm)
            && (s.showOld || !o.old)
            && o.tx1 !== null && o.tx2 !== null && o.py1 !== null && o.py2 !== null;

          if (!want) continue;

          const p1End = refineSuperBar ? htfEndOf(o.tx1) : o.tx1 + ROW_SEC[r];
          if (p1End <= chartFirstT || (!refineSuperBar && o.tx1 < chartFirstT)) continue;
          if (o.tx2 >= chartEndT) continue;

          const x1 = snapSubBar
            ? snapToChartBar(bars, o.tx1, chartSec)
            : refineSuperBar
              ? refineHtfPivotTime(bars, o.tx1, htfEndOf(o.tx1), mapA?.get(o.tx1), o.dir, o.hid)
              : o.tx1;
          const x2 = snapSubBar
            ? snapToChartBar(bars, o.tx2, chartSec)
            : refineSuperBar
              ? refineHtfPivotTime(bars, o.tx2, htfEndOf(o.tx2), mapA?.get(o.tx2), o.dir, o.hid)
              : o.tx2;

          if (x1 < chartFirstT || x2 > chartLastT || x2 <= x1) continue;

          const clr = o.dir === 1 ? (o.hid ? cHBull : cBull) : (o.hid ? cHBear : cBear);
          const qPairTxt = s.showSsmtTxt ? `Q${o.q1 ?? 1} Q${o.q2 ?? 2} ${TFN[r]}` : '';
          const segKey = `${x1}:${o.py1}:${x2}:${o.py2}`;
          ssmtBySegment.set(segKey, {
            type: 'line',
            _qtSsmt: true,
            _qtDir: o.dir,
            _qtTier: r,
            p1: { time: x1, price: o.py1 },
            p2: { time: x2, price: o.py2 },
            borderColor: clr.hex,
            strokeOpacity: clr.opacity,
            width: o.hid ? s.wH : s.wN,
            lineStyle: o.hid ? stHid : stNorm,
            ...(qPairTxt ? {
              text: qPairTxt,
              textStyle: {
                inlineOnLine: true,
                color: cSsmtLbl.css,
                size: ssmtLblPx
              }
            } : {})
          });
        }
      }
    }

    return {
      drawings: [...ssmtBySegment.values()],
      tables: buildCycleTable(rowCodes, s, darkBg)
    };
  }

  return {
    refineHtfPivotTime,
    computeRowSsmtAndCode,
    computeSsmtAndTable
  };
})();

if (typeof window !== 'undefined') window.QTSsmt = QTSsmt;
if (typeof module !== 'undefined') module.exports = QTSsmt;
