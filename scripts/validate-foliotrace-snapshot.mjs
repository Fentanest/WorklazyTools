// Usage: node --experimental-strip-types scripts/validate-foliotrace-snapshot.mjs <siteRoot> [--no-html]
//   siteRoot "public": validate the committed data before the build (use --no-html).
//   siteRoot "dist":   validate the built copy and the static summary in the ko/en pages.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { validatePublicData } from './foliotrace-public-data.mjs'

const args = process.argv.slice(2)
const noHtml = args.includes('--no-html')
const directory = args.find(arg => !arg.startsWith('--')) || 'dist'
const { manifest, snapshot, bytes } = await validatePublicData(directory)
if (!noHtml) {
  for (const lang of ['ko', 'en']) {
    const html = await fs.readFile(path.join(directory, lang, 'tools/foliotrace/index.html'), 'utf8')
    assert.ok(html.includes(`data-foliotrace-dataset='${manifest.datasetVersion}'`), `${lang} static summary missing or from another dataset`)
    if (snapshot.estimatedValue !== null) assert.ok(html.includes(snapshot.estimatedValue), `${lang} static summary lacks the estimated value`)
  }
}
console.log(JSON.stringify({ datasetVersion: manifest.datasetVersion, tracked: snapshot.trackedCount,
  priced: snapshot.pricedCount, snapshotSha256: manifest.snapshotSha256, bytes }))
