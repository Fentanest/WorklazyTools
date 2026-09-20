# Embedded Korean thumbnail worker — independent cross-review, Codex Astra

**PASS for the bounded worker repair.** No new compatibility/cancellation defect found. This review excludes approval of this reviewer's own PdfFinishPanel/engine changes. PROJECT_RULES read first. No tracked modification, commit/push, shared build, or user-original/network transfer performed.

## Source review

The six-line addition in pdfThumbnailRender.worker.ts supplies the dedicated worker's native FontFaceSet as `ownerDocument.fonts`, preceded by a worker.fonts/FontFace capability guard. Actual pinned PDF.js 6.2.108 code at build/pdf.mjs:7758–7890 confirms why this is sufficient: `isFontLoadingAPISupported` tests `_document.fonts`; supported embedded/system-font binding calls `.fonts.add/delete`, and clearing removes the same native faces. The CSS-style-element branch is used when that API is absent; the new guard routes that situation to the established main renderer instead of trying a fake document DOM implementation.

`pdfPreview.ts:229–318` is unchanged. A worker error terminates its owned worker and rejects into main-renderer fallback. An aborted signal/AbortError is rethrown and never triggers that fallback. Completion closes the bitmap, removes the abort listener and terminates once; renderer and document release paths are unchanged. The worker remains per-render, so its font set is isolated from other render requests; normal loadingTask.destroy and worker termination preserve cleanup. No PDF output writer, font asset, worker protocol, DPR/viewport geometry or dependency version was changed.

## Independently executed verification

Command:
`TEST_BASE_URL=http://127.0.0.1:4280 PDF_PREVIEW_FONT_OUTPUT=/tmp/worklazy-u4-user-bugs/integration/worker-audit/synthetic node tests/pdf-preview-font-smoke.mjs`

Exit 0, original output worker-audit/smoke.log and synthetic/report.json. Generated public-font synthetic input only. Actual dedicated-worker result event asserted (silent main fallback cannot satisfy it); workerLoads 5. Worker/main exact PNG equality; extracted Korean/Latin text equal. Independent SHA recomputation gives both `d260605abba92bd57e5bad2266efcef7fb650aa3a8ee3b41978721e27a59d6ef`.

Removing actual ownerDocument binding changes pixels to SHA `9b6796f1888f10e469120f63ad839a2e0eb71ca0ceadd51483867330fa593de3`, while extracted text remains equal; negative control correctly rejects. I separately opened worker.png and missing-owner.png using view_image: the former reads “한글미리보기검증가나다”, “Embedded Korean 123”, “Standard Latin 456”; the latter has replacement squares only in the Korean line, with both Latin lines intact. This establishes glyph repair beyond a ToUnicode/text-only oracle.

Forcing the actual capability guard returns a worker error and then identical healthy main pixels. Synchronous cancellation returns AbortError and terminates exactly one owned worker. Fresh retry restores identical pixels. No attempted nonlocal request (blocked array empty). These controls operate on intercepted responses/in-memory browser copies only, leaving tracked source unchanged.

This is Chrome/DPR1 synthetic parity and synchronous-cancel coverage, not a claim of every browser or mid-font-load timing permutation. Those rendering/lifecycle paths are unchanged, and prior owner report's 24 lifecycle/dependency tests plus legacy44 diff0 remain supporting previous execution. No need to repeat unrelated full suites. Original four-page Korean evidence was read as the other agent's report; this independent run used no private input and does not claim to have rerun all four original pages.

## Immutability

Start/end HEAD `82fa9c9b9567f0bc2e80e9c65189a2b5be4945e0` and full git status unchanged. All 2,540 inventoried src/scripts/tests files (including newly added font smoke) have identical start/end SHA; worker-audit/start.json, end.json and checks.json. Existing dirty changes were retained; no whole-tree-clean claim. Scope-specific approval is suitable input to root's integrated gate.
