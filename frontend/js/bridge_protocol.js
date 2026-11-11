/* Protocol checks prevent a legacy server from looking permanently "connecting". */
const BridgeProtocol={
  health(value){
    if(value?.type!=='bridge_status'||value.service!=='trading-terminal'||value.protocol_version!==2||!Number.isInteger(value.ws_port)||value.ws_port<1||value.ws_port>65535)throw Error('Backend cũ; khởi động lại server từ start_terminal.bat.');
    return value;
  },
  bars(previous,message){
    const incoming=MarketData.clean(message.type==='tick'?[message.bar]:Array.isArray(message.bars)?message.bars:[]);
    if(!incoming.length)return previous||[];
    return MarketData.clean([...(previous||[]),...incoming]).slice(-1500);
  }
};
if(typeof module!=='undefined')module.exports=BridgeProtocol;
