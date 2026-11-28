import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { injectStaticSummary, validatePublicData } from '../../scripts/foliotrace-public-data.mjs';

for (const name of ['chart-snapshot-20261103', 'assumption-replay-20261113']) test(`static public gate and localized summary preserve ${name}`, async () => {
  const snapshot = JSON.parse(await fs.readFile(new URL(`../fixtures/foliotrace/${name}.json`, import.meta.url), 'utf8'));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ft-assumption-static-'));
  try {
    const data = path.join(root, 'data/foliotrace/v1'); await fs.mkdir(path.join(data, 'snapshots'), { recursive: true });
    const body = JSON.stringify(snapshot);
    await fs.writeFile(path.join(data, `snapshots/${snapshot.datasetVersion}.json`), body);
    await fs.writeFile(path.join(data, 'manifest.json'), JSON.stringify({ schemaVersion: 1, datasetVersion: snapshot.datasetVersion,
      snapshotPath: `snapshots/${snapshot.datasetVersion}.json`, snapshotSha256: createHash('sha256').update(body).digest('hex') }));
    assert.deepEqual((await validatePublicData(root)).snapshot, snapshot);
    for (const lang of ['ko', 'en']) {
      const dir = path.join(root, lang, 'tools/foliotrace'); await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'index.html'), '<main class="seo-static-fallback"></main>');
    }
    await injectStaticSummary(root, snapshot); await injectStaticSummary(root, snapshot);
    for (const lang of ['ko', 'en']) {
      const html = await fs.readFile(path.join(root, lang, 'tools/foliotrace/index.html'), 'utf8');
      assert.equal((html.match(/data-foliotrace-dataset=/g) ?? []).length, 1);
      assert.doesNotMatch(html, /rights_offering_not_subscribed/);
      if (name.startsWith('assumption')) {
        assert.match(html, /220522672863/);
        assert.match(html, lang === 'ko' ? /수량 가정 16종목/ : /16 quantity-assumed/);
        assert.match(html, lang === 'ko' ? /평가 방법 3/ : /valuation method 3/);
        assert.match(html, lang === 'ko' ? /증자 뒤 수량 미확인/ : /Quantity after rights offering unconfirmed/);
      } else assert.doesNotMatch(html, /quantity-assumed|수량 가정/);
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
