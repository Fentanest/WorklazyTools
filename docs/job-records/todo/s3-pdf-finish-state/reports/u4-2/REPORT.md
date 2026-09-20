# U4-2(F0b) implementation report

Date: 2026-09-07 KST  
Repository: `/home/better0101/projects/worklazytools`  
Branch: `s3-pdf-finish`  
Start HEAD: `f56dc68d4c53d58cad520fe41973cd2699a4f548`  
Main baseline: `5bc6854175331bdd73b267784d9633cdccda8446`

## Result

- Added a PDF-owned facade over the unchanged common `runModuleWorker` lifecycle.
- Migrated PDF and PDF Office worker calls; every new `AbortSignal` is the final optional argument.
- Added cooperative `setTimeout(0)` yielding, abort checks, and yield-then-recheck before result registration.
- Added PDF.js cancellation ordering: cancel, await settlement, page cleanup, then owned loading-task destroy; shared preview documents are never destroyed.
- Preserved all three user-owned untracked files. No main merge or push.

## Contract evidence

- Dedicated lifecycle unit: 17/17.
- V3-4 facade scenarios: 11/11, including ko/en result and nested error identity, transfer identity, one termination, pre-abort, late result, timeout, post exception, duplicate terminal, error event, and constructor exception.
- Cooperative counterexample: microtask 12/12 with `aborted=false`; task yield 1/12 with `aborted=true`.
- Owned render order: `cancel,settled,cleanup,destroy`; shared: `cancel,settled,cleanup`.
- Full unit suite: 289/289, fail 0, skip 0.

## Invariance evidence

- Legacy oracle current capture versus U4-0 baseline: client 3/0 diffs, structure 4/0, render 32/0, output 4/0, input 1/0; total diffs 0.
- `TEST_SCOPE=pdf` browser smoke: pass for the four legacy modes.
- Full browser smoke: Excel, Word, PDF, and shared UI pass.
- Excel cleaner and Excel compare smoke suites: pass, including cancellation paths.
- Common worker lifecycle and both Excel clients: diff 0; blob hashes `a6406c80dbee62ba75ad91d548624c8618392e7b`, `48ccc95ece9c12ebc3d28a1c7e2f1cb8af99091b`, `ae130adc7f4a917ddb7b63b66c8f6b7710e07e81`.

## Validation

- TypeScript: pass, diagnostics 0.
- Production build with requested `NODE_OPTIONS=--max-old-space-size=4096`: pass, 2,837 modules and 61 localized static pages.
- Static validation: pass, startup recovery 104.
- New-tools smoke: HWP, Image, Audio, Video pass.
- QA rendering: 3 routes x 3 runs, external requests 0, CLS max 0. Production's expected analytics produced 126 external requests in the non-QA negative run.
- CSS orphan audit: 212 class tokens, 0 zero-reference selector arms.
- `git diff --check`: pass.
- Bundle deltas versus U4-0: entry +18B, affected PDF route +758B, shared +37B, app +867B, CSS 0B; all within limits.

The QA-to-production restoration encountered two host-memory `exit 137` runs while only 3.1-3.4GiB was available and swap was full. A final production restoration with a 3GiB heap cap and esbuild concurrency 1 passed. Its 81 measured bundle files matched the earlier successful production measurement by SHA, and static validation passed again. The rejected `--optimize-for-size` environment attempt exited 9 before starting a build.

## Artifacts

- `bundle.json`: production bundle measurement and comparison.
- `legacy-oracle-current/`: current-source recapture used for byte comparison.
- Rendering JSON: `/tmp/worklazytools-rendering-baseline.json`.

Final commit: `47c0f2286887111e3573d5efaec0af57165d7d0d` (`feat: add PDF worker cancellation lifecycle`).

Post-commit proof: `git diff main..HEAD -- src/utils/workerLifecycle.ts src/features/excel-*` produced 0 bytes (`protected.diff`). The working tree contains only the three pre-existing user-owned untracked files.
