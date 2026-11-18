/* Paper account manager and ticket, backed by the persistent local ledger. */
class PaperPanel {
 constructor({paper,charts,getActive,isLive,isReplay,toast,onRender,onToggle}){
  Object.assign(this,{paper,charts,getActive,isLive,isReplay,toast,onRender,onToggle});this.root=document.getElementById('paper-panel');this.tab='positions';this.editing=null;
  this.root.innerHTML=`<div class="paper-resize" role="separator" aria-label="Resize Paper Trading" tabindex="0"></div><header class="paper-heading"><div class="paper-brand"><span class="paper-dot"></span><strong>Paper Trade</strong><small class="paper-mode-badge">SIM</small></div><div class="paper-account-group"><select id="paper-account" aria-label="Tài khoản"></select><button id="btn-new-account" type="button" class="paper-head-btn" title="Tạo tài khoản mới">+ Tài khoản</button></div><div class="paper-head-actions"><button type="button" class="paper-export paper-head-btn" title="Xuất lịch sử giao dịch CSV">CSV</button><button type="button" class="paper-close" aria-label="Close Paper Trading">×</button></div></header><div id="paper-balance" class="paper-summary"></div><div class="paper-workspace"><form class="paper-ticket"><div class="paper-ticket-title"><div class="paper-sym-pill"><strong id="paper-symbol"></strong></div><span id="paper-quote-status"></span></div><div class="paper-type-seg" role="tablist" aria-label="Loại lệnh"><button type="button" data-order-type="market" class="active">Market</button><button type="button" data-order-type="limit">Limit</button><button type="button" data-order-type="stop">Stop</button></div><select id="order-type" hidden aria-hidden="true"><option value="market">Market</option><option value="limit">Limit</option><option value="stop">Stop</option></select><div class="paper-ticket-grid"><div class="paper-field paper-qty-field"><div class="paper-field-top"><span>Hợp đồng</span><div class="paper-qty-chips"><button type="button" data-qty-chip="1">1</button><button type="button" data-qty-chip="2">2</button><button type="button" data-qty-chip="5">5</button><button type="button" data-qty-chip="10">10</button></div></div><div class="paper-qty-stepper"><button type="button" data-qty-step="-1" aria-label="Giảm hợp đồng">−</button><input id="order-qty" type="number" min="1" step="1" value="1" aria-label="Hợp đồng"><button type="button" data-qty-step="1" aria-label="Tăng hợp đồng">+</button></div></div><label class="paper-field paper-price-label"><span>Giá đặt lệnh</span><input id="order-price" type="number" step="any" placeholder="Nhập mức giá"></label><label class="paper-field"><span>Stop Loss</span><input id="order-sl" type="number" step="any" placeholder="Tùy chọn"></label><label class="paper-field"><span>Take Profit</span><input id="order-tp" type="number" step="any" placeholder="Tùy chọn"></label></div><div class="paper-estimate" id="paper-estimate"></div><div class="paper-submit"><button type="button" id="paper-sell" class="paper-side sell"><span>Sell / Short</span></button><button type="button" id="paper-buy" class="paper-side buy"><span>Buy / Long</span></button><button type="button" id="paper-save-edit" class="btn-primary" hidden>Lưu thay đổi</button><button type="button" id="paper-cancel-edit" class="btn-secondary" hidden>Hủy</button></div><p id="paper-error" role="status"></p><p class="paper-disclaimer"></p></form><div class="paper-manager"><nav class="paper-tabs" aria-label="Paper Trading views"><button type="button" data-paper-tab="positions">Vị thế <span>0</span></button><button type="button" data-paper-tab="orders">Lệnh chờ <span>0</span></button><button type="button" data-paper-tab="history">Lịch sử <span>0</span></button></nav><div id="paper-positions" class="paper-table-scroll"></div></div></div>`;
  this.$=id=>document.getElementById(id);
  if(typeof TerminalLanguage!=='undefined')TerminalLanguage.markup(this.root);
  this.root.querySelector('.paper-close').onclick=()=>this.open(false);this.$('btn-new-account').onclick=()=>{const modal=document.getElementById('account-modal');modal.dataset.opener='btn-new-account';modal.classList.add('show');modal.querySelector('input').focus();};
  this.$('paper-account').onchange=e=>this.action(()=>{this.paper.select(e.target.value);this.reset();});
  this.root.querySelector('.paper-export').onclick=()=>this.export();
  const archive=document.createElement('button');archive.type='button';archive.className='paper-head-btn';archive.textContent='Lưu Replay';archive.onclick=()=>this.exportReplay?.();this.root.querySelector('.paper-head-actions').insertBefore(archive,this.root.querySelector('.paper-close'));this.archiveButton=archive;
  this.root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();if(this.editing)this.reset();else this.open(false);}});
  for(const b of this.root.querySelectorAll('[data-paper-tab]'))b.onclick=()=>{this.tab=b.dataset.paperTab;this.render();};
  for(const b of this.root.querySelectorAll('[data-order-type]'))b.onclick=()=>{if(this.editing)return;this.$('order-type').value=b.dataset.orderType;this.$('order-type').dispatchEvent(new Event('input'));this.ticket();};
  for(const b of this.root.querySelectorAll('[data-qty-step]'))b.onclick=()=>{if(this.editing?.kind==='position')return;const next=Math.max(1,(parseInt(this.$('order-qty').value,10)||1)+Number(b.dataset.qtyStep));this.setQty(next);};
  for(const b of this.root.querySelectorAll('[data-qty-chip]'))b.onclick=()=>{if(this.editing?.kind==='position')return;this.setQty(Number(b.dataset.qtyChip));};
  this.root.addEventListener('paper-new-ticket',e=>{this.reset();this.$('order-type').value='limit';this.$('order-price').value=e.detail.price;this.open();this.ticket();});this.$('paper-buy').onclick=()=>this.submit('buy');this.$('paper-sell').onclick=()=>this.submit('sell');
  this.$('paper-save-edit').onclick=()=>this.submit();this.$('paper-cancel-edit').onclick=()=>this.reset();
  this.root.querySelector('form').onsubmit=e=>{e.preventDefault();if(this.editing)this.submit();};
  for(const id of ['order-type','order-qty','order-price','order-sl','order-tp'])this.$(id).addEventListener('input',()=>this.ticket());
  this.observer=new MutationObserver(()=>{const isOpen=this.root.classList.contains('open');document.body.classList.toggle('paper-panel-open',isOpen);this.onToggle?.(isOpen);this.render();});this.observer.observe(this.root,{attributes:true,attributeFilter:['class']});
  const indModal=document.getElementById('indicator-modal');
  if(indModal){this.indicatorObserver=new MutationObserver(()=>{if(indModal.classList.contains('show'))this.open(false);});this.indicatorObserver.observe(indModal,{attributes:true,attributeFilter:['class']});}
  this.buildCloseDialog();this.resize();
  for(const chart of charts){chart.paperOverlay=new PaperChartOrders(this,chart);}
  this.timer=setInterval(()=>this.render(false),1000);this.render();
 }
 setQty(qty){
  const v=String(Math.max(1,Math.round(qty)||1));
  this.$('order-qty').value=v;
  const iq=document.getElementById('trade-inline-qty');if(iq)iq.value=v;
  this.$('order-qty').dispatchEvent(new Event('input'));
  this.ticket();
 }
 money(value){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(value);}
 price(value){return Number.isFinite(value)?String(Math.round(value*1e8)/1e8):'—';}
 symbol(){return this.editing?.symbol||this.getActive().symbol;}
 guard(symbol,chart=null){
  if(this.replayBlocked)throw Error("Replay chưa sẵn sàng để giao dịch.");
  if(this.isReplay()){
   if(chart&&!chart.replayMode)throw Error('Biểu đồ đang chọn ở chế độ Live, ngoài phạm vi Replay.');
   const target=(chart&&chart.symbol===symbol&&chart.replayMode)?chart:this.charts.find(c=>c.symbol===symbol&&c.replayMode);
   if(!target)throw Error('Chart này không nằm trong phạm vi Replay.');
   this.paper.quote(symbol);return;
  }
  if(!this.isLive(symbol))throw Error('Đang chờ giá live 1m; không dùng giá cache để khớp lệnh.');
 }
 action(fn){try{fn();this.$('paper-error').textContent='';this.render();return true;}catch(error){this.$('paper-error').textContent=error.message;this.toast?.(error.message,'alert');this.render();return false;}}
 open(show=true){if(show)document.getElementById('indicator-modal')?.classList.remove('show');if(this.root.classList.contains('open')!==show)this.root.classList.toggle('open',show);}
 reset(){this.editing=null;this.$('order-type').value='market';for(const id of ['order-price','order-sl','order-tp'])this.$(id).value='';this.$('order-qty').value='1';const iq=document.getElementById('trade-inline-qty');if(iq)iq.value='1';this.$('paper-error').textContent='';this.ticket();}
 edit(kind,item,field){this.editing={kind,id:item.id,symbol:item.symbol,account:this.paper.state.active};this.open();this.$('order-type').value=kind==='order'?item.type:'market';this.$('order-qty').value=item.qty;for(const k of ['price','sl','tp'])this.$('order-'+k).value=item[k]??'';this.$('paper-error').textContent='';this.ticket();this.$('order-'+(field||'sl'))?.focus();}
 submit(side){this.action(()=>{const symbol=this.symbol(),origin=this.editing?null:this.getActive();this.guard(symbol,origin);const optional=id=>this.$(id).value.trim()?Number(this.$(id).value):null;const fields={qty:Number(this.$('order-qty').value),price:optional('order-price'),sl:optional('order-sl'),tp:optional('order-tp')};
   if(this.editing){
    if(this.editing.account!==this.paper.state.active)throw Error('Tài khoản đã đổi.');
    if(this.editing.kind==='order'){
     const existing=this.paper.account?.orders.find(o=>o.id===this.editing.id);
     if(!existing)throw Error('Lệnh chờ không còn tồn tại.');
     const next={...existing,qty:fields.qty,price:fields.price,sl:fields.sl,tp:fields.tp};
     const ref=this.paper.quote(existing.symbol);
     this.paper.validateOrder(next,existing,ref);
     this.paper.checkMargin?.(next,existing,ref);
     this.paper.amendOrder(this.editing.id,fields);
    }else this.paper.amendPosition(this.editing.id,{sl:fields.sl,tp:fields.tp});
    this.reset();
   }else this.placeFromChart(origin,{symbol,side,type:this.$('order-type').value,...fields});
   this.open();
  });}
 quickMarket(side){
  const hadAccount=!!this.paper.account;
  const ok=this.action(()=>{
   const chart=this.getActive(),symbol=chart.symbol;
   this.guard(symbol,chart);
   const qty=Number(document.getElementById('trade-inline-qty')?.value||this.$('order-qty').value);
   this.placeFromChart(chart,{symbol,side,type:'market',qty,price:null,sl:null,tp:null});
  });
  if(!ok&&!hadAccount)this.open(true);
  return ok;
 }
 placeFromChart(chart,order){
  this.guard(order.symbol,chart);
  if(!this.paper.account)throw Error('Tạo/chọn tài khoản demo trước.');
  const settings=chart.appearance||{};
  const reference=this.paper.quote(order.symbol);
  this.paper.validateOrder(order,chart.metadata,reference);
  this.paper.checkMargin?.(order,chart.metadata,reference);
  const project=settings.projectOrder&&order.type==='market';
  const execute=()=>{
   this.guard(order.symbol,chart);
   this.unlockExecutionAudio(settings);
   const item=this.paper.place(order,chart.metadata);
   if(!settings.rejectionOnly&&!this.paper.account.history.some(h=>h.id===item.id&&h.event==='filled')){
    this.toast?.('Paper order placed');
   }
  };
  if(settings.oneClick!==false&&!project){execute();return;}
  this.confirmOrder(chart,order,reference,project,execute);
 }
 confirmOrder(chart,order,reference,project,execute){
  const paper=this.paper,account=paper.state.active;
  const dialog=document.createElement('dialog');
  dialog.className='paper-order-confirmation';
  const message=document.createElement('p');
  message.textContent=order.side.toUpperCase()+' '+order.qty+' '+order.symbol+' · '+order.type.toUpperCase()+' · '+this.price(order.type==='market'?reference:order.price);
  const form=document.createElement('form');
  form.method='dialog';
  for(const [label,value] of [['Hủy','cancel'],['Xác nhận đặt lệnh','confirm']]){
   const button=document.createElement('button');
   button.type='submit';button.value=value;button.textContent=label;
   button.className=value==='confirm'?'btn-primary':'btn-secondary';form.append(button);
  }
  dialog.setAttribute('aria-label','Confirm paper order');
  dialog.append(message,form);
  document.body.append(dialog);
  if(project){chart.projectedOrder={...order,price:reference};chart.renderDrawings();}
  dialog.addEventListener('close',()=>{
   chart.projectedOrder=null;
   chart.renderDrawings();
   const confirmed=dialog.returnValue==='confirm';
   dialog.remove();
   if(confirmed)this.action(()=>{
    if(this.paper!==paper||paper.state.active!==account||chart.symbol!==order.symbol)throw Error('Tài khoản hoặc chart đã đổi.');
    execute();
   });
  },{once:true});
  dialog.showModal();
 }
 reverse(chart,position){
  this.action(()=>{
   const live=this.paper.account?.positions.find(item=>item.id===position.id);
   if(!live)throw Error('Vị thế không còn tồn tại.');
   const side=live.side==='buy'?'sell':'buy';
   const quantity=this.paper.account.positions.filter(item=>item.symbol===live.symbol&&item.side===live.side).reduce((total,item)=>total+item.qty,0);
   this.placeFromChart(chart,{symbol:live.symbol,side,type:'market',qty:quantity*2});
  });
 }
 playExecution(settings){
  if(!settings.executionSound||!settings.executionVolume)return;
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return;
  const audio=this.executionAudio||=new Audio();
  if(audio.state!=='running'){audio.resume().then(()=>{if(audio.state==='running')this.playExecution(settings);}).catch(()=>{});return;}
  const notes=settings.executionTone==='Single Chime'?[659]:[523,659,784];
  const volume=settings.executionVolume/100*.12;
  notes.forEach((frequency,index)=>{
   const oscillator=audio.createOscillator(),gain=audio.createGain(),when=audio.currentTime+index*.085;
   oscillator.frequency.value=frequency;
   oscillator.connect(gain);gain.connect(audio.destination);
   gain.gain.setValueAtTime(volume,when);
   gain.gain.exponentialRampToValueAtTime(.001,when+.22);
   oscillator.start(when);oscillator.stop(when+.22);
  });
 }
 unlockExecutionAudio(settings){
  if(!settings.executionSound)return;
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  const audio=this.executionAudio||=new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{});
 }
 previewExecution(settings){this.playExecution({...settings,executionSound:true});}
 notifyExecutions(account){
  const prior=this.executionCursor;
  const history=account?.history||[];
  this.executionCursor={paper:this.paper,id:account?.id,length:history.length,last:history.at(-1)?.id,at:history.at(-1)?.at};
  if(prior?.paper!==this.paper||prior.id!==account?.id||prior.length>history.length)return;
  const previous=history[prior.length-1];
  if(prior.length&&(previous?.id!==prior.last||previous?.at!==prior.at))return;
  const latest=history.slice(prior.length);
  const executions=latest.filter(item=>item.event==='filled'||item.event==='closed'&&item.reason!=='offset');
  if(executions.length){
   const event=executions.at(-1),chart=this.charts.find(item=>item.symbol===event.symbol)||this.getActive(),settings=chart.appearance||{};
   this.playExecution(settings);
   if(!settings.rejectionOnly)this.toast?.(event.symbol+(event.event==='filled'?' · Paper order filled':' · Paper position closed'));
  }
  for(const event of latest.filter(item=>item.event==='rejected'))this.toast?.(event.reason,'alert');
 }
 ticket(){
  const e=this.editing,active=this.getActive(),symbol=this.symbol(),q=this.paper.quotes.get(symbol);
  const chartInScope=!this.isReplay()||(e?this.charts.some(c=>c.symbol===symbol&&c.replayMode):active.replayMode);
  const fresh=!this.replayBlocked&&chartInScope&&!!q&&(this.isReplay()||(Date.now()-q.received<=5000&&this.isLive(symbol)));
  this.$('paper-symbol').textContent=symbol+(e?' · '+(e.kind==='order'?'Sửa lệnh':'SL / TP'):'');
  this.$('paper-quote-status').textContent=fresh?(this.isReplay()?'Replay · ':'Live · ')+this.price(q.price):this.isReplay()&&!chartInScope?'Ngoài Replay':this.isReplay()?'Chờ nến Replay':'Chờ giá live';
  this.$('paper-quote-status').dataset.live=String(fresh);
  const curType=this.$('order-type').value;
  for(const b of this.root.querySelectorAll('[data-order-type]')){b.classList.toggle('active',b.dataset.orderType===curType);b.disabled=!!e;}
  const qtyVal=Number(this.$('order-qty').value);
  for(const b of this.root.querySelectorAll('[data-qty-chip]')){b.classList.toggle('active',Number(b.dataset.qtyChip)===qtyVal);b.disabled=e?.kind==='position';}
  for(const b of this.root.querySelectorAll('[data-qty-step]'))b.disabled=e?.kind==='position';
  this.root.querySelector('.paper-type-seg').hidden=e?.kind==='position';
  this.root.querySelector('.paper-qty-field').hidden=e?.kind==='position';
  const priceWrap=this.root.querySelector('.paper-price-label');
  const hidePrice=curType==='market'||e?.kind==='position';
  priceWrap.hidden=hidePrice;
  this.$('order-type').disabled=!!e;this.$('order-qty').disabled=e?.kind==='position';this.$('order-price').disabled=hidePrice;
  this.$('paper-buy').hidden=this.$('paper-sell').hidden=!!e;this.$('paper-save-edit').hidden=this.$('paper-cancel-edit').hidden=!e;
  for(const id of ['paper-buy','paper-sell','paper-save-edit'])this.$(id).disabled=!fresh;
  const meta=this.getActive().symbol===symbol?active.metadata:this.charts.find(c=>c.symbol===symbol)?.metadata||{};
  for(const id of ['order-price','order-sl','order-tp'])this.$(id).step=meta.tickSize||'any';
  const qty=Number(this.$('order-qty').value),reference=curType==='market'?q?.price:Number(this.$('order-price').value),sl=Number(this.$('order-sl').value),tp=Number(this.$('order-tp').value);
  const est=this.$('paper-estimate');
  est.classList.remove('insufficient');
  if(qty>0&&reference>0&&meta.pointValue){
   const parts=[];
   if(sl>0)parts.push('SL '+this.money(Math.abs(reference-sl)*qty*meta.pointValue));
   if(tp>0)parts.push('TP '+this.money(Math.abs(reference-tp)*qty*meta.pointValue));
   if(sl>0&&tp>0&&Math.abs(reference-sl)>0)parts.push('R:R '+(Math.abs(tp-reference)/Math.abs(reference-sl)).toFixed(2));
   if(!parts.length)parts.push('Giá trị '+this.money(reference*qty*meta.pointValue));
   est.textContent=parts.join(' · ');
  }else{
   est.textContent=e?.kind==='position'?'Nhập mức Stop Loss hoặc Take Profit mới.':'Chọn khối lượng & mức giá để tính rủi ro.';
  }
 }
 setPaper(paper){if(this.paper===paper)return;for(const chart of this.charts)chart.paperOverlay?.cancel();this.paper=paper;this.closeModal.classList.remove('show');this.accountSignature=null;this.reset();}
 render(redraw=true){
  const tr=v=>typeof ui==='function'?ui(v):v;
  this.archiveButton.hidden=!this.isReplay();
  this.root.querySelector('.paper-mode-badge').textContent=this.isReplay()?'REPLAY':'SIM';
  this.root.dataset.replay=String(!!this.isReplay());
  this.root.querySelector('.paper-disclaimer').textContent=this.isReplay()?'Khớp theo giá đóng nến 1m Replay · Tài khoản độc lập':'Khớp theo giá Last trực tiếp · Không tính phí & trượt giá';
  this.closeModal.querySelector('[data-close-confirm]').textContent=this.isReplay()?'Đóng theo giá Replay':'Đóng theo giá live';
  const a=this.paper.account,accounts=this.paper.state.accounts,signature=JSON.stringify([accounts.map(a=>[a.id,a.name]),this.paper.state.active]);
  this.notifyExecutions(a);
  if(signature!==this.accountSignature){this.accountSignature=signature;const select=this.$('paper-account');select.replaceChildren();if(!accounts.length)select.add(new Option('Chưa có tài khoản',''));for(const a of accounts)select.add(new Option(a.name,a.id));select.value=this.paper.state.active||'';}
  const stats=this.paper.summary(),unknownMark=a?.positions.some(p=>!this.paper.quotes.has(p.symbol));const summary=this.$('paper-balance');if(!summary.children.length)for(const [key,label] of [['balance','Balance'],['equity','Equity'],['unrealized','PnL mở'],['realized','Đã chốt']]){const cell=document.createElement('div');cell.innerHTML='<small></small><strong></strong>';cell.querySelector('small').textContent=tr(label);cell.dataset.stat=key;summary.appendChild(cell);}
  for(const cell of summary.children){const value=stats[cell.dataset.stat];cell.querySelector('strong').textContent=a&&!(unknownMark&&['equity','unrealized'].includes(cell.dataset.stat))?this.money(value):'—';cell.dataset.sign=['unrealized','realized'].includes(cell.dataset.stat)?value>0?'positive':value<0?'negative':'':'';}
  for(const button of this.root.querySelectorAll('[data-paper-tab]')){const tab=button.dataset.paperTab;button.classList.toggle('active',tab===this.tab);button.setAttribute('aria-selected',String(tab===this.tab));button.querySelector('span').textContent=tab==='positions'?a?.positions.length||0:tab==='orders'?a?.orders.length||0:a?.history.length||0;}
  this.ticket();this.renderTable();
  if(redraw)for(const chart of this.charts){chart.pendingOrders=(a?.orders||[]).filter(p=>p.symbol===chart.symbol);chart.positions=(a?.positions||[]).filter(p=>p.symbol===chart.symbol).map(p=>({...p,type:p.side}));chart.renderDrawings();}
  this.onRender?.();
 }
 button(label,action,variant=''){const b=document.createElement('button');b.type='button';b.textContent=label;b.className='paper-row-action'+(variant?' '+variant:'');b.onclick=action;return b;}
 renderTable(){
  const list=this.$('paper-positions'),a=this.paper.account;
  if(list.contains(document.activeElement)){for(const node of list.querySelectorAll('[data-paper-pnl]')){const p=a?.positions.find(p=>p.id===node.dataset.paperPnl);if(p)node.textContent=this.money(this.paper.pnl(p));}return;}
  list.replaceChildren();const records=this.tab==='positions'?a?.positions||[]:this.tab==='orders'?a?.orders||[]:[...(a?.history||[])].reverse().slice(0,200);
  if(!records.length){
   const empty=document.createElement('div');empty.className='paper-empty';
   empty.innerHTML='<strong></strong><span></span>';
   empty.querySelector('strong').textContent=!a?'Chưa có tài khoản mô phỏng':this.tab==='positions'?'Không có vị thế đang mở':this.tab==='orders'?'Không có lệnh chờ khớp':'Chưa có lịch sử giao dịch';
   empty.querySelector('span').textContent=!a?'Tạo tài khoản mới để chọn số vốn bắt đầu giao dịch.':this.tab==='positions'?'Đặt lệnh từ khung bên trái hoặc cụm nút Buy / Sell trên thanh công cụ.':'Mọi lệnh đã khớp, đóng hoặc hủy sẽ được ghi lại tại đây.';
   if(!a){const cta=document.createElement('button');cta.type='button';cta.className='btn-primary paper-empty-cta';cta.textContent='+ Tạo tài khoản Demo';cta.onclick=()=>this.$('btn-new-account').click();empty.appendChild(cta);}
   list.appendChild(empty);return;
  }
  const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody');const headers=this.tab==='history'?['Thời gian','Mã','Trạng thái','Chiều','HĐ','Giá','PnL / Lý do']:['Mã','Chiều','HĐ','Giá vào','SL','TP',this.tab==='positions'?'PnL mở':'Loại',''];head.innerHTML='<tr>'+headers.map(t=>'<th>'+t+'</th>').join('')+'</tr>';table.append(head,body);
  for(const item of records){const row=document.createElement('tr'),values=this.tab==='history'?[new Date(item.at||item.created).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+' · '+new Date(item.at||item.created).toLocaleDateString('vi-VN'),item.symbol,({'placed':'Đặt lệnh','filled':'Đã khớp','closed':'Đã đóng','cancelled':'Đã hủy','modified':'Sửa lệnh','modified-position':'Sửa SL/TP','rejected':'Từ chối'}[item.event]||item.event),item.side==='buy'?'LONG':item.side==='sell'?'SHORT':(item.side||'—'),item.qty,this.price(item.exit??item.price),item.pnl!=null?(item.pnl>=0?'+':'')+this.money(item.pnl)+(item.reason?' · '+({'offset':'Đảo chiều','stop-loss':'Stop Loss','take-profit':'Take Profit','manual':'Đóng tay'}[item.reason]||item.reason):''):item.reason||'—']:[item.symbol,item.side==='buy'?'LONG':'SHORT',item.qty,this.price(item.price),this.price(item.sl),this.price(item.tp),this.tab==='positions'?(this.paper.quotes.has(item.symbol)?(this.paper.pnl(item)>=0?'+':'')+this.money(this.paper.pnl(item)):'—'):item.type.toUpperCase()];
   for(let i=0;i<values.length;i++){
    const td=document.createElement('td');
    if((this.tab!=='history'&&i===1)||(this.tab==='history'&&i===3&&item.side)){
     const pill=document.createElement('span');pill.className='paper-side-pill';pill.dataset.side=item.side;pill.textContent=values[i];td.appendChild(pill);td.dataset.side=item.side;
    }else{
     td.textContent=values[i];
    }
    if(this.tab==='positions'&&i===6){const pnl=this.paper.pnl(item);td.dataset.paperPnl=item.id;td.dataset.sign=pnl>0?'positive':pnl<0?'negative':'';}
    if(this.tab==='history'&&i===6&&item.pnl!=null){td.dataset.sign=item.pnl>0?'positive':item.pnl<0?'negative':'';}
    row.appendChild(td);
   }
   if(this.tab!=='history'){const actions=document.createElement('td');actions.className='paper-actions-cell';actions.append(this.button(this.tab==='positions'?'SL / TP':'Sửa',()=>this.edit(this.tab==='positions'?'position':'order',item)));actions.append(this.button(this.tab==='positions'?'Đóng':'Hủy',()=>this.tab==='positions'?this.closeDialog(item):this.action(()=>this.paper.cancel(item.id)),'danger'));row.appendChild(actions);}body.appendChild(row);
  }
  list.appendChild(table);if(this.tab==='history'&&(a?.history.length||0)>200){const note=document.createElement('small');note.textContent='Hiển thị 200 giao dịch gần nhất · Nhấn CSV để tải toàn bộ.';list.appendChild(note);}
 }
 buildCloseDialog(){this.closeModal=document.createElement('div');this.closeModal.className='modal';this.closeModal.setAttribute('role','dialog');this.closeModal.setAttribute('aria-modal','true');this.closeModal.setAttribute('aria-label','Đóng vị thế mô phỏng');this.closeModal.innerHTML='<div class="modal-content paper-close-dialog"><div class="modal-header"><span>Đóng vị thế</span><button class="modal-close" aria-label="Hủy đóng vị thế">×</button></div><div class="modal-body"><p class="paper-close-description"></p><label>Số hợp đồng đóng<input type="number" min="1" step="1" aria-label="Số hợp đồng đóng"></label><p class="paper-close-error" role="status"></p></div><div class="modal-footer"><button class="btn-secondary" data-close-cancel>Hủy</button><button class="btn-primary" data-close-confirm>Đóng theo giá live</button></div></div>';document.body.appendChild(this.closeModal);for(const b of this.closeModal.querySelectorAll('.modal-close,[data-close-cancel]'))b.onclick=()=>this.closeModal.classList.remove('show');this.closeModal.querySelector('[data-close-confirm]').onclick=()=>{try{if(this.closeTarget.account!==this.paper.state.active)throw Error('Tài khoản đã đổi.');this.guard(this.closeTarget.symbol);this.paper.close(this.closeTarget.id,'manual',Number(this.closeModal.querySelector('input').value));this.closeModal.classList.remove('show');this.render();}catch(error){this.closeModal.querySelector('.paper-close-error').textContent=error.message;}};this.closeModal.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();this.closeModal.classList.remove('show');}};}
 closeDialog(p){this.closeTarget={id:p.id,symbol:p.symbol,account:this.paper.state.active};this.closeModal.querySelector('.paper-close-description').textContent=`${p.side.toUpperCase()} ${p.qty} ${p.symbol} · Giá vào ${this.price(p.price)}. Có thể đóng một phần.`;const input=this.closeModal.querySelector('input');input.max=p.qty;input.value=p.qty;this.closeModal.querySelector('.paper-close-error').textContent='';this.closeModal.classList.add('show');input.focus();}
 resize(){const grip=this.root.querySelector('.paper-resize');let drag;const set=value=>{const maxW=typeof innerWidth==='number'&&innerWidth>500?Math.min(600,Math.round(innerWidth*.48)):520;this.width=Math.max(310,Math.min(maxW,value));this.root.style.setProperty('--paper-width',this.width+'px');document.body.style.setProperty('--paper-width',this.width+'px');};let preferred=Workspace.read('paper_panel_width_v1',390);set(preferred);window.addEventListener('resize',()=>set(preferred));grip.onpointerdown=e=>{drag={x:e.clientX,width:this.width};grip.setPointerCapture(e.pointerId);};grip.onpointermove=e=>{if(drag)set(drag.width+drag.x-e.clientX);};grip.onpointerup=grip.onpointercancel=()=>{if(drag){preferred=this.width;Workspace.write('paper_panel_width_v1',this.width);}drag=null;};grip.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();set(this.width+(e.key==='ArrowLeft'?20:-20));preferred=this.width;Workspace.write('paper_panel_width_v1',this.height=this.width);}};}
 export(){const a=this.paper.account;if(!a)return;const rows=[['time','symbol','event','side','quantity','entry','exit','realized_pnl','reason'],...a.history.map(h=>[new Date(h.at||h.created).toISOString(),h.symbol,h.event,h.side,h.qty,h.price,h.exit,h.pnl,h.reason])];const cell=v=>{let s=String(v??'');if(typeof v!=='number'&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='paper-history.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
/* Canvas labels with DOM hit targets: TopstepX-style order lines, zones, axis tags & segmented badges. */
class PaperChartOrders {
 constructor(panel,chart){
  this.panel=panel;this.chart=chart;this.buttons=new Map();this.execMarks=[];this.hoverExec=null;
  this.layer=document.createElement('div');this.layer.className='paper-chart-controls';chart.container.appendChild(this.layer);
  chart.container.addEventListener?.('pointermove',e=>this.onHoverMove(e));
  chart.container.addEventListener?.('pointerleave',()=>{if(this.hoverExec!=null){this.hoverExec=null;this.chart.renderDrawings();}});
 }
 onHoverMove(e){
  if(!this.execMarks.length){if(this.hoverExec!=null){this.hoverExec=null;this.chart.renderDrawings();}return;}
  const rect=this.chart.container.getBoundingClientRect();
  const mx=e.clientX-rect.left,my=e.clientY-rect.top;
  let hit=null,best=Infinity;
  for(const m of this.execMarks){
   const minY=Math.min(m.tipY,m.tailY)-14,maxY=Math.max(m.tipY,m.tailY)+14;
   const dx=Math.abs(mx-m.x);
   if(dx<=14&&my>=minY&&my<=maxY){
    const d=dx+Math.abs(my-(m.tipY+m.tailY)/2);
    if(d<best){best=d;hit=m.id;}
   }
  }
  if(hit!==this.hoverExec){this.hoverExec=hit;this.chart.renderDrawings();}
 }
 records(){const a=this.panel.paper.account;return {positions:(a?.positions||[]).filter(p=>p.symbol===this.chart.symbol),orders:(a?.orders||[]).filter(p=>p.symbol===this.chart.symbol)};}
 isLightChart(){
  const hex=String(this.chart.appearance?.bg||this.chart.config?.bg||'#c2baae').replace('#','');
  if(!/^[\da-f]{6}$/i.test(hex))return true;
  const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.42;
 }
 formatAxisPrice(price){
  if(typeof ChartContextMenu!=='undefined'&&ChartContextMenu.formatPrice)return ChartContextMenu.formatPrice(price,this.chart.metadata,this.chart.appearance);
  return this.panel.price(price);
 }
 entryStartX(position,width){
  const bars=this.chart.bars||[],scale=this.chart.chart.timeScale();
  if(!bars.length)return 0;
  let ts=position.created?position.created/1000:null;
  if(!Number.isFinite(ts)){
   const filled=this.panel.paper.account?.history?.findLast(h=>h.id===position.id&&h.event==='filled');
   if(filled?.at)ts=filled.at/1000;
  }
  if(!Number.isFinite(ts))return Math.max(0,Math.round(width*.25));
  if(ts<=bars[0].time){const x0=scale.timeToCoordinate(bars[0].time);return x0!==null?Math.max(0,Math.min(width,x0)):0;}
  let lo=0,hi=bars.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(bars[mid].time<=ts)lo=mid+1;else hi=mid;}
  const bar=bars[Math.max(0,lo-1)];
  const x=bar?scale.timeToCoordinate(bar.time):null;
  if(x!==null)return Math.max(0,Math.min(width,x));
  const range=scale.getVisibleLogicalRange();
  if(range&&lo-1<range.from)return 0;
  return Math.max(0,width);
 }
 hitButton(key,record,kind,price,x,y,w,h,label,title,cursor){
  let button=this.buttons.get(key);
  if(!button){
   button=document.createElement('button');button.type='button';button.className='paper-chart-hit';button.dataset.key=key;
   button.onkeydown=e=>{
    if(e.key==='Enter'||e.key===' '){
     e.preventDefault();e.stopPropagation();
     const current=this.find(record.id);if(!current)return;
     const k=button.dataset.kind;
     if(k==='close'){if(this.chart.appearance?.oneClick!==false)this.panel.action(()=>{this.panel.guard(current.symbol);this.panel.paper.close(current.id,'manual');});else this.panel.closeDialog(current);}
     else if(k==='reverse')this.panel.reverse(this.chart,current);
     else if(k==='delsl')this.panel.action(()=>{this.panel.guard(current.symbol);this.panel.paper.amendPosition(current.id,{sl:null});});
     else if(k==='deltp')this.panel.action(()=>{this.panel.guard(current.symbol);this.panel.paper.amendPosition(current.id,{tp:null});});
     else if(k==='cancel')this.panel.action(()=>{this.panel.paper.cancel(current.id);});
     else this.panel.edit(k==='price'?'order':'position',current,k==='price'?'price':k==='entry'?'sl':k);
    }
   };
   button.onpointerdown=e=>this.start(e,record.id,button.dataset.kind);
   button.onpointermove=e=>this.move(e);
   button.onpointerup=e=>this.end(e);
   button.onpointercancel=()=>this.cancel();
   button.onlostpointercapture=()=>{if(this.drag)this.cancel();};
   this.layer.appendChild(button);this.buttons.set(key,button);
  }
  button.setAttribute('aria-label',label+' '+this.panel.price(price));
  button.title=title;button.dataset.id=record.id;button.dataset.kind=kind;
  button.hidden=false;
  Object.assign(button.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px',cursor});
 }
 drawSegmented(ctx,x,y,segments){
  const font='bold 11px Arial, Helvetica, sans-serif';
  ctx.font=font;
  const h=16,half=8;
  let cur=x;const boxes=[];
  for(let i=0;i<segments.length;i++){
   const seg=segments[i],pad=seg.pad??5,gw=seg.grip?8:0,w=Math.max(seg.minW||0,gw+Math.ceil(ctx.measureText(seg.text).width)+pad*2);
   ctx.fillStyle=seg.bg;ctx.fillRect(cur,y-half,w,h);
   if(seg.grip){
    ctx.fillStyle='rgba(0,0,0,.55)';
    for(const dx of [3,5.5])for(const dy of [-3.5,0,3.5])ctx.fillRect(cur+dx,y+dy-.5,1,1);
   }
   if(seg.closeIcon){
    ctx.strokeStyle='#222';ctx.lineWidth=1.1;ctx.lineCap='round';
    const cx=cur+w/2,cy=y;
    ctx.beginPath();ctx.moveTo(cx-3,cy-3);ctx.lineTo(cx+3,cy+3);ctx.moveTo(cx+3,cy-3);ctx.lineTo(cx-3,cy+3);ctx.stroke();
   }else{
    ctx.fillStyle=seg.fg||'#111';ctx.textBaseline='middle';ctx.textAlign=seg.center?'center':'left';
    ctx.fillText(seg.text,seg.center?cur+w/2:cur+gw+pad,y+.5);
   }
   if(i>0){ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cur+.5,y-half);ctx.lineTo(cur+.5,y+half);ctx.stroke();}
   boxes.push({x:cur,y:y-half,w,h,seg});
   cur+=w;
  }
  ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=1;ctx.strokeRect(x+.5,y-half+.5,cur-x-1,h-1);
  ctx.textAlign='left';
  return {boxes,totalW:cur-x};
 }
 drawAxisTag(ctx,width,axisW,height,y,price,bg,fg='#111'){
  if(y===null||y<0||y>height||axisW<=4)return;
  ctx.save();ctx.beginPath();ctx.rect(width,0,axisW,height);ctx.clip();
  const top=Math.max(0,Math.min(height-16,y-8));
  ctx.fillStyle=bg;ctx.fillRect(width+1,top,axisW-2,16);
  ctx.fillStyle=fg;ctx.font='bold 11px Arial, Helvetica, sans-serif';ctx.textBaseline='middle';ctx.textAlign='left';
  ctx.fillText(this.formatAxisPrice(price),width+5,top+8.5,axisW-8);
  ctx.restore();
 }
 draw(ctx,rect){
  const settings=this.chart.appearance||{};
  const {positions,orders}=this.records(),seen=new Set(),axisW=this.chart.chart.priceScale('right').width()||65,width=rect.width-axisW,height=this.chart.plotBottom;
  if(Boolean(this.chart.replayMode)!==Boolean(this.panel.isReplay())){for(const button of this.buttons.values())button.hidden=true;return;}
  const light=this.isLightChart(),green='#2bf22b',red='#ff1b1b',gray='#cccccc',closeGray=light?'#f4f4f4':'#c8c8c8';
  const entryLineCol=light?'#00b800':'#00ff00',tpLineCol=light?'#00b800':'#00ff00',orderLineCol=light?'#666666':'#e0e0e0';
  const chartRect=this.chart.container.getBoundingClientRect(),sidebar=document.getElementById('left-sidebar')?.getBoundingClientRect();
  const safeLeft=sidebar&&sidebar.right>chartRect.left&&sidebar.left<chartRect.left+width&&sidebar.top<chartRect.bottom&&sidebar.bottom>chartRect.top?Math.max(8,sidebar.right-chartRect.left+8):8;
  const hline=(y,col,dash,x1,x2)=>{
   ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
   ctx.strokeStyle=col;ctx.lineWidth=1;ctx.setLineDash(dash||[]);
   ctx.beginPath();ctx.moveTo(x1,Math.round(y)+.5);ctx.lineTo(x2,Math.round(y)+.5);ctx.stroke();
   ctx.restore();
  };
  const clampX=(x,w)=>Math.max(safeLeft,Math.min(x,Math.max(safeLeft,width-w-6)));
  const font='bold 11px Arial, Helvetica, sans-serif';
  const measureSegs=segs=>{
   ctx.save();ctx.font=font;
   let total=0;for(const s of segs)total+=Math.max(s.minW||0,(s.grip?8:0)+Math.ceil(ctx.measureText(s.text).width)+(s.pad??5)*2);
   ctx.restore();return total;
  };
  const rightPad=Math.min(64,Math.max(12,Math.round(width*.08)));
  const bracketPad=Math.min(rightPad+Math.round(Math.min(115,width*.16)),Math.max(rightPad,width-160));
  const orderPad=Math.min(rightPad+Math.round(Math.min(85,width*.12)),Math.max(rightPad,width-160));

  if(settings.positions!==false){
   for(const p of positions){
    const ye=this.chart.series.priceToCoordinate(p.price);
    const slPrice=this.drag?.id===p.id&&this.drag.kind==='sl'?this.drag.price:p.sl;
    const tpPrice=this.drag?.id===p.id&&this.drag.kind==='tp'?this.drag.price:p.tp;
    const ysl=slPrice!=null?this.chart.series.priceToCoordinate(slPrice):null;
    const ytp=tpPrice!=null?this.chart.series.priceToCoordinate(tpPrice):null;
    const hasQuote=this.panel.paper.quotes.has(p.symbol);
    const quotePrice=hasQuote?this.panel.paper.quotes.get(p.symbol).price:p.price;
    const pl=hasQuote?this.panel.paper.pnl(p,quotePrice):0;
    const plStr=hasQuote?(settings.pnlUnit==='Money'||!settings.pnlUnit?(pl<0?'-':'')+'$'+Math.abs(pl).toFixed(2):this.pnlText(p,quotePrice,settings.pnlUnit)):'—';

    // TopstepX layout: Entry closest to price axis, SL/TP & Pending staggered slightly left.
    const entrySegs=[];
    if(settings.pnl!==false&&settings.positionPnl!==false){
     entrySegs.push({text:plStr,bg:pl>=0?green:red,grip:true,kind:'entry'});
    }
    entrySegs.push({text:(p.side==='buy'?'':'-')+p.qty,bg:p.side==='buy'?green:red,grip:!entrySegs.length,kind:'entry'});
    entrySegs.push({text:'×',bg:closeGray,minW:17,pad:0,center:true,closeIcon:true,kind:'close'});
    if(settings.reversePosition)entrySegs.push({text:'↔',bg:closeGray,minW:19,pad:0,center:true,kind:'reverse'});
    const entryTotalW=measureSegs(entrySegs);
    const entryX=clampX(width-entryTotalW-rightPad,entryTotalW);

    // 1. Bracket Lines, Labels & Axis Tags (SL & TP)
    const drawBracket=(kind,price,y,lineCol,badgeBg,qtyBg,qtyText)=>{
     if(y===null||y<0||y>height)return;
     const v=this.panel.paper.pnl(p,price);
     const vStr=settings.bracketValue&&settings.bracketValue!=='Money'?this.pnlText(p,price,settings.bracketValue):'~ '+(v<0?'-':'+')+'$'+Math.abs(v).toFixed(2);
     const segs=[];
     if(settings.pnl!==false&&settings.bracketPnl!==false)segs.push({text:vStr,bg:badgeBg,grip:true,kind});
     else segs.push({text:kind.toUpperCase()+' '+this.formatAxisPrice(price),bg:badgeBg,grip:true,kind});
     segs.push({text:qtyText,bg:qtyBg,kind});
     segs.push({text:'×',bg:closeGray,minW:17,pad:0,center:true,closeIcon:true,kind:'del'+kind});
     const totalW=measureSegs(segs);
     const bx=clampX(width-totalW-bracketPad,totalW);
     hline(y,lineCol,[5,4],settings.extendedLines===false?bx:0,settings.extendedLines===false?bx+totalW:width);
     ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
     const {boxes}=this.drawSegmented(ctx,bx,y,segs);
     ctx.restore();
     this.drawAxisTag(ctx,width,axisW,height,y,price,badgeBg);
     const bodyBoxes=boxes.filter(b=>b.seg.kind===kind);
     const bodyW=bodyBoxes.reduce((n,b)=>n+b.w,0);
     const delBox=boxes.find(b=>b.seg.kind==='del'+kind);
     if(bodyBoxes.length){
      const k1=p.id+':'+kind;seen.add(k1);
      this.hitButton(k1,p,kind,price,bodyBoxes[0].x,Math.max(0,y-9),bodyW,18,kind.toUpperCase()+' '+vStr,'Kéo để sửa '+kind.toUpperCase(),'ns-resize');
     }
     if(delBox){
      const k2=p.id+':del'+kind;seen.add(k2);
      this.hitButton(k2,p,'del'+kind,price,delBox.x,Math.max(0,y-9),delBox.w,18,'Xóa '+kind.toUpperCase(),'Xóa '+kind.toUpperCase(),'pointer');
     }
    };
    if(slPrice!=null)drawBracket('sl',slPrice,ysl,red,red,red,(p.side==='buy'?'-':'')+p.qty);
    if(tpPrice!=null)drawBracket('tp',tpPrice,ytp,tpLineCol,green,green,(p.side==='buy'?'-':'')+p.qty);

    // 3. Entry Line, Label, Close/Reverse & Ghost +SL/+TP (placed to the left of Entry so Entry stays near price axis)
    if(ye!==null&&ye>=0&&ye<=height){
     hline(ye,entryLineCol,null,settings.extendedLines===false?entryX:0,settings.extendedLines===false?entryX+entryTotalW:width);
     ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
     const {boxes}=this.drawSegmented(ctx,entryX,ye,entrySegs);
     let gx=entryX-4;
     for(const [gkind,gcol] of [['tp',green],['sl',red]]){
      if(p[gkind]!=null||(this.drag?.id===p.id&&this.drag.kind===gkind))continue;
      const gsegs=[{text:'+'+gkind.toUpperCase(),bg:'#1e242d',fg:gcol,minW:32,pad:4,center:true,kind:gkind}];
      const gw=measureSegs(gsegs);
      if(gx-gw>=safeLeft){
       this.drawSegmented(ctx,gx-gw,ye,gsegs);
       const gk=p.id+':'+gkind;seen.add(gk);
       this.hitButton(gk,p,gkind,p.price,gx-gw,Math.max(0,ye-9),gw,18,'+'+gkind.toUpperCase(),'Kéo để đặt '+gkind.toUpperCase(),'ns-resize');
      }
      gx-=gw+3;
     }
     ctx.restore();
     this.drawAxisTag(ctx,width,axisW,height,ye,p.price,green);
     const entryBoxes=boxes.filter(b=>b.seg.kind==='entry');
     if(entryBoxes.length){
      const ek=p.id+':entry';seen.add(ek);
      this.hitButton(ek,p,'entry',p.price,entryBoxes[0].x,Math.max(0,ye-9),entryBoxes.reduce((n,b)=>n+b.w,0),18,`${p.side.toUpperCase()} ${p.qty} · ${plStr}`,'Sửa SL/TP vị thế','pointer');
     }
     const closeBox=boxes.find(b=>b.seg.kind==='close');
     if(closeBox){
      const ck=p.id+':close';seen.add(ck);
      this.hitButton(ck,p,'close',p.price,closeBox.x,Math.max(0,ye-9),closeBox.w,18,'Đóng vị thế',settings.oneClick!==false?'Đóng vị thế ngay (1-click)':'Đóng vị thế','pointer');
     }
     const revBox=boxes.find(b=>b.seg.kind==='reverse');
     if(revBox){
      const rk=p.id+':reverse';seen.add(rk);
      this.hitButton(rk,p,'reverse',p.price,revBox.x,Math.max(0,ye-9),revBox.w,18,'Đảo chiều','Đảo chiều vị thế','pointer');
     }
    }
   }

   // 4. Pending Orders (Limit / Stop)
   for(const o of orders){
    const price=this.drag?.id===o.id?this.drag.price:o.price;
    const y=this.chart.series.priceToCoordinate(price);
    if(y===null||y<0||y>height)continue;
    const typeLabel=(o.type==='limit'?'Limit':'Stop')+' '+(o.side==='buy'?'Buy':'Sell');
    const segs=[
     {text:typeLabel,bg:gray,grip:true,kind:'price'},
     {text:(o.side==='buy'?'':'-')+o.qty,bg:o.side==='buy'?green:red,kind:'price'},
     {text:'×',bg:closeGray,minW:17,pad:0,center:true,closeIcon:true,kind:'cancel'}
    ];
    const totalW=measureSegs(segs);
    const ox=clampX(width-totalW-orderPad,totalW);
    hline(y,orderLineCol,null,settings.extendedLines===false?ox:0,settings.extendedLines===false?ox+totalW:width);
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
    const {boxes}=this.drawSegmented(ctx,ox,y,segs);
    ctx.restore();
    this.drawAxisTag(ctx,width,axisW,height,y,price,gray);
    const bodyBoxes=boxes.filter(b=>b.seg.kind==='price');
    if(bodyBoxes.length){
     const ok=o.id+':price';seen.add(ok);
     this.hitButton(ok,o,'price',price,bodyBoxes[0].x,Math.max(0,y-9),bodyBoxes.reduce((n,b)=>n+b.w,0),18,`${typeLabel} ${o.qty}`,'Kéo để sửa giá lệnh chờ','ns-resize');
    }
    const cancelBox=boxes.find(b=>b.seg.kind==='cancel');
    if(cancelBox){
     const ck=o.id+':cancel';seen.add(ck);
     this.hitButton(ck,o,'cancel',price,cancelBox.x,Math.max(0,y-9),cancelBox.w,18,'Hủy lệnh chờ','Hủy lệnh chờ','pointer');
    }
   }
  }
  this.drawExecutions(ctx,width,height,settings);
  this.drawProjectedOrder(ctx,width,height);
  for(const [key,button]of this.buttons)if(!seen.has(key)){button.remove();this.buttons.delete(key);}
 }
 pnlText(position,price,unit){
  const points=(price-position.price)*(position.side==='buy'?1:-1);
  if(unit==='Ticks'&&position.tickSize>0)return (points/position.tickSize).toFixed(1)+' ticks';
  if(unit==='Percentage')return (100*points/position.price).toFixed(2)+'%';
  return this.panel.money(this.panel.paper.pnl(position,price));
 }
 drawProjectedOrder(ctx,width,height){
  const order=this.chart.projectedOrder;
  if(!order)return;
  const y=this.chart.series.priceToCoordinate(order.price);
  if(y===null||y<0||y>height)return;
  ctx.save();
  ctx.strokeStyle=ctx.fillStyle='#edc284';
  ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();
  ctx.font='12px Arial';
  ctx.fillText(order.side.toUpperCase()+' '+order.qty+' · Projected market order',12,Math.max(12,y-5));
  ctx.restore();
 }
 drawExecutions(ctx,width,height,settings){
  this.execMarks=[];
  if(settings.executionMarks===false)return;
  const chart=this.chart,scale=chart.chart.timeScale(),bars=chart.bars;
  if(!bars.length)return;
  const light=this.isLightChart(),halo=this.chart.appearance?.bg||this.chart.config?.bg||(light?'#c2baae':'#0f0f0f'),labelCol=settings.textColor||(light?'#111':'#e6e6e6');
  const stacks=new Map();
  ctx.save();
  ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
  for(const event of this.panel.paper.account?.history||[]){
   if(event.symbol!==chart.symbol||!(event.event==='filled'||event.event==='closed'&&event.reason!=='offset'))continue;
   const time=event.at/1000;
   const date=chart.replayMode?chart.replayClock:Date.now()/1000;
   if(time<bars[0].time||time>date)continue;
   let lo=0,hi=bars.length;
   while(lo<hi){const mid=(lo+hi)>>1;if(bars[mid].time<=time)lo=mid+1;else hi=mid;}
   const bar=bars[lo-1];
   if(!bar||time>TerminalTime.end(bar,chart.currentTimeframe,chart.displaySessionMetadata?.()||chart.metadata))continue;
   const execPrice=event.event==='closed'?event.exit:event.price;
   const x=scale.timeToCoordinate(bar.time);
   const buy=event.event==='filled'?event.side==='buy':event.side==='sell';
   const anchor=chart.series.priceToCoordinate(buy?bar.low:bar.high)??chart.series.priceToCoordinate(execPrice);
   if(x===null||anchor===null||x<0||x>width)continue;
   const sk=bar.time+':'+(buy?'b':'s'),idx=stacks.get(sk)||0;stacks.set(sk,idx+1);
   const dir=buy?1:-1,tipY=anchor+dir*(6+idx*24),tailY=tipY+dir*11;
   const color=buy?'#2962ff':'#f23645';
   const priceY=chart.series.priceToCoordinate(execPrice);
   const id=(event.id||'')+':'+event.at+':'+(buy?'b':'s')+':'+idx;
   const hovered=this.hoverExec===id;
   this.execMarks.push({id,x,tipY,tailY,priceY,buy,color,execPrice});
   if(hovered){
    const top=Math.min(tipY,tailY)-5,pillH=Math.abs(tailY-tipY)+10,rx=x-9,rw=18,rad=9;
    ctx.fillStyle=buy?'rgba(41,98,255,.22)':'rgba(242,54,69,.22)';
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(rx,top,rw,pillH,rad);
    else ctx.rect(rx,top,rw,pillH);
    ctx.fill();
   }
   ctx.lineCap='round';ctx.lineJoin='round';
   const strokeArrow=(col,lw)=>{
    ctx.strokeStyle=col;ctx.lineWidth=lw;
    ctx.beginPath();
    ctx.moveTo(x,tailY);ctx.lineTo(x,tipY);
    ctx.moveTo(x-4,tipY+dir*4.5);ctx.lineTo(x,tipY);ctx.lineTo(x+4,tipY+dir*4.5);
    ctx.stroke();
   };
   strokeArrow('#ffffff',hovered?3.8:2.8);
   strokeArrow(color,1.7);
   if(hovered&&priceY!==null&&priceY>=0&&priceY<=height){
    const strokeChevron=(col,lw)=>{
     ctx.strokeStyle=col;ctx.lineWidth=lw;
     ctx.beginPath();
     ctx.moveTo(x+5,priceY-4);ctx.lineTo(x,priceY);ctx.lineTo(x+5,priceY+4);
     ctx.stroke();
    };
    strokeChevron('#ffffff',3.8);
    strokeChevron(color,1.9);
   }
   if(settings.executionLabels!==false){
    const label=`${event.qty} @ ${this.formatAxisPrice(execPrice)}`;
    const ly=tailY+dir*11;
    ctx.font='500 11px Arial, Helvetica, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.strokeStyle=halo;ctx.lineWidth=3;ctx.strokeText(label,x,ly);
    ctx.fillStyle=labelCol;ctx.fillText(label,x,ly);
   }
  }
  ctx.textAlign='left';
  ctx.restore();
 }
 find(id){const values=this.records();return values.positions.find(p=>p.id===id)||values.orders.find(p=>p.id===id);}
 start(e,id,kind){
  if(e.button!==0)return;e.preventDefault();e.stopPropagation();const item=this.find(id);if(!item)return;
  if(kind==='entry'){this.panel.edit('position',item);return;}
  if(kind==='close'){if(this.chart.appearance?.oneClick!==false)this.panel.action(()=>{this.panel.guard(item.symbol,this.chart);this.panel.paper.close(item.id,'manual');});else this.panel.closeDialog(item);return;}
  if(kind==='reverse'){this.panel.reverse(this.chart,item);return;}
  if(kind==='delsl'){this.panel.action(()=>{this.panel.guard(item.symbol,this.chart);this.panel.paper.amendPosition(item.id,{sl:null});});return;}
  if(kind==='deltp'){this.panel.action(()=>{this.panel.guard(item.symbol,this.chart);this.panel.paper.amendPosition(item.id,{tp:null});});return;}
  if(kind==='cancel'){this.panel.action(()=>{this.panel.paper.cancel(item.id);});return;}
  try{this.panel.guard(item.symbol,this.chart);this.panel.paper.quote(item.symbol);}catch(error){this.panel.toast?.(error.message,'alert');return;}
  this.drag={id,kind,symbol:item.symbol,account:this.panel.paper.state.active,startY:e.clientY,price:item[kind]??item.price,button:e.currentTarget,pointer:e.pointerId,changed:false};this.drag.button.setPointerCapture(e.pointerId);
 }
 move(e){if(!this.drag)return;e.preventDefault();e.stopPropagation();const rect=this.chart.container.getBoundingClientRect(),price=this.chart.coordinateToPrice(e.clientY-rect.top);if(!Number.isFinite(price)||price<=0)return;const tick=this.chart.metadata.tickSize||this.find(this.drag.id)?.tickSize||.01;this.drag.price=Number((Math.round(price/tick)*tick).toFixed(8));this.drag.changed ||= Math.abs(e.clientY-this.drag.startY)>3;this.chart.renderDrawings();}
 end(e){if(!this.drag)return;e.preventDefault();e.stopPropagation();const drag=this.drag;this.drag=null;if(drag.button.hasPointerCapture(drag.pointer))drag.button.releasePointerCapture(drag.pointer);const item=this.find(drag.id);if(!item){this.chart.renderDrawings();return;}if(!drag.changed){this.panel.edit(drag.kind==='price'?'order':'position',item,drag.kind==='price'?'price':drag.kind);return;}
  this.panel.action(()=>{if(drag.account!==this.panel.paper.state.active||drag.symbol!==this.chart.symbol)throw Error('Tài khoản hoặc chart đã đổi; bỏ thay đổi giá.');this.panel.guard(item.symbol,this.chart);if(drag.kind==='price'){const ref=this.panel.paper.quote(item.symbol);this.panel.paper.checkMargin?.({...item,price:drag.price},item,ref);this.panel.paper.amendOrder(drag.id,{price:drag.price});}else this.panel.paper.amendPosition(drag.id,{[drag.kind]:drag.price});});
 }
 cancel(){const drag=this.drag;this.drag=null;if(drag?.button.hasPointerCapture(drag.pointer))drag.button.releasePointerCapture(drag.pointer);this.chart.renderDrawings();}
}
