import assert from 'node:assert/strict'
import test from 'node:test'
import { compareRevision, sourceMeta } from '../../scripts/foliotrace-source-meta.mjs'

const a = 'a'.repeat(40)
const b = 'b'.repeat(40)

test('announced data revision: none, match or differs', () => {
  assert.equal(compareRevision('', a), 'none')
  assert.equal(compareRevision('  ', a), 'none')
  assert.equal(compareRevision(undefined, a), 'none')
  assert.equal(compareRevision(a, a), 'match')
  assert.equal(compareRevision(` ${a}\n`, a), 'match')
  assert.equal(compareRevision(b, a), 'differs')
  assert.throws(() => compareRevision(a, 'HEAD'))
})

test('source marker is strict and carries only the revision and dataset version', () => {
  assert.throws(() => sourceMeta('abc', 'c'.repeat(64)))
  assert.throws(() => sourceMeta(a, 'short'))
  assert.deepEqual(Object.keys(sourceMeta(a, 'c'.repeat(64))).sort(), ['datasetVersion', 'revision', 'schemaVersion'])
})
