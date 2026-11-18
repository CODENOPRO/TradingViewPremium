/* Preview prices never mutate persisted alerts or take part in trigger checks. */
const AlertPrice={
  round(price,tick=.01){if(!Number.isFinite(price)||!Number.isFinite(tick)||tick<=0)throw Error('Giá hoặc tick không hợp lệ.');return Number((Math.round(price/tick)*tick).toFixed(10));},
  crossed(alert,previous,price){return alert.condition==='greater'?price>=alert.price:alert.condition==='less'?price<=alert.price:Number.isFinite(previous)&&previous!==price&&((previous<alert.price&&price>=alert.price)||(previous>alert.price&&price<=alert.price));}
};
class AlertChartControls{
  constructor(chart,ctx){
    this.chart=chart;Object.assign(this,ctx);this.buttons=new Map();this.removeButtons=new Map();
    this.layer=document.createElement('div');this.layer.className='alert-chart-controls';chart.container.appendChild(this.layer);
    window.addEventListener('blur',()=>this.cancel());
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.drag){e.preventDefault();this.cancel();}});
  }
  draw(ctx,rect){
    const chart=this.chart,width=rect.width-(chart.chart.priceScale('right').width()||65),height=chart.plotBottom,seen=new Set();
    if(this.drag&&(this.drag.symbol!==chart.symbol||this.drag.replay!==!!chart.replayMode||!this.getAlerts().some(a=>a.id===this.drag.id)))this.cancel(false);
    for(const a of this.getAlerts()){
      if(a.symbol!==chart.symbol)continue;
      const price=this.drag?.id===a.id?this.drag.price:a.price,y=chart.series.priceToCoordinate(price);seen.add(a.id);
      let button=this.buttons.get(a.id);
      if(!button){
        button=document.createElement('button');button.className='alert-chart-hit';button.type='button';button.dataset.id=a.id;
        button.onpointerdown=e=>this.start(e,a.id);button.onpointermove=e=>this.move(e);button.onpointerup=e=>this.end(e);
        button.onpointercancel=()=>this.cancel();button.onlostpointercapture=()=>{if(this.drag)this.cancel();};
        button.onclick=e=>{e.preventDefault();e.stopPropagation();};
        button.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.edit(a.id,chart);}};
        this.layer.appendChild(button);this.buttons.set(a.id,button);
        const remove=document.createElement('button');remove.className='alert-chart-remove';remove.type='button';remove.textContent='×';
        remove.title='Xóa cảnh báo';remove.setAttribute('aria-label',`Xóa alert ${a.symbol} ${a.price}`);
        remove.onpointerdown=e=>{e.preventDefault();e.stopPropagation();};
        remove.onclick=e=>{e.preventDefault();e.stopPropagation();this.remove(a.id);};
        this.layer.appendChild(remove);this.removeButtons.set(a.id,remove);
      }
      button.hidden=chart.appearance?.alertLines===false||(chart.appearance?.activeAlerts!==false&&a.triggered)||y===null||y<10||y>height-10;
      const remove=this.removeButtons.get(a.id);remove.hidden=button.hidden;
      if(button.hidden)continue;
      remove.setAttribute('aria-label',`Xóa alert ${a.symbol} ${price}`);
      Object.assign(remove.style,{left:Math.max(0,width-24)+'px',top:(y-11)+'px'});
      button.title='Kéo để đổi giá · Bấm để chỉnh alert';button.setAttribute('aria-label',`${a.symbol} alert ${price}${a.triggered?' · Triggered':''}`);
      button.style.pointerEvents=this.canDrag?.()===false?'none':'auto';
      Object.assign(button.style,{left:'0px',top:(y-7)+'px',width:width+'px',height:'14px'});
      ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
      const clr=a.triggered?'#d97706':((a.condition==='greater'?chart.appearance?.alertUpColor:a.condition==='less'?chart.appearance?.alertColor:'#2563eb')||'#2563eb');
      ctx.strokeStyle=clr;ctx.lineWidth=this.drag?.id===a.id?1.75:1.25;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();ctx.setLineDash([]);
      const symArrow=a.condition==='greater'?'↗':a.condition==='less'?'↘':'⇅';
      const priceTxt=Number(price).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
      const pillTxt=`${symArrow} ${priceTxt}${a.triggered?' · Khớp':''}`;
      ctx.font='600 10.5px "JetBrains Mono", monospace';
      const tw=ctx.measureText?ctx.measureText(pillTxt).width:pillTxt.length*6.2;
      const pw=tw+14,ph=18,px=Math.max(8,width-pw-28),py=y-ph/2;
      ctx.fillStyle=clr;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(px,py,pw,ph,5);ctx.fill();}
      else ctx.fillRect(px,py,pw,ph);
      ctx.fillStyle='#ffffff';ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillText(pillTxt,px+7,y+0.5);
      ctx.restore();
    }
    for(const [id,button]of this.buttons)if(!seen.has(id)){button.remove();this.buttons.delete(id);this.removeButtons.get(id)?.remove();this.removeButtons.delete(id);}
  }
  start(e,id){
    if(e.button!==0||this.canDrag?.()===false)return;e.preventDefault();e.stopPropagation();
    const a=this.getAlerts().find(a=>a.id===id);if(!a)return;
    this.drag={id,symbol:a.symbol,original:a.price,price:a.price,startY:e.clientY,button:e.currentTarget,pointer:e.pointerId,replay:!!this.chart.replayMode};
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  move(e){
    if(!this.drag)return;e.preventDefault();e.stopPropagation();
    const rect=this.chart.container.getBoundingClientRect(),y=e.clientY-rect.top;
    if(y<0||y>=this.chart.plotBottom)return;
    const price=this.chart.coordinateToPrice(y);if(!Number.isFinite(price))return;
    this.drag.price=AlertPrice.round(price,this.chart.metadata.tickSize||.01);this.drag.changed ||= Math.abs(e.clientY-this.drag.startY)>3;this.chart.renderDrawings();
  }
  end(e){
    if(!this.drag)return;e.preventDefault();e.stopPropagation();const drag=this.drag;
    this.cancel(false);
    if(drag.symbol===this.chart.symbol&&drag.replay===!!this.chart.replayMode){
      if(drag.changed)this.update(drag.id,drag.price,drag.original);else this.edit(drag.id,this.chart);
    }
    this.chart.renderDrawings();
  }
  cancel(render=true){const d=this.drag;this.drag=null;if(d?.button.hasPointerCapture(d.pointer))d.button.releasePointerCapture(d.pointer);if(render&&d)this.chart.renderDrawings();}
}
if(typeof module!=='undefined')module.exports=AlertPrice;
