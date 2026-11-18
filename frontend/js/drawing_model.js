/* Drawing properties are plain data so saved workspaces and templates share one format. */
const DrawingModel = (() => {
  const DEFAULT_FONT = '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';
  const DEFAULT_FIB_LEVELS = [
    { coeff: 0, color: '#787b86', visible: true },
    { coeff: 0.236, color: '#f23645', visible: true },
    { coeff: 0.382, color: '#ff9800', visible: true },
    { coeff: 0.5, color: '#4caf50', visible: true },
    { coeff: 0.618, color: '#089981', visible: true },
    { coeff: 0.786, color: '#00bcd4', visible: true },
    { coeff: 1, color: '#787b86', visible: true },
    { coeff: 1.618, color: '#2962ff', visible: true },
    { coeff: 2.618, color: '#f23645', visible: true },
    { coeff: 3.618, color: '#9c27b0', visible: true },
    { coeff: 4.236, color: '#e91e63', visible: true },
    { coeff: 1.272, color: '#ff9800', visible: false },
    { coeff: 1.414, color: '#f23645', visible: false },
    { coeff: 2, color: '#00bcd4', visible: false },
    { coeff: 2.272, color: '#ff9800', visible: false },
    { coeff: 2.414, color: '#4caf50', visible: false },
    { coeff: 3, color: '#00bcd4', visible: false },
    { coeff: 3.272, color: '#787b86', visible: false },
    { coeff: 3.414, color: '#2962ff', visible: false },
    { coeff: 4, color: '#f23645', visible: false },
    { coeff: 4.272, color: '#9c27b0', visible: false },
    { coeff: 4.414, color: '#e91e63', visible: false },
    { coeff: 4.618, color: '#ff9800', visible: false },
    { coeff: 4.764, color: '#089981', visible: false }
  ];
  const cloneFibLevels = () => DEFAULT_FIB_LEVELS.map(l => ({ ...l }));
  const names = { box:'Rectangle', line:'Trend Line', hline:'Horizontal Line', vline:'Vertical Line', fib:'Fib Retracement', text:'Text', position:'Long / Short Position', measure:'Measure', brush:'Brush' };
  const groups = { ticks:1, seconds:59, minutes:59, hours:24, days:366, weeks:52, months:12, ranges:1 };
  const defaultVis = Object.fromEntries(Object.entries(groups).map(([k,max]) => [k,{ enabled:true,min:1,max }]));
  const baseDefaultsCache = {};
  function baseDefaults(type) {
    return baseDefaultsCache[type] || (baseDefaultsCache[type] = {
      title:'', color:type==='vline'||type==='brush'?'#2962ff':'#211f1d', borderColor:type==='position'?'#dce1e8':(type==='vline'||type==='brush')?'#2962ff':'#211f1d', width:type==='brush'?2:1, lineStyle:type==='position'?'dashed':'solid', strokeOpacity:type==='position'?76:100,
      fillEnabled:type==='brush'?false:true, fillColor:type==='brush'?'#2962ff':'#916966', fillOpacity:type==='brush'?20:type==='fib'?20:32, profitColor:'#089981', profitOpacity:22, stopColor:'#f23645', stopOpacity:22, extend:'none', locked:false, anchored:false, showTime:true, smooth:5,
      fibTrendline:{ visible:true, color:'#787b86', width:1, style:'dashed', opacity:100 },
      reverse:false, showCoeffs:true, showPrices:true, coeffsAsPercents:false, horzLabelsAlign:'left', vertLabelsAlign:'middle', labelFontSize:12,
      middleLine:{ enabled:type === 'box', color:'#ffffff', width:1, style:'solid', opacity:36 }, text:'',
      textStyle:{ color:type==='text'||type==='vline'?'#2962ff':type==='position'?'#ffffff':'#ffffff', size:type==='text'||type==='vline'?14:12, bold:false, italic:false, horizontal:type==='text'?'left':type==='vline'?'center':'right', vertical:type==='vline'?'middle':'inside', orientation:type==='vline'?'vertical':'horizontal', fillBackground:false, backgroundColor:'#2962ff', backgroundOpacity:25, drawBorder:false, borderColor:'#787b86', wordWrap:false, wordWrapWidth:200 },
      stats:{price:false,percent:false,bars:false,time:false,middle:false},
      levels:[0,0.236,0.382,0.5,0.618,0.786,1], fibLevels:cloneFibLevels(), riskReward:2,
      side:'long', accountSize:25000, risk:100, riskDisplayMode:'money', compact:true, alwaysShowStats:false, _statsV2:true, showPriceLabels:true,
      visibility:defaultVis
    });
  }
  function fastNormalize(value) {
    const base = baseDefaults(value.type);
    const normalized = {
      ...base, ...value, borderColor:value.borderColor || value.color || base.borderColor,
      stats:value.stats ? { ...base.stats, ...value.stats } : base.stats,
      fibTrendline:value.fibTrendline ? { ...base.fibTrendline, ...value.fibTrendline } : base.fibTrendline,
      fibLevels:Array.isArray(value.fibLevels) ? value.fibLevels.map((l,i)=>({ ...(DEFAULT_FIB_LEVELS[i]||{color:'#787b86',visible:true}), ...l })) : (Array.isArray(value.levels)&&value.type==='fib' ? value.levels.map((c,i)=>({ coeff:c, color:(DEFAULT_FIB_LEVELS.find(x=>x.coeff===c)||DEFAULT_FIB_LEVELS[i%DEFAULT_FIB_LEVELS.length]).color, visible:true })) : base.fibLevels),
      middleLine:value.middleLine ? { ...base.middleLine, ...value.middleLine } : base.middleLine,
      textStyle:value.textStyle ? { ...base.textStyle, ...value.textStyle } : base.textStyle,
      visibility:value.visibility ? Object.fromEntries(Object.entries(base.visibility).map(([k,v])=>[k,{ ...v, ...value.visibility?.[k] }])) : base.visibility
    };
    if(normalized.type==='position'&&!value._statsV2){
      normalized.alwaysShowStats=false;
      normalized._statsV2=true;
    }
    if(normalized.type==='position'&&normalized.p1&&normalized.p2&&!normalized.p3){
      const reward=normalized.p2.price-normalized.p1.price;
      normalized.p3={time:normalized.p2.time,price:normalized.p1.price-reward/Math.max(.1,normalized.riskReward)};
    }
    if(normalized.type==='position'&&!value.side&&normalized.p1&&normalized.p2){
      normalized.side=normalized.p2.price<normalized.p1.price?'short':'long';
    }
    return normalized;
  }
  function defaults(type) {
    return { title:'', color:type==='vline'||type==='brush'?'#2962ff':'#211f1d', borderColor:type==='position'?'#dce1e8':(type==='vline'||type==='brush')?'#2962ff':'#211f1d', width:type==='brush'?2:1, lineStyle:type==='position'?'dashed':'solid', strokeOpacity:type==='position'?76:100,
      fillEnabled:type==='brush'?false:true, fillColor:type==='brush'?'#2962ff':'#916966', fillOpacity:type==='brush'?20:type==='fib'?20:32, profitColor:'#089981', profitOpacity:22, stopColor:'#f23645', stopOpacity:22, extend:'none', locked:false, anchored:false, showTime:true, smooth:5,
      fibTrendline:{ visible:true, color:'#787b86', width:1, style:'dashed', opacity:100 },
      reverse:false, showCoeffs:true, showPrices:true, coeffsAsPercents:false, horzLabelsAlign:'left', vertLabelsAlign:'middle', labelFontSize:12,
      middleLine:{ enabled:type === 'box', color:'#ffffff', width:1, style:'solid', opacity:36 }, text:'',
      textStyle:{ color:type==='text'||type==='vline'?'#2962ff':'#ffffff', size:type==='text'||type==='vline'?14:12, bold:false, italic:false, horizontal:type==='text'?'left':type==='vline'?'center':'right', vertical:type==='vline'?'middle':'inside', orientation:type==='vline'?'vertical':'horizontal', fillBackground:false, backgroundColor:'#2962ff', backgroundOpacity:25, drawBorder:false, borderColor:'#787b86', wordWrap:false, wordWrapWidth:200 },
      stats:{price:false,percent:false,bars:false,time:false,middle:false},
      levels:[0,0.236,0.382,0.5,0.618,0.786,1], fibLevels:cloneFibLevels(), riskReward:2,
      side:'long', accountSize:25000, risk:100, riskDisplayMode:'money', compact:true, alwaysShowStats:false, _statsV2:true, showPriceLabels:true,
      visibility:Object.fromEntries(Object.entries(groups).map(([k,max]) => [k,{ enabled:true,min:1,max }])) };
  }
  function normalize(value) {
    const base = defaults(value.type);
    const normalized={ ...base, ...value, borderColor:value.borderColor || value.color || base.borderColor,
      stats:{ ...base.stats, ...value.stats }, fibTrendline:{ ...base.fibTrendline, ...value.fibTrendline },
      fibLevels:Array.isArray(value.fibLevels) ? value.fibLevels.map((l,i)=>({ ...(DEFAULT_FIB_LEVELS[i]||{color:'#787b86',visible:true}), ...l })) : (Array.isArray(value.levels)&&value.type==='fib' ? value.levels.map((c,i)=>({ coeff:c, color:(DEFAULT_FIB_LEVELS.find(x=>x.coeff===c)||DEFAULT_FIB_LEVELS[i%DEFAULT_FIB_LEVELS.length]).color, visible:true })) : cloneFibLevels()),
      middleLine:{ ...base.middleLine, ...value.middleLine }, textStyle:{ ...base.textStyle, ...value.textStyle },
      visibility:Object.fromEntries(Object.entries(base.visibility).map(([k,v])=>[k,{ ...v, ...value.visibility?.[k] }])) };
    if(normalized.type==='position'&&!value._statsV2){
      normalized.alwaysShowStats=false;
      normalized._statsV2=true;
    }
    if(normalized.type==='position'&&normalized.p1&&normalized.p2&&!normalized.p3){
      const reward=normalized.p2.price-normalized.p1.price;
      normalized.p3={time:normalized.p2.time,price:normalized.p1.price-reward/Math.max(.1,normalized.riskReward)};
    }
    if(normalized.type==='position'&&!value.side&&normalized.p1&&normalized.p2){
      normalized.side=normalized.p2.price<normalized.p1.price?'short':'long';
    }
    return normalized;
  }
  function visible(value, timeframe) {
    if(value.hidden)return false;
    const entry = timeframe === 'D' ? ['days',1] : timeframe === 'W' ? ['weeks',1] : timeframe.endsWith('M') ? ['months',Number(timeframe.slice(0,-1))] : timeframe.endsWith('h') ? ['hours',Number(timeframe.slice(0,-1))] : timeframe.endsWith('m') ? ['minutes',Number(timeframe.slice(0,-1))] : null;
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
  function geometry(chart, value, preNorm=false) {
    const normalized=preNorm?value:fastNormalize(value);
    if (normalized.type==='text' && normalized.anchored && Number.isFinite(normalized.anchorX) && Number.isFinite(normalized.anchorY)) {
      const a={x:normalized.anchorX,y:normalized.anchorY};
      return { a, b:a, c:null, left:a.x, right:a.x, top:a.y, bottom:a.y };
    }
    const a=point(chart,normalized.p1),b=normalized.p2?point(chart,normalized.p2):a,c=normalized.p3?point(chart,normalized.p3):null;
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y) || (c && (!Number.isFinite(c.x) || !Number.isFinite(c.y)))) return null;
    if (value.type==='brush'&&value.points?.length) {
      const points=value.points.map(p=>point(chart,p)).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
      return { a,b,c,left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y)) };
    }
    return {
      a,b,c,
      left:c?Math.min(a.x,b.x,c.x):Math.min(a.x,b.x),
      right:c?Math.max(a.x,b.x,c.x):Math.max(a.x,b.x),
      top:c?Math.min(a.y,b.y,c.y):Math.min(a.y,b.y),
      bottom:c?Math.max(a.y,b.y,c.y):Math.max(a.y,b.y)
    };
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
  function positionHandles(g) {
    return [
      {handle:'p1',x:g.a.x,y:g.a.y},
      {handle:'p1_right',x:g.b.x,y:g.a.y},
      {handle:'p2_price',x:g.a.x,y:g.b.y},
      {handle:'p3_price',x:g.a.x,y:g.c.y}
    ];
  }
  function smoothBrushPoints(rawPoints, smooth = 5) {
    const pts = rawPoints.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (pts.length <= 2) return pts;
    const step = Math.max(1, Number(smooth) || 5);
    const sub = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      const len = Math.hypot(dx, dy);
      const count = Math.min(5, Math.floor(len / step));
      if (count > 1 && len > 0) {
        const ux = dx / len, uy = dy / len, seg = len / count;
        for (let k = 1; k < count; k++) sub.push({ x: pts[i - 1].x + ux * seg * k, y: pts[i - 1].y + uy * seg * k });
      }
      sub.push(pts[i]);
    }
    const out = new Array(sub.length);
    for (let r = 0; r < sub.length; r++) {
      let sx = 0, sy = 0;
      for (let k = 0; k < step; k++) {
        const a = sub[Math.max(r - k, 0)], b = sub[Math.min(r + k, sub.length - 1)];
        sx += a.x + b.x; sy += a.y + b.y;
      }
      out[r] = { x: sx * 0.5 / step, y: sy * 0.5 / step };
    }
    out.push(sub[sub.length - 1]);
    return out;
  }
  function wrapTextLines(ctx, text, maxWidth) {
    const rawLines = String(text || '').split('\n');
    if (!maxWidth || maxWidth <= 0 || !ctx?.measureText) return rawLines;
    const out = [];
    for (const para of rawLines) {
      if (!para) { out.push(''); continue; }
      const words = para.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (line && ctx.measureText(test).width > maxWidth) {
          out.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      out.push(line);
    }
    return out;
  }
  function hit(chart,value,x,y) {
    if (!visible(value,chart.currentTimeframe)) return null;
    const g=geometry(chart,value);if(!g)return null;
    if(value.type==='brush'){
      const rawPts=(value.points||[]).map(p=>point(chart,p));
      const points=rawPts.length>5?smoothBrushPoints(rawPts,value.smooth??5):rawPts;
      for(let i=1;i<points.length;i++)if(distance(x,y,points[i-1],points[i])<7)return 'body';
      return null;
    }
    if(value.type==='vline') return Math.abs(x-g.a.x)<7 ? 'body' : null;
    if (value.type==='position'&&g.c) {
      for (const h of positionHandles(g)) if (Math.hypot(x-h.x,y-h.y) < 9) return h.handle;
    }
    if (Math.hypot(x-g.a.x,y-g.a.y) < 9) return 'p1';
    if (value.p2 && Math.hypot(x-g.b.x,y-g.b.y) < 9) return 'p2';
    if (value.type==='position'&&g.c&&Math.hypot(x-g.c.x,y-g.c.y) < 9) return 'p3';
    if(value.type === 'box' && Math.hypot(x-g.a.x,y-g.b.y)<9)return 'p1x_p2y';
    if(value.type === 'box' && Math.hypot(x-g.b.x,y-g.a.y)<9)return 'p2x_p1y';
    if(value.type === 'box')for(const edge of boxEdges(g))if(Math.hypot(x-edge.x,y-edge.y)<9)return edge.handle;
    if(value.type === 'hline') return Math.abs(y-g.a.y)<7 ? 'body' : null;
    if(value.type === 'text') {
      const style=value.textStyle||{},sz=style.size||14,pad=sz/6,lh=sz*1.25;
      const lines=String(value.text||'Text').split('\n');
      const maxLen=lines.reduce((m,l)=>Math.max(m,l.length),0);
      const boxW=(style.wordWrap?Math.min(style.wordWrapWidth||200,maxLen*sz*0.6):maxLen*sz*0.6)+pad*2;
      const boxH=lines.length*lh+pad*2;
      return x>=g.a.x-pad-4 && x<=g.a.x+boxW+4 && y>=g.a.y-pad-4 && y<=g.a.y+boxH+4 ? 'body' : null;
    }
    if(['box','position','measure','fib'].includes(value.type)) return x>=g.left-6 && x<=g.right+6 && y>=g.top-6 && y<=g.bottom+6 ? 'body' : null;
    return distance(x,y,g.a,g.b)<7 ? 'body' : null;
  }
  function inRect(chart,value,rect) {
    if (!visible(value,chart.currentTimeframe)) return false;
    const g=geometry(chart,value);if(!g)return false;
    const rLeft=Math.min(rect.left,rect.right),rRight=Math.max(rect.left,rect.right);
    const rTop=Math.min(rect.top,rect.bottom),rBottom=Math.max(rect.top,rect.bottom);
    if(value.type==='hline') return g.a.y>=rTop && g.a.y<=rBottom;
    if(value.type==='vline') return g.a.x>=rLeft && g.a.x<=rRight;
    if(value.type==='text'){
      const st=value.textStyle||{},sz=st.size||14,pad=sz/6,lh=sz*1.25;
      const lines=String(value.text||'Text').split('\n');
      const maxLen=lines.reduce((m,l)=>Math.max(m,l.length),0);
      const w=(st.wordWrap?Math.min(st.wordWrapWidth||200,maxLen*sz*0.6):maxLen*sz*0.6)+pad*2;
      const h=lines.length*lh+pad*2;
      return !(g.a.x+w<rLeft || g.a.x-pad>rRight || g.a.y+h<rTop || g.a.y-pad>rBottom);
    }
    return !(g.right<rLeft || g.left>rRight || g.bottom<rTop || g.top>rBottom);
  }
  function draw(ctx, chart, raw, pass = 'all') {
    const d=fastNormalize(raw);if(!visible(d,chart.currentTimeframe))return;
    const g=geometry(chart,d,true);if(!g)return;
    const drawBg = pass === 'all' || pass === 'bg';
    const drawFg = pass === 'all' || pass === 'fg';
    const m=chart._drawMetrics;
    const axisW=m?m.axisW:(chart.chart?.priceScale?.('right')?.width?.()||65);
    const width=m?m.width:(chart.container.clientWidth-axisW);
    const plotBottom=m?m.plotBottom:((chart.plotHeight??chart.container.clientHeight)-26);
    if(d.type === 'line') {
      if(d.axis === 'vertical') {
        if(g.a.x < -2 || g.a.x > width + 2) return;
      } else if((!d.extend || d.extend === 'none') && (g.right < -40 || g.left > width + 40)) {
        return;
      }
    } else if(d.type === 'text' && d.textStyle?.pine) {
      if(!d._qtTrueOpenSpan && (g.a.x < -120 || g.a.x > width + 120 || g.a.y < -80 || g.a.y > plotBottom + 80)) return;
      if(d._qtTrueOpenSpan && (g.a.y < -80 || g.a.y > plotBottom + 80)) return;
    }
    let {left,right,top,bottom}=g;
    if(d.extend === 'left' || d.extend === 'both') left=0;
    if(d.extend === 'right' || d.extend === 'both') right=width;
    ctx.save();
    const isRealCanvas = typeof HTMLCanvasElement !== 'undefined' && ctx.canvas instanceof HTMLCanvasElement;
    const snap = v => (isRealCanvas ? Math.round(v) + 0.5 : v);
    const crispW = w => (Number(w) <= 1 ? 0.85 : Number(w));
    const haloCol = chart.config?.bg || chart.appearance?.bg || '#131722';
    const qtText = (t, x, y) => {
      if ((d._qtQLabel || d._qtTrueOpen || d._qtSsmt) && !d.labelBg && ctx.strokeText) {
        ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = haloCol; ctx.strokeText(t, x, y); ctx.restore();
      }
      ctx.fillText(t, x, y);
    };
    ctx.strokeStyle=rgba(d.borderColor,d.strokeOpacity);ctx.lineWidth=crispW(d.width);ctx.setLineDash(dash(d.lineStyle));
    const line=(x1,y1,x2,y2)=>{
      let ax=x1,ay=y1,bx=x2,by=y2;
      if(isRealCanvas&&ctx.lineWidth<=1){
        if(Math.abs(ay-by)<0.01){const sy=snap(ay);ay=sy;by=sy;}
        if(Math.abs(ax-bx)<0.01){const sx=snap(ax);ax=sx;bx=sx;}
      }
      ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
    };
    if(d.type==='brush'){
      const points=smoothBrushPoints((d.points||[]).map(p=>point(chart,p)), d.smooth??5);
      if(points.length){
        ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash([]);ctx.beginPath();
        points.forEach((p,i)=>{if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});
        if(drawBg&&d.fillEnabled&&points.length>2){ctx.fillStyle=rgba(d.fillColor,d.fillOpacity??20);ctx.fill();}
        if(drawFg)ctx.stroke();
      }
    } else if(d.type==='vline') {
      if(drawFg&&g.a.x >= -2 && g.a.x <= width + 2) {
        line(g.a.x,0,g.a.x,plotBottom);
        if(d.text){
          const style=d.textStyle||{},sz=style.size||14;
          const family=style.fontFamily==='monospace'?'Consolas, "Courier New", monospace':DEFAULT_FONT;
          ctx.save();
          ctx.font=`${style.italic?'italic ':''}${style.bold?'bold ':''}${sz}px ${family}`;
          ctx.fillStyle=style.color||d.borderColor||'#2962ff';
          ctx.setLineDash([]);
          const lines=String(d.text).split('\n'),lh=sz*1.25;
          const vy=style.vertical==='top'?12:style.vertical==='bottom'?plotBottom-12:plotBottom/2;
          if((style.orientation||'vertical')==='vertical'){
            ctx.translate(g.a.x,vy);
            ctx.rotate(-Math.PI/2);
            ctx.textAlign=style.vertical==='top'?'right':style.vertical==='bottom'?'left':'center';
            ctx.textBaseline=style.horizontal==='left'?'bottom':style.horizontal==='right'?'top':'middle';
            const offY=style.horizontal==='left'?-5:style.horizontal==='right'?5:0;
            lines.forEach((t,i)=>ctx.fillText(t,0,offY+(i-(lines.length-1)/2)*lh));
          } else {
            ctx.textAlign=style.horizontal==='left'?'right':style.horizontal==='right'?'left':'center';
            ctx.textBaseline=style.vertical==='top'?'top':style.vertical==='bottom'?'bottom':'middle';
            const offX=style.horizontal==='left'?-6:style.horizontal==='right'?6:0;
            lines.forEach((t,i)=>ctx.fillText(t,g.a.x+offX,vy+i*lh));
          }
          ctx.restore();
        }
      }
      ctx.restore();return;
    } else if(d.type === 'line') {
      if(!drawFg){ctx.restore();return;}
      if(d.axis==='vertical') {
        line(g.a.x,0,g.a.x,plotBottom);ctx.restore();return;
      }
      let a={...(g.a.x <= g.b.x ? g.a : g.b)},b={...(g.a.x <= g.b.x ? g.b : g.a)};
      if (Math.abs(b.x-a.x) >= 1e-6) {
        const slope=(b.y-a.y)/(b.x-a.x);
        if(d.extend === 'left' || d.extend === 'both'){const x=Math.min(a.x,b.x);const y=a.x<=b.x?a.y:b.y;a={x:0,y:y-x*slope};}
        if(d.extend === 'right' || d.extend === 'both'){const x=Math.max(g.a.x,g.b.x);const y=g.a.x>=g.b.x?g.a.y:g.b.y;b={x:width,y:y+(width-x)*slope};}
      } else if (d.extend === 'both') {
        a={x:a.x,y:0};
        b={x:a.x,y:plotBottom};
      }
      if (d.text && d.textStyle?.inlineOnLine) {
        const style=d.textStyle,family=style.fontFamily==='monospace'?'Consolas, "Courier New", monospace':DEFAULT_FONT;
        const dx=b.x-a.x,dy=b.y-a.y,segLen=Math.hypot(dx,dy),pos=style.inlinePos||'center';
        const fontStr=sz=>`${style.italic?'italic ':''}${style.bold?'bold ':''}${sz}px ${family}`;
        let baseSz=style.size||11;
        if(d._qtTrueOpen){
          if(!d._qtTrActive&&segLen<34){line(a.x,a.y,b.x,b.y);ctx.restore();return;}
          if(d._qtTier===0)baseSz=Math.min(baseSz,9.5);
          else if(d._qtTier===1)baseSz=Math.min(baseSz,10);
        }
        ctx.font=fontStr(baseSz);
        let tw=ctx.measureText(d.text).width,padX=4;
        let tx=(a.x+b.x)/2,ty=(a.y+b.y)/2,angle=segLen>1e-6?Math.atan2(dy,dx):0;
        if (Math.abs(dy) < 1e-3 && (pos === 'left' || pos === 'right' || d._qtTrueOpen)) {
          if(pos==='left'){
            const startX=a.x<6&&b.x>tw+18?6:a.x;
            tx=startX+tw/2;
          }else if(pos==='right'){
            const endX=b.x>width-6&&a.x<width-tw-18?width-6:b.x;
            tx=endX-tw/2;
          }else if(d.type==='text'){
        const pad=effSize/6;
        const maxW=Math.max(style.wordWrap?(style.wordWrapWidth||200):0,lines.reduce((m,l)=>Math.max(m,ctx.measureText?ctx.measureText(l).width:l.length*effSize*0.6),0));
        const boxW=maxW+pad*2,boxH=lines.length*lh+pad*2;
        if(style.fillBackground){
          ctx.fillStyle=rgba(style.backgroundColor||'#2962ff',style.backgroundOpacity??25);
          ctx.fillRect(g.a.x-pad,g.a.y-pad,boxW,boxH);
        }
        if(style.drawBorder){
          ctx.strokeStyle=style.borderColor||'#787b86';ctx.lineWidth=1;
          ctx.strokeRect(g.a.x-pad,g.a.y-pad,boxW,boxH);
        }
        ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle=style.color||'#2962ff';
        lines.forEach((text,index)=>ctx.fillText(text,g.a.x,g.a.y+index*lh));
      }else{
            const visA=Math.max(6,a.x),visB=Math.min(width-6,b.x);
            tx=visB-visA>tw+12?(visA+visB)/2:(a.x+b.x)/2;
          }
          ty=a.y;angle=0;
          const trBoxes=d._qtTrueOpen&&Array.isArray(chart._qtTrBoxes)?chart._qtTrBoxes:null;
          if(trBoxes){
            const halfH=baseSz*0.6+2;
            const hits=cx=>trBoxes.find(bx=>!(cx+tw/2+3<bx.x1||cx-tw/2-3>bx.x2||ty+halfH<bx.y1||ty-halfH>bx.y2));
            let hitBox=hits(tx),guard=0;
            while(hitBox&&guard++<6){
              const shifted=hitBox.x2+tw/2+8;
              if(shifted+tw/2<=Math.min(width-4,b.x+(d._qtTrActive?36:2))){tx=shifted;hitBox=hits(tx);}
              else break;
            }
            if(hitBox){
              if(!d._qtTrActive&&(d._qtTier??0)<=1){line(a.x,a.y,b.x,b.y);ctx.restore();return;}
              ty+=halfH*2+2;
              line(a.x,a.y,b.x,b.y);
              trBoxes.push({x1:tx-tw/2-2,y1:ty-halfH,x2:tx+tw/2+2,y2:ty+halfH});
              ctx.save();ctx.translate(tx,ty);ctx.setLineDash([]);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=style.color;ctx.fillText(d.text,0,0);ctx.restore();ctx.restore();return;
            }
            trBoxes.push({x1:tx-tw/2-2,y1:ty-halfH,x2:tx+tw/2+2,y2:ty+halfH});
          }
          const gL=tx-tw/2-padX,gR=tx+tw/2+padX;
          if(gL>a.x+2)line(a.x,a.y,Math.min(b.x,gL),a.y);
          if(b.x>gR+2)line(Math.max(a.x,gR),a.y,b.x,b.y);
        } else {
          if (segLen < 10) { line(a.x,a.y,b.x,b.y); ctx.restore(); return; }
          let maxSz = baseSz;
          const drawn = Array.isArray(chart._qtSsmtDrawn) ? chart._qtSsmtDrawn : null;
          if (drawn && drawn.length) {
            let minDist = Infinity;
            for (let i = 0; i < drawn.length; i++) {
              const dist = Math.hypot(tx - drawn[i].mx, ty - drawn[i].my);
              if (dist < minDist) minDist = dist;
            }
            if (minDist < 44 && segLen < 95) maxSz = Math.min(maxSz, Math.max(7.5, minDist * 0.22));
            else if (minDist < 28) maxSz = Math.min(maxSz, 9.5);
          }
          const fitSz = Math.min(maxSz, baseSz * (segLen * 0.52) / Math.max(1, tw));
          if (fitSz >= 8) {
            const sz = Math.round(fitSz * 2) / 2;
            if (sz !== baseSz) { ctx.font = fontStr(sz); tw = ctx.measureText(d.text).width; }
            const gapRatio = (tw / 2 + padX) / segLen;
            let chosenT = 0.5;
            if (drawn && drawn.length) {
              const candidates = [0.5, 0.35, 0.65, 0.26, 0.74];
              for (let c = 0; c < candidates.length; c++) {
                const tCand = candidates[c];
                if (tCand - gapRatio < 0.08 || tCand + gapRatio > 0.92) continue;
                const cx = a.x + dx * tCand, cy = a.y + dy * tCand;
                const clash = drawn.some(p => Math.hypot(cx - p.x, cy - p.y) < (tw + (p.w || tw)) * 0.38 && Math.abs((cx - p.x) * (-dy / segLen) + (cy - p.y) * (dx / segLen)) < sz + 3);
                if (!clash) { chosenT = tCand; break; }
              }
            }
            tx = a.x + dx * chosenT;
            ty = a.y + dy * chosenT;
            const t0 = chosenT - gapRatio, t1 = chosenT + gapRatio;
            line(a.x, a.y, a.x + dx * t0, a.y + dy * t0);
            line(a.x + dx * t1, a.y + dy * t1, b.x, b.y);
          } else {
            // Short SSMT: keep 100% of the SSMT line unbroken and place compact label cleanly outside the line
            line(a.x, a.y, b.x, b.y);
            const sz = segLen < 28 ? 7.5 : 8;
            ctx.font = fontStr(sz);
            tw = ctx.measureText(d.text).width;
            const sign = d._qtDir === 1 ? -1 : 1;
            const nx = dy / segLen, ny = -dx / segLen;
            const basePerp = sz * 0.65 + 2.5;
            const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
            const clampPt = (px, py) => {
              if (width > tw + 12 && plotBottom > 30) {
                px = Math.max(tw / 2 + 2, Math.min(width - tw / 2 - 2, px));
                py = Math.max(sz * 0.8, Math.min(plotBottom - sz * 0.8, py));
              }
              return [px, py];
            };
            [tx, ty] = clampPt(midX + sign * nx * basePerp, midY + sign * ny * basePerp);
            if (drawn && drawn.length) {
              const steps = [basePerp, basePerp + sz + 2.5, -basePerp, -(basePerp + sz + 2.5)];
              let clear = false;
              for (let sIdx = 0; sIdx < steps.length; sIdx++) {
                const [cx, cy] = clampPt(midX + sign * nx * steps[sIdx], midY + sign * ny * steps[sIdx]);
                if (!drawn.some(p => Math.hypot(cx - p.x, cy - p.y) < 18)) {
                  tx = cx; ty = cy; clear = true; break;
                }
              }
              if (!clear && segLen < 22) { ctx.restore(); return; }
            }
          }
          if (drawn) drawn.push({ x: tx, y: ty, w: tw, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 });
        }
        ctx.save();
        ctx.translate(tx,ty);
        if(angle)ctx.rotate(angle);
        ctx.setLineDash([]);ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle=style.color;ctx.fillText(d.text,0,0);
        ctx.restore();
        ctx.restore();return;
      }
      line(a.x,a.y,b.x,b.y);
      const items=[],change=d.p2.price-d.p1.price;
      if(d.stats.price)items.push(change.toFixed(2));
      if(d.stats.percent)items.push(d.p1.price?(change/d.p1.price*100).toFixed(2)+'%':'—');
      if(d.stats.bars)items.push(Math.abs(Math.round(logicalIndex(chart,d.p2.time)-logicalIndex(chart,d.p1.time)))+' bars');
      if(d.stats.time)items.push(Math.abs(Math.round((d.p2.time-d.p1.time)/60))+' min');
      if(items.length){ctx.setLineDash([]);ctx.font=`${d.textStyle.size}px ${DEFAULT_FONT}`;ctx.fillStyle=d.textStyle.color;ctx.textAlign='center';ctx.fillText(items.join(' · '),(g.a.x+g.b.x)/2,(g.a.y+g.b.y)/2-9);}
      if(d.stats.middle){ctx.beginPath();ctx.arc((g.a.x+g.b.x)/2,(g.a.y+g.b.y)/2,3,0,Math.PI*2);ctx.stroke();}

    } else if(d.type === 'hline') { if(drawFg)line(0,g.a.y,width,g.a.y); }
    else if(d.type === 'box') {
      if(drawBg&&d.fillEnabled){ctx.fillStyle=rgba(d.fillColor,d.fillOpacity);ctx.fillRect(left,top,right-left,bottom-top);}
      if(drawFg&&d.strokeOpacity>0&&d.width>0&&d.borderColor!=='transparent'){
        if(isRealCanvas&&ctx.lineWidth<=1){const sx=snap(left),sy=snap(top),sr=snap(right),sb=snap(bottom);ctx.strokeRect(sx,sy,sr-sx,sb-sy);}
        else ctx.strokeRect(left,top,right-left,bottom-top);
      }
      if(drawFg&&d.middleLine.enabled){ctx.strokeStyle=rgba(d.middleLine.color,d.middleLine.opacity);ctx.lineWidth=crispW(d.middleLine.width);ctx.setLineDash(dash(d.middleLine.style));line(left,(top+bottom)/2,right,(top+bottom)/2);}
    } else if(d.type === 'fib') {
      const levels=(d.fibLevels||cloneFibLevels()).filter(l=>l&&l.visible!==false&&Number.isFinite(Number(l.coeff))).map(l=>({coeff:Number(l.coeff),color:l.color||d.borderColor||'#787b86'})).sort((a,b)=>a.coeff-b.coeff);
      const basePrice=d.reverse?d.p1.price:d.p2.price,endPrice=d.reverse?d.p2.price:d.p1.price;
      const baseY=d.reverse?g.a.y:g.b.y,endY=d.reverse?g.b.y:g.a.y;
      const pts=levels.map(l=>({ ...l, y:baseY+(endY-baseY)*l.coeff, price:basePrice+(endPrice-basePrice)*l.coeff }));
      if(drawBg&&d.fillEnabled&&pts.length>1){
        for(let i=1;i<pts.length;i++){
          const prev=pts[i-1],cur=pts[i];
          ctx.fillStyle=rgba(cur.color,d.fillOpacity??20);
          ctx.fillRect(left,Math.min(prev.y,cur.y),right-left,Math.abs(cur.y-prev.y));
        }
      }
      if(!drawFg){ctx.restore();return;}
      if(d.fibTrendline?.visible!==false){
        const tl=d.fibTrendline||{};
        ctx.save();
        ctx.strokeStyle=rgba(tl.color||'#787b86',tl.opacity??100);
        ctx.lineWidth=crispW(tl.width||1);
        ctx.setLineDash(dash(tl.style||'dashed'));
        line(g.a.x,g.a.y,g.b.x,g.b.y);
        ctx.restore();
      }
      const tick=chart.metadata?.tickSize;
      const prec=Number.isFinite(tick)&&tick>0?Math.max(0,(String(tick).split('.')[1]||'').length):2;
      const fSize=d.labelFontSize||12;
      const hAlign=d.horzLabelsAlign||'left',vAlign=d.vertLabelsAlign||'middle';
      const extLeft=d.extend==='left'||d.extend==='both',extRight=d.extend==='right'||d.extend==='both';
      ctx.font=`${fSize}px ${DEFAULT_FONT}`;
      ctx.textBaseline=vAlign==='top'?'bottom':vAlign==='bottom'?'top':'middle';
      let labelX;
      if(hAlign==='right'){
        if(extRight){ctx.textAlign='right';labelX=right-6;}
        else{ctx.textAlign='left';labelX=right+8;}
      }else if(hAlign==='center'){
        ctx.textAlign='center';labelX=(left+right)/2;
      }else{
        if(extLeft){ctx.textAlign='left';labelX=left+6;}
        else{ctx.textAlign='right';labelX=left-8;}
      }
      const labelOffY=vAlign==='top'?-3:vAlign==='bottom'?3:0;
      ctx.lineWidth=crispW(d.width||1);
      ctx.setLineDash(dash(d.lineStyle||'solid'));
      for(const lv of pts){
        ctx.strokeStyle=rgba(lv.color,d.strokeOpacity??100);
        line(left,lv.y,right,lv.y);
        const parts=[];
        if(d.showCoeffs!==false)parts.push(d.coeffsAsPercents?`${Number((lv.coeff*100).toFixed(2))}%`:String(lv.coeff));
        if(d.showPrices!==false)parts.push(`(${lv.price.toFixed(prec)})`);
        if(parts.length){
          ctx.fillStyle=rgba(lv.color,d.strokeOpacity??100);
          ctx.fillText(parts.join(' '),labelX,lv.y+labelOffY);
        }
      }
    } else if(d.type === 'position'&&g.c) {
      const boxLeft=g.a.x,span=Math.max(30,g.b.x-g.a.x),entry=g.a.y,target=g.b.y,stop=g.c.y;
      const isLong=d.side==='short'?false:(d.side==='long'?true:d.p2.price>=d.p1.price);
      const reward=Math.abs(d.p2.price-d.p1.price),risk=Math.abs(d.p1.price-d.p3.price),rr=risk?reward/risk:0;
      const tick=chart.metadata?.tickSize||0.25,pv=chart.metadata?.pointValue||1;
      const rewardTicks=Math.round(reward/tick),riskTicks=Math.round(risk/tick);
      const rewardPct=d.p1.price?(reward/d.p1.price*100):0,riskPct=d.p1.price?(risk/d.p1.price*100):0;
      const riskAmt=d.riskDisplayMode==='percents'?((d.accountSize||25000)*(d.risk||1)/100):(d.risk??100);
      const rewardAmt=riskAmt*rr,qty=risk>0?(riskAmt/(risk*pv)):0;
      const lastClose=chart.bars?.at(-1)?.close;
      const openPnl=Number.isFinite(lastClose)&&risk>0?((isLong?lastClose-d.p1.price:d.p1.price-lastClose)/risk)*riskAmt:0;
      const rewardTop=Math.min(entry,target),rewardBottom=Math.max(entry,target),riskTop=Math.min(entry,stop),riskBottom=Math.max(entry,stop);
      if(drawBg){
        ctx.fillStyle=rgba(d.profitColor,d.profitOpacity);ctx.fillRect(boxLeft,rewardTop,span,Math.max(1,rewardBottom-rewardTop));
        ctx.fillStyle=rgba(d.stopColor,d.stopOpacity);ctx.fillRect(boxLeft,riskTop,span,Math.max(1,riskBottom-riskTop));
      }
      const bars=chart.bars||[];
      let exitBar=null,exitPrice=null;
      for(let i=0;i<bars.length;i++){
        const b=bars[i];
        if(b.time<d.p1.time)continue;
        if(b.time>d.p2.time)break;
        exitBar=b;exitPrice=b.close;
        if(isLong){
          if(b.low<=d.p3.price){exitPrice=d.p3.price;break;}
          if(b.high>=d.p2.price){exitPrice=d.p2.price;break;}
        }else{
          if(b.high>=d.p3.price){exitPrice=d.p3.price;break;}
          if(b.low<=d.p2.price){exitPrice=d.p2.price;break;}
        }
      }
      if(exitBar&&Number.isFinite(exitPrice)){
        const exitPt=point(chart,{time:exitBar.time,price:exitPrice});
        if(Number.isFinite(exitPt.x)&&Number.isFinite(exitPt.y)){
          const inProfit=isLong?exitPrice>=d.p1.price:exitPrice<=d.p1.price;
          const exTop=Math.min(entry,exitPt.y),exH=Math.max(1,Math.abs(exitPt.y-entry));
          if(drawBg){
            ctx.fillStyle=rgba(inProfit?d.profitColor:d.stopColor,Math.min(45,(inProfit?d.profitOpacity:d.stopOpacity)*0.95));
            ctx.fillRect(boxLeft,exTop,Math.max(1,exitPt.x-boxLeft),exH);
          }
          if(drawFg){
            ctx.save();
            ctx.strokeStyle='rgba(120, 123, 134, 0.78)';
            ctx.lineWidth=1.5;
            ctx.setLineDash([5,4]);
            line(boxLeft,entry,exitPt.x,exitPt.y);
            ctx.setLineDash([]);
            const dx=exitPt.x-boxLeft,dy=exitPt.y-entry,len=Math.hypot(dx,dy);
            if(len>10){
              const ux=dx/len,uy=dy/len,sz=7;
              ctx.beginPath();
              ctx.moveTo(exitPt.x-(ux*sz-uy*4.5),exitPt.y-(uy*sz+ux*4.5));
              ctx.lineTo(exitPt.x,exitPt.y);
              ctx.lineTo(exitPt.x-(ux*sz+uy*4.5),exitPt.y-(uy*sz-ux*4.5));
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      }
      if(!drawFg){ctx.restore();return;}
      ctx.setLineDash(dash(d.lineStyle).length?dash(d.lineStyle):[4,4]);ctx.strokeStyle=rgba(d.borderColor,d.strokeOpacity);ctx.lineWidth=crispW(d.width);line(boxLeft,entry,boxLeft+span,entry);ctx.setLineDash([]);
      const isSelected=typeof window!=='undefined'&&window.drawingMgr?.editor?.drawing?.id===d.id;
      if(d.alwaysShowStats===true||isSelected||d.isTemp){
        const posSize=d.textStyle?.size||11,posTextCol=d.textStyle?.color||'#ffffff';
        const pill=(text,x,y,fill,bordered=false)=>{
          const lines=Array.isArray(text)?text:[text];
          ctx.font=`500 ${posSize}px ${DEFAULT_FONT}`;
          const maxW=lines.reduce((m,l)=>Math.max(m,ctx.measureText?ctx.measureText(l).width:l.length*6),0);
          const lh=posSize+3,w=maxW+16,h=lines.length*lh+8;
          ctx.fillStyle=fill;
          ctx.beginPath();
          if(ctx.roundRect)ctx.roundRect(x-w/2,y-h/2,w,h,5);
          else ctx.rect(x-w/2,y-h/2,w,h);
          ctx.fill();
          if(bordered){ctx.strokeStyle='rgba(255,255,255,0.88)';ctx.lineWidth=1;ctx.stroke();}
          ctx.fillStyle=posTextCol;ctx.textAlign='center';ctx.textBaseline='middle';
          const startY=y-(lines.length-1)*lh/2;
          lines.forEach((l,i)=>ctx.fillText(l,x,startY+i*lh));
        };
        const tpColor=hex(d.profitColor)||'#089981',slColor=hex(d.stopColor)||'#f23645',midColor=openPnl>=0?tpColor:slColor;
        const tpText=d.compact?`T: ${reward.toFixed(2)} (${rewardPct.toFixed(2)}%) · ${rewardTicks}`:`Target: ${reward.toFixed(2)} (${rewardPct.toFixed(2)}%) ${rewardTicks}, Amount: ${((d.accountSize||25000)+rewardAmt).toFixed(2)}`;
        const slText=d.compact?`S: ${risk.toFixed(2)} (${riskPct.toFixed(2)}%) · ${riskTicks}`:`Stop: ${risk.toFixed(2)} (${riskPct.toFixed(2)}%) ${riskTicks}, Amount: ${((d.accountSize||25000)-riskAmt).toFixed(2)}`;
        const midLines=d.compact?[`R/R: ${rr.toFixed(2)} · Qty: ${qty.toFixed(2)}`]:[`Open PnL: ${openPnl.toFixed(2)}, Qty: ${qty.toFixed(3)}`,`Risk/reward ratio: ${rr.toFixed(2)}`];
        pill(tpText,boxLeft+span/2,isLong?rewardTop-16:rewardBottom+16,tpColor);
        pill(midLines,boxLeft+span/2,isLong?entry-24:entry+24,midColor,true);
        pill(slText,boxLeft+span/2,isLong?riskBottom+16:riskTop-16,slColor);
      }
      if(d.showPriceLabels!==false&&isSelected){
        const pxTag=(val,y,fill)=>{const txt=val.toFixed(2);ctx.font=`500 10px ${DEFAULT_FONT}`;const w=ctx.measureText(txt).width+8;ctx.fillStyle=fill;ctx.fillRect(boxLeft+span+2,y-8,w,16);ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(txt,boxLeft+span+6,y+3.5);};
        pxTag(d.p2.price,target,hex(d.profitColor)||'#089981');
        pxTag(d.p1.price,entry,'#68717c');
        pxTag(d.p3.price,stop,hex(d.stopColor)||'#f23645');
      }
    } else if(d.type === 'measure') {
      const change = d.p2.price - d.p1.price;
      const isUp = change >= 0;
      const baseHex = isUp ? '#2962ff' : '#f23645';
      const fillCss = isUp ? 'rgba(41, 98, 255, 0.20)' : 'rgba(242, 54, 69, 0.20)';
      const boxW = right - left, boxH = bottom - top;
      if(drawBg){
        ctx.fillStyle = fillCss;
        ctx.fillRect(left, top, boxW, boxH);
      }
      if(!drawFg){ctx.restore();return;}

      ctx.strokeStyle = baseHex;
      ctx.fillStyle = baseHex;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      const arrowHead = (x, y, dx, dy) => {
        const len = Math.hypot(dx, dy);
        if (!len) return;
        const ux = dx / len, uy = dy / len, sz = 6, hw = 3.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - ux * sz - uy * hw, y - uy * sz + ux * hw);
        ctx.lineTo(x - ux * sz + uy * hw, y - uy * sz - ux * hw);
        ctx.closePath();
        ctx.fill();
      };
      const midX = (g.a.x + g.b.x) / 2, midY = (g.a.y + g.b.y) / 2;
      if (Math.abs(g.b.x - g.a.x) >= 6) {
        line(g.a.x, midY, g.b.x, midY);
        arrowHead(g.b.x, midY, g.b.x - g.a.x, 0);
      }
      if (Math.abs(g.b.y - g.a.y) >= 6) {
        line(midX, g.a.y, midX, g.b.y);
        arrowHead(midX, g.b.y, 0, g.b.y - g.a.y);
      }

      const tick = chart.metadata?.tickSize;
      const dec = Number.isFinite(tick) && tick > 0 ? Math.max(0, Math.min(6, Math.ceil(-Math.log10(tick)))) : 2;
      const pct = d.p1.price ? (change / d.p1.price) * 100 : 0;
      const sign = change > 0 ? '+' : '';
      const ticksStr = Number.isFinite(tick) && tick > 0 ? ` ${Math.round(Math.abs(change) / tick)}` : '';
      const line1 = `${sign}${change.toFixed(dec)} (${sign}${pct.toFixed(2)}%)${ticksStr}`;

      const i1 = DrawingModel.logicalIndex(chart, d.p1.time);
      const i2 = DrawingModel.logicalIndex(chart, d.p2.time);
      const barsCount = (i1 != null && i2 != null) ? Math.abs(Math.round(i2 - i1)) : 0;
      const dt = Math.abs((d.p2.time || 0) - (d.p1.time || 0));
      let durText = '0m';
      if (dt < 60) durText = `${Math.round(dt)}s`;
      else if (dt < 3600) durText = `${Math.round(dt / 60)}m`;
      else if (dt < 86400) {
        const h = Math.floor(dt / 3600), mins = Math.round((dt % 3600) / 60);
        durText = mins ? `${h}h ${mins}m` : `${h}h`;
      } else {
        const days = Math.floor(dt / 86400), h = Math.floor((dt % 86400) / 3600);
        durText = h ? `${days}d ${h}h` : `${days}d`;
      }
      const line2 = `${barsCount} ${barsCount === 1 ? 'bar' : 'bars'}, ${durText}`;

      ctx.font = `600 11px ${DEFAULT_FONT}`;
      const w1 = ctx.measureText ? ctx.measureText(line1).width : line1.length * 6.2;
      const w2 = ctx.measureText ? ctx.measureText(line2).width : line2.length * 6.2;
      const padX = 10, padY = 6, lineH = 15;
      const tipW = Math.ceil(Math.max(w1, w2) + padX * 2);
      const tipH = lineH * 2 + padY * 2 - 2;
      const tipX = Math.max(4, Math.min((width || 800) - tipW - 4, (left + right) / 2 - tipW / 2));
      let tipY = g.b.y <= g.a.y ? top - tipH - 8 : bottom + 8;
      if (tipY < 4) tipY = Math.min(plotBottom - tipH - 4, bottom + 8);
      if (tipY + tipH > plotBottom - 4) tipY = Math.max(4, top - tipH - 8);

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = baseHex;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(tipX, tipY, tipW, tipH, 4);
      else ctx.rect(tipX, tipY, tipW, tipH);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(line1, tipX + tipW / 2, tipY + padY + lineH * 0.42);
      ctx.fillText(line2, tipX + tipW / 2, tipY + padY + lineH * 1.42);
    }
    if(drawFg && (d.text || d.type === 'text') && d.type !== 'vline' && !d._editingInline) {
      const style=d.textStyle;
      let effSize=style.size||(d.type==='text'?14:12);
      if(d._qtTrueOpenSpan){
        if(d._qtTier===0)effSize=Math.min(effSize,9.5);
        else if(d._qtTier===1)effSize=Math.min(effSize,10);
      }
      let lh=effSize*1.25;
      const family=style.fontFamily==='monospace'?'Consolas, "Courier New", monospace':DEFAULT_FONT;
      const setFont=sz=>{ctx.font=`${style.italic?'italic ':''}${style.bold?'bold ':''}${sz}px ${family}`;};
      ctx.setLineDash([]);setFont(effSize);
      let lines=(d.type==='text'&&style.wordWrap&&!style.pine)?wrapTextLines(ctx,d.text||'Text',style.wordWrapWidth||200):(d.text||(d.type==='text'?'Text':'')).split('\n');
      if(d.type==='text'&&style.pine){
        const place=style.placement||'center',padX=6,padY=3;
        const align=place==='label_left'?'left':place==='label_right'?'right':(style.horizontal||'center');
        let x=place==='label_left'?g.a.x+6:place==='label_right'?g.a.x-6:g.a.x;
        const base=place==='above'?'bottom':place==='below'?'top':'middle';
        const vGap=d._qtTrueOpenSpan?3:6;
        let anchorY=place==='above'?g.a.y-vGap:place==='below'?g.a.y+vGap:g.a.y;

        if(d._qtTrueOpenSpan){
          const spA=point(chart,{time:d._qtTrueOpenSpan.x1,price:d.p1.price});
          const spB=point(chart,{time:d._qtTrueOpenSpan.x2,price:d.p1.price});
          const segX1=Number.isFinite(spA.x)?spA.x:x,segX2=Number.isFinite(spB.x)?spB.x:x;
          const segW=Math.max(0,segX2-segX1);
          if(!d._qtTrActive&&segW<34){ctx.restore();return;}
          const maxW=ctx.measureText ? lines.reduce((m,l)=>Math.max(m,ctx.measureText(l).width),0) : d.text.length*effSize*0.6;
          if(align==='left'&&x<4&&segX2>maxW+10)x=4;
          if(align==='right'&&x>width-4&&segX1<width-maxW-10)x=width-4;
          const trBoxes=Array.isArray(chart._qtTrBoxes)?chart._qtTrBoxes:null;
          if(trBoxes){
            const boxBounds=(cx,ay)=>{
              const bx1=align==='left'?cx:align==='right'?cx-maxW:cx-maxW/2;
              const by1=base==='top'?ay:base==='bottom'?ay-lines.length*lh:ay-lines.length*lh*0.5;
              return {x1:bx1-2,y1:by1-1,x2:bx1+maxW+2,y2:by1+lines.length*lh+1};
            };
            let bnd=boxBounds(x,anchorY);
            const findHit=b=>trBoxes.find(o=>!(b.x2<o.x1||b.x1>o.x2||b.y2<o.y1||b.y1>o.y2));
            let hitBox=findHit(bnd),guard=0;
            while(hitBox&&guard++<6){
              const nextLeft=hitBox.x2+12;
              const nextX=align==='left'?nextLeft:align==='right'?nextLeft+maxW:nextLeft+maxW/2;
              const maxRight=Math.min(width-4,segX2+(d._qtTrActive?44:6));
              if(nextLeft+maxW<=maxRight){x=nextX;bnd=boxBounds(x,anchorY);hitBox=findHit(bnd);}
              else break;
            }
            if(hitBox){
              if(!d._qtTrActive&&(d._qtTier??0)<=1){ctx.restore();return;}
              anchorY+=place==='below'?(lines.length*lh+3):-(lines.length*lh+3);
              bnd=boxBounds(x,anchorY);
            }
            trBoxes.push(bnd);
          }
        } else if(d._qtQLabel){
          let maxW=ctx.measureText ? lines.reduce((m,l)=>Math.max(m,ctx.measureText(l).width),0) : lines[0].length*effSize*0.65;
          const halfH=lines.length*lh*0.5;
          if(plotBottom>40&&anchorY+halfH>plotBottom-3)anchorY=plotBottom-halfH-3;
          const qBoxes=Array.isArray(chart._qtQBoxes)?chart._qtQBoxes:null;
          if(qBoxes){
            const collides=w=>qBoxes.some(o=>Math.abs(x-o.x)<(w+o.w)*0.5+5&&Math.abs(anchorY-o.y)<lh*1.4);
            if(collides(maxW)){
              if(lines.length>1){
                lines=[lines[0]];
                effSize=Math.min(effSize,10);lh=effSize*1.2;setFont(effSize);
                maxW=ctx.measureText ? ctx.measureText(lines[0]).width : lines[0].length*effSize*0.65;
              }
              if(collides(maxW)){ctx.restore();return;}
            }
            qBoxes.push({x,y:anchorY,w:maxW});
          }
        }

        const startY=base==='bottom'?anchorY-(lines.length-1)*lh:base==='middle'?anchorY-(lines.length-1)*lh*.5:anchorY;
        if(d.labelBg){
          const maxW=lines.reduce((m,l)=>Math.max(m,ctx.measureText(l).width),0),boxW=maxW+padX*2,boxH=lines.length*lh+padY*2;
          const bx=align==='left'?x-padX:align==='right'?x-maxW-padX:x-boxW/2;
          const by=base==='top'?anchorY-padY:base==='bottom'?anchorY-lines.length*lh-padY:anchorY-boxH/2;
          ctx.fillStyle=d.labelBg;ctx.fillRect(bx,by,boxW,boxH);
        }
        ctx.textAlign=align;ctx.textBaseline=base;ctx.fillStyle=style.color;
        lines.forEach((text,index)=>qtText(text,x,startY+index*lh));
      }else if(d.type==='text'){
        const pad=effSize/6;
        const maxW=Math.max(style.wordWrap?(style.wordWrapWidth||200):0,lines.reduce((m,l)=>Math.max(m,ctx.measureText?ctx.measureText(l).width:l.length*effSize*0.6),0));
        const boxW=maxW+pad*2,boxH=lines.length*lh+pad*2;
        if(style.fillBackground){
          ctx.fillStyle=rgba(style.backgroundColor||'#2962ff',style.backgroundOpacity??25);
          ctx.fillRect(g.a.x-pad,g.a.y-pad,boxW,boxH);
        }
        if(style.drawBorder){
          ctx.strokeStyle=style.borderColor||'#787b86';ctx.lineWidth=1;
          ctx.strokeRect(g.a.x-pad,g.a.y-pad,boxW,boxH);
        }
        ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle=style.color||'#2962ff';
        lines.forEach((text,index)=>ctx.fillText(text,g.a.x,g.a.y+index*lh));
      }else{
        ctx.textAlign=style.horizontal;ctx.fillStyle=style.color;
        const x=d.type === 'text'?g.a.x:style.horizontal === 'left'?left+6:style.horizontal === 'center'?(left+right)/2:right-6;
        if(d.type==='box'&&['top','bottom','inside'].includes(style.vertical)){
          ctx.textBaseline=style.vertical==='top'?'top':style.vertical==='bottom'?'bottom':'middle';
          const y=style.vertical==='top'?top+4:style.vertical==='bottom'?bottom-4-(lines.length-1)*lh:(top+bottom)/2-(lines.length-1)*lh*.5;
          lines.forEach((text,index)=>ctx.fillText(text,x,y+index*lh));
        }else if(d.type==='text'){
        const pad=effSize/6;
        const maxW=Math.max(style.wordWrap?(style.wordWrapWidth||200):0,lines.reduce((m,l)=>Math.max(m,ctx.measureText?ctx.measureText(l).width:l.length*effSize*0.6),0));
        const boxW=maxW+pad*2,boxH=lines.length*lh+pad*2;
        if(style.fillBackground){
          ctx.fillStyle=rgba(style.backgroundColor||'#2962ff',style.backgroundOpacity??25);
          ctx.fillRect(g.a.x-pad,g.a.y-pad,boxW,boxH);
        }
        if(style.drawBorder){
          ctx.strokeStyle=style.borderColor||'#787b86';ctx.lineWidth=1;
          ctx.strokeRect(g.a.x-pad,g.a.y-pad,boxW,boxH);
        }
        ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle=style.color||'#2962ff';
        lines.forEach((text,index)=>ctx.fillText(text,g.a.x,g.a.y+index*lh));
      }else{
          const y=style.vertical === 'above'?top-8-(lines.length-1)*style.size*1.3:style.vertical === 'below'?bottom+style.size+6:d.type === 'text'?g.a.y:(top+bottom)/2-(lines.length-1)*style.size*.65;
          lines.forEach((text,index)=>ctx.fillText(text,x,y+index*style.size*1.3));
        }
      }
    }
    ctx.restore();
  }
  return {names,groups,defaults,normalize,visible,logicalIndex,timeAt,point,fromPixel,constrainLinePoint,hex,rgba,geometry,hit,inRect,draw,boxEdges,resizeBox,positionHandles};
})();
if(typeof module !== 'undefined')module.exports=DrawingModel;
