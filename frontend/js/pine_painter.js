/* Renderer-neutral Pine pane plots and fills, shared by the v4 canvas and v5 primitive. */
const PinePainter={
  draw(ctx,chart,descriptor,width,height){
    const x=time=>chart.chart.timeScale().logicalToCoordinate(DrawingModel.logicalIndex(chart,time)),y=value=>chart.series.priceToCoordinate(value);
    const spacing=time=>{const index=DrawingModel.logicalIndex(chart,time);if(index===null)return 8;const scale=chart.chart.timeScale(),a=scale.logicalToCoordinate(index),b=scale.logicalToCoordinate(index+1);return a===null||b===null?8:Math.abs(b-a);};
    ctx.save();ctx.beginPath();ctx.rect(0,24,Math.max(0,width-65),Math.max(0,height-24));ctx.clip();
    for(const paint of descriptor.paints||[]){
      if(paint.type==='background')for(const point of paint.data){const at=x(point.time),step=spacing(point.time);if(at!==null&&at+step>=0&&at-step<=width-65){ctx.fillStyle=point.color;ctx.fillRect(at-step/2,24,step,height-24);}}
      else if(paint.type==='fill'){
        const bottom=new Map(paint.bottom.map(p=>[p.time,p.value]));
        for(let i=1;i<paint.top.length;i++){const a=paint.top[i-1],b=paint.top[i],lowA=bottom.get(a.time),lowB=bottom.get(b.time);if(![a.value,b.value,lowA,lowB].every(Number.isFinite))continue;
          const xa=x(a.time),xb=x(b.time),ya=y(a.value),yb=y(b.value),la=y(lowA),lb=y(lowB);if([xa,xb,ya,yb,la,lb].some(v=>v===null))continue;
          if(Math.max(xa,xb)<0||Math.min(xa,xb)>width-65)continue;
          ctx.fillStyle=paint.colors?.[i]||paint.color;ctx.beginPath();ctx.moveTo(xa,ya);ctx.lineTo(xb,yb);ctx.lineTo(xb,lb);ctx.lineTo(xa,la);ctx.closePath();ctx.fill();
        }
      }
    }
    for(const series of descriptor.series||[]){
      const points=series.data||[],baseline=y(0)??height;
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
