'use strict';
const TerminalMusicLinks={
  parse(text){
    let u;try{u=new URL(text.trim());}catch{throw Error('Paste a full music or playlist link.');}
    if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Use an official HTTPS provider link.');
    const host=u.hostname.replace(/^www\./,''),path=u.pathname.split('/').filter(Boolean);
    if(/\.(mp3|m4a|aac|wav|ogg|opus|flac|weba)$/i.test(u.pathname))return {provider:'audio',url:u.href};
    if(['youtube.com','m.youtube.com','youtu.be'].includes(host)){
      const id=host==='youtu.be'?path[0]:['shorts','embed','live'].includes(path[0])?path[1]:u.searchParams.get('v'),list=u.searchParams.get('list');
      if((!id||!/^[\w-]{11}$/.test(id))&&(!list||!/^[\w-]{10,100}$/.test(list)))throw Error('Use a YouTube video or playlist link.');
      const validId=id&&/^[\w-]{11}$/.test(id)?id:null;
      return {provider:'youtube',id:validId,list:list&&/^[\w-]{10,100}$/.test(list)?list:null,url:validId?'https://www.youtube.com/watch?v='+validId:'https://www.youtube.com/playlist?list='+list};
    }
    if(['vm.tiktok.com','vt.tiktok.com','on.soundcloud.com','spotify.link'].includes(host)&&path.length)return {share:true,url:u.href};
    if(host==='open.spotify.com'){
      if(/^intl-/.test(path[0]))path.shift();if(path[0]==='embed')path.shift();const [type,id]=path;
      if(!['track','playlist','album','episode','show'].includes(type)||!/^[a-zA-Z0-9]{22}$/.test(id||''))throw Error('Use a Spotify track, album or playlist link.');
      return {provider:'spotify',id,type,url:`https://open.spotify.com/${type}/${id}`,uri:`spotify:${type}:${id}`};
    }
    if(['soundcloud.com','m.soundcloud.com'].includes(host)&&path.length>=2&&!['discover','search','you'].includes(path[0]))return {provider:'soundcloud',url:'https://soundcloud.com/'+path.join('/')+(u.searchParams.get('secret_token')?'?'+new URLSearchParams({secret_token:u.searchParams.get('secret_token')}):'')};
    if(['tiktok.com','m.tiktok.com'].includes(host)&&path[1]==='video'&&/^\d{10,25}$/.test(path[2]||''))return {provider:'tiktok',id:path[2],url:'https://www.tiktok.com/'+path.slice(0,3).join('/')};
    if(host==='tiktok.com'&&path[0]==='player'&&path[1]==='v1'&&/^\d{10,25}$/.test(path[2]||''))return {provider:'tiktok',id:path[2],url:'https://www.tiktok.com/player/v1/'+path[2]};
    throw Error('Use a YouTube, Spotify, SoundCloud or TikTok video link.');
  }
};
class TerminalCompanions{
  constructor(ctx){
    Object.assign(this,ctx);this.calendarData=null;this.playing=false;this.epoch=0;this.currentTrack='';this.impacts=new Set(Workspace.read('terminal_calendar_impacts_v1',['High','Medium','Low']));this.currency=Workspace.read('terminal_calendar_currency_v1','USD');
    const savedProtocols=Workspace.read('terminal_protocol_events_v1',[]);this.protocolEvents=Array.isArray(savedProtocols)?savedProtocols:[];
    this.dock=document.createElement('aside');this.dock.id='terminal-edge-dock';this.dock.setAttribute('aria-label','Calendar and music');(document.getElementById('right-sidebar')||document.body).appendChild(this.dock);
    this.panels={};for(const [key,title,path] of [['calendar','Calendar','M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 14h2m4 0h2M8 17h2'],['music','Music','M9 18V5l11-2v13M9 8l11-2M9 18a3 2.5 0 1 1-6 0 3 2.5 0 0 1 6 0Zm11-2a3 2.5 0 1 1-6 0 3 2.5 0 0 1 6 0Z']]){
      const button=document.createElement('button');button.className='edge-handle';button.id='edge-'+key;button.type='button';button.setAttribute('aria-label',title);button.setAttribute('aria-expanded','false');button.innerHTML=`<span>${title}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;this.dock.appendChild(button);
      const panel=document.createElement('section');panel.id=key+'-panel';panel.className='companion-panel';panel.inert=true;panel.setAttribute('aria-label',title);panel.innerHTML=`<header><h2>${title==='Calendar'?'Economic Calendar':title}</h2><button type="button" aria-label="Close ${title}">×</button></header>`;panel.querySelector('button').onclick=()=>this.toggle(key,false);document.body.appendChild(panel);this.panels[key]=panel;button.onclick=()=>this.toggle(key);
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
    if(show&&this.open&&this.open!==key)this.toggle(this.open,false);
    this.panels[key].classList.toggle('open',show);this.panels[key].inert=!show;document.getElementById('edge-'+key).setAttribute('aria-expanded',String(show));
    this.open=show?key:null;
    if(key==='calendar'&&show)this.renderCalendar();
    if(key==='music'&&!show&&this.link?.provider==='tiktok')this.command('pause');
  }
  buildCalendar(){
    const panel=this.panels.calendar,filters=document.createElement('div');filters.className='calendar-filters';
    for(const impact of ['High','Medium','Low']){const button=document.createElement('button');button.textContent=impact;button.dataset.impact=impact;button.type='button';button.onclick=()=>{if(this.impacts.has(impact))this.impacts.delete(impact);else this.impacts.add(impact);Workspace.write('terminal_calendar_impacts_v1',[...this.impacts]);this.renderCalendar();};filters.appendChild(button);}
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
      heading.textContent=dayIso===todayIso?'Today':dayIso===tomorrowIso?'Tomorrow':dateFormat.format(entry.date);
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
    this.form=panel.querySelector('form');this.form.onsubmit=e=>{e.preventDefault();this.loadMusic(this.form.querySelector('input').value);};this.disc=panel.querySelector('.music-disc');this.art=this.disc.querySelector('img');this.trackTitle=panel.querySelector('.music-now h3');this.trackAuthor=panel.querySelector('.music-now p');this.clock=panel.querySelector('.music-clock');this.playerHost=panel.querySelector('.music-player-host');this.musicNotice=panel.querySelector('.music-notice');
    const fileInput=this.form.querySelector('input[type=file]');
    this.form.querySelector('[data-audio-file]').onclick=()=>fileInput.click();
    fileInput.onchange=()=>{
      const file=fileInput.files[0];
      if(file)this.loadMusic('',file);
      fileInput.value='';
    };
    this.seek=panel.querySelector('.music-seek');
    this.seek.oninput=()=>{
      const seconds=Number(this.seek.value);
      if(this.audio)this.audio.currentTime=seconds;
      else if(this.widget)this.widget.seekTo(seconds*1000);
      else if(this.spotify)this.spotify.seek(seconds);
      this.elapsed=seconds;
    };
    this.musicToggle=panel.querySelector('[data-command=toggle]');
    panel.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>this.command(b.dataset.command));this.setCommands(false);
    const toast=document.createElement('div');toast.id='music-track-toast';toast.innerHTML='<img alt=""><div><strong></strong><small></small></div>';toast.setAttribute('role','status');document.body.appendChild(toast);this.songToast=toast;
    const saved=Workspace.read('terminal_music_link_v1','');if(saved)this.form.querySelector('input').value=saved; // Never autoplay or contact providers until Load.
    this.metadataStatus=document.createElement('p');this.metadataStatus.className='music-metadata-status';this.metadataStatus.setAttribute('role','status');this.musicNotice.after(this.metadataStatus);
    window.addEventListener('message',e=>{
      if(this.link?.provider!=='tiktok'||e.origin!=='https://www.tiktok.com'||e.source!==this.iframe?.contentWindow||!e.data?.['x-tiktok-player'])return;
      const {type,value}=e.data;
      if(type==='onPlayerReady'){clearTimeout(this.playerReadyTimer);this.setCommands(true,false);this.musicNotice.textContent='Use Play in the TikTok player or the toolbar.';}
      if(type==='onStateChange'){
        this.setPlaying(value===1,value===1||value===3);
        if(this.canPause&&this.open!=='music')this.command('pause');
      }
      if(type==='onCurrentTime'&&value){this.elapsed=value.currentTime;this.duration=value.duration;}
      if(type==='onPlayerError'||type==='onError'){
        clearTimeout(this.playerReadyTimer);this.setPlaying(false);this.setCommands(false);
        const code=value?.errorCode??value;
        this.musicNotice.textContent=Number(code)===2001?'TikTok could not serve this video (2001). Retry or open it on TikTok.':`TikTok could not play this video${Number.isFinite(Number(code))?' ('+code+')':''}. Retry or open it on TikTok.`;
      }
    });
  }
  script(src,ready){return new Promise((resolve,reject)=>{if(ready()){resolve();return;}const existing=document.querySelector(`script[src="${src}"]`),s=existing||document.createElement('script');if(!existing){s.src=src;s.async=true;document.head.appendChild(s);}let count=0;const check=setInterval(()=>{if(ready()){clearInterval(check);resolve();}else if(++count>100){clearInterval(check);s.remove();reject(Error('Provider API could not load. Check connection or blockers.'));}},100);s.addEventListener('error',()=>{clearInterval(check);s.remove();reject(Error('Provider API unavailable.'));},{once:true});});}
  async loadMusic(url,file){
    let link;try{link=file?{provider:'audio'}:TerminalMusicLinks.parse(url);}catch(e){this.musicNotice.textContent=e.message;return;}
    const epoch=++this.epoch;
    this.loadAbort?.abort();this.metadataAbort?.abort();this.loadAbort=new AbortController();this.metadataStatus.textContent='';
    clearTimeout(this.playerReadyTimer);clearTimeout(this.toastTimer);this.songToast.classList.remove('show');
    this.audio?.pause();this.audio=null;
    if(this.audioObjectUrl){URL.revokeObjectURL(this.audioObjectUrl);this.audioObjectUrl=null;}
    this.spotify?.destroy?.();this.iframe=null;this.widget=null;this.spotify=null;this.playerHost.replaceChildren();this.link=null;this.spotifyFrameOnly=false;this.setPlaying(false);this.currentTrack='';this.metadataURL=null;this.duration=0;this.elapsed=0;this.trackTitle.textContent='Loading…';this.art.hidden=true;
    this.setCommands(false);
    this.seek.disabled=true;
    this.seek.value=0;
    if(link.share){
      this.musicNotice.textContent='Resolving official share link…';
      try{
        const response=await fetch('/api/music/resolve?'+new URLSearchParams({url:link.url}),{signal:AbortSignal.any([this.loadAbort.signal,AbortSignal.timeout(18000)])}),result=await response.json();
        if(!response.ok)throw Error(result.error||'Could not resolve share link');
        link=TerminalMusicLinks.parse(result.url);if(link.share)throw Error('Paste the full link from the provider');
      }catch(e){if(epoch===this.epoch){this.trackTitle.textContent='Share link unavailable';this.musicNotice.textContent=e.message;}return;}
      if(epoch!==this.epoch)return;
    }
    this.link=link;
    if(link.provider==='audio'){
      if(file)link.url=this.audioObjectUrl=URL.createObjectURL(file);
      else Workspace.write('terminal_music_link_v1',url);
      this.loadAudio(link.url,file?.name,epoch);
      return;
    }
    Workspace.write('terminal_music_link_v1',url);
    this.metadata(link.url,epoch);
    if(link.provider==='youtube'){
      this.musicNotice.textContent='YouTube links show track details only in audio mode. To play here, choose a file or paste a direct audio URL or SoundCloud link.';
      return;
    }
    this.musicNotice.textContent='Loading '+link.provider+'…';
    try{
      if(link.provider==='soundcloud'){
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
        this.frame('https://www.tiktok.com/player/v1/'+link.id+'?music_info=1&description=1',320);
        this.playerReadyTimer=setTimeout(()=>{if(epoch===this.epoch)this.musicNotice.textContent='TikTok did not report that the player is ready. Try its controls, retry, or open the original video.';},12000);
      }
    }catch(e){
      if(epoch!==this.epoch)return;
      this.musicNotice.textContent=e.message;
      if(link.provider==='spotify')this.useSpotifyFrame(link,epoch);
      this.setCommands(false);
    }
  }

  loadAudio(url,name,epoch){
    const audio=this.audio=new Audio();
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
    this.musicToggle.setAttribute('aria-label',canPause?'Pause':'Play');
  }
  formatTime(value){if(!Number.isFinite(value)||value<=0)return '—';return Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0');}
  updateMusic(){
    if(this.audio){
      this.elapsed=this.audio.currentTime;
      this.duration=this.audio.duration;
    }
    this.clock.textContent=(this.elapsed?this.formatTime(this.elapsed):'0:00')+' / '+this.formatTime(this.duration);
    const seekable=Number.isFinite(this.duration)&&this.duration>0&&!!(this.audio||this.widget||this.spotify);
    this.seek.disabled=!seekable;
    this.seek.max=seekable?this.duration:1;
    if(!this.seek.matches(':active'))this.seek.value=seekable?this.elapsed:0;
  }
  command(action){
    if(!this.link)return;
    const pause=action==='pause'||(action==='toggle'&&this.canPause);
    if(this.audio){
      if(pause)this.audio.pause();
      else if(action==='toggle')this.audio.play().catch(()=>{this.musicNotice.textContent='Could not start playback.';});
    }else if(this.widget){
      if(action==='previous')this.widget.prev();
      else if(action==='next')this.widget.next();
      else if(pause)this.widget.pause();
      else this.widget.play();
    }else if(this.spotify){
      if(pause)this.spotify.pause();
      else if(action==='toggle')this.spotify.togglePlay();
    }else if(this.link.provider==='tiktok'&&(action==='toggle'||action==='pause')){
      this.iframe?.contentWindow.postMessage({'x-tiktok-player':true,type:pause?'pause':'play'},'https://www.tiktok.com');
    }
  }
}
if(typeof module!=='undefined')module.exports={TerminalMusicLinks};
