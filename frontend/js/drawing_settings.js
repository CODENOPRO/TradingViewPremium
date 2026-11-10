class DrawingSettings {
  constructor(editor) {
    this.editor=editor;
    this.root=document.createElement('div');this.root.className='modal drawing-settings';this.root.id='drawing-settings';this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');
    const field=(label,path,type='number',extra='')=>`<label class="drawing-field"><span>${label}</span><input data-field="${path}" type="${type}" ${extra}></label>`;
    const select=(label,path,options)=>`<label class="drawing-field"><span>${label}</span><select data-field="${path}">${options.map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select></label>`;
    const check=(label,path)=>`<label class="drawing-check"><input data-field="${path}" type="checkbox"><span>${label}</span></label>`;
    this.root.innerHTML=`<div class="modal-content drawing-dialog">
      <div class="modal-header"><span id="drawing-settings-title"></span><button type="button" class="modal-close" aria-label="Đóng setting hình">×</button></div>
      <div class="drawing-tabs" role="tablist">${['Style','Text','Coordinates','Visibility'].map((tab,i)=>`<button type="button" role="tab" data-tab="${tab.toLowerCase()}" aria-selected="${i===0}">${tab}</button>`).join('')}</div>
      <div class="modal-body drawing-panel" data-panel="style">
        <div data-types="box,line,fib">${select('Extend','extend',[['none',"Don’t extend"],['left','Extend left'],['right','Extend right'],['both','Extend both']])}</div>
        <div data-types="box,line,hline,fib,position,measure" class="drawing-inline-field"><span>Border / Line</span><div class="drawing-inline-controls">
          <input data-field="borderColor" type="color" aria-label="Border color"><input data-field="width" type="number" min="1" max="5" aria-label="Line width"><select data-field="lineStyle" aria-label="Line style"><option value="solid">━━</option><option value="dotted">····</option><option value="dashed">┅┅</option></select><input data-field="strokeOpacity" type="range" min="0" max="100" aria-label="Line opacity">
        </div></div>
        <div data-types="box" class="drawing-inline-field"><label><input data-field="middleLine.enabled" type="checkbox">Middle line</label><div class="drawing-inline-controls">
          <input data-field="middleLine.color" type="color" aria-label="Middle line color"><input data-field="middleLine.width" type="number" min="1" max="5" aria-label="Middle line width"><select data-field="middleLine.style" aria-label="Middle line style"><option value="solid">━━</option><option value="dotted">····</option><option value="dashed">┅┅</option></select><input data-field="middleLine.opacity" type="range" min="0" max="100" aria-label="Middle line opacity">
        </div></div>
        <div data-types="box,measure" class="drawing-inline-field"><label><input data-field="fillEnabled" type="checkbox">Background</label><div class="drawing-inline-controls"><input data-field="fillColor" type="color" aria-label="Background color"><input data-field="fillOpacity" type="range" min="0" max="100" aria-label="Background opacity"></div></div>
        <div data-types="fib"><label class="drawing-field"><span>Levels</span><input id="drawing-levels" type="text" placeholder="0, 0.5, 1"></label></div>
        <div data-types="position">${field('Risk / Reward','riskReward','number','min="0.1" max="100" step="0.1"')}</div>
        <div data-types="line" class="drawing-line-stats">${check('Price range','stats.price')}${check('Percent change','stats.percent')}${check('Bars range','stats.bars')}${check('Date / time range','stats.time')}${check('Middle point','stats.middle')}</div>
      </div>
      <div class="modal-body drawing-panel" data-panel="text" hidden>
        <div class="drawing-text-toolbar">${field('Text color','textStyle.color','color')}${field('Size','textStyle.size','number','min="8" max="72"')}${check('Bold','textStyle.bold')}${check('Italic','textStyle.italic')}</div>
        <textarea id="drawing-text" aria-label="Drawing text" placeholder="Add text" spellcheck="false"></textarea>
        ${select('Text alignment','textStyle.vertical',[['inside','Inside'],['above','Above'],['below','Below']])}${select('Horizontal','textStyle.horizontal',[['left','Left'],['center','Center'],['right','Right']])}
      </div>
      <div class="modal-body drawing-panel" data-panel="coordinates" hidden><p class="editor-help">Bar index theo nến đang tải; thời gian của điểm được lưu cố định.</p><div id="drawing-points"></div></div>
      <div class="modal-body drawing-panel" data-panel="visibility" hidden>${Object.entries(DrawingModel.groups).map(([key,max])=>`<div class="visibility-row"><label><input type="checkbox" data-field="visibility.${key}.enabled">${key[0].toUpperCase()+key.slice(1)}</label>${max===1?'':`<input aria-label="${key} minimum" type="number" data-field="visibility.${key}.min" min="1" max="${max}"><div class="visibility-sliders"><input aria-label="${key} range start" type="range" data-mirror="visibility.${key}.min" min="1" max="${max}"><input aria-label="${key} range end" type="range" data-mirror="visibility.${key}.max" min="1" max="${max}"></div><input aria-label="${key} maximum" type="number" data-field="visibility.${key}.max" min="1" max="${max}">`}</div>`).join('')}</div>
      <p id="drawing-settings-error" role="alert"></p>
      <div class="modal-footer"><select id="drawing-template" aria-label="Drawing template"><option value="">Template</option></select><input id="drawing-template-name" aria-label="Template name" placeholder="Template name" hidden><button type="button" id="drawing-template-save" class="btn-secondary" hidden>Save</button><button type="button" id="drawing-cancel" class="btn-secondary">Cancel</button><button type="button" id="drawing-apply" class="btn-primary">Ok</button></div>
    </div>`;
    document.body.appendChild(this.root);
    this.root.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>this.tab(button.dataset.tab)));
    this.root.querySelectorAll('[data-field]').forEach(input=>input.addEventListener('input',()=>this.preview()));
    this.root.querySelectorAll('[data-mirror]').forEach(input=>input.addEventListener('input',()=>{this.root.querySelector(`[data-field="${input.dataset.mirror}"]`).value=input.value;this.preview();}));
    this.root.querySelector('#drawing-text').addEventListener('input',()=>this.preview());
    this.root.querySelector('#drawing-levels').addEventListener('input',()=>this.preview());
    this.root.querySelector('#drawing-cancel').addEventListener('click',()=>this.cancel());
    this.root.querySelector('.modal-close').addEventListener('click',()=>this.cancel());
    this.root.addEventListener('click',event=>{if(event.target===this.root)this.cancel();});
    this.root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();this.cancel();}if(event.key==='Tab'){const items=[...this.root.querySelectorAll('input,button,select,textarea')].filter(el=>el.getClientRects().length&&!el.disabled);if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}else if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}}});
    this.root.querySelector('#drawing-apply').addEventListener('click',()=>{try{this.read();this.editor.commit(this.draft);this.hide();}catch(error){this.error(error.message);}});
    this.root.querySelector('#drawing-template').addEventListener('change',event=>{
      if(event.target.value==='__save'){this.root.querySelector('#drawing-template-name').hidden=false;this.root.querySelector('#drawing-template-save').hidden=false;return;}
      const template=Workspace.read('drawing_templates_v1',{})[this.draft.type]?.[event.target.value];
      if(template){this.draft=DrawingModel.normalize({...this.draft,...structuredClone(template)});this.fill();this.editor.preview(this.draft);}
    });
    this.root.querySelector('#drawing-template-save').addEventListener('click',()=>{
      try{this.read();const name=this.root.querySelector('#drawing-template-name').value.trim();if(!name)throw new Error('Nhập tên template.');
        if(['__proto__','constructor','prototype'].includes(name))throw new Error('Tên template không hợp lệ.');
        const templates=Workspace.read('drawing_templates_v1',{});templates[this.draft.type]||={};
        const {id,type,p1,p2,locked,...style}=structuredClone(this.draft);templates[type][name]=style;
        if(Workspace.write('drawing_templates_v1',templates)){this.templates();this.root.querySelector('#drawing-template-name').hidden=true;this.root.querySelector('#drawing-template-save').hidden=true;}
      }catch(error){this.error(error.message);}
    });
  }
  value(path){return path.split('.').reduce((value,key)=>value?.[key],this.draft);}
  assign(path,value){const keys=path.split('.');let target=this.draft;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)]=value;}
  open(chart,drawing,tab='style'){
    this.chart=chart;this.draft=structuredClone(DrawingModel.normalize(drawing));this.error('');
    this.root.querySelector('#drawing-settings-title').textContent=DrawingModel.names[drawing.type]||drawing.type;
    this.root.querySelectorAll('[data-types]').forEach(el=>el.hidden=!el.dataset.types.split(',').includes(drawing.type));
    const points=this.root.querySelector('#drawing-points');points.replaceChildren();
    for(const key of drawing.p2?['p1','p2']:['p1']){
      const row=document.createElement('div');row.className='coordinate-row';
      const label=document.createElement('label');label.textContent=`#${key==='p1'?1:2} (price, bar)`;
      const price=document.createElement('input');price.type='number';price.step='any';price.dataset.point=key;price.dataset.coordinate='price';price.setAttribute('aria-label',key+' price');
      const bar=document.createElement('input');bar.type='number';bar.step='1';bar.dataset.point=key;bar.dataset.coordinate='bar';bar.setAttribute('aria-label',key+' bar');
      row.append(label,price,bar);points.appendChild(row);
      price.addEventListener('input',()=>this.preview());bar.addEventListener('input',()=>this.preview());
    }
    this.fill();this.templates();this.tab(tab);this.root.classList.add('show');this.root.querySelector(`[data-tab="${tab}"]`).focus();
  }
  fill(){
    this.root.querySelectorAll('[data-field]').forEach(input=>{
      const value=this.value(input.dataset.field);
      if(input.type==='checkbox')input.checked=!!value;
      else input.value=input.type==='color'?DrawingModel.hex(value):value;
    });
    this.root.querySelectorAll('[data-mirror]').forEach(input=>input.value=this.value(input.dataset.mirror));
    this.root.querySelector('#drawing-text').value=this.draft.text||'';
    this.root.querySelector('#drawing-levels').value=this.draft.levels.join(', ');
    this.root.querySelectorAll('[data-point]').forEach(input=>{const point=this.draft[input.dataset.point];input.value=input.dataset.coordinate==='price'?point.price:Number(DrawingModel.logicalIndex(this.chart,point.time)?.toFixed(3));input.dataset.original=input.value;});
  }
  read(){
    this.root.querySelectorAll('[data-field]').forEach(input=>{
      const value=input.type==='checkbox'?input.checked:input.type==='number'||input.type==='range'?Number(input.value):input.value;
      if((input.type==='number'||input.type==='range')&&(!input.value||!Number.isFinite(value)||value<Number(input.min)||value>Number(input.max)))throw new Error('Thông số vượt giới hạn.');
      this.assign(input.dataset.field,value);
    });
    for(const [name,rule] of Object.entries(this.draft.visibility))if(rule.min>rule.max)throw new Error(`${name}: minimum phải ≤ maximum.`);
    this.draft.text=this.root.querySelector('#drawing-text').value;
    const levels=this.root.querySelector('#drawing-levels').value.split(',').map(value=>Number(value.trim()));
    if(!levels.length||levels.length>30||levels.some(value=>!Number.isFinite(value)))throw new Error('Fib levels không hợp lệ.');
    this.draft.levels=levels;
    this.root.querySelectorAll('[data-point]').forEach(input=>{
      const value=Number(input.value);if(!input.value||!Number.isFinite(value))throw new Error('Tọa độ không hợp lệ.');
      const point=this.draft[input.dataset.point];
      if(input.value===input.dataset.original)return;
      if(input.dataset.coordinate==='price')point.price=value;
      else {const time=DrawingModel.timeAt(this.chart,value);if(time===null||time<=0)throw new Error('Bar không hợp lệ.');point.time=time;}
    });
    this.root.querySelectorAll('[data-mirror]').forEach(input=>input.value=this.value(input.dataset.mirror));
  }
  preview(){try{this.read();this.error('');this.editor.preview(this.draft);}catch(error){this.error(error.message);}}
  templates(){const select=this.root.querySelector('#drawing-template');select.replaceChildren(new Option('Template',''));for(const name of Object.keys(Workspace.read('drawing_templates_v1',{})[this.draft.type]||{}))select.add(new Option(name,name));select.add(new Option('Save as…','__save'));}
  tab(name){this.root.querySelectorAll('[data-tab]').forEach(button=>{const selected=button.dataset.tab===name;button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));});this.root.querySelectorAll('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==name);}
  error(message){this.root.querySelector('#drawing-settings-error').textContent=message;}
  hide(){this.root.classList.remove('show');this.editor.preview(null);this.editor.toolbar.querySelector('[data-action="settings"]')?.focus();}
  cancel(){this.hide();}
}
