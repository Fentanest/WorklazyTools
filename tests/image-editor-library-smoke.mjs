import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
/** Detect the rendered artifact, not the Node process's build-flag environment. */
export async function isLibraryImageEditor(page) {
  await page.waitForFunction(() => document.querySelector('[data-testid=library-image-editor] .lower-canvas') || document.querySelector('[data-testid=image-editor-canvas-stage] .lower-canvas'));
  return page.evaluate(() => !!document.querySelector('[data-testid=library-image-editor]'));
}
export async function assertLibraryDirectTool(page, purpose, language) {
  const features = JSON.parse(await fs.readFile(new URL(`../src/locales/${language}/features.json`, import.meta.url), 'utf8'));
  const label = features.image.library.labels[({resize:'Resize',mosaic:'Redact',watermark:'Text'})[purpose]];
  if (!label) throw new Error(`No library direct-entry assertion for ${purpose}`);
  await page.waitForFunction(`Array.from(document.querySelectorAll('.asp-panel__title')).some(node => node.textContent.includes(${JSON.stringify(label)}))`);
}
export async function runLibraryImageSmoke(base, output, { deviceScaleFactor = 1 } = {}) {
  await fs.mkdir(output, { recursive: true });
  const result = await exec(process.execPath, [fileURLToPath(new URL('./ie1/ui.mjs', import.meta.url))], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, TEST_BASE_URL:base, IE1_OUTPUT:path.resolve(output), IE1_DPR:String(deviceScaleFactor) }, maxBuffer: 8 * 1024 * 1024,
  });
  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const count = Number(result.stdout.match(/^# tests (\d+)$/m)?.[1]);
  if (!count || !/^# fail 0$/m.test(result.stdout)) throw new Error('Library image smoke did not execute positive passing tests');
  return count;
}
