# U8 R4 limited repair acceptance — Codx

**PASS: both R3 blockers are resolved on the frozen R4 QA build.** This accepts the bounded UI lifetime repair, not the final production or visual gate. No new blocker found in this scope.

Source `/tmp/worklazy-u8-impl`, HEAD `1df3c2e50edeb010272d82f15f279c1355f9f8ab`; Page SHA `97602d695a5a4d11808e393964aa951543bc4962a02cbb4e6fe6fcd8133fa71c`. QA source `/tmp/worklazy-u8-ui-fix/qa-dist`; route SHA `75337407a3897de54d0318886ad138f7362359ed947ced9a576f02bb604ad546`; entry SHA `e3a2d03219a42a7fd5f21bf970c7d47276dc4053fdbd44b61c1c00f510068a47`. All 10 supplied source/test/build/artifact freeze entries checked. Independent copy here has current src and exact QA dist. `start-identity.json` and `end-identity.json` prove HEAD/status/UI+core7 source SHA unchanged and copied source matches; final identity records probe SHA.

Read repair REPORT, exact R3→R4 diff, freeze, relevant author test assertions/results. Only lifetime logic changes: invalidation aborts export and clears owned URLs/timers plus visible results; new runs invalidate first; generation guards late run/progress/finally/error callbacks; export checks ownership before publishing. Explicit cancel retains generation. Core7, JSX/styles and child components unchanged; prior canvas cleanup and Gemini visual evidence remain reusable, without independent visual replay.

## New execution

`node /tmp/worklazy-u8-ui-review-r4/probe.mjs > /tmp/worklazy-u8-ui-review-r4/probe.log 2>&1` **exit0 / PASS**, Chromium153.0.8010.12. This is a separately saved repaired-product acceptance probe; R3's exit0 defect-observation probe remains untouched and is not reclassified as a pass.

- Original lazy XLSX chunk delay → Download report → Swap sides → release actual response. After response completion and the observation interval: **downloads0, report URLs0, download anchor clicks0**; old result already hidden.
- Normal compare after swap → actual UI Download report → reopened XLSX: **changed-word.pdf / normal-ascii.pdf**, matching current direction. Artifact `current-direction.xlsx`.
- Original delayed File.arrayBuffer → Compare again: while Cancel comparison is visible, **old result headings0 / old download controls0**. Cancel completes rather than hanging on that unresolved read.

Exact outcomes `probe-results.json`. No product/bundle transformation, build, installation, full UI suite or external HTTP permitted in probe. All reviewer outputs stay here.

## Reused / limits

Explicit canceled partial positive sample reused from author verification02 on identical R4 source/build: actual UI waits for completed progress, cancels and downloads XLSX. Inspected original assertions/result and independently parsed that frozen workbook's OOXML status cells: **5 Complete /1 Canceled /194 Unknown**, recorded here in `reused-partial-cells.json`. This is artifact verification, not a new browser partial run. Author verification01's premature-unmount failure remains failed; corrected actual-detachment verification02 is distinct, and product source did not change. No broad lifecycle, core, DPR, performance, 17-image or production suite duplicated.

Bounded repair accepted; root/Sol retain final integration/production/visual/publication responsibilities. Reviewer product edits/commit/push: none.
