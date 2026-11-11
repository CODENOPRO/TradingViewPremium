// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0: https://mozilla.org/MPL/2.0/
// Original Pine Script © arleay: Quarter Sequence Stacks+ | @arleay.
// JavaScript adaptation for TradingViewPremium. No TradingView/Pine runtime required.
// Import this whole file in the terminal's indicator editor; settings use the original input names.
const indicator = (() => {
  const defaults = {
    fridayAsQ4:true, blockLimit:55, showTriplets:true, showRoots:true, showNames:true,
    rowNano:true, rowMicro:true, row90:true, rowDaily:true, rowWeekly:true, rowMonthly:true,
    q1:'#454A52', q2:'#E54F5E', q3:'#60AE64', q4:'#4677E5', autoPeers:true,
    manualA:'CME_MINI:ES1!', manualB:'CBOT_MINI:YM1!', showSmt:true, showStages:true,
    smtNano:false, smtMicro:true, smt90:true, smtDaily:true, minStages:1,
    swingTolerance:2, historyLimit:70, bull:'#147D69', bear:'#B93847',
    showOpen:true, showStackNote:true, showLiquidity:false
  };
  const zone = 'America/New_York';
  const formatter = new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const partCache=new Map(),wallCache=new Map(),boundCache=new Map();
  const bounded=(cache,key,make)=> {if(cache.has(key))return cache.get(key);if(cache.size>=24000)cache.clear();const value=make();cache.set(key,value);return value;};
  const parts = t => bounded(partCache,t,()=>Object.fromEntries(formatter.formatToParts(new Date(t*1000)).filter(p=>p.type!=='literal').map(p=>[p.type,+p.value])));
  function wall(y,m,d,h=0,mi=0,se=0) {
    const target = Date.UTC(y,m-1,d,h,mi,se)/1000;
    if(wallCache.has(target))return wallCache.get(target);
    let t = target;
    for(let i=0;i<4;i++) { const p=parts(t), delta=target-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)/1000; t+=delta; if(!delta) break; }
    return bounded(wallCache,target,()=>t);
  }
  function offset(t, days, h=0, mi=0) { const p=parts(t); return wall(p.year,p.month,p.day+days,h,mi); }
  function monday(y,m) { const dow=new Date(Date.UTC(y,m-1,1)).getUTCDay(); return wall(y,m,1+(8-dow)%7,12); }
  function bounds(t, idx, friday=true) {
    const p=parts(t), trade=wall(p.year,p.month,p.day+(p.hour>=18?1:0),12), td=parts(trade);
    let start,end,parent,trueTime,phase;
    if(idx===0) {
      const m=Math.floor((p.month-1)/3)*3+1; phase=Math.floor((p.month-1)/3)+1;
      start=wall(p.year,m,1); end=wall(p.year,m+3,1); parent=wall(p.year,1,1); trueTime=wall(p.year,4,1);
    } else if(idx===1) {
      let anchor=monday(td.year,td.month);
      if(trade<anchor) { const prev=parts(wall(td.year,td.month-1,15,12)); anchor=monday(prev.year,prev.month); }
      const a=parts(anchor), next=monday(a.year,a.month+1);
      phase=Math.min(4,Math.floor((trade-anchor+43200)/604800)+1);
      start=offset(anchor,(phase-1)*7-1,18); end=phase===4?offset(next,-1,18):offset(anchor,phase*7-1,18);
      parent=offset(anchor,-1,18); trueTime=offset(anchor,6,18);
    } else if(idx===2) {
      const since=(new Date(Date.UTC(td.year,td.month-1,td.day)).getUTCDay()+6)%7, mon=offset(trade,-since,12);
      parent=offset(mon,-1,18); trueTime=offset(mon,0,18);
      phase=since<=3?since+1:since===4&&friday?4:0;
      start=phase>0?offset(mon,phase-2,18):offset(trade,-1,18);
      end=phase===4&&friday?offset(mon,4,18):offset(trade,0,18);
    } else {
      const span=idx===3?21600:idx===4?5400:idx===5?1350:337.5;
      const seconds=p.hour*3600+p.minute*60+p.second+((t%1)+1)%1, slot=Math.floor(seconds/span)*span;
      start=wall(p.year,p.month,p.day,0,0,Math.floor(slot))+slot%1;
      end=wall(p.year,p.month,p.day,0,0,Math.floor(slot+span))+(slot+span)%1;
      if(idx===3) { parent=offset(trade,-1,18); trueTime=offset(trade,0,0); phase=Math.floor(((p.hour+6)%24)/6)+1; }
      else { const cycle=Math.floor(seconds/(span*4))*span*4;
        parent=wall(p.year,p.month,p.day,0,0,Math.floor(cycle))+cycle%1;
        trueTime=wall(p.year,p.month,p.day,0,0,Math.floor(cycle+span))+(cycle+span)%1;
        phase=Math.floor((seconds%(span*4))/span)+1; }
    }
    return {start,end,parent,trueTime,phase};
  }
  const names=['','Monthly','Weekly','Daily','90M','Micro','Nano'];
  const short = s => String(s).split(':').pop();
  function peers(symbol,s) {
    if(!s.autoPeers) return [s.manualA,s.manualB].map(short);
    const root=short(symbol).replace(/[12]!$/,''), micro=['MNQ','MES','MYM'].includes(root);
    return [root==='ES'||root==='MES'?(micro?'MNQ1!':'NQ1!'):(micro?'MES1!':'ES1!'), root==='YM'||root==='MYM'?(micro?'MNQ1!':'NQ1!'):(micro?'MYM1!':'YM1!')];
  }
  const line=(a,b,color,style='solid')=>({type:'line',p1:a,p2:b,borderColor:color,lineStyle:style,width:1});
  const label=(time,price,text,color,vertical='inside',horizontal='left')=>({type:'text',p1:{time,price},text,textStyle:{color,size:10,horizontal,vertical}});
  function calculate(input, context={}) {
    const s={...defaults,...context.settings};
    for(const key of Object.keys(context.settings||{}))if(!(key in defaults))throw Error('Tham số QS Stacks+ không tồn tại: '+key);
    for(const [key,min,max] of [['blockLimit',8,70],['minStages',1,4],['swingTolerance',0,12],['historyLimit',5,140]]) {
      if(!Number.isInteger(s[key])||s[key]<min||s[key]>max) throw Error(`${key}: ${min}–${max}`);
    }
    const tf=context.timeframe||'1m', seconds=context.timeframeSeconds||({'1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'6h':21600,D:86400,W:604800}[tf]);
    if(!seconds||seconds>=86400) throw Error('QS Stacks+ gốc chỉ chạy trên chart intraday tiêu chuẩn.');
    const now=context.now??Date.now()/1000;
    // Pine uses barstate.isconfirmed. Never include the still-open realtime candle.
    const bars=input.filter(b=>b.time+seconds<=now);
    const warnings=[], pair=peers(context.symbol||'NQ1!',s), own=short(context.symbol||'NQ1!');
    const peerMaps=pair.map((name,i)=>{
      const entry=Object.entries(context.markets||{}).find(([k])=>short(k)===name)?.[1];
      let values=entry?.[tf];
      if(context.peerBars?.[name]) values=context.peerBars[name];
      if((!values?.length)&&tf!=='1m'&&entry?.['1m']?.length&&typeof MarketData!=='undefined') values=MarketData.aggregate(entry['1m'],tf,entry.metadata);
      if(!values?.length) warnings.push(`Thiếu ${name} ${tf}: SSMT của peer này chưa tính`);
      if(name===own||(i===1&&name===pair[0])) return new Map();
      return new Map((values||[]).map(b=>[b.time,b]));
    });
    const enabled=[false,s.rowMonthly,s.rowWeekly,s.rowDaily,s.row90,s.rowMicro,s.rowNano], tier=[false,false,false,s.smtDaily,s.smt90,s.smtMicro,s.smtNano];
    const rowHeight=96/Math.max(1,enabled.filter(Boolean).length), lanes=Array.from({length:7},()=>[]), cycles=Array.from({length:7},()=>({seeded:false,prevReady:false,ink:[null,null]}));
    const history=[], stages=[], events=[], drawings=[];
    let lastBull={}, lastBear={}, lastNanoStart, lastNanoMark='', openInk, openStamp, priorQuarter, liquidity=[];
    const memo=boundCache;
    const get=(t,i)=>bounded(memo,`${t}:${i}:${s.fridayAsQ4}`,()=>bounds(t,i,s.fridayAsQ4));
    const root=(t,i)=>{ const phases=[Math.max(0,i-2),Math.max(0,i-1),i].map(j=>get(t,j).phase); return i>=2&&phases.every(x=>x>0)?1+(phases.reduce((a,b)=>a+b,0)-1)%9:0; };
    const mark=(t,i)=>{ const r=root(t,i); if(![3,6,9].includes(r)) return ''; let out=String(r); for(let j=i-1;j>=1&&out.length<3;j--) {if(root(t,j)!==r)break;out+=r;} return out; };
    const seq=(t,i)=>i>=2?[Math.max(0,i-2),Math.max(0,i-1),i].map(j=>get(t,j).phase).join('-'):`Q${get(t,i).phase}`;
    const keep=(arr,item,n)=>{if(item) {arr.push(item);if(arr.length>n)arr.shift();}};
    const paint=(c,idx,isBull,peersText)=>{
      const k=isBull?0:1;
      if(!peersText) {c.ink[k]=null;return;}
      const a=isBull?{time:c.prev.loAt,price:c.prev.lo}:{time:c.prev.hiAt,price:c.prev.hi};
      const b=isBull?{time:c.cur.loAt,price:c.cur.lo}:{time:c.cur.hiAt,price:c.cur.hi};
      const color=idx<=4?(isBull?s.bull:s.bear):'#646B74';
      let text=`${idx===4?'90m':names[idx]}  ${peersText}`, digits=s.showRoots?mark(b.time,idx):'';
      if(digits) text+='\n'+digits;
      c.ink[k]=[line(a,b,color,idx<=4?'solid':'dotted'),label((a.time+b.time)/2,(a.price+b.price)/2,text,color,isBull?'below':'above','center')];
    };
    const stage=(isBull)=>{
      const key=isBull?'up':'dn', stamp=isBull?'loAt':'hiAt';
      const candidates=cycles.slice(3).filter(c=>c[key]);
      if(!candidates.length) return null;
      const anchor=Math.max(...candidates.map(c=>c.cur[stamp])), matched=[], peerSet=new Set();
      for(let idx=6;idx>=3;idx--) {const c=cycles[idx];if(c[key]&&Math.abs(c.cur[stamp]-anchor)<=s.swingTolerance*seconds) {matched.push(idx===5?'Mic':idx===4?'90m':names[idx]);c[key].split(' + ').forEach(x=>peerSet.add(x));}}
      return {anchor,names:matched.join('+'),count:matched.length,peers:[...peerSet].join(' | ')};
    };
    for(const bar of bars) {
      const time=bar.time, close=time+seconds, peer=peerMaps.map(m=>m.get(time));
      let slot=0;
      for(let idx=1;idx<=6;idx++) {
        const b=get(time,idx);
        if(enabled[idx]) {
          slot++; const lane=lanes[idx], prev=lane.at(-1);
          if(!prev||prev.start!==b.start) {
            if(prev)prev.right=Math.min(prev.end,b.start);
            const digits=s.showRoots?mark(b.start,idx):'';
            lane.push({...b,right:Math.min(close,b.end),top:slot*rowHeight,bottom:slot*rowHeight-rowHeight*.90625,text:s.showTriplets?(digits||seq(b.start,idx)):'',digits});
            if(lane.length>s.blockLimit)lane.shift();
          } else prev.right=Math.min(close,b.end);
        }
        const showTier=(s.showSmt||s.showStages)&&tier[idx];
        if(!showTier&&!(s.showLiquidity&&idx===4)) continue;
        const c=cycles[idx], layerOk=seconds<=(idx===6?337.5:idx===5?1350:idx===4?5400:21600);
        if(c.left===undefined||b.start!==c.left) {
          c.prevReady=c.seeded; c.seeded=c.left!==undefined||b.start===time; c.left=b.start; c.prev=c.cur;
          c.cur={hi:-Infinity,lo:Infinity,aHi:-Infinity,aLo:Infinity,bHi:-Infinity,bLo:Infinity};
          for(const ink of c.ink)keep(history,ink,s.historyLimit);
          c.ink=[null,null];
        }
        if(layerOk&&b.phase>0) {
          const cur=c.cur;
          if(bar.high>cur.hi) {cur.hi=bar.high;cur.hiAt=time;}
          if(bar.low<cur.lo) {cur.lo=bar.low;cur.loAt=time;}
          peer.forEach((v,i)=>{if(v){const k=i?'b':'a';cur[k+'Hi']=Math.max(cur[k+'Hi'],v.high);cur[k+'Lo']=Math.min(cur[k+'Lo'],v.low);}});
        }
        const divergence=(isBull)=>{
          if(!c.prevReady||!Number.isFinite(c.prev?.hi)||!Number.isFinite(c.cur.hi))return '';
          const key=isBull?'lo':'hi', took=isBull?c.cur[key]<c.prev[key]:c.cur[key]>c.prev[key];
          return pair.filter((name,i)=>{const k=(i?'b':'a')+(isBull?'Lo':'Hi');return peer[i]&&Number.isFinite(c.prev[k])&&Number.isFinite(c.cur[k])&&took!==(isBull?c.cur[k]<c.prev[k]:c.cur[k]>c.prev[k]);}).join(' + ');
        };
        c.up=showTier&&layerOk&&b.phase>0?divergence(true):''; c.dn=showTier&&layerOk&&b.phase>0?divergence(false):'';
        if(showTier&&s.showSmt) {paint(c,idx,true,c.up);paint(c,idx,false,c.dn);}
      }
      if(s.showStages) for(const isBull of [true,false]) {
        const st=stage(isBull), last=isBull?lastBull:lastBear;
        if(st&&st.count>=s.minStages&&(last.anchor===undefined||st.anchor-last.anchor>s.swingTolerance*seconds||st.names!==last.names)) {
          const y=isBull?bar.low:bar.high, edge=time+seconds*6, color=isBull?s.bull:s.bear;
          keep(stages,[line({time,price:y},{time:edge,price:y},color,st.count>=2?'solid':'dashed'),label(edge,y,st.names+(isBull?' ▲':' ▼'),color)],36);
          events.push({time,type:isBull?'bullStage':'bearStage',tiers:st.names,peers:st.peers});
          if(isBull)lastBull=st;else lastBear=st;
        }
      }
      const b90=get(time,4);
      if(s.showOpen&&time<=b90.trueTime&&close>b90.trueTime&&openStamp!==b90.trueTime) {openStamp=b90.trueTime;openInk={time,price:bar.open};}
      if(s.showLiquidity&&seconds<=5400&&priorQuarter!==b90.start) {
        priorQuarter=b90.start;const c=cycles[4];liquidity=[];
        if(Number.isFinite(c.prev?.hi))liquidity=[line({time:c.prev.hiAt,price:c.prev.hi},{time:b90.end,price:c.prev.hi},s.bear,'dotted'),line({time:c.prev.loAt,price:c.prev.lo},{time:b90.end,price:c.prev.lo},s.bull,'dotted')];
      }
      if(s.showStackNote&&seconds<=337.5) {
        const nano=get(time,6);
        if(lastNanoStart!==nano.start) {
          lastNanoStart=nano.start;const digits=mark(nano.start,6);
          if(digits.length===3&&lastNanoMark!==digits) {
            const edge=time+seconds*14;
            keep(stages,[line({time,price:bar.low},{time:edge,price:bar.low},s.bear),label(edge,bar.low,digits+'\nSequence Of Sequences',s.bear,'below')],36);
            events.push({time,type:'tripleStage',digits});
          }
          lastNanoMark=digits;
        }
      }
    }
    for(const list of [history,stages,...cycles.map(c=>c.ink)])for(const ink of list)if(ink)drawings.push(...ink);
    drawings.push(...liquidity);
    if(openInk&&bars.length) {const edge=bars.at(-1).time+seconds*9;drawings.push(line(openInk,{time:edge,price:openInk.price},'#626871','dotted'),label(edge,openInk.price,'T90mO','#626871'));}
    const pane=[];
    lanes.forEach((lane,idx)=>{
      for(const block of lane) pane.push({type:'box',p1:{time:block.start,price:block.top},p2:{time:block.right,price:block.bottom},borderColor:'#6C7380',strokeOpacity:65,fillColor:block.phase?s['q'+block.phase]:'#808080',fillOpacity:block.digits?90:27,middleLine:{enabled:false},text:block.text,textStyle:{size:10,color:block.digits?'#ffffff':'#59616B',horizontal:'center',vertical:'inside'}});
      if(s.showNames&&lane.length) {const b=lane.at(-1), x=Math.max(lane[0].start,context.viewport?.from??lane[0].start);pane.push(label(x,(b.top+b.bottom)/2,names[idx],'#202020'));}
    });
    if(bars.length&&!peerMaps.some(m=>bars.some(b=>m.has(b.time))))warnings.push('Không có nến peer trùng giờ; chỉ hiển thị clock/price context');
    return {series:[],drawings,pane:{title:'QS Stacks+',min:0,max:100,drawings:pane},events,warnings};
  }
  return {name:'QS Stacks+ · JavaScript',defaults,calculate, bounds, peers};
})();
if(typeof module!=='undefined') module.exports=indicator;
