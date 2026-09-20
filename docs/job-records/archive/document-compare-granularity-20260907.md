# 작업지시서 초안 — 문서 비교 diff 입도(granularity)·결과 화면 UI (2026-09-07, v1 Claude 초안 — 정본 아님)

> 사용자 `!계획!` 발동(2026-09-07 10:05). 대상: Word(.docx)·HWP 비교의 **웹 결과 화면 diff** 가 MS Word 비교와 다른 입도로 표시되는 결함 + 결과 화면 UI 2건. 정본화 전까지 Codex(astra) 반박 왕복으로 보완한다.

## 0. 사용자 원 요구(원문 요지 — 임의 생략 금지)
1. `dummyfortest/` 의 v1.2(비교 전)·v1.4(비교 후)를 우리 코드로 비교하면 **제14조 ④ 문구에 '자금'이 두 번 들어간 문장**이 나온다. 사용자가 Word 로 직접 비교한 `비교.docx` 는 '자금'이 한 번만 나오며 잘 수정된 문구를 보인다. **둘의 차이를 분석하고 같은 방식으로 비교할 수 있게** 할 것. **한글(HWP) 문서도 동일하게.**
2. 웹 문서 비교 결과 화면의 **레이아웃을 좌/우로 더 늘려도 될 것 같다**(여백이 많이 남음).
3. 「이전 변경 / n / 다음 변경」 이동 바는 **사용자 스크롤을 따라다녀야 의미가 있으니 우측 스티키로 이동**할 것.

## 1. 실측 사실 (2026-09-07 Claude — 전부 로컬 재현, 산출물 `/tmp/worklazy-wc/`)
**F1. 입력 문서 구조.** v1.2(법무검토)는 **변경 추적이 남아 있는 문서**다. 제14조 ④ 해당 run: `plain "…단, 회사가 제3자에게 " · w:ins#4 "투자받은 자금 이외의 자체 보유 자금(영업활동으로 발생한 수익금 등)" · w:del#5 "자금" · plain "을 대여하거나…" · w:del#7 "7" · w:ins#8 "30"`. v1.4(clean)는 `"… 자금 이외의 자체 보유 자금(영업활동으로 발생한 수익금 등)" · "자금" · "을 대여…" · "30"` — 즉 **v1.4 본문 자체에 "등)자금을" 이 들어 있다**(문장 안에 '자금'이 두 번 있는 것은 v1.4 원문의 사실). Word 의 `비교.docx` 는 `plain "…등)" · w:ins@Pioneer "자금" · plain "을 대여…"`.
- 산출 명령: `python3` + `zipfile`/`ElementTree` 로 `word/document.xml` 의 `w:p` 순회, `w:ins`/`w:del` 조상 표기(스크립트 본문은 3차 산출물에 보존 예정).

**F2. Word 의 동작.** 원본(v1.2)의 추적 변경을 **수락한 상태**("…등)을 대여")를 기준으로 v1.4("…등)자금을 대여")와 비교해 **"자금" 삽입 하나**만 표시한다(글자 단위 최소 차이).

**F3. 우리 파이프라인 3경로의 결과(같은 입력).**
| 경로 | 구현 | 제14조 ④ 결과 | Word 와 일치 |
|---|---|---|---|
| 추적 변경 docx 생성 | `tracked_docx.py` `_styled_tokens` = **글자 단위 토큰** + `difflib.SequenceMatcher(autojunk=False)` | `w:ins "자금"` 만 | **일치** |
| 웹 결과 화면(문서 뷰·변경 목록) | `document-compare/documentComparison.ts` `diffText` = **단어 토큰**(`/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu`) + LCS(`diffUnits`) | `deleted "을"` + `added "자금을"` | **불일치** — 사용자가 본 '자금 두 번' = 수정 후 열에 `자금(…등)` 뒤에 강조된 `자금을` 이 붙어 보이는 표시 |
| 파이썬 `compare.py` `compare_documents` | `TOKEN_PATTERN = \s+|[\w]+|[^\w\s]` 단어 토큰 + SequenceMatcher | `deleted "을"` + `added "자금을"` | 불일치(웹 worker 가 이 함수를 아직 호출하는지는 **미확인** — 반박 1차에서 판정) |
- 재현: `/tmp/worklazy-wc/run-ts.mjs`(esbuild 번들 `documentComparison.ts` → `compareDocumentModels` + `diffText` 직접 호출) · `generate_tracked_document(v1.2, v1.4, out, 'Worklazy', False, True, False)` → 29 · `compare_documents(...)` → `changes[4].segments`.
- `diffCharacters`(글자 단위 최장 공통 부분열 재귀)가 `documentComparison.ts:383` 에 **정의되어 있으나 호출처 확인 필요**(반박 1차).

**F4. HWP.** `hwp-compare/hwp-compare.worker.ts:75` 가 **같은** `compareDocumentModels` 를 호출한다 → 같은 입도 결함, 같은 수정으로 해소. HWP 는 추적 변경 문서 생성 경로가 없다. HWP 원본 안의 변경 추적(한글 '변경 내용 추적') 처리 여부는 **미확인**(반박 1차 판정 요청).

**F5. 결과 화면 UI 현황.** 결과 페이지는 `UtilityPage`(`components/UtilitySurface.tsx:19`) `max-w-[1030px]` 안에 `min-w-[940px] grid-cols-2 gap-x-[22px] p-5`(`WordCompareResultPage.tsx:208`) 두 열. 1920px 화면에서 좌우 여백이 크다(사용자 스크린샷). 이동 바는 `sticky top-2 mx-auto w-max`(`:207`) — 가운데 상단 고정.

## 2. 원인 판정
**입도 차이**다. 정렬(문단 매칭)은 두 파이프라인이 같고, 문단 안 텍스트 diff 의 **토큰 단위가 웹 경로만 '단어'** 여서 한국어 조사가 붙은 어절(`을` → `자금을`)이 통째로 교체로 표시된다. Word 와 우리 추적 docx 경로는 글자 단위이므로 `자금` 삽입만 나온다. "우리 코드로 비교하면 자금이 두 번" 은 표시 입도 문제이고, 최종 문장 텍스트는 세 결과가 모두 v1.4 와 같다.

## 3. 설계 후보(반박 대상)
- **A. 단어 LCS 후 교체 구간만 글자 단위 정제(권장)**: `diffUnits` 결과에서 인접한 `deleted`+`added` 쌍마다 글자 공통 접두·접미를 잘라 내고(또는 기존 `diffCharacters` 를 그 쌍에만 적용) 남은 차이만 표시. `을`→`자금을` ⇒ `added "자금"`. 문단 정렬·큰 이동은 단어 단위 유지(잡음 억제), 비용은 교체 구간 길이에 비례.
- **B. 웹 경로를 글자 토큰으로 전환**(추적 docx 와 동일 알고리즘): 단일 진실이 되지만 긴 문단의 실질 편집(`회사`→`투자자`)에서 글자 단위 부분 일치 잡음이 생길 수 있다(Word 도 같은 성질). `diffUnits` 1.5M 셀 가드 안에서 글자 수 제곱 비용.
- **C. 두 경로의 결과 동치를 계약으로**: 어느 안이든 **같은 문단에 대해 웹 세그먼트의 added/deleted 연결 문자열 == 추적 docx 의 ins/del 연결 문자열** 을 oracle 로 둔다(현행 fixture + 본 건 패턴의 합성 fixture — 사용자 문서는 커밋 금지).
- **D. 단일 diff 코어(사용자 질문 2026-09-07 10:40 "웹·추적 생성 경로가 로직을 다르게 쓰나, 같은 로직이 낫지 않나" → 채택 방향)**: 실측 — 살아 있는 문장 diff 구현은 둘(TS `documentComparison.ts` 웹 / 파이썬 `tracked_docx.py` 추적 docx), 파이썬 `compare.py` 의 `_segments`·`compare_documents` 는 **웹 worker 호출처 0(죽은 경로)**, Excel 비교(`excel-compare/compareEngine.ts`)는 셀·행·열 정렬이라 문장 diff 없음. 방향: **문장 diff 코어를 TS 한 곳**으로 두고 추적 docx 파이썬은 pyodide **JS 역호출**로 같은 함수를 받아 XML 쓰기만 담당 → 웹 화면과 내려받은 docx 가 항상 같은 변경을 표시. 문단 정렬(TS `documentAlignment.ts` vs 파이썬 `_align_elements`)의 통일은 **동치 oracle 로 차이를 먼저 측정**한 뒤 별도 단계(회귀 위험: 표·문단 분할·메모 anchor). 죽은 `compare.py` 문장 diff 는 제거 대상 표시(추출 함수 `extract_document_model` 은 현역). **사용자 확인(10:45) — 공용 기준 동작 = Word 와 일치하는 쪽(현행 파이썬 추적 docx 의 글자 단위 결과)**, 코드 위치만 TS 로 이동. 완료 기준: 현행 `tracked_docx.py` 출력(= Word) 을 fixture oracle 로 고정하고 새 공용 코어가 이를 재현. 글자 단위의 잘게 쪼개진 표시는 Word 와 같은 기준 동작으로 보며, 보완안(A)은 fixture 에서 Word 결과와 일치할 때만 채택. 2차 반박에서 판정: pyodide 역호출 성능(문단 수 × 호출 비용)·추적 docx 의 Word 일치 회귀(현행 글자 단위 결과 = Word 인 fixture 를 oracle 로 고정)·문단 정렬 차이 측정표.
- 파이썬 `compare.py _segments` 는 (i) 호출처가 살아 있으면 같은 정제 적용, (ii) 죽었으면 그 사실만 기록(제거는 backlog 「도달 불가 컴포넌트」 단위).

## 4. UI 항목(사용자 결정 2·3)
- **U1 폭**: 결과 페이지만 컨테이너 상한을 넓힌다(제안: `UtilityPage` 에 `wide` 옵션 → `max-w-[1480px]`; 두 열 각 ≈700px, 22px 간격 유지; 820px 이하 현행). 정확한 값은 반박 라운드에서 1280/1440/1920 실측 캡처로 정한다. 다른 도구 페이지 폭 불변.
- **U2 이동 바**: 데스크톱(≥821px)에서 **우측에 스크롤을 따라다니는 고정 바**(결과 뷰 영역 우측 가장자리, 세로 중앙 또는 상단; `position: sticky`/`fixed` 중 CLS 0·본문 겹침 0 을 만족하는 쪽), 모바일은 현행 유지 후보. 키보드 포커스 순서·`aria-label` 유지, 본문 텍스트를 가리지 않도록 여백 확보.
- 둘 다 「배포 전 로컬 시각 검수」(규칙 19) 대상: 시각 회귀 `document-compare` scenario 기준선 갱신 + Gemini/Claude 육안 + CLS ≤0.1 + a11y 0.

## 5. 완료 기준(초안 — 반박 후 확정)
`npm run build` · `npx tsc -b` · `npm run test:unit`(diff 정제 골든: `을`→`자금을` ⇒ `자금`; 영문·숫자·기호·공백 경계 반례; 긴 문단 성능 가드) · `TEST_SCOPE=word npm run test:browser` · `TEST_ONLY_HWP=1 npm run test:new-tools`(HWP 비교) · **동치 oracle**(웹 세그먼트 ↔ 추적 docx ins/del, 합성 fixture) · `npm run test:static` · `npm run test:visual`(document-compare scenario 갱신) · `A11Y_MAX_TOTAL=0 npm run test:a11y` · `npm run test:rendering` · `npm run bundle:measure` · `npm run css:orphans` · `git diff --check`. 사용자 문서(`dummyfortest/`)로 **수동 재현 1회**: 제14조 ④ 웹 결과 = `added "자금"` 만.

## 6. 명시 제외(초안)
문단 정렬 알고리즘 변경 · 추적 docx 생성 경로 변경(이미 Word 와 일치) · 원본 추적 변경의 "거부 상태 기준 비교" 옵션 신설 · Word 의 서식 비교 의미론 이식 · 다른 도구 페이지 폭 변경 · 모바일 이동 바 재설계(반박에서 필요 판정 시 재검토).

## 7. 반박 1차 요청(astra, 실험 모드·저장소 불변)
(a) F3 표 재현(세 경로) + `compare_documents`·`diffCharacters` 호출처 판정 (b) A vs B: 현행 fixture(`tests/fixtures` word/hwp)와 합성 반례 10개 이상(한국어 조사·영문 접미·숫자·기호·공백·이모지·긴 문단)에서 두 안의 세그먼트를 Word 기대(글자 최소 차이)와 비교, 잡음 사례 제시 (c) C 동치 oracle 의 실행 가능성(현행 추적 docx 결과와 웹 세그먼트를 같은 문단으로 묶는 키) (d) HWP: 공유 경로 확인 + HWP 원본 변경 추적 처리 현황 (e) U1: 1280/1440/1920 × ko/en 캡처로 폭 후보 비교, 사이드바(≈256px) 포함 실제 가용 폭 (f) U2: sticky vs fixed 의 CLS·겹침·포커스 실측, 모바일 처리 판정 (g) 배포 단위: `main` 에서 별도 브랜치 → 독립 배포(S3 `s3-pdf-finish` 는 이후 merge 로 따라감) 의 충돌 여부 (h) sol 이 재해석할 미정의 지점 열거. **(i, 2차 추가) 설계 D 단일 diff 코어 실행 가능성.**

## 왕복 기록
- v1 초안 2026-09-07 10:15 Claude. 기준 HEAD(main) `5bc6854175331bdd73b267784d9633cdccda8446`(반박 라운드는 main 기준 읽기·실험; 워킹트리는 `s3-pdf-finish` 이므로 **`git worktree`/`git archive main` 사본에서 실험**).

---

## v2 반영 (2026-09-07 11:05, Claude — astra 1차 반박 R1~R8 판정 + 사용자 결정 2건. 근거 `docs/jobs/todo/document-compare-rounds/round-1-REPORT.md`·`probes-r1/`)

**사용자 결정(11:00)**: ① '자금' 관찰 위치 = **웹 결과 화면(좌/우 열)**. ② 공용 diff 기준 = **단어 단위(현재 웹 = Word 와 동일)**.

### R1 사실 정정 — [수용, v1 §1 F1~F3·§2 폐기]
- 사용자 `비교.docx` 제14조 ④ = `w:del#142 "을"` + `w:ins#143 "자금을"`(ins 자손 run 전체 연결 — Claude 11:00 재판독으로 확인). **현행 웹 diff(단어 LCS)와 동일.** 다른 쪽은 우리 **추적 docx 생성기**(`tracked_docx.py` 글자 토큰) = `ins "자금"` 단독.
- 웹 수정 후 열은 `SideDiffText` 가 equal+added 만 그리므로 "…등)자금을 대여…" 를 한 번만 표시한다(`WordCompareResultPage.tsx:406-435` 판독). **문장 안 '자금' 2회는 v1.4 원문**("자체 보유 자금(…등)자금을")이며 Word 결과도 같다 → **웹 표시 결함 아님.** 사용자 스크린샷(제14조 ④ 웹 vs Word) 대조를 정본화 전 확인 항목으로 남긴다(불일치가 보이면 재조사).
- **목표 재정의**: "Word 와 맞추는 결함 수리" → **(i) 웹·추적 docx 두 산출물의 diff 통일(단일 TS 코어, 단어 단위 = Word) (ii) 결과 화면 UI 개선(폭·이동 rail·모바일 잘림·결과 ARIA) (iii) HWP 는 같은 TS 코어를 이미 쓰므로 fixture 보강만.** v1.4 원문 문구 중복을 자동 수정하지 않는다.

### R2 알고리즘 — [확정] 현행 `diffText`(단어 토큰 `/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu` + `diffUnits` LCS) 를 **공용 코어**로 고정. A1/A2/B 정제는 **채택하지 않음**(사용자 결정 ②). 정본에 고정할 규칙: 토큰 정의 · LCS tie-break(현행 `diffUnits` 역추적 순서: equal 우선 → added(col) ≥ → deleted) · 세그먼트 순서 deleted→added · 빈 세그먼트 제거 · 인접 동일 타입 병합. 1차 98쌍 세그먼트(`probes-r1/algorithm-results.json` 의 `current`) 를 **골든**으로 커밋(합성 27 + fixture 68 + HWP 2; 사용자 문단 1은 커밋 금지·수동 재현만).
### R3 경계 — [수용] 1.5M 셀 가드 유지(초과 시 전체 교체 2세그먼트 — 현행) · 정제 미도입이므로 재진입 없음 · `diffCharacters` 는 서식 비교(`inlineFormattingChanges`) 현역으로 **무변경**, 서식 골든 유지 · Unicode: code point 단위(`Array.from`/정규식 `u`), trim·NFC/NFD 정규화·surrogate 분할 금지, grapheme 강조는 범위 밖(명시).
### 설계 D 확정 — 추적 docx 생성기의 diff 를 TS 코어로
- `word.worker.ts` 가 `diffText` 를 pyodide 전역(JS 함수)으로 주입 → `tracked_docx.py` 의 `_paragraph_revision`(SequenceMatcher on `_styled_tokens` 글자 값, `:691-`) 을 **JS 세그먼트 → 글자 offset opcode 변환** 으로 대체. `_styled_tokens` 의 run 경계·서식 이벤트·기존 revision 보존 분기(`:680-`)는 유지(변경 대상은 "무엇이 바뀌었나" 판정만). 표 셀·메모·머리말/꼬리말 문단도 같은 경로.
- 파이썬 전용 폴백 구현 **금지**(이중 구현 재발). 파이썬 단독 테스트가 있으면 Node 에서 pyodide 를 띄우거나 세그먼트를 fixture 로 주입하는 방식으로 전환 — **2차 반박 (i)**: 역호출 성능(문단 수 × 호출 비용, 1차 fixture 5쌍 + 1,000문단 합성) · 현행 tracked docx 테스트가 어디서 실행되는지(`tests/`·pyodide 스모크) · 변환 오류 반례(탭·줄바꿈·`w:br`·빈 run·surrogate).
- 죽은 `compare.py` `compare_documents`·`_segments`·`_align_*`(호출처 0) **제거 포함**(추출기 `extract_document_model` 과 그 의존 함수만 남김 — 제거 후 `rg` 로 호출처 0 증명, worker 로드 정상). — 이견 시 backlog 로.
### R4 oracle — [수용, 범위 한정] 통일 후에는 같은 함수이므로 **텍스트 동치는 정확 일치**가 기대값: revision 없는 합성 fixture(1차 `oracle-package` 4키 + 5쌍) 에서 웹 세그먼트(added/deleted 문자열 **+ offset 순서**) == 추적 docx ins/del(자손 run·`w:tab`·`w:br` 복원). 키 = fixture sidecar `(pairId, storyPart, beforeIndexes, afterIndexes, table/row/cell/paragraph path)`, ko/en `location` 키 사용 금지. 명시 예외(ID·이유 열거): 기존 after revision 보존 문단 · 구조 revision(행·열·문단 표식) · 자동 번호 display 접두 · 메모 author · 서식 rPrChange. 사용자 문서 커밋 금지.
### R5 HWP — [수용] 범위 = rhwp 추출 텍스트에 같은 TS 코어(이미 공유 — 코드 변경 0). 추가: 실제 텍스트 변경이 있는 합성 HWP fixture(1차 `hwp.mjs` 방식, 빈 fixture 대체 아님·추가) 를 `TEST_ONLY_HWP=1 npm run test:new-tools` 와 시각 fixture 에 편입. HWP/HWPX 원본 변경 추적 의미론은 **명시 제외**. 안내 문구(ko/en) astra 문안 채택: "HWP/HWPX 의 검토 메모와 변경 추적 기록은 비교하지 않습니다. 해당 기록이 있는 문서는 변경 내용을 모두 적용한 사본으로 비교해 주세요." / "Review comments and tracked changes in HWP/HWPX files are not compared. For files with these records, compare copies with the changes accepted." — 기존 warning 의 `browser parser` 류 내부 명칭 표현 교체.
### R6 UI — [확정] **U1**: 결과 페이지 `UtilityPage` 호출에만 `className="min-[821px]:max-w-[1480px]"`(공용 기본폭·셸 padding 불변, `calc(100%−48px)` 미사용; 1280 에서 확대 효과 없음은 정상; 1920 본문 열 388→613px). **U2**: 결과 문서 x-scroll 과 이동 rail 을 형제 배치, nav 는 DOM 상 문서 앞·rail 안 `sticky top:80px`; **≥1600px rail 156/gap 12(텍스트 버튼), 821~1599px rail 52/gap 8(아이콘 + sr-only 이름 + tooltip, count 소자)**; 문서 최소폭 940 보존 → 821~1440 에서 내부 가로 스크롤 증가(1280: 48→108px) 는 **승인된 비용**(사용자 확인 항목 ★). 다크·ko/en 캡처 게이트.
### R7 모바일·a11y — [수용, 범위 포함 ★사용자 확인] 320 EN toolbar 잘림(page overflow 13px·Next hit=false) 수리: nav `minmax(0,1fr) 44px minmax(0,1fr)` + 버튼 줄바꿈 + toolbar wrap, 결과 toolbar ≤1200 세로 배치. **결과 ARIA 수리**: `article role=cell`·row 없는 columnheader·초과 스크롤 영역 키보드 진입 → 실제 결과 상태 axe **0**(1차 실측 71/72 위반 — 기존 결함, 현행 `test:a11y` 8 URL 이 결과 상태를 열지 않아 미검출). `DocumentTable` 실제 표 의미론 훼손 금지.
### R8 검증·통합 — [수용] production `build → tsc -b → test:unit → test:static` 보존 후 `VITE_LOCAL_QA=1` 빌드로 브라우저·시각·a11y·CLS(QA 산출물에 production 분석 검사 미적용). `TEST_SCOPE=word npm run test:browser` 에 이동 rail·Tab/Enter·변경0·영역0·전체내용 토글·문서 쌍 전환·compact/expanded 1599/1600·mobile 820/821 resize 추가. 결과 상태 a11y/CLS 는 업로드→비교→결과 진입 동작으로(URL 직접 goto 는 만료 화면) — `accessibility-audit.mjs`·`rendering-baseline.mjs` 에 결과 상태 진입 시나리오 등록 + unit 기대 목록 갱신. 시각 fixture: 장문/다중 변경(ko/en × 1280/1440/1920 × 320/390 × light/dark, initial·중간·끝 스크롤). 기준선 갱신은 `VISUAL_ONLY=document-compare VISUAL_CONCURRENCY=1 UPDATE_VISUAL_BASELINES=1 npm run test:visual` 로 한정, 공통 config 합치기 전 전체 baseline 정리 금지. **배포 단위**: 정본화 시점의 최신 `main` 해시로 **분리 체크아웃**(`git worktree`) 브랜치 → 독립 배포(규칙 19 로컬 시각 검수 + Gemini/Claude 육안, 규칙 18 Codex push — **push 전 사용자 보고**) → S3 가 최신 main 을 merge 하고 자체 게이트 재통과. S3 와의 공통 파일(CHANGELOG·review-notes·browser-smoke·accessibility-audit·rendering-baseline·visual config/scenarios) 은 파일별 병합, 한쪽 전체 선택 금지.
### 사용자 확인 필요(★) — 정본화 전
1. R6 의 가로 스크롤 비용(821~1440px 데스크톱에서 문서 내부 가로 스크롤 증가) 승인 여부.
2. R7 결과 ARIA 수리 포함 여부(기존 결함이라 범위 확대 — 권장 포함).
3. 제14조 ④ 스크린샷(웹 vs Word) 대조 — 웹 표시 결함 아님 결론에 이의 여부.

### 2차 반박 요청(astra)
(i) 설계 D 실행 가능성 — pyodide JS 역호출 성능·현행 tracked docx 테스트 위치·세그먼트→offset 변환 반례(탭·`w:br`·빈 run·surrogate·기존 revision 문단) 프로토타입 1회(1차 fixture 5쌍 + 사용자 문단은 메모리 처리) · 죽은 `compare.py` 함수 제거의 안전성(`?raw` 로드 영향). (ii) R2 골든 98쌍 커밋 형태(JSON fixture + unit) 와 tie-break 문안의 결정성. (iii) R4 sidecar 키·offset 검사 프로토타입을 통일 후 기대(정확 일치)로 재실행. (iv) R6/R7 문안대로 React 구현 시 상태 전환(tab·전체내용·문서 쌍·resize) 반례와 CLS 재확인, ARIA 수리안 DOM 초안 + axe 0 실측. (v) R8 결과 상태 진입 하네스 등록 방식(업로드 fixture·세션) 과 S3 최종 공통 파일 목록 재산출. (vi) sol 재해석 지점 잔여. 잔여 0 이면 [정본화 가능].

---

# 정본화 (2026-09-07 11:55, Claude — v3. 근거: astra 1·2차 반박 `document-compare-rounds/round-{1,2}-REPORT.md`·`round-2-AMENDMENTS.md`, 사용자 결정 5건)

## 우선순위·읽는 법
**정본화 v3 > v2 반영 > v1 본문** 순으로 우선하며, 충돌 시 v3 가 정본이다. v1 §1 F1~F3·§2(원인 판정)·§3 A/B/C 정제안·§4 UI 항목은 **폐기**한다. 충돌 시 이 절이 정본이다.

## 사용자 결정
1. (11:00) '자금' 관찰 위치 = 웹 결과 화면. 2. (11:00) 공용 diff 기준 = **단어 단위**(현행 웹 = 사용자 Word 산출물과 동일). 3. (11:52) 결과 화면 **가로 스크롤 비용 승인**. 4. (11:52) 결과 화면 **접근성 수리 포함**. 5. (11:52) **문서 비교는 엔진만, UI 는 UI 개편 계획으로 합침** → 결정 3·4 는 `ui-theme-redesign-20260907.md` 로 이관(아래 「이관」).

## 사실 (astra 재현으로 확정)
- 사용자 `비교.docx` 제14조 ④ = `w:del#142 "을"` + `w:ins#143 "자금을"`(ins 자손 run 전체 연결). **현행 웹 결과와 동일** — 웹 표시 결함 아님. 문장 안 '자금' 2회는 v1.4 원문이며 diff 입도로 없어지지 않는다.
- 현행 웹·`compare.py` 는 단어 토큰, 우리 **추적 docx 생성기만 글자 토큰**(`ins "자금"`) → 두 산출물 불일치가 실제 결함.
- `compare_documents` 는 제품 호출 0(죽음). `diffCharacters` 는 서식 비교 현역. `compare.py?raw` 와 `extract_document_model` 은 살아 있다.
- HWP 는 같은 `compareDocumentModels` 를 이미 공유(코드 변경 0). 기존 HWP fixture 는 본문 0(빈 문서).

## 확정 1 — 공용 diff 코어(문장 diff 정본)
`documentComparison.ts` 의 현행 `diffText` **하나**. 동일 문자열은 빈 값이면 `[]`, 아니면 equal 1개. 그 외 `/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu` 토큰화 → LCS(행=before·열=after, 첫 행/열 0, 같으면 대각+1, 다르면 위·왼쪽 max) → 마지막 셀 역추적((1) 양쪽 남고 끝 토큰 같음 → equal·대각 (2) after 남고 before 없거나 왼쪽 ≥ 위 → added·왼쪽 (3) 그 외 deleted·위) → 뒤집고 **인접 동일 타입만 병합**. 별도 정렬·글자 정제·trim·Unicode 정규화 없음. `deleted→added` 는 역추적 출력 성질이며 타입별 재정렬이 아니다.
**확정 1-a(가드, Q1 판정 = astra 권고 수용)**: `beforeTokenCount = tokenize(before).length`·`afterTokenCount = tokenize(after).length` 로 정의하고, `(beforeTokenCount+1)*(afterTokenCount+1) > 1_500_000` 이면 DP 없이 현행대로 `deleted(before)`·`added(after)` 두 항목을 반환한다. **문자열 길이·UTF-16 길이·code point 길이로 가드 크기를 계산하지 않는다**(3차 반례: 1,500자 두 덩어리 + 공통 꼬리 → 토큰 셀 16 vs 문자 셀 2,268,036, 문자 기준이면 `equal " tail"` 이 사라진다). 동일 문자열 조기 반환은 이 가드보다 먼저 실행한다. **"모든 경로에서 빈 세그먼트 제거" 문장은 삭제**(현행 동작 보존). 빈 항목은 XML opcode 어댑터가 길이 0 으로 건너뛴다. 공용 API 에서 빈 항목을 없애려면 별도 변경으로 승인받는다.
**확정 1-b(골든)**: `tests/fixtures/document-compare/word-diff-golden.json` + `tests/unit/document-diff-golden.test.ts`. 1차 98쌍 중 사용자 문단 1쌍을 뺀 **97쌍**(합성 27·Word fixture 68·HWP 2)을 **정적 기대값**으로 고정, 실행 시 현행 함수로 자기 생성 금지. 사용자 문단은 메모리 재현만(커밋 금지).

## 확정 2 — pyodide 역호출·생성기(설계 D)
- `word.worker.ts` 초기화에서 동기 JS 함수 `worklazyDiffJson(before, after) => JSON.stringify(diffText(before, after))` 를 worker JS 전역에 등록한 뒤 Python 로드. Python 은 `from js import worklazyDiffJson` + `json.loads`(값만 수신, PyProxy 방치 금지). **Python 단독 fallback 없음.** 주입 실패·타입 오류·before/after 재구성 불일치는 작업 실패로 전달하고 기존 현지화 오류 경계 사용(내부 명칭 비노출).
- `_paragraph_revision` 의 글자 토큰을 연결한 before/after 를 공용 함수에 넘기고, Python `len(segment.text)`(code point) 로 양쪽 cursor 누적: equal 양쪽·deleted before·added after. offset 은 정규화하지 않은 0-based code point 경계. **JS `.length` 를 Python 인덱스로 쓰지 않는다.** 마지막 cursor == 입력 길이 검증. `w:tab=\t`·`w:br|w:cr=\n`, run 경계·빈 run 은 길이 0, 유효 surrogate pair 는 1 code point. 기존 이벤트·서식·revision 보존 분기 유지.
- **변경 범위는 `_paragraph_revision` 의 문장 diff 판정뿐**. 문단·표 정렬의 `SequenceMatcher` 는 광역 제거하지 않는다.
- **죽은 코드 제거**: 제거 대상 정본은 **2차 산출** `docs/jobs/todo/document-compare-rounds/probes-r2/pruning.json`(SHA-256 `d2c74bea63190073d951e57818bec11d1e072a9580282577fdccf58b53997894`) 의 `removed` **31개 정의**이며 `keep` 17개와 추출 의존 폐쇄를 보존한다. 착수 기준 코드에서 각 정의의 존재와 의존 폐쇄를 확인하고, 달라졌으면 **새 삭제 대상을 임의 산출하지 말고 기준 변경 영향으로 보고**한다. 제거 후 `extract_document_model` 의존 폐쇄는 보존(`_cell_payload`·`_display_text`·번호 계산기 등 이름이 비교처럼 보여도 유지). 검증 = 추출 ko/en × tables on/off × metadata on/off × 10파일 **80건 동일 출력**. `compare.py?raw` import 와 `runPython(compareScript)` 보존.
- **확정 2-a(메모, Q2 판정 = astra 권고 수용)**: `word/comments.xml` 은 기존대로 **after bytes 보존**. 대상은 본문·표 셀·활성 머리말/꼬리말·각주/미주 문단. 웹 메모 diff 표시는 유지. 메모 본문의 내려받기 diff 는 **범위 밖**(별도 범위·ID 대응·수락/거부 의미론·기존 `trackedComments===afterComments` 테스트 변경이 선행되어야 함).

## 확정 3 — 동치 oracle
- **첫 라운드 oracle 4개 키는 실제 생성 DOCX 에서 검사**하고, 5쌍 fixture 는 `_paragraph_revision` 호출 sidecar 검사와 전체 패키지 구조/수락/거부 검사를 구분한다.
- 보장 범위: **같은 before/after 입력이 전달되는 revision 없는 1:1 문단과 단일 문단 셀**에 대해 문자열·변경 offset·순서 **정확 일치**. "공용 함수이므로 항상 같다" 는 보장하지 않는다.
- sidecar 키 = `pairId, storyPart, beforeIndexes[], afterIndexes[], beforePath, afterPath`(부모 block 배열 0-based, 경로에 story root/content control/table/row/cell/paragraph 포함). ko/en location·호출 순번을 키로 쓰지 않는다. 분할 임시 문단은 원본 group 인덱스 + source slice `[start,end)` 추가. property change·문단 끝 표시를 텍스트와 혼합 금지. 인접 revision 이 서식 run/ID 로 나뉜 경우 cursor 보존하며 같은 타입 병합 후 비교. **문자열이 같아도 offset 1 이동한 음성 대조가 실패해야 한다.**
- **확정 3-a(Q3 판정 = astra 권고 수용)**: 명시 예외를 fixture ID·이유로 고정 — E1 기존 after revision 보존(수락 후 텍스트 동일 포함) · E2 문단 분할/병합·행/열/문단 표시 · E3 자동 번호 display 접두 · E4 메모 본문/author · E5 서식 property revision · **E6 여러 문단을 연결한 셀의 diff 입력 차이**(예: 셀 `['Alpha ','Beta']→['Alpha','Beta']` 에서 웹 `del ' \n' + ins '\n'` vs 생성기 `del ' '`). **E2·E6 은 이름 붙은 회귀 fixture 로 명시 제외**하고, 문서 전체 diff 통일은 backlog(TS 정렬 group·셀 세그먼트를 Python 작성기에 전달해 문단 경계를 재배분하는 별도 설계 필요).

## 확정 4 — HWP
코드 변경 0(같은 코어 공유). **실제 텍스트 변경이 있는 합성 HWP fixture 를 추가**(1차 `hwp.mjs` 방식, 기존 빈 fixture 는 유지·대체 아님) 하고 `TEST_ONLY_HWP=1 npm run test:new-tools` 에 편입. HWP/HWPX 원본 변경 추적 의미론은 **명시 제외**. 안내 문구 교체(내부 명칭 제거): ko "HWP/HWPX 의 검토 메모와 변경 추적 기록은 비교하지 않습니다. 해당 기록이 있는 문서는 변경 내용을 모두 적용한 사본으로 비교해 주세요." / en "Review comments and tracked changes in HWP/HWPX files are not compared. For files with these records, compare copies with the changes accepted."

**확정 4-a(화면 문구 영향 — 3차 R3-3 수용)**: HWP **diff 알고리즘 변경은 0** 이지만 위 안내 문구 교체는 **사용자 화면 문구 변경**이다. 따라서 "UI 변경 0" 은 폭·rail·모바일·ARIA·신규 등록에 한정하고, 문구 변경분은 다음을 검증한다 — ① `TEST_ONLY_HWP=1 npm run test:new-tools` 에 ko/en 안내 문구 단언 + 신규 실텍스트 fixture 의 변경 문자열·수정 후 본문 복원 단언 추가 ② `VITE_LOCAL_QA=1` QA 빌드에서 안내가 보이는 결과 화면을 **ko/en 데스크톱 + 320px 모바일**로 직접 확인(줄바꿈·잘림·가로 초과)하고 정상 DOCX 웹 결과 표본도 확인 ③ `VISUAL_ONLY=document-compare VISUAL_CONCURRENCY=1 npm run test:visual` 실행 — 기존 `interaction-hwp-result` 기준선 차이가 실제 발생하면 검토·기록 후 **그 상태의 기준선만** 갱신(전체 cleanup 금지) ④ 안내는 worker inline `L(ko,en)` 이라 locale JSON·SEO 정적 본문에서 생성되지 않음을 기록하고, SEO·FAQ·route·sitemap·광고/격리 불변을 명시(worker 번들 해시 변경을 정적 본문 변경과 혼동하지 않는다). 장문 시각 fixture·결과 a11y/rendering 신규 등록은 이번에 추가하지 않는다(§6-B 이관 유지).

## 이관 — UI 항목은 `ui-theme-redesign-20260907.md` 로 (사용자 결정 5)
U1 결과 폭(`min-[821px]:max-w-[1480px]`, 1920 본문 열 **529px** — rail 차감 후 최종 실측; 613px 은 rail 미차감 수치) · U2 이동 rail(≥1600 rail156/gap12, 821~1599 rail52/gap8, `sticky top:80px`, DOM 상 nav 우선, 940 최소폭 유지, **가로 스크롤 증가 승인됨**) · 모바일 320 EN toolbar 잘림 수리 · **결과 ARIA 수리(axe 0)** · 상태 계약(`resultTab`·`showFullContent` 유지, 선택 index 초기화 규칙, key 범위) · 결과 상태 진입 하네스 등록(a11y result 3 ID·rendering document-result·시각 fixture) · 공용 진입 helper `tests/document-result-entry.mjs`. **`round-2-AMENDMENTS.md` D·E 의 UI 관련 원문 전체를 필수 계약으로 채택**하며, §6-B 의 U1~U6 요약은 그 원문을 대체하지 않는다.
→ 따라서 **이 정본의 UI 변경은 0**: 시각 기준선 갱신·a11y/rendering 신규 등록·시각 fixture 는 이번 범위에 없다.

## 기준 해시·브랜치·배포
정본화 시점 최신 `main` 해시를 착수 직전 재고정(현재 `5bc6854175331bdd73b267784d9633cdccda8446`). **분리 체크아웃**(`git worktree`)에서 독립 브랜치로 구현 — 현재 `s3-pdf-finish` 워킹트리를 전환하지 않는다. 배포 1회(규칙 19 로컬 시각 검수는 UI 변경 0 이므로 결과 화면 표본 확인으로 갈음, 규칙 18 Codex push, **push 전 사용자 보고**). S3 와의 공통 파일 9개(CHANGELOG·review-notes·browser-smoke·accessibility-audit·rendering-baseline·`unit/accessibility-audit.test.ts`·`unit/rendering-baseline.test.ts`·visual config·visual scenarios) 는 **파일별 병합**, 한쪽 전체 선택 금지. 이 정본은 UI 미포함이라 실제 교집합은 CHANGELOG·review-notes·browser-smoke 로 줄어든다.

## 완료 기준 검증 명령
production `npm run build` → `npx tsc -b` → `npm run test:unit`(골든 97 포함) → `npm run test:static` 보존 후, `VITE_LOCAL_QA=1 NODE_OPTIONS=--max-old-space-size=4096 npm run build` 로 추적 없는 QA 산출물을 만들어 확정 4-a 의 화면 확인을 수행한다(QA 산출물에 production 분석 코드 존재 검사 미적용). 스모크: `TEST_SCOPE=word npm run test:browser`(입도 변경·추적 docx 내려받기) · `TEST_ONLY_HWP=1 npm run test:new-tools`(신규 실텍스트 fixture) · `npm run test:browser` 전체 · `npm run test:office` · `npm run test:excel-cleaner`·`test:excel-compare`. **동치 oracle**(sidecar 키·offset·음성 대조, E1~E6 예외 ID) 실행. `npm run bundle:measure`(5종) · `css:orphans` · `node tests/tool-registry-routes.mjs` · `git diff --check`. 사용자 문서로 **수동 재현 1회**: 제14조 ④ 에서 웹 세그먼트와 추적 docx ins/del 이 같은 문자열·offset. 빌드·브라우저 직렬 `NODE_OPTIONS=--max-old-space-size=4096`, 분리 체크아웃에서 전체 unit 통과.

## 명시 제외
문단 정렬 알고리즘 변경 · 글자 단위 정제(A1/A2/B/C) · 메모 본문 diff 의 docx 반영 · HWP/HWPX 원본 변경 추적 의미론 · E2·E6 범위의 동치 · 결과 화면 UI(폭·rail·모바일·ARIA — UI 개편으로 이관) · 사용자 문서의 fixture 커밋 · `diffCharacters`(서식 비교) 변경 · 새 npm 의존.

## 착수 조건
astra 3차 확인 라운드에서 **이견 0** 선언 → sol 디스패치(이 정본의 절을 인용, 새 결정 금지).
