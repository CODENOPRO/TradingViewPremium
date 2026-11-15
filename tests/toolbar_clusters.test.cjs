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
