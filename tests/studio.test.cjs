const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const PineEditor=require('../frontend/js/pine_editor.js');
test('Pine indentation handles multiline selections and trailing newlines without changing adjacent code',()=>{
  assert.deepEqual(PineEditor.indent('x\nfoo\nbar\ny',2,10),{start:2,end:9,text:'    foo\n    bar'});
  assert.deepEqual(PineEditor.indent('    foo\n\tbar',0,12,true),{start:0,end:12,text:'foo\nbar'});
  assert.deepEqual(PineEditor.indent('foo',1,1),{start:1,end:1,text:'    ',cursor:5});
});
test('Pine syntax highlighting escapes source text and does not interpret strings or comments as HTML',()=>{
  const html=PineEditor.highlight('if close > 1\n    label.new(bar_index, high, "<img onerror=alert(1)>") // <b>');
  assert.ok(html.includes('class="pine-keyword">if</span>'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(html.includes('class="pine-comment">// &lt;b&gt;</span>'));
});
test('external drawings repaint inside every native scale frame before pointerup, without an idle RAF or indicator rerun',()=>{
  const ctx=vm.createContext({MarketData:{durations:{}},Intl});
  vm.runInContext(fs.readFileSync('frontend/js/chart_engine.js','utf8')+';this.Engine=ChartEngine',ctx);
  let primitive,scale=1,calculations=0;const positions=[];
  const engine={series:{attachPrimitive:p=>primitive=p},runner:{schedule:()=>calculations++},renderDrawings:()=>positions.push(100*scale)};
  ctx.Engine.prototype.initOverlayScaleSync.call(engine);
  const renderer=primitive.paneViews()[0].renderer();renderer.draw();scale=2;renderer.draw();scale=3;renderer.draw();
  assert.deepEqual(positions,[100,200,300]);assert.equal(calculations,0);assert.equal(primitive.paneViews()[0].zOrder(),'top');
});
const expression=name=>fs.readFileSync('backend/bridge_server.py','utf8').match(new RegExp(name+" = r'''([\\s\\S]*?)'''"))[1];
test('editing Pine source preserves the instance inputs instead of resetting them to defaults',()=>{
  const values={'indicator-code':'//@version=6\nindicator("Test")\nplot(close)','indicator-name':'Test'};
  const ctx=vm.createContext({document:{getElementById:id=>({value:values[id]})}});
  vm.runInContext(fs.readFileSync('frontend/js/indicator_library.js','utf8')+';this.Library=IndicatorLibrary',ctx);
  const inputs={period:17,enabled:false};const script=ctx.Library.prototype.readEditor.call({instanceId:'x',sources:[],chart:{runner:{entries:[{record:{id:'x',settings:inputs}}]}}});
  assert.equal(script.settings.period,17);assert.equal(script.settings.enabled,false);assert.notEqual(script.settings,inputs);
});
test('Overlay snapshots use its own resolved symbol, OHLCV plot rows and metadata; reject stale symbol metadata',()=>{
  const overlay=(symbol,infoName,close)=>({metaInfo:()=>({id:'Overlay@tv-basicstudies'}),symbol:()=>symbol,symbolInfo:()=>null,_symbolSourceSymbolInfo:{value:()=>({name:infoName,minmov:1,pricescale:4,pointvalue:50,timezone:'America/Chicago',session:'1700-1600'})},interval:()=>'1',data:()=>({size:()=>1,each:fn=>fn(0,[60,close,close+1,close-1,close,99])})});
  const loading={...overlay('CME_MINI:NQ1!','NQ1!',99),status:()=>({type:1})};
  const widget={model:()=>({dataSources:()=>[overlay('CME_MINI:ES1!','ES1!',7550),overlay('CBOT_MINI:YM1!','YM1!',52000),overlay('CME_MINI:NQ1!','ES1!',99),loading]})};
  const entries=vm.runInNewContext(expression('SNAPSHOT_JS').replace('__FULL__','true'),{window:{_exposed_chartWidgetCollection:{getAll:()=>[widget]}}});
  assert.equal(entries.length,2);assert.equal(entries[0].symbol,'ES1!');assert.equal(entries[0].bars[0].close,7550);assert.equal(entries[1].bars[0].close,52000);assert.equal(entries[0].metadata.tickSize,.25);assert.equal(entries[1].bars[0].volume,99);
});
test('single-tab setup adds native peer panes and repeated setup does not duplicate them or alter the main interval',async()=>{
  const sources=[],created=[];const main={symbolInfo:()=>({name:'NQ1!'}),interval:()=>'5'};sources.push(main);
  const widget={model:()=>({mainSeries:()=>main,dataSources:()=>sources}),addOverlayStudy:async(symbol,overlay,extend)=>{assert.equal(overlay,false);assert.equal(extend,true);const s={id:()=>symbol,metaInfo:()=>({id:'Overlay@tv-basicstudies'}),symbol:()=>symbol};sources.push(s);created.push(symbol);return s;}};
  const ctx=vm.createContext({window:{_exposed_chartWidgetCollection:{activeChartWidget:{value:()=>widget}}}});
  const first=await vm.runInContext(expression('ENSURE_PANES_JS'),ctx);assert.equal(first.created.length,2);assert.equal(first.resolution,'5');
  const second=await vm.runInContext(expression('ENSURE_PANES_JS'),ctx);assert.equal(second.created.length,0);assert.deepEqual(created,['CME_MINI:ES1!','CBOT_MINI:YM1!']);
});
