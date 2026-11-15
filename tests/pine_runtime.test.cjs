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

test('Pine v6 transpiler error surfaces instead of being masked as non-indicator',async()=>{
 const send=worker();
 const bad=await send({type:'init',code:'\uFEFF// @version=6\nindicator("Syntax Err")\nx = @broken'});
 assert.equal(bad.type,'error');
 assert.doesNotMatch(bad.error,/Chỉ hỗ trợ indicator/);
 assert.equal(Intl.DateTimeFormat.__cached,true);
});

test('Pine v6 maps 30m/1M/3M timeframes and converts box/label/table/plot/linefill/polyline accurately',async()=>{
 const send=worker();
 const script=[
  '//@version=6',
  'indicator("Parity", overlay=true)',
  'src = input.source(hlcc4, "Source")',
  'm30 = request.security(syminfo.tickerid, "30", close)',
  'm1M = request.security(syminfo.tickerid, "1M", close)',
  'plot(m30 + m1M * 0 + src * 0, "Dyn", color = close > open ? color.green : na)',
  'plot(close, "HiddenDW", display = display.data_window)',
  'plotcandle(open, high, low, close, color = color.teal)',
  'if barstate.islast',
  '    box.new(bar_index-3, high, bar_index, low, border_color=na, bgcolor=color.new(color.green, 80), text="BRK", text_size=size.tiny, text_halign=text.align_right, text_valign=text.align_bottom, text_font_family=font.family_monospace)',
  '    l1 = line.new(bar_index-2, high, bar_index, high)',
  '    l2 = line.new(bar_index-2, low, bar_index, low)',
  '    linefill.new(l1, l2, color.new(color.purple, 80))',
  '    label.new(bar_index, high, "UNI+", xloc=xloc.bar_index, style=label.style_label_left, color=color.new(color.blue, 100), textcolor=color.blue, size=size.tiny, text_font_family=font.family_monospace)',
  '    pts = array.from(chart.point.from_index(bar_index-2, low), chart.point.from_index(bar_index, high))',
  '    polyline.new(pts, line_color=color.orange, closed=false)',
 '    t = table.new(position.top_right, 2, 2, border_width=0)',
 '    table.cell(t, 0, 0, "OK", text_color=color.black, bgcolor=color.new(color.gray, 90), text_size=size.tiny, text_formatting=text.format_bold, text_font_family=font.family_monospace)',
 'plot(open, "NaOnly", color=na)'
 ].join('\n');
 const ready=await send({type:'init',code:script});
 assert.equal(ready.type,'ready',ready.error);
 assert.ok(ready.inputs.find(i=>i.key==='src').options.includes('hlcc4'));
 const m30Bars=[{time:1700001000,open:99,high:105,low:98,close:103,volume:20},{time:1700002800,open:103,high:115,low:101,close:112,volume:30}];
 const m1MBars=[{time:1696111200,open:90,high:110,low:85,close:100,volume:500},{time:1698789600,open:100,high:120,low:95,close:115,volume:600}];
 const res=await send({type:'run',id:1,bars,context:{...context,markets:{'NQ1!':{'1m':bars,'30m':m30Bars,'1M':m1MBars,metadata}}}});
 assert.equal(res.type,'result',res.error);
 assert.equal(res.result.warnings.some(w=>w.includes('Label hiện dạng text')),false);
 const titles=res.result.series.map(s=>s.title);
 assert.equal(titles.includes('HiddenDW'),false);
 assert.ok(res.result.series.some(s=>s.type==='candle'));
 const dyn=res.result.series.find(s=>s.title==='Dyn');
 assert.ok(dyn.data.some(p=>p.color==='#4CAF50'));
 const naOnly=res.result.series.find(s=>s.title==='NaOnly');
 assert.ok(naOnly.data.every(p=>p.color==='rgba(0,0,0,0)'));
 const box=res.result.drawings.find(d=>d.type==='box');
 assert.equal(box.color,'transparent');assert.equal(box.strokeOpacity,0);assert.equal(box.width,0);
 assert.equal(box.textStyle.vertical,'bottom');assert.equal(box.textStyle.fontFamily,'monospace');assert.equal(box.textStyle.size,10);
 const lbl=res.result.drawings.find(d=>d.type==='text'&&d.text==='UNI+');
 assert.equal(lbl.textStyle.placement,'label_left');assert.equal(lbl.labelBg,null);assert.equal(lbl.textStyle.fontFamily,'monospace');
 assert.ok(res.result.paints.some(p=>p.type==='quad'));
 assert.ok(res.result.paints.some(p=>p.type==='polyline'));
 assert.equal(res.result.tables[0].rows[0][0].text,'OK');
 assert.equal(res.result.tables[0].rows[0][0].bold,true);
 assert.equal(res.result.tables[0].rows[0][0].fontFamily,'monospace');
});

test('Pine v6 dynamic ternary na plot color renders transparent or breaks line on false bars',async()=>{
 const send=worker();
 const altBars=bars.map((b,i)=>i%2===0?b:{...b,close:b.open-1});
 await send({type:'init',code:'//@version=6\nindicator("DynNa", overlay=true)\nplot(close, "Dyn", color = close > open ? color.green : na)\nplot(close, "DynBr", color = close > open ? color.green : na, style = plot.style_linebr)'});
 const res=await send({type:'run',id:1,bars:altBars,context:{...context,markets:{'NQ1!':{'1m':altBars,metadata}}}});
 assert.equal(res.type,'result',res.error);
 const dyn=res.result.series.find(s=>s.title==='Dyn');
 assert.equal(dyn.data[0].color,'#4CAF50');
 assert.equal(dyn.data[1].color,'rgba(0,0,0,0)');
 const dynBr=res.result.series.find(s=>s.title==='DynBr');
 assert.equal(dynBr.data[0].color,'#4CAF50');
 assert.equal('value' in dynBr.data[1],false);
});

test('Pine cleared empty tables are omitted and box with border_color na skips strokeRect in DrawingModel',()=>{
 const PineCls=vm.runInNewContext(fs.readFileSync('frontend/js/pine_runtime.js','utf8')+';PineRuntime',{MarketData:require('../frontend/js/market_data.js')});
 const runtime=Object.create(PineCls.prototype);
 const converted=runtime.convert({indicator:{overlay:true},plots:{
  __tables__:{options:{style:'table'},data:[{value:[{id:1,rows:2,columns:2,position:'top_right',bgcolor:'',cells:[[{text:'',bgcolor:''},null],[null,null]]}]}]},
  __boxes__:{options:{style:'drawing_box'},data:[{value:[{id:2,left:0,top:105,right:2,bottom:95,border_color:null,border_width:1,bgcolor:'#66BB6A26',text:'BRK',text_size:'tiny',text_halign:'right',text_valign:'bottom',text_font_family:'monospace'}]}]}
 }},bars,{timeframeSeconds:60},new Set());
 assert.equal(converted.tables.length,0);
 const box=converted.drawings[0];
 const dm=vm.runInNewContext(fs.readFileSync('frontend/js/drawing_model.js','utf8')+';DrawingModel',{module:{exports:{}}});
 let stroked=0;const fills=[],texts=[];
 const ctx={save(){},restore(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillRect(...a){fills.push(a);},strokeRect(){stroked++;},fillText(t,x,y){texts.push({t,x,y,align:ctx.textAlign,base:ctx.textBaseline,font:ctx.font});}};
 const chart={bars,tfSeconds:60,currentTimeframe:'1m',container:{clientWidth:500,clientHeight:300},chart:{timeScale:()=>({logicalToCoordinate:i=>i*20})},series:{priceToCoordinate:p=>200-p}};
 dm.draw(ctx,chart,box);
 assert.equal(stroked,0);assert.equal(fills.length,1);assert.equal(texts[0].t,'BRK');assert.equal(texts[0].base,'bottom');assert.match(texts[0].font,/monospace/);
});
