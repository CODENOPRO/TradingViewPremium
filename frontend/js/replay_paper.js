/* Replay uses only completed 1m closes. Live quotes never enter this ledger. */
class ReplayPaper {
 constructor({Paper,read=()=>null,save=()=>{}}){this.Paper=Paper;this.persist=save;this.saved=read()||{runs:[]};this.saved.runs ||= [];this.active=false;}
 write(){if(this.persist(this.saved)===false)throw Error('Không lưu được tài khoản Replay.');}
 checkpoint(state){const before=structuredClone(this.run);const points=this.run.points;const point={clock:this.clock,state:structuredClone(state)};if(points.at(-1)?.clock===this.clock)points[points.length-1]=point;else points.push(point);this.run.clock=this.clock;try{this.write();}catch(error){Object.assign(this.run,before);throw error;}}
 start(clock){
  this.clock=clock;this.run={id:crypto.randomUUID(),origin:clock,clock,points:[],branches:[]};this.saved.runs.push(this.run);if(this.saved.runs.length>10)this.saved.runs.splice(0,this.saved.runs.length-10);
  this.paper=new this.Paper(undefined,state=>this.checkpoint(state));this.paper.replay=true;this.paper.now=()=>this.clock*1000;
  this.paper.create('Replay · '+new Date(clock*1000).toISOString().slice(0,16),100000,0);this.active=true;
 }
 seek(clock,markets){
  if(!Number.isFinite(clock))throw Error('Đồng hồ Replay không hợp lệ.');
  if(!this.active){
   const last=this.saved.runs.at(-1);
   if(last?.points.length){this.run=last;this.clock=last.clock;this.paper=new this.Paper(structuredClone(last.points.at(-1).state),state=>this.checkpoint(state));this.paper.replay=true;this.paper.now=()=>this.clock*1000;this.active=true;}
   else this.start(clock);
  }
  if(clock<this.run.origin){this.start(clock);}else if(clock<this.clock){
   // Keep the abandoned branch; restore the last state known at the requested time.
   this.run.branches.push({clock:this.clock,points:structuredClone(this.run.points)});if(this.run.branches.length>12)this.run.branches.splice(0,this.run.branches.length-12);
   this.run.points=this.run.points.filter(p=>p.clock<=clock);
   this.paper.state=structuredClone(this.run.points.at(-1).state);this.paper.quotes.clear();this.clock=clock;this.run.clock=clock;this.write();
  }
  const previous=this.clock,events=[],latest=new Map(),allowed=new Set(markets.map(m=>m.symbol));
  for(const {symbol,bars} of markets){for(const bar of bars||[]){const end=bar.time+60;if(end>clock)break;if(!Number.isFinite(bar.close)||bar.close<=0)continue;latest.set(symbol,{price:bar.close,end});if(end>previous)events.push({symbol,price:bar.close,end});}}
  for(const symbol of this.paper.quotes.keys())if(!allowed.has(symbol)||!latest.has(symbol))this.paper.quotes.delete(symbol);
  // Prime all marks at the old clock before advancing; never mark another symbol with future prices.
  for(const {symbol,bars} of markets){const prior=(bars||[]).findLast(b=>b.time+60<=previous&&Number.isFinite(b.close)&&b.close>0);if(prior)this.paper.quotes.set(symbol,{price:prior.close,received:previous*1000});}
  events.sort((a,b)=>a.end-b.end||a.symbol.localeCompare(b.symbol));
  for(const event of events){this.clock=event.end;this.paper.tick(event.symbol,event.price);}
  this.clock=clock;
  for(const [symbol,q] of latest)this.paper.quotes.set(symbol,{price:q.price,received:q.end*1000});
  this.run.clock=clock;
 }
 leave(){if(this.active)this.write();this.active=false;}
}
if(typeof module!=='undefined')module.exports=ReplayPaper;
