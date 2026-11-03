import test from "node:test";
import assert from "node:assert/strict";
import { layoutMapLabels, leaderSegmentsCross, mapLeaderEnd, mapLeaderIntersectsPin, nearestMapPin, rectanglesOverlap, segmentDistanceSquared } from "../../src/features/timezone-calculator/mapLayout.ts";
import { exceedsMapDragThreshold } from "../../src/features/timezone-calculator/mapInteraction.ts";
import { geoEqualEarth } from "d3-geo";
import { WORLD_CITIES } from "../../src/features/timezone-calculator/cities.ts";

test("leader geometry includes endpoint and collinear contact without flagging separated paths", () => {
  const a={x:0,y:0},b={x:10,y:10};
  assert.equal(leaderSegmentsCross(a,b,{x:0,y:10},{x:10,y:0}),true);
  assert.equal(leaderSegmentsCross(a,b,b,{x:20,y:20}),true);
  assert.equal(leaderSegmentsCross(a,b,{x:4,y:4},{x:7,y:7}),true);
  assert.equal(leaderSegmentsCross(a,b,{x:20,y:0},{x:20,y:10}),false);
  assert.equal(segmentDistanceSquared({x:5,y:5},{x:0,y:0},{x:10,y:0}),25);
});

test("six real European and East Asian cities route without pin or leader intersections", () => {
  const projection=geoEqualEarth().fitExtent([[18,18],[942,482]],{type:"Sphere"});
  const cities=WORLD_CITIES.map(c=>{const p=projection([...c.coordinates])!;return{id:c.id,x:p[0],y:p[1]};});
  for(const ids of [["london","paris","berlin","amsterdam","madrid","rome"],["seoul","tokyo","beijing","hong-kong","taipei","manila"]])for(const zoom of[1,1.5,3]) {
    const pins=cities.map(p=>({...p,x:480+(p.x-480)*zoom,y:250+(p.y-250)*zoom}));
    const result=layoutMapLabels(ids.map((id,i)=>({...pins.find(p=>p.id===id)!,width:ids[0]==="seoul"?[84.35,84.35,99.02,84.35,113.73,99.02][i]:110,height:30.46})),pins,960,500);
    const segments=(l:typeof result[number])=>l.leaderPath.slice(1).map((p,i)=>[l.leaderPath[i],p] as const).filter(([a,b])=>Math.hypot(a.x-b.x,a.y-b.y)>.01);
    for(const label of result)for(const [a,b]of segments(label))for(const pin of pins)if(pin.id!==label.id)assert.ok(segmentDistanceSquared({x:pin.x,y:pin.y-10},a,b)>=81-1e-6,`${label.id}/${pin.id} at ${zoom}`);
    for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++)for(const[a,b]of segments(result[i]))for(const[c,d]of segments(result[j]))assert.equal(leaderSegmentsCross(a,b,c,d,0),false,`${result[i].id}/${result[j].id} at ${zoom}`);
  }
});

test("three nearby city pairs have independent, bounded label boxes, including zoomed edge anchors", () => {
  const anchors = [{ id: "seoul", x: 775, y: 130 }, { id: "tokyo", x: 807, y: 133 }, { id: "new-york", x: 312, y: 116 }, { id: "toronto", x: 304, y: 107 }, { id: "london", x: 479, y: 80 }, { id: "paris", x: 485, y: 92 }];
  for (const zoom of [1, 1.5, 3]) {
    const pins = anchors.map(p => ({ ...p, x: 480 + (p.x - 480) * zoom, y: 250 + (p.y - 250) * zoom }));
    const boxes = layoutMapLabels(pins.map(p => ({ ...p, width: 135, height: 24 })), pins, 960, 500);
    assert.equal(boxes.length, 6);
    for (const box of boxes) assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 960 && box.y + box.height <= 500);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.equal(rectanglesOverlap(boxes[i], boxes[j]), false);
  }
});

test("map gestures use a CSS-pixel threshold, with tiny motion kept as a click", () => {
  assert.equal(exceedsMapDragThreshold(100, 100, 102, 101), false);
  assert.equal(exceedsMapDragThreshold(100, 100, 106, 100), false);
  assert.equal(exceedsMapDragThreshold(100, 100, 106.1, 100), true);
  assert.equal(exceedsMapDragThreshold(100, 100, 104.3, 104.3), true);
});

test("leader clearance detects a crossed pin and keeps endpoints on the label edge", () => {
  const anchor = { id: "a", x: 100, y: 150 }, box = { x: 200, y: 20, width: 80, height: 20 };
  assert.deepEqual(mapLeaderEnd(anchor, box), { x: 200, y: 40 });
  assert.equal(mapLeaderIntersectsPin(anchor, box, { id: "b", x: 150, y: 100 }), true);
  assert.equal(mapLeaderIntersectsPin(anchor, box, { id: "b", x: 150, y: 130 }), false);
  assert.equal(mapLeaderIntersectsPin(anchor, box, { id: "b", x: 150, y: 100 }, 0), false);
});

test("six coincident anchors with longer translated labels do not hide one another", () => {
  const pins = Array.from({ length: 8 }, (_, i) => ({ id: String(i), x: 5, y: 3 }));
  const boxes = layoutMapLabels(pins.map(p => ({ ...p, width: 240, height: 30 })), pins, 960, 500);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.equal(rectanglesOverlap(boxes[i], boxes[j]), false);
  assert.ok(boxes.every(b => b.x >= 0 && b.y >= 0 && b.x + b.width <= 960 && b.y + b.height <= 500));
});

test("New York remains the pointer target even when Toronto paints last", () => {
  const ny = { id: "new-york", x: 312, y: 116 }, toronto = { id: "toronto", x: 304, y: 107 };
  for (const pins of [[ny, toronto], [toronto, ny]]) {
    assert.equal(nearestMapPin(pins, 312, 108)?.id, "new-york");
    assert.equal(nearestMapPin(pins, 304, 99)?.id, "toronto");
  }
  assert.equal(nearestMapPin([], 0, 0), undefined);
});
