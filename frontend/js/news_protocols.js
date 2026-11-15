/* Reference cards supplied by the user. No market predictions are inferred. */
const NewsProtocols=(()=>{
  const zone='America/New_York',format=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  function parts(seconds){return Object.fromEntries(format.formatToParts(new Date(seconds*1000)).map(p=>[p.type,p.value]));}
  function day(seconds){const p=parts(seconds);return `${p.year}-${p.month}-${p.day}`;}
  function shift(date,amount){const d=new Date(date+'T12:00:00Z');const step=Math.sign(amount);for(let n=Math.abs(amount);n;){d.setUTCDate(d.getUTCDate()+step);if(![0,6].includes(d.getUTCDay()))n--;}return d.toISOString().slice(0,10);}
  function monday(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
  function matchDay(events,today){
    const weekday=new Date(today+'T12:00:00Z').getUTCDay(),groups=new Map();
    if([0,6].includes(weekday))return [];
    const usd=events.filter(e=>e&&typeof e.title==='string'&&e.currency==='USD'&&!e.tentative&&Number.isFinite(e.time));
    const add=(id,title,e,reason)=>{if(!groups.has(id))groups.set(id,{id,title,reasons:[],events:[]});const card=groups.get(id);const key=e.title+' · '+day(e.time);if(!card.events.some(x=>x.title===e.title&&x.time===e.time)){card.events.push(e);card.reasons.push(reason+' · '+key);}};
    for(const e of usd){
      const date=day(e.time),p=parts(e.time),title=e.title.toLowerCase();
      const cpi=/\bcpi\b|consumer price index/.test(title),ppi=/\bppi\b|producer price index/.test(title);
      const nfp=/non[- ]?farm (?:employment|payroll)|\bnfp\b/.test(title)&&!/adp/.test(title);
      const fomc=/fomc (?:statement|press conference)|federal funds rate|fed interest rate decision/.test(title);
      const fed=/\bpowell\b|fed(?:'s|’s)?\s+chair(?:man)?\b/.test(title)&&!/nomination/.test(title);
      if(date===today&&p.hour==='08'&&p.minute==='30'&&/\bpmi\b|purchasing managers|core retail sales|retail sales (?:control group|ex autos)|(?:unemployment|jobless) claims/.test(title)&&e.impact==='High')add('0830','08:30 Red Folder News',e,'Tin 08:30 ET');
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
  function match(events,now){return matchDay(events,day(now));}
  function merge(previous,events,now){const cut=now-60*86400,m=new Map();for(const e of [...previous,...events])if(e&&Number.isFinite(e.time)&&e.time>=cut)m.set([e.time,e.currency,e.title].join('|'),e);return [...m.values()].sort((a,b)=>a.time-b.time).slice(-4000);}
  return {zone,day,shift,match,matchDay,merge};
})();
if(typeof module!=='undefined')module.exports=NewsProtocols;
