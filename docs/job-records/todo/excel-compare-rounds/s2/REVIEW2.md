# Excel S2 fix-1 재검수(2차)

**[수정 후 재검수] — R01 내부 키, R02 세로 줄바꿈, R03 기준선 수리는 확인. 모바일 키보드 초점이 하단 탭/표 경계에 가려지는 잔여 1건(S2-R04, P2).**

Codx · 2026-09-08 · 대상 `/tmp/worklazy-xd` · 브랜치 `excel-dupkey-20260907` · **`ab00de3a6c47e07a15e8554c5ff0a466a130c209`** · 부모 `ebba5203d2984b9ddcb8b321beaf80f4b953f2a4`.

사용자 첫 500행의 내부 키 노출 셀은 **499/494/500 → 0/0/0**, 72상태의 상태·판정은 **모두 1줄**, Excel 시각 회귀는 **16/16 일치**다. 하지만 이름 있는 가로 스크롤 영역과 44px 크기만으로 키보드 가시성을 보장하지 못한다. 실제 Tab·Enter·Escape 경로에서 새 결과 버튼이 가려지므로 최종 제품 승인으로 확대하지 않는다. 코드 수정·커밋·push·브랜치 전환은 하지 않았다.

## 실행 게이트와 출처

- `PROJECT_RULES.md` 전문을 첫 행동으로 읽고, 대상 AGENTS·[재검수 지시](input/excel-s2-review2-dispatch.md)·1차 REPORT·[fix-1 정본 판정](input/excel-s2-fix1-dispatch.md)·sol REPORT/evidence·v3 정본·관련 review-notes를 읽었다. 최신 fix-1의 일반 `displayKey` 허용 판정이 S1의 과거 필드 금지 단언보다 우선한다.
- 시작 HEAD/브랜치 일치, status 빈 문자열. 대상에는 ignored `docs/jobs/todo`가 없어서 **허용된 S0 보존본의 열린 계획 19개**를 다시 스캔했다. [검색](evidence/open-plans-scan.txt), [계획·baseline SHA](evidence/plan-baseline-hashes.json). 이번 고정 커밋 검수와 상반된 실행 지시 없음. 금지된 U4 원 트리의 실시간 계획/변경을 읽었다는 뜻이 아니다.
- `git -C /tmp/worklazy-xd archive ab00de3a6c47e07a15e8554c5ff0a466a130c209`로 `main/` 사본 생성. 추적 **2,408파일 SHA**가 커밋/대상과 일치. unit의 git 읽기를 위해 해당 커밋의 기존 object **2,053개**만 독립 `.git`에 복사하고 index 구성; 새 commit/checkout 없음. 의존성도 대상의 독립 node_modules에서 복사했다. [출처](evidence/archive-provenance.json).
- 모든 빌드·브라우저 실행 직렬, Node v22.17.1/4GiB heap. preview **4350 `--strictPort`**, QR fixture proxy **4351** strict. 임시 파일/npm cache도 이번 디렉터리 안이다. 실제 HTTP JS/CSS **75자산**을 당시 archive dist bytes와 대조했다. [production](evidence/provenance-production.json), [QA](evidence/provenance-qa.json).
- 원본 `ui-review.mjs`·`layout-review.mjs`·`user-review.mjs`·S1 두 probe는 **무수정** 재실행했다. [읽기 전용 bind 래퍼](probes/original.py)는 current `main/`과 새 `evidence/`만 논리 경로에 연결한다. 과거 보고서 JSON에 남는 경로 이름은 새 실행의 논리 경로이며 산출물은 이번 디렉터리에 있다. 별도 호환 프로브는 **다른 이름의 파생 파일**이고 원본 실패 로그를 보존했다. [수정 범위/SHA](evidence/compatible-probe-provenance.json).
- 공통 규칙 선독 외 원 워킹트리, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl` 접근 없음. 사용자 3파일은 `/tmp/worklazy-userfiles`에서 읽기만 했다. 원문이 포함된 결과/캡처는 `evidence/private/`에 둔다.

## 잔여 수정 지시: S2-R04 — P2, 모바일 초점 가림

**정상 제품 입력으로 도달한다.** 한국어 light/dark, **390×844**, 사용자 두 Excel → 머리글 1행/B키 → 비교 → 중복 필터. 검색 입력에서 **Tab(결과 region) → Tab(왼쪽 보기) → Enter → Tab(첫 전체 값)**. Enter로 모달을 열고 Escape로 닫아도 같은 버튼에 초점이 돌아오며 가림이 남는다. Worker 결과 주입·파일 변조 없이 실행했다.

[브라우저 재현](probes/overlap-review.mjs), [전 단계 좌표·hit test](evidence/overlap-review.json), [실패 단언](evidence/focus-contract.log), [실패 상세](evidence/focus-contract-failures.json), [ko light 직접 연 캡처](evidence/private/overlap-ko-light-current-2.png), [ko dark](evidence/private/overlap-ko-dark-current-2.png), [en 오른쪽 초점](evidence/private/overlap-en-light-current-5.png).

| 실측 | 결과 |
|---|---|
| ko light/dark 전체 값 버튼 | x=38, y=792.5, **68.5625×44px** |
| 고정 하단 탭 | y=773~835 |
| 버튼의 가려진 높이 | **42.5/44px (96.6%)**, 글자·중앙 클릭점은 하단 홈 탭에 가림 |
| Tab 직후 / 모달 Escape 복귀 | 같은 가림 2테마 모두 재현 |
| en light/dark 오른쪽 전체 값 버튼 | x=328.969, 폭=85.922px, 결과 region 오른쪽 경계 약360px → 라벨/초점 테두리 일부 잘림 |
| 독립 matrix의 focus+scrollIntoView | 사용자 1/B 모바일 4프로필에서 좌우 두 전체 값 버튼의 중앙이 하단 탭에 가림 |

**과장하지 않는 판정:** 데이터/다운로드 손실은 없고 Enter로 모달은 열린다. 수동 스크롤로 복구 가능하지만 키보드로 이동한 대상이 보이지 않으므로 P2이다. 9점 중 0점이 보였다는 값으로 버튼 전 픽셀 100%가 가려졌다고 주장하지 않는다(아래 약1.5px는 남음). 둥근 버튼 모서리 때문에 생기는 7/9 진단값도 결함으로 세지 않았다. 최종 실패 단언은 **중앙 hit test**를 사용하며 4프로필의 **20 focus 상태**가 실패했다(20개의 별개 결함이 아님).

**원인·귀속:** 표 1,040px와 열 최소 폭으로 값 셀 폭/행 높이가 달라졌지만, 결과 목록 초점 이동은 모바일 고정 상·하단 영역과 표의 가로 잘림을 보정하지 않는다. `ExcelComparePage.tsx`의 결과 region/`DuplicateSideList`/`DuplicateValue`와 변경 없는 `AppShell`·공용 CSS의 고정 chrome 경계가 만나는 문제다. 현재 duplicate DOM의 **열 클래스만 수리 전 그대로 복원한 대조 실험**에서는 ko의 이 하단 가림이 사라졌다. 이것은 이전 커밋 전체 실행을 대신하는 주장이 아니라 레이아웃 인과 대조다. 옆열 일부 가림은 복원 실험에도 있어 전부 fix-1이 새로 만든 회귀라고 주장하지 않는다. 현재 명시 계약의 키보드·하단 겹침 검사는 실패한다.

**수정 지시 문안:**

> Excel 결과 region 안의 펼침·추가 로딩·전체 값 버튼에 키보드 초점이 들어갈 때, 대상의 읽을 수 있는 영역과 초점 표시가 이름 있는 가로 스크롤 region 안에 드러나고 모바일 고정 헤더/하단 탭 위의 유효 뷰포트 안에 오도록 조정하라. 모달 Escape의 초점 복귀도 포함한다. 이미 완전히 보이는 대상은 불필요하게 움직이지 않는다. 1,040px를 단순 되돌려 세로 낙하를 재도입하거나 문서 전체를 가로로 늘리는 수리는 금지한다. 상태·판정 한 줄, 좌우 독립/lazy 50/50, 44px, 전체 원문을 보존한다. 정상 긴 값 fixture와 사용자 1/B·4/A를 ko/en light/dark 390px에서 실제 Tab·Shift+Tab·Enter·Escape로 검증하고, 중앙 및 텍스트/초점 표시의 가림과 region 경계 초과가 0임을 좌표·캡처로 단언하라. 공용 U4 트리를 고치지 말고 허용된 Excel 표면에서 해결하되 공용 변경이 필요하면 별도 범위로 보고하라.

재현 명령(현재 QA 빌드/4350): `python3 ../probes/check.py focus-repro node ../probes/overlap-review.mjs` → 측정 JSON. 이어 `python3 ../probes/check.py focus-contract python3 ../probes/focus-contract.py` → **exit 1, 20 keyboard focus states have the control center obscured**. 저장소는 불변이다.

## 지시서 항목별 판정

| 항목 | 판정 | 재현 명령·출력/증거 | 수정 지시 문안 |
|---|---|---|---|
| A1 화면 전체 내부 키, 필터 전후 | 통과 | 원본 typedCollision 접두사0/0. 독립 정상 XLSX(숫자1×2·문자1×2 양측, 2/Unique/Same/Gone/New) ko/en의 모든 status 필터와 검색 후 **body.innerText 전체** 접두사0. [독립 UI](evidence/independent-ui.json), 렌더 `.txt` | 없음 |
| A2 사용자 최초500행 | 통과 | 3조합 각각 **500행·3,500 td**, 노출0. 필터별 전체 body/셀 재측정도0. [사용자 전수](evidence/private/user-text.json) | 없음 |
| A3 원본 복원·secondary 열 순서 | 통과 | `compareEngine.ts:160,172,183,480`: `displayKeyForRows`가 좌측 원본 행(없으면 우측)에서 `cellText(getCell(...))`로 join. 접두사 제거/역파싱 없음. 비대칭/순서중복 열까지 [독립 engine 245대조](evidence/engine-review.json) | 없음 |
| A4 숫자/문자1 identity·펼침 | 통과 | 내부 `number:1`/`string:1` 두 그룹, displayKey 둘다1. 각 측2건, 한 그룹만 펴도 다른그룹 DOM0. 복합 표시 충돌·다른 쌍 같은키도 원본 probe 통과 | 없음 |
| A5 판정·순서·보고서 | 통과 | 수정 전 ebba engine과 **245조합 전체 결과**가 새 일반 displayKey만 제외하고 동일. 실제 다운로드 XML에서 **9시트·7개 detail 시트의 13열 이름/순서**, Key 공개값 일치. [보고서 Key](evidence/report-key-review.json) | 없음 |
| A6 전체 검색 | 통과 | source `recordSearchText`가 displayKey와 중복 전체 값·행번호 포함. 원본 probe: 닫힌51번째/미표시501번째 그룹/원본602행/displayKey 검색, 목록DOM0 유지 | 없음 |
| B7 원본 layout probe | 통과 | 무수정4화면×3상태: 상태/판정 모두1줄. [원본 결과](evidence/layout-review.json) | 없음 |
| B8 72상태 줄 수 | 통과 | 독립24화면×3상태: 모두1줄, 상태≥96·판정≥112·키≥128. [matrix](evidence/layout-independent.json) | 없음 |
| B9 모바일 부작용·키보드·44px | **가림 실패** | 문서 가로 넘침0, region Tab1회/ArrowRight40px/양끝55·710px, 버튼 최소높이44·폭68.563. 하지만 실제 Tab·Escape 초점 가림 재현 | **S2-R04** |
| B10 독립목록/lazy/50/모달 | 기능 통과 | 원본 probe 초기0, 50/0→51/50→0/50→재개방50/50→오른쪽100→101. 네 배열·모달원문 유지. 초점 반환의 가시성만 R04 | R04 가시성 |
| B11 사용자 좌우 한 행 | 배치/읽기 통과 | [1/B](evidence/private/user-h1-c2-side-by-side.png), [4/A](evidence/private/user-h4-c1-side-by-side.png) 직접 열어 확인, 양측cell y동일. 상태/판정 낙하 없음 | R04 모바일 이동 |
| C12 기준선16·직접 열기·범위 | 수리 통과 | **16/16 일치**, 갱신10장 모두 직접 열어 비교. 기존173장 bytes불변(Excel의 나머지6장 포함). [파일별 판정](evidence/baseline-manual-review.json) | R04 통과 후 결과 상태 재확인 |
| D13 160/근거/정본불변 | 통과(밀도 설명 한정) | 160 유지 근거가 review-notes에 있음. 159/160 원문/버튼0,161 preview+버튼1. 8프로필 무손실·이모지/결합문자/CRLF/공백·Escape·초점객체복귀. source에 높이 clamp없음. 정본 S0/S2 SHA같음 | 아래 근거 한정 참조 |
| E14 S1/S2·선행 안전화 | 통과 | S1 원본4/8+첫deepEqual실패는 새 displayKey 필드 충돌. 필드만 허용한 파생 프로브 **8/8+supplement통과**, 전체 engine대조245. unit381의 writer/backstop/희소/Row·Column numFmt/DataRows 회귀도 실행 | 기존 probe 기대 스키마 갱신 필요, 제품수리 아님 |
| E15 사용자1·6·0그룹 | 통과 | 아래 표·실다운로드. 비교 밖 원본파일 사용 없음 | 없음 |
| E16 접근성 보류 수동판정 | 신규 텍스트 통과 / 초점 가시성 실패 | 공식16페이지 violations0, incomplete1265 누락0. 신규14+별도608텍스트 대비통과. 공용533gradient·3ARIA 보류는 통과로 세지 않음. 상세 아래 | **R04**, 공용 기존부채 분리 |
| E17 범위/SEO/스택 | 통과 | fix19파일, 신규의존/서버/광고예외/생성물수기0. 실제 HTML105/canonical62/hreflang91/sitemap61 집합 S0와 동일 | 없음 |
| E18 공통 명령 | 필수 회귀 통과 / 별도 focus 계약 실패 | 아래 모든 명령·exit·원출력. production Excel/Cleaner 재실행 성공 | **R04** |

## 레이아웃·스크롤 수치

각 profile의 9상태는 합성 fixture·사용자1/B·사용자4/A × 접힘/좌측/양측이다. 모바일390×844, desktop1365×900.

| 언어/테마/뷰포트 | 측정 상태 | 상태/판정 줄 | 문서 가로 넘침 | region 최대 scrollLeft |
|---|---:|---:|---:|---:|
| ko/light/desktop | 9 | 1 / 1 | 0 | 55px |
| ko/light/mobile | 9 | 1 / 1 | 0 | 710px |
| ko/dark/desktop | 9 | 1 / 1 | 0 | 55px |
| ko/dark/mobile | 9 | 1 / 1 | 0 | 710px |
| en/light/desktop | 9 | 1 / 1 | 0 | 55px |
| en/light/mobile | 9 | 1 / 1 | 0 | 710px |
| en/dark/desktop | 9 | 1 / 1 | 0 | 55px |
| en/dark/mobile | 9 | 1 / 1 | 0 | 710px |

표는 1,040px. border 포함 region 폭은 desktop987/mobile332px, 실제 scroll clientWidth는985/330px다. **가로 스크롤은 실제로 필요**하며 “강제되지 않는다”로 보고하지 않는다. 수리 전부터 최소920px였고 정본이 허용한 표 내부 스크롤이다. 문제는 문서 밖 밀림이 아니라 별도 R04의 초점 가시성이다. 모달/검색/다운로드/안내의 가로 경계는 화면 안이고, 최소 타깃은44px다.

## 사용자 파일·보고서

| 머리글/키 | duplicate | matched | changed | added | 최초500행 내부키셀 |
|---|---:|---:|---:|---:|---:|
| 1/B | 1 | 713 | 37 | 48 | **0 (이전499)** |
| 4/A | 6 | 486 | 134 | 31 | **0 (이전494)** |
| 4/B | 0 | 703 | 37 | 48 | **0 (이전500)** |

각 조건의 initial/duplicate/matched/changed/added/removed 전체 렌더 텍스트를 private에 보존했다. 4/A 첫 그룹 원본은 좌5·73행, 우5·79행으로 순서/측 독립 유지. XML 독립 파서는 실제 다운로드·ZIP·경계 산출물 **31 XLSX / 558 XML·rels**를 재개방했다. ZIP2항목은 개별2보고서와 bytes동일, 9시트/13열, 전체문자≤32767·목록≤16000, 폭12~48 및 수식객체 없음. [XML검증](evidence/xml-review.json).

## 시각 기준선 파일별 직접 판정

ko desktop light/dark의 **수리 전** 파일도 직접 열었다. `중/복/키` 세로 낙하가 현재는 `중복키` 한 줄로 바뀌었다. mobile 결과 캡처는 focus로 왼쪽 값에 가로 이동한 상태이므로 양측·상태 전체 가시성 증거로 확대하지 않았다. R04는 이 짧은 합성 시각 fixture로 검출되지 않는다.

| 파일 | 변경 사유 | 판정 |
|---|---|---|
| `excel-compare-empty__bottom__en__light__mobile.png` | 중복 FAQ 1항목 추가에 따른 기존 bottom 이동 | 직접 열어 확인 |
| `excel-compare-empty__bottom__ko__dark__mobile.png` | 중복 FAQ 1항목 추가에 따른 기존 bottom 이동 | 직접 열어 확인 |
| `excel-compare-empty__interaction-duplicate-result__en__dark__desktop.png` | 짧은 열의 폭·nowrap 수리, 값 셀 안 줄바꿈 | 직접 열어 확인 |
| `excel-compare-empty__interaction-duplicate-result__en__dark__mobile.png` | 짧은 열의 폭·nowrap 수리, 값 셀 안 줄바꿈 | 직접 열어 확인 |
| `excel-compare-empty__interaction-duplicate-result__en__light__desktop.png` | 짧은 열의 폭·nowrap 수리, 값 셀 안 줄바꿈 | 직접 열어 확인 |
| `excel-compare-empty__interaction-duplicate-result__en__light__mobile.png` | 짧은 열의 폭·nowrap 수리, 값 셀 안 줄바꿈 | 직접 열어 확인 |
| `excel-compare-empty__interaction-duplicate-result__ko__dark__desktop.png` | 짧은 열의 폭·nowrap 수리, 값 셀 안 줄바꿈 | 직접 열어 확인 |
| `excel-compare-empty__interaction-duplicate-result__ko__dark__mobile.png` | 짧은 열의 폭·nowrap 수리, 값 셀 안 줄바꿈 | 직접 열어 확인 |
| `excel-compare-empty__interaction-duplicate-result__ko__light__desktop.png` | 짧은 열의 폭·nowrap 수리, 값 셀 안 줄바꿈 | 직접 열어 확인 |
| `excel-compare-empty__interaction-duplicate-result__ko__light__mobile.png` | 짧은 열의 폭·nowrap 수리, 값 셀 안 줄바꿈 | 직접 열어 확인 |

FAQ bottom 두 장은 질문3개→4개(중복키 질문 추가)에 따른 정상 이동이다. 기존 한국어 “보고서와 개인정보” 설명의 긴 시트명 나열 잘림은 수리 전/후에 같은 공용 guide 배치로 존재하며 이번 표 폭 수정의 회귀가 아니다. 기준선 전체가 모든 기존 UI 부채까지 정상이라는 의미로 승인하지 않는다.

## N01·접근성 판정의 한계

160은 **고정 code point 미리보기 정책**으로 유지됐다. `docs/review-notes.md:18`에 DOM 측정시점/뷰포트에 따른 trigger 변동을 피한다는 선택 근거가 있고 정본은 수정되지 않았다. 160이하 값에 modal을 만들지 않고 원문을 wrap하며, 초과하면 명시적 ellipsis+전체값을 제공한다. 159/160/161 경계와 무손실 동작은8프로필 통과했다. 다만 기록의 “두세 줄”은 모든 언어/폭의 실측 보장이 아니다(긴 한글은 더 많은 줄). 동작상 누락/불필요 modal 결함으로 세지 않되 그 설명을 보편적 줄 수 보장으로 인용하지 말 것. **초점 객체 복귀는 통과, 보이는 복귀는 R04 실패**로 분리한다.

공식 `A11Y_MAX_TOTAL=0`은16페이지·위반0·외부요청0이다. selector **1,265개**를 별도 재방문해 누락0. [수동분류](evidence/incomplete-disposition.json): 단색 대비 판정 **729통과**, 공용 기여 gradient **533보류**, 공용 `aria-prohibited-attr` **3건 미충족**(tools category2·HWP host1). 보류를 통과로 세지 않는다. sol의 “171미달”은 **153 node의171텍스트 단색 근사 후보**이며 gradient를 제거한 확정비율로 확대하지 않는다. 그 selector집합은 이전 보존 측정과 동일하다.

S2소유 공식14노드의 대비 최저12.7995:1·실패0. 별도 결과/모달 **608텍스트**는 기여 이미지0, 최저 light5.27295/dark5.73290:1·미달0. 필터를 duplicate만 선택하면 공용 미선택7버튼의 대비 부족이 기존처럼 light4프로필×목록/모달 **56 node instances**로 재현된다. 해당 공용상속 부채도 공식0 위반 수치로 덮지 않는다. 모달의 focus-guard 보류는 두 frame 안정 후 **144/144 내부**, Escape trigger객체복귀8/8. 실제 NVDA/VoiceOver 음성 출력 검증을 했다는 주장은 아니다. R04는 새 결과 컨트롤의 키보드 가시성 결함으로 별도 실패 판정했다.

## 번들·main/U4 통합 표면

S0 기준선 SHA **726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8** 그대로, production·19routes·multiplier1·override없음. [실측](evidence/bundle.json).

| gzip bytes | 현재 | S0 증분 | 증가 한도 | 잔여 |
|---|---:|---:|---:|---:|
| Entry JS | 300,692 | +1,404 | 20,480 | **19,076** |
| Affected routes JS | 2,453,104 | +1,523 | 61,440 | **59,917** |
| Shared JS | 2,715,918 | +1,410 | 30,720 | **29,310** |
| App JS | 5,469,714 | +4,337 | 81,920 | **77,583** |
| CSS | 37,839 | +146 | 10,240 | **10,094** |

`main 597a92ff56ed9c3eb23755a58df2580b0269b8bd`는 대상의 **실제 조상**이다. 고정 main 대비 S1+S2 변경31파일, 따라서 그 고정main만 기준으로는 분기 충돌이 없다. 현재 원 트리/U4 미커밋 변경은 금지되어 읽지 않았으므로 실제 통합 clean을 주장하지 않는다. [전체 경로](evidence/scope.json).

| 표면 | 고정main→S1+S2 | U4와의 통합 주의 |
|---|---|---|
| ExcelComparePage/engine/duplicateReport/report/types·Excel tests | Excel 전용 전환 | PDF feature 직접교집합0 |
| `src/app/seo.ts`, ko/en `features.json`·`tools.json` | Excel 설명/FAQ | U4의 PDF route/안내 변경과 **파일공유**, 서로의 키/URL 보존 필요 |
| `tests/accessibility-audit.mjs`·관련unit·`tests/visual-regression.scenarios.mjs`·visual config unit | Excel 결과8프로필 등록 | U4 PDF등록/시각시나리오와 **파일공유**, 양쪽목록 보존 |
| `CHANGELOG.md`·`docs/review-notes.md` | Excel기록 | 동시prepend/내용 취합 표면 |
| writer/backstop/DataRows·package/lock | **S0 및 fix 부모와 bytes보존** | 선행안전화·공용의존 보존, 덮어쓰기 금지 |
| `browser-smoke.mjs`·AppShell/global.css | 이 브랜치변경0, 스모크전체 실행 | R04 수리에 공용surface 확대하면 U4등 재충돌검사 필요 |

## 실제 실행 명령과 실패 처리

기본 cwd=`/tmp/worklazy-xd-s2-review2/main`, `python3 ../probes/check.py <name> <command...>`. [래퍼](probes/check.py), [모든명령/exit/시간](evidence/checks.jsonl).

원본 S1실패는 새 displayKey 금지 기대와 충돌한 것이며 삭제/통과로 바꾸지 않았다. 파생 probe는 그 필드차이만 허용해8/8+supplement를 확인했다. 초기 Excel/Cleaner smoke는 내가 **QA build에 production 광고존재 단언을 실행한 환경오류**(`ads:false`)였다. production 재빌드후 같은 무수정명령이 통과했다. 초기 layout 실패는 실제 중앙가림이고, 후속 fullmatrix는 결함을 숨기지 않도록 좌표를 전부 모으는 측정으로 실행했다. 마지막 별도 focus계약은 여전히 **exit1**이다. `python` alias없는 setup 첫호출은 시작전에127로 끝났고 `python3`로 실행했다.

| 명령 | exit / 시간 | 원출력 |
|---|---|---|
| `tsc`: `./node_modules/.bin/tsc -b --pretty false` | **0** / 16.761s | [tsc.log](evidence/tsc.log) |
| `unit`: `npm run test:unit` | **0** / 3.793s | [unit.log](evidence/unit.log) |
| `build-production`: `npm run build` | **0** / 98.507s | [build-production.log](evidence/build-production.log) |
| `static`: `npm run test:static` | **0** / 0.806s | [static.log](evidence/static.log) |
| `provenance-production`: `python3 ../probes/provenance.py production` | **0** / 0.236s | [provenance-production.log](evidence/provenance-production.log) |
| `s1-independent-original`: `python3 ../probes/original.py node --experimental-strip-types --expose-gc /tmp/worklazy-xd-s1-review/probes/independent.mjs` | **1** / 8.973s | [s1-independent-original.log](evidence/s1-independent-original.log) |
| `s1-supplement-original`: `python3 ../probes/original.py node --experimental-strip-types /tmp/worklazy-xd-s1-review/probes/supplement.mjs` | **1** / 0.599s | [s1-supplement-original.log](evidence/s1-supplement-original.log) |
| `build-qa`: `env VITE_LOCAL_QA=1 npm run build` | **0** / 88.741s | [build-qa.log](evidence/build-qa.log) |
| `provenance-qa`: `python3 ../probes/provenance.py qa` | **0** / 0.215s | [provenance-qa.log](evidence/provenance-qa.log) |
| `scope`: `python3 ../probes/scope.py` | **0** / 0.985s | [scope.log](evidence/scope.log) |
| `engine-review`: `node --experimental-strip-types ../probes/engine-review.mjs` | **0** / 2.218s | [engine-review.log](evidence/engine-review.log) |
| `s1-compatible`: `node --experimental-strip-types --expose-gc ../probes/compatible-independent.mjs` | **0** / 10.707s | [s1-compatible.log](evidence/s1-compatible.log) |
| `s1-supplement-compatible`: `node --experimental-strip-types ../probes/compatible-supplement.mjs` | **0** / 0.863s | [s1-supplement-compatible.log](evidence/s1-supplement-compatible.log) |
| `ui-original`: `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review/probes/ui-review.mjs` | **0** / 20.571s | [ui-original.log](evidence/ui-original.log) |
| `layout-original`: `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review/probes/layout-review.mjs` | **0** / 13.428s | [layout-original.log](evidence/layout-original.log) |
| `user-original`: `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review/probes/user-review.mjs` | **0** / 15.796s | [user-original.log](evidence/user-original.log) |
| `ui-independent`: `node ../probes/independent-ui.mjs` | **0** / 17.486s | [ui-independent.log](evidence/ui-independent.log) |
| `layout-independent`: `node ../probes/layout-independent.mjs` | **1** / 27.092s | [layout-independent.log](evidence/layout-independent.log) |
| `smoke-compare`: `npm run test:excel-compare` | **1** / 2.006s | [smoke-compare.log](evidence/smoke-compare.log) |
| `smoke-cleaner`: `npm run test:excel-cleaner` | **1** / 1.886s | [smoke-cleaner.log](evidence/smoke-cleaner.log) |
| `xml-review`: `python3 ../probes/xml-review.py` | **0** / 0.323s | [xml-review.log](evidence/xml-review.log) |
| `css`: `npm run css:orphans` | **0** / 0.597s | [css.log](evidence/css.log) |
| `routes`: `node tests/tool-registry-routes.mjs` | **0** / 0.507s | [routes.log](evidence/routes.log) |
| `diff-check`: `git diff --check` | **0** / 0.068s | [diff-check.log](evidence/diff-check.log) |
| `smoke-qr`: `env 'NODE_OPTIONS=--max-old-space-size=4096 --import /tmp/worklazy-excel-s0/probes/strict-test-port.mjs' npm run test:qr-bulk` | **0** / 49.342s | [smoke-qr.log](evidence/smoke-qr.log) |
| `smoke-browser`: `npm run test:browser` | **0** / 50.324s | [smoke-browser.log](evidence/smoke-browser.log) |
| `visual`: `env VISUAL_ONLY=excel-compare VISUAL_ARTIFACT_DIR=/tmp/worklazy-xd-s2-review2/evidence/visual npm run test:visual` | **0** / 43.624s | [visual.log](evidence/visual.log) |
| `report-keys`: `python3 ../probes/report-key-review.py` | **0** / 0.046s | [report-keys.log](evidence/report-keys.log) |
| `a11y`: `env A11Y_MAX_TOTAL=0 A11Y_REPORT_PATH=/tmp/worklazy-xd-s2-review2/evidence/a11y.json npm run test:a11y` | **0** / 60.135s | [a11y.log](evidence/a11y.log) |
| `a11y-manual`: `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review/probes/a11y-review.mjs` | **0** / 62.916s | [a11y-manual.log](evidence/a11y-manual.log) |
| `a11y-incomplete-manual`: `python3 ../probes/original.py node /tmp/worklazy-xd-s2-review/probes/official-incomplete.mjs` | **0** / 33.501s | [a11y-incomplete-manual.log](evidence/a11y-incomplete-manual.log) |
| `a11y-adjudication`: `python3 ../probes/a11y-adjudicate.py` | **0** / 0.163s | [a11y-adjudication.log](evidence/a11y-adjudication.log) |
| `layout-independent-final`: `node ../probes/layout-independent.mjs` | **0** / 126.812s | [layout-independent-final.log](evidence/layout-independent-final.log) |
| `user-text`: `node ../probes/user-text.mjs` | **0** / 59.013s | [user-text.log](evidence/user-text.log) |
| `build-production-final`: `npm run build` | **0** / 91.623s | [build-production-final.log](evidence/build-production-final.log) |
| `static-final`: `npm run test:static` | **0** / 0.877s | [static-final.log](evidence/static-final.log) |
| `focus-contract`: `python3 ../probes/focus-contract.py` | **1** / 0.123s | [focus-contract.log](evidence/focus-contract.log) |
| `smoke-compare-production`: `npm run test:excel-compare` | **0** / 41.365s | [smoke-compare-production.log](evidence/smoke-compare-production.log) |
| `smoke-cleaner-production`: `npm run test:excel-cleaner` | **0** / 55.031s | [smoke-cleaner-production.log](evidence/smoke-cleaner-production.log) |
| `bundle`: `env BUNDLE_BASELINE=/tmp/worklazy-excel-s0/evidence/bundle-baseline.json BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-xd-s2-review2/evidence/bundle.json npm run bundle:measure` | **0** / 76.175s | [bundle.log](evidence/bundle.log) |
| `final-state`: `python3 ../probes/final-state.py` | **0** / 2.744s | [final-state.log](evidence/final-state.log) |

## 불변 증명·다음 단계

시작·종료 대상 HEAD/브랜치 동일, 대상·archive status 모두 빈 문자열. **양쪽 추적 2,408파일의 SHA 모두 동일**, 사용자 사본/원본 probe/계획 보존본 및 S0 baseline 불변. archive 재생성 스트림 SHA도 동일하다. 종료 4350~4359 listener 0. [시작](evidence/state-start.json), [종료](evidence/state-finish.json), [요약](evidence/invariance.json). 보고서는 저장소 밖에 저장했으므로 CHANGELOG/review-notes 추적 파일은 수정하지 않았다.

**S3 착수 조건:** Claude가 S2-R04의 수정 범위를 정본화하고 수리 커밋의 재검수를 통과시킨 뒤, 그 SHA를 기준으로 S3 단일 지시서를 발행할 것. 기존 R01 표시 범위/N01 정책은 fix-1 지시서에서 이미 정리됐다. 이번 작업에서 S3는 착수하지 않았다.

**S1+S2 병합·배포 후보:** **현재는 아니다.** 표시/그룹/보고서 전환과 필수 회귀는 통과했지만 R04가 남았다. 수리 후 S1+S2를 한 전환 단위로 병합 후보 판정한다. 실제 배포는 정본 S4 통합·Gemini 직접 시각 검수·배포 게이트가 별도로 필요하며 이번 검수 로그로 대체하지 않는다.

**[수정 후 재검수]**
