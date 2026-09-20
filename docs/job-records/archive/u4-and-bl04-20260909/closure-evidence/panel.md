# Independent panel/engine audit — Codex Astra

Verdict: reviewed other author's PdfFinishPanel, finish/engine, ko/en locale and tests; no new P2 blocker found. My own pdfThumbnailRender.worker.ts change is expressly excluded from this approval. No tracked file writes, commit or push.

## Exact user scope

User requested four per-tab inclusion checkboxes, removal only of the old inclusion box, preserving defaults and explicit exclusions. Diff confirms old wrapper/ToggleRow alone is removed; underlying form controls and settings cards remain. setDecorationEnabled now accepts an explicit tab but has the same preflight/risk/result invalidation. Defaults and tab-navigation state initialization are unchanged. Four separate native inputs are aligned immediately beneath four tab buttons, not nested in tab buttons/tablist. Names include their tab names in both languages. A short localized draft paragraph clarifies off-state preview beside the existing preview.

Independent browser script checkbox.mjs ran KO/EN × finish/header-footer/watermark/stamp, eight 320px contexts: initial included option matches each direct-entry preset, all four accessible names unique, Space toggles without changing active tab, tab changes retain checkbox state, old box absent, nested tab input count zero, upload retains selected inclusion, external requests zero. checkbox.log: PASS 8 contexts.

## Acceptance run-2/3 and default watermark — not a concealed regression

The acceptance synthetic source is 420pt wide. Default values remain font36, margin24, size60%, rotation-32. Actual Helvetica width of CONFIDENTIAL is 264.024pt; allocated width (420−48)×0.6 is 223.2pt. The canonical U4 horizontal overflow policy calls for ellipsis plus preflight warning, without silent font shrinking. Both archived baseline4273 and current4280 produce the same warning, exactly identical decoded watermark Form stream, identical native Poppler PNG SHA fe4d241d0ed28e295c703e2370e454f1c0b0524fb5b62c8b0139dd437139f3c1, visually CONFIDE…. This is preserved behavior required by the overflow contract, not a new regression.

At 595pt width, configured width328.2pt accommodates the full text. Both versions render complete CONFIDENTIAL with no warning, equal Form streams and native PNG SHA 6b7c03d0fbf10a890d7e889dcc0ceae0008834b19ad266dae3846e3a8fdd5766. Nevertheless pdftotext -layout breaks rotated text into reversed/spaced fragments, so includes('CONFIDENTIAL') is not a valid oracle for default rotated text, even when the visible result is complete.

Therefore acceptance changing its integration fixture to rotation0/size80/font10 is acceptable to test four-option inclusion semantics. It must not be described as validating complete default text on narrow pages. The independent unchanged-default comparison above closes that gap. Measurements, actual options, warning strings, extraction, Form streams: default-watermark.json. Native and preview PNGs are synthetic, safe for visual audit. No user-derived document was opened during this audit.

## Reported corner clipping and regression boundary

Independent corner-probe.mjs reused defaults except top-left on 595pt: archived preview visually NTIAL; current preview and Poppler output show full CONFIDENTIAL. Old Form lacks the full glyph sequence; new Form contains it. Captures inspected directly; corner/default-watermark.json and corner.log record evidence. This serves as an archived-source negative control for the repaired user path, without mutating product source.

Exact HEAD-source comparison confirms finish/engine.ts only replaces the watermark branch's width=min(width,header/footer-column-width) statement with a comment; numbering and header/footer branches are byte unchanged. Their separate six-region contract remains. Updated old watermark-only unit expectation appropriately changes the corner watermark width while retaining descender/multiline/baseline assertions. Added full-word checks cover six anchors × four rotations, nonzero CropBox/UserUnit, and real oversized-text warning.

Executed engine/modules unit: 42/42 PASS (focused-unit.log). Inspected existing old-wrap DOM mutant evidence: fixed/restored child26px,parent26px,offset0 vs mutant child53px,parent26px,offset−26; it was rejected. Same-round legacy verification already executed by me before this independent audit against the current engine source: 44 files,totalDiffs0 at ../korean-preview/legacy.log. This audit did not redundantly rerun the full browser/a11y/visual suites. Root owns integrated production/QA/static and final overall approval.

## Integrity and limits

Start/end SHA lists cover 2726 tracked files and compare identically (sha-diff.txt empty). git status lists are preserved. The only status delta during audit is that untracked before.docx/after.docx entries disappear; this auditor neither read nor touched those files. Reported promptly to root as an observed status delta; no cause is attributed and no protected contents were investigated. No full status-invariant claim is made.

The acceptance README still says only syntax/dependency validation, despite later successful logs/report.json. This is stale offline reporting, not product P2; root should use executed run/report evidence when consolidating. No unrelated backlog change or source repair is requested by this audit.
