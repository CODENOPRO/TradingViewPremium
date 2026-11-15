const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ChartContextMenu=require('../frontend/js/chart_context_menu.js');
const DrawingModel=require('../frontend/js/drawing_model.js');
const {ChartAppearance}=require('../frontend/js/chart_settings.js');
const TemplateMenu=require('../frontend/js/template_menu.js');
const chart={plotHeight:300,container:{clientWidth:700},metadata:{tickSize:.25},coordinateToTime:x=>60+x,coordinateToPrice:y=>100+y/100};
test('chart context point uses tick-rounded cursor price, never the latest quote',()=>{
  assert.deepEqual(ChartContextMenu.clickedPoint(chart,100,48),{time:160,price:100.5});
});
test('context menu does not offer a price from an indicator pane or price/time axes',()=>{
  assert.equal(ChartContextMenu.clickedPoint(chart,100,290),null);
  assert.equal(ChartContextMenu.clickedPoint(chart,690,100),null);
  assert.equal(ChartContextMenu.clickedPoint({...chart,coordinateToPrice:()=>null},100,100),null);
});
test('context menu order types follow reference price side and format tick decimals',()=>{
  assert.deepEqual(ChartContextMenu.orderKinds(28040,27890),{sellType:'limit',buyType:'stop'});
  assert.deepEqual(ChartContextMenu.orderKinds(27700,27890),{sellType:'stop',buyType:'limit'});
  assert.deepEqual(ChartContextMenu.orderKinds(27890,27890),{sellType:'limit',buyType:'limit'});
  assert.equal(ChartContextMenu.formatPrice(28040,{tickSize:.25},{}),'28,040.00');
  assert.equal(ChartContextMenu.formatPrice(42100,{tickSize:1},{}),'42,100');
});
test('context menu renders TV desktop menu layout, copy/paste, cursor lock, counts and submenus',()=>{
  const listeners={};
  const makeNode=(tag)=>{const n={tagName:tag.toUpperCase(),children:[],style:{},dataset:{},attributes:{},hidden:false,disabled:false,textContent:'',className:'',listeners:{},
    setAttribute(k,v){this.attributes[k]=String(v);},getAttribute(k){return this.attributes[k]??null;},
    append(...items){for(const x of items)this.appendChild(x);},appendChild(x){this.children.push(x);return x;},replaceChildren(...items){this.children=[];this.append(...items);},
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);},dispatchEvent(e){for(const fn of this.listeners[e.type]||[])fn(e);},
    remove(){},focus(){},contains(t){return t===this||this.children.some(c=>c.contains?.(t));},
    getBoundingClientRect(){return {left:10,top:10,right:260,bottom:320,width:250,height:310};},
    querySelectorAll(sel){const all=[];const walk=el=>{for(const c of el.children||[]){if(!sel||(sel.includes('menuitem')&&c.attributes?.role==='menuitem'))all.push(c);walk(c);}};walk(this);return all;},
    querySelector(sel){return this.querySelectorAll(sel)[0]||null;},closest(){return null;}};return n;};
  const fakeDoc={body:makeNode('body'),createElement:tag=>makeNode(tag),addEventListener:(t,fn)=>{(listeners[t]||=[]).push(fn);},querySelector:()=>null,getElementById:()=>null,activeElement:null};
  const ctx=vm.createContext({document:fakeDoc,window:{addEventListener:()=>{},innerWidth:1280,innerHeight:720},setTimeout,clearTimeout,CustomEvent:class{constructor(t,o){this.type=t;this.detail=o?.detail;}},DrawingModel,TemplateMenu,Workspace:{read:(_,d)=>d,write:()=>true},innerWidth:1280,innerHeight:720});
  vm.runInContext(fs.readFileSync('frontend/js/chart_context_menu.js','utf8')+';this.Menu=ChartContextMenu;',ctx);
  const targetChart={symbol:'NQ1!',plotHeight:300,tfSeconds:60,bars:[{time:60,close:27890},{time:120,close:27900}],drawings:[{id:'d1',type:'box',p1:{time:60,price:27800},p2:{time:120,price:27850}},{id:'d2',type:'line',p1:{time:60,price:27820},p2:{time:120,price:27860}},{id:'d3',type:'fib',p1:{time:60,price:27810},p2:{time:120,price:27870}}],runner:{entries:[{record:{id:'i1'}}],remove(){}},metadata:{tickSize:.25},appearance:{precision:'Default'},container:{clientWidth:700,addEventListener:()=>{},dispatchEvent:()=>{}},coordinateToTime:x=>60+x,coordinateToPrice:()=>28040,resetView(){}};
  const sync={options:{crosshair:true},charts:[targetChart]};
  let hitDrawing=null;
  const editor={find:()=>hitDrawing,toolbar:{querySelector:()=>null},settings:{templateMenuOptions:()=>({getItems:()=>[]})},select(){},open(){},clear(){},commit(){}};
  const drawing={editor,drawingsLocked:false,saveDrawings(){},setTool(){}};
  const menu=new ctx.Menu({charts:[targetChart],drawing,desktop:{open(){}},activate(){},openAlert(){},chartSettings:{templateMenuOptions:()=>({getItems:()=>[]})},paperPanel:{guard(){},render(){},paper:{place(){}}},sync});
  menu.open(targetChart,100,48,100,48);
  const labels=menu.root.querySelectorAll('button[role="menuitem"]').map(b=>b.children[1]?.textContent);
  assert.ok(labels.includes('Reset chart view'));
  assert.ok(labels.includes('Copy price 28,040.00'));
  assert.ok(labels.includes('Paste'));
  assert.ok(labels.includes('Sell 1 NQ1! @ 28,040.00 limit'));
  assert.ok(labels.includes('Buy 1 NQ1! @ 28,040.00 stop'));
  assert.ok(labels.includes('Add order on NQ1! at 28,040.00…'));
  assert.ok(labels.includes('Lock vertical cursor line by time'));
  assert.ok(labels.includes('Table view'));
  assert.ok(labels.includes('Object tree'));
  assert.ok(labels.includes('Chart template'));
  assert.ok(labels.includes('Remove 3 drawings'));
  assert.ok(labels.includes('Remove 1 indicator'));
  const pasteBtn=menu.root.children.find(c=>c.children?.[1]?.textContent==='Paste');
  assert.equal(pasteBtn.disabled,true);
  hitDrawing={drawing:targetChart.drawings[0],handle:'body'};
  menu.open(targetChart,100,48,100,48);
  const boxLabels=menu.root.querySelectorAll('button[role="menuitem"]').map(b=>b.children[1]?.textContent);
  for(const expected of ['Settings…','Template','Text…','Visual order','Clone','Copy','Lock','Hide','Remove'])assert.ok(boxLabels.includes(expected));
  hitDrawing={drawing:targetChart.drawings[2],handle:'body'};
  menu.open(targetChart,100,48,100,48);
  const fibLabels=menu.root.querySelectorAll('button[role="menuitem"]').map(b=>b.children[1]?.textContent);
  assert.equal(fibLabels.includes('Text…'),false);
  menu.copyDrawing(targetChart.drawings[0]);
  hitDrawing=null;
  menu.open(targetChart,100,48,100,48);
  assert.equal(menu.root.children.find(c=>c.children?.[1]?.textContent==='Paste').disabled,false);
  menu.toggleVerticalCursorLock();
  assert.equal(sync.options.crosshair,false);
});
test('TemplateMenu manages named chart and drawing templates cleanly',()=>{
  const store={};
  const Workspace={read:(k,d)=>k in store?JSON.parse(JSON.stringify(store[k])):d,write:(k,v)=>{store[k]=JSON.parse(JSON.stringify(v));return true;}};
  store[TemplateMenu.LEGACY_CHART_KEY]={...ChartAppearance.defaults(),bg:'#112233',session:'RTH'};
  const initial=TemplateMenu.listChartTemplates(Workspace,ChartAppearance,'NQ1!');
  assert.deepEqual(initial.slice(0,2).map(x=>x.name),['Default','Dark']);
  assert.ok(initial.some(x=>x.name==='Saved template'&&x.legacy));
  TemplateMenu.saveChartTemplate(Workspace,ChartAppearance,'Midnight',{...ChartAppearance.defaults(),bg:'#0b0e14',session:'RTH'});
  assert.equal(store[TemplateMenu.CHART_KEY].Midnight.session,undefined);
  assert.equal(store[TemplateMenu.CHART_KEY].Midnight.bg,'#0b0e14');
  assert.throws(()=>TemplateMenu.saveChartTemplate(Workspace,ChartAppearance,'   ',ChartAppearance.defaults()));
  assert.throws(()=>TemplateMenu.saveChartTemplate(Workspace,ChartAppearance,'__proto__',ChartAppearance.defaults()));
  TemplateMenu.deleteChartTemplate(Workspace,'Midnight',false);
  assert.equal(store[TemplateMenu.CHART_KEY].Midnight,undefined);

  const box=DrawingModel.normalize({id:'b1',type:'box',p1:{time:60,price:100},p2:{time:120,price:120},title:'OB',text:'FVG',fillColor:'#10b981',borderColor:'#059669',locked:true});
  TemplateMenu.saveDrawingTemplate(Workspace,'box','Green Zone',box);
  const savedBox=store[TemplateMenu.DRAWING_KEY].box['Green Zone'];
  assert.equal(savedBox.id,undefined);assert.equal(savedBox.p1,undefined);assert.equal(savedBox.title,undefined);assert.equal(savedBox.locked,undefined);
  const target=DrawingModel.normalize({id:'b2',type:'box',p1:{time:300,price:200},p2:{time:360,price:240},title:'Target',text:'Original'});
  const applied=TemplateMenu.applyDrawingStyle(DrawingModel,target,savedBox,false);
  assert.equal(applied.id,'b2');assert.deepEqual(applied.p1,{time:300,price:200});assert.equal(applied.title,'Target');assert.equal(applied.fillColor,'#10b981');assert.equal(applied.text,'FVG');
  const cleared=TemplateMenu.applyDrawingStyle(DrawingModel,{...applied,text:'Keep note'},DrawingModel.defaults('box'),true);
  assert.equal(cleared.fillColor,DrawingModel.defaults('box').fillColor);assert.equal(cleared.text,'Keep note');
  TemplateMenu.deleteDrawingTemplate(Workspace,'box','Green Zone');
  assert.equal(TemplateMenu.listDrawingTemplates(Workspace,'box').length,0);
});
