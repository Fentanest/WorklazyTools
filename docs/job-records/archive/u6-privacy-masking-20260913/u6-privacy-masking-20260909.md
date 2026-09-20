# U6 문서 개인정보 마스킹 — v4 실행 정본

현재 실행 상태: **완료 — P0~P3·UI·최종 통합 검수, 배포 및 한·영 라이브 사후 확인 종결.** 기준 HEAD `fa0bef7e20e1a578fb37805b60d74e39c9a69b86`. 사용자 todo 실행 지시로 과거 계획 라운드의 구현·배포 금지 문안은 대체되며 단계별 기술 검증과 배포 전 검수는 유지한다. 이번 U6의 한정 Astra 대행 재검토 근거와 최종 정정은 본문 마지막 v4 채택 기록이 우선한다. 원 계수28 정책이나 전체 제품 완성을 통과로 바꾸지 않는다.

## v3 수립 당시 기록 (아래 당시 상태는 현 실행 상태가 아님)

상태: **조건부 상세 정본 — sol R3 이견 0.** 이번 라운드 구현 금지. 작성 Codx.
기준 HEAD d9c79b7a16f5b99fa7cddfde741b8d10f08f07d0 (s3-pdf-finish). 지정 d3a8d89 이후 main 통합 영향 존재. 상위 new-tools-roadmap의 C1~C4·지원범위·공통 완료 기준, roadmap-completion의 S4 순서 유지. U4 배포/사후확인 후 착수 직전 해시·의존·번들 재확인. 이번 지시로 미래 코드 착수까지 승인됐다고 해석하지 않는다.

## 제품·입출력 계약
URL `/tools/document-redactor`, ko/en. PDF·JPG/JPEG·PNG·정적 WebP 다중 입력. 브라우저 내부 처리·원본 불변. 이번 첫 버전의 기능은 사용자가 직접 지정하는 불투명 검정 사각형 마스킹이다. 영역 추가·이동·크기 변경·삭제·undo/redo·페이지 이동·확대 및 결과 재열기 미리보기. 좌표 숫자 입력과 방향키/Shift 방향키, 영역 추가/삭제 버튼으로 drag 대안 제공. 자동 개인정보 탐지/OCR·흐림·모자이크는 지원 표시하지 않는다(자동 탐지 요구가 원 프롬프트에 존재하면 별도 쟁점으로 돌리고 임의 축소하지 않는다).
PDF는 입력당 모든 페이지를 새 PDF로 재생성. 표시한 영역만 검정으로 덮은 **래스터 픽셀**을 새 PDF image stream으로 넣고 원본 객체·텍스트·폰트·주석·폼·첨부·레이어·metadata를 복사하지 않는다. 선택하지 않은 페이지도 raster로 재생성하여 원문 구조가 남지 않는다. 이미지 출력은 모두 PNG(정규화한 표시 방향, 새 encode, metadata 복사 없음). PDF 출력은 PNG 래스터만(손실 압축 경계 오염을 피함), 텍스트 검색·복사/서명/양식·링크/원본 메타데이터 소실 안내 ko/en 필수. PDF 결과의 검색 텍스트는 모든 페이지 0.
무마스크 파일은 출력 차단(최소 1영역); PDF 일부 페이지 무마스크는 허용하되 검수 목록으로 표시. 원문이 다른 곳에 반복되는지 자동 검출 보장하지 않음. 최종 사용자 확인 후 export. 성공=가린 영역 픽셀·새 PDF 구조·재열기 검증 통과. 검증 실패는 현재 파일 결과를 게시하지 않고 구체적인 행동 안내만 표시.
파일명은 원문 개인정보를 결과명에 재사용하지 않고 `redacted-001.pdf/png` 기본값. 사용자 편집 결과명은 C2 검사. 실패 목록도 기본 문서번호를 쓰며 원시 text/bytes/영역 내용을 로그·URL·storage로 보내지 않는다. 결과2개 이상 C3 ZIP; ZIP은 검증 성공 파일만, 실패개수 별도 표시.

## 재사용 경계와 구현 파일
신설 `src/features/document-redactor/{DocumentRedactorPage.tsx,types.ts,geometry.ts,input.ts,engine.ts,verify.ts,redactorClient.ts}`. PNG 인코딩/렌더는 브라우저 지원 경계 확인 뒤 main canvas, PDF compose/structure verify는 **main의 lazy pdf-lib core 공급**으로 확정한다. 신규 redactor worker에 pdf-lib를 다시 번들하지 않는다. PDFDocument 객체를 realm간 넘기지 않고 Uint8Array와 숫자좌표만 전달한다.
`src/features/pdf-editor/pdfPreview.ts:35-76`의 openOwnedPdfDocument는 취소 가능한 owned load이지만 JSZip/Tesseract를 함께 가진 넓은 모듈이다. 필요한 owned loading/render lifecycle만 중립 utils로 추출하고 원래 PDF/QR 경로의 출력/에러를 보존한다. `finish/raster.ts`는 가리기 callback도 결과 verify도 없어 그대로 안전 마스킹 엔진으로 사용하지 않는다. `canvasPolicy.ts` 순수 치수 계산만 재사용하며 U4의 photo-scan 압축계수를 U6 PNG 크기 보장으로 재사용하지 않는다. C2 안전 파일명/C3 ZIP·cooperativeCancel·operation progress 재사용, feature별 결과 URL 수명주기 유지. fontkit 필요 없음. 대형 ImageStudio/Fabric/OCR 엔진 import 금지.

## 좌표·렌더·구조 안전 계약
1. 영역은 pageId 및 **PDF.js rotation/CropBox/UserUnit 적용 후 표시 페이지**의 정규화 좌표 x/y/w/h[0,1]로 저장. 이미지 EXIF orientation은 decode 시 한 번만 적용. viewport inverse/forward 변환은 공용 geometry 순수 함수. devicePixelRatio/CSS zoom은 저장 좌표에 포함하지 않는다.
2. render 완료 → clamp한 x0/y0 floor, x1/y1 ceil → 사방 2출력픽셀 확장 → globalAlpha=1/source-over/검정 fill → PNG encode 순서. 빈/NaN/Infinity/역전 사각형 거부. 영역 overlap union. 미리보기 overlay와 export 픽셀 검사는 같은 좌표 계약, 데이터 경로는 독립 oracle로 검증.
3. PDF default 150dpi, 200/300 선택. max side4096 및 area4096² 초과 시 자동 DPI 하향하지 않고 줄일 해상도를 안내해 사용자가 다시 선택. 150도 넘으면 파일 unsupported. 입력 최대20파일/파일32MiB/배치64MiB, PDF 최대100페이지/전체200페이지, 이미지16MP, 파일당 최대1000영역. 이는 초기 보수적 제품 상한(실측 지원 보장이 아니며 하한 실기기 검증 필요). 시작 전 표시하고 boundary±1 단언.
4. 하나의 작업만, 한 페이지씩 render→mask→encode→embed→release. 활성 canvas1+검증 canvas1 이하(원문 preview는 export 전 해제). 별도 JS 배열에 페이지 PNG를 누적하지 않고 embed후 caller참조를 해제. composer내 encoded stream 보유분은 아래binary ledger에 포함. **아래명시한 소유binary 항목 동시합128MiB 장부상한**; 브라우저전체heap 상한이 아님. 등록 전후 확인. OPFS/IndexedDB/CacheStorage에 파일 데이터 저장 금지. quota/할당 실패는 현 파일 실패·다음파일은 사용자 재실행; 취소는 배치 중단, 이전 검증 성공 결과만 유지. JS heap 모든 내부할당을 이 계산이 보장한다고 쓰지 않는다.
5. encrypted/password PDF, XFA, 비정상 CropBox/UserUnit, 지원불가 decode/애니메이션·손상은 유형별 거부. 추가 action·외부 이미지 요청·JavaScript 실행은 금지. 새 output PDF catalog 최소 Page tree+image drawing만. PDF create의 기본 metadata도 사용자정보 없음으로 검증하고 원본 객체부재는 아래parser allowlist로 단언. 원본 첨부/이름/URL/문자열 sentinel 검색은 합성fixture의 비image구조 보조검사이며 binary우연일치를 제품검증실패로 처리하지 않는다.
6. 생성된 결과를 PDF.js로 다시 열어 페이지수·치수·텍스트0·masked pixel black 및 마스크밖 RGBA 보존 검사(아래v2 수치). 전체 이미지를 다시 decode하여 masking pixel/마스크밖 RGBA 보존 검사. production은 원본bitmap과 결과를 같은 렌더좌표로 아래전체픽셀기준에 비교한다. sentinel은 합성fixture 음성대조에만 사용한다. 결과 URL 생성은 검증 뒤, 실패/취소/새실행/unmount에 revoke. stale requestId의 progress/result 무시, PDF loadingTask/renderTask·worker 종료, 재실행 성공 검사.

## 파일이 브라우저 밖으로 나가지 않는 계약
단순히 API를 만들지 않는 것으로 완료하지 않는다. `AppShell.tsx:69-70` 현재 일반 route는 광고/분석 로더가 살아 있고 이미 실행된 외부 스크립트는 unmount로 취소되지 않는다. U6는 **광고·분석 없는 별도 전체 문서 진입**으로 만든다. 일반 페이지에서 U6 진입은 hard navigation, 파일 input은 깨끗한 전용 document marker 및 자산 준비 완료 후에만 mount한다. 뒤로가기/BFCache·언어 변경도 해당 경계 준수. 격리 문서 의미/광고 상태는 사용자 화면에 노출하지 않는다. worker COI 요구는 없으므로 서비스워커/서버 header를 전제로 하지 않는다.
전용 정적 HTML의 초기 inline CSP와 loader deny 분기에서 외부 connect/script/image/font/object/frame/form 전송을 막는다. 필요한 JS/CSS/폰트/worker는 same-origin 고정 정적 URL만 허용; 원문 기반 URL fetch는 금지. 최초 파일 선택 전에 모든 필수 자산을 로드·완료 대기하여 준비 상태 표시. 파일 선택 이후 PDF/image/ZIP의 모든 처리에서 **새 네트워크 요청 0**(same-origin 포함)을 단언. Blob 내부 동작은 네트워크 요청과 별도 기록하며 외부 전송으로 세지 않는다. 최초 진입의 고정 정적 자산 다운로드와 개인정보 업로드를 혼동하지 않는다.
테스트: production(LOCAL_QA unset)·동의 granted/denied·신규 직접진입/광고 로드된 홈→U6/뒤로→재진입×ko/en. request listener는 context와 worker/SW에서 시작 전 부착; HTTP(S)·WebSocket·sendBeacon·XHR·fetch·form/navigation·image ping을 포착. 외부는 진입부터0, 파일 input enable 이후 HTTP(S)0. 연결 차단으로 요청이 실패해도 **시도**가 있으면 실패. 네트워크를 막고 upload/mask/export/reopen/ZIP/cancel/retry가 성공해야 함. 누출시도 mutant를 넣었을 때 검사 exit1을 증명. 원문 synthetic canary가 요청 URL/body/headers·console·storage·보고서에0. source 광역 전송API 감사도 함께 실행하고 테스트의 진단용 false positive는 exact file/owner/purpose 예외로만 관리.

## 단계·번들
P0=안전/번들 탐색, P1=입력·좌표·렌더·verify 순수 엔진, P2=UI/취소/다중/ZIP, P3=등록/격리/검수.
P0 기존 PDF.js/pdf-lib 재사용 graph를 /tmp 탐색 build로 측정, entry/route/shared/app/CSS 전부 기록. lazy route는 필수이지만 app 총량의 여유를 만들지 않는다. d3 기준 app2,507B 여유로 이 도구가 들어간다고 주장하지 않는다. 고정 baseline/상한/override{}/multiplier1 유지, 최종 초과면 SCOPE-OUT(상향 요청 금지). dedup 투자를 자동 선행 승인하지 않는다.
P1 신규 gzip app +5~12KiB, P2 +6~12KiB, P3 entry/locale +2~6KiB, CSS +1~3KiB, 총 app +13~30KiB는 **설계 추정**. 기존 PDF 의존 route→shared 이동은 실제 새 bytes와 별도 계측. 탐색 재사용 footprint/empty route bytes는 최종 구현 예산 보장이 아니다. U4 종결 후 고정 5종 잔여가 추정범위를 수용하지 못하면 구현 착수하지 않는다.

## ko/en·배포 표면
등록 current20→21은 expectedToolIds에도 독립 추가. toolRegistry/seoByPath·양어 feature locales/tools/seo·social image generation·static route 목록·sitemap·FAQ(래스터로 텍스트 소실, 수동 선택 범위, 해상도/크기, 원본 불변)·canonical/hreflang·unprefixed redirect 동시 반영. 라벨: 개인정보 마스킹 / Document redaction, 영역 추가 / Add area, 결과 확인 / Review output, 파일 처리 준비 중 / Preparing file tools. 오류는 손상/미지원/크기 제한/취소/검증 실패 코드→양어 고정문구. 파일 원문·내부 Worker/runtime/원시 예외 메시지 UI 노출 금지.

## 합성 fixture와 완료 명령
신설 `scripts/generate-redactor-fixtures.mjs`는 seed 고정 합성만: 영문/한글·회전0/90/180/270·CropBox offset/UserUnit2·텍스트/이미지겹침·주석/링크/첨부/metadata canary·OFF layer·양식·암호·손상·EXIF8방향·alpha·애니메이션 WebP 거부·다중 실패. `dummyfortest/` 및 사용자 문서는 읽거나 fixture로 쓰지 않는다. 아래 신규 명령/파일은 구현단계에서 작성하고 실행할 계약이며 지금 이미 존재/통과했다고 주장하지 않는다.
```sh
node scripts/generate-redactor-fixtures.mjs --out /tmp/worklazy-redactor-fixtures
npm run build
npm run test:unit
node --experimental-strip-types tests/redactor-golden.mjs
node tests/redactor-smoke.mjs
node tests/redactor-network.mjs
node tests/redactor-negative-controls.mjs
node tests/tool-registry-routes.mjs
npm run test:new-tools
npm run test:pdf-finish-oracle
npm run test:static
BUNDLE_BASELINE=docs/jobs/todo/canon-rounds-20260909/bundle-baseline.json BUNDLE_BUDGET_MULTIPLIER=1 BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-canon/u6-budget.json npm run bundle:measure
```
음성 대조: 검정 overlay만 남기기/원본 page copy/마스크 생략/좌표 DPR중복/검증 skip/원본 metadata복사/외부 beacon/늦은 result 게시를 각각 정확히 주입→exit1, control0. 코딩 뒤 astra는 지정 목록 외 독립 회귀를 재현한다.
시각/접근성은 empty·영역선택·처리·결과·손상·취소를 ko/en×light/dark×desktop/mobile 및 EN320에서 확인. 기존 a11y incomplete는 합격으로 합산하지 않고 inherited와 new 분리; 신규 위반0·CLS≤0.1. 병합직전 이월: 전체 browser/utilities/office/QR/PDF 영향회귀·2locale visual·a11y/rendering·production privacy 격리·Gemini 로컬 전수 시각. 매 단계 되돌림/기존 PDF byte oracle/게이트 건전성/사용자 파일처리 경로 재현은 축소 불가. 기존 결함은 부모 대조 backlog, 새 개인정보 유출/변환손실 차단.

## 명시 제외
DOCX/HWP/HWPX/자동AI·OCR탐지/클라우드 API/내용 보존형 PDF redaction/원본 수정/브라우저 영구 저장/폰트 재서브셋/UI전면개편/U7·U8 상세/배포. PDF OCR 검출 보장·완전 개인정보 탐지 표현 금지. 이번 산출은 ignored 계획서뿐이며 추적 파일 수정·커밋·main 병합·push 없다.

## 반박에서 뒤집힌 것
R1 교차7항 전건수용, 뒤집힌판단7건: production sentinel→전체RGBA수치 oracle, 전체메모리로 읽히는128MiB→소유binary장부와rawRGBA분리, PNG누적금지→caller배열금지/composer보유계측, 단순preload→worker/render/compose/ZIP실제warmup, CSP로시간경계보장→정적외부금지+warmup/request계측+PWA분리, 문자열검색→parser최소구조, 모호viewport→단일top-left정규화와EXIF8방향. 별도sol4항은 중복이므로건수에더하지않는다. P0 lazy지정만으로예산성립이라는전제는root탐색에서추가폐기(별도1건), R2재확인대기.

## v2 정확한 검증·수명주기 (위동일항목을 구체화)
### 좌표·EXIF
저장평면은 PDF.js `page.getViewport({scale:1})`가 반환한 rotation/CropBox/UserUnit적용후 top-left평면. 이 반환크기외에 원PDF회전/offset을 재적용하지 않는다. preview canvas content-box의좌상단/실제폭높이(패딩·테두리·letterbox제외)로 pointer좌표를정규화. `normalizedToPixelRect(viewportSize,rect)` 순수함수만 preview/export가 사용: x0=floor(x*ceil(width)),y0=floor(y*ceil(height)),x1=ceil((x+w)*ceil(width)),y1=ceil((y+h)*ceil(height)); clamp→2픽셀확장. mask기록은이미정규화되어있으므로DPR2/zoom에따른추가배율0. mask검사는 원지정rect 전픽셀+확장1px가black인지, 2px외부를비교(최외곽1px은렌더경계guard).
이미지는 `createImageBitmap(file,{imageOrientation:"from-image"})`로 한차례 decode하고 bitmap.width/height평면을정본으로삼는다. 별도EXIF transform없음. bootstrap의합성8방향probe가실패하면 해당브라우저의image입력을비활성화하고 양어지원안내; HTMLimg와수동EXIF를섞는fallback없음. animation WebP는 RIFF ANIM/ANMF chunk검사로거부; PNG acTL animated도거부. MIME/확장자보다signature와실제decode결과를확인한다.
### production 전체픽셀검증
동일PDF.js버전과동일dpi/ceilviewport/배경white로 source페이지를다시render하고 output새PDF를다시render, 한페이지씩비교한다. PDF마스크내부 원rect+1px는 모든RGB0/alpha255(실제encode픽셀도완전검정), 가장바깥guard1px는대조에서제외. 마스크외부의채널절대오차>2인pixel비율≤0.001, 전체외부채널평균절대오차≤0.25(0~255스케일), 페이지수/치수exact. PNG는normalized sourceRGBA와decoded outputPNG를비교, alpha도동일기준. source는export마스크그림을재사용하지않고재렌더/재decode하여가림누락을독립검출한다. 위수치는초기품질계약이며실측통과라고주장하지않음; 지원fixture가실패하면임계완화없이P0미통과, 원인/지원제외근거로재왕복한다. 테스트sentinel은검정영역보존·원문소실mutant의구분검출용이다.
### PDF구조와image검증
PDFDocument.create후입력객체copyPages/loadintooutput없음. output metadata는generic producer/creator고정, title/author/subject/keywords/날짜사용자유래값없음. `save({useObjectStreams:false})`를U6출력에만사용하여최소구조를단순화(legacy출력설정변경0). parser검증은최종bytes에서Catalog(Type/Pages만),Pages(Type/Kids/Count/Parent),Page(Type/Parent/MediaBox/Resources/Contents),Resources(XObject/ProcSet만),Contents(stream),Image XObject(Type/Subtype/Width/Height/ColorSpace/BitsPerComponent/Filter/Length/DecodeParms만),trailer(Size/Root/Info/ID)의정확key허용목록을쓴다. 필요없는pdf-lib기본키가있으면생성기에서없애며승인없이목록확대금지. PDF각페이지는opaque RGB image정확1개·SMask0·Mask0, fonts0, Contents operator는 q/Q/cm/Do만이고 Do정확1회. /Annots/AcroForm/Names/EmbeddedFiles/OpenAction/AA/JavaScript/URI/OCProperties/XFA/Metadata·원본첨부전부0. 최종PDF는위구조및모든 페이지 image비교통과후만게시한다. image출력PNG는IHDR/IDAT/IEND만허용하고sRGB/gAMA등고정비식별encoder필수chunk는정확키/목적으로만목록화; eXIf/tEXt/iTXt/zTXt및원본metadata0. metadata strip은PNGchunk재조립/CRC검증으로하며압축pixel데이터는변경하지않는다.
### binary장부·raw리소스·실패
원본File.size합64MiB는입력작업량상한. 128MiB binary장부항목은 owned input ArrayBuffer(복제마다),pdf-lib에embed되어남는페이지압축stream길이,save결과Uint8Array,published Blob,ZIP output,verify의재읽기ArrayBuffer다. 같은ArrayBuffer view는identity로1회,Blob은물리공유보장이없어별도크기로보수계산. pdf-lib문서내raw PNG채널정보나object overhead는정확heap보장밖이며별도계측한다.
reserve-before-allocate: input은size,render/verify는rawRGBA별도장부에4*W*H,PNG/save의알수없는출력길이는아래R2 conservative cap계약으로예약하고반환뒤actual길이를검사한다. 이예약은수학적상계/할당성공/전체heap보장이아니다. 예측밖할당실패는명시catch로파일실패. outputBlob/verify복제는알려진outputlength로reserve. 한페이지source/output verify canvas는각1,동시rawRGBA≤128MiB; UIpreview export전에release. 할당못하면이전검증성공결과만남기고배치를중단,사용자재실행으로이어감. ZIP은C3 entry순차스트리밍을쓰더라도최종Blobreserve(성공file bytes합+entry당65536+1MiB)가128MiB장부를넘으면생성하지않고개별다운로드를안내;2개이상ZIP제공은이명시상한내에서만지원. 복사+압축크기초과로ZIP실패해도개별결과보존. 스트리밍PDF새writer/OPFS 도입은이번제외;작업중장부상한에걸리는파일은용량제한으로중단.
### network0의시작점·PWA·warmup
U6전용문서는처음부터광고/분석컴포넌트mount0,main의registerServiceWorker호출을전용marker/정규화exactpath에서생략. 이미root PWA controller가있는진입도시험하고U6에서새SW register/update0;service-worker.js의기존fetch handler는U6문서/처리용cache추가없음을검사한다. CSP는시점별same-origin금지기제가아님. 초기CSP에서외부origin금지(script/connect/img/font/media/worker self및필요blob만,object/frame/form none,base-uri self), bootstrap용inline은빌드시고정hash nonce없는정적목록. connect self는정적필수자산준비때만사용하는코드경계,사용자file기반fetch/form/이미지src없음. `window` API monkeypatch를보안경계로삼지않는다.
input enable전: PDF.js import→**공유PDFWorker 1개명시생성**→고정합성1page getDocument(worker주입)/첫render→PNGencode→pdf-libcreate/save→리오픈→ZIP module import 및1entry생성. loadingTask/renderTask는종료해도sharedPDFWorker를유지하여다음입력때새worker fetch가없게한다. PDF.js의font/cMap/wasm 필요자산은준비manifest에고정하고in-memory factory로제공;준비manifest는사용자의PDF정보로만들지않는다. 새네트워크fetch가필요한format/font는처리중fallback요청대신지원불가로실패. factory/worker조합의현행API실측은P0완료조건이며실패하면네트워크0을완화하지말고P0차단. ZIP은worker사용을끄는공용옵션을확인하거나warm worker를세션동안유지;무조건전역공용ZIP설정을바꾸지않음.
warmup전부터page/worker/SW/cspviolation/ws listener설치,requests-inflight0 및준비manifest모든 자산완료후input enable. 선택뒤**앱에서유발한새HTTP(S)/WS시도0**를검사;CSP가차단한시도도실패. browser자체update통신을앱처리요청으로오인하지않고CDP initiator/target을기록. 원본/결과persist0는File/Blob/URL과명시로컬download를제외한storage감사로입증;sharedworker도unmount/문서이탈때terminate. partialresult와 warmresource의owner/token를 분리하고 늦은결과게시0.

## P0 실제탐색결과와착수차단
명령: `BUNDLE_SOURCE_ROOT=/tmp/worklazy-canon/u6-probe BUNDLE_ROUTES=document-redactor BUNDLE_BASELINE=docs/jobs/todo/canon-rounds-20260909/bundle-baseline.json BUNDLE_BUDGET_MULTIPLIER=1 BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-canon/u6-explore.json node scripts/measure-bundle-budget.mjs` (실제실행에서는동일SHA원본/tmp baseline경로).
synthetic lazy route가 PDFDocument+openOwnedPdfDocument를참조: entry314150/PDF신규route337/shared1956934/app5944172/CSS38242B. 현control대비entry+107/app+156. 고정baseline shared순증244935>30720/app100457>96000으로exit1. 코드구현량의추정자료가아니며광범위재사용모듈의귀속변경이실패함을증명한다.
**구현착수조건**: U4종결+고정5종잔여확보, 그때별도/tmp P0사본에서narrow owned PDF helper·pdf-lib공급·prewarm프로토타입(제품기능구현전)을측정해5종exit0 및warmup후network0를확인. 실패면scope-out후근거재왕복, 임의상한상향·P1착수금지. 현재 U6 전체실행가능/예산통과/모바일상한실측완료라고선언하지않는다. 이문서는지원/검증/차단조건의상세계약이며 P0기술게이트를미리통과시킨정본이아니다.


## R2 추가 반박 수용 — encode/save 예약은 실측 제품제한
U6-XR2-01 수용, 뒤집힌판단 추가1건(교차총8건,별도lazy실패1건): raw+0.1%+64KiB를PNG의수학상계로쓰던식을폐기한다. 브라우저canvas encoder/pdf-lib save의내부할당은소유한compressBound가없으므로 **알수없는출력할당을미리완전히제한한다는hard보장도하지않는다**.128MiB는등록과다음단계진입을거부하는장부한도이며예측못한일시peak는보고하고실패처리한다.
P0필수산출 `redactor-resource-policy.json`은same browser버전별 seed고정opaque noise/alpha noise/gradient/text의치수1/1024/2048/4096,PDF1/4/16페이지에서 PNG actual/raw ratio 및save actual/retained ratio를기록한다. 제품계수정의: `pngFactor=max(2,ceil(maxMeasuredPngRatio*1.25))`, `saveFactor=max(2,ceil(maxMeasuredSaveRatio*1.25))`, 각cap=`ceil(factor*rawOrRetained)+1MiB`. corpus·seed·버전·전수raw/max·계수·script SHA와독립재측정을첨부하고P0반박에서고정. 이절차가산출할값을현재실측값이라고쓰지않는다. 신규브라우저/encoder차이가cap을넘으면현재파일폐기·미지원안내이며계수를런타임자가확대하지않는다.
P0이전에P1착수금지,계수/입력fixture/동시계상이확정되지않으면P0미통과. 현재design budget은binary≤128MiB,rawRGBA≤128MiB,**binary+rawRGBA동시합≤192MiB**(canvas backing store를raw쪽에서1회만계상)이다. 모든known-size객체는예약전검사,encode전은기존binary+canvas raw+pngCap,save전은existing binary+saveCap,verify전은existing binary+source/output두canvas raw를192MiB와대조한다.4096²두canvas=128MiB는raw하한내등호허용하되binary가64MiB를넘으면동시합게이트로시작거부. equality는모든상한에서허용(<=),+1byte는거부한다. 실제encode/save결과가cap또는장부한도를넘으면즉시reference해제·현파일result0,이전검증성공result보존. wasm/JS내부heap·GPU추가복제는보장이아니며실기기peak/OOM과함께P0에기록한다. 실기기검증미실행상태는모바일지원보장으로표현하지않는다. R3재확인대기.


## 최종 정본화 기록 — 2026-09-09, Codx

실제 `gpt-5.6-sol` 구현자 반박 3회, 수정/철회한 판단 9건. 마지막 독립 판정: `/tmp/worklazy-canon/reviews/u6-r3.md`. **이견 0의 범위: P0 가능성 판정 절차와 상세 지원·검증 계약의 정본이다. 현재 예산/네트워크/자원정책 탐색이 완료됐다는 뜻이 아니며 P0 전제 미충족 상태에서 P1 착수는 금지한다.**
상단 정본 상태와 이 최종 기록이 본문의 과거 “재확인 대기” 기록보다 우선한다. 상세 계약은 최종 v3/v4의 추가 정정이 같은 항목의 이전 문안보다 우선한다. 제품 구현에는 착수하지 않았다. 공통 기준 해시 게이트·열린 계획 소유권·고정 예산은 `canon-rounds-20260909/GATES.md`를 함께 읽는다.

## 2026-09-09 P0 실행 개시 — Codx

U4 release83f210406fbedae41632ed77edffe2db058cae63/Pages34321552862 성공및live종결. /tmp/worklazy-u6-preflight/EXECUTION-GATE.json으로기준차이확인. 기준d9이후해당surface변경은bundle기본상한해제/PdfFinishPanel포함UI및notice/워터마크폭/thumbnailworker글꼴연결;package/lock및pdfPreview좁은helper기준동일. 기존용량상한구문은사용자기본5null결정이대체하며고정baseline SHA/override{}/multiplier1/물리inventory는유지. U7/U8/U9/UI/B2는동시제품구현하지않는다.

P0기술prototype는/tmp/worklazy-u6-p0(base83f2104),계수실증은/tmp/worklazy-u6-resource-policy에서별도Astra담당. 원제품추적파일변경없음/P1미착수. root독립1pxPNG실측88B/raw4=22→정본factor하한28,일반A4 150dpiPNG예약244,840,544B>binary128MiB라는계약문제발견. 식을임의변경하거나P0통과로쓰지않으며전수실증/Claude·Astra재검토대기. 세부실행지시서/tmp/worklazy-u6-preflight/P0-TECH-DISPATCH.md·P0-RESOURCE-DISPATCH.md.

### P0 전수 자원 실증 중간 판정 — Codx

2026-09-09 Chrome152.0.7977.64/pdf-lib1.17.1에서 정본80 corpus 전건 실행, PNG368관측/save48관측. max22.25/22.12962962962963 → 정본 pngFactor28/saveFactor28. root 독립 전수 재집계 및 실제 최대대표2건 재실행 일치. 일반A4 150dpi PNG예약244,840,544B>binary134,217,728B, raw동시합253,547,400B>201,326,592B이므로 현 정책 기본처리 실증 미통과. /tmp/worklazy-u6-resource-policy/initial-run 및 /tmp/worklazy-u6-preflight/RESOURCE-CONTRACT-FINDING.md 참조.

기술prototype의 최초 production24조합은12개 재렌더외부픽셀 기준 실패. 또한 전체canvas테두리1px를 검사에서 제외하는 검사기 구멍을 root가 변이로 재현했으므로 이 결과는 최종게이트가 아니다. 가장자리 전체검사 교정·pixel grid 매핑 원인실험 및 별도최종재검증 진행 중. 임계완화/문서치수변경 없음. 자원실증과 기술prototype 모두 제품실행/모바일상한/전체메모리보장 PASS가 아니다.

Claude Opus/Sonnet 실제 연결은RESOURCE_EXHAUSTED(reset 약10:32UTC), 재왕복 판정 미수신. 고정1MiB 여유를 분리하는 계수식 후보를 실측표에 대조하는 검토자료는 준비 중이나 채택/정본대체/제품P1 착수 승인 없음. 현본 P0미통과 조건을 그대로 유지한다.

### P0 최종 실증 판정 — 재왕복 대기 (Codx)

최종기술24/24 및root별도4회·독립Pillow28쌍은외부오차0/내부검정/치수exact/text0/최소구조통과. EXIF8·이미지3형식·factory3종실사용·legacy44diff0·정확inputenable1cycle새HTTP/WS/CSP0 및0.322ms뒤요청음성검출을확인했다. 초기12품질FAIL/테두리검사기누락/2회CDP시간경계검사실패는보존했다.

전체P0는미통과: ①정본자원식28/28로기본A4예약이한도초과 ②원bundlemeter가rawJS3자산을main/modules로오분류해공식report미생성 ③실제처리경로장부예약·동시소유·초과실패의통합실증미완료. 고정baseline/meter불변,제품P1/코드반영/배포없음. 후보식2/2는독립전수검토한미채택안. Claude두모델사용량한도로재왕복판정없음. 자세한근거는/tmp/worklazy-u6-preflight/P0-RESULT.md, 추적판정기록은docs/review-notes.md,기존검사기결함은docs/backlog.md. 후속U7→U8→U9→UI→용량정리순서는유지한다.


### P0 재검토 2차 — 번들 검사기 호환 수리 부분 채택 (Codx)

기준 HEAD `83f210406fbedae41632ed77edffe2db058cae63`. 계속 실행하라는 사용자 지시에 따라 이번 U6 재검토만 Claude 사용량 한도 시 Astra 독립 교차검수+root 실측으로 진행한다(`/tmp/worklazy-u6-preflight/resume-review/ROLE-NOTE.md`). Claude 승인으로 표기하지 않으며 전역 역할 규칙은 바꾸지 않는다.

계측기 6파일 후보는 작성 Astra와 다른 Astra의 실제 재현에서 차단 이견 0, root도 기존/신규 hook U4 scoped/full replay 및 20개 음성을 재실행했다. `/tmp/worklazy-u6-meter-p0/evidence/REPORT.md`, `/tmp/worklazy-u6-ledger-p0/meter-cross-audit/REPORT.md`에 근거가 있다. **이 6파일의 검사기 수리만 채택하고 제품 저장소에 반영한다. 전체 P0·자원식2/2·P1은 아직 승인하지 않는다.**

정정 계약: 측정 전용 Vite/Rollup hook의 실제 OutputAsset/OutputChunk 구분·크기·SHA·참조를 `vite-output-kind-and-bytes-v1`과 별도 보존 SHA receipt로 기록한다. 새 보고서는 schema4이며 고정 schema3 baseline SHA `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`와 기존 largest-remainder 귀속 계산을 유지한다. 실제 chunk는 동일 SHA의 raw asset 별칭이 있어도 경로별 modules가 필수다. raw JS/MJS는 전체 물리 census와 gzip 합계·실제 참조 route 귀속에서 빠지지 않는다. 이름 3개 허용목록·확장자 변경·미확인 metadata 면제는 금지한다. receipt는 변조/불일치 검출이며 metadata와 receipt를 함께 재작성하는 공격의 인증서가 아니다. 별도 빌드 로그·source/config SHA·원본 receipt와 배포 자산 연결을 보존한다.

반영 파일은 `scripts/{bundle-module-attribution.mjs,measure-bundle-budget.mjs,bundle-output-metadata.mjs,bundle-output-metadata.d.mts}`, `vite.config.ts`, `tests/unit/bundle-output-metadata.test.ts`이며 `/tmp/worklazy-u6-meter-p0/evidence/candidate.patch` 및 candidate-source-sha.json으로 고정한다. P0 App adapter/임시 fixture는 제외. 기본5상한 null/override{}/multiplier1은 사용자 결정대로 유지. 통합 완료 명령은 실제 unit/production build/static 및 기존 U4 byte·귀속 replay, 새 hook receipt/P0 replay다. UI/SEO/광고/한국어·영어 표시 변화는 없고 새 배포를 이 단계만으로 실행하지 않는다.

부분 채택 통합 검증 완료: 실제 root unit511/511·production build·static PASS, production JS/MJS/CSS108경로 bytes exact U4/누락추가0. 검증자root. `/tmp/worklazy-u6-preflight/root-review/meter-adoption-sha.json`에서채택6파일freeze동일. UI·PDF제품코드변경없으며장부/자원식검수는별도진행한다.


## v4 P0 재검토 채택 및 P1 착수 — Codx

이번 U6 한정 Astra 교차검수와 root 실측으로 최종 차단 이견 0에 도달했다. 검사기 작성자와 장부 작성자가 서로 다른 표면을 검수했고, root는 실측·원오류·재현음성을 대조했다. Claude 승인으로 기록하지 않는다. 정정문을 다음과 같이 **채택**하며 기존 동일 항목을 대체한다.

1. **계수 산식.** PNG와 저장 출력 계수는 각각 필수 전체 코퍼스의 `actualBytes`와 해당 `basis`(PNG는 `4WH`, 저장은 retained bytes)를 사용해 `f = max(2, ceil(1.25 × max_i(max(0, actualBytes_i − 1,048,576) / basis_i)))`로 계산한다. 런타임 예약은 `ceil(f × basis) + 1,048,576`바이트다. floor 또는 작은 이미지 제외는 사용하지 않는다. 80개 입력·368 PNG·48 save의 보존 실측에서 두 계수는 2이며, 이는 미실측 fallback 2가 아니다. 기존 전체 비율식은 1×1 PNG 헤더 때문에 28이 되어 A4 150dpi 예약 244,840,544바이트로 기존 한도를 넘는다. 따라서 원식의 통과로 재분류하지 않고 산식 변경의 명시적 정책 채택으로 기록한다.

2. **보장 범위.** 계수는 코퍼스 기반 예약 정책이며 알 수 없는 출력 길이나 브라우저 전체 heap의 수학적 상한을 보장하지 않는다. 실제 길이가 예약보다 크면 반환된 결과를 채택하지 않고 참조·소유권을 정리하며 이전 성공 결과는 보존한다. 생성자가 반환하기 전 순간 초과나 GC 시점까지 방지했다는 주장은 하지 않는다. binary 128MiB, raw 128MiB, 합산 192MiB 상한은 올리지 않으며 모바일 실기기 안전성은 아직 미검증이다.

3. **raw 작업공간과 사전 판정.** `16WH + 1MiB`는 pdf-lib PNG decode/embed 주위에 별도로 유지하는 실험상 보수적 raw 예약이다. PNG 출력 계수나 실측 native heap 최대치가 아니며 P1에서는 실제 소유하는 RGB·중간 버퍼와의 중복 여부를 명시해 계상한다. P0 성공 실적은 기본 A4 150·200dpi다. A4 300dpi(2481×3508)는 이 예약 140,302,144바이트가 raw 128MiB를 넘어 실제 embed 직전 거부됐다. 최대 4096 치수는 지원 보장이 아니다. P1은 치수가 결정되면 PNG 예약뿐 아니라 이 고정 scratch의 필요 예약도 일찍 검사해 사용자가 DPI를 낮추도록 안내한다. 자동 DPI 하향이나 임의 scratch 축소는 하지 않는다.

4. **동시 소유권.** 비교 중 canvas는 최대 2개, 각각 `4WH` raw로 소유한다. ImageBitmap은 별도 계상·종료하고, 두 비교용 ImageData backing은 각각 `4W × min(32, 남은 행수)`로 별도 예약한다. 동일 ArrayBuffer를 보는 view는 backing identity로 한 번 계상하고 복제된 backing 및 새로 생성한 Blob/File 복제 객체는 보수적으로 별도 계상한다. 선택 원본 File의 기존 저장공간을 작업 장부에 다시 넣는 뜻은 아니다. 선택 원본 File의 총 64MiB/파일 32MiB 입력 제한과 실제 읽어 소유하는 ArrayBuffer 계상은 서로 다른 제한이다. 입력 활성화 전 고정 master 189개/3,466,109바이트와 런타임은 별도 고정 수명으로 명시하며 문서에 공급하는 clone은 작업 장부에 계상한다.

5. **취소와 결과 보존.** 취소할 수 없는 toBlob 등 producer가 진행 중이면 취소 즉시 reservation이나 active 상태를 해제하지 않는다. 실제 settle 후 cleanup이 끝나야 재시도를 허용하며 늦게 도착한 결과는 공개하지 않는다. 취소 가능한 document/render 작업도 cancel/destroy의 정리를 기다린다. 반복 ZIP의 새 결과가 채택되면 이전 ZIP 소유권을 해제하며 실패하면 이전 ZIP/PDF identity를 유지한다.

6. **실제 ZIP 경로.** BlobReader.readUint8Array만 덮어쓰면 createReadable의 Blob.stream 경로를 통제하지 못하므로 이를 계상했다고 한 과거 P0 주장은 철회한다. 최종 실증은 base Reader의 실제 읽기 경로에서 Blob.slice와 ArrayBuffer를 생성 전에 각각 예약하고 writer settle까지 필요한 버퍼를 유지한다. 실제 reader 이벤트가 없는 원 trace를 거부하는 대조를 유지한다. C3 기존 helper는 그대로 재사용할 수 없으며 다음 마지막 optional options 서명으로 좁게 확장한다: `interface ZipArchiveOptions { useWebWorkers?: boolean; readerFactory?: (blob: Blob) => Reader<Blob> }`; `createIncrementalZipArchiveWriter(writable, signal?, options?)`; `writeZipArchive(files, writable, signal?, onProgress?, onFinalizing?, options?)`. 옵션은 writer와 add의 worker 설정 및 실제 reader 생성에 전달하고, 미지정 시 기존 `new BlobReader(blob)`와 기존 모든 호출자의 기본 동작을 유지한다. U6만 `useWebWorkers:false` 및 소유권 예약을 수행하는 custom base Reader를 전달한다. writer 출력 소유권도 U6 장부에서 계상한다. 설치된 Reader<Blob>의 constructor에는 source Blob 인자가 필요하다.

7. **출력 pixel grid와 전체 테두리 oracle.** 재렌더 시 원 raster grid를 맞추기 위해 `drawW = ceil(viewportW) / (dpi / 72)`, `drawH = ceil(viewportH) / (dpi / 72)`, `x = 0`, `y = baseH - drawH`로 이미지를 그린다. 출력 MediaBox는 기존 base viewport 치수를 유지한다. canvas 전체 테두리를 포함해 mask 외부를 검사하며, 비교 제외 guard는 확장된 mask의 최외곽 1px에만 둔다. canvas 바깥 테두리 전체를 제외하거나 품질 임계치를 완화하지 않는다. 기존 24개 pixel-grid 결과는 이 정렬과 oracle을 실제 실행한 증거다.

8. **P0 완료와 이후 단계.** 이 합의는 한 페이지 고정 mask prototype의 자원·취소 가능성, 기존 24개 회전/DPI/CropBox/UserUnit 픽셀 실증 및 별도의 이미지/EXIF 원 실증에 대한 P0 가능성 절차 완료의 입력이다. 실제 제품 P1/P2 기능 통과가 아니다. 다중페이지 순차 처리·retained streams 및 이전 결과 누적, 범용 mask 합집합/무마스크 페이지, 입력 거부 규칙, ZIP 동시 실행·취소·settlement 전체 계약과 모바일 실기기 검증은 해당 P1/P2 구현·검증에 남긴다. 이전 24개 결과를 최종 ZIP-only 수정 뒤 다시 실행했다고 쓰지 않는다.


### 실제 P0 판정과 실행 범위

P0 가능성 판정 PASS. 근거: 원 corpus80/80·PNG368/save48 및 root독립재집계·대표재실행, 수정 pixel-grid24/24 및 root28쌍 검증, EXIF8/이미지3형식·고정factory실사용의 원기술자료, 최종 ledger 실제 Reader/반복ZIP/할당초과/지연결과, exact-input-enable 2PDF→ZIP 요청0와 즉시요청 mutant검출. 별도 source/runtime/증거 범위를 합쳐 한 번에 모든 제품 기능을 검증했다고 쓰지 않는다. 원28 실패·초기pixel12/24실패·canvas테두리검사누락·rawJS분류실패·ZIP누수·reader경로누락은 모두 보존한다.

최종 검수: `/tmp/worklazy-u6-ledger-cross-audit/REPORT.md`, `/tmp/worklazy-u6-ledger-p0/meter-cross-audit/REPORT.md`. 최종 ledger14파일 freeze는 `/tmp/worklazy-u6-ledger-p0/evidence/zip-reader-fix/source-freeze.final.json`, owned-engine SHA `36f41750656633207c076a9861ce096723ecdf0c41888a79c7bad10bbeaf6157`. root는 별도 A4150/200·pending취소/재실행/이전Blobidentity·canvas최대2, 최종 reader필수coverage원본거부/최종통과와 ZIP별두PDF바이트전량읽기, 구/신PDF바이트동일을 확인했다. `/tmp/worklazy-u6-preflight/root-review/` 참조.

5종 공식 후보 계측은 이전 narrow-helper/prewarm prototype 그래프의 entry314301/route184794/shared1944120/app6128678/CSS38284B이며 최종 제품 장부 엔진의 용량으로 오인하지 않는다. meter6파일은 fa0bef7에 채택·통합했고 actual unit511/511/build/static 및 U4 JS/CSS108경로 bytes exact를 통과했다. 새 P1 코드가 들어간 그래프는 P1 통합 때 다시 계측한다. 고정 baseline과5null/override{}/multiplier1을 유지하며 dedup 정리는 마지막이다.

현재 P1 구현 범위는 기존 정본의 input/geometry/렌더/독립검증/실제소유장부·준비 및 narrow-helper와 위 C3확장이다. P1 작업 사본은 `/tmp/worklazy-u6-impl`, 기준 fa0bef7. 복잡한 엔진·PDF 입력 거부·수명주기는 Astra, 좁은 공용 ZIP 옵션과 회귀는 Sol이 담당하고 최종 검수는 다른 Astra가 재현한다. P2 UI/P3 등록·격리는 P1 검증 후 이어서 수행하며, 최종 병합 이월 검증 목록은 기존 정본을 모두 유지한다. 사용자 파일·dummyfortest/외부전송/새서버/생성물직접수정/전역ZIP설정/상한증가/광역pdfPreview직접import/PDF-lib새worker는 금지.


### 2026-09-12 재개 확인 — Codx

사용자 “하던거 다시 그대로 이어서 해” 지시로 P1을 재개한다. root/작업사본HEAD fa0bef7 유지, 제품 src/scripts/tests/의존선언은 HEAD와동일하며 사본은아직C3/엔진수정전이었다. 원루트에변경된PROJECT_RULES/AGENTS/CLAUDE/GEMINI/runbook및신규스킬·설치문서·zip은별도사용자유지보수로보존하고이번제품커밋에섞지않는다. 최신규칙의작업공간당동시제품작성자1명과범위검증정책을적용한다.

P1공용C3옵션은Sol이먼저구현한다. 다음의복잡한엔진은사용자직접지시“오늘수행할작업중코딩이까다로운부분이있다면아스트라가할것”을그범위에우선적용하여Astra가담당한다. 역할표전역을수정하지않고커밋/배포는구현담당Sol에맡긴다. 검수는제품작성과분리한다.

Chrome152.0.7977.64→153.0.8010.36변경,Node22.17.1/PDF.js6.2.108/pdf-lib1.17.1/zip.js2.9.0유지. P0판정·원로그는보존하되현재브라우저계수실증은새80corpus로갱신한다. 동일옛pixel24를반복하지않고P1새엔진의필수품질검증에서현재Chrome를사용한다. 초기검사범위는C3직접단위/Unicode/스트리밍및실제reader소비·취소. P0meter/기존U4결과는해당제품소스변경없음을근거로재사용하고, P1공용helper변경때그소비자oracle만다시실행한다. 전체unit/build/static/등록/격리/시각등최종필수검사는기존정본대로해당단계에회수한다.


### 2026-09-12 P1 핵심 검수 완료 및 P2 착수 — Codx

P1 핵심 범위 통과. 기준 fa0bef7, 작업사본 /tmp/worklazy-u6-impl, 최종25파일 freeze `f16851f65d8ecd5bc90bab1394f3fc9a984f9885268b08756ee89f5b10be2ff2`. 작성 Astra /tmp/worklazy-u6-preflight/p1-engine/README.md, 독립 Astra /tmp/worklazy-u6-p1-independent/REPORT.md를 root가 원증거·최종 SHA와 대조했다. 제품 전체완료/배포 판정이 아니다.

새 실행: tsc·집중35검사, 실제 다중페이지/실패19검사, EXIF8·ZIP지연취소 포함17검사, 지원 소형페이지4회전×200/300dpi, 정확input-enable후PDF+PNG+ZIP+취소/재시도 요청0와0.279ms즉시요청음성, 공용helper legacy44diff0 및 별도PDF oracle56표본/57페이지를 확인했다. Chrome153 자원80셀/PNG368/save48은 별도 재측정에서2/2·Chrome152와출력크기차0이며 root독립재집계도완료했다. 모바일전체heap/모든300dpi입력지원 보장은 없다.

독립검수 신규차단2건은 원실패를 보존하고 수리했다: 비정규 페이지키00의 무가림결과 게시, ProcSet/DecodeParms 중첩값 검사누락. 수리된3제품파일과관련2검사만 변경·재빌드하여 정상키/비정규키거부, 구조정상+11음성, 관련7unit/tsc를 새로 실행했다. 다른Astra가 원2재현의수리와270도/fractional CropBox/UserUnit2/200dpi 전픽셀오차0, maxcanvas2, 파일/용량/영역경계 및 실제배치200/201·이전선택보존을 독립 확인했다. 변경하지않은 encoder/runtime/수명주기/legacy 증거는 재사용이며 수리후모두재실행했다고쓰지않는다. root별도ZIP entry명/개별bytes및palettePNG 가림밖RGBA검증은최종개별출력SHA동일로재사용했다.

최종 필수 이월: P2 UI·ObjectURL/Blob소유권/키보드·숫자·pointer/DPR/zoom/취소/다중결과, P3 등록/양어SEO/정적CSP/전용문서·SW·BFCache·언어·canary storage/console/network, 실제등록그래프계측 및 전체build/unit/static/필수영향회귀/시각·접근성. 명시음성목록 중 DPR중복, verify-skip, overlay-only/copyPages 직접주입은 아직실행하지않았으므로 최종게이트에서 반드시회수한다. 기존mask생략·구조11·지연취소·즉시요청음성을그대체라고쓰지않는다.

Astra 작성·독립검수 종료후 Sol이 같은사본의 유일제품작성자로 P2에착수한다. 기존디자인/컴포넌트와최종clientAPI를사용하고 P3 App/registry/SEO/CSP/SW는아직동시수정하지않는다. 관련준비 /tmp/worklazy-u6-preflight/p2-ui-reuse.md·p3-integration-reuse.md. 최종사용자확인1회와무가림페이지목록만요구하며 별도페이지마다확인체크를추가하지않는다. 원루트의사용자규칙/스킬유지보수변경은계속분리보존한다. U6→U7→U8→U9→UI재기준화→UIv3→B1/B2·용량정리 순서유지, PDF파일명축약기준 요청도후속대기유지.

### 2026-09-13 P2 국소 결과 검수 및 P3 준비 — Codx

P2 첫 제출 aggregate e687adaf99bf7dd4ef4f6a05c2db904308bdf74bfe1a0af0d9e0d2d17bd04373, /tmp/worklazy-u6-preflight/p2-ui/REPORT.md. 명시 tsconfig.app 타입검사 exit0·helper unit3·전용 production Vite build와 양어 실제 다운로드를 확인했다. DPR2/zoom200에서 content width536px 기준20px 이동·10px resize의 수치 oracle 및 DPR중복 mutant exit1/control0, PDF실다운로드 재열기1/3페이지·ZIP2entry·취소후기존결과/재시도·URL정리를 확인했다. root는 actual ko-result.bin을 별도 Pillow로 대조해16×16의 검정48픽셀과 가림밖208 RGBA(전체canvas테두리 포함) exact를 확인했다(root-ui-png-oracle.json). EN320 configured 캡처를 실제 열람했으나 이는 최종 전수 시각검수 완료가 아니다.

P2 최종 수용은 보류: root 소스 검토에서 새 export/ZIP 시작시 이전 ZIP URL을 먼저 revoke하는 경로와 limit 실패뒤 다음파일을 계속하는 경로를 발견했다. 전자는 v4 이전 ZIP보존, 후자는 자원실패시 배치중단 계약과 충돌하므로 Sol이 관련수정/재현만 수행한다. 비동기 입력선택 중 UI작업 소유권 경합도 함께 확인한다. 기존 P1 frozen25파일은 제출시 mismatch0이며 제품작성자는 계속 Sol 한 명이다.

P3 worker feasibility는 /tmp/worklazy-u6-p3-worker-probe/REPORT.md의 임시사본 실증이다. 고정same-origin worker module을 고정Blobwrapper에서 import하고 실제import완료를 기다린 후 공유PDFWorker port로 전달하면 Chrome153의 일반worker message실행에서 JS eval거부·WASM허용·외부fetch CSP차단이 실제 PDF/CMap/JPX 처리와 양립했다. caller-owned nativeWorker의 terminate/URLrevoke, import오류·시간초과·준비취소후 동일Runtime 재준비를 확인했다. PDFWorker.promise를 module준비로 간주하거나 설치6.2.108에서 제거된 isEvalSupported:false를 보안근거로 쓰지 않는다. DevTools evaluate의 잘못된 최초관측은 보존했다. 제품 P3 적용/전용정적문서·기존SW·BFCache 검수는 아직이며 시험용오류분기/짧은timeout/diagnostic listener를 제품에 복사하지 않는다.


### 2026-09-13 P2 수용·음성대조 회수·P3 착수 — Codx

Sol의 P2 최종 aggregate09d294f11c23e568b85001eab47bfbee2b380729d3ada717b3ffee5a2cabc0c9(10파일)을 root가 실제SHA mismatch0으로 확인하고 수용했다. 수정후 ZIP취소/한도실패의 이전href exact보존, A4@300 첫파일limit뒤지원PNG미처리/결과0, metadata교체20파일동안조작잠금과정착후재활성, 취소후1결과보존→재시도2/URL3개정리를 actuallog로 확인했다. 타입/관련unit3/전용build 통과, P1 25파일불변. 최신UI다운로드PNG SHA가별도Pillow48black/208outside-exact 판정과동일하다. P2전용테스트가 P3 실제등록/격리를대신하지않는다.

/tmp/worklazy-u6-p1-mutation-gate/REPORT.md와 run-summary-full.json/runtime-evidence.json을검토해 이월3음성대조를 frozen P1범위에서회수했다. 정상/동일mask누락+정상검증은exit0/0(후자는실제verification거부·게시0), overlay-only/copyPages/verification-skip은각실물잘못된출력을생성한후독립oracle이exit1/1/1로거부했다. PDF원문81자·font잔류와PNG256비검정등raw증거및wholecanvas테두리포함검사를확인했다. 처음테두리제외보조검사와교정후재실행은분리보존, 제품임계변경없음. P3 runtime/client게시경로변경시관련산출provenance와핵심출력경로를다시연결하며 이증거를P3전용문서승인으로쓰지않는다.

P2 Sol 제품작성을 종료하고 P3의 유일작성자를 Astra로 인계했다. 사용자 '까다로운 코딩은 Astra'의 명시지시에 따른 U6 개인정보격리·worker/CSP/문서이동수명 통합범위의예외이며 전역역할변경아니다. 최종통합기록·커밋/push/배포는 Sol이담당한다. P3제품산출 /tmp/worklazy-u6-preflight/p3-integration, 원root사용자유지보수분리유지. 현재 U6전체완료/배포아님.

P3 관측 지원(2026-09-13): /tmp/worklazy-u6-p3-target-observer/REPORT.md·exits.json·replay.json을 root가확인했다. 고정합성page/worker/SW 시작전Network/Runtime/Log/Audits관측의control0, worker관측생략mutant1, BFCache관측유/무control0/0; 실제HTTPterminal·WS101·CSP차단과own-targetconsole을 raw로재집계했다. 같은Chrome153.0.8010.36의실제persisted복원은지원됐으며 Playwright기본BFCache비활성옵션을해제한환경control은 /tmp/worklazy-u6-preflight/p3-bfcache-environment/. 이는 제품P3privacy통과가아니다. SWscript 최초다운로드는3targetNetwork에없는실제관측누락이므로로컬서버기록·등록/update시도관측과최종제품검사에서보완해야하고browserupdate로임의제외하지않는다. Gemini의로컬PNG열람가용성은 agy 1회호출의실제섹션3개보고를root이미지와대조해확인했다(/tmp/worklazy-u6-preflight/gemini-image-capability/RESULT.md); 최종시각검수는아직이며plain출력에는tooltrace가없으므로최종호출은지원stream-json증거를보존한다.

P3 중간실증(2026-09-13): 등록관련9unit·두차례production Vite build가통과했고EN실제등록경로PNG선택/가림/검증다운로드가성공했다. 처음static은사본의기존vendor-runtime 생성단계누락으로실패하여원실패보존후고정캐시+원생성기를네트워크차단하에사용했다(생성물손수수정없음). BFCache는최초테스트서버no-store에서미실행이며수정서버에서persisted=true가관측됐다. 지연toBlob중pagehide는nativeworker terminate0인실제신규결함으로확인되어 terminal문서이탈만즉시worker종료하는경로를수리중이다. 정상cancel·producer정착전예약유지계약은그대로유지하고worker종료와모든producer정착을혼동하지않는다. 최종P3privacy/BFCache완료판정아직없음.

### 2026-09-13 P3 작성 종료·UI 게이트 국소수리 인계 — Codx

P3 작성자가57파일freeze b6b36a8cbabb091fe3174313ec269a0e709af720ba4f66a71f2a9e80ab2e9a1f, immutable dist-fourth를고정하고제품쓰기를종료했다. root는57파일전량SHA를대조하여 /tmp/worklazy-u6-preflight/p3-review-source 에검수사본을만들었다. P3최종privacy기록의문서귀속정정은/tmp에서마감중이며별도Astra가같은사본과제출raw의고위험핵심만독립검수한다(/tmp/worklazy-u6-p3-independent). Sol은다시 /tmp/worklazy-u6-impl의유일작성자로UI국소수리와최종통합을담당한다. 이인계는U6전체완료/배포아니다.

UI검사 /tmp/worklazy-u6-preflight/final-ui-review/REPORT.md: 60상태를실제실행·캡처했다. 처음raw contrast39발생은전부안정결함이아니며selected Undo/Remove 2건은transition직후측정,250ms/1s/2s 동일DOM에서는0으로판별했다(원raw보존,rule제외/허용오차완화없음). preview-scroll/공용progress-log의키보드focus지속문제는별도수리한다. EN320 CLS .126217은footer 최초배치.0711905+U6 lazy/준비후높이추가.0550266로분해돼전용공간사전예약이국소수리경계다. legacy총CLS .237만으로동일원인이라고쓰지않는다. 기존EN320전역동의버튼잘림은동일legacy geometry로분리했고메뉴/광고loader mount를혼동하지않는다.

Gemini agy 두호출의stream-json에서ko24/en36 PNG view_file DONE을확인했으나 first캡처→동의선택후최종캡처의동시갱신이있어최종동일코퍼스60검수로표기하지않는다. attempt3와final-attempt4 SHA대조에서empty10동일/나머지50변경. 원예비보고와tooltrace보존, 이후수리후고정이미지와이50범위를합쳐필요한최종재검수1회로회수한다. fullpage에서fixed header/nav가문서중간에보인것은viewport-only실제위치검사로CSS배치결함주장을기각했다. 자동scrollIntoView의일시겹침은영구조작불가로승격않고, 실제사용·발생시점을구분한다. 기존캡처경로는이후덮어쓰지않는다.

### 2026-09-13 P3·UI 수용 및 최종 통합 — Codx

P3 author REPORT와 별도 Astra /tmp/worklazy-u6-p3-independent/REPORT.md를 root가 대조해 frozen P3의 신규 차단0을 수용했다. 실제 정상 privacy10조합·추가 storage1, 정확 enable 고정자산189개/3466109B, startup/worker CSP/실제 BFCache·active PDF·late PNG 정착·언어/모바일/뒤로·앞으로 근거가 있으며, 즉시HTTP와 외부sendBeacon은 동일0게이트 actual child exit1이다. 독립 검수는 input 이후 offline+전HTTP 차단 상태의 PDF/PNG/ZIP/재열기/취소·기존ZIP보존·재시도 exit0 및 PNG48검정/208외부RGBA exact·PDF3p/text0·ZIP개별bytes 일치를 새 실행했다. 전체heap0·abandoned PDF transport의 모든promise정착·미실행개별API변이까지 보장하지 않는다.

UI repair6파일 aggregate b6e126882315abec7eeb7cbee86222655cd9f9ff79f6952418f4953857a9c85e, /tmp/worklazy-u6-preflight/final-ui-fix/REPORT.md와 별도 /tmp/worklazy-u6-ui-independent/REPORT.md를 수용했다. U6만 main 공간예약, preview와 공용progress로그의 명명·Tab focus·visible ring, 안정적 처리/손상대비를 수리했다. stable mobile6상태 신규위반0/maxCLS.0260803, desktop6상태 U6직접위반0/maxCLS.007179; 기존desktop LanguageSwitcher 대비1은 동일수리전selector로분리했다. 독립 QR 일반main block/844px 유지와 U6전용flex/1036px·실제Tab/스크롤/처리 표본exit0. incomplete72/188은PASS에합산하지 않는다.

전송API 광역원문감사 /tmp/worklazy-u6-transmission-audit/REPORT.md: 저장소소스470파일·927lexical hit/167exact경로 owner·purpose 귀속, ignored생성public130파일 별도목록. 테스트/worker/HTML/CSS/Python/빌드/workflow를검색에서제외하지않았다. P3고정prepare·메모리factory·Blob다운로드·loader제외 경계를재확인했고 final static validator1파일변경은의도된marker부재검사 정합화로별도diff수용했다. 외부beacon은정본의명시변이이며회수완료; API관측목록을모든API별제품변이실행으로허위확대하지않는다.

Sol 최종 full build/unit/static·등록계측·직접영향smoke·고정최종시각코퍼스 진행. 실제최종dist와관련sourceSHA 연결후 Gemini가 고정이미지를재열람한다. 기존변하지않은엔진/좌표/출력/자원/legacy와P310조합은검사별재사용하며 전체매트릭스를중복하지않는다. 최종검사·commit/push·Pages/live확인·U6종결은아직남아있다.

최종통합 중간(2026-09-13): full unit527/527·production build 정적73페이지·전체static(기동복구122문서)·registry21·new-tools 및 recovery151이 실제통과했다. 검사시각/전체sourcefreeze 연결은 Sol최종보고에서마감한다. 최초browser전체는Excel/공유UI단계뒤Word일반오류로exit1, 원인미확정로그보존. 다른Astra의원TEST_SCOPE=word·관측Word·대표Excel→Word연결은모두exit0이고Wordworker/Pyodide6자산이기존고정dist와SHA동일했다(/tmp/worklazy-u6-final-word-diagnostic/REPORT.md). 첫실패를inherited나전체PASS로바꾸지않고미실행PDF범위만별도회수한다. 관측기자체frame=null오류는제품실패와구분했다.

최종대상교정(2026-09-13): root가 final-captures raw에서수리전preview focus/cancel대비를발견했다. Sol은copied4350 logging server의root기본값dist-first가문자열치환실패로남았음을확정했다. 최초final-captures60 및privacy attempt3는현재최종빌드검사로무효,원산출보존. REDACTOR_DIST=/tmp/worklazy-u6-impl/dist로명시재기동하고served EN HTML SHA가실제최종dist와일치함을확인한privacy-final3 attempt4는exit0, final-captures2를새경로에서재생성중이다. 기존P3 fixed검수/candidate3검수와full build/unit,4173의실제최종dist Word검증은별개유효하며이오류로전체를재실행하지않는다. 다른최종검사도사용URL·served실물귀속을최종보고에명시한다.

### 2026-09-13 최종 검수 수용·배포 진행 — Codx

/tmp/worklazy-u6-final/REPORT.md의실제명령/로그와root-reuse-comparison.json을대조해검수수용. 최종source관련대조는P1 23/25불변(달라진runtime/client는P3검증),P2 6/10불변(페이지/스타일/상태문구는후속검증),P3 53/57불변(4파일validator/UI국소변경),UI6/6불변이다. broad browser중Word원실패는미확정으로유지하고원Wordscope및대표Excel→Word+PDFscope통과를회수했다. C3직접소비QRbulk/Excelcompare도actualexit0이다.

최종시각 final-captures2 manifestSHA2ac4081102a8ce651f87d78c69376734683e9322cb5f970bbf90f61cebfde683,60PNG/25098291B를작성종료후고정복사했다. Gemini2호출actualexit0/SUCCESS,view_fileDONE ko24/24+en36/36 missing0/unexpected0 및열람후SHA불변;root가raw와최종소견을대조해신규시각차단0을수용했다(/tmp/worklazy-u6-final/gemini-final/ROOT-DECISION.md). final60외부/브라우저오류/가로넘침0,maxCLS.027802332275024065,직접U6 a11y0·기존desktop전환기contrast1;incomplete는PASS아니다.

일반화면 rendering처음실행은production+granted동의에서외부provider500시도로exit1이었다(로컬무추적검사조건불일치,원기록보존;U6privacy실패아님). VITE_LOCAL_QA=1 별도dist-qa로검수빌드를만들어지원RENDER_TARGET_IDS=home,document-compare,pdf-editor 대표3×3만새실행했고external0/각maxCLS0/exit0이다. 잘못된4350구버전을본최초a11y43은현재후보증거에서제외하고finalU6 60상태+UI독립표본으로관련변경을회수했다. 500실패·구버전캡처/검사를PASS로덮어쓰지않고제품후보dist/Gemini고정이미지불변유지.

Sol에게검토한U6 63exact파일commit→root FF통합→origin/main최신ancestor확인후push→Pages/live확인을이어서지시했다. 사용자원유지보수/개인파일·node_modules·dist는commit제외. 아직배포성공/U6전체종결로표기하지않는다.

### 2026-09-13 배포·사후 확인 종결 — Codx

제품 63파일은 `5ac8b6473d1786691fff7a83c5fde126f16e6af1`로 커밋되어 root와 origin/main에 일치한다. root가 commit 대상 63개와 freeze SHA를 독립 대조했다. Pages 실행 `34706393538` build/deploy SUCCESS. 실제 Pages artifact와 라이브 ko/en의 자산 각19개를 byte/SHA 대조해 모두 일치; 합성16×16 PNG 가림·다운로드·재열기154B, 광고/외부 요청/입력 이후HTTP/페이지오류0. 로컬 빌드와 CI 생성 파일명 차이는 실제 배포 artifact 대조로 검증했고 동일 빌드라는 주장은 하지 않는다.

U6 전체 종결. 원시 근거 `/tmp/worklazy-u6-final`, `/tmp/worklazy-u6-live`; 선별 종결 근거는 이 문서와 같은 디렉터리의 `closure-evidence/CLOSURE.json`. 과거 실패·무효 검사·기존 부채·실기기 한계는 위 기록과 추적 review-notes/backlog에 보존한다. 다음은 U7-0 후보 실증이며 U7→U8→U9→UI 재기준화→UI v3→B1/실제 B2 재왕복 순서를 유지한다.
