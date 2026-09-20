# 지시서 — U4(PDF 마무리) 계획 v4 · Codex 3차 반박 (2026-09-06, Claude → Codex gpt-6-astra)

## 0. 선독
`PROJECT_RULES.md` 전문(특히 「증거 없는 반박은 무게 0」·「계획 정본화」·「Gemini 산출물은 단서다」) → `AGENTS.md` → **`docs/jobs/todo/pdf-finish-20260905.md` 전문(v4 — 확정 1~27항 + 「v4 현행화」 H1~H7)** → `docs/jobs/todo/roadmap-completion-20260906.md` §2 공통 계약(C-A~C-G)·§3 S3·「진행 기록」 → `docs/jobs/todo/new-tools-roadmap-20260903.md`(상위 로드맵 U4 절·R4 폰트 기각) → 자신의 1·2차 반박(`task-mt…` 기록은 계획서 「왕복 기록」 참조).

## 1. 성격·기준
- **반박 라운드 — 저장소 수정·커밋·push 절대 금지.** 단 H2(c) 탐색 빌드와 probe 실행이 필요하므로 **실험 작업(쓰기 모드)** 로 디스패치한다: 산출물은 전부 `/tmp/worklazy-u4-r3/` 아래, 시작·종료 시 `git status --porcelain` 으로 저장소 불변(untracked 사용자 파일 3개만)을 증명한다. `dist/` 도 건드리지 않는다(탐색 빌드는 `vite.build({write:false})` 또는 별도 outDir `/tmp/...`). npm 설치 금지.
- 저장소 루트 `/home/better0101/projects/worklazytools`. **기준 HEAD `main` = `1a04f2571109495a76b8468af95b2f4edcd862cf`**(`origin/main` 동일). 착수 시 대조, 다르면 중단·보고.
- 라운드 중 Claude 는 추적 파일을 고치지 않는다. 계획서(`pdf-finish-20260905.md`)도 라운드 중 불변.

## 2. 반박 대상(항목별로 [동의]/[이견]/[해소 불가] + **실행한 명령·출력** 필수 — 논증만 있는 항목은 판정에 반영되지 않는다)
### 2-1. v3 잔여 쟁점 5건(계획서 「왕복 기록」 마지막 항)
1. 암호 fixture 세대 범위 — R2/RC4 만으로 충분한가, AES-256/R6 을 U4 완료 기준에 넣어야 하는가(qpdf 부재 상태에서 Node 만으로 R6 생성이 가능한지 probe).
2. 캔버스 상한 3중 검사(확정 18항)의 구현 위치 — 순수 정책 모듈·UI preflight·`pdfPreview.ts:356` 직전 — 현행 코드 구조에서 성립하는가.
3. legacy-organize 3종 oracle(확정 16항)의 **채취 시점(U4-0, `main` 기준)** 과 F5 비교 방법 — byte equality 보조 조건(고정 날짜·고정 PNG) 성립 여부를 **실제로 두 번 생성해 diff** 로 보여라.
4. worker lifecycle adapter(확정 2항)의 공용 회귀 범위 — `workerLifecycle.ts` 소비처(Excel cleaner/compare) 무변경 보증 방법.
5. 확정 9~20항 실행 가능성 — 특히 9항 토큰 표·12항 복합 순서·13항 preset 계약·20항 F4b 결정 규칙.
### 2-2. v4 현행화 H1~H7 (계획서 「v4 현행화」)
(a) H1 nth-child 범위: `browser-smoke.mjs` 의 `.pdf-output-mode-list button:nth-child`·`.pdf-page-card:nth-child` 를 확정 15항(navigation 위치 의존 selector 0건)에 포함할지.
(b) H2 recovery 표본: finish 5경로를 `tests/blank-page-recovery-smoke.mjs` 정상 진입 표본에 넣을지 `test:pdf-finish` 에 둘지.
(c) **H2 route 예산 탐색 빌드(결정적)** — `main` 에서 `vite.build({write:false, manifest:true})`(또는 `/tmp` outDir) 로 현행 pdf-editor route gzip **171,864B** 를 재확인하고, U4 예상 규모(production 2,850~4,650줄 · fontkit 은 이미 QR 에서 shared/route 어디에 귀속되는지 실측)를 근거로 **finish 를 `PdfEditorPage` 청크에 통합 vs 별도 lazy 청크(`PdfFinishPanel` 동적 import)** 두 설계의 route/shared 귀속과 5종 delta 예측을 표로 내라. 가상 모듈(예: 3,000줄 상당 더미 또는 기존 유사 규모 모듈 참조)을 임시로 연결한 탐색 빌드는 허용(저장소 파일 수정 없이 `/tmp` 복제본에서). **상한(+60KB route)을 넘을 것으로 예측되면 분리 설계를 정본 확정 항목으로 제안**하고, 그래도 넘으면 근거와 함께 보고(상한 변경 제안 금지 — C-B).
(d) H2 QR 폰트 자산 정합: U4 Noto 임베드가 `QR_LABEL_FONT_PATH` 를 재사용할 때, S2b QR 감량이 서브셋/woff2 를 도입하면 U4 는 전체 OTF 를 계속 쓰는 분리 설계가 타당한가(R4 기각 유지).
(e) H3: `visual-regression.config.mjs` `clock.toolReasons` 에 `pdf-editor` 추가만으로 finish scenario 의 `{date}` 가 고정되는지 — `visual-regression.mjs` 의 시계 고정 구현(`6fc458f`)이 toolId 기준으로 동작하는지 코드로 확인.
(f) H4 단계표·배포 단위: U4 전체 1회 배포 vs U4-3(F1) 후 중간 배포 — 위험·이점을 근거로 판정.
(g) H6 scenario 수와 시각 회귀 상한 20분(C-E) — finish 4탭 × ko/en × desktop/mobile + 5칸 navigation 320/390px 를 추가하면 캡처 수·예상 소요를 산식으로.
### 2-3. 자유 반박
계획서 어디든 "코드를 모르고 하는 소리"가 있으면 증거와 함께.

## 3. 판정 형식
- 항목별 표: | 항목 | 판정 | 근거(명령·출력·파일:라인) | 정본 반영 문안(있으면) |
- 마지막에 **잔여 이견 수** 와 **[정본화 가능] / [재왕복 필요]** 선언. 잔여 0 이면 "Claude–Codex 간 이견 0" 을 명시.
- 산출물: `/tmp/worklazy-u4-r3/REPORT.md` + probe 스크립트·로그. 시작·종료 `git status --porcelain`·`git rev-parse HEAD` 원문.

## 4. 금지
저장소 파일 생성·수정·삭제 · 커밋·push · `dist/` 변경 · npm 설치 · 계획서 편집(반영 문안은 보고서에만) · 사용자 파일 3개 조작.
