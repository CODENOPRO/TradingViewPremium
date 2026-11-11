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

    // Keep the target crosshair at the same relative height, never at a candle close.
    chartEngine.chart.subscribeCrosshairMove((param) => {
      if (!this.syncEnabled || this.isCrosshairBroadcasting) return;
      const sourceHeight=this.mainPaneHeight(chartEngine);
      const valid=param&&Number.isFinite(param.time)&&param.point&&Number.isFinite(param.point.x)&&Number.isFinite(param.point.y)&&param.point.x>=0&&param.point.y>=0&&param.point.y<sourceHeight&&(param.paneIndex===undefined||param.paneIndex===0);
      this.isCrosshairBroadcasting=true;
      try {
        for(const target of this.charts){
          if(target===chartEngine)continue;
          try {
            if(!valid||!target.series||!target.bars?.length){target.chart.clearCrosshairPosition();continue;}
            const index=this.findClosestBarIndex(target.bars,param.time),bar=target.bars[index];
            // The native API otherwise snaps missing/future times to an old loaded candle.
            const contains=bar&&(bar.time===param.time||target.tfSeconds>chartEngine.tfSeconds&&param.time>=bar.time&&param.time<bar.time+target.tfSeconds);
            const height=this.mainPaneHeight(target);
            const price=height>0?target.series.coordinateToPrice(param.point.y/sourceHeight*height):null;
            if(!contains||!Number.isFinite(price)){target.chart.clearCrosshairPosition();continue;}
            target.chart.setCrosshairPosition(price,bar.time,target.series);
          }catch(error){try{target.chart.clearCrosshairPosition();}catch{}}
        }
      }finally{this.isCrosshairBroadcasting=false;}
    });
  }

  mainPaneHeight(engine){
    const height=engine.plotHeight??engine.container?.clientHeight??0;
    const axis=engine.chart.timeScale().height?.()??26;
    return Math.max(0,height-axis);
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
