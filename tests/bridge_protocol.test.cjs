const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const MarketData=require('../frontend/js/market_data.js');
const context=vm.createContext({MarketData,module:{exports:{}}});vm.runInContext(fs.readFileSync('frontend/js/bridge_protocol.js','utf8'),context);const Protocol=context.module.exports;
const bar=t=>({time:t,open:100,high:103,low:99,close:101,volume:5});
test('a legacy health response is rejected instead of waiting forever for bridge_status',()=>{
  assert.throws(()=>Protocol.health({}),/Backend/);assert.throws(()=>Protocol.health({type:'bridge_status',ws_port:0}),/Backend/);
  assert.equal(Protocol.health({type:'bridge_status',service:'trading-terminal',protocol_version:2,ws_port:8080}).ws_port,8080);
});
test('empty or shorter YM snapshots preserve validated history, while corrections overwrite same timestamps',()=>{
  const previous=[bar(60),bar(120)];assert.equal(Protocol.bars(previous,{type:'history',bars:[]}),previous);
  assert.equal(Protocol.bars(previous,{type:'history',bars:[{bad:true}]}),previous);
  const merged=Protocol.bars(previous,{type:'history',bars:[{...bar(120),close:102},bar(180)]});
  assert.equal(merged.length,3);assert.equal(merged[0].time,60);assert.equal(merged[1].close,102);assert.equal(previous[1].close,101);
});
test('CDP extraction reads non-active loaded charts and deduplicates a symbol by newest bar then history depth',()=>{
  const source=(symbol,times)=>({symbolInfo:()=>({name:symbol,timezone:'America/Chicago',session:'1700-1600'}),interval:()=>'1',data:()=>({bars:()=>({size:()=>times.length,each:fn=>times.forEach((t,i)=>fn(i,[t,100,103,99,101,5]))})})});
  const widgets=[{model:()=>({dataSources:()=>[source('NQ1!',[60,120]),source('ES1!',[60,120])]})},{model:()=>({dataSources:()=>[source('YM1!',[60,120]),source('ES1!',[30,60,120]),source('ES1!',[10,20,30,60])]})}];
  const code=fs.readFileSync('backend/bridge_server.py','utf8').match(/SNAPSHOT_JS = r'''([\s\S]*?)'''/)[1].replace('__FULL__','true');
  const entries=vm.runInNewContext(code,{window:{_exposed_chartWidgetCollection:{getAll:()=>widgets,activeChartWidget:{value:()=>widgets[0]}}}});
  assert.equal(entries.filter(e=>e.symbol==='YM1!').length,1);assert.equal(entries.filter(e=>e.symbol==='ES1!').length,1);
  assert.equal(entries.find(e=>e.symbol==='ES1!').bars.length,3);assert.equal(entries.find(e=>e.symbol==='ES1!').bars.at(-1).time,120);
});
