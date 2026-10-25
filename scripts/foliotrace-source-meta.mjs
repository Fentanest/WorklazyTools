// Data source revision marker for the FolioTrace deployment (outside the contract folder data/foliotrace/v1).
//   write  <distRoot> <revision>        writes dist/data/foliotrace-source.json
//   compare <requested> <actual>        logs whether the revision the sender announced matches the checked-out data head
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REVISION = /^[0-9a-f]{40}$/
const VERSION = /^[a-f0-9]{64}$/
export const META_PATH = 'data/foliotrace-source.json'

export function sourceMeta(revision, datasetVersion) {
  if (!REVISION.test(revision)) throw new Error('data repository revision must be a 40-hex commit id')
  if (!VERSION.test(datasetVersion)) throw new Error('invalid dataset version')
  return { schemaVersion: 1, revision, datasetVersion }
}

/** 'none' (nothing announced), 'match', or 'differs'. A differing head is still deployed (it is newer data); the caller only logs it. */
export function compareRevision(requested, actual) {
  if (!REVISION.test(actual)) throw new Error('actual revision must be a 40-hex commit id')
  if (requested === undefined || requested === null || requested.trim() === '') return 'none'
  return requested.trim() === actual ? 'match' : 'differs'
}

async function main() {
  const [command, a, b] = process.argv.slice(2)
  if (command === 'write') {
    const manifest = JSON.parse(await fs.readFile(path.join(a, 'data/foliotrace/v1/manifest.json'), 'utf8'))
    await fs.writeFile(path.join(a, META_PATH), JSON.stringify(sourceMeta(b, manifest.datasetVersion)) + '\n')
    console.log(`wrote ${META_PATH}`)
  } else if (command === 'compare') {
    const result = compareRevision(a, b)
    if (result === 'differs') console.log(`::notice::announced data revision differs from the checked-out head ${b}; continuing with the head`)
    else console.log(`data revision ${result === 'match' ? 'matches the announcement' : 'not announced'}: ${b}`)
  } else {
    throw new Error('usage: write <dist> <revision> | compare <requested> <actual>')
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
