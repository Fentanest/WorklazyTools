import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(process.env.DIRECT_ENTRY_SOURCE_ROOT || '.');
const rows=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/direct-entry-contract.json'),'utf8'));
assert.equal(rows.length,14,'fourteen independent purpose rows');
assert.equal(new Set(rows.map(row=>row.path)).size,14,'duplicate purpose route');
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
for(const row of rows){
 assert.ok(routes.has(row.path),`Missing React route ${row.path}`);
 assert.deepEqual(row.locales,['ko','en']);assert.equal(row.canonical,'self');
 assert.equal(row.redirectTarget,`/ko${row.path}`);assert.equal(row.indexable,true);assert.equal(row.sitemap,true);assert.equal(row.static,true);
 if(row.owner!=='excel-merger')assert.ok(routes.get(row.path).includes(`purpose: "${row.purpose}"`),`Missing typed purpose ${row.path}`);
 assert.ok(!routes.get(row.path).includes('LocalizedNavigate'),`Purpose redirects instead of rendering ${row.path}`);
}
if (!process.argv.includes('--core')) {
  // D3 full SEO/static/deployment contract (Sol integration).
  // Run with: node --experimental-strip-types tests/direct-entry-contract.mjs
  const { getSeoDefinition, getSocialImageDefinition } = await import('../src/app/seo.ts');
  const sitemap = await fs.readFile(path.join(root, 'dist/sitemap.xml'), 'utf8');
  for (const row of rows) {
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
    }
    assert.ok(sitemap.includes(`/ko/${slug}/`) && sitemap.includes(`/en/${slug}/`), `Sitemap is missing ${slug}.`);
    assert.ok(await fs.stat(path.join(root, 'dist', slug, 'index.html')).then(() => true).catch(() => false), `Missing unprefixed redirect ${slug}/`);
  }
  console.log(`Direct entry contract passed: ${rows.length} independent rows with full SEO/static/deployment assertions.`);
} else {
  console.log(`Core direct entry contract passed: ${rows.length} independent rows; 12 static slugs / 11 new React routes / 0 new tool IDs. SEO/static deployment assertions remain D3 integration.`);
}
