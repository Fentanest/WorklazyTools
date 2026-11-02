import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
const config = new URL('../../src/app/publicServiceConfig.mjs', import.meta.url).href;
for (const value of [undefined, 'library', 'legacy', 'invalid']) {
  test(`editor build flag ${value ?? 'default'}`, () => {
    const env = { ...process.env }; if (value === undefined) delete env.IMAGE_EDITOR_ENGINE; else env.IMAGE_EDITOR_ENGINE = value;
    const result = spawnSync(process.execPath, ['--input-type=module','-e',`import { IMAGE_EDITOR_ENGINE } from ${JSON.stringify(config)}; console.log(IMAGE_EDITOR_ENGINE);`], { env, encoding:'utf8' });
    if (value === 'invalid') { assert.notEqual(result.status,0); assert.match(result.stderr,/IMAGE_EDITOR_ENGINE must/); }
    else { assert.equal(result.status,0); assert.equal(result.stdout.trim(),value ?? 'library'); }
  });
}
