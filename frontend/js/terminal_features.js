'use strict';
const TerminalTime={
  sessions(date,metadata={}){
    const stamp=date.toISOString().slice(0,10).replaceAll('-',''),weekday=String(date.getUTCDay()+1);
    let schedule=metadata.session||'1700-1600',corrected=false;
    for(const group of String(metadata.sessionCorrections||'').split(';')){
      const i=group.lastIndexOf(':');if(i>=0&&group.slice(i+1).split(',').includes(stamp)){schedule=group.slice(0,i);corrected=true;break;}
    }
    if(schedule==='dayoff'||(!corrected&&String(metadata.holidays||'').split(',').includes(stamp)))return [];
    if(schedule==='24x7')schedule='0000-2400:1234567';
    const groups=schedule.replace(/^\d;/,'').replace(/;\d$/,'').split('|');
    const explicit=groups.find(g=>g.includes(':')&&g.split(':')[1].includes(weekday));
    schedule=explicit||groups.find(g=>!g.includes(':'))||'';
    if(!corrected&&!explicit&&[0,6].includes(date.getUTCDay()))return [];
    const zone=metadata.timezone||'America/Chicago',result=[];
    for(const range of schedule.split(':')[0].split(',')){
      const m=/^(\d{2})(\d{2})(F\d*)?-(\d{2})(\d{2})(F\d*)?$/.exec(range);if(!m)continue;
      const open=+m[1]*60+ +m[2],close=+m[4]*60+ +m[5];
      const back=x=>x?+(x.slice(1)||1):0;
      const from=new Date(date),to=new Date(date);from.setUTCDate(from.getUTCDate()-(m[3]?back(m[3]):open>=close&&open!==0?1:0));to.setUTCDate(to.getUTCDate()-back(m[6]));
      const at=(d,h,m)=>MarketData.localTime(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),h,m,zone);
      result.push([at(from,+m[1],+m[2]),at(to,+m[4],+m[5])]);
    }return result;
  },
  activeSession(now,metadata={}){
    const p=MarketData.parts(now,metadata.timezone||'America/Chicago'),date=new Date(Date.UTC(p.year,p.month-1,p.day));
    // Fn corrections may attach a segment to a later trading date.
    for(let i=0;i<=7;i++){for(const [start,end] of this.sessions(date,metadata))if(now>=start&&now<end)return {start,end};date.setUTCDate(date.getUTCDate()+1);}return null;
  },
  end(bar,tf,metadata={}){
    if(!bar)return NaN;const duration=MarketData.durations[tf];
    if(duration<86400){const session=this.activeSession(bar.time,metadata);return session?Math.min(bar.time+duration,session.end):bar.time+duration;}
    const date=new Date(bar.time*1000);
    if(tf==='W')date.setUTCDate(date.getUTCDate()+(5-date.getUTCDay()+7)%7);
    if(tf==='1M'||tf==='3M')date.setUTCMonth(date.getUTCMonth()+(tf==='3M'?3:1),0);
    for(let i=0;i<14;i++){const sessions=this.sessions(date,metadata);if(sessions.length)return Math.max(...sessions.map(s=>s[1]));if(tf==='D')break;date.setUTCDate(date.getUTCDate()-1);}return NaN;
  },
  format(seconds){const days=Math.floor(seconds/86400),hours=Math.floor(seconds/3600)%24,minutes=Math.floor(seconds/60)%60;return (days?days+'d ':'')+(days||hours?String(hours).padStart(2,'0')+':':'')+String(minutes).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');},
  closedIndex(bars,tf,metadata,clock){let lo=0,hi=bars.length;while(lo<hi){const mid=(lo+hi)>>1;if(this.end(bars[mid],tf,metadata)<=clock)lo=mid+1;else hi=mid;}return lo;}
};

class TerminalReplay {
  constructor(ctx){
    Object.assign(this,ctx);
    this.running=false;
    this.timer=null;
    this.clock=null;
    this.targets=[];
    this.previews=new Map();
    this.bar=document.getElementById('replay-toolbar');
    this.bar.replaceChildren();
    this.bar.setAttribute('aria-label','Replay controls');
    const button=(parent,label,action)=>{
      const element=document.createElement('button');
      element.type='button';
      element.textContent=label;
      element.onclick=action;
      parent.appendChild(element);
      return element;
    };
    const icon=path=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';
    const saved=Workspace.read('terminal_replay_session_v2',{})||{};
    this.selectBar=button(this.bar,ui('Select bar'),()=>this.selecting?this.clearSelection():this.pickBar());
    this.selectBar.className='replay-select-bar';
    this.selectBar.setAttribute('aria-pressed','false');
    const options=document.createElement('details');
    options.className='replay-options';
    options.innerHTML='<summary aria-label="Replay options" title="Replay options">'+icon('m7 10 5 5 5-5')+'</summary><div class="replay-options-menu"></div>';
    this.bar.appendChild(options);
    this.options=options;
    const menu=options.lastElementChild;
    this.scope=document.createElement('select');
    this.scope.setAttribute('aria-label','Replay scope');
    this.scope.add(new Option('All charts','all'));
    this.scope.add(new Option('Current chart','one'));
    this.scope.value=saved.scope==='one'?'one':'all';
    this.scope.onchange=()=>{
      const clock=this.clock;
      this.stop(false);
      if(Number.isFinite(clock)&&this.go(clock,false))return;
      this.pickBar();
    };
    menu.appendChild(this.scope);
    this.date=document.createElement('input');
    this.date.type='datetime-local';
    this.date.step='1';
    this.date.setAttribute('aria-label','Replay date and time UTC');
    menu.appendChild(this.date);
    button(menu,'Go (UTC)',()=>this.go(Date.parse(this.date.value+'Z')/1000));
    button(menu,'Random',()=>this.startDefault(true));
    button(menu,'◀ Previous',()=>this.step(-1));
    this.play=button(this.bar,ui('Play'),()=>this.toggle());
    this.play.className='replay-play';
    const next=button(this.bar,'',()=>this.step(1));
    next.innerHTML=icon('m6 5 10 7-10 7zM19 5v14');
    next.setAttribute('aria-label','Next bar');
    next.title='Next bar';
    this.speed=document.createElement('select');
    this.speed.setAttribute('aria-label','Replay speed');
    for(const n of [.5,1,2,5,10])this.speed.add(new Option(n+'×',n));
    this.speed.value=[.5,1,2,5,10].includes(+saved.speed)?String(saved.speed):'1';
    this.speed.onchange=()=>{if(this.timer){this.pause();this.toggle();}this.persist();};
    this.bar.appendChild(this.speed);
    this.timeframe=document.createElement('span');
    this.timeframe.className='replay-timeframe';
    this.bar.appendChild(this.timeframe);
    this.position=document.createElement('time');
    this.position.id='replay-position';
    this.bar.appendChild(this.position);
    const exit=button(this.bar,'',()=>this.stop());
    exit.innerHTML=icon('m6 6 12 12M18 6 6 18');
    exit.setAttribute('aria-label','Exit Replay');
    exit.title='Exit Replay';
    document.getElementById('btn-replay').onclick=()=>this.bar.classList.contains('show')?this.stop():this.start();
    document.addEventListener('pointerdown',event=>{
      if(options.open&&!options.contains(event.target))options.open=false;
    });
    document.addEventListener('keydown',event=>{
      if(!this.bar.classList.contains('show'))return;
      if(event.key==='Escape'&&this.selecting){this.clearSelection();return;}
      if(event.target.matches('input,textarea,select,button,summary,[contenteditable=true]'))return;
      if(event.code==='Space'){event.preventDefault();this.toggle();}
      if(event.altKey&&event.code==='ArrowRight'){event.preventDefault();this.step(1);}
      if(event.altKey&&event.code==='ArrowLeft'){event.preventDefault();this.step(-1);}
    });
    for(const chart of this.charts){
      chart.container.addEventListener('pointermove',event=>this.previewAt(chart,event));
      chart.container.addEventListener('pointerleave',()=>{
        const preview=this.previews.get(chart);
        if(preview)preview.hidden=true;
      });
      chart.container.addEventListener('pointerdown',event=>{
        if(!this.selecting||!this.previews.has(chart)||event.button!==0||event.target.closest('button,input,select'))return;
        const bar=this.previewAt(chart,event);
        if(!bar)return;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.go(this.end(chart,bar),true,this.selectionTargets);
      },true);
    }
    this.updateTimeframe();
  }

  chartsForScope(){
    return this.scope.value==='all'?this.getCharts():[this.getActive()];
  }
  bars(chart){return chart.getBarsForTimeframe(chart.currentTimeframe);}
  end(chart,bar){return TerminalTime.end(bar,chart.currentTimeframe,chart.displaySessionMetadata?.()||chart.metadata);}
  limits(charts){
    const now=Date.now()/1000;
    let first=-Infinity,last=now;
    for(const chart of charts){
      const bars=this.bars(chart);
      const count=TerminalTime.closedIndex(bars,chart.currentTimeframe,chart.displaySessionMetadata?.()||chart.metadata,now);
      if(!count)return null;
      first=Math.max(first,this.end(chart,bars[0]));
      last=Math.min(last,this.end(chart,bars[count-1]));
    }
    return charts.length&&Number.isFinite(first)&&first<=last?{first,last}:null;
  }
  boundaryMessage(direction,limits){
    if(!limits)return 'Các chart không còn khoảng dữ liệu chung. Chọn Current chart để Replay riêng.';
    const edge=direction<0?limits.first:limits.last;
    const format=time=>new Date(time*1000).toISOString().replace('T',' ').slice(0,16)+' UTC';
    const blockers=this.targets.filter(chart=>{const bars=this.bars(chart),count=TerminalTime.closedIndex(bars,chart.currentTimeframe,chart.displaySessionMetadata?.()||chart.metadata,Date.now()/1000);return count&&this.end(chart,bars[direction<0?0:count-1])===edge;});
    return `Đã ${direction<0?'tới đầu':'hết nến đã tải'}: ${blockers.map(c=>c.symbol+' '+c.currentTimeframe).join(', ')||'các chart'} · ${format(edge)}. Phạm vi chung: ${format(limits.first)} → ${format(limits.last)}. Có đủ khung không có nghĩa đã tải hết lịch sử; chọn Current chart để phát riêng.`;
  }
  updateTimeframe(){this.timeframe.textContent=this.getActive()?.currentTimeframe||'';}
  start(){
    this.bar.classList.add('show');
    this.updateTimeframe();
    this.pickBar();
  }
  pickBar(){
    this.pause();
    this.clearSelection();
    const targets=this.chartsForScope();
    const limits=this.limits(targets);
    if(!limits){
      this.toast('Các chart chưa có khoảng dữ liệu chung. Bạn có thể chọn Current chart trong menu Replay.','alert');
      return;
    }
    this.selectionTargets=targets;
    this.selecting=true;
    this.selectBar.setAttribute('aria-pressed','true');
    for(const chart of targets){
      const preview=document.createElement('div');
      preview.className='replay-preview';
      preview.hidden=true;
      preview.innerHTML='<span></span>';
      chart.container.appendChild(preview);
      chart.container.classList.add('replay-selecting');
      this.previews.set(chart,preview);
      chart.replayPreview=true;
      chart.renderCandleData();
    }
    if(!this.running)this.date.value=new Date(limits.last*1000).toISOString().slice(0,19);
  }
  previewAt(chart,event){
    const preview=this.previews.get(chart);
    if(!preview)return;
    const rect=chart.container.getBoundingClientRect();
    const x=event.clientX-rect.left,y=event.clientY-rect.top;
    const width=rect.width-chart.chart.priceScale('right').width();
    const height=chart.plotHeight-(chart.chart.timeScale().height?.()||26);
    const scale=chart.chart.timeScale();
    const bar=x>=0&&x<width&&y>=0&&y<height?this.bars(chart)[Math.round(scale.coordinateToLogical(x)??-1)]:null;
    const coordinate=bar?scale.timeToCoordinate(bar.time):null;
    preview.hidden=coordinate===null;
    if(coordinate===null)return;
    preview.style.left=coordinate+'px';
    preview.style.width=Math.max(0,width-coordinate)+'px';
    preview.style.height=height+'px';
    preview.firstElementChild.textContent=new Date(bar.time*1000).toISOString().slice(11,16)+' UTC';
    return bar;
  }
  clearSelection(){
    this.selecting=false;
    this.selectionTargets=null;
    this.selectBar.setAttribute('aria-pressed','false');
    for(const [chart,preview] of this.previews){
      preview.remove();
      chart.container.classList.remove('replay-selecting');
      chart.replayPreview=false;
      chart.renderCandleData();
    }
    this.previews.clear();
  }
  startDefault(random=false){
    const targets=this.chartsForScope();
    const limits=this.limits(targets);
    if(!limits){this.toast('Chưa có dữ liệu đóng nến chung để phát Replay','alert');return false;}
    const active=this.getActive();
    const chart=targets.includes(active)?active:targets[0];
    const bars=this.bars(chart);
    const from=TerminalTime.closedIndex(bars,chart.currentTimeframe,chart.displaySessionMetadata?.()||chart.metadata,limits.first-.001);
    const to=TerminalTime.closedIndex(bars,chart.currentTimeframe,chart.displaySessionMetadata?.()||chart.metadata,limits.last);
    const index=random?from+Math.floor(Math.random()*Math.max(1,to-from-1)):Math.max(from,to-26);
    const clock=this.end(chart,bars[index]);
    return this.go(clock>=limits.first&&clock<=limits.last?clock:limits.first,true,targets);
  }
  go(clock,notify=true,targets=this.chartsForScope()){
    const limits=this.limits(targets);
    if(!limits||!Number.isFinite(clock)||clock<limits.first||clock>limits.last){
      if(notify)this.toast('Mốc này nằm ngoài khoảng nến đã đóng của chart được chọn','alert');
      return false;
    }
    this.pause();
    this.clearSelection();
    this.options.open=false;
    for(const chart of this.targets){
      if(!targets.includes(chart))this.restoreChart(chart);
    }
    this.targets=targets;
    this.clock=clock;
    this.running=true;
    this.refresh(true);
    for(const chart of targets)chart.runner.restart();
    this.persist();
    return true;
  }
  markets(cache){
    const key=this.clock+':'+(this.marketVersion||0);if(this.marketKey===key)return this.marketCache;
    const result={};for(const [symbol,data] of cache){const filtered={metadata:data.metadata};for(const [tf,bars] of Object.entries(data)){if(Array.isArray(bars)&&MarketData.durations[tf])filtered[tf]=bars.slice(0,TerminalTime.closedIndex(bars,tf,data.metadata,this.clock));}result[symbol]=filtered;}
    this.marketKey=key;return this.marketCache=result;
  }
  updatePlayButton(playing) {
    this.play.dataset.playing=String(playing);
    this.play.textContent=ui(playing?'Pause':'Play');
  }
  pause(){clearInterval(this.timer);this.timer=null;this.updatePlayButton(false);}
  toggle(){
    if(this.timer){this.pause();return;}
    if(!this.running&&!this.startDefault())return;
    this.clearSelection();
    this.updatePlayButton(true);
    this.timer=setInterval(()=>this.step(1,false),1000/Number(this.speed.value));
  }
  step(direction,pause=true){
    if(!this.bar.classList.contains('show'))return;
    if(!this.running){this.startDefault();return;}
    if(pause)this.pause();
    this.clearSelection();
    const limits=this.limits(this.targets);
    const times=this.targets.map(chart=>{
      const bars=this.bars(chart);
      const index=TerminalTime.closedIndex(bars,chart.currentTimeframe,chart.displaySessionMetadata?.()||chart.metadata,this.clock-(direction<0?.001:0));
      return this.end(chart,bars[direction>0?index:index-1]);
    }).filter(Number.isFinite);
    const next=direction>0?Math.min(...times):Math.max(...times);
    if(!limits||!Number.isFinite(next)||next<limits.first||next>limits.last||next===this.clock){
      this.pause();
      this.toast(this.boundaryMessage(direction,limits),'alert');
      return;
    }
    this.clock=next;
    this.refresh();
    if(direction<0)for(const chart of this.targets)chart.runner.restart();
    this.persist();
  }
  refresh(focus=false){
    this.updateTimeframe();
    if(!this.running)return;
    for(const chart of this.targets){
      const scale=chart.chart.timeScale();
      const range=scale.getVisibleLogicalRange();
      chart.replayMode=true;
      chart.replayClock=this.clock;
      chart.renderCurrentTimeframe(false);
      if(focus&&chart.bars.length){
        const to=chart.bars.length+5;
        scale.setVisibleLogicalRange({from:to-(range?range.to-range.from:70),to});
      }
      chart.updateCountdown();
    }
    if(document.activeElement!==this.date)this.date.value=new Date(this.clock*1000).toISOString().slice(0,19);
    this.position.dateTime=new Date(this.clock*1000).toISOString();
    this.position.textContent=this.position.dateTime.slice(11,19)+' UTC';
    const limits=this.limits(this.targets);if(limits)this.position.title='Dữ liệu chung đã tải: '+new Date(limits.first*1000).toISOString()+' → '+new Date(limits.last*1000).toISOString();
    this.onChange?.(this);
  }
  persist(){
    if(this.running)Workspace.write('terminal_replay_session_v2',{
      clock:this.clock,scope:this.scope.value,speed:+this.speed.value,
      charts:this.targets.map(chart=>({symbol:chart.symbol,timeframe:chart.currentTimeframe}))
    });
  }
  restoreChart(chart){
    chart.replayMode=false;
    chart.replayClock=null;
    chart.renderCurrentTimeframe(false);
    if(!chart.container.hidden)chart.runner.restart();
  }
  stop(close=true){
    this.persist();
    this.pause();
    this.clearSelection();
    this.running=false;
    this.clock=null;
    for(const chart of this.targets)if(chart.replayMode)this.restoreChart(chart);
    this.targets=[];
    this.position.textContent='';
    if(close){this.bar.classList.remove('show');this.options.open=false;}
    this.onChange?.(this);
  }
}

class TerminalFeatures{
  constructor(ctx){
    Object.assign(this,ctx);this.count=3;this.dragging=false;
    const $=id=>document.getElementById(id);
    $('btn-sync').hidden=true;$('btn-sync').style.display='none';$('btn-settings').hidden=false;
    $('btn-layout').querySelector('span')?.remove();$('btn-layout').setAttribute('aria-label','Layout and synchronization');
    const pop=$('layout-popover');pop.querySelectorAll('.layout-row').forEach(n=>n.remove());
    const layouts=document.createElement('section');
    layouts.className='complete-layouts';
    const layoutHeading=document.createElement('h2');
    layoutHeading.textContent=ui('Chart layout');
    layouts.appendChild(layoutHeading);
    pop.prepend(layouts);
    const saved=Workspace.read('terminal_layout_v2',{count:3,columns:3});
    for(let count=1;count<=3;count++){
      const row=document.createElement('div');row.className='layout-row';const number=document.createElement('span');number.textContent=count;number.className='layout-row-num';row.appendChild(number);
      const choices=count===1?[1]:[count,1];
      for(const columns of choices){const button=document.createElement('button');button.type='button';button.className='layout-choice';button.title=`${count} charts · ${columns} columns`;button.setAttribute('aria-label',button.title);
        button.dataset.layoutKey=`${count}:${columns}`;
        const rows=Math.ceil(count/columns);let rects='';for(let i=0;i<count;i++)rects+=`<rect x="${2+i%columns*24/columns}" y="${2+Math.floor(i/columns)*24/rows}" width="${24/columns-1}" height="${24/rows-1}"/>`;
        button.innerHTML=`<svg viewBox="0 0 28 28" aria-hidden="true">${rects}</svg>`;button.onclick=()=>{this.layout(count,columns);pop.classList.remove('show');};row.appendChild(button);}
      if(count>=3){
        const patterns=[[1,count-1],[count-1,1]];
        for(const axis of ['column','row'])for(const groups of patterns){
          const b=document.createElement('button');b.type='button';b.className='layout-choice';b.title=`${count} charts · ${axis} ${groups.join('+')}`;b.setAttribute('aria-label',b.title);let rects='';
          groups.forEach((size,g)=>{for(let j=0;j<size;j++){const x=axis==='row'?j/size:g/groups.length,y=axis==='row'?g/groups.length:j/size,w=axis==='row'?1/size:1/groups.length,h=axis==='row'?1/groups.length:1/size;rects+=`<rect x="${2+x*24}" y="${2+y*24}" width="${w*24-1}" height="${h*24-1}"/>`;}});
          b.dataset.layoutKey=`${count}:${axis}:${groups.join(',')}`;
          b.innerHTML=`<svg viewBox="0 0 28 28" aria-hidden="true">${rects}</svg>`;b.onclick=()=>{this.layout(count,1,true,{groups,axis});pop.classList.remove('show');};row.appendChild(b);
        }
      }
      layouts.appendChild(row);
    }
    const settings=document.createElement('section');
    settings.className='layout-sync-settings';
    const syncHeading=document.createElement('h2');
    syncHeading.textContent=ui('Sync in layout');
    settings.appendChild(syncHeading);
    for(const [key,label] of Object.entries({symbol:'Symbol',interval:'Interval',crosshair:'Crosshair',time:'Time',dateRange:'Date range'})){
      const row=document.createElement('label');const caption=document.createElement('span');caption.textContent=ui(label);const info=document.createElement('span');info.className='sync-info';info.textContent='i';info.setAttribute('aria-hidden','true');info.title={symbol:'Use the same symbol on all charts',interval:'Use the same timeframe on all charts',crosshair:'Show the crosshair at the same time on all charts',time:'Synchronize the visible time position',dateRange:'Synchronize the visible date range'}[key];caption.append(' ',info);row.appendChild(caption);const input=document.createElement('input');input.type='checkbox';input.setAttribute('role','switch');input.checked=this.sync.options[key];input.setAttribute('aria-label','Sync '+label);input.onchange=()=>{this.sync.options[key]=input.checked;Workspace.write('terminal_sync_options_v1',this.sync.options);};row.appendChild(input);settings.appendChild(row);
    }
    document.body.classList.toggle('icon-labels-only',Workspace.read('terminal_compact_labels_v1',false));pop.appendChild(settings);
    for(const button of document.querySelectorAll('.topbar-left button,.topbar-right button')){
      if(button.closest('#timeframe-menu')||button.classList.contains('tf-btn')||button.id==='btn-layout'||button.id==='btn-sync'||button.id==='reload-chart-data'||button.id==='live-tz'||button.closest('#clock-timezone-menu')||button.id==='btn-indicator')continue;
      const text=button.textContent.trim(),label=/[a-zA-ZÀ-ỹ]/.test(text)?text:button.getAttribute('aria-label')||button.title||text;if(!label)continue;
      if(!button.querySelector('svg'))button.prepend(this.icon(button.id||(button.classList.contains('toolbar-more')?'more':'')));
      for(const node of [...button.childNodes])if(node.nodeType===3){const span=document.createElement('span');span.textContent=node.textContent;node.replaceWith(span);}
      button.dataset.label=label;button.setAttribute('aria-label',label);
    }
    const cursor=document.querySelector('[data-tool="crosshair"]');if(cursor)cursor.innerHTML=TerminalIcons.svg('crosshair');
    this.installFavorites();
    this.installPolish();
    this.companions=new TerminalCompanions({getReplay:this.getReplay,getActive:this.getActive});
    const sensor=document.createElement('div');sensor.id='fullscreen-timeframe';const group=document.querySelector('.timeframe-group'),anchor=document.createComment('timeframe-home');group.before(anchor);document.body.appendChild(sensor);
    sensor.hidden=true;
    document.addEventListener('fullscreenchange',()=>{
      const full=!!document.fullscreenElement;
      document.body.classList.toggle('terminal-fullscreen',full);
      if(full)sensor.appendChild(group);
      else anchor.after(group);
      sensor.hidden=!full;
      const favouritesHome=full?document.body:document.getElementById('left-sidebar');
      favouritesHome.appendChild(this.favoriteBar);
      document.getElementById('favorite-tool-menu').hidden=true;
      this.favoriteBar.querySelector('[data-manage-favourites]')?.setAttribute('aria-expanded','false');
      document.querySelectorAll('.toolbar-overflow').forEach(menu=>menu.hidden=true);
    });
    const restoredCount=Math.min(3,Math.max(1,saved.count||3));
    this.layout(restoredCount,saved.count>3?3:Math.min(restoredCount,Math.max(1,saved.columns||3)),false,saved.count>3?null:saved.shape||null);
    for(const c of this.charts){c.appearance.countdown=true;c.updateCountdown();}
    window.addEventListener('resize',()=>this.clampFavorites());
  }
  icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.classList.add('tt-icon');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',name==='more'?'M4 12h.1M12 12h.1M20 12h.1':name==='btn-indicator-settings'?'M4 8h6.8m4.4 0H20M4 16h2.8m4.4 0H20M10.8 8a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0M6.8 16a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0':name?.includes('redo')?'M4 12h16m-6-6 6 6-6 6':'M20 12H4m6-6-6 6 6 6');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width',name==='more'?'3':'1.6');path.setAttribute('stroke-linecap','round');svg.appendChild(path);return svg;}
  visibleCharts(){return this.charts.slice(0,this.count);}
  layout(count,columns,persist=true,shape=null){
    if(!shape&&count>columns&&count%columns)shape={axis:'row',groups:Array.from({length:Math.ceil(count/columns)},(_,i)=>Math.min(columns,count-i*columns))};
    const selectedKey=shape?`${count}:${shape.axis}:${shape.groups.join(',')}`:`${count}:${columns}`;
    document.querySelectorAll('.layout-choice').forEach(button=>{const active=button.dataset.layoutKey===selectedKey;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    this.count=count;const grid=document.getElementById('chart-grid');grid.className='terminal-layout';grid.style.display='grid';grid.style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;grid.style.gridTemplateRows=`repeat(${Math.ceil(count/columns)},minmax(0,1fr))`;delete grid.dataset.expanded;
    const replay=this.getReplay?.();
    if(replay?.selecting)replay.clearSelection();
    if(replay?.running){
      if(replay.scope.value==='all'){
        const targets=this.visibleCharts(),limits=replay.limits(targets);
        if(limits&&replay.clock>=limits.first&&replay.clock<=limits.last){
          for(const chart of replay.targets)if(!targets.includes(chart))replay.restoreChart(chart);
          replay.targets=targets;
        }else replay.stop();
      }else if(!this.visibleCharts().includes(replay.targets[0]))replay.stop();
    }
    grid.style.gridTemplateAreas='none';for(const c of this.charts)c.container.style.gridArea='auto';
    if(shape){const gcd=(a,b)=>b?gcd(b,a%b):a,units=shape.groups.reduce((a,b)=>a*b/gcd(a,b),1);let index=0;const areas=shape.groups.map(size=>{const row=[];for(let j=0;j<size;j++)for(let k=0;k<units/size;k++)row.push('c'+(index+j));index+=size;return row;});
      const matrix=shape.axis==='row'?areas:Array.from({length:units},(_,i)=>areas.map(r=>r[i]));grid.style.gridTemplateAreas=matrix.map(row=>'"'+row.join(' ')+'"').join(' ');grid.style.gridTemplateRows=`repeat(${matrix.length},minmax(0,1fr))`;grid.style.gridTemplateColumns=`repeat(${matrix[0].length},minmax(0,1fr))`;this.charts.slice(0,count).forEach((c,i)=>c.container.style.gridArea='c'+i);
    }
    this.charts.forEach((c,i)=>{c.container.hidden=i>=count;c.container.style.display=i<count?'block':'none';if(i<count){this.hydrate(c);c.runner.restart();}else c.runner.stop();});
    if(!this.visibleCharts().includes(this.getActive()))this.activate(this.charts[0]);
    replay?.refresh();
    this.installChartDividers(grid,this.visibleCharts().map(chart=>chart.container));
    if(persist){Workspace.write('terminal_layout_v2',{count,columns,shape});this.saveWorkspace();this.subscribe();}
  }
  installFavorites(){
    this.favorites=Workspace.read('terminal_drawing_favorites_v1',[]);if(!Array.isArray(this.favorites))this.favorites=[];
    const bar=document.createElement('div');bar.id='drawing-favorites';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Favorite drawing tools');this.favoriteBar=bar;document.getElementById('left-sidebar').appendChild(bar);
    const draw=()=>{document.querySelectorAll('#left-sidebar .favorite-star').forEach(star=>{
      const selected=this.favorites.includes(star.previousElementSibling?.dataset.tool);
      star.textContent=selected?'★':'☆';
      star.setAttribute('aria-pressed',String(selected));
      star.title=selected?'Remove from Favourites':'Add to Favourites';
    });bar.replaceChildren();
      const manage=document.createElement('button');manage.type='button';manage.textContent='☆';manage.className='tool-btn';manage.dataset.manageFavourites='true';manage.setAttribute('aria-label','Manage favourite drawing tools');manage.setAttribute('aria-controls','favorite-tool-menu');manage.setAttribute('aria-expanded',String(!menu.hidden));manage.onclick=()=>menu.hidden?this.openFavorites(manage.getBoundingClientRect()):closeMenu();bar.appendChild(manage);
      for(const key of this.favorites){const original=document.querySelector(`#left-sidebar [data-tool="${CSS.escape(key)}"]`);if(!original)continue;const b=original.cloneNode(true);b.removeAttribute('id');b.querySelector('.favorite-star')?.remove();b.onclick=()=>this.drawing.setTool(key);b.oncontextmenu=e=>{e.preventDefault();this.favorites=this.favorites.filter(x=>x!==key);Workspace.write('terminal_drawing_favorites_v1',this.favorites);draw();};bar.appendChild(b);}bar.hidden=false;this.clampFavorites();};
    this.renderFavorites=draw;bar.dataset.orientation='vertical';
    const menu=document.createElement('section');menu.id='favorite-tool-menu';menu.hidden=true;menu.setAttribute('aria-label',ui('Favourite tools'));document.body.appendChild(menu);
    const manageButton=()=>bar.querySelector('[data-manage-favourites]');
    const closeMenu=(restoreFocus=false)=>{
      menu.hidden=true;
      manageButton()?.setAttribute('aria-expanded','false');
      if(restoreFocus)manageButton()?.focus();
    };
    const positionMenu=(x,y,above=true)=>{
      menu.hidden=false;
      const width=menu.offsetWidth,height=menu.offsetHeight;
      menu.style.left=Math.max(8,Math.min(innerWidth-width-8,x))+'px';
      menu.style.top=Math.max(8,Math.min(innerHeight-height-8,above?y-height-10:y))+'px';
      manageButton()?.setAttribute('aria-expanded','true');
    };
    const names={crosshair:'Con trỏ',line:'Đường xu hướng',hline:'Đường ngang',vline:'Đường dọc',box:'Hộp Order Block / Range',text:'Ghi chú',fib:'Fibonacci Retracement',position:'Vị thế Long',short_position:'Vị thế Short',measure:'Đo giá và số nến',brush:'Cọ vẽ'};
    this.openFavorites=rect=>{
      menu.replaceChildren();
      const header=document.createElement('header');
      const title=document.createElement('strong');title.textContent=ui('Favourite tools');
      const count=document.createElement('span');count.className='favourite-picker-count';
      header.append(title,count);
      const list=document.createElement('div');list.className='favourite-picker-list';
      menu.append(header,list);
      const updateCount=()=>{count.textContent=this.favorites.length+(TerminalLanguage.language==='vi'?' đã ghim':' pinned');};
      const seen=new Set();
      for(const tool of document.querySelectorAll('#left-sidebar [data-tool]')){
        const key=tool.dataset.tool;
        if(!names[key]||seen.has(key))continue;
        seen.add(key);
        const button=document.createElement('button');button.type='button';button.className='favourite-picker-row';
        const icon=tool.querySelector('svg')?.cloneNode(true);
        if(icon){icon.setAttribute('aria-hidden','true');button.append(icon);}
        const name=document.createElement('span');name.textContent=ui(names[key]);button.append(name);
        const shortcut=(tool.title||tool.getAttribute('aria-label')||'').match(/\(([^()]+)\)$/)?.[1];
        if(shortcut){const hint=document.createElement('kbd');hint.textContent=shortcut;button.append(hint);}
        const star=document.createElement('span');star.className='favourite-picker-star';star.setAttribute('aria-hidden','true');button.append(star);
        const update=()=>{
          const pinned=this.favorites.includes(key);
          button.setAttribute('aria-pressed',String(pinned));
          star.textContent=pinned?'★':'☆';
        };
        button.onclick=()=>{
          this.favorites=this.favorites.includes(key)?this.favorites.filter(value=>value!==key):[...this.favorites,key];
          Workspace.write('terminal_drawing_favorites_v1',this.favorites);
          update();updateCount();draw();
          const anchor=manageButton()?.getBoundingClientRect();
          if(anchor)positionMenu(anchor.left,anchor.top);
        };
        update();list.append(button);
      }
      updateCount();
      positionMenu(rect.left,rect.top);
      list.querySelector('button')?.focus({preventScroll:true});
    };
    for(const b of document.querySelectorAll('#left-sidebar [data-tool]')){
      if(['trash','lock','hide','eye','magnet'].includes(b.dataset.tool))continue;
      const star=document.createElement('button');star.className='favorite-star';star.type='button';star.textContent=this.favorites.includes(b.dataset.tool)?'★':'☆';star.title='Toggle favourite';star.setAttribute('aria-label','Favourite '+(b.title||b.dataset.tool));const slot=document.createElement('div');slot.className='drawing-favourite-slot';b.before(slot);slot.append(b,star);star.onclick=e=>{e.stopPropagation();const key=b.dataset.tool;this.favorites=this.favorites.includes(key)?this.favorites.filter(x=>x!==key):[...this.favorites,key];Workspace.write('terminal_drawing_favorites_v1',this.favorites);draw();};
      b.addEventListener('contextmenu',e=>{e.preventDefault();const key=b.dataset.tool;menu.replaceChildren();const toggle=document.createElement('button');toggle.textContent=this.favorites.includes(key)?'★ Remove favourite':'☆ Add favourite';toggle.onclick=()=>{this.favorites=this.favorites.includes(key)?this.favorites.filter(x=>x!==key):[...this.favorites,key];Workspace.write('terminal_drawing_favorites_v1',this.favorites);menu.hidden=true;draw();};menu.appendChild(toggle);menu.style.left=Math.min(innerWidth-180,e.clientX)+'px';menu.style.top=Math.min(innerHeight-50,e.clientY)+'px';menu.hidden=false;});
    }
    document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!e.target.closest('[data-manage-favourites]'))closeMenu();});
    menu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenu(true);}});
    draw();
  }
  draggable(handle,bar){handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();this.justDragged=false;handle.setPointerCapture(e.pointerId);const r=bar.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top,x=e.clientX,y=e.clientY;handle.onpointermove=m=>{if(Math.hypot(m.clientX-x,m.clientY-y)<4&&!this.justDragged)return;this.justDragged=true;bar.style.left=Math.max(0,Math.min(innerWidth-bar.offsetWidth,m.clientX-dx))+'px';bar.style.top=Math.max(0,Math.min(innerHeight-bar.offsetHeight,m.clientY-dy))+'px';};handle.onpointerup=()=>{handle.onpointermove=null;Workspace.write('terminal_favorites_position_v1',{x:parseFloat(bar.style.left),y:parseFloat(bar.style.top)});};handle.onpointercancel=()=>{handle.onpointermove=null;};};}
  clampFavorites(){const b=this.favoriteBar;if(!b||b.hidden)return;b.style.left=Math.max(0,Math.min(innerWidth-b.offsetWidth,parseFloat(b.style.left)||0))+'px';b.style.top=Math.max(0,Math.min(innerHeight-b.offsetHeight,parseFloat(b.style.top)||0))+'px';}
}
if(typeof module!=='undefined')module.exports={TerminalTime,TerminalReplay};
