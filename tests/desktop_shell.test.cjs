const test=require('node:test'),assert=require('node:assert/strict');
const DesktopShell=require('../frontend/js/desktop_shell.js');
const vm=require('node:vm'),fs=require('node:fs'),DrawingModel=require('../frontend/js/drawing_model.js');
const context=vm.createContext({Intl,MarketData:{durations:{}},DrawingModel});vm.runInContext(fs.readFileSync('frontend/js/chart_engine.js','utf8')+';this.Engine=ChartEngine',context);
test('history prepend retains live right offset and historical candle timestamps',()=>{
  const old=[{time:180},{time:240},{time:3600}],next=[{time:60},{time:120},...old];
  const live=context.Engine.rebaseRange(old,next,{from:0,to:3},60);assert.equal(live.from,2);assert.equal(live.to,5);
  const history=context.Engine.rebaseRange(old,next,{from:0,to:1},60);assert.equal(history.from,2);assert.equal(history.to,3);
});

test('return-to-latest keeps zoom span and uses real loaded bar count and configured margin',()=>{
  const chart={bars:Array.from({length:800},(_,i)=>({time:i*60})),appearance:{rightMargin:10},chart:{timeScale:()=>({getVisibleLogicalRange:()=>({from:100,to:220})})}};
  const snapshot=JSON.stringify(chart.bars),range=DesktopShell.latestRange(chart);
  assert.deepEqual(range,{from:689,to:809});assert.equal(range.to-range.from,120);
  assert.equal(JSON.stringify(chart.bars),snapshot);
  assert.equal(DesktopShell.latestRange({...chart,bars:[]}),null);
});

test('return-to-latest handles an uninitialized viewport without borrowing another chart range',()=>{
  const chart={bars:[{time:10}],appearance:{rightMargin:0},chart:{timeScale:()=>({getVisibleLogicalRange:()=>null})}};
  assert.deepEqual(DesktopShell.latestRange(chart),{from:-100,to:0});
});
