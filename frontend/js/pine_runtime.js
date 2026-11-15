/* Pine v6 adapter. Runtime remains isolated in the indicator Worker. */
class PineRuntime {
  constructor(lib,code) {
    this.lib=lib;this.code=String(code||'').replace(/^\uFEFF/,'');this.lastKey=null;this.closeCache=new Map();
    this.needsPeers=/\brequest\s*\./.test(this.code);this.needsClock=/\btimenow\b/.test(this.code);
  }
  async initialize(){
    if(!/^\s*\/\/\s*@version\s*=\s*6\b/m.test(this.code))throw Error('Môi trường này nhận Pine Script //@version=6.');
    this.indicator=new this.lib.Indicator(this.code);
    await this.indicator.resolveImports(path=>{throw Error(`Thiếu source thư viện Pine ${path}; import không tự tải từ TradingView.`);});
    const decl=this.indicator.getDeclarationType();
    if(decl&&decl!=='indicator')throw Error('Chỉ hỗ trợ indicator(), chưa chạy strategy/backtest hoặc library độc lập.');
    this.indicator.prepare();
    if(this.indicator.getDeclarationType()!=='indicator')throw Error('Chỉ hỗ trợ indicator(), chưa chạy strategy/backtest hoặc library độc lập.');
    this.defaults={};
    this.inputs=this.indicator.getInputsMeta().map(f=>{
      const key=f.varId||f.id,value=f.defval;
      if(['number','boolean','string'].includes(typeof value))this.defaults[key]=value;
      return {key,label:f.title||f.name||key,type:['price','time'].includes(f.type)?'float':f.type,group:f.group||'Inputs',tooltip:f.tooltip,min:f.minval,max:f.maxval,step:f.step,options:f.type==='source'?['open','high','low','close','hl2','hlc3','ohlc4','hlcc4']:f.options};
    });
    this.usesViewport=this.indicator.usesVisibleRange();
    return {name:'Pine v6',runtime:'pine6',defaults:this.defaults,inputs:this.inputs,usesViewport:this.usesViewport,usesMarkets:this.needsPeers};
  }
  timeframe(value){
    const raw=String(value||'').trim();
    const aliases={'1':'1m','1m':'1m','3':'3m','3m':'3m','5':'5m','5m':'5m','15':'15m','15m':'15m','30':'30m','30m':'30m','45':'45m','45m':'45m','60':'1h','1h':'1h','1H':'1h','120':'2h','2h':'2h','2H':'2h','240':'4h','4h':'4h','4H':'4h','360':'6h','6h':'6h','6H':'6h','720':'12h','12h':'12h','12H':'12h',D:'D','1D':'D',W:'W','1W':'W',M:'1M','1M':'1M','43200':'1M','3M':'3M','129600':'3M'};
    return aliases[raw]||raw;
  }
  closeTime(time,tf,metadata,regular){
    const seconds=MarketData.durations[tf],zone=metadata?.timezone;
    if(!seconds)throw Error(`Timeframe ${tf} chưa hỗ trợ.`);
    const intraday=tf!=='D'&&tf!=='W'&&tf!=='1M'&&tf!=='3M';
    let session=regular?metadata.sessionRegular?.session:metadata.session;
    const cacheKey=`${zone||''}|${regular?'R':'E'}|${tf}|${session||''}`;
    const cached=this.closeCache.get(cacheKey);
    if(intraday&&cached&&time>=cached.open&&time<cached.close)return Math.min(time+seconds,cached.close)*1000;
    const corrections=regular?metadata.sessionRegular?.corrections:'';
    if(corrections){
      const p=MarketData.parts(time,zone),dateKey=`${p.year}${String(p.month).padStart(2,'0')}${String(p.day).padStart(2,'0')}`;
      for(const group of corrections.split(';')){const split=group.indexOf(':');if(split>=0&&group.slice(split+1).split(',').includes(dateKey)){session=group.slice(0,split);break;}}
    }
    if(session==='24x7')return (time+seconds)*1000;
    const match=/^(\d{2})(\d{2})-(\d{2})(\d{2})(?::\d+)?$/.exec(session||'');
    if(!match||!zone)throw Error('Lịch phiên Pine chưa hỗ trợ hoặc thiếu timezone.');
    const start=+match[1]*60+ +match[2],end=+match[3]*60+ +match[4];
    const open=MarketData.bucket(time,tf==='W'?'W':'D',{...metadata,session,sessionType:regular?'RTH':metadata.sessionType});
    const day=MarketData.parts(open,zone),date=new Date(Date.UTC(day.year,day.month-1,day.day));
    if(tf==='3M')date.setUTCMonth(date.getUTCMonth()+3);
    else if(tf==='1M')date.setUTCMonth(date.getUTCMonth()+1);
    else date.setUTCDate(date.getUTCDate()+(tf==='W'?(regular?4:5):end<=start?1:0));
    let close=MarketData.localTime(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate(),+match[3],+match[4],zone);
    if(intraday){
      if(open<=time&&time<close)this.closeCache.set(cacheKey,{open,close});
      const result=Math.min(time+seconds,close);
      return (result<=time?time+seconds:result)*1000;
    }
    if(close<=time)close=time+seconds;
    return close*1000;
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
        if(tf==='6h')warnings.add('6h ghép từ nến native 1h, căn theo phiên nguồn; không phải feed native 6h.');
        if(!source?.length){
          const error=Error(`Đang chờ dữ liệu native ${symbol}/${tf}. Nạp khung ${tf} trong TradingView; indicator sẽ tự chạy lại khi dữ liệu tới.`);
          error.dataRequired={symbol,timeframe:tf,resolution:String(resolution)};throw error;
        }
        source=source.filter(b=>(!context.replay||b.time<=bars.at(-1).time)&&(!Number.isFinite(start)||b.time*1000>=start)&&(!Number.isFinite(end)||b.time*1000<=end));
        if(Number.isFinite(limit)&&limit>0)source=source.slice(-limit);
        if(!source.length)throw Error(`Không có nến ${symbol}/${resolution} trong history đang tải.`);
        const seconds=MarketData.durations[tf];if(!seconds)throw Error(`Timeframe ${resolution} chưa hỗ trợ.`);
        return source.map(b=>({openTime:b.time*1000,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume,
          closeTime:this.closeTime(b.time,tf,metadata,useRegular)}));
      }
    };
  }
  marketsSignature(markets){
    if(!markets)return null;
    const parts=[];
    for(const sym of Object.keys(markets).sort()){
      const entry=markets[sym]||{};
      const tfs=Object.keys(entry).filter(k=>k!=='metadata'&&Array.isArray(entry[k])).sort();
      parts.push(sym,entry.metadata?.sessionRegular?.session||'',entry.metadata?.session||'');
      for(const tf of tfs){
        const arr=entry[tf],n=arr.length,mid=arr[n>>1],last=arr[n-1];
        let checksum=0;
        for(let i=Math.max(0,n-16);i<n;i++)checksum+=arr[i].close+(arr[i].volume||0)*1e-4;
        parts.push(tf,n,arr[0]?.time,mid?.close,last?.time,last?.close,last?.volume,checksum);
      }
    }
    return parts;
  }
  async run(bars,context){
    const key=JSON.stringify([context.dataRevision,bars.length,bars.at(-1)?.time,context.symbol,context.timeframe,context.sessionMode,context.replay,context.settings,context.metadata,this.needsPeers?this.marketsSignature(context.markets):null,this.usesViewport?context.viewport:null,this.needsClock?context.now:null]);
    if(key===this.lastKey)return {...this.lastResult,cached:true};
    for(const f of this.inputs){const value=context.settings?.[f.key]??this.defaults[f.key];if(value!==undefined){try{this.indicator.input[f.key]=value;}catch{this.indicator.inputs[f.key]=value;}}}
    const warnings=new Set(),provider=this.provider(bars,context,warnings);
    if(this.needsPeers)warnings.add('request dùng history local đã tải; chưa chứng minh tương đương TradingView cho nested request, gaps/lookahead và mọi phiên lễ.');
    if(context.timeframe==='W')warnings.add('Lịch đóng nến tuần là xấp xỉ theo phiên chuẩn, chưa có lịch nghỉ lễ đầy đủ.');
    const resolution=['D','W','1M','3M'].includes(context.timeframe)?context.timeframe:String(context.timeframeSeconds/60);
    const pine=new this.lib.PineTS(provider,context.symbol,resolution,bars.length);pine.setMaxLoops(100000);
    if(context.viewport?.from&&context.viewport?.to)pine.setVisibleRange(context.viewport.from*1000,context.viewport.to*1000);
    const output=await pine.run(this.indicator);
    const result=this.convert(output,bars,context,warnings);
    this.lastKey=key;this.lastResult=result;return result;
  }
  convert(output,bars,context,warnings=new Set()){
    const overlay=!!output.indicator.overlay,result={name:output.indicator.shorttitle||output.indicator.title||'Pine v6',series:[],drawings:[],tables:[],candleColors:[],paints:[],warnings:[],runtime:'pine6'};
    const pane={title:result.name,min:Infinity,max:-Infinity,drawings:[],series:[],paints:[],autoScale:true};
    const isTransparent=value=>{
      if(value===null||value===undefined||value===''||value==='na'||value==='transparent'||Number.isNaN(value))return true;
      const s=String(value).trim().toLowerCase();
      if(s==='na'||s==='nan')return true;
      if(/^#[0-9a-f]{8}$/.test(s)&&s.slice(7)==='00')return true;
      const m=/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/.exec(s);
      return !!m&&Number(m[1])===0;
    };
    const color=(value,fallback='#2962ff')=>typeof value==='string'&&value?value:fallback;
    const sizePx=(value,fallback=11)=>{
      if(typeof value==='number'&&Number.isFinite(value))return Math.max(8,Math.min(36,value));
      const s=String(value||'').toLowerCase();
      if(s.includes('tiny'))return 10;if(s.includes('small'))return 11;if(s.includes('normal'))return 13;if(s.includes('large'))return 16;if(s.includes('huge'))return 20;
      return fallback;
    };
    const style=value=>String(value||'solid').includes('dash')?'dashed':String(value||'').includes('dot')?'dotted':'solid';
    const seconds=context.timeframeSeconds||60;
    const at=(x,xloc)=>{
      if(!bars.length||!Number.isFinite(x))return null;
      return xloc==='bt'||xloc==='bar_time'?x/1000:bars[Math.trunc(x)]?.time??(x<0?bars[0].time+x*seconds:bars.at(-1).time+(x-bars.length+1)*seconds);
    };
    const add=(drawing,onMain)=>{if(!drawing||![drawing.p1?.time,drawing.p1?.price,...(drawing.p2?[drawing.p2.time,drawing.p2.price]:[])].every(Number.isFinite))return;(onMain?result.drawings:pane.drawings).push(drawing);};
    const names=Object.values(output.plots||{}),plots=output.plots||{},barIndex=new Map(),barByTime=new Map();
    bars.forEach((bar,index)=>{barIndex.set(bar.time,index);barByTime.set(bar.time,bar);});
    const plotTime=(point,offset=0)=>{
      const original=point.time/1000;
      if(!offset)return original;
      const index=barIndex.get(original);
      return Number.isInteger(index)?at(index+offset,'bar_index'):original;
    };
    for(const plot of names){
      const options=plot.options||{},kind=options.style||'line',onMain=options.force_overlay===true||(options.overlay??overlay),target=onMain?result:pane;
      if(['label','drawing_line','drawing_box','table','linefill','drawing_polyline'].includes(kind)){
        const objects=new Map();for(const item of plot.data||[])for(const value of Array.isArray(item.value)?item.value:[])objects.set(value.id,value);
        for(const value of objects.values()){
          if(value._deleted)continue;const main=!!value.force_overlay||overlay;
          if(kind==='drawing_line'){
            add({type:'line',p1:{time:at(value.x1,value.xloc),price:value.y1},p2:{time:at(value.x2,value.xloc),price:value.y2},color:isTransparent(value.color===null||value.color==='transparent'?'transparent':color(value.color))?'transparent':color(value.color),strokeOpacity:value.color===null?0:100,width:value.width||1,lineStyle:style(value.style),extend:value.extend||'none'},main);
          }else if(kind==='drawing_box'){
            const hasBorder=value.border_color!==null&&value.border_width!==0&&!isTransparent(value.border_color===''?'#2962ff':value.border_color);
            const hasFill=!isTransparent(value.bgcolor);
            add({type:'box',p1:{time:at(value.left,value.xloc),price:value.top},p2:{time:at(value.right,value.xloc),price:value.bottom},color:hasBorder?color(value.border_color):'transparent',strokeOpacity:hasBorder?100:0,width:hasBorder?Math.max(1,value.border_width||1):0,lineStyle:style(value.border_style),extend:value.extend||'none',fillColor:hasFill?value.bgcolor:'transparent',fillOpacity:100,fillEnabled:hasFill,middleLine:{enabled:false},text:value.text||'',textStyle:{color:color(value.text_color,'#202020'),size:sizePx(value.text_size,11),bold:String(value.text_formatting||'').includes('bold'),italic:String(value.text_formatting||'').includes('italic'),fontFamily:value.text_font_family==='monospace'?'monospace':'Arial',horizontal:value.text_halign||'center',vertical:['top','bottom'].includes(value.text_valign)?value.text_valign:'inside'}},main);
          }else if(kind==='label'){
            const time=at(value.x,value.xloc),bar=time!==null?barByTime.get(time):null,above=value.yloc==='ab'||String(value.yloc).includes('above'),below=value.yloc==='bl'||String(value.yloc).includes('below');
            const st=String(value.style||'style_label_down');
            const placement=st==='style_label_left'?'label_left':st==='style_label_right'?'label_right':st==='style_label_up'||below?'below':st==='style_label_down'||above?'above':'center';
            const horizontal=st==='style_label_left'?'left':st==='style_label_right'?'right':(value.textalign||'center');
            const bg=!isTransparent(value.color)&&st!=='style_none'?value.color:null;
            if(value.text||bg)add({type:'text',p1:{time,price:above?bar?.high:below?bar?.low:value.y},text:String(value.text??''),labelBg:bg,textStyle:{pine:true,placement,color:color(value.textcolor,'#202020'),size:sizePx(value.size,11),bold:String(value.text_formatting||'').includes('bold'),italic:String(value.text_formatting||'').includes('italic'),fontFamily:value.text_font_family==='monospace'?'monospace':'Arial',horizontal}},main);
          }else if(kind==='table'){
            const tbl=(value.bgcolor&&typeof value.bgcolor==='object')?{...value,...value.bgcolor,bgcolor:value.bgcolor.bgcolor??''}:value;
            let hasContent=false;
            const rows=Array.from({length:Math.min(tbl.rows||0,100)},(_,r)=>Array.from({length:Math.min(tbl.columns||0,30)},(_,c)=>{
              const rawCell=tbl.cells?.[r]?.[c],cell=(rawCell&&typeof rawCell.width==='object'&&rawCell.width)?{...rawCell,...rawCell.width}:rawCell;
              const text=String(cell?.text??''),bg=!isTransparent(cell?.bgcolor)?cell.bgcolor:(!isTransparent(tbl.bgcolor)?tbl.bgcolor:undefined);
              if(text.trim()||!isTransparent(cell?.bgcolor))hasContent=true;
              const fmt=String(cell?.text_formatting||'');
              return {text,color:color(cell?.text_color,'#202020'),background:bg,align:cell?.text_halign,size:cell?.text_size?sizePx(cell.text_size,11):undefined,bold:fmt.includes('bold'),italic:fmt.includes('italic'),fontFamily:cell?.text_font_family==='monospace'?'monospace':undefined};
            }));
            if(!hasContent&&isTransparent(tbl.bgcolor))continue;
            result.tables.push({rows,position:tbl.position,pane:!main,merges:tbl.merges||[],bgcolor:!isTransparent(tbl.bgcolor)?tbl.bgcolor:undefined,borderWidth:tbl.border_width,borderColor:!isTransparent(tbl.border_color)?tbl.border_color:undefined,frameWidth:tbl.frame_width,frameColor:!isTransparent(tbl.frame_color)?tbl.frame_color:undefined});
          }else if(kind==='linefill'&&value.line1&&value.line2&&!isTransparent(value.color)){
            const l1=value.line1,l2=value.line2,pts=[{time:at(l1.x1,l1.xloc),price:l1.y1},{time:at(l1.x2,l1.xloc),price:l1.y2},{time:at(l2.x2,l2.xloc),price:l2.y2},{time:at(l2.x1,l2.xloc),price:l2.y1}];
            if(pts.every(p=>Number.isFinite(p.time)&&Number.isFinite(p.price)))(main?result:pane).paints.push({type:'quad',points:pts,color:value.color});
          }else if(kind==='drawing_polyline'&&Array.isArray(value.points)){
            const pts=value.points.map(pt=>({time:at(pt.time??pt.index,value.xloc),price:pt.price})).filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.price));
            if(pts.length>=2)(main?result:pane).paints.push({type:'polyline',points:pts,closed:!!value.closed,color:!isTransparent(value.line_color===''?'#2962ff':value.line_color)?color(value.line_color):null,fillColor:isTransparent(value.fill_color)?null:value.fill_color,width:value.line_width||1,lineStyle:style(value.line_style)});
          }else if(objects.size)warnings.add(`Chưa render Pine ${kind}; không coi là đầy đủ hình vẽ.`);
        }
        continue;
      }
      if(kind==='barcolor'){for(const point of plot.data||[])if(point.value&&point.options?.color)result.candleColors.push({time:point.time/1000,color:point.options.color});continue;}
      if(kind==='background'){target.paints.push({type:'background',data:(plot.data||[]).filter(p=>p.value).map(p=>({time:p.time/1000,color:color(p.options?.color,options.color)}))});continue;}
      if(kind==='fill'){
        const first=plots[options.plot1],second=plots[options.plot2];if(first&&second)target.paints.push({type:'fill',top:first.data.map(p=>({time:plotTime(p,Number(first.options?.offset)||0),value:p.value})),bottom:second.data.map(p=>({time:plotTime(p,Number(second.options?.offset)||0),value:p.value})),color:color(options.color),colors:(plot.data||[]).map(p=>p.options?.color)});else warnings.add('Fill thiếu plot tham chiếu.');continue;
      }
      if(kind==='shape'||kind==='char'||kind==='arrow'){
        if(!onMain&&!String(options.location).toLowerCase().includes('absolute')){warnings.add('Shape trong pane chưa hỗ trợ vị trí tương đối; không dùng giá OHLC để làm lệch thang đo pane.');continue;}
        for(const p of plot.data||[]){if(!p.value)continue;const time=p.time/1000,bar=barByTime.get(time),o={...options,...p.options},location=String(o.location||'AboveBar').toLowerCase();
          const below=location.includes('below'),absolute=location.includes('absolute'),price=absolute?Number(p.value):(below?bar?.low:bar?.high);
          const symbol=kind==='char'?(o.char||'●'):String(o.shape).includes('down')?'▼':String(o.shape).includes('triangle')?'▲':'●';
          add({type:'text',_isShape:true,p1:{time,price},text:(o.text?o.text+' ':'')+symbol,textStyle:{pine:true,placement:absolute?'center':below?'below':'above',color:color(o.color),size:sizePx(o.size,11),horizontal:'center'}},onMain);
        }
        continue;
      }
      if(['none','data_window','status_line'].includes(String(options.display||'').toLowerCase()))continue;
      if(kind==='candle'||kind==='bar'){
        const offset=Number(options.offset)||0;
        const data=(plot.data||[]).filter(p=>Array.isArray(p.value)&&p.value.length>=4&&p.value.every(Number.isFinite)).map(p=>{
          const [open,high,low,close]=p.value,o={...options,...p.options};
          return {time:plotTime(p,offset),open,high,low,close,color:color(o.color),wickColor:color(o.wickcolor,o.color),borderColor:color(o.bordercolor,o.color)};
        });
        if(data.length)target.series.push({type:kind,title:plot.title||'',color:color(options.color),data});
        continue;
      }
      const allowed=['line','style_line','style_linebr','style_stepline','style_steplinebr','hline','style_histogram','style_columns','style_area','style_areabr','style_circles','style_cross'];
      if(!allowed.includes(kind)){warnings.add(`Chưa render plot style ${kind}.`);continue;}
      const offset=Number(options.offset)||0,isBreak=kind.endsWith('br');
      const optNa=options.color!==undefined&&isTransparent(options.color);
      const hasPtColors=(plot.data||[]).some(p=>p.options&&p.options.color!==undefined);
      const seriesColor=optNa?'rgba(0,0,0,0)':color(options.color);
      const data=(plot.data||[]).map(p=>{
        const time=plotTime(p,offset),ptCol=p.options?.color;
        const isPtNa=(ptCol===undefined&&(optNa||hasPtColors))||(ptCol!==undefined&&isTransparent(ptCol));
        if(!Number.isFinite(p.value)||(isBreak&&isPtNa))return {time};
        return {time,value:p.value,color:isPtNa?'rgba(0,0,0,0)':color(ptCol,seriesColor)};
      });
      const type=kind.includes('histogram')||kind.includes('columns')?'histogram':kind.includes('area')?'area':'line';
      target.series.push({type,title:plot.title||'',color:seriesColor,width:Math.max(1,Math.min(4,Number(options.linewidth)||1)),data,lineStyle:style(options.linestyle),step:kind.includes('stepline'),markersOnly:kind==='style_circles'||kind==='style_cross'});
    }
    for(const list of [result.drawings,pane.drawings]){
      if(list.length>2000){
        const keepShapes=Math.max(0,2000-list.filter(d=>!d._isShape).length);
        const nonShapes=list.filter(d=>!d._isShape),shapes=list.filter(d=>d._isShape).slice(-keepShapes);
        list.splice(0,list.length,...shapes,...nonShapes.slice(-2000));
        warnings.add('Giới hạn hiển thị 2000 hình/marker gần nhất.');
      }
      for(const d of list)delete d._isShape;
    }
    if(!overlay){
      for(const series of pane.series)for(const point of series.data){
        if(Number.isFinite(point.value)){pane.min=Math.min(pane.min,point.value,series.type==='histogram'?0:Infinity);pane.max=Math.max(pane.max,point.value,series.type==='histogram'?0:-Infinity);}
        if(Number.isFinite(point.low)&&Number.isFinite(point.high)){pane.min=Math.min(pane.min,point.low);pane.max=Math.max(pane.max,point.high);}
      }
      for(const d of pane.drawings)for(const p of [d.p1,d.p2])if(p){pane.min=Math.min(pane.min,p.price);pane.max=Math.max(pane.max,p.price);}
      for(const p of pane.paints)for(const pt of p.points||[])if(Number.isFinite(pt.price)){pane.min=Math.min(pane.min,pt.price);pane.max=Math.max(pane.max,pt.price);}
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
