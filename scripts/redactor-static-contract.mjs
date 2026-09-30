import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export function assertRedactorStatic(html) {
  const policyTag=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?>/);
  assert.ok(policyTag,'redactor CSP missing');const policy=policyTag[1];
  assert.ok(html.includes('<meta name="worklazy-redactor-isolation" content="document-scope" />'));
  const first=html.search(/<(?:script|style|link)\b/i);
  assert.ok(policyTag.index<first,'CSP must precede executable/resource elements');
  for(const value of ["default-src 'none'","script-src 'self' 'wasm-unsafe-eval' https://pagead2.googlesyndication.com https://www.googletagmanager.com https://wcs.pstatic.net","connect-src 'self' https://www.googletagmanager.com","worker-src 'self' blob:","object-src 'none'","frame-src https://ads-partners.coupang.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com","form-action 'none'","base-uri 'self'"])assert.ok(policy.includes(value),value);
  assert.ok(!policy.includes("'unsafe-eval'")&&!policy.includes("'unsafe-inline'")&&!/script-src[^;]*https:(?:\s|;)/.test(policy));
  for(const [,attrs,text]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=|application\/ld\+json/.test(attrs))continue;
    assert.ok(policy.includes("'sha256-"+createHash('sha256').update(text).digest('base64')+"'"),'exact executable bootstrap hash missing');
  }
  for(const [,text]of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))assert.ok(policy.includes("'sha256-"+createHash('sha256').update(text).digest('base64')+"'"));
  const accountTags = [...html.matchAll(/<meta\s+name="google-adsense-account"(?=\s|\/?>)[^>]*>/g)];
  assert.equal(accountTags.length, 1, 'exactly one AdSense account meta is required');
  assert.match(accountTags[0][0], /\bcontent="ca-pub-8940087269746960"/, 'configured AdSense account is required');
  for(const forbidden of ['data-worklazy-video-isolation','coi-serviceworker.js'])assert.ok(!html.includes(forbidden),forbidden);
  assert.ok(/<script[^>]+type="module"[^>]+src=|<script[^>]+src=[^>]+type="module"/.test(html));
  return true;
}
