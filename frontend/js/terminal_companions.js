'use strict';
const trCompanion = value => typeof ui === 'function' ? ui(value) : value;
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
const MUSIC_ICONS={
  prev:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="2.2" height="12" rx="1" fill="currentColor"/><path d="M18.5 6.8a1 1 0 0 0-1.56-.83l-7.8 5.2a1 1 0 0 0 0 1.66l7.8 5.2a1 1 0 0 0 1.56-.83V6.8z" fill="currentColor"/></svg>',
  rewind:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.5 7.2a1 1 0 0 0-1.6-.8l-6.4 4.8a1 1 0 0 0 0 1.6l6.4 4.8a1 1 0 0 0 1.6-.8V7.2zM20.5 7.2a1 1 0 0 0-1.6-.8l-6.4 4.8a1 1 0 0 0 0 1.6l6.4 4.8a1 1 0 0 0 1.6-.8V7.2z" fill="currentColor"/></svg>',
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 5.6a1.1 1.1 0 0 1 1.68-.93l9.4 6a1.1 1.1 0 0 1 0 1.86l-9.4 6A1.1 1.1 0 0 1 8.2 17.6V5.6z" fill="currentColor"/></svg>',
  pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="3.8" height="13" rx="1.4" fill="currentColor"/><rect x="13.7" y="5.5" width="3.8" height="13" rx="1.4" fill="currentColor"/></svg>',
  forward:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.2a1 1 0 0 1 1.6-.8l6.4 4.8a1 1 0 0 1 0 1.6l-6.4 4.8a1 1 0 0 1-1.6-.8V7.2zM12.5 7.2a1 1 0 0 1 1.6-.8l6.4 4.8a1 1 0 0 1 0 1.6l-6.4 4.8a1 1 0 0 1-1.6-.8V7.2z" fill="currentColor"/></svg>',
  next:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="16.8" y="6" width="2.2" height="12" rx="1" fill="currentColor"/><path d="M5.5 6.8a1 1 0 0 1 1.56-.83l7.8 5.2a1 1 0 0 1 0 1.66l-7.8 5.2A1 1 0 0 1 5.5 17.2V6.8z" fill="currentColor"/></svg>',
  volume:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
  muted:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
  expand:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>'
};
const POPUP_RATIOS=[
  {key:'free',label:'Free',ratio:null},
  {key:'16/9',label:'16:9',ratio:16/9},
  {key:'9/16',label:'9:16',ratio:9/16},
  {key:'4/3',label:'4:3',ratio:4/3},
  {key:'1/1',label:'1:1',ratio:1}
];
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
    const width=40;
    if(width===this.edgeWidth)return;
    this.edgeWidth=width;
    this.dock.style.setProperty('--edge-width',width+'px');
    const inset='72px';
    for(const panel of Object.values(this.panels)){
      panel.style.setProperty('--companion-inset',inset);
      if(!panel.classList.contains('music-mini'))panel.style.right=inset;
    }
  }
  closeDocked(){
    if(this.open)this.toggle(this.open,false);
  }
  toggle(key,force){
    const show=force??this.open!==key;
    if(show&&this.desktop?.mode){
      this.desktop.open(null);
    }
    if(show&&this.open&&this.open!==key){
      this.toggle(this.open,false);
    }
    if(key==='music'){
      this.panels.music.classList.remove('music-mini','music-popup-interacting');
      if(this.panels.music.style)this.panels.music.style.right='72px';
      this.setVideoHidden?.(true);
      this.updateMusicPopupButton();
    }
    this.panels[key].classList.toggle('open',show);this.panels[key].inert=!show;document.getElementById('edge-'+key)?.setAttribute('aria-expanded',String(show));
    if(show)this.open=key;
    else if(this.open===key)this.open=null;
    this.desktop?.syncRailActive?.();
    if(key==='calendar'&&show)this.renderCalendar();
  }
  setMusicMini(mini,focus=true){
    if(!this.link)return;
    const panel=this.panels.music;
    if(!mini){
      panel.classList.remove('music-popup-interacting');
      this.toggle('music',true);
    }else{
      panel.classList.add('music-mini','open');
      panel.inert=false;
      if(!this.popupRatio||this.popupRatioProvider!==this.link.provider){
        this.popupRatio='free';
        this.popupRatioProvider=this.link.provider;
      }
      this.setVideoHidden(false);
      this.applyPopupLayout();
      if(this.open==='music'){
        this.open=null;
        document.getElementById('edge-music')?.setAttribute('aria-expanded','false');
      }
      this.desktop?.syncRailActive?.();
      this.updateMusicPopupButton();
    }
    if(focus)(mini&&this.isVideoProvider()&&this.iframe?this.popupExpandButton:this.popupButton)?.focus();
  }
  isVideoProvider(){return ['youtube','tiktok'].includes(this.link?.provider);}
  setVideoHidden(hidden){
    const panel=this.panels.music;
    const enabled=this.isVideoProvider()&&!!this.iframe&&!panel.classList.contains('music-mini');
    panel.classList.toggle('music-video-hidden',enabled&&hidden);
    if(this.link?.provider==='tiktok'&&this.iframe)this.iframe.tabIndex=enabled&&hidden?-1:0;
  }
  getPopupRatioEntry(){
    return POPUP_RATIOS.find(r=>r.key===this.popupRatio)||POPUP_RATIOS[0];
  }
  applyPopupLayout(){
    const panel=this.panels.music;
    if(!panel.classList.contains('music-mini'))return;
    const isTikTok=this.link?.provider==='tiktok';
    const maxW=Math.max(220,innerWidth-12);
    const maxH=Math.max(150,innerHeight-12);
    const defaultW=this.isVideoProvider()?(isTikTok?260:340):340;
    const defaultH=isTikTok?380:192;
    const width=Math.round(Math.max(180,Math.min(maxW,this.videoPopupSize?.w||defaultW)));
    if(this.isVideoProvider()){
      const entry=this.getPopupRatioEntry();
      if(entry.key==='free'||!entry.ratio){
        const height=Math.round(Math.max(120,Math.min(maxH,this.videoPopupSize?.h||defaultH)));
        panel.style.setProperty('--music-mini-w',width+'px');
        panel.style.setProperty('--music-mini-h',height+'px');
        panel.style.setProperty('--music-mini-aspect','auto');
      }else{
        const clampedW=Math.max(180,Math.min(width,Math.round(maxH*entry.ratio)));
        panel.style.setProperty('--music-mini-w',clampedW+'px');
        panel.style.setProperty('--music-mini-aspect',entry.key);
        panel.style.setProperty('--music-mini-h','auto');
      }
      if(this.popupRatioButton)this.popupRatioButton.textContent=entry.label;
    }else{
      panel.style.setProperty('--music-mini-w',width+'px');
      panel.style.setProperty('--music-mini-h',this.videoPopupSize?.h?Math.round(Math.max(120,Math.min(maxH,this.videoPopupSize.h)))+'px':'auto');
      panel.style.setProperty('--music-mini-aspect','auto');
    }
    this.placeVideoPopup();
  }
  placeVideoPopup(position=this.videoPopupPosition){
    const panel=this.panels.music;
    if(!panel.classList.contains('music-mini'))return;
    if(!position){
      const rect=panel.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      position={x:Math.max(4,innerWidth-rect.width-20),y:Math.max(4,innerHeight-rect.height-20)};
    }
    const maxX=Math.max(4,innerWidth-panel.offsetWidth-4);
    const maxY=Math.max(4,innerHeight-panel.offsetHeight-4);
    const x=Math.round(Math.max(4,Math.min(position.x,maxX)));
    const y=Math.round(Math.max(4,Math.min(position.y,maxY)));
    this.videoPopupPosition={x,y};
    panel.dataset.floatingPosition='';
    panel.style.setProperty('--music-left',x+'px');
    panel.style.setProperty('--music-top',y+'px');
  }
  resizeVideoPopup(){
    const sizes=this.link?.provider==='tiktok'?[240,320,420]:[320,480,680];
    const cur=this.panels.music.offsetWidth||sizes[0];
    const next=sizes.find(s=>s>cur+18)||sizes[0];
    const curH=this.panels.music.offsetHeight||200;
    const scale=next/cur;
    this.videoPopupSize={w:next,h:Math.round(curH*scale)};
    this.applyPopupLayout();
  }
  cyclePopupRatio(){
    if(!this.isVideoProvider())return;
    const idx=POPUP_RATIOS.findIndex(r=>r.key===this.popupRatio);
    const next=POPUP_RATIOS[(idx+1)%POPUP_RATIOS.length];
    this.popupRatio=next.key;
    if(next.ratio){
      const w=this.panels.music.offsetWidth||this.videoPopupSize?.w||340;
      this.videoPopupSize={w,h:Math.round(w/next.ratio)};
    }
    this.applyPopupLayout();
  }
  installVideoPopup(panel){
    const rail=document.createElement('div');rail.className='video-popup-tools';
    const button=(symbol,label,action,cls)=>{
      const element=document.createElement('button');
      element.type='button';element.innerHTML=symbol;element.title=ui(label);
      element.setAttribute('aria-label',element.title);
      if(cls)element.className=cls;
      if(action)element.onclick=action;
      rail.appendChild(element);return element;
    };
    this.popupExpandButton=button(MUSIC_ICONS.expand,'Expand',()=>this.setMusicMini(false));
    button(MUSIC_ICONS.close,'Close popup',()=>this.toggle('music',false));
    panel.appendChild(rail);

    const startDrag=(event,handle)=>{
      if(event.button!==0||!panel.classList.contains('music-mini'))return;
      if(event.target.closest('button,input,a,.music-popup-resizer'))return;
      event.preventDefault();
      const rect=panel.getBoundingClientRect();
      const drag={pointer:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};
      panel.classList.add('music-popup-interacting');
      handle.setPointerCapture(event.pointerId);
      const onMove=ev=>{
        if(ev.pointerId!==drag.pointer)return;
        this.placeVideoPopup({x:ev.clientX-drag.dx,y:ev.clientY-drag.dy});
      };
      const onDone=()=>{
        panel.classList.remove('music-popup-interacting');
        handle.removeEventListener('pointermove',onMove);
        handle.removeEventListener('pointerup',onDone);
        handle.removeEventListener('pointercancel',onDone);
        handle.removeEventListener('lostpointercapture',onDone);
      };
      handle.addEventListener('pointermove',onMove);
      handle.addEventListener('pointerup',onDone);
      handle.addEventListener('pointercancel',onDone);
      handle.addEventListener('lostpointercapture',onDone);
    };
    rail.addEventListener('pointerdown',e=>startDrag(e,rail));
    panel.querySelector('header').addEventListener('pointerdown',e=>startDrag(e,panel.querySelector('header')));
    const hud=panel.querySelector('.music-hud');
    if(hud)hud.addEventListener('pointerdown',e=>{if(panel.classList.contains('music-mini'))startDrag(e,hud);});
    const shield=document.createElement('div');
    shield.className='music-video-shield';
    shield.setAttribute('aria-hidden','true');
    shield.addEventListener('pointerdown',event=>{
      if(event.button!==0||!panel.classList.contains('music-mini'))return;
      event.preventDefault();
      const pid=event.pointerId,startX=event.clientX,startY=event.clientY,rect=panel.getBoundingClientRect();
      let moved=false;
      const dx=startX-rect.left,dy=startY-rect.top;
      panel.classList.add('music-popup-interacting');
      shield.setPointerCapture(pid);
      const onMove=ev=>{
        if(ev.pointerId!==pid)return;
        if(!moved&&Math.hypot(ev.clientX-startX,ev.clientY-startY)>4)moved=true;
        if(moved)this.placeVideoPopup({x:ev.clientX-dx,y:ev.clientY-dy});
      };
      const onDone=()=>{
        panel.classList.remove('music-popup-interacting');
        shield.removeEventListener('pointermove',onMove);
        shield.removeEventListener('pointerup',onUp);
        shield.removeEventListener('pointercancel',onDone);
        shield.removeEventListener('lostpointercapture',onDone);
      };
      const onUp=ev=>{
        onDone();
        if(ev.pointerId===pid&&!moved)this.command('toggle');
      };
      shield.addEventListener('pointermove',onMove);
      shield.addEventListener('pointerup',onUp);
      shield.addEventListener('pointercancel',onDone);
      shield.addEventListener('lostpointercapture',onDone);
    });
    panel.appendChild(shield);
    panel.addEventListener('pointerleave',()=>{
      if(panel.classList.contains('music-mini')&&document.activeElement&&panel.contains(document.activeElement)){
        document.activeElement.blur();
      }
    });
    rail.addEventListener('dblclick',event=>{if(!event.target.closest('button'))this.resizeVideoPopup();});

    const addResizer=(dirs,cls,label)=>{
      const handle=document.createElement('div');
      handle.className='music-popup-resizer '+cls;
      handle.title=label;
      handle.setAttribute('aria-label',label);
      handle.addEventListener('pointerdown',event=>{
        if(event.button!==0||!panel.classList.contains('music-mini'))return;
        event.preventDefault();event.stopPropagation();
        const pid=event.pointerId;
        const rect=panel.getBoundingClientRect();
        this.placeVideoPopup({x:rect.left,y:rect.top});
        panel.classList.add('music-popup-interacting');
        handle.setPointerCapture(pid);
        const startX=event.clientX,startY=event.clientY;
        const startLeft=rect.left,startTop=rect.top,startRight=rect.right,startBottom=rect.bottom;
        const startW=rect.width,startH=rect.height;
        const minW=180,minH=120;
        const hasW=dirs.includes('w'),hasE=dirs.includes('e'),hasN=dirs.includes('n'),hasS=dirs.includes('s');
        const onMove=ev=>{
          if(ev.pointerId!==pid)return;
          const dw=ev.clientX-startX,dh=ev.clientY-startY;
          let left=startLeft,top=startTop,width=startW,height=startH;
          if(hasW){
            left=Math.max(4,Math.min(startRight-minW,startLeft+dw));
            width=startRight-left;
          }else if(hasE){
            width=Math.max(minW,Math.min(innerWidth-4-startLeft,startW+dw));
          }
          if(hasN){
            top=Math.max(4,Math.min(startBottom-minH,startTop+dh));
            height=startBottom-top;
          }else if(hasS){
            height=Math.max(minH,Math.min(innerHeight-4-startTop,startH+dh));
          }
          if(this.isVideoProvider())this.popupRatio='free';
          this.videoPopupSize={w:width,h:height};
          this.videoPopupPosition={x:left,y:top};
          this.applyPopupLayout();
        };
        const onDone=()=>{
          panel.classList.remove('music-popup-interacting');
          handle.removeEventListener('pointermove',onMove);
          handle.removeEventListener('pointerup',onDone);
          handle.removeEventListener('pointercancel',onDone);
          handle.removeEventListener('lostpointercapture',onDone);
        };
        handle.addEventListener('pointermove',onMove);
        handle.addEventListener('pointerup',onDone);
        handle.addEventListener('pointercancel',onDone);
        handle.addEventListener('lostpointercapture',onDone);
      });
      panel.appendChild(handle);
    };
    addResizer('nw','resizer-nw','Kéo góc trên-trái để phóng to / thu nhỏ tự do');
    addResizer('ne','resizer-ne','Kéo góc trên-phải để phóng to / thu nhỏ tự do');
    addResizer('sw','resizer-sw','Kéo góc dưới-trái để phóng to / thu nhỏ tự do');
    addResizer('se','resizer-se resizer-corner','Kéo góc dưới-phải để phóng to / thu nhỏ tự do');
    addResizer('n','resizer-n','Kéo cạnh trên để chỉnh chiều cao');
    addResizer('s','resizer-s resizer-bottom','Kéo cạnh dưới để chỉnh chiều cao');
    addResizer('w','resizer-w','Kéo cạnh trái để chỉnh chiều rộng');
    addResizer('e','resizer-e resizer-right','Kéo cạnh phải để chỉnh chiều rộng');

    window.addEventListener('resize',()=>{
      if(panel.classList.contains('music-mini'))this.applyPopupLayout();
    });
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
    const protocolEnabled=!replay&&typeof NewsProtocols!=='undefined'&&(this.currency==='All'||this.currency==='USD');
    let startDay=today;
    if(protocolEnabled){
      const [nyY,nyM,nyD]=NewsProtocols.day(+now/1000).split('-').map(Number);
      const nyDate=new Date(nyY,nyM-1,nyD);
      if(nyDate<today)startDay=nyDate;
    }
    const events=rawEvents.filter(event=>
      this.impacts.has(event.impact)&&(this.currency==='All'||event.currency===this.currency)&&event.time*1000>=+startDay);
    if(!replay&&data&&data!==this.calendarSyncedData&&typeof NewsProtocols!=='undefined'){
      this.calendarSyncedData=data;
      const archived=Array.isArray(this.protocolEvents)?this.protocolEvents:Array.isArray(this.news?.events)?this.news.events:[];
      const merged=NewsProtocols.merge(archived,rawEvents,+now/1000);
      this.protocolEvents=merged;
      if(this.news)this.news.events=merged;
      if(merged.length)Workspace.write('terminal_protocol_events_v1',merged);
    }
    const protocolEvents=protocolEnabled?NewsProtocols.merge(this.protocolEvents||this.news?.events||[],rawEvents,+now/1000):[];
    const next=events.find(event=>!event.tentative&&event.time*1000>+now);
    const nextToday=events.find(event=>event.time*1000>+now&&event.time*1000<+tomorrow);
    const key=JSON.stringify([replay,this.currency,[...this.impacts],data?.checked_at,data?.error,+startDay,+today,next?.time,nextToday?.time,protocolEnabled?[protocolEvents.length,protocolEvents[0]?.time,protocolEvents.at(-1)?.time]:0]);
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
        this.buildCalendarList(events,next,nextToday,today,tomorrow,protocolEvents,protocolEnabled,startDay);
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
  buildCalendarList(events,next,nextToday,today,tomorrow,protocolEvents=[],protocolEnabled=false,startDay=today){
    const data=this.calendarData;
    const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const todayIso=iso(today),tomorrowIso=iso(tomorrow),startIso=iso(startDay);
    const groups=new Map([[todayIso,{date:today,events:[],cards:[],checked:false}]]);
    for(const event of events){
      const dayKey=protocolEnabled&&typeof NewsProtocols!=='undefined'&&event.currency==='USD'?NewsProtocols.day(event.time):null;
      let day,k;
      if(dayKey){
        const [y,m,dd]=dayKey.split('-').map(Number);
        day=new Date(y,m-1,dd);k=dayKey;
      }else{
        const ed=new Date(event.time*1000);
        day=new Date(ed.getFullYear(),ed.getMonth(),ed.getDate());k=iso(day);
      }
      if(k<startIso)continue;
      if(!groups.has(k))groups.set(k,{date:day,events:[],cards:[],checked:false});
      groups.get(k).events.push(event);
    }
    if(protocolEnabled&&protocolEvents.length){
      const limit=+today+21*86400000;
      let maxMs=+today;
      for(const event of protocolEvents)if(event.time*1000>=+startDay&&event.time*1000<=limit)maxMs=Math.max(maxMs,event.time*1000);
      const endMs=Math.min(limit,maxMs+5*86400000);
      for(let d=new Date(startDay);+d<=endMs;d.setDate(d.getDate()+1)){
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
      heading.textContent=dayIso===todayIso?trCompanion('Today'):dayIso===tomorrowIso?trCompanion('Tomorrow'):dayIso<todayIso?dateFormat.format(entry.date)+' · NY Session':dateFormat.format(entry.date);
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
    if(card.nextEvents?.length&&['cpi-day','ppi-day','fed-day'].includes(card.id)){
      const warn=document.createElement('div');
      warn.className='calendar-protocol-next';
      warn.textContent='Lưu ý phiên kế tiếp: '+card.nextEvents.map(e=>e.title).join(', ');
      list.appendChild(warn);
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
    const panel=this.panels.music;panel.insertAdjacentHTML('beforeend',`<form class="music-link-form"><input type="url" required placeholder="Paste YouTube, Spotify, SoundCloud or TikTok link" aria-label="Music link"><button type="submit">Load</button><button type="button" data-audio-file>File</button><input type="file" accept="audio/*,.mp3,.m4a,.flac,.opus" hidden></form><div class="music-now"><div class="music-disc"><img alt="Track artwork" hidden></div><div><h3>Nothing is playing</h3><p>Paste a link to load the official player.</p></div></div><div class="music-hud"><div class="music-progress-row"><div class="music-track" role="slider" tabindex="0" aria-label="Playback position" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0" aria-disabled="true"><div class="music-rail"><div class="music-buf"></div><div class="music-fill"></div><div class="music-dot"></div></div><div class="music-tip">0:00</div></div><span class="music-clock">0:00 / —</span></div><div class="music-controls"><button type="button" data-command="previous" aria-label="Previous track" title="Bài trước">${MUSIC_ICONS.prev}</button><button type="button" data-command="rewind" aria-label="Rewind 10 seconds" title="Lùi 10 giây">${MUSIC_ICONS.rewind}</button><button type="button" data-command="toggle" aria-label="Play" title="Phát / Tạm dừng">${MUSIC_ICONS.play}</button><button type="button" data-command="forward" aria-label="Forward 10 seconds" title="Tua nhanh 10 giây">${MUSIC_ICONS.forward}</button><button type="button" data-command="next" aria-label="Next track" title="Bài tiếp">${MUSIC_ICONS.next}</button></div></div><div class="music-player-host"></div><p class="music-notice" role="status">Paste a music link or choose an audio file.</p>`);
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
    this.installVideoPopup(panel);
    this.updateMusicPopupButton();
    const fileInput=this.form.querySelector('input[type=file]');
    fileInput.accept+=',video/mp4,.mp4';
    this.form.querySelector('[data-audio-file]').onclick=()=>fileInput.click();
    this.tiktokFileButton=document.createElement('button');
    this.tiktokFileButton.type='button';this.tiktokFileButton.hidden=true;
    this.tiktokFileButton.textContent=ui('Play saved video or audio');
    this.tiktokFileButton.onclick=()=>fileInput.click();
    this.musicNotice.after(this.tiktokFileButton);
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
    this.musicNotice.after(this.tabAudioButton);
    window.addEventListener('pagehide',()=>{
      this.tabAudioRequest++;
      this.stopTabAudio();
    });
    fileInput.onchange=()=>{
      const file=fileInput.files[0];
      if(file)this.loadMusic('',file);
      fileInput.value='';
    };
    const savedVol=Workspace.read('terminal_music_volume_v1',80);
    this.musicVolume=Number.isFinite(Number(savedVol))?Math.max(0,Math.min(100,Math.round(Number(savedVol)))):80;
    this.lastNonZeroVolume=this.musicVolume>0?this.musicVolume:80;
    this.musicVolWrap=document.createElement('div');
    this.musicVolWrap.className='music-vol-wrap';
    this.musicVolWrap.hidden=true;
    this.musicMute=document.createElement('button');
    this.musicMute.type='button';
    this.musicMute.className='music-mute-btn';
    this.musicMute.hidden=true;
    this.musicMute.innerHTML=MUSIC_ICONS.volume;
    this.musicMute.onclick=()=>this.toggleMute();
    this.musicVolPop=document.createElement('div');
    this.musicVolPop.className='music-vol-pop';
    this.musicVolSlider=document.createElement('input');
    this.musicVolSlider.type='range';
    this.musicVolSlider.className='music-vol-slider';
    this.musicVolSlider.min='0';
    this.musicVolSlider.max='100';
    this.musicVolSlider.step='1';
    this.musicVolSlider.value=String(this.musicVolume);
    this.musicVolSlider.setAttribute('aria-label',ui('Volume'));
    this.musicVolSlider.addEventListener('input',()=>this.setVolume(this.musicVolSlider.value));
    this.musicVolPop.appendChild(this.musicVolSlider);
    this.musicVolWrap.append(this.musicMute,this.musicVolPop);
    panel.querySelector('.music-controls').appendChild(this.musicVolWrap);
    this.track=panel.querySelector('.music-track');
    this.trackFill=panel.querySelector('.music-fill');
    this.trackBuf=panel.querySelector('.music-buf');
    this.trackDot=panel.querySelector('.music-dot');
    this.trackTip=panel.querySelector('.music-tip');
    this.seek={disabled:true,max:1,value:0,dragging:false};
    const trackTime=clientX=>{
      const r=this.track.getBoundingClientRect(),dur=this.duration||0;
      if(!r.width||dur<=0)return {x:0,s:0};
      const x=Math.min(r.width,Math.max(0,clientX-r.left));
      return {x,s:(x/r.width)*dur};
    };
    this.track.addEventListener('pointerdown',event=>{
      if(event.button!==0||this.seek.disabled||!(this.duration>0))return;
      event.preventDefault();event.stopPropagation();
      this.seek.dragging=true;
      this.track.classList.add('drag');
      this.track.setPointerCapture(event.pointerId);
      const {x,s}=trackTime(event.clientX);
      this.trackTip.style.left=x+'px';this.trackTip.textContent=this.formatTime(s);
      this.seekToSeconds(s);
    });
    this.track.addEventListener('pointermove',event=>{
      if(this.seek.disabled||!(this.duration>0))return;
      const {x,s}=trackTime(event.clientX);
      this.trackTip.style.left=x+'px';this.trackTip.textContent=this.formatTime(s);
      if(this.seek.dragging)this.seekToSeconds(s);
    });
    const endTrack=()=>{this.seek.dragging=false;this.track.classList.remove('drag');};
    this.track.addEventListener('pointerup',endTrack);
    this.track.addEventListener('pointercancel',endTrack);
    this.track.addEventListener('lostpointercapture',endTrack);
    const spreadTrackWave=clientX=>{
      if(!panel.classList.contains('music-mini')||this.link?.provider!=='youtube')return;
      [...panel.querySelectorAll('.music-controls button:not([data-command=toggle]):not([hidden]), .music-clock')]
        .map(el=>{const r=el.getBoundingClientRect();return {el,d:Math.abs(r.left+r.width/2-clientX)};})
        .sort((a,b)=>a.d-b.d)
        .forEach((o,i)=>o.el.style.setProperty('--dly',(i*0.04).toFixed(2)+'s'));
    };
    this.track.addEventListener('pointerenter',event=>spreadTrackWave(event.clientX));
    this.track.addEventListener('pointerleave',event=>spreadTrackWave(event.clientX));
    this.track.addEventListener('keydown',event=>{
      if(this.seek.disabled||!(this.duration>0))return;
      const step={ArrowLeft:-5,ArrowRight:5,ArrowDown:-5,ArrowUp:5,Home:-this.duration,End:this.duration}[event.key];
      if(step!==undefined){event.preventDefault();this.seekToSeconds((this.elapsed||0)+step);}
    });
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
        panel.classList.add('music-shield-active');
        if(document.activeElement===this.iframe){this.iframe.blur();window.focus?.();}
        this.setCommands(true);
        this.musicVolWrap.hidden=false;
        this.musicVolWrap.classList.add('no-slider');
        this.musicMute.hidden=false;
        this.musicMute.disabled=false;
        this.tabAudioButton.hidden=true;
        this.tiktokFileButton.hidden=true;
        this.musicNotice.textContent='';
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
    this.panels.music.classList.remove('music-shield-active');
    this.youtubeStarted=false;
    this.tiktokNative=false;
    this.tiktokRecovering=false;
    this.musicVolWrap.hidden=true;
    this.musicMute.hidden=true;
    this.setTikTokMuted(false);
    this.tiktokFileButton.hidden=true;
    this.setVideoHidden(true);
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
    this.panels.music.dataset.provider=link.provider;
    if(this.panels.music.classList.contains('music-mini')){
      if(this.popupRatioProvider!==link.provider){this.popupRatio='free';this.popupRatioProvider=link.provider;}
      this.applyPopupLayout();
    }
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
    this.musicVolWrap.hidden=false;
    this.musicVolWrap.classList.add('no-slider');
    this.musicMute.hidden=false;
    this.musicMute.disabled=true;
    this.setTikTokMuted(false);
    this.frame(src.href,360);
    this.popupButton.disabled=false;
    this.setVideoHidden(!this.panels.music.classList.contains('music-mini'));
    if(native)this.tiktokPlayPrompt();
    else this.playerReadyTimer=setTimeout(()=>{
      if(epoch===this.epoch&&!this.tiktokStarted)this.tiktokPlayPrompt();
    },8000);
  }

  setTikTokMuted(muted){
    this.tiktokMuted=muted;
    this.updateMuteButton(muted);
  }
  updateMuteButton(muted){
    const label=ui(muted?'Unmute':'Mute');
    this.musicMute.innerHTML=muted?MUSIC_ICONS.muted:MUSIC_ICONS.volume;
    this.musicMute.setAttribute('aria-label',label);
    this.musicMute.title=label;
    this.musicMute.setAttribute('aria-pressed',String(!!muted));
    const displayVol=muted?0:this.musicVolume;
    if(this.musicVolSlider){
      this.musicVolSlider.value=String(displayVol);
      this.musicVolWrap?.style.setProperty('--vol',displayVol+'%');
    }
  }
  setVolume(val){
    const v=Math.max(0,Math.min(100,Math.round(Number(val)||0)));
    this.musicVolume=v;
    if(v>0)this.lastNonZeroVolume=v;
    Workspace.write('terminal_music_volume_v1',v);
    if(this.youtube){
      this.youtube.setVolume?.(v);
      if(v===0)this.youtube.mute?.();
      else if(this.youtube.isMuted?.())this.youtube.unMute?.();
    }else if(this.audio){
      this.audio.volume=v/100;
      this.audio.muted=v===0;
    }
    this.updateMuteButton(v===0);
  }
  toggleMute(){
    if(this.link?.provider==='tiktok'){
      this.sendTikTok(this.tiktokMuted?'unMute':'mute');
    }else if(this.youtube){
      const muted=!!this.youtube.isMuted?.();
      if(muted){
        const nextVol=this.musicVolume>0?this.musicVolume:(this.lastNonZeroVolume||80);
        this.musicVolume=nextVol;
        this.youtube.unMute?.();
        this.youtube.setVolume?.(nextVol);
        this.updateMuteButton(false);
      }else{
        this.youtube.mute?.();
        this.updateMuteButton(true);
      }
    }else if(this.audio){
      if(this.audio.muted){
        const nextVol=this.musicVolume>0?this.musicVolume:(this.lastNonZeroVolume||80);
        this.musicVolume=nextVol;
        this.audio.muted=false;
        this.audio.volume=nextVol/100;
        this.updateMuteButton(false);
      }else{
        this.audio.muted=true;
        this.updateMuteButton(true);
      }
    }
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
    this.musicVolWrap.hidden=true;
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
    const params=new URLSearchParams({enablejsapi:'1',origin:location.origin,playsinline:'1',controls:'0',rel:'0',modestbranding:'1',iv_load_policy:'3'});
    const isMixList=!!(link.list&&/^RD/i.test(link.list));
    const mixVideoId=!link.id&&isMixList?link.list.match(/^RD(?:MM|EM|AMVM|CL|CM)?([\w-]{11})$/i)?.[1]||null:null;
    const videoId=link.id||mixVideoId;
    const embedList=link.list&&!isMixList?link.list:null;
    if(embedList){
      if(!videoId)params.set('listType','playlist');
      params.set('list',embedList);
    }
    const frame=this.frame('https://www.youtube.com/embed/'+(videoId||'videoseries')+'?'+params,240);
    await this.script('https://www.youtube.com/iframe_api',()=>typeof window.YT?.Player==='function');
    if(epoch!==this.epoch)return;
    this.youtube=new window.YT.Player(frame,{
      events:{
        onReady:()=>{if(epoch===this.epoch){this.setCommands(true,!!embedList);this.musicVolWrap.hidden=false;this.musicVolWrap.classList.remove('no-slider');this.musicMute.hidden=false;this.musicMute.disabled=false;this.youtube?.setVolume?.(this.musicVolume);if(this.musicVolume===0)this.youtube?.mute?.();this.updateMuteButton(this.musicVolume===0||!!this.youtube?.isMuted?.());this.setVideoHidden(!this.panels.music.classList.contains('music-mini'));this.panels.music.classList.add('music-shield-active');this.musicNotice.textContent=isMixList&&videoId?'YouTube Mix (RD...) không hỗ trợ nhúng playlist; đang phát video này.':'';}},
        onStateChange:({data})=>{
          if(epoch!==this.epoch)return;
          this.setPlaying(data===1,data===1||data===3);
          if(data===1){
            this.musicNotice.textContent=isMixList&&videoId?'YouTube Mix (RD...) không hỗ trợ nhúng playlist; đang phát video này.':'';
            this.youtubeStarted=true;
            this.panels.music.classList.add('music-shield-active');
            if(document.activeElement===this.iframe){this.iframe.blur();window.focus?.();}
          }
        },
        onError:({data})=>{
          if(epoch!==this.epoch)return;
          if(embedList&&videoId){
            this.loadYouTube({provider:'youtube',id:videoId,list:null,url:'https://www.youtube.com/watch?v='+videoId},epoch);
            return;
          }
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
    this.musicVolWrap.hidden=false;
    this.musicVolWrap.classList.remove('no-slider');
    this.musicMute.hidden=false;
    this.musicMute.disabled=false;
    audio.volume=this.musicVolume/100;
    audio.muted=this.musicVolume===0;
    this.updateMuteButton(audio.muted);
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

  setCommands(play,skip=false){
    for(const b of this.panels.music.querySelectorAll('[data-command]')){
      const cmd=b.dataset.command;
      b.disabled=!(cmd==='toggle'||cmd==='rewind'||cmd==='forward'?play:skip);
    }
  }
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
    this.panels.music.classList.toggle('music-playing',playing);
    this.disc.classList.toggle('playing',playing);
    this.musicToggle.innerHTML=canPause?MUSIC_ICONS.pause:MUSIC_ICONS.play;
    this.musicToggle.setAttribute('aria-label',ui(canPause?'Pause':'Play'));
    document.getElementById('edge-music')?.classList.toggle('music-live',playing);
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
    if(!(this.seek.dragging||this.seek.matches?.(':active')))this.seek.value=seekable?this.elapsed:0;
    const pct=seekable?Math.min(100,Math.max(0,(Number(this.seek.value)/this.duration)*100)):0;
    this.seek.style?.setProperty?.('--seek-pct',pct.toFixed(2)+'%');
    if(this.track){
      this.track.setAttribute('aria-disabled',String(!seekable));
      this.track.setAttribute('aria-valuemax',String(Math.round(seekable?this.duration:1)));
      this.track.setAttribute('aria-valuenow',String(Math.round(this.seek.value||0)));
      const w=pct.toFixed(2)+'%';
      this.trackFill.style.width=w;
      this.trackDot.style.left=w;
      let bufPct=pct;
      if(seekable&&typeof this.youtube?.getVideoLoadedFraction==='function'){
        bufPct=Math.max(pct,Math.min(100,(this.youtube.getVideoLoadedFraction()||0)*100));
      }else if(seekable&&this.audio?.buffered?.length){
        try{bufPct=Math.max(pct,Math.min(100,(this.audio.buffered.end(this.audio.buffered.length-1)/this.duration)*100));}catch{}
      }
      this.trackBuf.style.width=bufPct.toFixed(2)+'%';
    }
  }
  seekToSeconds(seconds){
    if(!Number.isFinite(seconds))return;
    const clamped=this.duration>0?Math.max(0,Math.min(this.duration,seconds)):Math.max(0,seconds);
    if(this.audio)this.audio.currentTime=clamped;
    else if(this.widget)this.widget.seekTo(clamped*1000);
    else if(this.spotify)this.spotify.seek(clamped);
    else if(this.youtube)this.youtube.seekTo?.(clamped,true);
    else if(this.link?.provider==='tiktok')this.sendTikTok('seekTo',clamped);
    this.elapsed=clamped;
    this.updateMusic();
  }
  command(action){
    if(!this.link)return;
    if(action==='rewind'||action==='forward'){
      const base=typeof this.youtube?.getCurrentTime==='function'?this.youtube.getCurrentTime():this.audio?this.audio.currentTime:this.elapsed||0;
      this.seekToSeconds(base+(action==='forward'?10:-10));
      return;
    }
    const pause=action==='pause'||(action==='toggle'&&this.canPause);
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
if(typeof module!=='undefined')module.exports={TerminalMusicLinks,TerminalCompanions};
