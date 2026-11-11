const test=require('node:test');
const assert=require('node:assert/strict');
const {ChartAppearance}=require('../frontend/js/chart_settings.js');

test('previous-close candle direction, body visibility and indicator color keep raw OHLC unchanged',()=>{
  const bars=[{time:1,open:100,high:111,low:99,close:110},{time:2,open:101,high:106,low:100,close:105}];
  const original=JSON.stringify(bars),s=ChartAppearance.defaults();
  const e={appearance:{...s,previousClose:true},indicatorCandleColors:new Map()};
  assert.equal(ChartAppearance.candleData(e,bars)[1].color,s.bodyDown);
  e.appearance.previousClose=false;
  assert.equal(ChartAppearance.candleData(e,bars)[1].color,s.bodyUp);
  e.indicatorCandleColors.set(2,'#123456');
  assert.equal(ChartAppearance.candleData(e,bars)[1].color,'#123456');
  e.appearance.body=false;
  assert.equal(ChartAppearance.candleData(e,bars)[1].color,'transparent');
  assert.equal(JSON.stringify(bars),original);
});

test('incremental styling matches whole-series previous-close colors through gaps',()=>{
  const e={appearance:{...ChartAppearance.defaults(),previousClose:true}};
  const bars=[{time:1,open:10,close:15},{time:2,open:12,close:14},{time:200,open:18,close:16}];
  assert.deepEqual(ChartAppearance.candleData(e,bars).at(-1),ChartAppearance.candleData(e,bars.slice(-2)).at(-1));
});

test('display timezone and ISO date cross midnight/DST without modifying market timestamps',()=>{
  const s={...ChartAppearance.defaults(),dateFormat:'yyyy-MM-dd'};
  const time=Date.parse('2026-03-09T02:30:00Z')/1000;
  assert.equal(ChartAppearance.formatters(s).tick(time),'2026-03-08');
  const utc=ChartAppearance.formatters({...s,timezone:'Etc/UTC'});
  assert.equal(utc.tick(time),'2026-03-09');
  assert.match(utc.clock(time),/02:30/);
  assert.equal(time,1773023400);
});

test('invalid margins/timezone fail before any chart mutation',()=>{
  const s=ChartAppearance.defaults();let calls=0;
  const engine={chart:{applyOptions(){calls++;}}};
  assert.throws(()=>ChartAppearance.apply(engine,{...s,topMargin:80,bottomMargin:20}),/total/);
  assert.throws(()=>ChartAppearance.apply(engine,{...s,timezone:'Invalid/Zone'}),/time zone/i);
  assert.equal(calls,0);assert.equal(engine.appearance,undefined);
});

test('appearance applies to one engine; repeated preview preserves horizontal scroll offset',()=>{
  const opts=[],seriesOpts=[],offsets=[];
  const engine={bars:[{time:100,open:10,high:12,low:9,close:11}],config:{},metadata:{tickSize:.25},customSeries:[],
    chart:{applyOptions:o=>opts.push(o),timeScale:()=>({applyOptions:o=>offsets.push(o)})},series:{applyOptions:o=>seriesOpts.push(o),setData(){}},
    container:{style:{setProperty(){}},dataset:{},querySelector:()=>null},updateLegend(){},renderDrawings(){},renderIndicatorPane(){}};
  const other={config:{bg:'#111111'}};const s=ChartAppearance.defaults();
  ChartAppearance.apply(engine,{...s,symbolLine:'Line'});
  assert.equal(seriesOpts.at(-1).priceLineVisible,true);assert.equal(seriesOpts.at(-1).lastValueVisible,false);
  assert.equal(seriesOpts.at(-1).priceFormat.minMove,.25);
  ChartAppearance.apply(engine,{...s,symbolLine:'Hidden',verticalGrid:false});
  assert.equal(offsets.length,1);assert.equal(opts.at(-1).grid.vertLines.visible,false);
  assert.equal(seriesOpts.at(-1).priceLineVisible,false);assert.deepEqual(other,{config:{bg:'#111111'}});
});
