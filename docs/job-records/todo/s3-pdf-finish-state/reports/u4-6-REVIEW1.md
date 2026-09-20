# U4-6 범위 한정 검수 — Codx / 2026-09-08

**[수정 후 재검수] — 새 결함 2건(R1·R2).** 새 문서 재구축의 고아 제거와 링크 보존은 확대 입력에서 재현됐다. 그러나 **정상 양식 appearance의 크기·위치를 바꾸는 평탄화**와 **첨부만 제거할 때 부모 없는 Popup을 남기는 처리**가 새 기능 경로에서 발생한다. 두 건을 수정하고 해당 재현을 통과시키기 전에는 U4-6 종결 및 U4-7 착수 조건을 충족하지 않는다. 기존 부채는 별도 백로그 귀속이며 이번 단계의 차단 사유로 삼지 않았다.

대상은 `s3-pdf-finish`, `cea060b65cd983bf3b2b3fdce698a4092e187169`이다. `PROJECT_RULES.md` 전문을 첫 작업으로 읽었고 지정된 정본·단계 지시서·SCOPEOUT·감량 조사·sol 보고·기각 이력을 대조했다. 열린 계획에서 PDF 단계에 상반된 현행 지시를 찾지 않았으며, 이번 사용자의 명시적 검수 범위가 전 스코프 실행 문구보다 우선한다. `git archive cea060b`로 만든 `repo/`에서만 검증했다. 구현 수정·커밋·push·브랜치 전환은 하지 않았다. 사용자 미추적 4항목의 내용 및 금지된 다른 워크트리에 접근하지 않았다.

**새 결함과 수정 지시**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| **R1 — 정상 AP의 BBox/Matrix를 고려하지 않는 양식 평탄화** | **P2, U4-6 신규, 차단** | `node --experimental-strip-types probes/appearance-review.mjs`. 동일한 원본 표시를 갖는 정상 AP 5종 중 identity만 PDF.js/Poppler SHA 일치. BBox가 절반인 경우 **2,000→500** 파란 픽셀, 비영점 BBox는 **(100,180)→(110,160)**, 2배 Matrix는 **2,000→8,000** 픽셀, 평행이동 Matrix는 **(100,180)→(130,140)**. 두 렌더러가 모든 사례에서 같은 손상을 검출. `probes/product-appearance.mjs`의 실제 제품 화면도 **preflight=ready → 다운로드 제공 → 2,000→500**을 재현했다. | `src/features/pdf-editor/finish/structure.ts:135,153`의 AP 지원 판정과 flatten 실행을 함께 수정한다. 선택된 정상 AP의 **BBox에 Matrix를 적용한 경계와 Widget Rect 사이의 배율·이동**을 반영해 원본 표시를 유지한다. `updateFieldAppearances:false`와 값 재생성 금지는 유지한다. 유효하지 않거나 지원 못 하는 변환은 실행 전에 현지화된 지원 제외로 차단하고 결과를 제공하지 않는다. 이번 정상 5종의 양 렌더러 원본/결과 픽셀 골든과 실제 UI 다운로드 검증을 추가한다. 다른 크기·원점·Matrix를 모두 허용하면서 기존 기본 AP 한 종류만 검사하는 상태로 닫지 않는다. |
| **R2 — 첨부 제거 후 부모 없는 Popup 잔존** | **P2, U4-6 신규, 차단** | 같은 명령의 최소 `appearance/popup-source.pdf` → `popup-output.pdf`. `removeAttachments=true`, `removeAnnotations=false`, form 보존. 출력의 **`4 0 R`은 `/Subtype /Popup`과 `/P 3 0 R`만 남고 `/Parent`가 없다.** 복합 12페이지에서는 **24개** 발생하며 PDF.js가 `Popup annotation has a missing or invalid parent annotation.`을 24번 기록했다. | `structure.ts:90–117`에서 제거 대상 annotation의 종속 Popup을 제거 집합에 함께 넣고 해당 참조를 고정점까지 정리한다. Parent를 지우기만 하여 불완전한 Popup을 남기지 않는다. 살아 있는 일반 markup/reply와 첨부는 각 옵션대로 유지하고, 제거 대상 Popup/IRT/Parent 연결만 정리한다. 전체 출력 검사에 **필수 부모 없는 Popup** 판정을 추가한다. 최소 fixture 및 첨부·주석 옵션 조합에서 잔여 Popup/깨진 참조/첨부 payload 0을 각각 확인한다. |

R1 근거는 `appearance/results.json`, `evidence/appearance.log`, `evidence/product-appearance.json`이며 원본·결과 PDF와 PNG가 `appearance/`에 있다. R2의 5개 전체 출력 객체도 `appearance/results.json` 마지막 행에 보존했다. 복합 사례는 `heavy/attachmentsOnly.json`과 `evidence/heavy-final.log`에 있다.

**귀속 근거:** 부모 `79c2071`에는 `finish/structure.ts`가 없고 이번 커밋이 `engine.ts:430`에 `rebuildPdfStructure` 호출과 F4a UI를 처음 연결했다. `evidence/parent-structure.txt`는 `git ls-tree 79c2071 .../structure.ts`의 빈 출력, `engine-diff.txt`·`panel-diff.txt`는 신규 연결의 실제 diff다. R1의 하부 원인은 기존 pdf-lib `PDFForm.flatten()`의 단순 Rect 이동 호출이지만, **그 한계를 검증·보정 없이 새 제품 기능으로 노출한 것은 이번 변경**이다. 기존 라이브러리 부채라는 이유로 면제하지 않는다. 참고로 사용 중인 PDF.js의 `getTransformMatrix`는 transformed BBox와 Rect 간의 비율·이동을 계산하며, 독립 렌더 비교도 그 의미를 확인했다. R2 입력은 제거 전 Parent/Popup 양방향 관계가 정상이고, 제거 후에만 부모가 없어졌다.

**A — 전체 간접 객체 골든과 확대 검사**

공식 oracle을 직접 실행했다. 최소 출력은 **1,116B / 14객체 / SHA-256 `c92299811b5d12cf8d65d48de873071b27fca5514467cfe44f306c4d34de42f3`**로 보고값과 완전히 같다. `evidence/oracle.json`의 `.fixtureContracts.removalOutput.wholeIndirectObjects`에 객체별 원출력을 보존했다. 허용 OC **56개/57페이지**, 제외 **31개**, 제외 변환 시도 **0**, 양 렌더러 SHA 일치 **56/56**, 첫 Contents를 비운 음성 대조는 두 렌더러 모두 검출했다.

독립 probe는 기존 oracle snapshot 함수를 사용하지 않는다. `probes/structure-review.mjs`에서 fixture 생성, 제품 변환, 저장·재파싱, trailer 루트 도달성 및 **전체 context 간접 객체 전수 열거**를 별도로 수행했다. raw 객체 문자열, 실제 raw stream base64·SHA, decoded stream base64·SHA·오류, 금지 key/type/subtype, 누락된 참조, Parent 없는 Popup, plaintext·hex/UTF-16 문자열 sentinel까지 기록했다. 디코딩 오류를 성공으로 삼지 않았다. `probes/assert-evidence.py`는 결과의 기대 수치·불변 조건을 실제 assert하며, 선언된 R2를 제외한 구조 잔여를 허용하지 않는다.

확대 입력 `heavy/input.pdf`는 **42,433B, 610개 간접 객체, 12페이지**다. 압축된 첨부 24개의 실제 decoded 데이터는 **1,286,144B**이며, 페이지마다 양식 1개·XMP·여러 markup subtype·Popup/IRT 연결을 갖는다. 같은 문서에 ON/OFF OCG, tagged 구조/MCID/ParentTree, catalog/page AF, 12개 outline, 페이지 라벨, viewer preferences가 있다. 페이지 크기 혼합·비영점 CropBox·회전 0/90/180/270도 포함한다. 이름 tree는 9개 leaf의 `Kids`를 사용하며 **72개 Names/Dests + 12개 구식 Dests = 84개** 목적지가 있다. 링크는 **URI 12 + 직접 Dest 12 + 이름 Dest/GoTo 84 = 108개**다. 고의로 도달 불가능한 sentinel stream도 추가했다.

| 조합 | 출력 bytes / 객체 | 고아 / 누락 ref / decode 오류 | PDF.js 링크 / 잘못된 목적지 | 부모 없는 Popup |
|---|---:|---:|---:|---:|
| 메타·첨부·주석·양식 모두 제거 | 7,972 / 230 | 0 / 0 / 0 | 108 / 0 | 0 |
| 메타·첨부·주석 제거 + 양식 flatten | 14,430 / 256 | 0 / 0 / 0 | 108 / 0 | 0 |
| 메타·첨부·주석 제거 + 양식 보존 | 13,536 / 267 | 0 / 0 / 0 | 108 / 0 | 0 |
| 첨부만 제거 | 24,343 / 496 | 0 / 0 / 0 | 108 / 0 | **24 — R2** |
| 주석만 제거 | 26,768 / 353 | 0 / 0 / 0 | 108 / 0 | 0 |
| 메타데이터만 제거 | 30,176 / 556 | 0 / 0 / 0 | 108 / 0 | 0 |

모든 조합에서 새 page ref로 목적지가 해석되고 이름 목적지 84개·outline 12개·페이지 라벨·viewer preferences가 유지됐다. 제거 모드의 첨부/XMP/Info/양식/숨은 OC/고아 sentinel 잔여는 **전부 0**이다. flatten 모드의 양식 appearance 내 표시 텍스트 12개는 의도적으로 남고 AcroForm·Widget·FT는 없어진다. 이것을 제거 실패로 오인하지 않았다. 반대로 form 보존에서는 양식/appearance가 남으며, 첨부 미제거 대조군에서는 PDF.js 첨부 24개·decoded sentinel 24개가 유지된다.

추가 `probes/heavy-render.mjs`는 구조가 모두 공존하는 입력과 메타 제거 결과를 비교했다. 이 경로는 OC 기본 표시를 고정하고 태그를 제거하며 양식·첨부·일반 주석은 남긴다. **12페이지 전부 PDF.js·Poppler 각각 원본/결과 RGBA SHA 일치**다(`heavy-render/results.json`). 렌더러별 before/after 비교이며 두 렌더러가 모든 PDF를 서로 동일하게 그린다고 일반화한 것이 아니다.

**판정:** 14객체 최소 문서만의 증거에서 벗어나, 위 복합 그래프와 여섯 옵션 조합까지 **새 문서 재구축이 제거 payload를 고아로 남기지 않는다는 근거**를 확대했다. 모든 임의 PDF에 대한 수학적 증명으로 쓰지 않는다. 특히 **도달성상 고아 0과 annotation 관계의 유효성은 별개**이며 R2 때문에 전체 구조 정합성 통과는 아니다.

**B — 제거 보증 ①~⑦**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| ① Info + XMP | 통과 | 공식 oracle 및 `structure-review.mjs`: trailer Info, catalog/page Metadata, 타입 Metadata, raw/decoded XMP sentinel 0. PDF.js XMP 없음, Title/Producer 없음. 미제거 대조군은 유지. | 없음 |
| ② 첨부 | payload 제거 통과 / 종속 Popup은 R2 | **delete-only 대조는 고수준 attachments=0인데 전체 객체에서 압축된 첨부 sentinel 24개가 그대로 남는다.** 동일 입력의 새 문서 결과는 0. Names/EmbeddedFiles, Filespec, EmbeddedFile, catalog/page AF, FileAttachment도 전수 검사에서 0. `heavy/delete-only.pdf`, `delete-only.json`. | 첨부 payload 제거 방식은 유지하고 R2만 수정 |
| ③ form·annotation 선별 | **수정 필요** | form 보존/제거/flatten 배타 및 각 subtype 제거는 동작. Link는 주석 제거 뒤에도 유지. **정상 AP 일반화는 R1**, 제거 대상 부모를 가진 Popup은 R2. | R1·R2 |
| ④ reachable-only 재구축 | 통과 | `structure.ts:235`의 새 `PDFDocument.create({updateMetadata:false})`, page ref 선할당, 공통 copier와 허용 catalog root 복사 확인. 기존 source context save가 아니다. 출력 230~556객체 전수에서 고아 0. | 없음 |
| ⑤ 고수준 + 전수 검사 동시 | 제거 payload 기준 통과 / 전체 의미 보존은 미통과 | PDF.js metadata/attachments/annotations/destinations와 모든 간접 객체·sentinel 동시 검사. 정상 AP 표시 손상과 parentless Popup은 기존 validator가 놓친다. | 전체 검사에 R2 관계 유효성, form 골든에 R1 표시 의미 검증 추가 |
| ⑥ 임의 annotation flatten 미지원 | 통과 | ko/en UI에 임의 주석 flatten 지원 없음. 주석 삭제와 양식 flatten을 구분하며 Redact 주석 제거가 본문 가림이 아님을 명시. | 없음 |
| ⑦ XFA·서명·AP 미지원 고지/차단 | 명시된 음성 통과 / 정상 AP 지원 경계 보강 필요 | unit의 XFA, Sig, AP 누락, AP/N 손상 및 제외 OC fixture가 모두 거부됨. 실제 UI 제외 입력도 오류 고지·실행 비활성. R1 정상 AP 4종은 잘못 허용됨. | R1의 변환 지원 경계를 정확히 구현하거나 사전 제외 |

**C — 링크, 실행 전 고지, D4**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| URI·직접·이름 Dest 실사용 | 통과 | `probes/browser-review.mjs`: 제품 출력 `heavy/remove.pdf`를 실제 PDF.js `PDFViewer`/`PDFLinkService`로 열어 annotation anchor를 클릭. 직접 목적지 **1→6쪽**, Names 목적지 **1→2쪽**, 구식 이름 목적지 **1→6쪽**. URI는 로컬 **`/uri/1`**에 실제 도달하고 응답 본문 확인. 108개 전체 목적지는 별도 PDF.js `getDestination`/`getPageIndex`로 기대 쪽수와 대조. | 없음 |
| 주석 제거에도 Link 보존 | 통과 | 모든 markup 16종 제거 조합에서 Link 108개 유지, 제거 대상 subtype 0. 첨부·양식은 별도 옵션을 따른다. | R2 종속 Popup 예외만 수정 |
| ko/en 실행 전 고지 | 통과 | desktop 1365px, ko/en 390px, en 320px **5상태**에서 고지 visible, DOM 순서 및 세로 위치가 실행 버튼보다 앞, 다운로드 수 0. 고지 스크린샷을 직접 열어 확인. | 없음 |
| D4 보존표 | 구조별 대체로 일치 / form R1 미충족 | 13행. Outlines, Names/Dests·구식 Dests, PageLabels, ViewerPreferences, metadata/첨부 옵션, Link 표본은 실제와 일치. OC 고정·tagged 제거는 복합 문서 및 공식 oracle 렌더로 확인. 정상 AP 표시 보존은 R1 반례가 있으므로 blanket 지원 판정을 승인하지 않음. "리오픈 성공 = 의미 보존"을 근거로 삼지 않음. | R1 지원 경계와 표/고지를 함께 갱신 |

실제 고지는 ko **“주석 제거를 선택해도 하이퍼링크는 계속 작동합니다.”**, en **“Hyperlinks remain active even when Remove annotations is selected.”**로 표시된다. sol 보고의 축약 문구와 글자 그대로 같지는 않지만 요구한 의미와 사전 시점은 충족한다. 접힌 옵션을 펼치는 순간 표시되며 실행 후 통보로 대체되지 않았다. 증거: `evidence/browser-review.json`, `shots/notice-*.png`.

**D — 마지막 번들 상향 4조건**

`git diff 79c2071..cea060b -- scripts/measure-bundle-budget.mjs`는 **`affectedRouteJsGzip: 72000→82000`, `appJsGzip: 80*1024→96000` 두 값만** 바뀌었다. entry/shared/CSS 및 계측 로직은 동일하다. 실행 보고의 override는 **{}**, multiplier는 **1**이다. `CHANGELOG`/locale/PDF 기능/검사 외 다른 route 구현을 감량한 diff는 없다. `.js/.mjs` 재귀 inventory·중복 SHA 처리·worker 귀속 범위도 축소하지 않았다.

고정 baseline은 schema-v3, SHA-256 **`4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`**이며 scoped와 full 모두 새 production 빌드로 계측했다.

| gzip 지표 | baseline 대비 증가 | 사용자 상한 | 잔여 |
|---|---:|---:|---:|
| entry JS | 11,065B | 20,480B | **9,415B** |
| PDF route JS | 70,335B | 82,000B | **11,665B** |
| shared JS, 귀속 이동 제외 | 2,455B | 30,720B | **28,265B** |
| app JS | 84,776B | 96,000B | **11,224B** |
| CSS | 400B | 10,240B | **9,840B** |

app 절대값 **5,928,491B**, PDF route 절대값 **1,147,622B**. shared gross 512,417B 중 509,962B는 귀속 이동이다. full의 모든 route 합계 증분 **-438,706B**는 분류 이동을 포함하므로 PDF 증가의 상쇄 근거로 사용하지 않았다. PDF 전용 scoped 증가 **70,335B**를 별도로 통과시켰다. 위 값은 완화 전 목표 충족을 뜻하지 않으며 **사용자가 변경한 상한 아래의 수치**다.

`docs/review-notes.md:7`에 상향 사실·수치·사유·**이번이 마지막 상향, U4-7/U4-8 다음 초과 시 추가 상향 요청 없이 SCOPE-OUT 및 구조 변경**이 있다. `docs/backlog.md:31`에는 main pdf-lib **118,977B**, legacy worker **219,622B**, 순감량 **목표** 80~120KB, 합계 **5~10인일** 및 **상향은 해결이 아니라 유예**라는 내용이 등재돼 있다. 실제 감량 달성 수치로 오인하지 않았다. 따라서 네 조건은 통과다. 근거: `evidence/budget-diff.txt`, `bundle-scoped.json`, `bundle-full.json`.

**E·F — 되돌림 사냥, 게이트, 좁은 회귀**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| tsc | 통과 | `npx tsc -b`, exit 0 | 없음 |
| unit | 통과, 초기 환경 실패 별도 | `npm run test:unit`, **331/331, skipped 0**, exit 0. archive 이력 연결 전 실패 2건은 아래에 기록 | 없음 |
| production·QA build | 통과 | `npm run build`, `VITE_LOCAL_QA=1 npm run build`, 각 2,851 modules·71 static pages, exit 0 | 없음 |
| static | 통과 | `npm run test:static`, exit 0 | 없음 |
| PDF finish + watermark + stamp | 최종 전체 명령 통과, 선행 timeout 보존 | `npm run test:pdf-finish`, **185.34초**, exit 0. 직접 진입 20개, 응답/취소/재시도, preview 48, 정규 구조 흐름, watermark **4 Contents + 128 image + 32 text**, stamp **16 좌표 + 16 실제 preview/output + 8 renderer pages**까지 최종 로그 확인 | timeout 원인은 미확정으로 기록; R1·R2 회귀 추가 |
| legacy oracle | 통과 | `npm run fixtures:pdf-legacy-oracle`: client 3, structure 4, render 32, output 4, input 1 파일 모두 **diff 0** | 없음 |
| 공식 PDF finish oracle | 통과 | `npm run test:pdf-finish-oracle`: 앞 A절 수치·음성 대조 | R1·R2 범위 보강 |
| 기존 PDF 4모드 | 통과 | 올바른 사본 서버에서 `TEST_SCOPE=pdf npm run test:browser`, exit 0, 9.04초. 최종 성공 문구의 Excel/Word 과장은 기존 P3 | 아래 백로그 |
| visual | 통과 | `VISUAL_ONLY=pdf-finish-structure VISUAL_CONCURRENCY=1 npm run test:visual`, **9/9** 기준선 일치. ko/en·light/dark·desktop/mobile·en320 포함 | 없음 |
| F4a+finish a11y | 범위 통과 / inherited 미해결 유지 | 7상태, 위반 0, F4a incomplete 0, **inherited incomplete 125**, 외부 요청 0. inherited를 지우거나 해결로 계산하지 않음 | 공용 부채 유지 |
| F4a 게이트 음성 | 통과 | 실제 DOM에서 소유 marker 제거 후 6개 target 재측정 → 게이트 실패. owned incomplete 주입 → 실패. 등록 상태 누락 → 실패. `browser-review.json`에 원출력 | 없음 |
| 의존 패치 음성 | 통과 | 독립 임시 patch manifest에 예상 SHA 변조, `node negative-patch/scripts/apply-dependency-patches.mjs` → **exit 1 / source hash mismatch**. 실제 dependency 파일은 변경하지 않음. 정규 unit은 exact 버전·4변형 SHA 확인 | 없음 |
| 단일 display URL·배포 범위 | 통과 | finish runtime 실측 `pdf-CCjkBPdx.mjs` 한 개를 main과 thumbnail worker가 공유. JS/MJS inventory 비교까지 정규 smoke에서 수행, `runtime.json` 보존 | 없음 |
| 기존 좌표·도장·응답·20도구 | 해당 범위 통과 | 정규 finish 및 stamp 골든, unit의 available tool routes/IDs=20, worker lifecycle·기존 engine 계약 통과. 성능 12입력은 실행하지 않았으며 대용량 수치 통과를 새로 주장하지 않음 | 누적 성능 부채 이월 |
| 영향 CLS | 통과 | 구조 시나리오만 3회, 최대 **0.0001480365514755249 ≤0.1**, 외부 요청 0 | 없음 |
| diff/stat | 통과 | `git diff --stat 79c2071..cea060b`: 30 files, +1,191/-35. `git diff --check 79c2071..cea060b` 및 주 저장소 `git diff --check`: exit 0 | 없음 |

성공한 `finish-diagnostic.log`에서 모든 하위 단계 성공 문구를 직접 확인했다. source의 top-level 검사는 모두 `await`되고 마지막 성공 로그 이전의 assert가 살아 있다. 검색된 early return은 요청 음성 응답 처리, 준비 실패 reject, 취소 감지 성공, 네트워크 계측의 비대상 응답 제외로 검사 전체를 조용히 건너뛰는 분기가 아니다. 초기 실패한 npm `&&` 체인은 뒤의 watermark/stamp를 실행하지 않았고, 이를 통과로 세지 않았다. **최종 성공 실행에서는 세 명령 모두 실제로 실행됐다.**

sol이 보고한 `data-error-code` 사고는 **하네스의 오류 상태 식별/관측 계약 문제**로 판정한다. 실제 지원 제외 입력의 DOM에서 해당 속성만 지우는 대조를 했다. 오류 문구는 전후 동일하고 만들기 버튼은 전후 disabled=true인데, 엄격한 오류-code selector만 **1→0**이 됐다. 즉 그 selector 실패만으로 사용자에게 잘못된 결과가 제공됐다고 해석할 근거가 없다. 공개 오류 코드와 소유 marker 추가는 검사 식별을 보강하는 적절한 수리이며, 현재 정상 DOM과 음성 게이트도 동작한다(`product-appearance.json.errorMarkerControl`).

**실패·환경 적응 원출력과 해석**

- `evidence/unit.log`: archive에는 `.git`가 없어 git 이력/파일목록을 읽는 2개 unit이 실패했다. 검증 대상은 계속 archive에 두고 `GIT_DIR`는 원 저장소의 읽기용 이력, `GIT_WORK_TREE`는 archive, `GIT_INDEX_FILE`은 이 작업 안의 복사본, `GIT_OPTIONAL_LOCKS=0`으로 재실행해 331/331 통과했다. 제품 코드를 고치지 않았다.
- 공식 oracle은 4280~4289만 허용하고 legacy capture는 임의 port 0을 사용한다. **archive의 하네스 포트만** 4270~4279/고정 4277로 바꿨다. native HTTP listen은 포트 충돌 시 실패하며 Vite는 모두 `--strictPort`다. 세부는 `harness-adaptations.txt`.
- 첫 preview의 **4270 포트가 이미 사용 중**이었다. 제 실행기가 프로세스 시작 실패를 확인하기 전에 HTTP 응답을 받아 첫 browser/finish/a11y/rendering을 진행했다. 이는 **검수 실행기 오류**이며 해당 결과는 전부 무효다. 다른 서버의 파일 경로나 워크트리를 조사하지 않았고, 그 포트에 대한 검증은 중단했다. 올바른 실행은 비어 있는 4273에서 서버 자신의 `Local:` 출력·생존을 먼저 확인하고, 응답 HTML을 archive `dist/index.html`과 바이트/SHA 대조했다. `server-identity.json`, `preview-valid.log`·`preview-diagnostic.log`에 증거가 있다. 독립 UI probe도 4274에서 같은 확인을 수행했다. 공식 oracle=4279, legacy=4277, 링크 로컬 뷰어/URI=4278이다.
- 첫 visual은 캡처 경로가 `tests/visual-artifacts` 하위가 아니라 시작하지 못했다. archive 내부의 해당 경로로 수정한 유효 실행은 9/9 통과했다. 검사 범위·기준선·threshold는 바꾸지 않았다.
- **유효 사본 서버의 첫 finish 실행도** header-footer direct entry에서 30초 timeout이 있었다(`finish-valid.log`). 다음 실행에서는 실패 시에만 DOM·URL·실제 tab을 저장하고 원래 오류를 다시 던지는 관측 코드만 추가했다. **제품·assert·timeout은 동일**하고 전체 명령이 통과했으며 추가 실패 진단 파일은 생성되지 않았다. 따라서 이것을 제품 신규/기존 결함으로 확정하거나 환경 문제로 단정할 증거는 부족하다. **간헐 direct-entry timeout, 귀속 미확정**으로 남긴다. 재실행 성공을 앞선 실패가 없었던 것으로 쓰지 않는다. 다음 좁은 재검수에서 관측을 유지한다.
- Node PDF.js의 FreeText/Redact/standard-font 경고는 원출력에 남아 있다. 선언된 raster 미지원 범위를 통과로 바꾸지 않았고, stream decode error와 혼동하지 않았다. 복합 before/after 렌더는 두 렌더러 각각 12/12 SHA를 비교했다.

**기존 결함·백로그 귀속 — 단계 차단 아님**

추적 문서 수정이 금지되어 아래는 Claude 취합용 문안이다. R1·R2와 섞지 않는다.

| 항목 | 귀속 / 우선순위 | 백로그·후속 문안 |
|---|---|---|
| scoped browser 성공 문구 | 기존 P3 | `tests/browser-smoke.mjs`는 부모와 이번 커밋에서 동일하다. PDF scope만 실행해도 Excel/Word 성공을 주장하는 문구를 실제 scope에 맞춰 수정. 기존 BL-U4-5-02 유지 |
| 공용 접근성 incomplete | 기존 UI 부채 | 이번 7상태에서 inherited **125**개를 그대로 보존. F4a 0과 분리해서 공용 접근성 후속으로 처리 |
| 작은 도장 resize/핸들 | 기존 U4-5 P3 | BL-U4-5-01 유지. 이번 골든 통과로 작은 조작 알고리즘 부채까지 해소됐다고 쓰지 않음 |
| 128MiB heartbeat | 기존 U4-4 후속 | 이전 목표 미달·진행 표시·취소 등 대체 계약 유지. 이번 성능 12입력 재측정 없음 |
| PDF 생성 라이브러리 중복 | 기존 구조 부채 | 이미 backlog에 등재된 80~120KB 목표·5~10인일 유지. 이번 상향이 없앤 것이 아니라 미룬 부채 |
| direct-entry 간헐 timeout | **귀속 미확정**, 조사 기록 | 위 유효 실패와 동일 코드의 성공을 함께 보존. 기존 결함으로 임의 분류하지 않으며, R1·R2 수정 뒤 scoped 실행에서 실패 진단 수집을 유지 |

**U4-8 뒤 누적 이월 목록 — Claude checklist 갱신 문안**

이번 REPORT가 저장소 `MERGE-GATE-CHECKLIST.md` 변경을 대신하는 취합 문안이다. 기존 13묶음을 보존하고 U4-6 검수 발견을 추가한다. 아래 전량 검사는 이번에 실행하지 않았다.

1. 최종 통합본 tsc, production build, unit 전체, static, diff-check.
2. 전체 `test:browser`, new-tools, utilities, office, QR bulk/font 2종, recovery. 기존 PDF 4모드 scope도 최종본 확인.
3. Excel cleaner/compare 2종, xls-preserve, xls-first-load, video-hybrid 및 공용 기반 회귀.
4. PDF finish/공식 골든 전체, legacy diff0, fixture 결정성 2회, PDF finish oracle. U4-5 실제 preview/download16·선택 복제·history·keyboard48·border mutant 유지. **U4-6: 복합 610객체/12페이지·84이름 목적지·108링크·전체 raw/decoded/orphan·delete-only 대조, R1 정상 AP BBox/Matrix 5종·실제 다운로드, R2 종속 Popup 조합** 추가.
5. inline payload/EI, descender/Noto/회전, 0배치·1픽셀·공백·6영역·400/401타일, zero/불확실 clip, 재개방, 소유/원시 구현명 비노출 경계.
6. 성능 **12입력×3** 및 cold 경로. 16/32/64MiB 실행≤200ms, 128MiB 기존 미달과 진행 paint·외부취소≤250ms·늦은 결과0·retry/fallback 대체 계약.
7. 의존 exact/lock/4SHA/멱등성/음성. 의존 변경 때 4빌드×180렌더·scalar/tail·5음성·worker/fallback 갱신.
8. visual ko/en 전량, 양 테마·320/390px·모바일 하단·시간 상한. U4-6 신규9장 포함, 최종에는 이번 filter 제거.
9. a11y 전량, F2 오류/표시실패/reload, F3 편집/history/keyboard·pixel evidence·음성, F4a ko/en×양 테마·제외 상태·소유6종·실제 marker 삭제/owned incomplete/상태 누락 음성. inherited 부채는 별도.
10. rendering 전량 및 CLS≤0.1. `pdf-finish-structure` 등록 유지.
11. 최종 production schema-v3 scoped+full bundle, physical census/raw network/양방향 inventory/동일SHA별칭·내용변경·누락mjs 음성. **이번이 마지막 상향**, 5상한·override{}·multiplier1 유지.
12. css:orphans, legacy:manifest, standalone tool-registry-routes 전량, 20도구·locale/SEO/FAQ/정적/social/canonical/hreflang/sitemap/광고 격리.
13. 추적 없는 QA에서 Gemini 실제 브라우저·Claude 육안·Codex DOM 통합 검수. 모바일 정렬/label/Tab가림/하단탭/토글 내부 정렬 포함.

명시적으로 미실행한 금지 목록: **full browser, new-tools, utilities, office, QR 2종, recovery, Excel 2종, full a11y, full visual, full rendering, css:orphans, legacy:manifest, standalone tool-registry-routes, 성능12입력.** 정규 build/unit/finish 내부의 기존 계약 검사는 지시된 명령의 일부다. 이후 F4b **4fixture×3쪽수×3DPI×2포맷×2환경**, 가독성/용량/메모리/포맷 oracle 및 F5 복합 실행·공유 font·다중결과/ZIP을 추가하고 U4-8 뒤 통합 게이트를 1회 실행한다.

**U4-7 착수 조건과 main 동기화**

현재는 R1·R2 수정 및 재현 통과 전이므로 착수 승인 상태가 아니다. 다음 단계는 두 결함의 좁은 재검수, 기준 HEAD·열린 계획 충돌 재확인, 정본 단계 지시서 고정 뒤 진행한다. 현재 번들 출발 잔여는 **app 11,224B / PDF route 11,665B**이며 수정 커밋에서 재측정한다. 초과하면 추가 상향 요청 없이 SCOPE-OUT/구조 변경으로 넘긴다.

지시된 main `2d0ff3a8280bdd1c3149946306d0ca394244fd5c`와 merge-base는 `5bc6854175331bdd73b267784d9633cdccda8446`이다. 원본 refs/index에 쓰지 않고 텍스트 blob을 `/tmp`로 추출해 파일별 `git merge-file -p`로 모의했다. branch 변경317파일/main94파일, 교집합12파일이다. **실제 병합·브랜치 전환은 하지 않았다.**

| 예상 충돌 파일 | hunk 수 |
|---|---:|
| CHANGELOG.md | 1 |
| docs/review-notes.md | 1 |
| tests/accessibility-audit.mjs | 7 |
| tests/unit/accessibility-audit.test.ts | 2 |
| tests/unit/visual-config.test.ts | 1 |

교집합의 나머지 `docs/backlog.md`, `package.json`, `src/app/seo.ts`, ko/en `features.json`, `tests/unit/seo.test.ts`, `tests/visual-regression.scenarios.mjs`는 텍스트 모의 충돌 0이다. 의미 통합·최종 빌드 성공을 뜻하지 않는다. 원자료 `evidence/main-conflicts.json`, `merge-simulation/`.

**재현·산출물·불변 증명**

공통 환경은 `NODE_OPTIONS=--max-old-space-size=4096`, `TMPDIR=/tmp/worklazy-u4-6-review/tmp`이며 빌드·브라우저·렌더는 직렬 실행했다. 정규 명령과 환경/exit/소요시간은 `evidence/base-commands.json`, `suite-commands.json`, **유효** `browser-commands.json`, `finish-diagnostic-commands.json`에 있다. 원출력은 같은 디렉터리의 `.log` 파일이다. `suite-commands.json`의 첫 서버 기반 결과는 앞서 설명한 이유로 무효이며, 그 파일의 unit·legacy·oracle·bundle·build처럼 서버와 무관한 결과는 유효하다.

독립 재현 명령은 다음과 같다(작업 루트 `/tmp/worklazy-u4-6-review`, archive의 node_modules 사용).

```bash
node --experimental-strip-types probes/structure-review.mjs
node --experimental-strip-types probes/appearance-review.mjs
node probes/heavy-render.mjs
node --experimental-strip-types probes/browser-review.mjs
node --experimental-strip-types probes/product-appearance.mjs
node negative-patch/scripts/apply-dependency-patches.mjs  # 예상 exit 1
python3 probes/assert-evidence.py
```

`evidence/verified-summary.json`은 확대 검사의 기대값 assert 통과 결과다. product-appearance probe는 **결함을 관측·기록하는 재현기**이므로 프로세스 exit 0을 제품 기능 통과로 해석하지 않는다. 실제 결과 필드는 `preserved:false`다.

시작·종료의 주 저장소 **추적 파일 2,645개 SHA 변경 0**, `git status --porcelain` 동일, HEAD/브랜치 동일을 확인했다(`start-sha.json`, `end-sha.json`, `start-status.txt`, `end-status.txt`, `repository-immutability.json`). 시작부터 수정 상태인 `CLAUDE.md`·`PROJECT_RULES.md`는 main blob 해시와 일치하며 오염으로 처리하지 않았다. 산출물·검수 하네스 변경은 모두 이 `/tmp/worklazy-u4-6-review/` 안에 있다. 저장소 CHANGELOG/review-notes/backlog/checklist는 수정하지 않았다.

**최종 판정: [수정 후 재검수].**

— Codx
