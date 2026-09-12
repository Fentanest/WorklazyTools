import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export function assertRedactorStatic(html) {
  const policyTag=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?>/);
  assert.ok(policyTag,'redactor CSP missing');const policy=policyTag[1];
  assert.ok(html.includes('<meta name="worklazy-redactor-isolation" content="document-scope" />'));
  const first=html.search(/<(?:script|style|link)\b/i);
  assert.ok(policyTag.index<first,'CSP must precede executable/resource elements');
  for(const value of ["default-src 'none'","script-src 'self' 'wasm-unsafe-eval'","connect-src 'self'","worker-src 'self' blob:","object-src 'none'","frame-src 'none'","form-action 'none'","base-uri 'self'"])assert.ok(policy.includes(value),value);
  assert.ok(!policy.includes("'unsafe-eval'")&&!policy.includes("'unsafe-inline'")&&!policy.includes('https:'));
  for(const [,attrs,text]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=|application\/ld\+json/.test(attrs))continue;
    assert.ok(policy.includes("'sha256-"+createHash('sha256').update(text).digest('base64')+"'"),'exact executable bootstrap hash missing');
  }
  for(const [,text]of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))assert.ok(policy.includes("'sha256-"+createHash('sha256').update(text).digest('base64')+"'"));
  for(const forbidden of ['google-adsense-account','data-worklazy-video-isolation','coi-serviceworker.js'])assert.ok(!html.includes(forbidden),forbidden);
  assert.ok(/<script[^>]+type="module"[^>]+src=|<script[^>]+src=[^>]+type="module"/.test(html));
  return true;
}
