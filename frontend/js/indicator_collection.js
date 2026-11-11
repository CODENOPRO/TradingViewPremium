/* Saved sources and chart instances are separate: removing an instance keeps its source. */
class IndicatorCollection {
  constructor(chart,getContext,onStatus) {
    this.chart=chart;this.getContext=getContext;this.onStatus=onStatus;this.entries=[];
    const stored=Workspace.read('indicators_'+chart.id,null);
    const legacy=Workspace.read('indicator_'+chart.id,null);
    const records=Array.isArray(stored)?stored:legacy?.code?[{...legacy,id:'legacy',enabled:true}]:[];
    for(const record of records)if(record&&typeof record.code==='string'&&record.code.trim())this.mount({...record,id:record.id||this.id()});
    this.selectedId=this.entries[0]?.record.id;
    if(!Array.isArray(stored)&&this.entries.length){
      for(const prefix of ['indicator_pane_','indicator_native_pane_']){const old=Workspace.read(prefix+chart.id,null);if(old&&Workspace.read(prefix+chart.id+':legacy',null)===null)Workspace.write(prefix+chart.id+':legacy',old);}
      this.persist();
    }
    this.stack=new IndicatorPaneStack(chart);chart.indicatorStack=this.stack;
    this.stack.onSettings=id=>{this.select(id);chart.onIndicatorSettings?.();};
    for(const entry of this.entries)this.start(entry);
  }
  id(){return globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
  get selected(){return this.entries.find(e=>e.record.id===this.selectedId)||this.entries[0];}
  get record(){return this.selected?.record;}
  get ready(){return !!this.selected?.runner.ready;}
  get defaults(){return this.selected?.runner.defaults||{};}
  get inputs(){return this.selected?.runner.inputs||[];}
  get settings(){return this.selected?.runner.settings||{};}
  get view(){return this.selected?.runner.view||this.record?.view||{};}
  get name(){return this.selected?.runner.name||this.record?.name||'Indicator';}
  get lastResult(){return this.combined;}
  select(id){if(this.entries.some(e=>e.record.id===id))this.selectedId=id;}
  persist(records=this.entries.map(e=>e.record)){return Workspace.write('indicators_'+this.chart.id,records);}
  mount(record){
    const entry={record,result:null};
    const proxy=new Proxy(this.chart,{get:(target,key)=>{
      if(key==='clearCustomSeries')return ()=>{entry.result=null;this.render();};
      if(key==='applyIndicatorResult')return result=>{entry.result=result;this.render();};
      if(key==='setIndicatorLegend')return name=>{entry.name=name;this.renderLegends();};
      return Reflect.get(target,key,target);
    }});
    entry.runner=new IndicatorRunner(proxy,this.getContext,message=>{entry.status=message;this.onStatus(`${entry.name||record.name}: ${message}`);this.renderLegends();});
    this.entries.push(entry);return entry;
  }
  start(entry){if(entry.record.enabled!==false)entry.runner.load(entry.record.code,entry.record.settings||{},entry.record.view||{});}
  add(record){
    const next={...structuredClone(record),id:this.id(),enabled:true};
    if(!this.persist([...this.entries.map(e=>e.record),next]))return false;
    const entry=this.mount(next);this.selectedId=next.id;this.start(entry);this.renderLegends();return next;
  }
  update(id,changes){
    const entry=this.entries.find(e=>e.record.id===id);if(!entry)return false;
    const next={...entry.record,...structuredClone(changes),id};
    if(!this.persist(this.entries.map(e=>e===entry?next:e.record)))return false;
    const recalculate=next.code!==entry.record.code||JSON.stringify(next.settings)!==JSON.stringify(entry.record.settings)||next.enabled!==entry.record.enabled;
    entry.record=next;
    if(recalculate){entry.runner.stop();entry.result=null;this.start(entry);}
    else {entry.runner.view=next.view||{};entry.runner.applyView();}
    this.render();return true;
  }
  load(code,settings,view){return this.record?this.update(this.record.id,{code,settings,view,enabled:true}):this.add({name:'Custom indicator',code,settings,view});}
  remove(id=this.record?.id){
    const entry=this.entries.find(e=>e.record.id===id);if(!entry)return false;
    if(!this.persist(this.entries.filter(e=>e!==entry).map(e=>e.record)))return false;
    entry.runner.stop();this.entries=this.entries.filter(e=>e!==entry);
    if(this.selectedId===id)this.selectedId=this.entries[0]?.record.id;
    this.render();return true;
  }
  toggle(id=this.record?.id){const entry=this.entries.find(e=>e.record.id===id);return entry&&this.update(id,{view:{...entry.record.view,hidden:!entry.record.view?.hidden}});}
  pause(id=this.record?.id){return id?this.update(id,{enabled:false}):false;}
  schedule(){for(const e of this.entries)if(e.record.enabled!==false)e.runner.schedule();}
  stop(){for(const e of this.entries)e.runner.stop();}
  restart(){this.stop();for(const e of this.entries){e.result=null;this.start(e);}this.render();}
  render(){
    if(!this.stack)return;
    const combined={series:[],drawings:[],tables:[],candleColors:[],paints:[]},panes=[];
    for(const e of this.entries){if(!e.result)continue;for(const key of Object.keys(combined))combined[key].push(...(key==='tables'?(e.result.tables||[]).map(t=>({...t,paneId:e.record.id})):(e.result[key]||[])));if(e.result.pane)panes.push({id:e.record.id,descriptor:e.result.pane});}
    this.combined=combined;
    this.stack.set(panes);this.chart.applyIndicatorResult(combined);this.renderLegends();
  }
  renderLegends(){
    if(!this.stack)return;
    const signature=JSON.stringify(this.entries.map(e=>[e.record.id,e.name,e.record.name,e.record.view?.hidden,e.record.enabled]));
    if(this.legendSignature===signature){for(const row of this.legends?.children||[])row.title=this.entries.find(e=>e.record.id===row.dataset.indicatorId)?.status||'';return;}
    this.legendSignature=signature;
    if(!this.legends){this.legends=document.createElement('div');this.legends.className='indicator-legends';this.chart.container.appendChild(this.legends);}
    this.legends.replaceChildren();
    for(const e of this.entries){
      const row=document.createElement('div');row.className='indicator-legend';row.dataset.indicatorId=e.record.id;row.classList.toggle('indicator-muted',!!e.record.view?.hidden);row.title=e.status||'';
      const button=(text,label,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.onclick=event=>{event.stopPropagation();this.select(e.record.id);action();};return b;};
      const title=button(e.name||e.record.name,'Settings: '+(e.name||e.record.name),()=>this.chart.onIndicatorSettings?.());title.className='indicator-title';row.appendChild(title);
      row.append(button(e.record.view?.hidden?'◌':'◉','Hide / show '+e.record.name,()=>this.toggle(e.record.id)),button('⚙','Settings '+e.record.name,()=>this.chart.onIndicatorSettings?.()),button('‹/›','Edit source '+e.record.name,()=>this.chart.onIndicatorEdit?.(e.record.id)),button('×','Remove '+e.record.name,()=>this.remove(e.record.id)));
      if(e.record.enabled===false)row.append(button('▶','Resume '+e.record.name,()=>this.update(e.record.id,{enabled:true})));
      this.legends.appendChild(row);
    }
  }
}
if(typeof module!=='undefined')module.exports=IndicatorCollection;
