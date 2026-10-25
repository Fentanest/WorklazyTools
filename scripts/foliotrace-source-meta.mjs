// Data source revision marker for the FolioTrace deployment (outside the contract folder data/foliotrace/v1).
//   write  <distRoot> <revision>        writes dist/data/foliotrace-source.json
//   decide <revision> <publishedUrl>    prints changed=true|false (for GITHUB_OUTPUT); fetch failure or a bad marker means changed=true
import fs from 'node:fs/promises'
import path from 'node:path'

const REVISION = /^[0-9a-f]{40}$/
const VERSION = /^[a-f0-9]{64}$/
export const META_PATH = 'data/foliotrace-source.json'

export function sourceMeta(revision, datasetVersion) {
  if (!REVISION.test(revision)) throw new Error('data repository revision must be a 40-hex commit id')
  if (!VERSION.test(datasetVersion)) throw new Error('invalid dataset version')
  return { schemaVersion: 1, revision, datasetVersion }
}

/** Returns the published revision, or null when the marker is absent, unreadable or malformed. */
export function publishedRevision(text) {
  try {
    const meta = JSON.parse(text)
    return meta && meta.schemaVersion === 1 && typeof meta.revision === 'string' && REVISION.test(meta.revision) ? meta.revision : null
  } catch { return null }
}

/** Deploy when the data repository head differs from the revision carried by the live site, or the live revision is unknown. */
export function needsDeploy(currentRevision, publishedText) {
  if (!REVISION.test(currentRevision)) throw new Error('current revision must be a 40-hex commit id')
  const live = publishedText === null ? null : publishedRevision(publishedText)
  return live === null || live !== currentRevision
}

async function main() {
  const [command, a, b] = process.argv.slice(2)
  if (command === 'write') {
    const manifest = JSON.parse(await fs.readFile(path.join(a, 'data/foliotrace/v1/manifest.json'), 'utf8'))
    await fs.writeFile(path.join(a, META_PATH), JSON.stringify(sourceMeta(b, manifest.datasetVersion)) + '\n')
    console.log(`wrote ${META_PATH}`)
  } else if (command === 'decide') {
    let text = null
    try {
      const response = await fetch(b, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      if (response.ok) text = await response.text()
      else console.log(`published marker status ${response.status}`)
    } catch (error) { console.log(`published marker unreachable: ${error.name}`) }
    console.log(`changed=${needsDeploy(a, text)}`)
  } else {
    throw new Error('usage: write <dist> <revision> | decide <revision> <url>')
  }
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) await main()
