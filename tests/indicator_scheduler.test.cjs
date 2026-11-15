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

test('viewport events skip indicators that do not consume context.viewport',()=>{
 const timers=new Map(),workers=[];let sequence=0;
 class Worker{constructor(){this.messages=[];workers.push(this);}postMessage(m){this.messages.push(m);}terminate(){}}
 const ctx=vm.createContext({Worker,setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync('frontend/js/indicator_runner.js','utf8')+';this.Runner=IndicatorRunner;',ctx);
 const chart={symbol:'NQ1!',currentTimeframe:'1m',sessionMode:'ETH',bars:[{time:60}],container:{dataset:{}},clearCustomSeries(){},setIndicatorLegend(){},applyIndicatorResult(){}};
 const runner=new ctx.Runner(chart,()=>({}),()=>{});
 runner.load('function calculate(bars){ return {series:[]}; }',{},{});
 workers[0].onmessage({data:{type:'ready',name:'User',defaults:{}}});
 // Ignore the expected initial data calculation.
 timers.clear();runner.debounce=null;
 runner.schedule({viewport:true});
 assert.equal([...timers.values()].filter(t=>t.ms===100).length,0);
 runner.usesViewport=true;
 runner.schedule({viewport:true});
 assert.equal([...timers.values()].filter(t=>t.ms===100).length,1);
});

test('runner does not clone market caches unless the script consumes them',()=>{
 const timers=new Map(),workers=[];let sequence=0,requested;
 class Worker{constructor(){this.messages=[];workers.push(this);}postMessage(m){this.messages.push(m);}terminate(){}}
 const ctx=vm.createContext({Worker,setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id),Date});
 vm.runInContext(fs.readFileSync('frontend/js/indicator_runner.js','utf8')+';this.Runner=IndicatorRunner;',ctx);
 const chart={symbol:'NQ1!',currentTimeframe:'1m',sessionMode:'ETH',tfSeconds:60,bars:[{time:60,close:1}],container:{dataset:{}},clearCustomSeries(){},setIndicatorLegend(){},applyIndicatorResult(){}};
 const runner=new ctx.Runner(chart,options=>{requested=options;return {markets:{'ES1!':{'1m':[{},{}]}}};},()=>{});
 runner.load('function calculate(bars){ return {series:[]}; }',{},{});
 const worker=workers[0];worker.onmessage({data:{type:'ready',name:'User',defaults:{}}});
 for(const [id,t] of [...timers])if(t.ms===100){timers.delete(id);t.fn();}
 const message=worker.messages.find(m=>m.type==='run');
 assert.equal(JSON.stringify(requested),JSON.stringify({markets:false,viewport:false}));
 assert.equal(Object.hasOwn(message.context,'markets'),false);
});

test('unchanged chart state is dispatched once, then a data revision reruns it',()=>{
 const timers=new Map(),workers=[];let sequence=0;
 class Worker{constructor(){this.messages=[];workers.push(this);}postMessage(m){this.messages.push(m);}terminate(){}}
 const ctx=vm.createContext({Worker,setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync('frontend/js/indicator_runner.js','utf8')+';this.Runner=IndicatorRunner;',ctx);
 const chart={symbol:'NQ1!',currentTimeframe:'1m',sessionMode:'ETH',dataRevision:1,tfSeconds:60,bars:[{time:60,close:1}],container:{dataset:{}},clearCustomSeries(){},setIndicatorLegend(){},applyIndicatorResult(){}};
 const flush=()=>{for(const [id,t] of [...timers])if(t.ms===100){timers.delete(id);t.fn();}};
 const runner=new ctx.Runner(chart,()=>({}),()=>{});
 runner.load('function calculate(bars){ return {series:[]}; }',{},{});
 const worker=workers[0];worker.onmessage({data:{type:'ready',name:'User',defaults:{}}});flush();
 assert.equal(worker.messages.filter(m=>m.type==='run').length,1);
 worker.onmessage({data:{type:'result',id:runner.revision,result:{series:[]},elapsed:1}});
 runner.schedule();flush();
 assert.equal(worker.messages.filter(m=>m.type==='run').length,1);
 chart.dataRevision++;
 runner.schedule();flush();
 assert.equal(worker.messages.filter(m=>m.type==='run').length,2);
});

test('a live tail update sends only the replaced tail and appended candle to the worker',()=>{
 const timers=new Map(),workers=[];let sequence=0;
 class Worker{constructor(){this.messages=[];workers.push(this);}postMessage(m){this.messages.push(m);}terminate(){}}
 const ctx=vm.createContext({Worker,setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync('frontend/js/indicator_runner.js','utf8')+';this.Runner=IndicatorRunner;',ctx);
 const chart={symbol:'NQ1!',currentTimeframe:'1m',sessionMode:'ETH',dataRevision:1,dataUpdateKind:'replace',tfSeconds:60,bars:[{time:60,close:1},{time:120,close:2}],container:{dataset:{}},clearCustomSeries(){},setIndicatorLegend(){},applyIndicatorResult(){}};
 const flush=()=>{for(const [id,t] of [...timers])if(t.ms===100){timers.delete(id);t.fn();}};
 const runner=new ctx.Runner(chart,()=>({}),()=>{});runner.load('function calculate(bars){ return {series:[]}; }',{},{});
 const worker=workers[0];worker.onmessage({data:{type:'ready',name:'User',defaults:{}}});flush();
 assert.equal(worker.messages.at(-1).bars.mode,'replace');
 worker.onmessage({data:{type:'result',id:runner.revision,result:{series:[]},elapsed:1}});
 chart.bars.push({time:180,close:3});chart.dataRevision++;chart.dataUpdateKind='tail';runner.schedule();flush();
 const payload=worker.messages.at(-1).bars;
 assert.equal(payload.mode,'tail');assert.equal(payload.start,1);assert.deepEqual(payload.values,[{time:120,close:2},{time:180,close:3}]);
});

test('timenow scripts wake once per second and release their timer on stop',()=>{
 const timers=new Map(),intervals=new Map(),workers=[];let sequence=0;
 class Worker{constructor(){this.messages=[];workers.push(this);}postMessage(m){this.messages.push(m);}terminate(){}}
 const ctx=vm.createContext({Worker,setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>{intervals.set(++sequence,{fn,ms});return sequence;},clearInterval:id=>intervals.delete(id),Date});
 vm.runInContext(fs.readFileSync('frontend/js/indicator_runner.js','utf8')+';this.Runner=IndicatorRunner;',ctx);
 const chart={symbol:'NQ1!',currentTimeframe:'1m',sessionMode:'ETH',dataRevision:1,bars:[{time:60}],container:{dataset:{}},clearCustomSeries(){},setIndicatorLegend(){},applyIndicatorResult(){}};
 const runner=new ctx.Runner(chart,()=>({}),()=>{});runner.load('//@version=6\nindicator("Clock")\nplot(timenow)',{},{});
 workers[0].onmessage({data:{type:'ready',name:'Clock',runtime:'pine6',defaults:{}}});
 assert.equal([...intervals.values()].filter(t=>t.ms===1000).length,1);
 runner.stop();assert.equal(intervals.size,0);
});

test('a missing native timeframe keeps the worker alive and retries only when that history arrives',()=>{
 const workers=[],timers=new Map();let sequence=0,market={},requests=0;
 class Worker{constructor(){this.messages=[];workers.push(this);}postMessage(m){this.messages.push(m);}terminate(){this.terminated=true;}}
 const ctx=vm.createContext({Worker,setTimeout:fn=>{timers.set(++sequence,fn);return sequence;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync('frontend/js/indicator_runner.js','utf8')+';this.Runner=IndicatorRunner;',ctx);
 const chart={symbol:'NQ1!',currentTimeframe:'1m',sessionMode:'ETH',bars:[{time:60}],container:{dataset:{}},clearCustomSeries(){},setIndicatorLegend(){},onIndicatorDataRequired(){requests++;},applyIndicatorResult(){}};
 const r=new ctx.Runner(chart,()=>({markets:{'NQ1!':market}}),()=>{});r.load('//@version=6\nindicator("Daily")');
 workers[0].onmessage({data:{type:'ready',runtime:'pine6',usesMarkets:true,defaults:{}}});r.run();
 workers[0].onmessage({data:{type:'data_required',id:r.revision,error:'waiting',requirement:{symbol:'NQ1!',timeframe:'D'}}});
 assert.equal(r.ready,true);assert.equal(workers[0].terminated,undefined);assert.equal(requests,1);const count=workers[0].messages.length;
 r.run();assert.equal(workers[0].messages.length,count);market.D=[{time:1}];r.run();assert.equal(workers[0].messages.length,count+1);assert.equal(r.dataRequirement,null);r.stop();
});
