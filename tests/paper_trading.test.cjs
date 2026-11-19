const test=require('node:test'),assert=require('node:assert/strict');
const Paper=require('../frontend/js/paper_trading.js');
const meta={pointValue:20,tickSize:.25};
function setup(balance=100000){const p=new Paper();p.create('Demo',balance,10);p.tick('NQ1!',100);return p;}
const order=(side='buy',qty=1,extra={})=>({symbol:'NQ1!',side,type:'market',qty,...extra});
test('scale in averages price, opposite trades reduce then reverse one symbol',()=>{const p=setup();p.place(order('buy',2),meta);p.tick('NQ1!',102);p.place(order('buy',2),meta);assert.equal(p.account.positions.length,1);assert.equal(p.account.positions[0].qty,4);assert.equal(p.account.positions[0].price,101);p.place(order('sell',5),meta);assert.equal(p.account.positions.length,1);assert.equal(p.account.positions[0].side,'sell');assert.equal(p.account.positions[0].qty,1);assert.equal(p.account.balance,100080);assert.equal(p.summary().realized,80);});
test('a reducing trade works even when equity is below initial balance',()=>{const p=setup(200);p.place(order(),meta);p.tick('NQ1!',99);p.place(order('sell'),meta);assert.equal(p.account.positions.length,0);assert.equal(p.account.balance,180);});
test('large reversal executes atomically without margin rejection',()=>{const p=setup(1000);p.place(order(),meta);p.tick('NQ1!',90);p.place(order('sell',100),meta);assert.equal(p.account.positions.length,1);assert.equal(p.account.positions[0].side,'sell');assert.equal(p.account.positions[0].qty,99);assert.equal(p.account.balance,800);});
test('marketable limit fills immediately at the observed better last price and validates SL against fill quote',()=>{
  const p=setup();
  assert.throws(()=>p.place(order('buy',1,{type:'limit',price:102,sl:101}),meta));
  assert.equal(p.account.positions.length,0);
  p.place(order('buy',1,{type:'limit',price:101,sl:98}),meta);
  assert.equal(p.account.orders.length,0);
  assert.equal(p.account.positions[0].price,100);
});
test('PaperPanel guard blocks Live chart orders from routing into Replay when Replay scope is Current chart',()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const ctx=vm.createContext({document:{getElementById:()=>null,addEventListener(){}}});
  vm.runInContext(fs.readFileSync('frontend/js/paper_panel.js','utf8')+';this.PaperPanel=PaperPanel;',ctx);
  const panel=Object.assign(Object.create(ctx.PaperPanel.prototype),{
    isReplay:()=>true,
    charts:[{symbol:'NQ1!',replayMode:true}],
    paper:setup()
  });
  assert.throws(()=>panel.guard('NQ1!',{symbol:'NQ1!',replayMode:false}),/Live/);
  assert.doesNotThrow(()=>panel.guard('NQ1!',{symbol:'NQ1!',replayMode:true}));
});
test('stop gaps fill at the observed last and cancelled orders remain in the journal',()=>{const p=setup();p.place(order('buy',1,{type:'stop',price:101}),meta);p.tick('NQ1!',103);assert.equal(p.account.positions[0].price,103);const item=p.place(order('buy',1,{type:'limit',price:99}),meta);p.cancel(item.id);assert.equal(p.account.history.at(-1).event,'cancelled');assert.equal(p.account.orders.length,0);});
test('tick size, stop side and bracket side validate before changing the account',()=>{const p=setup();for(const item of [order('buy',1,{type:'limit',price:99.1}),order('buy',1,{type:'stop',price:99}),order('buy',1,{sl:101}),order('sell',1,{tp:101})])assert.throws(()=>p.place(item,meta));assert.equal(p.account.positions.length,0);assert.equal(p.account.orders.length,0);});
test('partial close realizes only closed size',()=>{const p=setup();p.place(order('buy',4),meta);const item=p.account.positions[0];p.tick('NQ1!',102);p.close(item.id,'manual',1);assert.equal(p.account.balance,100040);assert.equal(item.qty,3);assert.equal(p.account.history.at(-1).qty,1);assert.throws(()=>p.close(item.id,'manual',4));});
test('an existing long can move stop above entry but below live price',()=>{const p=setup();p.place(order('buy',1,{sl:95,tp:120}),meta);const item=p.account.positions[0];p.tick('NQ1!',110);p.amendPosition(item.id,{sl:105});assert.equal(item.sl,105);assert.equal(item.price,100);assert.throws(()=>p.amendPosition(item.id,{sl:111}));p.tick('NQ1!',104);assert.equal(p.account.positions.length,0);assert.equal(p.account.balance,100080);});
test('amending a pending limit is persistent and can make it immediately executable',()=>{const p=setup();const item=p.place(order('buy',1,{type:'limit',price:95,sl:90,tp:110}),meta);p.amendOrder(item.id,{qty:2,price:100});assert.equal(p.account.orders.length,0);assert.equal(p.account.positions[0].qty,2);assert.equal(p.account.positions[0].price,100);assert.ok(p.account.history.some(h=>h.event==='modified'));});
test('failed persistence rolls back placement, closing, account selection and cancellation',()=>{const p=setup();p.place(order(),meta);const id=p.account.positions[0].id;const before=structuredClone(p.state);p.persist=()=>false;assert.throws(()=>p.close(id),/lưu/);assert.deepEqual(p.state,before);assert.throws(()=>p.place(order('buy'),meta),/lưu/);assert.deepEqual(p.state,before);});
test('background pending fills work across accounts and keep the selected account unchanged',()=>{const p=setup(300);const a=p.account;p.place(order('buy',2,{type:'limit',price:99}),meta);const b=p.create('Second',10000,0);p.tick('NQ1!',98);assert.equal(a.orders.length,0);assert.equal(a.positions.length,1);assert.equal(a.history.at(-1).event,'filled');assert.equal(p.state.active,b.id);});
test('idle price samples never rewrite storage and stale quotes cannot fill or close',()=>{let saved=0;const p=new Paper(undefined,()=>{saved++;});p.create('A',10000,0);const count=saved;p.tick('NQ1!',100);p.tick('NQ1!',101);assert.equal(saved,count);p.quotes.get('NQ1!').received=Date.now()-6000;assert.throws(()=>p.place(order(),meta),/live/);p.tick('NQ1!',NaN);assert.equal(p.quotes.get('NQ1!').price,101);});
test('multiple legacy lots and saved account history are retained during reconstruction',()=>{const p=setup();p.account.positions=[{id:'a',symbol:'NQ1!',side:'buy',qty:1,price:100,pointValue:20,margin:200},{id:'b',symbol:'NQ1!',side:'sell',qty:1,price:110,pointValue:20,margin:220}];const before=structuredClone(p.state),restored=new Paper(before);assert.equal(restored.account.positions.length,2);assert.equal(restored.account.positions[1].price,110);});
test('checkMargin allows orders without margin blocking when account is valid',()=>{
  const p=setup(300);
  assert.doesNotThrow(()=>p.checkMargin(order('buy',2),meta,100));
  assert.doesNotThrow(()=>p.checkMargin(order('buy',2,{type:'limit',price:95}),meta,100));
  assert.doesNotThrow(()=>p.checkMargin(order('buy',2,{type:'stop',price:105}),meta,100));
  assert.equal(p.usedMargin(),0);
});
test('amendPosition can clear SL or TP individually without losing the other',()=>{
  const p=setup();
  p.place(order('buy',1,{sl:95,tp:110}),meta);
  const pos=p.account.positions[0];
  p.amendPosition(pos.id,{sl:null});
  assert.equal(pos.sl,null);
  assert.equal(pos.tp,110);
  p.amendPosition(pos.id,{tp:null});
  assert.equal(pos.tp,null);
});
test('TopstepX PaperChartOrders draws zones, right-aligned badges, execution arrows, 1-click close and deletes SL/TP/orders via ×',()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const makeNode=(tag='div')=>({tagName:tag.toUpperCase(),children:[],style:{},dataset:{},attributes:{},hidden:false,
    setAttribute(k,v){this.attributes[k]=String(v);},appendChild(x){this.children.push(x);return x;},remove(){}});
  const fakeDoc={createElement:tag=>makeNode(tag),getElementById:()=>null};
  const ctx=vm.createContext({document:fakeDoc,ChartContextMenu:{formatPrice:p=>Number(p).toFixed(2)},TerminalTime:{end:b=>b.time+60}});
  vm.runInContext(fs.readFileSync('frontend/js/paper_panel.js','utf8')+';this.PaperChartOrders=PaperChartOrders;',ctx);
  const paper=setup();
  paper.now=()=>120000;
  paper.place(order('buy',2,{sl:95,tp:115}),meta);
  const pending=paper.place(order('buy',1,{type:'limit',price:90}),meta);
  const fills=[],texts=[],strokes=[];
  const canvasCtx={save(){},restore(){},beginPath(){},rect(){},clip(){},setLineDash(){},moveTo(){},lineTo(){},
    stroke(){strokes.push(this._stroke);},strokeRect(){},strokeText(){},
    measureText:t=>({width:String(t).length*7}),
    set fillStyle(v){this._fill=v;},get fillStyle(){return this._fill;},
    set strokeStyle(v){this._stroke=v;},get strokeStyle(){return this._stroke;},
    fillRect(x,y,w,h){fills.push({fill:this._fill,x,y,w,h});},
    fill(){fills.push({fill:this._fill});},
    fillText(t,x){texts.push({t:String(t),x});}};
  const chart={symbol:'NQ1!',plotBottom:400,replayMode:true,replayClock:120,bars:[{time:0,low:98,high:102,close:100},{time:60,low:99,high:103,close:100}],metadata:meta,displaySessionMetadata:()=>meta,
    appearance:{bg:'#050505',bracketPnl:true,oneClick:true,executionMarks:true,executionLabels:true,alignment:'Left'},
    container:{appendChild(){},getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:420})},
    chart:{priceScale:()=>({width:()=>70}),timeScale:()=>({timeToCoordinate:()=>100,getVisibleLogicalRange:()=>({from:0,to:10})})},
    series:{priceToCoordinate:p=>300-(p-85)*10},renderDrawings(){}};
  let amended=null,cancelled=null,closeDialogs=0;
  const origAmend=paper.amendPosition.bind(paper),origCancel=paper.cancel.bind(paper);
  paper.amendPosition=(id,ch)=>{amended=[id,ch];return origAmend(id,ch);};
  paper.cancel=id=>{cancelled=id;return origCancel(id);};
  const panel={paper,isReplay:()=>true,money:v=>'$'+v.toFixed(2),price:v=>String(v),
    guard(){},action(fn){fn();},edit(){},closeDialog(){closeDialogs++;}};
  const overlay=new ctx.PaperChartOrders(panel,chart);
  overlay.draw(canvasCtx,{width:800,height:420});
  assert.equal(fills.some(f=>f.fill==='rgba(255,27,27,.22)'||f.fill==='rgba(0,200,150,.28)'),false);
  const limitText=texts.find(x=>x.t.includes('Limit Buy'));
  const slText=texts.find(x=>x.t.startsWith('~ -'));
  const entryText=texts.find(x=>x.t==='$0.00');
  assert.ok(limitText && limitText.x>400);
  assert.ok(entryText && slText && entryText.x>slText.x);
  assert.ok(texts.some(x=>x.t.startsWith('~ ')));
  assert.ok(strokes.includes('#2962ff'));
  assert.ok(texts.some(x=>x.t==='2 @ 100.00'));
  assert.equal(overlay.execMarks.length,1);
  const m=overlay.execMarks[0];
  let redrawn=0;chart.renderDrawings=()=>{redrawn++;};
  overlay.onHoverMove({clientX:m.x,clientY:m.tipY});
  assert.equal(overlay.hoverExec,m.id);
  assert.equal(redrawn,1);
  fills.length=0;
  overlay.draw(canvasCtx,{width:800,height:420});
  assert.ok(fills.some(f=>f.fill==='rgba(41,98,255,.22)'));
  const posId=paper.account.positions[0].id;
  overlay.start({button:0,preventDefault(){},stopPropagation(){}},posId,'delsl');
  assert.equal(amended[0],posId);
  assert.equal(amended[1].sl,null);
  assert.equal(paper.account.positions[0].sl,null);
  overlay.start({button:0,preventDefault(){},stopPropagation(){}},pending.id,'cancel');
  assert.equal(cancelled,pending.id);
  assert.equal(paper.account.orders.length,0);
  overlay.start({button:0,preventDefault(){},stopPropagation(){}},posId,'close');
  assert.equal(closeDialogs,0);
  assert.equal(paper.account.positions.length,0);
});

test('Paper-Entry-UI v11: dragging from entry PnL box sets TP/SL, locks direction, and dragging back to entry line cancels/deletes', () => {
  const fs=require('node:fs'),vm=require('node:vm');
  const makeNode=(tag='div')=>({tagName:tag.toUpperCase(),children:[],style:{},dataset:{},attributes:{},hidden:false,
    setAttribute(k,v){this.attributes[k]=String(v);},appendChild(x){this.children.push(x);return x;},remove(){}});
  const fakeDoc={createElement:tag=>makeNode(tag),getElementById:()=>null};
  const ctx=vm.createContext({document:fakeDoc,ChartContextMenu:{formatPrice:p=>Number(p).toFixed(2)},TerminalTime:{end:b=>b.time+60}});
  vm.runInContext(fs.readFileSync('frontend/js/paper_panel.js','utf8')+';this.PaperChartOrders=PaperChartOrders;',ctx);
  const paper=setup();
  paper.place(order('buy',2),meta);
  let amended=null;
  const origAmend=paper.amendPosition.bind(paper);
  paper.amendPosition=(id,ch)=>{amended=[id,ch];return origAmend(id,ch);};
  const chart={symbol:'NQ1!',plotBottom:400,replayMode:false,bars:[{time:0,low:98,high:102,close:100}],metadata:meta,
    appearance:{bg:'#050505',bracketPnl:true,oneClick:true},
    container:{appendChild(){},getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:420})},
    chart:{priceScale:()=>({width:()=>70}),timeScale:()=>({timeToCoordinate:()=>100,getVisibleLogicalRange:()=>({from:0,to:10})})},
    series:{priceToCoordinate:p=>300-(p-85)*10},coordinateToPrice:y=>85+(300-y)/10,renderDrawings(){}};
  const panel={paper,isReplay:()=>false,money:v=>'$'+v.toFixed(2),price:v=>String(v),
    guard(){},action(fn){fn();},edit(){},closeDialog(){}};
  const overlay=new ctx.PaperChartOrders(panel,chart);
  const posId=paper.account.positions[0].id;

  // 1. Drag up from entry PnL (Long) -> creates TP
  overlay.start({button:0,clientY:150,preventDefault(){},stopPropagation(){}},posId,'entry');
  assert.equal(overlay.drag.mode,'create');
  overlay.move({clientY:100,preventDefault(){},stopPropagation(){}});
  assert.equal(overlay.drag.targetKind,'tp');
  assert.equal(overlay.drag.price,105);

  // 2. Lock direction: moving down past entry does not switch to SL
  overlay.move({clientY:200,preventDefault(){},stopPropagation(){}});
  assert.equal(overlay.drag.price,null);

  // Move back up -> TP reappears
  overlay.move({clientY:110,preventDefault(){},stopPropagation(){}});
  assert.equal(overlay.drag.price,104);
  overlay.end({preventDefault(){},stopPropagation(){}});
  assert.equal(amended[0],posId);
  assert.equal(amended[1].tp,104);
  assert.equal(paper.account.positions[0].tp,104);

  // 3. Move existing TP: drag back to coincide with entry line (< 1 tick) -> DELETES TP
  overlay.start({button:0,clientY:110,preventDefault(){},stopPropagation(){}},posId,'tp');
  assert.equal(overlay.drag.mode,'move');
  overlay.move({clientY:150,preventDefault(){},stopPropagation(){}});
  assert.equal(overlay.drag.canceled,true);
  assert.equal(overlay.drag.price,null);
  overlay.end({preventDefault(){},stopPropagation(){}});
  assert.equal(amended[1].tp,null);
  assert.equal(paper.account.positions[0].tp,null);

  // 4. Drag down from entry PnL (Long) -> creates SL
  overlay.start({button:0,clientY:150,preventDefault(){},stopPropagation(){}},posId,'entry');
  overlay.move({clientY:200,preventDefault(){},stopPropagation(){}});
  assert.equal(overlay.drag.targetKind,'sl');
  assert.equal(overlay.drag.price,95);
  overlay.end({preventDefault(){},stopPropagation(){}});
  assert.equal(amended[1].sl,95);
  assert.equal(paper.account.positions[0].sl,95);
});
