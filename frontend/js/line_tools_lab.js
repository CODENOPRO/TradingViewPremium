(async()=>{
  const $=id=>document.getElementById(id),host=$('lab-chart');
  const chart=LightweightCharts.createChart(host,{autoSize:true,layout:{background:{color:'#c2baae'},textColor:'#211f1d'},timeScale:{timeVisible:true,rightOffset:15}});
  const series=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:'#e8e4dc',downColor:'#211f1d',borderColor:'#211f1d',wickColor:'#211f1d'});
  const tools=LightweightChartsLineToolsCore.createLineToolsPlugin(chart,series);
  tools.registerLineTool('Rectangle',LightweightChartsLineToolsRectangle.LineToolRectangle);
  tools.registerLineTool('FibRetracement',LightweightChartsLineToolsFibRetracement.LineToolFibRetracement);
  tools.registerLineTool('LongShortPosition',LightweightChartsLineToolsLongShortPosition.LineToolLongShortPosition);
  const report=text=>$('lab-report').textContent=text;
  let symbol=$('lab-symbol').value,bars=[],snapshots=new Map();
  const storageKey=()=> 'line_tools_lab_'+symbol;
  const save=()=>{const json=tools.exportLineTools();Workspace.write(storageKey(),JSON.parse(json));report(`Đã lưu ${JSON.parse(json).length} hình trong vùng thử.`);};
  tools.subscribeLineToolsAfterEdit(save);
  tools.subscribeLineToolsDoubleClick(({selectedLineTool})=>{$('lab-options').value=JSON.stringify(selectedLineTool,null,2);$('lab-options').closest('details').open=true;});
  const restore=()=>{tools.removeAllLineTools();const saved=Workspace.read(storageKey(),[]);if(!tools.importLineTools(JSON.stringify(saved)))throw Error('Plugin không import được snapshot đã lưu');};
  restore();
  for(const button of document.querySelectorAll('[data-tool]'))button.onclick=()=>{tools.addLineTool(button.dataset.tool,[],{});report('Click trên chart để đặt các điểm.');};
  $('lab-save').onclick=save;
  $('lab-roundtrip').onclick=()=>{
    const before=tools.exportLineTools(),expected=JSON.parse(before);
    const ok=tools.importLineTools(before),after=JSON.parse(tools.exportLineTools());
    const equal=ok&&expected.length===after.length&&expected.every(a=>after.some(b=>JSON.stringify(a)===JSON.stringify(b)));
    report(equal?`PASS: ${after.length} hình giữ nguyên ID/tọa độ/options sau export/import.`:'FAIL: export/import khác snapshot; giữ bản gốc để kiểm tra.');
  };
  $('lab-import').onclick=()=>{
    const id=$('lab-source').value,original=Workspace.read('drawings_'+id+'_'+symbol,Workspace.read('drawings_'+symbol,[]));
    const converted=LineToolsBridge.convert(original);
    Workspace.write('line_tools_lab_original_'+id+'_'+symbol,converted.originals);
    const ok=tools.importLineTools(JSON.stringify(converted.tools));
    const issues=LineToolsBridge.audit(converted.tools,JSON.parse(tools.exportLineTools()));
    report(`${ok?'Đã đọc':'Không import được'} ${converted.tools.length}/${original.length} hình từ ${id}/${symbol}.\n${[...converted.warnings,...issues].join('\n')}${issues.length?'':'\nTọa độ/options đã chuyển khớp snapshot plugin.'}`);
  };
  $('lab-seed').onclick=()=>{
    if(bars.length<80)return report('Chờ ít nhất 80 nến thật để đặt hình kiểm thử.');
    const a=bars.at(-75),b=bars.at(-40),c=bars.at(-12),range=Math.max(a.high-a.low,Math.abs(a.close-b.close),1);
    const base=[{id:'check-box',type:'box',p1:{time:a.time,price:a.close+range},p2:{time:b.time,price:a.close-range},middleLine:{enabled:false},text:'Rectangle test'},
      {id:'check-fib',type:'fib',p1:{time:b.time,price:b.low},p2:{time:c.time,price:c.high}},
      {id:'check-position',type:'position',p1:{time:b.time,price:b.close},p2:{time:c.time,price:b.close+range*2},riskReward:2}];
    const converted=LineToolsBridge.convert(base);tools.importLineTools(JSON.stringify(converted.tools));const issues=LineToolsBridge.audit(converted.tools,JSON.parse(tools.exportLineTools()));report(issues.length?issues.join('\n'):'Đã thêm 3 hình thử trên nến thật; tọa độ/options khớp adapter. Kéo điểm, double-click xem JSON, hoặc kiểm tra export/import.');
  };
  $('lab-symbol').onchange=()=>{save();symbol=$('lab-symbol').value;bars=snapshots.get(symbol)||[];series.setData(bars);chart.timeScale().fitContent();restore();};
  let socket;
  async function connect(){
    try {const health=await(await fetch('/health')).json();socket=new WebSocket(`ws://${location.hostname}:${health.ws_port}`);
      socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.timeframe!=='1m'||!['history','tick'].includes(m.type))return;
        const values=m.type==='history'?m.bars:[...(snapshots.get(m.symbol)||[]),m.bar],clean=MarketData.clean(values);snapshots.set(m.symbol,clean);
        if(m.symbol===symbol){const initial=!bars.length;bars=clean;series.setData(bars);if(initial)chart.timeScale().fitContent();$('lab-status').textContent=`${symbol} · ${bars.length} nến 1m từ bridge`;}
      };
      socket.onclose=()=>{$('lab-status').textContent='Mất kết nối · dữ liệu đã nhận';setTimeout(connect,3000);};
    }catch(error){$('lab-status').textContent=error.message;setTimeout(connect,3000);}
  }
  connect();window.addEventListener('pagehide',()=>{if(socket){socket.onclose=null;socket.close();}tools.destroy();chart.remove();},{once:true});
})().catch(error=>{document.getElementById('lab-report').textContent='Lỗi plugin: '+error.message;console.error(error);});
