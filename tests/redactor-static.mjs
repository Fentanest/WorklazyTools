import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {assertRedactorStatic} from '../scripts/redactor-static-contract.mjs';
const root=path.resolve(process.env.REDACTOR_DIST_DIR??'dist');
const rows=[];
for(const language of ['ko','en']) {
 const html=await fs.readFile(path.join(root,language,'tools/document-redactor/index.html'),'utf8');
 assertRedactorStatic(html);
 assert.match(html,new RegExp('<html lang="'+language+'"'));
 assert.match(html,new RegExp('rel="canonical" href="[^"]*/'+language+'/tools/document-redactor/"'));
 for(const alternate of ['ko','en'])assert.match(html,new RegExp('hreflang="'+alternate+'"[^>]*href="[^"]*/'+alternate+'/tools/document-redactor/"'));
 assert.ok(html.includes('FAQPage'));
 const image='social/tools/document-redactor-'+language+'.png';
 assert.ok(html.includes(image));assert.ok((await fs.stat(path.join(root,image))).size>0);
 const mutations={
  'missing policy':html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,''),
  'missing marker':html.replace('worklazy-redactor-isolation','removed-marker'),
  'external connect':html.replace("connect-src 'self'","connect-src 'self' https:"),
  'JS eval permission':html.replace("'wasm-unsafe-eval'","'wasm-unsafe-eval' 'unsafe-eval'"),
  'changed executable bootstrap':html.replace(/(<script(?![^>]*src=)(?![^>]*application\/ld\+json)[^>]*>)/,'$1/* changed hash */'),
  'ads bootstrap':html.replace('</head>','<meta name="google-adsense-account" content="test"></head>'),
  'late policy':html.replace('<head>','<head><script src="/before-csp.js"></script>'),
 };
 for(const [name,mutated]of Object.entries(mutations))assert.throws(()=>assertRedactorStatic(mutated),undefined,name);
 const sitemap=await fs.readFile(path.join(root,'sitemap.xml'),'utf8');assert.ok(sitemap.includes('/'+language+'/tools/document-redactor/'));
 rows.push({language,control:true,negative:Object.keys(mutations)});
}
const redirect=await fs.readFile(path.join(root,'tools/document-redactor/index.html'),'utf8');assert.ok(redirect.includes('/tools/document-redactor/'));
console.log(JSON.stringify({root,rows}));
