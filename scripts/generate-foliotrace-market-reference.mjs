import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Explicit offline input: fetch the official stock finder separately and keep
// its response for review. Never refresh market classifications during a build.
const input = process.argv[2];
if (!input) throw new Error('Pass a saved KRX stock-finder JSON response');
const bytes = await fs.readFile(input);
const source = JSON.parse(bytes);
const date = /^(\d{4})\.(\d{2})\.(\d{2}) /.exec(source.CURRENT_DATETIME);
if (!date || !Array.isArray(source.block1)) throw new Error('Invalid KRX stock-finder response');
const markets = {};
const kinds = { STK: 'KOSPI', KSQ: 'KOSDAQ', KNX: 'KONEX' };
const counts = { KOSPI: 0, KOSDAQ: 0, KONEX: 0 };
for (const row of source.block1) {
  const code = row.short_code, market = kinds[row.marketCode];
  if (!/^[0-9A-Z]{6}$/.test(code) || !market || !row.full_code) throw new Error('Invalid security/market mapping');
  if (code in markets) throw new Error(`Duplicate short code: ${code}`);
  markets[code] = market;
  counts[market]++;
}
if (counts.KOSPI < 500 || counts.KOSDAQ < 1000 || counts.KONEX < 20) throw new Error('Incomplete market reference');
const output = {
  schemaVersion: 1,
  asOfDate: date.slice(1).join('-'),
  source: 'KRX Data Marketplace stock finder',
  sourceTimestamp: source.CURRENT_DATETIME,
  sourceUrl: 'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd',
  sourceRequest: { bld: 'dbms/comm/finder/finder_stkisu', locale: 'ko_KR', mktsel: 'ALL', typeNo: '0', searchText: '' },
  sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  counts,
  markets: Object.fromEntries(Object.entries(markets).sort(([a], [b]) => a.localeCompare(b))),
};
await fs.writeFile(new URL('../src/features/foliotrace/data/marketReference.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(`KRX market reference ${output.asOfDate}: ${JSON.stringify(counts)}`);
