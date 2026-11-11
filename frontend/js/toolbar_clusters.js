/* Floating clusters imported from the user's TradingTerminal UI; preferences are local. */
class ToolbarClusters {
  constructor(openSettings,onLayout){
    this.onLayout=onLayout;
    const $=id=>document.getElementById(id),old=Workspace.read('terminal_toolbar_visibility_v1',{})||{};
    const saved=Workspace.read('terminal_cluster_visibility_v2',null)||{topLeft:old.topbar!==false,topRight:old.topbar!==false,sidebar:old.sidebar!==false,bottomLeft:old.bottombar!==false,bottomRight:old.bottombar!==false};
    this.elements={topLeft:document.querySelector('.topbar-left'),topRight:document.querySelector('.topbar-right'),sidebar:$('left-sidebar'),bottomLeft:document.querySelector('.bottom-ranges'),bottomRight:document.querySelector('.bottom-meta')};
    this.visibility=Object.fromEntries(Object.keys(this.elements).map(key=>[key,saved[key]!==false]));
    const opacity=Workspace.read('terminal_toolbar_opacity_v1',100);this.opacity=Number.isFinite(opacity)?Math.max(0,Math.min(100,opacity)):100;
    for(const key of Object.keys(this.elements))$(`set-show-${key}`).addEventListener('change',event=>{
      const next={...this.visibility,[key]:event.target.checked};if(Workspace.write('terminal_cluster_visibility_v2',next))this.visibility=next;this.apply();
    });
    $('set-toolbar-opacity').addEventListener('input',event=>{
      const value=Number(event.target.value);if(Number.isFinite(value)){const next=100-Math.max(0,Math.min(100,value));if(Workspace.write('terminal_toolbar_opacity_v1',next))this.opacity=next;}this.apply();
    });
    // This recovery shortcut remains available even when every cluster is hidden.
    window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.code==='Comma'){event.preventDefault();event.stopPropagation();openSettings();}},true);
    this.apply();
  }
  apply(){
    for(const [key,element]of Object.entries(this.elements)){element.hidden=!this.visibility[key];document.getElementById(`set-show-${key}`).checked=this.visibility[key];}
    document.documentElement.style.setProperty('--toolbar-opacity',String(this.opacity/100));
    document.getElementById('set-toolbar-opacity').value=100-this.opacity;
    document.getElementById('toolbar-opacity-value').value=`${100-this.opacity}%`;
    this.onLayout?.();
  }
}
if(typeof module!=='undefined')module.exports=ToolbarClusters;
