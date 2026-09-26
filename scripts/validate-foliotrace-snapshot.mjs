import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { validSnapshot } from '../src/features/foliotrace/data/loadSnapshot.ts'

const directory = process.argv[2] || 'dist'
const root = path.join(directory, 'data/foliotrace/v1')
const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'))
assert.match(manifest.datasetVersion, /^[a-f0-9]{64}$/)
assert.equal(manifest.snapshotPath, `snapshots/${manifest.datasetVersion}.json`)
const bytes = await fs.readFile(path.join(root, manifest.snapshotPath))
assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.snapshotSha256)
const snapshot = JSON.parse(bytes.toString('utf8'))
assert.equal(validSnapshot(snapshot, manifest.datasetVersion), true, 'FolioTrace snapshot schema invalid')
assert.equal(snapshot.holdings.length, snapshot.trackedCount)
assert.equal(snapshot.holdings.filter(row => row.estimatedValue !== null).length, snapshot.pricedCount)
for (const lang of ['ko', 'en']) {
  const html = await fs.readFile(path.join(directory, lang, 'tools/foliotrace/index.html'), 'utf8')
  assert.ok(html.includes(`data-foliotrace-dataset='${manifest.datasetVersion}'`))
  if (snapshot.estimatedValue !== null) assert.ok(html.includes(snapshot.estimatedValue))
}
console.log(JSON.stringify({ datasetVersion: manifest.datasetVersion, tracked: snapshot.trackedCount,
  priced: snapshot.pricedCount, snapshotSha256: manifest.snapshotSha256 }))
