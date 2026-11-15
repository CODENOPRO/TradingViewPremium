const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Model=require('../frontend/js/drawing_model.js'),News=require('../frontend/js/news_protocols.js'),Alert=require('../frontend/js/price_alerts.js');
const now=s=>Date.parse(s)/1000,event=(title,date,extra={})=>({title,time:now(date),currency:'USD',impact:'High',...extra});
const chart=()=>({currentTimeframe:'1m',tfSeconds:60,bars:[{time:60},{time:120},{time:3600}],chart:{timeScale:()=>({logicalToCoordinate:i=>i*100,coordinateToLogical:x=>x/100})},series:{priceToCoordinate:p=>p*10,coordinateToPrice:y=>y/10}});

test('four rectangle edge handles resize exactly one coordinate even after crossing the opposite edge',()=>{
  const c=chart();
  for(const reversed of [false,true]){
    const d={type:'box',p1:{time:reversed?120:60,price:reversed?20:10},p2:{time:reversed?60:120,price:reversed?10:20}};
    const original=JSON.stringify(d),edges=Model.boxEdges(Model.geometry(c,d));
    assert.equal(edges.length,4);
    for(const edge of edges){
      assert.equal(Model.hit(c,d,edge.x,edge.y),edge.handle);
      const resized=Model.resizeBox(d,edge.handle,{time:4000,price:40}),[key,axis]=edge.handle.split('_'),other=key==='p1'?'p2':'p1';
      assert.deepEqual(resized[other],d[other]);assert.equal(resized[key][axis],axis==='time'?4000:40);
      assert.equal(resized[key][axis==='time'?'price':'time'],d[key][axis==='time'?'price':'time']);
    }
    assert.equal(JSON.stringify(d),original);
  }
});

test('hover cursors describe edges, corners, lines, fib and locked drawings',()=>{
  const c=vm.createContext({DrawingModel:Model});vm.runInContext(fs.readFileSync('frontend/js/drawing_editor.js','utf8')+';this.Editor=DrawingEditor;',c);
  const e=Object.assign(Object.create(c.Editor.prototype),{manager:{drawingsLocked:false}}),d={type:'box',p1:{time:60,price:10},p2:{time:120,price:20}};
  const cursor=(handle,drawing=d)=>e.cursor(chart(),{handle,drawing});
  assert.equal(cursor('p1_time'),'ew-resize');assert.equal(cursor('p2_price'),'ns-resize');assert.equal(cursor('p1'),'nwse-resize');assert.equal(cursor('p1x_p2y'),'nesw-resize');
  for(const type of ['line','fib','measure','position','text','brush'])assert.equal(cursor('body',{...d,type}),'move');
  assert.equal(cursor('p1',{...d,type:'hline'}),'ns-resize');assert.equal(cursor('body',{...d,locked:true}),'not-allowed');
});

test('brush preserves sub-bar coordinates across gaps and only hits the painted stroke',()=>{
  const c=chart(),p=Model.fromPixel(c,150,150,true);assert.deepEqual(p,{time:1860,price:15});assert.equal(Model.point(c,p).x,150);
  const d={type:'brush',p1:{time:60,price:10},points:[{time:60,price:10},p,{time:3600,price:10}]};
  assert.equal(Model.hit(c,d,150,150),'body');assert.equal(Model.hit(c,d,100,190),null);assert.equal(Model.geometry(c,d).right,200);
});

test('weak magnet updates the actual crosshair, guards recursion and leaves free motion outside the radius',()=>{
  const handlers={},calls=[];let callback;
  const c=vm.createContext({});vm.runInContext(fs.readFileSync('frontend/js/drawing_tools.js','utf8')+';this.Manager=DrawingManager;',c);
  const m=Object.assign(Object.create(c.Manager.prototype),{magnetEnabled:true,magnetMode:'weak'});
  const ch={container:{hidden:false,clientWidth:500,getBoundingClientRect:()=>({left:10,top:20}),addEventListener:(name,fn)=>handlers[name]=fn},plotHeight:400,series:{},coordinateToTime:x=>x,coordinateToPrice:y=>y,
    snapToBar:(time,price,mode,pixel)=>{assert.equal(mode,'weak');return Math.abs(pixel.y-100)<=8?{time:60,price:100}:{time,price};},
    chart:{priceScale:()=>({width:()=>65}),subscribeCrosshairMove:fn=>callback=fn,clearCrosshairPosition(){},setCrosshairPosition:(p,t)=>{calls.push([p,t]);callback({point:{x:60,y:100}});}}};
  m.bindMagnetCrosshair(ch);
  const move=(x,y,ctrlKey=false)=>{handlers.mousemove({clientX:x+10,clientY:y+20,ctrlKey,target:{closest:()=>false}});callback({point:{x,y}});};
  move(61,104);assert.deepEqual(calls,[[100,60]]);move(61,120);assert.equal(calls.length,1);move(61,104,true);assert.equal(calls.length,1);
});

test('alert drag previews leave the original untouched; cancel discards and release commits tick-rounded price once',()=>{
  const context=vm.createContext({document:{createElement:()=>({appendChild(){}}),addEventListener(){}},window:{addEventListener(){}},AlertPrice:Alert});
  vm.runInContext(fs.readFileSync('frontend/js/price_alerts.js','utf8')+';this.Controls=AlertChartControls;',context);
  const a={id:'a',symbol:'NQ1!',price:100},updates=[];const ch={symbol:'NQ1!',metadata:{tickSize:.25},plotHeight:300,coordinateToPrice:y=>y/10,renderDrawings(){},container:{appendChild(){},getBoundingClientRect:()=>({top:0})}};
  const controls=new context.Controls(ch,{getAlerts:()=>[a],update:(...args)=>updates.push(args),edit(){}}),button={setPointerCapture(){},hasPointerCapture:()=>false};
  const e=y=>({clientY:y,button:0,pointerId:1,currentTarget:button,preventDefault(){},stopPropagation(){}});
  controls.start(e(100),'a');controls.move(e(154));assert.equal(controls.drag.price,15.5);assert.equal(a.price,100);assert.equal(updates.length,0);controls.cancel();assert.equal(updates.length,0);
  controls.start(e(100),'a');controls.move(e(154));controls.end(e(154));assert.deepEqual(updates,[['a',15.5,100]]);assert.equal(a.price,100);
  assert.equal(Alert.crossed({price:100,condition:'cross'},99,101),true);assert.equal(Alert.crossed({price:100,condition:'cross'},101,101),false);
});

test('protocols match New York dates and DST, ignore non-USD/tentative/ADP, retain multiple matching cards',()=>{
  const events=[event('Core CPI m/m','2026-03-10T12:30:00Z'),event('Core PPI m/m','2026-03-11T12:30:00Z'),event('Unemployment Claims','2026-03-10T12:30:00Z'),event('ADP Non-Farm Employment Change','2026-03-10T12:30:00Z'),event('CPI','2026-03-10T12:30:00Z',{currency:'EUR'}),event('FOMC Statement','2026-03-10T18:00:00Z',{tentative:true})];
  assert.equal(News.day(now('2026-03-10T02:00:00Z')),'2026-03-09');
  assert.deepEqual(News.match(events,now('2026-03-09T16:00:00Z')).map(x=>x.id),['cpi-before']);
  const cards=News.match(events,now('2026-03-10T16:00:00Z'));assert.deepEqual(cards.map(x=>x.id),['cpi-day','0830']);assert.equal(cards[0].nextEvents[0].title,'Core PPI m/m');
  assert.equal(News.match([event('Unemployment Claims','2026-01-13T13:30:00Z')],now('2026-01-13T16:00:00Z'))[0].id,'0830');
});

test('FOMC before/after skips weekends, NFP spans its workweek and calendar archive carries last week into next',()=>{
  const fomc=event('FOMC Statement','2026-11-13T19:00:00Z'),nfp=event('Non-Farm Employment Change','2026-11-13T13:30:00Z');
  assert.equal(News.match([fomc],now('2026-11-12T16:00:00Z'))[0].id,'fomc-before');
  assert.equal(News.match([fomc],now('2026-11-16T16:00:00Z'))[0].id,'fomc-after');
  assert.deepEqual(News.match([fomc],now('2026-11-15T16:00:00Z')),[]);
  assert.equal(News.match([nfp],now('2026-11-09T16:00:00Z'))[0].id,'nfp-week');
  assert.equal(News.merge([fomc],[fomc,nfp],now('2026-11-16T16:00:00Z')).length,2);
});
