# 작업지시서 — S1 문서 비교 죽은 코드 제거 (2026-09-06, Claude → Codex gpt-6-astra)

## 0. 선독(순서대로)
1. `PROJECT_RULES.md` 전문 — 특히 「작업 기록」·「검증은 실행이다」·「생성물 직접 수정 금지」·「실행 게이트」·「현지화·SEO·AdSense 동시 검토」.
2. `AGENTS.md`.
3. **정본** `docs/jobs/todo/roadmap-completion-20260906.md` §2 공통 계약(C-A~C-G) · **§3 S1 절** · 「완료 기준 검증 명령 총람」 S1 행. 이 지시서는 S1 절의 착수판이며 어긋나면 정본이 우선(어긋난 점 보고).
4. `docs/backlog.md` 「문서 비교 죽은 코드」 항목(대상·주의) · `docs/review-notes.md` 상단 S0 절(형식 참고).
5. 자신의 앞선 왕복 실측: 3차·4차 반박에서 CSS orphan 25 class/81 arm·rule 76개·manifest 153/0/2·unit 10/10·TS 진단 0 을 모의했다 — 그 모의를 실제 코드에 적용하는 것이 이 작업이다.

## 1. 성격·기준
- **파일 수정이 필요한 구현 작업(쓰기 모드).** 브랜치 커밋 필수, **main 병합·push 금지**(§7). 이전 전달 과정의 "커밋 금지" 제약은 무효.
- 저장소 루트 `/home/better0101/projects/worklazytools`. **기준 해시 `main` = `37d4e69924d80120c3f34a38b0d20dd0e08d3f59`**(S0 병합 `b7e3977` + 사후 기록, `origin/main` 동일 — 2026-09-06 19:45 Claude 실측). 착수 시 `git rev-parse main origin/main` 대조, 다르면 중단·보고.
- **착수 시 워킹트리에 Claude 문서 변경 2파일이 있다**: ` M docs/backlog.md` · ` M docs/review-notes.md`(S0 게이트 ⑨ 판정·backlog 이관, Claude 서명). 브랜치를 딴 뒤 **첫 커밋으로 이 2파일만** `docs: record S0 gate judgment and live-audit backlog items` 로 커밋한다(내용 수정 금지). untracked 사용자 파일 3개(`after.docx`·`before.docx`·루트 `naver0516….html`)는 수정·추적·삭제 금지.
- 브랜치: `git checkout -b s1-dead-code main`.
- 열린 계획서 충돌 검사는 Claude 가 수행했다(문서 비교 표면에 상반 지시 0 — `pdf-finish`는 PDF 표면, `p2-tool-migration`은 종결). 실행 중 상반 지시 발견 시 보고.

## 2. 범위(정본 S1 그대로)
**삭제**: `src/features/word-compare/WordComparePage.tsx`(318줄) · `src/features/hwp-compare/HwpComparePage.tsx`(231) · `src/features/hwp-compare/HwpCompareResultPage.tsx`(19) · `src/features/hwp-compare/hwpCompareSession.tsx`(81) · `src/features/word-compare/wordCompareSession.tsx`(90) · `WordCompareResultPage.tsx:47` 의 `export function WordCompareResultPage()` **wrapper 함수만**(`useWordCompareSession` 소비자).
**보존**: `DocumentCompareResultPage` export · `docModel.ts` · 두 worker(`word.worker`·`hwp-compare.worker`) · `wordWorkerClient`·`hwpWorkerClient` · Word Python 4파일 · `/word-compare`·`/hwp-compare` → document-compare redirect(`App.tsx` `LocalizedNavigate` 2행·정적 redirect 페이지).
**규칙**: 파일을 하나 지울 때마다 그 자리에서 남은 사용처를 `grep -rn` 으로 다시 확인한다(CLAUDE.md 「사용처를 하나 지우면…」). 디렉터리 통째 삭제 금지. 2026-09-06 19:45 Claude grep: `WordComparePage`·`HwpComparePage`·`HwpCompareResultPage` 외부 참조 0, `hwpCompareSession` 은 삭제 대상 2파일만, `wordCompareSession` 은 `WordComparePage`(삭제)와 `WordCompareResultPage`(wrapper 삭제로 소비 소멸) — 확인 후 삭제.

**CSS·manifest·unit 연쇄(4차 확정치 — 실측으로 재확인하고 다르면 실측값 채택·보고)**:
- `npm run css:orphans` 로 orphan 목록 확인(기대 25 class/81 arm) → `src/styles/global.css` 에서 **영향 rule 76개(71 삭제 + 5 부분 변경)** 수동 정리 → 감사 재실행 **orphan 0**. 부분 변경 5개는 살아 있는 selector 를 보존하는 방식으로.
- `scripts/generate-legacy-owner-manifest.mjs` `currentStateOverrides`(`:141`) 갱신 → `npm run legacy:manifest` 결과 **153 removed · 0 split · 2 active(`legacy-004`·`005`)**. `legacy-006·007·134` = S1 제거, **`legacy-132` = `currentState=removed · removedIn=B3 · lastUpdatedIn=S1`**(B3 기대 목록 유지).
- `tests/unit/ui-legacy-isolation.test.ts`: `:297` `removed 149→153` · `split 1→0` · **`:156` `rules.length >= 600` → 삭제 후 실측 rule 수(4차 모의 541)에 맞는 하한으로 갱신**(정확한 실측값 근거 병기). 관련 unit 10건 통과.
- **생성물(`dist/`·vendor)은 손대지 않는다.**

## 3. 제품 규칙 점검(완료 기준)
- ko/en: 삭제되는 페이지 전용 로케일 키가 있으면 함께 제거하되 **document-compare 가 쓰는 키는 보존**(`feature-locales` unit + grep 근거). 사용자 노출 문구 변화 0.
- SEO·정적: `/word-compare`·`/hwp-compare`(ko/en) redirect 페이지·사이트맵·FAQ·소셜 **변화 0** — `npm run test:static` + 전후 `dist` HTML 파일 수·sitemap SHA-256 비교.
- 광고 격리: 격리 경로 영향 0(grep 전후 동일 집합).
- 내부 구현 비노출: 신규 문구 없음 → 해당 없음(명시).

## 4. 검증(전부 실행·출력 기록)
`npm run build` · `npx tsc -b` · `npm run test:unit` · `TEST_SCOPE=word npm run test:browser` · `TEST_ONLY_HWP=1 npm run test:new-tools` · `npm run test:browser`(전체) · `npm run test:new-tools`(전체) · `npm run test:utilities` · `npm run test:office` · `npm run test:static` · `npm run css:orphans`(0) · `npm run legacy:manifest` · `node tests/tool-registry-routes.mjs` · `npm run test:recovery` · `LANG=ko_KR.UTF-8 npm run test:visual` · `LANG=en_US.UTF-8 npm run test:visual`(전체 — 기준선 갱신 0 기대, 갱신 시 사유·diff 경로) · `VITE_LOCAL_QA=1 npm run build` 후 `A11Y_MAX_TOTAL=0 npm run test:a11y` · `npm run test:rendering`(CLS 비회귀 ≤0.114199 — 절대 0.1 게이트는 S2-H 이후) · `npm run bundle:measure`(착수 시 `main` production 빌드로 `/tmp/s1-bundle-baseline.json` 고정 → `BUNDLE_BASELINE=` 비교, 5종 상한 내 — 삭제 작업이라 감소 기대, 5종 delta 표 기록) · `git diff --check`.
- redirect 유지: 브라우저로 `/ko/tools/word-compare/`·`/ko/tools/hwp-compare/`·`/en/tools/word-compare/`·`/ko/word-compare/`(정적 redirect 페이지) 진입 → document-compare 도착 DOM 확인(4건 표).
- 마지막에 `dist/` 는 **`VITE_LOCAL_QA=1` 빌드로 남긴다**(Claude·Gemini 로컬 시각 검수용). 검수 서버 기동 명령(`npx vite preview --port 4288` 류)과 검수 경로(document-compare ko/en 입력→결과 흐름, redirect 4건, 홈·도구 목록) 를 보고에 적어라.

## 5. 기록(브랜치, 병합 전)
`CHANGELOG.md` 코드 변경 몇 줄(삭제 파일·rule 수·manifest 수치), 서명 Codx. `docs/review-notes.md` S1 절: 삭제 전후 grep 표·orphan 전후·manifest 전후·unit 갱신 근거(rule 실측 수)·번들 5종 delta·redirect 4건. 서명 Codx. 정본 계획서는 수정하지 않는다.

## 6. 커밋
브랜치 `s1-dead-code` 에 논리 단위 커밋(docs 선행 커밋 / 페이지·세션 삭제 / CSS 정리 / manifest·unit 갱신 / 기록). 영어 한 줄 요약. `git add -A`·`git add .`·squash·rebase·force 금지. `dist/`·측정 로그·`/tmp` 산출물·사용자 파일 커밋 금지.

## 7. 정지점 — main 병합·push 금지
완료 기준 통과 후 브랜치 상태로 멈춘다. 병합·push 는 Claude 게이트 ①~⑧(Gemini 로컬 시각 검수 포함) 후 별도 지시. 종료 시 `git status --porcelain`(사용자 파일 3개만)·`git log --oneline main..s1-dead-code`·`git diff --stat main..s1-dead-code` 원문.

## 8. 보고 형식
착수 게이트 원문 · 삭제 파일별 사용처 grep 전후 · CSS rule 삭제/변경 목록(수) · manifest 전후 수치 · unit 갱신 diff 와 실측 근거 · §4 검증표(명령·exit·소요·산출물 경로) · 번들 5종 delta · 제품 규칙 점검표 · 범위 밖 발견(고치지 않고 보고) · 검수 기동 안내 · §7 정지 상태 원문.
