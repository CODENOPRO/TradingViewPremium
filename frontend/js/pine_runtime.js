/* Pine v6 adapter. Runtime remains isolated in the indicator Worker. */
class PineRuntime {
  constructor(lib,code) {
    this.lib=lib;this.code=code;this.indicator=new lib.Indicator(code);this.lastKey=null;
    this.needsPeers=/\brequest\s*\./.test(code);this.needsClock=/\btimenow\b/.test(code);
  }
  async initialize(){
    if(!/^\s*\/\/@version\s*=\s*6\b/m.test(this.code))throw Error('Môi trường này nhận Pine Script //@version=6.');
    await this.indicator.resolveImports(path=>{throw Error(`Thiếu source thư viện Pine ${path}; import không tự tải từ TradingView.`);});
    if(this.indicator.getDeclarationType()!=='indicator')throw Error('Chỉ hỗ trợ indicator(), chưa chạy strategy/backtest hoặc library độc lập.');
    this.indicator.prepare();this.defaults={};
    this.inputs=this.indicator.getInputsMeta().map(f=>{
      const key=f.varId||f.id,value=f.defval;
      if(['number','boolean','string'].includes(typeof value))this.defaults[key]=value;
      return {key,label:f.title||f.name||key,type:['price','time'].includes(f.type)?'float':f.type,group:f.group||'Inputs',tooltip:f.tooltip,min:f.minval,max:f.maxval,step:f.step,options:f.type==='source'?['open','high','low','close','hl2','hlc3','ohlc4']:f.options};
    });
    this.usesViewport=this.indicator.usesVisibleRange();
    return {name:'Pine v6',runtime:'pine6',defaults:this.defaults,inputs:this.inputs};
  }
  timeframe(value){const aliases={'1':'1m','5':'5m','15':'15m','60':'1h','240':'4h','360':'6h','1D':'D','1W':'W'};return aliases[value]||value;}
  closeTime(time,tf,metadata,regular){
    const seconds=MarketData.durations[tf],zone=metadata.timezone;
    let session=regular?metadata.sessionRegular?.session:metadata.session;
    const p=MarketData.parts(time,zone),dateKey=`${p.year}${String(p.month).padStart(2,'0')}${String(p.day).padStart(2,'0')}`;
    if(regular)for(const group of (metadata.sessionRegular?.corrections||'').split(';')){const split=group.indexOf(':');if(split>=0&&group.slice(split+1).split(',').includes(dateKey))session=group.slice(0,split);}
    if(session==='24x7')return (time+seconds)*1000;
    const match=/^(\d{2})(\d{2})-(\d{2})(\d{2})(?::\d+)?$/.exec(session||'');
    if(!match||!zone)throw Error('Lịch phiên Pine chưa hỗ trợ hoặc thiếu timezone.');
    const start=+match[1]*60+ +match[2],end=+match[3]*60+ +match[4];
    const open=MarketData.bucket(time,tf==='W'?'W':'D',{...metadata,session,sessionType:regular?'RTH':metadata.sessionType});
    const day=MarketData.parts(open,zone),date=new Date(Date.UTC(day.year,day.month-1,day.day));
    date.setUTCDate(date.getUTCDate()+(tf==='W'?(regular?4:5):end<=start?1:0));
    const close=MarketData.localTime(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate(),+match[3],+match[4],zone);
    const result=tf==='D'||tf==='W'?close:Math.min(time+seconds,close);
    if(result<=time)throw Error('Nến nằm ngoài lịch phiên nguồn; không tạo closeTime giả.');
    return result*1000;
  }
  provider(bars,context,warnings){
    const lib=this.lib,chartTf=context.timeframe,markets=context.markets||{};
    const ticker=id=>{
      const decoded=lib.decodeTickerId(String(id||context.symbol)),split=lib.splitTickerModifier(decoded.symbol);
      if(split.modifier)throw Error(`Chưa có dữ liệu chart type ${split.modifier}.`);
      for(const key of Object.keys(decoded.modifiers))if(key!=='session')throw Error(`Chưa hỗ trợ ticker modifier ${key}.`);
      if(decoded.modifiers.session&&!['regular','extended'].includes(decoded.modifiers.session))throw Error('Ticker session chưa hỗ trợ.');
      return {symbol:split.symbol.split(':').pop(),regular:decoded.modifiers.session?decoded.modifiers.session==='regular':undefined};
    };
    const info=symbol=>{
      const meta=markets[symbol]?.metadata||(symbol===context.symbol?context.metadata:null);
      if(!meta)throw Error(`Chưa có metadata cho ${symbol}. Giữ mã này tải trong TradingView.`);
      return {ticker:symbol,tickerid:(meta.exchange?meta.exchange+':':'')+symbol,main_tickerid:(meta.exchange?meta.exchange+':':'')+symbol,root:symbol.replace(/\d!$/,''),prefix:meta.exchange,description:meta.description,timezone:meta.timezone,session:meta.session,mintick:meta.tickSize,pointvalue:meta.pointValue,type:'futures'};
    };
    return {
      configure(){},
      getSymbolInfo:async id=>info(ticker(id).symbol),
      getMarketData:async(id,resolution,limit,start,end)=>{
        const {symbol,regular}=ticker(id),entry=markets[symbol],tf=this.timeframe(String(resolution||chartTf));
        const metadata=entry?.metadata||(symbol===context.symbol?context.metadata:null);
        if(!metadata)throw Error(`Chưa có dữ liệu ${symbol}; không mượn nến từ mã khác.`);
        const useRegular=regular??context.sessionMode==='RTH';
        let source;
        if(symbol===context.symbol&&tf===chartTf&&useRegular===(context.sessionMode==='RTH'))source=bars;
        else if(useRegular){
          if(!metadata.sessionRegular)throw Error(`Thiếu lịch phiên RTH của ${symbol}.`);
          let minute=(entry?.['1m']||[]).filter(b=>MarketData.inRegularSession(b,metadata));
          if(context.replay)minute=minute.filter(b=>b.time<=bars.at(-1).time);
          source=MarketData.durations[tf]?MarketData.aggregate(minute,tf,{...metadata,session:metadata.sessionRegular.session,sessionType:'RTH'}):null;
        }else source=entry?.[tf];
        if(!source&&MarketData.durations[tf]){
          let minute=entry?.['1m']||[];if(context.replay)minute=minute.filter(b=>b.time<=bars.at(-1).time);
          source=MarketData.aggregate(minute,tf,metadata);
        }
        if(!source)throw Error(`Chưa có timeframe ${resolution} cho ${symbol}.`);
        source=source.filter(b=>(!context.replay||b.time<=bars.at(-1).time)&&(!Number.isFinite(start)||b.time*1000>=start)&&(!Number.isFinite(end)||b.time*1000<=end));
        if(Number.isFinite(limit)&&limit>0)source=source.slice(-limit);
        if(!source.length)throw Error(`Không có nến ${symbol}/${resolution} trong history đang tải.`);
        const seconds=MarketData.durations[tf];if(!seconds)throw Error(`Timeframe ${resolution} chưa hỗ trợ.`);
        return source.map(b=>({openTime:b.time*1000,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume,
          closeTime:this.closeTime(b.time,tf,metadata,useRegular)}));
      }
    };
  }
  async run(bars,context){
    const key=JSON.stringify([bars,context.symbol,context.timeframe,context.sessionMode,context.replay,context.settings,context.metadata,this.needsPeers?context.markets:null,this.usesViewport?context.viewport:null,this.needsClock?context.now:Math.floor((context.now||0)/(context.timeframeSeconds||60))]);
    if(key===this.lastKey)return {...this.lastResult,cached:true};
    for(const f of this.inputs){const value=context.settings?.[f.key]??this.defaults[f.key];if(value!==undefined){try{this.indicator.input[f.key]=value;}catch{this.indicator.inputs[f.key]=value;}}}
    const warnings=new Set(),provider=this.provider(bars,context,warnings);
    if(this.needsPeers)warnings.add('request dùng history local đã tải; chưa chứng minh tương đương TradingView cho nested request, gaps/lookahead và mọi phiên lễ.');
    if(context.timeframe==='W')warnings.add('Lịch đóng nến tuần là xấp xỉ theo phiên chuẩn, chưa có lịch nghỉ lễ đầy đủ.');
    const resolution=context.timeframe==='D'||context.timeframe==='W'?context.timeframe:String(context.timeframeSeconds/60);
    const pine=new this.lib.PineTS(provider,context.symbol,resolution,bars.length);pine.setMaxLoops(100000);
    if(context.viewport?.from&&context.viewport?.to)pine.setVisibleRange(context.viewport.from*1000,context.viewport.to*1000);
    const output=await pine.run(this.indicator);
    const result=this.convert(output,bars,context,warnings);
    this.lastKey=key;this.lastResult=result;return result;
  }
  convert(output,bars,context,warnings=new Set()){
    const overlay=!!output.indicator.overlay,result={name:output.indicator.shorttitle||output.indicator.title||'Pine v6',series:[],drawings:[],tables:[],candleColors:[],paints:[],warnings:[],runtime:'pine6'};
    const pane={title:result.name,min:Infinity,max:-Infinity,drawings:[],series:[],paints:[],autoScale:true};
    const color=(value,fallback='#2962ff')=>typeof value==='string'&&value?value:fallback;
    const style=value=>String(value||'solid').includes('dash')?'dashed':String(value||'').includes('dot')?'dotted':'solid';
    const seconds=context.timeframeSeconds||60;
    const at=(x,xloc)=>xloc==='bt'||xloc==='bar_time'?x/1000:bars[Math.trunc(x)]?.time??(x<0?bars[0].time+x*seconds:bars.at(-1).time+(x-bars.length+1)*seconds);
    const add=(drawing,onMain)=>{if(!drawing||![drawing.p1?.time,drawing.p1?.price,...(drawing.p2?[drawing.p2.time,drawing.p2.price]:[])].every(Number.isFinite))return;(onMain?result.drawings:pane.drawings).push(drawing);};
    const names=Object.values(output.plots||{}),plots=output.plots||{};
    for(const plot of names){
      const options=plot.options||{},kind=options.style||'line',onMain=options.force_overlay===true||(options.overlay??overlay),target=onMain?result:pane;
      if(['label','drawing_line','drawing_box','table','linefill','drawing_polyline'].includes(kind)){
        const objects=new Map();for(const item of plot.data||[])for(const value of Array.isArray(item.value)?item.value:[])objects.set(value.id,value);
        for(const value of objects.values()){
          if(value._deleted)continue;const main=!!value.force_overlay||overlay;
          if(kind==='drawing_line')add({type:'line',p1:{time:at(value.x1,value.xloc),price:value.y1},p2:{time:at(value.x2,value.xloc),price:value.y2},color:color(value.color),width:value.width||1,lineStyle:style(value.style),extend:value.extend||'none'},main);
          else if(kind==='drawing_box')add({type:'box',p1:{time:at(value.left,value.xloc),price:value.top},p2:{time:at(value.right,value.xloc),price:value.bottom},color:color(value.border_color),strokeOpacity:value.border_width===0?0:100,width:value.border_width||1,lineStyle:style(value.border_style),extend:value.extend||'none',fillColor:color(value.bgcolor,'transparent'),fillOpacity:100,fillEnabled:!!value.bgcolor,middleLine:{enabled:false},text:value.text||'',textStyle:{color:color(value.text_color,'#202020'),size:typeof value.text_size==='number'?value.text_size:12,horizontal:value.text_halign||'center',vertical:'inside'}},main);
          else if(kind==='label'){
            const time=at(value.x,value.xloc),bar=bars.find(b=>b.time===time),above=value.yloc==='ab'||String(value.yloc).includes('above'),below=value.yloc==='bl'||String(value.yloc).includes('below');
            if(value.text)add({type:'text',p1:{time,price:above?bar?.high:below?bar?.low:value.y},text:value.text,textStyle:{color:color(value.textcolor,'#202020'),size:typeof value.size==='number'?value.size:12,horizontal:value.textalign||'center',vertical:above?'above':below?'below':'inside'}},main);
            if(value.color&&value.style!=='style_none')warnings.add('Label hiện dạng text; nền và mũi tên label chưa tương đương TradingView.');
          }else if(kind==='table'){
            const rows=Array.from({length:Math.min(value.rows,100)},(_,r)=>Array.from({length:Math.min(value.columns,30)},(_,c)=>{const cell=value.cells?.[r]?.[c];return {text:cell?.text||'',color:color(cell?.text_color,'#202020'),background:cell?.bgcolor||value.bgcolor,align:cell?.text_halign,size:typeof cell?.text_size==='number'?cell.text_size:undefined};}));
            result.tables.push({rows,position:value.position,pane:!main,merges:value.merges||[]});
          }else if(objects.size)warnings.add(`Chưa render Pine ${kind}; không coi là đầy đủ hình vẽ.`);
        }
        continue;
      }
      if(kind==='barcolor'){for(const point of plot.data||[])if(point.value&&point.options?.color)result.candleColors.push({time:point.time/1000,color:point.options.color});continue;}
      if(kind==='background'){target.paints.push({type:'background',data:(plot.data||[]).filter(p=>p.value).map(p=>({time:p.time/1000,color:color(p.options?.color,options.color)}))});continue;}
      if(kind==='fill'){
        const first=plots[options.plot1],second=plots[options.plot2];if(first&&second)target.paints.push({type:'fill',top:first.data.map(p=>({time:p.time/1000,value:p.value})),bottom:second.data.map(p=>({time:p.time/1000,value:p.value})),color:color(options.color),colors:(plot.data||[]).map(p=>p.options?.color)});else warnings.add('Fill thiếu plot tham chiếu.');continue;
      }
      if(kind==='shape'||kind==='char'||kind==='arrow'){
        if(!onMain&&!String(options.location).toLowerCase().includes('absolute')){warnings.add('Shape trong pane chưa hỗ trợ vị trí tương đối; không dùng giá OHLC để làm lệch thang đo pane.');continue;}
        for(const p of plot.data||[]){if(!p.value)continue;const time=p.time/1000,bar=bars.find(b=>b.time===time),o={...options,...p.options},location=String(o.location||'AboveBar').toLowerCase();
          const below=location.includes('below'),absolute=location.includes('absolute'),price=absolute?Number(p.value):(below?bar?.low:bar?.high);
          const symbol=kind==='char'?(o.char||'●'):String(o.shape).includes('down')?'▼':String(o.shape).includes('triangle')?'▲':'●';
          add({type:'text',p1:{time,price},text:(o.text?o.text+' ':'')+symbol,textStyle:{color:color(o.color),size:12,horizontal:'center',vertical:absolute?'inside':below?'below':'above'}},onMain);
        }
        warnings.add('Plotshape/plotchar dùng ký hiệu text; chưa pixel parity.');continue;
      }
      if(options.display==='none')continue;
      const allowed=['line','style_line','style_linebr','style_stepline','hline','style_histogram','style_columns','style_area'];
      if(!allowed.includes(kind)){warnings.add(`Chưa render plot style ${kind}.`);continue;}
      const offset=Number(options.offset)||0;
      if(offset)warnings.add('Plot offset chưa được render; plot này được bỏ qua để tránh đặt sai thời gian.');
      if(offset)continue;
      const data=(plot.data||[]).map(p=>Number.isFinite(p.value)?{time:p.time/1000,value:p.value,color:color(p.options?.color,options.color)}:{time:p.time/1000});
      const type=kind.includes('histogram')||kind.includes('columns')?'histogram':kind.includes('area')?'area':'line';
      target.series.push({type,title:plot.title||'',color:color(options.color),width:Math.max(1,Math.min(4,Number(options.linewidth)||1)),data,lineStyle:style(options.linestyle),step:kind.includes('stepline')});
    }
    if(!overlay){
      for(const series of pane.series)for(const point of series.data)if(Number.isFinite(point.value)){pane.min=Math.min(pane.min,point.value,series.type==='histogram'?0:Infinity);pane.max=Math.max(pane.max,point.value,series.type==='histogram'?0:-Infinity);}
      for(const d of pane.drawings)for(const p of [d.p1,d.p2])if(p){pane.min=Math.min(pane.min,p.price);pane.max=Math.max(pane.max,p.price);}
      if(!Number.isFinite(pane.min)||!Number.isFinite(pane.max)){pane.min=0;pane.max=1;}
      if(pane.min===pane.max){pane.min-=1;pane.max+=1;}
      const padding=(pane.max-pane.min)*.08;pane.min-=padding;pane.max+=padding;result.pane=pane;
    }
    for(const warning of output.warnings||[])warnings.add(warning.message);
    if(output.alerts?.length)warnings.add('Pine alert đã tính nhưng chưa nối thông báo/webhook.');
    result.warnings=[...warnings].slice(0,8);return result;
  }
}
if(typeof module!=='undefined')module.exports=PineRuntime;
