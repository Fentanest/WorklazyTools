U4 PDF 마무리 v12 — Codex astra 11차 반박 (Codx, 2026-09-07)

**잔여 이견 1건(D4: Type3 글꼴의 페이지 OC 블록 제거) · [재왕복 필요]. Claude–Codex 간 이견 0 아님.**

기존 **355입력(184+169+2)**에서는 v12 문안과 10차 `proposed-guard.mjs`의 허용/제외가 전부 일치했다. **허용 198·제외 157**, 허용 198개를 모두 새로 변환하고 Poppler·실제 Chrome PDF.js에서 각각 원본/결과 전체 RGBA SHA 동일을 재확인했다. 지정 manifest **허용 4·제외 15**, 직접 배열 회귀 **32/32**, 추가 대표 **20/20**도 일치했다.

그러나 새 입력 한 라운드 **72개** 중 **v12가 허용하는 Type3 2개**에서 Poppler가 각각 **1,722픽셀** 바뀐다. PDF.js 변화는 0이다. **CharProcs 내부에는 OC가 없고, OC 마크는 페이지 Contents에만 있다.** 따라서 “비페이지 OC 전부 제외”에 이미 걸리는 사례가 아니다. OFF 블록의 기존 6조건과 ⑦⑧을 모두 통과하고, 변환 결과의 깊은 OC 잔여도 0이다. **일반 재저장·참조 보존 복사에서는 변화 0, OFF 블록만 제거해도 동일한 1,722픽셀 변화**를 재현했다.

**항목별 판정**

| 대상 | 판정 | 실제 증거 |
|---|---|---|
| catalog 경계: 비어 있지 않은 registry·catalog 없는 orphan OC 제외 | **[동의]** | E11-1/5/7. 기존 184 유지, 빈 registry·catalog 없는 OCMD 두 경계 모두 제외·해당 경로 변환 0 |
| v11 OCMD 원시 표현·등록 ref·BaseState→ON→OFF | **[동의]** | 174 탐색은 84/90 유지, 직접 배열 회귀 32/32. 생성기 두 번 실행 후 이전 SHA까지 일치 |
| ⑦ OFF 출구 미완료 clipping | **[동의]** | 기존 W/W* 4개 모두 제외. 소비된 clip 및 OFF Do path 보충 대조는 허용·양쪽 동일 |
| ⑧ 열린 BT 안 OFF Do | **[동의]** | `supp-form-incoming-text` 제외. ⑧을 일반 text show까지 확장해 Type3 반례를 이미 제외했다고 읽을 수는 없음 |
| 페이지 Contents + 직접 등록 Form/Image 자체 OC로 지원 위치 한정 | **[동의 — 문안]** | 비페이지 OC의 효과는 명확함. 단 **실험 가드의 실제 구현은 새 입력에서 14개를 놓침**, 아래 fixture 목록. 이를 새로운 정책 이견으로 세지 않음 |
| 순환 방지 전객체·orphan 탐색 | **[동의 — 문안]** | 기존 순환·orphan 분류 유지. **객체 visited와 사용 경로 검사를 구분해야 하는 실행 증거** 추가 |
| Name #xx 해독 | **[동의]** | 기존 escaped page tag 3개 허용·양쪽 동일. 대표 20에 포함하여 두 번 생성, 과거 SHA 일치 |
| fixture 4/15 + 회귀 32 + 대표 20 | **[동의]** | E11-5/6/7. 19개 manifest, 회귀32, 대표20은 각각 별도 명시 목록이며 기존 355의 부분집합 |
| v12 ↔ 10차 가드 동치 | **[지정 355개 일치 / 전 입력 동치 아님]** | 기존 분류 차이 0. 새 72개에서 v12 제외·가드 허용 14개. 단순 코드 복제만으로 v12 구현 완료라고 할 수 없음 |
| 문안을 통과하는 새 입력 | **[이견 1: D4]** | Type3 d1 glyph를 페이지 ON/OFF 블록에서 재사용한 두 입력. Poppler 각 1,722px·PDF.js 0·OC 잔여 0 |
| sol U4-0~8 인계 | **[재왕복 필요]** | U4-0 fixture 기대와 U4-6 Type3+OC 지원 분기를 추가로 결정해야 함. 나머지 이전 해소 유지 |

**실행 범위와 게이트**

첫 도구 명령은 `cat PROJECT_RULES.md`였다. AGENTS, 지정 dispatch 전문, PDF 계획 전문(「v12 확정」 우선), roadmap §2·§3 S3·결정10/11, r3~r10 REPORT와 관련 review-notes 기각 이력을 읽었다. 절단 출력은 구간 재독했다. 열린 계획 16개를 열거·검색한 원문은 `logs/open-plans-scan.txt`(138행)이다. S2b QR selector/fallback과 U4 전체 OTF·공용 import의 기존 분담은 정합한다. 최신 지시대로 **main만 기준 해시로 대조하고 PDF 편집기 표면을 확인**, 브랜치를 전환하지 않았다.

```text
HEAD   71a6200aaefed34a8fbf4524faf4e4068370decc
main   f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e
branch s2b-qr-font
git diff main -- src/features/pdf-editor
(출력 없음, exit 0)
```

새 스크립트·PDF·PNG·Chrome 프로필·로그·보고서는 **`/tmp/worklazy-u4-r11/`에만** 썼다. 저장소/계획서/사용자 파일/기존 r3~r10 산출물 수정, dist 변경, npm 설치, build/prebuild, 브랜치 전환, commit/push, 제품 구현, 서브에이전트 호출은 수행하지 않았다. 기록 금지에 따라 저장소 CHANGELOG/review-notes 대신 이 REPORT로 전달한다. 미구현 U4의 제품 build/unit/browser/static/C-D 9게이트를 통과했다고 주장하지 않는다.

**명령과 원출력**

아래 cwd는 저장소 루트, 경로는 `/tmp/worklazy-u4-r11/` 기준이다. 스크립트의 출력 경로는 /tmp로 고정했다.

| ID | 실제 실행 명령 | 최종 exit / 출력 |
|---|---|---|
| E11-1 | `node /tmp/worklazy-u4-r11/probes/rerun.mjs` | **0**, `rerun.json`, `logs/rerun.log`: 355 재분류·원본 SHA 대조·허용198 새 변환/Poppler |
| E11-2 | `node /tmp/worklazy-u4-r11/probes/browser.mjs rerun` | **0**, `rerun-pdfjs.json`, 대응 log: 허용198 전체 PDF.js 새 렌더 |
| E11-3 | `node /tmp/worklazy-u4-r11/probes/explore.mjs` 및 `node …/probes/browser.mjs explore` | **0/0**, `explore.json`, `explore-pdfjs.json`, 대응 logs: 고정72입력·각2회 생성·양쪽 렌더. 최종 문안 분류는 E11-5로 보정 |
| E11-4 | `node …/probes/repro.mjs` 및 `node …/probes/browser.mjs repro` | **0/0**, `repro*.json`, 대응 logs: 동일 반례2개의 반복·재저장·복사·OFF만/ON마크만 제거 **10대조** |
| E11-5 | `node …/probes/complete-classification.mjs` | **0**, `classification.json`, 대응 log: v12 전체 재대조·19 manifest·32회귀 결정성·후보427분류 |
| E11-6 | `node …/probes/representatives.mjs` | **0**, `representatives.json`, 대응 log: 명시 대표20 각각2회 생성·기존 SHA 동일 |
| E11-7 | `node …/probes/final-assertions.mjs` | **0**, `final-assertions.json`, 대응 log: 실제 PDF/PNG 재독·RGBA 차이·깊은 잔여·양쪽 oracle·후보집합 검산 |
| E11-8 | `source-evidence.json`의 argv 9명령 | **9/9 exit 0**, `logs/source-evidence.log`: 계획·설치 PDF.js 코드·가드·git·환경 원문 |
| E11-9 | `python3 …/probes/verify-unchanged.py` | **1**, `unchanged.json`, 대응 log: 동시 QR 스모크/로드맵 변경을 그대로 검출 |
| E11-10 | `python3 …/probes/scope-integrity.py` | **0**, `scope-integrity.json`, 대응 log: PDF/main·dist·U4 계획·사용자 파일·실험 입력 불변 |
| E11-11 | `node …/probes/candidate-verify.mjs` | **0**, 대응 log: r11 `proposed-guard.mjs`의 새 후보를427개에 직접 적용, 기존 후보표427/427 일치 |

Poppler **24.02.0**: `pdftoppm -f <page> -l <page> -r 72 -png -singlefile <pdf> <prefix>`. PDF.js **6.2.108**, Chrome **152.0.7977.64**, scale=1·흰 배경·ceil viewport의 전체 RGBA. Node **v22.17.1**, pdf-lib **1.17.1**, puppeteer-core **25.6.0**, pngjs **7.0.0**. 모든 페이지를 검사했으며 renderer 상호 동일성이 아니라 **각 renderer에서 원본=결과**가 oracle이다. 외부 요청 **0**, 링크 클릭 없음, 실 모바일 측정 아님.

초기 하네스 실패도 보존했다. E11-2 최초는 suite 필터에 `rerun`을 빠뜨려 저장하지 않은 **제외157 원본 URL에 404**, **exit 1 (157 !== 0)**이었다. 허용198의 첫 실행 자체는 모두 동일했지만 필터 수정 후 명령 전체를 다시 실행하여 **198·오류0·변화0·exit0**으로 확인했다(`rerun-pdfjs-initial.json`, `logs/rerun-pdfjs-initial.log`). 문안 비교기의 첫 탐색은 annotation back-pointer `/P`를 피하려는 코드가 **Pattern 리소스명 `/P`도 건너뛰어** 두 기대 불일치가 났다. Annotation 문맥으로 한정한 뒤 **같은72입력 전체를 재분류**, 기대 불일치0을 확인했다(`explore-initial.json`, `classification.json`). 새 탐색을 추가한 것이 아니다. 마지막 RGBA 검산 최초에는 도형 내부 면적1,600을 예상값으로 둬 **1722 !== 1600, exit1**. 실제 PNG를 독립 Pillow 대조해 경계 포함 **1,722**임을 확인하고 정확한 수치로 단언했다(`logs/final-assertions-initial.log`). 중간 안내의1,600도 최종 수치로 정정한다. 지원 조건·픽셀 임계는 완화하지 않았다.

**355입력의 재실행 결과**

`v12-literal.mjs`는 v11 고정 전제(candidate/classifier)를 재사용하고 **v12의 추가 경계·⑦⑧·전객체/사용 경로 검사**를 별도로 구현했다. 10차 가드는 원본 `/tmp/worklazy-u4-r10/probes/proposed-guard.mjs`를 직접 import해 실행했다(SHA-256 `594fc00f9d8f91831d311b6e2dc475110a41b4be1aa5391f52a09a3c17e5f473`). 새 변환은 10차 normalized 변환의 출력 디렉터리만 바꾼 복제본이다. 가드가 기대 픽셀이나 파일명/SHA를 보고 분류하지 않는다.

| 집합 | 입력 | 허용 | 제외 | 결과 |
|---|---:|---:|---:|---|
| 9차174 + 기존10 | 184 | 88 | 96 | 두 분류 일치, 허용88 양쪽 동일 |
| 10차 탐색 | 156 | 105 | 51 | 일치, 허용105 양쪽 동일 |
| clipping/Do/escaped 보충 | 13 | 5 | 8 | 일치, 허용5 양쪽 동일 |
| 빈 registry/catalog 없는 OCMD | 2 | 0 | 2 | 일치, 변환0 |
| **합계** | **355** | **198** | **157** | **허용198 전부 양쪽 RGBA 동일·깊은 OC 잔여0** |

fixture manifest는 **19개=허용4+제외15**다. v12의 “v11의10종” 표현은 앞뒤의 누적 지정4개·최종4/15를 함께 읽어 **v11 manifest14개 + 새5개**로 정리했다. 숫자 편집 잔재를 독립 이견으로 만들지 않는다. 정확한 이름/SHA/기대는 `classification.json.manifest`, 직접 배열32는 `.regression`에 있다. `representatives.json`의 **명시20개**는 중복/순환·상속·Image OCG/OCMD·간접 Name·escaped page tag를 골랐다. 32+20 모두 생성기2회·이전SHA 동일이다. 이들은355의 부분집합이며 새 입력 수에 중복 합산하지 않는다.

**새 탐색 한 라운드: 72입력**

입력명·그룹·사전 기대를 `exploration-matrix.json`으로 고정한 한 번의 매트릭스다. 각 파일은 두 번 생성해 SHA 동일을 단언했다. 이후10대조는 발견한 **같은 반례2개의 원인 분리/재현**이며 새로운 탐색 라운드가 아니다.

| 축 | 입력 | v12 허용/제외 | 가드의 잘못된 허용 | 판정 |
|---|---:|---:|---:|---|
| ExtGState `/Font` → Type3 | 4 | 2/2 | 2 | CharProc 내부 OC는 이미 제외. 내부 OC 없는 대조2개는 양쪽 동일 |
| ExtGState `/TR`·`TR2`·`BG`·`UCR`의 함수 객체 `/OC` | 8 | 0/8 | 0 | 기존 비페이지 OC 제외 fixture 후보 |
| Shading 직접/간접 dict 및 Function의 `/OC` | 6 | 0/6 | 0 | 기존 제외. 추가 키의 유효한 PDF 가시성 의미를 인증하는 시험은 아님 |
| Type3 CharProcs 내부 OC, 직접/간접 CharProcs dict | 4 | 0/4 | 4 | 기존 제외인데 prototype 탐지 누락 |
| **CharProc 내부 OC 없는 Type3, 페이지 OC에서 glyph 재사용** | **4** | **4/0** | **0** | d0 대조2개 동일. **d1 두 입력 Poppler 각1,722px·PDF.js0** |
| Widget/AP 자체/내부 OC·페이지 직접등록 공유·무OC 대조 | 12 | 2/10 | 2 | 공유 AP 자체OC도 비페이지 사용 경로가 있어 이미 제외 |
| Resources 2/4/7단 상속·중간 shadow·두 가시성 | 12 | 12/0 | 0 | 양쪽 전부 동일. 가장 가까운 Resources를 사용, 조상과 merge하지 않음 |
| 동일 Form을 ON/OFF 경로에서 참조: 자체 OC 없음/ON/OFF·호출순서·Contents 배열 | 12 | 12/0 | 0 | 양쪽 전부 동일 |
| 페이지 등록 Form을 SMask/Pattern/다른 Form에서도 공유 | 6 | 0/6 | 6 | 기존 제외. 객체 identity만으로 지원 위치를 판정하면 놓침 |
| OFF Form Do + caller W/W*·n/f 대조 | 4 | 4/0 | 0 | 양쪽 전부 동일 |
| **합계** | **72** | **36/36** | **14** | v12 허용36 중 **34 양쪽 동일·2 새 반례** |

**이미 제외인14개는 이견0, 탐지/fixture 보완 목록이다.** 10차 가드는 stream 내용을 `/Subtype /Form` 또는 `/Type /Pattern`인 경우에만 파싱해 **untyped CharProc stream**을 놓친다. ExtGState `/Font`도 같은 CharProc로 들어가는 다른 경로다. 또 페이지 Resources에 있으면 dictionary를 전역 `owners` Set에 넣기 때문에 **그 객체가 AP/SMask/Pattern/다른 Form에도 사용되는 경우**를 놓친다. 기존 `prepare().forms()` 역시 직접등록 F를 먼저 visited 처리하면 뒤의 Wrapper→F를 생략한다. **순환 차단용 visited는 유지하되, 경로별 허용 여부는 visited로 소거하지 않아야 한다.** `classification.json.codeGaps`가14개의 파일명·구체적인 경로 witness를 제공한다.

이14개는 v12 경로에서는 모두 **변환 전 제외**다. `explore.json`의 `diagnosticOnly:true` 변환은 **10차 prototype의 탐지 누락을 측정한 별도 진단**이지 v12 지원 결과가 아니다. 해당 진단에서 CharProc 내부 OFF가 노출되거나 잔여OC가 발견된 것은 문안상 이미 제외된 실패이며, 별도 잔여 이견으로 부풀리지 않는다. 일반 annotation·일반 Type3를 무조건 금지하는 기존 계약이 있다고 주장하지도 않는다.

**유일한 새 이견: OC가 없는 Type3 glyph도 OFF 블록 통삭제에 안전하지 않다.**

대표 **`pdf/r11-type3-page-true-1-original.pdf`**, **1,074B**, SHA-256 **`a4718041019e9f525182c8acf964db1b1f1cee8bd745fdfad7c38f3f1147c44a`**.

```pdf
% catalog registry A,B; /D /BaseState /OFF /ON [B] /OFF []
% page Resources: /Properties << /Target A /Other B >> /Font << /T type3 >>
0 0 1 rg 10 10 40 40 re f
/OC /Target BDC q 1 0 0 rg
  BT /T 40 Tf 60 60 Td (A) Tj ET
Q EMC
/OC /Other BDC q 0 1 0 rg
  BT /T 40 Tf 100 100 Td (A) Tj ET
Q EMC
% Type3 font Resources << >>, CharProcs/A:
1000 0 0 0 1000 1000 d1 q 0 0 1000 1000 re f Q
```

첫 Target 블록은 OFF, 둘째 Other 블록은 ON이다. **glyph stream에는 OC 마크·키가 전혀 없고**, Font Resources도 비어 있다. OCG는 정상 등록, Usage/Intent/AS/Configs/VE·중첩·Form/Pattern/AP 경로도 없다. OFF 진입 path=false/clipPending=false/textDepth=0, 본문 q…BT…ET…Q, q wrapper/출구path/BT균형/깊이/inline/진입6조건 true. **W/W*가 없어서⑦ 통과, Do가 없어서⑧ 통과.** 동적 glyph 실행 자체를 “CharProcs 내부 OC”로 해석해 제외하면 지원 문법을 새로 넓혀 읽는 것이다.

| 원본의 가시성 순서 | Poppler 원본→결과 | Poppler 전체 RGBA 변화 | PDF.js 변화 |
|---|---|---:|---:|
| OFF → ON (대표) | 초록 glyph 없음 → 나타남 | **1,722px** | **0** |
| ON → OFF (대조 반례) | OFF 위치의 초록 glyph 나타남 → 없어짐 | **1,722px** | **0** |

둘째 파일 **`r11-type3-page-true-0-original.pdf`**,1,074B,SHA **`328886f315026c475cf70a81d133dfcd97a80c0438405542d1710fabe2d899fa`**. 색 glyph 내부1,600px에 경계 포함1,722px이며 diff bbox는 두 경우 모두 **x=100..140, y=59..100**(72DPI). 사각형의 유색 내부 개수만 세면 oracle을 과소보고한다.

대표의 Poppler 원본 RGBA SHA는 `1439513bc5a20bc9b43d240593413d949d7774d5601f949b63eeca7f61defb0a`, 결과는 `c1b3b7080c7f1bc1ce6ca38b634e1f036463dafe99c5608ada854bbc6bcf309a`다. PDF.js는 양쪽 모두 `df86c2a7d330d1b7d6db8d674744136a2c469274a02c9d52576157ffb53a9ccb`. Poppler 원본/결과 PNG도 직접 열어 초록 glyph 출현을 확인했다. 원본 renderer끼리 이미 표시가 다르므로, “OC를 없앤 결과 하나로 양쪽 원본 표시를 유지”한다는 계약에 넣을 수 없다.

| 같은 입력2개의 대조 | Poppler 변화(각 파일) | PDF.js 변화(각 파일) |
|---|---:|---:|
| 10차 변환 새 반복 | 1,722 | 0 |
| load/save만 | 0 | 0 |
| 하나의 PDFObjectCopier로 페이지+OC catalog 참조 보존 복사 | 0 | 0 |
| **catalog/Properties/ON마크 유지, OFF 블록만 제거** | **1,722** | **0** |
| OFF 유지, ON마크만 제거 | 0 | 0 |

E11-4/7의10행이 이 표를 직접 단언한다. 따라서 PDF serialization이나 catalog 재구축만의 결함으로 돌릴 수 없다. 관측은 **Type3 d1 glyph 재사용과 OFF 블록 삭제에 연관된 렌더 변화**이며, Poppler 내부 캐시 구현을 읽지 않았으므로 내부 원인까지 확정하지 않는다. 설치 PDF.js 코드(`pdf.worker.mjs:37433` 등)는 CharProcs가 별도의 operator list로 처리됨을 보여준다. `d0` 대조2개는 동일했지만 이것만으로 모든 d0/다른 glyph 조합까지 보장하지 않는다.

**닫히는 구체적 후보 — 아직 Claude 채택 전**

> v12를 유지하되, **OCProperties가 있는 문서에서 전체 직접/간접 객체 탐색 중 Type3 글꼴이 발견되면 구조 제거를 파일 단위 지원 제외**한다. CharProcs 내부 OC 유무·실제 사용 여부로 예외를 두지 않는다. 기존 레이어 처리 불가 고지·구조 제거 옵션 비활성·장식/raster 허용을 유지한다. Type3 지원 확대는 별도 증거와 문법을 먼저 확정한다.

이는 폰트 호출/캐시 상태까지 분석하는 새 알고리즘을 sol에게 맡기지 않는 **보수적인 하나의 제안**이다. 문서에 OC가 없는 일반 Type3 PDF까지 이 조건으로 제외하자는 뜻은 아니다. 더 좁은 “OFF에서 사용하는 특정 glyph만” 경계를 이미 검증했다고 주장하지 않는다. **현재 이견인2개뿐 아니라 정상 대조4개도 추가 제외**한다는 비용을 공개한다.

E11-5의 후보는 기존198을 전부 유지하고, 새 v12허용36에서 Type3 6개를 제외하여 **새30 허용**, 전체427 중 **허용228·제외199**다. E11-7은 **같은 이번 라운드의 새 변환/렌더 자료**로 후보 허용228 전부 양쪽 RGBA 동일·깊은 OC 잔여0을 검산했다. 변환 알고리즘을 바꾼 후보가 아니므로 재분류 전후 동일 입력·동일 결과를 대응했다. 임의 PDF 전체 안전성이나 완성 제품 게이트를 증명한 것은 아니다. 후보 성공을 Claude 수용으로 대체하지 않는다.

**sol 관점과 잔여 원장**

| 단계 | 판정 |
|---|---|
| U4-0 | 기존 암호·legacy·번들 측정 계약 및4/15+32+20 fixture 가능. **새 Type3 지원 제외 여부와2개 oracle를 확정해야 함** |
| U4-1/3/4/5 | exact set·번호 anchor·도장 중심/비율·coverage/date/clock·route/canonical·미리보기·400타일 등 이전 해소 유지. 이번 새 이견 없음 |
| U4-2 | 실제 lifecycle facade·기존4모드/Excel 불변·task 양보·등록 전 abort·PDF.js 취소 정착 계약 유지. 과거 테스트를 이번 재실행으로 표기하지 않음 |
| U4-6 | **D4 Type3+OC 지원 결정이 남음**. 이미 문안에 있는 비페이지OC 제외는 CharProc/ExtGState Font·공유 사용 경로 탐지로 충실히 구현해야 함(새 정책 이견0) |
| U4-7/8 | OPFS 실패 일괄 중단·200MiB 등록 전 cap·계수 집계·전체 벤치·복합 golden·C-D 게이트 유지. 이번 전체 제품 검증 아님 |

파일명/변수명·과거 문구 잔재·이미 제외된14개·동시 QR 변경을 이견 수에 더하지 않는다. **잔여1건은 문안을 실제로 통과하는 두 Type3 입력의 지원 정책**이다. [정본화 가능]을 선언할 조건이 충족되지 않았다.

**종료 불변 증명**

시작2,929파일의 SHA-256·크기·mtime·파일 집합과 git 상태를 채취했다. 지정 예외는 AGENTS.md·CLAUDE.md뿐이며 검사 자체를 완화하지 않았다. 전체 verifier는 **exit1**: 동시 세션의 QR 스모크1줄과 review-notes2줄이 커밋 **`2f59a44737e87019fd90ca84f23e75c7d297ef97`**(`Stabilize QR export cancellation smoke test`)으로 반영됐고, 오프라인 roadmap 진행 기록도 바뀌었다. QR 변경은 `await waitForGenerateEnabled(page);` 추가, review-notes는 S2b3차 검수 F2-R의 재실행 기록이다. 이 세션은 저장소 파일을 수정하거나 commit하지 않았다. 전후 SHA/크기/mtime·실제 diff·커밋은 `scope-integrity.json`에 보존했다.

**PDF 편집기12파일·dist537파일·U4 v12계획·사용자3파일은 내용/크기/mtime/집합 불변**이다. main=`f29d249…` 불변, HEAD는 **`71a6200…→2f59a44…`**로 이동했다. 브랜치·git status·worktree diff·index는 최종 검사에서 시작과 같지만, 추적파일2개의 내용은 새 커밋으로 바뀌었다. `src/`·`scripts/`·public/dist·package/lock·U4계획에 변화0이라 이번 PDF 실험 입력·의존성에는 영향이 없다. 최신 사용자 지시의 PDF/main 범위 검사는 **exit0**. **저장소 전체 불변 또는 추적 파일 전체 불변이라고 확대하지 않는다.**

**최종: 기존355 분류일치·허용198 두 렌더러 SHA 재검증 통과. 새72 중 문안통과 Type3 반례2개, 잔여 이견1건(D4) · [재왕복 필요]. — Codx**
