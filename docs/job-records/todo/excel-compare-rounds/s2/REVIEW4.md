**Excel S2 fix-3 재검수(4차·범위 축소) — [검수 통과]**

Codx · 2026-09-08 · Worklazy Tools 자체 제품 품질 검증.
대상 `/tmp/worklazy-xd` · 브랜치 `excel-dupkey-20260907` · **`bdd09a7d6bc10da74db8fd3b2b8565da9c3f054e`** · 부모 `5dfe4139cf042090ef6a5207f67843e2e4ef9ce3`.

**지정한 R05·R06·R07이 해소됐고 R04 20/20이 유지됐다. 이번 수정에서 비롯된 새 결함은 발견하지 않았다.** 마우스·터치 추가 로드는 이동 0px·보정 0회·100항목·늦은 이동 0px, 닫힘도 0px이다. 819/820/821의 지정 Tab·Enter 및 활성 초점 resize에서 중앙·라벨·링이 보인다. 320px은 시작 모서리에 가로 보정 한 번으로 수렴한다. 데스크톱 72개 상태의 settled 좌표·스크롤은 직전 라운드와 같고 정상 상태 보정은 0회다.

S1+S2는 **한 전환 단위의 병합·배포 후보**다. 실제 병합 직전 전체 회귀 1회와 통합·배포 게이트는 남아 있다. 이 판정은 이번 축소 범위의 통과이며 전체 회귀를 이번에 다시 실행했다는 뜻은 아니다. 기존 결함은 아래 백로그에 귀속하고 이 단계를 막지 않는다. main 병합·push·배포·S3 착수는 수행하지 않았다.

**항목별 판정**

아래 명령의 기본 cwd는 `/tmp/worklazy-xd-s2-review4/main`이다. `python3 ../probes/check.py <name> <command...>`가 명령·stdout/stderr·exit·시간을 기록한다. 원본 probe는 `python3 ../probes/original.py`로 코드/입력을 읽기 전용으로 bind하고 출력만 이번 evidence로 보낸다. [전체 실행 기록](evidence/checks.jsonl).

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| A1 R05 포인터 | 통과 | 원본 `side-effects.mjs` 무수정: mouse/touch 추가·닫힘 ΔY=0, 호출0, 늦은 이동0; 추가100항목. [원출력](evidence/side-effects-original.log) | 없음 |
| A2 R06 폭 경계 | 통과 | 위 원본의 819/820/821 각각72/72 중앙; 이전821 실패8/8 해소. 원본 `side-effects-resize.mjs keyboard`: 활성 resize16/16. `contracts.py`: 지정 중앙·라벨·링40/40. [집계](evidence/focus-summary.json) | 없음. R06은 기존 결함 해소로 귀속 |
| A3 R07 320px | 통과 | ko/en×light/dark, 가로 −42 또는 −22.796875px 각1회, 시작 간격4 또는4.203125px, 왕복0, 중앙 가시·높이44px | 없음. 반대쪽 초과는 합의한 시작 모서리 우선 정책 |
| A4 R04 유지 | 통과 | 원본 `overlap-review.mjs`·`focus-contract.py`: 동일 인덱스20/20, 현재 버튼48/48의 9점 가시. [20개 대조](evidence/prior-20.json) | 없음 |
| B5 키보드 경로 | 통과 | 390의 Tab/Shift+Tab/Enter/모달/Escape72/72, 긴 목록 연속Tab200/200. 별도 Space 활성화·모달 복귀8/8. [원자료](evidence/side-effects.json), [추가 입력](evidence/cancellation-summary.json) | 없음 |
| B6 새 취소 트리거 | 통과 | `cancellation.mjs`: 4프로필×11입력44경로, 입력 후 보정0, 다음Tab44/44. `pending-native.mjs`: 실제 pending pointerdown/wheel/touchmove 각각 취소·후속보정0. [보충](evidence/pending-native-summary.json) | 없음 |
| B7 데스크톱1365×900 | 무회귀 | 72/72 중앙, 정상 보정0. 직전5dfe413 실측의 같은72단계와 settled rect/scroll/region 등 차이0. [대조](evidence/focus-summary.json) | 기존 상단 부분 가림은 BL03으로 분리 |
| B8 전 폭 가로 보정 | 통과 | 1365 정상72상태 호출0; 390의 이미 보이는 toggle↔full 왕복8회 ΔY=0. 820→821만 필요한 영역 가로 보정 각1회, window0 | 없음 |
| B9 일반 포인터 | 통과 | mouse/touch 펼침·추가·닫힘 스모크6동작 이동0. wheel +260px, native touch +375px·15이벤트·prevented0·보정0. 실제 드래그4/4, 보정0 | 없음 |
| C10 좁은 회귀 | 통과 | `./node_modules/.bin/tsc -b --pretty false`, `npm run build`, `npm run test:excel-compare` 모두exit0 | 없음 |
| C11 Excel 시각16 | 통과·기존 부채 분리 | QA build 후 `VISUAL_ONLY=excel-compare npm run test:visual`, 16/16 일치. 현재16장 직접 열기. 기준선 수정0 | BL02는 정상 승인하지 않음 |
| C12 사용자1행/B | 통과 | `user-one.mjs`: duplicate1·matched713·changed37·added48, 다운로드1. [결과](evidence/user-one.json) | 없음. 4행/A·4행/B 생략 |
| C13 R01 내부 키 | 통과 | 사용자1행/B 결과 화면 `number:`/`string:` 노출0, 페이지 오류0 | 없음. 3조합500행 전수 재측정 생략 |
| C14 범위 제한 | 준수 | `git diff --stat 5dfe413..bdd09a7`: **4파일 +274/−17**, 제품1·테스트1·기록2. 금지한 전 스코프 명령 실행0 | 전체 회귀는 병합 직전1회 |

**세 결함의 실측**

정상 CSV 두 개(`Key,Value`, 각151행, 키A, 긴 left/right 값)를 제품의 파일 선택→키 비교→중복 필터로 처리했다. 결과를 주입하지 않았다. 사용자 파일은 지정한 읽기 전용 사본의 1행/B만 사용했다.

| 포인터 입력 | ΔscrollY | 보정 호출 | 항목 수 | 두 rAF 뒤 추가650ms 이동 |
|---|---:|---:|---:|---:|
| mouse 50개 추가 | 0px | 0 | 100 | 0px |
| touch 50개 추가 | 0px | 0 | 100 | 0px |
| mouse 목록 닫힘 | 0px | 0 | 0 | 0px |
| touch 목록 닫힘 | 0px | 0 | 0 | 0px |

보정 표식만 제거한 원본 probe의 DOM 대조군도 같은 값이다. 제품 스모크는 펼침까지 포함한 두 입력×세 동작과 새 첫 항목 `Source row 52`의 가시성을 단언했다. [mouse 실제 추가 후 화면](evidence/pointer-mouse-current-show-more-after.png)에서 기존51행 아래에 새52·53행이 그대로 보인다. touch 화면도 직접 확인했다. 포인터로 누른 더보기 버튼 자체가 새100번째 항목 아래로 내려가는 것은 정상이며, 그 버튼을 viewport가 따라가지 않는 것이 R05의 계약이다.

| 폭·높이 | ko/en×light/dark 키보드 중앙 | 필요한 보정·가시성 판정 |
|---|---:|---|
| 390×844 | 72/72 | 고정 header/tab 회피, 한영 Escape 복귀 유지 |
| 819×844 | 72/72 | 지정 왼쪽 Tab·Enter8상태 라벨·3px 링 가시 |
| 820×844 | 72/72 | 지정 왼쪽 Tab·Enter8상태 라벨·3px 링 가시 |
| 821×844 | 72/72 | 이전 실패8상태 모두 라벨·3px 링 가시. 고정 chrome 없음·제품 세로 보정 없음 |
| 1365×900 | 72/72 | 정상 상태 보정0; 이전72상태와 레이아웃/스크롤 차이0 |
| 320×844 | 72/72 | 과대 요소 시작 모서리 우선, 아래 표의 단방향 수렴 |

활성 오른쪽 toggle의 820→821→820→819→820 resize는 총16상태에서 중앙·라벨·링이 보인다. 820→821에서는 4프로필 각각 영역 가로 보정1회·window 보정0회, 오른쪽 간격은 ko4.03125px·en4.015625px다. [resize 원자료](evidence/side-effects-resize.json). 819/820/821 Tab·Enter24상태와 resize16상태를 합친 기하 계약40개가 모두 통과했다. 일반 데스크톱의 모든 라벨·링이 완전 노출된다는 확대 해석은 하지 않는다(BL03 참조).

| 320 프로필 | 대상 폭 / 사용 폭 | Enter 후 가로 보정 | 시작 간격 | 왕복 | 높이·중앙 |
|---|---|---|---:|---:|---|
| ko light/dark | 283.984375 / 252px | −42px 1회 | 4px | 0 | 44px·가시 |
| en light/dark | 264.78125 / 252px | −22.796875px 1회 | 4.203125px | 0 | 44px·가시 |

[320 한국어 실제 화면](evidence/private/edge-ko-320-enter.png)에서 라벨의 시작과 시작 쪽 링이 보인다. 반대쪽 초과는 [fix-3의 Claude 판정](input/excel-s2-fix3-dispatch.md)에 따른 허용 상태다. 원본 `motion-contract.py` 실패 배열은 `[]`이고, 독립 `contracts.py`도 실패0이다. 390/819/820/320의 키보드 경로는 두 rAF 이후 늦은 세로 이동0이었다. 821/1365에서 native smooth 스크롤이 계속되는 단계는 제품 보정 호출과 구분했다. 1365의 최종 좌표·스크롤은 직전 라운드와 동일하다.

**취소 입력·키보드 보존의 인과 확인**

[수정 diff](evidence/diff.txt)의 예약 시점과 매 실행 프레임은 `:focus-visible`을 확인한다. pointerdown·touchmove·wheel·스크롤 키는 이전 AbortController를 취소하며 preventDefault/전파 차단은 추가하지 않았다. Tab·Shift+Tab·Enter·Escape는 취소 키 목록에 없고, Space는 native click에서 새 예약을 만든다. 이 코드 관찰을 아래 실제 입력으로 교차했다.

- ko/en×light/dark×390에서 빠른 Tab→Space 펼침과 Space 모달→Escape가8/8 통과했다. 일반 원본의 Enter·모달 trap·Escape 경로도 계속 가시다.
- ArrowDown/Up, PageDown/Up, Home/End, ArrowRight/Left, wheel, pointerdown, touch의44경로를 실제 trusted 입력으로 실행했다. 29경로는 입력 시점에 예약이 남아 있었고, 이 중 취소 대상 세로 스크롤 키는21경로였다. 입력 뒤 추가 보정은44경로 모두0, 다음Tab은44/44 가시였다. [입력 시각·pending·좌표](evidence/cancellation.json).
- PageDown은4프로필 모두 +738px, wheel은+240px 이동했다. 사용자가 스크롤해 초점을 화면 밖으로 보낸 뒤 보정이 억지로 돌아오지 않으며, 다음Tab은 다시 초점을 보이게 한다. 사용자 스크롤 의도를 우선하는 합리적인 동작이다.
- 최초 순차 실험에서는 wheel·pointerdown·touch가 예약 종료 뒤에 도착했다. 이를 “pending 취소를 재현했다”고 세지 않고 **en/light/390에서 순서 있는 CDP 입력을 응답 대기 없이 연이어 보내는 보충 실험**을 했다. rAF/타이머를 인위적으로 지연하지 않았다. touchmove는 접촉이 유지된 상태에서 Tab과 move를 교차했다. 아래 세 입력 모두 실제 pending1개를 취소했고 후속 보정0이었다. wheel 첫 시도는 pending0이라 active 취소 증거에서 제외하고 다음 시도의 pending1을 사용했다.

| 실제 pending 입력 | pending / abort | 이벤트→취소 | 입력 뒤 보정 |
|---|---|---:|---:|
| pointerdown | 1 / 1 | 0.090ms | 0 |
| wheel | 1 / 1 | 0.135ms | 0 |
| touchmove | 1 / 1 | 0.075ms | 0 |

[보충 명령](probes/pending-native.mjs) · [원출력](evidence/pending-native.log) · [원자료](evidence/pending-native.json).

일반 wheel +260px와 별도 native touch +375px·15이벤트는 제품 보정0이었다. 원본 `synthesizeScrollGesture`의 이동0은 터치 성공 증거로 사용하지 않았다. `edge-focus.mjs`의 실제 touchStart/Move/End 경로를 사용했다. 마우스 텍스트 드래그는4프로필에서 각각66/66/74/74문자를 선택했고 보정0이다. 브라우저 검증 환경은 Chrome152.0.7977.64의 desktop/mobile/touch emulation이며 실기기·실제 스크린리더 음성 검사를 했다는 주장은 하지 않는다.

**시각16개 — 기준선 재승인과 구분**

`VITE_LOCAL_QA=1 npm run build` 후 현재 캡처16개를 저장하고 전부 직접 열었다. 기존 `pixelmatch threshold=0.1, includeAA=false, maxDiffPixelRatio=0.001`을 그대로 사용했다. **16장 모두 이 설정에서 유의 차이0픽셀**이다. PNG 자체는10장이 byte동일이고6장에는 미세 색 차이가 있다. 아래에 파일별 최대 8bit 채널 차이를 기록했다. 해당6장은 요소 배치 변화가 관찰되지 않았으며 미세 색 차이의 렌더러 원인은 이번 범위에서 확정하지 않았다. 기준선 파일·허용영역·임계값은 수정하지 않았다.

한국어 guide의 긴 시트명 나열 잘림은 이전에도 있던 결함이다. 시각 일치를 이 결함의 정상 승인으로 사용하지 않으며 BL02에 귀속한다. [파일별 SHA·원시 차이·직접 확인 기록](evidence/visual-manual.json), [공식 로그](evidence/visual-excel.log).

| 파일 (`excel-compare-empty__` 접두 공통) | 시각 결과 / 최대 채널차 | 변경 사유·기존 관찰 |
|---|---|---|
| [bottom__en__light__mobile.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__bottom__en__light__mobile.png) | 일치 / 0 | PNG byte동일·변경 없음 |
| [bottom__ko__dark__mobile.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__bottom__ko__dark__mobile.png) | 일치 / 0 | PNG byte동일·변경 없음; guide 잘림은 BL02 |
| [initial__en__dark__desktop.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__initial__en__dark__desktop.png) | 일치 / 3 | 미세 색 차이만 관찰; 기존 비교 설정 차이0픽셀 |
| [initial__en__light__mobile.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__initial__en__light__mobile.png) | 일치 / 2 | 미세 색 차이만 관찰; 기존 비교 설정 차이0픽셀 |
| [initial__ko__dark__mobile.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__initial__ko__dark__mobile.png) | 일치 / 24 | 미세 색 차이만 관찰; 기존 비교 설정 차이0픽셀 |
| [initial__ko__light__desktop.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__initial__ko__light__desktop.png) | 일치 / 3 | 미세 색 차이만 관찰; 기존 비교 설정 차이0픽셀 |
| [interaction-duplicate-result__en__dark__desktop.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__interaction-duplicate-result__en__dark__desktop.png) | 일치 / 0 | PNG byte동일·변경 없음 |
| [interaction-duplicate-result__en__dark__mobile.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__interaction-duplicate-result__en__dark__mobile.png) | 일치 / 0 | PNG byte동일·변경 없음 |
| [interaction-duplicate-result__en__light__desktop.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__interaction-duplicate-result__en__light__desktop.png) | 일치 / 0 | PNG byte동일·변경 없음 |
| [interaction-duplicate-result__en__light__mobile.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__interaction-duplicate-result__en__light__mobile.png) | 일치 / 0 | PNG byte동일·변경 없음 |
| [interaction-duplicate-result__ko__dark__desktop.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__interaction-duplicate-result__ko__dark__desktop.png) | 일치 / 0 | PNG byte동일·변경 없음; guide 잘림은 BL02 |
| [interaction-duplicate-result__ko__dark__mobile.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__interaction-duplicate-result__ko__dark__mobile.png) | 일치 / 0 | PNG byte동일·변경 없음 |
| [interaction-duplicate-result__ko__light__desktop.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__interaction-duplicate-result__ko__light__desktop.png) | 일치 / 0 | PNG byte동일·변경 없음; guide 잘림은 BL02 |
| [interaction-duplicate-result__ko__light__mobile.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__interaction-duplicate-result__ko__light__mobile.png) | 일치 / 0 | PNG byte동일·변경 없음 |
| [interaction-key-mode__en__dark__desktop.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__interaction-key-mode__en__dark__desktop.png) | 일치 / 2 | 미세 색 차이만 관찰; 기존 비교 설정 차이0픽셀 |
| [interaction-pair__en__dark__desktop.png](main/tests/visual-artifacts/review4-excel/excel-compare-empty__interaction-pair__en__dark__desktop.png) | 일치 / 2 | 미세 색 차이만 관찰; 기존 비교 설정 차이0픽셀 |

**기존 결함의 백로그 귀속 — 이번 단계 비차단**

| 귀속 | 제품 입력 도달성·현재 증거 | 이번 수정과 구분 | 후속 문안 |
|---|---|---|---|
| BL01 목록 최종 소진 초점 목적지 | 정상151행 중복 목록에서 키보드로 마지막 더보기를 소진하면 버튼 DOM이 사라져 BODY 초점4/4 | 직전 검수에도4/4. remaining 계산부터 목록/값 컨트롤까지 부모와 SHA동일. [증거](evidence/backlog-code-provenance.json) | Excel 비교 접근성 백로그: 최종 소진 후 초점 목적지와 다음Tab 동작을 별도 계약으로 정할 것 |
| BL02 한국어 guide 시트명 나열 잘림 | Excel 안내의 긴 영문 시트명 문자열이 카드 끝에서 잘림. 현재 시각 캡처에서도 관찰 | 기존 baseline에 동일하게 포함. 해당 문구·레이아웃·CSS는 이번 diff에서 변경0 | Excel guide 가독성 백로그: 줄바꿈/표현을 고친 뒤 그 범위의 정상 기준선 갱신 |
| BL03 기존 한국어 desktop 상단 부분 가림 | 사용자1/B,1365×900, 오른쪽 Enter 뒤 toggle y=−19.53125~24.46875, 중앙은 가시이나 위쪽 라벨/링 일부 잘림. 전후 Tab/Shift+Tab은 y=0.46875로 링 여백 부족 | 두 테마의6상태가 직전5dfe413와 rect동일. 이번 정상 desktop 보정0·72상태 무회귀와 구분. [대조](evidence/existing-desktop-clipping.json) | Excel desktop 초점 백로그: 고정 shell 없는 viewport 상단의 부분 가림 정책을 별도 범위로 판정 |

이는 새로 발생한 회귀가 아니며 이번 축소 검수의 수정 요청은 **0건**이다. 기록의 추적 파일 수정 금지 때문에 `docs/backlog.md`·`docs/review-notes.md`를 직접 편집하지 않았다. 위 귀속은 Claude 취합용 후속 문안이다. 기존 접근성 전체 incomplete·공용 대비 부채는 이번에 재측정하거나 해소 승인하지 않았다.

**실행 게이트·저장소 불변**

첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 AGENTS, [이번 지시서](input/excel-s2-review4-dispatch.md), 3차 검수의 R05/R06/R07, fix-3 Claude 판정, sol REPORT, 관련 review-notes·기각 이력과 v3 정본의 S0~S4 계약을 확인했다. 이번 지시서의 “파일3개” 문구는 나열 및 실제diff에 맞춰 제품1·테스트1·기록2의 **4개**로 해석했다.

HEAD/브랜치가 지정값과 일치했고 시작 status는 비어 있었다. 대상에는 ignored `docs/jobs/todo`가 없어 허용된 S0 보존 열린 계획19개를 스캔했다. 같은 파일을 언급하는 이전 Excel 계획은 있으나 이번 고정 커밋 재검수와 상반되는 실행 지시는 없었다. [스캔](evidence/open-plans-scan.txt). 금지된 원 트리의 실시간 미커밋 계획까지 검사했다고 주장하지 않는다.

`git -C /tmp/worklazy-xd archive bdd09a7`를 `main/`에 풀고 시작 추적2408파일과 SHA를 대조했다. node_modules는 대상의 독립 디렉터리를 `cp -a --reflink=auto`로 복사했다. 검수 사본에 별도 Git 저장소를 만들거나 commit/checkout하지 않았다. 모든 빌드·브라우저는 직렬, Node22.17.1·heap4GiB, preview4350 `--strictPort`, visual concurrency1이다. 실제 production/QA HTTP JS·CSS 자산은 각각 사본 dist와 byte대조했다. [production](evidence/provenance-production.json), [QA](evidence/provenance-qa.json), [환경](evidence/environment.json).

원본 probe와 코드가 ro, 출력이 rw인 bind를 `statvfs`와 SHA로 확인했다. [mapping proof](evidence/mapping-proof.log). 원본 probe 안의 이전 라운드 논리 경로는 이번 archive와 evidence를 가리키며 원본 파일 자체는 수정하지 않았다. 두 원본 probe의 대조군은 제품 통과 수에 넣지 않았다. 사용자 사본은 `/tmp/worklazy-userfiles/`만 읽었고 사용자 내용 포함 화면은 `evidence/private/`에 보관했다. 원 트리의 최초 공통 규칙 읽기 외 접근, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`, 다른 잡 포트 접근은 없다.

종료 HEAD/브랜치/status가 시작과 같고, **대상2408파일·archive2408파일의 변경0**, 보호한 원본 probe·사용자 파일·계획 입력83파일의 변경0이다. 사용한 preview를 종료했고 **4350~4359 listener0**이다. [시작](evidence/state-start.json), [종료](evidence/state-finish.json), [불변 요약](evidence/invariance.json). 제품 코드·추적 기록·기준선 수정, 커밋·push·브랜치 전환 없음.

**실제 명령·종료 코드**

| 이름 | 실제 명령 (`check.py` 뒤 인수) | exit | 시간 | 원출력 |
|---|---|---:|---:|---|
| tsc | `./node_modules/.bin/tsc -b --pretty false` | 0 | 19.193s | [tsc.log](evidence/tsc.log) |
| build-production | `npm run build` | 0 | 112.558s | [build-production.log](evidence/build-production.log) |
| provenance-production | `python3 ../probes/provenance.py production` | 0 | 0.245s | [provenance-production.log](evidence/provenance-production.log) |
| overlap-original | `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review2/probes/overlap-review.mjs` | 0 | 43.056s | [overlap-original.log](evidence/overlap-original.log) |
| focus-contract | `python3 ../probes/original.py python3 /tmp/worklazy-xd-s2-review2/probes/focus-contract.py` | 0 | 0.070s | [focus-contract.log](evidence/focus-contract.log) |
| mapping-proof | `python3 ../probes/original.py python3 -c <statvfs·SHA 확인; 전문은 로그>` | 0 | 0.073s | [mapping-proof.log](evidence/mapping-proof.log) |
| side-effects-original | `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review3/probes/side-effects.mjs` | 0 | 536.665s | [side-effects-original.log](evidence/side-effects-original.log) |
| resize-original | `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review3/probes/side-effects-resize.mjs keyboard` | 0 | 83.373s | [resize-original.log](evidence/resize-original.log) |
| motion-contract | `python3 ../probes/original.py python3 /tmp/worklazy-xd-s2-review3/probes/motion-contract.py` | 0 | 0.245s | [motion-contract.log](evidence/motion-contract.log) |
| smoke-compare | `npm run test:excel-compare` | 0 | 67.044s | [smoke-compare.log](evidence/smoke-compare.log) |
| narrow-contracts | `python3 ../probes/contracts.py` | 0 | 0.398s | [narrow-contracts.log](evidence/narrow-contracts.log) |
| cancellation | `node ../probes/cancellation.mjs` | 0 | 186.047s | [cancellation.log](evidence/cancellation.log) |
| user-one | `node ../probes/user-one.mjs` | 0 | 4.272s | [user-one.log](evidence/user-one.log) |
| edge-capture-original | `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review3/probes/edge-focus.mjs` | 0 | 39.668s | [edge-capture-original.log](evidence/edge-capture-original.log) |
| build-qa | `env VITE_LOCAL_QA=1 npm run build` | 0 | 95.342s | [build-qa.log](evidence/build-qa.log) |
| provenance-qa | `python3 ../probes/provenance.py qa` | 0 | 0.291s | [provenance-qa.log](evidence/provenance-qa.log) |
| visual-excel | `env VISUAL_ONLY=excel-compare VISUAL_ARTIFACT_DIR=../evidence/visual VISUAL_CAPTURE_DIR=../main/tests/visual-artifacts/review4-excel npm run test:visual` | 0 | 47.244s | [visual-excel.log](evidence/visual-excel.log) |
| pending-native | `node ../probes/pending-native.mjs` | 0 | 12.736s | [pending-native.log](evidence/pending-native.log) |
| final-state | `python3 ../probes/final-state.py` | 0 | 1.224s | [final-state.log](evidence/final-state.log) |

검증 명령의 실패나 재시도에 의한 통과 전환은 없었다. pending-native의 wheel 첫 시도는 제품 실패가 아니라 pending0이라는 측정 결과이며 그대로 원자료에 보존했다. production/QA build는 각각2835 modules·61 정적 페이지를 생성했다. 보고서용 기존 캡처 픽셀 분석은 새 브라우저 회귀 재실행이 아니다.

**병합 직전 1회로 남긴 전체 회귀**

현재 사용자 지시로 이번에는 아래 전 스코프를 실행하지 않았다. sol의 직전 전체 통과 로그를 이번 실행 결과로 대체 표기하지도 않았다.

- `npm run test:unit` 전체
- `npm run test:browser` 전체
- `npm run test:qr-bulk`
- `npm run test:excel-cleaner`
- production `npm run build` 후 `npm run test:static`
- `VITE_LOCAL_QA=1 npm run build` 후 `A11Y_MAX_TOTAL=0 npm run test:a11y` 전체. incomplete은 통과로 세지 않고 기존/신규 및 수동 판정 분리
- `BUNDLE_BASELINE=/tmp/worklazy-excel-s0/evidence/bundle-baseline.json npm run bundle:measure` — S0 기준선 SHA `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`, 상한/귀속 계약 유지
- `npm run css:orphans`
- `node tests/tool-registry-routes.mjs`

병합될 정확한 산출물에서 위 목록과 `./node_modules/.bin/tsc -b`, `npm run test:excel-compare`, `git diff --check`, 통합 변경 범위 시각 회귀를 **한 차례의 최종 검증 묶음**으로 수행한다. 다른 잡의 변경이 합쳐지면 그 공동 파일의 누락·충돌을 통합 게이트에서 확인한다. 실제 배포 전 추적 제외 로컬 결과 화면의 Gemini 직접 시각 검수와 S4/배포 게이트도 남아 있다.

**S3 착수 조건·main 충돌 표면**

S3(머리글 자동 감지)는 Claude가 이 S2 통과를 채택하고, 실제 착수 HEAD를 기준으로 S3 정본 지시서를 발행하며 기준 해시·열린 계획 충돌 게이트를 통과한 뒤 착수할 수 있다. v3 정본대로 detector·원시 sample→inspect→client 취소/token/cache→파일·시트 상태/swap→ko/en 안내와 수동·경쟁·취소 회귀를 함께 범위화한다. 기존 BL01~03은 별도 백로그이고 이번 단계나 S3 착수를 막지 않는다. 병합 직전으로 미룬 전체 회귀를 S3 착수 전에 다시 실행하는 조건을 추가하지 않는다. 이번 검수는 S3를 구현하지 않았다.

고정 **main `597a92ff56ed9c3eb23755a58df2580b0269b8bd`**는 bdd09a7의 조상이다(`git merge-base --is-ancestor 597a92f bdd09a7` exit0). 이 고정 기준과는 분기 충돌이 없으며 main→S1+S2 변경은31파일이다. [파일 목록](evidence/main-diff.txt), [조상 검사](evidence/main-ancestry.txt). 현재 U4 트리·금지된 다른 worktree를 읽거나 merge를 실행하지 않았으므로 그 미커밋 변경까지 clean merge를 보장하지 않는다.

| 표면 | 고정 main 대비 | 통합 때 확인할 내용 |
|---|---|---|
| ExcelComparePage/engine/types/report/duplicateReport·Excel 전용 tests | Excel 전용 변경 | S1+S2 전환을 함께 유지; PDF 전용 feature와 직접 교집합 없음 |
| `src/app/seo.ts`, ko/en `features.json`·`tools.json` | Excel 설명·FAQ 변경 | PDF/다른 기능과 파일 공유 가능; 양쪽 route·문구 키 보존 |
| accessibility-audit·관련unit, visual scenarios/config unit | Excel 결과 시나리오 등록 | U4 등 다른 결과 페이지 등록·기대 목록과 병합 충돌 주의 |
| `CHANGELOG.md`, `docs/review-notes.md` | 기록 추가 | 동시 기록 취합 |
| writer/backstop/DataRows, package/lock, AppShell/global.css | 이 전환에서 변경 없음 | 선행 안전화·의존·공용 UI의 다른 잡 변경을 덮어쓰지 않을 것 |

**최종 판정: [검수 통과]** — 이번 수정의 잔여 수정 요청0, 기존 결함은 백로그 귀속. S1+S2 병합·배포 후보, 실제 병합/배포는 위 최종 게이트 후 별도 수행.
