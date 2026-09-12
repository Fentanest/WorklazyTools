import assert from 'node:assert/strict';
import test from 'node:test';
import { clampMask, clientDelta, commitMasks, countMasks, emptyMaskHistory, redoMasks, undoMasks, unmaskedPages } from '../../src/features/document-redactor/uiState.ts';

test('redactor UI maps the displayed content box to source coordinates at any CSS zoom', () => {
  assert.deepEqual(clientDelta(150, 300, { width: 600, height: 1200 } as DOMRect, { width: 1200, height: 2400 }), { x: .25, y: .25 });
  assert.deepEqual(clientDelta(75, 150, { width: 300, height: 600 } as DOMRect, { width: 1200, height: 2400 }), { x: .25, y: .25 });
});

test('redactor UI clamps masks and keeps one history entry per commit', () => {
  const page={width:100,height:200}; const mask=clampMask({x:.95,y:-.2,w:.3,h:2.5},page);
  assert.deepEqual(mask,{x:.7,y:0,w:.3,h:1});
  const first=commitMasks(emptyMaskHistory(),{0:[mask]}); const second=commitMasks(first,{0:[{...mask,x:.6}]});
  assert.deepEqual(undoMasks(second).present,first.present); assert.deepEqual(redoMasks(undoMasks(second)).present,second.present);
});

test('redactor UI counts document masks and reports zero-based unmasked pages', () => {
  const masks={0:[{x:0,y:0,w:1,h:1}],2:[{x:0,y:0,w:1,h:1}]};
  assert.equal(countMasks(masks),2); assert.deepEqual(unmaskedPages(masks,4),[1,3]);
});
