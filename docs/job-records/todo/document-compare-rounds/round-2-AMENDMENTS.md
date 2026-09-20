# 문서 비교 2차 — 정본 반영 문안 제안 (Codx)

아래 문안은 정본 원본에 쓰지 않았다. v1의 글자 정제·추적 생성기 제외·모바일 수리 제외·사용자 문단 `ins 자금` 기대값은 모두 폐기하고 하나의 정본으로 정리한다. 단어 단위 공용 기준이라는 사용자 결정은 유지한다.

## A. 공용 코어와 경계

> 텍스트 diff 정본은 `documentComparison.ts`의 현행 `diffText` 하나이다. 동일 문자열은 비어 있으면 `[]`, 아니면 equal 하나로 반환한다. 나머지는 `/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu`로 토큰화한다. LCS 행은 before, 열은 after, 첫 행·열은 0이다. 두 끝 토큰이 같으면 대각 값+1, 다르면 위·왼쪽의 최댓값이다. 마지막 셀에서 역추적하며 (1) 양쪽이 남고 끝 토큰이 같으면 equal과 대각 이동, (2) after가 남고 before가 없거나 왼쪽 점수가 위 점수 이상이면 added와 왼쪽 이동, (3) 그 외 deleted와 위 이동이다. 역추적 결과를 한 번 뒤집고 인접 동일 타입만 병합한다. 별도 정렬·글자 정제·trim·Unicode 정규화는 하지 않는다. `deleted→added`는 이 역추적의 출력 성질이며 전체 세그먼트를 타입별 재정렬하라는 뜻이 아니다.
>
> `(beforeTokenCount+1)*(afterTokenCount+1)>1_500_000`이면 DP를 만들지 않고 현행 deleted(before), added(after) 두 항목을 그대로 반환한다. **현행 코어 고정 권고안:** 이 조기 반환에는 비어 있는 한쪽 항목이 남을 수 있다. 따라서 ‘모든 경로에서 빈 세그먼트 제거’라는 문장은 삭제한다. XML opcode 어댑터는 길이 0을 건너뛴다. 만약 공용 API에서도 항상 빈 항목을 제거하려면 이를 현행과 다른 변경으로 명시하고 별도 경계 기대값을 승인한다. [잔여 Q1]
>
> 커밋용 JSON은 `tests/fixtures/document-compare/word-diff-golden.json`, 실행 파일은 `tests/unit/document-diff-golden.test.ts`로 둔다. 첫 라운드 98쌍 중 사용자 문단 1쌍을 제외한 **97쌍**(합성27·Word fixture68·HWP2)을 정적 기대값으로 고정한다. 기대값을 테스트 실행 시 현행 함수로 자기 생성하지 않는다. 사용자 문단은 입력 파일을 읽어 메모리에서만 별도 재현한다.

## B. pyodide 연결과 생성기

> `word.worker.ts` 초기화에서 동기 JS 함수 `worklazyDiffJson(before,after) => JSON.stringify(diffText(before,after))`를 worker의 JS 전역에 등록한 뒤 Python 스크립트를 로드한다. Python은 `from js import worklazyDiffJson`으로 호출하고 `json.loads`로 값만 받는다. 문단별 PyProxy 객체를 생성·방치하는 반환 계약은 쓰지 않는다. Python 단독 fallback은 없다. 주입 실패·잘못된 타입·before/after 재구성 불일치는 작업 실패로 전달하고 기존 사용자용 현지화 오류 경계를 이용한다.
>
> `_paragraph_revision`의 글자 토큰 목록을 연결한 before/after 문자열을 공용 함수에 넘긴다. Python `len(segment.text)`의 Unicode code point 수로 양쪽 cursor를 각각 누적한다. equal은 양쪽, deleted는 before, added는 after만 전진한다. offset은 정규화하지 않은 각 비교 입력의 0-based code point 경계이다. JS `.length`를 Python 토큰 인덱스로 쓰지 않는다. 마지막 cursor와 입력 길이를 검증한다. `w:tab=\t`, `w:br/w:cr=\n`; run 경계·빈 run은 문자 길이를 추가하지 않는다. 유효한 surrogate pair는 한 code point로 다룬다. 기존 이벤트·서식·revision 보존 분기는 유지한다.
>
> 변경 범위는 `_paragraph_revision`의 문장 diff 판정이다. 문단·표 정렬의 `difflib.SequenceMatcher`까지 광역 제거하지 않는다. `compare.py`는 `extract_document_model`의 의존 폐쇄만 남긴다. `_cell_payload`·`_display_text`·번호 계산기 등 추출에 필요한 함수는 이름이 비교처럼 보여도 보존한다. 제거 대상은 재현 스크립트 `pruning.json`의 31개 정의이며 추출 ko/en×tables on/off×metadata on/off×10파일 80건의 동일 출력을 검증한다. `compare.py?raw` import와 worker의 `runPython(compareScript)`는 보존한다.
>
> **메모 권고안:** DOCX `word/comments.xml`은 기존 계약처럼 after bytes를 보존한다. ‘메모 문단도 같은 생성 경로’ 문장을 삭제하고 본문·표 셀·활성화된 머리말/꼬리말·각주/미주 문단을 대상으로 쓴다. 웹 메모 diff 표시는 유지한다. 메모 텍스트까지 내려받기 diff를 새로 만들려면 별도 범위·ID 대응·신규/삭제 메모·기존 메모 revision 보존·수락/거부 의미론과 기존 `trackedComments===afterComments` 테스트 변경을 먼저 정한다. **author만 oracle 예외로 두는 것은 불충분하다.** [잔여 Q2]

## C. oracle 입력 범위·구조키

> ‘공용 함수이므로 웹과 docx 모든 텍스트 diff가 항상 같다’는 보장을 하지 않는다. 동일한 before/after 비교 입력이 전달되는 revision 없는 1:1 문단과 단일 문단 셀에 대해 문자열·변경 offset·순서의 정확 일치를 요구한다. 첫 라운드 oracle 4개 키는 실제 생성 DOCX에서 검사한다. 5쌍 fixture는 `_paragraph_revision` 호출 sidecar 검사와 전체 패키지 구조/수락/거부 검사를 구분한다.
>
> sidecar 키는 `pairId, storyPart, beforeIndexes[], afterIndexes[], beforePath, afterPath`이다. 인덱스는 해당 부모 block 배열에서의 0-based 인덱스이며 경로에 story root/content control/table/row/cell/paragraph를 포함해 부모를 구별한다. 표시용 ko/en location이나 호출 순번만을 매칭 키로 쓰지 않는다. 분할로 만든 임시 before 문단에는 원본 group 인덱스와 source slice `[start,end)`를 추가하고 실제 after 경로를 유지한다. 생성 XML의 property change·문단 끝 표시를 텍스트와 혼합하지 않는다. 인접 revision이 서로 다른 서식 run/ID로 나뉜 경우 code point cursor를 보존하며 같은 타입을 합쳐 비교한다. 문자열이 같아도 offset을 1 옮긴 음성 대조가 실패해야 한다.
>
> 예외는 광역 디렉터리/모든 표가 아니라 fixture의 명시 ID와 이유로 고정한다. E1 기존 after revision 보존(수락 후 텍스트가 같은 경우도 포함), E2 문단 분할/병합과 행·열·문단 표시, E3 자동 번호 display 접두, E4 메모 본문/author 보존, E5 서식 property revision, **E6 여러 문단을 연결한 셀의 diff 입력 차이**를 구분한다. E6은 문단 수가 그대로여도 발생한다: 셀 `['Alpha ','Beta']→['Alpha','Beta']`에서 웹은 `del ' \n'+ins '\n'`, 생성기는 `del ' '`다. 단순히 paragraph separator를 offset에 더하는 것만으로는 변경 문자열까지 같아지지 않는다.
>
> **범위 권고안:** 이번에는 E2/E6을 이름 붙은 회귀 fixture로 명시 제외하고 입력 범위별 정확 일치만 보장한다. 문서 전체 diff 통일을 필수로 유지한다면, Python XML 작성기에 TS의 동일한 정렬 group·셀 문자열 세그먼트를 전달하고 문단 경계를 다시 배분하는 추가 설계를 먼저 확정한다. 이는 현재 ‘문단 정렬 변경 제외/기존 분기 유지’ 범위를 넘어선다. [잔여 Q3]

## D. React 구조·상태·접근성

> 결과 페이지에만 max-width1480을 적용한다. `DocumentPageComparison` 아래 `layout → rail(nav) + named x-scroll region → ARIA table` 구조를 React JSX로 한 번 렌더한다. nav는 DOM상 먼저, desktop CSS grid의 오른쪽 열에 놓는다. mobile에서는 nav가 문서 scroll 영역보다 먼저 쌓이며 종전처럼 페이지 스크롤을 추종하지 않는다. DOM 이동 MutationObserver나 resize 때의 별도 nav 복제는 사용하지 않는다.
>
> ≥1600 rail156/gap12, 821~1599 rail52/gap8, sticky top80; compact 버튼은 아이콘+sr-only ko/en 이름+tooltip, 카운터는 유지한다. 940px 문서 최소폭과 내부 가로 스크롤은 유지한다. **1920px의 최종 본문 폭 수치는 rail을 포함한 최종 배치로 보고한다.** 최종 실측은 **529px**이며 613px은 rail을 차감하기 전 폭 후보의 수치다. 모바일 nav는 `minmax(0,1fr) 44px minmax(0,1fr)`, 버튼 줄바꿈, toolbar ≤1200 세로 배치·wrap이다.
>
> `resultTab`·`showFullContent`는 결과 페이지 상태로 두고 문서 쌍 전환 때 유지한다. 선택 변경 index는 문서 쌍·tab·전체내용 토글 때 -1로 초기화한다. `DocumentPageComparison key={pairNumber:tab:showFullContent}`처럼 결과 영역에만 key를 둔다. App/세션 provider를 remount하지 않는다. resize는 CSS만 바꾸므로 index와 기존 버튼 focus를 유지한다. 초기 previous는 마지막, initial next는 첫 변경으로 이동한다. 첫 항목에서 previous, 마지막에서 next가 disabled이며 1건이면 선택 후 둘 다 disabled이다. 변경0/내용0에서는 nav를 렌더하지 않는다.
>
> ARIA table의 두 columnheader는 role=row로 묶는다. `article role=cell`을 유효한 `div role=cell`로 바꾸되 내부 `DocumentTable`의 실제 table/tbody/tr/td는 유지한다. 문서 가로 스크롤 영역과 넘칠 수 있는 legend는 role=region·현지화 이름·tabIndex=0을 갖는다. 문서 영역에 focus하고 ArrowRight로 scrollLeft가 증가함을 검사한다. 새 rail과 본문/셸 UI의 가시 영역 겹침을 별도 검사한다. `browser-smoke.mjs`의 본문 행 선택자는 `[role=row][data-document-kind]`로 바꾼다. 헤더 row를 본문 1개로 세어 문단/표 개수 기대가 실패하는 기존 selector를 유지하지 않는다.

## E. 검증 등록·병합

> `tests/document-result-entry.mjs` 같은 공용 진입 helper에서 합성 DOCX를 메모리로 생성하고 실제 파일 input→비교 버튼→결과 링크를 누른다. 생성 fixture는 34개 본문 문단/12개 본문 변경+1개 표 변경, 1개 header 변경, 비어 있는 notes, 동일 내용인 두 번째 문서 쌍을 갖는다. fixture에 사용자 문서를 포함하지 않는다. output은 웹만 켜고 metadata는 명시적으로 켠다. worker 준비/비교 timeout240초, 입력·결과 DOM timeout30초, 폰트+2 RAF, 렌더링 안정화3초를 둔다. 새로운 context마다 업로드를 다시 실행하고 결과 URL에 직접 goto하여 성공으로 취급하지 않는다.
>
> 접근성에 result KO1920 light, EN320 light, EN1920 dark 3개 ID를 추가하고 각각 전체 결과 DOM axe0을 요구한다. 기존 8개/S3 추가 3개 등록은 보존한다. 각 target의 lang/theme/viewport를 실제 context에 적용하고 summary에 혼합 theme을 단일 light로 오기하지 않는다. 렌더링에 document-result ID를 추가하되 입력 페이지 로딩과 결과 진입의 metric phase를 분리한다. 기존 observer의 LCP는 입력 페이지 수치이므로 result LCP로 이름 붙이지 않는다. 결과 mount 직전 CLS reset과 raw layoutShifts, 이후 scroll/resize의 분리 수치를 보존한다. 최종 게이트는 기존 run 수3을 유지한다(이번 반박의 하네스 실행은 요구대로 1회).
>
> S3와의 실측 공통 파일은 CHANGELOG.md, docs/review-notes.md, browser-smoke.mjs, accessibility-audit.mjs, rendering-baseline.mjs, **unit/accessibility-audit.test.ts, unit/rendering-baseline.test.ts**, visual-regression.config.mjs, visual-regression.scenarios.mjs 9개다. main은 result 등록 후 a11y11/rendering4, S3와 통합하면 a11y14/rendering7이다. 동일 파일 전체를 한쪽 것으로 고르지 않고 등록·기대 목록을 함께 병합한다. 종료 직전 S3 `002732a`의 rendering CLI 기본 CLS 한계0.1도 보존한다. golden97 unit는 기존 test glob에서 실행된다.
>
> production build/tsc/unit/static 후 QA rebuild, 결과 브라우저/시각/a11y/CLS는 직렬 NODE_OPTIONS4096으로 실행한다. archive 사본에서는 `.git` 의존 unit가 실행되지 않으므로 최종 구현은 정상 분리 checkout에서 전체 unit를 통과시킨다. node_modules는 읽기 전용 의존 링크로 재사용하더라도 `.tmp/.vite/.vite-temp` 캐시는 `/tmp` 사본에 따로 둔다. 시각 fixture/state별 baseline 변경은 document-compare로 한정하고 S3 config 통합 전에 전체 cleanup하지 않는다. HWP actual-text fixture 추가·ko/en 안내·SEO/정적 영향·광고 격리 불변 검토는 v2 R5/R8대로 유지한다.

## 결정 대기

기술 잔여는 Q1(가드 반환 계약), Q2(메모 범위), Q3(문단/셀 입력 범위) **3건**이다. 권고 문안을 수용한 정본을 받기 전 sol이 선택하게 두지 않는다. 기존 v2의 ★스크롤 비용·★ARIA 범위·★사용자 스크린샷 대조 3항목은 이 보고서에서 사용자 승인으로 바꾸지 않는다.

— Codx
