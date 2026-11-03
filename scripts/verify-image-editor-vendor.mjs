import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../vendor/react-image-editor/', import.meta.url);
const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', root), 'utf8'));
if (manifest.forkCommit !== '263b8cfc347c822ff1bf4d2d85b5a95c0efe51d4') throw new Error('Unexpected image editor fork');
if (manifest.sourcePatch && !manifest.files.some(asset => asset.file === manifest.sourcePatch)) throw new Error('Missing pinned editor source patch');
if (manifest.packageFile) {
  const packageJson = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
  if (packageJson.dependencies[manifest.name] !== `file:vendor/react-image-editor/${manifest.packageFile}`) throw new Error('Editor package/manifest mismatch');
}
for (const asset of manifest.files) {
  if (!/^[\w.-]+$/.test(asset.file)) throw new Error('Invalid vendor filename');
  const bytes = await fs.readFile(new URL(asset.file, root));
  if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Image editor integrity: ${asset.file}`);
}
console.log(`Image editor fork verified: ${manifest.forkCommit}, ${manifest.files.length} assets`);
