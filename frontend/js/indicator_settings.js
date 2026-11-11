/* Indicator inputs are data; the editor never evaluates user scripts on the UI thread. */
class IndicatorSettings {
  constructor(onApply) {
    this.onApply=onApply;this.schemas=new Map();
    const modal=document.createElement('div');modal.className='modal indicator-settings-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Indicator settings');
    modal.innerHTML='<div class="modal-content indicator-settings-dialog"><div class="modal-header"><span class="indi-settings-title"></span><button class="modal-close" aria-label="Close indicator settings">×</button></div><div class="indi-tabs" role="tablist"><button role="tab" data-tab="inputs">Inputs</button><button role="tab" data-tab="style">Style</button><button role="tab" data-tab="visibility">Visibility</button></div><div class="indi-settings-body"></div><div class="indi-settings-error" role="alert"></div><div class="modal-footer"><button class="btn-secondary indi-defaults">Defaults</button><button class="btn-secondary indi-cancel">Cancel</button><button class="btn-primary indi-ok">Ok</button></div></div>';
    this.modal=modal;document.body.appendChild(modal);
    modal.querySelector('.modal-close').onclick=modal.querySelector('.indi-cancel').onclick=()=>this.close();
    modal.onclick=e=>{if(e.target===modal)this.close();};
    modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.close();}if(e.key==='Tab'){const fields=[...modal.querySelectorAll('button,input,select,textarea')].filter(x=>!x.disabled&&x.getClientRects().length);const first=fields[0],last=fields.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
    for(const button of modal.querySelectorAll('[data-tab]'))button.onclick=()=>this.render(button.dataset.tab);
    modal.querySelector('.indi-defaults').onclick=()=>{if(this.tab==='inputs')this.draft={...this.chart.runner.defaults};else if(this.tab==='style')this.view={...this.view,overlay:true,pane:true,tables:true,candleColors:true};else this.view.visibility={};this.render(this.tab);};
    modal.querySelector('.indi-ok').onclick=()=>this.apply();
  }

  async open(chart) {
    if(!chart.runner?.ready){window.showToast?.('Nạp indicator trước khi mở setting.','alert');return;}
    this.chart=chart;this.opener=document.activeElement;this.draft={...chart.runner.settings};this.view=structuredClone(chart.runner.view||{});
    this.modal.querySelector('.indi-settings-title').textContent=chart.runner.name||'Indicator';
    this.modal.querySelector('.indi-settings-error').textContent='';
    const name=chart.runner.name||'',slug=name.startsWith('QT+ by 4XS')?'qt-plus':name.startsWith('QS Stacks+')?'qs-stacks-plus':null;
    this.fields=chart.runner.inputs||[];
    if(!this.fields.length&&slug){
      try {if(!this.schemas.has(slug)){const response=await fetch(`indicators/${slug}.inputs.json`);if(!response.ok)throw Error('Input metadata unavailable');this.schemas.set(slug,await response.json());}this.fields=this.schemas.get(slug);}
      catch(error){console.warn(error.message);}
    }
    if(this.chart!==chart)return;
    if(!this.fields.length)this.fields=Object.entries(chart.runner.defaults||{}).map(([key,value])=>({key,label:key.replaceAll('_',' '),type:typeof value==='boolean'?'bool':typeof value==='number'?'float':/^#[0-9a-f]{6,8}$/i.test(value)?'color':'string',group:'Inputs'}));
    this.fields=this.fields.filter(f=>Object.hasOwn(chart.runner.defaults||{},f.key));
    this.modal.classList.add('show');this.render('inputs');this.modal.querySelector('[data-tab="inputs"]').focus();
  }

  close(){this.modal.classList.remove('show');this.opener?.focus();}

  render(tab) {
    this.tab=tab;
    for(const button of this.modal.querySelectorAll('[data-tab]')){const selected=button.dataset.tab===tab;button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));}
    const body=this.modal.querySelector('.indi-settings-body');body.replaceChildren();
    if(tab==='inputs') {
      const search=document.createElement('input');search.type='search';search.placeholder='Search inputs';search.setAttribute('aria-label','Search indicator inputs');search.className='indi-input-search';body.appendChild(search);
      const content=document.createElement('div');body.appendChild(content);
      const fill=query=>{
        content.replaceChildren();let group;
        for(const field of this.fields){if(query&&!`${field.label} ${field.group} ${field.key}`.toLowerCase().includes(query))continue;
          if(group!==field.group){const heading=document.createElement('h3');heading.textContent=field.group||'Inputs';content.appendChild(heading);group=field.group;}
          this.field(content,field,this.draft);
        }
        if(!this.fields.length){const p=document.createElement('p');p.textContent='Script này không khai báo inputs. Mở editor để sửa mã.';content.appendChild(p);}
      };
      fill('');search.oninput=()=>fill(search.value.trim().toLowerCase());
    } else if(tab==='style') {
      for(const [key,label] of [['overlay','Overlay drawings'],['pane','Cycle pane'],['tables','Tables'],['candleColors','Candle body colors']])this.field(body,{key,label,type:'bool'},this.view,true);
    } else {
      this.view.visibility||={};
      for(const tf of Object.keys(MarketData.durations))this.field(body,{key:tf,label:tf,type:'bool'},this.view.visibility,true);
    }
  }

  field(parent,descriptor,target,defaultTrue=false) {
    const {key,type}=descriptor,row=document.createElement('label');row.className='indi-field';row.title=descriptor.disabled||descriptor.tooltip||'';
    const caption=document.createElement('span');caption.textContent=descriptor.label||key;row.appendChild(caption);
    const value=target[key]??(defaultTrue?true:this.chart.runner.defaults[key]);
    let control;
    if(descriptor.options?.length){control=document.createElement('select');for(const v of descriptor.options){const option=document.createElement('option');option.value=String(v);option.textContent=String(v);control.appendChild(option);}control.value=String(value);}
    else {control=document.createElement('input');control.type=type==='bool'?'checkbox':type==='int'||type==='float'?'number':type==='color'?'color':'text';
      if(type==='bool')control.checked=!!value;else control.value=type==='color'?String(value).slice(0,7):String(value??'');
      if(control.type==='number'){control.step=descriptor.step??(type==='int'?1:'any');if(descriptor.min!==undefined)control.min=descriptor.min;if(descriptor.max!==undefined)control.max=descriptor.max;}
    }
    control.dataset.inputKey=key;control.setAttribute('aria-label',descriptor.label||key);control.disabled=!!descriptor.disabled;
    control.oninput=()=>{target[key]=type==='bool'?control.checked:type==='int'||type==='float'?Number(control.value):type==='color'?control.value+(String(target[key]||value).length===9?String(target[key]||value).slice(7):''):control.value;};
    row.appendChild(control);
    if(type==='color'){
      const alpha=document.createElement('input');alpha.type='range';alpha.min=0;alpha.max=100;alpha.value=String(value).length===9?Math.round(parseInt(String(value).slice(7),16)/255*100):100;alpha.setAttribute('aria-label',(descriptor.label||key)+' opacity');alpha.disabled=!!descriptor.disabled;
      alpha.oninput=()=>{target[key]=String(target[key]||value).slice(0,7)+Math.round(+alpha.value/100*255).toString(16).padStart(2,'0');};row.appendChild(alpha);
    }
    if(descriptor.disabled){row.classList.add('unsupported');const note=document.createElement('small');note.textContent='Chưa hỗ trợ';row.appendChild(note);}
    parent.appendChild(row);
  }

  apply() {
    try {
      const invalid=this.modal.querySelector('input:invalid');if(invalid){invalid.reportValidity();return;}
      for(const f of this.fields){const v=this.draft[f.key];if(['int','float'].includes(f.type)&&(!Number.isFinite(v)||f.type==='int'&&!Number.isInteger(v)||f.min!==undefined&&v<f.min||f.max!==undefined&&v>f.max))throw Error(`Giá trị không hợp lệ: ${f.label}`);}
      if(this.onApply(this.chart,this.draft,this.view)!==false)this.close();
    } catch(error){this.modal.querySelector('.indi-settings-error').textContent=error.message;}
  }
}
