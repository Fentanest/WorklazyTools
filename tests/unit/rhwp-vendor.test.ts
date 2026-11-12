import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function fixture(run: (root: string, vendor: string, manifest: any) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rhwp-vendor-policy-'));
  const vendor = path.join(root, 'public/vendor/rhwp-studio/0.9.0');
  try {
    for (const dir of ['scripts', 'src/config', 'public/vendor/rhwp-studio/0.9.0/assets']) fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.copyFileSync('scripts/validate-rhwp-vendor.mjs', path.join(root, 'scripts/validate-rhwp-vendor.mjs'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { '@rhwp/core': '0.9.0', '@rhwp/editor': '0.9.0' } }));
    fs.writeFileSync(path.join(root, 'src/config/rhwp.ts'), 'export const RHWP_VERSION = "0.9.0";');
    fs.writeFileSync(path.join(root, 'scripts/rhwp-worklazy.patch'), 'reviewed patch');
    const manifest = { version: '0.9.0', tag: 'v0.9.0', commit: 'c9095c5f67632e6721e800ccc7fb43ea49d26682', packages: { '@rhwp/core': '0.9.0', '@rhwp/editor': '0.9.0' }, externalWebFonts: false, withoutHwpCtrl: true, withoutAi: true, networkPolicy: 'same-origin-only', localPatch: { path: 'scripts/rhwp-worklazy.patch', sha256: sha('reviewed patch') }, files: {} };
    addFile(vendor, manifest, 'index.html', '<meta http-equiv="Content-Security-Policy" content="default-src self"><meta name="rhwp-version" content="0.9.0">');
    addFile(vendor, manifest, 'assets/main.js', 'console.log("local editor");');
    run(root, vendor, manifest);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function addFile(vendor: string, manifest: any, name: string, content: string) {
  fs.writeFileSync(path.join(vendor, name), content);
  manifest.files[name] = { bytes: Buffer.byteLength(content), sha256: sha(content) };
}
function validate(root: string, vendor: string, manifest: any) {
  fs.writeFileSync(path.join(vendor, 'rhwp-vendor.json'), JSON.stringify(manifest));
  return spawnSync(process.execPath, [path.join(root, 'scripts/validate-rhwp-vendor.mjs')], { encoding: 'utf8' });
}
test('vendor policy accepts an isolated output with nonzero runtime scan', () => fixture((root, vendor, manifest) => {
  const result = validate(root, vendor, manifest);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 runtime files scanned, AI artifacts=0/);
}));
test('vendor policy rejects AI chunks even with matching declared bytes and hashes', () => fixture((root, vendor, manifest) => {
  addFile(vendor, manifest, 'assets/ai-plugin-123.js', 'export const plugin = true;');
  const result = validate(root, vendor, manifest);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /AI.*청크/);
}));
for (const marker of ['@anthropic-ai/sdk', 'https://api.anthropic.com/v1/messages', 'https://api.openai.com/v1', 'https://generativelanguage.googleapis.com/v1beta', 'anthropic-version', 'x-stainless-runtime', 'ai-panel', 'ai-settings-dialog', 'ai-unlock-dialog']) {
  test(`vendor policy rejects ${marker} in a renamed, correctly hashed bundle`, () => fixture((root, vendor, manifest) => {
    addFile(vendor, manifest, 'assets/main.js', JSON.stringify(marker));
    const result = validate(root, vendor, manifest);
    assert.notEqual(result.status, 0); assert.match(result.stderr, /AI.*외부 AI API/);
  }));
}
test('vendor policy retains exact commit, file set and hash checks', () => fixture((root, vendor, manifest) => {
  manifest.commit = 'a'.repeat(40);
  assert.match(validate(root, vendor, manifest).stderr, /커밋 메타데이터/);
  manifest.commit = 'c9095c5f67632e6721e800ccc7fb43ea49d26682';
  fs.writeFileSync(path.join(vendor, 'assets/unexpected.js'), 'x');
  assert.match(validate(root, vendor, manifest).stderr, /파일 집합/);
  fs.unlinkSync(path.join(vendor, 'assets/unexpected.js'));
  fs.writeFileSync(path.join(vendor, 'assets/main.js'), 'x');
  assert.match(validate(root, vendor, manifest).stderr, /파일 크기/);
  manifest.files['assets/main.js'].bytes = 1;
  assert.match(validate(root, vendor, manifest).stderr, /파일 해시/);
}));
