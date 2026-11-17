'use strict';
const TerminalMusicLinks={
  parse(text){
    let u;try{u=new URL(text.trim());}catch{throw Error('Paste a full music or playlist link.');}
    if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Use an official HTTPS provider link.');
    const host=u.hostname.replace(/^www\./,''),path=u.pathname.split('/').filter(Boolean);
    if(/\.(mp3|m4a|aac|wav|ogg|opus|flac|weba)$/i.test(u.pathname))return {provider:'audio',url:u.href};
    if(['youtube.com','m.youtube.com','music.youtube.com','youtu.be'].includes(host)){
      const id=host==='youtu.be'?path[0]:['shorts','embed','live'].includes(path[0])?path[1]:u.searchParams.get('v'),list=u.searchParams.get('list');
      if((!id||!/^[\w-]{11}$/.test(id))&&(!list||!/^[\w-]{10,100}$/.test(list)))throw Error('Use a YouTube video or playlist link.');
      const validId=id&&/^[\w-]{11}$/.test(id)?id:null;
      const validList=list&&/^[\w-]{10,100}$/.test(list)?list:null;
      return {provider:'youtube',id:validId,list:validList,url:validId?'https://www.youtube.com/watch?v='+validId+(validList?'&list='+validList:''):'https://www.youtube.com/playlist?list='+validList};
    }
    if(['vm.tiktok.com','vt.tiktok.com','on.soundcloud.com','spotify.link'].includes(host)&&path.length)return {share:true,url:u.href};
    if(host==='tiktok.com'&&path[0]==='t'&&path.length===2)return {share:true,url:'https://www.tiktok.com/t/'+path[1]+'/'};
    if(host==='open.spotify.com'){
      if(/^intl-/.test(path[0]))path.shift();if(path[0]==='embed')path.shift();const [type,id]=path;
      if(!['track','playlist','album','episode','show'].includes(type)||!/^[a-zA-Z0-9]{22}$/.test(id||''))throw Error('Use a Spotify track, album or playlist link.');
      return {provider:'spotify',id,type,url:`https://open.spotify.com/${type}/${id}`,uri:`spotify:${type}:${id}`};
    }
    if(['soundcloud.com','m.soundcloud.com'].includes(host)&&path.length>=2&&!['discover','search','you'].includes(path[0]))return {provider:'soundcloud',url:'https://soundcloud.com/'+path.join('/')+(u.searchParams.get('secret_token')?'?'+new URLSearchParams({secret_token:u.searchParams.get('secret_token')}):'')};
    if(['tiktok.com','m.tiktok.com'].includes(host)&&path[0]==='music')throw Error('Paste a TikTok post link. Sound pages need a post that uses the sound.');
    if(['tiktok.com','m.tiktok.com'].includes(host)){
      const post=u.pathname.match(/^\/(@[^/]+\/(?:video|photo)\/(\d{10,25}))\/?$/);
      if(post)return {provider:'tiktok',id:post[2],url:'https://www.tiktok.com/'+post[1]};
    }
    if(host==='tiktok.com'&&path[0]==='player'&&path[1]==='v1'&&/^\d{10,25}$/.test(path[2]||''))return {provider:'tiktok',id:path[2],url:'https://www.tiktok.com/player/v1/'+path[2]};
    throw Error('Use a YouTube, Spotify, SoundCloud or TikTok video link.');
  }
};
class TerminalCompanions{
  constructor(ctx){
    Object.assign(this,ctx);this.calendarData=null;this.playing=false;this.epoch=0;this.currentTrack='';this.impacts=new Set(Workspace.read('terminal_calendar_impacts_v1',['High','Medium','Low']));this.currency=Workspace.read('terminal_calendar_currency_v1','USD');
    const savedProtocols=Workspace.read('terminal_protocol_events_v1',[]);this.protocolEvents=Array.isArray(savedProtocols)?savedProtocols:[];
    this.dock=document.createElement('aside');this.dock.id='terminal-edge-dock';this.dock.setAttribute('aria-label','Calendar and music');(document.getElementById('right-sidebar')||document.body).appendChild(this.dock);
    this.panels={};for(const [key,title,path] of [['calendar','Calendar','M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 14h2m4 0h2M8 17h2'],['music','Music','M10 5.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15ZM10 11.25a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 1 0 0-3.5ZM6.1 11.3A4.25 4.25 0 0 1 10 8.75M20.5 3.5v7l-2 3.5']]){
      const button=document.createElement('button');button.className='edge-handle';button.id='edge-'+key;button.type='button';button.setAttribute('aria-label',ui(title));button.dataset.dockLabel=ui(title);button.setAttribute('aria-expanded','false');button.innerHTML=`<span>${title}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;TerminalLanguage.markup(button);this.dock.appendChild(button);
      const panel=document.createElement('section');panel.id=key+'-panel';panel.className='companion-panel';panel.inert=true;panel.setAttribute('aria-label',title);panel.innerHTML=`<header><h2>${title==='Calendar'?'Economic Calendar':title}</h2><button type="button" aria-label="Close ${title}">×</button></header>`;panel.querySelector('button').onclick=()=>this.toggle(key,false);TerminalLanguage.markup(panel);document.body.appendChild(panel);this.panels[key]=panel;button.onclick=()=>this.toggle(key);
    }
    this.buildCalendar();this.buildMusic();this.loadCalendar();this.tick=setInterval(()=>{this.syncDockWidth();if(this.open==='calendar')this.renderCalendar();this.loadCalendar();this.updateMusic();},1000);this.syncDockWidth();
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(this.protocolLightbox&&!this.protocolLightbox.hidden){this.protocolLightbox.hidden=true;return;}if(this.open&&!e.target.closest('.modal'))this.toggle(this.open,false);}});
  }
  syncDockWidth(){
    const axis=this.getActive?.()?.chart?.priceScale('right').width()||65;
    const width=Math.max(18,axis*.3);
    if(width===this.edgeWidth)return;
    this.edgeWidth=width;
    this.dock.style.setProperty('--edge-width',width+'px');
    const inset=Math.max(30,width+8)+'px';
    for(const panel of Object.values(this.panels)){
      panel.style.setProperty('--companion-inset',inset);
      panel.style.right=inset;
    }
  }
  toggle(key,force){
    const show=force??this.open!==key;
    if(show&&this.open&&this.open!==key){
      if(this.open==='music'&&this.link)this.setMusicMini(true,false);
      else this.toggle(this.open,false);
    }
    if(key==='music'){
      this.panels.music.classList.remove('music-mini');
      this.updateMusicPopupButton();
      if(!show){
        this.tabAudioRequest++;
        this.stopTabAudio();
        this.command('pause');
        if(this.iframe&&['youtube','soundcloud','spotify'].includes(this.link?.provider)&&!this.youtube&&!this.widget&&!this.spotify){
          this.iframe.remove();
          this.iframe=null;
          this.epoch++;
          clearTimeout(this.playerReadyTimer);
          this.setPlaying(false);
          this.setCommands(false);
          this.musicNotice.textContent='Bấm Load để mở lại trình phát.';
        }
      }
    }
    this.panels[key].classList.toggle('open',show);this.panels[key].inert=!show;document.getElementById('edge-'+key).setAttribute('aria-expanded',String(show));
    if(show)this.open=key;
    else if(this.open===key)this.open=null;
    if(key==='calendar'&&show)this.renderCalendar();
  }
  setMusicMini(mini,focus=true){
    if(!this.link)return;
    if(!mini){
      this.toggle('music',true);
    }else{
      this.panels.music.classList.add('music-mini','open');
      this.setVideoHidden(false);
      this.placeVideoPopup();
      if(this.open==='music')this.open=null;
      this.updateMusicPopupButton();
    }
    if(focus)(mini&&this.isVideoProvider()&&this.iframe?this.popupGrip:this.popupButton).focus();
  }
  isVideoProvider(){return ['youtube','tiktok'].includes(this.link?.provider);}
  setVideoHidden(hidden){
    if(!this.hideVideoButton)return;
    const panel=this.panels.music;
    const enabled=this.isVideoProvider()&&!!this.iframe;
    panel.classList.toggle('music-video-hidden',enabled&&hidden);
    if(this.link?.provider==='tiktok'&&this.iframe)this.iframe.tabIndex=hidden?-1:0;
    this.hideVideoButton.hidden=!enabled;
    this.hideVideoButton.textContent=ui(hidden?'Show video':'Hide video');
    this.hideVideoButton.setAttribute('aria-pressed',String(enabled&&hidden));
  }
  placeVideoPopup(position=this.videoPopupPosition){
    const panel=this.panels.music;
    if(!panel.classList.contains('music-mini')||!this.isVideoProvider()||!position)return;
    const x=Math.max(4,Math.min(position.x,innerWidth-panel.offsetWidth-4));
    const y=Math.max(30,Math.min(position.y,innerHeight-panel.offsetHeight-4));
    this.videoPopupPosition={x,y};
    panel.dataset.floatingPosition='';
    panel.style.setProperty('--music-left',x+'px');
    panel.style.setProperty('--music-top',y+'px');
  }
  resizeVideoPopup(){
    this.panels.music.classList.toggle('music-mini-large');
    this.placeVideoPopup();
  }
  installVideoPopup(panel){
    const rail=document.createElement('div');rail.className='video-popup-tools';
    const button=(symbol,label,action)=>{
      const element=document.createElement('button');
      element.type='button';element.textContent=symbol;element.title=ui(label);
      element.setAttribute('aria-label',element.title);
      if(action)element.onclick=action;
      rail.appendChild(element);return element;
    };
    const grip=this.popupGrip=button('⠿','Drag popup',null);
    button('⤢','Resize popup',()=>this.resizeVideoPopup());
    button('↗','Expand',()=>this.setMusicMini(false));
    button('×','Close popup',()=>this.toggle('music',false));
    panel.appendChild(rail);
    let drag;
    grip.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      const rect=panel.getBoundingClientRect();
      drag={pointer:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};
      grip.setPointerCapture(event.pointerId);
    });
    grip.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.pointer)return;
      this.placeVideoPopup({x:event.clientX-drag.dx,y:event.clientY-drag.dy});
    });
    grip.addEventListener('lostpointercapture',()=>{drag=null;});
    rail.addEventListener('dblclick',event=>{if(event.target===rail||event.target===grip)this.resizeVideoPopup();});
    grip.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();this.resizeVideoPopup();return;}
      const delta={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];
      if(delta){event.preventDefault();const rect=panel.getBoundingClientRect();this.placeVideoPopup({x:rect.left+delta[0],y:rect.top+delta[1]});}
    });
    window.addEventListener('resize',()=>this.placeVideoPopup());
  }
  updateMusicPopupButton(){
    const mini=this.panels.music.classList.contains('music-mini');
    this.popupButton.textContent=mini?ui('Expand'):'Popup';
    this.popupButton.setAttribute('aria-label',mini?'Mở rộng trình phát':'Thu nhỏ trình phát thành cửa sổ nổi');
    this.popupButton.setAttribute('aria-pressed',String(mini));
  }
  buildCalendar(){
    const panel=this.panels.calendar,filters=document.createElement('div');filters.className='calendar-filters';
    for(const impact of ['High','Medium','Low']){const button=document.createElement('button');button.textContent=ui(impact);button.dataset.impact=impact;button.type='button';button.onclick=()=>{if(this.impacts.has(impact))this.impacts.delete(impact);else this.impacts.add(impact);Workspace.write('terminal_calendar_impacts_v1',[...this.impacts]);this.renderCalendar();};filters.appendChild(button);}
    const currency=document.createElement('select');currency.setAttribute('aria-label','Calendar currency');for(const name of ['All','USD','EUR','GBP','JPY','CAD','AUD','NZD','CHF','CNY'])currency.add(new Option(name,name));currency.value=this.currency;currency.onchange=()=>{this.currency=currency.value;Workspace.write('terminal_calendar_currency_v1',this.currency);this.renderCalendar();};filters.appendChild(currency);panel.appendChild(filters);this.calendarFilters=filters;
    this.calendarList=document.createElement('div');this.calendarList.className='calendar-list';panel.appendChild(this.calendarList);this.calendarStatus=document.createElement('footer');panel.appendChild(this.calendarStatus);
  }
  async loadCalendar(){
    if(this.getReplay?.()?.running||this.calendarLoading||Date.now()<(this.calendarNextCheck||0))return;
    this.calendarLoading=true;
    try{
      const response=await fetch('/api/calendar');
      if(!response.ok)throw Error('Calendar service unavailable');
      this.calendarData=await response.json();
      this.calendarNextCheck=Math.max(Date.now()+60000,this.calendarData.next_check_at*1000||Date.now()+900000);
    }catch(error){
      this.calendarNextCheck=Date.now()+60000;
      this.calendarData={...this.calendarData,error:error.message};
    }finally{
      this.calendarLoading=false;
      this.renderCalendar();
    }
  }
  renderCalendar(){
    const replay=!!this.getReplay?.()?.running;
    this.calendarFilters.hidden=replay;
    const data=this.calendarData;
    const now=new Date();
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    const rawEvents=replay?[]:data?.events||[];
    const events=rawEvents.filter(event=>
      this.impacts.has(event.impact)&&(this.currency==='All'||event.currency===this.currency)&&event.time*1000>=+today);
    if(!replay&&data&&data!==this.calendarSyncedData&&typeof NewsProtocols!=='undefined'){
      this.calendarSyncedData=data;
      const archived=Array.isArray(this.protocolEvents)?this.protocolEvents:Array.isArray(this.news?.events)?this.news.events:[];
      const merged=NewsProtocols.merge(archived,rawEvents,+now/1000);
      this.protocolEvents=merged;
      if(this.news)this.news.events=merged;
      if(merged.length)Workspace.write('terminal_protocol_events_v1',merged);
    }
    const protocolEnabled=!replay&&typeof NewsProtocols!=='undefined'&&(this.currency==='All'||this.currency==='USD');
    const protocolEvents=protocolEnabled?NewsProtocols.merge(this.protocolEvents||this.news?.events||[],rawEvents,+now/1000):[];
    const next=events.find(event=>!event.tentative&&event.time*1000>+now);
    const nextToday=events.find(event=>event.time*1000>+now&&event.time*1000<+tomorrow);
    const key=JSON.stringify([replay,this.currency,[...this.impacts],data?.checked_at,data?.error,+today,next?.time,nextToday?.time,protocolEnabled?[protocolEvents.length,protocolEvents[0]?.time,protocolEvents.at(-1)?.time]:0]);
    this.calendarTimeFormat??=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    if(key!==this.calendarRenderKey){
      this.calendarRenderKey=key;
      const scroll=this.calendarList.scrollTop;
      this.calendarList.replaceChildren();
      this.calendarStatus.replaceChildren();
      this.calendarStatus.removeAttribute('title');
      this.calendarNow=null;
      this.calendarCountdown=null;
      for(const button of this.calendarFilters.querySelectorAll('button')){
        button.setAttribute('aria-pressed',String(this.impacts.has(button.dataset.impact)));
      }
      if(replay){
        const empty=document.createElement('div');
        empty.className='calendar-unavailable';
        empty.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v16H4zM8 2v6m8-6v6M4 11h16M2 2l20 20"/></svg><p>Unavailable in Replay</p>';
        this.calendarList.appendChild(empty);
        this.calendarStatus.textContent='Return to Live to view the economic calendar.';
      }else if(!data){
        this.calendarList.textContent='Loading economic events…';
      }else{
        this.buildCalendarList(events,next,nextToday,today,tomorrow,protocolEvents,protocolEnabled);
      }
      this.calendarList.scrollTop=scroll;
    }
    if(this.calendarNow){
      const label='NOW · '+this.calendarTimeFormat.format(now);
      if(this.calendarNow.textContent!==label)this.calendarNow.textContent=label;
    }
    if(this.calendarCountdown&&next){
      const minutes=Math.ceil((next.time*1000-+now)/60000);
      const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;
      const label='in '+[days&&days+'d',hours&&hours+'h',mins&&mins+'m'].filter(Boolean).join(' ');
      if(this.calendarCountdown.textContent!==label)this.calendarCountdown.textContent=label;
    }
    if(!replay)this.loadCalendar();
  }
  buildCalendarList(events,next,nextToday,today,tomorrow,protocolEvents=[],protocolEnabled=false){
    const data=this.calendarData;
    const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const todayIso=iso(today),tomorrowIso=iso(tomorrow);
    const groups=new Map([[todayIso,{date:today,events:[],cards:[],checked:false}]]);
    for(const event of events){
      const ed=new Date(event.time*1000),day=new Date(ed.getFullYear(),ed.getMonth(),ed.getDate()),k=iso(day);
      if(!groups.has(k))groups.set(k,{date:day,events:[],cards:[],checked:false});
      groups.get(k).events.push(event);
    }
    if(protocolEnabled&&protocolEvents.length){
      const limit=+today+21*86400000;
      let maxMs=+today;
      for(const event of protocolEvents)if(event.time*1000>=+today&&event.time*1000<=limit)maxMs=Math.max(maxMs,event.time*1000);
      const endMs=Math.min(limit,maxMs+5*86400000);
      for(let d=new Date(today);+d<=endMs;d.setDate(d.getDate()+1)){
        const k=iso(d),cards=NewsProtocols.matchDay(protocolEvents,k);
        if(cards.length){
          if(!groups.has(k))groups.set(k,{date:new Date(d),events:[],cards,checked:true});
          else Object.assign(groups.get(k),{cards,checked:true});
        }else if(groups.has(k)){
          groups.get(k).checked=true;
        }
      }
      for(const [k,entry] of groups)if(!entry.checked){entry.cards=NewsProtocols.matchDay(protocolEvents,k);entry.checked=true;}
    }
    const dateFormat=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'});
    this.calendarNow=document.createElement('div');
    this.calendarNow.className='calendar-now';
    for(const [dayIso,entry] of [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
      const heading=document.createElement('h3');
      heading.textContent=dayIso===todayIso?ui('Today'):dayIso===tomorrowIso?ui('Tomorrow'):dateFormat.format(entry.date);
      this.calendarList.appendChild(heading);
      if(entry.cards.length){
        const box=document.createElement('div');
        box.className='calendar-day-protocols';
        for(const card of entry.cards)box.appendChild(this.buildCalendarProtocol(card,dayIso,dateFormat));
        this.calendarList.appendChild(box);
      }
      for(const event of entry.events){
        if(event===nextToday)this.calendarList.appendChild(this.calendarNow);
        this.calendarList.appendChild(this.buildCalendarEvent(event));
        if(event===next){
          this.calendarCountdown=document.createElement('div');
          this.calendarCountdown.className='calendar-countdown';
          this.calendarList.appendChild(this.calendarCountdown);
        }
      }
      if(dayIso===todayIso&&!nextToday)this.calendarList.appendChild(this.calendarNow);
    }
    if(!events.length){
      const message=document.createElement('p');
      message.className='calendar-message';
      message.textContent=data.error?'Calendar data is temporarily unavailable.':'No upcoming events match these filters.';
      this.calendarList.appendChild(message);
    }
    const updated=Number.isFinite(data.updated_at)
      ?' · Updated '+dateFormat.format(new Date(data.updated_at*1000))+' '+this.calendarTimeFormat.format(new Date(data.updated_at*1000)):'';
    this.calendarStatus.append((updated?updated.slice(3)+' · ':'')+'Times on this computer'+(data.error&&events.length?' · Showing cached data':''));
    this.calendarStatus.title=data.notice||'';
  }
  buildCalendarProtocol(card,dayIso,dateFormat){
    const item=document.createElement('article');
    item.className='calendar-protocol-card';
    item.dataset.protocol=card.id;
    item.title=card.reasons?.join('\n')||card.title;
    const info=document.createElement('div');
    info.className='calendar-protocol-info';
    const head=document.createElement('div');
    head.className='calendar-protocol-head';
    const title=document.createElement('strong');
    title.textContent=card.title;
    head.appendChild(title);
    const evts=card.events||[];
    const hasShifted=evts.some(e=>{
      if(!dayIso||!Number.isFinite(e?.time))return false;
      const d=new Date(e.time*1000);
      const localDay=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return localDay!==dayIso;
    });
    const tagText=card.id.endsWith('-after')?'Sau tin':card.id.endsWith('-before')?'Trước tin':card.id==='nfp-week'?'Tuần NFP':hasShifted?'Phiên NY':'';
    if(tagText){
      const tag=document.createElement('span');
      tag.className='calendar-protocol-tag';
      tag.textContent=tagText;
      head.appendChild(tag);
    }
    const list=document.createElement('div');
    list.className='calendar-protocol-events';
    const dayFmt=dateFormat||new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'});
    for(const e of evts){
      const row=document.createElement('div');
      row.className='calendar-protocol-event';
      const dot=document.createElement('i');
      if(e.impact)dot.dataset.impact=e.impact;
      const when=document.createElement('span');
      when.className='calendar-protocol-when';
      if(Number.isFinite(e.time)){
        const d=new Date(e.time*1000);
        const localDay=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const clock=e.tentative?'TBD':(this.calendarTimeFormat?this.calendarTimeFormat.format(d):'');
        when.textContent=localDay!==dayIso?`${clock} (${dayFmt.format(d)})`:clock;
      }
      const cur=document.createElement('b');
      cur.textContent=e.currency||'USD';
      const name=document.createElement('span');
      name.className='calendar-protocol-name';
      name.textContent=e.title||'';
      row.append(dot,when,cur,name);
      const vals=[e.actual&&'A '+e.actual,e.forecast&&'F '+e.forecast,e.previous&&'P '+e.previous].filter(Boolean).join(' · ');
      if(vals){
        const nums=document.createElement('small');
        nums.textContent=vals;
        row.appendChild(nums);
      }
      list.appendChild(row);
    }
    info.append(head,list);
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='calendar-protocol-thumb';
    btn.setAttribute('aria-label','Enlarge '+card.title);
    const img=document.createElement('img');
    img.src='assets/news-protocols/'+card.id+'.png';
    img.alt=card.title;
    btn.appendChild(img);
    btn.onclick=()=>this.openProtocolLightbox(card);
    item.append(info,btn);
    return item;
  }
  openProtocolLightbox(card){
    if(!this.protocolLightbox){
      const overlay=document.createElement('div');
      overlay.className='calendar-protocol-lightbox';
      overlay.hidden=true;
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.innerHTML='<div class="calendar-protocol-dialog"><header><strong></strong><button type="button" aria-label="Close protocol image">×</button></header><img></div>';
      overlay.onclick=e=>{if(e.target===overlay)overlay.hidden=true;};
      overlay.querySelector('button').onclick=()=>overlay.hidden=true;
      document.body.appendChild(overlay);
      this.protocolLightbox=overlay;
    }
    this.protocolLightbox.querySelector('strong').textContent=card.title+(card.events?.length?' · '+card.events.map(e=>e.title).join(', '):'');
    const img=this.protocolLightbox.querySelector('img');
    img.src='assets/news-protocols/'+card.id+'.png';
    img.alt=card.title;
    this.protocolLightbox.hidden=false;
  }
  buildCalendarEvent(event){
    const row=document.createElement('article');
    row.className='calendar-event';
    const date=new Date(event.time*1000);
    const clock=document.createElement(event.tentative?'span':'time');
    clock.className='calendar-time';
    clock.textContent=event.tentative?'TBD':this.calendarTimeFormat.format(date);
    if(!event.tentative)clock.dateTime=date.toISOString();
    const dot=document.createElement('i');
    dot.dataset.impact=event.impact;
    dot.title=event.impact;
    dot.setAttribute('role','img');
    dot.setAttribute('aria-label',event.impact+' impact');
    const currency=document.createElement('b');
    currency.textContent=event.currency;
    const title=document.createElement('span');
    title.className='event-title';
    title.textContent=event.title;
    const values=document.createElement('small');
    values.textContent=[event.actual&&'A '+event.actual,event.forecast&&'F '+event.forecast,event.previous&&'P '+event.previous].filter(Boolean).join(' · ');
    values.title=[event.actual&&'Actual '+event.actual,event.forecast&&'Forecast '+event.forecast,event.previous&&'Previous '+event.previous].filter(Boolean).join(' · ');
    row.append(clock,dot,currency,title,values);
    return row;
  }
  buildMusic(){
    const panel=this.panels.music;panel.insertAdjacentHTML('beforeend','<form class="music-link-form"><input type="url" required placeholder="Paste YouTube, Spotify, SoundCloud or TikTok link" aria-label="Music link"><button type="submit">Load</button><button type="button" data-audio-file>File</button><input type="file" accept="audio/*,.mp3,.m4a,.flac,.opus" hidden></form><div class="music-now"><div class="music-disc"><img alt="Track artwork" hidden></div><div><h3>Nothing is playing</h3><p>Paste a link to load the official player.</p><input type="range" class="music-seek" min="0" max="1" value="0" step="0.1" aria-label="Playback position" disabled><span class="music-clock">0:00 / —</span></div></div><div class="music-controls"><button data-command="previous" aria-label="Previous track">◀</button><button data-command="toggle" aria-label="Play">▶</button><button data-command="next" aria-label="Next track">▶</button></div><div class="music-player-host"></div><p class="music-notice" role="status">Paste a music link or choose an audio file.</p>');
    TerminalLanguage.markup(panel);
    this.form=panel.querySelector('form');
    const linkInput=this.form.querySelector('input[type=url]');
    this.form.onsubmit=event=>{event.preventDefault();void this.loadMusic(linkInput.value);};
    this.disc=panel.querySelector('.music-disc');this.art=this.disc.querySelector('img');this.trackTitle=panel.querySelector('.music-now h3');this.trackAuthor=panel.querySelector('.music-now p');this.clock=panel.querySelector('.music-clock');this.playerHost=panel.querySelector('.music-player-host');this.musicNotice=panel.querySelector('.music-notice');
    const header=panel.querySelector('header');
    this.popupButton=document.createElement('button');
    this.popupButton.type='button';
    this.popupButton.className='music-popup-button';
    this.popupButton.disabled=true;
    this.popupButton.onclick=event=>this.setMusicMini(!panel.classList.contains('music-mini'),event.detail===0);
    header.lastElementChild.before(this.popupButton);
    this.hideVideoButton=document.createElement('button');
    this.hideVideoButton.type='button';this.hideVideoButton.className='music-popup-button';
    this.hideVideoButton.hidden=true;
    this.hideVideoButton.textContent=ui('Hide video');
    this.hideVideoButton.onclick=()=>{
      const hide=!panel.classList.contains('music-video-hidden');
      if(hide){
        if(this.link?.provider==='youtube'){
          if(typeof this.youtube?.pauseVideo!=='function')return;
          this.command('pause');
        }
      }
      this.setVideoHidden(hide);
    };
    this.popupButton.before(this.hideVideoButton);
    this.installVideoPopup(panel);
    this.updateMusicPopupButton();
    this.sourceLink=document.createElement('a');
    this.sourceLink.className='music-source-link';
    this.sourceLink.target='_blank';
    this.sourceLink.rel='noopener noreferrer';
    this.sourceLink.textContent=ui('Open original link');
    this.sourceLink.hidden=true;
    this.musicNotice.after(this.sourceLink);
    const fileInput=this.form.querySelector('input[type=file]');
    fileInput.accept+=',video/mp4,.mp4';
    this.form.querySelector('[data-audio-file]').onclick=()=>fileInput.click();
    this.tiktokFileButton=document.createElement('button');
    this.tiktokFileButton.type='button';this.tiktokFileButton.hidden=true;
    this.tiktokFileButton.textContent=ui('Play saved video or audio');
    this.tiktokFileButton.onclick=()=>fileInput.click();
    this.sourceLink.after(this.tiktokFileButton);
    this.tabAudioRequest=0;
    this.tabAudioButton=document.createElement('button');
    this.tabAudioButton.type='button';
    this.tabAudioButton.className='music-tab-audio';
    this.tabAudioButton.hidden=true;
    this.tabAudioButton.textContent=ui('Listen to TikTok tab audio');
    this.tabAudioButton.onclick=()=>{
      if(this.tabAudioStream)this.stopTabAudio();
      else void this.startTabAudio();
    };
    this.sourceLink.after(this.tabAudioButton);
    window.addEventListener('pagehide',()=>{
      this.tabAudioRequest++;
      this.stopTabAudio();
    });
    fileInput.onchange=()=>{
      const file=fileInput.files[0];
      if(file)this.loadMusic('',file);
      fileInput.value='';
    };
    this.musicMute=document.createElement('button');
    this.musicMute.type='button';
    this.musicMute.hidden=true;
    this.musicMute.onclick=()=>this.sendTikTok(this.tiktokMuted?'unMute':'mute');
    panel.querySelector('.music-controls').appendChild(this.musicMute);
    this.seek=panel.querySelector('.music-seek');
    this.seek.oninput=()=>{
      const seconds=Number(this.seek.value);
      if(this.audio)this.audio.currentTime=seconds;
      else if(this.widget)this.widget.seekTo(seconds*1000);
      else if(this.spotify)this.spotify.seek(seconds);
      else if(this.youtube)this.youtube.seekTo?.(seconds,true);
      else if(this.link?.provider==='tiktok')this.sendTikTok('seekTo',seconds);
      this.elapsed=seconds;
    };
    this.musicToggle=panel.querySelector('[data-command=toggle]');
    panel.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>this.command(b.dataset.command));this.setCommands(false);
    const toast=document.createElement('div');toast.id='music-track-toast';toast.innerHTML='<img alt=""><div><strong></strong><small></small></div>';toast.setAttribute('role','status');document.body.appendChild(toast);this.songToast=toast;
    const saved=Workspace.read('terminal_music_link_v1','');if(saved)linkInput.value=saved;
    this.metadataStatus=document.createElement('p');this.metadataStatus.className='music-metadata-status';this.metadataStatus.setAttribute('role','status');this.musicNotice.after(this.metadataStatus);
    window.addEventListener('message',e=>{
      // Accept messages only from the currently mounted official player.
      if(this.link?.provider!=='tiktok'||e.origin!=='https://www.tiktok.com'||
          e.source!==this.iframe?.contentWindow||e.data?.['x-tiktok-player']!==true)return;
      const {type,value}=e.data;
      if(type==='onPlayerReady'){
        this.setCommands(true);
        this.musicMute.disabled=false;
        if(!this.tiktokStarted)this.tiktokPlayPrompt();
      }else if(type==='onMute'&&typeof value==='boolean'){
        this.setTikTokMuted(value);
      }else if(type==='onStateChange'){
        this.setPlaying(value===1,value===1||value===3);
        if(value!==1)return;
        clearTimeout(this.playerReadyTimer);
        if(this.tiktokNative&&!this.tiktokStarted&&!panel.classList.contains('music-mini'))this.setVideoHidden(true);
        this.tiktokStarted=true;
        this.setCommands(true);
        this.musicMute.hidden=false;
        this.musicMute.disabled=false;
        this.tabAudioButton.hidden=true;
        this.tiktokFileButton.hidden=true;
        this.musicNotice.textContent='';
        if(!panel.classList.contains('open'))this.command('pause');
      }else if(type==='onCurrentTime'&&value){
        if(Number.isFinite(value.currentTime))this.elapsed=Math.max(0,value.currentTime);
        if(Number.isFinite(value.duration))this.duration=Math.max(0,value.duration);
        this.updateMusic();
      }else if(type==='onPlayerError'||type==='onError'){
        const code=Number(value?.errorCode??value);
        // Older builds also emit the media-aborted event while initializing.
        if(type==='onError'&&code===1)return;
        clearTimeout(this.playerReadyTimer);
        this.setPlaying(false);
        if(code===3002){
          if(this.tiktokManualPlay&&!this.tiktokNative)void this.recoverTikTok(this.epoch,code);
          else this.tiktokPlayPrompt();
        }else{
          void this.recoverTikTok(this.epoch,code);
        }
      }
    });
  }
  script(src,ready){return new Promise((resolve,reject)=>{if(ready()){resolve();return;}const existing=document.querySelector(`script[src="${src}"]`),s=existing||document.createElement('script');if(!existing){s.src=src;s.async=true;document.head.appendChild(s);}let count=0;const check=setInterval(()=>{if(ready()){clearInterval(check);resolve();}else if(++count>100){clearInterval(check);s.remove();reject(Error('Provider API could not load. Check connection or blockers.'));}},100);s.addEventListener('error',()=>{clearInterval(check);s.remove();reject(Error('Provider API unavailable.'));},{once:true});});}
  async loadMusic(url,file){
    let link;try{link=file?{provider:'audio'}:TerminalMusicLinks.parse(url);}catch(e){this.musicNotice.textContent=ui(e.message);return;}
    this.tabAudioRequest++;
    this.stopTabAudio();
    this.tabAudioButton.hidden=true;
    const epoch=++this.epoch;
    this.loadAbort?.abort();this.metadataAbort?.abort();this.loadAbort=new AbortController();this.metadataStatus.textContent='';
    clearTimeout(this.playerReadyTimer);clearTimeout(this.toastTimer);this.songToast.classList.remove('show');
    this.audio?.pause();this.audio=null;
    if(this.audioObjectUrl){URL.revokeObjectURL(this.audioObjectUrl);this.audioObjectUrl=null;}
    this.youtube?.destroy?.();this.youtube=null;
    this.spotify?.destroy?.();this.iframe=null;this.widget=null;this.spotify=null;this.playerHost.replaceChildren();this.link=null;this.spotifyFrameOnly=false;this.setPlaying(false);this.currentTrack='';this.metadataURL=null;this.duration=0;this.elapsed=0;this.trackTitle.textContent='Loading…';this.art.hidden=true;
    this.popupButton.disabled=true;
    this.tiktokNative=false;
    this.tiktokRecovering=false;
    this.musicMute.hidden=true;
    this.setTikTokMuted(false);
    this.tiktokFileButton.hidden=true;
    this.setVideoHidden(false);
    this.sourceLink.hidden=!!file;
    if(!file)this.sourceLink.href=link.url;
    this.setCommands(false);
    this.seek.disabled=true;
    this.seek.value=0;
    if(link.share){
      if(location.protocol==='file:'){
        this.trackTitle.textContent='Link rút gọn';
        this.musicNotice.textContent='Mở bản preview qua localhost để tải link rút gọn, hoặc mở link gốc rồi dán URL đầy đủ.';
        return;
      }
      this.musicNotice.textContent='Resolving official share link…';
      try{
        const response=await fetch('/api/music/resolve?'+new URLSearchParams({url:link.url}),{signal:AbortSignal.any([this.loadAbort.signal,AbortSignal.timeout(18000)])}),result=await response.json();
        if(!response.ok)throw Error(result.error||'Could not resolve share link');
        link=TerminalMusicLinks.parse(result.url);if(link.share)throw Error('Paste the full link from the provider');
      }catch(e){if(epoch===this.epoch){this.trackTitle.textContent='Share link unavailable';this.musicNotice.textContent=e.message;}return;}
      if(epoch!==this.epoch)return;
    }
    this.link=link;
    if(link.provider==='tiktok'){
      this.sourceLink.href=link.url;
      this.sourceLink.textContent=ui('Open TikTok source tab');
    }else this.sourceLink.textContent=ui('Open original link');
    this.panels.music.dataset.provider=link.provider;
    this.popupButton.disabled=false;
    if(link.provider==='audio'){
      if(file)link.url=this.audioObjectUrl=URL.createObjectURL(file);
      else Workspace.write('terminal_music_link_v1',url);
      this.loadAudio(link.url,file?.name,epoch,!!file&&(file.type.startsWith('video/')||/\.mp4$/i.test(file.name)));
      return;
    }
    Workspace.write('terminal_music_link_v1',url);
    this.updateTrack(link.url,({youtube:'YouTube',spotify:'Spotify',soundcloud:'SoundCloud',tiktok:'TikTok'})[link.provider],'',null,0,false);
    if(link.provider!=='tiktok')this.metadata(link.url,epoch);
    this.musicNotice.textContent='Loading '+link.provider+'…';
    try{
      if(link.provider==='youtube'){
        await this.loadYouTube(link,epoch);
      }else if(link.provider==='soundcloud'){
        const frame=this.frame('https://w.soundcloud.com/player/?'+new URLSearchParams({url:link.url,auto_play:'false',show_artwork:'true',visual:'false'}),200);
        await this.script('https://w.soundcloud.com/player/api.js',()=>!!window.SC?.Widget);if(epoch!==this.epoch)return;const widget=this.widget=SC.Widget(frame),events=SC.Widget.Events;
        const track=()=>widget.getCurrentSound(sound=>{if(epoch!==this.epoch||!sound)return;this.updateTrack(String(sound.permalink_url||link.url).replace(/^http:/,'https:'),sound.title,sound.user?.username,sound.artwork_url||sound.user?.avatar_url,sound.duration/1000);});
        widget.bind(events.ERROR,()=>{if(epoch!==this.epoch)return;this.setPlaying(false);this.musicNotice.textContent='SoundCloud could not play this link. Check its availability in the official player.';});widget.bind(events.READY,()=>{if(epoch===this.epoch){this.setCommands(true);track();widget.getSounds(sounds=>{if(epoch===this.epoch)this.setCommands(true,sounds?.length>1);});}});widget.bind(events.PLAY,()=>{if(epoch!==this.epoch)return;this.setPlaying(true);track();});widget.bind(events.PAUSE,()=>{if(epoch===this.epoch)this.setPlaying(false);});widget.bind(events.FINISH,()=>{if(epoch===this.epoch)this.setPlaying(false);});widget.bind(events.PLAY_PROGRESS,e=>{if(epoch===this.epoch)this.elapsed=e.currentPosition/1000;});this.musicNotice.textContent='SoundCloud playlist controls are available in the official player.';
      }else if(link.provider==='spotify'){
        let spotifyAPI=window.terminalSpotifyAPI;window.onSpotifyIframeApiReady=api=>window.terminalSpotifyAPI=api;
        await this.script('https://open.spotify.com/embed/iframe-api/v1',()=>!!window.terminalSpotifyAPI);if(epoch!==this.epoch)return;spotifyAPI=window.terminalSpotifyAPI;const target=document.createElement('div');this.playerHost.appendChild(target);
        this.playerReadyTimer=setTimeout(()=>this.useSpotifyFrame(link,epoch),10000);
        spotifyAPI.createController(target,{uri:link.uri,width:'100%',height:352},controller=>{
          if(epoch!==this.epoch||this.spotifyFrameOnly){controller.destroy();return;}
          this.spotify=controller;
          const frame=this.playerHost.querySelector('iframe');if(frame){frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';frame.title='Official Spotify player';}
          controller.addListener('ready',()=>{if(epoch!==this.epoch||this.spotifyFrameOnly)return;clearTimeout(this.playerReadyTimer);this.setCommands(true,false);this.musicNotice.textContent='Start playback inside Spotify if the toolbar cannot start it.';});
          controller.addListener('playback_update',e=>{if(epoch!==this.epoch||this.spotifyFrameOnly||!e?.data)return;clearTimeout(this.playerReadyTimer);this.setCommands(true,false);this.setPlaying(e.data.isPaused===false&&!e.data.isBuffering,e.data.isPaused===false);this.duration=e.data.duration/1000;this.elapsed=e.data.position/1000;if(e.data.playingURI){const [_,type,id]=e.data.playingURI.split(':');if(id)this.metadata(`https://open.spotify.com/${type}/${id}`,epoch,true);}});
        });
      }else{
        // Request oEmbed in parallel so metadata cannot delay the initial player.
        this.tiktokEmbed=this.loadTikTokMetadata(link,epoch);
        this.mountTikTok(epoch);
      }
    }catch(e){
      if(epoch!==this.epoch)return;
      this.musicNotice.textContent=this.iframe?'Dùng nút Play trong trình phát hoặc mở link gốc.':e.message;
      if(link.provider==='spotify')this.useSpotifyFrame(link,epoch);
      this.setCommands(false);
    }
  }

  async loadTikTokMetadata(link,epoch){
    if(location.protocol==='file:')return null;
    try{
      const response=await fetch('/api/music/metadata?'+new URLSearchParams({url:link.url,embed:'1'}),{
        signal:AbortSignal.any([this.loadAbort.signal,AbortSignal.timeout(10000)]),cache:'no-store'
      });
      if(!response.ok)throw Error('TikTok oEmbed unavailable');
      const data=await response.json();
      if(epoch!==this.epoch)return null;
      this.updateTrack(link.url,data.title||'TikTok',data.author_name,data.thumbnail_url,0,false);
      if(!data.embed_url)return null;
      const src=new URL(data.embed_url);
      if(src.origin==='https://www.tiktok.com'&&!src.username&&!src.password&&
          src.pathname.replace(/\/$/,'')==='/player/v1/'+link.id)return src;
    }catch{
      // Provider metadata is optional. The app's local proxy avoids browser CORS.
    }
    return null;
  }

  mountTikTok(epoch,native=false,embed=null){
    const src=embed||new URL('https://www.tiktok.com/player/v1/'+this.link.id);
    // Preserve the provider's oEmbed options for the native click fallback.
    const options=native?{autoplay:'0',muted:'0'}:{
      controls:'0',progress_bar:'0',description:'0',music_info:'0',rel:'0',autoplay:'1',force_muted:'0'
    };
    for(const [key,value] of Object.entries(options))src.searchParams.set(key,value);
    this.tiktokNative=native;
    this.tiktokStarted=false;
    this.tiktokManualPlay=false;
    this.musicMute.hidden=false;
    this.musicMute.disabled=true;
    this.setTikTokMuted(false);
    this.frame(src.href,360);
    this.popupButton.disabled=false;
    this.setVideoHidden(!native);
    if(native)this.tiktokPlayPrompt();
    else this.playerReadyTimer=setTimeout(()=>{
      if(epoch===this.epoch&&!this.tiktokStarted)this.tiktokPlayPrompt();
    },8000);
  }

  setTikTokMuted(muted){
    this.tiktokMuted=muted;
    const label=ui(muted?'Unmute':'Mute');
    this.musicMute.textContent=label;
    this.musicMute.setAttribute('aria-label',label);
  }

  tiktokPlayPrompt(){
    this.setCommands(true);
    this.musicNotice.textContent=ui(this.tiktokNative?'Tap Play in the TikTok player to start playback.':'Press Play in Music to start TikTok audio.');
    if(this.tiktokNative)this.tabAudioButton.hidden=false;
  }

  async recoverTikTok(epoch,code){
    if(epoch!==this.epoch||this.link?.provider!=='tiktok'||this.tiktokRecovering)return;
    clearTimeout(this.playerReadyTimer);
    this.iframe?.remove();
    this.iframe=null;
    this.elapsed=0;
    this.duration=0;
    this.updateMusic();
    this.setPlaying(false);
    this.setCommands(false);
    this.musicMute.hidden=true;
    this.popupButton.disabled=true;
    this.setVideoHidden(false);
    const panel=this.panels.music;
    if(panel.classList.contains('music-mini'))this.setMusicMini(false,false);
    if(!this.tiktokNative&&code!==1001){
      this.tiktokRecovering=true;
      this.musicNotice.textContent=ui('Requesting a fresh TikTok player\u2026');
      const embed=await this.tiktokEmbed;
      if(epoch!==this.epoch)return;
      this.tiktokRecovering=false;
      this.mountTikTok(epoch,true,embed);
      return;
    }
    const error=Number.isFinite(code)?' ('+code+')':'';
    const message=code===1001?'TikTok could not find this post. Check its link and visibility.':
      'TikTok could not play this post in the embedded player.';
    this.musicNotice.textContent=ui(message)+error+' '+ui('If the original post plays, you can share its tab audio here.');
    this.tabAudioButton.hidden=false;
    this.tiktokFileButton.hidden=false;
  }

  async startTabAudio(){
    const source=this.link;
    if(source?.provider!=='tiktok')return;
    if(!navigator.mediaDevices?.getDisplayMedia){
      this.musicNotice.textContent=ui('Open Terminal in Chrome or Edge to share tab audio.');
      return;
    }
    const request=++this.tabAudioRequest;
    this.tabAudioButton.disabled=true;
    this.musicNotice.textContent=ui('Select the TikTok tab that is playing and enable Share tab audio.');
    let capture;
    try{
      capture=await navigator.mediaDevices.getDisplayMedia({
        video:{displaySurface:'browser',frameRate:{ideal:1}},
        audio:{suppressLocalAudioPlayback:true},
        preferCurrentTab:false,
        selfBrowserSurface:'exclude',
        surfaceSwitching:'exclude',
        systemAudio:'exclude',
        monitorTypeSurfaces:'exclude'
      });
    }catch(error){
      if(request===this.tabAudioRequest){
        this.musicNotice.textContent=ui('Tab audio was not shared. Open and play TikTok, then try again.');
      }
      return;
    }finally{
      this.tabAudioButton.disabled=false;
    }
    const videoTrack=capture.getVideoTracks()[0];
    const audioTrack=capture.getAudioTracks()[0];
    if(request!==this.tabAudioRequest||source!==this.link||!this.panels.music.classList.contains('open')){
      for(const track of capture.getTracks())track.stop();
      return;
    }
    if(videoTrack?.getSettings().displaySurface!=='browser'||!audioTrack||audioTrack.readyState!=='live'){
      for(const track of capture.getTracks())track.stop();
      this.musicNotice.textContent=ui('Choose a browser tab and enable Share tab audio. Window or screen sharing cannot be used here.');
      return;
    }
    const epoch=++this.epoch;
    this.loadAbort?.abort();
    this.metadataAbort?.abort();
    clearTimeout(this.playerReadyTimer);
    this.iframe?.remove();
    this.iframe=null;
    this.setVideoHidden(false);
    // Keep the browser's share alive, but do not display or consume its video.
    for(const track of capture.getVideoTracks())track.enabled=false;
    this.tabAudioStream=capture;
    this.tabAudioSource=source;
    this.musicMute.hidden=true;
    this.link={provider:'audio',url:source.url};
    this.panels.music.dataset.provider='audio';
    this.tiktokFileButton.hidden=true;
    this.popupButton.disabled=false;
    this.tabAudioButton.textContent=ui('Stop tab audio');
    this.updateTrack(source.url,ui('TikTok tab audio'),ui('Live audio'),null,0,false);
    this.setCommands(true);
    const audio=this.audio=new Audio();
    audio.srcObject=new MediaStream([audioTrack]);
    audio.addEventListener('playing',()=>{if(this.epoch===epoch)this.setPlaying(true);});
    audio.addEventListener('pause',()=>{if(this.epoch===epoch)this.setPlaying(false);});
    for(const track of capture.getTracks()){
      track.addEventListener('ended',()=>{if(this.tabAudioStream===capture)this.stopTabAudio();},{once:true});
    }
    this.musicNotice.textContent=ui('Listening to the selected tab. Play or pause the video there, or use Play in Music to mute or resume it here.');
    audio.play().catch(()=>{
      if(this.tabAudioStream===capture)this.musicNotice.textContent=ui('Press Play in Music to listen to the shared tab.');
    });
  }
  stopTabAudio(){
    const stream=this.tabAudioStream;
    if(!stream)return;
    this.tabAudioStream=null;
    this.audio?.pause();
    if(this.audio)this.audio.srcObject=null;
    this.audio=null;
    for(const track of stream.getTracks())track.stop();
    this.link=this.tabAudioSource;
    this.tabAudioSource=null;
    this.panels.music.dataset.provider='tiktok';
    this.setPlaying(false);
    this.setCommands(false);
    this.popupButton.disabled=true;
    this.tabAudioButton.textContent=ui('Listen to TikTok tab audio');
    this.musicNotice.textContent=ui('Tab audio stopped.');
  }

  async loadYouTube(link,epoch){
    if(location.protocol==='file:'){
      this.musicNotice.textContent='Mở Trading Terminal qua localhost để phát YouTube trong ứng dụng.';
      return;
    }
    const params=new URLSearchParams({enablejsapi:'1',origin:location.origin,playsinline:'1'});
    if(link.list){params.set('listType','playlist');params.set('list',link.list);}
    const frame=this.frame('https://www.youtube.com/embed/'+(link.id||'videoseries')+'?'+params,240);
    this.musicNotice.textContent='Bấm Play trong trình phát YouTube.';
    await this.script('https://www.youtube.com/iframe_api',()=>typeof window.YT?.Player==='function');
    if(epoch!==this.epoch)return;
    this.youtube=new window.YT.Player(frame,{
      events:{
        onReady:()=>{if(epoch===this.epoch){this.setCommands(true,!!link.list);this.setVideoHidden(false);}},
        onStateChange:({data,target})=>{
          if(epoch!==this.epoch)return;
          this.setPlaying(data===1,data===1||data===3);
          if(this.canPause&&(!this.panels.music.classList.contains('open')||this.panels.music.classList.contains('music-video-hidden')))target.pauseVideo();
          if(data===1)this.musicNotice.textContent='';
        },
        onError:({data})=>{
          if(epoch!==this.epoch)return;
          this.setPlaying(false);
          this.setCommands(false);
          this.musicNotice.textContent=data===153?'YouTube không nhận được trang nhúng. Hãy mở link gốc hoặc dùng bản localhost.':'Video này không phát được trong trình phát nhúng. Hãy mở link gốc.';
        }
      }
    });
  }

  loadAudio(url,name,epoch,fromVideo=false){
    const audio=this.audio=fromVideo?document.createElement('video'):new Audio();
    if(fromVideo)audio.playsInline=true;
    audio.preload='metadata';
    this.updateTrack(url,name||new URL(url).pathname.split('/').pop()||'Audio','',null,0,false);
    this.musicNotice.textContent='';
    audio.addEventListener('loadedmetadata',()=>{
      if(epoch!==this.epoch)return;
      this.duration=audio.duration;
      this.setCommands(true);
      this.updateMusic();
    });
    audio.addEventListener('playing',()=>{if(epoch===this.epoch)this.setPlaying(true);});
    audio.addEventListener('pause',()=>{if(epoch===this.epoch)this.setPlaying(false);});
    audio.addEventListener('ended',()=>{if(epoch===this.epoch)this.setPlaying(false);});
    audio.addEventListener('error',()=>{
      if(epoch!==this.epoch)return;
      this.setCommands(false);
      this.musicNotice.textContent='This audio source could not be played.';
    });
    audio.src=url;
    this.setCommands(true);
    if(name)audio.play().catch(()=>{if(epoch===this.epoch)this.musicNotice.textContent=ui('Press Play to start the local file.');});
  }

  setCommands(play,skip=false){for(const b of this.panels.music.querySelectorAll('[data-command]'))b.disabled=!(b.dataset.command==='toggle'?play:skip);}
  useSpotifyFrame(link,epoch){
    if(epoch!==this.epoch||link?.provider!=='spotify'||this.spotifyFrameOnly)return;
    clearTimeout(this.playerReadyTimer);this.spotifyFrameOnly=true;this.spotify?.destroy?.();this.spotify=null;this.setPlaying(false);this.setCommands(false);
    this.playerHost.replaceChildren();this.frame(`https://open.spotify.com/embed/${link.type}/${link.id}`,352);
    this.musicNotice.textContent='Use the controls in the Spotify player.';
  }
  frame(src,height){const frame=document.createElement('iframe');frame.src=src;frame.height=height;frame.width='100%';frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';frame.allowFullscreen=true;frame.title='Official '+this.link.provider+' player';frame.referrerPolicy='strict-origin-when-cross-origin';this.playerHost.appendChild(frame);this.iframe=frame;return frame;}
  async metadata(url,epoch,change=false){
    if(location.protocol==='file:')return;
    try{url=TerminalMusicLinks.parse(url).url;}catch{return;}
    if(this.metadataURL===url)return;this.metadataURL=url;
    this.metadataAbort?.abort();const controller=this.metadataAbort=new AbortController();
    try{const response=await fetch('/api/music/metadata?'+new URLSearchParams({url}),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});const data=await response.json();if(!response.ok)throw Error(data.error||'Metadata unavailable');if(epoch!==this.epoch||this.metadataURL!==url)return;this.metadataStatus.textContent='';this.updateTrack(url,data.title||this.link.provider,data.author_name,data.thumbnail_url,this.duration,change);}catch(error){if(epoch!==this.epoch||this.metadataURL!==url||controller.signal.aborted)return;this.metadataStatus.textContent=error.name==='TimeoutError'?'Metadata quá hạn; trạng thái phát do player quyết định.':error.message;if(!this.currentTrack)this.updateTrack(url,this.link.provider+' · official player','','',this.duration);}
  }
  updateTrack(id,title,author,thumbnail,duration,notify=true){
    const changed=this.currentTrack&&this.currentTrack!==String(id);this.currentTrack=String(id);this.trackTitle.textContent=title||'Untitled';this.trackAuthor.textContent=author||'';if(duration)this.duration=duration;
    if(thumbnail?.startsWith('https://')){this.art.src=thumbnail;this.art.hidden=false;}else{this.art.removeAttribute('src');this.art.hidden=true;}
    if(changed&&notify&&Workspace.read('terminal_music_toast_v1',true)){this.songToast.querySelector('strong').textContent=title;this.songToast.querySelector('small').textContent=this.formatTime(this.duration);const img=this.songToast.querySelector('img');img.hidden=!thumbnail;if(thumbnail)img.src=thumbnail;clearTimeout(this.toastTimer);this.songToast.classList.add('show');this.toastTimer=setTimeout(()=>this.songToast.classList.remove('show'),2000);}
  }
  setPlaying(playing,canPause=playing){
    this.playing=playing;
    this.canPause=canPause;
    this.disc.classList.toggle('playing',playing);
    this.musicToggle.textContent=canPause?'Ⅱ':'▶';
    this.musicToggle.setAttribute('aria-label',ui(canPause?'Pause':'Play'));
  }
  formatTime(value){if(!Number.isFinite(value)||value<=0)return '—';return Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0');}
  updateMusic(){
    if(this.audio){
      this.elapsed=this.audio.currentTime;
      this.duration=this.audio.duration;
    }else if(typeof this.youtube?.getCurrentTime==='function'){
      this.elapsed=this.youtube.getCurrentTime();
      this.duration=this.youtube.getDuration();
    }
    this.clock.textContent=this.tabAudioStream?ui('Live audio'):(this.elapsed?this.formatTime(this.elapsed):'0:00')+' / '+this.formatTime(this.duration);
    const seekable=Number.isFinite(this.duration)&&this.duration>0&&!!(this.audio||this.widget||this.spotify||this.youtube||this.link?.provider==='tiktok');
    this.seek.disabled=!seekable;
    this.seek.max=seekable?this.duration:1;
    if(!this.seek.matches(':active'))this.seek.value=seekable?this.elapsed:0;
  }
  command(action){
    if(!this.link)return;
    const pause=action==='pause'||(action==='toggle'&&this.canPause);
    if(action==='toggle'&&!pause&&this.link.provider==='youtube')this.setVideoHidden(false);
    if(this.audio){
      if(pause)this.audio.pause();
      else if(action==='toggle')this.audio.play().catch(()=>{this.musicNotice.textContent='Could not start playback.';});
    }else if(this.youtube){
      if(pause)this.youtube.pauseVideo?.();
      else if(action==='previous')this.youtube.previousVideo?.();
      else if(action==='next')this.youtube.nextVideo?.();
      else this.youtube.playVideo?.();
    }else if(this.widget){
      if(action==='previous')this.widget.prev();
      else if(action==='next')this.widget.next();
      else if(pause)this.widget.pause();
      else this.widget.play();
    }else if(this.spotify){
      if(pause)this.spotify.pause();
      else if(action==='toggle')this.spotify.togglePlay();
    }else if(this.link.provider==='tiktok'&&(action==='toggle'||action==='pause')){
      this.sendTikTok(pause?'pause':'play');
      if(!pause&&!this.tiktokNative&&!this.tiktokStarted){
        this.tiktokManualPlay=true;
        const epoch=this.epoch;
        clearTimeout(this.playerReadyTimer);
        this.playerReadyTimer=setTimeout(()=>{
          if(epoch===this.epoch&&!this.tiktokStarted)void this.recoverTikTok(epoch);
        },5000);
      }
    }
  }
  sendTikTok(type,value){
    this.iframe?.contentWindow?.postMessage({'x-tiktok-player':true,type,value},'https://www.tiktok.com');
  }
}
if(typeof module!=='undefined')module.exports={TerminalMusicLinks};
