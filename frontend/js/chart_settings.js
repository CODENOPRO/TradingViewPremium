/* Chart appearance only. Exchange sessions and indicator calculation clocks stay separate. */
const ChartAppearance = {
  desktopProfile(previous,legacy,symbol) {
    const settings={...this.defaults(legacy),...previous};
    if(settings.desktopVersion===1)return settings;
    // Only replace the old application's defaults; keep deliberately customized values.
    const reference={previousClose:[false,true],titleMode:['Ticker','Name'],chartValues:[true,false],barChange:[true,false],verticalGrid:[true,false],horizontalGrid:[true,false],bottomMargin:[15,8],rightMargin:[12,10],hourFormat:['24-hours','12-hours'],textColor:['#202020','#000000'],borderUp:['#211f1d','#000000'],borderDown:['#211f1d','#000000'],wickUp:['#211f1d','#000000'],wickDown:['#211f1d','#000000'],crosshair:['#434651','#000000'],scaleLines:['#a8a194','#000000']};
    if(symbol==='NQ1!')reference.bodyDown=['#211f1d','#5e6977'];
    for(const [key,[old,value]] of Object.entries(reference))if(settings[key]===old)settings[key]=value;
    settings.desktopVersion=1;return settings;
  },
  defaults(colors={}) {
    return {bg:'#c2baae',grid:'#a8a194',bodyUp:'#e8e4dc',bodyDown:'#211f1d',borderUp:'#211f1d',borderDown:'#211f1d',wickUp:'#211f1d',wickDown:'#211f1d',textColor:'#202020',...colors,
      body:true,borders:true,wick:true,previousClose:false,precision:'Default',timezone:'America/New_York',
      logo:true,title:true,titleMode:'Ticker',marketStatus:false,chartValues:true,barChange:true,volume:false,buySell:true,indicatorTitles:true,legendBackground:false,legendOpacity:50,
      noOverlap:true,symbolLine:'Value and line',symbolLineColor:'#211f1d',symbolLineStyle:2,indicatorValues:'Hidden',highLow:'Hidden',highColor:'#089981',lowColor:'#f23645',countdown:false,
      dayOfWeek:false,dateFormat:'dd MMM yy',hourFormat:'24-hours',keepLeft:false,
      backgroundMode:'Solid',bgBottom:colors.bg||'#c2baae',verticalGrid:true,horizontalGrid:true,verticalGridColor:colors.grid||'#a8a194',horizontalGridColor:colors.grid||'#a8a194',verticalGridStyle:1,horizontalGridStyle:1,
      separator:'#655f58',crosshair:'#434651',crosshairStyle:2,watermark:'Hidden',watermarkColor:'#696159',fontSize:12,scaleLines:'#a8a194',navigation:'Visible on mouse over',paneButtons:'Visible on mouse over',topMargin:10,bottomMargin:15,rightMargin:12,
      oneClick:true,positions:true,pnl:true,pnlUnit:'Money',extendedLines:true,alignment:'Left',alertLines:true,alertColor:'#f23645',activeAlerts:true,hideToasts:true,sessionBreaks:false,sessionColor:'#2962ff',sessionStyle:2};
  },
  candleData(engine,bars) {
    const s=engine.appearance;if(!s)return bars;
    let previous;
    return bars.map(b=>{const up=b.close>=(s.previousClose?(previous??b.open):b.open);previous=b.close;return {...b,
      color:s.body?(engine.indicatorCandleColors?.get(b.time)||(up?s.bodyUp:s.bodyDown)):'transparent',
      borderColor:s.borders?(up?s.borderUp:s.borderDown):'transparent',wickColor:s.wick?(up?s.wickUp:s.wickDown):'transparent'};});
  },
  formatters(s) {
    const dateOptions=s.dateFormat==='yyyy-MM-dd'?{year:'numeric',month:'2-digit',day:'2-digit'}:{year:'2-digit',month:'short',day:'2-digit'};
    if(s.dayOfWeek)dateOptions.weekday='short';
    const date=new Intl.DateTimeFormat('en-GB',{timeZone:s.timezone,...dateOptions});
    const clock=new Intl.DateTimeFormat('en-US',{timeZone:s.timezone,hour:'2-digit',minute:'2-digit',hour12:s.hourFormat==='12-hours'});
    const tick=t=>{const d=new Date(t*1000);if(s.dateFormat!=='yyyy-MM-dd')return date.format(d);const p=Object.fromEntries(date.formatToParts(d).map(p=>[p.type,p.value]));return (s.dayOfWeek?p.weekday+' ':'')+`${p.year}-${p.month}-${p.day}`;};
    return {tick,clock:t=>clock.format(new Date(t*1000)),full:t=>tick(t)+' '+clock.format(new Date(t*1000))};
  },
  validate(s) {
    if(!s||typeof s!=='object'||Array.isArray(s))throw Error('Invalid chart settings');
    for(const key of ['topMargin','bottomMargin'])if(!Number.isFinite(s[key])||s[key]<0||s[key]>80)throw Error('Margins must be between 0 and 80%.');
    if(s.topMargin+s.bottomMargin>=95)throw Error('Top and bottom margins must total less than 95%.');
    if(!Number.isFinite(s.rightMargin)||s.rightMargin<0||s.rightMargin>500)throw Error('Right margin must be between 0 and 500 bars.');
    if(!Number.isFinite(s.fontSize)||s.fontSize<8||s.fontSize>24)throw Error('Text size must be between 8 and 24.');
    this.formatters(s);return s;
  },
  apply(engine,settings) {
    const s=this.validate(settings),before=engine.appearance;engine.appearance={...s};engine.config={...engine.config,...s};
    const f=this.formatters(s),hasLine=s.symbolLine.toLowerCase().includes('line'),hasValue=s.symbolLine.toLowerCase().includes('value');
    engine.chart.applyOptions({layout:{background:s.backgroundMode==='Gradient'?{type:'gradient',topColor:s.bg,bottomColor:s.bgBottom}:{type:'solid',color:s.bg},textColor:s.textColor,fontSize:s.fontSize},
      localization:{timeFormatter:t=>f.full(t)},grid:{vertLines:{visible:s.verticalGrid,color:s.verticalGridColor,style:s.verticalGridStyle},horzLines:{visible:s.horizontalGrid,color:s.horizontalGridColor,style:s.horizontalGridStyle}},
      crosshair:{vertLine:{color:s.crosshair,style:s.crosshairStyle},horzLine:{color:s.crosshair,style:s.crosshairStyle}},
      rightPriceScale:{borderColor:s.scaleLines,entireTextOnly:s.noOverlap,alignLabels:s.noOverlap,scaleMargins:{top:s.topMargin/100,bottom:s.bottomMargin/100}},
      timeScale:{borderColor:s.scaleLines,tickMarkFormatter:t=>typeof t==='number'?(engine.tfSeconds>=86400?f.tick(t):f.clock(t)):''}});
    if(!before||before.rightMargin!==s.rightMargin)engine.chart.timeScale().applyOptions({rightOffset:s.rightMargin});
    engine.series.applyOptions({upColor:s.body?s.bodyUp:'transparent',downColor:s.body?s.bodyDown:'transparent',borderVisible:s.borders,wickVisible:s.wick,borderUpColor:s.borderUp,borderDownColor:s.borderDown,wickUpColor:s.wickUp,wickDownColor:s.wickDown,
      priceLineVisible:hasLine,lastValueVisible:hasValue,priceLineColor:s.symbolLineColor,priceLineStyle:s.symbolLineStyle,
      priceFormat:{type:'price',precision:s.precision==='Default'?2:Number(s.precision),minMove:s.precision==='Default'?(engine.metadata?.tickSize||.01):10**-Number(s.precision)}});
    engine.series.setData(this.candleData(engine,engine.bars));
    engine.customSeries.forEach(series=>series.applyOptions({lastValueVisible:s.indicatorValues==='Value'}));
    engine.container.style.setProperty('--chart-text',s.textColor);engine.container.style.setProperty('--pane-background',s.bg);engine.container.style.setProperty('--pane-separator',s.separator);engine.container.style.background=s.bg;
    engine.container.dataset.navigation=s.navigation;engine.container.dataset.paneButtons=s.paneButtons;engine.container.dataset.indicatorTitles=String(s.indicatorTitles);
    engine.container.style.setProperty('--legend-background',s.legendBackground?`rgb(41 41 41 / ${s.legendOpacity}%)`:'transparent');
    if(engine.nativeCycle)engine.chart.applyOptions({layout:{panes:{separatorColor:s.separator}}});
    engine.container.querySelector('.tv-trade-pill')?.toggleAttribute('hidden',!s.buySell);
    engine.updateLegend(engine.bars.at(-1));engine.updateCountdown?.();engine.renderDrawings();engine.renderIndicatorPane();
  },
  draw(engine,ctx,rect) {
    const s=engine.appearance;if(!s)return;
    const width=rect.width-65,height=engine.plotHeight-26;ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
    if(s.watermark!=='Hidden'){ctx.fillStyle=s.watermarkColor;ctx.globalAlpha=.22;ctx.font=`600 ${Math.min(60,width/8)}px Arial`;ctx.textAlign='center';ctx.fillText(s.watermark==='Ticker'?engine.symbol:(engine.metadata.description||engine.symbol),width/2,height/2);ctx.globalAlpha=1;ctx.textAlign='left';}
    if(s.sessionBreaks&&engine.metadata?.timezone){let prior;ctx.strokeStyle=s.sessionColor;ctx.lineWidth=1;ctx.setLineDash(s.sessionStyle===0?[]:s.sessionStyle===1?[2,3]:[6,4]);for(const b of engine.bars){const bucket=MarketData.bucket(b.time,'D',engine.metadata);if(prior!==undefined&&bucket!==prior){const x=engine.chart.timeScale().timeToCoordinate(b.time);if(x!==null){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}}prior=bucket;}ctx.setLineDash([]);}
    for(const a of engine.priceAlerts||[])if(s.alertLines&&(!s.activeAlerts||!a.triggered)){const y=engine.series.priceToCoordinate(a.price);if(y!==null){ctx.strokeStyle=s.alertColor;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=s.alertColor;ctx.font='11px Arial';ctx.fillText(`Alert ${a.price}`,Math.max(8,width-125),y-5);}}
    if(s.highLow!=='Hidden'&&engine.bars.length){const range=engine.chart.timeScale().getVisibleLogicalRange();const bars=range?engine.bars.slice(Math.max(0,Math.floor(range.from)),Math.ceil(range.to)+1):engine.bars;if(bars.length)for(const [label,price,color] of [['High',Math.max(...bars.map(b=>b.high)),s.highColor],['Low',Math.min(...bars.map(b=>b.low)),s.lowColor]]){const y=engine.series.priceToCoordinate(price);if(y!==null){ctx.strokeStyle=color;ctx.fillStyle=color;ctx.font='11px Arial';if(s.highLow.includes('line')){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}ctx.fillText(`${label} ${price.toFixed(2)}`,Math.max(8,width-130),y-5);}}}
    ctx.restore();
  }
};

class ChartSettings {
  constructor(getChart,onCommit) {
    this.getChart=getChart;this.onCommit=onCommit;this.tab='Symbol';this.modal=document.getElementById('settings-modal');this.dialog=this.modal.querySelector('.chart-settings-dialog');
    this.nav=this.modal.querySelector('.chart-settings-nav');this.body=this.modal.querySelector('.chart-settings-body');this.error=this.modal.querySelector('.chart-settings-error');
    const icons=['M7 3v18m10-18v18M4 7h6v7H4zM14 10h6v7h-6z','M4 5h16M4 10h16M4 15h11M4 20h8','M4 3v17h17M7 15l5-5 5 4 4-8','M4 17L17 4l4 4L8 21H4z','M3 17l6-6 4 4 8-10M15 5h6v6','M12 8v5l3 2M5 4L2 7m17-3 3 3M4 13a8 8 0 1 0 16 0 8 8 0 1 0-16 0','M4 5h16v16H4zM8 2v6m8-6v6M4 11h16'];
    ['Symbol','Status line','Scales and lines','Canvas','Trading','Alerts','Events'].forEach((title,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','tab');b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[i]}"/></svg><span>${title}</span>`;b.onclick=()=>this.select(title);b.onkeydown=e=>{const keys=['ArrowDown','ArrowUp','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const buttons=[...this.nav.children],index=buttons.indexOf(b),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();};this.nav.appendChild(b);});
    this.modal.querySelector('#close-settings').onclick=()=>this.cancel();this.modal.querySelector('#cancel-settings').onclick=()=>this.cancel();this.modal.querySelector('#save-settings').onclick=()=>this.commit();
    this.modal.addEventListener('click',e=>{if(e.target===this.modal)this.cancel();});
    this.modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopImmediatePropagation();if(this.palette){this.palette.remove();this.palette=null;}else this.cancel();}if(e.key==='Tab'){const focusable=[...this.modal.querySelectorAll('button,input,select,textarea')].filter(n=>!n.disabled&&n.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
    this.modal.querySelector('#chart-template').onchange=e=>{try{if(e.target.value==='reset')this.draft={...ChartAppearance.desktopProfile(null,{},this.chart.symbol),session:this.original.session};else if(e.target.value==='load'){const value=Workspace.read('terminal_chart_template_v1',null);if(value)this.draft={...this.draft,...value,session:this.original.session};}else if(e.target.value==='save')Workspace.write('terminal_chart_template_v1',ChartAppearance.validate(this.draft));this.select(this.tab);this.preview();}catch(error){this.error.textContent=error.message;}e.target.value='';};
  }
  open(){this.chart=this.getChart();this.opener=document.activeElement;this.original={...this.chart.appearance,session:this.chart.sessionMode};this.draft={...this.original};this.modal.classList.add('show');this.select(this.tab);this.nav.querySelector('[aria-selected="true"]').focus();}
  close(){this.palette?.remove();this.palette=null;this.modal.classList.remove('show');this.opener?.focus();}
  cancel(){if(this.original){ChartAppearance.apply(this.chart,this.original);this.chart.container.querySelector('.tv-trade-pill')?.toggleAttribute('hidden',!this.original.buySell);}this.close();}
  commit(){try{ChartAppearance.validate(this.draft);if(this.onCommit(this.chart,{...this.draft})!==false)this.close();}catch(e){this.error.textContent=e.message;}}
  preview(){try{ChartAppearance.apply(this.chart,this.draft);this.chart.container.querySelector('.tv-trade-pill')?.toggleAttribute('hidden',!this.draft.buySell);this.error.textContent='';}catch(e){this.error.textContent=e.message;}}
  group(title){const h=document.createElement('h3');h.textContent=title;this.body.appendChild(h);}
  row(label,key,type='check',extra={}) {
    const row=document.createElement('div');row.className='chart-setting-row';const labelEl=document.createElement('label');labelEl.textContent=label;row.appendChild(labelEl);const controls=document.createElement('div');controls.className='chart-setting-controls';row.appendChild(controls);
    const id='chart-set-'+key;let input;
    if(type==='color'){input=this.color(key,label);controls.appendChild(input);}
    else{input=document.createElement(type==='select'?'select':'input');input.id=id;labelEl.htmlFor=id;input.setAttribute('aria-label',label);input.dataset.setting=key;
      if(type==='select'){for(const value of extra.options||[]){const [val,text]=Array.isArray(value)?value:[value,value];input.add(new Option(text,val));}input.value=this.draft[key];}
      else{input.type=type==='check'?'checkbox':type; if(type==='check'){input.checked=!!this.draft[key];labelEl.prepend(input);row.classList.add('is-check');}else{input.value=this.draft[key]??'';if(extra.min!==undefined)input.min=extra.min;if(extra.max!==undefined)input.max=extra.max;}}
      if(type!=='check')controls.appendChild(input);
      input.oninput=()=>{this.draft[key]=type==='check'?input.checked:['number','range'].includes(type)?Number(input.value):input.value;this.preview();};
    }
    if(extra.disabled){input.disabled=true;row.classList.add('unimplemented');row.title=extra.disabled;const note=document.createElement('span');note.className='chart-unavailable-note';note.textContent='?';note.tabIndex=0;note.setAttribute('aria-label',extra.disabled);note.title=extra.disabled;labelEl.appendChild(note);}
    if(extra.colors)for(const key of extra.colors)controls.appendChild(this.color(key,`${label} ${key.toLowerCase().includes('down')?'down':'up'}`));
    if(extra.line){const style=document.createElement('select');style.setAttribute('aria-label',label+' line style');for(const [value,text] of [[0,'━━━━'],[1,'······'],[2,'┄┄┄┄']])style.add(new Option(text,value));style.value=this.draft[extra.line];style.onchange=()=>{this.draft[extra.line]=Number(style.value);this.preview();};controls.appendChild(style);style.className='chart-line-style';}
    if(extra.size){const size=document.createElement('select');size.setAttribute('aria-label','Text size');for(const n of [8,9,10,11,12,13,14,15,16,18,20,22,24])size.add(new Option(n,n));size.value=this.draft.fontSize;size.onchange=()=>{this.draft.fontSize=Number(size.value);this.preview();};size.style.width='100px';controls.appendChild(size);}
    if(extra.suffix){const suffix=document.createElement('span');suffix.textContent=extra.suffix;controls.appendChild(suffix);}
    this.body.appendChild(row);return row;
  }
  color(key,label){const b=document.createElement('button');b.type='button';b.className='chart-color';b.setAttribute('aria-label',label+' color');b.dataset.color=key;const swatch=document.createElement('span');swatch.style.background=this.draft[key]||'transparent';b.appendChild(swatch);b.onclick=()=>this.openPalette(b,key);return b;}
  openPalette(button,key){this.palette?.remove();const p=document.createElement('div');p.className='chart-color-palette';p.setAttribute('role','group');p.setAttribute('aria-label','Color palette');this.palette=p;
    const colors=['#ffffff','#e8e4dc','#c2baae','#b2b5be','#9598a1','#787b86','#5d606b','#434651','#2a2e39','#131722','#000000','#f23645','#ff9800','#ffeb3b','#4caf50','#089981','#00bcd4','#2962ff','#673ab7','#9c27b0','#e91e63'];
    const base=colors.slice(11);for(const blend of [.78,.58,.36,.14,-.12,-.32])for(const c of base){const rgb=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));colors.push('#'+rgb.map(v=>Math.round(blend>=0?v+(255-v)*blend:v*(1+blend)).toString(16).padStart(2,'0')).join(''));}
    for(const c of colors){const b=document.createElement('button');b.type='button';b.title=c;b.setAttribute('aria-label',c);b.style.background=c;b.onclick=()=>{this.draft[key]=c;button.firstChild.style.background=c;this.preview();p.remove();this.palette=null;button.focus();};p.appendChild(b);}
    const custom=document.createElement('input');custom.type='color';custom.value=/^#[0-9a-f]{6}$/i.test(this.draft[key])?this.draft[key]:'#2962ff';custom.setAttribute('aria-label','Custom color');custom.oninput=()=>{this.draft[key]=custom.value;button.firstChild.style.background=custom.value;this.preview();};p.appendChild(custom);
    const hex=document.createElement('input');hex.type='text';hex.value=this.draft[key];hex.setAttribute('aria-label','Hex color');hex.pattern='#[0-9a-fA-F]{6}';hex.onchange=()=>{if(/^#[0-9a-f]{6}$/i.test(hex.value)){this.draft[key]=hex.value;button.firstChild.style.background=hex.value;this.preview();}};p.appendChild(hex);
    const close=document.createElement('button');close.type='button';close.textContent='Done';close.onclick=()=>{p.remove();this.palette=null;button.focus();};p.appendChild(close);this.modal.appendChild(p);const r=button.getBoundingClientRect();p.style.left=Math.max(8,Math.min(innerWidth-254,r.left))+'px';p.style.top=Math.max(8,Math.min(innerHeight-300,r.bottom+6))+'px';custom.focus();
  }
  select(tab) {
    this.tab=tab;this.palette?.remove();this.palette=null;this.body.replaceChildren();this.body.scrollTop=0;this.error.textContent='';
    [...this.nav.children].forEach(b=>b.setAttribute('aria-selected',String(b.textContent===tab)));this.body.setAttribute('aria-label',tab);const r=(...a)=>this.row(...a),g=t=>this.group(t);const unavailable='Chưa có trong engine hiện tại';
    if(tab==='Symbol'){
      g('CANDLES');
      r('Color bars based on previous close','previousClose');
      r('Body','body','check',{colors:['bodyUp','bodyDown']});
      r('Borders','borders','check',{colors:['borderUp','borderDown']});
      r('Wick','wick','check',{colors:['wickUp','wickDown']});
      g('DATA MODIFICATION');
      r('Session','session','select',{options:[['ETH','Electronic trading hours'],['RTH','Regular trading hours']]});
      r('Electronic trading hours background','ethBackground','color',{disabled:'Chưa có lớp tô nền ETH riêng'});
      r('Adjust for contract changes','backAdjust','check',{disabled:'Nguồn hiện tại đã xử lý B-ADJ; chưa có raw contract để chuyển lại'});
      r('Precision','precision','select',{options:['Default','0','1','2','3','4','5','6','7','8']});
      r('Timezone','timezone','select',{options:[['America/New_York','New York'],['America/Chicago','Chicago'],['Etc/UTC','UTC'],['Asia/Ho_Chi_Minh','Ho Chi Minh'],['Europe/London','London'],['Asia/Tokyo','Tokyo']]});
    }else if(tab==='Status line'){
      const note=document.createElement('p');note.className='desktop-panel-note';note.textContent='Tên mã/OHLC và BUY/SELL đã ẩn. Biểu tượng mã nằm ở góc dưới chart.';this.body.appendChild(note);
      g('INDICATORS');
      r('Titles','indicatorTitles');
      r('Inputs','indicatorInputs','check',{disabled:'Chưa có formatter rút gọn input theo từng script'});
      r('Values','statusIndicatorValues','check',{disabled:'Chưa có series values trong legend'});
      r('Background','legendBackground');
      r('Opacity','legendOpacity','range',{min:0,max:100,suffix:'%'});
    }else if(tab==='Scales and lines'){
      g('PRICE SCALE');
      r('Currency and Unit','currencyUnit','select',{options:['Visible on mouse over','Always visible','Hidden'],disabled:'Chưa có currency/unit header'});
      r('Scale modes (A and L)','scaleModes','select',{options:['Visible on mouse over','Always visible','Hidden'],disabled:'Nút mode hiện ở thanh dưới'});
      r('Lock price to bar ratio','priceRatio','check',{disabled:unavailable});
      r('Scales placement','scalePlacement','select',{options:['Auto','Right','Left'],disabled:'Bộ vẽ hiện neo vào thang bên phải'});
      g('PRICE LABELS & LINES');
      r('No overlapping labels','noOverlap');
      r('Plus button','plusButton','check',{disabled:'Chưa có menu đặt alert/lệnh tại con trỏ'});
      r('Countdown to bar close','countdown');
      r('Symbol','symbolLine','select',{options:['Value and line','Value','Line','Hidden'],colors:['symbolLineColor'],line:'symbolLineStyle'});
      r('Previous day close','prevDayLine','select',{options:['Hidden','Value','Line','Value and line'],disabled:'Chưa có previous settlement được xác minh'});
      r('Indicators and financials','indicatorValues','select',{options:['Value','Hidden']});
      r('High and low','highLow','select',{options:['Hidden','Value','Value and line'],colors:['highColor','lowColor']});
      r('Bid and ask','bidAsk','select',{options:['Hidden','Value','Line','Value and line'],disabled:'Bridge chỉ cấp last trade; không giả lập bid/ask'});
      g('TIME SCALE');
      r('Day of week on labels','dayOfWeek');
      r('Date format','dateFormat','select',{options:['dd MMM yy','yyyy-MM-dd']});
      r('Time hours format','hourFormat','select',{options:['12-hours','24-hours']});
      r('Save chart left edge position when changing interval','keepLeft');
    }else if(tab==='Canvas'){
      g('CHART BASIC STYLES');
      r('Background','backgroundMode','select',{options:['Solid','Gradient'],colors:['bg']});if(this.draft.backgroundMode==='Gradient')r('Bottom background','bgBottom','color');
      r('Vertical grid lines','verticalGrid','check',{colors:['verticalGridColor'],line:'verticalGridStyle'});
      r('Horizontal grid lines','horizontalGrid','check',{colors:['horizontalGridColor'],line:'horizontalGridStyle'});
      r('Pane separators','separator','color');
      r('Crosshair','crosshair','color',{line:'crosshairStyle'});
      r('Watermark','watermark','select',{options:['Hidden','Ticker','Name'],colors:['watermarkColor']});
      g('SCALES');
      r('Text','textColor','color',{size:true});
      r('Lines','scaleLines','color');
      g('BUTTONS');for(const [label,key] of [['Navigation','navigation'],['Pane','paneButtons']])r(label,key,'select',{options:['Visible on mouse over','Always visible','Hidden']});
      g('MARGINS');
      r('Top','topMargin','number',{min:0,max:80,suffix:'%'});
      r('Bottom','bottomMargin','number',{min:0,max:80,suffix:'%'});
      r('Right','rightMargin','number',{min:0,max:500,suffix:'bars'});
    }else if(tab==='Trading'){
      g('GENERAL');
      r('One-click trading','oneClick','check',{disabled:'Hiện luôn đặt lệnh mô phỏng một lần bấm; chưa có chế độ xác nhận'});
      r('Multiple exit levels','multipleExits','check',{disabled:'Ledger hiện hỗ trợ một SL và một TP cho mỗi vị thế'});
      r('Execution sound','executionSound','check',{disabled:'Chưa có bộ âm thanh khớp lệnh'});
      r('Show only rejection notifications','rejectionOnly','check',{disabled:'Chưa có bộ lọc thông báo giao dịch'});
      g('APPEARANCE');
      r('Positions and orders','positions');
      r('Reverse position button','reversePosition','check',{disabled:'Chưa có thao tác đảo vị thế'});
      r('Project order for market orders','projectOrder','check',{disabled:'Chưa có order preview'});
      r('Profit and loss value','pnl');
      r('Positions','pnlUnit','select',{options:['Money','Ticks','Percentage']});
      r('Brackets','bracketValue','select',{options:['Money','Ticks','Percentage'],disabled:'SL/TP hiện chưa có badge riêng'});
      r('Execution marks','executionMarks','check',{disabled:'Chưa có lớp execution history trên chart'});
      r('Execution labels','executionLabels','check',{disabled:'Chưa có lớp execution history trên chart'});
      r('Extended price lines across the entire chart width','extendedLines');
      r('Order and position alignment','alignment','select',{options:['Left','Right']});
      r('Orders, executions, and positions in chart snapshots','snapshotOrders','check',{disabled:'Chưa có chức năng chart snapshot'});
    }else if(tab==='Alerts'){
      g('CHART LINE VISIBILITY');
      r('Alert lines','alertLines','check',{colors:['alertColor']});
      r('Only active alerts','activeAlerts');
      g('NOTIFICATIONS');
      r('Automatically hide toasts','hideToasts');
    }else{
      g('EVENTS');
      r('Ideas','ideas','check',{disabled:'Chưa kết nối dữ liệu Ideas'});
      r('Session breaks','sessionBreaks','check',{colors:['sessionColor'],line:'sessionStyle'});
      r('Continuous contract switch','contractSwitch','check',{disabled:'Bridge chưa có lịch rollover'});
      r('Contract switch breaks','contractBreaks','check',{disabled:'Bridge chưa có lịch rollover'});
      r('Latest news','news','check',{disabled:'Chưa kết nối nguồn tin'});
      r('News notification','newsNotification','check',{disabled:'Chưa kết nối nguồn tin'});
    }
    this.body.querySelectorAll('select').forEach(el=>{if(el.value==='')el.selectedIndex=0;});
    this.body.querySelectorAll('select').forEach(el=>el.addEventListener('change',()=>{if(el.dataset.setting==='backgroundMode')this.select(tab);}));
  }
}
if(typeof module!=='undefined')module.exports={ChartAppearance,ChartSettings};
