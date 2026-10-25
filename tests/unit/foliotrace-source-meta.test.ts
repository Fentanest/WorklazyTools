import assert from 'node:assert/strict'
import test from 'node:test'
import { needsDeploy, publishedRevision, sourceMeta } from '../../scripts/foliotrace-source-meta.mjs'

const a = 'a'.repeat(40)
const b = 'b'.repeat(40)
const marker = (revision: string) => JSON.stringify(sourceMeta(revision, 'c'.repeat(64)))

test('deploy only when the data repository head differs from the live marker', () => {
  assert.equal(needsDeploy(a, marker(a)), false)
  assert.equal(needsDeploy(b, marker(a)), true)
})

test('unknown live revision means deploy (missing, malformed or wrong shape)', () => {
  for (const text of [null, '', 'not json', '{}', '{"schemaVersion":2,"revision":"' + a + '"}', '{"schemaVersion":1,"revision":"abc"}', 'null']) {
    assert.equal(publishedRevision(text as string), null, String(text))
    assert.equal(needsDeploy(a, text), true, String(text))
  }
})

test('marker and revision inputs are strict', () => {
  assert.throws(() => sourceMeta('abc', 'c'.repeat(64)))
  assert.throws(() => sourceMeta(a, 'short'))
  assert.throws(() => needsDeploy('HEAD', marker(a)))
  assert.deepEqual(Object.keys(sourceMeta(a, 'c'.repeat(64))).sort(), ['datasetVersion', 'revision', 'schemaVersion'])
})
