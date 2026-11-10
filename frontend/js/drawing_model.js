/* Drawing properties are plain data so saved workspaces and templates share one format. */
const DrawingModel = (() => {
  const names = { box:'Rectangle', line:'Trend Line', hline:'Horizontal Line', fib:'Fib Retracement', text:'Text', position:'Long / Short Position', measure:'Measure' };
  const groups = { ticks:1, seconds:59, minutes:59, hours:24, days:366, weeks:52, months:12, ranges:1 };
  function defaults(type) {
    return { color:'#211f1d', borderColor:'#211f1d', width:1, lineStyle:'solid', strokeOpacity:100,
      fillEnabled:true, fillColor:'#916966', fillOpacity:32, extend:'none', locked:false,
      middleLine:{ enabled:type === 'box', color:'#ffffff', width:1, style:'solid', opacity:36 }, text:'',
      textStyle:{ color:type === 'text' ? '#211f1d' : '#ffffff', size:12, bold:false, italic:false, horizontal:'right', vertical:'inside' },
      stats:{price:false,percent:false,bars:false,time:false,middle:false},
      levels:[0,0.236,0.382,0.5,0.618,0.786,1], riskReward:2,
      visibility:Object.fromEntries(Object.entries(groups).map(([k,max]) => [k,{ enabled:true,min:1,max }])) };
  }
  function normalize(value) {
    const base = defaults(value.type);
    return { ...base, ...value, borderColor:value.borderColor || value.color || base.borderColor,
      stats:{ ...base.stats, ...value.stats }, middleLine:{ ...base.middleLine, ...value.middleLine }, textStyle:{ ...base.textStyle, ...value.textStyle },
      visibility:Object.fromEntries(Object.entries(base.visibility).map(([k,v])=>[k,{ ...v, ...value.visibility?.[k] }])) };
  }
  function visible(value, timeframe) {
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
  function timeAt(chart, index) {
    if (!chart.bars.length || !Number.isFinite(index)) return null;
    const rounded=Math.round(index);
    if (rounded >= 0 && rounded < chart.bars.length) return chart.bars[rounded].time;
    const edge=rounded < 0 ? 0 : chart.bars.length-1;
    return chart.bars[edge].time+(rounded-edge)*chart.tfSeconds;
  }
  function point(chart, p) {
    const logical = logicalIndex(chart,p.time);
    return { x:logical === null ? null : chart.chart.timeScale().logicalToCoordinate(logical), y:chart.series.priceToCoordinate(p.price) };
  }
  function fromPixel(chart, x, y) {
    const time=timeAt(chart,chart.chart.timeScale().coordinateToLogical(x));
    const price=chart.series.coordinateToPrice(y);
    return time !== null && Number.isFinite(price) ? {time,price} : null;
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
    const a=point(chart,value.p1), b=point(chart,value.p2 || value.p1);
    if ([a.x,a.y,b.x,b.y].some(v=>v === null || !Number.isFinite(v))) return null;
    return { a,b,left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y) };
  }
  function distance(x,y,a,b) {
    const dx=b.x-a.x,dy=b.y-a.y, t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy || 1)));
    return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
  }
  function hit(chart,value,x,y) {
    if (!visible(value,chart.currentTimeframe)) return null;
    const g=geometry(chart,value);if(!g)return null;
    if (Math.hypot(x-g.a.x,y-g.a.y) < 9) return 'p1';
    if (value.p2 && Math.hypot(x-g.b.x,y-g.b.y) < 9) return 'p2';
    if(value.type === 'box' && Math.hypot(x-g.a.x,y-g.b.y)<9)return 'p1x_p2y';
    if(value.type === 'box' && Math.hypot(x-g.b.x,y-g.a.y)<9)return 'p2x_p1y';
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
    if(d.type === 'line') {
      let a={...(g.a.x <= g.b.x ? g.a : g.b)},b={...(g.a.x <= g.b.x ? g.b : g.a)};
      const slope=(b.y-a.y)/(b.x-a.x || .001);
      if(d.extend === 'left' || d.extend === 'both'){const x=Math.min(a.x,b.x);const y=a.x<=b.x?a.y:b.y;a={x:0,y:y-x*slope};}
      if(d.extend === 'right' || d.extend === 'both'){const x=Math.max(g.a.x,g.b.x);const y=g.a.x>=g.b.x?g.a.y:g.b.y;b={x:width,y:y+(width-x)*slope};}
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
      ctx.strokeRect(left,top,right-left,bottom-top);
      if(d.middleLine.enabled){ctx.strokeStyle=rgba(d.middleLine.color,d.middleLine.opacity);ctx.lineWidth=d.middleLine.width;ctx.setLineDash(dash(d.middleLine.style));line(left,(top+bottom)/2,right,(top+bottom)/2);}
    } else if(d.type === 'fib') {
      for(const level of d.levels){const y=g.a.y+(g.b.y-g.a.y)*level;line(left,y,right,y);ctx.fillStyle=d.color;ctx.font='10px Arial';ctx.fillText(`${level} (${(d.p1.price+(d.p2.price-d.p1.price)*level).toFixed(2)})`,left+4,y-4);}
    } else if(d.type === 'position') {
      const riskY=g.a.y+(g.a.y-g.b.y)/d.riskReward;
      ctx.fillStyle='rgba(8,153,129,.22)';ctx.fillRect(left,top,Math.max(30,right-left),bottom-top);
      ctx.fillStyle='rgba(242,54,69,.22)';ctx.fillRect(left,Math.min(g.a.y,riskY),Math.max(30,right-left),Math.abs(g.a.y-riskY));
      line(left,g.a.y,Math.max(right,left+30),g.a.y);
      ctx.fillStyle=d.textStyle.color;ctx.font='11px Arial';ctx.fillText(`R:R ${d.riskReward.toFixed(2)}`,left+5,top+16);
    } else if(d.type === 'measure') {
      if(d.fillEnabled){ctx.fillStyle=rgba(d.fillColor,d.fillOpacity);ctx.fillRect(left,top,right-left,bottom-top);}ctx.strokeRect(left,top,right-left,bottom-top);
      ctx.fillStyle=d.textStyle.color;ctx.font='11px Arial';
      const change=d.p2.price-d.p1.price;
      ctx.fillText(`${change.toFixed(2)} (${d.p1.price ? (change/d.p1.price*100).toFixed(2) : '—'}%)`,left+5,top+16);
    }
    if(d.text || d.type === 'text') {
      const style=d.textStyle;
      ctx.setLineDash([]);ctx.fillStyle=style.color;ctx.font=`${style.italic?'italic ':''}${style.bold?'bold ':''}${style.size}px Arial`;
      ctx.textAlign=d.type === 'text' ? 'left' : style.horizontal;
      const x=d.type === 'text'?g.a.x:style.horizontal === 'left'?left+6:style.horizontal === 'center'?(left+right)/2:right-6;
      const lines=(d.text||'Text').split('\n');
      const y=d.type === 'text'?g.a.y:style.vertical === 'above'?top-8-(lines.length-1)*style.size*1.3:style.vertical === 'below'?bottom+style.size+6:(top+bottom)/2-(lines.length-1)*style.size*.65;
      lines.forEach((text,index)=>ctx.fillText(text,x,y+index*style.size*1.3));
    }
    ctx.restore();
  }
  return {names,groups,defaults,normalize,visible,logicalIndex,timeAt,point,fromPixel,hex,rgba,geometry,hit,draw};
})();
if(typeof module !== 'undefined')module.exports=DrawingModel;
