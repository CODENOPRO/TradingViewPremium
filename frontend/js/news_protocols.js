/* Reference cards supplied by the user. No market predictions are inferred. */
const NewsProtocols=(()=>{
  const zone='America/New_York',format=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  function parts(seconds){return Object.fromEntries(format.formatToParts(new Date(seconds*1000)).map(p=>[p.type,p.value]));}
  function day(seconds){const p=parts(seconds);return `${p.year}-${p.month}-${p.day}`;}
  function shift(date,amount){const d=new Date(date+'T12:00:00Z');const step=Math.sign(amount);for(let n=Math.abs(amount);n;){d.setUTCDate(d.getUTCDate()+step);if(![0,6].includes(d.getUTCDay()))n--;}return d.toISOString().slice(0,10);}
  function monday(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
  function match(events,now){
    const today=day(now),weekday=new Date(today+'T12:00:00Z').getUTCDay(),groups=new Map();
    if([0,6].includes(weekday))return [];
    const usd=events.filter(e=>e&&typeof e.title==='string'&&e.currency==='USD'&&!e.tentative&&Number.isFinite(e.time));
    const add=(id,title,e,reason)=>{if(!groups.has(id))groups.set(id,{id,title,reasons:[],events:[]});const card=groups.get(id);const key=e.title+' · '+day(e.time);if(!card.events.some(x=>x.title===e.title&&x.time===e.time)){card.events.push(e);card.reasons.push(reason+' · '+key);}};
    for(const e of usd){
      const date=day(e.time),p=parts(e.time),title=e.title.toLowerCase();
      const cpi=/\bcpi\b|consumer price index/.test(title),ppi=/\bppi\b|producer price index/.test(title);
      const nfp=/non[- ]?farm (?:employment|payroll)|\bnfp\b/.test(title)&&!/adp/.test(title);
      const fomc=/fomc (?:statement|press conference)|federal funds rate|fed interest rate decision/.test(title);
      const fed=/\bpowell\b|fed chair(?:man)?\b/.test(title)&&!/nomination/.test(title);
      if(date===today&&p.hour==='08'&&p.minute==='30'&&/\bpmi\b|purchasing managers|core retail sales|(?:unemployment|jobless) claims/.test(title)&&e.impact==='High')add('0830','08:30 Red Folder News',e,'Tin 08:30 ET');
      if(nfp&&monday(date)===monday(today))add('nfp-week','NFP Protocol',e,'Tuần công bố NFP');
      if(cpi){if(date===today)add('cpi-day','CPI Day',e,'Ngày công bố CPI');if(shift(date,-1)===today)add('cpi-before','Day before CPI',e,'Ngày làm việc trước CPI');}
      if(ppi&&date===today)add('ppi-day','PPI Day',e,'Ngày công bố PPI');
      if(fomc){for(const [offset,id,label]of [[-1,'fomc-before','Day Before'],[0,'fomc-day','Event Day'],[1,'fomc-after','Day After']])if((offset?shift(date,offset):date)===today)add(id,'FOMC · '+label,e,offset<0?'Ngày làm việc trước FOMC':offset>0?'Ngày làm việc sau FOMC':'Ngày FOMC');}
      if(fed&&!fomc){if(date===today)add('fed-day','Fed Chair · Event Day',e,'Ngày Fed Chair phát biểu');if(shift(date,-1)===today)add('fed-before','Fed Chair · Day Before',e,'Ngày làm việc trước phát biểu');}
    }
    const next=shift(today,1),extra=usd.filter(e=>day(e.time)===next&&(parts(e.time).hour==='10'&&parts(e.time).minute==='00'&&e.impact==='High'||/\bppi\b|producer price index/i.test(e.title)));
    for(const card of groups.values())card.nextEvents=extra;
    return [...groups.values()];
  }
  function merge(previous,events,now){const cut=now-60*86400,m=new Map();for(const e of [...previous,...events])if(e&&Number.isFinite(e.time)&&e.time>=cut)m.set([e.time,e.currency,e.title].join('|'),e);return [...m.values()].sort((a,b)=>a.time-b.time).slice(-4000);}
  return {zone,day,shift,match,merge};
})();

class NewsProtocolPanel{
  constructor(companions){
    this.companions=companions;this.events=Workspace.read('terminal_protocol_events_v1',[]);if(!Array.isArray(this.events))this.events=[];
    this.button=document.createElement('button');this.button.className='edge-handle news-protocol-handle';this.button.type='button';this.button.textContent='News';this.button.title='News Protocol';this.button.setAttribute('aria-expanded','false');companions.dock.appendChild(this.button);
    this.root=document.createElement('section');this.root.className='news-protocol-panel';this.root.hidden=true;this.root.setAttribute('aria-label','News Protocol');
    this.root.innerHTML='<header><strong>News Protocol</strong><button type="button" data-expand aria-label="Expand News Protocol">⤢</button><button type="button" data-close aria-label="Close News Protocol">×</button></header><p class="news-protocol-date"></p><p class="news-protocol-status"></p><div class="news-protocol-cards"></div><footer>Ảnh quy tắc do bạn cung cấp · Ngày trước/sau bỏ qua cuối tuần; chưa có lịch nghỉ sàn.</footer>';
    document.body.appendChild(this.root);this.button.onclick=()=>this.show(this.root.hidden);this.root.querySelector('[data-close]').onclick=()=>this.show(false);this.root.querySelector('[data-expand]').onclick=()=>this.root.classList.toggle('expanded');
    this.bindDrag();this.render();
  }
  show(value,automatic=false){this.automaticallyOpened=value&&automatic;this.root.hidden=!value;this.button.setAttribute('aria-expanded',String(value));if(value)this.place();}
  place(){const p=Workspace.read('terminal_protocol_position_v1',null);if(p){this.root.style.left=Math.max(0,Math.min(innerWidth-this.root.offsetWidth,p.x))+'px';this.root.style.top=Math.max(0,Math.min(innerHeight-this.root.offsetHeight,p.y))+'px';this.root.style.right='auto';}}
  bindDrag(){
    const header=this.root.querySelector('header');let drag;
    header.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;e.preventDefault();const r=this.root.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};header.setPointerCapture(e.pointerId);};
    header.onpointermove=e=>{if(!drag)return;this.root.style.right='auto';this.root.style.left=Math.max(0,Math.min(innerWidth-this.root.offsetWidth,drag.left+e.clientX-drag.x))+'px';this.root.style.top=Math.max(0,Math.min(innerHeight-50,drag.top+e.clientY-drag.y))+'px';};
    header.onpointerup=header.onpointercancel=e=>{if(!drag)return;drag=null;if(header.hasPointerCapture(e.pointerId))header.releasePointerCapture(e.pointerId);const r=this.root.getBoundingClientRect();Workspace.write('terminal_protocol_position_v1',{x:r.left,y:r.top});};
    window.addEventListener('resize',()=>this.place());
  }
  render(){
    const owner=this.companions,data=owner.calendarData,now=Date.now()/1000,replay=!!owner.getReplay?.()?.running;
    if(data&&data!==this.data){this.data=data;this.events=NewsProtocols.merge(this.events,data.events||[],now);Workspace.write('terminal_protocol_events_v1',this.events);}
    const date=NewsProtocols.day(now),signature=JSON.stringify([date,replay,data?.checked_at,data?.updated_at,data?.error]);
    if(signature===this.signature)return;this.signature=signature;
    const cards=replay?[]:NewsProtocols.match(this.events,now);
    this.root.querySelector('.news-protocol-date').textContent=date+' · America/New_York';
    const stale=data?.error||!data||!Number.isFinite(data.checked_at)||now-data.checked_at>1800;
    this.root.querySelector('.news-protocol-status').textContent=replay?'Chưa có lịch tin lịch sử được xác minh cho Replay.':stale?'Lịch tin chưa cập nhật / đang lỗi. Các bảng khớp dữ liệu đã lưu có thể chưa đầy đủ.':'Khớp lịch USD · Nguồn: ShowMyTrades'+(Number.isFinite(data?.updated_at)?' · Dữ liệu cập nhật '+new Date(data.updated_at*1000).toLocaleString('en-GB',{timeZone:NewsProtocols.zone}):'');
    const body=this.root.querySelector('.news-protocol-cards');body.replaceChildren();
    if(!cards.length){const empty=document.createElement('p');empty.textContent=replay?'Trở về Live để xem bảng.':'Chưa có bảng khớp với dữ liệu lịch đã tải.';body.appendChild(empty);}
    for(const card of cards){
      const article=document.createElement('article'),title=document.createElement('h3'),reason=document.createElement('p'),img=document.createElement('img');
      title.textContent=card.title;reason.textContent=card.reasons.join('\n');img.src='assets/news-protocols/'+card.id+'.png';img.alt=card.title+' · bảng quy tắc gốc';img.loading='lazy';
      article.append(title,reason,img);
      if(card.nextEvents.length){const note=document.createElement('p');note.textContent='Lưu ý ngày làm việc tiếp theo: '+card.nextEvents.map(e=>e.title).join(', ');article.appendChild(note);}
      body.appendChild(article);
    }
    const autoKey=date+':'+cards.map(c=>c.id).sort().join(',');
    if(cards.length&&!replay&&Workspace.read('terminal_protocol_shown_v1','')!==autoKey){Workspace.write('terminal_protocol_shown_v1',autoKey);this.show(true,true);}
    if((!cards.length||replay)&&this.automaticallyOpened)this.show(false);
    this.button.dataset.matches=String(cards.length);
  }
}
if(typeof module!=='undefined')module.exports=NewsProtocols;
