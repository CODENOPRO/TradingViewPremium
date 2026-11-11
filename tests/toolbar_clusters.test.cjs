const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function create(stored=new Map(),canWrite=true){
 const nodes=new Map(),styles=new Map();let hotkey,opened=0;
 const element=key=>{if(!nodes.has(key))nodes.set(key,{events:{},addEventListener(type,fn){this.events[type]=fn;}});return nodes.get(key);};
 const context=vm.createContext({document:{getElementById:element,querySelector:element,documentElement:{style:{setProperty:(k,v)=>styles.set(k,v)}}},window:{addEventListener:(_type,fn)=>hotkey=fn},Workspace:{read:(k,f)=>stored.has(k)?structuredClone(stored.get(k)):f,write:(k,v)=>{if(!canWrite)return false;stored.set(k,structuredClone(v));return true;}}});
 vm.runInContext(fs.readFileSync('frontend/js/toolbar_clusters.js','utf8')+';this.Clusters=ToolbarClusters;',context);
 const controller=new context.Clusters(()=>opened++);return {controller,element,styles,hotkey,get opened(){return opened;},stored};
}
test('floating cluster visibility and background transparency persist; shortcut recovers Settings with all clusters hidden',()=>{
 const first=create();
 for(const key of Object.keys(first.controller.elements))first.element('set-show-'+key).events.change({target:{checked:false}});
 first.element('set-toolbar-opacity').events.input({target:{value:'65'}});assert.equal(first.styles.get('--toolbar-opacity'),'0.35');
 const reopened=create(first.stored);assert.equal(reopened.styles.get('--toolbar-opacity'),'0.35');for(const e of Object.values(reopened.controller.elements))assert.equal(e.hidden,true);
 let prevented=false;reopened.hotkey({ctrlKey:true,code:'Comma',preventDefault(){prevented=true;},stopPropagation(){}});assert.equal(reopened.opened,1);assert.equal(prevented,true);
 reopened.element('set-show-topRight').events.change({target:{checked:true}});assert.equal(reopened.controller.elements.topRight.hidden,false);assert.equal(reopened.controller.elements.topLeft.hidden,true);
});
test('failed saves restore controls to the last persisted value instead of reporting unsaved preferences as saved',()=>{
 const initial=new Map([['terminal_cluster_visibility_v2',{topLeft:false}],['terminal_toolbar_opacity_v1',40]]),h=create(initial,false);
 h.element('set-show-topLeft').events.change({target:{checked:true}});assert.equal(h.controller.elements.topLeft.hidden,true);assert.equal(h.element('set-show-topLeft').checked,false);
 h.element('set-toolbar-opacity').events.input({target:{value:'100'}});assert.equal(h.element('set-toolbar-opacity').value,60);assert.equal(h.styles.get('--toolbar-opacity'),'0.4');
});
