const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('frequent ticks do not starve calculation and same-context results render while next tick waits',()=>{
 const timers=new Map(),workers=[];let sequence=0,applied=0;
 class Worker{constructor(){this.messages=[];workers.push(this);}postMessage(m){this.messages.push(m);}terminate(){}}
 const ctx=vm.createContext({Worker,setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync('frontend/js/indicator_runner.js','utf8')+';this.Runner=IndicatorRunner;',ctx);
 const chart={symbol:'NQ1!',currentTimeframe:'1m',sessionMode:'ETH',bars:[{time:60}],container:{dataset:{}},clearCustomSeries(){},setIndicatorLegend(){},applyIndicatorResult(){applied++;}};
 const runner=new ctx.Runner(chart,()=>({}),()=>{});runner.load('user code',{},{});const w=workers[0];w.onmessage({data:{type:'ready',name:'User',defaults:{}}});
 for(let i=0;i<50;i++)runner.schedule();assert.equal([...timers.values()].filter(t=>t.ms===100).length,1);
 const flush=()=>{for(const [id,t]of [...timers])if(t.ms===100){timers.delete(id);t.fn();}};
 flush();assert.equal(w.messages.filter(m=>m.type==='run').length,1);const id=runner.revision;chart.bars.push({time:120});runner.schedule();flush();assert.equal(runner.pending,true);
 w.onmessage({data:{type:'result',id,result:{series:[]},elapsed:2}});assert.equal(applied,1);flush();assert.equal(w.messages.filter(m=>m.type==='run').length,2);
 chart.symbol='ES1!';w.onmessage({data:{type:'result',id:runner.revision,result:{series:[]},elapsed:2}});assert.equal(applied,1);
 runner.stop();assert.equal(runner.debounce,null);
});
