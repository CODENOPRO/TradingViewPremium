const test = require('node:test');
const assert = require('node:assert/strict');
const DrawingModel = require('../frontend/js/drawing_model.js');

test('visibility is independent for minute/hour/day intervals and does not mutate saved settings', () => {
  const shape = DrawingModel.normalize({type:'box', p1:{time:60,price:1}, p2:{time:120,price:2}});
  shape.visibility.minutes.min=5;
  assert.equal(DrawingModel.visible(shape,'1m'),false);
  assert.equal(DrawingModel.visible(shape,'5m'),true);
  assert.equal(DrawingModel.visible(shape,'1h'),true);
  shape.visibility.hours.enabled=false;
  assert.equal(DrawingModel.visible(shape,'4h'),false);
  assert.equal(DrawingModel.visible(shape,'D'),true);
  const snapshot = JSON.stringify(shape);
  DrawingModel.normalize(shape);
  assert.equal(JSON.stringify(shape),snapshot);
});

test('coordinates follow actual loaded bar indices across session gaps', () => {
  const chart = {tfSeconds:60,bars:[{time:60},{time:120},{time:3600}]};
  assert.equal(DrawingModel.timeAt(chart,2),3600);
  assert.equal(DrawingModel.timeAt(chart,3),3660);
  assert.equal(DrawingModel.logicalIndex(chart,3600),2);
  assert.equal(DrawingModel.logicalIndex(chart,3660),3);
});

test('rectangle mixed corners resize the correct point; invisible shapes cannot be selected', () => {
  const chart = { currentTimeframe:'1m', tfSeconds:60,bars:[{time:60},{time:120}],
    chart:{timeScale:()=>({logicalToCoordinate:index=>index*100})},series:{priceToCoordinate:price=>price*10} };
  const shape=DrawingModel.normalize({type:'box',p1:{time:60,price:1},p2:{time:120,price:5}});
  assert.equal(DrawingModel.hit(chart,shape,0,50),'p1x_p2y');
  assert.equal(DrawingModel.hit(chart,shape,100,10),'p2x_p1y');
  shape.visibility.minutes.enabled=false;
  assert.equal(DrawingModel.hit(chart,shape,0,50),null);
});
