# 문서 비교 diff 통일·결과 화면 UI v2 — 2차 반박 보고 (Codx)

**(i)~(vi) 실험 판정 완료. 기술 잔여 이견 3건(Q1·Q2·Q3). 정본화 보류.** 기존 v2의 ★사용자 확인 3항목은 기술 이견 수와 별도로 미확정 상태를 유지한다. 단어 단위 공용 TS 코어라는 사용자 결정을 되돌리지 않았다.

정본에 붙일 구체 문안은 [CANONICAL-AMENDMENTS.md](CANONICAL-AMENDMENTS.md)에 모았다. 이 문안과 보고서는 `/tmp/worklazy-dc-r2/`에만 썼다. 원본 계획서·CHANGELOG·review-notes 수정, 커밋·push·브랜치 전환은 하지 않았다.

## 실행 게이트와 실험 구성

- 첫 실행은 원본 `PROJECT_RULES.md` 전문 읽기였다. 이어 AGENTS, 지정 dispatch, v2 전체, 1차 REPORT·프로토타입, 관련 review-notes와 열린 계획서를 읽고 검색했다. [열린 계획서 검색](logs/open-plan-scan.txt).
- 실험 기준 main **5bc6854175331bdd73b267784d9633cdccda8446** 일치. 현재 HEAD는 S3라 기준 해시와 의도적으로 다르며 지정대로 `git archive` 사본을 사용했다. 그 워킹트리에서 빌드하거나 전환하지 않았다.
- 사본 `/tmp/worklazy-dc-r2/main/`; Python 역호출 실험은 worker 밖의 [tracked_prototype.py](probes/tracked_prototype.py), [bridge.mjs](probes/bridge.mjs), [bridge_suite.py](probes/bridge_suite.py). **worker 연결을 제품에 구현한 통합 완료본은 아니다.** 사본 worker 자체는 main과 동일하며 브라우저는 추출기 정리·React UI를 검사한다. 새 diff를 쓰는 DOCX 패키지는 별도 Node pyodide 실험에서 생성했다.
- Node 22.17.1, pyodide 0.29.4, Playwright1.63.0/Chrome152, axe4.13.0. 빌드와 브라우저는 직렬, `NODE_OPTIONS=--max-old-space-size=4096`.
- 사용자 DOCX 3개는 원본에서 읽기만 했다. v1.2/v1.4 입력과 새 DOCX는 Pyodide memory FS/BytesIO에서 처리하고 전체 추출 텍스트·파생 DOCX를 디스크에 기록하지 않았다. 보고 JSON에는 요청 문단의 변경 문자열·offset·길이만 남겼다. 합성 입력12개와 비사용자 골든97개는 [inputs](inputs/)에 보존했다.

## (i) 설계 D 역호출·변환·추출기 제거 — [동의], 메모 범위는 [반박: 증거]

재현:

```bash
export NODE_OPTIONS=--max-old-space-size=4096
node /tmp/worklazy-dc-r2/probes/bridge.mjs
node /tmp/worklazy-dc-r2/probes/extra.mjs
```

[bridge.log](logs/bridge.log), [bridge-results.json](bridge-results.json), [extra.log](logs/extra.log), [전체 패키지 성능](full-package-performance.json).

JS 전역에 `worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b))`를 주입하고 Python에서 실제 역호출했다. Python은 반환 JSON을 읽고 `len(text)`로 양쪽 code point offset을 누적하여 원래 XML emitter에 넘긴다. JS UTF-16 `.length`를 쓰지 않으며 별도 Python diff fallback을 만들지 않았다. 탭/개행을 글자 토큰으로 재구성한 값에 대해 before/after 완전 복원을 검사한다. 서로 다른 run·서식 때문에 revision ID가 나뉘어도 읽기 oracle은 위치를 유지하며 같은 타입을 합친다.

|fixture|새 revision 수|실제 문단 emitter 호출|문자열·offset 일치|예외|
|---|---:|---:|---:|---|
|base|15|17|16|기존 after revision|
|split|13|7|6|기존 after revision|
|boundary|0|9|8|기존 after revision|
|formatting|4|6|6|없음|
|revisions|18|16|10|기존 after revision|
|oracle|9|4|4|없음|

5쌍은 `include_formatting=True, include_tables=True, include_metadata=True`; user 대상은 False/True/False다. 이 조건이 다른 1차 revision 개수와 단순 비교하지 않는다. 표의 `oracle`은 5쌍과 별도인 첫 라운드 package4키다. **55호출 중46일치**는 같은 입력의 paragraph emitter 검사다. 이를 5개 웹 문서 전체가 모두 동일하다고 과장하지 않는다. 웹 그룹과 writer 입력 범위의 차이는 (iii)에 따로 판정했다.

사용자 대상 문단: before길이207/after209 code points. `deleted "을"`은 before104/after104, `added "자금을"`은 before105/after104; 새 DOCX와 공용 세그먼트가 일치했다. 새 전체 revision 수40. 전체 사용자 텍스트는 출력하지 않았다. 제공 Word와의 일치는 1차에서 재판독된 해당 문단 변경에 한정하며 모든 Word 비교 의미론을 재현했다고 주장하지 않는다.

변환 반례: `tabs`, `br`, `cr`, `surrogate`(😀 뒤 편집), `combining`, `empty-run`, `empty-text`는 **7/7 정확 일치**. `existing-after`는 기존 revision 보존 때문에 예상대로 비동치. `tab-only-history`는 해당 표본에서 일치했다. 기존 after revision 예외는 `_has_visible_text_revision` 분기가 직접 반환하는 경우에만 한정하면 안 된다. accepted text가 동일하여 원본 XML을 반환한 `boundary`의 기존 ins도 예외다. callback 미주입 모사(TypeError), 재구성 불일치(ValueError)는 **둘 다 실패로 종료**했으며 fallback으로 성공하지 않았다.

성능은 범위를 나누어 측정했다:

|측정|실측|
|---|---:|
|Node pyodide 최초 준비|2075.4ms|
|1,000 변경 문단 `_paragraph_revision` XML emitter|296.1ms|
|위 emitter 중 실제 JS 역호출+JSON 파싱 1,000회 합계|56.0ms|
|별도 역호출+opcode 소비 1,000회|36.5ms|
|1,000문단 전체 DOCX, 전 문단 변경·공통 앵커 없음|146741.2ms = 146.74초|
|위 전체 DOCX 중 역호출 1,000회 합계|60.75ms|
|위 전체 DOCX 산출|2000 revisions / 376,077B|

역호출 비용 자체는 작다. 전체 생성 시간은 정렬을 포함한 나머지 처리에 146680.5ms가 들었다. 단문1000개 emitter 벤치만 보고 전체1000문단 문서가0.3초라고 보고하면 틀린다. 이번에는 성능 임계값을 새로 정하거나 문단 정렬을 고치지 않았다. 최종 구현은 기존 문서 크기·시간 계약 안에서 이 전체 비용을 고려해야 한다.

**현행 테스트의 실행 위치와 의존성:** `tests/browser-smoke.mjs:994-999,1662-1766`이 브라우저 worker로 DOCX를 생성/다운로드한 후 JSZip으로 XML·수락/거부·서식·번호·메모를 검사한다. `assertUnifiedTrackedDocument:1768`도 브라우저 생성 경로다. tracked 생성기를 직접 실행하는 CPython 단독 테스트는 tests 검색에서 발견하지 못했다. `tests/zip-unicode-comparison.mjs:35`의 python3 호출은 ZIP 진단이며 tracked 생성 테스트가 아니다. 재현 검색은 [test-call-sites.txt](logs/test-call-sites.txt), [comments-and-raw.txt](logs/comments-and-raw.txt). 따라서 현행 tracked 테스트를 새 Python fallback으로 유지할 이유가 없다. 새 코어 unit/브리지는 Node pyodide, 기존 패키지 회귀는 browser smoke로 나누면 된다.

**메모 반박(Q2):** `_revisionize_comments`는 정의만 있고 `generate_tracked_document` 호출처0이다. 같은 ID의 메모 `Review cat→Review cats`를 만든 실제 DOCX는 `comments.xml`을 after와 byte-identical하게 보존했고 새 ins/del이 없었다. 직접 helper 호출은 새 세그먼트를 만들지만 이것은 제품 생성 경로가 아니다. 기존 스모크1736행도 `trackedComments !== afterComments`면 실패하도록 강제한다. v2의 “메모 문단도 같은 경로” 및 “메모 author만 예외”는 현행 계약과 동시에 만족할 수 없다.

**추출기 정리:** AST 의존 폐쇄로31개 정의를 제거하고17개 정의를 남긴 사본은 55,401→26,800B. 삭제/보존 이름은 [pruning.json](pruning.json). `_cell_payload`, `_display_text`, `_display_format_runs`, 번호 계산기는 현역 의존이다. ko/en×tables on/off×metadata on/off×10파일 **80/80 동일**, 제거된 `compare_documents/_segments/_align_records` Python global0. `compare.py?raw` import 및 `runPython(compareScript)`를 유지한 실제 브라우저 업로드/결과 진입과 Word 스모크도 통과했다.

정본 반영: [문안 A/B](CANONICAL-AMENDMENTS.md). **(i) 잔여1건 Q2**. 역호출 방식 자체에 대한 기술 반대는 없다.

## (ii) R2 골든·tie-break — [동의], 가드 반환 계약은 [반박: 증거]

```bash
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r2/probes/golden.mjs
cd /tmp/worklazy-dc-r2/main
NODE_OPTIONS=--max-old-space-size=4096 node --test --experimental-strip-types tests/unit/document-alignment.test.ts tests/unit/document-diff-golden.test.ts
```

[golden.log](logs/golden.log), [golden-results.json](golden-results.json), [고정 JSON](main/tests/fixtures/document-compare/word-diff-golden.json), [unit](main/tests/unit/document-diff-golden.test.ts), [unit-targeted.log](logs/unit-targeted.log).

- 원98쌍에서 사용자1쌍 제외 → 커밋용**97쌍**(27/68/2). JSON **161,515B**, unit **434B**. 실험 산출물만 준비했으며 커밋하지 않았다.
- 현행 diff의 골든97/97 일치. [golden.mjs](probes/golden.mjs)의 별도 2차원 배열 구현으로 행/열/동점/역방향/뒤집기/병합을 문장대로 다시 작성하여 **97/97**, 반복 토큰 전수 **3,969/3,969** 동일 결과를 냈다. 각 구현의 코드 형태를 그대로 복사한 대조가 아니다. 표본 일치는 보편적 형식 증명은 아니므로 정본에는 재현 가능한 점화식·역추적 규칙 자체를 적는다.
- **Q1 반례:** `diffText('', 'a '.repeat(750000))`는 현행 가드에서 `deleted('')`, `added(1500000 chars)`를 반환한다. “현행 반환을 고정”과 “모든 빈 세그먼트를 제거”가 충돌한다. 권고는 코어 guard 반환은 그대로 고정하고 XML 어댑터만 빈 항목을 건너뛰는 것이다. 이 선택을 정본 문장에 명시해야 sol이 임의 정규화하지 않는다.

정본 반영: [문안 A](CANONICAL-AMENDMENTS.md). **(ii) 잔여1건 Q1**. 97개라는 수치 정정·정확한 tie-break 설명은 별도 이견으로 중복 계산하지 않았다.

## (iii) R4 sidecar·offset·예외 — [일부 동의], 전범위 정확 일치는 [반박: 증거]

```bash
python3 /tmp/worklazy-dc-r2/probes/sidecar.py
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r2/probes/extra.mjs
```

[sidecar-results.json](sidecar-results.json), [sidecar.log](logs/sidecar.log), [extra-results.json](extra-results.json). 첫 라운드 네 개 키를 새 생성 DOCX에서 다시 읽어 검사했고 **4/4 문자열+양쪽 code point offset+순서 정확 일치**. added 문자열을 유지한 채 afterOffset을1 옮긴 대조는 실패했다.

sidecar는 `pairId/storyPart/beforeIndexes/afterIndexes/beforePath/afterPath`를 사용한다. 인덱스가 같은0이라도 content control·표 셀의 부모 경로가 달라 구별된다. `_paragraph_revision`에 건네준 원본 XML 객체의 경로를 parse 단계에서 기록했으며 ko/en location/text 검색으로 키를 만들지 않았다. 분할 문단은 실제 원본 before 객체가 아니라 합성 slice이므로 `beforePath=null, syntheticBoundary=true`; 최종 구현용 sidecar에는 원본 group+source slice를 명시해야 한다. 호출번호는 보고서의 진단 ID일 뿐 매칭 키가 아니다.

|예외 ID|실제로 확인한 대상|판정|
|---|---|---|
|E1_AFTER_HISTORY|base:1, split:2, boundary:2, revisions:0/8/12/13/14/15|9문단. 기존 after ins/del/이동·삭제 기록 보존; accepted text가 같은 경우 포함|
|E2_STRUCTURAL_GROUP|split:0+1, before[0]→after[0,1]|웹 한 group의 diff와 writer 두 slice의 diff는 입력이 다름; 웹 합성 newline과 문단 끝 revision을 구별|
|E3_NUMBERING_DISPLAY|split fixture 첫 문단의 웹 `1. ` 접두|웹 display 번호는 w:t 외 정보이며 writer 본문 offset0과 직접 같지 않음|
|E4_COMMENTS_PRESERVED|comments-multipara:comment:0|author뿐 아니라 메모 본문 전체가 after 보존 계약. Q2와 같은 원인이므로 중복 이견 아님|
|E5_PROPERTY_REVISION|formatting fixture6문단 및 property change|텍스트 oracle에서 rPrChange/pPrChange 등은 제외; 6/6 텍스트 일치, property XML은 기존 smoke가 별도로 검사|
|E6_CELL_PARAGRAPH_COORDINATES|comments-multipara:cell:0 및 `Alpha ` 반례|다중 문단 셀은 웹이 newline으로 연결한 입력, writer는 문단별 입력|

**Q3 결정적 반례:** 문단 수·표 구조·revision 없는 동일2문단 셀에서 `['Alpha ','Beta'] → ['Alpha','Beta']`를 비교했다. 웹은 `deleted ' \n' + added '\n'`, 생성 DOCX는 `deleted ' '`만이다. 현재 R4 예외인 “구조 revision”만으로는 설명되지 않는다. XML offset에 가상의 paragraph newline을 더해도 변경 문자열 자체가 같아지지 않는다. 같은 함수를 쓰는 것과 같은 입력 범위를 쓰는 것은 별개다.

따라서 명시한1:1 paragraph 및 단일 문단 셀의 정확 일치는 승인 가능하다. 전체 문서 동치가 필수라면 셀/group 단위의 같은 세그먼트를 XML 각 문단에 배분하는 별도 설계가 필요하다. 이번에 제외한다면 **E6을 구체 fixture ID로 고정하고 보장 범위를 좁힌다**고 정본에 적어야 한다. 모든 표를 광역 예외로 두자는 뜻이 아니다.

정본 반영: [문안 C](CANONICAL-AMENDMENTS.md). **(iii) 잔여1건 Q3**; Q2 재계산 없음.

## (iv) R6/R7 React 구조·상태·CLS·axe — [동의], 실측 수치/검사 선택자 [보완 제안]

프로토타입은 [React JSX](main/src/features/word-compare/WordCompareResultPage.tsx)와 결과에만 적용되는 [실험 CSS](main/src/features/word-compare/round2-prototype.css)다. DOM 재배치 MutationObserver 없이 rail과 x-scroll을 형제로 렌더하고 실제 세션의2쌍 결과를 사용했다. [ui.mjs](probes/ui.mjs), [ui-results.json](ui-results.json), [ui-supplement.json](ui-supplement.json).

```bash
cd /tmp/worklazy-dc-r2/main
NODE_OPTIONS=--max-old-space-size=4096 npm run preview -- --host 127.0.0.1 --port 4198 --strictPort
# 별도 셸, 빌드가 끝난 뒤 직렬 실행
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r2/probes/ui.mjs
NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-dc-r2/probes/ui-supplement.mjs
```

|실제 결과 프로필|axe violations|진입/중간/끝 CLS|페이지 가로 초과|본문-rail 겹침|
|---|---:|---|---:|---:|
|1920 KO light|0|0 / 0 / 0|0|0|
|320 EN light|0|0 / 0 / 0|0|0|
|1920 EN dark|0|0 / 0 / 0|0|0|

대표 캡처: [1920 KO 스크롤](captures/1920-ko-light-middle.png), [320 EN 결과/toolbar/nav](captures/320-en-light-initial.png), [1920 EN dark](captures/1920-en-dark-middle.png), [1599 compact](captures/resize-1599.png), [1600 text rail](captures/resize-1600.png), [820 mobile](captures/resize-820.png), [821 desktop](captures/resize-821.png). 18장 전체는 [CAPTURES.md](CAPTURES.md). 대표7장을 직접 열어 확인했다. 이 실험은 배포 전 Gemini/Claude 최종 시각 검수의 대체가 아니다.

- Tab으로 previous→next, Enter로첫 변경; first previous disabled. 두 번째 변경 선택 뒤1599/1600/820/821/1440/1280/390/320/1920 resize **9/9** count `2/13`과 같은 버튼 focus 유지, CLS0.
- 전체내용 토글→index−1, header tab→`–/1`, 첫 previous→마지막1/1과 양쪽 disabled, notes 빈영역→nav0, 본문 복귀→index−1.
- 두 번째 동일내용 pair에서는 변경0 nav0. 변경만 보기에서는 empty result, 전체내용을 켜면 문서가 표시되고 nav는 여전히0. 첫 pair로돌아오면 index−1. tab/전체내용 상태는 부모에서 유지하고 current index만 결과 child key로 초기화했다.
- 결과 region에 focus 후 ArrowRight로 scrollLeft **40px**, 키보드 진입 성공. mobile nav의 두 버튼은320 EN 초기 화면에서 모두 hit=true. mobile이 스크롤을 계속 따라가는 새 동작은 약속하지 않았다.
- 정상 실제 중첩 table을 fixture에 넣고 axe0을 확인했다. columnheader row, 유효 div cell, 명명된 focusable scroll/legend를 적용했다. 바깥 ARIA table과 안쪽 HTML table의 구조를 분리했다.
- desktop rail nav y는 최초510→중간/끝80, 셸 언어 선택기·mobile header/bottom nav·footer와 가시 영역 겹침0(8폭×3위치24표본). 페이지 초과0, 1280 문서 내부 초과108px·821에서521px은 v2의 승인 대상 비용과 같다.

**숫자 정정:** 1920의 최종 rail 포함 본문 열 폭은 **529px**, 613px은 rail 없는 폭 후보였다. 1440은 391px, 1280은 365px. 1599→1600에서 rail이 52→156으로 커져 본문은 470.5→417px로 줄지만 계획한 breakpoint의 비용이며 CLS는 0이었다. 두 후보의 값을 한 문장에 혼합하지 않는다.

**테스트 selector 반례:** 헤더를 row로 수리하자 기존 Word smoke가 그 row까지 본문으로 세어 `Document flow was not preserved ... [blockCount:0,2,2,2,2]`로 실패했다. [실패 원문](logs/word-smoke-header-row-failure.log). 사본 테스트의 본문 행 selector를 `[role=row][data-document-kind]`로 바꾼 후 전체 Word scope 재실행은 exit0([word-smoke.log](logs/word-smoke.log)). 헤더 row 자체를 제거해 테스트에 맞추지 않았다. console의 기본 성공 문구는 Excel/PDF도 나열하지만 실행 scope는 Word만이다.

정본 반영: [문안 D/E](CANONICAL-AMENDMENTS.md). **(iv) 새 기술 이견0**. 폭·상태·selector 수리 문안을 정본에 기록해야 한다. v2의 ★스크롤 비용·★ARIA 범위 승인 상태는 이 실험으로 변경하지 않는다.

## (v) R8 실제 진입 하네스·S3 공통 파일 — [동의], 등록 기대값 [보완 제안]

[document-result-entry.mjs](main/tests/document-result-entry.mjs)가 JSZip으로 합성 파일을 메모리 생성 → 파일 input → 비교 → result 링크 진입을 수행한다. result URL에 직접 goto하지 않는다. 본문34문단/12변경+표1변경·header1변경·빈 notes·동일 내용인 두 번째 쌍을 사용한다. 비교240초/DOM30초/폰트2RAF, rendering settle3초를 둔다. context마다 업로드하고 metadata on·웹 output only를 명시한다. 사용자 fixture·전역 세션 주입·서버 기능은 없다.

실제 사본 하네스에 등록한 뒤 아래 명령을 실행했다:

```bash
cd /tmp/worklazy-dc-r2/main
NODE_OPTIONS=--max-old-space-size=4096 TEST_BASE_URL=http://127.0.0.1:4198 A11Y_MAX_TOTAL=0 A11Y_REPORT_PATH=/tmp/worklazy-dc-r2/a11y-harness.json npm run test:a11y
NODE_OPTIONS=--max-old-space-size=4096 TEST_BASE_URL=http://127.0.0.1:4198 RENDER_RUNS=1 RENDER_REPORT_PATH=/tmp/worklazy-dc-r2/rendering-harness.json npm run test:rendering
```

접근성 [11페이지/위반0/외부0](a11y-harness.json), [stdout](logs/a11y-harness.log). 렌더링 [4대상×1회/전부CLS0/외부0](rendering-harness.json), [stdout](logs/rendering-harness.log). 기본8/3에 result3/1을 추가했으며 기존 검사를 빼지 않았다. a11y JSON의 summary에는 기존 `colorScheme:light`가 남지만 실제 result target/context와 별도 UI 검사는 dark도 적용했다. 최종 하네스 summary는 프로필별 또는 mixed로 고쳐야 한다. result 렌더링의 LCP는 입력 페이지 관측값이므로 result mount 성능으로 읽지 않는다. 결과 전후 CLS와 스크롤/resize CLS는 별도 수집했다. 최종 구현 게이트의 run3은 유지한다.

등록 기대 목록 수정은 사본 `tests/unit/accessibility-audit.test.ts`·`tests/unit/rendering-baseline.test.ts`에 실제 적용했다. 전체 unit344 중343 통과, archive의 .git 부재로 발생한 1실패만 남았다. helper는 browser/a11y/rendering의 진입 동작을 공유할 수 있는 초안이다. 기존 Playwright·Puppeteer 차이에 맞춰 스모크 등록을 합칠 때 DOM selector 계약을 보존한다.

S3 교집합 재현:

```bash
cd /home/better0101/projects/worklazytools
git diff main..s3-pdf-finish --name-only
python3 /tmp/worklazy-dc-r2/probes/facts.py
```

종료 S3 HEAD **002732a7d79b0a0a5851bf2e20ccdd83d6bdedfc**에서 예정 변경 목록과의 교집합은 **9파일**, 미커밋 working overlap0. [merge-surfaces.json](merge-surfaces.json)에 두 집합과 예정 파일 목록을 모두 보존했다.

- `CHANGELOG.md`
- `docs/review-notes.md`
- `tests/accessibility-audit.mjs`
- `tests/browser-smoke.mjs`
- `tests/rendering-baseline.mjs`
- `tests/unit/accessibility-audit.test.ts`
- `tests/unit/rendering-baseline.test.ts`
- `tests/visual-regression.config.mjs`
- `tests/visual-regression.scenarios.mjs`

1차 최종7파일 목록에 빠졌던 a11y/rendering unit2파일도 공통이다. main측 등록 후 a11y11/render4, S3 추가 등록을 보존해 병합하면 a11y14/render7이다. 종료 직전 S3의 `002732a`는 rendering CLI 기본 CLS 한계를 0→0.1로 되돌렸다. 병합 시 이 최신 계약을 보존한다. 이번 main 사본의 측정은 더 엄격한 0에서도 통과했으므로 실측 결론은 같다. 최종 구현 착수 때 main/HEAD/워킹 변경을 다시 검사한다. 공통 config 통합 전 전체 baseline cleanup 금지는 유지한다.

정본 반영: [문안 E](CANONICAL-AMENDMENTS.md). **(v) 새 기술 이견0**.

## (vi) 잔여·정본화 판정

|ID|sol이 선택하면 안 되는 잔여|권고 문안|기술 잔여|
|---|---|---|---:|
|Q1|현행 가드의 빈 항목 보존 vs 전 경로 빈 항목 제거|코어 조기 반환 보존, XML 어댑터만 길이0을 건너뜀|1|
|Q2|메모 본문 diff 추가 vs 기존 after bytes 보존|기존 메모 보존을 명시 예외로 유지; 메모 diff 신설은 별도 설계|1|
|Q3|서로 다른 문단/group/셀 입력에서도 전체 동치 보장 vs 범위 한정|동일 입력1:1만 정확 일치, E2/E6은 명시 fixture 예외; 전체 보장이 필수면 group→XML 매핑을 먼저 설계|1|

**기술 잔여3건. Claude–Codex 간 이견0에 도달하지 않았으므로 [정본화 가능]을 선언하지 않는다.** 골든97개·tie-break 점화식·offset 단위·UI 상태·ARIA 구조·하네스 입력·병합 파일·재현 명령은 문안으로 구체화했다. 구현자가 재해석해야 하는 선택은 위3건이다.

v2의 ★사용자 확인3항목(가로 스크롤 비용, ARIA 수리 범위, 제공 스크린샷 대조/웹 표시 결함 결론)은 별도 대기다. 본 지시는 실험 권한을 부여하지만 세 제품 판정을 사용자가 승인했다는 새 증거는 제공하지 않았다. 기술 잔여3과 이 확인 대기3을 합쳐 일방적으로0으로 만들지 않는다. 사용자 결정인 단어 공용 코어 자체를 바꾸는 제안은 없다.

## 실제 검증과 한계

|명령/실험|결과|증거|
|---|---|---|
|production `npm run build`(tsc 포함)|exit0, Vite1m12s, 정적61페이지|[build-production.log](logs/build-production.log)|
|production `npm run test:static`|exit0|[static-production.log](logs/static-production.log)|
|QA `VITE_LOCAL_QA=1 npm run build`|exit0, Vite1m11s|[build-qa.log](logs/build-qa.log)|
|골든97+alignment8 targeted unit|105/105|[unit-targeted.log](logs/unit-targeted.log)|
|전체 `npm run test:unit`|343/344, exit1|[unit-all.log](logs/unit-all.log)|
|새 Node pyodide 패키지·변환·예외·성능|실행 완료, 판정은 위 절|[bridge.log](logs/bridge.log), [extra.log](logs/extra.log)|
|실제 결과 axe/CLS/상태|3프로필 전부 axe0·CLS0, 18장|[ui-results.json](ui-results.json)|
|등록 후 `test:a11y`|11/11·위반0|[a11y-harness.log](logs/a11y-harness.log)|
|등록 후 `test:rendering`|4대상×1회·CLS0|[rendering-harness.log](logs/rendering-harness.log)|
|`TEST_SCOPE=word npm run test:browser`|최초 header row selector 실패 → 수리 후 exit0|[word-smoke.log](logs/word-smoke.log)|

전체 unit 실패 원문은 `fatal: not a git repository (or any of the parent directories): .git`이며 repo-wide 광고 허용 목록 검사의 `git ls-files` 호출이다. `.git`를 원본에 연결하거나 기대 허용 목록을 완화해 통과시키지 않았다. extra 탐침 초기에는 추출 모델에 없는 root.tables를 참조해 `KeyError: tables`가 발생했고 `blocks[].table`로 수정하여 재실행했다. 초기 로그는 [extra-initial-failure.log](logs/extra-initial-failure.log)에 보존했다.

실험은 계획 판정용이다. 신규 worker 연결의 통합 브라우저 완료, 전체 HWP/new-tools/visual baseline 갱신, bundle/css 전체 게이트, 최종 Gemini 시각 검수, production 배포 완료를 주장하지 않는다. 단일 TS 코어를 DOCX 생성기에서 실제 역호출한 증거와 React/a11y 초안의 실행 증거는 각각 있다. 최종 구현 시 정본 게이트를 다시 통과해야 한다.

## 원본 상태·SHA·동시 작업과 쓰기 범위

[start-state.json](start-state.json)·[end-state.json](end-state.json)에 git status, HEAD/branch, 추적 파일2,587개 SHA-256, 사용자 DOCX3개 SHA를 저장했다. [state-comparison.json](state-comparison.json)이 비교표다.

|항목|시작|종료|판정|
|---|---|---|---|
|branch|s3-pdf-finish|s3-pdf-finish|전환 없음|
|HEAD|532df465944952d47b64120b5fa3ca55b181537c|002732a7d79b0a0a5851bf2e20ccdd83d6bdedfc|병행 S3 커밋으로 변경|
|추적 working 변경|없음|없음|branch.oid와 병행 잡의 미추적 newui/ 추가|
|문서 비교/Word/HWP/UtilitySurface24파일|SHA 기록|24/24 동일|해당 원본 표면 불변|
|사용자 DOCX3개|SHA 기록|3/3 동일|읽기·메모리 처리|
|전체 추적2,587개|SHA 기록|2,579 동일·7개 PDF baseline 및 rendering 하네스 변경|S3 커밋 변경 집합과 정확 일치|

병행 커밋 `948cc0b test(pdf): refresh five-tab navigation baselines`의7PNG와 `002732a fix(test): retain canonical CLS gate`의 `tests/rendering-baseline.mjs` 변경을 합한8파일 집합이 시작/종료 SHA 차이 집합과 정확히 같다([concurrent-commits.log](logs/concurrent-commits.log)). 해당 변경을 되돌리거나 커밋하지 않았다. 따라서 **전체 저장소 불변이라고 주장하지 않고**, 문서 비교 표면과 사용자 문서의 불변 및 동시 작업의 변화를 구분해 보고한다. 시작 미추적 before.docx/after.docx/네이버 HTML3개는 종료에도 남았으며 병행 작업의 `newui/`가 추가로 보인다. 이 실험에서 newui/를 만들거나 건드리지 않았다. 마지막 산출물 점검 도중 이 두 번째 S3 커밋을 발견해 종료 상태를 다시 기록했다.

**캐시 격리 한계 공개:** 초기 두 빌드는 설치 의존성을 재사용하는 `main/node_modules` 전체 디렉터리 symlink를 썼고, 사본 tsconfig의 `tsBuildInfoFile` 설정이 공유 `node_modules/.tmp/tsconfig.app.tsbuildinfo`와 `tsconfig.node.tsbuildinfo`를 가리켰다. 그러므로 초기 빌드의 모든 캐시 쓰기가 /tmp에만 있었다고 보장할 수 없다. 발견 후 의존 항목별 읽기 symlink+사본 전용 `.tmp/.vite/.vite-temp/.cache` 디렉터리로 교정했다. 공유 캐시를 삭제·복원하지 않았다. 이 한계는 추적 파일 수정은 아니며 위 SHA 판정과 구별한다([dependency-isolation.json](dependency-isolation.json)).

새 실험 코드·합성 산출·캡처·보고서는 /tmp에 썼다. 원본 추적 파일 수정·커밋·push·브랜치 전환은0회. jobs 문서로의 복사/취합은 Claude에게 맡긴다.

— Codx
