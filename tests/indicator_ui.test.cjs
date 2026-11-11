const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const slug of ['qs-stacks-plus','qt-plus'])test(slug+' settings metadata matches actual defaults and declared constraints',()=>{
 const plugin=require('../frontend/indicators/'+slug+'.js'),inputs=JSON.parse(fs.readFileSync('frontend/indicators/'+slug+'.inputs.json','utf8'));
 assert.equal(inputs.length,Object.keys(plugin.defaults).length);const keys=new Set();
 for(const f of inputs){assert.ok(!keys.has(f.key));keys.add(f.key);assert.ok(Object.hasOwn(plugin.defaults,f.key));const v=plugin.defaults[f.key];
 if(['int','float'].includes(f.type)){assert.ok(Number.isFinite(v));if(f.min!==undefined)assert.ok(v>=f.min);if(f.max!==undefined)assert.ok(v<=f.max);}
 if(f.options&&!f.disabled)assert.ok(f.options.includes(v),f.key+' default missing from options');
 }
});
test('host visibility/styles filter the display without altering calculations or original results',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync('frontend/js/indicator_runner.js','utf8')+';this.Runner=IndicatorRunner',c);
 let applied;const runner=Object.create(c.Runner.prototype);runner.chart={currentTimeframe:'1m',applyIndicatorResult:r=>applied=r};
 const original={series:[],drawings:[{type:'text'}],pane:{min:0,max:100,drawings:[]},tables:[{pane:true},{title:'Main'}],candleColors:[{time:60,color:'#112233'}]};runner.lastResult=original;
 runner.view={pane:false,candleColors:false};runner.applyView();assert.equal(applied.pane,null);assert.equal(applied.tables.length,1);assert.equal(applied.drawings.length,1);assert.equal(applied.candleColors.length,0);assert.ok(original.pane);assert.equal(original.tables.length,2);
 runner.view={visibility:{'1m':false}};runner.applyView();assert.equal(applied.drawings.length,0);assert.equal(applied.tables.length,0);assert.equal(applied.pane,null);
 runner.view={hidden:true};runner.applyView();assert.equal(applied.drawings.length,0);assert.equal(applied.pane,null);assert.equal(applied.tables.length,0);
 runner.view={hidden:false};runner.applyView();assert.equal(applied.pane,original.pane);assert.equal(applied.drawings,original.drawings);assert.equal(runner.lastResult,original);
});
test('cycle separator/plot/axis pointer handlers resize, pan, zoom, persist and reset independently',()=>{
 class Element {constructor(){this.style={};this.children=[];this.events={};this.attrs={};}setAttribute(k,v){this.attrs[k]=v;}appendChild(x){this.children.push(x);}dispatchEvent(){}setPointerCapture(){}addEventListener(k,v){this.events[k]=v;}}
 const stored=new Map(),c=vm.createContext({MarketData:{durations:{}},Intl,CustomEvent,document:{createElement:()=>new Element()},Workspace:{read:(k,f)=>stored.has(k)?structuredClone(stored.get(k)):f,write:(k,v)=>stored.set(k,structuredClone(v))}});
 vm.runInContext(fs.readFileSync('frontend/js/chart_engine.js','utf8')+';this.Engine=ChartEngine',c);
 let range={from:0,to:99};const scale={getVisibleLogicalRange:()=>range,setVisibleLogicalRange:r=>range=r};
 const make=()=>{const e=Object.create(c.Engine.prototype),container=new Element();container.clientHeight=400;container.clientWidth=800;Object.assign(e,{id:'test',container,paneCanvas:new Element(),paneHeight:120,indicatorPane:{title:'Cycle',min:0,max:100},chart:{timeScale:()=>scale},resize(){this.paneHeight=this.container.clientHeight*this.paneView.ratio;},renderIndicatorPane(){}});e.setupIndicatorPane();return e;};
 const event=v=>({button:0,pointerId:1,preventDefault(){},stopPropagation(){},...v});const e=make();
 e.paneSeparator.onpointerdown(event({clientY:280}));e.paneSeparator.onpointermove(event({clientY:200}));e.paneSeparator.onpointerup();assert.equal(e.paneView.ratio,.5);
 e.paneCanvas.onpointerdown(event({clientX:100,clientY:250,offsetX:100}));e.paneCanvas.onpointermove(event({clientX:160,clientY:270}));e.paneCanvas.onpointerup();assert.ok(range.from<0);assert.ok(e.paneView.offset>0);
 e.paneCanvas.onpointerdown(event({clientX:770,clientY:250,offsetX:770}));e.paneCanvas.onpointermove(event({clientX:770,clientY:220}));e.paneCanvas.onpointerup();assert.ok(e.paneView.scale>1);
 const restored=make();assert.equal(restored.paneView.ratio,.5);assert.equal(restored.paneView.offset,e.paneView.offset);
 const prior=range.to-range.from;e.paneCanvas.events.wheel(event({offsetX:200,deltaY:-100}));assert.ok(range.to-range.from<prior);
 const reset=e.paneHeader.children.find(b=>b.attrs['aria-label']==='Reset cycle scale');reset.onclick(event({}));assert.equal(e.paneView.scale,1);assert.equal(e.paneView.offset,0);
});
