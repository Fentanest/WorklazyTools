import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditTsxSource, auditTsxTree } from '../../scripts/i18n-literal-audit.mjs';

test('i18n audit rejects JSX copy, accessible attributes, toast/error strings, and templates', () => {
  for (const source of [
    '<p>사용 안내 보기</p>', '<input placeholder="입력" />', '<img alt="미리보기" />',
    '<button title="열기" aria-label="열기" />', 'toast("완료했습니다")',
    'throw new Error("실패했습니다")', 'const message = `총 ${count}개`',
  ]) assert.ok(auditTsxSource(source).findings.length > 0, source);
});

test('i18n audit permits comments, translation keys, bilingual calls and language branches', () => {
  const source = '// 한국어 주석\nconst a = <p>{L("안내", "Guide")}{t("사용자키")}{ko ? "결과" : "Result"}</p>;';
  assert.deepEqual(auditTsxSource(source).findings, []);
  assert.ok(auditTsxSource('L("안내")').findings.length);
  assert.ok(auditTsxSource('L("안내", "영문도 한글")').findings.length);
});

test('i18n exceptions apply only to the documented symbol, not a whole TSX file', () => {
  const source = 'const koreanToolNames = {pdf: "PDF 도구"}; const leak = <p>다른 누출</p>;';
  const result = auditTsxSource(source, 'src/app/App.tsx');
  assert.equal(result.excluded.length, 1);
  assert.deepEqual(result.findings.map(f => f.text), ['다른 누출']);
});

test('i18n tree audit refuses an empty selection', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-audit-empty-'));
  try { assert.throws(() => auditTsxTree(root), /zero TSX files/); }
  finally { fs.rmSync(root, {recursive:true,force:true}); }
});
