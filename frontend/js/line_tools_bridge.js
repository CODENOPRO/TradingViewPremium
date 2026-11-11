/* One-way lab conversion. Originals remain intact; never writes the production drawing store. */
const LineToolsBridge={
  audit(expected,actual) {
    const equal=(a,b)=>typeof a==='number'?typeof b==='number'&&Math.abs(a-b)<1e-9:Array.isArray(a)?Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equal(v,b[i])):a&&typeof a==='object'?b&&Object.keys(a).every(k=>equal(a[k],b[k])):a===b;
    return expected.flatMap(a=>{const b=actual.find(x=>x.id===a.id);return !b?[`${a.id}: plugin không giữ ID`]:!equal(a.points,b.points)?[`${a.id}: plugin đã thay đổi tọa độ; chưa đạt migration`]:!equal(a.options,b.options)?[`${a.id}: plugin đã thay đổi options; cần đối chiếu`]:[];});
  },
  convert(values) {
    const tools=[],warnings=[];
    for(const [index,original] of values.entries()) {
      const d=DrawingModel.normalize(original),type={box:'Rectangle',fib:'FibRetracement',position:'LongShortPosition'}[d.type];
      if(!type){warnings.push(`${d.id}: ${d.type} chưa chuyển`);continue;}
      if(!d.p1||!d.p2||![d.p1.time,d.p1.price,d.p2.time,d.p2.price].every(Number.isFinite)){warnings.push(`${d.id}: tọa độ không hợp lệ`);continue;}
      const points=[d.p1,d.p2].map(p=>({timestamp:p.time,price:p.price})),extend={left:['left','both'].includes(d.extend),right:['right','both'].includes(d.extend)};
      const options={visible:DrawingModel.visible(d,'1m'),editable:!d.locked};
      const style={solid:0,dotted:1,dashed:2}[d.lineStyle]??0;
      if(d.type==='box') {
        options.rectangle={extend,border:{color:DrawingModel.rgba(d.borderColor,d.strokeOpacity),width:d.width,style,radius:0},background:{color:DrawingModel.rgba(d.fillColor,d.fillEnabled?d.fillOpacity:0)}};
        options.text={value:d.text,alignment:d.textStyle.horizontal,font:{color:d.textStyle.color,size:d.textStyle.size,bold:d.textStyle.bold,italic:d.textStyle.italic},box:{alignment:{horizontal:d.textStyle.horizontal,vertical:'middle'}}};
        if(d.middleLine.enabled)warnings.push(`${d.id}: Rectangle plugin chưa có middle line; giữ bản gốc để đối chiếu`);
        if(d.textStyle.vertical!=='inside')warnings.push(`${d.id}: vị trí text ngoài box chưa chuyển`);
      } else if(d.type==='fib') {
        // The plugin defines coefficient 0 at its second anchor; our saved format uses p1.
        points.reverse();
        options.line={width:d.width,style};options.extend=extend;
        options.levels=d.levels.map(coeff=>({coeff,color:d.color,opacity:0,distanceFromCoeffEnabled:false,distanceFromCoeff:0}));
      } else {
        if(!(d.riskReward>0)){warnings.push(`${d.id}: R:R không hợp lệ`);continue;}
        const stop=d.p1.price-(d.p2.price-d.p1.price)/d.riskReward;
        points.splice(1,0,{timestamp:d.p2.time,price:stop});
        options.showAutoText=true;
        warnings.push(`${d.id}: Position labels/style cần đối chiếu; không liên kết lệnh paper`);
      }
      const id='preview-'+(d.id??'legacy-'+index);
      if(tools.some(t=>t.id===id)){warnings.push(`${id}: ID gốc bị trùng; giữ bản gốc để xử lý`);continue;}
      tools.push({id,toolType:type,points,options});
    }
    return {tools,warnings,originals:JSON.parse(JSON.stringify(values))};
  }
};
if(typeof module!=='undefined')module.exports=LineToolsBridge;
