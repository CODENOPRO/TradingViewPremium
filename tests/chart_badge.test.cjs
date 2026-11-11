const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('symbol badges follow the selected market and avoid sidebar/bottom clusters without entering an indicator pane',()=>{
 let sidebar={left:6,right:54,top:56,bottom:582,width:48,height:526},lower={left:6,right:400,top:682,bottom:714,width:394,height:32};
 const context=vm.createContext({Intl,MarketData:{durations:{}},document:{getElementById:()=>({getBoundingClientRect:()=>sidebar}),querySelector:()=>({getBoundingClientRect:()=>lower})}});
 vm.runInContext(fs.readFileSync('frontend/js/chart_engine.js','utf8')+';this.Engine=ChartEngine;',context);
 const e=Object.create(context.Engine.prototype);e.symbol='NQ1!';e.symbolBadge={style:{}};e.container={clientHeight:240,getBoundingClientRect:()=>({left:0,bottom:240,width:1100,height:240})};
 e.updateSymbolBadge();assert.match(e.symbolBadge.src,/nasdaq-100\.svg$/);e.positionSymbolBadge();assert.equal(e.symbolBadge.style.left,'62px');assert.equal(e.symbolBadge.style.bottom,'30px');
 e.symbol='ES1!';e.updateSymbolBadge();assert.match(e.symbolBadge.src,/s-and-p-500\.svg$/);
 e.symbol='YM1!';e.updateSymbolBadge();assert.match(e.symbolBadge.src,/dow-30\.svg$/);
 e.symbol='CL1!';e.updateSymbolBadge();assert.equal(e.symbolBadge.hidden,true);
 e.container.getBoundingClientRect=()=>({left:0,bottom:720,width:1100,height:240});e.positionSymbolBadge();assert.equal(e.symbolBadge.style.left,'10px');assert.equal(e.symbolBadge.style.bottom,'44px');
 e.container.getBoundingClientRect=()=>({left:0,bottom:240,width:1100,height:240});e.paneHeight=100;e.positionSymbolBadge();assert.equal(e.symbolBadge.style.bottom,'130px');
});
