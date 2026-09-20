**Excel S2 fix-2 재검수(3차) — [수정 후 재검수]**

Codx · 2026-09-08 · 대상 `/tmp/worklazy-xd` · `excel-dupkey-20260907` · **`5dfe4139cf042090ef6a5207f67843e2e4ef9ce3`** · 부모 `ab00de3a6c47e07a15e8554c5ff0a466a130c209`.

**S2-R04의 지정 390px 재현은 해소됐다.** 원본 무수정 probe의 이전 실패 20개는 중앙·9점 모두 **20/20**, 현재 버튼 상태 전체도 **48/48** 가시다. 별도 smooth 스크롤 경로는 검색·region·양측 버튼·모달·Escape·Shift+Tab의 **72/72 상태**에서 중앙이 보였다. R01 내부 키 **0**, R02 상태·판정 **72/72 한 줄**, R03 시각 **16/16 일치**도 유지됐다.

하지만 **새 포인터 스크롤 점프(S2-R05, P2)**와 **320px의 왕복 보정·링/라벨 잘림(S2-R07, P3)**을 찾았다. **821px 초점 가림(S2-R06, P2)**은 부모에도 같아서 새 회귀로 세지 않지만, 이번 경계 검수는 미충족이다. 이 세 항목을 구분해 보고하며 제품 전체 통과를 선언하지 않는다. 저장소 수정·커밋·push·브랜치 전환은 없다.

**실행 게이트·검증 출처**

- `PROJECT_RULES.md` 전문을 첫 행동으로 읽고 AGENTS, [이번 지시](input/excel-s2-review3-dispatch.md), 2차·1차 REPORT와 R04 원본 probe/evidence, [fix-2 지시](input/excel-s2-fix2-dispatch.md), sol REPORT/evidence, [v3까지 합의된 정본](input/excel-compare-dupkey-header-20260907.md), 관련 review-notes/기각 이력을 읽었다. 정본의 앞부분 v1 초안을 최종 계약으로 오인하지 않았다.
- HEAD/브랜치 일치, 시작 status 빈 문자열. 대상의 ignored `docs/jobs/todo`는 없어서 허용된 **S0 보존 열린 계획 19개**를 재스캔했다. [검색](evidence/open-plans-scan.txt). 이 고정 커밋 검수와 충돌하는 실행 지시 없음. 금지된 U4 원 트리의 실시간 계획이나 미커밋 변경까지 확인했다는 뜻은 아니다.
- `git -C /tmp/worklazy-xd archive 5dfe4139cf042090ef6a5207f67843e2e4ef9ce3`로 `main/` 사본을 만들었다. 추적 **2,408파일**을 대상·archive와 SHA 대조했다. unit의 git 읽기를 위해 기존 commit/tree/blob **2,053개**만 독립 `.git`에 복사하고 index를 구성했으며 새 commit/checkout은 없다. node_modules는 대상의 독립 디렉터리를 복사했다. [archive 출처](evidence/archive-provenance.json), [환경](evidence/environment.txt).
- 모든 빌드·브라우저는 직렬, Node v22.17.1·heap 4GiB. preview **4350 `--strictPort`**, QR fixture proxy **4351 strict**. 부모 대조만 **4352 strict** 정적 서버를 사용했다. TMPDIR/npm cache/모든 새 산출물은 이번 디렉터리 안이다.
- production과 QA 각각 **HTTP JS/CSS 75자산**을 해당 archive dist bytes와 대조했다. [production](evidence/provenance-production.json), [QA](evidence/provenance-qa.json). 부모 대조는 허용된 2차 검수 보존 dist를 읽었다. 부모 component는 `git show ab00de3:…`와 같고 75자산은 그 검수 당시 HTTP SHA와 일치한다. [부모 출처](evidence/parent-server-provenance.json).
- 원 워킹트리는 필수 공통 규칙 첫 선독 외 접근하지 않았다. `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`, U4 트리/포트 접근 없음. 사용자 세 사본은 `/tmp/worklazy-userfiles/`에서 읽기만 했고, 원문이 포함된 화면·텍스트·보고서는 `evidence/private/`에 둔다.

**S2-R04 해소 — 원본 무수정과 별도 smooth 측정**

`python3 ../probes/check.py overlap-original python3 ../probes/original.py node /tmp/worklazy-xd-s2-review2/probes/overlap-review.mjs` → exit 0. 이어 원본 `focus-contract.py` → exit 0, 실패 배열 `[]`. [원출력](evidence/overlap-original.log), [측정](evidence/overlap-review.json), [이전 20개 동일 인덱스 대조](evidence/prior-20.json), [중앙 단언](evidence/focus-contract.log).

원본은 `pre-fix-classes` DOM 대조군도 포함한다. 이는 현재 결과 판정에 넣지 않았다. 원본 helper는 reduced-motion/auto 스크롤을 사용하므로 이것만으로 smooth 경합을 승인하지 않았다. **별도 [side-effects.mjs](probes/side-effects.mjs)는 제품 CSS를 그대로 두고 reduced-motion을 해제**했다. 원본 probe·제품 코드는 수정하지 않았고, scrollBy는 원래 구현을 그대로 호출하면서 인자·좌표·호출 출처를 기록했다. 각 입력 뒤 2 animation frame와 추가 650ms를 각각 측정했다.

390×844, ko/en × light/dark에서 아래는 **초점 중앙 (x,y)**다. 모든 셀의 `elementFromPoint`가 실제 초점 요소 또는 그 자손을 가리켰다. [전 단계 원자료](evidence/side-effects.json), [집계](evidence/side-effects-summary.json).

| 단계 | ko light | ko dark | en light | en dark |
|---|---|---|---|---|
| 검색 입력 | (159.000, 503.500) ✓ | (159.000, 503.500) ✓ | (173.500, 579.844) ✓ | (173.500, 579.844) ✓ |
| 결과 region | (195.000, 585.000) ✓ | (195.000, 585.000) ✓ | (195.000, 661.344) ✓ | (195.000, 661.344) ✓ |
| Tab → 왼쪽 보기 | (195.000, 603.500) ✓ | (195.000, 603.500) ✓ | (195.000, 679.844) ✓ | (195.000, 679.844) ✓ |
| Enter → 펼침 | (175.992, 603.500) ✓ | (175.992, 603.500) ✓ | (178.594, 679.844) ✓ | (178.594, 679.844) ✓ |
| Tab → 첫 전체 값 | (79.281, 746.500) ✓ | (79.281, 746.500) ✓ | (100.164, 746.844) ✓ | (100.164, 746.844) ✓ |
| Enter → 모달 닫기 버튼 | (327.117, 567.000) ✓ | (327.117, 567.000) ✓ | (322.102, 567.000) ✓ | (322.102, 567.000) ✓ |
| Escape → 원래 전체 값 | (79.281, 746.500) ✓ | (79.281, 746.500) ✓ | (100.164, 746.844) ✓ | (100.164, 746.844) ✓ |

한국어 전체 값은 **y=724.5~768.5**, 하단 탭 top=773으로 **4.5px** 여백이다(직전 y=792.5, 가림 42.5/44px). 영어는 y=724.844~768.844로 여백 **4.156px**. 영어 오른쪽 전체 값은 **x=117.969~203.891**, region client x=30~360 안에 라벨·3px 링이 모두 들어간다. [en light 실제 화면](evidence/private/steps-en-light-390-right-full.png), [ko dark](evidence/private/steps-ko-dark-390-right-full.png).

390/819/820 각각 4프로필×18단계 = **각 72/72 중앙 가시**, 버튼 링 간격도 3px 이상이다. 이 216상태의 2프레임 이후 추가 세로 이동은 0이다. 이미 보이는 toggle↔full 왕복 **8회는 ΔscrollY=0**, 긴 목록의 연속 Tab **200/200**도 중앙 가시다. 빠른 Tab→Enter→Tab 및 50개 추가 뒤 남아 있는 더보기 버튼의 중앙은 4/4프로필 가시다. 키보드로 추가한 50개가 앞에 삽입되므로 더보기 유지에 +10,100px, 다음 Tab으로 목록 위쪽의 우측 toggle에 가는 데 −19,594px가 필요했다. 이 구조상 이동을 포인터에서 발생한 R05와 같은 의도치 않은 이동으로 세지 않았다.

**수정 요청 S2-R05 — P2, 포인터 추가 로드에서 9,725px 점프 (새 부작용)**

정상 CSV 두 개: `Key,Value` 머리글, 각 151행, 키 `A`, 값은 `left/right N ` + `long-value ` 20회. 키 1열 비교 → 중복 필터 → 왼쪽 목록 펼침 → 처음 50개 끝의 **Show 50 more (101 remaining)**를 화면 y=350에 둔 뒤 **실제 mouse click 또는 touch tap**. Worker 결과 주입·XLSX 변조가 없다.

| 입력 | 수정본 ΔscrollY | 보정만 비활성화한 대조군 | 결과 항목 수 | 수정본 :focus-visible |
|---|---:|---:|---:|---|
| mouse click | **+9,725px** | **0px** | 양쪽 모두100 | false |
| touch tap | **+9,725px** | **0px** | 양쪽 모두100 | false |

[입력 전](evidence/pointer-mouse-current-show-more-before.png)에는 원본 51행과 추가 버튼이 보인다. [입력 후](evidence/pointer-mouse-current-show-more-after.png)에는 **99~101행 근처**로 뛰어 새 52행부터 읽을 위치를 잃는다. [대조군](evidence/pointer-mouse-correction-disabled-show-more-after.png)은 기존 51행 아래에 새 52·53행이 자연스럽게 나타난다. 데이터 누락은 없으며 되스크롤로 읽을 수 있어 P2로 판정한다. 닫기 클릭의 하단 경계 표본에서도 수정본 +10px/대조 0px이었다.

원인: [ExcelComparePage.tsx](main/src/features/excel-compare/ExcelComparePage.tsx)의 407~415행은 `activeElement === target`만 검사한다. 포인터로 초점을 받은 버튼도 포함한다. 367행 추가 로드 click은 DOM 변경 뒤 같은 보정을 예약하고, 새 더보기 위치까지 **`window.scrollBy({top:9725,behavior:'instant'})` 1회**를 호출한다. 대조군은 브라우저 DOM의 `data-excel-result-focus` 표식만 제거해 이 함수 진입을 막았다. 이는 이전 커밋 전체 대조라는 주장이 아닌, 동일 입력·동일 결과 DOM에서 보정의 인과를 분리한 실험이다. [좌표·호출](evidence/side-effects-summary.json), [probe](probes/side-effects.mjs).

**수정 지시 문안:**

> 결과 컨트롤에 초점이 있다는 사실만으로 포인터 클릭/탭 뒤 viewport를 따라가지 않게 하라. 키보드·보조기술 초점 가시성과 키보드로 연 모달의 Escape 복귀는 유지하되, 마우스/터치의 목록 펼침·50개 추가·닫힘에서는 사용자가 읽던 위치와 새 항목 시작이 유지돼야 한다. 일반 스크롤과 예약된 보정의 경합도 구분하라. 위 151행 입력에서 pointer 두 경로의 보정 기인 이동 0, 항목100, 새 52행 가시를 단언하고, 기존20/20·한영4프로필·연속Tab·Escape를 함께 재검증하라. 단순히 instant를 smooth로 바꿔 점프를 늦추거나, 모든 보정을 제거하는 수리는 금지한다.

**수정 요청 S2-R06 — P2, 821px 경계 초점 가림 (부모부터 존재, 새 회귀 아님)**

사용자 1/B, 821×844, ko/en light/dark. 검색 → Tab(region) → Tab(왼쪽 보기)에서 버튼 **x=720~952, 중앙 x=836**이 **viewport 821px 밖**이다. region client 오른쪽은 **779px**. Enter 후에도 가림이 남는다. **4프로필×2상태=8실패**. [대표 화면](evidence/private/edge-ko-821-toggle.png). 820px에서 초점을 유지한 채 821px로 resize하면 우측 toggle 중앙도 4/4프로필 영역 밖으로 나가고, 820으로 돌아오면 다시 보인다. [resize probe](probes/side-effects-resize.mjs), [좌표](evidence/side-effects-resize.json).

`(max-width:820px)` 가드는 821에서 가로 보정까지 중단한다. 다만 **부모 ab00de3의 실제 배포 자산 대조에서도 같은 8실패·같은 좌표**였다. 821/1365의 8프로필×18단계 **144상태에서 settled rect/scrollY/scrollX/region/chrome/중앙 판정 차이 0**이다. [부모 대조](evidence/parent-comparison.json), [probe](probes/side-effects-parent.mjs). 따라서 fix-2가 데스크톱을 망가뜨렸다는 판정은 하지 않는다. 1365×900 중앙은 양쪽 **72/72**, 새 보정 호출은 양쪽0이고 시각/레이아웃도 유지된다. 기존 ko desktop의 화면 상단 일부 링·라벨 가림까지 정상이라고 승인한 것은 아니다.

**수정 지시 문안:**

> Claude가 기존 “데스크톱 동작 불변”과 이번 821px 초점 가시성 요구의 범위를 먼저 정리하라. 고정 shell의 세로 경계 조건과 실제 overflow region의 가로 가시성 조건을 분리하는 보강이 필요하다. 819/820/821 실제 Tab·Enter와 활성 초점 resize에서 중앙·라벨·링을 확인하고, 1365 레이아웃·기존 정상 스크롤을 보존하라. 이 항목은 기존 미해소 결함으로 귀속하고 fix-2 신규 회귀로 기록하지 말라.

**수정 요청 S2-R07 — P3, 320px의 과대 버튼에 보정 방향이 왕복 (새 부작용/부분 잘림)**

제품의 최소 문서 폭인 320×844에서도 사용자 1/B로 재현했다. 결과 region client는 **260px**, 4px 양쪽 여백을 뺀 사용 폭은 **252px**인데, 펼친 왼쪽 toggle은 ko **283.984px**, en **264.781px**다. 양쪽 경계를 동시에 만족할 수 없다.

| 프로필(양 테마 동일) | Enter 뒤 연속 가로 보정 | 최종 왼쪽 간격 | 중앙 |
|---|---|---:|---|
| ko | **−42 → +31.984px** | **−28px** | 보임 |
| en | **−22.797 → +12.984px** | **−8.797px** | 보임 |

[ko 실제 화면](evidence/private/edge-ko-320-enter.png)은 “왼쪽” 일부와 왼쪽 링이 잘렸고 [en](evidence/private/edge-en-320-enter.png)은 링이 잘렸다. 428/429행의 left/else-right 보정이 두 프레임에서 반대로 움직인다. **무한 진동은 아니며**, 예약된 프레임 안의 유한 왕복이고 320의 72상태 중앙은 모두 보인다. 이전20 중앙 계약 실패와 동일한 심각도로 부풀리지 않아 P3로 둔다.

**수정 지시 문안:**

> target 폭이 실제 가시 폭보다 큰 경우를 명시적으로 처리하라. 320px에서 버튼의 읽을 라벨과 초점 표시가 들어갈 수 있도록 모바일 크기/줄바꿈 또는 이에 상응하는 안정된 노출 정책을 정하고, 연속 보정이 같은 target을 좌우로 되돌리지 않게 하라. 44px 타깃·초점 표시·상태/판정 한 줄·문서 overflow0·390/819/820 가시성을 보존하라. 단순 ring 제거·버튼 숨김·표1040px 되돌림은 금지한다.

**추가 관찰과 통과 범위**

- 151행 목록에서 마지막 두 번 Enter로 잔여1개까지 소진하면 더보기 DOM이 없어져 `activeElement=BODY`가 된다(4/4). 이는 기존 `remaining>0` 렌더 조건과 native 버튼 제거 경로이며 fix-2 신규 회귀로 세지 않았다. “추가 로드 후 초점 보정 전부 성립”의 근거로도 세지 않는다. 마지막 페이지 소진의 초점 목적지를 후속 지시서에서 명시하는 것이 필요하다. 일반 추가50 뒤 **남아 있는** 버튼의 가시성과 구분한다.
- 보정이 끝난 후 일반 wheel은 **+260px**, `touchStart/touchMove/touchEnd` 총13개 실제 touch 이벤트 경로는 **+375px** 이동했고 보정 호출0. 처음 CDP `synthesizeScrollGesture`는 이동0이라 성공 근거로 쓰지 않고 실제 touch 이벤트로 다시 확인했다. [원자료](evidence/edge-focus.json).
- Excel 화면에는 현재 `a[href^="#"]` 링크가0이다. 존재하는 `#excel-compare-results-title`로 **native fragment navigation**을 실행했다. CSS는 계속 smooth, 이동 중 보정 호출0, 1.6초 후 대상 top=**0.09375px**. `instant` 채택이 전역 smooth나 앵커 기전을 변경하지 않았다. 고정 header에 fragment 제목이 붙는 기존 동작까지 새 접근성 보정이 해결한다는 주장은 아니다.
- 모달 이름·원문·Escape 초점 객체 복귀8/8, 수동 trap 안정 후144/144 내부. 이번 smooth 390 경로에서도 모달 열림·순환·복귀 모두 중앙 가시. 실제 스크린리더 음성 출력이나 실기기 가상 키보드까지 검사했다는 주장은 하지 않는다. Chrome152의 desktop/모바일·touch emulation이다.

**지시서 항목별 판정**

| 항목 | 판정 | 재현 명령·출력/증거 | 수정 지시 문안 |
|---|---|---|---|
| A1 원본20 상태 | 통과 | 원본 overlap/focus-contract 무수정, 20/20·전체48/48 | 없음 |
| A2 검색→Escape 전 단계 | 390 통과 | side-effects, 4×18=72/72·필수7단계 위 좌표 | 없음 |
| A3 en 오른쪽 라벨·3px 링 | 390 통과 | x117.969~203.891, client30~360 | 320 별도 R07 |
| A4 펼침·50추가·연속/빠른키 | 남은 버튼 가시성 통과 / 포인터 실패 | Tab200/200, 빠른4/4, 추가4/4; 마지막 소진BODY 별도 | R05, 마지막 소진 후속 명시 |
| B5 점프·과보정 | 실패 | pointer +9725 vs0; 320 반대방향 보정 | R05·R07 |
| B6 instant와 다른 스크롤 | 기전 유지 | CSS smooth 유지, wheel260/touch375/fragment0.094top, 보정0 | 포인터 적용 범위 R05 |
| B7 819/820/821·desktop | 경계 미충족 / desktop 무회귀 | 819·820 각72/72; 821 8실패는 부모 동일; 1365 72/72·144부모대조 차이0 | R06 범위 판정 |
| B8 마우스·터치 영향0 | 실패 | 두 입력 모두 +9725px, :focus-visible=false | R05 |
| B9 모달 trap/Escape | 통과 | 수동8프로필, trap144/144; smooth390 모두 가시 | 유지 |
| B10 초점표시/Tab/fixed tabs/44px | 유지 | outline/ring 실제 캡처, 목록버튼≥44px, fixed tabs y773~835 | 제거/축소로 회피 금지 |
| C11 R01/R02/R03 | 통과 | 최초500행 노출0/0/0; 72상태 한 줄; visual16/16 | 없음 |
| C12 S1/S2·선행 안전화 | 데이터·기존 계약 통과 | unit381, S1 호환8/8+supplement, engine245, UI 원본, XML31/558 | 신규 UI 소견은 별도 |
| C13 사용자1·6·0 | 통과 | 1/B=1·713·37·48; 4/A=6·486·134·31; 4/B=0·703·37·48 | 없음 |
| D14 A11Y_MAX_TOTAL=0 | 자동0 / 수동 상속부채 분리 | 16페이지, incomplete1265 전수·S2 신규14+608 대비통과 | 기존533보류·3ARIA를 통과로 세지 않음 |
| D15 Excel visual16 | 일치 | 기준선 변경0, 16장 직접 열기; 실제 독립 결과 캡처도 열기 | 기존 guide 잘림 정상 승인 아님 |
| D16 범위·SEO·스택 | 통과 | fix 4파일, URL집합같음, 의존/생성/서버/광고새경로0 | 없음 |
| D17 필수 명령 | 최종 필수 통과 / 새 motion 계약실패 | 아래 모든 명령·exit; QR 초기실패 및 재실행 보존 | R05~R07 |
| D18 sol bwrap 타당성 | 방식·현재 재실행 검증 | ro code/probe, 출력만rw, SHA/HTTP 일치; sol64단계 차이0 | 당시 mount/SHA 미제공 한계 명시 |
| E19 최종·후속 | 수정 후 재검수 | 새 motion contract exit1, 14실패 상태/3소견 묶음 | 아래 S3·병합 판정 |

**R01·R02·S1/S2 전 계약·사용자 보고서**

사용자 최초 화면 세 조합 각각 **500행·3,500셀**, 내부 `number:`/`string:` 노출0. initial/duplicate/matched/changed/added/removed 필터별 전체 body도0. [사용자 전수](evidence/private/user-text.json), [정상 XLSX 혼합키 독립 UI](evidence/independent-ui.json). 렌더 text의 논리 경로가 과거 review2로 보이는 파일은 bwrap의 출력 bind를 통해 이 디렉터리에 새로 저장된 것이다.

`displayKey`가 같은 숫자1/문자1·구분자 포함 복합키·다른 쌍의 같은 내부키는 독립 그룹·펼침 상태를 유지한다. 중복 네 배열의 측별 길이/순서/행 대응·null/빈 스칼라·0:2/2:0/2:1/1:2·summary.duplicate 그룹수·원본 선택열 순서·secondary/occurrence 의미를 실제 XLSX로 검사했다. S1 당시 “일반 레코드 displayKey 없음” 단언은 fix-1 정본과 충돌하므로 이전에 보존한 **필드 하나만 허용하는 호환 probe**를 그대로 재사용했다(이번 변경은 출력 root만). 이를 S1 원본 무수정 통과라고 바꾸지 않는다. [호환8/8](evidence/s1-compatible.log), [추가계약](evidence/s1-supplement-compatible.log), [245개 전체 엔진 대조](evidence/engine-review.json).

분할 formatter의 16,000/32,767 경계·UTF-16/surrogate·CR/LF·독립 좌우 목록·Parameters·32,768 key 오류 ko/en 안내·4,096 취소·30,000행 append·report 불변성 통과. 501그룹 fixture의 최초 DOM500, 닫힌 목록DOM0, 측별50/50, DOM 밖51번째/501번째 그룹/원본602행 검색, 무손실 모달/ZIP도 통과했다. [원본 UI](evidence/ui-review.json), [XML 독립 파서](evidence/xml-review.json), [공개 보고서 Key](evidence/report-key-review.json).

| 머리글/키 | duplicate | matched | changed | added | 최초500행 내부 키 셀 |
|---|---:|---:|---:|---:|---:|
| 1/B | 1 | 713 | 37 | 48 | 0 |
| 4/A | 6 | 486 | 134 | 31 | 0 |
| 4/B | 0 | 703 | 37 | 48 | 0 |

XML 파서는 실제 다운로드·ZIP·경계 보고서 **31 XLSX/558 XML·rels**를 재개방했다. 9시트·7 detail 시트13열, 목록≤16000·셀≤32767, 폭12~48, 수식객체 없음, ZIP2항목과 개별2보고서 bytes동일. 선행 writer/backstop/DataRows 및 package/lock은 부모와 SHA 같고 공용 writer 3파일은 S0와도 bytes같다. unit에는 희소 조회/객체수·행열 numFmt·문자 안전화 등 선행 배포 회귀가 포함된다.

레이아웃은 합성·사용자1/B·사용자4/A × ko/en × light/dark × desktop1365/mobile390 × 접힘/좌측/양측의 **24화면·72상태**. 전부 status/reason1줄, 폭≥96/112, 키≥128, 표1040, 문서 overflow0, 영역 최대 가로 스크롤 desktop55/mobile710px. 가로 스크롤이 실제로 필요하다는 사실을 숨기지 않는다. [전체 실측](evidence/layout-independent.json).

**접근성·시각 판정**

공식 `A11Y_MAX_TOTAL=0`은16페이지 violations0·외부요청0. incomplete **1,265 selector 재방문, 누락0**. [수동 분류](evidence/incomplete-disposition.json)는 **단색 대비729통과 / 공용 gradient533보류 / 공용 ARIA3미충족**이다. ARIA는 tools category2·HWP host1. 단색 근사의 저대비153 node(171 text)를 gradient까지 확정 실패한 값으로 확대하지 않았다. 해당 selector집합은 이전과 동일하다.

S2소유 공식14노드는 최소12.7995:1·실패0, 별도 결과/모달608텍스트는 최소5.27295:1·실패0. [수동 집계](evidence/a11y-adjudication.json). 공용 미선택 status 필터의 기존 대비부채와 guide 잘림은 상속 표면이며, axe0이나 시각일치를 모든 부채 해소의 증거로 삼지 않는다. 새 초점·포인터 소견은 별도 실패다.

Excel 시각은 **16/16 일치**, 기존183기준선 bytes불변. 표 아래 시트명 나열이 잘리는 한국어 guide는 앞선 라운드와 같은 기존 결함으로 보존했으며 정상 화면으로 승인하지 않았다. 시각 테스트는 일치 시 actual png를 남기지 않으므로 **현재 캡처가 일치한 기준선16장을 직접 열었고**, 별도 현재 결과·초점·포인터 캡처도 직접 열었다. [시각 로그](evidence/visual.log), [파일별 직접 검토](evidence/visual-manual.json).

| 파일 | 결과·변경 사유 |
|---|---|
| `excel-compare-empty__initial__ko__light__desktop.png` | 일치 · 변경 없음 |
| `excel-compare-empty__initial__ko__dark__mobile.png` | 일치 · 변경 없음 |
| `excel-compare-empty__bottom__ko__dark__mobile.png` | 일치 · 변경 없음 |
| `excel-compare-empty__interaction-duplicate-result__ko__light__desktop.png` | 일치 · 변경 없음 |
| `excel-compare-empty__interaction-duplicate-result__ko__light__mobile.png` | 일치 · 변경 없음 |
| `excel-compare-empty__interaction-duplicate-result__ko__dark__desktop.png` | 일치 · 변경 없음 |
| `excel-compare-empty__interaction-duplicate-result__ko__dark__mobile.png` | 일치 · 변경 없음 |
| `excel-compare-empty__initial__en__light__mobile.png` | 일치 · 변경 없음 |
| `excel-compare-empty__initial__en__dark__desktop.png` | 일치 · 변경 없음 |
| `excel-compare-empty__bottom__en__light__mobile.png` | 일치 · 변경 없음 |
| `excel-compare-empty__interaction-key-mode__en__dark__desktop.png` | 일치 · 변경 없음 |
| `excel-compare-empty__interaction-pair__en__dark__desktop.png` | 일치 · 변경 없음 |
| `excel-compare-empty__interaction-duplicate-result__en__light__desktop.png` | 일치 · 변경 없음 |
| `excel-compare-empty__interaction-duplicate-result__en__light__mobile.png` | 일치 · 변경 없음 |
| `excel-compare-empty__interaction-duplicate-result__en__dark__desktop.png` | 일치 · 변경 없음 |
| `excel-compare-empty__interaction-duplicate-result__en__dark__mobile.png` | 일치 · 변경 없음 |

**범위·main/U4·번들**

`git diff --stat ab00de3..5dfe413` → **4파일 +155/−8**: ExcelComparePage.tsx, Excel 비교 smoke, CHANGELOG, review-notes. 나머지 **2,404 추적 파일은 부모와 bytes동일**. [diff](evidence/diff-stat.txt), [보존](evidence/parent-preservation.json), [전체 실행 확장자 재귀검색·명시적 vendor 예외](evidence/recursive-contract-scan.json). 새 의존/서버 전제/광고 예외·경로/생성물·벤더 수기수정0. 실제 생성 출력의 HTML·canonical·hreflang·sitemap 집합은 S0 보존 출력과 일치했다. [URL집합](evidence/url-sets.json). 집합을 의미하는 검증이며 현재 live 배포 검증은 아니다.

고정 `main 597a92ff56ed9c3eb23755a58df2580b0269b8bd`는 대상의 조상이고 S1+S2 변경31파일이다. 이 고정 main 기준 분기 충돌은 없다. 금지된 현재 U4 트리를 읽지 않았으므로 현재 U4 미커밋 변경과 실제 merge가 clean하다고 선언하지 않는다.

| 표면 | 고정 main→S1+S2 | U4와의 공동/충돌 주의 |
|---|---|---|
| Excel component/engine/duplicateReport/report/types·Excel tests | Excel 전용 전환 | PDF feature 직접 교집합0 |
| src/app/seo.ts · ko/en features.json/tools.json | Excel 설명·FAQ | PDF route/문구와 파일공유, 양쪽키·URL 보존 |
| accessibility-audit 및 관련 unit · visual scenarios/config unit | Excel8결과 프로필 | U4 PDF등록·시나리오 목록과 공동표면 |
| CHANGELOG.md · docs/review-notes.md | Excel기록 | 동시 prepend/기록 취합 |
| writer/backstop/DataRows · package/lock | S0/부모 보존 | 선행 안전화·의존 덮어쓰기 금지 |
| AppShell/global.css · browser-smoke | 이 브랜치 변경0 | R06 범위 확대 시 공용 수정 필요 여부 재판정 |

번들 기준선 SHA-256 **`726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`**. multiplier1, override없음, 귀속이동0. [실측](evidence/bundle.json).

| gzip 지표 | 현재 B | S0 대비 증가 B | 허용 증가 B | 잔여 B |
|---|---:|---:|---:|---:|
| entryJsGzip | 300,703 | +1,415 | 20,480 | **19,065** |
| affectedRouteJsGzip | 2,453,580 | +1,999 | 61,440 | **59,441** |
| sharedJsGzip | 2,715,925 | +1,417 | 30,720 | **29,303** |
| appJsGzip | 5,470,208 | +4,831 | 81,920 | **77,089** |
| cssGzip | 37,839 | +146 | 10,240 | **10,094** |

**sol의 read-only 실행 검증과 불변 증명**

[original.py](probes/original.py)는 root와 원본 probe를 ro로 두고 과거 `main` 논리 경로를 현재 archive로, `evidence` 출력만 이번 경로로 bind한다. `statvfs`로 **code ro/probe ro/output rw**를 확인했다. [mapping-proof](evidence/mapping-proof.json). 논리 current component SHA **`4e9974ae8e76547117954d3cd7f493d93b362c48d5aaf2e916c63f97d4d7717e`**, 원본 overlap SHA **`fab1f2cd976fd919b3d02697ba680c651601378ca169432451dbfef953e47814`**. 실제 HTTP도 현재 fix-2 자산과 같았다.

sol의 저장된 current **64단계**와 이번 무수정 실행의 stage/대상/측/rect/9점/scrollY/chrome을 비교해 **차이0**이다. [대조](evidence/sol-reproduction-comparison.json). 따라서 read-only bind 방식 자체는 타당하고, 같은 fix-2 결과는 독립 재현됐다. 다만 sol 산출물에는 당시 mount 목록과 review2 자신의 probe/evidence 시작·종료 SHA manifest가 없어 **그 과거 실행의 모든 마운트·원본 불변을 소급해서 증명할 수는 없다**. 이번 라운드에서는 시작·종료 SHA를 직접 남겨 그 한계를 보완했다.

시작·종료 대상 HEAD/브랜치 동일, 대상·archive status 모두 빈 문자열. 양쪽 추적 **2,408파일 SHA동일**, 보호 입력·원본 probe·이전 검수 evidence·사용자 사본·기준선 **435파일 SHA동일**, archive stream SHA동일. **4350~4359 listener0**. [시작](evidence/state-start.json), [종료](evidence/state-finish.json), [불변 요약](evidence/invariance.json). 보고서는 저장소 밖에 두므로 추적 CHANGELOG/review-notes는 편집하지 않았다.

**실제 실행 명령·실패 원출력**

기본 cwd `/tmp/worklazy-xd-s2-review3/main`, 공통 래퍼 `python3 ../probes/check.py <name> <command...>`. [전체 명령·exit·시간](evidence/checks.jsonl).

실패를 숨기지 않는다. QR 최초 실행은 취소 후 생성 버튼의 wait→click 사이 DOM이 바뀌어 `tests/qr-bulk-smoke.mjs:217`에서 `No element found`로 종료됐다. 같은 무수정 명령은 후속 QA build에서 통과했다. 환경이 production→QA로 달라졌으므로 production의 단순 재실행 성공으로 표현하지 않으며, 알려진 동기화 경합 후보로 남긴다. QR 코드/테스트는 부모와 bytes동일이고 이 Excel 보정은 QR 페이지에 마운트되지 않는다.

`user-text` 첫 실행은 모든 18화면/최초500행 측정을 저장한 뒤 검수 사본의 후속 `overlap-review.mjs` import 누락으로 exit1이었다. 제품 실패로 세지 않았다. **원본 review2 user-text를 원본 경로 그대로 ro bind 실행**한 `user-text-original`은 후속 overlap까지 exit0이다. 별도 `motion-contract`는 의도적으로 완화하지 않은 새 품질 계약이며 **exit1: 14 measured states / 3 finding groups**다. 이것이 최종 실패 판정의 실행 근거다.

| 검증 | 실제 명령 | exit | 시간 | 원출력 |
|---|---|---:|---:|---|
| tsc | `./node_modules/.bin/tsc -b --pretty false` | **0** | 17.437s | [tsc.log](evidence/tsc.log) |
| unit | `npm run test:unit` | **0** | 4.289s | [unit.log](evidence/unit.log) |
| build-production | `npm run build` | **0** | 101.075s | [build-production.log](evidence/build-production.log) |
| static | `npm run test:static` | **0** | 0.778s | [static.log](evidence/static.log) |
| provenance-production | `python3 ../probes/provenance.py production` | **0** | 0.220s | [provenance-production.log](evidence/provenance-production.log) |
| overlap-original | `python3 /tmp/worklazy-xd-s2-review3/probes/original.py node /tmp/worklazy-xd-s2-review2/probes/overlap-review.mjs` | **0** | 37.470s | [overlap-original.log](evidence/overlap-original.log) |
| focus-contract | `python3 /tmp/worklazy-xd-s2-review3/probes/original.py python3 /tmp/worklazy-xd-s2-review2/probes/focus-contract.py` | **0** | 0.064s | [focus-contract.log](evidence/focus-contract.log) |
| smoke-compare | `npm run test:excel-compare` | **0** | 42.179s | [smoke-compare.log](evidence/smoke-compare.log) |
| smoke-cleaner | `npm run test:excel-cleaner` | **0** | 54.815s | [smoke-cleaner.log](evidence/smoke-cleaner.log) |
| scope | `python3 ../probes/scope.py` | **0** | 1.049s | [scope.log](evidence/scope.log) |
| smoke-qr | `env 'NODE_OPTIONS=--max-old-space-size=4096 --import /tmp/worklazy-excel-s0/probes/strict-test-port.mjs' npm run test:qr-bulk` | **1** | 47.105s | [smoke-qr.log](evidence/smoke-qr.log) |
| mapping-proof | `python3 /tmp/worklazy-xd-s2-review3/probes/original.py python3 /tmp/worklazy-xd-s2-review3/probes/mapping-proof.py` | **0** | 0.101s | [mapping-proof.log](evidence/mapping-proof.log) |
| smoke-browser | `npm run test:browser` | **0** | 58.984s | [smoke-browser.log](evidence/smoke-browser.log) |
| engine-review | `node --experimental-strip-types ../probes/engine-review.mjs` | **0** | 2.883s | [engine-review.log](evidence/engine-review.log) |
| s1-compatible | `node --experimental-strip-types --expose-gc ../probes/compatible-independent.mjs` | **0** | 12.283s | [s1-compatible.log](evidence/s1-compatible.log) |
| s1-supplement-compatible | `node --experimental-strip-types ../probes/compatible-supplement.mjs` | **0** | 0.962s | [s1-supplement-compatible.log](evidence/s1-supplement-compatible.log) |
| ui-original | `python3 /tmp/worklazy-xd-s2-review3/probes/original.py node /tmp/worklazy-xd-s2-review/probes/ui-review.mjs` | **0** | 25.485s | [ui-original.log](evidence/ui-original.log) |
| layout-original | `python3 /tmp/worklazy-xd-s2-review3/probes/original.py node /tmp/worklazy-xd-s2-review/probes/layout-review.mjs` | **0** | 15.647s | [layout-original.log](evidence/layout-original.log) |
| user-original | `python3 /tmp/worklazy-xd-s2-review3/probes/original.py node /tmp/worklazy-xd-s2-review/probes/user-review.mjs` | **0** | 18.897s | [user-original.log](evidence/user-original.log) |
| ui-independent | `node ../probes/independent-ui.mjs` | **0** | 20.194s | [ui-independent.log](evidence/ui-independent.log) |
| layout-independent | `node ../probes/layout-independent.mjs` | **0** | 149.096s | [layout-independent.log](evidence/layout-independent.log) |
| user-text | `node ../probes/user-text.mjs` | **1** | 25.909s | [user-text.log](evidence/user-text.log) |
| xml-review | `python3 ../probes/xml-review.py` | **0** | 0.367s | [xml-review.log](evidence/xml-review.log) |
| report-keys | `python3 ../probes/report-key-review.py` | **0** | 0.057s | [report-keys.log](evidence/report-keys.log) |
| css | `npm run css:orphans` | **0** | 0.705s | [css.log](evidence/css.log) |
| routes | `node tests/tool-registry-routes.mjs` | **0** | 0.583s | [routes.log](evidence/routes.log) |
| diff-check | `git diff --check` | **0** | 0.090s | [diff-check.log](evidence/diff-check.log) |
| build-qa | `env VITE_LOCAL_QA=1 npm run build` | **0** | 96.636s | [build-qa.log](evidence/build-qa.log) |
| provenance-qa | `python3 ../probes/provenance.py qa` | **0** | 0.211s | [provenance-qa.log](evidence/provenance-qa.log) |
| visual | `env VISUAL_ONLY=excel-compare VISUAL_ARTIFACT_DIR=/tmp/worklazy-xd-s2-review3/evidence/visual npm run test:visual` | **0** | 46.040s | [visual.log](evidence/visual.log) |
| a11y | `env A11Y_MAX_TOTAL=0 A11Y_REPORT_PATH=/tmp/worklazy-xd-s2-review3/evidence/a11y.json npm run test:a11y` | **0** | 63.129s | [a11y.log](evidence/a11y.log) |
| a11y-manual | `python3 /tmp/worklazy-xd-s2-review3/probes/original.py node /tmp/worklazy-xd-s2-review/probes/a11y-review.mjs` | **0** | 67.650s | [a11y-manual.log](evidence/a11y-manual.log) |
| a11y-incomplete-manual | `python3 /tmp/worklazy-xd-s2-review3/probes/original.py node /tmp/worklazy-xd-s2-review/probes/official-incomplete.mjs` | **0** | 35.208s | [a11y-incomplete-manual.log](evidence/a11y-incomplete-manual.log) |
| a11y-adjudication | `python3 ../probes/a11y-adjudicate.py` | **0** | 0.162s | [a11y-adjudication.log](evidence/a11y-adjudication.log) |
| bundle | `env BUNDLE_BASELINE=/tmp/worklazy-excel-s0/evidence/bundle-baseline.json BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-xd-s2-review3/evidence/bundle.json npm run bundle:measure` | **0** | 75.712s | [bundle.log](evidence/bundle.log) |
| side-effects | `node ../probes/side-effects.mjs` | **0** | 531.794s | [side-effects.log](evidence/side-effects.log) |
| smoke-qr-retry | `env 'NODE_OPTIONS=--max-old-space-size=4096 --import /tmp/worklazy-excel-s0/probes/strict-test-port.mjs' npm run test:qr-bulk` | **0** | 51.820s | [smoke-qr-retry.log](evidence/smoke-qr-retry.log) |
| user-text-original | `python3 /tmp/worklazy-xd-s2-review3/probes/original.py node /tmp/worklazy-xd-s2-review2/probes/user-text.mjs` | **0** | 60.646s | [user-text-original.log](evidence/user-text-original.log) |
| resize-focus | `node ../probes/side-effects-resize.mjs keyboard` | **0** | 83.857s | [resize-focus.log](evidence/resize-focus.log) |
| parent-focus | `node ../probes/side-effects-parent.mjs keyboard` | **0** | 147.437s | [parent-focus.log](evidence/parent-focus.log) |
| edge-focus | `node ../probes/edge-focus.mjs` | **0** | 39.707s | [edge-focus.log](evidence/edge-focus.log) |
| motion-contract | `python3 ../probes/motion-contract.py` | **1** | 0.293s | [motion-contract.log](evidence/motion-contract.log) |
| final-state | `python3 ../probes/final-state.py` | **0** | 4.542s | [final-state.log](evidence/final-state.log) |

**다음 단계 판정**

- **S3 착수:** 아직 불가. Claude가 R05·R07 수리와 R06 기존 경계 결함의 포함 범위, 마지막 목록 소진의 초점 목적지를 한 지시서로 정리한 뒤 sol 수리→astra 재검수를 거쳐 잔여0의 SHA로 S3 지시서를 발행해야 한다. 이번 검수에서 S3는 착수하지 않았다.
- **S1+S2 병합·배포 후보:** 현재는 아니다. 데이터/보고서 전환과 R01~R04의 지정 재현은 통과하지만 신규 포인터 부작용이 남았다. 수리 후 S1+S2를 한 전환 단위로 다시 판정한다. 실제 배포는 S4 통합·Gemini 직접 시각 검수·배포 게이트가 별도이며 이번 보고서로 대체하지 않는다.
- **번들 잔여 예산:** 위 표의 19,065 / 59,441 / 29,303 / 77,089 / 10,094B. 수리 시 재측정하고 기준선/상한을 올리지 않는다.

**[수정 후 재검수]**
