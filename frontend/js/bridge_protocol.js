/* Protocol checks prevent a legacy server from looking permanently "connecting". */
const BridgeProtocol={
  health(value){
    if(value?.type!=='bridge_status'||value.service!=='trading-terminal'||value.protocol_version!==2||!Number.isInteger(value.ws_port)||value.ws_port<1||value.ws_port>65535)throw Error('Backend cũ; khởi động lại server từ start_terminal.bat.');
    return value;
  },
  bars(previous,message){
    const incoming=MarketData.clean(message.type==='tick'?[message.bar]:Array.isArray(message.bars)?message.bars:[]);
    if(!incoming.length)return previous||[];
    const existing=previous||[], result=[];
    let i=0,j=0,changed=false;
    while(i<existing.length && j<incoming.length){
      const a=existing[i],b=incoming[j];
      if(a.time<b.time){result.push(a);i++;}
      else if(a.time>b.time){result.push(b);j++;changed=true;}
      else{const same=['open','high','low','close','volume'].every(k=>a[k]===b[k]);result.push(same?a:b);changed ||= !same;i++;j++;}
    }
    while(i<existing.length)result.push(existing[i++]);
    while(j<incoming.length){result.push(incoming[j++]);changed=true;}
    return changed?result:existing;
  }
};
if(typeof module!=='undefined')module.exports=BridgeProtocol;
