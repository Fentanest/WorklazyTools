# U8 PDF 비교 — 상세 지시서

현재 실행: **전체 구현·검수·배포·라이브 확인 완료 (2026-09-13 Codx)**. 사용자의 모든 정본 실행·재개 지시가 아래 작성 당시 구현 금지를 대체한다. U7 release `1df3c2e50edeb010272d82f15f279c1355f9f8ab` / Pages `34713794908` 및 라이브 확인 종결을 선행 근거로 삼는다. 이 release에서 기준 차이·열린 계획 충돌을 기록한다. U8-0 수용 전 제품 연결 금지는 유지한다.

## 공통 실행 계약
- 작성/판정 Codx, 기준 `d9c79b7a16f5b99fa7cddfde741b8d10f08f07d0`, 브랜치 `s3-pdf-finish`, 2026-09-09. 이번은 **문서 정본화만**. 상태: **상세 정본 — 실제 gpt-5.6-sol R2 이견 0**.
- 현재 사용자 지시가 이전 로드맵의 U7/U8 상세 작성 연기와 번들 “마지막 상향” 조건을 대체한다. **번들 용량 상한 없음; 용량 정리는 모든 정본 작업의 맨 마지막.** 배포 JS/worker/public/mjs/CSS·route별 raw/gzip 증분과 초기/실행시 요청량은 계속 계측한다. 로딩 성능을 위해 route/엔진은 지연 로딩한다. 메모리/응답성 안전 경계는 번들 상한과 별개다.
- 실행자는 PROJECT_RULES.md 전문, 이 문서, PLAN-INDEX와 참조 정본/기각 이력을 선독하고 `git rev-parse HEAD`, `git status --short`, `git diff d9c79b7..HEAD -- <대상>`로 기준 차이와 열린 계획 충돌을 기록한다. 계획 승인과 제품 구현 착수/배포 승인은 구별한다. 이번엔 구현·커밋·push·배포가 금지다.
- 새 회귀는 수리하고 기존 부채는 부모 대조 증거로 backlog에 귀속한다. 매 구현 라운드: 되돌림 사냥, 하위 호환 oracle, 검사기 음성 대조/누락 감지, 사용자 경로 재현. 큰 검증을 미루면 항목을 기록해 최종 병합 전 전부 실행한다. 아래 미래 명령을 이번에 통과했다고 기록하지 않는다.
- UI가 생기면 ko/en 행동 중심 오류/진행/빈 상태/취소/부분 결과/접근성 이름, toolRegistry·App.tsx lazy route·SEO·정적 페이지·sitemap·FAQ·소셜 이미지 생성 입력을 함께 반영. 기존 일반 광고 경로를 사용하며 새 격리 필요성을 근거 없이 만들지 않는다. production 정적 검증과 `VITE_LOCAL_QA=1` 광고·분석 없는 브라우저 검증을 분리한다. 새 경로의 일반 로더와 기존 광고 제외 경로의 요청 0, 모바일 320/390·820/821·desktop, ko/en·light/dark·키보드·드래그 버튼 대안을 검증한다. Worker/런타임/원시 예외를 사용자에게 노출하지 않는다.
- 생성물 직접 수정 금지. 코드 변경은 CHANGELOG(Codx), 판정/기각/수치는 review-notes(Codx). 이번 문안은 `/tmp/worklazy-canon2/tracked-updates.md`에만 남긴다.

## 범위와 선행
`/ko/tools/pdf-compare/`, `/en/tools/pdf-compare/`. PDF 전후 파일을 여러 쌍으로 명시 배치하고 **페이지별 시각 비교 + 추출 텍스트 비교**를 제공한다. U7 종결·배포/사후확인 뒤 구현. 자동 OCR/법적 동일성/변경 추적 PDF 생성은 제외. 기본 1쌍, 추가 쌍 버튼·좌우 교체·쌍별 실패 격리. 원본 파일을 바꾸지 않는다.

## 재사용 가능/불가 — 실행 증거
`node /tmp/worklazy-canon2/evidence/probe-pdf.mjs` exit0, 결과 `evidence/pdf-probe.json`.
- `documentComparison.ts:376` `diffText('금액 100원','금액 200원')` → equal '금액 ', deleted '100원', added '200원'. 기존 단어 토큰·LCS·1.5M fallback 계약은 그대로 호출한다. 문단/표/메모/서식·DOCX revision 모델은 PDF 구조가 아니므로 `compareDocumentModels`·WordResult UI·Word/HWP worker 통째 재사용 금지. `documentCompareClient.ts:21-47`은 word/hwp 두 family뿐이다.
- `documentAlignment.ts:33`의 기본 빈 문자열 필터는 ['A','','B']의 가운데 페이지를 실제 누락한다(결과 2쌍). include true/canGroup false/detectMoves false로 3쌍을 보존하나 PDF의 이미지 페이지를 텍스트 유사도로 자동 연결하는 근거는 없다. **v1은 `alignDocumentSequence`를 호출하지 않는 단순 index manifest의 물리 순번 대응**과 사용자 명시 수동 대응만, 페이지 삽입은 자동 확정하지 않는다.
- `pdfPreview.ts:34-71` openOwnedPdfDocument: 복사한 bytes, loadingTask 소유권·abort open, `pdfRenderLifecycle.ts` cancel→promise settle→page.cleanup→owner destroy 재사용 가능. U8 단위가 파일쌍의 task를 소유하며 기존 전역 File cache/getPdfDocument/releasePdf와 섞지 않는다.
- `pdfPreview.ts:430-455` extractPdfText는 AbortSignal 없는 전체 page 수집과 conversion/OCR 루트 결합. 그대로 쓰지 않고 U8 전용 page iterator에서 `getTextContent()` raw items/transform/hasEOL을 보존한다. U4 `rasterizePdf`는 새 PDF를 만들고 출력 정책이 달라 비교 엔진이 아니다. 렌더 helper·좌표 변환만 재사용.
- **추출 오류 직접 재현**: 입력 '김민수 서울 강남구 테헤란로 123' → '김민수堺서울堺강남구堺테헤란로 123'; '한글 라벨 주소 품목 설명' → '한글堺라벨堺주소堺품목堺설명'; 'ABC 123 456 office ffi' → 'ABC 塨塩塪 填塬塭 office ffi'. 설치된 PDF.js+공용 helper와 동일 pdf-lib/fontkit+전체 OTF로 생성, 원본 PDF와 script 보존. `test:qr-font-render`의 전체/subset **서로 같음**은 원문 정확성 oracle이 아니다. 임의 堺→space/한자→숫자 치환 금지.

## 비교 의미·입력 계약
1. PDF sniff/open만 요구하며 편집용 U4 pdf-lib 사전검사로 지원 PDF를 부당 거부하지 않는다. 암호는 v1 미지원으로 사용자에게 잠금 없는 사본 요청; 암호/손상/읽기 실패는 현지화된 코드로 구분. PDF 내 JS/첨부/외부 링크 실행·다운로드 없음. 주석/폼 appearance 포함 여부를 아래 렌더 정책으로 고정한다.
2. 페이지 대응 초기값 before[i]↔after[i], 긴 쪽 남은 페이지는 추가/삭제. 표시명 **“쪽 번호로 대응 / Match by page number”**. 사용자 mapping editor는 각 페이지 0~1회 소비, 순서 변경·빈 쪽(없음) 허용, 중복·모두 없음 차단. 매핑 변경은 결과 run 무효화 후 비교 재실행. 자동 문서 구조/페이지 이동 검출은 미지원.
3. 텍스트 문자열은 PDF.js raw TextItem 순서대로 `str` + `hasEOL`의 LF, 페이지 단위. normalize/공백 삭제/NFC/좌표 정렬로 입력을 몰래 교정하지 않는다. reading order는 PDF 내부 순서이며 다단·합자·회전에서 원문과 다를 수 있음을 안내. 영속 결과에는 페이지 문자열·요약·좌표 없는 diff만 보존한다. raw PDF.js 객체는 페이지 처리 종료 때 폐기한다. 선택 페이지 대조 시 재추출한 자체 최소 타입 `{str,hasEOL,transform,width,height,pageIndex}`만 선택 페이지 수명 동안 유지하고 선택 변경/unmount 때 해제한다. 텍스트 diff가 같아도 상태는 **“추출된 텍스트에서 차이 없음 / No difference in extracted text”**. 텍스트가 없는 이미지/빈 페이지는 **“비교할 텍스트 없음 / No text to compare”**, 페이지별 `beforeTextAvailable`/`afterTextAvailable`를 독립 기록(`items`의 비어 있지 않은 str 존재). 양쪽 available일 때만 diffText, 한쪽 또는 양쪽 unavailable이면 textComparison=unavailable이며 추가/삭제로 자동 해석하지 않는다. items0만으로 빈 종이/이미지 페이지를 구분하지 않는다. 양쪽 비어 있음으로 동일 판정 금지. 알려진 폰트 오류의 자동 감지 보장은 하지 않고 항상 한계 안내.
4. 시각 비교는 **동일 PDF.js 버전·동일 render 옵션 내 렌더 픽셀 차이**. source rotation·CropBox·UserUnit 반영한 viewport 사용. 96dpi(scale=96/72), DPR 독립 offscreen canvas, 두 canvas를 불투명 white로 초기화하고 render background white, getImageData RGBA에서 alpha=255 oracle을 확인하고 RGB만 비교, annotationMode=ENABLE, optional content은 기본 표시 상태. 서로 다른 크기는 큰 viewport에 좌상단 정렬한 흰 배경, 페이지 크기 변경은 `pageSizeChanged=true`로 별도 표시(둘 다 흰 여백인 차이는 RGB count0일 수 있으나 크기변경 상태는 유지)(내용 fit 확대 축소 금지). 픽셀 metric은 RGB 채널별 최대차 >16인 픽셀 수와 비교 canvas 전체 대비 비율; 임계값 16은 표시 민감도 기본값으로 0/16/32 선택하고 결과에 기록. 한 픽셀 이상이면 시각 차이; 정밀한 원본 의미의 동일성을 주장하지 않는다. 텍스트 결과와 시각 결과는 항상 분리.
5. canvas 한 변4096·면적 4096²를 넘으면 쌍 양쪽에 같은 scale factor로 **함께** 줄여 비교하고 실제 DPI/크기·낮아진 해상도를 UI/보고서에 명시. 한쪽만 축소 금지. raw RGBA는 before/after/diff 최대 3장을 동시 보유, 다음 쌍 전에 release. 전체 문서 canvas/이미지 목록 선렌더 금지. page text/compact summary만 저장하고 결과 preview는 선택 쌍만 다시 렌더. unpaired 페이지는 원본 썸네일과 추가/삭제 표시(차이율 null), 빈 가짜 페이지와 비교해 0% 오판 금지.
6. 쌍/페이지 순차 처리 concurrency1. 매 페이지/await/등록 전 abort/runId 검사, PDF.js render cancel+settle 후 cleanup; worker diff 동기 구간은 terminate. 완료된 page 결과 보존, 실패/취소/current 미완료는 unknown/canceled로 구분. 완료율은 처리 페이지 비율이며 canceled를 success에 합산하지 않는다. 새 입력/재실행/unmount 때 이전 task·URL·canvas width/height=0·storage 제거. 문서 로드/텍스트 추출 지연 동안 취소는 owner loadingTask.destroy로 종료한다.
7. 결과는 쌍/쪽 탐색, 좌우 보기·차이 overlay/불투명도(시각 차이를 색+텍스트로 표시), 추출 텍스트 삭제/추가, 변경 페이지만 보기. per-pair XLSX 보고서(C4)에는 입력명·page pair·mapping source·status·text availability·추출diff·pixel count/ratio·scale/threshold·warning·partial 여부. 두 결과 이상 C2+C3 ZIP을 지연 import. 변경 0건도 정상 보고서 1행의 요약을 남겨 빈 보고서 gate와 충돌하지 않게 한다. 원본/렌더 이미지 보고서 삽입은 v1 제외; 화면에서 대조한다.

## 정확도 게이트와 단계 분할
- U8-0: 현재 증거 fixture를 고정하고 독립 원문→PDF→PDF.js 문자열 기대와 Poppler 시각 대조. 오류 fixture가 **차이 없음(문서 동일)**으로 승격되지 않는지 검증. 정상 ToUnicode ASCII/한글 fixture의 원문 일치 golden, 문제 fixture의 실제 추출 문자열/상시 한계안내 golden, 동일 문제 PDF끼리 시각 diff0 golden을 분리한다. `extractionExact=false`는 원문을 아는 테스트의 관측값이며 업로드 PDF에서 원문 미상인데 자동 판정하는 제품 필드로 사용하지 않는다. 입력 원문 text oracle은 현재 3/3 불일치로 기록; U8은 시각 대조+정확한 제한 표시로 진행 가능하되 PDF 생산측 ToUnicode 수리는 backlog 별도 소유. 수정 안 된 오류를 '정확 추출' 지원표에 넣지 않는다.
- U8-1: page iterator/owned loading/cancel, mapping/textDiff/paired render kernel/report. 두 렌더러(PDF.js와 Poppler)에서 자체 동일 입력은 차이0, 변조 단어/숫자/색상/한글·빈페이지·이미지페이지 차이 검출(서로 다른 renderer 픽셀끼리 동일 요구 금지).
- U8-2: route·UI·ko/en/SEO/static/광고 경계와 취소/재실행/부분 결과.
- U8-3: 1/20/200페이지·페이지 삽입/삭제·동일 본문+다른 폰트·같은 렌더+다른 encoding·스캔/혼합·회전/CropBox/UserUnit·DPR1/2·손상/암호 fixture, 모바일 시각·메모리·heartbeat·초기/실행 요청량/증분 측정. 200p 정체·메모리 폭증은 실제값과 사유 기록 후 owner 단위 수리, 번들 상한 우회로 기능 축소 금지.

## 완료 기준 검증 명령
신규 `tests/pdf-compare-smoke.mjs`, `tests/pdf-compare-golden.mjs`, `tests/unit/pdf-compare.test.ts` 추가 후 실행(현재 없음).
```sh
npm run build
npm run test:unit
node tests/pdf-compare-golden.mjs
node tests/pdf-compare-smoke.mjs
npm run test:document-diff
TEST_SCOPE=word npm run test:browser
TEST_ONLY_HWP=1 npm run test:new-tools
TEST_SCOPE=pdf npm run test:browser
npm run test:pdf-finish-oracle
npm run test:static
npm run test:utilities
npm run test:recovery
npm run bundle:measure
```
기존 Word/HWP 97 골든·서식 diff·DOCX 웹 동치 oracle 불변. 검사기 음성 대조: 빈 페이지 누락·숫자 변경 삭제·scale 한쪽만 적용·abort 후 완료 등록·未知를 identical로 승격 각각 실패. 로딩은 기존 pdfPreview/helper를 재사용해 새 버전/중복 PDF.js 공급0; 정적 pdfPreview import가 JSZip 등 전이 의존을 가져오는 현실도 route/app 그래프로 계측. 사전 증분은 새 PDF vendor0, 신규 UI/worker/기존 shared 이동 **미측정**, U8-0 탐색→완성 재측정으로 채운다.

## 명시 제외
제품 구현/저장소 수정/commit/push/deploy(이번), OCR·자동 페이지 정렬/이동 검출·원문 정확추출 보장·의미적/법적 동일성·PDF/DOCX 변경추적 출력·PDF 편집/ToUnicode 수리·암호 해제·서버 업로드·번들 다이어트.

## 반박에서 뒤집힌 것
R1 sol 5건 수용: ①한쪽 텍스트 없음→양쪽 availability와 unavailable 비교 계약, ②raw 영속보관→선택 쪽 재추출·최소타입 단기 보관, ③정렬기 사용0 명시, ④정상/문제/동일문제 골든 분리, ⑤불투명 RGBA·RGB 비교 고정. 판단 변경2건(①②), 명확화3건(③④⑤). R2 독립 확인 완료, 이견0. 원문 미상 업로드의 추출 정확성을 자동 감지한다고 주장하지 않는다.

## 실행 기록 — U8-0 종결·U8-1 착수 (2026-09-13 Codx)

실행기준 U7release1df3c2e, d9c79b7 ancestry exit0 및 대상diff/열린계획 충돌 기록은 /tmp/worklazy-u8-preflight/evidence에 있다. 현행owned-load는 utils/pdfOwnedDocument.ts로 분리됐으며 동일계약으로 대조했다. 제품/의존변경 없는 sourceworktree clean; 고정입력/관련소스33건 SHA를 root가 직접 대조해 mismatch0.

합성8PDF10쪽에서 정상원문7/7 일치와 역사오류3/3 관측golden을 분리했다(역사원문정확성은0/3). 현재PDF.js6.2.108·Poppler24.02 각각 동일입력10/10 RGB차이0, 단어/숫자/한글/색상 변경8/8 검출. rawTextItems·원문기대·실제실행/첫python별칭실패127→python3성공0을 보존한다. 미래unknown상태금지 예시는 제품mutation검증이 아니며 실제코드검증은후속필수.

Gemini agy ae421f42/session19581 exit0, 고정12PNG 실제열람12/누락0/SHA변경0. 역사한글2쪽은시각공백정상, 역사3쪽숫자는정상숫자로읽히나두renderer모두넓은자간을관찰했다. 정상3종은원문문구와시각일치. 내부매핑원인이나전문서동일성의증거로확대하지않는다. REPORT: /tmp/worklazy-u8-gemini-visual/REPORT.md, coverage.json. root수용 /tmp/worklazy-u8-preflight/U8-0-ACCEPTED.json. 원오류PDF/생산측ToUnicode수리0, 새정확추출지원주장0.

사용자 까다로운코딩Astra 지시에 따라 U8-1의page iterator/owned취소/mapping/textDiff/paired render kernel/report 구현으로 이어간다. UI/route/최종통합/배포는 후속단계이며 현재완료아님. 화면·상호작용·간단검증은 Gemini 활용, Codex는실행/캡처와고위험제품경계에집중한다.

### U8-1 소스 고정·독립 검수 진행 — Codx

/tmp/worklazy-u8-impl에서 제품7+tests6 소스고정, 공유소스/의존수정0. author REPORT/API-HANDOFF/evidence/source-freeze.json을 root가 확인했다. coretsc/unit5/golden16시나리오22쪽/actualownedload·text·render·pixelworker취소·late·partial상태/supersedednull/selected양쪽independentcanvasoracle/XLSX3+ZIP2재열기/제품mutation5/범위productionbuild 통과. 최종현재합성입력 Poppler12self0·5변경검출도 실제실행. 전체app build/unit/static·UI·1/20/200/DPR2/CropBox/UserUnit등정본3단계 검사는후속필수로남긴다.

원실패·Vite설정경고·흰색imagefixture음성누락·render중owner해제순서보강은원로그보존; 소스변경과겹친golden04는무효기록후관련검사재실행. 최종render순서는cancel→settled→cleanup→destroy로실측. 입력/원문정확성/시각·문서동일성한계는유지. authorwriter중지후 /tmp/worklazy-u8-core-review 독립Astra가고위험표본만검수중이며 stage2 writer인계는그판정후다.

### U8-1 독립 검수 수용·U8-2 연결 — Codx

독립Astra가별도복사본에서실제두번째쪽getTextContent를영구pending으로만들고취소했다. 5초내종료/owner2destroy/완료·취소·미시작3상태/progress[0,1]을확인. 별도blank크기차표본은pixel0+pageSizeChangedtrue+textunavailable동시유지. 새XLSX2개를Python OOXML로재개방해상태·미완료pixel빈칸을확인했다. root가원자료 probe-results/reopen-results/end-identity의실제값을대조했고author HEAD/status/검사대상SHA는불변. /tmp/worklazy-u8-core-review/ROOT-ACCEPTANCE.json으로stage1수용. 새로운차단없음,전체검사중복없음.

후속 U8-2는Sol단일제품writer로 UI·한영·route/SEO/static·전용상호작용하네스를연결한다. 고정core7파일은기본불변으로유지하며실제핵심수리가필요하면Astra에게별도인계. GeminiFlash기존UI연결지도 /tmp/worklazy-u8-ui-reading/REPORT.md와ROOT-NOTES.md를활용, 실제화면검수는고정QA산출물에서별도수행한다.

### U8-3 DPR 한정 판정 — Codx

별도stage3고정core실증에서DPR1/2 geometry·96dpi는같으나비내장폰트색변경pixelCount3913/3973이다. 엄격crossDPR동등실험은실패로원로그보존한다. 동일DPR반복4표본각차이0,내장font동일기하crossDPR0,PDF를안거치는nativeArialcanvas도518픽셀(>16)crossDPR차이가재현됐다. /tmp/worklazy-u8-stage3-core/dpr-analysis.json. root의추가실증지시‘DPR동등’은기하와환경간pixel불변을너무넓게묶었다.

독립Astra /tmp/worklazy-u8-core-review/DPR-DISPOSITION.md가정본4의DPR독립canvas크기·공통scale/96dpi와환경간폰트픽셀불변보장을구별했다. 본래DPR독립해상도/동일환경sameinput0/변경분류계약은유지하며환경간정확pixel불변은새지원보장으로추가하지않는다. 제품/threshold/기대값완화0,strictcrossDPR원실패보존,현재브라우저환경의렌더결과이고기기/표시환경에따라차이율변동가능함을UI한계안내에반영하는조건으로해당쟁점종결. 최종전체DPR검증을PASS로덮어쓰지않는다.

기하대표6PNG는Flash actual6/6view/누락0/SHA불변으로문구CROP ABC123·색변화·회전·도형보존확인. /tmp/worklazy-u8-stage3-visual/{REPORT.md,coverage.json}. Poppler크기차관측을같은pixeloracle이나소스원인확정으로승격하지않는다.

### U8-3 고정 엔진 실증 종결 — Codx

/tmp/worklazy-u8-stage3-core/REPORT.md, HANDOFF.md, summary.json, source-freeze-end.json 및root수용문서보존. 새functional12(삽입/삭제·mixedimage·font/encoding분리·rotate/CropBox/UserUnit·손상/암호)와1/20/200쪽완료를확인. warmheadlessengine200쪽17.294초·heartbeatmax52.9ms;mainisolateendpoint/sampleheap과browser자손VmRSS합최대700980KiB는서로다른관측이며worker/native/공유중복·선행geometry잔류한계명시,실기기/전체heap보장아님. 전체실행은strictcrossDPRassert에서exit1였고해당실패보존;나머지raw결과와finalize독립assertexit0/정본DPR한정판정으로엔진범위수용한다. 제품수리/원본golden기대완화0.

7core/공유/의존SHA시작끝불변과현재UIworktree7core동일을root가확인. UI/모바일/표시환경한계문구·초기/실행네트워크·최종productionbundle/build/unit/static/소비자검증·배포는여전히후속필수다. 같은엔진벤치전체재실행은관련소스/입력/환경이바뀌지않으면요구하지않는다.

### U8-2 R3 시각검수·독립 비동기 차단 수리 — Codx

UI9장최초Gemini actual열람으로821px Dropfiles/Choosefiles겹침확인,root실제PNG대조수용후U8grid전환폭만국소수리. dark파일명캡처는class/localStorage조작이라실제dark입력미적용;공식prefers-color-scheme media로하네스교정,정식essential-only동의버튼후배너부재assert. sidebar침범추측은root원본상근거없음으로기각,전역UI수리0. addPair에기존result/preview무효화누락도수리했고구sourceaggregate11cb23… vs후속변경을분리보존했다.

R3currentsource/QA aggregate e5fcd18a…는root재현일치,HTML/entry/CSS/route/worker identity기록. UIactual17PNG/외부HTTP0/pageerror0·EN320/821/999/1000 문구/버튼교차0·키보드실행·ZIP2XLSX재열기. Gemini sameconversationb4c3120d session99581exit0 actual17/17/SHA불변으로local겹침해소·실제dark·선택/mapping/overlay/mobile/하단시각범위수용. /tmp/worklazy-u8-gemini-ui-r3/ROOT-DISPOSITION.md. 과거9장dark오표기와생산추적marker없는QAstatic exit1는정확히보존,productionstatic아직아님.

별도Astra실제UI경계검수에서차단2건: report준비중Swap→응답후구방향XLSX자동download(독립OOXML재열기), rerun로딩중기존results/download활성. 선택canvas교체정리는PASS. /tmp/worklazy-u8-ui-review/REPORT.md 및probe-results/stale-report.xlsx. Sol제품writer중지후사용자어려운코딩Astra지정에따라u8_core가두비동기수명경계만수리중. root최종UI/배포수용아직아님,같은재현만수정후검수하고전engine/시각전체반복금지.

### R4 수리 고정·최종 통합 착수 — Codx

Astra가 Page 한 곳의 generation·export abort/URL 수명과 rerun 즉시 결과 비움을 수리했다. Page SHA97602d69…, `/tmp/worklazy-u8-ui-fix/REPORT.md`·source-freeze-R4.json. 원R3 두 결함은 각각 baseline exit1로 재현했고 수정QA에서는 입력무효화7종+실제unmount의 늦은 download/URL/anchor click0, 현재방향 XLSX 및 명시취소 partial(complete5/canceled1/unknown194) 재열기 통과. verification01의 unmount 실패는 실제화면제거 전 응답을 풀었던 검사타이밍이며 제품재수정 없이 실제detached대기 후 verification02 exit0, 원실패유지. core7·JSX/style불변, R3 Gemini actual17장 시각검수 재사용.

수리writer 종료 후 동일 Astra reviewer가 별도 R4 복사본에서 원래 두 경계만 독립 확인 중. Sol은 현재 제품수정 없이 최종 production build/unit/static·영향 inventory/utility/recovery/bundle 요청검사를 시작한다. `/tmp/worklazy-u8-final/REUSE-VERIFIED.md`의 실제로그+관련소스/의존비교로 document-diff/Word/HWP/기존PDF 범위를 재사용한다. PDF finish oracle은 이전 실행귀속/브라우저환경 동일성 입증부족으로 named검사 1회 재실행, 전체 U4 회귀로 확대하지 않는다. 최종 통합·배포/라이브는 아직 완료 아님.

독립 R4 확인 종결: `/tmp/worklazy-u8-ui-review-r4/REPORT.md`, 원래 두 지연경계 probe exit0. 무효화 후 download/URL/click0, rerun 중 old result/download0, 새방향 XLSX 이름 일치. 같은 QA 취소 보고서를 별도 OOXML로 읽어5Complete/1Canceled/194Unknown 확인(브라우저 재실행 아님). source/test/build/artifact freeze10과 HEAD/status/Page+core7 불변. root가 보고서/정확한 대상 수용했으며 같은 경계의 추가 검수는 종료한다. 최종 통합은 Sol이 계속 담당한다.


### 최종 배포·라이브 종결 — Codx

Release `9fa435ae6be5c92b05f9032479d1f7298899b76b`, Pages `34719374659` build/deploy success. 최종543unit·159recovery·production77pages/static·utilities·currentPDFfinishoracle·bundle와 R4독립경계/원시각17장 재사용 수용. 실제 CI artifact10305459086의 HTML3/entry/CSS/U8route/compareworker/PDFentry/worker9개가 live bytes/SHA일치, essential-only합성PDF비교와7338B XLSX 재열기2행/양입력명일치, 외부HTTP0/pageerror0. 원요청graph2실패와 globalvisual의 기존U6누락7 exit1, strictcrossDPR실패는 그대로 보존한다.

root는 release로 ff-only 동기화했고 사용자유지보수SHA/상태불변. 정본과 종결증거는 이 archive 및 `closure-evidence/CLOSURE.json`에 보관한다. 다음 U9는 이 release와현행도구inventory/열린계획 게이트로 착수한다. PDF파일명 숫자축약 요청은 별도대기, UI재기준화→UIv3→B1/실제B2재왕복·용량정리맨마지막 순서유지.
