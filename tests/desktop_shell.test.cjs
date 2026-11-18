const test=require('node:test'),assert=require('node:assert/strict');
const DesktopShell=require('../frontend/js/desktop_shell.js');
const vm=require('node:vm'),fs=require('node:fs'),DrawingModel=require('../frontend/js/drawing_model.js');
const context=vm.createContext({Intl,MarketData:{durations:{}},DrawingModel});vm.runInContext(fs.readFileSync('frontend/js/chart_engine.js','utf8')+';this.Engine=ChartEngine',context);
test('history prepend retains live right offset and historical candle timestamps',()=>{
  const old=[{time:180},{time:240},{time:3600}],next=[{time:60},{time:120},...old];
  const live=context.Engine.rebaseRange(old,next,{from:0,to:3},60);assert.equal(live.from,2);assert.equal(live.to,5);
  const history=context.Engine.rebaseRange(old,next,{from:0,to:1},60);assert.equal(history.from,2);assert.equal(history.to,3);
});

test('return-to-latest keeps zoom span and uses real loaded bar count and configured margin',()=>{
  const chart={bars:Array.from({length:800},(_,i)=>({time:i*60})),appearance:{rightMargin:10},chart:{timeScale:()=>({getVisibleLogicalRange:()=>({from:100,to:220})})}};
  const snapshot=JSON.stringify(chart.bars),range=DesktopShell.latestRange(chart);
  assert.deepEqual(range,{from:689,to:809});assert.equal(range.to-range.from,120);
  assert.equal(JSON.stringify(chart.bars),snapshot);
  assert.equal(DesktopShell.latestRange({...chart,bars:[]}),null);
});

test('return-to-latest handles an uninitialized viewport without borrowing another chart range',()=>{
  const chart={bars:[{time:10}],appearance:{rightMargin:0},chart:{timeScale:()=>({getVisibleLogicalRange:()=>null})}};
  assert.deepEqual(DesktopShell.latestRange(chart),{from:-100,to:0});
});

test('right-rail panels (DesktopShell and TerminalCompanions) close each other cleanly on tab switch and never overlap',()=>{
  const ctx=vm.createContext({
    Workspace:{read:(_,d)=>d,write:()=>true},
    ui:s=>s,
    document:{getElementById:()=>null,createElement:tag=>({tag,dataset:{},setAttribute(){}})}
  });
  vm.runInContext(fs.readFileSync('frontend/js/desktop_shell.js','utf8')+';this.Shell=DesktopShell;',ctx);
  vm.runInContext(fs.readFileSync('frontend/js/terminal_companions.js','utf8')+';this.Companions=TerminalCompanions;',ctx);

  const mkBtn=panel=>({dataset:{panel},active:false,attrs:{},classList:{toggle(c,v){if(c==='active')this._self.active=!!v;}},setAttribute(k,v){this.attrs[k]=v;}});
  const btns=['chart','watch','alerts'].map(p=>{const b=mkBtn(p);b.classList._self=b;return b;});
  const shell=Object.assign(Object.create(ctx.Shell.prototype),{
    mode:null,
    root:{dataset:{},hidden:true},
    content:{replaceChildren(){}},
    tabs:{replaceChildren(){},appendChild(){}},
    rail:{querySelectorAll:()=>btns,querySelector:()=>null},
    charts:[],
    getActive:()=>({id:'c1',symbol:'NQ1!',currentTimeframe:'1m',bars:[]}),
    getMarkets:()=>new Map(),
    getAlerts:()=>[],
    renderWatchlist(){},
    renderAlerts(){}
  });

  const mkPanel=()=>({inert:true,style:{},classList:{_s:new Set(),toggle(c,v){v?this._s.add(c):this._s.delete(c);},remove(...cs){cs.forEach(c=>this._s.delete(c));},contains(c){return this._s.has(c);}}});
  const comp=Object.assign(Object.create(ctx.Companions.prototype),{
    open:null,
    desktop:shell,
    panels:{calendar:mkPanel(),music:mkPanel()},
    updateMusicPopupButton(){},
    renderCalendar(){}
  });
  shell.companions=comp;

  // 1. Open Watchlist -> Watchlist active, Companion closed
  shell.open('watch',false);
  assert.equal(shell.mode,'watch');
  assert.equal(shell.root.hidden,false);
  assert.equal(btns[1].active,true);
  assert.equal(btns[0].active,false);

  // 2. Switch to Music -> Watchlist auto-closes, ONLY Music is open (no overlapping panels!)
  comp.toggle('music');
  assert.equal(comp.open,'music');
  assert.equal(shell.mode,null);
  assert.equal(shell.root.hidden,true);
  assert.equal(btns[0].active,false,'Chart button must not highlight while Music drawer is open');
  assert.equal(btns[1].active,false,'Watchlist button must un-highlight when Music opens');

  // 3. Switch to Alerts -> Music auto-closes, ONLY Alerts is open
  shell.open('alerts',false);
  assert.equal(comp.open,null);
  assert.equal(comp.panels.music.classList.contains('open'),false);
  assert.equal(shell.mode,'alerts');
  assert.equal(btns[2].active,true);

  // 4. Close Alerts -> Chart button becomes active again
  shell.open(null,false);
  assert.equal(btns[0].active,true);
});
