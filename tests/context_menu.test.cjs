const test=require('node:test'),assert=require('node:assert/strict');
const ChartContextMenu=require('../frontend/js/chart_context_menu.js');
const chart={plotHeight:300,container:{clientWidth:700},metadata:{tickSize:.25},coordinateToTime:x=>60+x,coordinateToPrice:y=>100+y/100};
test('chart context point uses tick-rounded cursor price, never the latest quote',()=>{
  assert.deepEqual(ChartContextMenu.clickedPoint(chart,100,48),{time:160,price:100.5});
});
test('context menu does not offer a price from an indicator pane or price/time axes',()=>{
  assert.equal(ChartContextMenu.clickedPoint(chart,100,290),null);
  assert.equal(ChartContextMenu.clickedPoint(chart,690,100),null);
  assert.equal(ChartContextMenu.clickedPoint({...chart,coordinateToPrice:()=>null},100,100),null);
});
