/* Pinned terminal chrome; legacy floating preferences remain available for recovery. */
class ToolbarClusters {
  constructor(openSettings,onLayout){
    this.onLayout=onLayout;
    const $=id=>document.getElementById(id);
    const candidates={topLeft:document.querySelector('.topbar-left'),topRight:document.querySelector('.topbar-right'),sidebar:$('left-sidebar'),bottomLeft:document.querySelector('.bottom-ranges'),bottomRight:document.querySelector('.bottom-meta')};
    this.elements=Object.fromEntries(Object.entries(candidates).filter(([,element])=>element));
    for(const key of ['bottomLeft','bottomRight'])if(!this.elements[key])$(`set-show-${key}`)?.closest('.setting-row')?.setAttribute('hidden','');
    this.visibility=Object.fromEntries(Object.keys(this.elements).map(key=>[key,true]));
    this.opacity=100;
    for(const key of Object.keys(this.elements)){const control=$(`set-show-${key}`);if(control){control.disabled=true;control.title='Pinned to the screen';}}
    $('set-toolbar-opacity').disabled=true;
    // Pinned chrome stays visible and opaque; leave legacy saved preferences untouched.
    window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.code==='Comma'){event.preventDefault();event.stopPropagation();openSettings();}},true);
    this.apply();
  }
  apply(){
    for(const [key,element]of Object.entries(this.elements)){element.hidden=!this.visibility[key];const control=document.getElementById(`set-show-${key}`);if(control)control.checked=this.visibility[key];}
    document.documentElement.style.setProperty('--toolbar-opacity',String(this.opacity/100));
    document.getElementById('set-toolbar-opacity').value=100-this.opacity;
    document.getElementById('toolbar-opacity-value').value=`${100-this.opacity}%`;
    this.onLayout?.();
  }
}
if(typeof module!=='undefined')module.exports=ToolbarClusters;
