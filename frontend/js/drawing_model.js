/* Drawing properties are plain data so saved workspaces and templates share one format. */
const DrawingModel = (() => {
  const names = { box:'Rectangle', line:'Trend Line', hline:'Horizontal Line', fib:'Fib Retracement', text:'Text', position:'Long / Short Position', measure:'Measure',brush:'Brush' };
  const groups = { ticks:1, seconds:59, minutes:59, hours:24, days:366, weeks:52, months:12, ranges:1 };
  function defaults(type) {
    return { title:'', color:'#211f1d', borderColor:type==='position'?'#dce1e8':'#211f1d', width:1, lineStyle:type==='position'?'dashed':'solid', strokeOpacity:type==='position'?76:100,
      fillEnabled:true, fillColor:'#916966', fillOpacity:32, profitColor:'#089981', profitOpacity:22, stopColor:'#f23645', stopOpacity:22, extend:'none', locked:false,
      middleLine:{ enabled:type === 'box', color:'#ffffff', width:1, style:'solid', opacity:36 }, text:'',
      textStyle:{ color:type === 'text' ? '#211f1d' : '#ffffff', size:12, bold:false, italic:false, horizontal:'right', vertical:'inside' },
      stats:{price:false,percent:false,bars:false,time:false,middle:false},
      levels:[0,0.236,0.382,0.5,0.618,0.786,1], riskReward:2,
      visibility:Object.fromEntries(Object.entries(groups).map(([k,max]) => [k,{ enabled:true,min:1,max }])) };
  }
  function normalize(value) {
    const base = defaults(value.type);
    const normalized={ ...base, ...value, borderColor:value.borderColor || value.color || base.borderColor,
      stats:{ ...base.stats, ...value.stats }, middleLine:{ ...base.middleLine, ...value.middleLine }, textStyle:{ ...base.textStyle, ...value.textStyle },
      visibility:Object.fromEntries(Object.entries(base.visibility).map(([k,v])=>[k,{ ...v, ...value.visibility?.[k] }])) };
    if(normalized.type==='position'&&normalized.p1&&normalized.p2&&!normalized.p3){
      const reward=normalized.p2.price-normalized.p1.price;
      normalized.p3={time:normalized.p2.time,price:normalized.p1.price-reward/Math.max(.1,normalized.riskReward)};
    }
    return normalized;
  }
  function visible(value, timeframe) {
    if(value.hidden)return false;
    const entry = timeframe === 'D' ? ['days',1] : timeframe === 'W' ? ['weeks',1] : timeframe.endsWith('h') ? ['hours',Number(timeframe.slice(0,-1))] : timeframe.endsWith('m') ? ['minutes',Number(timeframe.slice(0,-1))] : null;
    if (!entry) return true;
    const rule = value.visibility?.[entry[0]];
    return !rule || rule.enabled !== false && entry[1] >= rule.min && entry[1] <= rule.max;
  }
  function logicalIndex(chart, time) {
    const bars = chart.bars;
    if (!bars.length) return null;
    if (time < bars[0].time) return (time-bars[0].time)/chart.tfSeconds;
    if (time > bars.at(-1).time) return bars.length-1+(time-bars.at(-1).time)/chart.tfSeconds;
    let lo=0, hi=bars.length-1;
    while (lo < hi) { const mid=(lo+hi)>>1; if (bars[mid].time < time) lo=mid+1; else hi=mid; }
    if (!lo || bars[lo].time === time) return lo;
    return lo-1+(time-bars[lo-1].time)/(bars[lo].time-bars[lo-1].time);
  }
  function timeAt(chart, index, continuous=false) {
    if (!chart.bars.length || !Number.isFinite(index)) return null;
    if(continuous){const base=Math.max(0,Math.min(chart.bars.length-1,Math.floor(index))),bar=chart.bars[base],next=chart.bars[base+1];return bar.time+(index-base)*(next?next.time-bar.time:chart.tfSeconds);}
    const rounded=Math.round(index);
    if (rounded >= 0 && rounded < chart.bars.length) return chart.bars[rounded].time;
    const edge=rounded < 0 ? 0 : chart.bars.length-1;
    return chart.bars[edge].time+(rounded-edge)*chart.tfSeconds;
  }
  function point(chart, p) {
    const logical = logicalIndex(chart,p.time);
    return { x:logical === null ? null : chart.chart.timeScale().logicalToCoordinate(logical), y:chart.series.priceToCoordinate(p.price) };
  }
  function fromPixel(chart, x, y, continuous=false) {
    const time=timeAt(chart,chart.chart.timeScale().coordinateToLogical(x),continuous);
    const price=chart.series.coordinateToPrice(y);
    return time !== null && Number.isFinite(price) ? {time,price} : null;
  }
  function constrainLinePoint(chart, anchor, targetPoint, pixel=null) {
    if (!anchor || !targetPoint) return targetPoint;
    const a=point(chart, anchor);
    const b=pixel && Number.isFinite(pixel.x) && Number.isFinite(pixel.y) ? pixel : point(chart, targetPoint);
    if (!a || !b || !Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) return targetPoint;
    const dx=b.x-a.x, dy=b.y-a.y;
    if (Math.hypot(dx, dy) < 1e-6) return {time:anchor.time, price:anchor.price};
    const angle=Math.round(Math.atan2(dy, dx)/(Math.PI/4))*(Math.PI/4);
    if (Math.abs(Math.sin(angle)) < 1e-6) return {time:targetPoint.time, price:anchor.price};
    if (Math.abs(Math.cos(angle)) < 1e-6) return {time:anchor.time, price:targetPoint.price};
    const ux=Math.cos(angle), uy=Math.sin(angle), proj=dx*ux+dy*uy;
    return fromPixel(chart, a.x+proj*ux, a.y+proj*uy) || targetPoint;
  }
  function rgba(color, opacity) {
    if (!/^#[0-9a-f]{6}$/i.test(color || '')) return color || '#211f1d';
    return `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},${Math.max(0,Math.min(100,opacity))/100})`;
  }
  function hex(color) {
    if (/^#[0-9a-f]{6}$/i.test(color || '')) return color;
    const match=/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color || '');
    return match ? '#'+match.slice(1,4).map(v=>Number(v).toString(16).padStart(2,'0')).join('') : '#211f1d';
  }
  const dash = style => style === 'dashed' ? [7,5] : style === 'dotted' ? [2,3] : [];
  function geometry(chart, value) {
    const normalized=normalize(value),a=point(chart,normalized.p1),b=point(chart,normalized.p2 || normalized.p1),c=normalized.p3?point(chart,normalized.p3):null;
    if ([a.x,a.y,b.x,b.y,...(c?[c.x,c.y]:[])].some(v=>v === null || !Number.isFinite(v))) return null;
    const points=value.type==='brush'&&value.points?.length?value.points.map(p=>point(chart,p)).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)):c?[a,b,c]:[a,b];return { a,b,c,left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y)) };
  }
  function distance(x,y,a,b) {
    const dx=b.x-a.x,dy=b.y-a.y, t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy || 1)));
    return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
  }
  function boxEdges(g) {
    return [
      {handle:'p1_time',x:g.a.x,y:(g.a.y+g.b.y)/2},
      {handle:'p2_time',x:g.b.x,y:(g.a.y+g.b.y)/2},
      {handle:'p1_price',x:(g.a.x+g.b.x)/2,y:g.a.y},
      {handle:'p2_price',x:(g.a.x+g.b.x)/2,y:g.b.y}
    ];
  }
  function resizeBox(value,handle,point) {
    const result=structuredClone(value),[key,axis]=handle.split('_');
    if(['p1','p2'].includes(key)&&['time','price'].includes(axis))result[key][axis]=point[axis];
    return result;
  }
  function hit(chart,value,x,y) {
    if (!visible(value,chart.currentTimeframe)) return null;
    const g=geometry(chart,value);if(!g)return null;
    if(value.type==='brush'){
      const points=(value.points||[]).map(p=>point(chart,p));
      for(let i=1;i<points.length;i++)if(distance(x,y,points[i-1],points[i])<7)return 'body';
      return null;
    }
    if (Math.hypot(x-g.a.x,y-g.a.y) < 9) return 'p1';
    if (value.p2 && Math.hypot(x-g.b.x,y-g.b.y) < 9) return 'p2';
    if (value.type==='position'&&g.c&&Math.hypot(x-g.c.x,y-g.c.y) < 9) return 'p3';
    if(value.type === 'box' && Math.hypot(x-g.a.x,y-g.b.y)<9)return 'p1x_p2y';
    if(value.type === 'box' && Math.hypot(x-g.b.x,y-g.a.y)<9)return 'p2x_p1y';
    if(value.type === 'box')for(const edge of boxEdges(g))if(Math.hypot(x-edge.x,y-edge.y)<9)return edge.handle;
    if(value.type === 'hline') return Math.abs(y-g.a.y)<7 ? 'body' : null;
    if(value.type === 'text') return x>=g.a.x-8 && x<=g.a.x+Math.max(50,(value.text||'').length*(value.textStyle?.size||12)*.65) && Math.abs(y-g.a.y)<22 ? 'body' : null;
    if(['box','position','measure','fib'].includes(value.type)) return x>=g.left-6 && x<=g.right+6 && y>=g.top-6 && y<=g.bottom+6 ? 'body' : null;
    return distance(x,y,g.a,g.b)<7 ? 'body' : null;
  }
  function draw(ctx, chart, raw) {
    const d=normalize(raw);if(!visible(d,chart.currentTimeframe))return;
    const g=geometry(chart,d);if(!g)return;
    const width=chart.container.clientWidth-65;
    let {left,right,top,bottom}=g;
    if(d.extend === 'left' || d.extend === 'both') left=0;
    if(d.extend === 'right' || d.extend === 'both') right=width;
    ctx.save();
    ctx.strokeStyle=rgba(d.borderColor,d.strokeOpacity);ctx.lineWidth=d.width;ctx.setLineDash(dash(d.lineStyle));
    const line=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
    if(d.type==='brush'){
      const points=(d.points||[]).map(p=>point(chart,p));ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
      points.forEach((p,i)=>{if(Number.isFinite(p.x)&&Number.isFinite(p.y)){if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);}});ctx.stroke();
    } else if(d.type === 'line') {
      if(d.axis==='vertical') {
        line(g.a.x,0,g.a.x,(chart.plotHeight??chart.container.clientHeight)-26);ctx.restore();return;
      }
      let a={...(g.a.x <= g.b.x ? g.a : g.b)},b={...(g.a.x <= g.b.x ? g.b : g.a)};
      if (Math.abs(b.x-a.x) >= 1e-6) {
        const slope=(b.y-a.y)/(b.x-a.x);
        if(d.extend === 'left' || d.extend === 'both'){const x=Math.min(a.x,b.x);const y=a.x<=b.x?a.y:b.y;a={x:0,y:y-x*slope};}
        if(d.extend === 'right' || d.extend === 'both'){const x=Math.max(g.a.x,g.b.x);const y=g.a.x>=g.b.x?g.a.y:g.b.y;b={x:width,y:y+(width-x)*slope};}
      } else if (d.extend === 'both') {
        a={x:a.x,y:0};
        b={x:a.x,y:(chart.plotHeight??chart.container.clientHeight)-26};
      }
      line(a.x,a.y,b.x,b.y);
      const items=[],change=d.p2.price-d.p1.price;
      if(d.stats.price)items.push(change.toFixed(2));
      if(d.stats.percent)items.push(d.p1.price?(change/d.p1.price*100).toFixed(2)+'%':'—');
      if(d.stats.bars)items.push(Math.abs(Math.round(logicalIndex(chart,d.p2.time)-logicalIndex(chart,d.p1.time)))+' bars');
      if(d.stats.time)items.push(Math.abs(Math.round((d.p2.time-d.p1.time)/60))+' min');
      if(items.length){ctx.setLineDash([]);ctx.font=`${d.textStyle.size}px Arial`;ctx.fillStyle=d.textStyle.color;ctx.textAlign='center';ctx.fillText(items.join(' · '),(g.a.x+g.b.x)/2,(g.a.y+g.b.y)/2-9);}
      if(d.stats.middle){ctx.beginPath();ctx.arc((g.a.x+g.b.x)/2,(g.a.y+g.b.y)/2,3,0,Math.PI*2);ctx.stroke();}

    } else if(d.type === 'hline') line(0,g.a.y,width,g.a.y);
    else if(d.type === 'box') {
      if(d.fillEnabled){ctx.fillStyle=rgba(d.fillColor,d.fillOpacity);ctx.fillRect(left,top,right-left,bottom-top);}
      if(d.strokeOpacity>0&&d.width>0&&d.borderColor!=='transparent')ctx.strokeRect(left,top,right-left,bottom-top);
      if(d.middleLine.enabled){ctx.strokeStyle=rgba(d.middleLine.color,d.middleLine.opacity);ctx.lineWidth=d.middleLine.width;ctx.setLineDash(dash(d.middleLine.style));line(left,(top+bottom)/2,right,(top+bottom)/2);}
    } else if(d.type === 'fib') {
      for(const level of d.levels){const y=g.a.y+(g.b.y-g.a.y)*level;line(left,y,right,y);ctx.fillStyle=rgba(d.borderColor,d.strokeOpacity);ctx.font='10px Arial';ctx.fillText(`${level} (${(d.p1.price+(d.p2.price-d.p1.price)*level).toFixed(2)})`,left+4,y-4);}
    } else if(d.type === 'position'&&g.c) {
      const span=Math.max(30,right-left),entry=g.a.y,target=g.b.y,stop=g.c.y,isLong=d.p2.price>=d.p1.price;
      const reward=Math.abs(d.p2.price-d.p1.price),risk=Math.abs(d.p1.price-d.p3.price),rr=risk?reward/risk:0;
      const rewardTop=Math.min(entry,target),rewardBottom=Math.max(entry,target),riskTop=Math.min(entry,stop),riskBottom=Math.max(entry,stop);
      ctx.fillStyle=rgba(d.profitColor,d.profitOpacity);ctx.fillRect(left,rewardTop,span,Math.max(1,rewardBottom-rewardTop));
      ctx.fillStyle=rgba(d.stopColor,d.stopOpacity);ctx.fillRect(left,riskTop,span,Math.max(1,riskBottom-riskTop));
      ctx.setLineDash(dash(d.lineStyle).length?dash(d.lineStyle):[5,5]);ctx.strokeStyle=rgba(d.borderColor,d.strokeOpacity);ctx.lineWidth=d.width;line(left,entry,left+span,entry);ctx.setLineDash([]);
      const pill=(text,x,y,fill)=>{ctx.font='600 11px Arial';const w=ctx.measureText(text).width+10;ctx.fillStyle=fill;ctx.fillRect(x-w/2,y-10,w,19);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(text,x,y+3);};
      pill(`PnL: ${isLong?'+':'-'}${reward.toFixed(2)}`,left+span/2,rewardTop+9,'#3c7b9e');
      pill(`PnL: ${isLong?'-':'+'}${risk.toFixed(2)}`,left+span/2,riskBottom+9,'#616b77');
      pill(`Risk/reward ratio: ${rr.toFixed(2)}`,left+span/2,entry,'#68717c');
    } else if(d.type === 'measure') {
      if(d.fillEnabled){ctx.fillStyle=rgba(d.fillColor,d.fillOpacity);ctx.fillRect(left,top,right-left,bottom-top);}ctx.strokeRect(left,top,right-left,bottom-top);
      ctx.fillStyle=d.textStyle.color;ctx.font='11px Arial';
      const change=d.p2.price-d.p1.price;
      ctx.fillText(`${change.toFixed(2)} (${d.p1.price ? (change/d.p1.price*100).toFixed(2) : '—'}%)`,left+5,top+16);
    }
    if(d.text || d.type === 'text') {
      const style=d.textStyle,lh=style.size*1.28,lines=(d.text||(d.type==='text'?'Text':'')).split('\n');
      const family=style.fontFamily==='monospace'?'Consolas, "Courier New", monospace':'Arial';
      ctx.setLineDash([]);ctx.font=`${style.italic?'italic ':''}${style.bold?'bold ':''}${style.size}px ${family}`;
      if(d.type==='text'&&style.pine){
        const place=style.placement||'center',padX=6,padY=3;
        const align=place==='label_left'?'left':place==='label_right'?'right':(style.horizontal||'center');
        const x=place==='label_left'?g.a.x+6:place==='label_right'?g.a.x-6:g.a.x;
        const base=place==='above'?'bottom':place==='below'?'top':'middle';
        const anchorY=place==='above'?g.a.y-6:place==='below'?g.a.y+6:g.a.y;
        const startY=base==='bottom'?anchorY-(lines.length-1)*lh:base==='middle'?anchorY-(lines.length-1)*lh*.5:anchorY;
        if(d.labelBg){
          const maxW=lines.reduce((m,l)=>Math.max(m,ctx.measureText(l).width),0),boxW=maxW+padX*2,boxH=lines.length*lh+padY*2;
          const bx=align==='left'?x-padX:align==='right'?x-maxW-padX:x-boxW/2;
          const by=base==='top'?anchorY-padY:base==='bottom'?anchorY-lines.length*lh-padY:anchorY-boxH/2;
          ctx.fillStyle=d.labelBg;ctx.fillRect(bx,by,boxW,boxH);
        }
        ctx.textAlign=align;ctx.textBaseline=base;ctx.fillStyle=style.color;
        lines.forEach((text,index)=>ctx.fillText(text,x,startY+index*lh));
      }else{
        ctx.textAlign=style.horizontal;ctx.fillStyle=style.color;
        const x=d.type === 'text'?g.a.x:style.horizontal === 'left'?left+6:style.horizontal === 'center'?(left+right)/2:right-6;
        if(d.type==='box'&&['top','bottom','inside'].includes(style.vertical)){
          ctx.textBaseline=style.vertical==='top'?'top':style.vertical==='bottom'?'bottom':'middle';
          const y=style.vertical==='top'?top+4:style.vertical==='bottom'?bottom-4-(lines.length-1)*lh:(top+bottom)/2-(lines.length-1)*lh*.5;
          lines.forEach((text,index)=>ctx.fillText(text,x,y+index*lh));
        }else{
          const y=style.vertical === 'above'?top-8-(lines.length-1)*style.size*1.3:style.vertical === 'below'?bottom+style.size+6:d.type === 'text'?g.a.y:(top+bottom)/2-(lines.length-1)*style.size*.65;
          lines.forEach((text,index)=>ctx.fillText(text,x,y+index*style.size*1.3));
        }
      }
    }
    ctx.restore();
  }
  return {names,groups,defaults,normalize,visible,logicalIndex,timeAt,point,fromPixel,constrainLinePoint,hex,rgba,geometry,hit,draw,boxEdges,resizeBox};
})();
if(typeof module !== 'undefined')module.exports=DrawingModel;
