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

test('matchDay supports possessive Fed Chair and Retail Sales Control Group while rejecting non-Chair speakers',()=>{
  const warsh=event("Fed's Chair Warsh speech",'2026-11-16T17:00:00Z');
  const barr=event("Fed's Barr speech",'2026-11-16T10:00:00Z',{impact:'Medium'});
  const ctrl=event('Retail Sales Control Group','2026-11-17T13:30:00Z');
  assert.deepEqual(News.matchDay([warsh,barr,ctrl],'2026-11-13').map(x=>x.id),['fed-before']);
  assert.deepEqual(News.matchDay([warsh,barr,ctrl],'2026-11-16').map(x=>x.id),['fed-day']);
  assert.deepEqual(News.matchDay([warsh,barr,ctrl],'2026-11-17').map(x=>x.id),['0830']);
  assert.deepEqual(News.matchDay([barr],'2026-11-16'),[]);
});

test('matchDay matches ShowMyTrades Initial Jobless Claims (Medium), Retail Sales ex Autos, and 09:45/10:00 US PMI to 0830',()=>{
  const claims=event('Initial Jobless Claims','2026-11-19T13:30:00Z',{impact:'Medium'});
  const retail=event('Retail Sales ex Autos MoM','2026-11-17T13:30:00Z',{impact:'Medium'});
  const spPmi=event('S&P Global Services PMI','2026-11-23T14:45:00Z',{impact:'High'});
  const ismPmi=event('ISM Manufacturing PMI','2026-11-02T15:00:00Z',{impact:'High'});
  assert.deepEqual(News.matchDay([claims],'2026-11-19').map(x=>x.id),['0830']);
  assert.deepEqual(News.matchDay([retail],'2026-11-17').map(x=>x.id),['0830']);
  assert.deepEqual(News.matchDay([spPmi],'2026-11-23').map(x=>x.id),['0830']);
  assert.deepEqual(News.matchDay([ismPmi],'2026-11-02').map(x=>x.id),['0830']);
});

test('calendar attaches protocol images to matching day headings and omits them in Replay or EUR-only filter',()=>{
  const makeEl=tag=>{
    const el={tagName:tag.toUpperCase(),children:[],dataset:{},attributes:{},className:'',textContent:'',src:'',alt:'',title:'',hidden:false,
      setAttribute(k,v){this.attributes[k]=String(v);},removeAttribute(k){delete this.attributes[k];},
      append(...nodes){for(const n of nodes)this.children.push(typeof n==='string'?{textContent:n,children:[]}:n);},
      appendChild(n){this.children.push(n);return n;},
      replaceChildren(){this.children=[];},
      querySelectorAll(){return [];},querySelector(){return null;}};
    return el;
  };
  const RealDate=Date,fixedNow=RealDate.parse('2026-11-15T12:00:00Z');
  class FakeDate extends RealDate{constructor(...a){super(...(a.length?a:[fixedNow]));}static now(){return fixedNow;}}
  const doc={createElement:makeEl,getElementById:()=>null,body:makeEl('body'),addEventListener(){}};
  const ctx=vm.createContext({document:doc,Date:FakeDate,Intl,NewsProtocols:News,Workspace:{read:(_,d)=>d,write(){}}});
  vm.runInContext(fs.readFileSync('frontend/js/terminal_companions.js','utf8')+';this.Companions=TerminalCompanions;',ctx);
  const comp=Object.assign(Object.create(ctx.Companions.prototype),{
    currency:'USD',impacts:new Set(['High']),calendarFilters:makeEl('div'),calendarList:makeEl('div'),calendarStatus:makeEl('footer'),
    news:{events:[]},getReplay:()=>({running:false}),loadCalendar(){},
    calendarData:{checked_at:fixedNow/1000,events:[event('FOMC Statement','2026-11-18T19:00:00Z')]}
  });
  comp.renderCalendar();
  const walk=(node,fn)=>{fn(node);for(const c of node.children||[])walk(c,fn);};
  const imgs=[];walk(comp.calendarList,n=>{if(n.tagName==='IMG')imgs.push(n.src);});
  assert.deepEqual(imgs,['assets/news-protocols/fomc-before.png','assets/news-protocols/fomc-day.png','assets/news-protocols/fomc-after.png']);
  comp.currency='EUR';comp.renderCalendar();
  const eurImgs=[];walk(comp.calendarList,n=>{if(n.tagName==='IMG')eurImgs.push(n.src);});
  assert.deepEqual(eurImgs,[]);
  comp.currency='USD';comp.getReplay=()=>({running:true});comp.renderCalendar();
  const replayImgs=[];walk(comp.calendarList,n=>{if(n.tagName==='IMG')replayImgs.push(n.src);});
  assert.deepEqual(replayImgs,[]);
});

test('calendar preserves post-news Day After predictions across yesterday, weekends, empty day rows and far windows',()=>{
  const makeEl=tag=>{
    const el={tagName:tag.toUpperCase(),children:[],dataset:{},attributes:{},className:'',textContent:'',src:'',alt:'',title:'',hidden:false,
      setAttribute(k,v){this.attributes[k]=String(v);},removeAttribute(k){delete this.attributes[k];},
      append(...nodes){for(const n of nodes)this.children.push(typeof n==='string'?{textContent:n,children:[]}:n);},
      appendChild(n){this.children.push(n);return n;},
      replaceChildren(){this.children=[];},
      querySelectorAll(){return [];},querySelector(){return null;}};
    return el;
  };
  const RealDate=Date;
  const runAt=(isoNow,events)=>{
    const fixedNow=RealDate.parse(isoNow),writes=[];
    class FakeDate extends RealDate{constructor(...a){super(...(a.length?a:[fixedNow]));}static now(){return fixedNow;}}
    const doc={createElement:makeEl,getElementById:()=>null,body:makeEl('body'),addEventListener(){}};
    const ctx=vm.createContext({document:doc,Date:FakeDate,Intl,NewsProtocols:News,Workspace:{read:(_,d)=>d,write:(k,v)=>writes.push([k,v])}});
    vm.runInContext(fs.readFileSync('frontend/js/terminal_companions.js','utf8')+';this.Companions=TerminalCompanions;',ctx);
    const comp=Object.assign(Object.create(ctx.Companions.prototype),{
      currency:'USD',impacts:new Set(['High']),calendarFilters:makeEl('div'),calendarList:makeEl('div'),calendarStatus:makeEl('footer'),
      protocolEvents:[],getReplay:()=>({running:false}),loadCalendar(){},
      calendarData:{checked_at:fixedNow/1000,events}
    });
    comp.renderCalendar();
    const walk=(node,fn)=>{fn(node);for(const c of node.children||[])walk(c,fn);};
    const imgs=[],texts=[],dots=[],smalls=[];
    walk(comp.calendarList,n=>{
      if(n.tagName==='IMG')imgs.push(n.src);
      if(n.tagName==='SPAN'&&n.textContent)texts.push(n.textContent);
      if(n.tagName==='I'&&n.dataset?.impact)dots.push(n.dataset.impact);
      if(n.tagName==='SMALL'&&n.textContent)smalls.push(n.textContent);
    });
    return {comp,imgs,texts,dots,smalls,writes};
  };

  const dayAfter=runAt('2026-11-19T12:00:00Z',[event('FOMC Statement','2026-11-18T19:00:00Z',{actual:'4.50%',forecast:'4.50%'})]);
  assert.deepEqual(dayAfter.imgs,['assets/news-protocols/fomc-after.png']);
  assert.ok(dayAfter.texts.includes('Sau tin'));
  assert.ok(dayAfter.texts.includes('FOMC Statement'));
  assert.ok(dayAfter.dots.includes('High'));
  assert.ok(dayAfter.smalls.some(s=>s.includes('A 4.50%')&&s.includes('F 4.50%')));
  assert.equal(dayAfter.comp.protocolEvents.length,1);
  assert.ok(dayAfter.writes.some(([k,v])=>k==='terminal_protocol_events_v1'&&v.length===1));

  const mondayAfterFri=runAt('2026-11-16T12:00:00Z',[event('FOMC Statement','2026-11-13T19:00:00Z')]);
  assert.deepEqual(mondayAfterFri.imgs,['assets/news-protocols/fomc-after.png']);

  const farWindow=runAt('2026-11-01T12:00:00Z',[event('FOMC Statement','2026-11-13T19:00:00Z')]);
  assert.deepEqual(farWindow.imgs,['assets/news-protocols/fomc-before.png','assets/news-protocols/fomc-day.png','assets/news-protocols/fomc-after.png']);
});
