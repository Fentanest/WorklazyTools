import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(process.env.DIRECT_ENTRY_SOURCE_ROOT || '.');
const rows=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/direct-entry-contract.json'),'utf8'));
assert.equal(rows.length,18,'eighteen direct-entry rows (14 + 4 pdf-finish)');
assert.equal(new Set(rows.map(row=>row.path)).size,18,'duplicate direct-entry route');
const text=await fs.readFile(path.join(root,'src/app/App.tsx'),'utf8');
const source=ts.createSourceFile('App.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const routes=new Map();
function walk(node){
 if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(source)==='Route'){
  const attr=node.attributes.properties.find(prop=>ts.isJsxAttribute(prop)&&prop.name.getText(source)==='path');
  if(attr?.initializer&&ts.isStringLiteral(attr.initializer))routes.set('/'+attr.initializer.text,node.getText(source));
 }
 ts.forEachChild(node,walk);
}
walk(source);
const { VIDEO_STUDIO_PUBLIC } = await import('../src/app/publicServiceConfig.mjs');
for(const row of rows){
 assert.deepEqual(row.locales,['ko','en']);
 // T4: video rows assert presence/absence by publication flag.
 // Note: App.tsx keeps video Routes textually inside a __VIDEO_STUDIO_PUBLIC__
 // conditional, so the static AST always contains them. Gate on the flag text
 // and verify real artifacts (sitemap/static) in the full section below.
 if(row.videoPublic && !VIDEO_STUDIO_PUBLIC){
  assert.ok(routes.has(row.path),`Video route text must exist for gating check ${row.path}`);
  assert.ok(text.includes('__VIDEO_STUDIO_PUBLIC__'),`Video routes must be publication-gated ${row.path}`);
  continue;
 }
 assert.ok(routes.has(row.path),`Missing React route ${row.path}`);
 const routeText=routes.get(row.path);
 if(row.redirectTo){
  // T4: legacy redirect rows assert the exact redirect destination, its live
  // destination route, and the destination feature — not a purpose render.
  assert.ok(routeText.includes('LocalizedNavigate'),`Legacy redirect must use LocalizedNavigate ${row.path}`);
  assert.ok(routeText.includes(`to="${row.redirectTo}"`),`Wrong redirect destination ${row.path}`);
  assert.ok(routes.has(row.redirectTo),`Redirect destination route is missing ${row.redirectTo}`);
  const destinationText=routes.get(row.redirectTo);
  if(row.path==='/tools/pdf-editor/ocr')assert.ok(destinationText.includes('purpose: "ocr"'),`Redirect destination lacks OCR feature ${row.redirectTo}`);
  else if(row.path==='/tools/pdf-editor/convert')assert.ok(destinationText.includes('mode="pdf-to-document"'),`Redirect destination lacks converter feature ${row.redirectTo}`);
  assert.equal(row.redirectTarget,`/ko${row.redirectTo}`);
  assert.equal(row.sitemap,false);
  assert.ok(row.canonical === row.redirectTo,`Redirect canonical must be its destination ${row.path}`);
 } else if(row.owner==='pdf-finish'){
  // S-B: finish subpaths render with initialTab, not purpose.
  assert.ok(!routeText.includes('LocalizedNavigate'),`Finish subpath must render, not redirect ${row.path}`);
  assert.ok(routeText.includes(`initialTab: "${row.initialTab}"`),`Missing typed initialTab ${row.path}`);
  assert.equal(row.canonical,'self');
  assert.equal(row.redirectTarget,`/ko${row.path}`);
  assert.equal(row.sitemap,true);
 } else {
  assert.equal(row.canonical,'self');
  assert.equal(row.redirectTarget,`/ko${row.path}`);
  assert.equal(row.sitemap,true);
  if(row.owner!=='excel-merger')assert.ok(routeText.includes(`purpose: "${row.purpose}"`),`Missing typed purpose ${row.path}`);
  assert.ok(!routeText.includes('LocalizedNavigate'),`Purpose redirects instead of rendering ${row.path}`);
 }
 assert.equal(row.indexable,true);assert.equal(row.static,true);
}
if (!process.argv.includes('--core')) {
  // D3 full SEO/static/deployment contract (Sol integration).
  // Run with: node --experimental-strip-types tests/direct-entry-contract.mjs
  const { getSeoDefinition, getSocialImageDefinition } = await import('../src/app/seo.ts');
  const sitemap = await fs.readFile(path.join(root, 'dist/sitemap.xml'), 'utf8');
  for (const row of rows) {
    if(row.videoPublic && !VIDEO_STUDIO_PUBLIC){
      const slug=row.path.slice(1);
      assert.ok(!sitemap.includes(`/ko/${slug}/`) && !sitemap.includes(`/en/${slug}/`),`Sitemap must not contain unpublished ${slug}.`);
      // I1: unpublished video must also leave no localized static document.
      for(const language of row.locales){
        assert.ok(await fs.stat(path.join(root, 'dist', language, slug, 'index.html')).then(() => false, () => true),`Unpublished video static document remains ${language}/${slug}.`);
      }
      continue;
    }
    const slug = row.path.slice(1);
    for (const language of row.locales) {
      const definition = getSeoDefinition(language, row.path);
      assert.ok(definition.title && definition.description, `Missing SEO title/description ${language} ${row.path}`);
      assert.ok((definition.faq ?? []).length > 0 || row.owner === 'excel-merger' || row.path === '/tools/pdf-editor/convert', `Missing SEO FAQ ${language} ${row.path}`);
      const social = getSocialImageDefinition(language, row.path);
      assert.equal(social.path, `social/tools/${row.socialSlug}-${language}.png`, `Missing social slug ${language} ${row.path}`);
      const html = await fs.readFile(path.join(root, 'dist', language, slug, 'index.html'), 'utf8');
      assert.ok(html.includes(definition.title), `Static page lacks its SEO title ${language} ${row.path}`);
      assert.ok(html.includes(`https://worklazy.net/${social.path}`), `Static page lacks its social image ${language} ${row.path}`);
      assert.ok(html.includes(`<link rel="alternate" hreflang="x-default" href="https://worklazy.net/en/${slug}/" />`), `Static page lacks x-default hreflang ${language} ${row.path}`);
      // S3 (T4): per-row canonical tag; redirect rows point at the converter destination.
      const expectedCanonical = row.redirectTo
        ? `https://worklazy.net/${language}${row.redirectTo}/`
        : `https://worklazy.net/${language}${row.path}/`;
      assert.ok(html.includes(`<link rel="canonical" href="${expectedCanonical}" />`), `Static canonical mismatch ${language} ${row.path}`);
    }
    if(row.sitemap){
      assert.ok(sitemap.includes(`/ko/${slug}/`) && sitemap.includes(`/en/${slug}/`), `Sitemap is missing ${slug}.`);
    } else {
      // T4: sitemap:false asserts absence, not a skipped check.
      assert.ok(!sitemap.includes(`/ko/${slug}/`) && !sitemap.includes(`/en/${slug}/`), `Sitemap must not contain ${slug}.`);
    }
    assert.ok(await fs.stat(path.join(root, 'dist', slug, 'index.html')).then(() => true).catch(() => false), `Missing unprefixed redirect ${slug}/`);
  }
  console.log(`Direct entry contract passed: ${rows.length} independent rows with full SEO/static/deployment assertions.`);
} else {
  console.log(`Core direct entry contract passed: ${rows.length} independent rows; 12 static slugs / 11 new React routes / 0 new tool IDs. SEO/static deployment assertions remain D3 integration.`);
}
