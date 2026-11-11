const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(initial={}){
  const saved=new Map(Object.entries(structuredClone(initial)));let canWrite=true;
  class Element{constructor(){this.children=[];this.dataset={};this.classList={toggle(){}};}appendChild(e){this.children.push(e);}append(...es){this.children.push(...es);}replaceChildren(){this.children=[];}setAttribute(){}}
  class Runner{constructor(chart){this.chart=chart;this.view={};this.defaults={};}load(code,settings,view){this.code=code;this.settings=settings;this.view=view;this.ready=true;this.loads=(this.loads||0)+1;this.chart.clearCustomSeries();}stop(){this.ready=false;}schedule(){this.scheduled=true;}applyView(){if(this.lastResult)this.chart.applyIndicatorResult(this.view.hidden?{series:[],drawings:[]}:this.lastResult);}emit(result){this.lastResult=result;this.applyView();}}
  class Stack{constructor(){this.hosts=new Map();}set(panes){this.panes=panes;}remove(){}}
  const ctx=vm.createContext({structuredClone,document:{createElement:()=>new Element()},IndicatorRunner:Runner,IndicatorPaneStack:Stack,Workspace:{read:(k,f)=>saved.has(k)?structuredClone(saved.get(k)):f,write:(k,v)=>{if(!canWrite)return false;saved.set(k,structuredClone(v));return true;}}});
  vm.runInContext(fs.readFileSync('frontend/js/indicator_collection.js','utf8')+';this.Collection=IndicatorCollection;',ctx);
  const chart=id=>({id,container:new Element(),applyIndicatorResult(r){this.result=r;}});
  return {saved,Collection:ctx.Collection,chart,failWrites:()=>canWrite=false};
}
test('single indicator migrates once, settings survive restart and removing last never resurrects legacy',()=>{
 const h=harness({'indicator_a':{name:'User script',code:'user code',settings:{length:7},view:{hidden:true}}}),c=h.chart('a');
 const first=new h.Collection(c,()=>({}),()=>{});assert.equal(first.entries.length,1);assert.equal(first.settings.length,7);assert.equal(first.view.hidden,true);
 assert.equal(h.saved.get('indicator_a').code,'user code');assert.ok(first.remove());
 const restarted=new h.Collection(h.chart('a'),()=>({}),()=>{});assert.equal(restarted.entries.length,0);
});
test('instances retain independent inputs, hidden state and results through a full reconstruction',()=>{
 const h=harness(),c=h.chart('a'),group=new h.Collection(c,()=>({}),()=>{});
 const one=group.add({name:'one',code:'one',settings:{n:2},view:{}}),two=group.add({name:'two',code:'two',settings:{n:4},view:{}});
 group.entries[0].runner.emit({series:[],drawings:[{text:'one'}],pane:{min:0,max:1,drawings:[]}});
 group.entries[1].runner.emit({series:[],drawings:[{text:'two'}],pane:{min:100,max:200,drawings:[]}});
 assert.equal(c.result.drawings.length,2);assert.equal(group.stack.panes.length,2);assert.notEqual(group.stack.panes[0].id,group.stack.panes[1].id);
 group.toggle(one.id);assert.equal(c.result.drawings.length,1);assert.equal(c.result.drawings[0].text,'two');
 const restored=new h.Collection(h.chart('a'),()=>({}),()=>{});assert.equal(restored.entries.length,2);assert.equal(restored.entries[0].record.view.hidden,true);assert.equal(restored.entries[1].record.settings.n,4);
 restored.select(two.id);assert.equal(restored.name,'two');assert.equal(restored.pause(),true);
 const again=new h.Collection(h.chart('a'),()=>({}),()=>{});assert.equal(again.entries[1].runner.ready,undefined);assert.equal(again.entries[1].record.enabled,false);
 assert.equal(new h.Collection(h.chart('b'),()=>({}),()=>{}).entries.length,0);
});
test('failed persistence leaves displayed indicators and source settings untouched',()=>{
 const h=harness(),group=new h.Collection(h.chart('a'),()=>({}),()=>{});const record=group.add({name:'one',code:'code',settings:{n:2},view:{}});h.failWrites();
 assert.equal(group.remove(record.id),false);assert.equal(group.update(record.id,{settings:{n:99}}),false);assert.equal(group.add({code:'other'}),false);
 assert.equal(group.entries.length,1);assert.equal(group.entries[0].record.settings.n,2);assert.equal(group.entries[0].runner.ready,true);
});
