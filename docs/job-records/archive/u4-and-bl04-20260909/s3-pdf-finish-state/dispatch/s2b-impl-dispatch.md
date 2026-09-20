# 작업지시서 — S2b QR 라벨 PDF 한글 폰트 감량 구현 (2026-09-06, Claude → Codex **gpt-5.6-sol**)

## 0. 선독(순서대로)
1. `PROJECT_RULES.md` 전문 — 「백엔드 없음」·「GitHub Pages 스택」·「검증은 실행이다」·「생성물 직접 수정 금지」·「실행 게이트」·「현지화·SEO·AdSense 동시 검토」·「내부 구현 비노출」·「작업 기록」.
2. `AGENTS.md`(워킹트리 버전 — 「모델 역할 분담」 포함: 이 잡은 **sol 코딩**, 계획에 없는 판단은 임의 결정 말고 "범위 밖 발견"으로 보고).
3. **정본** `docs/jobs/todo/qr-font-20260906.md` 전문 — **「v3 확정」 + 「정본화 보강」 절이 우선 계약**(§2·§3 은 초안 흔적). 상위 `roadmap-completion-20260906.md` §결정 10·11·§2 C-A~C-D.
4. 3차 반박 산출물 `/tmp/worklazy-s2b-r3/REPORT.md` + **구현 참고 초안 `/tmp/worklazy-s2b-r3/drafts/`**(QrBulkPanel.tsx/.diff · qrLabelFont.ts/.diff · qrLabelPdf.diff · qr-bulk-smoke.mjs/.diff · qr-stage-metrics.mjs/.diff · qr-font-scenarios.mjs · vendor-qr-label-font.mjs/.diff · scripts/assets 폴더 모양). 고정 자산 실물은 `/tmp/worklazy-s2b-r2/regen-a/`(SHA 는 정본 표와 대조 후 복사).
5. `docs/OFFICE_EDITOR_ASSETS.md` QR 절 · `docs/review-notes.md` 상단(형식).

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 커밋 필수, **main 병합·push 금지**(§7).
- 저장소 루트 `/home/better0101/projects/worklazytools`. **기준 해시 `main` = `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`**(`origin/main` 은 `1a04f25` — 로컬 main 이 문서 커밋 1개 앞선 상태가 정상). 착수 시 `git rev-parse main` 대조, 다르면 중단·보고.
- 브랜치: `git checkout -b s2b-qr-font main`. **첫 커밋 = 워킹트리의 ` M AGENTS.md`(Claude 의 「모델 역할 분담」 절) 만** `docs: add Codex model role assignment to AGENTS.md` 로 커밋(내용 수정 금지). untracked 사용자 파일 3개(`after.docx`·`before.docx`·루트 `naver0516….html`) 수정·추적·삭제 금지.
- 열린 계획서 충돌: Claude 확인 — U4(`pdf-finish` v8) 는 QR selector 를 바꾸지 않으며 공용 `pdfFontEmbed` import 는 U4 병합 시 U4 우선(정본 「v3 확정」 D4 마지막 항). 실행 중 상반 지시 발견 시 보고.

## 2. 구현 범위(정본 「v3 확정」·「정본화 보강」 그대로 — 요약)
A. 자산·벤더: `scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/` 5파일(+목록) 추적 — regen-a 실물 복사 후 정본 표 SHA 전수 대조(불일치 시 중단·보고, 손수정 금지) · `scripts/build-qr-label-font-subset.py` + `scripts/requirements-fonts.txt` · `scripts/vendor-qr-label-font.mjs` 확장(drafts 초안 채택) · `public/vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/` 는 vendor 산출로만 생성 · `OFFICE_EDITOR_ASSETS.md` 역할별 해시표.
B. 코드: `src/features/qr-studio/qrLabelFont.ts` 신설(panel 별 lazy factory·원문+NFC coverage·8,192 코드포인트마다 양보·자산 size/SHA 검증·메모리 캐시 최대 2·optional signal) · `QrBulkPanel.tsx`(ZIP·PDF 공용 export 토큰·첫 await 전 동기 점유·busy 비활성·cancel/run 폐기/cleanup/unmount 무효화·storageRef 분리 선행·최종 Blob 뒤 task 양보 재검사) · `qrLabelPdf.ts`(`registerFontkit`/`embedFont` 만 `QrLabelFontInitError`, subset typed 실패 시만 full 1회·PNG 재독 금지). **`QR_LABEL_FONT_PATH` 의미(전체 OTF)·경로·바이트 불변.** 사용자 문구 추가 0.
C. 테스트: `tests/unit/qr-label-font.test.ts` · `tests/qr-font-scenarios.mjs` · `tests/qr-bulk-smoke.mjs`(1MB 하한 삭제 → 임베드 폰트 count/size/SHA, 3 scenario) · `tests/qr-stage-metrics.mjs`(`--scenario`) · 렌더 회귀 스크립트(3 fixture Poppler 픽셀 0·PDF.js 추출 동일 — npm script 로 두되 unit 에 넣지 않음).
D. 기록: CHANGELOG · review-notes(감량 실측 표·레시피·GS/PDF.js 기존 결함 명시·B 판정) · `docs/backlog.md` 2건(GS tofu descriptor 경계 · PDF.js 추출 오류) · `OFFICE_EDITOR_ASSETS.md`.

## 3. 검증 — 정본 「완료 기준 총람」 전부 실행·출력 기록(요약)
build · `tsc -b` · unit · `test:qr-bulk`(3 scenario) · `test:utilities` · `test:static` · `test:browser` · `test:new-tools` · `test:office` · `test:recovery` · 시각 회귀 ko/en(기준선 갱신 0 기대) · QA 빌드 a11y `A11Y_MAX_TOTAL=0` · `test:rendering` · `bundle:measure`(착수 시 main production 기준 `/tmp/s2b-bundle-baseline.json`; coverage JSON 은 QR route 에 포함되어 측정 대상) · `css:orphans` · `legacy:manifest` · `tool-registry-routes` · `git diff --check` · **`npm run measure:qr -- --scenario=subset|full|corrupt`**(PDF 단계 전송량 전/후 표) · 렌더 회귀 3 fixture · clean copy(`git worktree` 또는 `/tmp` 복제) 에서 `npm run vendor:qr-font` 2회 동일 SHA + `npm run build`.
- 마지막에 `dist/` 는 `VITE_LOCAL_QA=1` 빌드로 남기고 검수 서버 기동 명령·검수 경로(`/ko/tools/qr-studio/bulk`·`/en/…` 라벨 PDF 흐름) 보고.

## 4. 금지
main 커밋·병합·push · squash/rebase/force · `dist/`·`public/vendor/**` 손수정 · 새 npm/pip **런타임/개발 의존 추가**(Python 도구는 `/tmp` venv 로만, requirements 파일은 추적) · 계획서 정본 편집 · 사용자 파일 3개 조작 · 전체 OTF 경로/바이트 변경 · page.route/fetch mock 으로 corrupt 주입 · 계획 밖 판단(발견은 보고서 「범위 밖 발견」에).

## 5. 정지점·보고
완료 기준 통과 후 **브랜치 상태로 정지**(병합은 astra 검수 → Claude 게이트 → 별도 지시). 보고: 착수 게이트 원문 · A~D 변경 파일·핵심 결정 · 검증표(명령·exit·소요·산출물 경로) · 전송량 전/후 표 · 렌더 회귀 결과 · 번들 5종 delta · 제품 규칙 점검표 · 범위 밖 발견 · 검수 기동 안내 · `git status --porcelain`·`git log --oneline main..s2b-qr-font`·`git diff --stat main..s2b-qr-font` 원문. 산출물 `/tmp/worklazy-s2b/`.
