const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const DrawingModel=require('../frontend/js/drawing_model.js');global.DrawingModel=DrawingModel;
const bridge=require('../frontend/js/line_tools_bridge.js');
test('v5 workspace reads an original snapshot but only writes its isolated namespace',()=>{
 const original=JSON.stringify([{id:'saved',type:'box',p1:{time:60,price:10},p2:{time:120,price:20}}]),store=new Map([['drawings_box-1_NQ1!',original]]);
 const c=vm.createContext({window:{TERMINAL_ENGINE_V5:true},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},console});
 vm.runInContext(fs.readFileSync('frontend/js/workspace.js','utf8')+';this.storage=Workspace',c);
 const shapes=c.storage.read('drawings_box-1_NQ1!',[]);shapes[0].p1.price=999;c.storage.write('drawings_box-1_NQ1!',shapes);
 assert.equal(store.get('drawings_box-1_NQ1!'),original);assert.equal(JSON.parse(store.get('terminal_v5_preview:drawings_box-1_NQ1!'))[0].p1.price,999);
 assert.equal(c.storage.read('drawings_box-1_NQ1!',[])[0].p1.price,999);
});
test('v4 and v5 factories create the correct series without changing saved candle options',()=>{
 const token={},c=vm.createContext({MarketData:{durations:{}},LightweightCharts:{CandlestickSeries:token},Intl});vm.runInContext(fs.readFileSync('frontend/js/chart_engine.js','utf8')+';this.Engine=ChartEngine',c);
 const engine=Object.create(c.Engine.prototype),options={upColor:'#ffffff'};
 engine.chart={addCandlestickSeries:o=>({legacy:true,options:o})};assert.equal(engine.addSeries('Candlestick',options).legacy,true);
 engine.chart={addSeries:(type,o,pane)=>({type,options:o,pane})};const result=engine.addSeries('Candlestick',options,1);assert.equal(result.type,token);assert.equal(result.options,options);assert.equal(result.pane,1);
});
test('lab conversion retains originals and flags unsupported rectangle features',()=>{
 const source=[DrawingModel.normalize({id:'box',type:'box',p1:{time:60,price:10},p2:{time:120,price:20},text:'Saved',locked:true}),{id:'line',type:'line',p1:{time:60,price:10},p2:{time:120,price:20}}],before=JSON.stringify(source);
 const result=bridge.convert(source);assert.equal(JSON.stringify(source),before);assert.deepEqual(result.originals,source);assert.equal(result.tools.length,1);assert.equal(result.tools[0].options.editable,false);assert.equal(result.tools[0].options.text.value,'Saved');assert.ok(result.warnings.some(w=>w.includes('middle line')));assert.ok(result.warnings.some(w=>w.includes('line chưa chuyển')));
});
test('legacy Fib coefficient prices and position entry/stop/target survive conversion including session gaps',()=>{
 const a={time:60,price:100},b={time:3600,price:120},result=bridge.convert([{id:'fib',type:'fib',p1:a,p2:b,levels:[0,.236,.5,1]},{id:'pos',type:'position',p1:a,p2:b,riskReward:2}]);
 const fib=result.tools[0];for(const level of fib.options.levels){const [p0,p1]=fib.points,pluginPrice=p1.price-(p1.price-p0.price)*level.coeff,originalPrice=a.price+(b.price-a.price)*level.coeff;assert.equal(pluginPrice,originalPrice);}
 const position=result.tools[1];assert.equal(position.points[0].price,100);assert.equal(position.points[1].price,90);assert.equal(position.points[2].price,120);assert.equal(position.points[1].timestamp,3600);
});
test('native pane waits until its HTMLElement exists and uses unchanged candle timestamps',()=>{
 class Element {constructor(){this.children=[];this.style={setProperty(){}};this.dataset={};}setAttribute(){}appendChild(e){this.children.push(e);}get firstChild(){return this.children[0];}getBoundingClientRect(){return {top:150};}addEventListener(){}removeEventListener(){}remove(){}}
 let row=null,observed=0,anchor,descriptorRange,detached=0,nativeHeight=80,layoutCallback,storedView;
 const pane={getHTMLElement:()=>row,getHeight:()=>nativeHeight,setHeight(){}},scale={applyOptions(){},setVisibleRange:r=>descriptorRange=r,getVisibleRange:()=>descriptorRange};
 const series={getPane:()=>pane,priceScale:()=>scale,attachPrimitive:p=>p.attached({requestUpdate(){}}),detachPrimitive:()=>detached++,setData:bars=>anchor=bars};
 const engine={id:'x',bars:[{time:60},{time:3600}],container:new Element(),config:{bg:'#ffffff'},addSeries:()=>series,chart:{timeScale:()=>({height:()=>26}),removeSeries(){}},renderDrawings(){}};engine.container.clientHeight=300;
 const c=vm.createContext({ChartEngine:class{},document:{createElement:()=>new Element()},Workspace:{read:(_k,f)=>f,write:(_k,v)=>storedView=structuredClone(v)},ResizeObserver:class{constructor(callback){layoutCallback=callback;}observe(e){assert.ok(e);observed++;}disconnect(){}},clearTimeout,setTimeout});
 vm.runInContext(fs.readFileSync('frontend/js/native_cycle_pane.js','utf8')+';this.Pane=NativeCyclePane',c);
 const control=new c.Pane(engine);assert.equal(observed,0);row=new Element();control.set({min:0,max:100,drawings:[]});assert.deepEqual(Array.from(anchor,b=>b.time),[60,3600]);assert.equal(observed,1);assert.equal(descriptorRange.from,-15);assert.equal(descriptorRange.to,115);nativeHeight=92;layoutCallback();assert.equal(storedView.ratio,92/274);control.destroy();assert.equal(detached,1);
});
test('lab audit catches plugin rounding or option changes instead of declaring migration success',()=>{
 const converted=bridge.convert([{type:'position',p1:{time:60,price:100},p2:{time:120,price:101},riskReward:3}]);
 const actual=structuredClone(converted.tools);actual[0].options.extraDefault=true;assert.equal(bridge.audit(converted.tools,actual).length,0);
 actual[0].points[1].price=99.67;assert.match(bridge.audit(converted.tools,actual)[0],/tọa độ/);
 const legacy=bridge.convert([{type:'box',p1:{time:60,price:1},p2:{time:120,price:2}},{type:'box',p1:{time:60,price:2},p2:{time:120,price:3}}]);assert.notEqual(legacy.tools[0].id,legacy.tools[1].id);
});
