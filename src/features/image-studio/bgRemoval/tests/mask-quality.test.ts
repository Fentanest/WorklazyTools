import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyMask, validateMask } from '../pixels.ts';
import { inferUsableMask } from '../inference.ts';
import { BgRemovalError, messages } from '../errors.ts';

const original = new Uint8ClampedArray([12, 34, 56, 255, 78, 90, 12, 128, 0, 0, 0, 0, 13, 14, 15, 255]);
for (const [name, values, logits] of [
  ['Safari alpha 232 constant', [2.3125, 2.3125, 2.3125, 2.3125], true],
  ['near constant', [.910001, .91, .910002, .91], false],
  ['low variance with an outlier', [...new Array(10000).fill(.5), .51], false],
  ['NaN', [-1, 1, NaN, 0], true],
  ['infinity', [-1, 1, Infinity, 0], true],
  ['varying saturated logits', [100, 200, 300, 400], true],
  ['all background', [0, 0, 0, 0], false],
  ['all foreground', [1, 1, 1, 1], false],
  ['empty output', [], false],
] as [string, number[], boolean][]) test(`${name}: reject before changing source RGB/alpha`, () => {
  const pixels = original.slice();
  assert.throws(() => applyMask(pixels, 4, 1, new Float32Array(values), values.length, 1, logits), { code: 'bg-mask-unusable' });
  assert.deepEqual(pixels, original);
});

test('valid foreground and background preserve RGB and existing transparency', () => {
  const pixels = original.slice();
  applyMask(pixels, 4, 1, new Float32Array([-20, 20, 20, -20]), 4, 1, true);
  assert.deepEqual([...pixels], [12, 34, 56, 0, 78, 90, 12, 128, 0, 0, 0, 0, 13, 14, 15, 0]);
  assert.ok(validateMask(new Float32Array([0, 1]), false).variance > .2);
});

test('degenerate GPU mask retries same product inference on WASM once', async () => {
  const providers: string[] = []; let fallbacks = 0;
  const result = await inferUsableMask('product', async provider => {
    providers.push(provider);
    return { data: new Float32Array(provider === 'webgpu' ? [2.3125, 2.3125] : [-20, 20]), width: 2, height: 1 };
  }, () => fallbacks++);
  assert.deepEqual(providers, ['webgpu', 'wasm']); assert.equal(fallbacks, 1);
  assert.deepEqual([...result.data], [-20, 20]);
});

test('unusable CPU retry rejects without applying either mask or retrying forever', async () => {
  const providers: string[] = [], pixels = original.slice();
  await assert.rejects(async () => {
    const mask = await inferUsableMask('product', async provider => {
      providers.push(provider); return { data: new Float32Array([2.3125, 2.3125]), width: 2, height: 1 };
    }, () => {});
    applyMask(pixels, 4, 1, mask.data, mask.width, mask.height, true);
  }, { code: 'bg-mask-unusable' });
  assert.deepEqual(providers, ['webgpu', 'wasm']); assert.deepEqual(pixels, original);
});

test('valid GPU inference does not pay for CPU retry', async () => {
  const providers: string[] = [];
  await inferUsableMask('product', async provider => { providers.push(provider); return { data: new Float32Array([-20, 20]), width: 2, height: 1 }; }, () => assert.fail('unexpected retry'));
  assert.deepEqual(providers, ['webgpu']);
});

test('portrait invalid mask and inference failures do not start a fallback', async () => {
  for (const mode of ['person', 'product'] as const) {
    const providers: string[] = [];
    await assert.rejects(inferUsableMask(mode, async provider => { providers.push(provider); throw new BgRemovalError('bg-out-of-memory'); }, () => assert.fail('unexpected retry')), { code: 'bg-out-of-memory' });
    assert.equal(providers.length, 1);
  }
  await assert.rejects(inferUsableMask('person', async () => ({ data: new Float32Array([.5, .5]), width: 2, height: 1 }), () => assert.fail('portrait retry')), { code: 'bg-mask-unusable' });
});

test('mask failure has localized user-facing feedback', () => {
  assert.match(messages.ko['bg-mask-unusable'], /배경을 구분하지 못했습니다.*원본/);
  assert.match(messages.en['bg-mask-unusable'], /Could not distinguish the background.*original image is unchanged/);
});
