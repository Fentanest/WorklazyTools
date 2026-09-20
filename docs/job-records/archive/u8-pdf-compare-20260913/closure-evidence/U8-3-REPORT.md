# U8-3 frozen-core evidence — Codx, 2026-09-13

**Engine scope completed; no product changes.** Twelve new functional scenarios and 1/20/200-page observations are preserved. Strict cross-DPR pixel equality failed for system-font rendering; geometry/resolution and same-environment identical-input invariants held. Root and independent Astra accepted the bounded DPR interpretation as nonblocking: `/tmp/worklazy-u8-core-review/DPR-DISPOSITION.md`. Cross-environment exact pixels exceed the canonical DPR-independent canvas geometry contract; the observed strict equality failure remains a failure. Do not erase the failed assertion. Gemini's six-image visual reading is received: `/tmp/worklazy-u8-stage3-visual/REPORT.md` and `coverage.json`, session63336 exit0, actual6/6, missing0, SHA changes0. Text, rotation, color change and blue rectangles are visible without clipping in this selected sample. This does not establish the cause of cross-renderer dimensions or DPR differences.

## Source and scope

`source/` is a detached U7 `1df3c2e50edeb010272d82f15f279c1355f9f8ab` worktree with the exact seven accepted U8-1 core files copied after SHA verification. No live UI-writer changes followed. Start `core-source-start.json`; end `source-freeze-end.json`: seven core hashes, shared inputs and installed dependency hashes unchanged, baseline tracked diff0. Existing U7 dependency tree read for resolution; caches, synthetic PDFs, scripts and screenshots stay in this temporary area. No stage1 suite repetition, repository test edits, dependency install, commit or push.

Node22.17.1 / Chromium153.0.8010.12 / PDF.js6.2.108 / Linux headless. Existing scoped-verification rules govern reuse and observation limits. All documents synthetic; original-user files untouched.

## New functional results

- Physical index mapping on page insertion/deletion yields three rows, content difference at the shifted row and unpaired added/deleted tail. Mixed text/image/text preserves the image row with unavailable text.
- Same text in Helvetica/Courier: extracted text equal, **1,964 changed pixels**. Deliberately changed ToUnicode with unchanged embedded glyph appearance: visual0, extracted text different. This is an isolated test control, not producer repair or source-accuracy support.
- Rotate90 + CropBox(20,30,400,200) + UserUnit2 yields **534×1067**, 96dpi. Rotate270 + CropBox is processed; UserUnit40 pair is jointly reduced to **4096×2048**. Color mutation detected. Both DPRs retain identical geometry/scale/text/status and within-context same-input0.
- Damaged PDF produces `invalid-pdf`; actual encrypted synthetic PDF produces `password`. No unlock attempted.
- Poppler24.02.0 new geometry samples rendered successfully. At cropbox/96dpi it produced **267×534** for UserUnit2 versus PDF.js534×1067; this is not cross-renderer equality evidence. UserUnit40 Poppler `-scale-to 4096` and PDF.js common downscale both produce4096×2048. Exact six PNGs/expected visible text in `visual-manifest.json` remain unchanged for Gemini.

## Performance and memory observations

Sequential same-input runs, 16ms requested interval heartbeat. No new budget/threshold or success limit invented.

| Pages | Completed / nonzero pixel results | Time ms | Heartbeat p95 / max ms | Main JS used bytes before→after |
|---:|---|---:|---:|---:|
| 1 | 1 / 0 | 969.2 | 16.5 / 17.9 | 45,771,420→45,948,775 |
| 20 | 20 / 0 | 2,231.6 | 18.8 / 36.3 | 45,990,928→11,784,288 |
| 200 | 200 / 0 | 17,293.9 | 24.6 / 52.9 | 11,887,167→12,136,725 |

`performance.memory` uses `--enable-precise-memory-info`; CDP Runtime.getHeapUsage sampled once/second had **0/2/17 samples**, main usedSize maxima unavailable/7,070,772/8,932,028 bytes. These main-isolate metrics exclude worker heaps and much native canvas/GPU storage and should not be equated. GC explains why post-run usage can be lower; endpoint values are not peaks. All three runs followed the functional corpus in one browser, so these are a warm sequence, not isolated cold/device benchmarks.

Separate `/proc` sampling sums VmRSS for the owned Chromium browser and descendants: **11 samples overall**, 5 while the last completed phase was20 (during200), maximum **700,980KiB**. Shared mappings can be counted in multiple processes; this includes renderer/browser/native overhead and retained allocations from earlier geometry tests. It is not unique physical memory, pure PDF memory or a mobile bound. No browser crash or unfinished200-page result observed. No UI/whole-app heap/network/performance claim follows. Page-level local-harness request observation had no off-origin request; final production request inventory belongs to root/Sol.

## DPR finding, bounded follow-up

The original run exited1 only at strict DPR result equality: geometry color-change count **3913 (DPR1) vs3973 (DPR2)**. No dimensions changed. Follow-up four controls, DPR1/2 each repeated twice:

| Control | Same-DPR repeats | Cross-DPR pixels >16 |
|---|---:|---:|
| PDF standard/system-font geometry | 0 | 502 |
| Same geometry, embedded OTF | 0 | 0 |
| System-font UserUnit40 reduced output | 0 | 4294 |
| Plain native canvas Arial, no PDF | 0 | 518 |

Native-canvas reproduction and stable embedded-font control support browser system-font raster dependence, rather than a common-scale error. They do not identify every rasterization internal or guarantee every font. Same-version/settings **within the same environment** and DPR-independent canvas dimensions hold. No global DPR override, font replacement, engine modification, test tolerance relaxation or corrected-pixel claim was introduced. Evidence `dpr-focus.json`, `dpr-analysis.json`, distinct focus PNGs. The broad root test expectation has been clarified separately; its original failure remains in `run-02.log`.

## Commands and disposition

- `node generate.mjs` exit0; Ghostscript synthetic-password encryption command exit0 (`generate.log`, `encrypt.log`). pypdf/PyPDF2 probes were unavailable; no installation. Existing Ghostscript used only to create the locked synthetic control.
- `node run.mjs` first temporary script parse failure exit1 (`run-01.log`); brace fixed. New run exit1 at strict cross-DPR assertion (`run-02.log`); full raw observations already saved `results.json`.
- `node dpr-focus.mjs`, `python3 dpr-analyze.py`, `python3 memory-sample.py`, four recorded Poppler commands: exit0. `python3 finalize.py` exit0 independently asserts1/20/200 completion/progress/nonzero0 and start/end source equality (`summary.json`, `finalize.log`). It does not relabel the DPR failure.

**Reuse:** stage1 core/ownership and stage0 accuracy/visual acceptance only. Newly generated/changed inputs were newly executed. **Remaining elsewhere:** live UI/ko-en/themes/mobile, initial and execution request graph, production route/app raw/gzip, full integration and eventual deployment. **Disposition complete:** independent Astra DPR ruling is nonblocking; Gemini selected visual review is complete. Stage3 engine scope is closed. Root/Sol retain final UI limitation wording verification and integration work. Product repair is not proposed. Core writer stayed stopped; UI sole writer was not modified or interrupted by this work.
