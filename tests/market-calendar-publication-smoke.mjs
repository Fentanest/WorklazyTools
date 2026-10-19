import { selectCalendarValue, selectCalendarDay } from './helpers/market-calendar-selection.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const origin = process.env.MCAL_ORIGIN || 'http://127.0.0.1:4427';
const output = process.env.MCAL_OUTPUT_DIR || '.review-tmp/mcal-copy';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.WORKLAZY_CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const checks = [], errors = [], external = [];
try {
  for (const lang of ['ko', 'en']) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1920, height: 1030 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : (external.push(route.request().url()), route.abort()));
    const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${origin}/${lang}/tools/market-calendar/`); await page.locator('.mcal-grid').waitFor();
    await selectCalendarValue(page, 1, '2026');
    for (const scenario of ['new-year', 'year-end-closed', 'year-end-pending', 'early-close', 'christmas-eve', 'duplicate-notes']) {
      const duplicate = scenario === 'duplicate-notes';
      const us = scenario === 'early-close' || scenario === 'christmas-eve' || duplicate;
      const month = scenario === 'new-year' ? 1 : scenario === 'early-close' || duplicate ? 11 : 12;
      const day = scenario === 'new-year' ? 1 : scenario === 'year-end-closed' ? 31 : scenario === 'year-end-pending' ? 30 : scenario === 'early-close' || duplicate ? 27 : 24;
      if (duplicate) {
        const payload = JSON.stringify([{ date: '20261127', venue: 'nyse', status: 'open', special: null, reason: null, sessions: [{ code: 'regular', start: '09:30:00', end: '13:00:00', tz: 'America/New_York' }], notes: [...Array(5).fill('추가 거래 일정 조건은 공식 근거 원문을 함께 확인하세요.'), '현행판 기준', '특수일: Early Close', '조기폐장: 13:00 종료'], sources: [] }]);
        const manifest = { schema_version: 1, generation_id: 'duplicate-notes-fixture', created_at: '2026-10-18T21:32:33Z', files: [{ year: 2026, path: 'calendar-2026.json', sha256: createHash('sha256').update(payload).digest('hex') }], scopes: [{ venue: 'nyse', year: 2026, included: true, validity: 'valid', last_checked_at: '2026-10-18T21:08:54Z', reason: null }] };
        await context.route('**/data/market-calendar/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().endsWith('manifest.json') ? JSON.stringify(manifest) : payload }));
        await page.getByRole('button', { name: lang === 'ko' ? '새로고침' : 'Refresh', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.mcal-metadata time')?.getAttribute('datetime') === '2026-10-18T21:32:33Z');
      }
      await selectCalendarValue(page, 0, us ? 'nyse' : 'krx'); await selectCalendarValue(page, 2, month); await selectCalendarDay(page, day);
      const detail = await page.locator('.mcal-detail').innerText();
      const expected = scenario === 'new-year' ? (lang === 'ko' ? /신정 휴장/ : /Closed for New Year/) : scenario === 'year-end-closed' ? (lang === 'ko' ? /연말 휴장/ : /Closed for the year-end holiday/) : scenario === 'year-end-pending' ? (lang === 'ko' ? /아직 확정되지 않은 일정/ : /Schedule not confirmed/) : (lang === 'ko' ? /조기폐장.*13:00.*마감/ : /Early close at 13:00/);
      assert.match(detail, expected);
      assert.doesNotMatch(detail, /발행본|현행판|조문|전용|고정 입력|추가 거래 일정 조건|special_expected|forced_unknown|registry|continuity|Publication notes|translation.*not.*available/i);
      if (lang === 'en') assert.doesNotMatch(detail, /[가-힣]/);
      const paragraphs = await page.locator('.mcal-detail > p').allTextContents(); assert.equal(paragraphs.length, new Set(paragraphs).size, 'no repeated date explanations');
      const metadata = await page.locator('.mcal-metadata').innerText();
      assert.equal(await page.locator('.mcal-metadata time').count(), 1);assert.match(metadata, lang === 'ko' ? /마지막 업데이트:.*한국 시간/ : /Last updated.*KST/);
      assert.doesNotMatch(metadata, /\d{4}-\d\d-\d\dT|발행|세대|generation|checked/i);
      assert.equal(await page.getByRole('heading', { name: /발행본 참고 사항|Publication notes/ }).count(), 0);
      if (us) assert.match(detail, lang === 'ko' ? /한국 시간.*23:30.*03:00/ : /Korea time.*23:30.*03:00/);
      assert.equal(errors.length, 0, JSON.stringify(errors)); assert.equal(external.length, 0, JSON.stringify(external));
      await page.locator('.mcal-detail').scrollIntoViewIfNeeded();await page.screenshot({ path: `${output}/${lang}-${scenario}.png` });
      checks.push({ lang, scenario, detail, metadata, pass: true });console.log(`ok ${checks.length} - ${lang} ${scenario}`);
    }
    await context.close();
  }
} finally { await browser.close(); await fs.writeFile(`${output}/publication-detail.json`, JSON.stringify({ checks, errors, external }, null, 2)); }
console.log(`1..${checks.length}\n# tests ${checks.length}\n# pass ${checks.length}\n# fail 0`);
