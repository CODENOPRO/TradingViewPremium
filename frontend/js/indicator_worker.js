/* Scripts execute off the UI thread; an infinite loop is stopped by the host timeout. */
if (typeof importScripts === 'function') importScripts('market_data.js');
let calculate,isPine=false,workerBars=[];
self.onmessage = async ({ data }) => {
  const started = performance.now();
  try {
    if (data.type === 'init') {
      if (/^\s*(?:\/\/\s*@version|indicator\s*\(|import\s+\w+\/)/m.test(data.code)) {
        isPine=true;
        if(typeof importScripts!=='function')throw Error('Pine runtime unavailable in this host.');
        if(typeof Intl==='object'&&typeof Intl.DateTimeFormat==='function'&&!Intl.DateTimeFormat.__cached){
          const NativeDTF=Intl.DateTimeFormat,dtfCache=new Map();
          function CachedDateTimeFormat(locales,options){
            const key=(typeof locales==='string'?locales:JSON.stringify(locales))+'|'+(options?JSON.stringify(options):'');
            let formatter=dtfCache.get(key);
            if(!formatter){formatter=new NativeDTF(locales,options);if(dtfCache.size<512)dtfCache.set(key,formatter);}
            return formatter;
          }
          CachedDateTimeFormat.prototype=NativeDTF.prototype;
          CachedDateTimeFormat.supportedLocalesOf=NativeDTF.supportedLocalesOf.bind(NativeDTF);
          CachedDateTimeFormat.__cached=true;
          Intl.DateTimeFormat=CachedDateTimeFormat;
        }
        importScripts('../vendor/pinets-0.13.1/pinets.min.browser.js','pine_runtime.js');
        const runtime=new PineRuntime(PineTSLib,data.code),metadata=await runtime.initialize();
        calculate=(bars,context)=>runtime.run(bars,context);self.postMessage({type:'ready',...metadata,initElapsed:performance.now()-started});return;
      }
      const plugin = new Function('"use strict";\n' + data.code + '\nreturn typeof indicator !== "undefined" ? indicator : (typeof calculate === "function" ? { calculate } : null);')();
      isPine=false;
      if (!plugin || typeof plugin.calculate !== 'function') throw new Error('Script cần function calculate(bars, context) hoặc const indicator = { calculate }.');
      calculate = plugin.calculate;
      self.postMessage({ type: 'ready', defaults: plugin.defaults || {}, inputs:plugin.inputs||[], name: plugin.name || 'Custom indicator', usesViewport: /\b(?:context\s*\.\s*)?viewport\b/.test(data.code), usesMarkets: /\b(?:markets|peerBars)\b/.test(data.code) });
      return;
    }
    if (data.type === 'run') {
      if(Array.isArray(data.bars))workerBars=data.bars;
      else if(data.bars?.mode==='replace')workerBars=data.bars.values||[];
      else if(data.bars?.mode==='tail')workerBars=[...workerBars.slice(0,data.bars.start),...(data.bars.values||[])];
      const bars=workerBars;
      if(!isPine&&data.context.sessionMode==='RTH' && typeof MarketData!=='undefined') {
        data.context.markets=Object.fromEntries(Object.entries(data.context.markets||{}).map(([name,entry])=>{
          const minute=(entry['1m']||[]).filter(b=>MarketData.inRegularSession(b,entry.metadata||{}));
          const metadata={...entry.metadata,session:entry.metadata?.sessionRegular?.session,sessionType:'RTH'};
          return [name,{...Object.fromEntries(Object.keys(MarketData.durations).map(tf=>[tf,MarketData.aggregate(minute,tf,metadata)])),metadata}];
        }));
      }
      const output = await calculate(bars, data.context);
      const result = Array.isArray(output) ? { series: output } : output;
      if (!result || typeof result !== 'object') throw new Error('Indicator phải trả về {series, drawings, tables}.');
      self.postMessage({ type: 'result', id: data.id, result, barsCount:bars.length, elapsed: performance.now() - started });
    }
  } catch (error) {
    self.postMessage({ type: error.dataRequired?'data_required':'error', id: data.id, error: error.message || String(error), ...(error.dataRequired?{requirement:error.dataRequired}:{}) });
  }
};
