const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function create(stored=new Map(),canWrite=true){
 const nodes=new Map(),styles=new Map();let hotkey,opened=0;
 const element=key=>{if(!nodes.has(key))nodes.set(key,{events:{},addEventListener(type,fn){this.events[type]=fn;}});return nodes.get(key);};
 const context=vm.createContext({document:{getElementById:element,querySelector:element,documentElement:{style:{setProperty:(k,v)=>styles.set(k,v)}}},window:{addEventListener:(_type,fn)=>hotkey=fn},Workspace:{read:(k,f)=>stored.has(k)?structuredClone(stored.get(k)):f,write:(k,v)=>{if(!canWrite)return false;stored.set(k,structuredClone(v));return true;}}});
 vm.runInContext(fs.readFileSync('frontend/js/toolbar_clusters.js','utf8')+';this.Clusters=ToolbarClusters;',context);
 const controller=new context.Clusters(()=>opened++);return {controller,element,styles,hotkey,get opened(){return opened;},stored};
}
test('pinned chrome ignores legacy hidden/transparent settings without overwriting them',()=>{
 const initial=new Map([['terminal_cluster_visibility_v2',{topLeft:false,topRight:false,sidebar:false}],['terminal_toolbar_opacity_v1',0]]),snapshot=structuredClone(initial),h=create(initial);
 for(const [key,e]of Object.entries(h.controller.elements)){assert.equal(e.hidden,false);assert.equal(h.element('set-show-'+key).checked,true);assert.equal(h.element('set-show-'+key).disabled,true);}
 assert.equal(h.styles.get('--toolbar-opacity'),'1');assert.equal(h.element('set-toolbar-opacity').disabled,true);assert.equal(h.element('set-toolbar-opacity').value,0);assert.deepEqual(initial,snapshot);
});
test('Settings shortcut remains available when storage cannot be written',()=>{
 const h=create(new Map(),false);let prevented=false;
 h.hotkey({ctrlKey:true,code:'Comma',preventDefault(){prevented=true;},stopPropagation(){}});
 assert.equal(h.opened,1);assert.equal(prevented,true);assert.equal(h.controller.elements.sidebar.hidden,false);
});
test('toolbar scale clamps, persists, updates --toolbar-scale live and resets cleanly',()=>{
 const stored=new Map(),styles=new Map();let fitted=0,badged=0;
 const mk=tag=>({tag,children:[],attrs:{},events:{},classList:{toggle(){}},style:{},append(...ns){for(const n of ns){if(n&&typeof n==='object')n.parentElement=this;this.children.push(n);}},appendChild(n){if(n&&typeof n==='object')n.parentElement=this;this.children.push(n);return n;},prepend(n){if(n&&typeof n==='object')n.parentElement=this;this.children.unshift(n);},remove(){},querySelector(){return null;},querySelectorAll(){return [];},setAttribute(k,v){this.attrs[k]=v;},addEventListener(t,f){this.events[t]=f;}});
 const help=mk('p');
 const old=mk('details');old.children.push(help);
 const modal=mk('div');modal.querySelector=sel=>sel==='.toolbar-settings'?old:null;
 const ctx=vm.createContext({
  TerminalFeatures:function(){},
  Workspace:{read:(k,f)=>stored.has(k)?stored.get(k):f,write:(k,v)=>{stored.set(k,v);return true;}},
  document:{createElement:tag=>{const e=mk(tag);e.querySelector=sel=>sel==='.editor-help'?help:null;return e;},body:mk('body'),documentElement:{style:{setProperty:(k,v)=>styles.set(k,v)}},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}}
 });
 vm.runInContext(fs.readFileSync('frontend/js/terminal_polish.js','utf8'),ctx);
 assert.equal(ctx.TerminalFeatures.clampToolbarScale(undefined),85);
 assert.equal(ctx.TerminalFeatures.clampToolbarScale(42),60);
 assert.equal(ctx.TerminalFeatures.clampToolbarScale(180),125);
 assert.equal(ctx.TerminalFeatures.clampToolbarScale(78),80);
 const chartSettings={modal,dialog:mk('div')};
 ctx.TerminalFeatures.prototype.installPolish.call({chartSettings,desktop:{fitToolbar(){fitted++;}},charts:[{positionSymbolBadge(){badged++;}}]});
 assert.equal(styles.get('--toolbar-scale'),'0.85');
 const scaleRow=chartSettings.toolbarControls.children[0];
 const scaleWrap=scaleRow.children[1],scaleInput=scaleWrap.children[0],scaleOut=scaleWrap.children[1];
 assert.equal(scaleInput.id,'set-toolbar-scale');
 assert.equal(scaleOut.textContent,'85%');
 scaleInput.value='72';scaleInput.oninput();
 assert.equal(styles.get('--toolbar-scale'),'0.70');
 assert.equal(stored.get('terminal_toolbar_scale_v1'),70);
 assert.equal(scaleOut.textContent,'70%');
 assert.ok(fitted>=2&&badged>=2);
 chartSettings.onToolbarReset();
 assert.equal(styles.get('--toolbar-scale'),'0.85');
 assert.equal(stored.get('terminal_toolbar_scale_v1'),85);
});
