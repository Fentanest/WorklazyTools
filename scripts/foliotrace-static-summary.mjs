// Usage: node --experimental-strip-types scripts/foliotrace-static-summary.mjs <distRoot>
// Validates the data copied into dist and adds the static summary to the ko/en pages.
import { injectStaticSummary, validatePublicData } from './foliotrace-public-data.mjs'

const dist = process.argv[2] || 'dist'
const { manifest, snapshot } = await validatePublicData(dist)
await injectStaticSummary(dist, snapshot)
console.log(JSON.stringify({ datasetVersion: manifest.datasetVersion, injected: ['ko', 'en'] }))
