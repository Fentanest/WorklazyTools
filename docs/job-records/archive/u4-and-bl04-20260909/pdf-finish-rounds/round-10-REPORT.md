U4 PDF 마무리 v11 — Codex astra 10차 반박 (Codx, 2026-09-07)

**판정: 잔여 이견 1건(D4: 지원 문법과 사전 검사의 적용 범위) · [재왕복 필요]. Claude–Codex 간 이견 0 아님.**

9차에서 문제였던 **OCMD 원시 표현 규칙 자체는 이번 지정 표본에서 해소**됐다. 174입력을 v11로 재분류한 결과는 **허용 84·제외 90**이다. 지정 manifest는 **허용 4·제외 10**, 직접 배열 회귀는 **32/32 허용**이며, 허용 집합 전체 **88개(기존 4+탐색 84)**를 새로 변환하고 Poppler·실제 Chrome PDF.js에서 각각 **원본/결과 전체 RGBA SHA 동일**을 확인했다. 32회귀는 84 안에 포함되므로 중복 합산하지 않는다.

그러나 아직 정본화할 수 없다. **OFF 블록 종료 시 미완료 clipping을 놓치는 입력**은 현재 6조건과 **깊은 OC 잔여 0**을 모두 통과해도 Poppler가 **6,400픽셀** 바뀐다. 주석·패턴 등의 OC 처리 위치도 사전 검사에 빠져 있으며, 후보 코드와 v11 문안 사이에는 **빈 registry와 catalog 없는 orphan OCMD의 적용 범위**가 남는다. 아래에서는 문안 결정이 필요한 부분과 단순 prototype 결함을 구분한다. 이를 반례 개수만큼 늘리지 않고 D4 한 건으로 취합했다.

| 요청 항목 | 판정 | 실제 명령·출력 근거 |
|---|---|---|
| OCMD `/VE` 없음·P 생략/네 정책 | **[동의]** | E10-1/2/8. P를 해독한 Name으로 판정. 직접 배열의 네 정책을 일괄 금지할 근거 없음 |
| `/OCGs` 원시 규칙 ① 직접 배열 | **[동의]** | 직접 배열 32회귀 허용, 두 renderer SHA 동일; 중복 ref 추가 66입력도 각각 동일 |
| ② 단일 ref+AnyOn/AllOn, ③ 간접 배열 제외 | **[동의]** | 기존 단일 음수 정책·간접 배열 반례 모두 사전 제외, 변환 시도 0 |
| ④ 누락/빈 배열/직접 dict/중첩 OCMD/잘못된 P | **[동의 — catalog가 있는 지정 입력]** | 174 재분류와 기존 후보가 일치. **catalog 없는 orphan까지 적용할지는 아래 문안 차이** |
| ⑤ Form 자체 OCMD | **[동의 — 지원된 호출 문맥]** | marked/Form 직접 배열 진리표 32 및 기존 허용 Form 동일. Form 내부 OC는 기존 제외 유지 |
| catalog 등록 검증·BaseState→ON→OFF | **[동의 — 기본 규칙]** | 등록 밖 ref 제외, Unchanged/누락 D 제외, 생략 ON 및 OFF 최종 우선 재현. 빈 집합 단독은 아래 경계 결정 필요 |
| manifest 4/10 + 직접 배열 32 | **[동의·해소]** | E10-1/2/8. 14행 모두 기대와 일치, 생성기 36개(새 제외 대표 4+회귀 32) 두 번 생성해 이전 SHA까지 동일 |
| 새 입력 탐색·sol의 지원 범위 재해석 | **[이견 1: D4]** | E10-3~8/10~11. clipping 출구·OFF Do의 text 진입 문맥·Annotation/비페이지 OC의 지원 경계, 코드와 문안의 적용 범위 정리 필요 |

첫 명령은 `cat PROJECT_RULES.md`였다. AGENTS·지정 dispatch 전문·PDF 계획 전문(최신 v11 우선)·roadmap §2/§3 S3/결정 10·11·3~9차 REPORT와 관련 review-notes를 읽었다. 큰 출력의 절단 부분은 구간을 나누어 보충했다. 열린 계획 16개를 검색한 원문은 `logs/open-plans-scan.txt`다. 현재 S2b의 QR 선택 자산/fallback과 U4 전체 OTF 유지·공용 import 계약은 정합한다. 최신 사용자 지시가 이번 읽기/실험의 권한이며, 정본이 없는 제품 구현을 시작하지 않았다.

시작 상태는 다음과 같다. `main`만 기준으로 대조했고 브랜치를 전환하지 않았다.

```text
HEAD   249e1727b44fa84ca8635741e1214cc1a9902591
main   f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e
branch s2b-qr-font
$ git diff main -- src/features/pdf-editor
(출력 없음, exit 0)
$ git status --short --branch
## s2b-qr-font
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

모든 새 스크립트·fixture·PNG·Chrome 프로필·보고서는 `/tmp/worklazy-u4-r10/`에만 작성했다. 저장소/계획서/사용자 파일/기존 r3~r9 산출물 수정, 설치, commit/push, dist 변경, 브랜치 전환, 제품 build/prebuild는 하지 않았다. 서브에이전트 호출도 없었다. 미구현 U4의 npm build/unit/browser/static/C-D 9게이트를 완료했다고 주장하지 않는다. 저장소 기록 금지에 따라 CHANGELOG/review-notes 대신 이 보고서에 결과를 남긴다.

재현 명령은 아래와 같다. cwd는 저장소 루트이고 모든 출력 경로는 `/tmp/worklazy-u4-r10/` 기준이다. 실험·증거 검산 명령은 실제 실행해 **exit 0**이었다. E10-12의 최종 전체 불변 검사는 동시 S2b 커밋으로 **exit 1**이며, PDF/main 범위 검사는 E10-13에서 별도로 exit 0을 확인했다. 예상 실패/반례가 재현된 것도 assertion의 성공에 포함되므로 exit 0을 모든 입력의 지원 성공으로 해석하지 않는다.

| ID | 명령 | 출력·범위 |
|---|---|---|
| E10-1 | `node /tmp/worklazy-u4-r10/probes/baseline.mjs` | `baseline.json`, `logs/baseline.log`: 184파일 원본 SHA 대조·174 재분류·허용 88 변환/Poppler·36개 생성 결정성 |
| E10-2 | `node /tmp/worklazy-u4-r10/probes/browser.mjs baseline` | `baseline-pdfjs.json`, `logs/baseline-pdfjs.log`: 허용 88 전부 Chrome PDF.js 새 렌더 |
| E10-3 | `node /tmp/worklazy-u4-r10/probes/exploration.mjs` 및 `node /tmp/worklazy-u4-r10/probes/browser.mjs exploration` | `exploration*.json`, `logs/exploration*.log`: 지정 탐색 축 및 원시 타입 156입력 |
| E10-4 | `node /tmp/worklazy-u4-r10/probes/supplement.mjs` 및 `node /tmp/worklazy-u4-r10/probes/browser.mjs supplement` | `supplement*.json`, 대응 logs: clip/Do 문맥/escaped tag 13입력 |
| E10-5 | `node /tmp/worklazy-u4-r10/probes/grammar-boundaries.mjs` 및 `node /tmp/worklazy-u4-r10/probes/browser.mjs grammar` | `grammar*.json`, 대응 logs: 빈 registry·catalog 없는 OCMD 경계 2입력 |
| E10-6 | `node /tmp/worklazy-u4-r10/probes/compare-wording.mjs` | `wording.json`, `logs/wording.log`: 후보와 독립 literal 해석을 184+2입력에 실제 대조 |
| E10-7 | `node /tmp/worklazy-u4-r10/probes/repeat.mjs` 및 `node /tmp/worklazy-u4-r10/probes/browser.mjs repeat` | `repeat*.json`, 대응 logs: 대표 반례 6개를 별도 Poppler/Chrome 실행에서 재현 |
| E10-8 | `node /tmp/worklazy-u4-r10/probes/final-assertions.mjs` | `final-assertions.json`, `logs/final-assertions.log`: 실제 PDF/PNG 재독·SHA·차이 픽셀 수·깊은 OC 잔여·반복 비교 |
| E10-9 | `python3 /tmp/worklazy-u4-r10/probes/source-evidence.py` | `source-evidence.json`, `logs/source-evidence.log`: 환경·계획·설치 소스·git 15명령 모두 exit 0 |
| E10-10 | `node /tmp/worklazy-u4-r10/probes/proposed.mjs` 및 `node /tmp/worklazy-u4-r10/probes/browser.mjs proposed` | `proposed*.json`, 대응 logs: **미채택 보완 후보**, 허용 198 전부 두 renderer 동일 |
| E10-11 | `node /tmp/worklazy-u4-r10/probes/proposed-boundaries.mjs` | `proposed-boundaries.json`, 대응 log: 문안 경계 2개를 제외하는 후보 추가·앞선 353판정 불변 |
| E10-12 | `python3 /tmp/worklazy-u4-r10/probes/verify-unchanged.py` | **최종 exit 1**, 시작/종료 snapshot·git·`unchanged.json`, `logs/unchanged.log` |
| E10-13 | `python3 /tmp/worklazy-u4-r10/probes/scope-integrity.py` | **exit 0**, 동시 변경의 전후 SHA·커밋·실험 입력/PDF/main 불변; `scope-integrity.json`, 대응 log |

환경은 **Node v22.17.1 · pdf-lib 1.17.1 · PDF.js 6.2.108 · Poppler 24.02.0 · Chrome 152.0.7977.64 · puppeteer-core 25.6.0 · pngjs 7.0.0**이다. Poppler는 `pdftoppm -f <page> -l <page> -r 72 -png -singlefile <pdf> <prefix>`(기존 1페이지 baseline은 `-r 72 -png -singlefile`), PDF.js는 scale=1·흰 배경·ceil viewport 캔버스다. 상속 Resources의 2페이지 fixture는 **양쪽 renderer 모두 2페이지 전부** 검사했다. Chrome 외부 요청은 모든 실행에서 **0**이었다. 주소가 있는 Link fixture도 클릭하지 않았다. warning/404는 browser JSON의 console에 보존했다. 실 모바일 측정이 아니다.

**9차 candidate와 v11의 차이는 174표본에서는 없지만, 전체 문법 동치까지 증명되지는 않았다.**

`v11-guard.mjs`는 9차 candidate의 분류 로직을 복제하고 top-level 실행 부작용만 없앴다. classifier/변환은 r9를 복제했다. `/OCGs`에 한해서만 원시 배열/단일 참조/간접 배열을 구별하는 v11 계약은 그대로 구현되어 있다. `/P`는 일반 PDF 객체처럼 참조 해제한 뒤 Name 값으로 판정했다. `/P`·OCMD Type·OCG Type·BaseState를 간접 Name으로 바꾼 **8입력 모두 허용, 두 renderer 원본/결과 동일**이었다. v11이 **원시 형태**를 특별히 요구한 필드는 `/OCGs`이며, 다른 Name까지 직접 객체만 허용하도록 좁힐 실증 근거는 이번에 없었다. 이 부분은 새 이견으로 세지 않는다.

반면 다음 두 경계는 실제 분기가 난다. `v11-literal.mjs`는 **빈 집합도 유효한 참조 집합이며 OCMD 문법 검사는 모든 OCMD에 적용한다**는 문안 독해를 실행한 비교 함수다. Claude가 이미 그 해석을 선택했다고 주장하지 않는다.

| 입력 | r9 candidate | v11의 literal 독해 | 표시·변환 |
|---|---|---|---|
| `/OCProperties << /OCGs [] /D << /BaseState /ON /ON [] /OFF [] >> >>`, OC 사용처 없음 | **제외**: `!list.size()` | **허용**: 모든 원소가 유효하다는 집합 조건은 만족 | 두 renderer 각각 원본/무OC 결과 동일 |
| `/OCProperties` 없음, 사용되지 않는 indirect `<< /Type /OCMD /OCGs [] /P /AnyOn >>` 하나 | **허용**: OCMD 순회가 `if (oc)` 안에 있음 | **제외**: v11 ④의 빈 배열 OCMD | 역시 원본/무OC 결과 동일 |

이는 9차 `empty-catalog-OCGs`를 다시 살리자는 주장이 아니다. 그 기존 입력에는 등록 밖 `/OFF` ref와 실제 OC 사용처가 있으므로 **양쪽 독해 모두 제외**다. 새 경계는 실제 사용처/ON/OFF가 모두 빈 경우로 분리했다. E10-6의 출력은 **174 = 84/90, 기존 184에서 분류 차이 0, 위 2개에서만 차이 2**다. 따라서 지원 정책을 sol에게 재해석시키지 않으려면 빈 등록 집합의 허용 여부와 orphan 검사 적용 범위를 문장으로 고정해야 한다.

**기존 fixture와 허용 집합 전량 재검증은 통과했다.**

| 집합 | 허용 | 제외 | oracle |
|---|---:|---:|---|
| r6~r8 기존 10종 | 4 | 6 | 허용 4 두 renderer 동일 |
| v11 지정 추가 대표 4종 | 0 | 4 | 전부 변환 시도 0 |
| 따라서 U4-0 manifest 14종 | **4** | **10** | 기대 14/14 일치 |
| 9차 탐색 174종 | **84** | **90** | 허용 84 모두 새 변환·두 renderer 동일 |
| 직접 배열 회귀 32종(174 안의 부분집합) | **32** | **0** | 네 정책×네 상태×marked/Form 모두 동일 |

manifest의 허용은 `on`, `xobject-off`, `xobject-on`, `balanced-state`다. 기존 제외 6개와 추가 `marked-single-AllOff-1`, `extra-marked-indirect-AnyOn-00`, `extra-form-indirect-AnyOn-00`, `unlisted-off`는 모두 제외됐다. 원본 PDF SHA는 이전 JSON과 직접 비교했다. 예전 fixture에 q/Q를 덧붙여 기대를 맞추지 않았다. 새 대표 4와 회귀 32는 9차 생성기로 **각각 2회 생성, 두 번의 SHA 및 이전 SHA까지 동일**했다.

허용 88개는 save/reopen·페이지 수·전체 객체 깊은 검사에서 OC 관련 잔여 0이다. 흰 배경의 단순 사각형 baseline에서는 renderer 상호 SHA도 같지만, 계약의 핵심은 **각 renderer 안에서 원본=결과**라는 것이다. 새 이미지/패턴의 renderer 간 edge/안티앨리어싱 차이를 OC 가시성 차이로 오인하지 않았다.

**새 탐색 169입력의 결과는 다음과 같다.** 여기에 위 문안 경계 2입력을 별도로 더해 총 **171개 새 입력**을 생성했다. 모두 두 번 생성해 결정성을 확인했다. 아래 169입력은 SHA가 전부 다르다.

표의 “허용”은 **r9 prototype에 v11 candidate guard를 연결한 실행값**이다. escaped Form 두 개처럼 문안은 이미 제외하지만 탐지 코드가 놓친 경우가 포함되어 있으며, 이들을 v11이 의도적으로 허용했다고 주장하지 않는다. 출력의 진단을 위해 r10 `flatten()`은 최종 residual assertion 대신 **saved bytes+잔여 목록을 반환**하도록 바꾸었다. 변환 알고리즘은 그대로다. 잔여가 있는 결과는 런타임 계약상 제공 불가이며, 검사를 우회한 성공 결과로 집계하지 않았다.

| 탐색 축 | 입력 | 사전 허용/제외 | 실제 관측 |
|---|---:|---:|---|
| `/OCGs [A A]`, `[A A B]`·catalog/ON/OFF 중복 | 66 | 66/0 | 두 renderer 원본/결과 동일, 잔여 0. 중복 ref 일괄 제외 가설 기각 |
| 순환 참조 | 6 | 4/2 | OCG의 무시되는 추가 키를 통한 self/상호/OCMD 연결 4개는 동일. 실제 OCMD→자기/다른 OCMD membership 2개는 등록된 OCG ref 조건으로 제외; 무한 루프 없음 |
| 페이지 트리 Resources 상속·로컬 shadow | 10 | 8/2 | parent/grandparent/2페이지 공유/로컬 치환 8개 동일. 로컬 Resources가 있되 Target이 없으면 부모와 merge하지 않고 제외 |
| Image XObject 자체 `/OC` | 20 | 20/0 | OCG 및 직접 배열 네 정책, 네 상태 전부 각각 SHA 동일·잔여 0. 이미지 표시 지원을 이유 없이 전부 금지할 근거 없음 |
| Annotation `/OC` (Square/Link/Stamp/Widget) | 24 | 24/0 | **24개 모두 OC 잔여**, OFF 12개는 양쪽 6,400px 변화. 아래 별도 구분 |
| 패턴/셰이딩/소프트마스크 내부 OC | 14 | 14/0 | 12개 잔여. OFF tiling-marked/tiling-Form/SMask-Form 4개 양쪽 6,400px 변화. 페이지 OC 블록 안 정상 `sh` 2개는 동일·잔여 0 |
| 페이지와 Form의 동명 property | 8 | 2/6 | 정상 표기의 Form 내부 OC 6개는 기존 제외. escaped tag 2개는 탐지 누락; 그중 1개 양쪽 변화, 둘 다 잔여 |
| Name 값의 간접 표현(P/Type/BaseState) | 8 | 8/0 | 모두 각각 동일·잔여 0 |
| OFF 출구 미완료 W/W* | 4 | 4/0 | **6조건 전부 true·깊은 잔여 0인데 Poppler 각 6,400px 변화**, PDF.js는 0 |
| OFF Form/Image Do의 path/text/ON-block 문맥 | 6 | 6/0 | Form Do가 열린 BT 안에 있으면 PDF.js 311px 변화. 나머지 표본은 각각 동일 |
| 페이지 OC tag의 `#xx` escape | 3 | 3/0 | 양쪽 각 6,400px 변화. prototype 객체 잔여 0이나 **이름 해독한 content 검사는 잔여 검출** |

총 사전 **허용 159·제외 10**. 허용 결과 중 **Poppler 변화 24·PDF.js 변화 21**이었다. 기존 prototype residual 검사 실패는 **38개**, 원시 Name을 해독하고 직접/간접 dict·배열·stream dict·content까지 깊게 검사하면 **41개**다. 이 수치를 독립 실패 원인 24건/41건으로 집계하지 않는다. 자세한 입력별 값과 grouping은 `final-assertions.json`에 있다.

셰이딩 dictionary/PatternType2에 붙인 `/OC` 4개는 **그 키에 유효한 가시성 의미가 있다고 인증한 fixture가 아니다**. 두 renderer가 실제로 무시하는 추가 키의 잔여 처리 경계를 조사했다. 이 네 개를 “정상 shading OC 지원 실패”로 부르지 않는다. OFF Form Do의 열린 BT 문맥과 미완료 W 역시 정상 PDF 적합성 인증이 아니라 **현재 사전 검사가 허용해 버리는 비정상/경계 연산열**의 복구 동작을 검증한 것이다.

**D4의 결정적 새 반례는 OFF 블록의 미완료 clipping이다.**

`pdf/supp-pending-clip-nonzero-empty-original.pdf`: **807B**, SHA-256 **`4da6e14f0535acb741698a2a7b5330dd6fd5786d7c41bc8edc7435f03caac716`**.

```pdf
% Target은 catalog에 등록된 OCG, /D /BaseState /OFF
/OC /Target BDC q W Q EMC
0 0 1 rg 10 10 40 40 re f
1 0 0 rg 60 60 80 80 re f
```

Usage/Intent/AS/Configs/VE/중첩/Form 내부 OC가 없다. OFF 진입의 path=false·clipPending=false·textDepth=0이며 본문은 `q W Q`다. classifier가 기록한 **qWrapper/pathClosed/textBalanced/depthOne/noInlineImage/entryPathEmpty는 전부 true**다. 블록 내부에는 path construction이 없으므로 “마지막 path-construction 뒤 painting/n 종결”이라는 현행 검사는 열린 path가 없다고 판정한다. 그러나 아직 소비되지 않은 `W`의 처리가 renderer에 따라 다르다.

| renderer | 원본 빨강/파랑 | OFF 통삭제 결과 | changed pixels |
|---|---:|---:|---:|
| Poppler | **0/1,600** | **6,400/1,600** | **6,400** |
| PDF.js | **6,400/1,600** | **6,400/1,600** | **0** |

Poppler 원본 RGBA SHA는 `1439513b…fb0a`, 결과는 `69aad151…c1e6`; PDF.js는 둘 다 후자다(전체 SHA는 JSON). `W*`와 앞에 별도의 `re n`을 둔 대조까지 4개가 같은 행태다. 이 네 결과는 **Name을 해독한 깊은 OC 검사도 잔여 0**이다. Poppler 원본/결과 PNG를 직접 열어 빨간 사각형 출현도 확인했다.

설치된 PDF.js `pdf.mjs:11643`은 `restore()`에서 `pendingClip=null`, `:11799/:11803`은 W/W*의 pending 설정, `:12975` 이후는 path 소비 때 clipping 처리를 보여준다. Poppler 내부 구현은 읽지 않았으므로 그 내부 원인까지 단정하지 않는다. **관측 사실은 원본 renderer 간 표시 차이와 통삭제 후 Poppler 변화**다.

v9의 clipping 문장은 조건 ⑥인 **진입**을 설명한다. “W/W*는 n으로 종결되어야 비어 있음”을 출구까지 적용해 이미 제외라고 해석할 수도 있으나, 채택 근거인 classifier는 그 강한 해석을 구현하지 않는다. sol이 이를 임의로 선택하지 않게 **OFF 종료 시 pending clipping 없음**을 별도 판정으로 써야 한다. 가장 좁은 수정 후보는 **OFF 안의 W/W*가 같은 블록에서 painting/n으로 소비되지 않은 채 EMC에 도달하면 파일 단위 구조 제거 제외**다. q/Q가 pending clipping을 안전하게 없앤다고 가정하지 않는다.

보충 `supp-form-incoming-text`는 981B, SHA `aa836834…8af6`이고 페이지 content는 `BT /F1 20 Tf 20 100 Td /Fm Do (TEST) Tj ET`다. Fm 자체 OC만 OFF이며 Form 내부 OC는 없다. Poppler 변화 0, PDF.js 변화 **311px**, 깊은 OC 잔여 0이었다. 8차 `form-with-text`는 **`/OC BDC q /Fm Do Q EMC` 블록이 BT 안에 있는 경우**라 조건 ⑥에 걸렸다. 이번 것은 **Form 자체 OC의 Do**라 그 검사가 적용되지 않는다. 이 비정상 호출 문맥도 명시적으로 사전 제외하는 것이 좁은 후보다. 정상 incoming path/ON 블록 안의 호출을 모두 제외할 필요는 이번 표본에서 발견하지 못했다.

**Annotation과 비페이지 리소스의 잔여는 별도의 구현 누락이며, 지원 효과를 정해야 한다.**

대표 Link는 `new-annot-Link-OCG-0-original.pdf`, 1,043B, SHA **`5a99469a97d9a89358694aa829c7b4184faf94fd4ebc924a3ff847ba2b3d849d`**다. catalog에 등록된 OFF OCG를 Annotation의 `/OC`가 가리키고 `/AP /N`은 빨간 80×80 Form이다. `/A /S /URI` 링크는 보존 대상이다. **주석 제거/양식 flatten 없이 다른 구조 제거를 할 경우**를 검사했다.

prototype은 페이지 Contents와 페이지 Resources의 XObject만 정리한 뒤 catalog를 떼므로, Link `/OC`와 그 OCG가 출력에 남는다. 양쪽 renderer에서 빨강이 **0→6,400px**이고 residual은 `4 0 R:OC`, `6 0 R:Type`이다. **이 출력은 잔여 검사에서 실패하므로 런타임이 정상 결과로 제공할 것이라는 반례는 아니다.** 문제는 preflight는 허용인데 뒤에서 결과 전체를 거부하거나, sol이 OC annotation을 삭제/상시 표시/hidden flag 전환/사전 지원 제외 중 새 정책을 정해야 한다는 점이다. Link 보존 계약 때문에 OFF annotation을 무조건 삭제하는 방식을 암묵 채택할 수 없다. Widget fixture의 AcroForm graph는 r9의 작은 copyPages prototype 범위 밖이므로 기존 양식 보존 문제를 새 이견으로 중복 계산하지 않았다.

대표 tiling pattern은 `new-pattern-tiling-marked-0-original.pdf`, 1,165B, SHA **`d43cd179f5e7f428fb7a5d5d0b676e7ed15399f9972299ae8064b602b3aa29a4`**다. PatternType1 stream 안 `/OC /Target BDC q … f Q EMC`, 자체 Resources/Properties의 등록 OCG를 사용한다. 페이지는 `/Pattern cs /P scn … re f`로 패턴을 호출한다. r9의 `forms()`는 페이지 XObject만 따라가므로 패턴을 보지 못하고 양쪽 renderer에서 **6,400px 노출**, OCG 잔여를 남긴다.

SMask `/G` Form 내부 OC는 **이미 문안상 Form 내부 OC 제외**다. 문제는 ExtGState/SMask를 따라가지 않는 탐색기이며 새 Form 지원 정책 이견으로 세지 않는다. 같은 property 이름을 가진 Form의 escaped OC도 같은 성격이다. 전역 visited set으로 순환을 끊되 **페이지/상속/패턴/SMask/Annotation AP/하위 Resources의 사용 문맥을 놓치지 않는 탐색**이 필요하다. 페이지와 Form의 property 이름을 하나의 전역 map으로 합치지 않는다.

**PDF Name 해독 오류는 새로운 제외 정책 없이 고쳐지는 prototype 결함이다.**

`/O#43`, `/#4FC`, `/#4f#43`는 시험에서 양쪽 renderer가 OC tag로 인식했다. r9는 property 이름 `/Hid#64en`은 해독하면서 tag는 `raw === '/OC'`로만 비교했다. 그래서 페이지 OC 마크를 남기고 Properties/catalog를 삭제하며, 원시 문자열 `'/OC'`만 찾는 residual 검사도 이를 놓친다. 대표 입력 SHA는 **`f8ea961ab9404063fca47b8b04403afedc40288b749f790350ed86d10cb38426`**다.

`probes/normalized/`는 tag 비교에도 동일 `#xx` 해독을 적용한다. 원본 토큰의 byte start/end는 유지하여 치환 offset을 바꾸지 않았다. **세 페이지 입력은 지원 유지·두 renderer 동일·깊은 잔여 0으로 해결**, escaped Form 두 개는 기존 Form 내부 제외에 정확히 걸렸다. 이 사실만으로 별도 제품 지원 이견을 추가하지 않는다. 정본화 시 “lexer의 Name 비교와 잔여 검사 모두 해독된 이름 사용”을 구현 주의로 남기면 된다.

**검증한 보완 후보는 다음 한 가지다. Claude 채택 전이며 기존 v11 결과를 이 후보로 덮어쓰지 않았다.**

> v11 OCMD 원시 규칙과 기존 6조건을 유지한다. catalog OCProperties가 있으면 OCGs는 **비어 있지 않은 유효 OCG ref 배열**이어야 한다. OCProperties가 없더라도 전체 직접/간접 객체를 검사하며 **OCG/OCMD가 발견되면 구조 제거 지원 제외**한다. OC가 전혀 없는 일반 문서는 허용한다.
>
> OFF 블록 진입/출구의 path·text·미완료 clipping을 검사한다. 블록 내부 W/W*가 같은 블록 안 painting/n으로 소비되지 않고 끝나면 제외한다. **OFF XObject Do가 열린 BT 안에서 실행되는 경우도 제외**한다. 논리적 Contents 배열의 경계에서 상태를 초기화하지 않는다.
>
> OC 제거의 지원 위치는 **페이지 논리적 Contents의 OC marked content + 페이지의 유효 Resources(상속 해소 포함)에 직접 등록된 Form/Image XObject 자체 OC**로 명시한다. **그 밖의 OC 키 사용처(Annotation 포함), Form/Pattern stream 내부 OC 및 패턴·SMask·AP 등 경로에서 발견되는 미지원 OC는 파일 단위 구조 제거 지원 제외**한다. 직접/간접 dict·배열·stream dict·리소스 그래프를 순환 방지하여 검사하고, 사용되지 않는 객체도 같은 전체 객체 검사에 포함한다. 전체 입력을 성공적으로 분석하지 못하면 지원 허용으로 승격하지 않는다.
>
> PDF Name의 `#xx`를 tag/property/resource 비교와 잔여 검사에서 동일하게 해독한다. 제외 효과는 기존의 ko/en 레이어 처리 불가 고지·구조 제거 옵션 비활성·장식/raster 허용을 유지한다. Annotation을 조용히 삭제하거나 상시 표시하는 대안을 추가하지 않는다.

후보의 비페이지 OC 지원 축소는 **검증되지 않은 위치를 사전에 제외하기 위한 제품 결정 후보**다. 모든 Annotation/패턴을 금지하는 것은 아니며 **OC가 있는 경우**를 말한다. unknown extra `/OC`가 있는 OCG 또는 orphan Form도 이 보수적 전객체 검사에서는 제외된다. supplement의 Image 대조 일부에는 생성 시 교체된 Form이 orphan으로 남아 있어서 이 이유로 제외된다. 이 결과를 “Image 자체 OC가 깨져서 제외”로 설명하지 않는다. 순수 Image OC 20개는 계속 전부 허용·동일하다.

실행한 후보 `proposed-guard.mjs` + 이름 해독 보정 변환의 결과:

| 범위 | 허용/제외 | 검증 |
|---|---:|---|
| 기존 184개(174 탐색+기존 10) | **88/96 불변** | v11 manifest/32회귀 포함 모든 기존 판정 유지 |
| 새 탐색 169개 | **110/59** | 허용 110 모두 두 renderer 원본/결과 동일 |
| 추가 문안 경계 2개 | **0/2** | 후보대로 사전 제외·후보 변환 시도 0 |
| 새 입력 171개 합계 | **110/61** | 기존·신규 허용 합계 **198개**, 두 renderer 전량 SHA 동일·깊은 OC 잔여 0 |

E10-11은 catalog 없는 OC 검사 보완 뒤 앞선 **353개 판정이 모두 동일**함을 직접 재검사했다. 변환 코드와 허용 입력 집합은 바뀌지 않아 기존 198개 renderer 증거가 그대로 유효하다. 빈 registry/orphan 두 입력은 진단용 no-op 변환을 E10-5에서 별도로 실행했으나, **후보 경로에서는 둘 다 변환 전 제외**다. 이 둘을 혼동하지 않는다. 전체 임의 PDF 지원 증명이나 완성 U4 제품 게이트를 주장하는 수치가 아니다.

U4-0 fixture에는 기존 14+32를 유지하면서 최소한 **미완료 W/W***, **OFF Form 자체 OC의 BT 안 Do**, **Link OC**, **tiling pattern OC**, **escaped OC tag의 페이지 허용/Form 제외**, **빈 registry/catalog 없는 OCMD** 기대값을 고정하는 것이 필요하다. 파일명/SHA 예외처리가 아니라 위 구조 조건으로 분류해야 한다. 같은 property 이름·Resources 상속·순환·중복 ref는 이번 양성/음성 표본을 함께 보존하면 된다.

sol 관점의 최종 판정은 다음과 같다.

| 단계 | 판정 |
|---|---|
| U4-0 | 기존 legacy/암호/번들 계측 계약 유지. **D4 추가 문법·fixture 기대를 확정해야 함** |
| U4-1/3/4/5 | 선택 exact set·번호 anchor·도장 비율/중심·coverage/date·clock·route/canonical·미리보기·400타일 등 이전 해소 유지. 이번에 다른 새 이견 없음 |
| U4-2 | facade 실제 이관·기존 4모드/Excel 불변·task 양보·결과 등록 전 abort·PDF.js 정착 순서 유지. 과거 테스트를 이번 새 실행으로 표기하지 않음 |
| U4-6 | **OFF 제거의 끝/호출 문맥, Annotation/비페이지 리소스 OC의 지원 효과, 빈 registry/orphan 검사 범위를 sol이 재해석해야 하는 상태** |
| U4-7/8 | D3 OPFS 실패 일괄 중단·200MiB 등록 전 cap·경고 계수·벤치/복합 golden·최종 C-D 게이트 유지. 전체 제품 벤치/게이트는 이번 대상 아님 |

기존 D1·D2·D3·D5·D6·D7·D8·N1·N2·N3를 다시 이견으로 세지 않는다. 문서의 구 버전 잔재는 최신 절 우선순위로 읽었다. 변수명·파일 배치 선택도 이견이 아니다. **D4는 OCMD 174표본의 문법 검증은 통과했지만, 적용 경계와 사전 검사 조건까지 하나로 닫히지 않았다.** 구체적인 후보와 성공 실험이 있다는 사실만으로 Claude의 수용을 대신 선언하지 않는다.

종료 불변 검사는 최초 exit 0이었으나, **최종 재실행은 exit 1**이었다. 보고서 작성 중 동시 S2b 세션의 커밋 **`71a6200aaefed34a8fbf4524faf4e4068370decc`**(`test: cover final QR download cancellation task`)과 로드맵 갱신이 발생했다. 엄격한 verifier나 허용목록을 완화하지 않고 실패를 그대로 보존했다.

```json
{
  "snapshotFiles": 2929,
  "endFiles": 2929,
  "changed": [
    "docs/jobs/todo/roadmap-completion-20260906.md",
    "docs/review-notes.md",
    "tests/unit/qr-label-font.test.ts"
  ],
  "trackedChanged": ["docs/review-notes.md", "tests/unit/qr-label-font.test.ts"],
  "pdfFiles": 12,
  "pdfChanged": [],
  "pdfDiffFromMain": "",
  "distFiles": 537,
  "distChanged": [],
  "u4PlanUnchanged": true,
  "userFilesChanged": [],
  "mainMatches": true,
  "scopePass": true,
  "pass": false
}
```

새 커밋의 실제 diff는 **QR unit 25줄 + review-notes 4줄**, 두 추적 파일만이다. 로드맵은 gitignore 오프라인 진행 기록이다. 이 세션은 저장소 수정·git commit을 실행하지 않았다. 전후 SHA/크기/mtime와 커밋 원문은 `scope-integrity.json`에 기록했다. 초기 snapshot에서 지정 예외였던 AGENTS.md·CLAUDE.md 자체는 이번 세션 동안 불변이다.

**최신 사용자 지시의 PDF/main 범위 검사는 통과**했다. PDF 편집기 **12파일**, dist **537파일**, U4 v11 계획, 사용자 3파일은 SHA/크기/mtime/집합 불변이다. main=`f29d249…`, 브랜치·git status·worktree diff·index도 그대로이며 HEAD만 `249e172…→71a6200…`으로 이동했다. `src/`·`scripts/`·public/dist·package/lock 및 U4 계획에 변경이 없어 이번 PDF 실험 입력과 의존 전제에 영향이 없다. 별도 E10-13은 **exit 0**이다. 따라서 저장소 전체 불변이나 추적 파일 전체 불변을 선언하지 않는다. 동시 QR 변경은 U4의 잔여 이견 수에 넣지 않았다.

**최종: 174입력 84/90 · manifest 4/10 · 직접 배열 32/32 · 허용 88개 두 renderer SHA 동일 통과. 잔여 이견 1건(D4) · [재왕복 필요]. Claude–Codex 간 이견 0 아님. — Codx**
