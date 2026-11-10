class SyncController {
  constructor() {
    this.charts = [];
    this.syncEnabled = true;
    this.isBroadcasting = false;
    this.isCrosshairBroadcasting = false;
  }

  register(chartEngine) {
    this.charts.push(chartEngine);

    // 1. Sync Visible Logical Range (Time & Zoom Sync with Right-Aligned Offset)
    chartEngine.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!this.syncEnabled || this.isBroadcasting || !range) return;
      if (!chartEngine.bars || chartEngine.bars.length === 0) return;

      this.isBroadcasting = true;

      const srcBars = chartEngine.bars;
      const srcLastIdx = srcBars.length - 1;
      const span = range.to - range.from;

      for (const target of this.charts) {
        if (target === chartEngine) continue;
        const tgtBars = target.bars;
        if (!tgtBars || tgtBars.length === 0) continue;

        const tgtLastIdx = tgtBars.length - 1;

        try {
          if (range.to >= srcLastIdx) {
            // Live / Near-live view with right margin padding
            const offsetFromRight = range.to - srcLastIdx;
            const targetTo = tgtLastIdx + offsetFromRight;
            const targetFrom = targetTo - span;
            target.chart.timeScale().setVisibleLogicalRange({ from: targetFrom, to: targetTo });
          } else {
            // Viewing historical candles in the past
            // Find timestamp of the bar near range.to on source chart
            const clampedSrcIdx = Math.max(0, Math.min(srcLastIdx, Math.round(range.to)));
            const targetTime = srcBars[clampedSrcIdx].time;

            // Find matching bar in target chart
            const tgtIdx = this.findClosestBarIndex(tgtBars, targetTime);
            if (tgtIdx >= 0) {
              const subBarFraction = range.to - Math.round(range.to);
              const targetTo = tgtIdx + subBarFraction;
              const targetFrom = targetTo - span;
              target.chart.timeScale().setVisibleLogicalRange({ from: targetFrom, to: targetTo });
            } else {
              const offsetFromRight = range.to - srcLastIdx;
              const targetTo = tgtLastIdx + offsetFromRight;
              target.chart.timeScale().setVisibleLogicalRange({ from: targetTo - span, to: targetTo });
            }
          }
        } catch (e) {
          // Ignore transient range errors
        }
      }

      this.isBroadcasting = false;
    });

    // 2. Synchronize Crosshair across all charts
    chartEngine.chart.subscribeCrosshairMove((param) => {
      if (!this.syncEnabled || this.isCrosshairBroadcasting) return;

      if (!param || !param.time || param.point === undefined || param.point.x < 0) {
        // Pointer left chart - clear crosshair on others
        this.isCrosshairBroadcasting = true;
        for (const target of this.charts) {
          if (target !== chartEngine) {
            try { target.chart.clearCrosshairPosition(); } catch(e) {}
          }
        }
        this.isCrosshairBroadcasting = false;
        return;
      }

      this.isCrosshairBroadcasting = true;
      for (const target of this.charts) {
        if (target !== chartEngine && target.series && target.bars && target.bars.length > 0) {
          try {
            const tgtIdx = this.findClosestBarIndex(target.bars, param.time);
            if (tgtIdx >= 0) {
              const tgtBar = target.bars[tgtIdx];
              target.chart.setCrosshairPosition(tgtBar.close, param.time, target.series);
            }
          } catch(e) {}
        }
      }
      this.isCrosshairBroadcasting = false;
    });
  }

  findClosestBarIndex(bars, time) {
    if (!bars || bars.length === 0) return -1;
    let low = 0;
    let high = bars.length - 1;
    if (time <= bars[0].time) return 0;
    if (time >= bars[high].time) return high;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (bars[mid].time === time) return mid;
      if (bars[mid].time < time) low = mid + 1;
      else high = mid - 1;
    }
    return Math.max(0, high);
  }

  resetAllCharts() {
    this.isBroadcasting = true;
    for (const c of this.charts) {
      try {
        c.resetView();
      } catch(e) {}
    }
    this.isBroadcasting = false;
  }

  toggleSync(btnElement) {
    this.syncEnabled = !this.syncEnabled;
    if (btnElement) {
      btnElement.classList.toggle('active', this.syncEnabled);
      btnElement.innerHTML = this.syncEnabled ? '🔗 Sync: ON' : '🔗 Sync: OFF';
    }
  }
}
