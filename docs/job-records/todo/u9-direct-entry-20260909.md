# U9 직접 진입 잔여 구현 — v4 정본

현재 실행: **U8 배포·라이브 종결 뒤 U9 실행 게이트·D0 착수 (2026-09-13 Codx)**. 실행 기준 `9fa435ae6be5c92b05f9032479d1f7298899b76b` / Pages34719374659 success, actual CI/live9자산일치와 합성PDF비교/XLSX재열기로 선행 종결. 현재 사용자의 모든 정본 수행·재개 지시가 아래 작성 당시 제품구현 금지를 대체한다. 상한5개 null·overrides{}·multiplier1/원baselineSHA4caaa9c6 유지, 용량정리는 맨마지막으로 구 고정예산 착수불가 문구를 대체한다. 실제기준차이·현행inventory·열린계획 충돌 확인 전 제품작성은 하지 않는다.

상태: **상세 정본 — sol R4 이견 0.** 작성 Codx. 기준 HEAD d9c79b7a16f5b99fa7cddfde741b8d10f08f07d0, s3-pdf-finish. 지시 기준 d3a8d89 이후 통합된 94파일은 실행 게이트 차이로 기록한다. 제품 구현은 이번 라운드 금지. 실행 순서는 로드맵 S7(신규도구 U8 배포·사후확인 이후) 유지. 미래 착수 직전 HEAD·열린 계획 충돌·신규도구 목록을 재대조한다.

## 실측 잔여
`node tests/tool-registry-routes.mjs` → count20, missing/unexpected/duplicates 모두[]. 이 검사는 top-level 도구 ID만 읽으므로 세부 preset·static·canonical·redirect 통과 증거가 아니다.
`src/app/App.tsx:53-65`: split은 organize로 redirect. image-to-pdf/pdf-to-image/convert/finish/page-numbers/header-footer/watermark/stamp는 존재. U4 5개 finish URL은 이미 소유 단위 완료라 재구현하지 않는다.
`scripts/generate-static-pages.mjs:12-24`의 별도 목록은 split조차 포함하지 않는다. `src/app/seo.ts`도 독립 테이블이다. U9은 신규 엔진을 만들지 않고 기존 기능의 시작 상태를 typed prop으로 연결한다.

## 고정 경로·시작 상태
아래 path는 /tools 아래, ko/en과 비접두 redirect를 함께 등록한다. canonical은 각 기능 경로 자체(기존 U4 finish 4 alias의 finish canonical 계약은 보존).
|기능|path|초기 상태/정확한 목적|
|PDF 합치기|pdf-editor/merge|organize; purpose=merge, outputMode=merged, 출력 영역 안내|
|PDF 나누기|pdf-editor/split|organize; purpose=split, outputMode=ranges, quickSplit=true; 기존 redirect 교체|
|PDF 삭제|pdf-editor/delete|organize; purpose=delete, outputMode=merged; 로드후 첫 페이지 삭제 버튼 안내·초점, 자동삭제0|
|PDF 회전|pdf-editor/rotate|organize; purpose=rotate, outputMode=merged; 로드후 첫 페이지 회전 버튼 안내·초점, 자동회전0|
|PDF OCR|pdf-editor/ocr|convert; format=searchable-pdf, pageRange=""(전페이지); 내부 searchable 분기가 all 처리|
|PDF 변환|pdf-editor/convert|현행 유지; docx/auto|
|이미지 크기|image-studio/resize|tab=editor, panel=size, interactionMode=select|
|이미지 모자이크|image-studio/mosaic|tab=editor, panel=effect, interactionMode=effect, regionEffect=mosaic|
|이미지 워터마크|image-studio/watermark|tab=editor, panel=text, interactionMode=select, text=""; 자동 객체 삽입0|
|비디오 자르기|video-studio/trim|allGroupsOneFile=false, group outputMode=individual, outputFormat=mp4, audioMode=copy; ranges 안내|
|비디오 합치기|video-studio/merge|allGroupsOneFile=true, group outputMode=individual 유지, outputFormat=mp4, audioMode=copy; groups 안내|
|비디오 음원|video-studio/extract-audio|allGroupsOneFile=false, group outputMode=individual, outputFormat=mp3, audioMode=copy; ranges 안내|
|오디오 자르기|audio-studio/trim|purpose=trim; 파일 decode 뒤 defaultSelection commit 직후 exportSelection=true; 파일전 자동처리0|
|Excel 병합|excel-merger|현행 base 경로 자체 충족; 별도 alias 만들지 않음|
typed 계약은 `PdfOrganizePreset` discriminated union(위4purpose/outputMode/quickSplit/postLoadFocus), `PdfConvertPreset`(format/pageRange 및 convert만 ocrMode), `ImageDirectPreset`, `VideoDirectPreset`, `AudioDirectPreset`으로 각 feature가 소유한다. 전역 generic preset router 금지. 신규 `data-direct-purpose`와 이름있는 목적별 안내heading, 실제 선택된 output/panel/toggle을 독립 fixture가 단언. PDF split의 quickSplit은 기존 나누기위치 UI를 열고 전체 페이지가 들어오는 최초range를 유지하며, 사용자가 경계를 누르기 전 자동분할0. base PDF organize에는 신규 안내/기본값/문구 변경0.
**적용시점**: 최초진입 1회 및 언어prefix를 제거하고 trailing slash를 정규화한 pathname이 변경될 때만. search/hash·언어변경·리렌더·resize에는 재적용0. `lastAppliedRouteKeyRef`/pendingPreset으로 관리; file/result/state를 key=pathname로 remount하지 않는다. 같은feature alias wrapper type과 state 소유자를 유지하여 browser 전환 테스트로 실제 보존을 증명한다. dirty=false일 때 즉시 적용. dirty/running/result가 있으면 화면의 양어 확인에서 승인 후 current operation abort·stale결과차단·기존result revoke, 입력파일/페이지편집값은 유지하고 preset 관련 옵션만 바꾼다. 거부하면 상태 유지하고 직전 승인 pathname+직전 search/hash로 replace(현재언어 prefix 유지), 추가confirm루프0. back/forward도 동일계약; 다른feature 이동의 기존처리 정책은 바꾸지 않는다.
**파일로드후**: image `loadFile`의 select 초기화 직후 현재 승인preset의 panel/interactionMode를 딱1회 적용; 다음 사용자 패널조작을 effect가 덮지 않음. 새 파일로 교체할 때도 현재목적을1회 적용, 자동 text/object삽입0. audio는 defaultSelection을 commit한 뒤 trim의 exportSelection을1회 적용; 이후 선택삭제에 따른false는 유지. video 입력은 group1 기본 배정, 기존파일그룹/trim범위 보존, merge는 모든그룹을 그룹번호/카드순서로1출력하는 현행 allGroupsOneFile 기능을 사용한다. mp3 출력은 비디오없는 audio 결과임을 ffprobe로 검사. OCR은 ocrMode 새UI를 만들지 않으며 searchable 분기(현 PdfConvertPanel:61-68)가 전체OCR을 강제한다.

## 단계·예산
D0 계약 검사/독립 manifest: 표의 expected routes+동작·언어·canonical·indexability·격리 종류를 tests/fixtures/direct-entry-contract.json에 고정. 제품 목록에서 expected 자기생성 금지. 실행 JS 영향0.
D1 PDF/이미지/오디오 typed prop: feature별 구현, 단계 예상 app +2~6KiB, entry +0.5~2KiB, affected routes +1~4KiB, shared 0~1KiB, CSS 0~0.5KiB (설계 추정, 측정 아님).
D2 비디오 isolated 경로: AppShell videoStudioActive의 exact match, VideoIsolationBoundary, isolation document marker, worker/runtime 상대경로·coi-serviceworker scope를 세 subpath에 적용. 기존 video analytics 허용·ads 제외 유지. 예상 app +1~3KiB/entry+0.3~1KiB/CSS0. worker 복제 배포를 추가하지 않고 기존 parent 자산 경로를 사용.
D3 SEO/정적/전체 감사: ko/en title/description/FAQ/featureList·social image slug·canonical/hreflang·sitemap·unprefixed redirect·404 native static 서버로 검사. JS 메타 예상 +1~4KiB; 새 PNG는 JS 예산과 별도 실측. U6~U8 owner의 신규 route도 감사 목록에 추가하되 그 구현은 소유단위 책임.
누적 app 추정 +4~13KiB는 d3의 2,507B 여유보다 크다. lazy만으로 app 전체량이 감소하지 않으므로 고정 예산 내 회수 확보 전 착수 불가. 상한·override·multiplier 변경 금지.

## 광역 감사 계약
구현할 `scripts/audit-direct-entry.mjs`는 repo root 재귀, .ts/.tsx/.js/.jsx/.mjs/.cjs/.mts/.cts/.html을 전부 검사(신규 하위 경로 포함). 정적 import/export/dynamic import/new URL/Worker/문자열 링크/JSX Route와 navigation을 수집하며 해석 불가 구문은 미확인 실패. `git ls-files`만으로 신규 미추적 실행 소스를 놓치지 않는다. node_modules/.git 제외는 dependency/VCS 경계, docs/jobs·tests/fixtures·dist/public/vendor는 종류별 별도 명시 소유자와 목적을 가진 목록으로 분리한다. generated/vendor는 무시하지 않고 배포 재귀 검사로 대조. 사용자 접근 금지4항목은 exact 경로로 내용 접근 없이 기록. 현 glob 결과로 예외 생성/광역 wildcard 허용 금지.
최소 예외: HWP en은 unavailable(404→tools), document result는 세션 전용/no static, office app·xls-preserve는 격리 비색인, retired Word/HWP는 명시 redirect, 기존 U4 4 alias는 finish canonical. 그 외 누락은 실패. 세부 exact 경로·purpose·owner는 manifest에 열거. 신규 중첩 .mjs 경로에 미등록 route를 넣거나 static/SEO 한 항목을 지우는 음성 대조가 exit1이어야 한다.

## 완료 기준 명령 (신규 검사는 구현 단계 작성 후 실행)
```sh
node tests/tool-registry-routes.mjs
node scripts/audit-direct-entry.mjs
node tests/direct-entry-contract.mjs
npm run build
npm run test:unit
node tests/direct-entry-smoke.mjs
npm run test:browser
npm run test:new-tools
npm run test:utilities
npm run test:static
BUNDLE_BASELINE=docs/jobs/todo/canon-rounds-20260909/bundle-baseline.json BUNDLE_BUDGET_MULTIPLIER=1 BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-canon/u9-budget.json npm run bundle:measure
```
새 smoke는 위14행×ko/en×직접/새로고침/앱 이동/뒤로·앞으로를 native static 서버에서 검증. U9 자체 top-level 도구ID 증분0. 현재20이고, 미래 U6~U8의 실제 승인ID는 각각 소유정본에서 먼저 독립목록에 반영해 비교한다. 14행은 U9기능행; 신규/교체 static slug12(양어24페이지), 기존기능2(convert/excel-merger)다. split은 route교체1이므로 신규React route11과 신규static slug12를 구분한다. unknown route는 기존 결함으로 분리하고 U9가 더 넓은 wildcard를 만들지 않게 한다. 게이트 누락 mutant, 기존 base 초기값 oracle, 이전 기능 회귀 및 사용자 직접진입 경로는 매 라운드. 시각·a11y·CLS는 영향 route와 ko/en 모바일, production 광고 격리 및 Gemini 로컬 시각검수는 병합 직전 회수한다.

## 명시 제외
엔진 기능 추가/일반 in-app404 수리/U4 organize 기존 기본 UI·문구 변경/전역 generic router/신규도구 상세 구현/UI테마 개편/상한 변경. 이번에는 계획만, 추적 파일·main·push 불변. 새 오류는 ko/en 행동 중심, 내부 구현·원시 예외 노출 금지. 기존 결함은 부모 대조 후 backlog, 새 회귀 차단.

## 반박에서 뒤집힌 것
R1 코드교차7항 전건수용, 뒤집힌판단7건: video 가상탭→실제옵션, PDF organize 하나→typed4목적, OCR all별도state→searchable분기, resize resample→size 및 load후 재적용, audio mount-toggle→selection commit뒤적용, URL마다강제→dirty/거부/언어분리 lifecycle, video하위경로 단순추가→exact family+부모scope 정적계약. 두sol의 중복3항은 별도건수로 더하지 않는다. R2 재확인대기.

## 비디오격리·감사목록 v2 (D2의 정확한 계약)
`src/components/AppShell.tsx:41,201-214`, `scripts/generate-static-pages.mjs:83-95,152` 실측에 따라 **exact family4**=`/tools/video-studio`, `/tools/video-studio/trim`, `/tools/video-studio/merge`, `/tools/video-studio/extract-audio`. beginsWith wildcard 금지. 언어/BASE_URL/끝slash만 정규화 후 같은 typed 목록으로 판정. 비디오외부→가족경로는 기존 VideoIsolationBoundary 전체문서 replace를 유지하되 요청한 subpath+search+hash를 보존. 같은video isolated 문서의 가족내 SPA전환은 위dirty 계약, reload는 self경로, non-isolated문서에서는 COI controller 준비 전 도구파일input/engine mount금지. 분석허용/광고제외 정책은 가족4에 동일 적용.
정적 ko/en의3하위페이지(6문서)는 video marker 및 `../coi-serviceworker.js`; 부모 ko/en와 legacy COI **기존3개만** 생성, 하위SW복사0. worker/runtime은 기존 localized video root assets를 canonical absolute URL helper(사이트 BASE_URL+언어+tools/video-studio/)로 참조; `./runtime`처럼 현재subpath 기준 계산 금지. video moduleWorker의 import.meta.url 기준 resource는 기존값을 유지하고 helper 적용대상은 document기준 경로뿐. `/probe/` static빌드에서도 모든 참조파일존재·MIME·controller scope=video root를 검사. root PWA와video COI 공존 직접/reload/back 테스트를 포함한다.
독립contract JSON 필수필드: path,purpose,owner,locales,canonical,indexable,sitemap,static,redirectTarget,readySelector,postLoadAssertions,isolation. 위14행 모두 locales[ko,en],canonical=self,indexable=true,sitemap=true,static=true,unprefixed redirect=ko self, hreflang ko/en 및 x-default=해당기능의en URL(현 generate-static-pages.mjs:139와동일). 신규기능social slug는 path를 '-'로 연결한고정slug(기존convert와Excel slug유지), SEO에 사용자행동ko/en문구. 생성기목록으로 expected자기생성 금지.
예외exact: `/tools/hwp-editor` en unavailable; `/tools/document-compare/results/:pairNumber` session/no-static; `/tools/office-editor/app`와`/tools/excel-merger/xls-preserve` isolated/noindex; retired `/tools/word-compare`, `/tools/hwp-compare` redirect; 기존 `/tools/pdf-editor/page-numbers`,`/tools/pdf-editor/header-footer`,`/tools/pdf-editor/watermark`,`/tools/pdf-editor/stamp` canonical finish. 각 경로의 locale expansion을 명시적 허용변환으로만 허용하고 새로운suffix wildcard허용없음.
광역scanner는 실행소스 모든확장자와 신규하위경로를 읽되 dependency/VCS/문서/fixture/generated/vendor별 source-root명시분류표를 정적으로 가지고 재귀범위를 관리. 문서·fixture는 런타임금지검사 예외여도 route계약 fixture로서 검증한다. generated/vendor는 실제배포graph확인으로 대조하며 namespace 전체white-list는없다. 허용 예외마다 exact relative file+AST node kind 또는 exact route+purpose+owner를 기록; 신규동적 unresolved route는 failure. 사용자4항목은 내용접근하지 않는 exact제외. 기존vendor사본안링크는 upstream ownership inventory로 분리하고 앱route누락을 감추는예외로 쓰지 않는다.


## R2 추가 반박 수용 — dirty 판정 확정
U9-XR2-01 수용. 뒤집힌 판단 추가1건(총8건): 추상dirty를feature별확인조건으로교체한다. preset route 전환 확인 필요 = 아래조건 중 하나. 파일 없이옵션만조정한것은false(빈화면간목적이동은확인0).
|feature|confirm predicate|
|PDF organize|sources.length>0 또는 pages.length>0 또는 inspecting 또는 operation.status=running 또는 download.result존재|
|PDF convert|file존재 또는 loading 또는 operation.status=running 또는 download.result존재|
|image editor|file존재 또는 historyState.length>emptyReadyHistoryLength 또는 regionEffectBusy/stickerBusy 또는 바깥progress.status=running 또는 downloadable result존재|
|video|items.length>0 또는 progress.status=running/입력probe진행 또는 downloadableOutputs.length>0|
|audio|document존재 또는 undoHistory.length>0 또는 redoHistory.length>0 또는 busy/파일decode진행 또는 lastResult !== ""|
image의emptyReadyHistoryLength는최초빈canvas준비직후history.length를1회고정한값이며사용자조작후다시갱신하지않는다. 다른탭(batch/collage/gif)에입력/결과/진행이있어editor목적으로이동할때도같은hasInput/hasResult/isRunning OR조건으로확인; 탭입력을숨긴채없다고판정하지않는다. 결과를이미다운로드했더라도card/URL이남으면true. 입력만로드하고미편집이어도true. 취소승인후입력보존, 기존result폐기는기존v2계약대로.
각helper는실제feature state를인자로받는순수판정이며새전역generic preset router가아니다. 빈상태/옵션만변경→confirm0, file-only/running/result/undo-only→confirm1, 거부→이전URLreplace/상태유지/루프0를unit및브라우저에서고정한다. R3재확인대기.


## R3 추가 반박 수용 — audio 결과는 URL이 아니라 notice
U9-XR3-01 수용(추가1건, 총9건): AudioStudioPage.tsx:499의downloadAudio는즉시다운로드이고:501의lastResult는문자열,:659는안내notice다. audio confirm predicate의결과항목은정확히`lastResult !== ""`. 승인시`setLastResult("")`로이전성공안내를지우며 **audio에새retained Blob URL/card를만들지않고 revoke도호출하지않는다**. v2의result revoke공통문구는실제resultURL소유feature에만적용한다. notice남은상태→confirm1,승인→notice비움,거부→notice유지/URL원복을fixture로확정. R4재확인대기.


## 최종 정본화 기록 — 2026-09-09, Codx

실제 `gpt-5.6-sol` 구현자 반박 4회, 수정/철회한 판단 9건. 마지막 독립 판정: `/tmp/worklazy-canon/reviews/u9-r4.md`. **이견 0의 범위: 실제 구현은 U8 종결 뒤 최신 해시·전체 도구 목록·예산·열린 계획 재대조가 선행한다.**
상단 정본 상태와 이 최종 기록이 본문의 과거 “재확인 대기” 기록보다 우선한다. 상세 계약은 최종 v3/v4의 추가 정정이 같은 항목의 이전 문안보다 우선한다. 제품 구현에는 착수하지 않았다. 공통 기준 해시 게이트·열린 계획 소유권·고정 예산은 `canon-rounds-20260909/GATES.md`를 함께 읽는다.


## 실행 준비 — 2026-09-13 Codx

U8종결증거 `../archive/u8-pdf-compare-20260913/closure-evidence/CLOSURE.json`, root release ff-only 동기화와 사용자유지보수상태불변 확인. 상세인계 `/tmp/worklazy-u9-reading/EXECUTION-HANDOFF-PENDING.md`는 지금 선행종결조건을 충족했으며 실제 실행gate는 구현담당이 기록한다. 사용자의 어려운코딩Astra 지정에 따라 feature별preset비동기수명·보존/거부URL복원·비디오격리·ASTinventory 등 어려운부분을 Astra에게 맡기고 일반 등록/마감/배포는 Sol로 넘긴다. 동일 공간 제품writer는 항상1명. Gemini source위치보완 `/tmp/worklazy-u9-reading/FOLLOWUP-REPORT.md`와ROOT-NOTES를 읽기보조로만 사용하고 이전 /organize endpoint·subpathSW복사 제안은기각유지.

실행gate PASS: `/tmp/worklazy-u9-core/GATE.json`, source9fa435a·d9ancestor exit0·198파일차이(12670삽입5235삭제), actualregistry23/missing0/unexpected0/duplicate0, caps5null/overrides{}/multiplier1/원baselineSHA동일. U6~U8등록과현재PDF수리 보존, UI/번들 미착수·동시제품writer없음. isolated `/tmp/worklazy-u9-impl`와기존U8의존링크 사용, 설치/패치실행0·금지입력내용읽기0. root가gate원문을대조했다.

D0독립14행·feature별typed계약과수명구현 진행중. 기존PDF organize/convert의abort소유가없던부분은 실제inspect/render/worker/OCR에취소전달하는직접영향범위로연결하고 관련소비자검사를기록한다. image기존탭unmount구조에서정본의타탭입력보존을실현할때숨은editor전역키보드등비활성소유자경계도국소검사한다. 현재컴파일/새browser검수/최종통합완료판정은아직아님. Gemini D3읽기 source지도와englishPageSeo/U4canonical보완은 `/tmp/worklazy-u9-reading/D3-REPORT.md`, `D3-ROOT-NOTES.md`에보존한다.


D0/D1/D2 코어 고정 — 2026-09-13 Codx: `/tmp/worklazy-u9-core/REPORT.md`, FREEZE/source/build/evidence manifests 및 overlay. root source36/manifest·archive4 SHA대조 mismatch0 (`ROOT-FREEZE-CHECK.json`). final QA build6와tsc, frozen pureunit8/contract14, final image-history표본 및4initialcapture확정. 과거build3~5 PDF/audio/video/28route browser성공은 관련실행artifact귀속증거미보존으로 최종재사용UNVERIFIED이며 통과승격하지않는다. 독립Astra는고위험대표표본만고정build로재현하고, 나머지필수는Sol final에서회수한다. recursiveAST scanner는별도Astra writer의후속D3, SEO/static/social등록은Sol 후속; 코어완료를U9종결로보지않는다. GeminiFlash session71281/conversation98fcb492의DONE view_file로4PNG 실제열람확인, 관찰시각차단0. `/tmp/worklazy-u9-gemini-visual/ROOT-DISPOSITION.md`의모바일하단·대화상자·상호작용미확인범위는최종선정검수로회수한다.

독립코어검수 수용: `/tmp/worklazy-u9-core-review/REPORT.md`, source36/HEAD/status 불변, finalbuild6실제응답165건/46경로SHAmismatch0. PDFpending/실제3쪽90도/거부queryhash·result보존/승인pageID보존+revoke, audio원read반환뒤동일File재획득/WAV/notice거부보존·승인삭제, video정확parentCOI+MP3(audio1/video0) 대표표본확정. 4199connectionrefused 원실패뒤reviewer4200native서버사용. audio원read영구hold해제전재획득이라는추가강화표본30s실패는보존하되정본의추가약속으로승격하지않음. finalimagehistory8pureunit/core14계약은고정근거재사용. 코어새차단0, D3·probe·OCRsuccess·최종matrix/production/시각·배포이월유지.
