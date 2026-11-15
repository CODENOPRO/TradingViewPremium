const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function worker(){
 const messages=[],ctx=vm.createContext({self:{postMessage:m=>messages.push(m)},performance,console,Intl,setTimeout,clearTimeout,structuredClone});
 ctx.importScripts=(...files)=>{for(const name of files)vm.runInContext(fs.readFileSync(path.resolve('frontend/js',name),'utf8'),ctx,{filename:name});};
 vm.runInContext(fs.readFileSync('frontend/js/indicator_worker.js','utf8'),ctx);
 return async data=>{await ctx.self.onmessage({data});return messages.pop();};
}
const bars=Array.from({length:12},(_,i)=>({time:1700003640+i*60,open:100+i,high:103+i,low:99+i,close:102+i,volume:10+i}));
const metadata={exchange:'CME_MINI',description:'Nasdaq',timezone:'America/Chicago',session:'1700-1600',tickSize:.25,pointValue:20};
const context={symbol:'NQ1!',timeframe:'1m',timeframeSeconds:60,metadata,markets:{'NQ1!':{'1m':bars,metadata}},now:1700000800,settings:{},sessionMode:'ETH'};
test('actual browser Pine bundle runs input/plots/drawings and caches identical calculations',async()=>{
 const send=worker();const ready=await send({type:'init',code:'//@version=6\nindicator("Saved", overlay=true)\nfactor=input.float(2.0,"Factor")\nplot(close*factor)\nif barstate.islast\n    line.new(bar_index-2, low, bar_index, high)\n    box.new(bar_index-3, high, bar_index, low)'});
 assert.equal(ready.type,'ready');assert.equal(ready.runtime,'pine6');const key=ready.inputs[0].key;
 const first=await send({type:'run',id:1,bars,context});assert.equal(first.type,'result',first.error);assert.equal(first.result.series[0].data.at(-1).value,226);assert.equal(first.result.name,'Saved');assert.equal(first.result.drawings.length,2);
 const again=await send({type:'run',id:2,bars,context});assert.equal(again.result.cached,true);
 const changed=await send({type:'run',id:3,bars,context:{...context,settings:{[key]:3}}});assert.equal(changed.result.series[0].data.at(-1).value,339);assert.notEqual(changed.result.cached,true);
 const corrected=bars.map((b,i)=>i===11?{...b,close:114}:b);const correction=await send({type:'run',id:4,bars:corrected,context});assert.equal(correction.result.series[0].data.at(-1).value,228);
});
test('Pine separate pane and local peer data use correct symbol, no fake fallback',async()=>{
 const send=worker();await send({type:'init',code:'//@version=6\nindicator("Peer", overlay=false)\nplot(request.security("ES1!","1",close))'});
 const missing=await send({type:'run',id:1,bars,context});assert.equal(missing.type,'error');assert.match(missing.error,/ES1!/);
 const peers=bars.map(b=>({...b,open:b.open+500,high:b.high+500,low:b.low+500,close:b.close+500}));const found=await send({type:'run',id:2,bars,context:{...context,markets:{...context.markets,'ES1!':{'1m':peers,metadata}}}});
 assert.equal(found.type,'result',found.error);assert.equal(found.result.series.length,0);assert.equal(found.result.pane.series[0].data.at(-1).value,613);
});
test('imports and strategy fail clearly without pretending full Pine compatibility',async()=>{
 const imports=await worker()({type:'init',code:'//@version=6\nimport ENIGMA_001/AssetCorrelationUtils/8 as AC\nindicator("Private")\nplot(close)'});assert.equal(imports.type,'error');assert.match(imports.error,/source|import/i);
 const strategy=await worker()({type:'init',code:'//@version=6\nstrategy("Unsupported")\nplot(close)'});assert.equal(strategy.type,'error');assert.match(strategy.error,/indicator|strategy/i);
});
test('Pine ETH security never substitutes aggregated minute bars for missing native history',async()=>{
 const send=worker();await send({type:'init',code:'//@version=6\nindicator("Native only")\nplot(request.security("ES1!","60",close))'});
 const peers=bars.map(b=>({...b,close:b.close+500,open:b.open+500,high:b.high+500,low:b.low+500}));
 const result=await send({type:'run',id:1,bars,context:{...context,markets:{...context.markets,'ES1!':{'1m':peers,metadata}}}});
 assert.equal(result.type,'data_required');assert.equal(result.requirement.symbol,'ES1!');assert.equal(result.requirement.timeframe,'1h');assert.match(result.error,/native/);
});

test('missing native daily history waits and the same Pine worker runs after the data arrives',async()=>{
 const send=worker();await send({type:'init',code:'//@version=6\nindicator("Daily dependency",overlay=true)\nplot(request.security(syminfo.tickerid,"D",close))'});
 const waiting=await send({type:'run',id:1,bars,context});assert.equal(waiting.type,'data_required');assert.equal(waiting.requirement.timeframe,'D');
 const daily=[{time:1699916400,open:90,high:110,low:85,close:100,volume:500},{time:1700002800,open:100,high:130,low:95,close:120,volume:600}];
 const result=await send({type:'run',id:2,bars,context:{...context,dataRevision:2,markets:{'NQ1!':{'1m':bars,D:daily,metadata}}}});assert.equal(result.type,'result',result.error);
});
