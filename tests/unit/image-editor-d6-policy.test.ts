import assert from 'node:assert/strict';
import test from 'node:test';
import { actualShrinkNotice, classifyD6, draftD6Props } from '../../src/features/image-studio/editor/d6Policy.ts';

test('recommended draft separates coarse phones and fine non-touch PCs', () => {
  assert.equal(classifyD6({ primaryPointerCoarse: true }), 'A');
  // Viewport narrowing is not an input: a narrow desktop window remains B.
  assert.equal(classifyD6({ primaryPointerCoarse: false, maxTouchPoints: 0, screenShortEdgeCssPx: 1080 }), 'B');
});
test('fine external pointer on a tablet remains A; boundary and large touch PC are explicit', () => {
  const s = { primaryPointerCoarse: false, maxTouchPoints: 5 };
  assert.equal(classifyD6({ ...s, screenShortEdgeCssPx: 1032 }), 'A');
  assert.equal(classifyD6({ ...s, screenShortEdgeCssPx: 1100 }), 'A');
  assert.equal(classifyD6({ ...s, screenShortEdgeCssPx: 1101 }), 'B');
});
test('pointer-only candidate misses tablets with a fine primary pointer', () => {
  assert.equal(classifyD6({ primaryPointerCoarse: false }, 'primary-pointer'), 'B');
});
test('memory is an optional conservative auxiliary, not a requirement or device identity', () => {
  const s = { primaryPointerCoarse: false, maxTouchPoints: 10, screenShortEdgeCssPx: 1200 };
  assert.equal(classifyD6({ ...s, deviceMemoryGiB: 4 }, 'touch-memory-assisted'), 'A');
  for (const memory of [undefined, null, NaN, Infinity, -1, 8]) {
    assert.equal(classifyD6({ ...s, deviceMemoryGiB: memory }, 'touch-memory-assisted'), 'B');
  }
  assert.equal(classifyD6({ ...s, deviceMemoryGiB: 4 }), 'B');
});
test('unknown and invalid decisive signals fall back to A', () => {
  for (const s of [{}, { primaryPointerCoarse: null }, { primaryPointerCoarse: false },
    { primaryPointerCoarse: false, maxTouchPoints: -1 },
    { primaryPointerCoarse: false, maxTouchPoints: 0.5 },
    { primaryPointerCoarse: false, maxTouchPoints: 2, screenShortEdgeCssPx: NaN }]) {
    assert.equal(classifyD6(s), 'A');
  }
});
test('D6 draft passes exact caps and only JPEG quality', () => {
  for (const [tier, edge] of [['A', 4096], ['B', 8192]] as const) {
    const p = draftD6Props(tier);
    assert.deepEqual(p, { jpegExportQuality: 95, resolutionLimits: {
      inputMaxDimension: edge, cropMaxPixels: edge ** 2, flattenMaxPixels: edge ** 2, limitUrlInputs: true,
    } });
    assert.equal('exportQuality' in p, false);
  }
});
test('notice uses actual measured dimensions in both languages', () => {
  const from = { width: 6000, height: 4000 }, to = { width: 4096, height: 2731 };
  assert.equal(actualShrinkNotice(from, to, 'ko'), '이미지가 6000×4000에서 4096×2731픽셀로 줄어들었습니다. 현재 편집에는 줄어든 이미지를 사용합니다.');
  assert.equal(actualShrinkNotice(from, to, 'en'), 'The image was reduced from 6000×4000 to 4096×2731 pixels. Editing uses the reduced image.');
});
test('notice omits unchanged, upscaled, invalid, and unnormalized orientation sizes', () => {
  const from = { width: 6000, height: 4000 };
  for (const to of [from, { width: 7000, height: 5000 }, { width: 4000, height: 6000 }, { width: 0, height: 5 }, { width: NaN, height: 5 }]) {
    assert.equal(actualShrinkNotice(from, to, 'en'), null);
  }
});
