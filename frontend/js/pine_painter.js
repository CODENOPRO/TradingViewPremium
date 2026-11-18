/* Renderer-neutral Pine pane plots and fills, shared by the v4 canvas and v5 primitive. */
const PinePainter={
  draw(ctx,chart,descriptor,width,height){
    const x=time=>chart.chart.timeScale().logicalToCoordinate(DrawingModel.logicalIndex(chart,time)),y=value=>chart.series.priceToCoordinate(value);
    const spacing=time=>{const index=DrawingModel.logicalIndex(chart,time);if(index===null)return 8;const scale=chart.chart.timeScale(),a=scale.logicalToCoordinate(index),b=scale.logicalToCoordinate(index+1);return a===null||b===null?8:Math.abs(b-a);};
    const top=descriptor.topInset??(descriptor.series?.length||descriptor.min!==undefined?24:0);
    ctx.save();ctx.beginPath();ctx.rect(0,top,Math.max(0,width-65),Math.max(0,height-top));ctx.clip();
    for(const paint of descriptor.paints||[]){
      if(paint.type==='background')for(const point of paint.data){const at=x(point.time),step=spacing(point.time);if(at!==null&&at+step>=0&&at-step<=width-65){ctx.fillStyle=point.color;ctx.fillRect(at-step/2,top,step,height-top);}}
      else if(paint.type==='fill'){
        const bottom=new Map(paint.bottom.map(p=>[p.time,p.value]));
        for(let i=1;i<paint.top.length;i++){const a=paint.top[i-1],b=paint.top[i],lowA=bottom.get(a.time),lowB=bottom.get(b.time);if(![a.value,b.value,lowA,lowB].every(Number.isFinite))continue;
          const xa=x(a.time),xb=x(b.time),ya=y(a.value),yb=y(b.value),la=y(lowA),lb=y(lowB);if([xa,xb,ya,yb,la,lb].some(v=>v===null))continue;
          if(Math.max(xa,xb)<0||Math.min(xa,xb)>width-65)continue;
          ctx.fillStyle=paint.colors?.[i]||paint.color;ctx.beginPath();ctx.moveTo(xa,ya);ctx.lineTo(xb,yb);ctx.lineTo(xb,lb);ctx.lineTo(xa,la);ctx.closePath();ctx.fill();
        }
      } else if((paint.type==='quad'||paint.type==='polyline')&&Array.isArray(paint.points)&&paint.points.length>=2){
        const coords=paint.points.map(p=>({px:x(p.time),py:y(p.price)}));
        if(coords.some(c=>c.px===null||c.py===null))continue;
        ctx.beginPath();coords.forEach((c,i)=>{if(i)ctx.lineTo(c.px,c.py);else ctx.moveTo(c.px,c.py);});
        if(paint.closed||paint.type==='quad')ctx.closePath();
        if(paint.type==='quad'||paint.fillColor){ctx.fillStyle=paint.fillColor||paint.color;ctx.fill();}
        if(paint.type==='polyline'&&paint.color){ctx.strokeStyle=paint.color;ctx.lineWidth=paint.width||1;ctx.setLineDash(paint.lineStyle==='dashed'?[7,5]:paint.lineStyle==='dotted'?[2,3]:[]);ctx.stroke();ctx.setLineDash([]);}
      }
    }
    for(const series of descriptor.series||[]){
      const points=series.data||[],baseline=y(0)??height;
      if(series.type==='candle'||series.type==='bar'){
        for(const pt of points){
          if(!Number.isFinite(pt.high)||!Number.isFinite(pt.low))continue;
          const px=x(pt.time);if(px===null||px<-20||px>width-45)continue;
          const yo=y(pt.open),yh=y(pt.high),yl=y(pt.low),yc=y(pt.close),step=Math.max(2,Math.min(16,spacing(pt.time)*.6));
          ctx.strokeStyle=pt.wickColor||pt.color||'#211f1d';ctx.beginPath();ctx.moveTo(px,yh);ctx.lineTo(px,yl);ctx.stroke();
          if(series.type==='candle'){ctx.fillStyle=pt.color||(pt.close>=pt.open?'#26a69a':'#f23645');ctx.fillRect(px-step/2,Math.min(yo,yc),step,Math.max(1,Math.abs(yc-yo)));}
        }
        continue;
      }
      ctx.lineWidth=series.width||1;ctx.setLineDash(series.lineStyle==='dashed'?[7,5]:series.lineStyle==='dotted'?[2,3]:[]);
      let previous=null;
      for(const point of points){
        if(!Number.isFinite(point.value)){previous=null;continue;}
        const px=x(point.time),py=y(point.value);if(px===null||py===null){previous=null;continue;}
        ctx.strokeStyle=point.color||series.color||'#2962ff';ctx.fillStyle=ctx.strokeStyle;
        if(series.type==='histogram'){if(px>=-20&&px<=width-45){const step=Math.max(1,Math.min(20,spacing(point.time)*.7));ctx.fillRect(px-step/2,Math.min(py,baseline),step,Math.max(1,Math.abs(py-baseline)));}}
        else if(previous&&Math.max(previous.x,px)>=0&&Math.min(previous.x,px)<=width-65){
          if(series.type==='area'){ctx.save();ctx.globalAlpha=.25;ctx.beginPath();ctx.moveTo(previous.x,baseline);ctx.lineTo(previous.x,previous.y);ctx.lineTo(px,py);ctx.lineTo(px,baseline);ctx.closePath();ctx.fill();ctx.restore();}
          ctx.beginPath();ctx.moveTo(previous.x,previous.y);if(series.step)ctx.lineTo(px,previous.y);ctx.lineTo(px,py);ctx.stroke();
        }
        previous={x:px,y:py};
      }
    }
    ctx.restore();
  }
};
if(typeof module!=='undefined')module.exports=PinePainter;
