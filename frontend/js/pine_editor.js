/* Lightweight editing controls; execution stays in the existing isolated Worker. */
class PineEditor {
  constructor(library) {
    this.library=library;this.modal=library.modal;
    this.code=document.getElementById('indicator-code');
    this.lines=document.getElementById('editor-lines');
    this.highlight=document.createElement('pre');this.highlight.className='editor-highlight';this.highlight.setAttribute('aria-hidden','true');this.code.before(this.highlight);
    this.cursor=document.getElementById('editor-cursor');
    this.code.addEventListener('input',()=>this.refresh());
    this.code.addEventListener('scroll',()=>this.scroll());
    for(const event of ['click','keyup','select'])this.code.addEventListener(event,()=>this.position());
    this.code.addEventListener('keydown',event=>{
      if(event.key==='Tab'){
        event.preventDefault();const edit=PineEditor.indent(this.code.value,this.code.selectionStart,this.code.selectionEnd,event.shiftKey);
        this.code.setRangeText(edit.text,edit.start,edit.end,'select');
        if(edit.cursor!==undefined)this.code.setSelectionRange(edit.cursor,edit.cursor);
        this.code.dispatchEvent(new Event('input',{bubbles:true}));
      }
    });
    this.modal.addEventListener('keydown',event=>{
      if(!(event.ctrlKey||event.metaKey)||library.section!=='editor')return;
      if(event.key.toLowerCase()==='s'||event.key==='Enter'){
        event.preventDefault();event.stopPropagation();library.save(event.key==='Enter');
      }
    });
    document.getElementById('editor-expand').onclick=()=>{
      this.modal.classList.toggle('editor-expanded');
      document.getElementById('editor-expand').setAttribute('aria-label',this.modal.classList.contains('editor-expanded')?'Restore editor':'Expand editor');
    };
    this.observer=new MutationObserver(()=>this.sync());
    this.observer.observe(this.modal,{attributes:true,attributeFilter:['class']});
  }
  static indent(value,start,end,unindent=false){
    const first=start>0?value.lastIndexOf('\n',start-1)+1:0;
    if(start===end&&!unindent)return {start,end,text:'    ',cursor:start+4};
    const stop=end>start&&value[end-1]==='\n'?end-1:end;
    const text=value.slice(first,stop).split('\n').map(line=>unindent?line.replace(/^( {1,4}|\t)/,''):'    '+line).join('\n');
    return {start:first,end:stop,text};
  }
  static highlight(value){
    const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    const token=/\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:\d+(?:\.\d+)?|if|else|for|while|var|varip|const|float|int|bool|string|color|type|method|import|as|export|true|false|na|and|or|not|switch|indicator|plot|input|request|ta|math|array|line|box|label|table|barstate|syminfo|timeframe)\b/g;
    let result='',previous=0;
    for(const match of value.matchAll(token)){
      result+=escape(value.slice(previous,match.index));
      const text=match[0],kind=text.startsWith('//')?'comment':/^['"]/.test(text)?'string':/^\d/.test(text)?'number':/^(if|else|for|while|var|varip|const|type|method|import|as|export|and|or|not|switch|true|false|na)$/.test(text)?'keyword':'builtin';
      result+='<span class="pine-'+kind+'">'+escape(text)+'</span>';previous=match.index+text.length;
    }
    return result+escape(value.slice(previous))+'\n';
  }
  scroll(){this.lines.scrollTop=this.code.scrollTop;this.highlight.scrollTop=this.code.scrollTop;this.highlight.scrollLeft=this.code.scrollLeft;}
  sync(){
    const editing=this.modal.classList.contains('show')&&this.library.section==='editor';
    if(this.modal.classList.contains('studio-editing')!==editing)this.modal.classList.toggle('studio-editing',editing);
    document.body.classList.toggle('pine-editor-open',editing);
    document.body.classList.toggle('pine-editor-expanded',editing&&this.modal.classList.contains('editor-expanded'));
    if(editing)this.refresh();
  }
  refresh(){
    const count=this.code.value.split('\n').length;
    if(count!==this.lineCount){this.lines.textContent=Array.from({length:count},(_,i)=>i+1).join('\n');this.lineCount=count;}
    this.highlight.innerHTML=PineEditor.highlight(this.code.value);this.scroll();this.position();
    const chart=this.library.chart;
    document.getElementById('editor-target').textContent=chart?`${chart.symbol} / ${chart.currentTimeframe} · ${chart.bars.length.toLocaleString()} bars`:'';
  }
  position(){const before=this.code.value.slice(0,this.code.selectionStart),parts=before.split('\n');this.cursor.textContent=`Ln ${parts.length}, Col ${parts.at(-1).length+1}`;}
}
if(typeof module!=='undefined')module.exports=PineEditor;
