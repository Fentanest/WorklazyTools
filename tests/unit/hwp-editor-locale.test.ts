import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function config(base: string) {
  const exports: any = {};
  const source = readFileSync('src/config/rhwp.ts', 'utf8').replaceAll('import.meta.env.BASE_URL', JSON.stringify(base));
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, URL, window: { location: { origin: 'https://example.test' } } });
  return exports;
}
test('Studio URL carries the explicit app locale under root and deployment subpaths', () => {
  for (const base of ['/', '/worklazytools/', '/worklazytools']) for (const language of ['ko', 'en']) {
    const { getRhwpStudioUrl, RHWP_VERSION } = config(base);
    const url = new URL(getRhwpStudioUrl(language));
    assert.equal(url.origin, 'https://example.test');
    assert.equal(url.pathname, `${base === '/' ? '' : '/worklazytools'}/vendor/rhwp-studio/${RHWP_VERSION}/`);
    assert.equal(url.searchParams.get('lang'), language);
    assert.deepEqual([...url.searchParams.keys()], ['lang']);
  }
});
test('Studio callers that set their own locale retain the original directory URL', () => {
  for (const base of ['/', '/worklazytools/']) {
    const { getRhwpStudioUrl } = config(base);
    const url = new URL(getRhwpStudioUrl());
    assert.equal(url.search, '');
    const print = new URL('index.html', url); print.searchParams.set('lang', 'en');
    assert.equal(print.pathname, url.pathname + 'index.html'); assert.equal(print.searchParams.get('lang'), 'en');
  }
});
test('Pinned Studio first-paint bootstrap honors the host locale over opposite stored preferences', () => {
  const source = readFileSync('public/vendor/rhwp-studio/0.9.0/locale-init.js', 'utf8');
  for (const language of ['ko', 'en']) {
    const document = { documentElement: { lang: '' } };
    vm.runInNewContext(source, { URLSearchParams, location: { search: '?lang=' + language }, localStorage: { getItem: () => language === 'en' ? 'ko' : 'en' }, document });
    assert.equal(document.documentElement.lang, language);
  }
});
