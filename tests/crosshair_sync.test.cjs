const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const context=vm.createContext({});vm.runInContext(fs.readFileSync('frontend/js/sync_controller.js','utf8')+';this.Sync=SyncController;',context);
 const sync=new context.Sync();
 const make=(height,scale)=>{let move;const c={bars:[{time:60,close:99999},{time:120,close:88888}],tfSeconds:60,plotHeight:height+26,series:{coordinateToPrice:y=>1000-y*scale},calls:[],clears:0,chart:{timeScale:()=>({height:()=>26,subscribeVisibleLogicalRangeChange(){}}),subscribeCrosshairMove:fn=>move=fn,clearCrosshairPosition(){c.clears++;},setCrosshairPosition(price,time,series){c.calls.push({price,time,series});move({time,point:{x:10,y:10}});}}};c.move=p=>move(p);sync.register(c);return c;};
 const nq=make(400,1),es=make(200,2),ym=make(600,3);return {sync,nq,es,ym};
}
test('cross-chart Y follows free mouse height and independent price scales, never OHLC close; no synthetic feedback loop',()=>{
 const {nq,es,ym,sync}=setup();nq.move({time:60,point:{x:100,y:100}});
 assert.equal(es.calls[0].price,900);assert.equal(ym.calls[0].price,550);assert.equal(es.calls[0].time,60);assert.equal(nq.calls.length,0);assert.equal(sync.isCrosshairBroadcasting,false);
 nq.move({time:60,point:{x:101,y:120}});assert.equal(es.calls[1].price,880);assert.equal(ym.calls[1].price,460);assert.notEqual(es.calls[1].price,es.bars[0].close);
});
test('missing timestamps/future bars and leaving the main pane clear targets rather than snapping to a stale candle',()=>{
 const {nq,es,ym}=setup();nq.move({time:600,point:{x:100,y:100}});assert.equal(es.calls.length,0);assert.equal(es.clears,1);
 nq.move({time:60,point:{x:100,y:100},paneIndex:1});assert.equal(es.clears,2);
 nq.move({point:undefined});assert.equal(es.clears,3);assert.equal(ym.clears,3);
 nq.move({time:60,point:{x:100,y:401}});assert.equal(es.clears,4);
});
test('coarser target interval uses its containing real bar; sync off keeps crosshair broadcasts disabled',()=>{
 const {sync,nq,es}=setup();es.tfSeconds=300;es.bars=[{time:60,close:99999}];
 nq.move({time:180,point:{x:100,y:200}});assert.equal(es.calls[0].time,60);assert.equal(es.calls[0].price,800);
 sync.syncEnabled=false;nq.move({time:60,point:{x:100,y:100}});assert.equal(es.calls.length,1);
});
