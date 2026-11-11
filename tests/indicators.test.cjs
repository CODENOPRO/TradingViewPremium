const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const qs=require('../frontend/indicators/qs-stacks-plus.js');
const qt=require('../frontend/indicators/qt-plus.js');
const MarketData=require('../frontend/js/market_data.js');
global.MarketData=MarketData;
const t=s=>Date.parse(s)/1000;
const bar=(time,high=102,low=99,open=100,close=101)=>({time,high,low,open,close,volume:10});
function validate(r){
 const c=vm.createContext({});vm.runInContext(fs.readFileSync('frontend/js/indicator_runner.js','utf8')+';this.Runner=IndicatorRunner',c);
 c.Runner.prototype.validate(r);
}
test('QS Stacks boundaries preserve fractional nano periods and NY DST wall clock',()=>{
 const before=qs.bounds(t('2026-11-10T05:05:37Z'),6),after=qs.bounds(t('2026-11-10T05:05:38Z'),6);
 assert.equal(before.end,t('2026-11-10T05:05:37Z')+.5);
 assert.equal(after.phase,2);assert.equal(after.start,before.end);
 for(const iso of ['2026-03-06T23:00:00Z','2026-03-09T22:00:00Z','2026-11-02T23:00:00Z'])assert.equal(qs.bounds(t(iso),3).phase,1);
 assert.equal(qs.bounds(t('2026-11-13T17:00:00Z'),2,true).phase,4);
 assert.equal(qs.bounds(t('2026-11-13T17:00:00Z'),2,false).phase,0);
 const a=qs.bounds(t('2026-11-13T17:00:00Z'),2,true),b=qs.bounds(t('2026-11-12T17:00:00Z'),2,true);assert.equal(a.start,b.start);
});
test('QS compares adjacent fully seeded quarters, invalidates current divergence, waits for confirmed bars',()=>{
 const start=t('2026-11-10T05:00:00Z');
 const own=[bar(start,110,90),bar(start+60,110,91),bar(start+1380,115,91)];
 const peer=[bar(start,210,190,200,201),bar(start+60,210,191,200,201),bar(start+1380,209,191,200,201)];
 const ctx={symbol:'NQ1!',timeframe:'1m',now:start+1440,peerBars:{'ES1!':peer,'YM1!':peer},settings:{showStages:false,showStackNote:false,showOpen:false}};
 const r=qs.calculate(own,ctx);validate(r);
 assert.ok(r.drawings.some(x=>x.type==='line'&&x.p1.price===110&&x.p2.price===115));
 const live=qs.calculate(own,{...ctx,now:start+1439});assert.equal(live.drawings.length,0);
 const caught=[...peer,bar(start+1440,216,191,200,201)];
 const gone=qs.calculate([...own,bar(start+1440,115,91)],{...ctx,now:start+1500,peerBars:{'ES1!':caught,'YM1!':caught}});
 assert.equal(gone.drawings.length,0);
});
test('QS missing timestamps do not borrow stale peers or emit phantom divergence; no future peers leak into replay',()=>{
 const start=t('2026-11-10T05:00:00Z'),own=[bar(start,110,90),bar(start+1380,115,91)];
 const ctx={symbol:'NQ1!',timeframe:'1m',now:start+2000,settings:{showOpen:false,showStages:false,showStackNote:false},peerBars:{'ES1!':[bar(start,210,190,200,201),bar(start+1440,209,191,200,201)]}};
 const r=qs.calculate(own,ctx);assert.equal(r.drawings.length,0);assert.ok(r.warnings.some(s=>s.includes('YM1!')));validate(r);
 const es=qs.peers('ES1!',qs.defaults);assert.deepEqual(es,['NQ1!','YM1!']);
 const ym=qs.peers('YM1!',qs.defaults);assert.deepEqual(ym,['ES1!','NQ1!']);
});
test('QT keeps fixed UTC-4 SSMT distinct from NY DST ribbon and compares equal extremes inclusively',()=>{
 const stamp=t('2026-11-10T22:00:00Z');
 assert.equal(qt.parts(stamp,'UTC-4').hour,18);assert.equal(qt.parts(stamp).hour,17);
 assert.equal(qt.smtPhases(stamp,qt.defaults).values[2],0);
 assert.equal(qt.phaseSet(stamp,qt.defaults).ph[3],4);
 assert.equal(qt.disagree(110,110,210,215,false),true);
 assert.equal(qt.disagree(110,110,210,210,false),false);
});
test('both scripts run in the real Worker contract and validate pane/overlay output',async()=>{
 const bars=Array.from({length:320},(_,i)=>bar(t('2026-11-10T05:00:00Z')+i*60,105+(i%31),95-(i%23)));
 const markets=Object.fromEntries(['NQ1!','ES1!','YM1!'].map(k=>[k,{'1m':bars,metadata:{timezone:'America/Chicago',session:'1700-1600'}}]));
 for(const name of ['qs-stacks-plus','qt-plus']) {
  const messages=[],context=vm.createContext({self:{postMessage:m=>messages.push(m)},performance,MarketData});
  vm.runInContext(fs.readFileSync('frontend/js/indicator_worker.js','utf8'),context);
  await context.self.onmessage({data:{type:'init',code:fs.readFileSync(`frontend/indicators/${name}.js`,'utf8')}});
  assert.equal(messages.pop().type,'ready');
  await context.self.onmessage({data:{type:'run',id:1,bars,context:{symbol:'NQ1!',timeframe:'1m',markets,now:2e9}}});
  const message=messages.pop();assert.equal(message.type,'result',message.error);assert.ok(message.result.pane.drawings.length>0);validate(message.result);
  const again=await (name==='qt-plus'?qt:qs).calculate(bars,{symbol:'NQ1!',timeframe:'1m',markets,now:2e9});
  assert.deepEqual(JSON.parse(JSON.stringify(message.result)),JSON.parse(JSON.stringify(again)));
 }
});
test('RTH worker excludes ETH highs from peer candles',async()=>{
 const messages=[],context=vm.createContext({self:{postMessage:m=>messages.push(m)},performance,MarketData});
 vm.runInContext(fs.readFileSync('frontend/js/indicator_worker.js','utf8'),context);
 await context.self.onmessage({data:{type:'init',code:'function calculate(bars,c){return {tables:[{rows:[[c.markets.ES["1m"].length,c.markets.ES["5m"][0].high]]}]};}'}});
 await context.self.onmessage({data:{type:'run',id:1,bars:[],context:{sessionMode:'RTH',markets:{ES:{'1m':[bar(t('2026-11-10T14:00:00Z'),1000),bar(t('2026-11-10T14:30:00Z'),110)],metadata:{timezone:'America/Chicago',sessionRegular:{session:'0830-1515'}}}}}}});
 assert.deepEqual(Array.from(messages.pop().result.tables[0].rows[0]),[1,110]);
});
test('QT refuses unsupported correlation/backadjustment and both reject misspelled inputs',()=>{
 const bars=[bar(t('2026-11-10T05:00:00Z'))];
 assert.throws(()=>qt.calculate(bars,{symbol:'CL1!'}),/AssetCorrelation/);
 assert.throws(()=>qt.calculate(bars,{symbol:'NQ1!',settings:{badj:true}}),/B-ADJ/);
 assert.throws(()=>qs.calculate(bars,{settings:{blockLmit:8}}),/blockLmit/);
 assert.throws(()=>qt.calculate(bars,{settings:{i_hst:8}}),/i_hst/);
});

test('overlay renderer keeps indicator shapes without user drawing ids',()=>{
 const drawn=[],c=vm.createContext({window:{},DrawingModel:{draw:(_ctx,_engine,d)=>{assert.ok(d);drawn.push(d);}}});
 vm.runInContext(fs.readFileSync('frontend/js/chart_engine.js','utf8').replace('const TF_MAP = MarketData.durations;','const TF_MAP = {};')+';this.Engine=ChartEngine',c);
 const engine=Object.create(c.Engine.prototype),ctx={clearRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){}};
 Object.assign(engine,{overlayCtx:ctx,container:{getBoundingClientRect:()=>({width:500,height:300})},indicatorDrawings:[{type:'text',p1:{time:60,price:1},text:'SSMT'}],drawings:[],drawingPreview:undefined});
 engine.renderDrawings();assert.equal(drawn.length,1);assert.equal(drawn[0].text,'SSMT');
});
test('QT QCISD confirms a bearish level and invalidates after three full bodies above it',()=>{
 const start=t('2026-11-10T04:00:00Z');
 const bars=[bar(start,110,90,100,101),bar(start+1380,115,91,100,101)];
 const peers=[bar(start,210,190,200,201),bar(start+1380,209,191,200,201)];
 const ctx={symbol:'NQ1!',timeframe:'1m',settings:{show_qcisd:true},peerBars:{'ES1!':peers,'YM1!':peers}};
 const first=qt.calculate(bars,ctx);assert.ok(first.drawings.some(x=>x.text?.startsWith('(-)')));validate(first);
 bars.push(bar(start+1440,114,91,95,96));peers.push(bar(start+1440,209,191,200,201));
 assert.ok(qt.calculate(bars,ctx).events.some(x=>x.type==='qcisdConfirm'));
 for(let i=1;i<=3;i++){bars.push(bar(start+1440+i*60,114,104,105,106));peers.push(bar(start+1440+i*60,209,191,200,201));}
 const ended=qt.calculate(bars,ctx);assert.ok(ended.events.some(x=>x.type==='qcisdInvalidation'));assert.ok(!ended.drawings.some(x=>x.text?.startsWith('(-)')));
});
