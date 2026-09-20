# U7-2 React/core ownership review — fixed boundaries accepted

**Both reproduced blockers are resolved on dist4. This bounded high-risk review is complete.** No further core/UI suite was run or requested here. General screen/accessibility/SEO and final integration remain with their assigned owners.

Fixed page SHA `da5c67b0fc2a7cae8594943db196d5b265e78c496fafc401f6cc8e327d6e2c80`; page chunk `DocumentGeneratorPage-BZmabEGJ.js` SHA `96c136f3fe2c00f5bc488865644a0c4ca0f443937d1729755f3051def3ca27cb`; local server4391, `dist-current-4`. Relevant page/core19 and five declared build identities verified at start/end (`fixed/invariance.json`). Input copies match the original reproductions exactly. Test-only harness counter edits are outside this product review.

- `node /tmp/worklazy-u7-ui-core-review/fixed/sample-stale.mjs > /tmp/worklazy-u7-ui-core-review/fixed/sample-stale.log 2>&1`: **actual exit0**. Changing A-First-1 to A-First-2 removes the old sample link (count0); explicitly regenerated/downloaded `fixed/regenerated-sample.docx` contains A-First-2 and lacks A-First-1. Exact prior selection flow plus this requested positive control; Chrome153.0.8010.36, external0.
- `node /tmp/worklazy-u7-ui-core-review/fixed/zip-retirement.mjs > /tmp/worklazy-u7-ui-core-review/fixed/zip-retirement.log 2>&1`: **actual exit0**. At first new result commit, old ZIP URL is revoked with connectedAnchors[] and resultCount1. Original observer/assertion unchanged apart from target/output paths; external0.

The localized delta invalidates the sample on row selection and renders ZIP only when its owner matches the published result attempt. Before-first-commit preservation and failed re-export keep the same published attempt identity, so the new display condition preserves that accepted core contract. Core19 is unchanged; its prior checks remain reused. No product/test edits, commit or push by this reviewer.

The superseded held report and original exit1 artifacts below are preserved for the before/after record.

---

# U7-2 React/core ownership review — held for two local repairs

**Two new reproducible UI ownership blockers; root accepted both and assigned Sol a UI-only batch repair.** No additional audit expansion. Core19 remains accepted from `/tmp/worklazy-u7-core-review/REPORT.md`; this review did not repeat its suites or perform screen/axe/CLS/SEO/registry validation.

Target: original page SHA `dc0b602113783884a09c812fcf78a4c4db2872a5d2416a23cba392b4708ec24b`, immutable QA `dist-current-3`, page chunk SHA `201e450e201ca5b401083b99dbe1d51af33bd62fcdf590ddb297335b54319d32`. Relevant page+core19 were verified and copied before inspection; `relevant-freeze.json`. UI-wide manifest already reflected authorized test-only changes (aggregate `3c008b41828167e7365a3ce7b16979d641957d12db716d7430c76b199f662005` versus initial report bedbfaba…); relevant product hashes matched exactly. At review end Sol's authorized repair had changed only the original page among these20; the copied original20 and original core19 remain exact. `invariance.before-fix.json` records actual before/after SHA, avoiding a false original-page immutability claim. Five declared dist identities still match. No product/test edit, commit or push by this reviewer.

## 1. Selected row and downloadable sample diverge

`node /tmp/worklazy-u7-ui-core-review/sample-stale.mjs > /tmp/worklazy-u7-ui-core-review/sample-stale.log 2>&1` — **actual exit1**, Chrome153.0.8010.36, only fixed local origin allowed, external0. Synthetic inputs copied here from author's fixture directory; input hashes recorded.

Create sample for A-First-1 / document-A-3.docx, then select A-First-2 / document-A-4.docx. Displayed selection changes but existing sample link remains, same URL. Actual saved `stale-download.docx` contains A-First-1 and lacks A-First-2. `sample-stale.json` records both selected text states and decoded output observations. Assertion requires the downloadable sample to match selection or be invalidated.

Cause: page170 selector calls only `setSampleRow`; sample at173 retains unrelated Blob/URL. Local repair should invalidate/release previous sample on row change or bind sample rendering to its generated row identity, while keeping actual chosen-row generation. This is a data/output association defect, not a styling preference.

## 2. Retired ZIP is revoked before its link leaves DOM

`node /tmp/worklazy-u7-ui-core-review/zip-retirement.mjs > /tmp/worklazy-u7-ui-core-review/zip-retirement.log 2>&1` — **actual exit1**, same fixed build/browser, external0. Generate3 outputs, create ZIP, regenerate. When first new output commits, wrapped `URL.revokeObjectURL` observes old ZIP still referenced by connected anchor `Download completed ZIP` and resultCount1. `zip-retirement.json` preserves the event. This violates the accepted API's remove-old-links-in-React-commit → acknowledge → retire ordering.

Cause: page53 acknowledgement effect precedes page55 stale-ZIP removal effect; page186 renders `zip` even when its owner attempt differs from the published result attempt. Gate ZIP rendering by matching attempt ownership so the replacing React commit removes its old anchor before acknowledgement. Preserve old ZIP for canceled/failed runs before first new commit and failed re-export of the same published result set.

## Remaining reviewed contracts / limits

By source/API comparison, latest-attempt versus published-results manifests are explicitly selected at142–143/148/182–185; successful outputs use snapshot IDs and C2 fileName at135–136/183. Generation/export delegate BUSY/cancel/settlement to unchanged core. File replacement awaits reset before loading; effect subscription cleanup and microtask mount generation avoid disposing the reused client during StrictMode's synchronous effect replay. True unmount delegates cancellation and producer settlement to core dispose. These are bounded code findings and reused core evidence, not a new all-scenarios React lifetime execution claim. Sample generic suggested filename was not treated as the result registry path or invented as another blocker.

Root/Gemini retain simple UI interactions/screens and final app checks. This stage is held only for these two accepted local defects. After new page freeze/dist4, rerun these same two concrete paths with appropriate positive regeneration control; no whole browser/core suite is requested here.
