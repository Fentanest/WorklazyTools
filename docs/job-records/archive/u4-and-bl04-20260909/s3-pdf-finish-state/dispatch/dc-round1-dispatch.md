# 반박 1차 지시서 — 문서 비교 diff 입도·결과 화면 UI 계획 초안 (2026-09-07, Claude → Codex **gpt-6-astra**)

## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(「모델 역할 분담」 반박: **작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박**, 증거 없는 반박은 무게 0) → 계획 초안 **`docs/jobs/todo/document-compare-granularity-20260907.md`**(§7 반박 1차 요청 (a)~(h)) → `docs/backlog.md` 「문서 비교」 → 관련 코드: `src/features/document-compare/documentComparison.ts`(`diffText`·`diffUnits`·`diffCharacters`·`tokenize`) · `src/features/word-compare/{compare.py,tracked_docx.py,word.worker.ts,WordCompareResultPage.tsx}` · `src/features/hwp-compare/hwp-compare.worker.ts` · `src/components/UtilitySurface.tsx` · `tests/browser-smoke.mjs`(`testWordCompare`) · `tests/visual-regression.scenarios.mjs`(document-compare).

## 1. 성격·기준
- **실험 작업(쓰기 모드 필요) — 저장소 불변.** 추적 파일 수정·커밋·push·브랜치 전환 금지. 현재 워킹트리는 `s3-pdf-finish`(다른 구현 잡이 병행 중 — **절대 건드리지 말 것**). 실험은 **`git archive 5bc6854175331bdd73b267784d9633cdccda8446`(main) 을 `/tmp/worklazy-dc-r1/main/` 에 풀어** 그 사본에서 수행(의존성은 기존 `node_modules` 복사/심링크, 설치 금지). 산출물 `/tmp/worklazy-dc-r1/`(REPORT.md + probes + 캡처). 시작·종료 `git status`·HEAD 로 불변 증명.
- 사용자 문서 `dummyfortest/*.docx` 는 **읽기만**(복사·수정·커밋 금지; 캡처·보고에 내용 인용은 제14조 ④ 문장 범위로 최소화).
- 빌드·브라우저 직렬, `NODE_OPTIONS=--max-old-space-size=4096`.

## 2. 반박 항목(초안 §7 (a)~(h) 전부 — 각 항목에 재현 명령·출력)
(a) 세 경로 재현(초안 §1 F3 표) + `compare_documents`·`diffCharacters` 의 실제 호출처(`rg`) — 죽은 코드면 명시.
(b) 설계 A(단어 LCS 후 교체 쌍 글자 정제) vs B(글자 토큰 전체) — 프로토타입 함수를 `/tmp` 에 작성해 **현행 word/hwp fixture 전 문단 + 합성 반례 ≥10**(한국어 조사 `을/를/이/가/에서` 부착·영문 접미 `s/ed`·숫자 `7→30`·기호·공백만 변경·이모지/결합문자·긴 문단 5,000자·문장 순서 교환·`회사`→`투자자` 형 실질 교체)에서 세그먼트를 산출, **Word 기대(글자 최소 차이)** 와 대조, 잡음(과잉 분할) 사례를 표로. 성능: 최악 문단 길이에서 시간·`diffUnits` 1.5M 가드 영향.
(c) 동치 oracle(웹 added/deleted 연결 문자열 == 추적 docx ins/del 연결 문자열) 의 실행 가능성 — 같은 문단을 묶는 키(문단 순서·`location`)와 예외(표·메모·서식 run 분할) 열거, 프로토타입 1회 실행.
(d) HWP: `hwp-compare.worker.ts` 공유 경로 확인 · HWP 원본의 변경 추적(한글 변경 내용 추적) 이 모델 텍스트에 어떻게 들어오는지(rhwp API 로 판독 가능한지) · HWP fixture 로 A/B 적용 결과.
(e) U1 폭: `VITE_LOCAL_QA=1` 빌드 preview 에서 문서 비교 결과 페이지를 1280/1440/1920 × ko/en 캡처(현행 1030 vs 후보 1280/1480/가변 `min(100%−48px, …)`), 사이드바 포함 실제 가용 폭·한 줄 글자 수·가독성 판정, 다른 페이지 영향 0 방법(`UtilityPage` 옵션 vs 결과 페이지 전용 클래스).
(f) U2 이동 바: 우측 고정의 `sticky` vs `fixed` — CLS(`test:rendering` 방식)·본문 겹침·키보드 포커스 순서·모바일(390/320) 처리·다크 모드 캡처. 프로토타입 CSS 로 캡처 1세트.
(g) 배포 단위: `main` 기준 별도 브랜치·독립 배포 시 `s3-pdf-finish` 와의 충돌 파일 예측(`git diff main..s3-pdf-finish --stat` 로 겹치는 파일), 시각 기준선 충돌 여부.
(h) 미정의 지점: sol 이 재해석할 수 있는 문안 열거 + 정본 반영 문안 제안. 규칙 4(ko/en·SEO·광고)·5(내부 노출) 영향 점검.

## 3. 판정 형식
항목별 `[동의] / [반박: 증거] / [보완 제안]` + 재현 명령·출력 + 정본 반영 문안. 마지막에 **잔여 이견 수**. 산출물 `/tmp/worklazy-dc-r1/REPORT.md`(끝나면 `docs/jobs/todo/document-compare-rounds/round-1-REPORT.md` 로 Claude 가 복사).
