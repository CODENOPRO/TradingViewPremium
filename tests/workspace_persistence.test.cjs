const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('manual line/box retain exact anchors, settings, hidden/locked state after reopening and symbol changes',()=>{
 const storage=new Map(),context=vm.createContext({Workspace:{read:(k,f)=>storage.has(k)?JSON.parse(storage.get(k)):f,write:(k,v)=>{storage.set(k,JSON.stringify(v));return true;}}});
 vm.runInContext(fs.readFileSync('frontend/js/drawing_tools.js','utf8')+';this.Manager=DrawingManager;',context);
 const manager=()=>Object.assign(Object.create(context.Manager.prototype),{undoStacks:new Map(),redoStacks:new Map()});
 const drawings=[{id:'user-line',type:'line',p1:{time:1700000000,price:28123.75},p2:{time:1700003600,price:28234.25},locked:true,text:'Saved line',color:'#aabbcc',lineStyle:'dashed'},
 {id:'user-box',type:'box',p1:{time:1700000120,price:28100},p2:{time:1700002000,price:28200},hidden:true,middleLine:{enabled:true,color:'#abcdef',width:2,style:'dotted'},text:'Saved box',textStyle:{size:14,horizontal:'right'},visibility:{minutes:{enabled:true,min:5,max:59}}}];
 const c={id:'box-1',symbol:'NQ1!',drawings:[...structuredClone(drawings),{isTemp:true,p1:{time:1,price:1}}],renderDrawings(){}};manager().saveDrawings(c);
 const reopened={id:'box-1',symbol:'NQ1!',renderDrawings(){}};manager().loadDrawings(reopened);assert.equal(JSON.stringify(reopened.drawings),JSON.stringify(drawings));
 reopened.symbol='ES1!';manager().loadDrawings(reopened);assert.equal(reopened.drawings.length,0);
 reopened.symbol='NQ1!';manager().loadDrawings(reopened);assert.equal(JSON.stringify(reopened.drawings),JSON.stringify(drawings));
});
test('multiple indicator panes reserve distinct regions and retain separate scale and collapse state',()=>{
 const context=vm.createContext({});vm.runInContext(fs.readFileSync('frontend/js/indicator_pane_stack.js','utf8')+';this.Stack=IndicatorPaneStack;',context);
 let mainHeight;const parent={container:{dataset:{},style:{setProperty(){}}},chart:{applyOptions:o=>mainHeight=o.height},resizeOverlay(){}};
 const stack=new context.Stack(parent),pane=(ratio,scale,offset,collapsed=false)=>({paneView:{ratio,scale,offset,collapsed},paneCanvas:{style:{}},paneHeader:{style:{}},paneSeparator:{style:{}},renderIndicatorPane(){this.rendered={...this.paneView};}});
 const first=pane(.2,2,9),second=pane(.3,.5,-4);stack.hosts.set('first',first);stack.hosts.set('second',second);stack.resize({height:400,width:800});
 assert.equal(mainHeight,200);assert.equal(first.paneCanvas.style.bottom,'120px');assert.equal(second.paneCanvas.style.bottom,'0px');assert.equal(first.rendered.offset,9);assert.equal(second.rendered.scale,.5);
 second.paneView.collapsed=true;stack.resize({height:400,width:800});assert.equal(mainHeight,296);assert.equal(first.paneCanvas.style.bottom,'24px');assert.equal(first.paneView.scale,2);
 for(const host of stack.hosts.values())for(const key of ['paneCanvas','paneHeader','paneSeparator'])host[key].remove=()=>{};
 parent.resize=()=>stack.resize({height:400,width:800});stack.set([]);assert.equal(mainHeight,400);assert.equal(parent.paneHeight,0);
});
