class IndicatorLibrary {
  constructor({getChart,openSettings,onChange}) {
    Object.assign(this,{getChart,openSettings,onChange});
    this.modal=document.getElementById('indicator-modal');this.body=this.modal.querySelector('.script-body');
    this.sources=Workspace.read('indicator_library_v1',[]);if(!Array.isArray(this.sources))this.sources=[];
    this.panel=document.createElement('div');this.panel.className='indicator-browser';
    this.panel.innerHTML='<input class="indicator-search search-input" aria-label="Search scripts" placeholder="Search"><div class="indicator-browser-columns"><nav aria-label="Indicator categories"><button data-section="favorites">☆ Favorites</button><button data-section="scripts">‹/› My scripts</button><button data-section="chart">▤ On chart</button><button data-section="editor">＋ New script</button><button data-section="archived">Archived scripts</button></nav><div class="indicator-script-list"></div></div>';
    this.body.before(this.panel);this.list=this.panel.querySelector('.indicator-script-list');this.search=this.panel.querySelector('.indicator-search');this.search.oninput=()=>this.renderList();
    for(const b of this.panel.querySelectorAll('[data-section]'))b.onclick=()=>b.dataset.section==='editor'?this.edit():this.showSection(b.dataset.section);
    const back=document.createElement('button');back.type='button';back.className='btn-secondary indicator-back';back.textContent='‹ My scripts';back.onclick=()=>this.showSection('scripts');this.body.prepend(back);
    this.footer=this.modal.querySelector('.modal-footer');this.saved=document.createElement('span');this.saved.className='indicator-save-state';this.footer.prepend(this.saved);
    const save=document.createElement('button');save.type='button';save.className='btn-secondary';save.textContent='Save script';save.onclick=()=>this.save(false);document.getElementById('apply-indicator').before(save);
    for(const id of ['indicator-code','indicator-name','indicator-settings'])document.getElementById(id).addEventListener('input',()=>{this.clean=false;clearTimeout(this.timer);this.timer=setTimeout(()=>this.saveDraft(),250);this.saved.textContent='Draft…';});
    this.modal.addEventListener('close',()=>this.saveDraft());
    window.addEventListener('pagehide',()=>{if(this.section==='editor')this.saveDraft();});
    document.getElementById('indicator-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;if(file.size>2*1024*1024){window.showToast?.('File vượt 2 MB','alert');return;}document.getElementById('indicator-code').value=await file.text();document.getElementById('indicator-name').value=file.name.replace(/\.[^.]+$/,'');event.target.value='';this.clean=false;this.saveDraft();});
    document.getElementById('apply-indicator').onclick=()=>this.save(true);
    document.getElementById('remove-indicator').onclick=()=>{if(this.instanceId&&this.chart.runner.remove(this.instanceId))this.showSection('chart');};
    document.getElementById('stop-indicator-run').onclick=()=>{if(this.instanceId&&this.chart.runner.pause(this.instanceId)){this.saved.textContent='Stopped · saved';this.onChange?.();}};
  }
  migrate(charts){
    let changed=false;
    for(const chart of charts)for(const e of chart.runner.entries)if(!this.sources.some(s=>s.code===e.record.code)){this.sources.push({id:chart.runner.id(),name:e.record.name,code:e.record.code,settings:e.record.settings||{},favorite:false});changed=true;}
    if(changed)Workspace.write('indicator_library_v1',this.sources);
  }
  open(chart=this.getChart(),instanceId){
    this.chart=chart;this.search.value='';this.modal.classList.add('show');
    if(instanceId)this.edit(chart.runner.entries.find(e=>e.record.id===instanceId)?.record,instanceId);
    else this.showSection('scripts');
  }
  showSection(section){
    if(this.section==='editor')this.saveDraft();this.section=section;this.body.hidden=true;this.footer.hidden=true;this.panel.hidden=false;
    for(const b of this.panel.querySelectorAll('[data-section]'))b.classList.toggle('active',b.dataset.section===section);
    this.renderList();this.search.focus();
  }
  renderList(){
    this.list.replaceChildren();const query=this.search.value.trim().toLowerCase();
    const records=this.section==='chart'?this.chart.runner.entries.map(e=>({...e.record,name:e.name||e.record.name})):this.sources.filter(s=>this.section==='archived'?s.archived:!s.archived&&(this.section!=='favorites'||s.favorite));
    const button=(text,label,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.onclick=action;return b;};
    for(const record of records.filter(s=>s.name.toLowerCase().includes(query))){
      const row=document.createElement('div');row.className='indicator-script-row';const name=document.createElement('span');name.textContent=record.name;row.appendChild(name);
      if(this.section==='chart'){
        row.append(button('⚙','Settings '+record.name,()=>{this.modal.classList.remove('show');this.openSettings(this.chart,record.id);}),button(record.view?.hidden?'◌':'◉','Hide / show '+record.name,()=>{this.chart.runner.toggle(record.id);this.renderList();this.onChange?.();}),button('‹/›','Edit '+record.name,()=>this.edit(record,record.id)),button('×','Remove from chart '+record.name,()=>{this.chart.runner.remove(record.id);this.renderList();this.onChange?.();}));
      }else if(this.section==='archived'){
        row.append(button('Restore','Restore '+record.name,()=>{const next=this.sources.map(s=>s.id===record.id?{...s,archived:false}:s);if(Workspace.write('indicator_library_v1',next)){this.sources=next;this.renderList();}}));
      }else{
        row.prepend(button(record.favorite?'★':'☆','Favorite '+record.name,()=>{const next=this.sources.map(s=>s.id===record.id?{...s,favorite:!s.favorite}:s);if(Workspace.write('indicator_library_v1',next)){this.sources=next;this.renderList();}}));
        row.append(button('Add to chart','Add '+record.name,()=>{if(this.chart.runner.add({...record,sourceId:record.id,view:{}})){this.onChange?.();row.dataset.added='true';row.querySelector('[data-added-state]')?.remove();const note=document.createElement('small');note.dataset.addedState='';note.textContent='Added';row.appendChild(note);}}),button('‹/›','Edit '+record.name,()=>this.edit(record)),button('Archive','Archive '+record.name,()=>{const next=this.sources.map(s=>s.id===record.id?{...s,archived:true}:s);if(Workspace.write('indicator_library_v1',next)){this.sources=next;this.renderList();}}));
      }
      this.list.appendChild(row);
    }
    if(!this.list.children.length){const empty=document.createElement('p');empty.className='indicator-empty';empty.textContent=query?'No matching scripts':this.section==='chart'?'No indicators on this chart':this.section==='favorites'?'Star a script in My scripts to keep it here.':'Your saved scripts appear here.';this.list.appendChild(empty);}
    const create=button('＋ New script','Create a script',()=>this.edit());create.className='btn-secondary indicator-create';this.list.appendChild(create);
  }
  edit(source,instanceId){
    this.section='editor';this.clean=!!source;this.panel.hidden=true;this.body.hidden=false;this.footer.hidden=false;this.instanceId=instanceId||null;
    this.sourceId=source?.sourceId||(!instanceId?source?.id:null)||this.sources.find(s=>s.code===source?.code)?.id||null;
    const draft=!source?Workspace.read('indicator_draft_v1',{}):source;
    document.getElementById('indicator-name').value=draft?.name||'';document.getElementById('indicator-code').value=draft?.code||'';document.getElementById('indicator-settings').value=draft?.settingsText??JSON.stringify(draft?.settings||{},null,2);
    document.getElementById('apply-indicator').textContent=instanceId?'Save & update chart':'Save & add to chart';
    document.getElementById('remove-indicator').hidden=document.getElementById('stop-indicator-run').hidden=!instanceId;this.saved.textContent='';document.getElementById('indicator-code').focus();
  }
  readEditor(){const settings=JSON.parse(document.getElementById('indicator-settings').value||'{}');if(!settings||Array.isArray(settings)||typeof settings!=='object')throw Error('Settings cần là JSON object.');return {name:document.getElementById('indicator-name').value.trim()||'Custom indicator',code:document.getElementById('indicator-code').value,settings};}
  saveDraft(){clearTimeout(this.timer);if(this.section!=='editor'||this.clean)return;const draft={name:document.getElementById('indicator-name').value,code:document.getElementById('indicator-code').value,settingsText:document.getElementById('indicator-settings').value};if(Workspace.write('indicator_draft_v1',draft))this.saved.textContent='Draft saved';}
  save(add){
    try{
      const script=this.readEditor();if(!script.code.trim())throw Error('Dán code indicator trước khi lưu.');
      const id=this.sourceId||this.chart.runner.id(),previous=this.sources.find(s=>s.id===id);
      const source={...previous,...script,id,updatedAt:Date.now()};const next=[...this.sources.filter(s=>s.id!==id),source];
      if(!Workspace.write('indicator_library_v1',next))return;this.sources=next;this.sourceId=id;this.clean=true;Workspace.write('indicator_draft_v1',null);this.saved.textContent='Saved';
      if(add){const ok=this.instanceId?this.chart.runner.update(this.instanceId,{...script,sourceId:id,enabled:true}):this.chart.runner.add({...script,sourceId:id,view:{}});if(ok){this.onChange?.();this.showSection('chart');}}
    }catch(error){this.saved.textContent=error.message;}
  }
}
