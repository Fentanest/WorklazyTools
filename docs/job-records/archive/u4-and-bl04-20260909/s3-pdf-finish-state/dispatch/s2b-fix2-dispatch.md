# 수정 지시서 — S2b 재검수 소견 F1-R 반영 + Claude 검수 판정 기록 (2026-09-07, Claude → Codex **gpt-5.6-sol**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md` → **재검수 보고 `/tmp/worklazy-s2b-review2/REPORT.md`**(F1-R 정의·`final-task-mutation.py`·`logs/mutation-final-task-*`) → 1차 검수 `/tmp/worklazy-s2b-review/REPORT.md:13` → 정본 `docs/jobs/todo/qr-font-20260906.md` R2-1(최종 Blob 생성 뒤 task 양보 후 토큰 재검사 → download).

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 `s2b-qr-font`(HEAD `249e172`) 위에 커밋 1개. **main 병합·push 금지.** 착수 시 브랜치·HEAD·`git rev-parse main`(`f29d249…`) 확인. 사용자 untracked 3파일 금지 동일. **제품 코드 동작 변경 금지**(테스트·기록만).
- 동시에 U4 10차 반박(읽기 전용, pdf-editor 표면)이 돌 수 있다 — 무관.

## 2. 수정
- **F1-R**: `QrBulkPanel.tsx:359` 의 마지막 `await new Promise(r => setTimeout(r, 0))`(다운로드 직전 task 양보 + 토큰 재검사) 경계를 **실제 handler 실행으로 단언하는 unit** 추가 — "PDF Blob 완성 직후 큐에 들어온 취소(cleanup/cancel)가 다운로드를 막는다"(stale 다운로드 0). 재검수 `final-task-mutation.py` 방식으로 **양보 제거 mutation 시 실패(`1 !== 0`)** 함을 확인하고 원문을 보고에 포함. 기존 unit 246·F1·F2 단언 보존.
- **Claude 검수 판정 기록(문서 — 아래 문단을 `docs/review-notes.md` 의 S2b 절 끝에 그대로 추가, 내용 수정 금지)**:

> **Gemini 로컬 시각 검수 소견 판정 (Claude, 2026-09-07 02:45)** — Gemini(agy `gemini-3.1-pro-high`, QA 빌드 4188) 는 QR 스튜디오 정상 렌더 9화면을 정상으로 보고하면서 "① `똠` 라벨에서 서브셋 폰트만 요청(깨짐) ② 영어 라벨 PDF 흐름 차단" 2건을 냈다. **둘 다 검수 입력 결함으로 판정, 제품 결함 아님.** ① Gemini 스크립트(`/tmp/worklazy-s2b/gemini-local/QA-fallback.mjs`)는 제목 템플릿(`[data-testid="qr-mapping-title-template"]`)을 `{{Label}}` 로 설정하지 않아 `똠` 이 CSV Label 열에만 있고 라벨 텍스트(커버리지 검사 대상)에는 들어가지 않았다 — payload 만으로는 full 선택 실험이 되지 않는다는 1차 반박 지적과 동일. ② 영어 버튼 실제 문구는 "Create row QR codes" 인데 "Generate" 를 찾아 타임아웃. Claude 재현(`/tmp/worklazy-s2b/claude-fallback-probe.mjs`, 템플릿 `{{Label}}` 설정): fallback ko(첫 Label `똠 라벨`) → **전체 OTF `noto-cjk-sans-2.004/NotoSansKR-Regular.otf` 200 4,644,748B 요청, PDF 4,076,547B** · normal ko/en → **서브셋 `…ksx1001-v1/NotoSansKR-Regular.ksx1001.otf` 200 931,704B, PDF 826,074/826,075B** · 오류 경계·정적 안내 노출 0. CLAUDE.md §5-3 "차단 결함이 오면 검수 입력이 그 판정을 뒷받침하는지 본다" 의 사례. — Claude

- `CHANGELOG.md` 기존 S2b 항목은 변경 불필요(테스트만 — unit 수 증가는 review-notes 에 한 줄).

## 3. 검증
`npm run test:unit`(mutation 음성 원문 포함) · `npm run test:qr-bulk` · `npx tsc -b` · `npm run test:static` · `git diff --check`.

## 4. 정지점·보고
커밋 후 브랜치 상태로 정지. 보고: 변경 파일:라인 · mutation 원문 · 검증표 · `git status --porcelain`·`git log --oneline main..s2b-qr-font`. 산출물 `/tmp/worklazy-s2b-fix2/`.

## 5. 금지
main 커밋·병합·push · 제품 코드 변경 · page.route · 계획서 편집 · 사용자 파일 조작 · Claude 문단 내용 수정.
