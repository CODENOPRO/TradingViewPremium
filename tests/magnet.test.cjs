const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const DrawingModel=require('../frontend/js/drawing_model.js');
const c=vm.createContext({MarketData:{durations:{}},Intl,DrawingModel});
vm.runInContext(fs.readFileSync('frontend/js/chart_engine.js','utf8')+';this.Engine=ChartEngine;',c);
const chart=()=>Object.assign(Object.create(c.Engine.prototype),{bars:[{time:60,open:100,high:110,low:95,close:105},{time:3600,open:120,high:130,low:115,close:125}],tfSeconds:60,series:{priceToCoordinate:p=>p*10},chart:{timeScale:()=>({logicalToCoordinate:i=>i*20})}});
test('strong magnet snaps both price and real candle timestamp across session gaps',()=>{
  const e=chart(),p=e.snapToBar(3500,124.5,'strong');assert.equal(p.time,3600);assert.equal(p.price,125);
  assert.equal(e.snapToBar(3500,1000,'strong').price,130);
});
test('weak magnet uses pixel distance in both axes and does not pull distant/future points',()=>{
  const e=chart();assert.equal(e.snapToBar(3600,125.5,'weak').price,125);
  assert.equal(e.snapToBar(3600,126,'weak').price,126);
  assert.equal(e.snapToBar(6000,125,'weak').time,6000);
});
test('magnet toggle is silent; Ctrl temporarily inverts it without changing persisted mode',()=>{
  let toasts=0,writes=0;const attrs={};
  const context=vm.createContext({document:{querySelectorAll:()=>[{classList:{toggle(){}},setAttribute:(k,v)=>attrs[k]=v}]},Workspace:{write(){writes++;}},showToast:()=>toasts++});
  vm.runInContext(fs.readFileSync('frontend/js/drawing_tools.js','utf8')+';this.Manager=DrawingManager',context);
  const manager=Object.assign(Object.create(context.Manager.prototype),{magnetEnabled:false,magnetMode:'strong'}),e=chart();
  assert.equal(manager.snapPoint(e,3500,124.5,{}).price,124.5);
  assert.equal(manager.snapPoint(e,3500,124.5,{ctrlKey:true}).price,125);
  manager.setTool('magnet');assert.equal(attrs['aria-pressed'],'true');assert.equal(writes,1);assert.equal(toasts,0);
  assert.equal(manager.snapPoint(e,3500,124.5,{ctrlKey:true}).price,124.5);assert.equal(manager.magnetEnabled,true);assert.equal(writes,1);
});
