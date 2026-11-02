import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'src/features/image-studio/bgRemoval/model.manifest.json'), 'utf8'));
const selected = process.env.BG_REMOVAL_MODELS === 'person' ? manifest.models.filter(m => m.id === 'person') : manifest.models;
for (const model of selected) {
  if (!/^[a-f0-9]{40}$/.test(model.revision) || !/^[a-f0-9]{64}$/.test(model.sha256) ||
      model.sourceUrl !== `https://huggingface.co/${model.repo}/resolve/${model.revision}/${model.sourcePath}` ||
      !/^[\w-]+\/[\w.-]+$/.test(model.repo) || !Number.isSafeInteger(model.bytes)) throw new Error('Invalid pinned background model manifest');
  const cache = path.join(root, '.cache/image-studio-assets/bg-removal', model.id, model.revision, path.basename(model.sourcePath));
  const destination = path.join(root, 'public', model.url);
  if (!(await matches(cache, model))) {
    await fs.mkdir(path.dirname(cache), { recursive: true });
    const temporary = `${cache}.partial-${process.pid}`;
    try {
      const response = await fetch(model.sourceUrl, { headers: { 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(300_000) });
      if (!response.ok || !response.body) throw new Error(`Model download failed: ${model.id} HTTP ${response.status}`);
      let count = 0; const hash = createHash('sha256');
      const verifier = new Transform({ transform(chunk, encoding, callback) {
        count += chunk.length;
        if (count > model.bytes) return callback(new Error('Model exceeded its pinned byte count'));
        hash.update(chunk); callback(null, chunk);
      } });
      await pipeline(Readable.fromWeb(response.body), verifier, createWriteStream(temporary));
      if (count !== model.bytes || hash.digest('hex') !== model.sha256) throw new Error(`Pinned model integrity mismatch: ${model.id}`);
      await fs.rename(temporary, cache);
    } finally { await fs.rm(temporary, { force: true }); }
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(cache, destination);
  if (!(await matches(destination, model))) throw new Error(`Vendored model mismatch: ${model.id}`);
  console.log(`Background model verified: ${model.id} ${model.bytes} bytes ${model.sha256}`);
}
// A person-only deployment must not accidentally retain a previously vendored product model.
if (process.env.BG_REMOVAL_MODELS === 'person') await fs.rm(path.join(root, 'public/vendor/bg-removal/product'), { recursive: true, force: true });
async function matches(file, expected) {
  try {
    if ((await fs.stat(file)).size !== expected.bytes) return false;
    const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest('hex') === expected.sha256;
  } catch { return false; }
}
