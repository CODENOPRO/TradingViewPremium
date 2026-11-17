/* Chart appearance only. Exchange sessions and indicator calculation clocks stay separate. */
const ChartAppearance = {
  desktopProfile(previous,legacy,symbol) {
    const settings={...this.defaults(legacy),...previous};
    if(settings.desktopVersion>=1)return settings;
    // Only replace the old application's defaults; keep deliberately customized values.
    const reference={previousClose:[false,true],titleMode:['Ticker','Name'],chartValues:[true,false],barChange:[true,false],verticalGrid:[true,false],horizontalGrid:[true,false],bottomMargin:[15,8],rightMargin:[12,10],hourFormat:['24-hours','12-hours'],textColor:['#202020','#000000'],borderUp:['#211f1d','#000000'],borderDown:['#211f1d','#000000'],wickUp:['#211f1d','#000000'],wickDown:['#211f1d','#000000'],crosshair:['#434651','#000000'],scaleLines:['#a8a194','#000000']};
    if(symbol==='NQ1!')reference.bodyDown=['#211f1d','#5e6977'];
    for(const [key,[old,value]] of Object.entries(reference))if(settings[key]===old)settings[key]=value;
    settings.desktopVersion=1;return settings;
  },
  defaults(colors={}) {
    return {bg:'#c2baae',grid:'#a8a194',bodyUp:'#e8e4dc',bodyDown:'#211f1d',borderUp:'#211f1d',borderDown:'#211f1d',wickUp:'#211f1d',wickDown:'#211f1d',textColor:'#202020',...colors,
      body:true,borders:true,wick:true,previousClose:false,precision:'Default',timezone:'America/New_York',
      sessionMode:'ETH',ethBackground:'transparent',lastDayChange:false,logo:true,title:false,titleMode:'Ticker',marketStatus:false,chartValues:false,barChange:false,volume:false,buySell:true,indicatorTitles:true,indicatorInputs:false,statusIndicatorValues:false,legendBackground:false,legendOpacity:50,
      priceRatio:false,priceUnitsPerBar:1,symbolValueMode:'Value according to scale',alertUpColor:'#089981',currencyUnit:'Hidden',scaleModes:'Hidden',plusButton:false,extendedZoom:false,prevDayLine:'Hidden',prevDayColor:'#787b86',prevDayStyle:2,highLowStyle:0,bidColor:'#2962ff',askColor:'#f23645',noOverlap:true,symbolLine:'Value and line',symbolLineColor:'#211f1d',symbolLineStyle:2,indicatorValues:'Hidden',highLow:'Hidden',highColor:'#089981',lowColor:'#f23645',countdown:false,
      dayOfWeek:false,dateFormat:'dd MMM yy',hourFormat:'24-hours',keepLeft:false,
      backgroundMode:'Solid',bgBottom:colors.bg||'#c2baae',verticalGrid:true,horizontalGrid:true,verticalGridColor:colors.grid||'#a8a194',horizontalGridColor:colors.grid||'#a8a194',verticalGridStyle:1,horizontalGridStyle:1,
      separator:'#655f58',crosshair:'#434651',crosshairStyle:2,watermark:'Hidden',watermarkColor:'#696159',fontSize:10,scaleLines:'#a8a194',navigation:'Visible on mouse over',paneButtons:'Visible on mouse over',topMargin:10,bottomMargin:15,rightMargin:12,
      oneClick:true,executionSound:false,executionVolume:60,executionTone:'3 Notes Reverb',rejectionOnly:false,reversePosition:false,projectOrder:false,positions:true,pnl:true,positionPnl:true,bracketPnl:false,pnlUnit:'Money',bracketValue:'Money',executionMarks:false,executionLabels:true,snapshotOrders:true,extendedLines:true,alignment:'Right',alertLines:true,alertColor:'#f23645',activeAlerts:true,hideToasts:true,sessionBreaks:false,sessionColor:'#2962ff',sessionStyle:2};
  },
  candleData(engine,bars) {
    const s=engine.appearance;if(!s)return bars;
    let previous;
    return bars.map(b=>{const up=b.close>=(s.previousClose?(previous??b.open):b.open);previous=b.close;return {...b,
      color:s.body?(engine.indicatorCandleColors?.get(b.time)||(up?s.bodyUp:s.bodyDown)):'transparent',
      borderColor:s.borders?(up?s.borderUp:s.borderDown):'transparent',wickColor:s.wick?(up?s.wickUp:s.wickDown):'transparent'};});
  },
  formatters(s) {
    const dateOptions=s.dateFormat!=='dd MMM yy'?{year:'numeric',month:'2-digit',day:'2-digit'}:{year:'2-digit',month:'short',day:'2-digit'};
    if(s.dayOfWeek)dateOptions.weekday='short';
    const date=new Intl.DateTimeFormat('en-GB',{timeZone:s.timezone,...dateOptions});
    const clock=new Intl.DateTimeFormat('en-US',{timeZone:s.timezone,hour:'2-digit',minute:'2-digit',hour12:s.hourFormat==='12-hours'});
    const tick=t=>{const d=new Date(t*1000);if(s.dateFormat==='dd MMM yy')return date.format(d);const p=Object.fromEntries(date.formatToParts(d).map(p=>[p.type,p.value]));return (s.dayOfWeek?p.weekday+' ':'')+(s.dateFormat==='dd-MM-yyyy'?[p.day,p.month,p.year]:[p.year,p.month,p.day]).join('-');};
    return {tick,clock:t=>clock.format(new Date(t*1000)),full:t=>tick(t)+' '+clock.format(new Date(t*1000))};
  },
  validate(s) {
    if(!s||typeof s!=='object'||Array.isArray(s))throw Error('Invalid chart settings');
    for(const key of ['topMargin','bottomMargin'])if(!Number.isFinite(s[key])||s[key]<0||s[key]>80)throw Error('Margins must be between 0 and 80%.');
    if(s.topMargin+s.bottomMargin>=95)throw Error('Top and bottom margins must total less than 95%.');
    if(!Number.isFinite(s.rightMargin)||s.rightMargin<0||s.rightMargin>500)throw Error('Right margin must be between 0 and 500 bars.');
    if(!Number.isFinite(s.fontSize)||s.fontSize<8||s.fontSize>24)throw Error('Text size must be between 8 and 24.');
    if(s.priceRatio&&(!Number.isFinite(s.priceUnitsPerBar)||s.priceUnitsPerBar<=0))throw Error('Price units per bar must be positive.');
    this.formatters(s);return s;
  },
  apply(engine,settings) {
    const s=this.validate(settings),before=engine.appearance;engine.appearance={...s};engine.config={...engine.config,...s};
    const f=this.formatters(s),hasLine=s.symbolLine.toLowerCase().includes('line'),hasValue=s.symbolLine.toLowerCase().includes('value');
    const customPriceLabel=s.countdown||s.symbolValueMode==='Raw price'||s.symbolLine.toLowerCase().includes('name');
    engine.chart.applyOptions({layout:{background:s.backgroundMode==='Gradient'?{type:'gradient',topColor:s.bg,bottomColor:s.bgBottom}:{type:'solid',color:s.bg},textColor:s.textColor,fontSize:s.fontSize},
      handleScale:{axisPressedMouseMove:{price:!s.priceRatio}},
      localization:{timeFormatter:t=>f.full(t)},grid:{vertLines:{visible:s.verticalGrid,color:s.verticalGridColor,style:s.verticalGridStyle},horzLines:{visible:s.horizontalGrid,color:s.horizontalGridColor,style:s.horizontalGridStyle}},
      crosshair:{vertLine:{color:s.crosshair,style:s.crosshairStyle},horzLine:{color:s.crosshair,style:s.crosshairStyle}},
      rightPriceScale:{borderColor:s.scaleLines,entireTextOnly:s.noOverlap,alignLabels:s.noOverlap,scaleMargins:{top:s.topMargin/100,bottom:s.bottomMargin/100}},
      timeScale:{borderColor:s.scaleLines,tickMarkFormatter:t=>typeof t==='number'?(engine.tfSeconds>=86400?f.tick(t):f.clock(t)):''}});
    const timeScaleOptions={};
    if(!before||before.extendedZoom!==s.extendedZoom)timeScaleOptions.minBarSpacing=s.extendedZoom?.1:.5;
    if(!before||before.rightMargin!==s.rightMargin)timeScaleOptions.rightOffset=s.rightMargin;
    if(Object.keys(timeScaleOptions).length)engine.chart.timeScale().applyOptions(timeScaleOptions);
    engine.series.applyOptions({upColor:s.body?s.bodyUp:'transparent',downColor:s.body?s.bodyDown:'transparent',borderVisible:s.borders,wickVisible:s.wick,borderUpColor:s.borderUp,borderDownColor:s.borderDown,wickUpColor:s.wickUp,wickDownColor:s.wickDown,
      priceLineVisible:hasLine,lastValueVisible:hasValue&&!customPriceLabel,priceLineColor:s.symbolLineColor,priceLineStyle:s.symbolLineStyle,
      priceFormat:{type:'price',precision:s.precision==='Default'?2:Number(s.precision),minMove:s.precision==='Default'?(engine.metadata?.tickSize||.01):10**-Number(s.precision)}});
    if(before && before.sessionMode!==s.sessionMode)engine.renderCurrentTimeframe(false);
    else engine.series.setData(this.candleData(engine,engine.bars));
    engine.updateSymbolBadge?.();
    engine.updateScaleControls?.();
    if(!before||before.priceRatio!==s.priceRatio||before.priceUnitsPerBar!==s.priceUnitsPerBar)engine.applyPriceRatio?.();
    engine.runner?.renderLegends?.();
    if(s.lastDayChange||s.prevDayLine!=='Hidden')engine.onPreviousDayDataRequired?.();
    engine.customSeries.forEach(series=>series.applyOptions({lastValueVisible:s.indicatorValues==='Value'}));
    engine.container.style.setProperty('--chart-text',s.textColor);engine.container.style.setProperty('--pane-background',s.bg);engine.container.style.setProperty('--pane-separator',s.separator);engine.container.style.background=s.bg;
    engine.container.dataset.navigation=s.navigation;engine.container.dataset.paneButtons=s.paneButtons;engine.container.dataset.indicatorTitles=String(s.indicatorTitles);
    engine.container.style.setProperty('--legend-background',s.legendBackground?`rgb(41 41 41 / ${s.legendOpacity}%)`:'transparent');
    if(engine.nativeCycle)engine.chart.applyOptions({layout:{panes:{separatorColor:s.separator}}});
    if (engine === window.currentActiveChart) {
      document.querySelector('#topbar .tv-trade-pill')?.toggleAttribute('hidden', !s.buySell);
    }
    engine.updateLegend(engine.bars.at(-1));engine.updateCountdown?.();engine.renderDrawings();engine.renderIndicatorPane();
  },
  draw(engine,ctx,rect) {
    const s=engine.appearance;if(!s)return;
    const width=rect.width-(engine.chart.priceScale('right').width()||65),height=engine.plotBottom;ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
    if(s.watermark!=='Hidden'){ctx.fillStyle=s.watermarkColor;ctx.globalAlpha=.22;ctx.font=`600 ${Math.min(60,width/8)}px Arial`;ctx.textAlign='center';ctx.fillText(s.watermark==='Ticker'?engine.symbol:(engine.metadata.description||engine.symbol),width/2,height/2);ctx.globalAlpha=1;ctx.textAlign='left';}
    if(s.sessionBreaks&&engine.metadata?.timezone){let prior;ctx.strokeStyle=s.sessionColor;ctx.lineWidth=1;ctx.setLineDash(s.sessionStyle===0?[]:s.sessionStyle===1?[2,3]:[6,4]);for(const b of engine.bars){const bucket=MarketData.bucket(b.time,'D',engine.metadata);if(prior!==undefined&&bucket!==prior){const x=engine.chart.timeScale().timeToCoordinate(b.time);if(x!==null){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}}prior=bucket;}ctx.setLineDash([]);}
    if(!engine.alertOverlay)for(const a of engine.priceAlerts||[])if(s.alertLines&&(!s.activeAlerts||!a.triggered)){const y=engine.series.priceToCoordinate(a.price);if(y!==null){ctx.strokeStyle=s.alertColor;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=s.alertColor;ctx.font='11px Arial';ctx.fillText(`Alert ${a.price}`,Math.max(8,width-125),y-5);}}
    const lastBar=engine.bars.at(-1);
    if(lastBar&&s.prevDayLine!=='Hidden'){
      const close=engine.previousDayClose?.(lastBar.time);
      const y=Number.isFinite(close)?engine.series.priceToCoordinate(close):null;
      if(y!==null){
        ctx.strokeStyle=s.prevDayColor;ctx.fillStyle=s.prevDayColor;
        if(s.prevDayLine.toLowerCase().includes('line')){
          ctx.setLineDash(s.prevDayStyle===0?[]:s.prevDayStyle===1?[2,3]:[6,4]);
          ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();ctx.setLineDash([]);
        }
        if(s.prevDayLine.toLowerCase().includes('value')){
          ctx.font='11px Arial';
          ctx.fillText('Previous close '+engine.series.priceFormatter().format(close),Math.max(8,width-145),y-5);
        }
      }
    }
    if(s.highLow!=='Hidden'&&engine.bars.length){const range=engine.chart.timeScale().getVisibleLogicalRange();const bars=range?engine.bars.slice(Math.max(0,Math.floor(range.from)),Math.ceil(range.to)+1):engine.bars;if(bars.length)for(const [label,price,color] of [['High',Math.max(...bars.map(b=>b.high)),s.highColor],['Low',Math.min(...bars.map(b=>b.low)),s.lowColor]]){const y=engine.series.priceToCoordinate(price);if(y!==null){ctx.strokeStyle=color;ctx.fillStyle=color;ctx.font='11px Arial';if(s.highLow.toLowerCase().includes('line')){ctx.setLineDash(s.highLowStyle===0?[]:s.highLowStyle===1?[2,3]:[6,4]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();ctx.setLineDash([]);}if(s.highLow.toLowerCase().includes('value'))ctx.fillText(`${label} ${price.toFixed(2)}`,Math.max(8,width-130),y-5);}}}
    ctx.restore();
  }
};

class ChartSettings {
  constructor(getChart,onCommit,onSoundPreview=()=>{},onThemeSelect=()=>{},onSoundUnlock=()=>{}) {
    this.getChart=getChart;this.onCommit=onCommit;this.onSoundPreview=onSoundPreview;this.onThemeSelect=onThemeSelect;this.onSoundUnlock=onSoundUnlock;this.tab='Symbol';this.modal=document.getElementById('settings-modal');this.dialog=this.modal.querySelector('.chart-settings-dialog');
    this.nav=this.modal.querySelector('.chart-settings-nav');this.body=this.modal.querySelector('.chart-settings-body');this.error=this.modal.querySelector('.chart-settings-error');
    const tabs = [
      ['Theme', '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="d" d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle class="dot" cx="7.6" cy="11.2" r="1.1"/><circle class="dot" cx="10.4" cy="7.4" r="1.1"/><circle class="dot" cx="15" cy="7.6" r="1.1"/></svg>'],
      ['Symbol', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v3m0 9v3m8-12v3m0 9v3"/><rect class="d" x="6" y="6" width="4" height="9" rx="1.2"/><rect x="14" y="9" width="4" height="9" rx="1.2"/></svg>'],
      ['Status line', '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="d" x="3" y="4" width="18" height="16" rx="4"/><path d="M7.5 9h3.5M14 9h2.5M7.5 13.5h9"/></svg>'],
      ['Scales and lines', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v16h16M8 20v-2m4 2v-2m4 2v-2"/><path d="M7.5 14l3.5-4 3 2.5 4.2-6"/><circle class="dot" cx="18.2" cy="6.5" r="1.3"/></svg>'],
      ['Canvas', '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="d" d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3M12.5 20H20"/></svg>'],
      ['Trading', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20V5m0 0L4.5 8.5M8 5l3.5 3.5M16 4v15m0 0l-3.5-3.5M16 19l3.5-3.5"/></svg>'],
      ['Alerts', '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="d" d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/></svg>'],
      ['Events', '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="d" x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M8 3.5v4m8-4v4M4 10.5h16"/><circle class="dot" cx="12" cy="15" r="1.4"/></svg>'],
      ['Language', '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="d" cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>'],
      ['Toolbars', '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="d" x="3" y="4" width="18" height="5" rx="1.6"/><rect x="3" y="12" width="7" height="8" rx="1.6"/><rect x="13" y="12" width="8" height="8" rx="1.6"/></svg>'],
    ];
    for (const [name, icon] of tabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tab = name;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-label', name);
      button.title = name;
      button.tabIndex = name === this.tab ? 0 : -1;
      button.setAttribute('aria-selected', String(name === this.tab));
      button.innerHTML = icon + '<span class="chart-tab-label"><span></span></span>';
      button.lastElementChild.firstElementChild.textContent = name;
      this.nav.appendChild(button);
    }
    TerminalLanguage.markup(this.nav);
    this.nav.addEventListener('click', event => {
      const target = event.target.closest('[role="tab"]');
      if (target) this.select(target.dataset.tab);
    });
    this.nav.addEventListener('keydown', event => {
      const current = event.target.closest('[role="tab"]');
      if (!current) return;
      const direction = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 };
      if (!Object.hasOwn(direction, event.key) && !['Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...this.nav.children];
      const index = buttons.indexOf(current);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + direction[event.key] + buttons.length) % buttons.length;
      buttons[next].focus({ preventScroll: true });
      this.select(buttons[next].dataset.tab);
    });
    const updateFade = () => this.updateTabFade();
    this.nav.addEventListener('scroll', updateFade, { passive: true });
    this.nav.addEventListener('transitionend', updateFade);
    new ResizeObserver(updateFade).observe(this.nav);
    this.nav.addEventListener('wheel', event => {
      const maxScroll = this.nav.scrollWidth - this.nav.clientWidth;
      if (event.ctrlKey || event.deltaX || !event.deltaY || maxScroll <= 0) return;

      const unit = event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? this.nav.clientWidth : 1;
      const left = this.nav.scrollLeft;
      const nextLeft = Math.max(0, Math.min(maxScroll, left + event.deltaY * unit));
      if (nextLeft === left || !event.cancelable) return;

      event.preventDefault();
      this.nav.scrollLeft = nextLeft;
    }, { passive: false });
    this.modal.querySelector('#close-settings').onclick=()=>this.cancel();this.modal.querySelector('#cancel-settings').onclick=()=>this.cancel();this.modal.querySelector('#save-settings').onclick=()=>this.commit();
    this.modal.querySelector('#reset-dock-settings').onclick=()=>{
      this.draft=ChartAppearance.desktopProfile(null,{},this.chart.symbol);
      this.select(this.tab);
      this.preview();
    };
    document.addEventListener('pointerdown',e=>{if(this.palette&&!this.palette.contains(e.target)&&!e.target.closest?.('.chart-color'))this.closePalette();},true);
    window.addEventListener('resize', () => this.positionPalette());
    this.body.addEventListener('scroll', () => this.positionPalette(), { passive: true });
    this.modal.inert=true;
    this.modal.addEventListener('click',event=>{if(event.target===this.modal)this.cancel();});
    this.modal.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        e.stopImmediatePropagation();
        if(!this.palette)this.cancel();
        else if(typeof ColorPicker==='undefined'||!ColorPicker.closeActiveSub(this.palette))this.closePalette();
      }
      if(e.key==='Tab'){
        const focusable=[...this.modal.querySelectorAll('button,input,select,textarea')].filter(n=>!n.disabled&&n.tabIndex>=0&&n.getClientRects().length);
        const first=focusable[0],last=focusable.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
    this.modal.querySelector('#chart-template').onclick=e=>{e.stopPropagation();this.openTemplateMenu(e.currentTarget);};
  }
  templateMenuOptions(chart,draftMode=true){
    if(typeof TemplateMenu==='undefined')return null;
    const applyDraft=data=>{try{this.draft={...this.draft,...structuredClone(data)};this.select(this.tab);this.preview();}catch(error){this.error.textContent=error.message;}};
    return {
      saveLabel:'Save as…',
      defaultLabel:'Apply defaults',
      onApplyAll:draftMode ? () => this.commit(true) : undefined,
      getItems:()=>TemplateMenu.listChartTemplates(Workspace,ChartAppearance,chart?.symbol),
      onSaveAs:()=>TemplateMenu.openSaveDialog({
        title:'Save chart template',
        opener:this.modal.querySelector('#chart-template'),
        onSave:name=>TemplateMenu.saveChartTemplate(Workspace,ChartAppearance,name,draftMode?this.draft:{...chart.appearance})
      }),
      onDefault:()=>{
        const def=ChartAppearance.desktopProfile(null,{},chart?.symbol);
        if(draftMode)applyDraft(def);else this.applyTemplate(chart,def,true);
      },
      onApply:item=>{if(draftMode)applyDraft(item.data);else this.applyTemplate(chart,item.data,false);},
      onDelete:item=>TemplateMenu.deleteChartTemplate(Workspace,item.name,item.legacy)
    };
  }
  openTemplateMenu(anchor){const opts=this.templateMenuOptions(this.chart,true);if(opts)TemplateMenu.openPopup({anchor,prefer:'above',...opts});}
  applyTemplate(chart,data,isDefault=false){
    const next=isDefault?{...ChartAppearance.desktopProfile(null,{},chart.symbol)}:{...chart.appearance,...structuredClone(data)};
    return this.onCommit(chart,next);
  }
  open(){
    this.chart=this.getChart();
    this.opener=document.activeElement;
    this.original={...this.chart.appearance};
    this.draft={...this.original};
    this.languageDraft=TerminalLanguage.language;
    this.modal.inert=false;
    this.modal.classList.add('show');
    const header=this.dialog.querySelector('.modal-header').getBoundingClientRect();
    const visibleWidth=Math.min(innerWidth,header.right)-Math.max(0,header.left);
    const visibleHeight=Math.min(innerHeight,header.bottom)-Math.max(0,header.top);
    if(this.dialog.style.position==='fixed'&&(visibleWidth<24||visibleHeight<16)){
      for(const property of ['position','margin','left','top'])this.dialog.style.removeProperty(property);
    }
    this.select(this.tab);
    this.nav.querySelector('[aria-selected="true"]').focus({preventScroll:true});
  }
  closePalette(){this.palette?.remove();this.palette=null;this.paletteTarget?.classList.remove('active');this.paletteTarget=null;}
  close(){clearTimeout(this.tabScrollTimer);this.closePalette();if(typeof TemplateMenu!=='undefined')TemplateMenu.closePopup();this.modal.classList.remove('show');this.modal.inert=true;this.opener?.focus();}
  cancel(){if(this.original){ChartAppearance.apply(this.chart,this.original);document.querySelector('#topbar .tv-trade-pill')?.toggleAttribute('hidden',!this.original.buySell);}this.close();}
  commit(applyAll=false){
    try{
      ChartAppearance.validate(this.draft);
      if(this.onCommit(this.chart,{...this.draft},applyAll)===false)return;
      if(this.languageDraft!==TerminalLanguage.language){
        if(!TerminalLanguage.save(this.languageDraft))throw Error(ui('Could not save the language preference.'));
        this.close();
        location.reload();
      }else this.close();
    }catch(e){this.error.textContent=ui(e.message);}
  }
  preview(){try{ChartAppearance.apply(this.chart,this.draft);document.querySelector('#topbar .tv-trade-pill')?.toggleAttribute('hidden',!this.draft.buySell);this.error.textContent='';}catch(e){this.error.textContent=e.message;}}
  group(title){
    const h=document.createElement('h3');
    h.textContent=title;
    this.card=document.createElement('div');
    this.card.className='chart-setting-card';
    this.body.append(h,this.card);
  }
  row(label,key,type='check',extra={}) {
    const row=document.createElement('div');row.className='chart-setting-row';const labelEl=document.createElement('label');labelEl.textContent=label;row.appendChild(labelEl);const controls=document.createElement('div');controls.className='chart-setting-controls';row.appendChild(controls);
    const id='chart-set-'+key;let input,readout;
    if(type==='color'){input=this.color(key,label);controls.appendChild(input);}
    else{input=document.createElement(type==='select'?'select':'input');input.id=id;labelEl.htmlFor=id;input.setAttribute('aria-label',label);input.dataset.setting=key;
      if(type==='select'){for(const value of extra.options||[]){const [val,text]=Array.isArray(value)?value:[value,value];input.add(new Option(text,val));}input.value=this.draft[key];}
      else{input.type=type==='check'?'checkbox':type; if(type==='check'){input.checked=!!this.draft[key];input.setAttribute('role','switch');labelEl.prepend(input);row.classList.add('is-check');}else{input.value=this.draft[key]??'';if(extra.min!==undefined)input.min=extra.min;if(extra.max!==undefined)input.max=extra.max;if(extra.step!==undefined)input.step=extra.step;}}
      if(type!=='check')controls.appendChild(input);
      input.oninput=()=>{
        this.draft[key]=type==='check'?input.checked:['number','range'].includes(type)?Number(input.value):input.value;
        if(readout){
          readout.textContent=input.value+extra.suffix;
          input.setAttribute('aria-valuetext',readout.textContent);
        }
        this.preview();
      };
    }
    if(extra.disabled&&input){input.disabled=true;row.classList.add('unimplemented');row.title=extra.disabled;const note=document.createElement('span');note.className='chart-unavailable-note';note.textContent='?';note.tabIndex=0;note.setAttribute('aria-label',extra.disabled);note.title=extra.disabled;labelEl.appendChild(note);}
    if(extra.colors){const chips=extra.colors.map(key=>this.color(key,extra.colors.length>1?`${label} ${key.toLowerCase().includes('down')?'down':'up'}`:label));if(chips.length>1){const pair=document.createElement('span');pair.className='chart-color-pair';pair.append(...chips);controls.appendChild(pair);}else controls.append(...chips);}
    if(extra.line){const style=document.createElement('select');style.setAttribute('aria-label',label+' line style');for(const [value,text] of [[0,'━━━━'],[1,'······'],[2,'┄┄┄┄']])style.add(new Option(text,value));style.value=this.draft[extra.line];style.onchange=()=>{this.draft[extra.line]=Number(style.value);this.preview();};controls.appendChild(style);style.className='chart-line-style';}
    if(extra.suffix){const suffix=document.createElement('span');suffix.textContent=extra.suffix;
      if(type==='range'){
        readout=suffix;
        readout.className='chart-range-value';
        readout.setAttribute('aria-hidden','true');
        readout.textContent=input.value+extra.suffix;
        input.setAttribute('aria-valuetext',readout.textContent);
      }
      controls.appendChild(suffix);}
    (this.card||this.body).appendChild(row);return row;
  }
  color(key,label){const b=document.createElement('button');b.type='button';b.className='chart-color';b.setAttribute('aria-label',label+' color');b.dataset.color=key;const swatch=document.createElement('span');swatch.style.background=this.draft[key]||'transparent';b.appendChild(swatch);b.onclick=()=>this.openPalette(b,key);return b;}
  openPalette(button,key){
    if(this.palette&&this.paletteTarget===button){this.closePalette();return;}
    this.closePalette();
    const p=document.createElement('div');p.className='tv-style-popover tv-chart-color-popover';p.setAttribute('role','dialog');p.setAttribute('aria-label','Color palette');
    this.palette=p;this.paletteTarget=button;button.classList.add('active');
    if(typeof ColorPicker!=='undefined'){
      ColorPicker.mount(p,{
        value:this.draft[key],
        showOpacity:true,
        onChange:({css})=>{
          this.draft[key]=css;
          button.firstChild.style.background=css;
          this.preview();
        }
      });
    }
    this.modal.appendChild(p);
    this.positionPalette();
  }
  positionPalette() {
    if (!this.palette || !this.paletteTarget) return;
    const anchor = this.paletteTarget.getBoundingClientRect();
    const { width, height } = this.palette.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchor.right - width, innerWidth - width - 8));
    const below = anchor.bottom + 6;
    const above = anchor.top - height - 6;
    const preferredTop = below + height <= innerHeight - 8 ? below : above;
    const top = Math.max(8, Math.min(preferredTop, innerHeight - height - 8));
    this.palette.style.left = left + 'px';
    this.palette.style.top = top + 'px';
  }
  updateTabFade() {
    const max = this.nav.scrollWidth - this.nav.clientWidth;
    this.nav.style.setProperty('--fl', this.nav.scrollLeft > 2 ? '24px' : '0px');
    this.nav.style.setProperty('--fr', this.nav.scrollLeft < max - 2 ? '24px' : '0px');
  }
  selectNavTab(name) {
    let selected;
    for (const button of this.nav.children) {
      const active = button.dataset.tab === name;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active) selected = button;
    }
    clearTimeout(this.tabScrollTimer);
    this.updateTabFade();
    if (!selected) return;
    const reduceMotion = document.body.classList.contains('reduce-motion');
    this.tabScrollTimer = setTimeout(() => {
      this.nav.scrollTo({
        left: selected.offsetLeft + (selected.offsetWidth - this.nav.clientWidth) / 2,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
      this.updateTabFade();
    }, reduceMotion ? 0 : 300);
  }
  select(tab) {
    this.tab=tab;this.modal.classList.toggle('theme-mode',tab==='Theme');this.closePalette();if(this.toolbarControls&&this.body.contains(this.toolbarControls))this.toolbarParking.appendChild(this.toolbarControls);this.body.replaceChildren();this.card=null;this.body.scrollTop=0;this.error.textContent='';
    this.selectNavTab(tab);
    this.body.setAttribute('aria-label',tab);const r=(...a)=>this.row(...a),g=t=>this.group(t);
    if(tab==='Theme'){
      g('Themes');
      const note=document.createElement('p');note.className='editor-help';note.textContent=ui('Choose an application theme. Chart and candle colors stay in Canvas settings.');
      const gallery=document.createElement('div');gallery.className='theme-gallery';
      for(const theme of window.TerminalThemes||[]){
        const card=document.createElement('button');card.type='button';card.className='theme-option';card.setAttribute('aria-pressed',String(document.documentElement.dataset.uiTheme===theme.id));card.title=theme.name;
        card.style.setProperty('--theme-bg',theme.colors['chrome-well']);card.style.setProperty('--theme-text',theme.colors.text);
        const name=document.createElement('span');name.className='theme-option-name';name.textContent=theme.name;
        const dots=document.createElement('span');dots.className='theme-option-dots';for(const color of theme.swatches){const dot=document.createElement('i');dot.style.background=color;dot.setAttribute('aria-hidden','true');dots.appendChild(dot);}
        card.append(name,dots);card.onclick=()=>{if(this.onThemeSelect(theme.id)===false)return;gallery.querySelectorAll('.theme-option').forEach(option=>option.setAttribute('aria-pressed',String(option===card)));};gallery.appendChild(card);
      }
      this.card.append(note,gallery);
    }else if(tab==='Language'){
      g('Language');
      const row=document.createElement('div');row.className='chart-setting-row';
      const label=document.createElement('label');label.htmlFor='settings-language';label.textContent=ui('Interface language');
      const select=document.createElement('select');select.id='settings-language';
      select.add(new Option('Tiếng Việt','vi'));select.add(new Option('English','en'));
      select.value=this.languageDraft;
      select.onchange=()=>{this.languageDraft=select.value;};
      row.append(label,select);this.card.appendChild(row);
      const help=document.createElement('p');help.className='desktop-panel-note';
      help.textContent=ui('Click OK to save and reload in the selected language.');this.body.appendChild(help);
    }else if(tab==='Toolbars'){this.body.appendChild(this.toolbarControls);}else if(tab==='Symbol'){
      g('Candles');
      r('Color bars based on previous close','previousClose');
      r('Body','body','check',{colors:['bodyUp','bodyDown']});
      r('Borders','borders','check',{colors:['borderUp','borderDown']});
      r('Wick','wick','check',{colors:['wickUp','wickDown']});
      g('Data modification');
      this.card.classList.add('chart-data-settings');
      r('Session','sessionMode','select',{options:[['ETH','Electronic trading hours'],['RTH','Regular trading hours']],disabled:this.chart.tfSeconds>=86400?'Session selection is available on intraday intervals':!this.chart.metadata?.sessionRegular?.session?'Regular session hours are missing from the feed':null});
      r('Electronic trading hours background','ethBackground','color',{disabled:this.chart.tfSeconds>=86400||!this.chart.metadata?.sessionRegular?.session?'Intraday regular session data is required':null});
      r('Adjust for contract changes','backAdjust','check',{disabled:'The data source is already back-adjusted; raw contracts are not available to switch back to'});
      r('Precision','precision','select',{options:['Default','0','1','2','3','4','5','6','7','8']});
      r('Timezone','timezone','select',{options:[['America/New_York','New York'],['America/Chicago','Chicago'],['Etc/UTC','UTC'],['Asia/Ho_Chi_Minh','Ho Chi Minh'],['Europe/London','London'],['Asia/Tokyo','Tokyo']]});
    }else if(tab==='Status line'){
      g('Instrument');
      r('Logo','logo');
      r('Title','title');
      r('Title display','titleMode','select',{options:[['Ticker','Symbol'],['Name','Description'],['Name and ticker','Symbol and description']]});
      r('Open market status','marketStatus');
      r('Chart values','chartValues');
      r('Bar change values','barChange');
      r('Volume','volume');
      r('Last day change values','lastDayChange');
      r('Buy/sell buttons','buySell');
      r('Background','legendBackground');
      r('Opacity','legendOpacity','range',{min:0,max:100,suffix:'%'});
      g('Indicators');
      r('Titles','indicatorTitles');
      r('Inputs','indicatorInputs');
      r('Values','statusIndicatorValues');
    }else if(tab==='Scales and lines'){
      g('Scales');
      r('Scale text size','fontSize','number',{min:8,max:24,step:1,suffix:'px'});
      r('Scale text color','textColor','color');
      r('Lines','scaleLines','color');
      g('Price scale');
      r('Currency and Unit','currencyUnit','select',{options:['Visible on mouse over','Always visible','Hidden']});
      r('Scale modes (A and L)','scaleModes','select',{options:['Visible on mouse over','Always visible','Hidden']});
      r('Lock price to bar ratio','priceRatio');
      r('Price units per bar','priceUnitsPerBar','number',{min:.000001,step:'any'});
      r('Scales placement','scalePlacement','select',{options:['Auto','Right','Left'],disabled:'The chart currently anchors to the right price scale'});
      g('Price labels & lines');
      r('No overlapping labels','noOverlap');
      r('Plus button','plusButton');
      r('Countdown to bar close','countdown');
      r('Symbol','symbolLine','select',{options:['Name, value, line','Value and line','Value','Line','Hidden'],colors:['symbolLineColor'],line:'symbolLineStyle'});
      r('Symbol value','symbolValueMode','select',{options:['Value according to scale','Raw price']});
      r('Previous day close','prevDayLine','select',{options:['Hidden','Value','Line','Value and line'],colors:['prevDayColor'],line:'prevDayStyle'});
      r('Indicators and financials','indicatorValues','select',{options:['Value','Hidden']});
      r('High and low','highLow','select',{options:['Hidden','Value','Line','Value and line'],colors:['highColor','lowColor'],line:'highLowStyle'});
      r('Bid and ask','bidAsk','select',{options:['Hidden','Value','Line','Value and line'],colors:['bidColor','askColor'],disabled:'The bridge provides last trade prices only'});
      g('Time scale');
      r('Day of week on labels','dayOfWeek');
      r('Date format','dateFormat','select',{options:['dd MMM yy','yyyy-MM-dd','dd-MM-yyyy']});
      r('Time hours format','hourFormat','select',{options:['12-hours','24-hours']});
      r('Save chart left edge position when changing interval','keepLeft');
      r('Allow extended zoom out','extendedZoom');
    }else if(tab==='Canvas'){
      g('Chart basic styles');
      r('Background','backgroundMode','select',{options:['Solid','Gradient'],colors:['bg']});if(this.draft.backgroundMode==='Gradient')r('Bottom background','bgBottom','color');
      r('Vertical grid lines','verticalGrid','check',{colors:['verticalGridColor'],line:'verticalGridStyle'});
      r('Horizontal grid lines','horizontalGrid','check',{colors:['horizontalGridColor'],line:'horizontalGridStyle'});
      r('Pane separators','separator','color');
      r('Crosshair','crosshair','color',{line:'crosshairStyle'});
      r('Watermark','watermark','select',{options:['Hidden','Ticker','Name'],colors:['watermarkColor']});
      g('Buttons');for(const [label,key] of [['Navigation','navigation'],['Pane','paneButtons']])r(label,key,'select',{options:['Visible on mouse over','Always visible','Hidden']});
      g('Margins');
      r('Top','topMargin','number',{min:0,max:80,suffix:'%'});
      r('Bottom','bottomMargin','number',{min:0,max:80,suffix:'%'});
      r('Right','rightMargin','number',{min:0,max:500,suffix:'bars'});
    }else if(tab==='Trading'){
      g('General');
      r('Buy/sell buttons','buySell');
      r('One-click trading','oneClick');
      r('Multiple exit levels','multipleExits','check',{disabled:'The ledger supports one SL and one TP per position'});
      const soundRow=r('Execution sound','executionSound');
      soundRow.querySelector('#chart-set-executionSound').addEventListener('change',()=>this.onSoundUnlock({...this.draft,executionSound:true}));
      r('Execution volume','executionVolume','range',{min:0,max:100,suffix:'%'});
      const toneRow=r('Execution tone','executionTone','select',{options:['3 Notes Reverb','Single Chime']});
      const preview=document.createElement('button');preview.type='button';preview.className='btn-secondary chart-sound-preview';preview.textContent=ui('Test sound');preview.onclick=()=>this.onSoundPreview({...this.draft});
      toneRow.querySelector('.chart-setting-controls').appendChild(preview);
      r('Show only rejection notifications','rejectionOnly');
      g('Appearance');
      r('Positions and orders','positions');
      r('Reverse position button','reversePosition');
      r('Project order for market orders','projectOrder');
      r('Profit and loss value','pnl');
      r('Positions','positionPnl');
      r('Position units','pnlUnit','select',{options:['Money','Ticks','Percentage']});
      r('Brackets','bracketPnl');
      r('Bracket units','bracketValue','select',{options:['Money','Ticks','Percentage']});
      r('Execution marks','executionMarks');
      r('Execution labels','executionLabels');
      r('Extended price lines across the entire chart width','extendedLines');
      r('Order and position alignment','alignment','select',{options:['Left','Right']});
      r('Orders, executions, and positions in chart snapshots','snapshotOrders');
    }else if(tab==='Alerts'){
      g('Chart line visibility');
      r('Alert lines','alertLines','check',{colors:['alertUpColor','alertColor']});
      r('Only active alerts','activeAlerts');
      g('Notifications');
      r('Automatically hide toasts','hideToasts');
    }else{
      g('Events');
      r('Ideas','ideas','check',{disabled:'Ideas data is not connected'});
      r('Ideas filter','ideasFilter','select',{options:['All ideas','People I follow'],disabled:'Ideas data is not connected'});
      r('Session breaks','sessionBreaks','check',{colors:['sessionColor'],line:'sessionStyle'});
      r('Continuous contract switch','contractSwitch','check',{disabled:'The bridge has no rollover schedule yet'});
      r('Contract switch breaks','contractBreaks','check',{disabled:'The bridge has no rollover schedule yet'});
      r('Latest news','news','check',{disabled:'No instrument news source connected'});
      r('News notification','newsNotification','check',{disabled:'No news source connected'});
    }
    this.body.querySelectorAll('select').forEach(el=>{if(el.value==='')el.selectedIndex=0;});
    this.body.querySelectorAll('select').forEach(el=>el.addEventListener('change',()=>{if(el.dataset.setting==='backgroundMode')this.select(tab);}));
    this.body.setAttribute('aria-label',ui(tab));
    TerminalLanguage.markup(this.body);
  }
}
if(typeof module!=='undefined')module.exports={ChartAppearance,ChartSettings};
