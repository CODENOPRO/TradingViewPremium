/* Settings, motion and input behavior shared by the terminal chrome. */
TerminalFeatures.contrast=color=>{const hex=String(color).replace('#','');if(!/^[\da-f]{6}$/i.test(hex))return '#fff';const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#111':'#fff';};
TerminalFeatures.prototype.installPolish=function(){
  const settings=this.chartSettings,modal=settings.modal,dialog=settings.dialog;
  const old=modal.querySelector('.toolbar-settings'),controls=document.createElement('div'),parking=document.createElement('div');
  parking.hidden=true;modal.appendChild(parking);settings.toolbarControls=controls;settings.toolbarParking=parking;
  for(const child of [...old.children])if(child.tagName!=='SUMMARY')controls.appendChild(child);old.remove();parking.appendChild(controls);
  const labels=['Top left toolbar','Top right toolbar','Drawing toolbar','Bottom left toolbar','Bottom right toolbar','Toolbar transparency'];
  controls.querySelectorAll('.setting-row>span:first-child').forEach((el,i)=>el.textContent=labels[i]);
  controls.querySelector('.editor-help').textContent='Ctrl + , opens Settings even when toolbars are hidden. Toolbar preferences save automatically.';
  const nav=document.createElement('button');nav.type='button';nav.setAttribute('role','tab');nav.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v5H3zM3 14h5v7H3zM12 14h9v7h-9z"/></svg><span>Toolbars</span>';nav.onclick=()=>settings.select('Toolbars');settings.nav.appendChild(nav);
  const add=(text,el)=>{const label=document.createElement('label');label.className='setting-row';const name=document.createElement('span');name.textContent=text;label.append(name,el);controls.appendChild(label);};
  const compact=document.createElement('input');compact.type='checkbox';compact.id='set-hide-labels';compact.checked=Workspace.read('terminal_compact_labels_v1',false);compact.onchange=()=>{document.body.classList.toggle('icon-labels-only',compact.checked);Workspace.write('terminal_compact_labels_v1',compact.checked);};add('Hide labels (keep symbol and timeframes)',compact);
  const reduced=document.createElement('input');reduced.type='checkbox';reduced.checked=Workspace.read('terminal_reduce_motion_v1',false);reduced.onchange=()=>{document.body.classList.toggle('reduce-motion',reduced.checked);Workspace.write('terminal_reduce_motion_v1',reduced.checked);};add('Reduce motion',reduced);reduced.onchange();
  const opacity=document.createElement('input');opacity.type='range';opacity.id='set-calendar-opacity';opacity.min=0;opacity.max=90;opacity.step=5;opacity.value=Workspace.read('terminal_calendar_transparency_v1',0);opacity.setAttribute('aria-label','Calendar transparency');opacity.oninput=()=>{document.documentElement.style.setProperty('--calendar-opacity',String(1-opacity.value/100));Workspace.write('terminal_calendar_transparency_v1',+opacity.value);};add('Calendar transparency',opacity);opacity.oninput();
  const songToast=document.createElement('input');songToast.type='checkbox';songToast.id='set-music-toast';songToast.checked=Workspace.read('terminal_music_toast_v1',true);songToast.onchange=()=>Workspace.write('terminal_music_toast_v1',songToast.checked);add('Show song-change notification (2 seconds)',songToast);
  // Keep vendor notices and a product link, outside the Settings dialog.
  modal.querySelector('.library-credit')?.remove();
  const credit=document.createElement('a');credit.id='terminal-library-link';credit.href='https://www.tradingview.com/';credit.target='_blank';credit.rel='noopener noreferrer';credit.title='TradingView Lightweight Charts™';credit.textContent='TradingView';document.querySelector('.bottom-ranges')?.appendChild(credit);
  const header=dialog.querySelector('.modal-header');header.title='Drag to move Settings';
  header.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button'))return;
    event.preventDefault();
    const rect=dialog.getBoundingClientRect();
    const offsetX=event.clientX-rect.left,offsetY=event.clientY-rect.top;
    Object.assign(dialog.style,{position:'fixed',margin:'0',left:rect.left+'px',top:rect.top+'px'});
    header.setPointerCapture(event.pointerId);
    header.onpointermove=move=>{
      if(move.pointerId!==event.pointerId)return;
      dialog.style.left=(move.clientX-offsetX)+'px';
      dialog.style.top=(move.clientY-offsetY)+'px';
    };
    header.onlostpointercapture=()=>{header.onpointermove=null;};
  });
  // Dismiss only the small popup being clicked away from; never the large Settings dialog.
  const small=['#layout-popover','.toolbar-overflow','.chart-context-menu','.drawing-menu','.tool-submenu','.drawing-more'];
  document.addEventListener('pointerdown',e=>{if(e.target.closest('#btn-layout,.toolbar-more,[data-menu],.tool-group'))return;for(const node of document.querySelectorAll(small.join(',')))if(!node.contains(e.target)){if(node.matches('.toolbar-overflow,.drawing-more'))node.hidden=true;else node.classList.remove('show');}},true);
  // Left drawing toolbar has its own saved position; drag grip never changes the drawing tool.
  const sidebar=document.getElementById('left-sidebar'),grip=document.createElement('button');grip.type='button';grip.className='sidebar-grip';grip.title='Move drawing toolbar';grip.setAttribute('aria-label',grip.title);sidebar.prepend(grip);
  const position=Workspace.read('terminal_sidebar_position_v1',null);if(position){sidebar.style.position='fixed';sidebar.style.left=position.x+'px';sidebar.style.top=position.y+'px';}
  grip.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const r=sidebar.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;sidebar.style.position='fixed';sidebar.style.margin='0';sidebar.style.height='auto';grip.setPointerCapture(e.pointerId);grip.onpointermove=m=>{sidebar.style.left=Math.max(0,Math.min(innerWidth-sidebar.offsetWidth,m.clientX-dx))+'px';sidebar.style.top=Math.max(0,Math.min(innerHeight-sidebar.offsetHeight,m.clientY-dy))+'px';};grip.onpointerup=grip.onpointercancel=()=>{grip.onpointermove=null;Workspace.write('terminal_sidebar_position_v1',{x:parseFloat(sidebar.style.left)||r.left,y:parseFloat(sidebar.style.top)||r.top});};};
};

TerminalFeatures.prototype.installChartDividers=function(grid,charts){
  this.removeChartDividers?.();
  const panels=charts.map(element=>({element,rect:element.getBoundingClientRect(),widthOffset:0,leftOffset:0}));
  const dividers=[];
  const gap=parseFloat(getComputedStyle(grid).columnGap)||0;

  const positionDividers=()=>{
    if(grid.dataset.expanded)return;
    const bounds=grid.getBoundingClientRect();
    const positions=dividers.map(({left,right})=>[left.element.getBoundingClientRect(),right.element.getBoundingClientRect()]);
    dividers.forEach(({handle},i)=>{
      const [left,right]=positions[i];
      handle.style.left=((left.right+right.left)/2-bounds.left)+'px';
      handle.style.top=(left.top-bounds.top)+'px';
      handle.style.height=left.height+'px';
    });
  };

  const setPanelWidth=(panel)=>{
    panel.element.style.setProperty('--chart-width-adjustment',panel.widthOffset+'cqw');
    panel.element.style.setProperty('--chart-left-adjustment',panel.leftOffset+'cqw');
  };

  const measure=(left,right)=>{
    const leftWidth=left.element.getBoundingClientRect().width;
    const rightWidth=right.element.getBoundingClientRect().width;
    return {leftWidth,rightWidth,leftOffset:left.widthOffset,rightOffset:right.widthOffset,rightStart:right.leftOffset};
  };
  const resizePair=(left,right,start,delta)=>{
    const min=Math.min(120,start.leftWidth,start.rightWidth);
    const width=grid.getBoundingClientRect().width;
    if(!width)return;
    const change=100*Math.max(min-start.leftWidth,Math.min(start.rightWidth-min,delta))/width;
    left.widthOffset=start.leftOffset+change;
    right.widthOffset=start.rightOffset-change;
    right.leftOffset=start.rightStart+change;
    setPanelWidth(left);
    setPanelWidth(right);
    positionDividers();
  };

  for(const left of panels){
    const right=panels.find(panel=>panel!==left
      && Math.abs(panel.rect.left-left.rect.right-gap)<1
      && Math.abs(panel.rect.top-left.rect.top)<1
      && Math.abs(panel.rect.bottom-left.rect.bottom)<1);
    if(!right)continue;

    const handle=document.createElement('div');
    handle.className='chart-grid-divider';
    handle.tabIndex=0;
    handle.setAttribute('role','separator');
    handle.setAttribute('aria-orientation','vertical');
    handle.setAttribute('aria-label','Resize adjacent charts');
    grid.appendChild(handle);
    dividers.push({handle,left,right});

    handle.onpointerdown=event=>{
      if(event.button!==0)return;
      event.preventDefault();
      const start=measure(left,right);
      const origin=event.clientX;
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('dragging');
      handle.onpointermove=move=>{
        if(move.pointerId===event.pointerId)resizePair(left,right,start,move.clientX-origin);
      };
    };
    handle.onlostpointercapture=()=>{
      handle.onpointermove=null;
      handle.classList.remove('dragging');
    };
    handle.onkeydown=event=>{
      if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
      event.preventDefault();
      resizePair(left,right,measure(left,right),event.key==='ArrowLeft'?-12:12);
    };
  }
  positionDividers();
  const observer=new ResizeObserver(positionDividers);
  observer.observe(grid);
  const expandedObserver=new MutationObserver(positionDividers);
  expandedObserver.observe(grid,{attributes:true,attributeFilter:['data-expanded']});
  this.removeChartDividers=()=>{
    observer.disconnect();
    expandedObserver.disconnect();
    for(const {handle} of dividers)handle.remove();
    for(const {element} of panels){
      element.style.removeProperty('--chart-width-adjustment');
      element.style.removeProperty('--chart-left-adjustment');
    }
  };
};
