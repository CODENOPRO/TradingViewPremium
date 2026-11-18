/* Local simulator: fills use observed last trades, not fabricated bid/ask. */
class PaperTrading {
 constructor(state={accounts:[],active:null},save=()=>{}){
  this.state=state&&Array.isArray(state.accounts)?state:{accounts:[],active:null};this.persist=save;this.quotes=new Map();this.now=()=>Date.now();this.replay=false;
  for(const a of this.state.accounts)for(const k of ['positions','orders','history'])if(!Array.isArray(a[k]))a[k]=[];
 }
 get account(){return this.state.accounts.find(a=>a.id===this.state.active);}
 save(){if(this.persist(this.state)===false)throw Error('Không lưu được tài khoản. Thao tác chưa được áp dụng.');}
 transaction(action){const before=structuredClone(this.state);try{const result=action();this.save();return result;}catch(error){const existing=new Map(this.state.accounts.map(a=>[a.id,a]));before.accounts=before.accounts.map(a=>{const target=existing.get(a.id);if(target){for(const k of Object.keys(target))delete target[k];Object.assign(target,a);return target;}return a;});Object.assign(this.state,before);throw error;}}
 create(name,balance,marginPercent=0){
  if(!name.trim()||!Number.isFinite(balance)||balance<=0)throw Error('Tên hoặc balance không hợp lệ.');
  const m=Number.isFinite(marginPercent)&&marginPercent>=0?marginPercent:0;
  return this.transaction(()=>{const a={id:crypto.randomUUID(),name:name.trim(),balance,initialBalance:balance,marginPercent:m,positions:[],orders:[],history:[]};this.state.accounts.push(a);this.state.active=a.id;return a;});
 }
 select(id){if(!this.state.accounts.some(a=>a.id===id))throw Error('Tài khoản không tồn tại.');return this.transaction(()=>{this.state.active=id;});}
 quote(symbol){const q=this.quotes.get(symbol);if(!q||(!this.replay&&this.now()-q.received>5000)||!Number.isFinite(q.price)||q.price<=0)throw Error('Không có giá live mới để mô phỏng khớp lệnh.');return q.price;}
 pnl(p,price=this.quotes.get(p.symbol)?.price??p.price,qty=p.qty){return (price-p.price)*(p.side==='buy'?1:-1)*qty*p.pointValue;}
 equity(a=this.account){return a?a.balance+a.positions.reduce((n,p)=>n+this.pnl(p),0):0;}
 usedMargin(){return 0;}
 summary(a=this.account){return {balance:a?.balance||0,equity:this.equity(a),unrealized:a?.positions.reduce((n,p)=>n+this.pnl(p),0)||0,realized:a?.history.reduce((n,h)=>n+(h.event==='closed'?h.pnl||0:0),0)||0,margin:0,available:this.equity(a)};}
 validatePrice(price,tickSize,label){if(!Number.isFinite(price)||price<=0)throw Error(label+' không hợp lệ.');if(tickSize>0&&Math.abs(price/tickSize-Math.round(price/tickSize))>1e-6)throw Error(label+' phải theo bước giá '+tickSize+'.');}
 validateStops(item,reference){for(const [k,d] of [['sl',-1],['tp',1]])if(item[k]!=null){this.validatePrice(item[k],item.tickSize,k.toUpperCase());if((item[k]-reference)*(item.side==='buy'?1:-1)*d<=0)throw Error('SL/TP nằm sai phía giá tham chiếu.');}}
 validateOrder(order,metadata,quote){
  if(!['NQ1!','ES1!','YM1!','CL1!'].includes(order.symbol)||!['buy','sell'].includes(order.side)||!['market','limit','stop'].includes(order.type)||!Number.isInteger(order.qty)||order.qty<=0)throw Error('Lệnh không hợp lệ.');
  if(!Number.isFinite(metadata.pointValue)||metadata.pointValue<=0)throw Error('Chưa có thông số hợp đồng từ TradingView.');
  const reference=order.type==='market'?quote:order.price;this.validatePrice(reference,metadata.tickSize,'Giá lệnh');this.validateStops({...order,tickSize:metadata.tickSize},reference);
  if(this.triggered(order,quote))this.validateStops({...order,tickSize:metadata.tickSize},quote);
  if(order.type==='stop'&&(order.price-quote)*(order.side==='buy'?1:-1)<=0)throw Error('Buy Stop phải cao hơn giá hiện tại; Sell Stop phải thấp hơn.');
 }
 triggered(o,p){return o.type==='market'||(o.type==='limit'?(o.side==='buy'?p<=o.price:p>=o.price):(o.side==='buy'?p>=o.price:p<=o.price));}
 formatUsd(v){return '$'+Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
 requiredMargin(order,metadata,quote,a=this.account){return {needed:0,available:this.equity(a),offsetQty:0};}
 checkMargin(order,metadata,quote,a=this.account){
  if(!a)throw Error('Tạo/chọn tài khoản demo trước.');
  if(!Number.isFinite(a.balance))throw Error('Thông số tài khoản đã lưu không hợp lệ; giữ dữ liệu và kiểm tra trước khi giao dịch.');
 }
 place(order,metadata){if(!this.account)throw Error('Tạo/chọn tài khoản demo trước.');if(!Number.isFinite(this.account.balance))throw Error('Thông số tài khoản đã lưu không hợp lệ; giữ dữ liệu và kiểm tra trước khi giao dịch.');const price=this.quote(order.symbol);this.validateOrder(order,metadata,price);return this.transaction(()=>{const item={...order,id:crypto.randomUUID(),pointValue:metadata.pointValue,tickSize:metadata.tickSize,created:this.now()};if(this.triggered(item,price))this.fill(item,price,this.account);else{this.account.orders.push(item);this.account.history.push({...item,event:'placed',at:this.now()});}return item;});}
 settle(a,p,qty,price,reason){const pnl=this.pnl(p,price,qty),closed={...p,qty,margin:0};a.balance+=pnl;a.history.push({...closed,event:'closed',exit:price,pnl,reason,at:this.now()});p.qty-=qty;if(!p.qty)a.positions=a.positions.filter(x=>x.id!==p.id);}
 fill(order,price,a=this.account){
  let qty=order.qty;
  // New fills net by symbol. Legacy lots are not silently migrated.
  for(const p of [...a.positions])if(qty&&p.symbol===order.symbol&&p.side!==order.side){const n=Math.min(qty,p.qty);this.settle(a,p,n,price,'offset');qty-=n;}
  if(qty){const p=a.positions.find(p=>p.symbol===order.symbol&&p.side===order.side);if(p){p.price=(p.price*p.qty+price*qty)/(p.qty+qty);p.qty+=qty;p.margin=0;if(order.sl!=null)p.sl=order.sl;if(order.tp!=null)p.tp=order.tp;}else a.positions.push({...order,qty,price,margin:0});}
  a.history.push({...order,event:'filled',price,at:this.now()});
 }
 close(id,reason='manual',qty){const a=this.account,p=a?.positions.find(p=>p.id===id);if(!p)throw Error('Vị thế không còn tồn tại.');const n=qty??p.qty;if(!Number.isInteger(n)||n<=0||n>p.qty)throw Error('Số lượng đóng không hợp lệ.');const price=this.quote(p.symbol);return this.transaction(()=>this.settle(a,p,n,price,reason));}
 amendOrder(id,changes){const a=this.account,o=a?.orders.find(o=>o.id===id);if(!o)throw Error('Lệnh chờ không còn tồn tại.');const next={...o,...Object.fromEntries(Object.entries(changes).filter(([k])=>['qty','price','sl','tp'].includes(k)))};const price=this.quote(o.symbol);this.validateOrder(next,o,price);return this.transaction(()=>{Object.assign(o,next);a.history.push({...o,event:'modified',at:this.now()});if(this.triggered(o,price)){this.fill(o,price,a);a.orders=a.orders.filter(x=>x.id!==id);}});}
 amendPosition(id,changes){const a=this.account,p=a?.positions.find(p=>p.id===id);if(!p)throw Error('Vị thế không còn tồn tại.');const next={...p,...Object.fromEntries(Object.entries(changes).filter(([k])=>['sl','tp'].includes(k)))};this.validateStops(next,this.quote(p.symbol));return this.transaction(()=>{Object.assign(p,next);a.history.push({...p,event:'modified-position',at:this.now()});});}
 cancel(id){const a=this.account,o=a?.orders.find(o=>o.id===id);if(!o)return false;return this.transaction(()=>{a.orders=a.orders.filter(o=>o.id!==id);a.history.push({...o,event:'cancelled',at:this.now()});return true;});}
 tick(symbol,price){
  if(!Number.isFinite(price)||price<=0)return;this.quotes.set(symbol,{price,received:this.now()});
  const actionable=this.state.accounts.some(a=>a.orders.some(o=>o.symbol===symbol&&this.triggered(o,price))||a.positions.some(p=>p.symbol===symbol&&((p.sl!=null&&(price-p.sl)*(p.side==='buy'?1:-1)<=0)||(p.tp!=null&&(price-p.tp)*(p.side==='buy'?1:-1)>=0))));if(!actionable)return;
  this.transaction(()=>{for(const a of this.state.accounts){
   const existingIds=new Set(a.positions.map(p=>p.id));
   for(const o of [...a.orders])if(o.symbol===symbol&&this.triggered(o,price)){const before=structuredClone(a);try{this.validateStops(o,price);this.fill(o,price,a);}catch(error){Object.assign(a,before);a.history.push({...o,event:'rejected',reason:error.message,at:this.now()});}a.orders=a.orders.filter(x=>x.id!==o.id);}
   for(const p of [...a.positions])if(p.symbol===symbol&&existingIds.has(p.id)){const sign=p.side==='buy'?1:-1;if(p.sl!=null&&(price-p.sl)*sign<=0)this.settle(a,p,p.qty,price,'stop-loss');else if(p.tp!=null&&(price-p.tp)*sign>=0)this.settle(a,p,p.qty,price,'take-profit');}
  }});
 }
}
if(typeof module!=='undefined')module.exports=PaperTrading;
