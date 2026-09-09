# 검토 기록 (Review Notes)

검토 과정에서 산출된 사고의 결과물 정본 — 판정·기각 사유·실측 수치·가설 검증을 작업 단위로 기록한다(「작업 기록」 규칙). 코드에 일어난 변경 자체는 `CHANGELOG.md`에 간결히 기록하고, 여기에는 "왜 그렇게 했고 무엇을 기각했나"를 남긴다. 같은 길을 다시 제안하기 전에 이 파일을 먼저 확인한다.

## 2026-09-09

### 번들 기본 상한 해제 (Codx)

최신 사용자 결정에 따라 기본 5종 크기 한계를 JSON에서도 유지되는 `null`로 표현했다. 중간 워킹트리의 1GiB 한계는 여전히 초과 시 차단하므로 무상한과 같지 않아 채택하지 않았다. 계측 schema·정수 bytes·route·module 귀속·배포 inventory 검증은 유지하며, 명시 환경변수 상한은 통제된 대조용으로 계속 검증한다. 이 결정은 과거 U4 SCOPE-OUT의 크기 차단 사유를 해제하지만, 미실행 게이트나 성능 목표 미달을 통과로 바꾸지 않는다.

관련 unit **32/32**를 실제 실행했다. Astra 독립 실험에서 각 지표 **2GiB+7B** 증가의 기본 통과, JSON null 보존, 명시 0B 상한 초과 거부와 경계 일치 통과를 확인했다. 잘못된 metric 값 6종×5와 schema·route·module·inventory 누락은 거부됐다. 증거 `/tmp/worklazy-todo-execution-20260909/bundle-unit.log`, `/tmp/worklazy-u4-audit3/meter-review/`; 검수 중 추적 파일 2,726개 SHA 변화 0. 최종 통합 번들 실측은 U4 병합 게이트에서 회수한다. — Codx

### BL04 XLSX/XLSM 오류 셀 타입 보존 (Codx)

기준 `d9c79b7`과 BL04 대상 diff는 0이었다. ExcelJS 정규화 전의 일반 셀 값 또는 `cacheState=present`인 수식 result에 own string `error` 속성이 있는지만 판정해 모델 `type`을 `error`로 교정했다. 값·표시값·캐시 값은 기존 문자열을 유지하고 missing 수식 캐시는 `null/undefined/blank/missing`을 유지한다. 오류명 문자열 blacklist, wrapper 재귀 탐색, legacy 숫자 오류 통일은 실제 문자열과 기존 모델을 바꾸므로 채택하지 않았다.

합성 XLSX와 실제 content type·VBA 프로젝트를 가진 XLSM에서 `#DIV/0!`·`#N/A` 머리글은 `uncertain`, 같은 literal 문자열은 `suggested(1)`이었다. 일반 오류 7종, cached/missing 수식, 실제 오류와 literal의 비교 차이, 기존 XLS/XLSB/SpreadsheetML 및 비오류 모델을 대조했다. helper false·문자열 blacklist·수식 cache 오류 누락의 세 음성 대조는 각각 새 회귀를 실패시켰다. 전체 unit **499/499**, production build **2,857 modules·71 정적 페이지**, Excel compare·cleaner·QR bulk·utilities 스모크와 static recovery **119**를 통과했다. 번들 계측은 91 JS/1 CSS, entry **314,039B**, affected routes **4,236,777B**, shared **1,393,351B**, app **5,944,167B**, CSS **38,242B**이며 상한은 적용하지 않았다. 기준 게이트 기록의 app **5,944,016B**보다 **+151B**다. 첫 Excel compare 스모크는 preview 미기동으로 연결 거부였고 같은 소스에서 서버를 띄운 재실행은 통과했다. — Codx

### U4 PDF 마무리 main 통합 게이트 SCOPE-OUT (Codx)

원격 main `2d0ff3a8280bdd1c3149946306d0ca394244fd5c`, U4 `d3a8d89d19dbb6165cacce8257838dc3dff9b084`, merge-base `5bc6854175331bdd73b267784d9633cdccda8446`를 대조하고 `fb7abde0d40649444b877ccf4ef899bb84f46631`로 `--no-ff` 병합했다. 공통 12파일의 모의 충돌은 CHANGELOG 1·review-notes 1·접근성 감사 7·접근성 unit 2·visual unit 1 hunk였다.

접근성 감사는 U4의 소유권·incomplete·PDF F2/F3/F4a/F4b 상태와 main의 Excel 중복 결과 8상태·scope·대비 측정을 함께 유지했다. 양 부모 standalone 함수 12개 byte 동일, package와 ko/en locale의 양 부모 변경키 546개 누락 0, visual 246·QA scenario 80·profile 628, 충돌 단위 18/18을 확인했다. 부모 독립 의미 검수도 284파일 SHA와 PDF 35+main 16 등록의 합집합 43페이지를 대조해 승인했다(`/tmp/worklazy-u4-handoff/MERGE-REVIEW.md`). U4-8 최종 test-only 표본은 정상+필수7+추가2와 원문 대형 사각형4개 소실 mutant를 검출한 `/tmp/worklazy-u4-8-review4/REPORT.md` 승인에 연결된다.

통합 후보에서 TypeScript, production build 2,857 modules·정적 71페이지, 전체 unit 496/496, static recovery 119, diff-check는 통과했다. 고정 schema-v3 baseline SHA `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`, override `{}`, multiplier 1의 scoped/full 측정은 둘 다 app JS 증가 **100,301B > 96,000B**로 실패했다. 병합 전 동일 schema-v3 93,493B에서 **+6,808B** 늘어 상한을 4,301B 넘었다. 부모 독립 재계산은 scoped/full 91 JS 파일·합계 5,944,016B 동일과 유일한 app 실패를 확인했다(`/tmp/worklazy-u4-handoff/bundle-stop-review.json`). category 증분은 entry +2,317B, Excel compare +8,071B, Excel cleaner +554B, QR +676B, document compare -4,810B, shared +7B, PDF -2B, 그 외 합 -5B다(`/tmp/worklazy-u4-handoff/merge-category-increment.json`).

정본의 예산 우선 중단 조건에 따라 상한·baseline·기능을 바꾸지 않고 SCOPE-OUT했다. 전체 browser/office/new-tools/utilities/Excel/QR/recovery, PDF 골든·oracle·legacy, 12입력×3 성능, 144셀 raster, visual/a11y/rendering, 의존 음성, CSS·legacy·route 묶음과 규칙 19 시각 검수는 이 후보에서 미실행 pending이다. main push·배포도 하지 않았다. 원로그와 JSON은 `/tmp/worklazy-u4-mergegate/`에 보존했다.

### U4-8 fix-2 — 최종 raster 장식별 sentinel 보강 (Codx)

**실행 게이트·범위** — 시작 branch/head는 `s3-pdf-finish`/`be20fdd1043ec7c7b51db665a54dbd63aa684748`로 지시와 일치했고 열린 PDF 계획서와 상반된 지시는 없었다. R1 자원 소유권 제품 코드는 검수 통과 범위로 보존했다. 사용자 소유 `CLAUDE.md`·`PROJECT_RULES.md`와 미추적 DOCX·HTML·`newui/`는 수정·stage하지 않았고 main 병합·push·배포도 하지 않았다.

**장식별 검출 계약** — 8행·7축 pairwise와 구조 잔여·연산자 순서·전체 픽셀 비교는 유지하되, 전체 평균은 보조 대조로만 남겼다. 번호는 파랑, 머리말은 초록, 도장은 주황, image/text 워터마크는 자홍으로 분리하고 각 전용 영역의 색상 픽셀 수를 raster 직전과 최종 raster에서 직접 단언한다. 중앙 워터마크 존재 수는 원문·폼 겹침 영역을 제외해 비중첩으로 세며, 별도 겹침 영역에서는 background의 워터마크 픽셀 0과 원문/평면화 폼 보존, foreground의 워터마크 픽셀 존재와 불투명 image의 완전 덮임을 단언한다. pairwise 배열이 만들 수 없는 세 축 조합 두 건(image/foreground/raster-on, text/background/raster-on)을 실제 엔진 출력으로 보충해 image/text × background/foreground 네 최종 가시 대조를 모두 고정했다.

**게이트 건전성** — 정상 control은 8 pairwise+2 가시성 대조, 최종 raster 6건으로 exit 0이었다. 기존 네 변이(text plan 생략, stamp/text 순서 반전, structure 옵션 생략, raster 분기 생략)는 각각 exit 1을 유지했다. raster 직전 stream에서 도장·텍스트·워터마크를 제거한 새 세 변이도 각각 최종 도장 **0**, 번호 **0**, 워터마크 **0** sentinel 단언으로 exit 1이었다. 일곱 변이는 모두 치환 횟수 1 이상과 원본 대비 source 변경을 확인했으며, 정상 최종 raster의 직접 계수는 번호 **166**, 머리말 **219**, 도장 **2,646**, 비중첩 image 워터마크 **17,344~18,144**, 비중첩 text 워터마크 **732~764** 픽셀이다. 원출력·patch·JSON은 `/tmp/worklazy-u4-8-fix2/`에 보존한다.

**검증·귀속·이월** — TypeScript 진단 0, unit **346/346**, production build **2,855 modules·71 정적 페이지**, static(startup recovery 119), PDF finish 전체 체인과 legacy oracle `totalDiffs=0`을 통과했다. `TEST_SCOPE=pdf` browser 1차는 이번 변경과 무관한 legacy 출력의 토글 상태 대기(`tests/browser-smoke.mjs:115`)가 180초 timeout이었고, 소스 무변경 재실행은 통과해 두 로그를 모두 보존했다. schema-v3 scoped/full 번들은 override `{}`·multiplier 1에서 5종 모두 통과했고 scoped 증분/상한/잔여는 entry **12,449/20,480/8,031B**, PDF route **77,624/82,000/4,376B**, shared 순증 **2,511/30,720/28,209B**, app **93,493/96,000/2,507B**, CSS **400/10,240/9,840B**다. `git diff --check`도 통과했다. 제품·locale·SEO·AdSense 실행 경로와 추적된 시각 기준선은 바뀌지 않았다. 전체 browser·office·new-tools·utilities·QR 2종·recovery·Excel 2종·a11y 전량·visual 전량·rendering 전량·`legacy:manifest`·성능 12입력·144셀 벤치는 지시대로 병합 게이트 1회로 이월한다. — Codx

### U4-8 fix-1 — 실행 소유권·전체 축 골든·다중 글꼴 안내 수리 (Codx)

**실행 게이트·귀속** — 시작 branch/head는 `s3-pdf-finish`/`3dbef33967bb83d89f758094ce5d431d920d559d`로 지시와 일치했고 열린 계획서 충돌은 없었다. 검수 R1~R3을 이번 수리 범위로 수용했고, 부모에도 있는 상위 텍스트 옵션 API 함정 R4는 아래 backlog로 분리했다. 사용자 소유 `CLAUDE.md`·`PROJECT_RULES.md`와 미추적 DOCX·HTML·`newui/`는 수정·stage하지 않았고 main 병합·push·배포도 하지 않았다.

**R1 실행 소유권** — PDF finish 실행마다 소유 세대를 부여하고 패널 unmount·파일 교체·파일 제거에서 세대를 폐기한 뒤 abort한다. 성공 반환, ZIP 생성 뒤, 오류의 `partialResults` 인계 전마다 소유권을 검사해 잃은 작업은 결과를 등록하거나 Object URL을 만들지 않고 각 output을 dispose한다. 취소 버튼은 세대를 폐기하지 않으므로 같은 화면 사용자의 취소에서는 이미 완료된 1개 결과를 계속 인계한다. 실제 Chromium 지연 주입에서 화면 이동과 파일 교체는 각각 다운로드 **0·PDF URL 0·OPFS 결과 0**, 같은 화면 취소는 다운로드 **1·OPFS 결과 1·미해제 PDF URL 1**을 보존했고 이후 화면 이탈 때 OPFS 0·URL revoke로 정리됐다. 저장소 회귀는 자신의 strict-port Vite 준비 로그를 확인하고 세 대조군을 모두 실행한다.

**R2 전체 축 실제 출력 골든** — fixture에 이진 7축을 명시했다: cleanup remove/preserve, form flatten/preserve, watermark image/text, layer background/foreground, text number-header/number, stamp on/off, raster on/off. 8행 orthogonal covering array가 21개 축 쌍의 네 상호작용을 각각 정확히 두 번 덮으며, 여덟 행 모두 살아 있는 엔진의 실제 출력이다. 네 행은 마지막 150DPI PNG raster까지 수행한다. 대표 pair-1은 metadata·첨부 제거+form flatten+image background watermark+번호/머리말+stamp+raster를 함께 켜고 raster 직전 `/Contents` 순서 **watermark→원문→FlatWidget Do→text→stamp**, title/첨부/AcroForm/Widget 잔여 0, 최종 Font 0·Image XObject 1을 단언했다. PDF.js/NAPI-canvas의 직전/최종 400×600 비교는 변경 픽셀 **2.0642%**, 평균 채널 차이 **0.9585/255**였고 네 raster 케이스 모두 허용치 8%·8/255 안이다. 정상 control은 exit 0, 제품에서 text plan 생략·stamp/text 순서 반전·structure 옵션 생략·raster 분기 생략을 각각 주입한 네 mutant는 모두 exit 1이었다. 이전 골든에서 exit 0이던 structure/raster 생략까지는 검출했지만, 이 시점의 전 페이지 평균 비교는 raster 직전 장식 누락 세 변이를 검출하지 못했다. 장식별 생존 보장은 위 fix-2가 보완한다.

**R3 다중 글꼴 용량 안내** — 사전 분석이 전체 글꼴 경고가 필요한 출력 수를 별도로 반환하고 preflight·완료·부분 결과 문구가 그 수와 `3.8MB × 수`를 함께 표시한다. 3개 실제 출력의 문구는 ko **“전체 글꼴이 필요한 출력은 3개입니다. 파일당 약 3.8MB, 이번 묶음은 합계 약 11.4MB 커질 수 있습니다.”**, en **“The full font is needed for 3 output(s). It may add about 3.8 MB per file, or about 11.4 MB for this batch.”**로 확인했다.

**R4 분리와 보고 보정** — 상위 텍스트 옵션과 optional `textDecorations`를 함께 둔 API는 stamp/image watermark 호출에서 텍스트를 조용히 버릴 수 있다. 부모에도 같고 UI는 명시 배열을 사용하므로 신규 회귀로 수리하지 않았다. typed/discriminated 계약 문서화 또는 모호한 입력 거부를 `docs/backlog.md`에 남겼으며, stamp-only 호출에 placeholder를 추가할 수 있는 무조건 fallback은 기각했다. 아래 원 U4-8 기록의 “모든 상호작용”과 27항 완전 반영으로 읽히는 표현은 후속 검수 R1~R3을 반영해 장식 4축 및 당시 대조 범위로 정정했다.

**검증·예산** — TypeScript, unit **346/346**, production build **2,855 modules·71 정적 페이지**, static(startup recovery 119), PDF finish의 UI·소유권·watermark·stamp·structure·7축 combined 체인, PDF scoped browser, legacy oracle(client3·structure4·render32·output4·input1, totalDiffs0), CSS orphan 0, registry20을 통과했다. schema-v3 고정 기준선과 override `{}`·multiplier 1에서 scoped 증분/상한/잔여는 entry **12,449/20,480/8,031B**, PDF route **77,624/82,000/4,376B**, shared 순증 **2,511/30,720/28,209B**, app **93,493/96,000/2,507B**, CSS **400/10,240/9,840B**다. full 독립 빌드도 같은 entry/shared/app/CSS와 19-route 합산 **-448,905B**로 통과했으며 PDF route 증가와 상쇄하지 않았다. 전체 browser·office·new-tools·utilities·QR 2종·recovery·Excel 2종·full a11y·full visual·full rendering·`legacy:manifest`·성능 12입력·144셀 벤치는 지시대로 이번 수리에서 실행하지 않고 통합 병합 게이트로 이월했다. 원출력·mutant 전후·브라우저 대조·계측 JSON은 `/tmp/worklazy-u4-8-fix1/REPORT.md`와 `logs/`에 보존한다. — Codx

### U4-8 — PDF 마무리 복합 실행·다중 결과·최종 감사 (Codx)

**실행 게이트와 결함 귀속** — 시작 branch/head는 `s3-pdf-finish`/`620f87943e27c76312e384a3dae5104941d12c98`로 지시와 일치했고 열린 계획서 충돌과 추적된 루트 merge-gate 문서는 없었다. 사용자 소유 `CLAUDE.md`·`PROJECT_RULES.md`와 미추적 DOCX·HTML·`newui/`는 수정·stage하지 않았고 main 병합·push·배포도 하지 않았다. U4-5에서 들어온 워터마크+도장 배타와 도장/이미지 워터마크 조기 반환은 정본 12에 근거 없는 기존 결함으로 판정했다. 다중 선택 도입 뒤 “다시 선택하면 교체”를 전제하던 finish 테스트는 이번 변경 귀속으로 명시적 제거→선택 흐름으로 고쳤다.

**복합 엔진·사용자 경로** — `analyzeDocument`를 계열별 plan 누적으로 바꾸고 구조 재구축 뒤 background 워터마크→원문→foreground 워터마크→번호/머리말/꼬리말→도장→선택적 raster 순서를 실제 content stream으로 만들었다. 당시 네 장식 축은 조합 폭발을 피하되 **그 네 축 안의 pairwise 상호작용만** 덮는 6개 pairwise + all-on foreground/background 2개, 총 **8개 실제 출력 PDF**로 줄였다. 구조와 최종 raster 축은 이 골든에 없었고 위 fix-1의 7축 골든이 이를 대체한다. PDF.js 텍스트, content operator 순서, XObject와 Font ref를 검사했으며 같은 문서의 텍스트 장식은 Font 1개를 공유한다. 제품에서 text plan을 제거한 mutant는 `missing text decoration: PAGE-1`로 **exit 1**이었고 원복 뒤 체인에 등록된 정상 골든이 통과했다.

**다중 결과·호환성** — finish 업로드는 파일을 concurrency 1로 검사·처리하고 첫 active preview 외 PDF.js cache를 즉시 해제한다. 각 결과는 기존 OPFS/Blob store의 dispose를 유지하며 취소·후속 ZIP 실패 때 완료된 부분 결과를 UI에 보존한다. 결과가 2개 이상이면 C2로 한글·중복명을 안전하게 예약하고 C3와 `@zip.js/zip.js`를 지연 import해 ZIP을 만든다. 브라우저 스모크는 같은 `결과.pdf` 2개에서 개별 PDF 2개+ZIP 1개, ZIP entry `결과-마무리.pdf`/`결과-마무리-2.pdf`, 각 출력의 번호·워터마크와 원문 Font 1+공유 장식 Font 1을 단언했다. legacy organize는 UI·문구와 worker blob을 바꾸지 않고 PNG canvas와 worker 배치 상수를 `legacy-organize` preset으로 고정했다. 실제 Chrome 두 옵션 스모크는 각 페이지의 PNG XObject와 번호를 단언하며, 페이지 번호 font를 끈 제품 mutant는 `Legacy PDF page 1 omitted…`, **exit 1**이었다. 기존 oracle은 client 3·structure 4·render 32·output 4·input 1, `totalDiffs=0`이다.

**누락 감사·현지화** — 정본 확정 1~27을 파일/줄로 다시 대조해 당시 26개는 U4-0~U4-7 산출물에서 확인했다고 기록했고, watermark/stamp preset만 자기 canonical을 유지하던 **1건**을 발견해 page-numbers/header-footer와 함께 `/tools/pdf-editor/finish`로 통일하고 unit·정적 출력 검증을 보강했다. 후속 검수가 R1~R3을 찾아냈으므로 이 26+1 집계는 27항의 완전 반영 증거가 아니며 위 fix-1 판정이 우선한다. 다중 업로드·ZIP·진행 문구와 finish 메타/소셜 입력은 ko/en을 동시에 갱신했다. route 수는 늘지 않아 기존 71개 정적 페이지·사이트맵 범위만 재생성했고 AdSense 실행 경로는 건드리지 않았다. 당시 27행 대조표와 재현 로그는 `/tmp/worklazy-u4-8/REPORT.md`에 보존한다.

**탐색 빌드와 예산** — 고정 schema-v3 기준선 SHA-256은 `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`, override `{}`, multiplier `1`이며 상한은 불변이다. 최초→엔진에서 entry/PDF route/shared/app/CSS 증분은 각각 **+14/+398/+48/+520/0B**, 엔진→복수 선택 UI에서는 **+204/+1,111/+58/+1,361/0B**였다. 70% 중단선 아래라 계속했다. 최종 정본 감사 수정까지 포함한 증분/상한/잔여는 entry **12,414/20,480/8,066B**, PDF route **77,436/82,000/4,564B**, shared **2,542/30,720/28,178B**, app **93,325/96,000/2,675B**, CSS **400/10,240/9,840B**다. 의무 초기·엔진·UI 세 checkpoint 뒤 legacy/누락 감사 변경의 최종성을 확인하려고 최종 계측을 추가 실행했으며, 어느 측정에서도 상한 상향·override는 사용하지 않았다.

**검증** — TypeScript, 전체 unit 346건, production build 2,855 modules·71 정적 페이지, static(startup recovery 119), PDF finish 체인(직접 진입 20+복합 배치+기존 4종 golden+당시 장식 4축 복합 8), 공식 oracle 87/허용56/제외31/양 renderer SHA56, PDF scoped browser, legacy 3종 oracle, CSS orphan 0, tool registry 20을 통과했다. 이 통과 목록은 후속 검수가 발견한 R1~R3 및 구조/raster 결합 검출력까지 포함했다는 뜻이 아니며, 해당 보완은 위 fix-1에 기록한다. 전체 browser·office·new-tools·utilities·QR 2종·recovery·Excel 2종·full a11y·full visual·full rendering·`legacy:manifest`·성능 12입력은 지시대로 병합 게이트 1회로 유예한다. — Codx

### U4-7 fix-1 — 벤치 게이트·부분 결과·페이지 정리 수리 (Codx)

**실행 게이트·귀속** — 시작 branch/head는 `s3-pdf-finish`/`661f717bc11ecbab06a777a25db2700164988648`로 지시와 일치했고 관련 열린 계획서의 상반 지시는 없었다. 검수 R1~R5는 이 기준 커밋에서 생긴 결함으로 수용해 모두 수리했다. 사용자 소유 `CLAUDE.md`·`PROJECT_RULES.md`와 미추적 DOCX·HTML·`newui/`는 수정·stage하지 않았고, main 병합·push·배포도 하지 않았다. 기존 `save()` 할당 오류, preview 포트 오인, scoped 로그 문구, 공용 incomplete 125, 실기기 미교정, 128MiB heartbeat·의존 패치는 이번 결함과 분리해 `docs/backlog.md`에 이월했다.

**R1 정정·R2 게이트 건전성** — 보존 원자료 `/tmp/worklazy-u4-7/benchmark-final/raw.json`의 SHA-256은 수정 전후 모두 **`6deae09a9f03e35cd5c879d456c924caad5ece14e94c54b54c966c9beb1b2f55`**다. 각 표본에서 target별 합계를 먼저 대조한 뒤 `usedSize`와 `backingStorageSize`의 최고점을 서로 독립 계산하고, 세 기록에서 지표별 최댓값을 선택했다. backing 값은 **25/144셀**이 정정됐고 used 값 변경은 0이다. 최대 정정은 desktop/photo-scan/16쪽/300DPI/PNG의 **461,501,557 → 585,737,224B**, 차이 **124,235,667B(118.4804MiB)**다. 기존 U4-7의 48행 표·계산식도 정정했으며 JPEG q0.85·미교정 폴백 150 DPI·결정 JSON은 바꾸지 않았다.

report-only는 저장 peak를 결과로 신뢰하지 않고 정확한 144셀 Cartesian 집합, 환경별 정확한 배치 집합, `blank-4 → text-vector-4 → photo-scan-4` 순서, 실행별 결과 3개와 보유 bytes 합, worker 표본, load/render/encode/embed/save/retain/release 7경계를 검사한다. 실제 음성 주입은 `peak=0`을 **`stored peak does not match its raw samples`**, 모바일 배치의 desktop 복제를 **`batch environments must equal the exact configured set`**, 결과 3→2 삭제를 **`must contain exactly three outputs (2 !== 3)`**로 모두 거부했다. 기존 worker 삭제와 render 경계 삭제 음성도 계속 거부한다. 대표 실제 재집계는 desktop/blank/4쪽/300DPI/PNG backing **176,358,692 → 277,836,862B**이며 record 1/sample 21의 두 target 합이 근거다.

**R3·R4 저장 경계** — OPFS B의 `close()` 또는 `getFile()` await 직후 abort를 재검사해 미완료 B만 제거하고 완료 A를 보존한다. 두 재현 모두 종전 `[A,B]` 등록/마지막 파일 정상 반환에서 **AbortError, partial `[A]`, entry `result-1.pdf`만 잔존**으로 바뀌었다. 결과별 dispose가 자기 entry만 제거하고 마지막 결과가 해제될 때만 세션을 지우며, 배치 dispose의 전체 세션 해제 계약은 유지한다. 두 번째 메모리 결과의 실제 `new Blob()` RangeError는 종전 raw `RangeError`·partial 없음에서 **`PdfFinishPartialError` / `PDF_FINISH_RESULT_MEMORY_LIMIT` / partial `[A]`**로 정규화됐고 C는 읽지 않았다. 별도 기존 `PDFDocument.save()` RangeError는 여전히 raw 오류·partial 없음이며 이번 수리 성과로 포함하지 않는다.

**R5 페이지 수명주기** — geometry preflight와 실제 페이지의 취득·캔버스 할당·render·encode·embed를 각각 page 단위 `try/finally`로 묶었다. 실제 PDF.js 재현에서 render 중 취소는 `render → cancel → settled(RenderingCancelledException) → cleanup → release → destroy`, encode 경계 취소는 `render → settled → render stage → encode stage → cleanup → release → destroy`, canvas context 할당 실패는 `cleanup → release → destroy` 순서다. 이를 실제 메모리 누수 입증으로 확대하지 않고 명시된 정리 순서 복구로 판정한다. Chromium OPFS close-abort도 종전 성공 `{returnedSize:3}`에서 `{mode:"opfs", error:"AbortError"}`로 바뀌었다.

**검증·예산** — TypeScript, 전체 unit **345/345**, production build **2,854 modules·71 정적 페이지**, static(startup recovery 119), `test:pdf-finish`의 직접 진입 20·watermark contents4+128+32·stamp16+16+8·structure appearance5×2/조합4/parentless0, 공식 oracle 87/허용56/제외31/양 renderer SHA56, PDF scoped browser, legacy oracle client3·structure4·render32·output4·input1/totalDiffs0을 통과했다. 전체 144셀 벤치는 다시 실행하지 않고 보존 raw의 report-only만 수행했다. 최초 scoped/full 번들을 실수로 겹쳐 시작한 시도는 JSON 생성 전에 중단돼 증거에서 폐기했고, 이후 두 측정을 순차 독립 실행했다.

최종 scoped 증분/상한/잔여는 entry **12,201/20,480/8,279B**, PDF route **75,807/82,000/6,193B**, shared 순증 **2,413/30,720/28,307B**, app **91,306/96,000/4,694B**, CSS **400/10,240/9,840B**다. override `{}`, multiplier `1`, 배포·계측 inventory 누락 0이며 상한을 바꾸지 않았다. full은 같은 entry/shared/app/CSS와 19-route 합산 **-433,267B**로 통과했고 scoped PDF 증가와 상쇄하지 않았다. 이번 변경은 테스트·내부 저장/정리 경계뿐이라 사용자 문구·route를 바꾸지 않았고 ko/en 현지화, SEO·정적 페이지, AdSense 격리에는 동반 변경할 표면이 없었다. 추적돼 있던 루트 `MERGE-GATE-CHECKLIST.md`는 내용 손실 없이 무시되는 `docs/jobs/todo/s3-pdf-finish-state/` 최신본에 합치고 추적에서 제거했다. 상세 로그·정정 25셀·전후 재현은 `/tmp/worklazy-u4-7-fix1/REPORT.md`에 보존한다. — Codx

### U4-7 — 이미지 변환 평탄화·벤치 매트릭스 (Codx)

**실행 게이트·탐색 빌드** — 시작 branch/head는 `s3-pdf-finish`/`509730a7c0b412f82834946b84231d3e07d00544`로 지시와 일치했고 열린 계획서 충돌은 없었다. 사용자 소유 `CLAUDE.md`·`PROJECT_RULES.md`, 미추적 DOCX·HTML·`newui/`와 금지 worktree는 수정·stage하지 않았고 main 병합·push·배포도 하지 않았다. schema-v3 기준선 SHA-256은 `4caaa9c6…30ea`다. 구현 전 탐색값은 entry **11,091B**, PDF route **71,060B**, shared 순증 **2,430B**, app **85,498B**, CSS **400B**였고 잔여는 PDF **10,940B**, app **10,502B**였다. 선택 페이지 래스터·OPFS 보유·한영 UI를 묶은 탐색 후보도 PDF **73,821/82,000B**, app **89,158/96,000B**로 예산 안임을 확인한 뒤 구현을 확정했다.

**벤치 절차·환경** — 아래 48행은 fixture 4종 × 쪽수 3종 × 포맷 2종 × 환경 2종이며 각 행의 150/200/300 DPI 셀이 세 열이다(총 144 실행 셀). 각 셀은 준비 1회 뒤 3회 기록했고 최종 PDF bytes와 raster 전체 처리시간은 중앙값, CDP 자원은 세 기록의 최댓값이다. CDP 값은 50ms 주기와 load/render/encode/embed/save/retain/release 경계에서 메인+PDF.js worker의 `Runtime.getHeapUsage`를 합산했으며 원자료에는 target별 `usedSize`·`backingStorageSize`와 모든 표본을 보존했다. Chrome binary는 **152.0.7977.64**다. Pixel 7 조건은 **412×839, DPR 2.625, touch와 mobile UA를 적용한 에뮬레이션이며 실기기가 아니다**. native/renderer/canvas 메모리는 실기기 계측이 없어 **미측정**이다. 원자료 `/tmp/worklazy-u4-7/benchmark-final/raw.json`(19MB, SHA-256 **`6deae09a9f03e35cd5c879d456c924caad5ece14e94c54b54c966c9beb1b2f55`**)은 덮어쓰지 않았다. 정정 집계는 각 표본 합계를 target별 값의 합과 먼저 대조하고, 각 기록의 `usedSize`와 `backingStorageSize` 최고점을 원시 표본에서 서로 독립 계산한 뒤 세 기록의 최댓값을 셀 값으로 선택한다. report-only는 정확한 144셀 Cartesian 집합, 환경별 배치, 파일·출력 순서와 보유 bytes 합, 매 실행 worker 표본·7경계를 fail-closed로 검사하며 `summary.json`에는 각 최고점의 기록 번호·표본 시각·경계·target 근거를 남긴다.

표의 각 DPI 셀 표기: **최종 PDF bytes 중앙값 / 처리시간 중앙값 / peak CDP used·backing 최댓값**.

| fixture | pages | format | environment | 150 DPI bytes / time / peak CDP used·backing | 200 DPI bytes / time / peak CDP used·backing | 300 DPI bytes / time / peak CDP used·backing |
|---|---:|---|---|---:|---:|---:|
| blank | 1 | PNG | Desktop host measurement | 7.1KiB / 598ms / 64.69MiB·80.14MiB | 12.0KiB / 755ms / 63.97MiB·97.96MiB | 25.7KiB / 1136ms / 64.11MiB·149.77MiB |
| blank | 1 | PNG | Pixel 7 emulation (not a physical device) | 7.1KiB / 573ms / 64.60MiB·80.14MiB | 12.0KiB / 699ms / 64.01MiB·97.96MiB | 25.7KiB / 1096ms / 64.09MiB·149.78MiB |
| blank | 1 | JPEG | Desktop host measurement | 14.2KiB / 379ms / 63.61MiB·58.03MiB | 24.1KiB / 405ms / 64.04MiB·58.05MiB | 51.9KiB / 442ms / 63.90MiB·58.10MiB |
| blank | 1 | JPEG | Pixel 7 emulation (not a physical device) | 14.2KiB / 368ms / 64.06MiB·58.03MiB | 24.1KiB / 371ms / 64.08MiB·58.05MiB | 51.9KiB / 413ms / 63.88MiB·58.10MiB |
| blank | 4 | PNG | Desktop host measurement | 26.8KiB / 1444ms / 63.86MiB·117.65MiB | 46.0KiB / 2209ms / 64.12MiB·164.63MiB | 101.1KiB / 3540ms / 64.17MiB·264.97MiB |
| blank | 4 | PNG | Pixel 7 emulation (not a physical device) | 26.8KiB / 1413ms / 63.85MiB·117.65MiB | 46.0KiB / 2092ms / 64.85MiB·164.63MiB | 101.1KiB / 3373ms / 64.13MiB·264.97MiB |
| blank | 4 | JPEG | Desktop host measurement | 55.1KiB / 468ms / 63.85MiB·58.92MiB | 94.5KiB / 536ms / 63.85MiB·59.00MiB | 206.0KiB / 660ms / 63.86MiB·59.22MiB |
| blank | 4 | JPEG | Pixel 7 emulation (not a physical device) | 55.1KiB / 450ms / 64.42MiB·58.92MiB | 94.5KiB / 535ms / 63.84MiB·59.00MiB | 206.0KiB / 668ms / 63.84MiB·59.22MiB |
| blank | 16 | PNG | Desktop host measurement | 105.3KiB / 3820ms / 64.89MiB·209.11MiB | 182.3KiB / 6261ms / 64.54MiB·297.45MiB | 402.7KiB / 12381ms / 65.20MiB·530.57MiB |
| blank | 16 | PNG | Pixel 7 emulation (not a physical device) | 105.3KiB / 3759ms / 64.87MiB·186.16MiB | 182.3KiB / 6190ms / 64.98MiB·297.45MiB | 402.7KiB / 12089ms / 65.21MiB·530.57MiB |
| blank | 16 | JPEG | Desktop host measurement | 218.8KiB / 840ms / 64.61MiB·62.49MiB | 376.0KiB / 1202ms / 64.63MiB·62.79MiB | 822.1KiB / 1661ms / 64.61MiB·63.67MiB |
| blank | 16 | JPEG | Pixel 7 emulation (not a physical device) | 218.8KiB / 860ms / 64.64MiB·62.49MiB | 376.0KiB / 1134ms / 64.59MiB·62.79MiB | 822.1KiB / 1608ms / 64.65MiB·63.67MiB |
| text-vector | 1 | PNG | Desktop host measurement | 81.2KiB / 923ms / 65.84MiB·80.40MiB | 119.9KiB / 1329ms / 65.95MiB·98.43MiB | 189.6KiB / 2292ms / 64.70MiB·150.42MiB |
| text-vector | 1 | PNG | Pixel 7 emulation (not a physical device) | 85.5KiB / 921ms / 65.84MiB·80.43MiB | 125.7KiB / 1358ms / 66.12MiB·98.45MiB | 196.3KiB / 2263ms / 64.85MiB·150.46MiB |
| text-vector | 1 | JPEG | Desktop host measurement | 102.8KiB / 401ms / 64.68MiB·58.11MiB | 154.7KiB / 414ms / 65.48MiB·58.21MiB | 272.5KiB / 458ms / 64.76MiB·58.44MiB |
| text-vector | 1 | JPEG | Pixel 7 emulation (not a physical device) | 103.8KiB / 445ms / 64.76MiB·58.11MiB | 153.6KiB / 466ms / 64.74MiB·58.21MiB | 274.3KiB / 499ms / 64.73MiB·58.45MiB |
| text-vector | 4 | PNG | Desktop host measurement | 328.5KiB / 1483ms / 65.71MiB·118.49MiB | 487.2KiB / 1964ms / 65.40MiB·180.70MiB | 769.2KiB / 3619ms / 65.61MiB·265.50MiB |
| text-vector | 4 | PNG | Pixel 7 emulation (not a physical device) | 346.0KiB / 1568ms / 65.46MiB·118.54MiB | 509.5KiB / 2301ms / 65.38MiB·166.00MiB | 796.8KiB / 3648ms / 65.61MiB·265.50MiB |
| text-vector | 4 | JPEG | Desktop host measurement | 410.2KiB / 498ms / 65.58MiB·59.57MiB | 622.7KiB / 575ms / 65.57MiB·59.98MiB | 1.07MiB / 722ms / 65.58MiB·60.92MiB |
| text-vector | 4 | JPEG | Pixel 7 emulation (not a physical device) | 414.2KiB / 562ms / 65.55MiB·59.58MiB | 618.0KiB / 603ms / 65.55MiB·59.98MiB | 1.08MiB / 770ms / 65.56MiB·60.93MiB |
| text-vector | 16 | PNG | Desktop host measurement | 1.31MiB / 4106ms / 67.27MiB·210.46MiB | 1.93MiB / 6702ms / 66.79MiB·298.90MiB | 3.06MiB / 12868ms / 66.26MiB·531.21MiB |
| text-vector | 16 | PNG | Pixel 7 emulation (not a physical device) | 1.38MiB / 4181ms / 66.64MiB·210.53MiB | 2.02MiB / 6767ms / 66.80MiB·298.95MiB | 3.17MiB / 12846ms / 66.65MiB·531.23MiB |
| text-vector | 16 | JPEG | Desktop host measurement | 1.63MiB / 953ms / 67.32MiB·65.42MiB | 2.47MiB / 1191ms / 67.37MiB·67.10MiB | 4.37MiB / 1801ms / 67.37MiB·70.90MiB |
| text-vector | 16 | JPEG | Pixel 7 emulation (not a physical device) | 1.64MiB / 998ms / 67.30MiB·65.45MiB | 2.45MiB / 1244ms / 67.31MiB·67.07MiB | 4.40MiB / 1873ms / 67.40MiB·70.96MiB |
| photo-scan | 1 | PNG | Desktop host measurement | 4.72MiB / 1578ms / 65.45MiB·122.32MiB | 3.94MiB / 1891ms / 65.04MiB·137.28MiB | 4.28MiB / 2982ms / 64.92MiB·190.87MiB |
| photo-scan | 1 | PNG | Pixel 7 emulation (not a physical device) | 4.72MiB / 1556ms / 64.67MiB·122.32MiB | 8.26MiB / 2418ms / 64.73MiB·158.70MiB | 18.13MiB / 4674ms / 65.08MiB·204.84MiB |
| photo-scan | 1 | JPEG | Desktop host measurement | 672.8KiB / 419ms / 64.22MiB·74.73MiB | 1.44MiB / 478ms / 64.25MiB·76.30MiB | 2.90MiB / 537ms / 64.25MiB·79.22MiB |
| photo-scan | 1 | JPEG | Pixel 7 emulation (not a physical device) | 672.8KiB / 426ms / 64.24MiB·74.73MiB | 1.03MiB / 459ms / 64.17MiB·75.47MiB | 1.87MiB / 542ms / 64.13MiB·77.16MiB |
| photo-scan | 4 | PNG | Desktop host measurement | 18.89MiB / 3891ms / 65.09MiB·178.82MiB | 15.76MiB / 4344ms / 65.13MiB·193.11MiB | 17.11MiB / 6369ms / 65.35MiB·297.36MiB |
| photo-scan | 4 | PNG | Pixel 7 emulation (not a physical device) | 18.89MiB / 3878ms / 65.10MiB·178.82MiB | 33.05MiB / 6458ms / 64.85MiB·246.42MiB | 72.51MiB / 14185ms / 64.31MiB·311.57MiB |
| photo-scan | 4 | JPEG | Desktop host measurement | 2.63MiB / 648ms / 64.39MiB·83.73MiB | 5.77MiB / 756ms / 64.39MiB·90.01MiB | 11.60MiB / 1122ms / 64.38MiB·101.68MiB |
| photo-scan | 4 | JPEG | Pixel 7 emulation (not a physical device) | 2.63MiB / 632ms / 64.35MiB·83.73MiB | 4.11MiB / 753ms / 64.38MiB·86.70MiB | 7.47MiB / 1069ms / 64.05MiB·93.43MiB |
| photo-scan | 16 | PNG | Desktop host measurement | 75.56MiB / 14090ms / 65.23MiB·310.23MiB | 63.03MiB / 15764ms / 65.22MiB·314.08MiB | 68.43MiB / 23745ms / 64.97MiB·558.60MiB |
| photo-scan | 16 | PNG | Pixel 7 emulation (not a physical device) | 75.56MiB / 14021ms / 65.49MiB·318.80MiB | 132.20MiB / 23823ms / 65.22MiB·430.88MiB | 290.03MiB / 52170ms / 64.69MiB·734.97MiB |
| photo-scan | 16 | JPEG | Desktop host measurement | 10.50MiB / 1373ms / 65.56MiB·103.49MiB | 23.06MiB / 1884ms / 64.81MiB·127.86MiB | 46.40MiB / 3237ms / 65.07MiB·174.47MiB |
| photo-scan | 16 | JPEG | Pixel 7 emulation (not a physical device) | 10.50MiB / 1329ms / 64.84MiB·103.49MiB | 16.45MiB / 1819ms / 64.79MiB·114.69MiB | 29.90MiB / 3150ms / 64.85MiB·141.65MiB |
| transparency | 1 | PNG | Desktop host measurement | 743.7KiB / 1018ms / 64.68MiB·87.31MiB | 800.7KiB / 1455ms / 64.10MiB·107.55MiB | 879.3KiB / 2376ms / 64.07MiB·158.70MiB |
| transparency | 1 | PNG | Pixel 7 emulation (not a physical device) | 991.2KiB / 1055ms / 64.42MiB·87.72MiB | 1.33MiB / 1449ms / 64.08MiB·109.54MiB | 1.99MiB / 2553ms / 64.09MiB·162.98MiB |
| transparency | 1 | JPEG | Desktop host measurement | 90.4KiB / 380ms / 64.08MiB·63.94MiB | 133.3KiB / 409ms / 64.09MiB·64.02MiB | 230.1KiB / 449ms / 64.00MiB·64.21MiB |
| transparency | 1 | JPEG | Pixel 7 emulation (not a physical device) | 84.9KiB / 381ms / 63.77MiB·63.93MiB | 124.5KiB / 413ms / 64.05MiB·64.00MiB | 211.7KiB / 462ms / 64.07MiB·64.17MiB |
| transparency | 4 | PNG | Desktop host measurement | 2.90MiB / 1991ms / 64.54MiB·128.19MiB | 3.13MiB / 2425ms / 64.60MiB·190.69MiB | 3.43MiB / 4226ms / 64.81MiB·273.59MiB |
| transparency | 4 | PNG | Pixel 7 emulation (not a physical device) | 3.87MiB / 2075ms / 64.51MiB·129.16MiB | 5.33MiB / 2729ms / 64.63MiB·193.01MiB | 7.96MiB / 5107ms / 64.93MiB·275.34MiB |
| transparency | 4 | JPEG | Desktop host measurement | 359.8KiB / 512ms / 64.41MiB·68.40MiB | 531.4KiB / 601ms / 64.64MiB·68.74MiB | 918.4KiB / 796ms / 64.54MiB·69.49MiB |
| transparency | 4 | JPEG | Pixel 7 emulation (not a physical device) | 337.7KiB / 539ms / 64.38MiB·68.36MiB | 496.1KiB / 570ms / 64.60MiB·68.67MiB | 845.0KiB / 794ms / 64.39MiB·69.35MiB |
| transparency | 16 | PNG | Desktop host measurement | 11.61MiB / 5973ms / 66.36MiB·223.50MiB | 12.50MiB / 8219ms / 65.38MiB·307.22MiB | 13.73MiB / 15578ms / 65.40MiB·537.66MiB |
| transparency | 16 | PNG | Pixel 7 emulation (not a physical device) | 15.48MiB / 6369ms / 65.22MiB·220.94MiB | 21.32MiB / 9370ms / 65.59MiB·300.08MiB | 31.85MiB / 18369ms / 65.82MiB·548.83MiB |
| transparency | 16 | JPEG | Desktop host measurement | 1.40MiB / 1052ms / 65.59MiB·72.69MiB | 2.07MiB / 1270ms / 65.59MiB·74.03MiB | 3.59MiB / 2127ms / 65.59MiB·77.05MiB |
| transparency | 16 | JPEG | Pixel 7 emulation (not a physical device) | 1.32MiB / 1065ms / 65.57MiB·72.52MiB | 1.94MiB / 1285ms / 65.57MiB·73.75MiB | 3.30MiB / 2245ms / 65.58MiB·76.48MiB |

**별도 3파일 배치** — 고정 결정 규칙으로 선택된 150 DPI/JPEG에서 `blank-4 → text-vector-4 → photo-scan-4`를 concurrency 1로 처리하고 세 결과 bytes를 배치 경계까지 함께 보유했다. 준비 1회+기록 3회를 별도로 수행했다.

| 환경 | 결과 보유 bytes 중앙값 | host wall 중앙값 | peak CDP used·backing 최댓값 |
|---|---:|---:|---:|
| Desktop host measurement | 3,230,310B (3.08MiB) | 1,644.5ms | 65.30MiB · 88.43MiB |
| Pixel 7 emulation (not a physical device) | 3,234,357B (3.08MiB) | 1,703.9ms | 65.30MiB · 88.43MiB |

**사전 확정 규칙 적용** — 벤치 결과를 보고 규칙을 바꾸지 않았다. 포맷은 photo-scan·300DPI·1쪽의 세 대응 반복에서 PNG/JPEG 최종 bytes 비율 중앙값만 썼다. Desktop은 `1.474693`이라 PNG, Pixel 7 에뮬레이션은 `9.698305`라 JPEG였고, 환경이 갈리면 모바일 셀이 우선이라는 사전 규칙에 따라 전역 기본값은 **JPEG quality 0.85**다. DPI는 모바일 peak heap이 **실측 물리 기기 한계의 50% 이하인 최대값**으로 정하도록 고정했으나 이번 조건은 에뮬레이션뿐이라 물리 기기 한계를 얻지 못했다. `performance.memory.jsHeapSizeLimit`, `navigator.deviceMemory`, 고정 256MiB를 기기 한계로 대체하지 않고 미교정 사전 폴백 **150 DPI**를 적용했다. 실기기 교정은 명시 제외로 남긴다.

예상 출력 경고 계수는 사전 확정식대로 각 DPI/포맷의 photo-scan 1·4·16쪽 × 두 환경 × 세 반복에서 `max(finalPdfBytes / selectedPixels)`를 썼다: 150-PNG **2.2751643073**, 150-JPEG **0.3164912800**, 200-PNG **2.2396780732**, 200-JPEG **0.3908593726**, 300-PNG **2.1839512794**, 300-JPEG **0.3494403533 B/px**. 예상값이 `min(input×10, 100MiB)`를 넘으면 사전 경고하며 임의 튜닝하지 않았다.

**가독성 oracle** — 각 포맷의 최종 PDF를 같은 DPI의 Poppler **24.02.0**으로 다시 렌더했다. 고정 ROI `x=68,y=112,w=58,h=18pt from top`, RGB 각 채널 ≤127을 ink로 보고 임계값 `floor(DPI×0.057)`을 적용했다.

| DPI | PNG ink height / threshold | JPEG ink height / threshold | 판정 |
|---:|---:|---:|---|
| 150 | 9 / 8 | 9 / 8 | 통과 |
| 200 | 12 / 11 | 12 / 11 | 통과 |
| 300 | 18 / 17 | 18 / 17 | 통과 |

**제품·수명주기 판정** — 모든 장식과 구조 옵션을 먼저 적용한 뒤 선택 페이지만 흰 배경 PNG/JPEG 단일 이미지로 만들고 비선택 페이지는 벡터 페이지로 복사한다. (A)는 페이지별 `maxSide`/`maxArea`를 preflight와 실제 할당 직전에 검사하고 요청 DPI부터 300→200→150 순서로만 낮춘다. 150 DPI도 (A)를 넘으면 조용한 빈 렌더나 누적 예산 거부가 아니라 지원 제외와 페이지 범위 축소를 한영으로 안내한다. (B)는 누적 pixels·raw RGBA ledger·중간 image bytes·최종 PDF bytes·관측 peak를 측정만 하며 차단 게이트와 섞지 않았다. 결과 보유는 OPFS 우선, 최초 이용 불가 때만 메모리 Blob으로 폴백한다. 메모리 모드는 등록 직전 `retained+current > 200MiB`를 검사하고, OPFS create/write/close 실패는 현재 항목만 제거한 뒤 완료분을 보존하고 배치를 중단하며 메모리로 재전환하지 않는다. 후속 파일의 일반 엔진 오류도 이미 등록한 완료 결과를 부분 결과 계약으로 공개하고 다음 파일을 읽지 않는다.

취소는 `RenderTask.cancel()` → render promise 정착 → `PDFPageProxy.cleanup()` → owned loading task의 document destroy 순서를 유지하고 각 취소 정리 예외를 삼킨다. 외부 preview cache에 이 문서를 넣지 않으며 성공·실패·취소에서 owned loading task를 파괴한다. 결과 교체/화면 종료 때 Object URL과 소유 storage를 함께 정리한다. raster 후 Link 재부착, (B) 차단 게이트, 실기기 한계 교정, wasm 메모리 상한은 착수하지 않았다.

**검증·예산** — 전체 unit **338/338**, TypeScript, production 및 local-QA build **2,854 modules·정적 71페이지**, static(startup recovery 119), `test:pdf-finish`의 신규 선택 페이지 래스터 실제 다운로드와 기존 watermark 128+32 렌더·stamp 16좌표/16실픽셀/8양렌더러·structure 5 appearance×2 renderer, 공식 oracle 87 preflight/허용 56/제외 31/양 renderer SHA 56, `TEST_SCOPE=pdf test:browser`, legacy oracle client 3·structure 4·render 32·output 4·input 1 diff 0을 통과했다. 영향 visual은 한영·양 테마·desktop/mobile 390과 영어 320px **9/9** 재대조했고 직접 열람에서 가로 잘림·겹침이 없었다. F4b+finish a11y 7상태는 violations 0, F4b unresolved incomplete 0, 기존 상속 incomplete 125(통과로 계산하지 않음), 외부 요청 0이었다. 정적 검증이 기존 ko/en·SEO·sitemap·FAQ/정적·광고 경로를 통과했고 route·광고 위치·격리·서버리스 구조·의존성은 바꾸지 않았다.

고정 상한의 최종 scoped 증분/상한/잔여는 entry **12,214/20,480/8,266B**, PDF route **75,673/82,000/6,327B**, shared 순증 **2,444/30,720/28,276B**, app **91,236/96,000/4,764B**, CSS **400/10,240/9,840B**다. override `{}`, multiplier `1`이며 상한을 올리지 않았다. full 교차 측정은 entry/app/shared/CSS가 같고 19-route 합산은 **-433,383B**로 통과했지만, 이를 scoped PDF 값과 상쇄·혼동하지 않는다. U4-8 뒤 한 번으로 이월한 전체 browser, new-tools·utilities·office, QR 2종, recovery, Excel 2종, 전체 a11y·visual·rendering, css:orphans, legacy:manifest, tool-registry-routes, 성능 12입력은 `MERGE-GATE-CHECKLIST.md`에 남겼다. 전체 원출력과 명령은 `/tmp/worklazy-u4-7/REPORT.md`에 보존한다. — Codx


### U4-6 fix-1 — 양식 appearance 기하 보존·첨부 Popup 관계 수리 (Codx)

**실행 게이트·원인 판정** — 시작 branch/head는 `s3-pdf-finish`/`cea060b65cd983bf3b2b3fdce698a4092e187169`로 지시와 일치했고 열린 계획서 충돌은 없었다. R1은 pdf-lib 기본 flatten이 Widget Rect의 원점 이동만 적용하고 AP의 BBox·Matrix가 만든 실제 경계를 Rect에 맞추지 않은 것이 직접 원인이다. 하부 라이브러리 동작이어도 검증 없이 새 제품 경로로 허용한 것이 이번 단계 책임이라는 검수 판정을 수용했다. R2는 FileAttachment를 Annots에서 제거한 뒤 양방향 `/Popup`·`/Parent` 관계를 닫지 않아 Popup만 살아남은 것이 원인이다. 사용자 소유 `CLAUDE.md`·`PROJECT_RULES.md`, 미추적 DOCX·HTML·`newui/`와 금지 worktree는 수정·stage하지 않았고 main 병합·push·배포도 하지 않았다.

**R1 수리·지원 경계** — 선택된 정상 AP stream의 유한 4값 BBox와 선택적 유한 6값 Matrix로 네 모서리의 transformed bounds를 구하고, 그 경계에서 정규화한 Widget Rect로 가는 독립 x/y 배율과 평행이동을 page content의 `q/cm/Do/Q`에 적용한다. appearance state dictionary는 상속 `/AS`, 그다음 `/V`로 실제 정상 상태만 선택한다. 모든 Widget의 기존 indirect raw stream·Rect·BBox·Matrix를 먼저 검사한 뒤에만 그리므로 일부만 평면화된 결과가 생기지 않는다. XFA·서명·AP 누락/손상에 더해 비유한·퇴화 Rect/BBox, 유효하지 않거나 특이행렬인 변환은 `unsupported-form`으로 실행 전에 차단한다. 값과 appearance를 새로 생성하지 않고 `updateFieldAppearances:false`를 유지했다. ko/en 안내는 내부 구현명이 아니라 안전하게 배치할 수 없는 양식 모양과 결과 미생성을 설명한다.

identity, 절반 BBox, 비영점 BBox, 2배 Matrix, 평행이동 Matrix 5종은 PDF.js와 Poppler 모두 원본·평면화 결과가 **300×300, 파란 픽셀 2,000, 경계 `[100,180,199,199]`, RGBA SHA-256 `ab80b4ec…033b`**로 정확히 일치했다. 특이행렬 fixture는 지원 제외됐다. 실제 제품 화면에서는 절반 BBox 입력이 `preflight=ready` 뒤 다운로드됐고 **2,000→2,000** 픽셀을 보존했으며, ko/en 각각 같은 다운로드 검사를 통과했다. 특이행렬은 양 언어에서 현지화 오류, 실행 버튼 disabled, 다운로드 0이었다. 검수자 원본 appearance probe도 수정 없이 5종×양 renderer를 통과했고 제품 probe는 고정 4274를 런타임 loader에서 허용 포트 4284로만 치환해 `produced=true`, `preserved=true`를 확인했다.

**R2 관계 폐쇄·출력 검증** — 최초 옵션 선별로 제거된 annotation의 raw ref와 dict를 집합에 넣고, 각 페이지 Annots의 Popup 중 `/Parent`가 제거 대상이거나 제거 대상의 `/Popup`이 가리키는 항목을 고정점까지 함께 제거한다. 살아 있는 annotation에서는 제거된 대상만 가리키는 `/Popup`·`/IRT`·`/Parent`를 지우며 일반 Text↔Popup과 FreeText `/IRT`, 첨부 미제거 대조는 보존한다. 최종 전체 객체 검사에서 모든 `/Popup`의 필수 Parent가 dict로 해석되지 않으면 결과를 거부한다. 최소 fixture의 보존/첨부만/주석만/둘 다 네 조합은 parentless Popup·누락 ref·깨진 관계·PDF.js missing-parent 경고가 모두 0이고, 첨부만 제거 결과는 `Text, Popup, FreeText`와 살아 있는 reply를 유지하면서 payload·고수준 attachment를 0으로 만들었다.

검수자의 복합 **12페이지·610객체·압축 첨부 decoded 1,286,144B** 입력에서 첨부만 제거한 출력은 **23,628B/472객체**, parentless Popup **24→0**, 고아·누락 ref·decode 오류·잘못된 관계·첨부 sentinel 모두 0, 링크 108·이름 목적지 84를 유지했다. 입력과 출력 모두 PDF.js의 missing/invalid Popup parent 경고는 0이다. 여섯 옵션 조합도 parentless Popup 0을 통과했다. 원 `assert-evidence.py`는 결함 재현용 기대값 24를 고정해 수리 후 그 한 줄에서 의도대로 실패했으며, 검수 산출물은 읽기 전용으로 보존하고 `/tmp/worklazy-u4-6-fix1/probes/assert-evidence-fixed.py` 사본의 기대값만 0으로 바꿔 나머지 모든 원 assert를 통과시켰다.

**회귀·예산·동반 영향** — `test:pdf-finish`는 실제 ko/en 다운로드 2건, 지원 제외 2건을 포함해 smoke·watermark 128렌더·stamp 16좌표/16브라우저/8 renderer page·새 structure golden을 모두 실행했다. 공식 OCG oracle은 87 preflight, 허용 56/57페이지, 제외 31, 제외 transform 0, 양 renderer SHA 56/56이며 legacy oracle은 client 3·structure 4·render 32·output 4·input 1에서 diff 0이다. full unit **332/332**, TypeScript, production build **2,851 modules·정적 71페이지**, static, 구조 visual **9/9**, F4a+finish a11y 7상태 위반 0·F4a incomplete 0·상속 125·외부 요청 0을 통과했다. 의존 patch hash 음성 대조도 Vite 이전 exit 1을 확인했다.

schema-v3 고정 baseline과 `BUNDLE_ROUTES=pdf-editor` 재계측 증분/상한은 entry **11,091/20,480B**, PDF route **71,060/82,000B**, shared 순증 **2,430/30,720B**, app **85,498/96,000B**, CSS **400/10,240B**다. override `{}`·multiplier `1`이며 한도·배수·측정 범위를 바꾸지 않았다. route·SEO 의미·광고 위치·격리 경로·서버 전제·의존성은 변하지 않았고, 사용자 오류 문구만 ko/en 동시 반영해 정적 검사를 통과했다. 원출력·JSON·PNG/PDF와 하네스 적응 기록은 `/tmp/worklazy-u4-6-fix1/REPORT.md` 및 그 하위에 보존한다. — Codx

## 2026-09-08

### U4-6 — 구조 제거·양식 평면화·링크 보존 고지와 최종 번들 상향 (Codx)

**예산 결정** — 1차 구현 후보의 app 증분이 **82,887B > 81,920B**로 **967B 초과**해 `SCOPE-OUT`한 판정은 옳았다. 967B만 줄이는 탐색안은 정적 JSON 1,390B 증가까지 합치면 순감량이 20B에 그치고, 후속 F4b/F5가 3,411~10,188B를 더 요구해 곧바로 다시 차단된다. 후보 PDF route도 **69,435B/72,000B**, 잔여 **2,565B**뿐이었다. 사용자 결정에 따라 `appJsGzip`을 `80 * 1024`에서 **96,000B**, `affectedRouteJsGzip`을 `72,000B`에서 **82,000B**로 올렸고 entry/shared/CSS, override `{}`, multiplier `1`은 그대로 두었다. 이는 **마지막 상향**이다. U4-7·U4-8에서 다시 초과하면 상향을 요청하지 않고 `SCOPE-OUT`으로 보고해 구조 변경으로 넘긴다.

고정 schema-v3 baseline(SHA-256 `4caaa9c6…`)과 `BUNDLE_ROUTES=pdf-editor`로 최종 재계측한 증분/상한/잔여는 entry **11,065/20,480/9,415B**, PDF route **70,335/82,000/11,665B**, shared 순증 **2,455/30,720/28,265B**, app **84,776/96,000/11,224B**, CSS **400/10,240/9,840B**다. 다른 route 감소로 PDF 증가를 상쇄하지 않았고 측정 범위도 줄이지 않았다. 탐색 시 shared gross 512,387B 중 509,960B가 분류 이동이었으며, 최종은 gross **512,417B**·이동 **509,962B**·순증 2,455B다. 이동분은 app에 다시 더하지 않는다. `PDFObjectCopier`는 공용 `pdfFontEmbed` 청크에 정확히 한 벌이고 이번 작업이 새 중복을 만든 것이 아니다. main `pdf-lib` 귀속 118,977B와 legacy `pdf.worker` 219,622B 내부의 별도 번들은 순감량 80~120KB·총 5~10인일의 backlog로 이관했다. 이번 상향은 이 부채의 해결이 아니라 유예다.

**제품 판정·구현** — 기존 문서에서 참조만 끊는 방식은 제거 payload를 orphan으로 남기므로 기각하고, 지원 구조를 정리한 뒤 page ref를 먼저 대응시켜 도달 가능한 루트만 새 `PDFDocument`에 복사했다. 페이지 tree/content/resources/MediaBox/CropBox/Rotate, 로컬 outline, Names/Dests와 구식 Dests, PageLabels, ViewerPreferences는 새 page ref로 보존한다. 고정 기본 가시성으로 정규화 가능한 optional content는 화면 의미를 보존한 채 구조를 제거하고, tagged structure는 제거한다. 지원하지 않는 OC·Type3는 실행 전 차단한다. Info와 XMP, EmbeddedFiles/Filespec/EmbeddedFile/catalog·page AF, AcroForm/Widget, 선택한 markup subtype은 전 객체 그래프와 출력에서 제거한다. URI·직접 Dest·이름 Dest의 Link는 subtype 선별로 세 종류 모두 보존하며 ko/en 옵션 화면에 실행 전에 “하이퍼링크는 유지됩니다”를 항상 표시한다. 임의 주석 평면화는 지원하지 않고 Redact 제거가 본문 가림이 아님을 밝힌다. 양식은 보존·제거·평면화 배타 모드이고, 평면화는 기존 AP만 `updateFieldAppearances:false`로 사용하며 XFA·서명·AP 누락/손상은 사전 차단한다.

**검증·증거** — 제거 결과의 **전체 14개 indirect object**를 raw dictionary/stream, raw·decoded SHA-256, 금지 key/type/subtype, 첨부·XMP sentinel로 전수 기록했다. 금지 구조와 두 decoded sentinel 잔여는 0이며 PDF.js 고수준 검사에서도 첨부·metadata가 없고 Link 3종, outline, page labels, viewer preferences가 보존됐다. 허용 OC fixture **56개/57페이지**는 제품 preflight와 제품 재구축을 거쳐 PDF.js·Poppler 원본/결과 RGBA SHA가 모두 일치했고, 제외 31개와 양 renderer 음성 대조는 모두 차단됐다. unit **331/331**, production/local-QA build(2,851 modules·정적 71페이지), `test:static`, `test:pdf-finish`, `TEST_SCOPE=pdf test:browser`, legacy oracle diff 0을 통과했다. 구조 시각 기준선은 ko/en·light/dark·desktop/mobile 및 영어 320px를 포함해 **9장** 추가했고 9/9 일치했다. F4a+finish 접근성은 7상태, 위반 0·F4a incomplete 0·기존 상속 125·외부 요청 0이고, 새 rendering 대상 3회 최대 CLS는 **0.0001480366**이다. 원자료와 전체 indirect-object 원출력은 `/tmp/worklazy-u4-6/`에 보존한다. — Codx

### U4-5 fix-1 — 도장 실제 픽셀 골든·F3 접근성 게이트 수리 (Codx)

**실행 게이트·원인 판정** — 시작 branch/head는 `s3-pdf-finish`/`8ec3e4edd97439dfc5b7807645d22c8373d69d11`로 지시와 일치했고 열린 계획서와 상반되는 지시는 없었다. 사용자 소유 `CLAUDE.md`·`PROJECT_RULES.md`, DOCX 2개·네이버 확인 HTML·`newui/`는 수정·stage하지 않았으며 금지 worktree, main 병합·push·배포에도 접근하지 않았다. 도장 좌표 모델과 출력 엔진은 옳았지만 model box의 `border-2`가 내부 2px씩을 차지하고 `<img class="h-full w-full">`가 그 content box에 다시 맞춰져 실제 화면 도장만 작아졌다. 기존 `tests/pdf-stamp-golden.mjs`의 16조합은 브라우저 미리보기 픽셀을 렌더하지 않고 계산된 사각형과 출력 좌표를 비교했으므로 이 결함을 검증했다는 종전 기록은 기각한다.

**R1 최소 수리·실제 픽셀 골든** — 선택 표시를 model box를 소비하지 않는 2px solid outline으로 옮겼다. 혼합 4페이지 fixture는 MediaBox `400×600/800×500/600×400/500×800`, CropBox `[20,35,350,510]/[45,30,680,410]/[30,25,520,330]/[40,55,400,680]`, 회전 `0/90/180/270`, UserUnit `1/1.25/1.5/2`다. 실제 Chrome context의 DPR `1/2` × canvas CSS 폭 `1/0.5` × 회전 4종에서 포인터 이동·크기 조절 후 canvas 영역을 device pixel로 캡처하고, 다운로드 PDF의 같은 페이지를 PDF.js로 같은 표시 폭·bitmap 크기에 렌더해 불투명 적색 픽셀 경계를 비교한다. 16조합 모두 종전 최대 **7~8.5 CSS px**에서 수정 후 **0.5~1 CSS px**로 줄어 허용 `≤2px`를 통과했고, DOM에서도 border `0px`, outline `2px`, 이미지와 model box 네 변 차이 `<0.1px`, DPR별 canvas backing 폭 `520/1040px`를 확인했다. 이 실제 경로는 저장소 정규 `npm run test:pdf-finish`에 포함했다.

좌표·출력 코드는 수정하지 않았다. 수정 전/후 `stamp-all-pages.pdf` SHA-256은 모두 `3831baa3abd1817e83f56928be578a7061f3686179e670475a43abf789568156`, `stamp-selected-pages.pdf`는 모두 `12ad29d42e992cd545ca78129f45ebffc5c6d0997ec5c6f4ea038f5850df8548`로 byte-identical하다. 기존 좌표 16조합, PDF.js/Poppler 8페이지, 선택 페이지 `[true,false,true,false]`와 legacy organize oracle의 client 3·structure 4·render 32·output 4·input 1 총 diff 0도 유지됐다.

**R2 F3 게이트 수리** — `[data-pdf-stamp-owned]`를 `f3-stamp` 소유 범주로 등록하고 stamp tab·notice·settings input·실제 overlay 네 marker를 각각 정확히 1개 요구한다. 기본 감사에 업로드 뒤 도장 overlay가 생긴 ko/en × light/dark 편집 상태 4개를 넣고 이 범위를 F3 selector로 직접 감사한다. gradient 때문에 Axe가 `color-contrast`를 incomplete로 돌려주는 notice title/body는 실제 렌더 배경 픽셀 전수와 계산 전경색을 대조한 증거에만 연결한다. body는 light **5.8648:1**, dark **13.0790:1**, title은 ko light/dark **14.6179/17.3805:1**, en light/dark **14.5232/17.2436:1**로 모두 4.5:1 이상이므로 대비 결함이 아니라 소유·상태 누락 결함이라는 판정을 유지한다. 범위 감사 10페이지는 violations 0, F3 unresolved incomplete 0, pixel-resolved 14, 상속 incomplete 247, 외부 요청 0이다.

marker 제거, 소유 target 미발견, 등록된 편집 결과 누락, F3 unresolved incomplete 잔존을 각각 독립 unit으로 fail-closed했고 full unit은 **327/327**다. 검수자의 원본 F3 probe도 제품 코드의 새 판정기에 unresolved 실제 노드 2개를 주입했을 때 `F3 stamp editing incomplete node lost ownership`으로 거절됐다. 원 probe가 금지된 4271 포트·read-only 검수 경로 쓰기·옛 archive import를 고정해 현재 실행 규율과 충돌하므로, probe 원본 SHA를 보존한 채 임시 loader/adapter에서 포트 4283·출력 `/tmp/worklazy-u4-5-fix1/`·현 워크트리 audit import만 치환했다. 원본 UI/verify probe 결과는 16조합 실패 0·최대 1px이며 검수 산출물의 종전 metrics(최대 8.5px)에는 쓰지 않았다.

**시각·예산·동시 검토** — outline의 실제 픽셀 변화로 stamp interaction 기준선 9장을 갱신했다. 최초 대조는 390px mobile 4장이 각 782px(`0.2376%`), en light 320px가 587px(`0.2173%`) 차이로 실패했고 desktop 4장도 0.1% 아래의 선택선 픽셀 변화가 있어 9장 전부 정규 update 후 **9/9** 일치했다. 직접 열람과 diff에서 변화는 선택선·핸들 주변뿐이었다. schema v3 고정 기준선 SHA `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`, override `{}`·multiplier 1로 PDF scoped gzip은 entry **8,878/20,480B**, PDF route **61,923/72,000B**, shared **2,407/30,720B**, app **74,107/81,920B**, CSS **393/10,240B**로 모두 통과했다. 사용자 문구·route가 바뀌지 않아 한·영 번역, SEO·정적 페이지, AdSense 격리에는 추가 변경이 없고 서버·새 의존성도 없다.

`npx tsc -b`, production build 2,849 modules·정적 71페이지, `npm run test:pdf-finish`, full unit 327/327, 영향 visual 9/9, stamp+finish a11y, dependency version mismatch의 Vite 전 fail-closed, scoped bundle, `git diff --check`를 실제 실행했다. merge-time full browser/new-tools/utilities/office, QR bulk/font, recovery/static, Excel 2종, full a11y/visual/rendering, CSS orphan, legacy manifest, registry routes, 12개 성능은 지시대로 이번 fix에서 유예한다. 상세 수치·명령·실패 이력은 `/tmp/worklazy-u4-5-fix1/REPORT.md`에 보존한다. — Codx

### U4-5 — PDF 도장·서명 이미지와 PDF route 예산 1건 상향 (Codx)

**사용자 결정과 이전 SCOPE-OUT 판정** — 2026-09-08 사용자 결정으로 `affectedRouteJsGzip` 기본 상한만 **61,440B → 72,000B**로 올렸다. U4 전체를 2,850~4,650줄로 추정해 잡은 구 상한이 U4-1~U4-4만으로 95% 소모됐고, 탐색 시제품은 동적 청크 62,997B로 구 상한보다 1,557B 부족했다. 정적 통합 대조는 61,414B로 26B만 남았지만 핵심 패널 329줄뿐이며 골든·한/영 문구·비전자서명 고지·접근성·SEO가 빠졌으므로, 당시 구현을 중단한 SCOPE-OUT 판정은 옳았다. 1,557B는 당시 PDF route 절대 gzip 약 1,135,719B의 0.14%였고, 추정 실패를 도장 기능의 비대화로 보지 않는다는 결정이다.

`scripts/measure-bundle-budget.mjs`에서는 `affectedRouteJsGzip: 60 * 1024` 한 줄만 `72000`으로 바꿨다. entry 20,480B·shared 30,720B·app 81,920B·CSS 10,240B는 불변이고 override `{}`·multiplier 1이다. 다른 route 감량으로 PDF route 증가를 상쇄하는 해석도 계속 금지한다. 기준선은 schema v3 `/tmp/worklazy-u4-4-review5/evidence/bundle-baseline.json`(SHA-256 `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`)만 사용했으며 schema v2 `/tmp/s3-bundle-baseline.json`은 사용하지 않았다. U4-6~U4-8에서 다시 초과하면 추가 상향을 요청하지 않고 SCOPE-OUT으로 보고해 감량·구조 변경 판정을 받는다.

| 번들 지표(gzip) | schema v3 대비 최종 증분 | 상한 | 잔여 | 판정 |
|---|---:|---:|---:|---|
| entry JS | 8,888B | 20,480B | 11,592B | 통과 |
| PDF route JS | **61,879B** | **72,000B** | **10,121B** | 통과 |
| shared JS(귀속 이동 제외) | 2,400B | 30,720B | 28,320B | 통과 |
| app JS | **74,059B** | **81,920B** | **7,861B** | 통과 |
| CSS | 376B | 10,240B | 9,864B | 통과 |

scoped PDF route 절대값은 1,139,166B였다. full route 비교도 같은 app 순증분과 5개 상한, override `{}`·multiplier 1로 통과했다. 앱 잔여 13,348B에서 시작한 이번 단계가 5,487B를 사용해 7,861B를 남겼으며 app 상한은 올리지 않았다.

**좌표·기능 계약** — 저장 모델은 raw PDF나 화면 픽셀이 아니라 회전된 visual viewport의 중심 `(cx, cy)`, 상대 폭 `rw`, 원본 비율 `aspect`다. CSS 포인터는 `getBoundingClientRect()`에서 viewport 좌표로 한 번 옮기고, 대상 페이지마다 적용 사각형의 **네 모서리 전부**를 기존 `viewportPointToPdf` 변환에 넣는다. 이 변환이 CropBox·UserUnit·회전·scale을 처리하므로 결과를 scale로 다시 나누는 이중 보정은 넣지 않았다. PNG/JPEG를 미리보기에서 직접 이동하고 오른쪽 아래 핸들로 비율 고정 크기 조절하며, 선택 페이지 모두에 같은 상대 위치를 적용한다. 이동·크기 변경은 현재 선택 이미지에 한정된 undo/redo history에 들어가고 다른 이미지를 고르면 history를 새로 시작한다. 포인터를 쓰기 어려운 사용자를 위해 상·하·좌·우와 확대·축소 버튼을 함께 제공한다.

화면의 ko/en 경고는 이 기능이 도장·서명 **이미지만 삽입**하며 공인 전자서명이나 인증서 기반·암호학적 디지털 서명을 만들거나 검증하지 않는다고 명시한다. `/tools/pdf-editor/stamp`는 자체 canonical, FAQ, application metadata와 ko/en 소셜 이미지를 갖고 정적 생성·sitemap 검증에 포함된다.

**골든·회귀 판정** — 비영점 CropBox, UserUnit 1/1.25/1.5/2, 회전 0/90/180/270의 혼합 4페이지에서 불투명 도장 픽셀 경계를 PDF.js와 Poppler로 렌더했다. DPR 1/2 × CSS 표시 배율 1/0.5 × 회전 4종의 **16조합**에서 CSS→viewport 모델, DPR bitmap의 PDF 점, 실제 출력 경계를 비교했고 양 렌더러 8페이지에서 위치·크기·비율을 통과했다. 별도 `1,3` 선택 출력은 페이지별 도장 존재가 `[true,false,true,false]`였다. legacy organize oracle은 client 3·structure 4·render 32·output 4·input 1에서 총 diff 0이다.

`test:pdf-finish`는 20개 직접 진입과 실제 drag/resize/undo/redo/대체 버튼/회전 페이지 동일 상대 좌표/3페이지 출력을 통과했다. unit 323/323, production 및 `VITE_LOCAL_QA=1` build 2,849 modules·정적 71페이지, static startup recovery 119, PDF scoped browser도 통과했다. local-QA stamp+finish a11y 6페이지는 violations 0·기존 상속 incomplete 253·외부 요청 0이며 incomplete를 통과로 세지 않았다. rendering은 8대상×3회, stamp 최대 CLS `0.0001480365514755249`, 외부 요청 0이다. 시각 회귀는 영향 45장을 ko/en에서 diff 0으로 재실행했고 stamp는 desktop/mobile 390px의 양 테마·양 언어 8장과 영어 light 320px 1장을 포함한다. 직접 열람 결과 도장·핸들·선택 썸네일·작업 버튼의 겹침이나 잘림은 없었다.

시각 기준선 변경은 새 `pdf-finish-stamp__interaction__{ko,en}__{light,dark}__{desktop,mobile}.png` 8장, 영어 light `mobile-320` 1장, 4탭 전환으로 달라진 `pdf-finish-navigation__active__{ko,en}__light__{mobile,mobile-320}.png` 4장, 총 13장이다. 상세 JSON·렌더 원출력·캡처와 실행 보고는 `/tmp/worklazy-u4-5/`에 보존한다. merge-time full browser/new-tools/utilities/office/QR/recovery/Excel/a11y/visual/CSS/legacy/registry/성능 항목은 정본 checklist대로 U4-8 병합 직전 1회로 이월한다. — Codx

### U4-4 fix-5 — 표시 실패 새로고침 버튼 대비 회귀 수리 (Codx)

**실행 게이트·범위** — `PROJECT_RULES.md`·`AGENTS.md`, fix-5/fix-4 지시서, astra 5차 검수 보고, PDF finish 정본과 열린 계획서를 대조했다. 시작 branch/head는 `s3-pdf-finish`/`c3288856b10953e663a0910a9ca125c7bfe667eb`로 지시와 일치했고 동일 코드 표면의 상반 지시는 없었다. 사용자 미추적 DOCX 2개·네이버 확인 HTML·`newui/`와 금지 worktree는 건드리지 않았으며 main 병합·push·배포는 범위 밖이다.

**원인·최소 수리** — fix-4에서 새로 만든 `pdf-display-reload` outline 버튼에 정상 전경색이 없어 상위 오류 컨테이너의 `text-destructive`를 상속했다. 버튼 범위에만 정상·hover·focus-visible `text-foreground`를 명시해 상속을 끊었다. 공용 팔레트·Button primitive·기능·한/영 문구·Tab 접근·36px 높이·marker·소유 분류·접근성 한도는 바꾸지 않았다.

| 언어·테마 | 수정 전 normal / hover / focus | 수정 후 normal / hover / focus |
|---|---:|---:|
| ko light | **4.2746 / 12.0215 / 4.2746** | **15.8771 / 12.0215 / 15.8771** |
| en light | **4.2746 / 12.0491 / 4.2746** | **15.8771 / 12.0491 / 15.8771** |
| ko dark | **6.5720 / 15.8803 / 6.5720** | **17.4330 / 15.8803 / 17.4330** |
| en dark | **6.6017 / 15.8803 / 6.6017** | **17.5118 / 15.8803 / 17.5118** |

수치는 Chrome 152에서 같은 버튼의 전경만 투명하게 만든 뒤 테두리·모서리를 제외한 내부 렌더 픽셀 전수와 계산 전경색을 대조한 최저값이다. 기준 커밋 보존 빌드는 light normal/focus에서 4.5:1 미만이며 Axe serious 2건으로 원래 집계기가 실제 실패했다. 수정 뒤 12조합 전부 4.5:1 이상이다. dark의 normal/focus는 gradient 때문에 Axe `incomplete` 2노드로 남아 이를 기존 shared 부채에 섞지 않고 `measured-pixel` 증거로 별도 보존하며, 해당 세 상태 픽셀 수치가 하나라도 4.5 미만이면 게이트가 실패한다.

**회귀 유지·검증** — 최초 표시 자산 요청을 중단한 ko/en 스모크에서 1.2초 동안 자동 재시도 0·자동 reload 0, 현지화 안내와 버튼, 원시 예외/자산 경로 노출 0을 확인했다. 명시적 새로고침은 선택을 비우고 재선택 뒤 preview와 `%PDF-` 저장까지 성공했으며 표시 URL은 하나다. fix-4의 기존 오류 요소는 light textarea/notice **7.6428/6.9595**, dark **8.9891/8.3795**로 양 언어에서 그대로 유지됐다. 범위 접근성 9상태는 위반 0·F2 incomplete 0·픽셀 해소 2·외부 요청 0이고, watermark interaction 시각은 기준선 변경 없이 ko/en×light/dark×desktop/mobile **8/8**이다. 전용 접근성 unit **9/9**, `npx tsc -b`, production build **2,847 modules·정적 69페이지**를 통과했다. 색과 하네스만 바뀌어 번역·SEO·정적 경로·AdSense 격리에는 추가 변경이 없다. full unit/browser/PDF finish/성능/번들/기타 전 스코프는 지시대로 병합 직전 1회로 이월한다. 원보고서와 JSON은 `/tmp/worklazy-u4-4-fix5/`에 보존한다. — Codx

### U4-4 fix-4 — 표시 실패 복구·배포 계측·오류 대비·128MiB 재측정 (Codx)

**실행 게이트·범위** — `PROJECT_RULES.md`와 `AGENTS.md` 전문, fix-4 지시서, PDF finish 정본, fix-3 기록과 read-only 검수 산출물을 대조했다. 시작 branch/head는 `s3-pdf-finish`/`e30018dd2d4801c5abba54a88f200e9ac69325d3`로 지시와 일치했고 열린 계획 충돌은 없었다. 사용자 미추적 DOCX 2개·네이버 확인 HTML·`newui/`는 열거나 stage하지 않았으며 금지 worktree에는 접근하지 않았다. main 병합·push·배포는 범위 밖이다.

**R-A 표시 런타임 최초 실패 복구** — 공유 표시 모듈 import 실패를 `PdfDisplayLoadError`라는 UI 경계용 오류로 분리해 정상 PDF의 손상·읽기 불가 판정으로 흘러가지 않게 했다. 브라우저 모듈 로더가 거부된 import를 캐시할 수 있어 같은 문서 안 자동 재시도는 실효성이 없다는 점을 근거로, ko/en 모두 연결 확인·페이지 새로고침·PDF 재선택을 안내하는 명시적 버튼을 제공한다. 자동 재시도 폭주는 없고 새로고침 전 선택은 폐기되며, 재선택 뒤 preview/save가 성공한다. 런타임 URL은 하나만 유지하고 worker fallback·취소 계약도 보존했다. 최초 요청을 중단한 실제 브라우저 회귀에서 내부 이름·원시 경로 노출 0, 고유 표시 URL 1개, 복구 뒤 미리보기·저장 성공을 확인했다.

**R-B 배포 실행 자산 계측** — 측정 순서를 Vite build 뒤 현재 정적 생성기로 69개 정적 페이지까지 생성한 다음 inventory하는 절차로 고정하고, baseline/current 모두 같은 측정기·생성 절차를 쓰되 소스 root만 바꾼다. ko/en 같은 내용의 생성 `.js/.mjs` 경로는 모두 deployment inventory에 남기고 gzip은 SHA-256마다 한 번만 부과한다. raw network 관측 집합은 기대 inventory의 `vendor/**`·`runtime/` 제외 규칙과 분리해, 제외 자산이 실제 로드돼도 누락을 숨기지 않는다. 정적 생성 뒤 늦게 추가한 `.mjs`가 양방향 inventory guard에서 실패하는 음성 대조도 추가했다.

S3 기준선 `5bc6854175331bdd73b267784d9633cdccda8446`을 임시 소스에 복원하고 당시 vendor 생성물을 준비한 뒤 재측정했다. baseline은 고유 실행 SHA 83개/배포 경로 99개, current는 89개/105개이고 양쪽 `missingFromInventory=[]`, `missingFromDeployment=[]`, 중복 경로 16개다. scoped 최종 gzip 증분은 entry **7,288B**, affected PDF **58,423B**, shared **2,095B**, app **68,529B**, CSS **300B**로 고정 상한 **20,480/61,440/30,720/81,920/10,240B**를 모두 통과했다. override `{}`·multiplier 1이며 상한은 바꾸지 않았다. full 비교도 5종 통과했고 affected 전체는 기준선보다 450,647B 작았다. 보고서 SHA-256은 baseline `ffc52532…`, scoped `64ee7a82…`, full `94201b35…`이다.

**R-C F2 오류 대비** — 잘못된 워터마크 텍스트 textarea와 empty-text notice를 light의 `red-800`, dark의 `red-200`으로 올리고 기존 F2 marker·공용 debt·판정 상한은 건드리지 않았다. ko/en×light/dark 네 settled error 상태를 실제 Axe 대상으로 등록하고 계산 스타일 대비를 별도 fail-closed 수치로 저장한다. 실측은 light textarea **7.6428:1**/notice **6.9595:1**, dark textarea **8.9891:1**/notice **8.3795:1**로 모두 4.5:1 이상이다. 위반 0, F2 incomplete 0, 상속 incomplete 253, 외부 요청 0이며 review 전 light textarea 4.36, light notice 3.98, dark notice 4.20의 실패를 해소했다.

**R-D 128MiB 응답성 재판정** — 12개 입력을 각각 새 browser context에서 3회 재측정했다. 128MiB 실제 최대 heartbeat는 **347.185/161.810/154.410ms**로, 3회 중 1회가 목표 200ms를 넘었으므로 **목표 미달**로 판정한다. 중앙 총 처리시간/heartbeat 곡선은 16MiB **1,796.767/142.395ms**, 32MiB **2,143.507/57.600ms**, 64MiB **3,120.417/88.705ms**, 128MiB **5,780.848/161.810ms**이고 총시간 비율 3.217로 준선형이다. 최대 breach의 phase는 saving이며 long task는 169ms였다. 원인은 pdf-lib가 단일 128MiB stream을 `object.copyBytesInto`에서 분할 불가능하게 직렬화하는 구간이라 기존 `objectsPerTick` 양보로 내부를 쪼갤 수 없다. 안전한 200ms 확정은 저장기 재설계 없이는 할 수 없어 통과로 주장하지 않는다. 대신 saving 상태를 먼저 그린 뒤 event loop에 양보하고 직렬화를 시작하도록 해 세 번 모두 사용자 진행 표시가 실제 paint됐으며, 취소 UI **115.170ms**, 늦은 결과 0·재시도 성공, Worker 생성 불가 fallback도 preview/download 성공·route error 0을 유지했다. 원보고서 SHA-256은 `439c0c51…`이다.

**검증·실패 이력** — `npx tsc -b` 진단 0, unit **320/320**, production/local-QA build 각 2,847 modules·정적 69페이지, PDF finish browser와 PDF.js/Poppler 골든 **160/160**, legacy oracle 총 diff 0, watermark interaction visual **8/8**을 통과했다. 의존 버전을 6.2.109로 바꾼 격리 음성 대조는 Vite 전에 정확히 fail-closed했다. 도중 full unit 1회는 빈 `A11Y_PAGE_IDS` 처리 결함, scoped a11y 1회는 보고서 디렉터리 미생성, 표시 복구 smoke 1회는 새로고침 뒤 여러 realm 요청을 정확히 2회로 가정한 테스트 결함으로 실패했고 각각 harness를 고쳐 최종 재실행을 통과했다. baseline 준비도 현행 SEO API와 baseline 생성기의 불일치, 당시 video runtime 미생성으로 두 번 실패한 뒤 현재 생성 절차와 baseline vendor 준비를 명시해 성공했다.

지시서에 따라 merge-time의 full `test:browser`, `test:new-tools`, `test:utilities`, `test:office`, `test:qr-bulk`, `test:qr-font-render`, `test:recovery`, `test:static`, full a11y, `css:orphans`, `legacy:manifest`, `tool-registry-routes`는 이번 범위에서 유예한다. 상세 보고서·JSON·캡처는 `/tmp/worklazy-u4-4-fix4/`에 보존한다. — Codx

### U4-4 fix-3 — PDF 표시 런타임 공유·배포 실행 자산 계측 정정 (Codx)

**기각 사유·구성 수리** — fix-2의 “PDF.js 표시 런타임 중복 없음”과 번들 5종 통과 기록은 `.mjs`를 집계하지 않은 측정에 기대어 **기각**한다. 실제 fix-2 산출물은 main이 full `pdf.mjs`를 정적 번들하고 thumbnail worker가 별도 `pdf.min.mjs` URL 자산을 로드해 표시 런타임이 두 벌이었다. fix-3에서 main의 정적 import를 제거하고 main과 전용 worker 모두 고정 패치된 full `pdf.mjs?url`을 동적 import하게 해 **하나의 배포 자산** `assets/pdf-CCjkBPdx.mjs`를 공유한다. OffscreenCanvas worker는 유지하고, PDF.js 내부 worker `pdf.worker.min-CHFwMXne.mjs`도 유지한다.

**계측 경계·기준선** — bundle schema를 v3으로 올리고 `vendor/**`와 `runtime/` 트리 밖의 모든 `.js`·`.mjs`를 배포 실행 inventory와 gzip 합계에 넣었다. route chunk가 URL로 참조하는 worker·public 실행 자산에 route 소유권을 전파하며, 동일 SHA-256 자산은 한 번만 세고 변경 전부터 있던 동일 SHA의 `pdf.worker.min.mjs`는 신규 증가로 세지 않는다. 같은 v3 범위로 S3 고정 기준선을 재생성한 뒤 `pdf-editor`만 scoped 측정했다. unscoped 비교는 S3 기준선에 없는 후속 `audio-studio` route 때문에 fail-closed하며 통과로 기록하지 않는다.

| 번들 지표(gzip) | fix-2 산출물을 v3로 정정 재계측 | fix-3 최종 | 고정 상한 | 최종 판정 |
|---|---:|---:|---:|---|
| entry JS | +7,177B | **+7,178B** | +20,480B | 통과 |
| affected PDF route JS | +22,750B | **+58,079B** | +61,440B | 통과 |
| shared JS(귀속 이동 제외) | **+133,495B** | **+2,152B** | +30,720B | 통과 |
| app JS | **+164,213B** | **+68,185B** | +81,920B | 통과 |
| CSS | +235B | **+235B** | +10,240B | 통과 |

override `{}`·multiplier 1이며 상한 변경은 없다. astra의 원본 `bundle-review.mjs`는 `unmeasuredNewDisplay=[]`과 scoped 5종 통과를 재현했다. 실제 워터마크 워크플로에서 로드된 `.js/.mjs` 20개는 전부 inventory에 있어 `missingFromMeasurement=[]`이었고, 표시 자산 하나를 `PdfEditorPage`와 `pdfThumbnailRender.worker`가 같이 참조했다.

**응답성·패치 안전성** — 고정 fixture를 128MiB까지 늘려 12개×3 새 context를 측정했다. 16/32/64/128MiB 중앙 처리시간은 **1.692/1.977/3.017/5.701초**, heartbeat는 **41.665/45.750/86.220/161.120ms**로 모두 200ms 이하였다. 외부 취소 click→UI는 **105.491ms**, 늦은 canvas·결과 0, 재시도 성공이었다. `Worker`를 생성할 수 없게 한 실제 브라우저 대조도 preview·download 성공, route error 0으로 호환 경로를 통과했다. fixture manifest SHA-256은 `c2629b4719786580cab709143a17af1728b86eb8e515493109ad2d7276d85eb2`다.

의존 패치는 원본 astra probe를 제품 파일 read-only 격리로 재실행했다. modern/legacy×full/minified 네 변형이 각각 180 fixture를 전부 렌더했고 변환 실패는 0이며 33 fixture에서 의도한 패치 차이가 나타났다. 독립 scalar oracle 대비 패치 픽셀 차이 0, 원본 차이 77, raw oracle 오류 0, 네 변형 SHA 동일을 확인했다. PDF.js와 lockfile은 **6.2.108**에 고정됐고 패치 대상 범위 밖 package 변경 0이다. 알 수 없는 hash·version, 원본 출현 0, 패치 출현, 결과 hash 불일치의 fail-closed 5개 음성 대조는 모두 Vite 실행 전 실패했고 원본·멱등 재적용은 통과했다.

**전체 회귀·동시 검토** — TypeScript 진단 0, unit **319/319**, production/local-QA 각 2,847 modules·정적 69페이지, startup recovery 116을 통과했다. PDF finish와 PDF.js/Poppler 골든 **160/160**, PDF 범위·전체 browser, new-tools·utilities·Office·QR bulk·QR font, recovery **147**, legacy oracle 총 diff 0, Excel Cleaner·Compare를 모두 통과했다. 기준선 갱신 없이 `ko_KR.UTF-8`·`en_US.UTF-8` visual은 각각 **211/211** 일치했다. local-QA a11y는 위반 0·F2 incomplete 0·상속 925·외부 요청 0, rendering은 7대상×3회·외부 요청 0과 finish 최대 CLS `0.0001480366`으로 통과했다. CSS orphan 0, legacy 155 rules/153 removed/0 split/2 active, tool 20개도 불변이다. 사용자 문구·화면·route는 바꾸지 않아 한·영 현지화, SEO·정적 페이지, AdSense 격리 경로에 추가 반영할 변경은 없었다. 원보고서와 JSON·캡처는 `/tmp/worklazy-u4-4-fix3/`에 보존한다. — Codx

### U4-4 fix-2 — PDF 워터마크 응답성·오탐·가시성·귀속 수리 (Codx)

**실행 게이트·범위** — 첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 `AGENTS.md`, fix-2 dispatch, astra 2b/1차 검수 보고, PDF finish 정본과 U4-4 기각 이력을 대조했다. `s3-pdf-finish`의 시작 `HEAD=15bad33cfb569ee032ba90c4fe42b75c1c48cf73`은 지시와 일치했고 열린 계획 충돌은 없었다. 사용자 미추적 DOCX 2개·네이버 확인 HTML·`newui/`는 열거나 stage하지 않았다. 검수 디렉터리는 읽기 전용으로만 사용했고 금지된 다른 worktree에는 접근하지 않았다. main 병합·push·배포는 수행하지 않는다.

**52초 응답 정지의 두 원인과 수리** — PDF.js 6.2.108의 RGB→RGBA remainder loop가 이후 chunk에서도 `srcPos`를 더하지 않아 앞 구간을 반복했다. package 버전을 정확히 고정하고 full/minified modern·legacy 빌드 4개에 원본/결과 SHA-256과 정확히 2회인 치환 횟수를 기록한 manifest를 두었다. `prepare`·`dev`·`prebuild`가 idempotent 적용과 hash를 검증하므로 `node_modules`·`public/vendor`·`dist` 수기 변경이나 버전 갱신은 없다. 원본→패치 hash는 modern full `487bde…17d`→`e0fac5…812`, legacy full `842284…a66`→`36644d…004`, modern min `e0be38…f6d`→`a67894…c5c`, legacy min `9fab0c…90c`→`377bcc…da3`이다. manifest 자체 SHA-256은 `8f6aaea47e122f7f85fc5f5d20251321f59b5652981817af70ccbdcc6880b8ef`이다.

두 번째 원인은 decoded content stream 전체를 이미지 payload까지 Latin-1 문자열로 바꾸던 위험/결과 검사였다. 이제 byte lexer가 문자열·주석·hex·name을 구분하고 inline dictionary의 W/H/BPC/CS/IM로 무필터 payload 길이를 계산해 원시 bytes를 건너뛴다. 토큰은 256 bytes로 제한하고 64KiB마다 실제 macrotask에 양보·abort를 재검사한다. Flate는 `DecompressionStream` chunk를 누적하면서 1MiB마다 같은 계약을 적용하고, 분할할 수 없는 fallback decode는 호출 전후 abort와 결과 미등록을 보장한다. 위험 검사와 결과 검사는 모두 이 byte 경로를 쓰며 생성한 짧은 marker stream 외에는 이미지 바이너리를 문자열로 만들지 않는다.

**미리보기·파일 수명주기** — fix-2에서는 큰 이미지의 canvas 작업을 전용 OffscreenCanvas worker에서 실행했으나, 이 시점의 **“PDF.js 표시 런타임을 중복 번들하지 않는다”는 기록은 fix-3 계측으로 거짓임이 확인되어 기각한다.** 당시 worker 본체는 1.67kB이지만 main의 full 모듈과 worker의 minified URL 모듈이 별도 산출물이었다. 전용 worker를 제거한 기각 대조에서는 32/64MiB heartbeat 중앙값이 약 **219/387ms**로 목표 200ms를 넘었으므로 main-thread 호환 경로만 쓰는 안을 기각했다. 파일별 controller/request token을 업로드 검사·thumbnail/large preview에 전달하고 제거·교체·unmount에서 abort, PDF document destroy, object URL 회수, 늦은 상태/canvas 등록 차단을 함께 수행한다. 검사 중 `pdf-finish-file-cancel`과 변환 중 기존 `pdf-finish-cancel`을 분리했으며 실제 외부 click 뒤 파일·canvas·결과가 사라지고 같은 탭 재시도가 성공한다.

| 성능 지표 | 수정 전 | fix-2 최종 중앙값 | 목표·판정 |
|---|---:|---:|---|
| 최대 heartbeat | 16/32/64MiB **3.328/13.083/52.293초** | **67.185/57.040/67.590ms** | 각 ≤200ms, 통과 |
| 총 처리시간 곡선 | heartbeat가 제곱 증가 | **2.463/2.571/3.602초** | 64/16=1.46, 준선형·통과 |
| 외부 취소 click→UI | 파일 제거 약 50초 대기 | **101.806ms** | ≤250ms, 통과 |
| 결과 보존 | 정상 파일은 약 52초 뒤 완료 | 3 curve 모두 preview dark sample·overlay·download 있음 | 통과 |

측정은 1280×900, DPR 1, CPU/network 제한 없음, 케이스별 새 context, 11개 유효 PDF×3회다. raw 1KiB/10KiB/64KiB/200KiB/1MiB와 Flate 1/4/8MiB, 같은 폭의 Flate 16/32/64MiB를 고정했고 manifest SHA-256은 `046cc7edf428971e6580b4bad873d001ed6af4b753b96bc48a24d1f3cbfa60ee`다. 최종 11개 중 가장 큰 heartbeat 중앙값은 **76.565ms**, Long Task 중앙값은 모두 0ms였다. 원보고서는 `/tmp/worklazy-u4-4-fix2/performance-final-optimized.json`이다.

**A3 네 반례와 가시성 정책**

| 반례 | 최종 판정·증거 |
|---|---|
| 597B 정상 inline payload 안의 EI 유사 bytes | dictionary 기반 payload skip으로 위험 경고 없이 정상 처리·다운로드했다. payload bytes를 연산자로 읽지 않는다. |
| 200×200, 100×50 이미지 tile 60%, 45°, offset 180 | 실제 회전 사각형 polygon과 유효 페이지의 교차 면적 0으로 `empty-placement` 사전 오류다. 0°·offset 199의 1-pixel 양성 대조는 배치 1개로 통과한다. |
| 확장 뒤 공백/줄바꿈뿐인 텍스트 | ko/en 모두 template 필드의 `empty-text` 사전 오류이며 다운로드는 0이다. |
| 복잡한 clip/path | scanner 불확실성을 확정 empty clip 근거로 쓰지 않는다. 확실한 zero rectangle만 결과 실패로 판정하고, 나머지는 기존 위험 경고·동의를 유지한 채 결과 1,376B를 제공하고 미리보기·다운로드 뒤 확인 안내를 적용한다. 완전한 가시성 판정이라고 주장하지 않는다. |

결과 validator는 비어 있는 glyph와 확정 zero clip을 거부하되 불확실한 문서를 일괄 거부하거나 layer를 바꾸지 않는다. 회전 배치는 AABB 후보를 빠르게 거른 뒤 실제 polygon을 clip해 면적을 계산한다. 4MiB stream 중간 취소 unit은 timer가 실행되어 `AbortError`로 끝나며 결과를 등록하지 않는다.

**A8·P3** — F2 고유 text/image 입력·helper, content/layer/pattern/position, font/margin/color, rotation/opacity/size, tile gap/offset, 미리보기 안내, 검사 상태·오류·경고·위험 동의의 실제 DOM 조상을 `[data-pdf-watermark-owned]`로 표시했다. 감사기는 selector 미발견·빈 target·해석 불가를 `shared-existing`으로 강등하지 않고 즉시 실패한다. 실제 text/image/risk/error 브라우저 상태에서 고유 target의 미귀속은 0이며, 6개 음성 mutation은 모두 거부됐다. local-QA 12페이지는 violations 0, incomplete **F2 0 / inherited 925**, 외부 요청 0이다.

Helvetica 두 줄 tile은 배치 높이·글자 크기·간격을 그대로 두고 Form XObject BBox 상단에 `max(1pt, size/32)` 여유만 더했다. PDF.js 픽셀은 **14,520/10,972**로 불변이고 Poppler는 손실 상태 **16,023/12,144**에서 상단 +20pt 대조와 같은 **16,137/12,208**로 복구됐다. 하단 확장 대조는 변화가 없고 font 축소는 하지 않았다. 미리보기 안내는 확정한 ko/en 사용자 문구로 교체해 `PDF.js`·`UserUnit viewport coordinates`를 화면에서 제거했으며 기술 문서의 UserUnit 범위 설명은 유지했다. 이 문구의 흐름 변화만 확인해 page-number/header-footer/watermark 각 8장, 총 **24장**을 공식 생성기로 갱신했다. `LANG=ko_KR.UTF-8`와 `en_US.UTF-8` 전체 visual은 각각 **211/211** 일치했다.

**astra 원본 probe** — 원본 SHA를 확인하고 수정하지 않은 채, 4270과 검수 경로를 하드코딩한 브라우저 probe만 bwrap read-only mapping과 4280→4288 same-origin proxy adapter로 실행했다. `resume-performance`, `adversarial-engine`, `cancel-fuzz`, `render-new`, `contracts-new`, `bbox-controls`, `a11y-aggregation-negative`, `browser-focused`는 제품 계약을 재현했다. cancel-fuzz는 1,256개 fuzz 최대 1.921ms, direct abort 26.13ms/UI 0.319ms, full engine abort 52.22ms/UI 1.18ms와 재시도 성공을 기록했다. `browser-new`는 597B 정상 파일에서 더 이상 false risk 경고가 나오지 않는데 구 계약대로 risk-confirmation을 click하려 해 그 지점에서 종료됐다. 이는 새 요구의 성공 관찰이며 PASS로 세지 않았다. `golden-recount-all` 이름의 독립 실행 파일은 없고, 현행 생성기/제품 골든이 **160/160**을 직접 재집계했다.

**fix-2 번들 기록 정정** — 아래는 `.mjs` 실행 자산을 누락한 당시 값이므로 5종 통과 근거로 쓸 수 없어 기각한다. 동일 산출물을 v3로 정정 재계측한 shared/app 증분은 +133,495B/+164,213B로 실제로는 상한을 넘었다.

| 번들 지표(gzip) | S3 고정 기준 대비 순증분 | 고정 상한 | 당시 판정(기각) |
|---|---:|---:|---|
| entry JS | +7,177B | +20,480B | 통과 |
| affected PDF route JS | +22,750B | +61,440B | 통과 |
| shared JS(귀속 이동 제외) | +3,068B | +30,720B | 통과 |
| app JS | +33,786B | +81,920B | 통과 |
| CSS | +235B | +10,240B | 통과 |

override `{}`·multiplier 1이며 QR/image-studio→shared 이동 **509,794B**는 순증분과 분리했다. 처음 PDF.js 표시 모듈을 worker에 정적 포함한 구현은 app +184,494B/shared +153,800B로 예산을 넘겨 기각했다. **당시 1.67kB worker+해시 `.mjs` 자산 경계에서 다섯 상한을 통과했다는 결론은 `.mjs` 누락으로 오판한 것이며 fix-3에서 상단과 같이 정정했다.**

| 검증 | 최종 결과 |
|---|---|
| `npx tsc -b` · `npm run test:unit` | 진단 0; **318/318**, fail·skip 0 |
| 4GiB production build · static | **2,847 modules**, 정적 **69페이지**, startup recovery **116**, 통과 |
| PDF finish · watermark golden | 16 직접 진입·오류/입력 복구·48 preview 배치·A3·취소/재시도 통과; PDF.js/Poppler **160/160** |
| PDF 범위/전체 browser · new-tools · utilities · Office | 모두 통과; new-tools 최종 실행은 네 도구 전체 통과, Dolby Vision host capability skip은 결정적 fallback 검증 통과 |
| QR bulk · font · recovery · legacy oracle | 통과; font 3 fixture changed pixels 0, recovery **147**, legacy client 3/structure 4/render 32/output 4/input 1 총 diff 0 |
| Excel Cleaner · Compare | 취소·재실행·보고서·모바일 포함 통과 |
| 전체 visual ko/en | 각각 **211/211**, 실제 문구 변화 24장만 갱신 |
| local-QA a11y · rendering | 위반 0·F2 incomplete 0·외부 요청 0; 7대상×3회, finish 계열 CLS max **0.0001480366** |
| bundle · CSS · legacy · registry | scoped 5상한 통과; orphan 0; 155 rules/153 removed/0 split/2 active; 도구 **20** 불변 |

`standardFontDataUrl` 경고는 기존 PDF.js 환경 경고이며 두 렌더러 골든과 출력 검증은 통과했다. 모든 원출력·JSON·캡처와 probe 격리 자료는 `/tmp/worklazy-u4-4-fix2/`에 보존한다. — Codx

## 2026-09-07

### U4-4 fix-1 — 1차 검수 R1~R9 수리·접근성 귀속 분리 (Codx)

**실행 게이트·범위** — `PROJECT_RULES.md`를 첫 행동으로 전문 확인하고 `AGENTS.md`, fix-1 dispatch, PDF finish 정본과 U4-4 착수 지시서, 저장소에 보존된 1차 검수 보고·시각 판정을 대조했다. 시작 branch/HEAD는 `s3-pdf-finish`/`5767f135443f113e655fbb0801a01e4d3c11de23`으로 지시와 일치했고 열린 실행 계획과 충돌은 없었다. 사용자 미추적 DOCX 2개·네이버 확인 HTML·`newui/`와 금지된 다른 worktree·검수 산출물에는 접근하지 않았고 main 동기화·병합·push·배포도 하지 않는다.

| 결함 | 원인과 수리·고정 회귀 |
|---|---|
| R1 inline image 멈춤 | content scanner가 연산자 밖의 `)`에서 index를 전진시키지 않았다. 모든 분기에 전진 보장을 두고 literal string·주석·hex·name과 `BI…ID…EI`의 원시 image data를 분리했다. 정상 `0x29` data, 닫는 괄호, 문자열/주석/hex, 여러 stream의 논리적 `q/Q` 균형 및 실제 업로드·취소·재시도를 고정했다. 불확실한 구문은 `risky-graphics-state` 경고이며 일괄 거부하지 않는다. |
| R2 descender | 마지막 baseline 0과 Form `BBox=[0,0,w,h]`가 하단 glyph를 잘랐다. font의 descender 포함 높이와 ascender 차이로 baseline offset을 만들고 모든 줄과 BBox 높이에 동일 적용했다. 글자 크기는 유지한다. `gypqj`, 다중 줄 마지막 `gypqj`, Noto, 4회전, single/tile을 PDF.js·Poppler **32렌더** 고정 수치로 추가했고 기존 이미지 **128렌더**도 유지했다. |
| R3 0개 배치 성공 | offset 뒤 행·열 수가 0이어도 성공으로 반환했고 validator는 marker만 확인했다. 회전 bounds와 signed offset의 실제 교차 타일부터 계산해 0개를 `empty-placement` 사전 필드 오류로 막고 ko/en 행동 안내를 추가했다. validator는 `Do≥1`, 참조 XObject 존재, 전경 앞의 `Q + zero-area/empty clip`을 확인해 marker-only·삭제 resource·비가시 결과를 거부한다. clamp·축소·전경 폴백은 하지 않는다. |
| R4 모바일 탭 | 공용 Button의 nowrap 상태에서 icon+label 폭이 3등분 버튼보다 컸다. 320/390px에서 icon/label을 세로 배치하고 label 줄바꿈과 `min-width:0`을 줘 자기 bbox와 인접 경계를 지키게 했다. 상위 5칸 navigation 계약은 유지했다. |
| R5 F1 미리보기 | F2 공용화 중 기존 F1 wrapper의 `white-space`, line-height, weight, opacity가 빠졌다. F1은 `whitespace-pre-wrap`, `leading-[1.2]`, `font-medium`, `opacity-90`, 최대 폭 60%를 복원했고 실제 두 줄 높이를 브라우저에서 단언한다. |
| R6 타일 미리보기 | 3열·18개·82% 폭 DOM을 고정해 size/gap/offset 변화가 없었다. PDF.js scale-1 viewport 치수와 제품 `createWatermarkPlacements`를 공유해 text/image object 비율과 배치 수·중심·크기·회전을 %로 표시한다. 픽셀 동일성은 주장하지 않지만 유효 size 변경의 폭·개수 반응을 검사한다. |
| R7 레이아웃·범위·취소 | 중앙 single은 전체 유효폭을 유지하고 나머지 6영역은 N3의 3열×2행 폭·높이에 같은 말줄임·수직 생략 경고를 적용했다. 확정 범위는 opacity **0.01~1(step .01)**, size **1~100%**, gap **0~2000pt**, offset **−2000~2000pt**이며 타일 상한 **400**은 유지한다. 각 tile operator 전에 abort 검사·event-loop 양보·재검사를 수행한다. 지원 설명은 **회전/CropBox 및 PDF.js 방식 UserUnit viewport 좌표 처리**로 한정하며 renderer 간 픽셀·치수 동일성을 뜻하지 않는다. |
| R8 접근성 | 하네스가 axe `incomplete`를 버려 passes/violations만 저장했다. 이제 rule·impact·help URL과 노드 target·failure summary·검사 사유를 보존하고, 노드를 `f2-watermark`/`shared-existing`으로 분리한다. QA 실측은 violations **0**, 외부 요청 **0**, incomplete **925 inherited / F2 신규 0**이다. 기존 공용 대비·ARIA는 이 작업의 통과로 세지 않고 `docs/backlog.md`의 UI 전면 재설계 게이트로 이관했다. |
| R9 내부 명칭 | ko/en의 “내부 구조/stream”을 “배경 워터마크를 안전하게 넣지 못함 → 전경 또는 다른 사본 시도”라는 행동·결과 문구로 교체했다. 원시 예외 미노출 경계는 그대로다. |

**1차 기록 정정** — 기존 U4-4 기록의 글꼴 분기는 “ASCII/Latin-1 대 나머지”가 아니라 **각 후보 전체의 Helvetica encode 가능 여부와 Noto glyph coverage** 기준이다. 최초 구현에서 수정된 시각 기준선 20장은 모두 세 번째 탭 때문이 아니며 **16장은 안내문+F1 glyph 스타일·하단 흐름, 4장은 내부 3탭**이다. 당시 bundle 귀속 이동 **509,794B**는 **QR 509,380B + image-studio 414B**이고 전부 QR로 적지 않는다. UserUnit 지원은 위 PDF.js식 viewport 좌표 범위로 제한한다.

fix-1에서는 공식 생성기로 필터 36장을 재생성했고 실제 변경은 **28장**이다: page-number 8·header/footer 8은 지원 안내와 F1 wrapper, watermark 8은 지원 안내와 새 배치 미리보기, active finish navigation 4는 모바일 내부 탭이다. start/end navigation 8장은 변경되지 않았다. 실제/diff 이미지를 확인한 뒤 갱신했으며 같은 필터 재실행 **36/36**이 기준에 일치했다.

**접근성 귀속 재측정** — local-QA 12페이지에서 자동 위반은 0, 외부 요청은 0이다. 하네스가 보존한 incomplete은 rule 15건·node 925개이며 F2 소유 target 목록은 정확히 `[]`(0개), 공용 상속은 925개다. 페이지별 공용 상속 node는 home 5·document-compare 43·tools 199·excel-compare 64·pdf-editor 47·pdf-finish-ko 47·pdf-finish-mobile-ko 31·pdf-finish-en 47·pdf-watermark-ko 47·hwp-editor 44·home-mobile-ko 171·tools-mobile-ko 180이다. target을 찾지 못하거나 target/reason을 버린 결과는 하네스 오류로 처리한다. 공용 925개는 `docs/backlog.md`의 "공용 UI 접근성 incomplete 정리"와 `docs/jobs/todo/ui-theme-redesign-20260907.md` 게이트에 귀속했다.

| 번들 지표(gzip) | 고정 S3 기준 대비 fix-1 누적 순증분 | 상한 | 잔여 |
|---|---:|---:|---:|
| entry JS | +7,128B | +20,480B | 13,352B |
| affected PDF route JS | +20,415B | +61,440B | 41,025B |
| shared JS(귀속 이동 제외 net) | +2,171B | +30,720B | 28,549B |
| app JS | +30,494B | +81,920B | 51,426B |
| CSS | +235B | +10,240B | 10,005B |

고정 기준 SHA-256은 `2605437e04a5d77ed41c2dbfac4fae864a6a9c8b5e56941e696a80b7f76ac692`, override `{}`·multiplier 1이다. scoped 비교는 5지표 모두 통과했다. 전체 route 원실행은 기준의 `perRouteJsGzip`에 audio가 없어 fail-closed 했고 이를 성공으로 세지 않았다. 기준 `files[].routeOwners/gzipBytes`를 변경 없이 재집계해 기록된 PDF **171,864B**와 일치함을 먼저 단언한 뒤 19개 전체 route를 비교했으며, 기준 **2,450,827B**→현재 **1,962,228B**, 증분 **−488,599B**다. QR→shared 509,380B와 image-studio→shared 414B의 귀속 이동은 순증분에서 분리했다.

| 검증 | fix-1 최종 결과 |
|---|---|
| TypeScript · unit · production build · static | 진단 0; **312/312**, fail·skip 0; **2,847 modules**, 정적 69페이지·startup recovery 116 통과 |
| PDF finish · watermark golden | inline image `0x29`, split stream, 0배치·resource/clip 음성 대조, 실제 업로드·취소·재시도 통과; 기존 128 + descender 32 = **160/160** 렌더 |
| PDF 범위/전체 browser · new-tools · utilities · Office | 전부 통과; 기존 host capability skip은 결정적 fallback 검증 통과 |
| QR bulk · font · recovery · legacy oracle | 전부 통과; recovery **147 cases**, legacy client/structure/render/output/input 총 diff **0** |
| Excel Cleaner · Compare | 취소·재실행·보고서·모바일 포함 통과 |
| 전체 visual ko/en | **211/211**, 위 28개만 공식 생성기로 변경 |
| local-QA a11y · rendering | 위반 0·F2 incomplete 0·공용 incomplete 925 보존·외부 요청 0; 7대상×3회, watermark CLS max **0.0001480366** |
| bundle scoped/전체 · CSS · legacy · registry | scoped 5상한 통과·전체 −488,599B; orphan 0; 155/153/0/2; 도구 20 |
| 공백·포트 | `git diff --check` 통과; 모든 명시 Vite 포트는 4280~4287 `--strictPort` |

검수 probe 원본은 허용된 저장소·dispatch 경로에 없고 금지된 `/tmp/worklazy-u4-4-review1` 및 4270 하드코딩을 가리켜, "무수정 실행"과 이번 잡의 접근 금지·4280~4289 제약을 동시에 만족할 수 없었다. 금지 경로를 읽거나 probe를 고치지 않았고, 같은 R1/R2/R3/R6 계약은 제품 unit·브라우저·PDF.js/Poppler 골든에서 직접 재현했다. 최초 inline 브라우저 재현은 이전 ready locator를 재사용한 동기화 오류와 200pt/10%의 의도된 6영역 overflow를 각각 검출했으며, 제품 완화 없이 새 파일의 실행 버튼 활성 대기와 유효 6pt fixture로 교정한 뒤 최종 명령을 통과했다. 원출력과 JSON·캡처·PDF/PNG는 `/tmp/worklazy-u4-4-fix1/`에 보존한다. — Codx

### U4-4(F2) PDF 벡터 워터마크·배경 stream — 브랜치 구현·검증 (Codx)

**실행 게이트·범위** — 첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 `AGENTS.md`, 지정 dispatch, PDF finish 정본의 현행 실측 1~3·확정 1/3/4/21/25/26·U4-4·H5 C-D·H6 및 관련 검토 이력을 확인했다. 시작점은 `s3-pdf-finish`의 `HEAD=31529570059efe2478fb0326baf7740bc4861783`으로 지시와 일치했고 추적 변경과 열린 계획 충돌은 없었다. 사용자 미추적 DOCX 2개·네이버 확인 HTML·`newui/`를 열거나 stage하지 않았으며 금지된 다른 worktree·검수 산출물도 접근하지 않았다. main 동기화·병합·push·배포는 수행하지 않는다.

**엔진·배경 stream 계약** — 텍스트는 페이지별 확장·줄바꿈 결과를 PDF Form XObject의 벡터 glyph로 만들고, 문서별 폰트 resource 하나를 각 form이 참조한다. ASCII/Latin-1은 Helvetica, 그 밖은 기존 고정 Noto asset의 glyph coverage·hash 검증과 배치당 1회 fetch를 그대로 공유한다. PNG/JPEG는 문서당 XObject 하나만 임베드하며 단일·타일 배치는 같은 reference를 반복 호출한다. 단일 7영역과 최대 400개 반복 타일은 회전된 bounds, 간격·x/y offset, CropBox∩MediaBox·UserUnit·0/90/180/270도 viewport 역변환을 적용한다.

각 워터마크는 원본과 분리된 content stream 하나로 `q` → `/Artifact BMC` → 배치별 `q`/ExtGState/CTM/XObject/`Q` → `EMC` → `Q`를 닫는다. 전경은 `/Contents` 마지막, 배경은 먼저 새 stream을 등록해 정규화된 배열 끝에 붙인 뒤 그 정확한 reference를 제거하고 **index 0에 삽입**한다. 없음·단일 stream·다중 배열은 이 절차로 각각 `[watermark]`·`[watermark, original]`·`[watermark, ...originals]`가 됐고 원본 순서는 유지됐다. 비정상 entry는 생성 전 거부해 부분 결과가 없으며 조용한 전경 폴백은 배경 선택의 의미를 바꾸므로 기각했다. 저장 뒤 문서를 다시 열어 페이지 수와 선택 페이지의 첫/마지막 marker stream을 검사하고 실패하면 결과를 제공하지 않는다.

**위험 문서·화면 표면** — 원본 stream의 `q/Q` 불균형, catalog의 optional content, tagged structure를 사전 검사 경고로 올린다. 위험 문서는 파일·설정을 유지한 채 명시 동의 전 실행만 막고, 동의 뒤에는 선택한 배경/전경 계약 그대로 실행한다. `/tools/pdf-editor/watermark`는 직접 진입 시 워터마크 탭을 열며 text/image, 배경/전경, 단일/타일, 영역·회전·불투명도·크기·여백·타일 간격/offset을 제공한다. 기존 exact page range와 썸네일 선택은 양방향 동기화되며 첫 선택 페이지 PDF.js canvas 위에 텍스트/이미지 단일·타일 overlay와 근사 안내를 표시한다. object URL은 교체·unmount 때 회수한다. ko/en 제목·설명·FAQ·canonical·정적 페이지·sitemap·소셜 PNG를 동반 등록했고 이 route는 격리 경로가 아니므로 기존 일반 광고 loader를 그대로 상속한다.

**구조·픽셀·resource 증거** — `/Contents` fixture 4종은 빈 Contents·단일 stream·다중 stream·비정상 entry다. 앞의 3종은 배경/전경×단일/타일×4회전×PDF.js/Poppler **96렌더**, 별도 비영점 CropBox 4쪽 고정 색상 문서는 같은 32렌더를 만들어 총 **128/128**을 통과했고, 비정상 fixture는 결과 0으로 차단됐다. 고정 문서의 원시 분류 픽셀 범위는 아래와 같으며 배경에서는 파란 원본이 빨간 워터마크 위를 덮고 전경에서는 반대임을 두 renderer에서 단언했다. 전체 원수치는 `/tmp/worklazy-u4-4/golden/metrics.json`에 있다.

| layer/pattern | PDF.js red / blue | Poppler red / blue |
|---|---:|---:|
| background single | 250~444 / 15,600 | 288~496 / 15,600 |
| background tile | 2,850~5,417 / 15,600 | 3,012~5,597 / 15,600 |
| foreground single | 7,852~9,722 / 6,256~7,923 | 8,054~9,926 / 6,170~7,834 |
| foreground tile | 11,116~12,649 / 7,264~8,298 | 11,421~12,991 / 7,191~8,206 |

이미지 타일 unit은 결과의 `/Subtype /Image`가 정확히 **1개**이고 워터마크 `Do`가 여러 개인 것을 함께 검사한다. 같은 116B PNG의 단일 결과는 **1,175B**, 타일 결과는 **1,270B**로 차이는 배치 연산자 **95B**뿐이었다. 텍스트 form도 font resource 정확히 1개와 vector text 추출을 확인했다. 첫 골든 실행에서 이미지 XObject의 고유 너비/높이를 다시 scale해 그림이 보이지 않던 결함을 검출했고, 이미지 자체가 단위 사각형을 그린다는 계약에 맞춰 object 크기를 1×1로 고친 뒤 전 렌더를 통과했다. 브라우저 이미지 비율 검사는 회전된 화면 bounds가 아니라 원본 `naturalWidth/naturalHeight`를 비교하도록 잘못된 하네스 판정을 교정했다.

**시각 판정** — 워터마크 full profile ko/en×light/dark×desktop/mobile **8장**을 새로 추가했다. 세 번째 구현 탭 추가로 실제로 바뀐 기존 page-number/header-footer 16장과 active navigation 4장만 생성기로 갱신해 기준선 diff는 **신규 8 + 수정 20 = 28장**이다. 첫 전체 실행의 기존 finish 20장 실패는 모두 새 탭 폭/문구 변화였고 diff를 육안 확인한 뒤 해당 파일만 갱신했다. 최종 전체는 **211/211, 2분 15.11초**, threshold 0.1·상이 픽셀 0.1% 이하·AA 무시 조건으로 통과했다. ko/en 390px 직접 경로와 320px navigation은 별도 baseline 및 브라우저 스모크에 포함된다.

| 번들 지표(gzip) | U4-0 고정 기준 대비 누적 순증분 | 고정 상한 | 잔여 | 판정 |
|---|---:|---:|---:|---|
| entry JS | +6,950B | +20,480B | 13,530B | 통과 |
| affected PDF route JS | +18,881B | +61,440B | 42,559B | 통과 |
| shared JS | +2,161B | +30,720B | 28,559B | 통과 |
| app JS | +28,748B | +81,920B | 53,172B | 통과 |
| CSS | +218B | +10,240B | 10,022B | 통과 |

기준은 schema v2 `/tmp/s3-bundle-baseline.json`, 현재 실측은 `/tmp/worklazy-u4-4/bundle-u4-4.json`이며 override `{}`·multiplier 1이다. QR route에서 shared로 이동한 **509,794B**는 모듈 귀속 이동으로 분리했다. 첫 비교는 `BUNDLE_ROUTES`를 생략해 PDF-only 기준과 전체 route 집합을 잘못 대조했고 baseline의 audio route 부재를 정확히 거부했다. 이를 통과로 취급하지 않고 `BUNDLE_ROUTES=pdf-editor`로 재실행했다. 결과 검증의 불필요한 동적 import도 제거해 production `PdfFinishPanel`을 **54.56kB / gzip 17.21kB**로 줄인 뒤 위 최종 수치를 다시 측정했다.

| 검증 | 최종 결과 |
|---|---|
| `npx tsc -b` · `npm run test:unit` | 진단 0; **306/306**, fail·skip 0 |
| production build · static | **2,847 modules**, 정적 **69페이지**, startup recovery **116**, 통과 |
| PDF finish smoke · watermark golden | 16 직접 진입, text/image/tile/risk/4회전 CropBox/출력/취소/재시도; 4 Contents fixture·**128/128** 렌더 통과 |
| PDF scope browser · 전체 browser | 기존 PDF 4모드와 Excel·Word·shared UI 통과 |
| new-tools · utilities · office | HWP·Image·Audio·Video, ko/en 유틸리티, Office 통과 |
| QR bulk · font render | 4 font scenario·취소·404 통과; 기존 fixture 픽셀·텍스트 oracle 통과 |
| recovery · legacy oracle | **147 cases**; client 3·structure 4·render 32·output 4·input 1, 총 diff **0** |
| Excel Cleaner · Compare | 취소·재실행·보고서·모바일 포함 통과 |
| 전체 visual | ko/en 포함 **211/211**; 위 28개 기준선 변경 |
| 최종 local-QA build · a11y · rendering | 정적 69; 12페이지 axe 위반 **0**; 7대상×3회 외부 요청 0, watermark CLS max **0.0001480366** < 0.1 |
| bundle · CSS · legacy · registry | 5종 상한 통과; orphan 0; 155 rules/153 removed/0 split/2 active; 도구 **20** 불변 |
| 공백·포트 | `git diff --check` 통과; 4280~4289 `--strictPort` 범위 사용 |

반복된 Node PDF.js `standardFontDataUrl`과 QR Poppler font-type 문구는 기존 환경 경고이며 PDF.js/Poppler 픽셀·텍스트 oracle은 통과했다. 원출력, bundle/a11y/rendering JSON, 직접 경로 캡처와 골든 PDF/PNG는 `/tmp/worklazy-u4-4/`에 보존한다. 범위 밖 F3 도장·F4 정리/래스터·다중 결과 ZIP은 구현하지 않았다. — Codx

### U4-3 fix-3 — 원시 숫자·탭 사전 검사와 Office 스모크 동기화 (Codx)

**실행 게이트·범위** — `PROJECT_RULES.md`·`AGENTS.md`, fix-3 dispatch, astra 3차·2차 보고와 fix-2 지시서를 전문 대조했다. 시작점은 `s3-pdf-finish` `HEAD=37470534a28b1bf1752a6d659820240fc3bc1b2a`로 지시와 일치했고 추적 변경은 없었다. 열린 계획의 문서 비교·Excel·UI 작업은 별도 작업 트리 또는 다른 제품 표면이며 이번 panel·스모크와 상반된 지시는 없었다. 사용자 미추적 DOCX 2개·네이버 확인 HTML·`newui/`를 열거나 stage하지 않았고, 금지된 `/tmp/worklazy-xr`·`/tmp/worklazy-dc-impl`도 접근하지 않았다. main `cdb4007` 병합·push·배포는 하지 않는다.

**R1 잔여 원인·수리** — fix-2의 동일 탭·위치 무시 가드는 유지됐다. 다만 `updateForm`과 공용 입력 helper는 원시 문자열의 실제 변화(`"10"→"10.0"`, `"1"→"01"`)를 보고 preflight를 `idle`로 지우는 반면, effect는 변환된 숫자만 의존해 값이 같으면 다시 실행되지 않았다. 실제 탭 전환도 `idle`을 만들지만 두 탭의 검사 설정이 같으면 effect 의존값이 바뀌지 않았다. 검사 effect가 `form.fontSize`·`form.margin`·`startNumber`·`startPage`·`activeTab`을 함께 의존하도록 초기화와 예약의 동일성을 맞췄다. 파일 없음·무효 입력은 계속 정상 `idle`이고 상태 은닉이나 버튼 강제 활성화는 없다.

전용 단언 `testPreflightRawInputAndTabChanges`는 ko/en 각각 글자 크기 `10→10.0`, 여백 `24→24.0`, 시작 번호 `1→01`, 시작 쪽 `1→01`과 두 탭의 template·region·raw numeric·색을 같게 만든 뒤 탭 전환을 검사한다. 각 10건에서 원시 입력 보존, `idle→checking`, `ready`, alert 0, route error 0, 실행 활성과 새 PDF 결과를 모두 확인해 **숫자 표기 8/8·탭 전환 2/2·실제 PDF 생성 10/10**으로 통과했다. 기존 동일 탭/위치 재클릭과 실제 위치 변경 **6/6**, 무효→유효 복귀, 취소·재시도 단언도 같은 전용 스모크에서 유지됐다.

**Office 플래키 수리** — 제품의 Office 저장·변환 코드는 바꾸지 않았다. `tests/office-editor-smoke.mjs`가 키 입력 API 반환을 셀 이동 완료로 간주하지 않고 실제 Office worker의 문서 controller와 첫 시트 값을 조건 대기한다. Ctrl+Home 뒤 A1(row 0, col 0)과 원래 한글 값, ArrowDown 뒤 A2(row 1, col 0)와 `이동 전`, Enter 뒤 A1 보존과 A2의 `Arrow navigation verified` 반영을 각각 확인한 뒤 다음 navigation과 저장을 수행한다. production preview 4250 `--strictPort`에서 원명령을 연속 **20/20, 실패 0**으로 실행했고 완료 기준의 별도 1회도 통과했다. 고정 sleep이나 기대값 완화는 추가하지 않았다.

**기록 정정 4건** — (1) 위 숫자 표기 8건·동일 설정 탭 전환 2건의 새 반례와 수리·재검증을 기존 fix-2의 6개 표본과 구분해 기록했다. (2) fix-2 표의 번들 수치는 `ff0452b3` 대비가 아니라 SHA `2605437e…`인 고정 S3 `/tmp/s3-bundle-baseline.json` 대비였으므로 아래 기존 문장을 정정했다. fix-3 재측정은 같은 기준·override `{}`·multiplier 1에서 entry **+4,860B**, PDF route **+13,801B**, shared net **+2,051B**, app **+21,152B**, CSS **+118B**로 모두 상한 안이다. (3) 시각 결과는 정확한 픽셀 동일을 뜻하지 않으므로 기존 “변경 픽셀 0”을 **기준선 파일 변경 0**으로 정정했다. 실제 회귀는 ko/en 각각 **203/203**이고 threshold 0.1·상이 픽셀 비율 0.1% 이하·AA 무시 조건이다. (4) native `maxLength=300` 뒤 현재 값은 300/300이므로 “현재 개수 초과”가 아니라 **입력 시도가 300자 한도를 넘어 일부만 반영됨**을 설명하도록 ko/en catalog를 고쳤다.

| 검증 | 결과 |
|---|---|
| `npx tsc -b` · `npm run test:unit` | 진단 0; **301/301**, fail·skip 0 |
| production build · static | **2,845 modules**, 정적 **67페이지**, startup recovery **113**, 통과 |
| PDF finish smoke | 기존 F1~F9·재클릭/변경 6 유지, 새 R1 **10/10**, 해당 새 PDF **10/10**, 48 preview·4회전 boundary·취소/재시도 통과 |
| PDF scope browser · 전체 browser · new-tools · utilities | 통과; 기존 Dolby Vision host capability skip과 결정적 fallback 결과를 원로그에 보존 |
| Office | A1/A2/편집 반영 조건 대기 적용 후 연속 **20/20 실패 0**, 별도 완료 기준 1회 통과 |
| QR bulk · font render | 4 scenario·취소·404 통과; 3 fixture Poppler changed pixels 0·PDF.js 추출 동일 |
| recovery · legacy oracle | **147 cases**; client 3·structure 4·render 32·output 4·input 1, 총 diff 0 |
| Excel Cleaner · Compare | 취소·재실행·보고서·모바일 포함 통과 |
| 두 `LANG` 전체 visual | 각각 **203/203**, 7분 28.31초·7분 25.36초; **기준선 파일 변경 0** |
| local-QA build · a11y · rendering | 정적 67; 11페이지 위반 0; 6대상×3회 외부 요청 0, finish 최대 CLS **0.0001480366** < 0.1 |
| bundle · CSS · legacy · registry | 고정 S3 기준 5종 상한 통과; orphan 0; 155 rules/153 removed/0 split/2 active; 도구 20 불변 |

제품 영향은 PDF finish 상태 예약과 ko/en 제한 안내뿐이다. route·SEO·정적 페이지 집합·광고 격리·기존 4모드·Office 제품 코드·의존성은 바꾸지 않았다. 원출력과 JSON은 `/tmp/worklazy-u4-3-fix3/` 및 ignored state report에 보존한다. — Codx

### U4-3 fix-2 — 사전 검사 재선택·출력명 끝 공백 수리 (Codx)

**실행 게이트·범위** — `PROJECT_RULES.md`·`AGENTS.md`, fix-2 dispatch, astra 재검수 보고서와 앞선 fix 지시·보고서, U4-3 정본 및 열린 계획서를 읽었다. 시작점은 `s3-pdf-finish` `HEAD=ff0452b3ad171bfba920f41ec0789612e5ec2001`로 지시와 일치했다. `main`이 `cdb4007`로 갱신된 사실은 확인했지만 이번 작업에는 병합하지 않았고 열린 계획 충돌도 없었다. 사용자 미추적 `after.docx`·`before.docx`·네이버 확인 HTML·`newui/`는 열거나 stage하지 않았으며, 금지된 `/tmp/worklazy-xr`·`/tmp/worklazy-dc-impl`도 건드리지 않았다. main 병합·push·배포는 수행하지 않는다.

**R1 원인·수리** — 탭과 위치 클릭 handler가 실제 상태값이 같은 경우에도 preflight만 `idle`로 초기화했다. 반면 검사 effect는 탭·폼의 실제 입력값을 의존하므로 동일값 재선택에는 다시 실행되지 않아, 유효 입력인데도 만들기 버튼이 계속 비활성화됐다. `selectTab`, `updateForm`, 직접 preflight 입력 helper는 `Object.is`로 실제 변경을 먼저 확인하고 같은 값이면 완료된 상태를 보존한다. 값이 달라지면 기존처럼 결과를 지우고 `idle`로 전환하며, 변경된 effect 의존성으로 `checking`과 `ready`를 다시 예약한다. 범위·홀짝·표지 제외·시작 번호·시작 페이지에도 같은 불변식을 적용했다. 브라우저 회귀는 ko/en 각각 동일 페이지 번호 탭, 동일 아래 가운데 위치, 실제 위 왼쪽 위치 변경을 검증했다. 동일값 두 경우는 1.5초 뒤에도 `ready`, 만들기 활성, alert 0, route error 0이고, 실제 변경은 MutationObserver가 `idle → checking`을 관측한 뒤 `ready`와 PDF 생성까지 확인했다. 합계 **6/6**이다. 입력 자체가 무효인 정상 `idle` 상태는 그대로 허용하며, 이번 수리는 유효한 동일값 재선택이 미예약 `idle`을 만드는 경로만 닫는다.

**R2 원인·수리** — 출력명은 원본에서 `.pdf`를 먼저 제거하고 나중에 trim·정규화해 끝 공백 앞 확장자를 놓쳤다. 이제 원본을 trim·정규화한 뒤 반복 `.pdf`와 기존 현지화 접미사를 제거한다. 단위 회귀는 `"  report.pdf  "`, `" .pdf "`, 반복 확장자, 확장자만 있는 이름, 확장자 없는 이름, Unicode 앞뒤 공백, 기존 `-finished` 접미사를 ko/en 각각 검사해 **16/16** 통과했고 기존 한글 금지 문자 정리도 보존했다. 실제 Chrome 다운로드 속성은 문제의 두 이름×ko/en **4/4**에서 `report-마무리.pdf`·`Worklazy-PDF-마무리.pdf`와 `report-finished.pdf`·`Worklazy-PDF-finished.pdf`로 확인했다. 따라서 빈 basename은 F9 fallback으로 수렴하고 확장자는 하나만 남는다.

**F1~F9 보존·시각 판정** — 제품 코드는 위 두 원인에 필요한 panel 상태 전이와 출력명 순서만 바꿨고 route·engine·geometry·폰트·QR·navigation·번역·SEO·정적 페이지·광고 격리 계약은 바꾸지 않았다. 전체 PDF·공용 도구·QR·복구·legacy·Excel 회귀를 재실행했다. 시각 기준선은 갱신하지 않았으며 ko/en 각각 **203/203**, 기준선 파일 변경 0으로 통과했다.

| 검증 | 결과 |
|---|---|
| `npx tsc -b` · `npm run test:unit` | 진단 0; **301/301**, fail·skip 0 |
| production build · static | **2,845 modules**, 정적 **67페이지**, startup recovery **113**, 통과 |
| PDF finish smoke | 12 직접 진입과 기존 F1~F9 회귀, R1 **6/6**, R2 실제 다운로드 **4/4**, 48 preview·4회전 boundary·취소/재시도 통과 |
| PDF scope browser · 전체 browser · new-tools · utilities | 통과; Dolby Vision host capability skip은 기존 환경 분기이며 결정적 fallback은 통과 |
| Office | 첫 실행은 Calc fixture의 저장값이 `["Arrow navigation verified", "이동 전"]`으로 남아 실패; 소스 변경 없이 동일 명령 재실행은 94 download·7 cached·한글 Calc keyboard·5,088B DOCX로 통과해 두 로그 모두 보존 |
| QR bulk · font render | 취소/복구/404와 4 시나리오 통과; 3 fixture Poppler changed pixels 0·PDF.js 추출 동일 |
| recovery · legacy oracle | **147 cases**; client 3·structure 4·render 32·output 4·input 1, 총 diff 0 |
| Excel Cleaner · Compare | 취소/재실행·보고서·모바일 포함 통과 |
| 두 `LANG` 전체 visual | ko **203/203, 7분 17.54초**; en **203/203, 7분 14.83초**; 기준선 갱신 0 |
| local-QA build · a11y · rendering | 정적 67; 11페이지 axe 위반 0; 6대상×3회 외부 요청 0, finish 최대 CLS **0.00014804** < 0.1 |
| bundle · CSS · legacy · registry | 5종 상한 통과; orphan 0; 155 rules/153 removed/0 split/2 active; 도구 20 불변 |

고정 S3 `/tmp/s3-bundle-baseline.json` 대비 번들 순증분은 entry **4,834B**, affected PDF route **13,791B**, shared **2,062B**, app **21,143B**, CSS **118B**로 다섯 고정 상한 안이며 override `{}`·multiplier 1이다. QR→shared 이동 **509,380B**는 순증분과 분리했다. raw 로그·JSON·보고서는 `/tmp/worklazy-u4-3-fix2/`와 ignored state report에 보존한다. — Codx

### U4-3 fix-1 — astra F1~F9 수리·계약 확정 (Codx)

**실행 게이트·범위** — `PROJECT_RULES.md`·`AGENTS.md`, fix dispatch, astra 원보고서와 재현 산출물, 제품 결정문, PDF finish 정본·원 지시서·관련 기각 이력을 읽었다. 기준은 `s3-pdf-finish` `HEAD=c8bff1fd1ab64f89afb7240778e0a373c953d1a3`, `main=origin/main=5bc6854175331bdd73b267784d9633cdccda8446`로 일치했고 추적 변경과 열린 계획 충돌은 없었다. 사용자 미추적 DOCX 2개·네이버 확인 HTML·`newui/`는 열거나 stage하지 않았고 main 병합·push·배포도 하지 않았다. 계획서 편집 금지와 F9의 정본 반영 요구는, Claude가 확정한 fix dispatch를 결정 정본으로 삼고 아래에 정본 반영 문안을 기록하되 `docs/jobs/todo/pdf-finish-20260905.md` 자체는 바꾸지 않는 것으로 함께 지켰다.

**F1~F4 수리** — F1은 시작 번호·시작 페이지와 글자 크기·여백을 입력 중 문자열로 보존한다. 특히 시작 페이지가 빈 값·`0`·`-1`·`1.5`이면 유효 lower bound를 만들지 않아 selection·thumbnail 순수 함수 호출을 막고, 파일·폼을 유지한 채 해당 ko/en 필드 오류와 실행 비활성만 적용한다. 정상값 복귀도 같은 화면에서 성공한다. F2는 업로드 오류를 파일 조건부 영역 밖에 두고 R2/R6 암호·권한 제한 4종을 “보호되어 편집 불가”, 손상 파일을 읽기 실패 안내로 분리했으며 재업로드와 원시 예외 치환 경계를 유지했다. F3은 가운데 위치를 `left:50%`로 고치고 helper의 inline 높이를 반응형으로 초기화한 뒤, 원본 종횡비의 실제 canvas wrapper 안에 overlay를 넣었다. 모바일 portrait/landscape×6영역×ko/en×light/dark **48/48**에서 종횡비 오차 ≤0.002, canvas wrapper 일치, overlay 내부 포함, 가운데 오차 ≤1px였다. F4는 CropBox와 MediaBox의 교집합을 표시 영역으로 쓰고 빈 교집합은 MediaBox로 되돌린다. 네 회전 viewport unit과 경계 밖 CropBox를 단위·브라우저 출력에 고정했고 PDF.js·Poppler 모두 장식 픽셀과 upright 텍스트를 검출했다.

**F5~F8 수리** — F5의 `analyzeDocument`는 token 치환→전처리→font coverage→layout의 한 계획을 preflight와 실제 draw가 함께 사용한다. 제어 문자·잘못된 날짜 형식·누락 glyph는 scalar 기준 행·열을 붙여 필드에 표시하고 생성 전 차단한다. 너무 좁은 영역·무효 여백은 페이지를 붙여 구별하며, 알 수 없는 토큰·가로 말줄임·세로 생략·전체 글꼴 임베드는 생성 전에 경고한다. ko/en 전체 글꼴 문안에는 실측 근거인 **약 3.8MB 증가**를 명시했다. F6은 file load 전후, font fetch/coverage/embed 전후, 반복 양보 뒤, save 전후, 등록 전에 abort를 재검사한다. 반환 배열 형식은 유지하고, 완료 결과가 있는 취소 rejection만 `PdfFinishCanceledError.partialResults`로 공개하는 명시적 부분 결과 계약을 추가했다. astra 동일 반례는 부분 결과 **1**, 두 번째 파일 read **0**이며 U4-8 다중 업로드 UI·ZIP은 앞당기지 않았다. F7은 신규 문서 helper가 `PDFDocument.create()` 기본 metadata를 그대로 보존하고 선택적 create options만 전달하게 했다. 기존 문서 load의 `updateMetadata:false`는 그대로다. 고정 시각 QR subset/full은 각각 **661,064B / 3,911,538B**, main과 byte·SHA·Info/Producer/Creator/날짜가 동일하고 Poppler 2쪽 SHA도 동일했다. F8은 다섯 navigation 항목에 148px 실제 최소 폭을 주고 viewport 821px 강제 5열 전환을 제거했으며 overflow가 있으면 fade를 계속 보인다. 영어 821px 실측은 client **523px** / scroll **764px**, 다섯 링크 모두 client=scroll **148px**로 레이블 잘림·겹침이 없다.

**F9 확정 계약·정본 반영 문안** — 번호 탭 초기값은 `{page} / {pages}`·아래 가운데, 머리말/바닥글 탭은 `{filename} · {date}`·위 가운데이고 두 탭 공통 10pt·24pt·`#34343a`다. `opacity=0.9`는 미리보기뿐 아니라 실제 PDF draw의 출력 계약이다. 출력명은 정리한 원본 basename에 ko `-마무리.pdf`, en `-finished.pdf`를 붙이며, 이미 붙은 두 접미사를 제거하고 반복 `.pdf`를 한 번으로 정리한다. 빈 basename fallback은 ko `Worklazy-PDF-마무리.pdf`, en `Worklazy-PDF-finished.pdf`다. 이 값은 locale message catalog와 engine 기대값에 함께 고정했다. 입력 범위 6~72pt와 0~144pt는 layout 안전성과 기존 UI 조작 범위를 보존하는 검증 한계이며 조용히 clamp하지 않고 필드 오류를 낸다. 템플릿 300자는 즉시 preflight·미리보기 갱신 비용과 좁은 표시 영역의 과도한 입력을 제한하는 UI 한계다. native `maxLength=300`, 보이는 글자 수 counter와 초과 입력 시 ko/en 안내를 함께 제공해 조용한 잘림으로 보이지 않게 했다. 이 문단이 편집 금지된 기존 계획서에 반영할 확정 문안이다.

**기록·재현 정정** — 최초 U4-3 구현 때 지정됐던 `/tmp/worklazy-u4-3/REPORT.md`와 logs는 astra 검수 시 존재하지 않아 원실행 이력을 검증할 수 없었다. 이번 fix는 `/tmp/worklazy-u4-3-fix1/REPORT.md`와 `logs/` 원문을 남기고 ignored state report에도 복사한다. 앞선 기록의 selector “전체 0”은 문자 그대로는 부정확하다. 위 U4-3 표의 문서 인용 한 건만 존재하며 실행 경로 `src tests scripts`에는 **0건**이라는 것이 정확한 범위다. astra 검수 스크립트와 산출물은 수정하지 않았고, QR·engine·focused-browser는 원본 복사본에 import/output/base URL만 바꾼 별도 드라이버로 실행해 diff를 함께 보존했다.

**시각 기준선·실패 보존** — UI 수리 뒤 finish 두 탭 16장과 navigation 12장, F8이 보이는 기존 PDF 모바일 2장, 합계 **30장**만 생성기로 갱신했다. 기존 convert/pdf-to-image interaction의 실행시간 표기만 달라져 갱신됐던 2장은 제품 변화가 아니므로 HEAD 이미지로 되돌렸다. 첫 전체 시각 실행은 새 최소 폭 영향이 남은 기존 모바일 기준선 2장 때문에 201/203(0.3050%·0.3889%)이었고, diff가 navigation에만 있음을 육안 확인한 뒤 두 장을 갱신했다. 최종은 ko **203/203, 7분 32.11초**, en **203/203, 7분 24.11초**다.

| 검증 | 최종 결과 |
|---|---|
| `npx tsc -b` · `npm run test:unit` | 진단 0; **301/301**, fail·skip 0 |
| production build · static | **2,845 modules**, 정적 **67페이지**, startup recovery **113**, 통과 |
| finish smoke · astra engine probe | 12 직접 진입, F1/F2/F5/F6 반례, 48 preview, 4회전 boundary 출력 통과; geometry **24/24**, 부분 결과 1·next read 0 |
| PDF scope browser · 전체 browser | 기존 PDF 4모드와 Excel·Word·shared UI 통과 |
| new-tools · utilities · office | HWP·Image·Audio·Video, ko/en 유틸리티, Office 통과 |
| QR bulk · font render · 고정 시각 비교 | 4 font scenario/취소/404 통과; 3 fixture changed pixels 0; subset/full byte·Poppler 동일 |
| recovery · legacy oracle | **147 cases**; client 3·structure 4·render 32·output 4·input 1, 총 diff 0 |
| Excel Cleaner · Compare | 취소/재실행·보고서·모바일 포함 통과 |
| 두 `LANG` 전체 visual | 각각 **203/203**, 위 시간으로 통과 |
| local-QA build · a11y · rendering | 정적 67; 11페이지 axe 위반 0; 6대상×3회, 외부 요청 0, CLS max **0.0116485** < 0.1 |
| bundle · CSS · legacy · registry | 5종 상한 통과; orphan 0; 155 rules/153 removed/0 split/2 active; 도구 20 불변 |

번들 순증분은 entry **4,837B**, affected PDF route **13,753B**, shared **2,066B**, app **21,109B**, CSS **118B**로 다섯 고정 상한 안이며 override `{}`·multiplier 1이다. QR→shared 이동 **509,380B**는 순증분과 분리했다. 반복된 PDF.js `standardFontDataUrl`과 Poppler OTF font-type 경고, new-tools의 Dolby Vision host capability skip은 기존 환경 경고이며 각각 텍스트·픽셀 oracle과 결정적 capability/fallback 검증은 통과했다. 복구 스위트는 병행 포트 규칙을 재현할 수 있도록 optional `RECOVERY_TEST_PORT`를 받아 지정 포트에 정확히 bind하도록 하네스만 보강했다. — Codx

### U4-3(F1) PDF 페이지 번호·머리말/꼬리말 — 브랜치 구현·검증 (Codx)

**착수 게이트·범위** — `PROJECT_RULES.md` 전문과 `AGENTS.md`, 지정 dispatch, PDF finish 정본의 route/preset/navigation·토큰/선택·clock·폰트·실행 realm/취소·미리보기/썸네일·H5/H6 게이트 및 U4-0~2 기록·기각 이력을 확인했다. 시작점은 `s3-pdf-finish`의 `HEAD=446a1e35ba60ebc308a32a13f8b675a02b095365`, `main=5bc6854175331bdd73b267784d9633cdccda8446`였고 열린 계획서와 충돌은 없었다. 착수 시 사용자 미추적 `after.docx`·`before.docx`·네이버 확인 HTML을 보존했다. 검증 중 새로 나타난 사용자 소유 `newui/`도 열거나 stage하지 않았다. main 병합·push·배포는 수행하지 않는다.

**route·SEO·정적 표면** — finish는 기존 PDF 도구의 다섯 번째 navigation이며 organize 뒤에 놓인다. navigation 항목은 위치가 아니라 `data-pdf-nav-mode`로 식별하고 320·390px에서 active 항목이 보이도록 자동 스크롤한다. 세 직접 경로는 하나의 lazy panel과 두 구현 탭을 공유하며 탭 변경은 URL을 바꾸지 않는다. `PdfFinishTab`은 후속 단계용 `watermark`·`stamp`까지 타입에 보존하되 F1 화면은 번호·머리말/꼬리말만 노출한다.

| 직접 경로 | 최초 탭 | canonical | ko/en SEO·FAQ | sitemap·정적·소셜 |
|---|---|---|---|---|
| `/tools/pdf-editor/finish` | 페이지 번호 | `/finish` | 등록 | 등록 |
| `/tools/pdf-editor/page-numbers` | 페이지 번호 | `/finish` | 등록 | 등록 |
| `/tools/pdf-editor/header-footer` | 머리말/꼬리말 | `/finish` | 등록 | 등록 |

빌드는 crawlable 정적 페이지 **67개**, startup recovery 문서 **113개**를 만들었고 3경로×2언어 소셜 PNG **6장**은 생성기로 만들었다. `docs/PUBLISHING_CHECKLIST.md`의 sitemap·canonical·Open Graph·FAQ 동반 갱신 항목과 대조했으며 체크리스트 자체의 정책 문안 변경은 필요하지 않았다. finish는 격리 경로가 아니므로 AppShell의 일반 광고 loader 조건을 그대로 상속한다. 전체 unit의 repo-wide 실행 파일 광고 문자열 최소 허용목록과 production utility 양성 대조가 통과했고 격리 경계 코드는 바꾸지 않았다.

**화면·엔진 계약** — 한 PDF 업로드 뒤 두 탭에서 공통 템플릿, 6영역, 글자 크기·색·여백, 시작 번호·시작 쪽·표지 제외, 범위·홀짝을 편집한다. 범위와 썸네일 체크는 U4-1의 물리 페이지 exact set을 양방향으로 공유하고 하한 밖 페이지는 비활성화한다. 우측 PDF.js canvas 위에는 첫 선택 페이지의 텍스트 오버레이와 근사 안내를 표시하며, 이 미리보기는 최종 임베드 글꼴·정확 줄바꿈의 렌더 oracle이 아니다. 실제 출력은 별도 엔진의 U4-1 text layout과 geometry를 사용한다.

엔진은 메인 스레드에서 파일을 concurrency 1로 처리한다. 배치 시작 시 clock을 한 번 캡처하고 `{page}`·`{pages}`·`{filename}`·locale `{date}`·허용 date format을 단일 pass로 확장한 뒤 전처리/coverage와 다중 줄 overflow를 판정한다. ASCII/Latin-1 범위는 Helvetica, 그 밖은 고정 전체 Noto OTF **4,644,748B / SHA-256 `69975a0a…8d68`**를 배치당 한 번 fetch·size/hash 검증하고 문서당 한 번 `subset:false`로 임베드한다. 회전 0/90/180/270, 비영점 CropBox와 UserUnit을 PDF.js transform 동형으로 역변환해 6영역 anchor에 upright 텍스트를 그린다. 보호 문서는 행동 중심 ko/en 오류로 수렴하고 알 수 없는 파서 예외는 일반 읽기 오류로 치환한다.

공용 `pdfFontEmbed` 청크는 PDF finish와 QR Studio가 함께 소유하며 document 생성·표준/커스텀 폰트 임베드만 담당한다. QR은 기존 subset/full 선택과 폰트 fallback을 유지한다. 각 파일 load 전후, 폰트 fetch/검증 전후, 페이지 반복마다 `yieldToEventLoop` 뒤, save 전후와 결과 등록 전 `yieldBeforeResultRegistration`에서 abort를 재검사한다. 동기 `pdf-lib` 호출 한가운데 즉시 중단은 보장하지 않는다는 안내를 ko/en에 명시했고 취소 결과는 stale download로 등록하지 않는다.

**하네스·실측** — 전용 스모크는 3경로×2언어×desktop/mobile **12 직접 진입**, 실제 `PdfFinishPanel` 청크 404 1회 주입 뒤 문서 요청 정확히 2회(자동 reload 1회)와 guard 정리, SPA organize→finish와 탭 URL 불변, 320/390/820/821px navigation, 필드/빈 선택 차단, 범위↔썸네일, 회전+CropBox 출력, PDF.js·Poppler 텍스트, 취소 뒤 stale 결과 0·재시도를 검증한다. 캡처는 `/tmp/worklazy-u4-3/shots/`에 12장 있다. 신규 시각 상태는 두 탭 full profile **16장**과 navigation 시작/활성/끝×ko/en×390/320 **12장**, 합계 **28장**이다. 다섯 탭으로 폭이 바뀐 기존 PDF 기준선은 생성기로 갱신했다.

첫 전체 시각 실행은 신규 28장은 통과했으나 의도된 다섯 탭 변화 때문에 기존 PDF 빈 화면 4장이 0.1710~0.2807% 차이로 실패했다. diff가 navigation에만 있음을 확인하고 `VISUAL_ONLY=pdf-editor-empty UPDATE_VISUAL_BASELINES=1` 생성기를 쓴 뒤 전체 **203/203**을 재통과했다. 최종 지시 로케일별 재검증도 `ko_KR.UTF-8` **203/203, 7분 25.69초**, `en_US.UTF-8` **203/203, 7분 17.76초**다. 접근성은 11페이지 위반 **0**이며 finish ko desktop/mobile/en의 axe pass가 각각 **42/44/42**다. rendering은 6대상×3회·외부 요청 0, 기존 3대상 CLS 0, 세 finish 경로 최대 CLS가 모두 **0.0001480365514755249**로 상한 0.1을 통과했다. 신규 등록 과정에서 실행 기본 상한을 0으로 잘못 낮춘 첫 측정은 이 미세 shift를 차단했다. 단위 계약은 계속 0.1이었으므로 실행값을 정본대로 복구한 뒤 재측정해 통과했다.

| 번들 지표(gzip) | U4-0 대비 순증분 | 고정 상한 | 판정 |
|---|---:|---:|---|
| entry JS | +4,211B | +20,480B | 통과 |
| affected PDF route JS | +11,509B | +61,440B | 통과 |
| shared JS | +2,081B | +30,720B | 통과 |
| app JS | +18,274B | +81,920B | 통과 |
| CSS | +82B | +10,240B | 통과 |

override·배수 변경은 0이다. 공용화로 QR route에서 shared로 옮겨간 **509,380B**는 모듈 귀속 이동으로 분리됐으며 순증분에 넣지 않았다. production 청크는 `PdfFinishPanel` **26.78kB / gzip 10.00kB**, `pdfFontEmbed` **1,149.25kB / gzip 509.31kB**, QR PDF adapter **1.78kB / gzip 0.93kB**로 분리됐다. 원보고서는 `/tmp/worklazy-u4-3/bundle-u4-3.json`이다.

| 검증 | 최종 결과 |
|---|---|
| `npx tsc -b` · `npm run test:unit` | 진단 0; **297/297**, fail·skip 0 |
| 4GiB `npm run build` · `npm run test:static` | 2,844 modules·정적 67페이지; startup 113, 통과 |
| `npm run test:pdf-finish` | 12 진입+실제 청크 404/1회 reload+출력+취소/재시도 통과 |
| `TEST_SCOPE=pdf npm run test:browser` · 전체 browser | 기존 PDF 4모드 / Excel·Word·PDF·shared UI 통과 |
| new-tools · utilities · office | HWP·Image·Audio·Video 및 ko/en 유틸리티·Office 통과 |
| QR bulk · QR font render | 4 폰트 시나리오·취소·404 통과; 3 fixture Poppler changed pixels **0**, PDF.js text 동일 |
| recovery · legacy oracle | **147 cases**; client 3·structure 4·render 32·output 4·input 1, 총 diff **0** |
| Excel Cleaner · Compare | 취소/재실행·보고서·모바일 포함 통과 |
| 두 `LANG` 전체 visual | 각각 **203/203**, 위 시간으로 통과 |
| local-QA build · a11y · rendering | 정적 67; 11페이지 위반 0; finish CLS max 0.000148, 외부 요청 0 |
| bundle · CSS · legacy · registry | 5종 상한 통과; orphan 0; 155 rules/153 removed/0 split/2 active; 도구 **20** 불변 |
| selector·광역 금지·공백 | `.pdf-tool-navigation a:nth-child` 0; 광고 allowlist 통과; `git diff --check` 통과 |

반복 경고는 제품 실패와 구분한다. Node PDF.js의 `standardFontDataUrl` 경고 2회와 QR Poppler의 기존 OTF font-type 경고가 있었지만 finish 텍스트 oracle과 QR 3 fixture 픽셀/PDF.js oracle은 통과했다. new-tools의 Dolby Vision base-layer는 이 Chrome에 호환 경로가 없어 기존 계약대로 skip했고 결정적 capability unit·fallback 안내는 통과했다.

**광역 비노출 검사** — 실행 가능 확장자의 저장소 전체 재귀 검색으로 raw exception 후보와 광고 문자열을 확인했다. 이번 runtime diff에서 새 `.message` 참조의 최소 허용목록은 정확히 둘이다: `PdfFinishPanel.tsx`는 세 개의 message-catalog 현지화 문자열과 일치할 때만 표시하고 나머지는 일반 오류로 치환하며, `finish/engine.ts`는 암호/권한 오류 분류 정규식에만 쓰고 cause를 화면에 넘기지 않는다. 내부 오류 code·fontkit/pdf-lib/AbortError 명칭은 사용자 문구에 없다. 광고 문자열은 전체 unit의 고정 repo-wide allowlist와 일치했다.

**범위 밖 발견** — 정본은 F1의 초기 템플릿·초기 위치·글자 크기·여백·색, 미리보기 불투명도, 결과 파일 접미사를 지정하지 않았다. 동작 가능한 form을 위해 현행 구현은 비계약 UI 초기값으로 번호 `{page} / {pages}`·아래 가운데, 머리말 `{filename} · {date}`·위 가운데, 10pt·24pt·`#34343a`, 미리보기 0.9, `-finished.pdf`를 사용한다. 이 값들은 후속 정본 결정으로 확정된 정책이라고 간주하지 않으며 Claude 판정 대상이다. F2 워터마크·F3 도장·F4 정리/래스터·다중 결과 ZIP은 명시 제외대로 구현하지 않았다. — Codx

### U4-2 fix-1 — terminal 확정 오류 불변 (Codx)

**F1 원인·수리** — astra의 같은-turn 반례 4개를 수용했다. 공용 `runModuleWorker`는 terminal을 한 번만 수락했지만 PDF facade가 그 guard 밖의 `envelopeError`를 무조건 갱신해 promise rejection handler가 실행되기 전 늦은 error의 `LATE/LATE_CODE`를 읽을 수 있었다. PDF 소유 adapter의 `terminate()`가 자체 종료 상태를 원 Worker 종료보다 먼저 확정하고 원 `message`/`error` callback을 해제하며, 이후 callback은 외부 상태 갱신과 lifecycle 전달을 모두 거부하도록 고쳤다. 최초 수락한 PDF error envelope는 message/code 값만 복사해 고정하므로 abort와 시작 실패는 다른 envelope로 새 Error가 되지 않는다. 공용 `src/utils/workerLifecycle.ts`, Excel 두 기능, 기존 4모드 UI·문구는 바꾸지 않았다.

**회귀 경계** — unit에 다음 같은-turn 반례 4개를 각각 추가해 최초 오류의 name·message·code, terminate 1회, abort listener 0을 단언했다: `abort → late error`, `error → late error`, `error event → late error`, `postMessage throw → late error`. 기존 `result → late error`를 보존했고, 다음 task에서 늦은 error가 오는 abort 대조군도 추가했다. 전용 unit은 기존 17개에서 **22/22**, 전체 unit은 기존 289개에서 **294/294**다. astra 원본 `/tmp/worklazy-u4-2-review/probes/lifecycle.mjs`는 수정하지 않고 고정 `current` 사본의 제품 source만 현행 워킹트리로 갱신해 실행했으며 **49 PASS/0 FAIL**이었다. E3의 11개 lifecycle 검사 중 timeout 1개는 facade가 timeout 인자를 공개해서가 아니라 변경하지 않은 **공용 helper**를 직접 검사한 것이다.

**생성물·번들 문안 정정** — U4-2 검수에서 current와 main/previous의 production SHA가 달랐던 파일 158개 중 156개는 PDF preload가 기존 `workerLifecycle` 청크를 새로 참조하면서 자산명이 정적 페이지까지 전파된 참조 해시 변경이었다. 나머지는 PDF 본체와 entry preload이며, 이를 “PDF 청크 외 SHA 동일”로 확대하지 않는다. fix-1의 47c0f22 대비 5종 변화는 entry **−18B**, PDF route **+46B**, shared **−17B**, app **+7B**, CSS **0B**다. main 기준 delta는 각각 **0B/+804B/+20B/+874B/0B**로 고정 상한 안이다.

| 검증 | 실제 결과 |
|---|---|
| `npx tsc -b` | exit 0, 진단 0 |
| `npm run test:unit` | **294/294**, fail·skip 0 |
| astra 원본 `probes/lifecycle.mjs` | **49/49**, 네 terminal 반례와 다음-task 대조군 PASS |
| 4GiB 직렬 `npm run build` · `npm run test:static` | 2,837 modules·정적 61페이지; startup recovery 104, 모두 exit 0 |
| `TEST_SCOPE=pdf npm run test:browser` | 기존 PDF edit/range split/conversion 통과 |
| `npm run test:excel-cleaner` · `npm run test:excel-compare` | cancellation/re-run 및 cancellation 포함 모두 통과 |
| `npm run fixtures:pdf-legacy-oracle` | client 3·structure 4·render 32·output 4·input 1, **총 diff 0** |
| `npm run bundle:measure` | 5종 전부 한도 내 |
| 금지 표면·공백 | 공용 helper·Excel diff 0; `git diff --check` exit 0 |

첫 전용 unit의 다음-task 대조군은 rejection 관찰을 타이머 뒤에 붙여 Node의 unhandled-rejection 감시에 1회 실패했고, 관찰을 즉시 등록하도록 테스트 순서만 바로잡은 뒤 22/22를 얻었다. 첫 PDF 브라우저 스모크도 preview 미기동으로 `ERR_CONNECTION_REFUSED`였으며 production preview를 명시적으로 띄운 같은 명령은 통과했다. 두 실패 원로그와 최종 로그, bundle JSON, legacy oracle은 `/tmp/worklazy-u4-2-fix1/`에 함께 보존한다. UI·번역·SEO·정적 페이지 내용·광고 격리 경로에는 변경이 없다. — Codx

### U4-2(F0b) PDF worker lifecycle facade·협력적 취소 — 브랜치 구현·검증 (Codx)

**착수 게이트·범위** — 첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 `AGENTS.md`, 지정 dispatch, PDF finish 정본의 확정 2·3·16·19와 D5·V3-4, round 3·5·6 증거 및 U4-0/U4-1 기록을 확인했다. 시작점은 `s3-pdf-finish`의 `HEAD=f56dc68d4c53d58cad520fe41973cd2699a4f548`, `main=5bc6854175331bdd73b267784d9633cdccda8446`였고 열린 계획서와 이번 표면의 충돌은 없었다. 로드맵 끝의 `브랜치 최종 3672fc7/main 5485fad` 문장은 바로 앞 U4-1 기록·실제 ref·최신 dispatch와 모순되는 낡은 문구라 이번 기준으로 쓰지 않았다. 사용자 미추적 `after.docx`·`before.docx`·네이버 확인 HTML은 건드리지 않았고 main 병합·push·배포도 하지 않는다.

**facade 계약** — `pdfWorkerLifecycle.ts`가 공용 `runModuleWorker`를 직접 소비하고 PDF 고유 envelope만 adapter 하나에서 변환한다. progress의 `message`는 공용 `phase`, 중첩 `error.message/code`는 공용 flat error로 넘긴 뒤 기존 `resolveFeatureMessage` 현지화와 result `warnings` 현지화를 PDF 소유 경계에서 복원한다. request·transfer 배열과 각 transferable의 identity는 복제하지 않으며 terminal은 공용 helper가 한 번만 수락하고 worker도 한 번만 종료한다. 생성·post·error-event 실패는 ko/en의 안전한 시작 오류로 수렴해 원시 예외를 사용자 메시지에 노출하지 않는다. `pdfWorkerClient.ts`의 PDF worker와 PDF Office worker 호출을 모두 facade로 이관했고 아래 공개 함수의 `signal`은 마지막 optional 인자다. 기존 호출자는 수정하지 않았으므로 미전달 4모드의 요청·출력·progress·warnings·오류 code·transfer 계약은 그대로다.

| 호출 | signal 위치 | 추가 취소 경계 |
|---|---|---|
| `mergePdfPages`·`exportPdfGroups` | output options 뒤 마지막 | 각 source `arrayBuffer()` 전후, watermark 직전·직후, worker lifecycle |
| `imagesToPdf` | output options 뒤 마지막 | 각 normalize/read 전후와 파일 loop 사이, watermark, worker lifecycle |
| `textDocumentToOffice`·`combineOcrPdfPages` | language 뒤 마지막 | worker lifecycle |
| `pdfToImageArchive`·`renderPdfPageAsJpeg` | 기존 인자 뒤 마지막 | load/getPage/render/blob·페이지 loop와 결과 등록 직전 |

**협력적 취소·PDF.js 소유권** — 정본의 위치 기본값에 따라 `src/utils/cooperativeCancel.ts`에 `setTimeout(0)` task 양보, abort 검사, 결과 등록 전 양보 후 재검사를 두었다. 같은 12단계·단계당 약 3ms 반례에서 `await Promise.resolve()`는 타이머 abort를 받지 못해 **12/12 완료·aborted false**, task 양보는 첫 단계 뒤 abort를 받아 **1/12 완료·aborted true**였다. 이는 동기 단위 한가운데의 즉시 중단을 보장하지 않고 명시 검사점 사이에서만 협력적으로 멈춘다. 결과 등록 시험은 이전 결과만 남기고 새 결과를 등록하지 않음을 단언한다.

`pdfRenderLifecycle.ts`는 abort 시 `renderTask.cancel()` → `renderTask.promise` rejection 정착 → `page.cleanup()` → 소유 문서일 때만 `loadingTask.destroy()` 순서를 고정한다. `RenderingCancelledException`만 취소 정착으로 삼고 예상 밖 오류는 cleanup/destroy 뒤 다시 던진다. unit의 소유 문서 로그는 정확히 `cancel, settled, cleanup, destroy`, 공유 preview 문서는 `cancel, settled, cleanup`이며 destroy가 없었다. 현재 preview는 공유 문서만 사용하므로 ownership을 주장하지 않는다.

**legacy·Excel 불변 증명** — U4-0 baseline을 덮어쓰는 대신 현재 source를 `/tmp`에 별도 재채취하는 driver를 추가했다. baseline capture 원본의 기본 동작·단언은 유지하고, 별도 output/current-source 환경은 `/tmp` 하위만 허용한다. 기존 unit의 “현재 client blob이 main과 동일” 단언은 필수 facade 이관과 양립할 수 없어 baseline manifest의 client·worker SHA가 실제 main blob과 일치함을 직접 검증하고, 현재 client 동작은 아래 byte oracle 비교가 맡도록 경계를 바로잡았다.

| 불변 표면 | 실제 결과 |
|---|---|
| legacy client oracle | 3파일, diff **0** |
| legacy structure oracle | 4파일, diff **0** |
| legacy render oracle | 32파일, diff **0** |
| legacy output/input oracle | 4파일/1파일, diff **0**; 총 diff **0** |
| PDF 4모드 | `TEST_SCOPE=pdf npm run test:browser` 통과; 전체 browser의 Word·Excel·PDF와 shared UI도 통과 |
| Excel 회귀 | cleaner의 취소·재실행·입력 불변, compare의 취소·보고서·모바일 모두 통과 |
| 금지 파일 | `workerLifecycle.ts`·두 Excel client diff 0; blob SHA는 각각 `a6406c8…`, `48ccc95…`, `ae130ad…`로 착수 시와 동일 |

**unit·번들·제품 영향** — facade V3-4는 ko/en 성공·progress·warning·result/transfer identity 2건, ko/en 중첩 error 현지화·code 2건, pre-abort, abort 뒤 늦은 result, timeout, post 예외, 중복 terminal, error event, 생성 예외의 **11개 lifecycle 시나리오**를 고정했다. file read 전/후, task 양보 반례, 결과 등록, PDF.js 소유/공유/AbortSignal을 더해 전용 파일은 **17/17**, 전체 unit은 **289/289**다. 테스트가 extensionless transitive TS import를 native strip만으로 해석하지 못한 것은 U4-1에 이미 기록된 Node 실행 경계이므로 제품 import나 검수 probe를 바꾸지 않고 테스트 전용 esbuild bundle로 실제 facade/client를 로드했다. 새 의존성은 없다.

U4-0 production baseline 대비 `pdf-editor` 선택 route의 번들 5종은 entry **+18B**(20,480B 한도), affected route **+758B**(61,440B), shared **+37B**(30,720B), app **+867B**(81,920B), CSS **0B**(10,240B)로 모두 통과했다. UI·route·기존 ko/en 문구·SEO·정적 페이지·광고 배치/격리 경로는 바꾸지 않았고 취소 버튼도 추가하지 않았다. signal 미전달 화면의 변화가 없으므로 전체 시각 회귀 대신 지시된 rendering 3페이지를 사용했다.

**완료 기준 검증** — 아래 명령을 실제 실행했다. 첫 production rendering은 CLS가 모두 0이었지만 production에 의도된 분석 요청 126건 때문에 외부 요청 게이트가 exit 1이었다. `VITE_LOCAL_QA=1` 직렬 빌드 후 같은 검사를 다시 실행해 3페이지×3회, 외부 요청 0, home/document-compare/pdf-editor CLS 모두 0으로 통과했다. 이는 제품 회귀가 아니라 추적 없는 QA 렌더링의 요구 환경 차이다.

QA 뒤 production `dist` 복원 시 앞서 통과한 것과 같은 4GiB 명령을 두 번 더 실행했으나, host 가용 3.1~3.4GiB·swap 4GiB 소진 상태에서 transform/chunk rendering 중 OS가 각각 exit 137로 종료했다. `--optimize-for-size`를 `NODE_OPTIONS`에 넣는 시도는 Node가 허용하지 않아 빌드 시작 전 exit 9였다. 완료 기준의 4GiB production 성공을 이 실패로 대체하지 않고, 복원만 `GOMAXPROCS=1 NODE_OPTIONS=--max-old-space-size=3072 npm run build`로 실행해 2,837 modules·정적 61페이지를 통과시켰다. 복원 `dist`의 번들 보고 대상 **81파일 SHA가 앞서 성공한 production bundle 측정과 81/81 동일**했고 static startup recovery 104도 다시 통과했다.

| 명령 | 실제 결과 |
|---|---|
| `npx tsc -b --pretty false` | exit 0, 진단 0 |
| `npm run test:unit` | **289/289**, 실패·skip 0 |
| `npm run fixtures:pdf-legacy-oracle` | client 3·structure 4·render 32·output 4·input 1, 총 diff **0** |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | production 2,837 modules·정적 61페이지 통과 |
| 최종 production 복원 build / 번들 SHA 대조 | 3GiB·esbuild 병렬도 1로 통과; production 측정 81파일과 mismatch 0 |
| `npm run test:static` | 정적 61페이지·startup recovery 104 통과 |
| `TEST_SCOPE=pdf npm run test:browser` / 전체 `test:browser` | PDF 4모드 / Excel·Word·PDF·shared UI 통과 |
| `npm run test:excel-cleaner` / `npm run test:excel-compare` | 양쪽 모두 취소 경로 포함 통과 |
| `npm run test:new-tools` | HWP·Image·Audio·Video 통과 |
| QA `npm run test:rendering` | 3×3, 외부 요청 0, CLS max 0 |
| `npm run bundle:measure` | U4-0 baseline 대비 5종 한도 내 통과 |
| `npm run css:orphans` | 212 class tokens, zero-reference selector arm 0 |
| `git diff --check` | 공백 오류 0 |

**범위 밖 발견** — 정본이 허용한 기본 위치에 공용 취소 helper를 둔 결정, 필수 client refactor와 충돌하던 legacy fixture test의 책임 분리, test-only TS resolver 우회는 위에 근거와 함께 기록했다. stale 로드맵 ref 외에 새 정책 판단이나 미해결 범위 밖 제품 결함은 없었다. 명령·oracle·bundle·rendering 산출은 `/tmp/worklazy-u4-2/`와 `/tmp/worklazytools-rendering-baseline.json`에 보존한다. — Codx

### U4-1(F0a) PDF finish 순수 정책 모듈 — 브랜치 구현·검증 (Codx)

**착수 게이트·범위** — 첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 `AGENTS.md`, 지정 dispatch, PDF finish 정본의 확정 1·7·8·9·10·12·18·21·22·24 및 D2·D3·D7·D8·N1·N2·N3, round probe 원자료와 U4-0 기록을 확인했다. 시작점은 `s3-pdf-finish`의 `HEAD=5ee9b1a4af1e5611cee8f86ba3f177801225dc97`, `main=5bc6854175331bdd73b267784d9633cdccda8446`였고 열린 계획서와 같은 표면의 충돌은 없었다. 사용자 미추적 `after.docx`·`before.docx`·네이버 확인 HTML은 건드리지 않았다. 제품 변경은 `src/features/pdf-editor/finish/**`의 순수 TypeScript에 한정하고, U4-0 test helper는 그 제품 preflight를 import하는 단일 경계로 바꿨다. React·UI·route·locale·registry·worker·기존 4모드·pdf-lib 그리기 호출은 변경하지 않았으며 main 병합·push·배포도 하지 않는다.

**astra fix-1 착수 게이트** — 검수 기준 `s3-pdf-finish` `HEAD=fd37ceab057ced2941fb752b2511124dbeaafda4`, `main=origin/main=5bc6854175331bdd73b267784d9633cdccda8446`와 dispatch가 일치했고 추적 변경은 없었다. 로드맵 진행 기록 끝의 `브랜치 최종 3672fc7/main 5485fad` 문장은 바로 앞 U4-1 진행 기록·실제 ref·최신 사용자 지시와 모순되는 낡은 문구라 최신 fix dispatch의 기준으로 대체했다. 열린 계획서에서 같은 finish 순수 모듈 표면의 상반 지시는 없었고 사용자 미추적 3파일을 계속 제외했다. UI·route·ko/en 문구·SEO·정적 페이지·광고 배치/격리 경로 영향은 없으며 test 실행 스크립트 한 줄만 명시 범위로 수정했다.

**astra fix-2 착수 게이트** — 재검수 기준 `s3-pdf-finish` `HEAD=ba762b4b1cf38b13bef3013aa465e59e33eb9146`와 dispatch가 정확히 일치했다. 열린 계획서는 이번 unit·기록 보강과 충돌하지 않았고 기존 사용자 미추적 3파일을 계속 보존했다. 재검수 `/tmp/worklazy-u4-1-review2/`의 `REPORT.md`·`UNIT-MAPPING.md`·7개 변이와 독립 probe를 대조해, 정상 제품 계산이 아니라 커밋된 회귀 단언만 보강했다. 변경은 `tests/unit/pdf-finish-modules.test.ts`와 이 기록뿐이며 `src/`·UI·route·ko/en·SEO·정적 페이지·광고 경로·의존성 영향은 0이다.

| 모듈 | export 계약·정본 대응 | 고정한 핵심 골든 |
|---|---|---|
| `geometry.ts` | PDF.js viewport transform 역변환, 상/하×좌/중/우 앵커, upright 회전; E5·확정 21 | 비영점 CropBox의 회전 4종과 실제 PDF.js 혼합 visual 크기 4쪽에서 여백 포함 중앙 앵커까지 24좌표 리터럴 |
| `selection.ts` | 파일별 물리 exact set, range parse/canonical, parity, 하한·anchor·표시 번호·토글; 확정 7·9·24, D2, N1 | `2-8 + even`에서 3쪽 토글 → `{2,3,4,6,8}`·`2-4,6,8`; startPage 4+표지 제외에서 2·3쪽 disabled·`[4,6,8]`·disabled 토글 객체 동일; 표지 제외 빈 set 실행 불가 |
| `tokens.ts` | 1회 clock/locale 캡처, 단일 pass 토큰 치환, date whitelist parser; 확정 7·10·24, N3 v8 | date 허용 5·오류 4·보충 14 전수, ko/en 로컬 날짜, 치환된 파일명 속 토큰 재해석 0, unknown 리터럴+경고 |
| `text.ts` | 토큰→개행→TAB→제어문자→LF 분리, 후보 전체 glyph coverage, 문서당 단일 폰트, scalar 위치, 6영역 overflow; 확정 1·21, D8, N3 | E6-2 전처리·coverage 10입력 전수, `H:Русский→H:ASCII→N` 호출 순서, 6영역 두 줄 x/y·14.4pt 간격, `80A/B/C`의 50×10 0줄+두 경고와 50×28.8 두 run text/width/y 리터럴 |
| `tiles.ts` | gap·offset·rotation 배치와 생성 전 불변 400 상한; N3 | 공개 `maximumTiles` 타입 키 0, 400 생성 400회, 420과 완화 시도 모두 생성 0회, gap 1은 361회; 20×20에서 offset 5/5·rotation 30의 네 좌표 리터럴 |
| `canvasPolicy.ts` | A의 ceil·면적·RGBA·4096 한 변/면적 검사와 300→200→150 하향, B 지표만 산출, 계수 주입 경고, 200MiB 등록 전 검사; 확정 18, D3 v6~v9 | 실제 PDF.js rotation/UserUnit 12행, 요청 300의 attempts `[300,200,150]`·applied 150, 100×100의 독립 maxArea 초과, 4096² 허용·4096.01 한 변 거부; 동시 raw ledger 1,200B/2장 peak |
| `stamp.ts` | CSS 상대 좌표→viewport→주입 `convertToPdfPoint`, `{cx,cy,rw,aspect}`, 균등 축소 후 중심 clamp; 확정 8·22, D7, N2 | 실제 legacy PDF.js fixture에서 DPR 1/2×CSS 1/0.5×회전 4의 독립 16조합과 리터럴 좌표 4개, 혼합 크기·clamp; (10,20,30,40) 주입 변환의 네 PDF corner 좌표 |
| `plan.ts` | 부작용 없는 1-based 복합 실행 계획; 확정 12 | 구조/양식→background→원문→foreground→번호·머리말→도장→raster |
| `preflight.ts` | U4-0 OCG classifier의 제품 단일 구현과 내부 사유 코드; D4 v13·U4-0 fixture | helper는 정적 re-export 한 줄, native strip에서 제품 export identity, OCG 87종 허용 56·제외 31과 두 renderer SHA 56 |

**검증 출처 정합** — 세 실행을 구분한다. 원구현 `fd37ceab`의 `/tmp/worklazy-u4-1/unit.log`는 **271/271, finish 12/12**이며 같은 경로에 원출력이 있다. fix-1 `ba762b4b`는 `/tmp/worklazy-u4-1-fix1/REPORT.md`에 **272/272, finish 13/13**으로 보고됐지만 그 디렉터리에는 `REPORT.md`·`bundle.json`만 있어 당시 unit 원로그는 보존됐다고 주장하지 않는다. 대신 astra가 같은 `ba762b4b` 사본을 `/tmp/worklazy-u4-1-review2/unit.log`에서 **272/272, finish 13/13**으로 독립 재현했다. 이번 fix-2는 아래 명령의 cwd·환경·exit를 `/tmp/worklazy-u4-1-fix2/commands.json`, 원출력을 `/tmp/worklazy-u4-1-fix2/logs/`, 변이별 unit/probe를 `/tmp/worklazy-u4-1-fix2/mutants/`에 보존했다.

| 명령 | 실제 결과 |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=4096 TMPDIR=/tmp/worklazy-u4-1-fix2/tmp npx tsc -b --pretty false` | exit 0, 진단 0 |
| 같은 환경의 `npm run test:unit` | exit 0, 전체 **272/272**, finish **13/13**, 실패·skip 0 |
| `python3 /tmp/worklazy-u4-1-fix2/mutation-audit.py` | wrapper exit 0; 7변이 각각 unit **exit 1, 12 pass/1 fail**, 정상/변이 독립 probe는 각각 exit 0/1 |
| `git diff --stat ba762b4b1cf38b13bef3013aa465e59e33eb9146` · `git diff --name-only … -- src` · `git diff --check` | 변경은 unit·이 기록 2파일뿐, `src/` diff 0, 공백 오류 0 |

제품 코드 diff가 0인 회귀 단언·기록 전용 수정이므로 build·bundle·oracle·브라우저 스모크는 생략했다. fix-1 제품 코드에 대한 해당 검증 결과는 위 astra 재검수 `/tmp/worklazy-u4-1-review2/`에 보존돼 있으며, 이번 변경은 그 실행 결과를 제품 검증으로 재귀속하지 않는다.

**astra F1~F5 판정·fix-1** — F1 공개 `maximumTiles`는 정본에 없는 상한 완화 정책이었으므로 “정본 미정의 정책 없음”이라는 앞선 문구를 철회하고 입력 타입·런타임 경로에서 제거했다. F2는 ellipsis 유효 폭 계산 직후 줄 길이와 무관하게 영역 폭을 검사한다. F3은 raw ledger entry를 “한 시점의 동시 생존 자원 목록”으로 고정하고 각 자원의 pixels·RGBA bytes·장수를 합산한 시점 합계의 최대만 peak로 삼는다. 문서 누적 pixels/raw bytes는 작업량 지표이며 peak나 차단 판정에 쓰지 않는다. F4는 전용 `register` loader를 제거해 helper를 정적 re-export 한 줄로 만들고 package script에서 native strip을 소유하게 했다. F5는 `UNIT-MAPPING.md` 누락 중 실제 PDF.js fixture·전처리 표·ledger·타일 생성 계측 등을 보강했으나, 재검수 변이 7종이 당시 13/13을 통과해 회귀 단언 전체 보강이라는 기록은 철회한다.

**astra F5-R·fix-2** — 150DPI 성공 거부·maxArea 무시·startPage disabled 무시·비영점 타일 offset 무시·text y=0·stamp corner=0·Noto coverage 조기 호출의 7개 한 식 변이를 각각 실패시키는 독립 리터럴 단언을 추가했다. 조정한 mutation audit는 입력 `head`를 고정 검수 사본에서 현재 워킹트리로 바꾸고, 과거 “7개 생존(exit 0)” 기대를 “7개 모두 unit exit 비영(0 아님)”으로 뒤집었으며 제품 변경 식과 독립 probe는 그대로 유지했다. 7개 모두 12 pass/1 fail이어서 F5-R을 해소했고 정상 unit은 13/13이다.

감사 명령 `node --experimental-strip-types /tmp/worklazy-u4-1-review/defects.mjs`는 스크립트가 현재 저장소가 아니라 자체 고정 사본 `/tmp/worklazy-u4-1-review/head`(`fd37cea`)을 import하므로 수정 뒤에도 옛 결함 4개와 `REPRODUCED`를 그대로 출력했다. 감사 사본을 훼손하지 않고 현재 워킹트리를 직접 import한 동치 probe를 별도로 실행해 420 입력 생성 0회·고정 상한 400, 긴/짧은/빈 줄 `narrow-region`, raw ledger `1,200B/2장`, helper/product export identity를 모두 확인했다. 원 loader를 손수 parser로 보는 우려는 Node 공식 API였다는 astra 기각을 유지하되, transitive `.ts` 의존을 놓치는 구성 결함 때문에 제거했다. 이 수정에서 새 정본 미정의 정책·UI 연결·실행 엔진은 추가하지 않았다. fix-1의 요약은 `/tmp/worklazy-u4-1-fix1/REPORT.md`, fix-2의 명령 원출력과 변이 결과는 `/tmp/worklazy-u4-1-fix2/`에 보존한다. — Codx

### U4-0(F-fix) PDF finish fixture·oracle·번들 귀속 — 브랜치 구현·검증 (Codx)

**착수 게이트·범위** — `PROJECT_RULES.md`를 첫 행동으로 전문 확인한 뒤 디스패치, `AGENTS.md`, 정본 `docs/jobs/todo/pdf-finish-20260905.md`의 「정본화」 우선순위, 로드맵 C-A~C-D·결정 11, 관련 기각 이력을 읽었다. 시작점은 `HEAD=main=origin/main=5bc6854175331bdd73b267784d9633cdccda8446`, 추적 변경 0이었다. 열린 계획서와 충돌이 없고 사용자 미추적 `after.docx`·`before.docx`·네이버 확인 HTML 3개가 있음을 확인한 뒤 `s3-pdf-finish`를 새로 분기했다. 제품 `src/`·UI·문구·번역·SEO·광고 경로는 바꾸지 않았고 main 병합·push·배포는 하지 않는다.

**번들 모듈 귀속 schema v2** — 측정 전용 Vite 플러그인이 main 청크의 `chunk.modules[id].code`를 수집해 각 모듈의 독립 rendered gzip을 가중치로 삼는다. 청크 실제 gzip `G_c`를 `floor(G_c×w_i/Σw)`로 먼저 배분하고, 남은 1B는 나머지 내림차순·canonical id의 로케일 비의존 코드포인트 순으로 주어 `Σ contribution=G_c`를 보장한다. canonical id는 `main`/worker realm, `<node_modules>` 패키지 경로, virtual NUL prefix, query를 보존한다. 이전 기여는 같은 category 잔존분부터 대응하고 나머지는 `min(previousRemaining,currentNeed)`만 이동으로 1회 대응한다. category net은 `gross-movedIn+movedOut`, 모든 category net 합은 실제 app delta다. shared·app은 net, entry·선택 route·CSS는 gross로 게이트한다. 전체 JS inventory와 realm을 보고서에 따로 보존하고 main 58청크는 전부 modules metadata·중복 없음·양의 가중치를 요구한다. worker 21개와 public 1개만 각각 후속 worker 계측·Rollup main graph 부재를 근거로 SHA opaque를 허용한다. 구 schema, inventory 부재, main metadata 빈 배열·부분 누락은 SHA 폴백 없이 양쪽 보고서에서 오류다. 기존 5종 상한·multiplier·override는 바꾸지 않았다.

| 지표 | main production baseline | 최종 측정 | delta | 고정 상한 |
|---|---:|---:|---:|---:|
| entry JS gzip | 299,287B | 299,287B | 0B | +20,480B |
| 선택 PDF route JS gzip | 171,864B | 171,864B | 0B | +61,440B |
| shared JS gzip(net gate) | 2,716,473B | 2,716,473B | 0B | +30,720B |
| app JS gzip(net gate) | 5,466,587B | 5,466,587B | 0B | +81,920B |
| CSS gzip | 37,687B | 37,687B | 0B | +10,240B |

기준선은 같은 제품 `src`에서 inventory를 포함해 재생성한 `/tmp/s3-bundle-baseline.json`, 최종 보고는 `/tmp/worklazy-u4-0-fix1/bundle-current.json`이다. 둘 다 `schemaVersion=2`, `moduleAttributionSchema=independent-rendered-gzip-largest-remainder-v1-main-opaque-workers`, module chunk 58개·module record 1,012개·inventory main 58/worker 21/public 1이다. 기준 production `dist`의 포함 JS 80개·CSS 1개는 분기 전 main 산출물과 파일별 SHA가 전부 같았다. 최종 movement는 빈 배열, 모든 category gross/net과 app net은 0이다. unit은 이동만 있는 합성 입력의 shared net 0, 5개 상한 각각 limit 통과/+1B 실패, 구 schema와 main metadata 빈/부분 누락 양쪽 거부, en-US/sv-SE 동률 배분 동일을 단언한다.

**결정적 fixture 생성기** — `scripts/generate-pdf-finish-fixtures.mjs`는 외부 패키지를 import하지 않고 Node `crypto`·`fs`·`path`·`url`·`zlib`만 사용한다. R2/RC4와 AES-256/R6는 고정 test key/salt로 직접 생성하고, raw PDF writer로 손상 3종·Contents 4종·위험 3종·제거 검증 1종·일반 Properties 2종을 만든다. exact-SHA가 계약인 OCG 87종은 r10~r12 원본을 SHA 대조해 만든 압축 snapshot seed에서 전개하며 전개 때 다시 검증한다. 두 독립 출력의 PDF 104개+manifest 1개 SHA 목록은 동일했고 그 목록 파일 SHA는 `ab261326…a207`이다. unit은 두 생성 결과와 tracked tree를 파일별로 대조한다. 전체 104개 fixture의 이름·SHA·기대값 정본은 `tests/fixtures/pdf-finish/manifest.json`, fixture 104행+legacy 7행 보고용 전개표는 `/tmp/worklazy-u4-0-fix1/fixture-table.json`(111행, SHA `73fb78da…58fb`)이다.

| 암호 fixture | bytes · SHA-256 | 무암호/빈값 | 오답 | 정답·owner / permissions | finish 기대 |
|---|---|---|---|---|---|
| R2 open `/P=-4` | 897 · `c2c0980b…441425` | PasswordException 1 | 2 | OPEN / `[4,8,16,32,256,512,1024,2048]` | `permissions !== null`, 거부 |
| R2 restricted `/P=-64` | 898 · `fab73fc6…d92b9` | OPEN | 2 | OPEN / `[256,512,1024,2048]` | 거부 |
| R6 open `/P=-4` | 1,361 · `df27b107…25b56` | PasswordException 1 | 2 | OPEN / `[4,8,16,32,256,512,1024,2048]` | 거부 |
| R6 restricted `/P=-3904` | 1,380 · `774e4b10…b694` | OPEN | 2 | OPEN / `[]` | 빈 배열도 거부 |

| fixture 묶음 | 수·SHA/대표 | 기대 oracle |
|---|---|---|
| 손상 | truncated `4599115b…d12c`; xref-all-9 `223e9297…6f7`; malformed Contents `aecaaedf…ac3` | 각각 InvalidPDFException; OPEN 1쪽 recovery; OPEN 1쪽 + `Unknown command` 경고 |
| 배경 stream | empty `4ead6f4d…f034`; single `39f68ee0…b13`; multiple `6a1ddd28…eb3f`; non-stream `a044d620…ffad` | 빈 배열 0 stream; 단일 ref 1; ref 배열 2; 비stream ref 0, 모두 PDF.js open |
| 위험 | q/Q `35e86b59…fd30`; tagged `27d2a6ae…2730`; active action `fbde441c…642` | q 2/Q 1; MarkInfo+StructTreeRoot; OpenAction+Names.JavaScript+Launch |
| 제거 검증 | 1종 5,202B `85ee6887…3136` | 첨부 sentinel·XMP, form/Widget, Outlines, Names(Dests·EmbeddedFiles·JavaScript), 구식 Dests, PageLabels, ViewerPreferences, URI/direct/named Link와 15개 subtype·Popup/IRT 관계 존재 |
| 일반 Properties | named 585B `44d5d5c0…7097`; Resources 없음 420B `c7eae473…a529` | `/Span /TextInfo BDC`와 빈 페이지 모두 비-OC로 허용; 두 렌더러 SHA 각각 `04ce6cfb…101b`·`cdbf6c08…e33a` |
| OCG | 허용 4·제외 31·직접 배열 32·대표 20 = 87 | exact input SHA; 전부 v13 preflight 기대, 허용 56개만 두 렌더러 픽셀 oracle |

OCG 허용 4종은 `on=35cda479…83d90`, `xobject-off=06d11215…689a`, `xobject-on=9f495db7…1ed3`, `balanced-state=1b518232…cde9`다. 직접 배열은 위치 2(marked-content/form-xobject) × 정책 4 × 2그룹 상태 4 = 32, 대표는 duplicate/inheritance/image/indirect-name/escaped-name 축 20종이다. round 11 탐색 72개와 round 12 탐색 50개 축도 manifest에 보존했다. 제외 31개는 파일명/SHA allowlist가 아닌 OCProperties·OCMD 원시 문법, OFF block 상태, 금지 객체 경로, 도달 가능한 Type3 객체 그래프를 검사하는 test preflight로 전수 판정했으며 실제 허용 56/제외 31·불일치 0이다.

**D4 재구축 보존/지원 제외표를 fixture 입력으로 고정** — 이번 단계는 제품 재구축을 구현하지 않고 다음 표를 fixture 구조·manifest 기대값으로 고정했다.

| 구조 | 정본 결정·fixture 검증점 |
|---|---|
| 페이지 트리·Contents·Resources·Media/Crop/Rotate | 보존; background 4종과 legacy 회전/CropBox 입력 |
| Outlines·Names/Dests·구식 Dests·PageLabels·ViewerPreferences | 새 page ref로 보존; removal fixture에 모두 존재 |
| Info+XMP Metadata | 제거 선택 시 둘 다 제거, 미선택 보존; Info/XMP sentinel 포함 |
| AcroForm·Widget | 미선택 보존, 제거/flatten 배타; form·Widget AP 포함, XFA·서명·AP 없음은 후속 지원 제외 |
| EmbeddedFiles·EmbeddedFile·Filespec·AF·FileAttachment | 제거 선택 시 복사 전 필터, payload sentinel 부재까지 검사; fixture에는 catalog AF와 attachment가 있고 두 page에는 AF가 없음 |
| Link URI·직접 Dest·이름 Dest | 보존·새 page map; 세 종류 모두 포함 |
| Text·FreeText·Highlight·Ink·Stamp·Square/Circle·Line·Polygon·Caret·Popup·Redact 등 | 주석 제거 시 subtype별 제거, Popup/IRT/Parent 정리; 임의 annotation flatten은 지원하지 않음 |
| OCProperties/OCG/OCMD | preflight 허용 OCG만 기본 표시를 고정해 구조 제거; 제외 OCG는 구조 제거 옵션을 비활성화하되 장식/raster는 허용 |
| StructTreeRoot/ParentTree/MarkInfo | tagged 정보 제거는 OCG 지원 판정과 분리해 별도 손실 고지; tagged fixture로 고정 |
| Sound/Movie/Screen/RichMedia/3D·알 수 없는 subtype·기타 Names | unsupported 사전 표시 후 제거; 조용한 삭제 금지 |
| 최종 raster | 픽셀 보존 범위와 검색/태그/양식/링크 손실 명시, Link 재부착 없음 |

**legacy-organize 3종 oracle** — exact main의 `pdfWorkerClient.ts`와 `pdf.worker.ts`가 기준 commit의 blob과 byte-identical임을 먼저 단언하고 `tests/fixtures/pdf-finish/legacy-oracle/`에 채취했다. 입력은 회전 0/90/180/270, 비영점 CropBox, 600×800/800×600 혼합 크기 4쪽이다. none/numbers/watermark/both 각 2회에서 output byte·PDF 구조가 같고 Poppler/PDF.js 각 16페이지의 2회 changed pixel은 모두 0이다. 출력은 각각 1,729B `f95081d4…61ff`, 2,766B `ebc4d35a…b4be`, 7,590B `6c671eb4…9507`, 7,990B `2089693b…024f`이며 r3 산출물과도 네 파일 모두 byte-identical이다. client PNG는 short 420×92 `480f0f9e…5c65`, wide 1800×92 `741931f9…d17`, surrogate 1800×92 `ed37b7e2…da1f`이고 r3와 동일하다. alpha 0.82(최대 209), UTF-16 120단위 slice를 실제 browser Canvas 호출로 기록했다.

환경은 Linux 7.0.0-30-generic x64, Node 22.17.1, Chrome 152.0.7977.64, Poppler 24.02.0, pdf-lib 1.17.1, PDF.js 6.2.108, `system-ui=Noto Sans (/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf)`다. Poppler legacy baseline은 기본 150DPI에 `-scale-to 650`, PDF.js는 scale 1, 두 렌더 모두 흰 배경·unpremultiplied RGBA SHA-256이다.

**두 렌더러 oracle·검증** — `npm run test:pdf-finish-oracle`은 먼저 OCG 87종 preflight와 허용 56종 57쪽의 원본 snapshot을 Poppler 72DPI·Chrome PDF.js scale 1로 각각 검증한다. 이어 허용 56개에만 12차 test 변환기를 실행해 각 renderer 안에서 원본=변환 결과 width/height/RGBA SHA 56/56, deep OC residual 0을 단언하고 제외 31개는 변환 시도 0을 단언한다. `on.pdf`의 변환 결과 Contents만 비운 음성 대조는 두 renderer 모두 차이를 검출했다. 일반 Properties·Resources 없음 2종도 비-OC 허용과 두 renderer SHA 동일을 확인한다. 같은 실행이 암호 20개 시나리오, 손상 기대표, Contents/위험 open, 제거 fixture의 catalog/attachment/outline/page label/annotation을 실제 API로 확인하며 외부 요청은 0이다.

최초 U4-0 실행은 production `npm run build`, `npm run test:static`, 명시 `npx tsc -b`, 전체 unit **255/255**, schema v2 `npm run bundle:measure` 5종 PASS, tool registry **20**, CSS orphan **0**, legacy owner **155(153 removed·0 split·2 active)**, `TEST_SCOPE=pdf npm run test:browser`, fixture 독립 생성 2회, PDF finish 원본 oracle, QA build 뒤 rendering **3페이지×3회·CLS max 0·외부 요청 0**, `git diff --check`를 통과했다. 첫 browser 실행은 5173 서버 미기동으로 connection refused, dev 서버 첫 재실행은 Vite dependency optimize hot reload 뒤 convert 결과 대기 180초 timeout이었다. 이미 최적화된 동일 서버 재실행은 15.6초에 통과했다. 첫 rendering은 production 분석/광고 요청 126건을 검출했고 요구된 QA build로 재실행해 0건으로 통과했다. QA build 뒤 static은 분석 설정 부재를 감지했고 production build 복원 뒤 startup recovery 104개를 포함해 통과했다. 이 세 건은 제품 회귀 판정으로 세지 않는다.

astra F1~F5 수정 후에는 `npx tsc -b`, 전체 unit **259/259**, fixture 2회 결정성, 확장 PDF oracle, schema v2 기준/현재 직렬 측정 5종 delta 0, 4차 E6 `shared +80B/app +13,264B`, production build, static startup recovery 104, 477입력 분류 불변, `src/` diff 0, `git diff --check`를 다시 통과했다. 수정 전/후 probe·원출력·JSON은 `/tmp/worklazy-u4-0-fix1/`에 보존한다. — Codx
## 2026-09-08

### Excel 중복키·머리글 S4 — 최종 통합 회귀 (Codx)

**게이트·범위** — `/tmp/worklazy-xd`, `excel-dupkey-20260907`, 시작 HEAD `657dec8bb6b7479ee93e54708544aef7b559ebc1`과 clean 상태, S0 bundle 기준 SHA-256 `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`를 확인했다. 대상에는 ignored `docs/jobs/todo`가 없어서 S0/S3가 보존한 19개 열린 계획서 스캔과 v3 정본 사본을 사용했고 상반 지시는 0건이었다. 실행 규칙 로드 외에는 원 워킹트리를 조사하지 않았고 `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`은 읽지 않았으며, 포트는 4350~4351 strict, 빌드·브라우저는 heap 4GiB·직렬로 실행했다. 새 기능, main 병합·push·배포, BL01~BL05 수리는 범위에 넣지 않았다.

**통합 결함·시각 판정** — QA 전체 시각 회귀 첫 실행은 **178/183**이었다. 실패 5장은 S3에서 홈/전체 도구의 Excel 카드 설명·태그를 머리글 후보·그룹 중복키 의미로 바꾼 뒤 공용 desktop 기준선을 갱신하지 않은 통합 누락이었다. 실제/기준/diff를 직접 열어 문구만 의도대로 바뀌고 정렬·토글·잘림 파손이 없음을 확인한 뒤 아래 5장만 첫 실행 actual로 갱신했다: `home-default__initial__{ko,en}__{light,dark}__desktop.png` 4장, `hwp-editor-empty__redirect-en-tools__en__dark__desktop.png` 1장. 전체를 다시 실행해 **183/183** 재일치했고 Excel 중복 결과 ko/en × desktop/mobile × light/dark 8상태도 모두 포함됐다. 기준선 reset·허용치 변경·결함 화면 승인은 없었다.

**전체 회귀와 스모크 경계 정정** — S4에서 타입 진단 0, unit **396/396**, production/QA build 각 2,836 modules·정적 61페이지, production static 104문서, browser 전체, Excel 비교·Cleaner, QR bulk, new-tools, utilities, office, recovery **147사례**, CSS orphan 0, registry 20도구, diff check 명령이 종료 코드 0이었다. 다만 `npm run test:new-tools`의 종료 코드 0은 모든 내부 세부 경로가 실행됐다는 뜻이 아니다. 그 로그 80행은 이 Chrome 호스트가 호환 경로를 제공하지 않아 **Dolby Vision base-layer 실제 streaming을 건너뛰었다**고 명시한다. 해당 실행에서 fallback 결과 안내와 deterministic capability unit은 통과했지만, 실제 base-layer streaming 및 이어지는 target-encode 경로는 실행하지 않았다. 이는 기존 기능·호스트 제약의 경계이며 이 단계에서 영상 기능을 수리하거나 미실행 경로를 통과로 바꾸지 않는다.

**정본 회귀 5군의 명령·단언 연결** — ① 중복 엔진은 S4의 `npm run test:unit`·`npm run test:excel-compare`가 2:1·2:0·0:2·1:1, 빈 키·정규화·복합키·복수 쌍·그룹 순서를 확인했고, fix-1의 `node --experimental-strip-types /tmp/worklazy-xd-s4-fix1/probes/shape-23.mjs`가 빠졌던 실제 CSV **2:3**을 중복 1그룹·좌 행 `[2,3]`·우 행 `[2,3,4]` 및 좌우 전체 값 보존으로 보완했다. ② 결과 화면은 S4의 `npm run test:excel-compare`가 초기 500/총 501그룹, 접힌 DOM 0, 마지막 값·원본 행번호 검색, 좌 50→100과 우 독립 전개, 0건 버튼 0, dialog·Escape 초점 반환을 단언했다. ③ 보고서는 S4의 `npm run test:unit`·`npm run test:excel-compare` 및 사용자 XML probe가 16,000/16,001·32,767/32,768·LF/CRLF·surrogate 분할, 9시트·13열·Summary/Parameters·주입 문자열, 직접 2+ZIP 2 재개방과 유한 폭 12~48을 확인했다. ④ 감지는 S4 `npm run test:unit`이 원형 23 및 6형식×23=138 기대표와 controller의 `finish(old)=false`·`cancelAll`·pre-abort를 확인했지만 실제 브라우저 완료 역전·unmount는 아니었다. fix-1의 `node /tmp/worklazy-xd-s4-fix1/probes/header-lifecycle-browser.mjs`가 오래된 5행 완료 뒤에도 새 6행과 busy를 유지하고 새 완료 뒤에만 busy를 해제하며, 보류 응답 상태에서 `/en/tools`로 unmount한 뒤 worker 종료 4→5·늦은 응답 무효·오류 0을 실제 브라우저에서 확인했다. ⑤ 결과 상태는 S4 `npm run test:visual`과 `A11Y_MAX_TOTAL=0 npm run test:a11y`가 ko/en×desktop/mobile×light/dark 8개 실제 중복 결과 상태를 포함해 visual 183/183·자동 violation 0을 냈고 빈 상태로 대체하지 않았다.

**실행 주체 분리** — S3의 astra 독립 검수도 과거에 `node ../probes/header-browser.mjs`로 완료 역전·stale finally·unmount 단언까지 도달했으나 뒤의 캡처 오류 때문에 명령 전체는 exit 1이었고, S4 astra 검수자가 사본을 `env -u HEADER_PHASE node /tmp/worklazy-xd-s4-review/lifecycle/probes/header-browser.mjs`로 보충 실행해 exit 0을 얻었다. 둘은 **검수자 실행**이며 S4 작성자의 실행으로 소급하지 않는다. 원 S4 작성자 실행은 `env HEADER_PHASE=user node /tmp/worklazy-xd-s4/probes/header-browser.mjs`여서 구조화 출력이 `profiles=0`, `races=0`, `user=2`였고 완료 역전·unmount를 건너뛰었다. 위 fix-1 두 명령만 이번 Codx 보완 실행이며 원출력·구조화 결과는 `/tmp/worklazy-xd-s4-fix1/evidence/`에 보존했다.

**사용자 파일** — `/tmp/worklazy-userfiles/`의 읽기 전용 사본만 사용했다. 수동 1행/B는 중복 **1그룹**, matched/changed/added **713/37/48**. 두 파일 자동 후보는 모두 **4행**이고 4행/B는 **0그룹·703/37/48**, 4행/A는 **6그룹·486/134/31**이다. 표시 키 1~6은 각각 왼쪽 2행·오른쪽 2행 배열이며 첫 그룹은 좌 `[5,73]`, 우 `[5,79]`; 화면에서 좌2→우2를 독립 전개해 DOM 4항목을 확인했다. ko/en 다운로드는 각 9시트, Duplicates 13열, 전체 폭 **12~48**, ZIP 안 XML/rels 각 **18개**가 ElementTree로 재개방됐다. 사용자명 포함 캡처와 보고서는 `/tmp/worklazy-xd-s4/evidence/private/`에만 보존하고 저장소에 넣지 않았다.

**접근성 분리 정정** — `A11Y_MAX_TOTAL=0` 전체 16페이지는 자동 위반 0·외부 요청 0이지만, axe `incomplete` **1,274노드**(color-contrast 1,271·aria-prohibited-attr 3)는 자동 통과로 세지 않았다. 이 가운데 안정 selector `[data-testid=excel-duplicate-row] .max-w-56`인 모바일 ko/en×light/dark **4노드**와 `[data-testid=excel-duplicate-toggle][data-side=right] span`인 dark 모바일 ko/en **2노드**는 공용 화면 상속이 아니라 S1~S3가 만든 새 결과 노드다. 원 S4의 6종×8프로필 48측정은 왼쪽 toggle과 대표 원본행 항목 중심이어서 이 6노드를 덮지 못했다. astra 검수자의 보충 측정은 위 두 안정 selector를 ko/en×desktop/mobile×light/dark **8프로필에서 각각 측정한 16개 값**이며 모두 기준을 넘고 최저가 **12.799508:1**이므로 두 새 노드 종류는 해결로 판정한다. 이 보충값은 검수자 실행 증거이며 Codx 측정으로 소급하지 않는다. 나머지 incomplete **1,268노드**는 공용 shell·도구 카드·기존 표/guide/footer·모바일 탭과 기존 ARIA 보류로 분리해 UI 재설계 계획 소유의 공용 부채로 유지하며 공용 UI를 수리하지 않는다. BL01·BL02·BL03·BL05는 낮은 우선순위(P3), 감지 정확도에 직접 영향을 주는 BL04는 기존 높은 우선순위와 `spreadsheet-core` 귀속·실제 오류 타입 보존 방침을 유지한다.

**제품 규칙·번들·보존** — ko/en features·guide/FAQ·tools·SEO/static 입력의 동시 변경을 unit/static/route 검사로 재확인했고 URL·canonical·hreflang·사이트맵 집합, 광고 예외, 서버 전제, 의존성은 바뀌지 않았다. 실행 확장자 전역 광고 참조의 명시적 allowlist unit을 포함해 396/396이 통과했고 화면 스모크의 내부 identity/reason/error 노출 배열은 0이다. Parameters 계약명은 XLSX metadata에만 남는다. S0 대비 gzip 증분은 entry **+2,242B**, affected routes **+4,008B**, shared **+1,766B**, app 전체 **+8,016B**, CSS **+146B**로 5종 예산을 모두 통과했으며 override·multiplier 변경은 없다.

**규칙 19 차이** — `VITE_LOCAL_QA=1` 빌드에서 결과 화면을 직접 열고 183장 전체 캡처, 사용자 ko/en 결과·머리글 16상태 캡처를 `/tmp/worklazy-xd-s4/evidence/`에 보존했다. 정본은 Gemini 직접 검수를 요구하지만 이번 S4 지시가 이를 Codex 실측+캡처 보존 및 Claude 확인으로 대체했으므로 Gemini가 직접 화면을 본 것으로 기록하지 않는다. 최초 상세 보고 `/tmp/worklazy-xd-s4/REPORT.md`의 위 과장·귀속 오류는 fix-1 보고 `/tmp/worklazy-xd-s4-fix1/REPORT.md`가 정정하며, 누락 실행 원출력도 같은 fix-1 산출물에 둔다. — Codx

### Excel 중복키 S3 — 보수적 머리글 후보·수동 우선 상태 (Codx)

**착수 게이트·범위** — 지정 worktree `/tmp/worklazy-xd`, 브랜치 `excel-dupkey-20260907`, 시작 HEAD `bdd09a7d6bc10da74db8fd3b2b8565da9c3f054e`와 clean 상태를 확인했다. 대상에는 열린 `docs/jobs/todo` 계획서가 없어 S0에 보존된 19개 열린 계획서 스캔과 같은 기준의 S2 최종 검수 통과 문서를 교차해 충돌 없음으로 판정했다. 명시적으로 접근 금지된 원 워킹트리는 live 재스캔하지 않았다. 이번 단계는 S3 머리글 감지와 그 화면·하네스만 포함하며 S1 그룹 엔진·보고서와 S2 결과 소비 의미를 바꾸지 않았다. main 병합·push·배포와 S4 통합 검증은 수행하지 않았다.

**감지 판정** — 공용 어댑터의 raw cell type·formula·error·merge 정보로 각 시트의 물리 1~20행만 후보로 보고 아래 최대 5행, 즉 25행까지만 지지도를 읽는다. 값은 null이 아니고 trim 뒤 비어 있지 않은 셀만 센다. 가로 병합 행은 건너뛰고, 세로 병합이 아닌 한 셀 제목 행은 다음 5행에 두 셀 이상 행이 있을 때만 건너뛴다. 그 뒤 처음 만난 행 하나만 `2셀 이상`, 비수식·비오류 문자열 비율 `>=1/2`, trim 값 중복 없음, 후보 열의 40% 이상을 채운 아래 행 2개 이상, 세로 병합 없음으로 판정하며 하나라도 어기면 뒤 행을 찾지 않고 `uncertain`으로 멈춘다. 후보가 없을 때만 `none`이다. `suggested`만 정수 행을 가지며 나머지는 null이다.

고정 원형 22패턴은 **suggested 12·uncertain 8·none 2**이고, 제안 12건 가운데 필터·설명·요약·머리글 없는 전부 텍스트·세 단계 비세로 병합의 **의미상 오탐 5건**을 성공으로 세탁하지 않고 fixture에 표시했다. 세로 병합 접두 사례를 23번째로 추가해 첫 한 셀 행에서 즉시 `uncertain`이 되는 것을 고정했다. XLSX·XLSM·BIFF8 XLS·XLSB·SpreadsheetML·CSV의 명시적 기대표 **138조합**을 실제 직렬화→각 형식 파서→감지로 통과했다. CSV는 병합 정보 소실과 숫자 문자열화 때문에 merged-title, numeric-header-after-title, dense-numeric-header, three-level-no-vertical, vertical-prefix의 정확히 5건이 원형과 다르다. 다단 머리글 합성, 20행 밖 탐색, 단일 열 의미 판별, 숫자 머리글 확인, 머리글 없음 모드는 지원 범위에서 제외하고 0행 모드는 만들지 않았다.

**초기 검사·상태 소유권** — 첫 inspect 응답이 모든 시트의 `headerSuggestion`과 요청 행∪제안 행의 열 이름을 함께 반환해 제안 행만을 위한 두 번째 parse/worker 왕복을 없앴다. 수동 행은 캐시에 있으면 재검사하지 않고, 없을 때만 `detectHeader:false`의 전체 parse 한 번으로 해당 행 열 이름을 병합한다. 파일·시트별 `{row, source=suggested|manual|fallback}`을 두 측에 독립 보관해 시트 전환은 수동→제안→1행 순으로 복원하고 수동 선택을 항상 우선한다. 파일 교체는 이전 선택·상태 안내를 지우며 좌우 교환은 파일, 검사 결과, 시트, 행 입력, 선택 source, 열 연결과 대사 열까지 함께 바꾼다.

검사 요청은 pair+side별 AbortController와 단조 token, File identity를 함께 소유한다. 새 파일·파일 제거·쌍 제거·unmount는 현재 요청을 terminate하고, 완료·오류·finally는 네 소유 조건이 모두 현재일 때만 상태를 갱신한다. pre-abort는 `arrayBuffer`와 worker 생성을 모두 막고, 읽기 직후 abort도 worker 생성을 막는다. 수동 미캐시 검사 중에는 compare와 swap이 비활성화되며 stale finally가 새 busy를 지우지 않는다. 단위시험은 양측 독립 취소·cancelPair·cancelAll과 stale finish 거부를, Chrome 스모크는 교체 경합·쌍 삭제 후 오류 0과 worker 종료를 확인했다.

**문구·화면 판정** — `suggested`는 “머리글 후보”, `uncertain/none`은 감지 성공으로 표현하지 않는 동일 1행 fallback, 수동은 선택 행으로 구분한다. 두 언어 모두 입력에 현재 판정 안내와 영구 도움말을 `aria-describedby`로 연결했고, 비동기 최초 결과만 polite status로 한 번 추가했다. 도움말은 선택 행 다음부터 비교하며 설명·필터·요약 선행 행에서는 실제 열 이름 행을 고르고 머리글이 없으면 맨 위에 열 이름 행을 추가하라는 복구 행동을 명시한다. ko/en 기능 문구·가이드·FAQ·도구 메타와 SEO 설명·featureList·static FAQ 입력을 함께 갱신했다. URL·canonical·hreflang·사이트맵 key, 광고 경계, 서버 전제와 의존성은 바꾸지 않았다.

Chrome 스모크에서 두 XLSX는 최초 inspect 메시지 각 1개(`headerRows=[1]`, `detectHeader=true`)만 보내고 모두 4행 후보와 그 열 이름으로 준비됐다. 캐시된 수동 1행은 추가 메시지 0개, 미캐시 5행은 `headerRows=[5]`, `detectHeader=false` 한 번이며 수동 안내와 busy 상태를 유지했다. 두 번째 시트 제안 2행과 각 시트 수동 선택 복원, 좌우의 suggested/manual source 및 행 교환, 새 CSV가 이전 수동 5행을 물려받지 않고 자기 1행 제안을 쓰는 것까지 확인했다. Excel 전용 16개 시각 기준선을 ko/en·light/dark·desktop/mobile 결과 상태로 갱신하고 대표 3장을 직접 확인한 뒤 **16/16 재일치**했다. QA axe는 기본 화면과 중복 결과 8상태, 총 **9페이지 위반 0·외부 요청 0**이다. 자동 판정 보류 `incomplete`은 각 페이지 color-contrast 1건, 총 **9건**이며 통과로 세지 않았다.

**사용자 사본 재현** — `/tmp/worklazy-userfiles/`의 두 원본 사본만 읽고 저장소 fixture나 산출물로 넣지 않았다. 두 `최종` 시트 모두 `{row:4, reason:suggested}`였다. 4행/B열은 중복 그룹 0·matched 703·changed 37·added 48, 4행/A열은 중복 그룹 6·matched 486·changed 134·added 31이었다. A열 표시 키 1~6은 각각 왼쪽 두 행과 오른쪽 두 행을 한 그룹으로 보존했고 재시작 행은 왼쪽 73, 오른쪽 79였다.

**검증·후속 경계** — `./node_modules/.bin/tsc -b` 진단 0, unit **396/396**, production·`VITE_LOCAL_QA=1` build 각각 2,836 modules와 정적 61페이지, 강화 Excel 비교 스모크, Excel 전용 visual **16/16**, Excel 전용 axe **9페이지/위반 0**, `git diff --check`를 통과했다. 빌드와 브라우저 검사는 `NODE_OPTIONS=--max-old-space-size=4096` 및 `127.0.0.1:4350 --strictPort`에서 직렬 실행했다. 단계 지시대로 전체 browser, Excel Cleaner, QR bulk, production static, full a11y, bundle 측정, CSS orphan, registry는 S4로 미뤘으며 이번 S3 통과로 대신하지 않는다. 증거는 `/tmp/worklazy-xd-s3/evidence/`, 최종 보고서는 `/tmp/worklazy-xd-s3/REPORT.md`에 둔다. — Codx

### Excel 중복키 S2 fix-3 — 포인터 위치·전 폭 초점 경계 (Codx)

**R05 원인·입력 경계** — 기존 예약 보정은 결과 컨트롤이 `activeElement`인지 여부만 확인해 마우스 클릭·터치 탭으로 생긴 비가시 초점도 키보드 초점처럼 따라갔다. 151행 목록에서 50개를 더 불러오면 같은 버튼의 새 좌표를 향해 `instant` 세로 보정이 실행되어 읽던 위치가 9,725px 이동했다. 보정 예약과 각 실행 프레임에서 결과 컨트롤의 `:focus-visible`을 확인하고, 포인터·터치 이동·wheel·스크롤 키 입력이 들어오면 남은 예약을 취소하도록 입력 경계를 분리했다. 실제 mouse/touch의 펼침·50개 추가·닫힘은 모두 `ΔscrollY=0`, 제품 보정 호출 0이고, 추가 뒤 항목은 100개이며 새 첫 항목 Source row 52가 화면에 보였다. 키보드로 포커스한 경로의 `instant` 보정과 모달 Escape 초점 복귀는 유지했다.

**R06 기존 결함 귀속·축 분리** — `(max-width: 820px)` 하나로 세로·가로 보정을 함께 막아 821px에서 왼쪽 toggle의 중앙이 결과 region 밖으로 나가던 문제는 부모 `ab00de3`에서도 ko/en × light/dark의 접힘·Enter 두 상태가 같은 좌표로 **8/8 실패**했으므로 fix-2 신규 회귀가 아닌 기존 미해소 결함으로 귀속한다. 가로 보정은 viewport 폭 제한 없이 실제 결과 scroll region의 client 경계에 적용하고, resize 때 현재 가시 초점을 다시 검사한다. 세로 보정은 매직 브레이크포인트 대신 `.mobile-header`·`.bottom-tabs`가 실제 DOM에 있고 계산 스타일이 `position: fixed`이며 표시·크기·viewport 교차 조건을 만족할 때만 각 실제 rect를 경계로 쓴다. 현재 819/820/821은 폭별 4프로필×18단계가 각각 **72/72 중앙 가시**이고, 활성 초점 820→821 resize 네 프로필은 각 1회 가로 보정·window 보정 0으로 라벨과 링을 region 안에 넣었다. 821에서는 고정 header/tab이 없으므로 세로 제품 보정은 없고, 1365×900도 72/72 중앙 가시·정상 상태 제품 보정 0이며 시각 기준선은 바뀌지 않았다.

**R07 시작 모서리 우선** — 320px 결과 region의 client 폭은 260px, 4px 양쪽 여백을 뺀 사용 폭은 252px인데 펼친 왼쪽 toggle은 ko 283.984px, en 264.781px라 양쪽 경계를 동시에 만족할 수 없다. 대상 폭이 사용 폭보다 크면 LTR 시작 모서리를 한 번에 맞추도록 판정을 명시했다. ko는 가로 보정 `−42px` 1회 뒤 왼쪽 간격 4px, en은 `−22.797px` 1회 뒤 4.203px이며 반대 방향 보정은 0이다. 두 언어·두 테마 모두 중앙과 라벨·시작쪽 3px 링, 44px 높이를 유지했다. 버튼 축소·초점 표시 제거·`smooth` 전환은 사용하지 않았다.

**회귀·범위 판정** — R04 원본 표본은 이전 실패 20/20과 현재 버튼 48/48이 계속 가시이고, smooth 키보드 경로는 폭별 72/72 중앙 가시, 사용자 사본은 1행/B **1·713·37·48**, 4행/A **6·486·134·31**, 4행/B **0·703·37·48**, 최초 500행 내부 키 노출 0을 유지했다. 상태·판정 72/72 한 줄, Excel 시각 **16/16**, S1 엔진 245조합과 독립 계약 8/8도 통과했다. 변경은 Excel 결과의 초점 이동 판정과 전용 스모크뿐이며 한·영 문구, SEO·정적 URL, 광고 격리, 서버 전제, 생성물·벤더, 의존성과 데스크톱 레이아웃은 바꾸지 않았다. 마지막 더보기 페이지를 키보드로 소진해 버튼 DOM이 사라질 때 초점 목적지가 `BODY`가 되는 기존 경로는 이번 세 결함의 범위 밖으로 유지하고 후속 판정 대상으로 기록한다. — Codx

### Excel 중복키 S2 fix-2 — 모바일 키보드 초점 가시성 (Codx)

**R04 원인과 수리** — 390×844 결과 표에서 브라우저의 기본 초점 스크롤은 고정 모바일 헤더·하단 탭의 실제 경계를 알지 못했고, 가로 스크롤도 초점 버튼 일부만 영역에 들여 오른쪽 영문 라벨과 3px 초점 링을 잘랐다. Excel 결과의 펼침·추가 로드·전체 값 버튼에 모바일 전용 가시성 보정을 연결했다. 초점 시점과 펼침/추가 로드 뒤 두 프레임에 고정 헤더 `bottom`, 하단 탭 `top`, 결과 region의 실제 client 경계를 다시 읽고 4px 여백 안으로 세로·가로 스크롤한다. 전역 `scroll-behavior: smooth`가 빠른 Tab→Enter 입력의 보정을 늦추지 않도록 이 접근성 보정만 `instant`로 실행한다. 데스크톱에서는 `(max-width: 820px)` 조건에서 즉시 반환하며 초점 링·고정 탭·44px 타깃은 그대로 유지한다.

**키보드·경계 단언** — astra의 `overlap-review.mjs`를 수정하지 않고 사용자 1행/B 파일에 다시 실행했다. ko/en × light/dark 모바일 네 프로필의 현재 구현 48개 펼침·전체 값·Escape 복귀 초점 상태는 9점 hit test가 모두 **48/48** 가시였고, 직전 보고서에서 중앙이 가렸던 동일 단계 20개는 중앙과 9점 모두 **20/20**으로 바뀌었다. 한국어 전체 값 버튼은 y=724.5~768.5로 하단 탭 top=773 위에 4.5px를 남겼다. 영문 오른쪽 전체 값 버튼은 x=117.969~203.891로 region client x=30~360 안에 라벨과 링이 들어왔다. 원본 focus contract 출력은 빈 실패 배열 `[]`이다. 별도 제품 스모크는 CSS smooth scroll을 켠 채 51행 좌·우 목록의 빠른 Tab→Enter, 양측 전체 값, Escape 복귀를 검사해 각 버튼이 고정 chrome과 region에서 3px 이상 떨어지고 중앙 hit·44px 높이를 유지함을 확인했다.

**회귀·범위 판정** — 사용자 사본은 1행/B **1·713·37·48**, 4행/A **6·486·134·31**, 4행/B **0·703·37·48**을 유지했고 세 화면의 최초 렌더 내부 키 노출은 모두 0이었다. 상태·판정은 합성 ko/en desktop/mobile의 접힘·좌측·양측 전개에서 모두 1줄이며, Excel 비교 시각 기준선은 **16/16 일치**해 데스크톱과 기존 모바일 정적 배치 변화가 없다. 제품 변경은 Excel 결과의 초점 시 스크롤 동작과 전용 스모크뿐이다. 한·영 문구, SEO·정적 URL, 광고 격리, 서버 전제, 생성물·벤더, 의존성은 바꾸지 않았다. — Codx

### Excel 중복키 S2 fix-1 — 일반 키 표시 경계·결과 표 열 안정화 (Codx)

**착수 게이트·범위** — 지정 worktree와 브랜치의 시작 HEAD가 `ebba5203d2984b9ddcb8b321beaf80f4b953f2a4`이고 추적 변경이 없음을 확인했다. 대상에 ignore된 todo 계획서가 없어 S0의 계획서 목록·inventory와 동일 HEAD의 S2 검수 문서를 교차했고 충돌하는 열린 계획은 없었다. S0 번들 기준선 SHA-256은 `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`로 일치했다. S3 머리글 감지, main 병합·push·배포, 다른 worktree는 범위 밖으로 유지했다.

**R01 표시 경계** — 일반 키 레코드에도 내부 `key`와 별개의 필수 `displayKey`를 둔다. `error`·`secondary`·`occurrence` 정책 모두 실제 해당 레코드의 왼쪽 원본 행, 왼쪽이 없으면 오른쪽 원본 행에서 선택 키 열을 `cellText`로 읽어 열 순서대로 ` | `로 연결한다. 접두사 절단이나 normalized identity 역파싱은 사용하지 않는다. UI 렌더·검색과 보고서 9번째 `Key` 열은 이 공개 표시값만 소비하고 내부 `key`는 그룹 identity와 React identity에만 남긴다. 숫자 `1`과 문자열 `1`은 둘 다 `1`로 보이지만 내부 `number:1`·`string:1` 그룹과 판정은 독립이다. 필터 전·후 전 행과 내려받은 Changed 시트에서 `number:`·`string:` 노출 0, 표시 키 `1`·`2`·`Unique`를 확인했다. 사용자 파일 최초 결과에서도 기존 499/494/500개 접두사 노출은 세 경우 모두 0이 됐다.

S1 원본 `independent.mjs`와 `supplement.mjs`는 검수 산출물을 수정하지 않고 실행했다. 둘은 S1 당시 계약인 “일반 레코드에 `displayKey` 속성이 없어야 한다”와 부모 결과와의 필드 단위 완전 동일을 직접 단언하므로, 이번 R01 정본의 필수 필드 하나 때문에 각각 4/8 통과와 첫 deep-equal 실패를 기록했다. 이는 비교 판정 실패로 세탁하지 않았다. 새 필드만 제거한 의미 대조에서는 0~8행 243조합, 정규화 21조합, 다른 모드 5개, 사용자 파일 3조합의 일반 레코드·순서·요약·warnings·parameters가 S1 부모와 동일했고, 원본 S1 프로브의 분할·한도·4,096 취소·보고서 불변 항목 D/E/F/G는 그대로 통과했다.

**R02 열 배분** — 좌우 목록의 `min-w-64`가 자동 표 레이아웃에서 짧은 상태·판정 열의 폭을 잠식했고, 셀 padding을 빼면 한국어 상태 세 글자를 담지 못했다. 표 최소 폭을 1,040px로 정하고 상태 96px·판정 112px·키 128px을 비롯한 짧은 머리글/셀에 최소 폭과 `nowrap`을 적용했다. 긴 키·좌우 값은 자기 셀에서 `overflow-wrap`하고 부족한 뷰포트에서는 기존 이름 있고 키보드 초점 가능한 가로 스크롤 영역을 사용한다. 합성 fixture와 사용자 1행/B·4행/A를 접힘·왼쪽 펼침·양쪽 펼침 × ko/en × desktop/mobile × light/dark로 잰 24개 화면·72개 상태에서 상태/판정은 전부 1줄, 실제 최소 폭은 96/112/128px, 표는 1,040px, 영역은 332~987px였다. 좌우 독립 DOM, 50/50 지연 전개와 최소 44px 버튼도 유지됐다.

**R03 시각 기준선** — 수리 전 전체 16개 실행은 결함 화면을 포함한 중복 결과 8장과 FAQ 추가로 아래 내용 위치가 바뀐 기존 bottom 2장만 실패했고, 무관한 6장은 일치했다. 수리 화면을 육안·기하 검사한 뒤 중복 결과 8장과 `excel-compare-empty__bottom__ko__dark__mobile.png`, `excel-compare-empty__bottom__en__light__mobile.png`만 갱신했다. update 모드가 기계적으로 다시 쓴 무관한 6장은 같은 시작 HEAD bytes로 복원했으며 최종 전체는 Chrome 152에서 **16/16 일치**했다. 따라서 한 글자씩 세로로 무너진 기존 신규 화면은 승인 기준선으로 남기지 않았다.

**N01 160 code point 판정** — 미리보기 경계 160 code point를 유지한다. code point 단위라 surrogate를 가르지 않고, 160 이하는 원문 전체를 렌더해 불필요한 모달을 만들지 않으며 160 초과에만 명시적 말줄임과 전체 원문 모달을 제공한다. 반응형 실제 높이에 연동하는 방식은 접힘·지연 DOM에서 측정 전후 버튼 존재가 달라지고 뷰포트에 따라 키보드 경로가 흔들리므로 기각했다. 160은 긴 셀 두세 줄의 예측 가능한 탐색 밀도와 무손실 접근 경계를 함께 고정하는 제품 임계값이며, 잘린 값의 Enter·Escape·이름·초점 복귀 계약은 기존 실브라우저 회귀로 유지한다.

**사용자 파일 재현** — `/tmp/worklazy-userfiles/` 사본만 읽었다. 1행/B열은 중복 1·matched 713·changed 37·added 48, 4행/A열은 6·486·134·31, 4행/B열은 0·703·37·48을 유지했다. 첫 두 결과의 좌우 목록을 동시에 펼친 캡처에서 열 폭과 독립 목록을 확인했고 세 경우 모두 초기 렌더 내부 접두사 수는 0이었다.

**검증 산출물** — TypeScript 진단 0, unit **381/381**, production/QA build 각 2,835 modules, production static 61페이지·startup 104문서, Excel 비교·Excel Cleaner·QR bulk·전체 browser, CSS orphan 0, registry 20개와 diff check를 통과했다. QA axe는 16페이지 위반 0·외부 요청 0이다. `incomplete`은 통과로 세지 않았다. 현재 1,265 selector를 모두 수동 측정해 S2 기준의 inherited 미달 171개가 그대로임을 확인했고, 이번 Excel 결과 소유 14개는 미달 0(최소 12.800:1), 별도 전체 결과 텍스트 608개도 미달 0(최소 5.273:1)이었다. S0 대비 번들 현재값/증분/상한은 entry **300,692/+1,404/+20,480B**, affected routes **2,453,104/+1,523/+61,440B**, shared **2,715,918/+1,410/+30,720B**, app JS **5,469,714/+4,337/+81,920B**, CSS **37,839/+146/+10,240B**로 전부 통과했다. R01 원본 셀 복원, R02 24조합, R03 16장, 사용자 결과, 원본/호환 S1 프로브와 접근성 수동 판정 원출력은 `/tmp/worklazy-xd-s2-fix1/evidence/`에 보존하고 최종 보고서는 같은 작업의 `REPORT.md`에 둔다. — Codx

### Excel 중복키 S2 — 결과 화면 그룹 소비 전환 (Codx)

**착수 게이트·범위** — 지정 브랜치 `excel-dupkey-20260907`의 시작 HEAD가 `c1e44f60096dfad33e6c225fdb96f5323516edf6`이고 추적 변경이 없음을 확인했다. 대상 worktree에는 ignore된 todo 계획서가 없어서 S0 증거 디렉터리에 보존된 동일 정본과 채택된 1~3차 보강 문서를 읽었고, 같은 HEAD의 S1 재검수에서 열린 계획서 19개와 충돌 없음·S1 통과가 이미 확인된 근거를 사용했다. S0 번들 기준선 SHA-256도 `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`로 일치했다. S3 머리글 감지, main 병합·push·배포는 포함하지 않았다.

**화면 소비 판정** — `status=duplicate` 레코드는 내부 normalized `key` 대신 `displayKey`를 표시하고, 한 그룹을 표의 한 행으로 렌더한다. 좌우 `Rows/Values`는 서로 독립된 기본 접힘 목록이며 0건 측은 버튼 없이 텍스트만 표시한다. 펼칠 때만 항목 DOM을 만들고 각 측 50건부터 50건씩 늘리며, 닫으면 그 측만 50건으로 초기화한다. 그룹과 측 항목의 React identity에만 `pairId+record.key`를 쓰고 검색·표시 DOM에는 내부 키를 쓰지 않는다. 검색 문자열은 접힘/500행 가시 범위와 무관하게 공개 키, 양측 전체 값, 모든 원본 행 번호를 미리 포함한다. 긴 값은 160 code point 미리보기 뒤 Base UI modal로 원문을 손실 없이 제공하며 키보드 Enter, 이름, Escape 닫기와 trigger 초점 반환을 확인했다. 결과 표와 지원 표의 모바일 가로 스크롤 영역은 이름 있는 focusable region으로 만들었다.

501그룹 합성 fixture에서 duplicate 필터의 최초 DOM은 정확히 500행, `더 보기` 잔여는 1이었다. 접힌 목록 DOM 0, 값 검색 결과 1그룹, 행 번호 검색에 단측 K001 그룹 포함, 양측 50/0 → 51/50 독립 전개, 닫은 뒤 0/50, 최소 버튼 높이 44px, 0건 측 버튼 0을 실브라우저에서 단언했다. 기존 보고서 경로도 개별·ZIP 모두 9시트·Duplicates 13열·연속 행 복원을 유지했다. 당시 검증한 **duplicate 필터 화면**에는 `string:`·`number:`·원시 `DUPLICATE_KEY`가 없었지만 일반 키 결과는 범위 밖이었고, 위 fix-1에서 전체 표·검색·보고서까지 공개 표시값 경계로 확장했다. 저장소 검색에서 남는 `DUPLICATE_KEY`는 엔진 판정값과 ko/en 번역 키, `DUPLICATE_KEY_TOO_LONG`은 안전 오류 상수와 번역 키뿐이며 실제 ko/en 오류·결과 화면 스모크는 원시 code 비노출을 확인한다.

**문구·정적 표면 판정** — ko/en 결과 문구에 그룹 수, 좌우 단·복수 접기, 0건, 원본 행, 빈 값, 더 보기, 전체 값 대화상자를 함께 추가했다. 가이드·FAQ와 도구 설명·SEO 설명/featureList/static FAQ는 좌우 같은 줄이 자동 매칭이 아니며 보조키·발생 순번을 선택할 수 있다는 의미로 동기화했다. SEO path key 집합은 기준과 같은 31개, production sitemap은 61 URL이고 정적 검증의 canonical/hreflang도 통과해 URL·canonical·사이트맵 집합은 불변이다. 광고·격리·network/API·서버 전제 코드는 바꾸지 않았다.

**시각·접근성 판정** — 실제 중복 결과를 여는 `interaction-duplicate-result`를 ko/en × light/dark × desktop/mobile 8개 profile로 추가했다. 최초 기준선 갱신은 8개 중 마지막 profile의 두 파일 upload가 React 갱신 전에 연속 실행되는 경합으로 7개 뒤 대기 실패했으며, 첫 파일 선택 완료와 두 번째 inspection 완료를 각각 기다리도록 시나리오를 고정한 뒤 **8/8 생성·재일치**했다. 다만 후속 S2 검수에서 목록 전개 시 상태·판정 열이 세로로 무너지는 결함을 발견했으므로 이 8장은 품질 승인된 최종 화면이 아니며, 위 fix-1에서 열 배분을 수리한 화면으로 모두 교체했다. FAQ 영향 bottom 2장 누락도 같은 fix에서 정정했다.

axe 등록은 기존 8페이지에 위 8개 결과 상태를 더해 총 16페이지다. 첫 모바일 감사가 기존 지원 표의 focus 불가 가로 스크롤을 네 profile에서 찾아 이름·초점을 보강했고, 최종은 **16페이지·위반 0·외부 요청 0**이다. `incomplete`은 통과로 세지 않고 대상 selector를 보고서에 보존했다. 상태 필터의 기존 무역할 `aria-label`은 `role=group`으로 명확히 해 ARIA 보류를 0으로 만들었다. oklab 색상 때문에 자동 판정 보류인 대비는 렌더 픽셀 합성으로 별도 계산해 새 결과 텍스트 최소가 light **5.273:1**, dark **5.733:1**임을 확인했다.

**사용자 파일 재현** — `/tmp/worklazy-userfiles/` 사본 두 개만 읽어 production 동형 브라우저에서 다음 결과와 그룹당 한 행·기본 접힘·`displayKey` 일치를 확인했다. 원본/사본을 fixture로 추가하거나 저장소에 넣지 않았다.

| 머리글/키 | 중복 그룹·UI 행 | matched | changed | added |
|---|---:|---:|---:|---:|
| 1행/B열 | **1/1** | 713 | 37 | 48 |
| 4행/A열 | **6/6** | 486 | 134 | 31 |
| 4행/B열 | **0/0** | 703 | 37 | 48 |

**회귀·번들** — 최종 TypeScript 진단 0, unit **380/380**, production/QA build 각 2,835 modules, production 정적 61페이지·startup 104문서, Excel 비교·Excel Cleaner·QR bulk·전체 browser 스모크, CSS orphan 0, 도구 registry 20개와 `git diff --check`를 통과했다. 브라우저는 `127.0.0.1:4350 --strictPort`에서 직렬 실행했다. S0 대비 gzip 현재값/증분/상한은 entry **300,694/+1,406/+20,480B**, affected routes **2,453,004/+1,423/+61,440B**, shared **2,715,789/+1,281/+30,720B**, app JS **5,469,487/+4,110/+81,920B**, CSS **37,818/+125/+10,240B**로 다섯 예산을 모두 통과했다. JSON·사용자 재현·접근성 원출력과 최종 보고서는 `/tmp/worklazy-xd-s2/`에 보존한다. — Codx

### Excel 중복키 S1 fix-1 — 긴 키 오류 안내·기록 정정 (Codx)

**누락·재현** — 지원되는 정상 CSV에서 선택 키 값 32,768자가 두 행에 반복되면 보고서 Key 절대 한도 guard가 `DUPLICATE_KEY_TOO_LONG`으로 그 쌍만 안전하게 제외한다. S1 커밋은 code 전달과 쌍 격리를 구현했지만 `excelCompare.error`의 ko/en 키를 빠뜨려, UI가 정상 입력에 `PROCESSING_FAILED`의 파일 손상·지원 형식 확인 안내를 표시했다. 이는 객체 주입·ZIP 변조 없이 도달하는 R2-01 정본 경로다.

**수리·회귀 단언** — ko/en `features.json`에 R2-01의 원인·복구 문구를 그대로 연결했다. `tests/excel-compare-smoke.mjs`는 각 언어에서 정상 A → 긴 키 실패 → 정상 B 순서로 실행하고, 실패 파일명과 해당 언어의 원인·더 짧은 키 열 선택 안내, 원시 code 비노출을 단언한다. 성공 산출물은 개별 XLSX 2개와 ZIP 1개뿐이고 ZIP 내부도 정상 XLSX 2개뿐이며, 개별·ZIP 보고서의 9시트·Duplicates 13열·분할 복원 결과가 일치한다.

**원본 probe·실화면** — astra의 `browser-extra.mjs`(SHA-256 `026e60ab…cc760c`)와 `error-contract.py`(`159f38a…e8e9e`)를 바꾸지 않고 읽기 전용 검수 디렉터리와 쓰기 가능한 이번 증거 디렉터리를 격리 마운트해 실행했다. error contract는 직전 ko/en 0/2에서 **2/2**로 바뀌었고, browser probe의 ko/en 두 실행 모두 정상 보고서 2개·ZIP 내부 2개, direct/ZIP 내용 일치, page error 0을 기록했다. 실제 오류 캡처에서도 ko/en 정본 문구가 잘림 없이 표시됐다. 증거는 `/tmp/worklazy-xd-s1-fix1/evidence/`에 보존한다.

**완료 검증** — `tsc -b` 진단 0, 단위시험 **379/379**, production build 2,835 modules, 정적 startup 104문서, 강화 Excel 비교·Excel Cleaner·QR bulk·전체 browser 스모크를 모두 통과했다. 원본 사용자 파일의 1행/B·4행/A·4행/B는 각각 **1·6·0그룹**, matched/changed/added **713·37·48 / 486·134·31 / 703·37·48**을 유지했고, 독립 결과 27파일·486 XML/rels가 9시트·13열·폭 12~48·문자 길이와 함께 전부 재개방됐다. 선행 안전화 원본 17명령과 보존 산출물 204파일·2,267 XML/rels도 예상 밖 malformed 0으로 통과했다. 보존 XML 집계의 첫 실행은 격리 경로에 원본 SHA manifest를 복사하지 않아 제품 실행 전에 실패했으며, 그 로그를 보존하고 동일 원본 manifest를 제공한 재실행 결과를 채택했다.

S0 기준 번들 gzip 현재값/증분은 entry **299,402/+114B**, affected routes **2,451,562/−19B**, shared **2,715,801/+1,293B**, app JS **5,466,765/+1,388B**, CSS **37,693/+0B**로 다섯 예산을 모두 통과했다. fix 기준 변경 파일은 locale 2개·스모크·두 기록 파일뿐이고 locale 구조 diff는 양쪽 모두 `excelCompare.error.DUPLICATE_KEY_TOO_LONG` 한 키다. URL 문서105·canonical62·hreflang91·sitemap61 집합은 S0와 같고, 신설 network/API·광고·서버 전제 줄은 0이다.

**S1/S2 경계 정정** — 신설 원시 오류 코드는 숨겨지지만, S1 시점 결과 화면에는 기존 `string:`/`number:` 내부 key 표시와 빈 scalar에 따른 그룹 값 소비가 남아 있다. 이는 정본이 S1+S2를 단일 제품 전환으로 요구한 단계 경계이며 별도 제품 결함으로 세지 않는다. 기존 기록의 “내부 key identity/reason/error code는 UI에 노출되지 않고 신규 ko/en 작업도 없다”는 전체 UI에 대한 일반화와 locale 판정을 이 내용으로 정정한다. S2 화면 전환과 S3 감지는 이번 fix에 포함하지 않았다. — Codx

### Excel 중복키 S1 — 그룹 스키마·엔진·보고서 분할 (Codx)

**착수 게이트·범위** — 지정 기준 `597a92ff56ed9c3eb23755a58df2580b0269b8bd`가 실제 `origin/main`과 같고 부모가 `cdb4007`·`0654fa7`임을 확인했다. 열린 작업계획서 19개에 S1과 상반된 지시가 없음을 확인한 뒤 `/tmp/worklazy-xd`의 `excel-dupkey-20260907` 브랜치에서만 작업했다. `/tmp/worklazy-excel-s0/evidence/bundle-baseline.json`의 SHA-256은 지정값 `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`과 일치했다. 화면 소비처 전환 S2와 머리글 감지 S3는 넣지 않았고, main 병합·push·배포도 하지 않는다. S1 단독은 배포 후보가 아니다.

**스키마·엔진 판정** — `status=duplicate`를 판별 가능한 레코드로 분리해 scalar 행·열은 `null`, scalar 값은 빈 문자열로 고정하고 `leftRows/rightRows/leftValues/rightValues` 네 배열과 `displayKey`를 필수화했다. 중복 오류 정책은 2:0·0:2·2:1·1:2 모두 키당 한 레코드를 만들며 반대편 단일 행까지 포함한 뒤 양쪽 map에서 제거한다. 1:1과 다른 상태의 scalar 계약은 그대로다. 내부 그룹 identity는 기존 `normalizeKeyPart`와 U+241F 복합키를 유지하고, `displayKey`만 첫 좌측 원본 행 또는 좌측이 없을 때 첫 우측 원본 행의 선택 키 열을 기존 `cellText`로 읽어 ` | `로 잇는다. 표시 문자열이 같은 number/string 두 내부 키도 별도 그룹으로 남는 대조를 추가했다. `groupRows`의 누적 배열 spread는 append로 교체했고 그룹 생성·중복 스캔·값 수집에 공유 4,096개 간격 취소 검사를 넣었다. 30,000행 단일 그룹은 한 레코드로 완주했고 실제 취소 callback도 그룹 생성과 값 수집에서 발생했다. `summary.duplicate`는 레코드 수와 같아져 중복키 **그룹 수** 의미가 되며 기존 골든은 4에서 1로 갱신했다.

**보고서 formatter·안전 경계** — 9시트·13열 이름과 순서를 유지하면서 Duplicates의 행 번호는 `, `, 값은 `원본행번호: 행값`과 LF로 직렬화하고 Key에는 내부 identity가 아닌 `displayKey`를 쓴다. 좌우는 독립적으로 원본 행 단위 탐욕 분할하고 각 목록 셀은 접두사·구분자 포함 16,000 UTF-16 code unit 이하로 제한한다. 단일 원본 행이 더 길면 전용 조각으로 나눠 `r [i/n]`을 표시하며 surrogate pair와 CRLF 사이를 경계로 삼지 않는다. 더 짧은 측이 먼저 끝나면 뒤 물리 행은 빈 셀로 둔다. 분할 행은 보고서 전용 객체에만 존재하고 엔진 `records`를 바꾸지 않는다. 모든 셀은 기존 공용 writer의 `writeUntrustedText`를 통과하며 수식 객체가 생기지 않는 것을 재개방으로 확인했다.

반복되는 `displayKey`에는 단일 줄 32,767, CR/LF 포함 여러 줄 16,000의 별도 guard를 두었다. 각 정확 경계는 통과하고 1 code unit 초과는 `DUPLICATE_KEY_TOO_LONG`으로 거부하며 자르거나 대체하지 않는다. Chrome에서 32,768자 중복키 쌍과 정상 쌍을 한 배치로 실행한 결과 정상 XLSX 1건만 남고 ZIP은 생성되지 않았으며, 실패 쌍은 일반 사용자 안내로 격리되고 원시 코드는 노출되지 않았다. Parameters는 키/오류 정책에서 고정 9항목(`duplicateCountUnit=key-group`, split 여부·그룹 수·물리 행 수, 세 한도, layout, 표기 설명)과 `duplicateReportGroup.<n>=Duplicates!시작행:끝행`을 기록한다. 따라서 그룹 1개 보고서는 요구된 10개 항목이며, 적용 밖 모드는 고정 9항목을 `UNUSED`로 기록한다.

**사용자 파일 재현** — 입력은 원본을 읽기만 했고 fixture나 커밋에 넣지 않았다. 두 파일은 각각 19,605B/SHA-256 `3152fb51…6a4a9`, 20,263B/`faab6f10…319cf`다. 모든 보고서는 9시트·Duplicates 13열·유한 폭 12~48을 유지했다.

| 머리글/키 | S0 레코드·그룹 | S1 `summary.duplicate`/레코드 | S1 Duplicates 물리 행 | 나머지 요약 |
|---|---:|---:|---:|---|
| 1행/B열 | 4·1 | **1/1** | 1 | matched 713·changed 37·added 48 |
| 4행/A열 | 24·6 | **6/6** | 6 | matched 486·changed 134·added 31 |
| 4행/B열 | 0·0 | **0/0** | 0 | matched 703·changed 37·added 48 |

1행/B열 그룹은 좌우 모두 `[2,3]`, 표시 키는 원본 `□ 2026년 설명절 선물 발송처(대외, 임직원)`이었다. 4행/A열은 표시 키 1~6과 각 측 두 행의 순서를 보존했다. 세 사용자 보고서와 17,000자 합성 분할 보고서를 ExcelJS/생성 무결성/가시성 검사로 다시 열고, 각 ZIP의 XML/rels **18개 전부**를 ElementTree로 파싱했다. 산출물은 `/tmp/worklazy-xd-s1/user-*.xlsx`, `synthetic-split.xlsx`, `user-file-results.json`에 보존했다.

**회귀·번들·제품 영향** — 첫 타입 검사에서 일반 레코드 필터의 union narrowing 진단을 발견해 명시적 type guard로 고친 뒤 전체를 다시 실행했다. 공용 writer 문자 안전화·희소 데이터행 판정·Row/Column `numFmt` backstop 파일은 기준 커밋과 byte diff가 없으며, 전용 64개 회귀에서 금지 문자·수식 주입·희소 객체 수·행/열 서식·유한 폭 계약이 모두 통과했다. 최종 결과는 다음과 같다.

| 검증 | 결과 |
|---|---|
| `./node_modules/.bin/tsc -b --pretty false` | 진단 0 |
| `npm run test:unit` | 상위 371개·하위 포함 **379/379** |
| `npm run build` / `npm run test:static` | 2,835 modules·정적 61페이지 / startup 104문서 통과 |
| `npm run test:excel-compare` | 그룹 분할 개별 2 XLSX+ZIP 내부 2 XLSX, 키 길이 실패 격리, 기존 취소·모바일·무결성 포함 통과 |
| `npm run test:excel-cleaner` / `npm run test:qr-bulk` | 5시트 출력·문자/서식 경계 / 7종·ZIP·2시트 manifest·PDF 글꼴 4시나리오 통과 |
| `npm run test:browser` | Excel·Word·PDF 편집/분할/변환 통과 |
| `npm run css:orphans` / route registry | orphan 0 / 도구 20개·누락/예상 외/중복 0 |
| `git diff --check` | 공백 오류 0 |

S0 기준 번들 gzip 현재값/증분은 entry **299,294/+6B**, affected routes **2,451,591/+10B**, shared **2,715,815/+1,307B**, app JS **5,466,700/+1,323B**, CSS **37,693/+0B**로 다섯 예산을 모두 통과했다. production 브라우저는 `127.0.0.1:4350 --strictPort`, QR 보조 프록시는 저장소 밖 preload로 4351에 고정해 직렬 실행했다. 변경된 제품 소스에 network/API·광고 경로·서버 전제를 추가하지 않았고 locale·SEO 입력·정적 페이지 생성기·URL/canonical/hreflang/sitemap 집합도 바꾸지 않았다. 신설 원시 오류 코드는 숨겨지지만, 기존 내부 key 표시와 그룹 값 소비는 S2에 남아 있다. 이는 정본이 S1+S2 단일 전환을 요구한 단계 경계이며 별도 제품 결함이 아니다. 또한 S1 신설 `DUPLICATE_KEY_TOO_LONG`에는 ko/en 복구 안내가 필요했으므로 추가 locale 작업이 불필요하다는 당시 판정은 잘못이었고, 위 fix-1 기록으로 정정한다. 번들 JSON과 재현 산출물·최종 보고서는 `/tmp/worklazy-xd-s1/`에 둔다. — Codx

## 2026-09-07

### 문서 비교 엔진 통일 — main 배포·라이브 검증 (Codx)

**병합 게이트** — `git fetch` 전후 `main=origin/main=5bc6854175331bdd73b267784d9633cdccda8446`, 구현 브랜치 `document-compare-engine-20260907=4a625489ae2f317d975e0246ffb90e1fd234250a`, merge-base와 기준 조상 검사를 통과했다. 원 `s3-pdf-finish` 워킹트리를 전환하지 않고 별도 `/tmp/worklazy-dc-main`에서 `--no-ff --no-commit` 병합 트리를 먼저 만들었다. 충돌은 없었으며 staging tree `9ef5a02085afb729bea4b5b36d6b4902e1585719`가 구현 브랜치 tree와 정확히 같았다. 공통 파일 `CHANGELOG.md`·`docs/review-notes.md`·`package.json`은 각각 diff를 확인해 main의 기존 내용을 보존하면서 문서 비교 기록과 `test:document-diff` 명령만 추가된 상태로 병합했다. `excel-report-width-20260907`은 병합하지 않았다.

**배포 전 전체 검증** — `NODE_OPTIONS=--max-old-space-size=4096`로 빌드와 브라우저 검사를 직렬 실행했다. `tsc -b` 진단 0, unit **345/345**, production·QA build 각각 2,834 modules/정적 61페이지, static startup 104문서, Word 범위·HWP 범위·전체 browser·Office·Excel Cleaner·Excel Compare 스모크가 모두 통과했다. Office 실측은 download 95·cache 7·저장 DOCX 5,089B였다. 동치 oracle은 Pyodide 0.29.4, bridge 101회, sidecar 62(일치 53·E1 9), package reject 5쌍/13 story part/구조 revision 5, 보호 part 28행(존재 7·부재 21), exact key 4, E6 fixture 1, edge 8 및 offset 음성 대조를 통과했다. 번들 gzip 5종은 **299,294 / 2,450,893 / 2,711,698 / 5,461,885 / 37,687B**, CSS orphan 0, route registry 20개, staged/unstaged `git diff --check`도 통과했다.

**규칙 19·사용자 문서** — `VITE_LOCAL_QA=1` 빌드와 4290~4292 `--strictPort`만 사용했다. HWP 안내 결과를 ko/en × 1,440px/320px로 캡처해 네 표본 모두 문구 exact, notice/document overflow 0, 좌우 잘림 0을 확인했고 정상 DOCX 표본도 4행·삭제/추가 강조·표 배치를 육안 확인했다. `VISUAL_ONLY=document-compare VISUAL_CONCURRENCY=1`은 Chrome 152에서 **10/10** 기존 기준선과 일치해 추가 차이 0이었다. 사용자 v1.2/v1.4 문서는 복제·fixture화하지 않고 Pyodide 메모리에서만 재현했다. 제14조 ④는 웹과 추적 DOCX 모두 deleted `을` `(104,104)` → added `자금을` `(105,104)`로 문자열·0-based code point offset·순서가 정확히 같고 수락 본문도 after와 일치했다. 오래된 임시 재현 하네스의 첫 실행은 fix-2 입력 `PRESERVED_PACKAGE_PARTS_JSON` 누락으로 제품 비교 전에 종료됐고, 두 번째는 입력을 잘못 삽입한 임시 스크립트 구문 오류였다. 저장소를 바꾸지 않고 최신 oracle 입력 계약으로 보정한 세 번째 실행만 위 최종 재현값으로 채택했으며 실패 원출력도 함께 보존했다.

**배포·라이브 판정** — 두 부모 `5bc6854`·`4a62548`의 merge commit은 **`d69e73a5162840837ed36a7ffb7817cab597966a`**다. 일반 push로 `origin/main`에 올렸고 GitHub Actions **Deploy GitHub Pages #34089072595**가 build 5분46초·deploy 19초로 성공했다. Actions의 Node 20 deprecation 표시는 경고이며 모든 build/SEO·AdSense/FFmpeg smoke/artifact/deploy 단계는 성공했다. `https://worklazy.net`에서 essential-only 동의 상태로 ko/en DOCX 비교를 각각 실행해 결과 4행·삭제 3·추가 10·가로 overflow 0을 확인하고, 각 9,455B 추적 DOCX를 실제 내려받아 `word/document.xml`의 `w:ins`·`w:del`을 확인했다. ko HWP 결과의 안내 문구도 exact·overflow 0·잘림 0이었다. 세 라이브 흐름 전체에서 console error 0, page error 0, request failure 0, HTTP 4xx/5xx 0이었다. 첫 HWP 캡처가 결과 전환 중 옅은 프레임을 잡아 1.5초 안정화 뒤 재측정했고 body/main opacity 1·열린 dialog 0인 정상 화면으로 재캡처했다. 원출력과 최종 로컬·라이브 화면은 `/tmp/worklazy-dc-deploy/logs/`·`/tmp/worklazy-dc-deploy/shots/`에 보존했다. — Codx

### 문서 비교 동치 oracle fix-2 — 메모 관련 package part 부재 일치 (Codx)

**R2-1 원인과 수리** — fix-1의 `commentsPreserved`는 output에 `word/comments.xml`이 없으면 after를 읽지 않고 참을 반환했다. 따라서 bytes 훼손은 잡았지만 part 전체 누락은 통과했고, 메모 fixture의 수락 package 불일치와도 연결되지 않았다. 보호 대상을 `word/comments.xml`·`word/commentsExtended.xml`·`word/commentsIds.xml`·`word/people.xml`의 명시 목록으로 고정하고, 기존 5쌍·exact·E4/E6 pair를 포함한 **7개 모든 대상 쌍**에서 각 part의 after/output 존재 여부가 같고, 존재할 때 bytes도 같아야 통과하도록 바꿨다. after에 없으면 output에도 없어야 하므로 output-only part 추가도 거부한다. `commentsPreserved`는 4개 part 행 전체가 일치할 때만 참이다.

**검사 범위와 음성 대조** — 정상 oracle은 7쌍 × 4 part = **28행**(after에 존재 7·부재 21)을 검사해 통과했다. `comments-multipara`의 `comments.xml` 제거는 `afterPresent=true/outputPresent=false`, bytes 훼손은 `true/true/bytesEqual=false`, 메모 없는 `exact` output에만 `comments.xml` 추가는 `false/true`로 각각 **exit 1**이며 모두 `commentsPreserved=false`였다. 실제 관련 part 3개가 함께 있는 `revisions`에서 `commentsExtended.xml`·`commentsIds.xml`·`people.xml`을 하나씩 제거한 실행도 각각 `true/false`, **exit 1**이었다. 따라서 패키지 part 누락·bytes 훼손·부재 불일치와 실제 존재하는 관련 part 각각의 누락이 독립적으로 실패한다. 원출력은 `/tmp/worklazy-dc-fix2/logs/negative-*.log`에 보존했다.

**범위 판정** — 제품 생성기, `diffText`, 문단·표 정렬, UI·한영 문구, SEO/정적 페이지, 광고 격리 경로는 변경하지 않았다. oracle의 package part 검사·음성 대조 계약과 이 기록만 바꿨으므로 시각 회귀는 생략한다. — Codx

**완료 검증** — 전용 `TMPDIR`·npm cache와 `NODE_OPTIONS=--max-old-space-size=4096`를 사용해 `npx tsc -b` 진단 0, `test:unit` **345/345**, 정상 oracle 28행, production build 2,834 modules·정적 61페이지, `test:static`, Word·HWP·Office·Excel cleaner·Excel compare 스모크를 모두 통과시켰다. `bundle:measure` 5종은 **299,294 / 2,450,893 / 2,711,698 / 5,461,885 / 37,687 bytes**, CSS orphan 0, route registry 20개, `git diff --check`도 통과했다. 브라우저 검증은 `127.0.0.1:4290 --strictPort`에서 직렬 실행했고 종료 후 4290~4299 listening socket은 0이었다. 전체 원출력은 `/tmp/worklazy-dc-fix2/logs/`에 보존했다.

### 문서 비교 동치 oracle fix-1 — 구조 키·패키지 거부·E6 fixture 정정 (Codx)

**원인과 수리** — 최초 oracle은 sidecar 구조 키의 존재·타입만 확인하고 실제 대조와 E1 허용 판정은 호출 순번 문자열로 했으므로 경로·인덱스·분할 slice를 바꿔도 통과했다. 또한 저장 전 sidecar를 거부 문자열처럼 재구성했을 뿐 최종 ZIP을 거부한 결과는 검사하지 않았고, E4/E6은 등록되지 않은 `comments-multipara` pair 이름만 가리켰다. 이를 독립 정적 fixture의 **62개 구조 키·기대 결과**와 실제 observation을 일대일 대응하도록 바꾸고, 누락·중복·예상 밖 키와 `pairId`·`storyPart`·양쪽 index/path·선택적 `[start,end)` `sourceSlice` 오염을 모두 실패시켰다. E1 9건은 각 구조 키가 `E1` 사유에 연결될 때만 허용하며 호출 순번은 식별에 사용하지 않는다.

**최종 패키지 검사 범위** — 기존 5쌍의 생성 완료 ZIP에서 본문·활성 머리말/꼬리말·각주/미주의 총 13개 story part를 다시 읽고, `Worklazy Oracle` 작성자의 삽입 text/행/셀만 제거하고 삭제 text/행/셀은 복원하는 거부 결과를 before와 대조한다. 기존 after 문서의 다른 작성자 revision은 그대로 두고 E1의 구조 키·사유에 대응하는 본문 3건과 머리말/꼬리말/각주/미주 4건만 명시 치환한다. `comments.xml`은 거부 대상이 아니며, fix-1 당시 별도 검사는 **output에 part가 있을 때의 after bytes 대조만 보장하고 part 누락은 놓쳤다**. 이 과대 진술은 위 fix-2의 존재·부재·bytes 양방향 검사로 보정했다. 정상 실행에서 구조 revision 5개가 실제 거부 경로를 통과하며, 저장 직전 생성 삭제 텍스트를 훼손하면 sidecar·수락 결과와 무관하게 최종 패키지 거부 대조가 실패한다.

**E4/E6 실행 fixture와 음성 대조** — `comments-multipara` 실제 DOCX pair는 before/after 메모 작성자·본문을 다르게 두고 after `comments.xml` bytes 보존을 검사한다. 같은 pair의 셀은 `['Alpha ', 'Beta']→['Alpha', 'Beta']` 두 문단을 실제 XML에 담는다. 웹 입력 `Alpha ␠\nBeta→Alpha\nBeta`는 삭제 `␠\n` `(5,5)`·삽입 `\n` `(7,5)`, 생성기 문단 입력은 첫 문단 삭제 `␠` `(5,5)`와 둘째 문단 무변경임을 각각 단언하며 **이 fixture ID만 E6**으로 둔다. 구조 키 오염·최종 ZIP 삭제 텍스트 훼손·E6 실행 pair 제거의 세 음성 대조는 모두 exit 1로 실패한다. 따라서 이전 기록의 “E1~E6 통과”는 이름 존재 검사가 아니라 위 실제 실행 범위로 정정한다. `diffText`·문단 정렬·UI·한영 문구·SEO/정적 페이지·광고 격리 경로는 변경하지 않았다.

**완료 검증** — 전용 `TMPDIR`·npm cache와 `NODE_OPTIONS=--max-old-space-size=4096`를 사용해 `npx tsc -b` 진단 0, `test:unit` **345/345**, production build 2,834 modules·정적 61페이지, `test:static`, 정상 oracle(기존 5쌍/55 sidecar·전체 구조 키 62·E1 허용 9·package reject 5쌍/13 story part/구조 revision 5·exact 4키·E6 1 fixture), `bundle:measure` 5종, `css:orphans` 0, route registry 20개를 통과시켰다. 4290 `--strictPort` production preview에서 Word·HWP·Office·Excel cleaner·Excel compare 스모크가 모두 통과했고 서버 종료 뒤 4290~4299 listening socket은 0이었다. 시각 회귀는 제품/UI/HWP 안내 문구 변경 없이 oracle·fixture만 바꾼 작업이므로 지시서 조건에 따라 생략했다. 원출력은 `/tmp/worklazy-dc-fix1/logs/`에 보존했다.

### 문서 비교 diff 코어 통일 — 분리 checkout 구현·검증 (Codx)

**착수 게이트·범위** — 첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 디스패치와 정본 `document-compare-granularity-20260907.md`의 「정본화 (2026-09-07 11:55, v3)」, 1·2차 반박 보고서·수정안, 관련 기각 이력을 확인했다. `main`이 지정 기준 **`5bc6854175331bdd73b267784d9633cdccda8446`**와 정확히 같고 열린 계획서와 충돌하지 않음을 확인한 뒤 `/tmp/worklazy-dc-impl`의 `document-compare-engine-20260907` 브랜치에서만 작업했다. 기존 `s3-pdf-finish` checkout은 전환·수정하지 않았다. 문서 결과 폭·이동 rail·모바일 toolbar·ARIA와 결과 상태 a11y/rendering 등록은 `ui-theme-redesign-20260907.md` 이관을 따랐으며 이번 변경에 넣지 않았다.

**공용 코어·경계** — `documentComparison.ts`의 현행 단어 토큰/LCS/역추적/인접 병합과 토큰 셀 1,500,000 가드를 97쌍 정적 골든(합성 27·Word 68·HWP 2)으로 고정했다. worker 전역의 동기 `worklazyDiffJson`은 이 함수 결과만 JSON으로 넘기며 Python fallback은 두지 않았다. `tracked_docx.py`의 `_paragraph_revision`만 이 값을 받아 Python `len()` 기반 0-origin Unicode code point cursor를 누적하고, 각 조각의 타입·문자열·양쪽 재구성과 마지막 cursor를 검사한다. 탭·`w:br`·`w:cr`·surrogate·결합문자·빈 run/빈 text를 Pyodide 0.29.4에서 재현했다. 문단·표 정렬과 서식 비교의 `SequenceMatcher`/`diffCharacters`, after의 `comments.xml` bytes 보존은 그대로다. bridge 주입·타입·재구성 실패는 기존 현지화 작업 오류 경계로 전달하며 내부 함수명이나 원시 예외를 사용자에게 새로 노출하지 않는다.

**죽은 비교 코드 제거** — 삭제 정본 `probes-r2/pruning.json`의 SHA-256 **`d2c74bea63190073d951e57818bec11d1e072a9580282577fdccf58b53997894`**를 대조했다. 착수 코드에는 `removed` 31개와 `keep` 17개가 정확히 존재했고 교집합은 0이었다. 31개 정의만 제거한 뒤 keep 17개·추출 의존 폐쇄·`compare.py?raw` import·`runPython(compareScript)`를 보존했다. 합성 DOCX 10개에 ko/en × tables on/off × metadata on/off를 적용한 구현 전후 **80/80** 직렬화 출력이 동일했다(229,909B, SHA-256 **`888853b43226e6aea8340a919d18151b299834bf73e1e68cc41c3fd35d4a9f0d`**).

**동치 oracle** — 커밋한 합성 DOCX 5쌍에서 실제 생성기의 `_paragraph_revision`만 계측해 `pairId, storyPart, beforeIndexes[], afterIndexes[], beforePath, afterPath` sidecar와 분할 source slice를 검증했다. 총 **55 sidecar 중 보장 범위 46개가 문자열·code point offset·순서까지 정확 일치**했고, 나머지 9개는 고정한 E1 기존 after revision 사례와 정확히 일치했다. 별도 4-key package fixture는 본문 3개와 단일 문단 셀 1개의 실제 생성 DOCX XML을 웹 모델 결과와 정확 대조했다. offset 하나를 +1한 음성 대조는 실패했고, 이름 붙인 E1~E6(기존 revision·분할/병합·자동번호·메모·property revision·다문단 연결 셀) 목록과 탭/개행/Unicode/빈 항목 8경계도 통과했다. 이 결과는 revision 없는 1:1 문단·단일 문단 셀 범위의 보장이지 문단 정렬·E2/E6까지 통일했다는 주장이 아니다.

**HWP·화면 문구** — 기존 빈 HWP fixture는 편집기 왕복용으로 유지했다. 실제 본문 `등)을 대여` → `등)자금을 대여`가 든 고정 fixture 두 개는 각각 3,584B이고 SHA-256은 before **`65255f73e971e65b317b225e30060b2786e18a86b075ded00d2d4243fc8a5980`**, after **`451e25962a5f32833f60c6099ffd57d5e7c63bc2096d00869882254a06d2e0b6`**다. HWP diff 알고리즘은 이미 공용 `compareDocumentModels`를 사용하므로 바꾸지 않고, 정본의 한·영 검토 메모·변경 추적 안내를 worker inline `L(ko,en)`으로 교체했다. 따라서 locale JSON·SEO/FAQ 정적 본문·route·sitemap·광고/격리 경계는 불변이며 worker bundle hash 변화는 정적 본문 변화가 아니다.

QA 결과 화면을 ko/en × 1,440px/320px로 직접 캡처·확인했다. 네 경우 모두 안내 문자열 정확 일치, notice overflow 0, 잘림 0, document 가로 초과 0이었고 정상 DOCX 표본도 삭제/추가 강조와 표 정렬을 확인했다. 시각 회귀 최초 실행은 10장 중 새 영어 안내가 있는 `interaction-hwp-result` 한 장만 **34,155px / 2.7802%** 달랐다. 기준·실제·diff를 확인해 이 한 장만 갱신했고 최종 문서 비교 **10/10**이 일치했다. HWP editor 스모크의 `[CanvasView] 페이지 0 정보가 없습니다` 2줄은 기존 빈 fixture를 여는 상류 로그이며 실제 3,584B·1페이지 저장/재파싱/재개방은 통과했다.

**사용자 문서 메모리 재현** — `dummyfortest`의 v1.2/v1.4를 복사·fixture화·커밋하지 않고 Pyodide 메모리에만 넣어 1회 실행했다. 제14조 ④의 공용 source 세그먼트와 생성 DOCX XML은 **deleted `을` (before 104, after 104) → added `자금을` (before 105, after 104)**로 문자열·0-based code point offset·순서가 정확히 같았고, 변경 적용 후 텍스트도 after 수락본과 일치했다. 웹 표시 좌표는 각각 (106,106)·(107,106)인데 이는 정본 E3의 자동번호 display 접두 `④ ` 2 code point 때문이며, source 좌표로 환산하면 위 XML 값과 정확히 같다. 전체 생성 호출은 1,158회, revision count는 153이었다.

**완료 기준 검증** — 전용 `TMPDIR`·npm cache, `NODE_OPTIONS=--max-old-space-size=4096`, 4210 `--strictPort` preview를 사용하고 빌드·브라우저를 직렬 실행했다. 원문 로그·화면 캡처는 `/tmp/worklazy-dc-impl-out/`에 보존했다.

| 명령/검증 | 실제 결과 |
|---|---|
| production `npm run build` | 2,834 modules·정적 61페이지 통과; Word worker 164.07kB |
| `npx --no-install tsc -b --pretty false` | 진단 0 |
| `npm run test:unit` | **345/345**(골든 inventory+97쌍 포함) |
| `npm run test:static` | locale/hreflang/runtime/ads/robots/sitemap·startup 104문서 통과 |
| `VITE_LOCAL_QA=1 npm run build` | 2,834 modules·정적 61페이지; 위 화면 표본 확인 |
| `TEST_SCOPE=word npm run test:browser` / 전체 `test:browser` | 둘 다 통과; 추적 DOCX 내려받기·웹 결과 포함 |
| `TEST_ONLY_HWP=1 npm run test:new-tools` | 실제 `을`→`자금을`, ko/en 안내, 본문 복원·HWP 편집 왕복 통과 |
| `npm run test:office` | 96 download·7 cache 상태, Calc 편집, 저장 DOCX 5,088B |
| `npm run test:excel-cleaner` / `test:excel-compare` | production preview에서 둘 다 통과 |
| `npm run test:document-diff` | Pyodide 0.29.4·bridge 97호출·5쌍/55 sidecar·4 package key·+1 offset 음성 대조·E1~E6 통과 |
| `npm run bundle:measure` | entry 299,294B·affected routes 2,450,893B·shared 2,711,698B·app 5,461,885B·CSS 37,687B gzip |
| `npm run css:orphans` / route registry | orphan selector arm 0 / 기대 20·누락·예상 외·중복 0 |
| `VISUAL_ONLY=document-compare VISUAL_CONCURRENCY=1 npm run test:visual` | 기준선 한 장 한정 갱신 후 **10/10** 일치 |
| 사용자 문서 메모리 재현 / `git diff --check` | 위 E3 환산 exact match / 공백 오류 0 |

**실행 중 판정** — 첫 Excel cleaner 실행은 QA 산출물에서 production 광고 DOM을 요구해 `ads:false`로 중단됐다. 이는 `VITE_LOCAL_QA=1`의 의도된 추적 제거와 스모크 전제의 충돌이므로 production을 다시 빌드·기동해 동일 명령을 통과시켰고 광고 계약을 낮추지 않았다. HWP 스모크 첫 개발 실행은 실텍스트 두 번째 파일 대신 첫 파일을 after 열로 옮기던 기존 selector 결함을 드러냈다. 두 파일이 모두 비었던 과거에는 보이지 않던 문제로, 두 번째 항목을 명시하는 selector로 고쳐 실제 before/after 방향을 검증했다. 사용자 재현 첫 대조는 자동번호 display 접두를 source XML offset과 바로 비교해 +2 차이를 냈고, 문단 원문이 든 실패 로그는 제거한 뒤 정본 E3를 명시 적용해 재실행했다. 새 제품 결함을 무시하거나 허용치를 넓힌 경우는 없다.
### XLSX 보고서 열 폭 NaN — 빈 화면 근본 원인·가시성 무결성 판정 (Codx)

**근본 원인 확정** — `ExcelJS.Column.values`는 1-based 행 번호를 반영해 index 0이 hole인 sparse 배열이다. 기존 `values.map(...)`는 hole을 보존하지만 이를 `Math.max(12, ...mapped)`로 펼치면 hole이 `undefined` 인자로 바뀌어 결과가 `NaN`이 된다. ExcelJS는 `column.width = NaN`을 `<col customWidth="1"/>`로 직렬화하면서 `width` 속성을 생략하고, Excel은 이 열을 폭 0으로 렌더한다. 셀과 shared string은 그대로라 시트명만 보이고 내용이 없는 것처럼 보였다. 2026-09-03 X-A가 확인한 byte 길이·`PK` 서명·재개방·행 수는 모두 참이어도 열 가시성은 보장하지 않으므로, 당시 서비스워커·전송 계층 가설은 이 증상의 원인이 아니며 “근본 원인 미확정” 판정을 폐기한다.

**영향·수정 경계** — 공용 `writeXlsxReport`를 쓰는 Excel 비교 `report.ts`, Excel 정리 `output.ts`, QR 일괄 `QrBulkPanel.tsx`의 보고서가 같은 결함을 공유했다. 폭 계산은 sparse hole을 건너뛰는 `forEach` 선형 순회로 바꿔 열당 인자 배열을 만들거나 spread하지 않고, 후보와 최종 폭을 `Number.isFinite`로 거른 뒤 12~48에 고정했다. 생성 직후 비교 워커의 무결성 검사는 XLSX ZIP을 다시 열어 모든 worksheet XML을 순차적으로 읽고, `customWidth=1|true`인 모든 `<col>`의 `width`가 유한한 양수인지와 **머리글을 제외하고 값 있는 셀이 하나 이상인 행**이 있는 시트가 최소 하나인지 확인한다. 행 시작 태그만 보던 첫 구현은 행 높이·스타일만 남은 빈 행도 데이터로 인정했으므로 폐기했다. 생산 검사와 테스트 보조 함수는 이제 같은 공용 판정기를 사용하며, `<c>` 안의 실제 문자 내용이 있는 `<v>`·`<is>` 또는 `<f>` 수식을 값으로 센다. shared string은 참조 인덱스의 실제 텍스트를 지연 확인해 빈 문자열을 제외하고, `0`·`false`는 값으로 유지한다. 실패는 기존 `REPORT_INTEGRITY_FAILED` 하나로만 귀결해 내부 원인을 사용자에게 노출하지 않는다. 전 시트의 열 폭은 계속 검사하되 데이터 존재는 시트당 첫 유효 행에서 멈추고, 한 번에 worksheet XML 하나만 문자열로 유지해 피크를 제한했다.

**mutant·검사기 판정** — 수정 전 코드를 그대로 둔 상태에서 새 XML 골든을 실행하자 exit 1과 함께 `XLSX report column has an invalid custom width in xl/worksheets/sheet1.xml: <col min="1" max="1" customWidth="1"/>`가 재현됐다(`/tmp/worklazy-xr-out/mutant-width-failure.log`). 수정 뒤 4개 논리 열 모두 폭 12~48, 50,000행 단일 열도 1.08초에 `RangeError` 없이 완료했다. 인접 열 폭이 같으면 ExcelJS가 `<col min="3" max="4">`처럼 한 태그로 합치므로, 테스트의 열 수는 태그 수가 아니라 `min..max` span으로 계산한다. 누락 폭 mutant와 헤더만 있는 보고서는 생산 무결성 검사에서 모두 기존 안전 오류 코드로 거부됐다.

**R1 데이터행 보정 대조·비용** — 독립 ExcelJS 재개방과 공용 XML 판정을 함께 사용해 음성 4종(행 높이만 있는 2행, 서식만 있는 A2, 모든 시트 머리글 전용, 빈 shared string 값)을 모두 데이터 0행으로 확인했고 생산 검사가 전부 `REPORT_INTEGRITY_FAILED`로 거부했다. 양성 3종(정상 보고서, 데이터 시트+머리글 전용 시트 혼재, `customWidth="true"`)은 각각 데이터 1·2·1행으로 통과했으며 혼재 표본의 `0`·`false`도 값으로 보존했다. astra 원본 `empty-data-negative.mts`(SHA-256 `2b664605…c2ccc`)는 bind 격리로 파일과 기존 산출물을 바꾸지 않고 실행해 2/2 통과했고 보조 함수도 두 표본을 각 0행으로 판정했다. 50,000레코드×13열·9시트 보고서는 2,525,550B, 생성 5,990ms, 검사 271/202/182ms(생성 대비 약 3.0~4.5%)였다. astra의 수정 전 검사 327/240/199ms보다 증가하지 않았다. 원출력은 `/tmp/worklazy-xr-fix1/logs/`에 보존했다.

**R1 fix-2 요소 경계 원인·수리** — `row`·`c`·`si` 정규식의 `[^>]*`가 자체 닫힘 태그 끝의 `/`까지 소비해 `/>` 분기가 아닌 시작+종료 분기를 택했고, 다음 형제의 닫힘 태그까지 한 요소로 합쳤다. 실제 ExcelJS 생성 표본의 같은 행에서 서식 전용 `<c r="A2" s="1"/>` 뒤 빈 shared-string B2가 오면 B2의 `<v>`가 A2 값처럼 해석되어 데이터 0행을 1행으로 오인했다. 정규식별 보완은 따옴표 안의 `>`·`/`와 `row/c/si/t`의 동일 경계를 일관되게 처리하지 못하므로 기각하고, 공용 `xlsxReportDataRows.mjs` 한 곳에 작은 따옴표 상태 기반 선형 태그 스캐너를 두었다. 자체 닫힘과 시작·종료 태그를 분리하고 정확한 속성 이름을 읽으며 주석·CDATA·처리 지시를 건너뛴다. 값 판정도 같은 요소 경계에서 shared/inline 값과 비어 있지 않은 `<f>` 수식을 읽는다. 생산 검사는 `maximum=1`, 테스트 보조는 전체 개수를 요청할 뿐 같은 함수를 사용한다. 보조 함수는 빈 보고서를 거부하는 것이 아니라 0행을 **반환**하며, 거부는 생산 검사만 담당한다.

**fix-2 조합·mutant 판정** — ExcelJS로 만든 XLSX의 192개 worksheet에 6개 셀 표현(자체 닫힘 `c`, 빈 `c`, `v`, `t="s"`, `t="inlineStr"`+`is`, `f`) × 8개 값(빈 문자열·공백·0·false·긴 문자열·따옴표·`>`·`/`) × 4개 배치(같은 행 앞/뒤·행 건너뛰기·속성만 있는 자체 닫힘 행)를 전수 구성했다. 태그 속성에도 실제 `>`·`/`와 따옴표 값을 넣고, ExcelJS 재개방의 값 있는 데이터 행 수와 공용 판정 결과를 **각 시트별로** 비교해 합계 상쇄를 막았으며 192/192가 일치했다. astra 원본 조합 probe는 수정 전 1/2 실패에서 수정 후 2/2 통과, 요소 경계 probe는 수정 전 1/5에서 5/5, 기존 음성 6/6·양성 4/4와 1차 음성 2/2도 통과했다. 수정 전 파일만 read-only bind한 mutant에서는 전체 대상 unit이 exit 1, 24 pass/4 fail이었고 조합 단언은 `Matrix65`의 자체 닫힘 셀+빈 `<v>`를 0이 아닌 1행으로 세어 실패했다. 원출력은 `/tmp/worklazy-xr-fix2/logs/mutant-combination-failure.log`와 같은 디렉터리의 probe 로그에 보존했다.

**fix-2 비용·사용자 파일·완료 검증** — 50,000레코드×13열·9시트 2,525,551B 보고서는 생성 5,877ms, 검사 256/190/178ms로 직전 astra 279/186/186ms와 동급이었다. 단일 열 대량 표본도 50,000·150,000행을 각각 62ms·117ms에 검사하고 `RangeError`가 없었다. 사용자 원본 2개를 읽기 전용으로 다시 비교한 결과는 matched 713·changed 37·added 48·duplicate 4, 보고서는 9시트·데이터 856행·논리 열 95개·폭 12~48·잘못된 폭 0이었다. 전용 `TMPDIR`·npm cache와 `NODE_OPTIONS=--max-old-space-size=4096`에서 `./node_modules/.bin/tsc -b`, 전체 unit 254개 상위 테스트·하위 포함 262/262, build 2,835 modules·정적 61페이지, `test:static`, `test:excel-compare`, `test:excel-cleaner`, `test:qr-bulk`, 전체 `test:browser`, `bundle:measure`, `css:orphans`, route 검사와 `git diff --check`가 모두 exit 0이다. 브라우저는 `127.0.0.1:4330 --strictPort`에서 직렬 실행하고 QR 보조 프록시만 4331로 고정했으며 종료 뒤 bundle 측정을 실행했다. 원출력과 생성물은 `/tmp/worklazy-xr-fix2/`에 보존했다. — Codx

**fix-3 문자 내용·문자 참조 원인·수리** — 기존 요소 스캐너가 반환한 `f`·`v`·`t` 내부 원본 substring의 길이를 그대로 검사해 빈 주석·처리 지시·CDATA도 값으로 오인했고, 행 `r`·셀 `t` 속성과 shared-string 인덱스의 문자 참조는 해석하지 않아 실제 행 번호·셀 형식·인덱스를 놓쳤다. 공용 판정기에 문자 데이터 조각을 합치는 선형 해석기를 추가해 주석과 처리 지시는 버리고 CDATA 본문은 실제 문자로 보존했다. 행 번호·셀 형식·shared-string 인덱스의 일반 문자 데이터와 속성에서는 XML 기본 명명 참조 5종과 십진·16진 숫자 참조를 정확히 한 번만 해석하며, 잘못된 참조와 XML 1.0에서 허용되지 않는 code point는 정상 값으로 우회시키지 않는다. CDATA 안의 `&#…;`는 문자 참조가 아니라 리터럴이므로 다시 해석하지 않는다. 공백·`0`·`false`·실제 수식과 비어 있지 않은 CDATA는 값으로 유지한다.

**fix-3 입력 계약·명시 제외·oracle 한계** — 이 helper의 생산 입력은 우리 ExcelJS writer가 만든 접두 없는 XLSX XML이며 범용 XML validator가 아니다. 범용 DTD·외부 엔티티, namespace 접두 요소(`x:row`·`x:c`·`x:t`), 사용자 제공 임의 XLSX의 XML 의미 검증은 명시 제외한다. 접두 요소는 현행 ExcelJS와 스캐너가 모두 무시한다는 제한된 일치일 뿐 namespace 지원으로 해석하지 않는다. 반대로 비어 있지 않은 CDATA는 XML 의미상 실제 문자이고 LibreOffice가 보존하지만 ExcelJS 재개방은 버리는 oracle 한계가 있으므로, ExcelJS 일치를 만들기 위해 해당 문자를 삭제하는 방식은 기각했다.

**fix-3 반례·확장·비용·사용자 파일 판정** — astra 최소 반례 32건 원본(SHA-256 `6fcc0a34…15a5ba3`)은 32/32 통과했다. 별도 확장 하니스는 6개 셀 표현×8개 값×4개 배치×15개 문법 profile의 **2,880/2,880**을 시트별 ExcelJS 재개방·공용 전체/maximum=1·보조·생산 수락과 일치시켰고, 십진·16진 엔티티는 384건이다. 기준 HEAD `cbe491a`의 공용 모듈만 되돌린 fix-3 mutant는 같은 최소 반례에서 16 pass/16 fail로 실패했다. 손상·대량 스캐너 비용 표본은 15종×4크기 **60/60**이 10초 상한 안에 끝났고 최대는 8MB 자체 닫힘 셀 표본 **815.043ms**였다. 50,000레코드×13열·9시트 보고서는 2,525,550B, 생성 5,762ms, 검사 279/201/181ms였다. 별도 안전 사본에서 사용자 파일 두 개를 재측정한 결과 matched 713·changed 37·added 48·duplicate 4, 보고서는 9시트·856행·95논리 열·폭 12~48·잘못된 폭 0이며 LibreOffice Summary CSV는 99B/9행이었다. 원본 probe의 전후 SHA가 같고 원출력·생성물은 `/tmp/worklazy-xr-fix3/`에 보존했다. — Codx

**fix-3 완료 검증** — 전용 `TMPDIR`·npm cache와 `NODE_OPTIONS=--max-old-space-size=4096`에서 `./node_modules/.bin/tsc -b`, 전체 unit **263/263**, build 2,835 modules·정적 61페이지, `test:static`, `test:excel-compare`, `test:excel-cleaner`, `test:qr-bulk`, 전체 `test:browser`, `bundle:measure`, `css:orphans`, route 20개 검사와 `git diff --check`가 모두 exit 0이었다. 브라우저는 `127.0.0.1:4330 --strictPort`, QR 임시 프록시는 4331로 고정해 직렬 실행하고 모두 종료한 뒤 bundle을 측정했다. 안전 오류 주입도 ko/en 모두 `REPORT_INTEGRITY_FAILED` 코드 하나, 다운로드 0, 내부 구현 명칭 노출 0으로 통과했다. 변경은 공용 XML 해석·unit·기록에 한정돼 사용자 문구·URL·SEO/정적 입력·광고 배치와 격리 경로·GitHub Pages 실행 구조·의존성은 바뀌지 않았다. — Codx

**fix-4 R3-writer 실측·입력 계약 보강** — 실제 ExcelJS writer에 셀 값과 시트명 `A<문자>B`를 넣어 29개 C0 금지 제어문자, 허용되는 탭·LF·CR, 짝 없는 서로게이트 4종, U+FFFE·U+FFFF를 각각 검사했다. C0 29종은 ExcelJS가 XML에서 조용히 삭제해 재개방 값이 `AB`가 되었고, 이는 XML 파싱에는 안전해도 위치·개수 보존 계약상 문제다. 짝 없는 서로게이트는 UTF-8 직렬화에서 이미 U+FFFD 하나로 바뀌어 ExcelJS·ElementTree가 수락했다. U+FFFE·U+FFFF는 `sharedStrings.xml`·`workbook.xml`·`docProps/app.xml`에 원문으로 남아 ExcelJS가 `disallowed character`, ElementTree가 `invalid token`으로 거부했다. 허용 제어문자는 sanitizer가 바꾸지 않으며 셀의 탭·LF는 그대로, CR은 XML 개행 정규화로 LF가 됐다. 시트명 속성의 탭·LF·CR은 XML 속성 공백 정규화로 공백이 됐지만 모두 well-formed였다. 정상 서로게이트 쌍도 보존됐다. 따라서 C0를 기존처럼 삭제하는 방식은 기각하고, 공용 `writeUntrustedText`와 시트명 경계에서 각 금지 UTF-16 code unit을 U+FFFD 하나로 명시 치환했다. 정상 서로게이트 쌍은 건너뛰고 짝 없는 서로게이트는 같은 결과를 writer에서 결정적으로 만든다. R3는 정상 UTF-8 CSV가 도달하는 **우리 writer 산출 결함**이므로 fix-3의 “사용자 제공 임의 XLSX 의미 검증 제외”에 포함하지 않는다.

**fix-4 backstop·소비처·비용 판정** — 직렬화 직전 공용 값 검사는 모든 worksheet 이름과 사용 중인 cell value의 문자열·수식 결과·rich text 구조를 순회해 남은 XML 1.0 금지 문자를 발견하면 기존 `REPORT_INTEGRITY_FAILED` 코드로 종료한다. ExcelJS 전체 재개방은 추가하지 않았다. 50,000행×13열·9시트, 650,021셀 표본의 값 스캔은 **115/113/117ms**, 같은 50,000레코드 비교 보고서는 생성 **5,824ms**, 기존 ZIP 무결성 검사는 **273/206/188ms**였다. Excel 정리의 보존 셀·수식·시트명은 공용 텍스트 setter를 우회하므로 동일 sanitizer와 공용 직렬화 backstop에 연결했고, Excel 비교와 QR manifest는 기존 공용 보고서 경계로 자동 적용됐다. 세 소비처의 경계 산출물을 ExcelJS·ElementTree·LibreOffice에서 각각 3/3 재개방해 비교 `left�right`, 정리 `A�B�C�D�E`, QR `A�B`를 확인했다. astra 원본 R3 probe는 무수정 **2/2**, writer sanitizer만 이전 대입으로 바꾼 mutant unit은 **9 pass/1 fail**로 검출됐다.

**fix-4 회귀·제품 영향 판정** — CSV 실제 parser→compare→9시트 보고서에서 C0 29종·U+FFFE·U+FFFF와 정상 한글·이모지·`&<>"'`·탭·개행을 입력 그대로 파싱한 뒤 기대 위치에 U+FFFD를 보존했고, ExcelJS·ElementTree·LibreOffice가 모두 수락했다. 1~3차 원본 probe는 **2/2·2/2·5/5·32/32**, 독립 확장은 **2,880/2,880**, 새 경계는 126건 단언과 실제 writer 29/29, 지정 음성 **6/6**·양성 **4/4**, 손상 스캐너 **60/60**, 문자 참조 비용 **32/32**를 통과했다. 폭 경계 `[12,13,47,48,48]`, 50,000/150,000행, 9시트·13열·토폴로지와 사용자 파일 **713/37/48/4·856행·폭 12~48**도 유지됐다. 전체 unit **266/266**, build 2,835 modules·정적 61페이지, static·Excel 비교·Excel 정리·QR 일괄·전체 browser·bundle·CSS orphan·20 route와 ko/en 안전 오류 경로를 통과했다. QR 스모크 최초 실행은 경계 manifest 확인 뒤 기존 PDF 취소 시나리오의 버튼 교체 레이스에서 실패했고, 동일 명령 재실행은 전 항목 통과해 두 원출력을 모두 보존했다. UI·사용자 문구·URL·SEO/정적 입력·광고 배치/격리·서버 전제·의존성 변경은 없다. 원출력과 산출물은 `/tmp/worklazy-xr-fix4/`에 보존했다. — Codx

**fix-5 R4-numFmt 원인·정책 판정** — 지원되는 BIFF8 `.xls`의 `numberFormat` 문자열이 `writeCleanedCell`의 보존 대입을 통해 ExcelJS `numFmt` 속성으로 그대로 직렬화되었고, U+FFFE·U+FFFF가 `xl/styles.xml` 속에 남아 재개방을 깨뜨렸다. 이 경로는 ZIP/XML을 변조하지 않은 **지원 입력→우리 writer 산출**이며 `3270512`에서도 2/2 재현된 기존 결함이지 fix-4 회귀가 아니다. 시트명·셀 값에서 이미 택한 자리별 U+FFFD 치환을 보존 `numberFormat`과 `style.numFmt` 우회 대입에도 같이 적용했다. 드문 코드 포인트 하나 때문에 정리 전체를 `REPORT_INTEGRITY_FAILED`로 종료하는 안전 거부는 사용자 손실이 더 크고 기존 writer 정책과도 달라져 기각했다.

**fix-5 동일 필드 우회·backstop 범위** — 세 소비처의 실행 경로를 재귀 검색한 결과, 입력 유래 숫자 서식을 직렬화하는 우회는 Excel 정리의 `target.style = source.style` 안 `style.numFmt`과 `target.numFmt = source.numberFormat` 두 곳이었다. Excel 비교·QR 일괄은 공용 writer가 안전한 상수 `@`만 설정하고, 비교 정규화의 `style.numFmt`는 비교용으로만 읽히며 산출 workbook에 복사되지 않았다. 신규 workbook의 creator는 제품 상수이고, Excel 정리는 정의된 이름을 복사하지 않고 셀에 scalar/formula만 쓰므로 docProps·정의된 이름·하이퍼링크에는 실제 입력 유래 R4 경로가 없어 코드를 넓히지 않았다. 공용 직렬화 전 backstop은 세 소비처 모두에서 시트명·사용 셀 값·`cell.numFmt`를 검사하며, `includeEmpty` 순회로 값 없는 서식 셀의 `numFmt`도 놓치지 않는다. 50,000행×13열·9시트, 650,021셀 표본의 확장 스캔은 **131/125/116ms**로 직전 **122/117/115ms**와 동급이었다.

**fix-5 문자 보존·재개방 판정** — 공용 sanitizer는 CR을 그대로 반환하고, 정상 보조 평면 서로게이트 쌍(이모지)과 U+FDD0~U+FDEF 32개를 모두 보존했다. 이후 셀 CR→LF·속성 CR→공백과 숫자 서식 escape `\`의 ExcelJS 재파싱 표현은 serializer/parser의 기존 정규화이며 sanitizer 변형과 구분했다. `#`·`0`·`,`·`.`·`;`·`"`·`\`·`yyyy-mm-dd`·통화 기호·한글·이모지와 숫자 `123`은 sanitizer 전후 동일했고, 실제 BIFF8 parser→정리→출력에서 U+FFFE·U+FFFF만 기대 자리의 U+FFFD로 바뀌었다. astra 원본 style 안전 probe는 무수정 **2/2**, 경계 probe는 두 건 모두 `unsafeStylesXml=false`·ExcelJS error `null`이었다. 실제 브라우저 출력 2건은 각각 숫자 123·`0"A�B"`를 보존했고 ExcelJS와 ElementTree(14 XML part)가 모두 재개방했다. fix-4 두 파일을 되돌린 mutant는 같은 원본 probe에서 **0/2**, 둘 다 `disallowed character`를 재현했다.

**fix-5 회귀·완료 검증** — 문자 독립 전수 **1,114,112/1,114,112**와 34 workbook의 ExcelJS·ElementTree·LibreOffice 재개방, 원본 probe **2/2·2/2·5/5·32/32·2/2**, 독립 확장 **2,880/2,880**, 지정 음성 **6/6**·양성 **4/4**, 스캐너 **60/60**·참조 비용 **32/32**, 폭 `[12,13,47,48,48]`·50,000/150,000행·9시트·13열·토폴로지를 통과했다. 사용자 파일은 **713/37/48/4·9시트·856행·95열·폭 12~48**, 54,122B이고 LibreOffice Summary CSV는 99B/9행이었다. 전체 unit **267/267**, build **2,835 modules·61 정적 페이지**, static·Excel 비교·Excel 정리·QR 일괄·전체 browser·bundle(80 JS/1 CSS)·CSS orphan 0·20 route·`git diff --check`를 통과했다. QR 스모크 경합은 이번 실행에서 재발하지 않았다. 초기 토폴로지·3-reader 재현은 각각 산출물 의존순서·LibreOffice 파이프 경로를 검수 격리에서 빠뜨린 하니스 실행 오류였고, 원본을 바꾸지 않은 직렬 재실행으로 모두 통과했으며 최초·정정 출력을 보존했다. UI·ko/en 문구·URL·SEO/정적 페이지·광고 배치/격리·서버 전제·의존성은 변경하지 않았다. 원출력과 산출물은 `/tmp/worklazy-xr-fix5/`에 보존했다. — Codx

### XLSX 보고서 R5 희소 backstop 회귀 수리·기록 정정 (Codx)

**R5 원인·수리 판정** — R4는 지원 BIFF8 숫자 서식이 malformed XLSX로 이어지던 기존 결함이고, R5는 fix-5가 값 없는 서식 셀을 잡기 위해 추가한 `worksheet.eachRow({includeEmpty:true})`·`row.eachCell({includeEmpty:true})`가 만든 별도 회귀다. ExcelJS의 이 순회는 빈 좌표마다 `getRow`·`getCell`을 호출해 실제 객체를 생성하고 workbook에 남긴다. 50,000행의 M열만 존재하는 표본은 Cell **50,001→650,001**, 150,001행 공백 표본은 Row **2→150,001**, 40행×16,384열 표본은 Cell **41→655,361**로 늘었다. fix-5의 밀집 650,021셀 측정 자체는 참이지만 빈 좌표가 없는 표본만으로 희소 비용도 동급이라고 닫은 판정은 불충분했다. 수리는 `rowCount` 범위에서 `findRow`, 각 기존 행의 `cellCount` 범위에서 `findCell`만 호출하는 공개 조회 순회로 한정했다. `includeEmpty:false`로 되돌리지 않아 값 없는 style-only Cell과 실제 Cell에 복사된 행·열 상속 `numFmt` 여섯 표본은 계속 검사했지만, Cell과 별개로 Row/Column 객체 자체에만 저장된 `numFmt`까지 보장한 것은 아니었다. 그 제한과 후속 수리는 아래 R6 기록으로 분리한다.

**R5 결정적 객체 단언·실측** — 같은 대규모 희소 세 표본에서 실제 객체 수는 순회 전후 각각 Row/Cell **50,001/50,001→동일**, **2/2→동일**, **41/41→동일**이었고, 값 없는 안전 서식 셀을 포함한 작은 unit도 **3/3→3/3**을 고정했다. 값 경로 6건(시트명·scalar·formula·cache·rich text·hyperlink)과 값 없는 `numFmt` 6건(직접·style·빈 행·희소 마지막 열·행 상속·열 상속)은 모두 `REPORT_INTEGRITY_FAILED`, serializer 호출 **0**이었다. astra와 동일한 43,165B·4,412실제셀 표본은 fix-4 **208.6ms**·fix-5 **6,485/9,218/6,568ms**에서 fix-6 **244.383ms·max RSS 193,392KiB**로, 166,209B·19,512실제셀 표본은 fix-4 **675.5ms**·fix-5 60초 제한 초과에서 fix-6 **725.462ms·326,520KiB**로 돌아왔다. 둘 다 5시트·마지막 값까지 ExcelJS로 재개방했고 모든 XML/rels 14개를 ElementTree로 파싱했으며, 데이터 시트 실제 셀은 **4,412/19,512**, 데이터행 `spans`는 `512:512`였다. 밀집 650,021셀은 fix-6 **117.310/117.684/113.878ms**로 fix-4 **123.4/117.5/115.9ms**, fix-5 **129.8/138.5/139.9ms** 대조 범위 안이고 Row/Cell 수도 불변이다. 정확한 ms를 unit 임계값으로 쓰지 않고 객체 수 불변을 결정적 회귀로 삼았다.

**fix-5 동일 필드·metadata 기록 정정** — “글꼴·색·테두리 또는 모든 스타일 문자열에 입력 유래 경로가 없다”는 설명을 폐기한다. 실제 OOXML 경로는 `comparableStyle`→cleaner 모델 clone→`target.style`이며 정상 스타일은 출력에 보존된다. 다만 `font.name`·`font.scheme`·`font.color.argb`·`fill.fgColor.argb`·`border.left.color.argb`의 U+FFFE/U+FFFF **10건**은 inputAdapter가 먼저 거부하고, BIFF8은 style 객체를 전달하지 않아 R4처럼 우회하지 못했다. 따라서 경로는 있으나 입력 단계에서 차단되며, 이번 수리에서 sanitizer를 확대하지 않는다.

| 필드 | 실제 입력→출력 결론 |
|---|---|
| 정리 `numberFormat`·`style.numFmt` | 두 출력 대입 모두 공용 sanitizer를 거치며 backstop이 값 없는 셀까지 재검사한다. |
| 비교 정규화 `style.numFmt` | 비교 판정용 읽기이며 style 객체는 보고서로 복사되지 않는다. 입력 서식이 반영된 display text는 공용 텍스트 sanitizer와 상수 `@`를 거친다. |
| QR | display lookup의 문자열만 공용 writer로 보내고 입력 style 객체는 복사하지 않으며 `@`는 제품 상수다. |
| docProps | 비교·정리·QR creator는 제품 상수이고 입력 title/author/subject/lastModifiedBy를 복사하지 않는다. |
| 정의된 이름 | 입력 수식 강등 판정에는 쓰지만 새 정리 workbook으로 복사하지 않는다. |
| 하이퍼링크·주석·조건부 서식 | hyperlink는 표시 scalar로 정규화하고 URL 관계, 주석, 조건부 서식은 cleaner 모델·출력으로 옮기지 않는다. |
| 글꼴·색·테두리·정렬·보호 | OOXML style 보존 경로가 있다. 위 10개 금지 문자 표본은 inputAdapter가 차단하고 BIFF8은 style 객체를 전달하지 않는다. |
| worksheet 속성 | 새 시트에 이름·선택 셀·병합·제품 고정 view/폭만 쓰며 입력 tabColor·headerFooter·pageSetup은 복사하지 않는다. |

**기존 oracle·종료성 기록 정정** — 원본 3차 CDATA 행렬은 **2,764/2,880·exit 1**이며 116건은 ExcelJS가 비어 있지 않은 CDATA 문자를 누락해 생긴 oracle 불일치다. 이를 원본 행렬 100% 통과로 기록하지 않는다. 독립 ElementTree 의미 검사는 **192/192**, scanner 불일치 **0**으로 별도 확인했다. scanner/reference 종료성 **60/60·32/32**는 각 10초 제한의 기존 XML 표본 결과일 뿐, fix-5의 새 희소 writer가 60초를 넘은 일을 통과했다는 뜻으로 확대하지 않는다.

**fix-6 회귀·제품 영향 판정** — 원본 R1/조합/요소/lexical/R3/R4 probe는 **2/2·2/2·5/5·32/32·2/2·2/2**, 독립 확장 **2,880/2,880**, 지정 음성 **6/6**·양성 **4/4**, 문자 전수 **1,114,112/1,114,112**와 34 workbook의 ExcelJS·ElementTree·LibreOffice 재개방, 폭 `[12,13,47,48,48]`·50,000/150,000행·9시트·13열·토폴로지를 통과했다. 사용자 파일은 **713/37/48/4·9시트·856행·95열·폭 12~48**, 54,121B였다. 전체 tsc, unit **269/269**, build **2,835 modules·61 정적 페이지**, static 104문서, Excel 비교·정리·QR 일괄·TEST_SCOPE 미설정 전체 browser, bundle **80 JS/1 CSS**, CSS orphan 0, route 20개를 모두 실행해 통과했다. 첫 희소 측정 probe는 출력 객체 자체를 `writeFile`에 넘긴 하니스 오류로 exit 1이었고 `output.buffer`로 바로잡은 동일 제품 경로가 통과했으며 최초 로그도 보존했다. UI·ko/en 문구·URL·SEO/정적 페이지·광고 배치/격리·서버 전제·의존성은 바뀌지 않아 추가 현지화·SEO·AdSense 수정은 불필요하다. 원출력과 산출물은 `/tmp/worklazy-xr-fix6/`에 보존했다. — Codx

### XLSX 보고서 R6 행·열 numFmt style-gap 수리 (Codx)

**R6 원인·범위 판정** — fix-6은 기존 Cell만 `findCell`로 읽으므로 Cell과 별개로 저장된 Row/Column `style.numFmt`를 보지 못했다. fix-5의 생성 순회는 빈 Cell을 만들 때 부모 style을 Cell에 복사해 우연히 이 경로도 검출했다. 따라서 `C2`만 존재하는 상태에서 B열 `column.style.numFmt`, 또는 2행 `row.style.numFmt`에 금지 문자를 둔 두 경우가 fix-5의 안전 오류·serializer 0에서 fix-6의 성공 반환·serializer 1·malformed `styles.xml`로 퇴행한 것이 **R6의 새 회귀 두 건**이다. 반면 마지막 Cell 밖 M열 style-only, Cell 없는 시트의 열 style, 높이가 있는 style-only 행은 fix-5도 놓친 **기존 Row/Column 사각지대**이므로 새 회귀로 합산하지 않는다. 높이도 Cell도 없는 행 style은 ExcelJS가 직렬화하지 않지만 같은 `numFmt` 검사 범위에서 보수적으로 거부한다.

**수리·결정적 단언** — 각 worksheet의 실제 저장 `columns` 컬렉션을 `columnCount`로 자르지 않고 조회해 `column.numFmt`를 먼저 검사하고, `rowCount` 범위의 `findRow`가 반환한 기존 Row의 `row.numFmt`를 Cell 순회와 독립적으로 검사한다. 기존 시트명·Cell 값·Cell `numFmt` 검사는 유지했다. `getRow`·`getCell`, `includeEmpty` 생성 순회, parser/engine/UI/QR·다른 metadata 확장은 넣지 않았다. astra 최소 원본은 무수정 **2/2**, 13조건 표본은 모두 `REPORT_INTEGRITY_FAILED`·serializer **0**이고 모든 표본의 Row/Cell 수가 전후 동일했다. 정상 단언에서는 `columnCount=3`인 시트의 저장 열 컬렉션 길이 **20**과 Cell 없는 B열·75행까지 검사한 뒤 Row/Cell **4/3→4/3**을 유지했고, 직렬화·재개방 뒤 값 `123`, Cell·Row·Column의 한글·이모지·통화·날짜·숫자 서식을 그대로 보존했다. 기존 값 6건과 Cell 기반 `numFmt` 6건도 각각 같은 안전 오류·serializer 0을 유지했다.

**R5 비용·희소 출력 보존** — 결정적 대규모 희소 세 표본은 각각 Row/Cell **50,001/50,001**, **2/2**, **41/41**로 전후 불변이었다. 밀집 **650,021셀·50,009행** 검사 세 번은 **153.460/129.062/122.234ms**였으며 단일 수치를 unit 임계값으로 쓰지 않았다. 동일 SHA의 43,165B·4,412실제셀과 166,209B·19,512실제셀 입력을 실제 parser→preflight→engine→writer로 재측정한 출력 단계는 각각 **292.689ms·max RSS 188,072KiB**, **734.029ms·347,148KiB**였다. 둘 다 5시트·SR3901/SR19001 값을 ExcelJS로 재개방했고 ElementTree가 XML/rels 14개, 실제 Cell **4,412/19,512**, 데이터행 `spans="512:512"`를 확인했다. fix-5의 6,485~9,218ms·60초 초과 회귀는 재발하지 않았다.

**도달성·사용자 파일 1바이트 판정** — 심각도는 P3 공용 writer 방어 회귀다. 비교·QR은 안전한 Cell `@`만 쓰고 정리는 입력 `numberFormat`·Cell style을 안전화해 대상 Cell에 쓰며, 세 소비처 어디에도 입력 Row/Column style 객체를 출력 Row/Column으로 복사하는 대입이 없다. malformed 다섯 표본은 제품 inputAdapter가 먼저 거부하므로 현재 지원 UI 입력에서 같은 손상 출력에 도달한다는 P2 근거는 없다. 사용자 파일 재실측은 **713/37/48/4·9시트·856행·95열·68 col 태그·폭 12~48**, 잘못된 폭 0을 유지했다. 앞선 54,122B/54,121B 차이는 `core.xml` 생성 시각 `2026-09-07T10:39:03Z`/`11:22:57Z`의 deflate 크기 **362B/361B** 차이이며, created/modified 외 모든 ZIP part의 압축 해제 바이트가 동일하다. 시각 고정 네 버전은 모두 **54,120B**와 동일 SHA였으므로 이를 데이터 누락이나 유령 Cell 제거로 해석하지 않고 byteLength 하나를 불변 계약으로 고정하지 않는다.

**R6 회귀·완료 검증** — 원본 R1/R2-R1/조합/요소/lexical/R3/R4 probe는 **2/2·2/2·2/2·5/5·32/32·2/2·2/2**, 독립 확장 **2,880/2,880**, 지정 음성 **6/6**·양성 **4/4**, 문자 전수 **1,114,112/1,114,112**와 34 workbook·70셀의 ExcelJS·ElementTree·LibreOffice 재개방을 통과했다. 원본 CDATA 행렬은 알려진 oracle 한계 그대로 **2,764/2,880·exit 1**이고 독립 ElementTree 의미 검사는 **192/192**·scanner 불일치 0이며, scanner/reference 종료성은 기존 표본 범위에서 **60/60·32/32**다. 폭 `[12,13,47,48,48]`, 50,000/150,000행, 9시트·13열·토폴로지, Excel 비교·정리·QR 일괄과 TEST_SCOPE 미설정 전체 browser를 통과했다. ko/en worker 주입은 Row/Column `numFmt`·Cell 값·폭 오류 모두 안전 안내·오류 코드 한 건·다운로드 0이었다. 전체 tsc, unit **270/270**, build **2,835 modules·61 정적 페이지**, static 104문서, bundle **80 JS/1 CSS**, CSS orphan 0, route 20개와 `git diff --check`를 통과했다. 최초 R2-R1 격리 실행의 이전 review1 artifact 경로 EROFS와 최초 3-reader bwrap 실행의 LibreOffice pipe 오류는 각각 빠진 artifact bind와 격리 pipe 경로 때문이었고, 원본 probe/제품을 바꾸지 않은 정정 실행이 통과했으며 최초·정정 로그를 모두 보존했다. UI·문구·URL·SEO/정적 입력·광고 배치/격리·GitHub Pages 구조·의존성은 바뀌지 않아 추가 현지화·SEO·AdSense 변경은 불필요하다. 원출력과 산출물은 `/tmp/worklazy-xr-fix7/`에 보존했다. — Codx

**사용자 파일 실측** — 읽기 전용 원본 `2026년 설 선물 발송처_20260204_취합중.xlsx`(19,605B, SHA-256 `3152fb51…6a4a9`)와 `2026년 설 선물 발송처_20260204_취합_송창훈.xlsx`(20,263B, `faab6f10…319cf`)를 기존 보고서 Parameters와 같은 `최종` 시트·헤더 1행·키 2열·중복 오류 정책으로 다시 비교했다. 결과는 matched 713·changed 37·added 48·duplicate 4이고 새 54,122B 보고서는 9시트·논리 열 95개·데이터 행 856개, 폭 최솟값 12·최댓값 48·비유한/0 폭 0개였다. 기존 다운로드 보고서는 custom-width `<col>` 95개 모두 `width`가 없었고, 새 보고서는 병합 직렬화된 `<col>` 태그 68개 모두 `width`가 있으며 누락 0개였다. LibreOffice headless 변환도 exit 0이며 첫 시트 CSV는 99B/9행으로 `matched,713`, `changed,37`, `added,48`을 보존했다. R1 보정 뒤 이 54,122B 산출물을 새 생산 검사와 독립 ExcelJS 재개방으로 다시 측정해 9시트·713/37/48/4·데이터 856행·논리 열 95개·폭 12~48가 그대로이고 비유한/0 폭이 0임을 확인했다. 원본은 수정·복사·스테이징하지 않았고 생성물과 원출력은 `/tmp/worklazy-xr-out/`과 `/tmp/worklazy-xr-fix1/logs/`에만 뒀다.

**완료 검증** — 전용 `TMPDIR`·npm cache와 `NODE_OPTIONS=--max-old-space-size=4096`에서 `./node_modules/.bin/tsc -b`, 전체 unit 252개 상위 테스트·하위 포함 259/259, 표준 build 2,835 modules·정적 61페이지, `test:static`, `test:excel-compare`, `test:excel-cleaner`, `test:qr-bulk`, 전체 `test:browser`, `bundle:measure`, `css:orphans`, `node tests/tool-registry-routes.mjs`, `git diff --check`가 모두 exit 0이다. 브라우저는 단일 production preview `127.0.0.1:4330 --strictPort`에서 직렬 실행했고 QR 테스트 보조 프록시는 저장소 밖 preload로 4331에 고정했다. Excel 비교의 9시트 다운로드, Excel 정리의 5시트/논리 열 33개/데이터 18행, QR 일괄의 2시트 manifest 모두 독립 raw XML 폭 단언을 통과했다. 원출력은 `/tmp/worklazy-xr-out/`과 `/tmp/worklazy-xr-fix1/logs/`에 보존했다.

**동반 영향 검토** — 사용자 문구·URL·기능 의미·SEO 메타데이터·정적 페이지·FAQ·광고 배치와 광고 제외 격리 경로는 바뀌지 않는다. 기존 ko/en 안전 오류 문구를 그대로 사용하고 정적 GitHub Pages 실행 구조와 새 의존 없음 계약을 유지하므로 이 표면의 추가 현지화·SEO·AdSense 수정은 불필요하다.

## 2026-09-06

### S2b QR 라벨 PDF 한글 글꼴 감량 — 브랜치 구현·검증 (Codx)

**착수 게이트·정지점** — `PROJECT_RULES.md` 전문을 첫 행동으로 읽고 디스패치, `AGENTS.md`, 정본 `qr-font-20260906.md`의 「v3 확정」·「정본화 보강」, 로드맵 결정 10·11, R3 보고서·고정 draft·관련 기각 이력을 확인했다. 시작 시 `HEAD=main=f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`, `origin/main=1a04f257…`였고 추적 변경은 `AGENTS.md` 하나, 사용자 미추적 파일은 `before.docx`·`after.docx`·네이버 확인 HTML이었다. 열린 작업계획서 16개와 상반 지시가 없음을 확인한 뒤 `s2b-qr-font`를 분기했다. 첫 커밋 `c680030`은 사용자 지시대로 기존 `AGENTS.md` 변경만 담았다. 정본 계획서는 수정하지 않았고 사용자 파일 세 개도 건드리지 않았다. 이번 정지점은 **브랜치 커밋·전체 검증·QA dist 보존까지**이며 main 병합·push·배포는 하지 않는다.

**공급 경계·재현 레시피** — 원본 전체 OTF 경로와 `QR_LABEL_FONT_PATH` 의미는 유지했다. 저장소에는 raw subset OTF 대신 아래 5개 생성 입력, 합계 **606,249B**만 추적한다. 일반 prebuild의 Node 벤더는 로컬 gzip·coverage·provenance를 먼저 검증하고 bounded gunzip한 뒤 원본 OTF·OFL까지 모두 확인한다. 이후 staging에서 전체/서브셋 두 소유 snapshot만 교체하고 실패 시 rollback한다. public의 subset snapshot과 `dist`는 생성물이라 추적하지 않는다.

| 추적 입력 | 바이트 | SHA-256 |
|---|---:|---|
| `unicodes-alias.txt` | 23,757 | `ac8fefb54a969022fc1b139a3a7a1937f711e71280fb992683eb0d4d43978b0c` |
| `NotoSansKR-Regular.ksx1001.otf.gz` | 561,161 | `e1db3cdcbb8d76fc0546ec582bed773b3b7ef3da60867b6828493a6b342c7e66` |
| `coverage.json` | 19,686 | `58f248442d4e8e5726559644a746740bd0066cebabf154956e0bb7e1458eafea` |
| `coverage.schema.json` | 444 | `919d01b6713b3438f6cd36091d3244a04a28822b031a5cdd7ac135ff3d17e6b0` |
| `provenance.json` | 1,201 | `30e10e1815835b8076a100ecdc9804c2613b115b555cbcc0b122150b92f77667` |

명시 재생성만 `/tmp` venv에서 `fonttools==4.59.2` wheel SHA `738f31f2…9464e`를 `pip install --require-hashes -r scripts/requirements-fonts.txt`로 설치한 뒤 `scripts/build-qr-label-font-subset.py`를 실행한다. 옵션은 `--layout-features=* --name-IDs=* --name-languages=* --name-legacy --notdef-glyph --notdef-outline --no-recalc-timestamp --retain-gids`다. 스크립트는 원본·목록 SHA와 fontTools/GNU gzip 1.12를 고정하고, subset cmap exact equality 및 3,394 코드포인트의 GID·hmtx·RecordingPen outline 차이 0을 확인한다. `gzip -n -9 -c`까지 모든 고정 SHA가 맞은 뒤에만 같은 파일시스템 staging에서 추적 입력을 **파일별 `os.replace`**로 교체한다. 실제 재생성은 `cmap=3394 size=931704 gzip=561161 glyph-differences=0`으로 통과했다.

최종 3,394 코드는 KS X 1001 현대 한글 2,350자와 ASCII·Latin-1·한글 자모·General Punctuation(U+2026 포함)·통화·CJK 구두점·호환 자모·전각 문자 중 원본 cmap에 있는 3,095코드, 그리고 layout closure가 보존한 원본 매핑 299코드다. 요청 목록에만 있고 원본에 없는 123코드는 넣지 않았다. raw OTF는 **4,644,748B → 931,704B(−79.94%)**, 고정 gzip은 **3,733,457B → 561,161B(−84.97%)**다.

**런타임 선택·수명주기** — `qrLabelFont.ts`는 coverage schema·snapshot·개수·정렬·scalar·surrogate·U+2026을 런타임에도 엄격히 검사한다. 각 라벨의 실제 draw 문자열은 바꾸지 않고 공백 정리한 **원문과 NFC 양쪽**을 `for…of` 코드포인트로 검사한다. 둘 다 포함될 때만 subset, 범위 밖 문자·NFD 결합문자·이모지·한자·잘못된 coverage는 처음부터 full을 고른다. 8,192코드마다 8ms를 넘으면 task를 양보하고 AbortSignal을 확인한다.

폰트 loader는 panel별 lazy factory이며 모듈 전역 cache가 없다. named asset 두 개만 size+SHA 검증 뒤 ArrayBuffer로 보관하고 404/503·network/body 오류·빈/HTML/잘린/동일 크기 손상 subset은 cache하지 않은 채 full을 한 번만 시도한다. PDF 클릭 뒤 coverage·폰트, PDF helper, 저장 PNG 읽기를 즉시 병렬 시작하되 클릭 전 prefetch는 하지 않는다. ZIP·PDF는 같은 동기 lease/token을 사용하고 파일 교체·재생성·취소·run 실패·unmount에서 Abort와 cache dispose를 함께 수행한다. `PDFDocument.create`와 PNG read/embed·draw·save는 typed catch 밖이며 `registerFontkit`/`embedFont`만 `QrLabelFontInitError`로 감싼다. 선택된 subset의 이 좁은 초기화 단계가 실패할 때만 PNG를 다시 읽지 않고 새 PDFDocument+full OTF로 한 번 재생성한다. 최종 Blob 뒤에도 task를 한 번 양보하고 token을 재검사한다.

**3시나리오 실제 전송량** — QA production·Chrome 152·새 브라우저/context·SW 차단·cache off·무스로틀 로컬 preview·NetLog encoded body+HTTP header 기준이다. corrupt는 브라우저 route mock 없이 same-origin reverse proxy가 정확한 subset OTF 경로의 50번째 바이트만 바꾼다. 각 PDF의 embedded raw OTF stream은 정확히 1개이고 아래 expected size/SHA와 일치했다. 이전 S2의 같은 4단계 PDF 기준은 **5,153,562B / JS gzip 508,018B / 누적 6,067,785B**다.

| 시나리오 | 요청 폰트 | PDF 단계 요청 / 전송 B | 기준 대비 | 누적 전송 B | 출력 PDF / embedded OTF |
|---|---|---:|---:|---:|---:|
| `subset` | subset 1회 | 3 / **1,450,793** | **−3,702,769B (−71.85%)** | 2,365,596 | 603,829B / 931,704B `b84d27a5…a252be` |
| `full` | full 1회 (`똠` 1자) | 3 / **5,163,839** | +10,277B (+0.20%) | 6,078,642 | 3,854,300B / 4,644,748B `69975a0a…148d68` |
| `corrupt` | 손상 subset → full | 4 / **6,095,694** | +942,132B (+18.28%) | 7,010,497 | 3,854,297B / 4,644,748B `69975a0a…148d68` |

subset OTF 자체의 로컬 identity 전송은 932,057B, full은 4,645,103B다. corrupt proxy 응답은 931,855B이고 이어 full 4,645,103B를 받았다. 세 경우 모두 **QR 라벨 OTF 요청**은 PDF 완료 단계에서만 발생했고 cache/SW hit와 외부 요청은 0이었다. full은 지원 범위 밖 문자를 보존하는 정상 경로이고 corrupt는 무결성 방어 비용을 계측한 것이므로 두 값을 감량 실패로 해석하지 않는다.

**렌더 oracle** — 전체 OTF와 subset OTF를 제품 helper에서 모두 `subset:false`로 임베드하고 Poppler `pdftoppm -r 144 -png`의 RGBA를 전 픽셀 대조했다. PDF.js extraction JSON은 두 폰트 결과끼리 비교했다.

| fixture | preset / 라벨 / 페이지 | 전체 PDF B | subset PDF B | 비교 픽셀 | 변경 픽셀 | PDF.js |
|---|---|---:|---:|---:|---:|---|
| sample | A4 / 25 / 2 | 3,979,131 | 728,659 | 4,011,288 | **0** | 동일 |
| inventory(원본 cmap 교집합 3,095) | A4 / 155 / 7 | 4,742,244 | 1,491,805 | 14,039,508 | **0** | 동일 |
| expanded(최종 3,394) | Letter / 170 / 8 | 4,829,717 | 1,579,298 | 15,510,528 | **0** | 동일 |

Poppler는 두 폰트를 시각적으로 동일하게 렌더했지만 descriptor가 `FontFile2`이고 스트림은 `OTTO`인 기존 pdf-lib 경계 때문에 `Mismatch between font type and embedded font file` 경고를 낸다. Ghostscript는 원본 전체 OTF PDF부터 한글 tofu를 내므로 S2b oracle에서 제외했다. PDF.js도 일부 공백→`堺`, shaping 숫자→한자처럼 **입력과 다른 기존 추출**이 있다. 따라서 이번 게이트는 "전체와 subset 동일"이며 "입력과 완전 동일"이 아니다. 두 결함은 `docs/backlog.md`의 U4 관련 후속으로 이관했고 이번 범위에서 수리했다고 주장하지 않는다.

**B·C 판정** — Brotli는 기술적으로 전면 불가가 아니다. WHATWG/BCD에는 brotli stream이 있고 Safari 18.4·Firefox 147 지원 정보가 있으나 실측 Chrome 152는 지원하지 않으며, 원본 full OTF의 q11 감량은 14.85%로 빌드 타임 subset gzip 84.97%보다 작고 미지원 폴백 계약이 추가된다. 따라서 B는 **미채택**했다. C는 전송량을 줄이지 못하므로 클릭 후 자산·helper·PNG 읽기 병렬화만 보조 채택했고 클릭 전 prefetch는 기각했다. 런타임 `embedFont({subset:true})` 재시도도 기존 한글 누락 재현 때문에 계속 금지한다.

**production 번들 5종** — 기준은 구현 전 `main=f29d249` production `/tmp/s2b-bundle-baseline.json`, 현재도 production이고 override 없음·multiplier 1·신규 route 없음·귀속 이동 0B다. coverage JSON과 selector helper는 JS 지표 안에 포함된다.

| 지표 | main 기준 gzip B | 브랜치 gzip B | delta B | 상한 B | 판정 |
|---|---:|---:|---:|---:|---|
| entryJsGzip | 299,283 | 299,287 | +4 | 20,480 | 통과 |
| affectedRouteJsGzip | 2,440,427 | 2,450,827 | +10,400 | 61,440 | 통과 |
| sharedJsGzip | 2,716,489 | 2,716,473 | −16 | 30,720 | 통과 |
| appJsGzip | 5,456,199 | 5,466,587 | +10,388 | 81,920 | 통과 |
| cssGzip | 37,687 | 37,687 | 0 | 10,240 | 통과 |

**clean copy** — detached `0198036` worktree에서 `/tmp` npm cache를 사용해 `npm ci`(775 packages)를 수행했다. 소유 외 snapshot sentinel을 추가한 뒤 `npm run vendor:qr-font`를 2회 실행해 전체/서브셋 8파일+sentinel, 합계 9파일 SHA 목록이 완전히 동일하고 sentinel이 보존됨을 확인했다. 이어 Python 실행 없이 `npm run build`가 61페이지까지 통과하고 `dist`에 subset OTF가 존재함을 확인했다. 원본 full/OFL cache가 없으면 고정 upstream을 받는 현재 계약은 유지하며 완전 offline full 공급을 주장하지 않는다.

**완료 기준 검증** — 아래 최종 명령은 모두 exit 0이다. stdout/stderr 원문은 `/tmp/worklazy-s2b/logs/`, 구조화 결과는 `/tmp/worklazy-s2b/`에 보존했다. 마지막 `dist`는 `VITE_LOCAL_QA=1` 산출이다.

| 명령 | 실제 결과 |
|---|---|
| `npm run build` | production·벤더 고정값·정적 61페이지 통과; clean copy도 별도 통과 |
| `npx tsc -b --pretty false` | 진단 0 |
| `npm run test:unit` | **241/241**(신규 QR font 10건 포함) |
| `npm run test:qr-bulk` | cancel/cleanup/rerun·7 payload·ZIP 2 PNG·2-sheet manifest·subset/full/corrupt 3종 25라벨/2페이지/폰트 SHA·외부 요청 0 |
| `npm run test:utilities` | ko/en·도구·video 호환·PDF 범위 통과 |
| `npm run test:static` | 현지화·hreflang·런타임·ads/robots/sitemap·startup 104문서 통과 |
| `npm run test:browser` | Excel·Word 비교·PDF edit/range/conversion 통과 |
| `npm run test:new-tools` | HWP·Image·Audio·Video 통과; 호스트 미지원 DV 실기능 분기는 기존 조건대로 skip, capability/fallback 단언 통과 |
| `npm run test:office` | 96 download·7 cache 상태·Calc 편집·DOCX 5,089B |
| `npm run test:recovery` | desktop+Android **147/147** |
| `LANG=ko_KR.UTF-8 … npm run test:visual` / `LANG=en_US.UTF-8 …` | 각각 **175/175**, 기준선 갱신 0 |
| `VITE_LOCAL_QA=1 npm run build` | 최종 QA dist·61페이지 |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | 8페이지·위반/외부 요청 0·placeholder 4.8871:1 |
| `npm run test:rendering` | 3페이지×3회 CLS 최대 0·외부 요청 0 |
| `BUNDLE_BASELINE=/tmp/s2b-bundle-baseline.json npm run bundle:measure` | 위 5종 상한 모두 통과 |
| `npm run css:orphans` | orphan selector arm 0 |
| `npm run legacy:manifest` | 153 removed / 0 split / 2 active |
| `node tests/tool-registry-routes.mjs` | 기대 20·누락/예상 외/중복 0 |
| `npm run measure:qr -- --scenario=subset|full|corrupt` | 위 3시나리오 전송·embedded SHA 통과 |
| `npm run test:qr-font-render` | 3 fixture·17페이지·33,561,324픽셀 차이 0·PDF.js 전체 대비 동일 |
| `git diff --check` | 공백 오류 0 |

**실행 중 실패·판정** — 최초 재생성 스크립트는 `/tmp` staging에서 저장소로 `os.replace`해 `EXDEV`가 났고 추적 입력은 불변이었다. staging을 `scripts/assets/qr-label-font/`와 같은 파일시스템으로 옮긴 뒤 고정 SHA 재생성에 통과했다. 첫 QR 스모크는 생성 결과가 보이는 즉시 PDF를 눌러 새 `busy` 비활성 계약에 걸렸다. 제품 계약을 완화하지 않고 버튼 enabled를 기다리도록 스모크를 고쳤다. typed PNG 음성 unit은 pdf-lib가 `Error` 객체가 아닌 raw 값을 던지는 경우가 있어 `instanceof Error` 기대를 없애고 **typed font-init이 아님**만 단언했다. clean copy의 첫 `npm ci`는 홈 npm cache가 read-only라 `EROFS`로 중단됐고 `/tmp` cache 지정 후 통과했다. production preview 4188 포트가 기존 프로세스에 점유돼 검증 전용 4190으로 분리했다. 새 제품 결함으로 분류하거나 게이트를 낮춘 경우는 없다.

**제품 규칙·범위** — 서버/API/SSR·새 npm runtime/devDependency·사용자 문구·route·SEO·사이트맵·광고/분석 경계 변경은 0이다. coverage·asset 오류와 내부 snapshot 명칭은 사용자에게 노출하지 않고 기존 ko/en PDF 오류로 귀결한다. public/vendor와 dist는 생성기로만 만들었다. CSV의 ExcelJS/JSZip 분리, `qrLabelPdf` 508KB 청크 감량, U4 공용 폰트 경계, jszip 제거, 기존 GS/PDF.js 결함 수리는 명시 제외를 유지한다. QA 감사·렌더링·QR 스모크/계측의 외부 요청은 0이다. 최종 브랜치만 남기며 main/origin/main은 이동시키지 않고 push하지 않는다.

**검수 소견 반영(F1·F2)** — F1의 정적 문자열 기반 export 검사를 실제 `QrBulkPanel` handler 본문을 TypeScript로 추출·실행하는 회귀로 교체했다. 이전 ZIP의 지연 실패/finally와 새 PDF의 경합에서 공용 lease가 `pdf`로 유지되고 이전 오류 메시지는 0이며, cancel·cleanup·run abort/error가 active export와 font loader를 무효화하고 `storageRef`를 `clear()` await 전에 분리해 새 storage를 보존하는지 실행 결과로 단언한다. PDF 버튼의 실제 JSX 식도 `busy=true`에서 비활성, 정상 idle에서 활성으로 평가한다. QR 전용 unit은 **15/15**, 전체 unit은 **246/246**이다. 별도 `/tmp` 사본에서 `finishExport`의 `if (!owned) return` 한 줄을 제거하고 같은 unit을 실행한 음성 대조는 기대대로 **exit 1·13 pass/2 fail**이며 핵심 실패 원문은 **`'' !== 'pdf'`**다.

F2는 same-origin scenario server가 정확한 subset OTF 경로만 HTTP 404로 응답하도록 확장했다. 브라우저 결과는 `font404`에서 **subset 404 1회 → full 1회**, 임베드 full OTF **4,644,748B / `69975a0a…148d68`**, 최상위 navigation reload **0**, `worklazy_tool_reload:` key **0**이다. 대조용 실제 빌드 `qrLabelPdf` lazy chunk 404는 reload **1**이었다. 같은 HTTP 경계를 지연시킨 채 결과 파일을 교체하면 font 요청은 subset 1회에서 중단되고 full 요청·stale PDF 다운로드는 **0**, 새 결과의 PDF export 버튼은 다시 활성화됐다. `page.route`/fetch mock은 사용하지 않았다. 기존 subset/full/corrupt 3시나리오와 PDF size/SHA 단언도 그대로 통과했다.

최종 실행은 `npm run test:unit` 246/246, `npm run test:qr-bulk` exit 0, `npx --no-install tsc -b --pretty false` 진단 0, 보존된 동일 HEAD production 산출물 대상 `npm run test:static` exit 0(startup 104문서), production preview 대상 `npm run test:utilities` exit 0이다. 첫 브라우저 수정 실행은 교체 CSV에서 유지 중인 `{{Label}}` 열을 빠뜨려 90초 timeout이 났고 fixture를 보정했다. Utilities 첫 실행은 preview 미기동으로 `ERR_CONNECTION_REFUSED`였으며 별도 production preview로 재실행했다. 테스트·기록만 변경했고 제품 코드·사용자 문구·자산·QA `dist`는 바꾸거나 재빌드하지 않았다. 원자료와 구현 보고는 `/tmp/worklazy-s2b-fix1/`에 둔다. — Codx

**재검수 F1-R 반영** — 실제 `QrBulkPanel` PDF handler가 완성 Blob을 받은 직후 큐에 든 cancel task를 마지막 양보에서 받아 다운로드·오류 메시지 없이 lease와 font loader를 해제하는 unit을 추가했다. QR 전용 unit은 **16/16**, 전체 unit은 **247/247**이며, 해당 양보 한 줄만 제거한 음성 대조는 **exit 1·15 pass/1 fail**, 핵심 실패 원문은 **`1 !== 0`**이다. — Codx

**3차 검수 F2-R 반영** — 결과 교체 뒤 재생성은 성공 결과 1개 표시 후 기존 `waitForGenerateEnabled`의 `waitForFunction`으로 생성 버튼 활성화를 기다린 다음 PDF 버튼 활성 상태를 단언하도록 동기화했고, 고정 sleep 추가 없이 `npm run test:qr-bulk`를 연속 2회 실행해 모두 exit 0(기존 stale download 0·font 요청·reload·3시나리오 단언 유지)으로 통과했다. 원문은 `/tmp/worklazy-s2b-fix3/logs/qr-bulk-{1,2}.log`에 보존했다. — Codx

**Gemini 로컬 시각 검수 소견 판정 (Claude, 2026-09-07 02:45)** — Gemini(agy `gemini-3.1-pro-high`, QA 빌드 4188) 는 QR 스튜디오 정상 렌더 9화면을 정상으로 보고하면서 "① `똠` 라벨에서 서브셋 폰트만 요청(깨짐) ② 영어 라벨 PDF 흐름 차단" 2건을 냈다. **둘 다 검수 입력 결함으로 판정, 제품 결함 아님.** ① Gemini 스크립트(`/tmp/worklazy-s2b/gemini-local/QA-fallback.mjs`)는 제목 템플릿(`[data-testid="qr-mapping-title-template"]`)을 `{{Label}}` 로 설정하지 않아 `똠` 이 CSV Label 열에만 있고 라벨 텍스트(커버리지 검사 대상)에는 들어가지 않았다 — payload 만으로는 full 선택 실험이 되지 않는다는 1차 반박 지적과 동일. ② 영어 버튼 실제 문구는 "Create row QR codes" 인데 "Generate" 를 찾아 타임아웃. Claude 재현(`/tmp/worklazy-s2b/claude-fallback-probe.mjs`, 템플릿 `{{Label}}` 설정): fallback ko(첫 Label `똠 라벨`) → **전체 OTF `noto-cjk-sans-2.004/NotoSansKR-Regular.otf` 200 4,644,748B 요청, PDF 4,076,547B** · normal ko/en → **서브셋 `…ksx1001-v1/NotoSansKR-Regular.ksx1001.otf` 200 931,704B, PDF 826,074/826,075B** · 오류 경계·정적 안내 노출 0. CLAUDE.md §5-3 "차단 결함이 오면 검수 입력이 그 판정을 뒷받침하는지 본다" 의 사례. — Claude

> **S2b 게이트 ①~⑧ 판정 (Claude, 2026-09-07 03:15) — 통과.** astra 검수 4회(1차 F1·F2 회귀 테스트 누락 → 2차 F1-R → 3차 F2-R 스모크 flake → 4차 [검수 통과]) 를 거쳐 브랜치 `2f59a44`(커밋 7개, 제품 코드는 `0198036` 이후 불변) 를 승인한다. ① 시각 회귀 350/350·기준선 갱신 0 ② 접근성 8페이지 위반 0 ③ 번들 5종 상한 내(coverage JSON 은 QR route 에 포함해 측정) ④ CLS 0 ⑤ 광고 격리 영향 0·새 외부 요청 0 ⑥ 사용자 문구 변화 0·정적/사이트맵 불변 ⑦ build·tsc·unit 247·QR 스모크 3 scenario+OTF 404 폴백+청크 404 대조+취소·utilities·office·browser·new-tools·recovery·static ⑧ Gemini 로컬 검수 9화면 정상(소견 2건은 검수 입력 결함으로 판정 — 위 문단) + Claude DOM/PDF 재현(서브셋 931,704B / `똠` 폴백 전체 OTF 4,644,748B) + astra DOM·mutation 교차. 배포 승인은 2026-09-06 사용자 포괄 결정(로드맵 §결정 7). — Claude

#### S2b 병합·production 배포·라이브 확인 — 사후 기록 (Codx)

**병합·push** — 실행 게이트에서 `main=f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`, `s2b-qr-font=2f59a44737e87019fd90ca84f23e75c7d297ef97`, `origin/main=1a04f2571109495a76b8468af95b2f4edcd862cf`를 대조했고 추적 변경 0·사용자 미추적 파일 3개를 확인했다. 열린 계획서 16개에서 상반 지시가 없었고 QR bulk R4·U4 전체 OTF 경계는 S2b 정본의 명시 제외와 일치했다. `git pull --ff-only origin main`은 `Already up to date`; 지정 `--no-ff` 병합으로 **`6173125c3766a3c889db3b1086c1dc55076d3414`**(부모 `f29d249`·`2f59a44`)를 만들었다. push 원문은 `1a04f25..6173125  main -> main`이다.

**push 전 main 검증** — production 빌드 2회와 그 사이 `VITE_LOCAL_QA=1` 빌드가 모두 2,834 modules·정적 61페이지로 통과했다. 세 prebuild 모두 `vendor-qr-label-font.mjs`를 실제 실행해 `QR fonts verified: full=4644748 subset=931704 coverage=3394`를 출력했다. 마지막 production entry는 `index-itbEJhl5.js`; 전개된 subset은 **931,704B**, SHA-256 **`b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be`**다. `npx tsc -b` 진단 0, unit **247/247**, static(61페이지·startup 104문서), QR bulk(subset/full/corrupt/font404·취소·chunk404 대조), utilities, registry 20, CSS orphan 0, diff check, QA 접근성 8페이지 위반/외부 요청 0, 렌더링 3페이지×3회 CLS 최대 0을 통과했다. utilities 첫 실행은 preview 미기동으로 `ERR_CONNECTION_REFUSED`였고 같은 production dist를 4173에 기동한 뒤 재실행해 통과했다. 원문은 `/tmp/worklazy-s2b-deploy/logs/01-production-build.log`부터 `13-final-production-build.log`까지 보존했다.

**Actions·CDN** — merge push의 GitHub Actions **run `34051975800`**은 SHA `6173125…`에서 success: build **6m10s**, deploy **18s**, 생성부터 완료까지 **6m37s**다. Node 20 deprecated action annotation 1건은 경고이며 모든 step은 success다. CDN 첫 확인에서 라이브 `/ko/` entry가 즉시 **`index-itbEJhl5.js`**로 로컬 production과 일치했고 `startup-help` 절이 유지됐다. subset URL은 HTTP 200·`content-length: 931704`, 실제 다운로드 931,704B; 기존 full URL도 HTTP 200·4,644,748B다. `/ads.txt` 200·59B(게시자 `pub-8940087269746960`), `/robots.txt` 200·66B, `/sitemap.xml` 200·21,596B도 확인했다.

**라이브 QR 라벨 PDF** — Chrome 152·Playwright 1.63, 새 context·SW 차단·cache disabled에서 `/ko/tools/qr-studio/bulk/`에 header+데이터 25행 CSV를 업로드하고 제목 템플릿을 `{{Label}}`로 지정했다. 양쪽 모두 성공 25·실패 0, font 요청 정확히 1회, pageerror/requestfailed 0이다.

| 시나리오 | 라이브 font 응답 | decoded bytes / SHA-256 | PDF |
|---|---|---|---|
| KS X 1001 범위 | subset 1회·HTTP 200·gzip 전송 560,628B | 931,704 / `b84d27a5…a252be` | 826,075B·`%PDF`·2p·embedded subset 1개 |
| 첫 Label `똠 라벨` | full OTF 1회·HTTP 200·gzip 전송 3,731,894B | 4,644,748 / `69975a0a…148d68` | 4,076,547B·`%PDF`·2p·embedded full 1개 |

첫 프로브는 결과 문구에서 timeout했고, 진단 실행에서 기존 `/tmp` CSV의 끝 LF가 빈 27행으로 파싱되어 `성공 25·실패 1`이 된 검수 입력 결함임을 확인했다. header+25행은 그대로 두고 끝 LF만 제거한 업로드 버퍼로 최종 실행을 통과했으며 제품 코드·CSV parser 계약은 바꾸지 않았다. 원문과 PDF는 `logs/19c-live-qr-font-final.log`, `live-qr-font.json`, `live-qr-{subset,full-tom}.pdf`에 있다.

**라이브 접근성·빈 화면·광고·CLS·404** — 요청된 홈 ko/en·도구 목록 ko·HWP ko·오디오 ko/en을 포함해 desktop/mobile **12화면**을 직접 Playwright+axe 4.13.0으로 감사했다. HWP의 정본 upstream iframe 1개만 제외하고 위반 0, HTTP 200, pageerror·가로 overflow·오류 경계·startup-help 오노출 0이었다. 홈·문서 비교·PDF 각 3회와 별도 홈 1회의 CLS는 전부 **0**(`layoutShifts=[]`)으로 ≤0.1·≤0.114199를 모두 충족했다. `/ko/404-없는경로/`의 초기 응답은 HTTP **404**, title `Page not found | Worklazy Tools`, `noindex=true`; 앱 기동 뒤 홈으로 이동하는 기존 S0/S1 판정은 그대로이며 404 view 유지 성공을 주장하지 않는다. 비디오·Office app·XLS preserve ko/en 격리 **6/6**은 `crossOriginIsolated=true`, `googlesyndication|adsbygoogle` 요청 0·광고 DOM 0이었다. 일반 Excel cleaner ko/en 대조는 광고 loader DOM 1·loaded=true·`adsbygoogle.js` HTTP 200으로 정상이다.

**20도구 ko/en 직접 진입** — 각 새 context에서 준비 DOM 뒤 `mainTextLength>0`, 오류 경계·startup-help 오노출·가로 overflow 0을 단언해 **40/40 양수·빈 화면 0**이다. 영어 HWP는 한국어 전용 기존 정책에 따라 최초 HTTP 404 뒤 `/en/tools`로 이동해 목록 본문 4,629자를 표시했다. 40장 contact sheet도 직접 확인해 빈 화면·정렬 붕괴·잘림을 관찰하지 않았다.

| toolId | ko mainTextLength / HTTP | en mainTextLength / HTTP |
|---|---:|---:|
| excel-merger | 3,155 / 200 | 5,891 / 200 |
| excel-compare | 1,835 / 200 | 3,585 / 200 |
| excel-cleaner | 1,588 / 200 | 3,011 / 200 |
| pdf-editor | 1,775 / 200 | 2,923 / 200 |
| document-compare | 1,380 / 200 | 2,586 / 200 |
| hwp-editor | 1,195 / 200 | 4,629 / 404→`/en/tools` |
| office-editor | 1,213 / 200 | 2,182 / 200 |
| video-studio | 1,933 / 200 | 3,343 / 200 |
| audio-studio | 1,414 / 200 | 2,293 / 200 |
| image-studio | 1,471 / 200 | 2,558 / 200 |
| text-merger | 962 / 200 | 1,791 / 200 |
| text-tools | 777 / 200 | 1,420 / 200 |
| text-formatter | 491 / 200 | 911 / 200 |
| work-calculator | 570 / 200 | 1,259 / 200 |
| timezone-calculator | 1,986 / 200 | 3,290 / 200 |
| payroll-calculator | 689 / 200 | 1,471 / 200 |
| image-privacy | 826 / 200 | 1,405 / 200 |
| security-tools | 724 / 200 | 1,442 / 200 |
| qr-studio | 618 / 200 | 1,086 / 200 |
| data-converter | 529 / 200 | 868 / 200 |

전체 라이브 원문·JSON·65장 캡처·contact sheet는 `/tmp/worklazy-s2b-deploy/`에 보존했다. 위 항목으로 C-D ⑨를 통과했다. — Codx

### S2 하네스 확장 + 성능 묶음 1차 — 브랜치 구현·검증 (Codx)

**착수 게이트** — `PROJECT_RULES.md` → `AGENTS.md` → 정본 `roadmap-completion-20260906.md`의 공통 계약·S2 전문·검증 총람·S0/S1·왕복 1~4차 기록 → backlog·관련 review-notes 순으로 확인했다. `HEAD=main=origin/main=15b31c1a38a6f39628046e988ae2b1ce92881fe9`, 추적 변경 0·사용자 미추적 파일 3개인 상태에서 `git checkout -b s2-harness-perf main`을 실행했다. 열린 계획서의 같은 표면에 상반 지시를 발견하지 않았다. 분기점 production `npm run build`와 기존 측정기를 실제 실행해 `/tmp/s2-bundle-baseline.json`을 저장했다. 정본 계획서는 수정하지 않았다. 이번 정지점은 **브랜치 커밋·전 검증·QA dist 보존까지**, main 병합·push·QR 감량 구현 없음이다.

**S2-H 양방향 unit** — 브라우저를 띄우는 진입점과 실제 판정 함수를 분리해 unit이 제품 측정 함수 자체를 import한다. 신규 S2-H 28건, ZIP 이름 1건, QR 전송량 2건이다.

| 항목 | 통과 방향 | 실패 방향 / 내용 단언 | unit 수 |
|---|---|---|---:|
| 번들 5종 | 각 기본 상한 정확히 일치; 독립 override 7B | 각 +1B; baseline/current 각각 NaN·누락·Infinity·음수·소수·문자열; 잘못된 override | 15 |
| 번들 신규 route·귀속 | 현재 존재하는 신규 lazy route 기준 기여 0; SHA 동일 청크 route→shared 40B는 app 증분 0 | 오타·eager route·기존 route 기준 수치 누락 거부; 다른 SHA를 이동으로 오인하지 않음; 실제 +9B 분리; 실제 작은 manifest/files 측정 | 3 |
| 렌더링 | CLS 0.1·페이지별 3표본 | 0.100001·1·NaN·누락 실패(중앙값 통과여도 최대값 차단); 페이지/표본 누락·중복 실패; 실제 observer의 요소·전후 rect·recent input 제외 | 3 |
| 접근성 | 현행 JSON total=0; 새 등록 8페이지 total=0 | summary를 0으로 놔둔 채 위반 1건 삽입해도 실패; 페이지 누락/중복 실패; 모바일 412px 2건·HWP·정확히 1개 예외의 소유자/사유 단언 | 4 |
| 도구 목록 | 레지스트리와 독립된 기대 ID 20개 일치 | 1개 누락·같은 개수로 ID 중복 1개 치환 실패 | 3 |

번들 override는 `BUNDLE_LIMIT_ENTRY_JS_GZIP`, `BUNDLE_LIMIT_AFFECTED_ROUTE_JS_GZIP`, `BUNDLE_LIMIT_SHARED_JS_GZIP`, `BUNDLE_LIMIT_APP_JS_GZIP`, `BUNDLE_LIMIT_CSS_GZIP`의 **바이트 정수**다. 지정한 지표만 최종 한도를 대체하고 나머지는 기존 multiplier를 적용한다. 사용 환경변수·수치·multiplier는 stdout 및 JSON budget에 남는다. 이번 실측은 override `{}`·multiplier 1이며 상한을 올리지 않았다. 기존의 파일 SHA 기록이 있어야 이동 판정이 가능하므로 누락된 측정 기록은 거부한다.

**CLS 원인 확정** — QA production·Chrome 152·1280×800 DPR1·light·ko-KR·SW block·매 회 새 context·cache off·무스로틀·3초 settle. 원시 source/rect는 `/tmp/worklazy-s2/render-before.json`, 단일 원인 대조는 `cls-diagnose.json`/`logs/cls-diagnose.log`다.

| sources | 수정 전 근거 | 기여 CLS | 수정 / 대조 결과 |
|---|---|---:|---|
| body | 정적 `.seo-static-fallback`의 `margin:48px auto`가 root/body로 collapse. rAF body/root y=48→0 | 0.037500000 | `#root { display: flow-root }`로 margin 전파 차단. 이것만 적용한 문서 비교 0.076699146 |
| `.sidebar-nav` | 이미지 로드 전 로고 높이 0→43.59375px, nav y=86→95.59375px | 0.000831958 | 로고 SVG의 실제 viewBox 320×64를 img width/height에 명시. 독립 aspect-ratio 대조는 해당 기여만 제거(0.113367188) |
| `.global-footer` | 문서/PDF 로딩 영역 55vh=440px 뒤 footer y=440, h=83 → 실제 페이지 로드 후 화면 밖(문서 y=2074.390625) | 0.075867188 | 세 Suspense fallback에 `min-h-screen` 예약. 예약 단독 대조 0.038331958 |

세 원인의 합이 기존 문서·PDF의 0.1141991455와 일치했다. 폰트 스왑을 원인으로 채택하지 않았다. 실제 수정은 자연 비율을 유지하는 img 속성을 사용하므로 독립 실험의 CSS aspect-ratio를 그대로 제품에 넣지 않았다. S0 `RouteErrorBoundary`와 `startup-help`의 기존 55vh 안내 예약은 그대로이고, 정상 로딩 중에만 더 큰 공간을 예약한다.

| 페이지 | 수정 전 CLS (1 / 2 / 3) | 수정 후 CLS (1 / 2 / 3) | 최댓값 ≤0.1 |
|---|---|---|---|
| home | 0.038331958 / 0.038331958 / 0.038331958 | 0 / 0 / 0 | 통과 |
| document-compare | 0.114199146 / 0.114199146 / 0.114199146 | 0 / 0 / 0 | 통과 |
| pdf-editor | 0.114199146 / 0.114199146 / 0.114199146 | 0 / 0 / 0 | 통과 |

S2-H 직후에는 새 하네스가 문서·PDF 0.1141991455를 실제 **exit 1**로 차단했다(`logs/render-before.log`). 수정 후 9표본 모두 CLS 0, 외부 요청 0이다. 판정 전에 소수점 반올림하지 않으므로 0.100001 경계를 숨기지 않는다.

**접근성 등록·예외·하단 탭** — 기존 `/` 언어 랜딩, 문서 비교, 도구 목록, Excel 비교, PDF 5페이지를 유지하고 HWP(1280×800), `/ko` 홈·`/ko/tools` 목록(Pixel 7 폭 **412×839**, touch/mobile)을 추가했다. 총 8페이지. 예외는 HWP의 `iframe[title="rhwp HWP 문서 편집기"]` **1항목**뿐이다. 목적은 상류 벤더 4노드 위반의 분리, 소유자는 **rhwp Studio 0.8.6 upstream**, 근거는 `docs/backlog.md`의 HWP iframe 항목이다. axe `exclude`는 이 셀렉터에만 적용하며 호스트 페이지는 감사하고, 실제 iframe 일치 수가 1이 아니면 실패한다.

수정 전 새 측정은 모바일 홈 2노드·목록 1노드의 color-contrast **2 violations/serious 2**로 exit 1이었다. 이후 기본 total 상한도 10→0으로 바꾸고 `.bottom-tab`의 상속 색 토큰 **한 줄**을 `--label-tertiary`→`--label-secondary`로 변경했다. `#fbfbfd` 기준 `#909098` **3.065384:1** → `#69696f` **5.276560:1**. 활성 탭의 blue 색·별도 배경은 유지한다. canonical `/ko/`, `/en/` 홈과 `/ko/tools`, `/en/tools`의 활성/비활성 구분은 `qa/*-mobile.png`, 같은 화면의 이전 토큰 대조는 `qa/*-old-tab-color-control.png`에 보존했다.

확장된 새 측정은 루트/문서/목록/Excel/PDF/HWP/모바일 홈/모바일 목록 모두 위반 **0**, 외부 요청 0, placeholder 대비 **4.887109:1**이다. HWP host의 43 passes를 포함한다. 기록 fixture `tests/fixtures/harness/a11y-zero.json`은 이번 수정 전 실제 측정의 기존 desktop 5페이지 부분을 판정 테스트 입력으로 보존한 것이다. 완료 브라우저 감사는 이 fixture를 재사용하지 않는다.

**시각 기준선** — 최초 전체 175장 중 영문 light/mobile 38장이 0.1% 허용치를 초과했다. 실제 diff에서 하단 탭의 색 변경을 확인했고, 탭 위 영역의 차이는 최대 288px/0.087495%로 단독 허용치 이내였다. 레이아웃 예약은 초기 로딩에 적용되어 완료 화면의 재배치가 없다. 이 38장의 하네스 실제 캡처만 해당 baseline으로 갱신했다. 원본 diff/actual 경로는 `/tmp/worklazy-s2/visual-before-update/*.{diff,actual}.png`, 정확한 목록은 `visual-updated.json`이다. KO/EN 전체 재실행 각각 175/175 통과. 별도 QA 16화면(ko/en·홈/목록 모바일·문서/PDF/QR desktop/mobile)에서 수평 overflow·추적 DOM·외부 요청 0이고 Codx는 대표 홈/목록/문서/PDF/QR 이미지를 직접 확인했다. Gemini 최종 로컬 검수는 이 브랜치·QA dist를 넘긴 뒤 수행할 단계다.

**QR 4단계 실측 (감량 구현 없음)** — `npm run measure:qr`, 새 context·SW 차단·page/worker CDP cache disabled·로컬 무스로틀·1365×900·한글 CSV 2행·PNG 2개·manifest 2시트/성공 시트 3행·한글 A4 PDF 1페이지를 단언했다. URL·요청 시작 단계·page/worker 구분·캐시 출처는 `/tmp/worklazy-s2/qr/metrics.json`, 전체 CDP events/NetLog는 `/tmp/worklazy-s2/qr/`에 있다. 각 단계 완료와 700ms 네트워크 정숙 후 다음 단계로 진행했다. 21요청 모두 network, cache/SW hit 0, 외부 요청·pageerror 0이다.

Chromium은 worker 첫 스크립트의 공개 CDP 전송 완료에 **헤더 388B만** 줄 수 있었다. 이를 그대로 0/388B로 보고하는 안은 기각했다. Chrome NetLog의 `URL_REQUEST_JOB_BYTES_READ`(gzip 전송 본문), identity 응답에서는 `URL_REQUEST_JOB_FILTERED_BYTES_READ`, 실제 HTTP 헤더를 대조한다. 표의 전송 B는 **인코딩된 응답 본문+HTTP 헤더, HTTP chunk framing 제외**로 전 요청 동일하다. CDP 수치는 별도 보존하고 worker 본문 누락은 실패시킨다. worker 실제 gzip 본문 56,905B + 헤더 388B = **57,293B**다. JS gzip B는 별도로 제공된 dist JS에 `gzipSync`를 적용한 값이며 전송 B와 합산하지 않는다. page.route/context.route를 사용하지 않아 S0 캐시 보존 실험과도 혼동하지 않는다.

| 단계 | 요청 수 | 전송 B | JS gzip B | 누적 전송 B | 누적 JS gzip B |
|---|---:|---:|---:|---:|---:|
| 진입 | 13 | 409,318 | 326,204 | 409,318 | 326,204 |
| 파일 선택 완료 | 4 | 446,422 | 444,649 | 855,740 | 770,853 |
| 생성·manifest 완료 | 2 | 58,483 | 57,657 | 914,223 | 828,510 |
| PDF 완료 | 2 | 5,153,562 | 508,018 | 6,067,785 | 1,336,528 |

| 상위 청크 | 단계 | 소유 | JS gzip B | 전송 B |
|---|---|---|---:|---:|
| `qrLabelPdf-SVT9ItGJ.js` | PDF 완료 | page | 508,018 | 508,459 |
| `index-ChABvuMb.js` | 진입 | page | 298,298 | 298,738 |
| `exceljs.min-C_nwFMmd.js` | 파일 선택 완료 | page | 271,024 | 271,464 |
| `inputAdapter-bxwQu7f1.js` | 파일 선택 완료 | page | 135,332 | 135,772 |
| `qr-bulk.worker-bbpyIOTx.js` | 생성·manifest 완료 | worker script | 56,905 | 57,293 |
| `jszip.min-D2jz9vXL.js` | 파일 선택 완료 | page | 38,101 | 38,541 |
| `QrStudioPage-ZbdLR02r.js` | 진입 | page | 15,664 | 16,103 |
| `QrBulkPanel-CTq9sWyI.js` | 진입 | page | 9,711 | 10,150 |
| `fileNameSafety-je7y36nX.js` | 진입 | page | 1,115 | 1,553 |
| `xlsxReport-DktnDtmv.js` | 생성·manifest 완료 | page | 752 | 1,190 |

PDF 단계의 `NotoSansKR-Regular.otf`는 **4,644,748B 본문 / 4,645,103B 전송(identity)**이며 JS gzip 밖이다. 진입 단계 Noto Sans Latin woff2는 **35,820B / 36,225B**다. **ExcelJS는 파일 선택 단계**에서 271,024B gzip, `inputAdapter.ts:2`의 정적 import가 근거다. manifest 생성 때 처음 받는다는 가정은 기각한다.

감량 여지 후보는 세 가지까지 사실만 남긴다(목표 수치·실현 보장 없음): ① CSV도 `inputAdapter.ts`의 ExcelJS/SheetJS/JSZip 정적 import를 따라가 파일 선택 444,649B gzip을 받는다 — 입력 형식별 의존 경계 검토 대상. ② PDF 클릭 시 전체 OTF를 fetch하고 `qrLabelPdf.ts`가 `subset:false`로 embed한다 — 폰트 전송·출력 포함 범위 검토 대상(다운로드와 생성 PDF 크기는 서로 다른 지표). ③ PDF 단계 `qrLabelPdf` 청크 508,018B gzip에는 `@pdf-lib/fontkit`와 `pdf-lib` 정적 import가 있다 — PDF 의존 구성 검토 대상. 세 항목 모두 구현·목표 확정은 별도 디스패치다.

**ZIP 소비 표** — 저장소 `src/**/*.{ts,tsx,js,mjs}`를 재귀 검색한 실제 소비자를 아래처럼 구분했다. PDF→이미지 외 JSZip 소비도 있으므로 패키지 제거는 하지 않는다. 한글 처리 열에서 이름의 입력/가공 경로는 소스 대조이며 모든 도구를 한글 fixture로 새로 시험했다는 뜻은 아니다.

| 소비자 / 코드 표면 | 구현 | 한글 이름 경로 | ZIP64 출력 | 스트리밍/출력 수집 |
|---|---|---|---|---|
| Excel 비교 `ExcelComparePage` | 공용 C3 zip.js | safe 파일명 검사→UTF-8 명시 | 강제 true | 입력 순차 stream, 최종 BlobWriter |
| Excel 정리 `ExcelCleanerPage` | 공용 C3 zip.js | safe 파일명 검사→UTF-8 명시 | 강제 true | 입력 순차 stream, 최종 BlobWriter |
| QR `QrBulkPanel.downloadZip` | 공용 C3 zip.js (버튼 시 import) | safe ZIP 경로·하위 폴더→UTF-8 명시 | 강제 true | 결과별 순차 입력, 최종 BlobWriter |
| Video `video-zip.worker`→`videoZipArchive` | 공용 C3 zip.js | safe 파일명→UTF-8 명시 | 강제 true | OPFS WritableStream; 조건부 BlobWriter 폴백 |
| PDF→이미지 `pdfPreview` | JSZip | 원본 baseName + 페이지 번호 | 미설정; 대조 fixture는 classic ZIP | DEFLATE 6, generateAsync Blob 완성본 |
| PDF 그룹 분리 `pdf.worker` | JSZip | sanitizeFileName + PDF 확장자 | 미설정 | DEFLATE 6, 전체 Uint8Array |
| PDF 오피스 출력 `pdfOffice.worker` | JSZip (OOXML 패키지) | 내부 OOXML 항목명 | 미설정 | DEFLATE 6, 전체 Uint8Array; 단순 결과 ZIP과 다른 계약 |
| 이미지 일괄 `image.worker` | JSZip | 순번 + sanitizeName + 출력 확장자 | 미설정 | DEFLATE 6, 전체 Uint8Array |
| 사진 메타데이터 제거 `image-privacy.worker` | JSZip | 순번 + 결과 fileName | 미설정 | streamFiles:true이나 generateAsync ArrayBuffer 전체 수집 |
| Excel 병합 `excel.worker`; 공용 `spreadsheet-core/inputAdapter` | JSZip 읽기 | OOXML 내부 항목 읽기 | 출력 해당 없음 | loadAsync 입력 파싱; QR·비교·정리에도 전이 |

공통 동일 fixture(`한글 결과.txt`, `보고서/서울 매출.csv`, `검사-😀.txt`, 본문 총 78B)를 **실제 C3 writer**와 JSZip DEFLATE 6로 각각 만들었다. `unzip -l`와 Python `zipfile` 모두 3개 이름·본문·UTF-8 flag를 보존했다. zip.js **768B/ZIP64 EOCD 있음**, JSZip **629B/ZIP64 EOCD 없음**. 압축 옵션·메타데이터가 달라 크기를 라이브러리 성능 우열로 해석하지 않는다. `tests/zip-unicode-comparison.mjs`는 재현 스크립트이고 원본 ZIP/해제 출력은 `/tmp/worklazy-s2/zip/`, `logs/zip-comparison.log`다. 기존 video streaming unit도 전체 입력 arrayBuffer 0회·다중 구간·ZIP64·unzip roundtrip을 검사한다.

판정 제안: **외부 결과 ZIP 출력**의 C3 이관은 별도 단위의 후보로 유지한다. 한글 이름 대조는 채택 근거지만 현재 fixture만으로 4GiB 이상 호환이나 도구별 회귀를 보장하지 않는다. 현 C3는 STORE(level 0), 기존 JSZip 출력은 DEFLATE 6이므로 통합 전 압축·메모리/취소·파일명 변경·UI 진행률·각 도구 ZIP 내용 회귀를 정해야 한다. OOXML 읽기/작성과 ExcelJS 전이 의존은 별도라 JSZip 패키지 제거 근거가 되지 않는다. 이번 제품 변경은 `useUnicodeFileNames:true` 명시뿐이다.

**분기점 production 번들 5종** — 신규 route 없음·override 없음·배수 1, SHA-256 중복 제거 규칙 동일. QA 빌드와 비교하지 않았다.

| 지표 | main 기준 gzip B | 브랜치 gzip B | delta B | 기본 상한 B | 판정 |
|---|---:|---:|---:|---:|---|
| entryJsGzip | 299,265 | 299,283 | +18 | 20,480 | 통과 |
| affectedRouteJsGzip | 2,440,445 | 2,440,427 | -18 | 61,440 | 통과 |
| sharedJsGzip | 2,716,493 | 2,716,489 | -4 | 30,720 | 통과 |
| appJsGzip | 5,456,203 | 5,456,199 | -4 | 81,920 | 통과 |
| cssGzip | 37,669 | 37,687 | +18 | 10,240 | 통과 |

귀속 이동 `route→shared` **0B/0청크**, shared delta **−4B**, 이동 제외 shared delta **−4B**, 전체 app JS 순증분 **−4B**. 이는 QR 감량 결과가 아니다. 실제 청크 이동과 순증분이 다른 상황은 위 unit의 40B 이동/+9B 순증분으로 검증했다.

**완료 기준 검증 명령·실제 출력** — 최종 판정에 쓴 실행은 아래 전부 exit 0이다. `logs/` 아래 각 명령 stdout/stderr 원문, `check-*.json`에 명령·종료 코드·실행 시간이 있다. 최종 측정 코드 HEAD는 `4f603bb`이며 뒤의 기록 커밋은 문서만 변경한다. QA 8페이지 감사는 새 브라우저로 다시 수행했다.

| 명령 (실행 환경 포함) | exit | 실제 결과 | 원문 로그 |
|---|---:|---|---|
| `npm run build` | 0 | production·정적 61페이지 | `logs/build.log` |
| `npx tsc -b` | 0 | TypeScript 진단 0 | `logs/tsc.log` |
| `npm run test:unit` | 0 | 231/231 | `logs/unit-final.log` |
| `npm run test:static` | 0 | 현지화·사이트맵·런타임·로더 검증 | `logs/static-production.log` |
| `TEST_BASE_URL=http://127.0.0.1:4188 npm run test:browser` | 0 | Excel·Word 비교·PDF 전 scope | `logs/browser-final.log` |
| `TEST_BASE_URL=http://127.0.0.1:4188 npm run test:new-tools` | 0 | HWP·이미지·오디오·비디오 | `logs/new-tools-production.log` |
| `TEST_BASE_URL=http://127.0.0.1:4188 npm run test:utilities` | 0 | ko/en·도구·영상 격리 | `logs/utilities.log` |
| `TEST_BASE_URL=http://127.0.0.1:4188 npm run test:office` | 0 | 편집·저장 DOCX 5,089B·캐시 | `logs/office.log` |
| `npm run test:qr-bulk` | 0 | 7 payload·PNG ZIP·manifest·25라벨/2페이지 PDF | `logs/qr-bulk.log` |
| `npm run test:recovery` | 0 | 147/147 (74 desktop·73 Android) | `logs/recovery.log` |
| `node tests/tool-registry-routes.mjs` | 0 | 독립 기대 20·누락/중복 0 | `logs/registry.log` |
| `LANG=ko_KR.UTF-8 VISUAL_ARTIFACT_DIR=/tmp/worklazy-s2/visual-ko npm run test:visual` | 0 | 175/175 | `logs/visual-ko.log` |
| `LANG=en_US.UTF-8 VISUAL_ARTIFACT_DIR=/tmp/worklazy-s2/visual-en npm run test:visual` | 0 | 175/175 | `logs/visual-en.log` |
| `VITE_LOCAL_QA=1 npm run build` | 0 | 최종 dist: QA, 추적 식별자 0 | `logs/build-qa-final.log` |
| `A11Y_MAX_TOTAL=0 A11Y_REPORT_PATH=/tmp/worklazy-s2/a11y-after.json npm run test:a11y` | 0 | 8페이지·위반/외부 요청 0 | `logs/a11y-final.log` |
| `RENDER_REPORT_PATH=/tmp/worklazy-s2/render-after.json npm run test:rendering` | 0 | 3페이지×3회 CLS 모두 0 | `logs/rendering-final.log` |
| `BUNDLE_BASELINE=/tmp/s2-bundle-baseline.json BUNDLE_MEASURE_OUTPUT=/tmp/worklazy-s2/bundle-final.json npm run bundle:measure` | 0 | 5종 통과·이동 0B·app 순증분 −4B | `logs/bundle.log` |
| `npm run css:orphans` | 0 | orphan 0 | `logs/css.log` |
| `npm run legacy:manifest` | 0 | 153 removed / 0 split / 2 active | `logs/manifest.log` |
| `git diff --check` | 0 | 공백 오류 0 | `logs/diff-check.log` |
| `QR_METRICS_OUTPUT=/tmp/worklazy-s2/qr npm run measure:qr` | 0 | 4단계·21요청·worker/폰트 포함 | `logs/qr-metrics-final.log` |

`ZIP_COMPARISON_OUTPUT=/tmp/worklazy-s2/zip node --experimental-strip-types tests/zip-unicode-comparison.mjs`도 exit 0이며 `logs/zip-comparison.log`에 두 해제 도구의 실제 이름·본문 대조를 기록했다.


**제품 규칙·범위 점검** — 서버/API/SSR·의존 추가 없음. 사용자 문구 추가 0, 하단 탭 ko/en 공통; SEO 정의·경로·FAQ·사이트맵·소셜 입력 diff 0. 정적 본문 margin 처리는 CSS 입력에서 했고 산출 HTML/벤더를 직접 수정하지 않았다. 광고/애널리틱스 경계 코드는 불변이며 QA 캡처/감사/렌더링/QR 계측 외부 요청 0이다. production 전용 new-tools·utilities·office 스모크에서도 정상 로더와 격리 제외를 확인했다. CSS orphan 0, legacy manifest 153 removed·0 split·2 active 유지. 사용자 파일 3개는 SHA-256 보존, 작업지시서/jobs·dist·실행 로그는 커밋하지 않는다.

| 제품 계약 | 판정 | 근거 |
|---|---|---|
| GitHub Pages 정적 스택 | 통과 | 변경은 클라이언트 CSS/속성/ZIP 옵션·로컬 하네스; 서버 런타임 추가 0 |
| ko/en·내부 구현 비노출 | 통과 | 신규 사용자 문구 0; 탭 색 공통; 계측 데이터는 테스트 출력에만 기록 |
| SEO·정적·사이트맵·FAQ | 통과 | 정의·생성기·route 추가 0; production test:static 통과, 61페이지 |
| 광고·애널리틱스 격리 | 통과 | production new-tools/utilities/office 계약 통과; QA 16화면 외부/추적 0 |
| 생성물·벤더 보호 | 통과 | dist는 생성 명령으로만 교체; public/vendor·정적 생성 페이지 직접 변경 0 |
| 의존·사용자 파일·정지점 | 통과 | 새 의존 0; 개인 파일 SHA 일치; main/origin/main 기준 해시 유지 |

**실행 중 실패와 판정** — 수정 전 새 CLS/a11y 게이트 실패는 의도한 음성 대조다. 최초 browser 실행은 기본 5173 서버가 없어 `ERR_CONNECTION_REFUSED`로 종료해 기존 preview를 `TEST_BASE_URL=http://127.0.0.1:4188`로 지정했다. `test:static`/new-tools의 영상 로더 검사는 production의 애널리틱스 존재를 요구해 QA 빌드에서는 실패했다. 게이트를 완화하거나 검사 코드를 바꾸지 않고 production 빌드에서 다시 실행했다. QR의 worker 전송 완료 누락/헤더만 집계는 NetLog 대조와 음성 unit으로 수정했다. 시각 38장 갱신 사유·diff 경로는 위에 명시했다. 복구 기본 명령은 desktop 74·Android 에뮬레이션 73, **147/147** 통과했다. `RECOVERY_STALE_NEW`를 주어 서로 다른 두 빌드를 비교하는 선택 사례 2건은 이번 명령에 포함되지 않아 S0 당시 149건과 다르다. 이번에 실행한 사례만 `recovery/executed-cases.json`과 함께 `/tmp/worklazy-s2/recovery/`로 보존했다. 신규 도구 스모크의 Dolby Vision base-layer 실기능 분기는 이 Chrome 호스트가 호환 경로를 제공하지 않아 기존 조건에 따라 생략됐고, capability unit·fallback 안내는 통과했다(`logs/new-tools-production.log`).

**범위 밖 발견** — slash 없는 `/ko`·`/en`에서는 홈 탭의 `end` 링크(`/ko/`·`/en/`)와 URL이 달라 active가 없고, canonical 홈 URL에서는 정상이다. 기존 `localizedPath`/NavLink 코드를 대조했고 이번 색 변경과 무관하므로 수정하지 않았다. 기존 HWP 벤더 내부 4노드와 인앱 NotFound 부재는 backlog대로 이번 구현 밖이다. QR 목표·감량 구현, ZIP 통합/패키지 제거, main 병합/push는 수행하지 않았다.

**검수 인계** — 최종 `dist/`는 `VITE_LOCAL_QA=1 npm run build` 산출물이다. 저장소 루트에서 `npm run preview -- --host 127.0.0.1 --port 4188 --strictPort`로 띄운다(기존 서버가 살아 있으면 재사용). 홈 `/ko/`, `/en/`와 목록 `/ko/tools`, `/en/tools`는 412px 모바일 하단 탭; 문서 비교 `/ko/tools/document-compare`, `/en/tools/document-compare`; PDF `/ko/tools/pdf-editor`, `/en/tools/pdf-editor`; QR `/ko/tools/qr-studio`, `/en/tools/qr-studio`, 일괄 `/ko/tools/qr-studio/bulk`, `/en/tools/qr-studio/bulk`를 검수한다. Codx 캡처는 `/tmp/worklazy-s2/qa/`에 16개 실제 화면 + 이전 탭색 대조 4장이다. 전체 보고·명령 원문·정지 상태는 `/tmp/worklazy-s2/REPORT.md`.

#### S2 병합·production 배포·라이브 확인 — 사후 기록 (Codx)

**판정** — S2 `--no-ff` 병합·main push·Actions 배포 성공, 배포 후 제품 확인 통과. `CHANGELOG.md`의 S2 구현 항목을 계승하는 C-A 사후 기록이다. HWP 벤더 iframe 접근성 예외와 앱 기동 후 404→홈 이동은 앞선 Claude 판정·backlog를 유지하며, 새 결함으로 재분류하거나 해결했다고 표시하지 않는다. 배포 실행 중 제품 코드·설정·검증 기준선 수정은 없다.

**실행 게이트·계보** — `PROJECT_RULES.md` 전문 → `AGENTS.md` → 정본 §2 C-A·C-D ⑨ → 게시 체크리스트·S2 검토 기록·열린 오프라인 계획서 15개를 확인했다. 기준 main `15b31c1a38a6f39628046e988ae2b1ce92881fe9`, S2 `f8f8b0df991b667cec54b8990d596fa61a3b70ab` 일치, 추적 변경 0·개인 미추적 3파일. 이전 작업의 push 제한은 최신 사용자 포괄 승인과 지정 `s2-merge-dispatch.md`로 해제됐으며 상반된 최신 실행 지시는 없었다. 정본의 S2 Gemini **45/45**·Claude 게이트 ①~⑧ 통과를 계승했다. `git checkout main && git pull --ff-only origin main`은 `Already up to date.`와 지정 HEAD를 반환했다.

- 병합 명령: `git merge --no-ff s2-harness-perf -m "Merge S2 harness gates, CLS fixes and accessibility coverage for live deployment"`.
- 병합 커밋: **`7c98628074c1eee7204b07b683333b945fbec205`**, 부모는 지정 main·S2 순서. `git diff --exit-code s2-harness-perf HEAD` **exit 0**, 병합 tree가 검수 브랜치와 같다.
- `git push origin main` **exit 0 / 4.54초**: `To github.com:Fentanest/WorklazyTools.git` / `15b31c1..7c98628  main -> main`.
- [Actions 34032612684](https://github.com/Fentanest/WorklazyTools/actions/runs/34032612684) **success / 312초**(12:16:24Z→12:21:36Z). `gh run list --limit 1`의 headSha 일치, `gh run watch 34032612684 --exit-status` **exit 0**. 빌드·정적 검증·비디오 하이브리드 스모크·Pages 업로드·deploy 모두 성공했다. Actions의 Node 20→24 실행 전환 안내는 원로그에 보존했다.

**push 전 main 실제 검증** — 아래 전부 병합 커밋에서 실행했고 exit 0이다. 명령·종료 코드·시간과 stdout/stderr는 `/tmp/worklazy-s2/deploy/prepush-checks.json` 및 `logs/`에 있다. production은 Actions와 같은 사이트 URL·base를 지정하고 QA 플래그를 제거했다.

| 명령 | exit | 초 |
|---|---:|---:|
| `env -u VITE_LOCAL_QA VITE_SITE_URL=https://worklazy.net/ VITE_BASE_PATH=/ npm run build` | 0 | 93.54 |
| `npx tsc -b` | 0 | 17.46 |
| `npm run test:unit` | 0 | 2.52 |
| `npm run test:static` | 0 | 0.76 |
| `npm run css:orphans` | 0 | 0.6 |
| `npm run legacy:manifest` | 0 | 0.33 |
| `node tests/tool-registry-routes.mjs` | 0 | 0.49 |
| `npm run test:qr-bulk` | 0 | 33.86 |
| `git diff --check` | 0 | 0.0 |
| `VITE_SITE_URL=https://worklazy.net/ VITE_BASE_PATH=/ VITE_LOCAL_QA=1 npm run build` | 0 | 92.25 |
| `A11Y_MAX_TOTAL=0 A11Y_REPORT_PATH=/tmp/worklazy-s2/deploy/a11y-report.json npm run test:a11y` | 0 | 27.61 |
| `RENDER_REPORT_PATH=/tmp/worklazy-s2/deploy/rendering-report.json npm run test:rendering` | 0 | 43.39 |
| `env -u VITE_LOCAL_QA VITE_SITE_URL=https://worklazy.net/ VITE_BASE_PATH=/ npm run build` | 0 | 90.51 |
| `git diff --check` | 0 | 0.07 |

unit **231/231**; CSS orphan **0**; manifest **153 removed / 0 split / 2 active**; 도구 레지스트리 **20 / 누락·중복 0**; 정적 페이지 **61**, startup recovery 문서 **104**. QR 스모크는 취소·정리·재실행, 7 payload, PNG 2개 ZIP, 2시트 manifest, 25라벨·2페이지·**4,102,717B** 한글 PDF, 외부 요청 0을 통과했다. QA 접근성은 **8페이지·위반 0·외부 요청 0**, placeholder 대비 **4.8871087704:1**. QA 전후 production entry 파일명·SHA-256은 동일하다.

**라이브 HTML·entry·게시 파일** — `curl -s https://worklazy.net/ko/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` 원출력은 **`index-BOWgdQ-Q.js`**. 첫 CDN 확인부터 일치해 60초 간격 재시도는 불필요했다. 실제 entry HTTP 200, 로컬/라이브 SHA-256 **`ffb66587f68279253741bb47be18c746bdbd2b44937fc4d18026029ec78be2c8`** 일치. 아래 요청 모두 `startup-help=true`, `entryMatch=true`다. 지시서가 “5페이지”로 명명한 열거 URL은 6개이므로 모두 측정하고 문서 비교 ko/en을 추가했다.

| 페이지 | HTTP | startup-help / entry 일치 |
|---|---:|---|
| `/ko/` | 200 | True / True |
| `/en/` | 200 | True / True |
| `/ko/tools/` | 200 | True / True |
| `/ko/tools/hwp-editor/` | 200 | True / True |
| `/ko/tools/audio-studio/` | 200 | True / True |
| `/en/tools/audio-studio/` | 200 | True / True |
| `/ko/tools/document-compare/` | 200 | True / True |
| `/en/tools/document-compare/` | 200 | True / True |

`/ads.txt` **200/59B**, `google.com, pub-8940087269746960, DIRECT, f08c47fec0942fa0`; `/robots.txt` **200/66B**; `/sitemap.xml` **200/21,596B**. `live-http.json`, `cdn-polls.jsonl`, `live-entry-command.txt`에 원응답·SHA·시각을 보존했다.

**라이브 CLS** — Chrome **152.0.7977.64**, 1280×800/DPR1/light/ko-KR/Asia/Seoul, 매 표본 새 context·cache disabled·SW blocked·무스로틀·consent granted, networkidle·준비 DOM 뒤 3초. 로컬 QA와 같은 S2 `installRenderingObservers` 및 절대 게이트 함수를 사용했다. 라이브 외부 요청 **162건**을 허용·기록했고 네트워크 가로채기·스타일 변경은 하지 않았다. 필드 CWV가 아닌 브라우저 실험 표본이다.

| 페이지 | 로컬 QA CLS 1 / 2 / 3 | 라이브 CLS 1 / 2 / 3 | 라이브−로컬 | sources |
|---|---|---|---:|---|
| `home` | 0 / 0 / 0 | 0 / 0 / 0 | 0 | 모든 표본 `layoutShifts=[]` (이동 없음) |
| `document-compare` | 0 / 0 / 0 | 0 / 0 / 0 | 0 | 모든 표본 `layoutShifts=[]` (이동 없음) |
| `pdf-editor` | 0 / 0 / 0 | 0 / 0 / 0 | 0 | 모든 표본 `layoutShifts=[]` (이동 없음) |

3×3 전부 **≤0.1**. 별도 P2 홈 ko 1회도 **CLS 0 ≤0.114199**, `layoutShifts=[]`. LCP·long task·관측 시간 및 원시 `sources` 수집 구조는 `live-rendering.json`, 각 `CLS {...}` 원출력은 `logs/live-rendering.log`에 있다. 소스가 없다는 것은 필드 누락이 아니라 관찰된 shift가 없다는 뜻이다.

**라이브 접근성·DOM·육안** — Playwright 1.63.0/axe 4.13.0, desktop 1280×800 또는 mobile 412×839/touch, consent granted·폰트 대기·감사용 애니메이션 비활성·외부 요청 차단 없음. S2의 정확히 1개 HWP `iframe[title="rhwp HWP 문서 편집기"]` 예외(소유자 rhwp Studio 0.8.6 upstream)를 재사용하고 일치 개수 1을 단언했다. 호스트 페이지는 감사 대상이다.

| 감사 페이지 | passes | 위반 |
|---|---:|---:|
| `home-ko` | 35 | 0 |
| `home-en` | 35 | 0 |
| `tools-ko` | 39 | 0 |
| `hwp-ko` | 43 | 0 |
| `audio-ko` | 40 | 0 |
| `audio-en` | 40 | 0 |
| `document-ko` | 41 | 0 |
| `document-en` | 41 | 0 |
| `home-mobile-ko` | 36 | 0 |
| `home-mobile-en` | 36 | 0 |
| `tools-mobile-ko` | 40 | 0 |
| `tools-mobile-en` | 40 | 0 |

별도 라이브 직접 감사 **12/12·위반 0**, overflow·pageerror·오류 경계·정적 실패 안내 오노출 0. 홈 ko/en·목록 ko·HWP ko·오디오 ko/en·문서 비교 ko·PDF ko의 desktop, 홈 ko·목록 en mobile 캡처를 Codx가 직접 확인해 정렬 붕괴·잘림·스위치 썸 이탈·로고 왜곡을 관찰하지 않았다. 원자료 `live-audit.json`·`shots/`(감사 24장, 도구 40장, 404 1장)이다.

- **모바일 탭**: 홈·목록 ko/en **4화면**, 보이는 비활성 `.bottom-tab` 전부 **`rgb(105, 105, 111)`**. 활성/비활성·가시성·문구를 개별 DOM 배열에 보존했다.
- **사이드바 로고**: desktop **8화면**, `naturalWidth/naturalHeight=300/60=5`. border box 222×43.59375px, 좌우 padding 합 4px·border 0, 실제 이미지 content box **218×43.59375px = 5.000716846**로 원본 5:1 유지(픽셀 양자화 차이). 처음 보조 검사에서 padding 포함 border box를 원본과 비교해 실패한 것은 **측정식 오류**였다. 제품 변경 없이 content box로 교정하고 전체 감사 재실행 **exit 0**. 실패 스크립트·원출력·JSON은 `initial-logo-box-assertion/`에 보존했다.
- **기존 하네스의 라이브 적용 한계**: 옵션을 실제 사용한 `TEST_BASE_URL=https://worklazy.net/ A11Y_MAX_TOTAL=0 A11Y_REPORT_PATH=/tmp/worklazy-s2/deploy/live-a11y-harness-report.json npm run test:a11y`는 **8페이지 위반 0**이지만 **exit 1**. 원문: `Error: Accessibility audit made 130 external request(s).` QA 전용 외부 요청 0 단언 때문이며 S0/S1 판정과 같다. 이 명령 자체를 통과로 기록하지 않고 위 직접 Playwright+axe 감사 **exit 0**과 구분한다. 위반 임계값·HWP 예외 범위를 넓히거나 저장소 하네스를 수정하지 않았다.

**404** — `/ko/404-없는경로/` 초기 HTTP **404**, title **`Page not found | Worklazy Tools`**, `noindex=true`. 앱 기동 후 URL은 **`https://worklazy.net/ko/`**, `app404ViewRetained=false`. S0/S1 Claude가 확정한 기존 인앱 404 뷰 부재를 그대로 재현했다. P2의 HTTP 404 확인은 통과이고, 앱 404 화면 유지가 구현됐다는 주장은 하지 않는다(`live-contract.json`·`shots/404.png`).

**광고 격리** — ko/en 각각 실제 `crossOriginIsolated=true`까지 기다려 요청을 수집했다. 최소 대상은 비디오·Office app·XLS preserve이며, 일반 페이지 대조군은 Excel 정리 ko/en이다.

| 경로 | ko / en 광고 요청 | ko / en 광고 script DOM | 판정 |
|---|---|---|---|
| `/tools/video-studio/` | 0 / 0 | 0 / 0 | 격리 2/2 |
| `/tools/office-editor/app/` | 0 / 0 | 0 / 0 | 격리 2/2 |
| `/tools/excel-merger/xls-preserve/` | 0 / 0 | 0 / 0 | 격리 2/2 |
| `/tools/excel-cleaner/` 대조 | 4 / 4 | 1 / 1 | 로더 loaded=true, adsbygoogle.js HTTP 200 양어 |

검사 패턴 **`googlesyndication|adsbygoogle`**, 격리 **6/6 요청 0**. URL·응답·격리 마커 원문은 `live-contract.json`·`logs/live-contract.log`에 있다. 광고 로더 정상과 광고가 실제 표시되는지는 서로 다른 사실이며 표시 성공을 단언하지 않았다.

**20 도구 ko/en 직접 진입 — mainTextLength 표** — 새 context에서 URL로 진입하고 각 도구 준비 DOM을 기다렸다. 총 **40/40 양수·빈 화면 0**, 오류 경계·startup-help 오노출 0. HWP en은 기존 한국어 전용 정책대로 초기 HTTP 404 후 `/en/tools`로 이동한 목록 본문이다.

| toolId | ko mainTextLength | en mainTextLength | 최초 HTTP ko / en |
|---|---:|---:|---|
| `excel-merger` | 3155 | 5891 | 200 / 200 |
| `excel-compare` | 1835 | 3585 | 200 / 200 |
| `excel-cleaner` | 1588 | 3011 | 200 / 200 |
| `pdf-editor` | 1775 | 2923 | 200 / 200 |
| `document-compare` | 1380 | 2586 | 200 / 200 |
| `hwp-editor` | 1195 | 4629 | 200 / 404 |
| `office-editor` | 1213 | 2182 | 200 / 200 |
| `video-studio` | 1933 | 3343 | 200 / 200 |
| `audio-studio` | 1414 | 2293 | 200 / 200 |
| `image-studio` | 1471 | 2558 | 200 / 200 |
| `text-merger` | 962 | 1791 | 200 / 200 |
| `text-tools` | 777 | 1420 | 200 / 200 |
| `text-formatter` | 491 | 911 | 200 / 200 |
| `work-calculator` | 570 | 1259 | 200 / 200 |
| `timezone-calculator` | 1992 | 3284 | 200 / 200 |
| `payroll-calculator` | 689 | 1471 | 200 / 200 |
| `image-privacy` | 826 | 1405 | 200 / 200 |
| `security-tools` | 724 | 1442 | 200 / 200 |
| `qr-studio` | 618 | 1086 | 200 / 200 |
| `data-converter` | 529 | 868 | 200 / 200 |

보존 redirect `/ko/tools/word-compare/`, `/ko/tools/hwp-compare/`, `/en/tools/word-compare/`도 **3/3** 해당 언어 문서 비교·파일 입력 2개로 확인했다. 재현: `node /tmp/worklazy-s2/deploy/live-check.mjs rendering`, `... audit`, `... contract`, `python3 /tmp/worklazy-s2/deploy/live-http.py` — 최종 전부 **exit 0**. 각 측정 JSON과 명령 종료 정보(`live-*-command.json`)는 별도 파일로 보존했다. 전체 원출력·종료 commit/push/status는 `/tmp/worklazy-s2/deploy/REPORT.md`에 취합한다. 사용자 미추적 3파일의 SHA-256은 착수 때와 같다. 롤백 시 C-A대로 사후 기록을 보존하고 `revert -m 1 <merge>` 문서 충돌을 수동 해결한 뒤 push·Actions·라이브 확인을 수행한다. — Codx

### S1 문서 비교 죽은 코드 제거 — 브랜치 구현·검증 (Codx)

**판정: 지정 S1 구현과 브랜치 커밋 완료. redirect 4건 중 `/ko/word-compare/`는 기준 main부터 없는 경로라 1건 미통과이며, 완료 기준 전체 통과를 선언하지 않는다.** `CHANGELOG.md`의 S1 항목에 대응한다. 나머지 지정 검증은 통과했고, `s1-dead-code`에서 main 병합·push 없이 멈췄다. 전체 명령·exit·소요·출력·CSS 76규칙 목록·unit diff·종료 git 원문은 `/tmp/worklazy-s1/REPORT.md`, 원자료는 같은 디렉터리의 JSON·`logs/`에 있다. 정본 계획서 수정 0.

- **착수 게이트:** `PROJECT_RULES.md`→`AGENTS.md`→정본 C-A~C-G/S1/검증 총람→backlog·관련 기각 이력 선독. `HEAD=main=origin/main=37d4e69924d80120c3f34a38b0d20dd0e08d3f59`. 열린 15문서 검색에서 상반 지시 0(P2 문서 비교 제외는 종결된 P2 범위, PDF 초안은 별도 표면). 최신 착수 지시가 S0 이후 기준점을 지정한다. 원문 `gate.txt`·`open-plan-scan.txt`.
- **Claude 문서 원문 보존:** `git checkout -b s1-dead-code main` 후 첫 커밋 **`4b2d810`**에 backlog·review-notes 2파일만 지정 메시지로 커밋했다. 원본 `claude-docs.patch`와 커밋 diff가 byte-identical임을 확인했다. 사용자 DOCX 2개·네이버 확인 HTML은 수정·추적·삭제하지 않았다.
- **제거·보존:** Word/HWP 입력 페이지 2개·HWP 결과 페이지·세션 2개(739줄), Word 결과 wrapper 6줄과 import 1줄을 제거했다. 파일마다 삭제 직후 `grep -rnE ... src/ --include=*.ts --include=*.tsx` 재실행(`grep-after-*.txt`). 공유 `DocumentCompareResultPage` export·docModel·worker 2개·client 2개·Word Python 4파일·기존 App redirect 2행 보존. `source-preservation.json`에서 조사한 39파일 중 삭제 5·지정 wrapper/CSS 변경 2·불변 32를 확인했다.

**사용처 전후** — `grep -rn <검색어> src/ --include=*.ts --include=*.tsx`, 자기 선언 포함 일치 행 수. 최종 `WordCompareResultPage` 1행은 살아 있는 공유 모듈 import 경로다. 원문 `grep-before-*.txt`·`grep-final-*.txt`.

| 검색어 (자기 선언 포함 행 수) | 삭제 전 | 삭제 후 |
| --- | --- | --- |
| WordComparePage | 1 | 0 |
| HwpComparePage | 1 | 0 |
| HwpCompareResultPage | 1 | 0 |
| hwpCompareSession | 2 | 0 |
| wordCompareSession | 2 | 0 |
| WordCompareResultPage | 3 | 1 |
| docModel | 1 | 1 |
| wordWorkerClient | 3 | 2 |
| hwpWorkerClient | 4 | 3 |
| word.worker | 1 | 1 |
| hwp-compare.worker | 1 | 1 |

**CSS·manifest:** orphan은 착수 **0** → 페이지 삭제 후 **25 class / 81 arm(exit 1)** → 수동 정리 후 **0(exit 0)**. PostCSS **612→541 rules**, **71개 전체 삭제 + 5개 부분 변경**. 부분 변경은 원본 762행(collage 설명 2arm), 768행(policy/content/about/sheet 설명 4arm), 847행(tool-page button·secondary link), 885행(about-grid), 993행(카드·guide·prose 테두리)의 살아 있는 selector·선언을 보존했다. 전체 삭제/부분 변경 selector 목록은 `css-rule-changes.json`·REPORT, 감사 허용목록 변경 0.

Manifest **149 removed / 1 split / 5 active → 153 / 0 / 2**. Active는 `legacy-004·005`; `006·007·134`는 removedIn/lastUpdatedIn=S1. `132`는 **currentState=removed·removedIn=B3·lastUpdatedIn=S1**로 B3 기대 목록을 유지했다. 생성기를 수정하고 JSON은 `npm run legacy:manifest`로 재생성했다.

**unit 갱신·실패 수리:** `ui-legacy-isolation` 하한 **600→541**은 실측 612−71 및 부분 규칙 5개 유지에 근거하며 관련 **10/10** 통과. removed/split **153/0**, active/S1 제거 ID 단언·진단 문구도 갱신했다. 전체 첫 실행은 **198/200**, `p1b-components`에서 **20 !== 22**, **13 !== 15**로 실패했다. main `git grep -l`과 현재 `rg -l` 소비 집합의 차이는 삭제한 두 페이지뿐(`consumer-counts.json`)이므로 ToolGuide **22→20**, OperationProgress **15→13** 기대값을 갱신해 전체 재실행 **200/200** 통과. 실패 원문 `logs/unit.log`, 최종 `logs/unit-final.log`, diff `unit-update.diff`·`unit-followup.diff`.

**최종 지정 검증** — 다음 명령은 모두 exit 0. browser/new-tools/utilities/office는 `TEST_BASE_URL=http://127.0.0.1:4288`; 시각·접근성·렌더링은 기존 하네스의 자체 preview. 전체 명령 환경변수·로그는 REPORT 검증표에 기록했다.

| 명령 | 초 | 결과 |
| --- | ---: | --- |
| `npm run build` | 101.73 | production |
| `npx tsc -b` | 20.25 | 진단 0 |
| `npm run test:unit` | 3.10 | 200/200 |
| `TEST_SCOPE=word npm run test:browser` | 23.28 | 통과 |
| `TEST_ONLY_HWP=1 npm run test:new-tools` | 7.24 | 통과 |
| `npm run test:browser` | 64.00 | 전체 통과 |
| `npm run test:new-tools` | 140.88 | 전체 통과 |
| `npm run test:utilities` | 111.21 | 전체 통과 |
| `npm run test:office` | 28.87 | 통과 |
| `npm run test:static` | 0.91 | startup 문서 104 |
| `npm run css:orphans` | 0.68 | orphan 0 |
| `npm run legacy:manifest` | 0.38 | 153/0/2 |
| `node tests/tool-registry-routes.mjs` | 1.17 | 통과 |
| `npm run test:recovery` | 284.86 | 147/147 |
| `LANG=ko_KR.UTF-8 npm run test:visual` | 115.21 | 175/175 |
| `LANG=en_US.UTF-8 npm run test:visual` | 116.16 | 175/175 |
| `VITE_LOCAL_QA=1 npm run build` | 94.29 | 최종 dist |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | 19.02 | 5페이지·위반 0·외부 요청 0 |
| `npm run test:rendering` | 43.51 | 3페이지×3회·외부 요청 0 |
| `BUNDLE_BASELINE=/tmp/s1-bundle-baseline.json npm run bundle:measure` | 83.53 | 5종 통과 |
| `git diff --check` | 0.01 | 추적 워킹트리 공백 오류 0 |

- 시각 첫 ko/en 실행은 `/tmp` 캡처 경로가 하네스의 `tests/visual-artifacts` 하위 경로 계약에 어긋나 **0/175에서 종료**했다(`logs/visual-ko.log`·`visual-en.log`). 지원 경로로 수정한 최종 전체 2회는 각 175/175·기준선 diff 0. 캡처는 종료 후 `/tmp/worklazy-s1/captures-ko·captures-en`으로 옮겼다(각 PNG 175장). 범위·임계·제품 코드 변경 0.
- Recovery는 필터 없는 기본 명령 **147/147(desktop 74·Android 에뮬레이션 73)**. S0의 149건은 `RECOVERY_STALE_NEW` 지정 시 B-stale-html 2건이 추가된 수치이며 이번 기본 명령에는 해당 선택 변수가 없다. JSON 결과 147행·개별 JSON 147개·PNG 153장 대조. 실제 Samsung Internet 검증은 아니다.
- Rendering CLS median은 **home 0.038332·document/PDF 0.114199**. 9 sample과 3 median을 별도 `python3 /tmp/worklazy-s1/cls-gate.py`로 **유한수·≤0.114199** 단언해 exit 0. 측정기 자체의 절대 0.1 차단은 S2-H 범위라 추가하지 않았다.

**번들 5종 — gzip bytes:** 착수 main production 빌드 **93.65초**·baseline 측정 **72.04초**, `/tmp/s1-bundle-baseline.json` 고정. 최종 비교도 `VITE_LOCAL_QA` unset, 전체 route 집합·상한·측정기 불변. JS는 이미 도달 불가 코드의 tree-shaking 영향으로 소폭 변화했다.

| gzip metric | main B | S1 B | delta B | 상한 B |
| --- | --- | --- | --- | --- |
| entryJsGzip | 299264 | 299265 | 1 | +20480 |
| affectedRouteJsGzip | 2440457 | 2440445 | -12 | +61440 |
| sharedJsGzip | 2716511 | 2716493 | -18 | +30720 |
| appJsGzip | 5456232 | 5456203 | -29 | +81920 |
| cssGzip | 38757 | 37669 | -1088 | +10240 |

**redirect 4건 — 3건 통과 / 1건 미통과:** 목적지 DOM·h1·drop target 수·pageerror를 실제 브라우저로 검사했다.

| 지정 경로 | 초기 HTTP (Vite) | 도착 경로 | 비교 DOM / drop targets |
| --- | --- | --- | --- |
| /ko/tools/word-compare/ | 200 | /ko/tools/document-compare/ | True / 2 |
| /ko/tools/hwp-compare/ | 200 | /ko/tools/document-compare/ | True / 2 |
| /en/tools/word-compare/ | 200 | /en/tools/document-compare/ | True / 2 |
| /ko/word-compare/ | 200 | /ko/ | False / 0 |

`/ko/word-compare/`는 **기준 main production HTML 목록에도 없고**, S1에도 없다(`static-before.json`·`static-after.json`). main 생성기의 retiredCompareRoutes는 `["tools/word-compare", "tools/hwp-compare"]`; App/생성기 전후 diff 0(`redirect-main-evidence.txt`). Vite는 부재 URL에 SPA index HTTP 200을 반환하고 앱이 `/ko/` 홈을 렌더했다. 최초 timeout 원문 `logs/redirects.log`; 네 결과와 PNG 4장을 수집한 최종 실행도 **exit 1·3 !== 4**(`logs/redirects-complete.log`·`redirect-results.json`·`redirect-shots/`). 요구 URL을 다른 경로로 바꿔 통과 처리하지 않았다. 정적·SEO 변화 0 및 범위 밖 수정 금지 계약대로 경로 추가 0이며, 이 지시서/기준 상태 불일치를 판정 대상으로 남긴다.

**제품 규칙:** 삭제 페이지 문구는 inline ko/en 분기라 별도 전용 로케일 키 없음. `documentCompare` 키는 `DocumentFileColumn`이 소비하므로 보존했으며 locales diff 0·feature-locales 포함 unit 통과. 신규 사용자 문구 없음 → 내부 구현 비노출은 해당 없음. 전후 HTML **107**, crawlable **61**, FAQPage **18**, sitemap SHA-256 **`51abcb369d6f5f715c74e0c411d0ada5386e4e84b0825d2542f1d58430c3ff9b` 동일**; 자산 해시 경로를 정규화한 HTML·소셜 자산 SHA·페이지 집합 차이 0. 광고 HTML 매칭 집합은 전후 0, 격리 meta **7파일** 집합 동일. repo-wide 실행 확장자의 `git grep -l -E 'worklazy-.*isolation|googlesyndication|adsbygoogle'`은 main/HEAD **13파일** 집합 동일(`ad-isolation-grep-*.txt`). 서버 전제 코드 추가 0, dist/vendor 직접 수정 0.

**추가 검사·범위 밖 발견:** `git diff --check main..s1-dead-code`는 **exit 2**, `docs/backlog.md:40: new blank line at EOF.`. 첫 Claude 문서 원문에 있던 공백이며 **내용 수정 금지**대로 보존했다. 지시된 `git diff --check`의 통과와 이 추가 검사 실패를 구분한다. new-tools의 Dolby Vision base-layer는 이 Chrome에 호환 경로가 없어 하네스 자체가 해당 경로를 skip했으며 deterministic unit·fallback 안내는 통과했다. 기존 eval·큰 청크 경고 외 새 제품 결함은 관찰하지 않았다.

**검수 인계:** 마지막 QA `dist/` entry는 **`index-C8iYsFND.js`**, Google/Naver 식별자·추적/광고 로더 URL 부재 및 4288 preview의 HTML byte 일치 확인(`qa-fingerprint-report.json`). 기동 명령 `npx vite preview --host 127.0.0.1 --port 4288 --strictPort`. 검수: `/ko/tools/document-compare/`·`/en/tools/document-compare/` DOCX 입력→비교→결과 상세, ko HWP 입력→결과, 위 redirect 4건, `/ko/`·`/en/`·`/ko/tools/`·`/en/tools/`. Gemini 육안/Claude 판정은 후속 단계이며 이번에 완료했다고 표시하지 않는다. main 병합·push 없음.

— Codx

#### S1 병합·production 배포·라이브 확인 — 사후 기록 (Codx)

**병합·main push·Actions 배포 성공. 라이브 확인은 전 항목 실행했으며, HWP iframe 접근성 2종과 앱 기동 후 404 화면 유지는 기존 결함으로 재현돼 미충족으로 남긴다.** 원래 5페이지 접근성 하네스도 라이브 외부 요청 제한에서 exit 1이므로 명령 전체 통과로 표시하지 않는다. 이번 디스패치의 완료 기준을 변경하거나 제품 코드를 덧붙이지 않았다. 원문 로그·JSON·57장 캡처·최종 커밋/push/status 보고는 `/tmp/worklazy-s1/deploy/REPORT.md`와 같은 디렉터리 `logs/`에 있다. 이 절은 C-A의 사후 기록 예외이며 위 S1 브랜치 구현 기록을 계승한다.

**실행 게이트·병합:** `PROJECT_RULES.md` 전문을 첫 행동으로 읽고 지정 디스패치·AGENTS·정본 C-A/C-D·Publishing checklist·기각 이력을 확인했다. 열린 15문서에서 이번 표면의 상반 지시 0; 이전 P2 제외/브랜치 제한은 종결된 P2 범위다. Gemini/Claude 로컬 시각 검수 통과는 디스패치의 전제대로 확인했다. `main=37d4e69924d80120c3f34a38b0d20dd0e08d3f59`, `s1-dead-code=454d9fbbcc6b43a8203dd94596d0ce038c04f983` 실측 일치. `git checkout main`·`git pull --ff-only origin main`은 Already up to date. 지정 `git merge --no-ff s1-dead-code -m "Merge S1 document-compare dead code removal for live deployment"`으로 **`01be055af657eff7487f9c4a6784c7ee07afb20b`** 생성; 부모는 위 main/S1 두 해시다. 원문 `merge.txt`·`logs/gate.log`·`logs/pull.log`·`logs/merge.log`.

**push 전 main 검증:** 병합 HEAD에서 아래 10개 명령 모두 실제 exit 0. 빌드는 `VITE_SITE_URL=https://worklazy.net/ VITE_BASE_PATH=/`, `VITE_LOCAL_QA` unset으로 Actions와 같은 production 조건이다. Word/HWP는 해당 dist의 `TEST_BASE_URL=http://127.0.0.1:4388` preview를 사용했다. unit **200/200**, startup 문서 **104**, orphan **0**, manifest **153 removed / 0 split / 2 active**, registry **20**. 전체 출력은 `logs/{build,tsc,unit,static,css-orphans,legacy-manifest,registry,diff-check,word,hwp}.log`. HWP 스모크는 3,584B·1페이지·sentinel round-trip/Studio 재열기 통과.

| 명령 | 초 | exit |
| --- | ---: | ---: |
| `npm run build` | 103.26 | 0 |
| `npx tsc -b` | 19.05 | 0 |
| `npm run test:unit` | 3.05 | 0 |
| `npm run test:static` | 1.15 | 0 |
| `npm run css:orphans` | 0.66 | 0 |
| `npm run legacy:manifest` | 0.34 | 0 |
| `node tests/tool-registry-routes.mjs` | 0.53 | 0 |
| `git diff --check` | 0.09 | 0 |
| `TEST_BASE_URL=http://127.0.0.1:4388 TEST_SCOPE=word npm run test:browser` | 20.75 | 0 |
| `TEST_BASE_URL=http://127.0.0.1:4388 TEST_ONLY_HWP=1 npm run test:new-tools` | 6.08 | 0 |

**push·Actions 원문:** `git push origin main` exit 0, `To github.com:Fentanest/WorklazyTools.git` / `37d4e69..01be055  main -> main`. `gh run list --limit 1`로 확보한 **[34028521809](https://github.com/Fentanest/WorklazyTools/actions/runs/34028521809)**의 headSha가 병합 HEAD와 일치. `gh run watch 34028521809 --exit-status --interval 30` exit 0; **success, 총 316초**(2026-09-06 10:50:18→10:55:34 UTC), build/deploy 두 job 성공. Node action deprecation annotation은 경고로 보존했다(`actions-success.json`, `logs/actions-watch.log`).

**production ↔ live:** Actions 성공 후 첫 CDN 확인에서 `curl -s https://worklazy.net/ko/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` 원문은 **`index-4gXIk3iV.js`**. 로컬·라이브 entry **953,288B**, SHA-256 **`91b42eac5a255c1a75868a2eef10caf29ce99e2205824ed471eb1b25e2b25469`** 일치. 홈 ko/en·목록 ko·HWP ko·오디오 ko/en·문서 비교 ko/en **8/8 HTTP 200·entry 일치·startup-help 유지**. 지시서가 “5페이지”라 부른 괄호 목록은 실제 6 URL이라 나열된 6개 모두 측정했다. `ads.txt`·`robots.txt`·`sitemap.xml`도 200; 게시자 `pub-8940087269746960`, sitemap SHA `51abcb369d6f5f715c74e0c411d0ada5386e4e84b0825d2542f1d58430c3ff9b`. 원문 `logs/live-http.log`·`logs/live-entry-grep.log`·`live-http.json`.

**redirect 3/3:** 각각 HTTP 200 뒤 document-compare 도착 DOM·h1·파일 입력 2개 확인. 앞선 잘못된 `/ko/word-compare/` 요구는 이번 디스패치에 없으며 추가하지 않았다.

| 진입 | HTTP | 도착 경로 | 파일 입력 |
| --- | ---: | --- | ---: |
| `/ko/tools/word-compare/` | 200 | `/ko/tools/document-compare/` | 2 |
| `/ko/tools/hwp-compare/` | 200 | `/ko/tools/document-compare/` | 2 |
| `/en/tools/word-compare/` | 200 | `/en/tools/document-compare/` | 2 |

**라이브 접근성·정상 DOM:** Playwright 1.63.0/Chrome 152.0.7977.64, axe 4.13.0, desktop 1280×800, light, consent granted, 폰트/paint 대기, 접근성/캡처용 애니메이션 비활성, 네트워크 차단 없음. 아래 8개 페이지 모두 본문 존재·가로 넘침 0·pageerror 0·오류 경계/정적 실패 안내 오노출 0. 홈 ko/en·목록 ko·HWP ko·오디오 ko/en·문서 비교 ko/en **8화면 9장**을 직접 열어 시각 확인했다(HWP viewport+전체; 문서 비교 ko/en 전체 포함). 글자 정렬 붕괴·문구 잘림·스위치 썸 이탈을 관찰하지 않았다. 전체 audit는 **HWP 때문에 exit 1**, 실패 원문 `2 !== 0`.

| 페이지 | HTTP | mainTextLength | axe 위반 종류 |
| --- | ---: | ---: | ---: |
| `/ko/` | 200 | 2880 | 0 |
| `/en/` | 200 | 4949 | 0 |
| `/ko/tools/` | 200 | 2721 | 0 |
| `/ko/tools/hwp-editor/` | 200 | 1227 | 2 |
| `/ko/tools/audio-studio/` | 200 | 1414 | 0 |
| `/en/tools/audio-studio/` | 200 | 2293 | 0 |
| `/ko/tools/document-compare/` | 200 | 1380 | 0 |
| `/en/tools/document-compare/` | 200 | 2586 | 0 |

- **HWP 기존 결함 재현:** 벤더 iframe `#sb-message` 대비 **3.54:1**, `label-title-only` **5노드**(`#style-name`·`#font-lang`·`#font-name`·`#font-size`·`#linespacing-select`), 총 **2종/6노드**. 이전 `4d0bae9` 실측 원문 `baseline-findings-full.log`의 (규칙 ID, 최종 target) 집합과 이번 집합을 비교해 **동일**을 단언했다. App/HWP/정적 생성기/vendor/접근성 하네스의 S0→S1 diff도 0. 기존 S0 판정·backlog를 계승하며 위반을 없다고 기록하지 않는다. 증거 `logs/evidence.log`·`evidence-summary.json`·`live-audit.json`.
- **기존 하네스 라이브 실행:** `TEST_BASE_URL=https://worklazy.net A11Y_MAX_TOTAL=0 A11Y_REPORT_PATH=/tmp/worklazy-s1/deploy/live-a11y-harness.json npm run test:a11y`는 **19.71초·exit 1**. 하네스의 기존 5대상(root·document·tools·excel-compare·pdf-editor)은 각각 **위반 0**, placeholder **4.8871:1**이나 `Error: Accessibility audit made 68 external request(s).`로 종료했다. 실제 production 광고·Google/Naver 분석 요청이며 로컬 QA의 외부 요청 0 계약과 구분한다. 하네스/요청 차단/임계 수정 0; 로그의 실패 exit를 보존했다.

**404 — 미충족:** `/ko/404-없는경로/` 초기 **HTTP 404**, 제목 `Page not found | Worklazy Tools`, `noindex=true`. 앱 기동 후 **`https://worklazy.net/ko/` 홈**으로 이동, `mainTextLength=2880`, 404 본문 유지 단언 실패(`FAIL 404 page 404 view after app startup`). S0 이전 `baseline-404.log`와 동일 동작이며 기존 backlog/Claude 판정을 계승한다. HTTP 404 성공을 앱 404 화면 유지 성공으로 바꾸지 않았다. 원문 `live-contract.json`·`logs/live-contract.log`·`shots/404.png`; 해당 계약 스크립트 **107.39초·exit 1**.

**광고 격리:** `/ko|en/tools/video-studio/`·`office-editor/app/`·`excel-merger/xls-preserve/` **6/6**, `crossOriginIsolated=true`, 명시 isolation meta 존재, `googlesyndication|adsbygoogle` **요청 0**, 광고 script DOM **0**. 각 새 context에서 동의 granted, app/격리 준비 후 3초 추가 관찰, 네트워크 차단 0. 일반 `/ko|en/tools/excel-cleaner/` **2/2**는 loader HTTP 200·script DOM 1·`adsbygoogle.loaded=true`. 전 경로 요청 배열은 `live-contract.json`의 `ads`에 있다.

**홈 CLS 단일 실측:** **0.0383319580078125 ≤ 0.114199**, LCP **1004ms**, 관측 종료 **5446.20ms**. 새 desktop context·캐시 비활성·동의 granted, 요청 차단/DOM·style 수정 없이 networkidle 후 3초. CLS 표본은 **1회만**이며 다른 브라우저 감사 실행 전 측정했다. field CWV가 아닌 라이브 실험실 표본. layout-shift 2개의 source/rect 원문은 `live-contract.json`의 `cls`.

**20도구 ko/en 직접 진입 — 빈 화면 0/40:** 매 경로 새 context·준비 DOM 확인 후 `mainTextLength>0`; 경계/정적 실패 안내 노출 0. 아래 HTTP는 최초 문서 응답이다. 영어 HWP는 기존 한국어 전용 정책대로 **404→`/en/tools/` 정상 목록 DOM**이며 영어 편집기 정상 동작으로 주장하지 않는다. 경로별 원문·h1·최종 URL은 `live-contract.json`과 `logs/live-contract.log`, PNG 40장과 distinct (언어,도구) 40행을 대조했다.

| 도구 | ko HTTP | ko mainTextLength | en HTTP | en mainTextLength |
| --- | ---: | ---: | ---: | ---: |
| excel-merger | 200 | 3155 | 200 | 5891 |
| excel-compare | 200 | 1835 | 200 | 3585 |
| excel-cleaner | 200 | 1588 | 200 | 3011 |
| pdf-editor | 200 | 1775 | 200 | 2923 |
| document-compare | 200 | 1380 | 200 | 2586 |
| hwp-editor | 200 | 1195 | 404 | 4629 |
| office-editor | 200 | 1213 | 200 | 2182 |
| video-studio | 200 | 1933 | 200 | 3343 |
| audio-studio | 200 | 1414 | 200 | 2293 |
| image-studio | 200 | 1471 | 200 | 2558 |
| text-merger | 200 | 962 | 200 | 1791 |
| text-tools | 200 | 777 | 200 | 1420 |
| text-formatter | 200 | 491 | 200 | 911 |
| work-calculator | 200 | 570 | 200 | 1259 |
| timezone-calculator | 200 | 1992 | 200 | 3284 |
| payroll-calculator | 200 | 689 | 200 | 1471 |
| image-privacy | 200 | 826 | 200 | 1405 |
| security-tools | 200 | 724 | 200 | 1442 |
| qr-studio | 200 | 618 | 200 | 1086 |
| data-converter | 200 | 529 | 200 | 868 |

**기록 경계:** 이번 병합 작업의 직접 추적 변경은 이 사후 기록뿐; 제품/번역/SEO/광고 코드 추가 수정 0. 사용자 미추적 DOCX 2개·네이버 HTML은 보존하며 최종 SHA·status는 REPORT에서 검증한다. 기존 미충족 2항을 통과로 재분류하거나 별도 기능 수리 범위로 확대하지 않는다. — Codx

### S0 빈 페이지 — 오류 경계·초기화 실패·캐시 유지 자동 복구 (Codx)

**판정: 지정 S0 구현과 브랜치 검증 완료. ② 자동 복구는 조건부이며, 지속 실패는 ① 안내로 종료한다.** `CHANGELOG.md`의 S0 항목에 대응한다. `s0-blank-page`에서만 커밋했고 main 병합·push는 하지 않았다. 전체 명령·소요·출력 원문·회차별 표·육안 검수 기동법은 `/tmp/worklazy-s0/REPORT.md`, 원자료는 같은 디렉터리의 `logs/`, `recovery-complete/`, `stale-final-r2/`에 있다. 측정 로그·jobs·사용자 파일은 커밋하지 않는다.

- **실행 게이트:** main/HEAD `5485fadc43677902c51fbc2d13579e8c1a26db0e` 일치, 미추적 사용자 파일 3개만 존재. `PROJECT_RULES.md`·`AGENTS.md`·지정 디스패치·정본 공통 계약/S0·A/B 재현 문서·검토 이력을 읽고 열린 15개 계획서를 재검색했으며 충돌 0. 정본 파일은 변경하지 않았다. 인용 원본 라인은 모두 일치했고 Office 키 삭제는 이미 원본 63행에 있었다. 사전 production build 94.29초·bundle 73.87초 exit 0; 기준 JSON `/tmp/s0-bundle-baseline.json` 고정.
- **경계·재시도:** AppShell Outlet 아래를 포괄하고 루트 언어 랜딩/InvalidLanguageRedirect는 범위 밖이다. 실제 reload 버튼·alert·포커스·55vh 예약, ko/en 안내를 적용했다. 가드는 `[정규화된 대상 route, 현재 경로+search]`로 구분하고 저장소 예외 시 reload를 생략한다. 성공 여부는 Suspense 안쪽 `ToolReady`의 정상 commit/도구 DOM으로 확인한다. 로딩 직후·pageshow·시간 경과로 지우지 않는다. Office/XLS/video 격리 meta가 있으면 청크 재시도 소유자는 reload하지 않는다.
- **기각·수리:** 처음의 `key=pathname+search` 경계 remount는 문서 비교 상세 이동·도구 검색 상태를 지웠다. 전체 browser/new-tools/utilities의 실제 timeout(`browser-smoke.mjs:1002`, `new-tools-smoke.mjs:168`, `utility-tools-smoke.mjs:119`; 원출력은 동명 logs)으로 확인하고, 경계 실패 상태만 reset해 정상 subtree를 보존하도록 수정했다. 세 전체 스모크 재실행이 통과했다. Audio `progress.fail()`은 running 밖에서 무시되므로 파형/전달 실패는 별도 상태 안내로 바꿨다. Canvas 생성은 동기 React effect에 유지해 경계로 전달하며 불필요한 catch를 추가하지 않았다.

**직접 보강 11곳의 귀결·검증** — 생성 지점 수의 가감은 없다. constructor 주입은 테스트 서버의 응답 변환 또는 addInitScript에서만 수행한다.

| # | 생성 지점 | 실패 귀결 | 브라우저 검증 |
|---|---|---|---|
| 1–3 | Audio Regions·Timeline·WaveSurfer | 부분 생성물 정리 후 경계, 파형 비동기 실패는 지역화 안내 | 세 생성자 각각 throw, desktop/Android 통과 |
| 4 | Audio BroadcastChannel | 전달 종료·수동 파일 열기 안내, 페이지 유지 | constructor throw 양 환경 통과 |
| 5 | Image Canvas | React effect의 동기 예외 → route 경계 | getContext throw 양 환경 통과 |
| 6–8 | DataConverter·TextTools·TextFormatter Worker | 생성/전송 동기 실패 → 다음 render에서 경계; error/messageerror → 도구 안내 | 도구별 세 실패 유형 양 환경 통과 |
| 9–10 | Video probe/processor FFmpeg | 기존 try 안 생성·안전한 finally·오류 메시지 → 메인 상태 UI | 두 생성자 각각 throw 양 환경 + 실제 소스 VM 통과 |
| 11 | Video BroadcastChannel | 안내·전달 버튼 비활성·다운로드 유지 | 실제 MP3 결과 생성 후 constructor throw 양 환경 통과 |

**Office/XLS 재검토:** 기존 경로+search 억제와 `crossOriginIsolated && SharedArrayBuffer` 성공 시 삭제를 유지하고 get/set/remove 예외 처리를 추가했다. VM에서 동일 target 반복·search 변경·COI만 있고 SAB 없음·각 저장소 연산 예외를 검사했다. 브라우저 10케이스에서 정상 준비는 reload 1회와 격리 성공 후 삭제, 저장소 예외는 reload 0, Office lazy 실패는 COI 소유자만 1회 reload하고 경계 표시, 청크 가드 설정 0·광고/외부 요청 0. HWP/Audio 원인으로 귀속하지 않는다.

**entry 안내:** inline capture listener가 module script의 실제 error 이벤트를 감지한다. 실패 응답 후 실측 **35/40/47/73ms**, 시험 상한 2초. 임의 mount 타이머는 사용하지 않고 entry를 15초 지연한 정상 진입 두 환경에서 표시 0을 확인했다. 앱 mount 시 제거, 문서 lang 기준 ko/en·루트 양어 병기, inline CSS/외부 요청 0, 초기 hidden/data-nosnippet. 일반·격리·redirect·404 앱 문서 104개에 생성되며 SEO 본문은 그대로 남는다. HTML 자체를 못 받는 완전 offline과 이미 캐시된 구 HTML 소급 삽입은 보장 밖이다.

**stale-document — 결정 조건 그대로 실측:** `/tmp/worklazy-s0/s0-final`(`index-CEPz80MF.js`) → `s0-next`(`index-DE-wK_ZQ.js`), 두 빌드 모두 최종 S0 소스 포함. 후자에 무해한 DOM 식별 1줄만 추가했고 나머지 src 차이 0(`source-provenance.json`, `build-fingerprints.json`). 같은 origin/context에서 HTTP cache·SW·sessionStorage와 `max-age=600`을 유지했다. 캐시 삭제·hard reload·page.route/context.route·수동 reload 없이 홈 → 서버 교체 → 미수신 lazy 경로 진입 → 옛 청크 404를 관측했다. 새 entry 식별+해당 도구 DOM, guard remove 시 ready=true/loading=false를 단언했다.

| 도구 | 언어 | 표본 | 결과 | reload | 소요 범위(초) |
|---|---|---:|---|---:|---|
| hwp-editor | ko | 5 | latest-tool-ready | 1 | 0.507–0.552 |
| hwp-editor | en | 5 | expected-language-redirect | 0 | 0.077–0.119 |
| audio-studio | ko | 5 | latest-tool-ready | 1 | 0.477–0.543 |
| audio-studio | en | 5 | latest-tool-ready | 1 | 0.479–0.563 |
| image-studio | ko | 3 | latest-tool-ready | 1 | 0.573–0.642 |
| image-studio | en | 3 | latest-tool-ready | 1 | 0.544–0.581 |
| data-converter | ko | 3 | latest-tool-ready | 1 | 0.533–0.560 |
| data-converter | en | 3 | latest-tool-ready | 1 | 0.499–0.535 |
| document-compare | ko | 3 | latest-tool-ready | 1 | 0.503–0.544 |
| document-compare | en | 3 | latest-tool-ready | 1 | 0.500–0.523 |

복구 대상 **33/33**, 빈 화면 **0**, **0.477–0.642초 < 600초**, 자동 reload **각 1회**. 영어 HWP 5회는 기존 한국어 전용 정책의 도구 목록 redirect이므로 복구 분모에 포함하지 않았다. HWP iframe Document를 reload로 세던 초기 계측을 최상위 frame 기준으로 교정했고 원자료를 보존했다. 요청별 status·Age·disk cache/SW flags·memory cache 이벤트·시각·최종 DOM·PNG가 있으며 최종 증거 검사에서 파일 누락 0이다.

- 수정 전 `073da56`→`4d0bae9`, 역방향 각 5도구×ko/en×1: 영어 HWP redirect 1건을 제외하고 **각 9/9 root=0, 자동 reload 0**을 재현했다(`control-pre/`, `control-current/`). 기존 결함/fix-forward 판정을 유지한다.
- S0 Audio 지속 404 ko/en 각1: **안내 2/2, reload 1**, guard 유지. 저장소 getter throw 각1: **안내 2/2, reload 0**(`negative-persistent/`, `negative-storage/`). 같은 해시의 404 자체가 600초 캐시되면 서버 응답을 정상으로 돌려도 reload는 disk-cached 404를 받는다. 따라서 **자동 복구를 무조건 성공으로 문서화하지 않는다**. 가드를 유지하는 경계 안내가 이 경우의 보장이다.
- **Android 에뮬레이션(모바일 Chromium) — Samsung Internet 실측 아님.** Pixel 7 touch/mobile UA, Chrome 152.0.7977.64·Playwright 1.63.0. 최종 recovery 스모크 **149/149**: A12·B10·C34·정상80·격리10·crash1·offline2. 정상 진입은 20도구×ko/en×두 환경 **빈 화면 0/80**, HWP EN은 정상 redirect. 실패 주입·정상 진입·crash 복원 후의 판정 시점을 분리했다.
- crash는 Page.crash 확인 → 기존 Puppeteer의 **명시적 page.reload()** → 정상 DOM으로 통과했다. Playwright 1.63은 복원 이후에도 내부 crashed 상태로 DOM 대기를 거절해(`crash-probe.log`) 동일 Chromium의 Puppeteer로 계측을 고정했다. 완전 offline reload는 미수신 HTML의 `ERR_INTERNET_DISCONNECTED`를 확인했고 앱 안내 보장을 주장하지 않았다. wasm 메모리 상한은 제외대로 시도하지 않았다.

**공통 게이트:** production build·unit **200/200**·production static·전체 browser/new-tools/utilities/office·registry·orphan **0**·manifest·diff check 통과. 최종 전체 스모크 소요 browser **54.25초**, new-tools **137.28초**, utilities **108.52초**, office **25.53초**. 두 LANG의 전체 visual은 각 **175/175**, **107.45/106.13초**, 기준선 변경 0. VITE_LOCAL_QA build 뒤 a11y **5페이지/위반0/외부요청0**, rendering **3페이지×3회/외부요청0**, CLS home **0.038332**, 문서/PDF **0.114199**로 상한 비회귀를 실측 대조했다. 측정기 자체의 CLS 임계 차단은 S2-H 범위라 추가하지 않았다. QA build에 별도 시도한 static은 기존 production 분석코드 필수 단언에서 실패했다(`static-qa.log` 원문); 분석 제거를 되돌리거나 기준을 완화하지 않았고 최종 production static은 다시 통과했다. `dist/`에는 의도대로 QA 빌드를 남긴다.

**제품 규칙/예산:** ko/en 동일키와 SEO unit 통과. 전후 HTML **107**, crawlable **61**, FAQPage **18**, sitemap SHA-256 동일(`51abcb369d6f5f715c74e0c411d0ada5386e4e84b0825d2542f1d58430c3ff9b`), 수 변화 0. 요청한 HTML `adsbygoogle|googlesyndication` 재귀 grep은 전후 모두0행, 파일 집합 diff0. 신규 안내 문자열에는 내부 명칭·원시 예외0; repo-wide 실행 확장자 재귀 검색 결과는 `repo-wide-implementation-terms.log`/`repo-wide-recovery-consumers.log`, 신규 경계/정적/common의 일치4행은 코드 식별자뿐이다. 테스트 sentinel의 정확 허용 파일은 신규 recovery 테스트3개+unit1개(Codx 소유·주입/비노출 검증 목적)이고 제품 DOM에서는 부재를 단언했다. 번들 gzip 증분: **entry +1,271B / route +433B / shared +7B / app JS +1,711B / CSS 0B**, 5종 고정 상한 모두 통과, 기준점/상한 변경 없음.

**범위 밖 후보 — 고치지 않고 보고:** `videoWorkerClient.ts:59,214`는 error 처리만 있고 messageerror가 없다(메타데이터는60초 timeout, 처리 시작 후 복원 실패의 즉시 안내 미확인). `text-formatter.worker.ts:60`의 문법 오류 반환과 DataConverter 파일읽기 catch는 기존 원시 메시지를 반환한다. 이번 생성/전송 실패 안내에는 원문을 넣지 않았으며 별도 입력/문법 실패 표면은 지시서의 나머지20곳 수정 금지에 따라 그대로 두었다. 실제 Samsung Internet/사용자 신고 당시 원인 일치/배포 후 Gemini 검수도 이 결과로 주장하지 않는다.

**육안 검수 인계:** `PORT=4188 node tests/recovery-server.mjs`로 남긴 QA dist의 정상 ko/en 영향 경로를 확인한다. `PORT=4189 RECOVERY_FAULT=404 RECOVERY_ASSET=AudioStudioPage- node tests/recovery-server.mjs`에서 양어 audio 경계, `PORT=4190 RECOVERY_FAULT=404 RECOVERY_ASSET=/assets/index- node tests/recovery-server.mjs`에서 entry 안내/루트 양어 안내를 재현한다. 전체 경로 목록·C 주입 기동법·원출력·최종 git 상태는 `/tmp/worklazy-s0/REPORT.md`. Codx는 desktop/mobile 경계·정적 안내 PNG를 열어 버튼·줄바꿈·가시성을 확인했으며 Claude/Gemini 판정을 대신했다고 표시하지 않는다. — Codx

#### 육안 검수 소견 반영 (Codx)

- **착수 게이트:** `s0-blank-page`/HEAD `ceb96ddba4adca6dc933c363279223348f5c5c78`, 미추적 사용자 파일 3개만 존재. 공통 규칙·역할·앞선 S0 보고·fix1 디스패치 선독 후 열린 15개 계획서에서 이번 버튼/포커스 표면의 상반 지시 0을 확인했다. 최신 지시대로 브랜치 커밋 1개만 추가하며 main 병합·push는 하지 않는다. 근거: `/tmp/worklazy-s0/fix1/gate.txt`, `open-plans-scan.txt`.
- **양어 라벨:** 기존 B 사례에 루트 양어 검사가 이미 있었다. 루트 및 ko/en 사례에 버튼 `innerText`와 구분자 가시성 단언을 추가했다. entry 404의 desktop/Pixel 7 각 3경로 실측은 `/` **`새로고침 · Refresh`**, `/ko/tools/audio-studio/` **`새로고침`**, `/en/tools/audio-studio/` **`Refresh`**이며 단일 언어 구분자는 hidden이다. 정적 생성 입력 `index.html`에서만 고쳤고 별도 안내 문단은 유지했다. `entry-labels.json`, `{desktop,mobile}-entry-{root,ko,en}.png` 6장에 기록했으며 PNG를 직접 열어 문구·버튼 잘림이 없음을 확인했다. 모바일은 Chromium Android 에뮬레이션이며 실제 Samsung Internet 측정은 아니다.
- **경계 실측·판정:** Chrome **152.0.7977.64**, Playwright **1.63.0**, desktop **1365×900**에서 홈 → 실제 `page.mouse.click` 사이드바 링크(`isTrusted=true`, 클릭 당시 `:focus-visible=false`) → Audio 청크 404 → 자동 reload → alert 포커스를 관측했다. ko/en 모두 최종 **`:focus-visible=true`, `outline:auto 1px rgb(16,16,16)`**였다(`before-focus-measurement.json`). 디스패치의 수정 조건에 해당해 경계는 테마 ring, 정적 안내는 `#555`의 **solid 2px·offset −2px**을 `:focus-visible`에만 적용했다. 자동 reload 뒤에도 매칭되므로 포커스 표시는 유지되며, 포인터 진입이라는 이유로 무조건 숨기지 않는다.
- **수정 후 접근성:** 실제 마우스 및 Tab→Enter 사이드바 진입 × ko/en **4/4**, 최상위 성공 문서 응답은 홈+자동 reload 각 2개, 최종 경계 `:focus-visible=true`·solid 2px·offset −2px를 단언했다. 경계 4개와 정적 안내 6개 모두 `role=alert`, `tabIndex=-1`, 실제 activeElement 이동을 유지한다. Tab으로 재시도 버튼에 이동하면 포커스 표시가 있고(경계 버튼은 transition 종료 후 ring 3px), 안내 여백을 마우스로 누르면 **active=true·`:focus-visible=false`·`outline:none`**이다. 재현: `node /tmp/worklazy-s0/fix1/measure-focus.mjs`, `node /tmp/worklazy-s0/fix1/capture-entry.mjs`; 결과 `focus-measurement.json`·`entry-labels.json`.
- **실패·교정 기록:** 최초 측정 선택자의 끝 슬래시 가정은 실제 sidebar href에 없어 30초 timeout → 실제 href로 수정했다(`logs/focus-measurement.log`). 첫 스타일의 `outline-none`은 Tailwind `--tw-outline-style:none`을 남겨 `focus-visible:outline-2`만으로는 **`none !== solid`** 단언에 실패했다(`logs/focus-after-production.log`) → `focus-visible:outline-solid`를 명시해 재빌드·실측 통과했다. 그 이전 전체 recovery 실행은 수정본 재빌드를 위해 exit **130**으로 중단했고 `recovery-initial-interrupted/`와 동명 log를 보존했다.
- **최종 검증·인계:** production build **93.92초**, static **104 startup 문서/1.89초**, unit **200/200·2.76초**, recovery **149/149·279.50초**, 포커스 **4/4·8.27초**, entry 캡처 **6/6·4.97초**, 마지막 `VITE_LOCAL_QA=1 npm run build` **94.68초**, 모두 exit **0**. B-stale-html 추가 2사례에는 앞선 보존 빌드 `/tmp/worklazy-s0/s0-next`를 사용했다. sitemap SHA-256은 앞선 S0와 같고 entry 실패 외부 요청 0, ko/en·SEO·광고 격리 정적 검사 통과. QA entry `index-CqGahg57.js`에서 분석 식별자·추적/광고 로더 URL이 제거됐고 4188·4189·4190의 응답은 최종 QA `dist/index.html`과 byte-identical이다(`qa-dist.json`). 최초 보조 Node fetch는 4190을 `bad port`로 거절해 로컬 HTTP 모듈로 확인했고 서버는 변경하지 않았다(`logs/qa-check-fetch-failed.log`). 전체 명령·출력·검증표·캡처·종료 git 상태는 `/tmp/worklazy-s0/fix1/REPORT.md`와 `logs/`에 기록한다. — Codx

#### S0 게이트 ⑨ 판정 — 라이브 "미통과" 2건은 기존 결함, S0 배포 유효 (Claude)

**판정: S0 배포 게이트 ⑨ 통과. Codx 가 실패로 기록한 2건은 S0 회귀가 아니라 배포 이전부터 있던 결함이며 `docs/backlog.md` 로 이관한다. 롤백 사유 없음.** 근거는 Codx 사후 확인 원자료(`/tmp/worklazy-s0/deploy/logs/`)를 Claude 가 직접 대조한 것이다.

- **HWP 편집 접근성(desktop)**: 위반 노드가 전부 벤더 rhwp Studio **iframe 내부**(`#sb-message` 대비 3.54 · `#style-name`·`#font-lang`·`#font-name` `label-title-only`)다. `baseline-findings-full.log`(S0 이전 `4d0bae9` dist)에서 동일 노드 검출 → 기존 결함. 「생성물 직접 수정 금지」 대상(`public/vendor/**`)이라 저장소에서 고칠 표면이 아니다. 접근성 게이트 하네스(`tests/accessibility-audit.mjs`)는 5페이지·desktop 1280 만 측정하며 HWP·iframe 을 포함하지 않으므로 이번 배포 게이트 ②(위반 0)와 모순되지 않는다 — 하네스 범위 확장 여부는 S2-H ③ 에서 결정.
- **모바일 하단 탭 라벨 대비 3.06**(`#909098`/`#fbfbfd`, 12px bold): P2 셸 스타일이며 S0 diff 에 하단 탭 CSS 변경 0(Codx `git diff 5485fad HEAD -- src/styles/global.css` 실측). 기존 결함 → backlog(수정은 1줄 색 토큰 조정 수준, 시각 기준선 갱신 수반).
- **없는 경로 → HTTP 404 후 앱이 홈 렌더**: `renderNotFound()` 가 `noindex`·404 제목의 `404.html` 을 생성하고 GitHub Pages 가 HTTP 404 로 서빙하는 것까지는 설계대로다(P2 배포 계약이 확인한 범위). 앱 기동 후 React Router 에 catch-all NotFound 뷰가 없어 홈으로 떨어지는 것은 `4d0bae9` 에서도 동일(`baseline-404.log`). Codx 의 "앱 기동 후에도 404 화면 유지" 단언은 이번 디스패치가 새로 세운 기준이며 기존 계약이 아니다 → 제품 결정 사항으로 backlog(인앱 NotFound 뷰 신설 여부).
- 라이브에서 S0 계약 자체는 전부 성립: entry `index-CqlI-bD5.js` 로컬 production 과 SHA 일치 · `startup-help` 존재 · 20도구 ko/en 진입 빈 화면 0/40 · 격리 6/6 광고 요청 0 · 일반 광고 로더 정상 · 홈 CLS 0.038332. Gemini 라이브 재검수(agy `gemini-3.1-pro-high`, 배포 후): 20도구 × ko/en × desktop/Pixel 7 = **80 화면 전부 정상**. 산출물 대조(CLAUDE.md §5-7): `results.jsonl` 80엔트리(+광고 격리 확인 2) · `shots/` 80장 · distinct route 40 — 표의 80행과 일치. 빈 화면 0 · 오류 경계 노출 0 · 정적 안내 오노출 0. 산출물 `/tmp/worklazy-s0/gemini-live/`.

— Claude

#### 승인된 main 병합·배포 사후 확인 (Codx)

**판정: 사용자 승인 S0 병합·배포는 완료했으나 라이브 게이트 ⑨는 미통과다. HWP 접근성 2종 및 없는 경로의 홈 이동을 실제 실패로 기록한다.** 2026-09-06 S0 병합 디스패치에 따라 실행했으며 위 브랜치 검증 기록 이후의 배포 결과다. 정본 C-A의 사후 기록 예외로 이 절을 병합 위 문서 커밋에 기록한다.

- **게이트·병합:** 선독·열린 15개 계획서 충돌 검사 후 `main=5485fadc43677902c51fbc2d13579e8c1a26db0e`, `s0-blank-page=3672fc7af03f3fedd11fe36c8f238b474ce4c4e1` 일치를 확인했다. `git checkout main` → `git pull --ff-only origin main`은 Already up to date. `git merge --no-ff s0-blank-page -m "Merge S0 blank-page recovery for live deployment"` → **`b7e39772e7dc0e3bd09c178ae04b79e75e7b230d`**, 두 부모는 위 main/S0 해시다. 병합 트리는 검수된 S0와 동일(`git diff --exit-code s0-blank-page HEAD`, exit 0). 정본의 Gemini 로컬 60화면 검수·Claude 12장 재확인 통과를 승계했다. 4173·4183 preview 리스너가 없어 종료할 프로세스는 없었다.
- **push 전 실측:** 아래 검증 모두 exit 0. unit **200/200**, recovery **149/149**(desktop 75·Android Chromium 74), static **104 startup 문서**, QA a11y **5페이지·위반 0·외부 요청 0**. 실제 Samsung Internet 측정은 아니다. QA → 최종 production 복원 후 entry JS와 `/ko/` HTML이 첫 production 빌드와 byte-identical이며 static도 재통과했다. 모든 production 빌드에 Actions와 같은 `VITE_SITE_URL=https://worklazy.net/`, `VITE_BASE_PATH=/`를 명시하고 `VITE_LOCAL_QA`를 unset했다. QA는 `VITE_LOCAL_QA=1`; a11y는 `A11Y_MAX_TOTAL=0`. 기존 eval·큰 청크 경고 외 오류 없음.

| 검증 로그 이름 (아래 원자료의 command/출력과 대응) | exit | 초 |
| --- | ---: | ---: |
| `build-production` | 0 | 94.50 |
| `unit` | 0 | 2.58 |
| `static` | 0 | 0.86 |
| `recovery` | 0 | 273.30 |
| `registry` | 0 | 0.83 |
| `diff-check` | 0 | 0.08 |
| `build-qa` | 0 | 92.46 |
| `a11y` | 0 | 18.51 |
| `build-production-final` | 0 | 90.63 |
| `static-final` | 0 | 0.74 |

- **push·Actions:** `git push origin main` → `5485fad..b7e3977  main -> main`, exit 0. [Pages 실행 34024575857](https://github.com/Fentanest/WorklazyTools/actions/runs/34024575857)은 병합 SHA와 일치하고 **success**, 생성 `2026-09-06T09:24:48Z` → 완료 `2026-09-06T09:30:08Z`(**320초**). `gh run watch 34024575857 --exit-status --interval 15` exit 0, build/static/video hybrid smoke/deploy success.
- **라이브 파일·HTTP:** `curl -s https://worklazy.net/ko/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` → **`index-CqlI-bD5.js`**, 병합 커밋 production과 파일명·SHA-256 **`a6b111354eb6d6ec9f6b4efb78a49e3b04ca7fa50fa7b78a33f72e7d66330d8e`** 모두 일치. `startup-help`는 아래 모든 라이브 HTML **6/6**에 있고 정상 앱 화면에서는 보이지 않는다. 지시서의 “5페이지”에 열거된 URL은 ko/en을 풀면 6개이므로 모두 검사했다. `/ads.txt`·`/robots.txt`·`/sitemap.xml` HTTP 200, ads 게시자 일치. CDN은 **첫 확인부터 일치**했고, 원자료 정리 중 HTTP를 1회 재확인했다.

**라이브 접근성·육안:** axe-core 4.13.0 / Playwright 1.63.0 / Chrome 152.0.7977.64; light·동의 granted·폰트/paint 대기·감사 시 애니메이션 제거. 전체 axe 규칙, 요청 차단 없이 실제 production에서 desktop 1280×800·mobile viewport 390×844를 각각 측정했다. **desktop 6페이지 중 5페이지 위반 0, HWP 2종(color-contrast·label-title-only)**으로 0 기준에 실패했다. 추가 mobile viewport 검사는 홈 ko 1종, HWP 3종(color-contrast·label-title-only·landmark-unique), 나머지 4페이지 0이다. 동일 origin HTTP 오류·pageerror 0, 문서 가로 overflow 0px. full-page/viewport 원본 각 12장(총 24장)을 저장했고 desktop full-page 6장·mobile viewport 6장을 Codx가 직접 열어 레이아웃·문구 잘림·버튼 정렬을 확인했다. 이번 라이브 검수는 Codx 실측이며 Gemini의 별도 라이브 판정으로 표시하지 않는다.

| 라이브 경로 | HTTP | desktop axe passes | violations desktop / mobile |
| --- | ---: | ---: | ---: |
| `/ko/` | 200 | 35 | 0 / 1 |
| `/en/` | 200 | 35 | 0 / 0 |
| `/ko/tools/` | 200 | 39 | 0 / 0 |
| `/ko/tools/hwp-editor/` | 200 | 51 | 2 / 3 |
| `/ko/tools/audio-studio/` | 200 | 40 | 0 / 0 |
| `/en/tools/audio-studio/` | 200 | 40 | 0 / 0 |

- **404 — 실패:** `/ko/404-없는경로/` 최초 HTTP **404**지만 앱 기동 후 URL은 `https://worklazy.net/ko/`, 본문은 홈이다. 따라서 **404 페이지 유지 조건 미통과**다(`404.png`, `live-contract.json` 원문). 이전 `4d0bae9` 보존 빌드에서도 HTTP 404 → `/ko/` 홈을 재현했다(`baseline-404.json`, probe exit 0).
- **광고 격리:** consent granted·새 context·요청 차단 없이 video/office app/XLS 보존 × ko/en **6/6**에서 `crossOriginIsolated=true`, 광고 script DOM **0**, `googlesyndication|adsbygoogle` 요청 **0**. 일반 Excel Cleaner ko/en 양성 대조 **2/2**는 loader HTTP 200·`adsbygoogle.loaded=true`로 확인했다. 계정 승인·광고 지면 게재 판정은 이 검사에 포함되지 않는다.
- **홈 ko CLS:** 한 번의 라이브 desktop 표본 **0.038332 ≤ 0.114199**, LCP **996.00ms**, 관측 종료 **5526.30ms**. cache disabled·동의 granted·networkidle 후 3초, 요청 차단/스타일 변경 없이 기존 측정기의 `!hadRecentInput` layout-shift 합산으로 측정했다. 실험실 1회 표본이며 실사용 CWV 집계는 아니다.

**실패의 기존 상태 대조:** 이전 A/B의 `4d0bae9` production 보존 빌드(`5485fad`까지 차이는 문서뿐)를 로컬에서 실행해 HWP desktop `color-contrast`·`label-title-only` **2종을 동일 재현**했다. 상태 문구 `#sb-message`는 **3.54:1**, `#style-name`·`#font-lang`·`#font-name`·`#font-size`·`#linespacing-select`는 title만 제공한다. 모바일 홈 하단 탭도 동일 **3.06:1**을 재현했고 S0 전후 `src/styles/global.css`·`tailwind.css` diff는 0이다. 근거 `baseline-findings.json`, `baseline-findings-full` exit 0·8.25초; 추적 동의 denied·외부 요청 0. **기존 문제임을 S0 회귀 아님으로 판정한 것이며, 라이브 위반 0 또는 404 게이트 통과를 뜻하지 않는다.** HWP iframe을 감사에서 제외하지 않았고 제품·벤더·라우팅을 이 배포 작업에서 추가 수정하지 않았다.

최종 실패 원문:

```text
Desktop live accessibility contract: violations=2; limit=0
AssertionError [ERR_ASSERTION]: Live desktop accessibility zero-violation contract failed
2 !== 0
40 direct routes: no blank pages; isolated ad requests: 0
AssertionError [ERR_ASSERTION]: Live unknown route must retain a 404 page after app startup
```

**20도구 ko/en 직접 진입 — 빈 화면 0/40:** 실제 도구 준비 DOM 뒤 `main.innerText.trim().length > 0`, 오류 경계·startup 안내 표시 없음을 단언했다. 최초 HTTP는 **39건 200, HWP EN 1건 404**이며 HWP EN은 기존 정책대로 영어 도구 목록으로 이동하고 그 목적지 HTTP는 200이다. 없는 영어 HWP 정적 문서는 이전 빌드에도 없으며 동일 404 → 도구 목록을 재현했다.

| 도구 | ko mainTextLength | en mainTextLength | 결과 |
| --- | ---: | ---: | --- |
| `excel-merger` | 3155 | 5891 | 정상 |
| `excel-compare` | 1835 | 3585 | 정상 |
| `excel-cleaner` | 1588 | 3011 | 정상 |
| `pdf-editor` | 1775 | 2923 | 정상 |
| `document-compare` | 1380 | 2586 | 정상 |
| `hwp-editor` | 1195 | 4629 | EN 최초 HTTP 404 → `/en/tools` HTTP 200 (기존 정책) |
| `office-editor` | 1213 | 2182 | 정상 |
| `video-studio` | 1933 | 3343 | 정상 |
| `audio-studio` | 1414 | 2293 | 정상 |
| `image-studio` | 1471 | 2558 | 정상 |
| `text-merger` | 962 | 1791 | 정상 |
| `text-tools` | 777 | 1420 | 정상 |
| `text-formatter` | 491 | 911 | 정상 |
| `work-calculator` | 570 | 1259 | 정상 |
| `timezone-calculator` | 1992 | 3284 | 정상 |
| `payroll-calculator` | 689 | 1471 | 정상 |
| `image-privacy` | 826 | 1405 | 정상 |
| `security-tools` | 724 | 1442 | 정상 |
| `qr-studio` | 618 | 1086 | 정상 |
| `data-converter` | 529 | 868 | 정상 |

**원자료·재현:** `/tmp/worklazy-s0/deploy/`의 `gate.txt`·`open-plan-surface-scan.txt`·`merge-provenance.json`, 각 명령 JSON의 command/exit/seconds와 `logs/*.log`, `production-fingerprint.json`·`qa-fingerprint.json`, `actions-run.json`, `live-http.json`·`cdn-polls.jsonl`, `live-audit.json`·PNG 24장, `live-contract.json`·`404.png`, `visual-review.txt`에 원출력을 보존했다. 라이브 재현 명령은 `python3 /tmp/worklazy-s0/deploy/live-http.py`, `node /tmp/worklazy-s0/deploy/live-audit.mjs`, `node /tmp/worklazy-s0/deploy/live-contract.mjs`이며 exit는 순서대로 **0 / 1 / 1**이다. 접근성·404 실패 기준을 제거하지 않고 마지막에 실패 종료하도록 전체 수집했다. 최초 보조 실행의 모바일 0 단언과 HWP EN 최초 HTTP 200 단언은 지정 범위를 넘긴 측정 가정이어서 원출력을 `initial-extra/`에 보존하고 교정했다. 실제 지정 조건의 실패 원문은 `desktop-failure/`·`notfound-failure/`·최종 logs에 보존했다. 사용자 파일 3개·jobs·측정 산출물은 커밋하지 않는다. 롤백이 필요하면 C-A대로 사후 기록을 보존하고 `revert -m 1 <merge>`의 문서 충돌을 수동 해결한 뒤 push·Actions 성공·라이브 확인까지 수행한다. — Codx

**원자료 정리 보정:** 보조 실행기의 메타데이터 파일명과 최초 라이브 결과 JSON 이름이 겹쳐, CLS는 최초 `logs/live-contract.log`의 원본 JSON 행에서 `live-cls.json`으로 복원했다(추가 CLS 측정 0회). HTTP 결과는 별도 실행 이름으로 재확인했다. 복구한 CLS·진입 40행·광고 8행·최종 axe 12행을 각 원본 stdout과 전부 대조해 일치를 확인했다(`evidence-reconciliation.txt`). `live-contract.mjs` 최종 실행은 앞선 진입·CLS 수집 결과를 유지하고 광고 검사를 재개한 실행이며, 초기·중간·최종 소스/출력을 함께 보존했다. — Codx

### P2 main 병합·라이브 배포 후 검증 (Codx)

**판정: 승인된 배포를 완료했고 배포 후 게이트 ⑥을 통과했다. 지정 7개 화면에서 레이아웃 파손·조작 불가·데이터 손실 가능성을 발견하지 않아 롤백하지 않았다.** CHANGELOG의 같은 날짜 P2 배포 항목에 대응한다. 제품 코드·번들 예산 상한/기준점·개인 파일 3개는 수정하지 않았다.

- **실행 게이트**: `PROJECT_RULES.md` 전문, `AGENTS.md`, P2 정본의 배포 계약·사용자 결정·게이트 판정, `PUBLISHING_CHECKLIST.md` 4항과 관련 기각 이력을 선독했다. fetch 후 `HEAD=6fc458fa064e3e59c7e6d0cfaf9b0101d73139db`, `origin/ui-migration=3588ebafab3dd876746e356ea652d923eda0f5e5`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`가 지시와 일치했다. 추적 변경 0, 개인 미추적 `before.docx`·`after.docx`·네이버 확인 HTML만 존재했다. 열린 14문서에서 이번 배포와 상반된 최신 지시는 없었다. U4 PDF는 비정본 후속이며 이전 브랜치 push 금지는 2026-09-06 사용자 승인으로 해제됐다.
- **계보·백업·병합**: `git push origin ui-migration` → `3588eba..6fc458f`, exit 0. `git switch main` 후 `git merge --no-ff ui-migration` → **`1ff9187e655575ea49bac327560861632bdf2815`**, 부모는 기존 main `073da56`과 검수 HEAD `6fc458f`다. `git diff --exit-code ui-migration HEAD` exit 0으로 병합 트리가 검수 브랜치와 동일함을 확인했다. 지시서의 30커밋은 `073da56..0663c74`에서 맞으며, 후속 충돌 수정 `3807644`·시계 수정 `6fc458f`를 포함한 실제 병합 이력은 **32커밋**이다. squash/rebase는 사용하지 않았다.
- **push 전 검증·실배포**: main에서 `npm run build` exit 0, **2,830 modules·정적 61페이지**, Vite 74초. 기존 eval·500kB chunk 경고 외 오류 없음. `npm run test:static`도 exit 0. `git push origin main` → `073da56..1ff9187`, exit 0. [Pages 실행 33981007120](https://github.com/Fentanest/WorklazyTools/actions/runs/33981007120)은 **build·static·video hybrid smoke·deploy 모두 success**이고 `gh run watch 33981007120 --exit-status`도 exit 0이다. 승인된 게이트 ①~⑤의 unit 195/195·전 스코프·KO/EN visual 각 175/175는 요청대로 재실행하지 않았다.
- **라이브 반영 확인·측정 전제 정정**: 라이브 진입 JS `index-BA1o-uV3.js`·CSS `index-DBcq71er.css`는 해당 성공 Actions의 업로드 목록과 일치한다. CSS 229,959B는 로컬과 byte-identical(SHA-256 `8c61ecc0a2c74349ac209964280df667179cae01af7c3ab31977fcefa26ff399`)이다. 최초 보조 검사에서 로컬 진입 JS 파일명 `index-BPo-f7fF.js`까지 같아야 한다는 가정은 실패했다. CI는 `VITE_SITE_URL`을 명시하고 로컬은 기본값을 쓰며 실제 번들도 950,503/950,468B로 달랐다. 로컬 파일명 동등성을 배포 성공으로 오인하지 않고 **성공한 CI 산출물 목록과 실제 라이브 참조**로 대조했다. 제품 수정은 하지 않았다.

**라이브 접근성** — axe-core **4.13.0**·Playwright **1.63.0**·Chrome **152.0.7977.64**·1280×800·light·ko-KR·Asia/Seoul. 기존 감사 스크립트와 같은 전체 axe 규칙·동의 granted·폰트/paint 대기·애니메이션 제거 조건이다. 라이브 복사본에서 로컬 QA 전용 외부 요청 0 단언만 제거하고 실제 외부 요청 **69건**을 기록했다. 접근성 기준과 제품 DOM은 바꾸지 않았다.

| 페이지 | 경로 | passes | 전환 전 → 배포 후 violations |
| --- | --- | ---: | ---: |
| 홈(언어 랜딩) | `/` | 25 | 1 → **0** |
| 문서 비교 | `/ko/tools/document-compare/` | 41 | 2 → **0** |
| 도구 목록 | `/ko/tools/` | 39 | 1 → **0** |
| Excel 비교 | `/ko/tools/excel-compare/` | 46 | 2 → **0** |
| PDF 도구 | `/ko/tools/pdf-editor/` | 43 | 4 → **0** |

합계 **10 → 0(−10)**, critical/serious/moderate **0/0/0**. 문서 비교 placeholder는 `rgb(105,105,111)` on `rgb(242,242,247)`, **4.8871087704:1**로 4.5:1 이상이다.

**육안·모바일·조작** — 위 5화면 + Excel 병합 EN mobile + HWP 문서 로드 후를 라이브에서 직접 열어 **13개 프로필**(1280×800 desktop·390×844 mobile, Excel EN은 mobile)을 채집했다. 원본 PNG를 직접 열어 정렬·토글 썸·줄바꿈·액션 가림을 대조했고 차단 증상은 없었다. 13프로필의 문서 가로 overflow **0px**, 동일 origin HTTP 오류와 pageerror **0건**이다. 모바일 일반 도구 5화면은 최하단 오차 **0px**, main padding **80px ≥ tabs 62px**, footer bottom **763.64~764.20px ≤ tabs top 773px**다. 루트 랜딩은 하단 탭이 없고, HWP 로드 상태는 전용 편집 화면으로 별도 확인했다.

- 문서 비교 스위치 Space ON/OFF 복원과 Excel 비교 키 모드 선택, Excel EN 시트 선택 토글·병합 방식 3개 실제 클릭이 동작했다. Excel EN 병합 분절은 **100×56px·2줄**, text Range 이탈 0·버튼 hit 검사 통과다. 최초 캡처는 native `scrollIntoViewIfNeeded`가 고정 하단 탭을 고려하지 않아 관심 분절이 캡처 아래에 놓였으므로, 추가 스크롤로 같은 화면의 분절을 중앙에 배치해 `excel-merger-en-mobile-controls.png`로 검수했다. 스크롤로 도달 가능한 영역이며 제품 결함으로 판정하지 않았다.
- HWP는 저장소의 합성 fixture를 로드하고 toolbar hit 검사를 통과했다. desktop 버튼 오른쪽 최대 **1139px**, 언어 전환기 앞에서 종료하며 mobile은 3+2행으로 모두 보인다. `P2_LIVE_DEPLOY_QA`를 입력해 **3,584B HWP 다운로드·core 재파싱(1페이지·문구 보존)·Studio 재개방**까지 확인했다. 개인 문서는 사용하지 않았다. HML 비활성은 해당 fixture의 기존 저장 가능 판정이며 가림이 아니다.
- **404**: sitemap의 공개 경로와 ads/robots/sitemap/404 문서·격리 workspace를 포함한 **69 URL 모두 HTTP 200**, 진입 JS/CSS **2/2 HTTP 200**. 의도적으로 만든 `/p2-deployment-check-intentionally-missing-20260906`은 **HTTP 404**였다. 추가로 실제 UI 13프로필의 동일 origin 요청에서 HTTP 오류 0을 확인했다.

**렌더링·Core Web Vitals 실측의 범위** — 기존 렌더링 측정기와 같은 Chrome 152·1280×800·light·ko-KR·cache off·SW block·무스로틀·cold **3회 중앙값**, networkidle 뒤 **3초** 대기다. 라이브 production은 HTTPS 네트워크 및 실제 동의 후 광고/추적을 포함해 외부 요청 **162건**이 발생했다. 따라서 광고 없는 로컬 loopback과의 차이를 순수 UI 성능 회귀로 단정하지 않는다. 측정 시각은 **2026-09-06 02:38 KST**다. 렌더링의 홈 표본은 기존 기준과 같은 `/ko`이며 접근성 홈 표본 `/`와 구별한다.

| 페이지 | LCP ms: 로컬 → 라이브 (Δ) | CLS: 로컬 → 라이브 | blocking ms: 로컬 → 라이브 (Δ) |
| --- | ---: | ---: | ---: |
| 홈 `/ko` | 91.34 → **508** (+416.66) | 0.038332 → **0.038332** | 146 → **109** (−37) |
| 문서 비교 | 90.67 → **732** (+641.33) | 0.114199 → **0.114199** | 49 → **85** (+36) |
| PDF | 512.32 → **168** (−344.32) | 0.114199 → **0.114199** | 52 → **32** (−20) |

blocking은 FCP 이후 관측창의 `sum(max(0,longTask.duration−50ms))`이며 정식 필드 INP가 아니다. 별도 실제 클릭의 Event Timing 최대 duration은 홈 **64ms(1회)**·문서 **64ms(5회)**·PDF **48ms(5회)**였다(16ms 이상 event 수집). 이 역시 **실험실 표본이며 실사용 INP·CrUX/Search Console의 28일 집계 판정이 아니다**. 실사용 집계는 이번 세션에서 측정하지 않았다. 문서/PDF의 CLS 0.114199는 기존 기준과 동일하며 이를 개선 완료 또는 모든 CWV 통과로 표시하지 않는다.

**광고·추적** — consent granted, KO/EN 양쪽에서 일반 Excel Cleaner 양성 대조와 video/office/XLS 격리 경로를 각각 새 브라우저 context로 열어 검사했다.

| 경로(각 KO/EN) | AdSense DOM / loader 요청 | 로더 응답·실행 | GA / Naver DOM | 격리 상태 |
| --- | ---: | --- | ---: | --- |
| `/tools/excel-cleaner/` | **1 / 1** | **HTTP 200, `adsbygoogle.loaded=true`**, 실패 0 | 1 / 1 | 일반 경로 |
| `/tools/video-studio/` | **0 / 0** | 광고 로드 없음 | 1 / 1 | marker·crossOriginIsolated true |
| `/tools/office-editor/app/` | **0 / 0** | 광고 로드 없음 | 0 / 0 | marker·crossOriginIsolated true |
| `/tools/excel-merger/xls-preserve/` | **0 / 0** | 광고 로드 없음 | 0 / 0 | marker·crossOriginIsolated true |

격리 경로 **6/6 광고 DOM·요청 0**, 일반 양성 대조 **2/2 로더 정상 실행**이다. 광고 지면의 실제 게재/계정 승인 상태까지 이 결과로 주장하지 않는다.

**재현 명령·증거** — `/tmp/worklazytools-p2-deploy-20260906/`에 원본 JSON·PNG·실행 로그·배포 메타데이터·검증용 스크립트를 보존했다. 다음 명령은 전부 실제 **exit 0**이었다. `live-a11y.mjs`와 `live-rendering.mjs`는 기존 `tests/accessibility-audit.mjs`·`tests/rendering-baseline.mjs`의 라이브 전용 복사본이며 production 외부 요청을 기록·허용하고 보고서의 환경 설명만 바로잡았다. repo 제품·테스트 코드 변경은 없다.

```sh
npm run build
npm run test:static
gh run watch 33981007120 --exit-status --interval 15
TEST_BASE_URL=https://worklazy.net A11Y_REPORT_PATH=/tmp/worklazytools-p2-deploy-20260906/live-a11y.json node /tmp/worklazytools-p2-deploy-20260906/live-a11y.mjs
node /tmp/worklazytools-p2-deploy-20260906/live-ui.mjs
node /tmp/worklazytools-p2-deploy-20260906/live-excel-controls.mjs
python3 /tmp/worklazytools-p2-deploy-20260906/live-http.py
node /tmp/worklazytools-p2-deploy-20260906/live-ads.mjs
TEST_BASE_URL=https://worklazy.net RENDER_REPORT_PATH=/tmp/worklazytools-p2-deploy-20260906/live-rendering.json node /tmp/worklazytools-p2-deploy-20260906/live-rendering.mjs
node /tmp/worklazytools-p2-deploy-20260906/live-interaction.mjs
```

### P-QA 커밋·시각 하네스 시계 결정성 (Codx)

- **실행 게이트·A 커밋**: `PROJECT_RULES.md`·`AGENTS.md` 전문 선독, `ui-migration`의 기준 `0663c7449f94f8d046e36c8ec16502582dd4f001` 일치, 열린 계획 14문서 충돌 검사 완료. 최신 지시로 이전 commit 금지만 무효화하고 모든 push 금지는 유지했다. Claude의 두 결함 해소 판정을 수용해 기존 수정을 보존했다. A=`380764486ebffdbcc5cc065c6cad0278146f503c`, **109파일**: 제품 2·scenario/test 2·기록 2·기준선 4(수정 1+신규 3)·증거 99(PNG 68). 증거는 기존 QA 추적 관례대로 4디렉터리 전부 포함했다. [포함 경로 전문](../tests/visual-artifacts/clock-fix-evidence/task-a-included.txt). 사용자 `before.docx`·`after.docx`·네이버 소유확인 HTML과 jobs는 제외했다.
- **원인·채택**: 이전 KO/EN **174/175** 실패의 공통 원인인 `DateTime.now()`를 제품 기본값에서 제거하는 안은 기각했다. `tests/visual-regression-clock.mjs`가 navigation 전에 선택 도구의 `Date.now()`·무인자 `new Date()`·함수 호출 `Date()`를 **2026-09-05T03:00:00.000Z(서울 12:00)**로 고정한다. 명시 날짜 생성/복제·parse/UTC·prototype/subclass는 native 의미를 유지한다. 실제 캡처 직전 now/constructor 값을 단언하고 환경 로그에 시각·대상을 출력한다. `setTimeout`/`setInterval`/RAF/`performance.now()`와 Node runner의 timeout·실측 시간은 그대로 진행한다. 모든 도구의 시계/타이머를 무차별 동결하는 안은 Office 경과시간·저장소 TTL·벤더 준비를 보존하려고 기각했다. 날짜 mask 추가·0.1% 임계값 완화도 하지 않았다.
- **전수 조사·발견 수**: 실행 확장자 JS/MJS/CJS/TS/TSX/JSX/HTML/Python을 repo-wide 재귀 검색해 직접 호출 **77행(앱 42·테스트/스크립트 35)**을 분류하고 `localIsoDate`·date-fns·Luxon/Temporal provider를 별도 추적했다. 캘린더 기본값 의존은 **3도구/9시나리오/일반 21캡처/QA 72캡처**다. 시차: 초기 날짜·시간 및 현재 시각 버튼, 근무: 영업일 시작·종료·연차 기준일·입사연도, 급여: 퇴직 기준일(현재 weekly/net 캡처에는 숨김) 모두 같은 시계로 고정했다. toolId별 사유를 가진 최소 명시 목록이 모든 상태/QA profile에 적용된다. 기존 공용 footer 연도 mask는 유지했다. 이미지 붙여넣기 날짜 파일명은 현재 scenario/QA에 paste가 없어 미실행, Office 경과시간은 idle workspace 시나리오에서 미실행이다. ID·파일 메타데이터·TTL·명시 날짜 파싱/복제·runner timeout은 캘린더 픽셀과 무관해 native로 둔다. [검색 원출력·예외 목적/소유자](../tests/visual-artifacts/clock-fix-evidence/README.md)에 vendor·generated·fixture를 분리 기록했다. PDF 후속 계획 10항의 config ISO/navigation 전 clock 계약과 방향이 같으며, 그 기능 구현 시 PDF를 이 목록에 연결할 수 있다.
- **날짜·연도 변경 실증**: Node 단위 테스트로 host 날짜 3개·명시 인자·invalid date·Date subclass·native timer 보존을 검사했다. 별도 실브라우저 [probe](../tests/visual-artifacts/clock-fix-evidence/probe.mjs)는 원래 시계를 `2026-09-05T14:59:59.999Z`/`2026-09-06T15:00:00.000Z`/`2027-01-01T00:00:00.000Z`로 각각 바꾼 뒤 실제 하네스 함수를 적용했다. KO/EN **36상태**, 반복 **24비교 모두 0px**; 서울 12:00·근무일 2026-09-05·입사연도 2025·퇴직 기준 2026-09-05가 같았다. 현재 날짜 입력을 2000년으로 바꾼 뒤 “현재 시각 사용” 버튼으로 복원하는 경로도 통과했다. timer/RAF/performance는 실제 진행했다. 최초 probe의 `role=radio` 가정은 현행 segmented adapter에 맞지 않아 실패했고, 본 하네스와 같은 button selector로 probe만 교정했다. 실패 원출력도 보존한다.
- **기준선 갱신 근거**: 시계 고정 직후 기존 baseline 비교는 **21/21**(28.48초)로 상한 이내였으나 과거 기준선의 서로 다른 채집 시각(예: EN timezone 2026-09-04 21:53)을 남겨두지 않고 고정 입력과 일치시켰다. 두 도구 14장만 생성해 **실제 변경 9장(시차 5·근무 4)**, 나머지 5장 byte-identical. 차이는 98~939px, 최대 **0.076435%**, 이전 실패 대상 EN mobile은 **291px/0.088407%**다. 날짜·세계 시각과 토요일 영업일 0/제외일 1 변화가 고정 입력과 일치함을 PNG에서 확인했다. [장별 실측](../tests/visual-artifacts/clock-fix-evidence/baseline-diffs.json).
- **제품 계약·보존**: B의 `src/`·package/lock diff는 **0B**. 오늘 날짜 기본값·한국어/영어 문자열·SEO 메타/정적 route/사이트맵/FAQ·광고/분석 및 격리 경계·서버 전제·내부 구현 비노출은 제품 코드 변화가 없어 보존된다. 새 의존성·벤더 변경·번들 최적화 없음. 원본 P-QA **604/604 SHA-256**, 사용자 파일 **3/3 SHA-256** 동일, 기준선 집합 175장. 원격 추적 refs도 `origin/ui-migration=3588eba`, `origin/main=073da56`로 그대로이며 push하지 않았다.

검증 원출력: [증거 인덱스](../tests/visual-artifacts/clock-fix-evidence/README.md). 일반 production 빌드에서 consent denied·외부 요청 0을 단언하는 시각 하네스를 실행했다. 아래 browser/utility/probe는 `TEST_BASE_URL=http://127.0.0.1:4296`, visual KO/EN은 각각 자체 preview 포트 4297/4298과 별도 artifact 경로를 썼다.

| 실행 명령 | 실제 결과 |
|---|---|
| `npm run build` | exit 0, **2,830 modules**, 79초, **정적 61페이지**. 기존 eval·chunk 크기 경고 외 오류 없음. |
| `npm run test:unit` | A **193/193**, B **195/195**, exit 0·fail 0. |
| `npm run test:static` | exit 0, localized pages/hreflang·runtimes·ads/robots/sitemap 통과. |
| `TEST_SCOPE=excel npm run test:browser` | exit 0, Excel·키보드 segmented/switch 계약 통과. 출력 공통 Word/PDF 문구는 실행 범위에 포함된다는 뜻이 아님. |
| `TEST_ONLY_HWP=1 npm run test:new-tools` | exit 0, **3,584B·1페이지·sentinel 재파싱·Studio 재개방** 통과. 기존 CanvasView 로그 1건 유지. |
| `npm run test:utilities` | exit 0, KO/EN 경로·세계 지도·유틸리티·격리 계약 통과. |
| `VISUAL_ONLY=timezone-calculator,work-calculator,payroll-calculator npm run test:visual` | exit 0, 갱신 전 **21/21**, 28.48초. |
| `UPDATE_VISUAL_BASELINES=1 VISUAL_ONLY=timezone-calculator,work-calculator npm run test:visual` | exit 0, **14/14**, 20.98초. 실제 9장 변경. |
| `node tests/visual-artifacts/clock-fix-evidence/probe.mjs` | exit 0, **36상태·24 반복 비교 0px**, native timer/RAF 진행. |
| `LANG=en_US.UTF-8 npm run test:visual` | exit 0, **175/175**, **134.10초**, Chrome 152.0.7977.64. |
| `LANG=ko_KR.UTF-8 npm run test:visual` | 최종 단독 실행 **exit 0, 175/175, 113.34초**. 최초 동시 실행은 98/175 진행 뒤 **exit 143**, 자체 오류 설명 없이 중단됐으므로 통과로 세지 않고 원출력을 보존했다. |
| `node --check` (clock helper·visual runner·probe) · `git diff --check` | exit 0. |

### P-QA 차단 2건 — Excel 영어 분절·HWP 액션 바 충돌 수정 (Codx)

> **2026-09-06 커밋 재개 정정 (Codx)**: 최신 사용자 지시로 이전 전달의 commit 금지는 무효다. 아래 미커밋·금지 서술은 이전 실행 당시 기록이며, 이번에는 두 수정·기준선 4장·증거 4디렉터리(99파일, PNG 68장)를 함께 커밋한다. Claude가 재캡처에서 두 결함 해소를 확인한 판정을 수용했다. 사용자 3파일과 원본 P-QA 604장의 SHA-256을 재확인했으며 모두 동일하다. 모든 push는 계속 금지한다. 시계 원인의 전체 회귀 실패는 별도 후속 커밋으로 해결한다.

- **실행 게이트·정본**: `PROJECT_RULES.md` → HEAD/지시 전문 → `AGENTS.md`·P2 정본·열린 계획서·관련 기각 이력을 확인했다. `ui-migration`, `HEAD=0663c7449f94f8d046e36c8ec16502582dd4f001`로 사용자 기준과 일치했다. 지시 전문은 `/tmp/claude-1000/-home-better0101-projects-worklazytools/98c2890e-0b15-4fc5-a7f8-98e9d02d526e/scratchpad/pqa-fix-dispatch.md`다. 기존 RHWP 업그레이드·Excel 서식 작업은 기능 보존 계약이고 현재 두 레이아웃 수정과 상반 지시가 없다. 지시서의 커밋 요구보다 **최신 사용자의 모든 commit/push 금지**가 우선하며 워킹트리에만 남긴다.
- **Excel 전→후**: `ExcelMergerPage.tsx`의 3단계 병합 방식에만 전용 wrapper를 두어 버튼의 `white-space: nowrap`·고정 높이를 해제하고 긴 단어의 비상 줄바꿈, 모바일 좌우 padding을 적용했다. 390px EN에서 각 분절 폭 100px에 `Separate sheets`·`Join horizontally`가 각각 1.61px·4.69px 벗어나던 상태가 **2줄·높이 56px·라벨 이탈 0px**가 됐다. KO 390px는 **100×44px·1줄**, EN 1365px는 **218.33×36px·1줄**을 보존했다. 공용 SegmentedControl이나 문구 축약은 다른 도구·번역 계약에 영향을 주므로 채택하지 않았다.
- **HWP 증상 정정·전→후**: "HWP 저장이 다른 문서를 덮는다"는 원 지적을 채택하지 않았다. 현재 DOM에서 데스크톱 언어 전환기는 **fixed/z-index 45**, rect `(1247.5,22)–(1341,66)`이며 HWPX/HML을 각각 **612.19/2,012.81px²** 덮었다. `HwpEditorPage.tsx`에서 로드 후 toolbar에 133px 오른쪽 공간과 64px 최소 높이를 확보해 **두 겹침 모두 0px²**, HML 오른쪽 1224px→언어 전환기 왼쪽 1247.5px 사이 **23.5px 간격**을 얻었다. 390px의 5등분 grid에서는 `도구 화면`·`HWP 저장` 라벨이 1.55/4.14px 벗어났으며 모바일 헤더의 언어 전환기 자체도 focus layer 아래에 있었다. 모바일 편집 영역은 **top 72px, 높이 100dvh−72px**, 액션은 내용 폭을 유지하는 **3+2 flex wrap**으로 바꿨다. 5개 버튼과 언어 전환기 모두 이탈·가림 0이다. 숨겨져 있던 전역 푸터가 새 헤더 틈에 비치는 것을 막는 규칙은 **HWP 문서 로드 후 모바일의 형제 footer**에만 적용했다.
- **보수적 범위·기능 상태**: desktop 언어 전환기 자체 위치/z-index·공용 헤더·다른 18도구·엔진/벤더는 수정하지 않았다. HML은 fixture의 기존 저장 가능 판정에 따라 비활성일 수 있으며, 가림 해소를 저장 기능 활성화로 해석하지 않았다. DOM hit 검사에서는 disabled의 `pointer-events:none`을 가림으로 오인하지 않도록 측정 순간에만 복원하고 즉시 원복했다.
- **회귀·증거 설계**: 기존 일반 시각 회귀의 Excel interaction은 EN desktop 1장이라 실제 결함의 EN mobile을 검사하지 않았다. Excel EN dark mobile·KO dark mobile, HWP 로드 KO dark mobile **3장**을 추가해 일반 기준선을 172→175장으로 보강했다. 수정 전후 DOM/텍스트 Range/버튼 hit 검사·PNG는 `tests/visual-artifacts/pqa-fix-{before,after}-geometry/`, P-QA 동일 조건의 3상태·2테마 재캡처 36장은 `tests/visual-artifacts/pqa-fix-after/`다. 원본 `p2-final/` 604장은 별도 SHA-256 목록으로 보존 검증한다. 기존 HWP 로드 desktop 1장의 변경은 언어 전환기 공간·toolbar 높이 확보에 따른 의도된 변화(최초 비교 **37,001px/3.0119%**); 그 기준선과 새 모바일 3장만 갱신한다.
- **현지화·SEO·AdSense·내부 비노출**: Excel ko/en 라벨은 동일 문자열을 유지하며 HWP의 한국어 전용 정책과 EN `/en/tools` redirect도 보존한다. 새 사용자 문구·요소 없이 레이아웃만 고쳐 번역·SEO 메타·FAQ·사이트맵·정적 route·광고 배치/제외 격리 경로·서버 전제 변경은 불필요하다. 새 내부 명칭·원시 예외를 노출하는 코드는 없다. 기존 HWP 안내의 내부 명칭은 이번 2표면 수리 범위 밖이므로 확대 수정하지 않았다. 시각 검증은 `VITE_LOCAL_QA=1` 빌드, static/analytics 포함 스모크는 일반 빌드로 분리한다.
- **대조·보존 결과**: `p2-final` 대비 Excel KO dark mobile·EN dark desktop 픽셀 차이는 각각 **0**, HWP 로드 전 KO light desktop은 **41px/0.0034%**로 기존 0.1% 이내다. 기존 604장·사용자 DOCX 2개/네이버 확인 HTML의 SHA-256은 모두 그대로다. 최종 HEAD도 `0663c74`이며 commit·push·staging을 수행하지 않았다.

검증 원출력과 전후 캡처 링크: [증거 인덱스](../tests/visual-artifacts/pqa-fix-evidence/README.md). 아래 browser/visual 명령에는 `TEST_BASE_URL=http://127.0.0.1:4291`을 지정했다(자체 서버를 띄우는 `test:xls-first-load`는 해당 설정을 사용하지 않는다). 시각 기준선 갱신은 `UPDATE_VISUAL_BASELINES=1 VISUAL_ONLY=excel-merger-empty--interaction-sheet-selection,hwp-editor-empty--interaction-document-loaded npm run test:visual`로 5/5를 생성했고 실제 변경은 HWP desktop 1장+신규 모바일 3장뿐이다.

| 실행 명령 | 실제 결과 |
|---|---|
| `VITE_LOCAL_QA=1 npm run build` · `npm run build` | 둘 다 exit 0, 2,830 modules·정적 61페이지. 최종 dist는 일반 production 빌드. |
| `npm run test:unit` | exit 0, **193/193**, fail 0. |
| `npm run test:static` | exit 0, localized pages·hreflang·self-hosted runtimes·ads.txt·robots·sitemap 통과. |
| `TEST_SCOPE=excel npm run test:browser` | exit 0, Excel 및 segmented Arrow/Space·공용 키보드 계약 통과. 출력 마지막의 Word/PDF 이름은 하네스 공통 문구이며 이번 실행 범위는 Excel이다. |
| `TEST_ONLY_HWP=1 npm run test:new-tools` | exit 0, **3,584B·1페이지·sentinel 재파싱·Studio 재개방** 통과. 기존 CanvasView 콘솔 로그 2건은 재현됐으며 기존 RHWP 기각 이력대로 벤더 수정하지 않았다. |
| `npm run test:utilities` | exit 0, ko/en 경로·HWP EN redirect·hreflang·유틸리티·광고/분석·격리 계약 통과. |
| `npm run test:xls-preserve` | exit 0, XLSX 4상태·XLS 보존 3상태·진행 10상태·degradation 3분기 통과. |
| `npm run test:xls-first-load` | exit 0, 전역 헤더 없는 정적 서버에서 합성 4파일 수동 reload 없이 검사. |
| `VISUAL_ONLY=excel-merger npm run test:visual` | exit 0, **9/9**, 11.44초. |
| `VISUAL_ONLY=hwp-editor npm run test:visual` | exit 0, **7/7**, 13.17초. |
| `LANG=ko_KR.UTF-8 npm run test:visual` | **exit 1, 174/175**, 105.95초. 미수정 timezone initial EN light mobile **363px/0.1103%** 차이로 1장 실패. |
| `LANG=en_US.UTF-8 npm run test:visual` | **exit 1, 174/175**, 108.61초. 같은 timezone 1장 **362px/0.1100%** 차이. |
| `LANG=ko_KR.UTF-8 VISUAL_ONLY=timezone-calculator npm run test:visual` | **exit 1, 6/7**, 같은 363px/0.1103% 재현. |
| `VISUAL_ONLY=excel-merger,hwp-editor VISUAL_CAPTURE_DIR=tests/visual-artifacts/pqa-fix-after VISUAL_CONSENT_GRANTED=1 npm run test:visual:qa` | exit 0, **36/36**·30.23초, initial/bottom/interaction 각 12장·외부 요청 0. |
| `node /tmp/worklazytools-pqa-fix/probe.mjs after` | exit 0, **24표본**(320/390/620/621/820/821/1020/1365px × Excel ko/en·HWP ko), 라벨 이탈·버튼/언어 전환기 가림·충돌 모두 0. 재현용 사본을 증거 폴더에 보존. |
| `git diff --check` · SHA-256 보존 검사 | exit 0, 기존 604장·사용자 3파일 변경 없음. |

**전체 회귀 잔여 판정**: 날짜·시각 입력과 `WORLD TIME` eyebrow에 차이 픽셀이 남았다. `TimezoneCalculatorPage.tsx:29`는 `DateTime.now()`로 초기 값을 만들고 시각 하네스는 날짜/시각을 고정하지 않는다. timezone·공용 SegmentedControl/AppShell/LanguageSwitcher·전역 CSS·i18n의 diff는 **0B**다. 이번 두 결함 밖의 코드·기준선·차이 임계값을 바꿔 전체 통과로 만들지 않고 실패를 그대로 보고한다. 두 도구의 수리·재캡처 증거는 완료했으며 Claude의 후속 육안 교차 판정 입력으로 남긴다.

### P2 P-final/P-QA 재개 — 미커밋 작업물 자체 감사 (Codx)

- **무결성·완료 범위**: 시작 `HEAD=3588ebafab3dd876746e356ea652d923eda0f5e5`, `ui-migration`, `git status --porcelain` 58건. 추적 변경 diff는 인계 `pfinal-inflight.diff`와 **75,923B byte-identical**이었다. CSS/manifest/감사·측정기/하네스 수정, 시각 기준선 35장, CHANGELOG의 Codx 서명과 아래 P-final/P-QA 두 절이 실제 작업물과 일치한다. 구현과 캡처 채집은 완료됐고 커밋·4점 귀속 판정이 남은 상태였다. 상단 계획 진행표의 P-final/P-QA “대기”는 완료 실행 기록보다 낡았으며 Gemini 최종 육안 판정은 본 자체 감사로 대체하지 않는다.
- **소스 감사**: 이전 HEAD CSS에 현행 orphan 측정기를 적용하면 **63 zero-reference classes / 152 selector arms, exit 1**이고 현재는 **238 tokens / 263 runtime sources / orphan 0, exit 0**이다. 삭제는 소비 0 class/selector arm·변수 5개이며 사용 중 legacy 6엔트리는 보존했다. `npm run legacy:manifest` 재생성 결과 **155 rules, 149 removed / 1 split / 5 active**이고 인계 manifest와 같다. 제품 TS/TSX·번역·route·SEO 생성기·광고 경계에는 이번 제품 변경이 없고 `tailwind.css`도 불변이다.
- **캡처 감사·커밋 범위**: 시나리오 manifest로 이름을 다시 생성해 **77상태 / 604장, initial 156·bottom 156·interaction 292, 누락 0·잉여 0**을 확인했다. `git log -1 --stat -- tests/visual-artifacts/p2-b5a`의 **80 files changed** 등 B1~B5a 캡처 추적 관례에 따라 미추적 B5b 32·B6 64·B-shared 160·P-final 604, 총 **860 PNG**를 함께 보존한다. 선행 문서 `docs/agent-dispatch-runbook.md`도 위임 변경으로 포함한다. 사용자 `before.docx`·`after.docx`·루트 `naver05161fb06bc9701a23cfc09ad5773578.html` 3개는 수정·추적·삭제하지 않는다. 이 3개와 QA 860장 SHA-256을 시작 시 저장하고 커밋 전 동일함을 확인했다. jobs 원문·dist·vendor·측정 로그는 커밋하지 않는다.
- **재검증 실행**: `npm run build` **exit 0, 2,830 modules, 정적 61페이지**, `npm run test:unit` **193/193**, `npm run test:static` **통과**, `npm run css:orphans` **orphan 0**, `npm run legacy:manifest` **통과**, `git diff --check` **통과**. 추가 `npm run test:ui-migration`은 일반 build에서 실행한 첫 시도에 `Local QA build emitted tracking`으로 **exit 1**이었다. 이는 호출자가 QA 전제를 빠뜨린 것이며 제품 수정 없이 `VITE_LOCAL_QA=1 npm run build` 후 `UI_MIGRATION_TEST_PORT=4291 npm run test:ui-migration` 재실행은 **exit 0, switches 7 contained / action 190px / legacy 0 / tracking 0**이었다. 스모크가 다시 쓴 B3 진단 PNG는 `/tmp`에 증거를 보관하고 재개 전 추적 내용으로 복원했다.
- **접근성·visual 증거**: QA build에서 `A11Y_TEST_PORT=4292 A11Y_REPORT_PATH=/tmp/worklazytools-pfinal-resume-20260906/a11y.json npm run test:a11y` **exit 0, 5페이지 위반 0·외부 요청 0·placeholder 4.8871087704:1**. 이전 잡 원로그에서 마지막 PDF mode-ready 수정 뒤 PDF 부분 2회와 `LANG=ko_KR.UTF-8 VISUAL_TEST_PORT=4277 npm run test:visual`(13:22:45Z), `LANG=en_US.UTF-8 VISUAL_TEST_PORT=4278 npm run test:visual`(13:24:47Z)의 **exit 0**을 확인했다. 이후 제품/시각 변경이 없어 전체 visual 재실행은 생략했다. 재개 로그와 보호 파일 해시는 `/tmp/worklazytools-pfinal-resume-20260906/`에 보존한다.
- **계보 전제 정정**: `5298c13^=454d7c8964d1a2f301c8661a6c6cc00f6304b49f`이며 RHWP/SEO main 변경은 B1 뒤 `26eb56ea5e2eff771f438d6c18d381da6af13474`에서 합류했다. 지시서의 “RHWP 등 기능 전부 포함·UI 전환 전 S2”는 실제 커밋으로 존재하지 않는다. 요청한 **B1 직전 S2**와 별도 **병합 전후 대조**를 실측해 이 혼입을 분리한다. 예산·기준점의 정본 계약을 바꾸는 결정은 하지 않는다. 이번 커밋과 후속 측정 기록 모두 **push 금지**다.

### P2 P-final/P-QA 재개 — 누적 번들 예산 4점 귀속 분해 (Codx)

**판정: P2 UI 전환은 5종 예산 모두 통과한다. 누적 route/app JS 실패는 U3 QR 일괄 생성만으로 이미 발생했다.** CJK 폰트 파일과 RHWP Studio vendor 자체는 이 JS 예산의 제외 대상이다. “RHWP 런타임도 이번 JS 초과의 주요 원인”이라는 추정은 채택하지 않는다. `4a8405c` 누적 게이트의 수치·기준점·상한은 바꾸지 않으며 이번 지시는 모든 push를 금지한다.

**A 보존 커밋**은 `3f0cf3bc1fa84fc8554724ce8c3b2f6d906b464a` (`refactor: finalize P2 CSS cleanup and preserve QA evidence`), **911파일**이다. 변경 시각 기준선 35장과 미추적 QA 860장, 구현·하네스·문서 16파일을 포함하고 개인 파일 3개는 제외했다. B에서는 제품 코드 최적화를 수행하지 않았고 측정 JSON에 deduplicated 파일별 크기·분류·소유 route·manifest 근거만 추가했다. multiplier는 `6junk`·소수·0·음수·빈 값을 정수로 오인하지 않게 엄격히 검사한다.

**계보 확정과 S2 전제 정정** — `git log --first-parent --oneline 4a8405c..3f0cf3b` 실측이다. U3 뒤 `7b3222b`(visual 결정성)·`454d7c8`(visual 병렬화), **B1 `5298c13`**, `4180f88`(QA 계약), **main 병합 `26eb56e`**, B2 `4ecda00` 순이다. `26eb56e`의 부모는 `4180f885678484ae51c2441e15c36a4d17b40e18`과 `073da56226f7bc1bdbef682a477e05ec28862074`다. 따라서 지시서의 “기능 전부 포함·B1 이전”에 해당하는 실제 커밋은 없다. 요청한 **B1 직전**이라는 정의를 그대로 사용하고, S1→S2를 기타 기능 구간으로 허위 표시하지 않는다.

| 점 | 정확한 커밋 | 실제 상태 |
| --- | ---: | ---: |
| S0 | `4a8405c7458ca72e454326e798592330478c67e4` | 지시서 분기점 |
| S1 | `62f9031ecc87fef37ca55b3d64f511cfc9b2b407` | U3 QR bulk 직후 |
| S2 | `454d7c8964d1a2f301c8661a6c6cc00f6304b49f` | B1 직전 (RHWP·SEO 병합 전) |
| S3 | `3f0cf3bc1fa84fc8554724ce8c3b2f6d906b464a` | 감사 후 P-final/P-QA 보존 커밋 |

**동일 조건** — 기존 `/tmp/worklazytools-pfinal-budget.ZaWR4c` worktree 한 곳을 순차 checkout해 S0·S1·S2·S3·병합 전·병합 후를 모두 **새로 빌드**했고 끝에 원래 S0로 복원했다. 다른 기존 worktree는 사용하지 않았다. 여섯 점 모두 `/home/better0101/projects/worklazytools/node_modules` 동일 symlink·설치, Node **v22.17.1**, npm **10.9.2**, Vite **6.4.3**, Rollup **4.62.4**, Tailwind **4.3.3**, React **19.2.8**, Base UI **1.7.0**, fontkit **1.1.1**, pdf-lib **1.17.1**, RHWP core/editor **0.8.6**이다. 설치를 바꾸지 않았으며 `VITE_LOCAL_QA`·`VITE_BASE_PATH`·`BUNDLE_ROUTES`는 unset, `NODE_OPTIONS=--max-old-space-size=4096`, `BUNDLE_BUDGET_MULTIPLIER=6`을 고정했다. 기준 branch의 과거 lockfile을 각각 설치한 측정이 아니라 요청대로 **현재 동일 설치로 정규화한 비교**다. RHWP 패키지 0.8.4↔0.8.6 자체의 역사적 비용은 이 비교로 추정하지 않는다.

- 측정기 SHA-256: `5789598e7c4539261f41fe555572bd0c0dde8f133329b9006283c43292f3931b`. 설치 `node_modules/.package-lock.json` SHA-256: `df730d9ec2838d43f1cd07c224b563406c05d022f1c89ccc8747f0bc2e9893ff`. 완료 시 두 fingerprint 불변을 확인했다.
- 실제 실행은 `BUNDLE_SOURCE_ROOT=/tmp/worklazytools-pfinal-budget.ZaWR4c BUNDLE_MEASURE_OUTPUT=/tmp/worklazytools-pfinal-resume-20260906/<점>.json BUNDLE_BUDGET_MULTIPLIER=6 NODE_OPTIONS=--max-old-space-size=4096 node /home/better0101/projects/worklazytools/scripts/measure-bundle-budget.mjs`다. 내부 명령은 `vite build --manifest --outDir dist-measure`, 모든 실행 종료 시 측정 dist를 삭제한다. S1/S2/S3는 각각 S0/S1/S2 JSON을 `BUNDLE_BASELINE`으로 주었고, 병합 후는 병합 전 JSON으로 비교했다.
- 포함·제외·gzip·route reachability 계약은 변경하지 않았다. 단일 소유 lazy 청크와 도구 경로 video worker는 route, 다중 route 또는 소유 경로 없는 worker는 shared, entry는 별도다. 따라서 QR bulk worker는 QR 기능 소유임에도 이 기존 측정 계약에서는 **shared**다. 19 lazy route 전체를 측정했고 eager Excel 병합은 entry에 포함된다. S0 **66 JS/1 CSS**, S1/S2/S3 **79 JS/1 CSS**, 네 점 모두 중복 해시 제거 건수 **0**이다.
- 원본 JSON·각 빌드 stdout/stderr·계보·설치 fingerprint·실행 exit/시간·분석 스크립트는 `/tmp/worklazytools-pfinal-resume-20260906/`에 보존한다 (`S0.json`…`S3.json`, `Mpre.json`, `Mpost.json`, `point-runs.json`, `measurement-environment.json`, `analysis.json`, `analyze-bundles.py`, `run-points.py`). 각 점의 모든 파일을 재합산해 **5개 metric 전부 exact 일치**, entry+route+shared=app JS도 여섯 점 모두 일치함을 검사했다.

**4점 실측 (각 파일 gzip 합, 단위 B)**

| 측정점 | entry | route | shared | app JS | CSS |
| --- | ---: | ---: | ---: | ---: | ---: |
| S0 | 289,574 | 1,507,461 | 2,615,772 | 4,412,807 | 49,015 |
| S1 | 294,982 | 2,412,311 | 2,716,255 | 5,423,548 | 49,325 |
| S2 | 294,982 | 2,412,311 | 2,716,255 | 5,423,548 | 49,325 |
| S3 | 297,901 | 2,439,997 | 2,716,475 | 5,454,373 | 38,545 |

**3구간 증분 (KiB = 1,024B, 반올림 전 B로 판정)**

| 실제 구간 | entry | route | shared | app JS | CSS |
| --- | ---: | ---: | ---: | ---: | ---: |
| S0→S1: U3 | +5.28 | +883.64 | +98.13 | +987.05 | +0.30 |
| S1→S2: visual 하네스만 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| S2→S3: P2 + P-final + main 병합 | +2.85 | +27.04 | +0.21 | +30.10 | -10.53 |
| S0→S3: 종전 누적 | +8.13 | +910.68 | +98.34 | +1017.15 | -10.22 |

S0와 S3 재측정 5종은 이전 P-final 보고의 원시 B와 전부 일치한다. S1→S2는 제품 코드/설치 변화가 없고 다섯 지표도 **exact 0**이다. U3 증가만으로 route **+883.64 > +360KiB**, app JS **+987.05 > +480KiB**여서 S1 비교 명령은 의도대로 **exit 1**이었다. U3는 S0→S3 순증의 route **97.03%**, app JS **97.04%**를 설명한다.

**실제 기능 합류 구간 보조 측정 (단위 B)** — 기준점을 대체하지 않고 혼입을 설명하기 위한 두 점이다.

| 병합 전후 | entry | route | shared | app JS | CSS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mpre `4180f885678484ae51c2441e15c36a4d17b40e18` | 295,057 | 2,414,984 | 2,717,113 | 5,427,154 | 49,275 |
| Mpost `26eb56ea5e2eff771f438d6c18d381da6af13474` | 295,065 | 2,414,981 | 2,717,095 | 5,427,141 | 49,275 |
| Mpre→Mpost 증분 | +8 | -3 | -18 | -13 | 0 |

병합은 동일 설치 조건에서 entry **+8B**, route **−3B**, shared **−18B**, app JS **−13B**, CSS **0B**다. 따라서 실제 UI 커밋 구간 합 `(S2→Mpre)+(Mpost→S3)`은 아래와 같다. 이것은 실제 이력의 증분 합이며 존재하지 않는 가상 “기능 완료 S2” 직접 측정값으로 표시하지 않는다.

| 지표 | S2→S3 실측 B (KiB) | UI 구간 합 B (KiB) | 기존 상한 KiB | 판정 |
| --- | ---: | ---: | ---: | ---: |
| entry | +2,919 (+2.85) | +2,911 (+2.84) | +120 | 모두 통과 |
| route | +27,686 (+27.04) | +27,689 (+27.04) | +360 | 모두 통과 |
| shared | +220 (+0.21) | +238 (+0.23) | +180 | 모두 통과 |
| app JS | +30,825 (+30.10) | +30,838 (+30.12) | +480 | 모두 통과 |
| CSS | -10,780 (-10.53) | -10,780 (-10.53) | +60 | 모두 통과 |

**chunk 증가 기여자** — content hash 접미사만 제거해 동명 출력을 대응했고 `index.html` entry, PDF helper index, `@zip.js` index는 manifest/owner로 구분했다. 점별 canonical chunk key 중복이 없음을 단언했다. 표는 **새 청크 전체 크기 또는 기존 청크의 순증**이며 route와 app JS 각 상위 10개다. 각 행의 세 구간 증분 합=누적 증분, 상위 10+기타=metric 증분을 exact B로 확인했다. 동일 개수의 청크라도 gzip에 영향을 주는 참조 hash 변화는 수 B 증감을 만들 수 있으므로 이를 라이브러리 기능 추가로 해석하지 않는다.

**route 상위 10개 (단위 B)**

| chunk | S0→S1 | S1→S2 | S2→S3 | 누적 증가 | 기능/구간 귀속 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `qrLabelPdf.js` | +508,018 | 0 | -1 | +508,017 (+496.11 KiB) | U3 PDF 생성; fontkit + PDF 생성 코드 |
| `exceljs.min.js` | +271,024 | 0 | -1 | +271,023 (+264.67 KiB) | U3 스프레드시트 입력·실패 XLSX 출력 |
| `inputAdapter.js` | +135,331 | 0 | 0 | +135,331 (+132.16 KiB) | U3 기존 공용 입력 파서의 앱 lazy 경로 |
| `@zip.js/zip.js/index.js` | +17,477 | 0 | -1 | +17,476 (+17.07 KiB) | U3 ZIP 동적 진입점 |
| `QrBulkPanel.js` | +9,709 | 0 | -1 | +9,708 (+9.48 KiB) | U3 일괄 생성 화면 |
| `VideoStudioPage.js` | -4 | 0 | +3,780 | +3,776 (+3.69 KiB) | 기존 화면; P2 B5b UI |
| `ImageStudioPage.js` | -6 | 0 | +3,737 | +3,731 (+3.64 KiB) | 기존 화면; P2 B6·B-shared UI |
| `DocumentCompareResultPage.js` | -4 | 0 | +1,783 | +1,779 (+1.74 KiB) | 기존 결과 화면; P2 B3 UI |
| `AudioStudioPage.js` | -4 | 0 | +1,648 | +1,644 (+1.61 KiB) | 기존 화면; P2 B5a UI |
| `ExcelComparePage.js` | +58 | 0 | +1,400 | +1,458 (+1.42 KiB) | 기존 화면; U3 + P2 B4 UI |

상위 10 합 **+953,943B** + 나머지(감소 포함) **-21,407B** = route 누적 **+932,536B**.

**app JS 상위 10개 (단위 B)**

| chunk | S0→S1 | S1→S2 | S2→S3 | 누적 증가 | 기능/구간 귀속 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `qrLabelPdf.js` | +508,018 | 0 | -1 | +508,017 (+496.11 KiB) | U3 PDF 생성; fontkit + PDF 생성 코드 |
| `exceljs.min.js` | +271,024 | 0 | -1 | +271,023 (+264.67 KiB) | U3 스프레드시트 입력·실패 XLSX 출력 |
| `inputAdapter.js` | +135,331 | 0 | 0 | +135,331 (+132.16 KiB) | U3 기존 공용 입력 파서의 앱 lazy 경로 |
| `zip-fs-wasm.js` | +64,626 | 0 | -2 | +64,624 (+63.11 KiB) | U3 ZIP; shared로 분리 |
| `qr-bulk.worker.js` | +56,905 | 0 | 0 | +56,905 (+55.57 KiB) | U3 raster worker; 계약상 shared |
| `jszip.min.js` | +38,101 | 0 | 0 | +38,101 (+37.21 KiB) | U3 공용 ZIP 분리; 기존 PDF에서 이동 포함 |
| `@zip.js/zip.js/index.js` | +17,477 | 0 | -1 | +17,476 (+17.07 KiB) | U3 ZIP 동적 진입점 |
| `QrBulkPanel.js` | +9,709 | 0 | -1 | +9,708 (+9.48 KiB) | U3 일괄 생성 화면 |
| `index.html (entry)` | +5,408 | 0 | +2,919 | +8,327 (+8.13 KiB) | 기존 entry; U3 + P2 공용 UI |
| `VideoStudioPage.js` | -4 | 0 | +3,780 | +3,776 (+3.69 KiB) | 기존 화면; P2 B5b UI |

상위 10 합 **+1,113,288B** + 나머지(감소 포함) **-71,722B** = app JS 누적 **+1,041,566B**.

**재배치·제외·shadcn 귀속의 경계**

- U3 시점의 `PdfEditorPage` **−38,226B**, `workerLifecycle` **−61,534B**는 양수 청크 증가를 상쇄한다. 누적에서는 각각 **−34,131B**, **−61,535B**다. 특히 JSZip·ZIP 공용 코드의 분리/재배치가 섞이므로 새 청크 크기를 전부 “새 라이브러리 비용”으로 더하지 않았다.
- CJK `public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf`는 U3에 들어온 **4,644,748B 원본 자산**, **route/app JS 기여 0B**다. `QrBulkPanel`의 PDF export 시 fetch하고 `qrLabelPdf`에 fontBytes로 전달한다. 위 약 **496.11KiB** JS 청크는 fontkit/PDF 생성 코드이며 OTF 바이트 자체가 아니다.
- RHWP Studio는 `git ls-tree -rl` 기준 manifest 포함 78파일 원본 합 **56,208,787→60,692,284B (+4,483,497B)**지만 모두 `public/vendor/rhwp-studio/0.8.4→0.8.6`라 **JS/CSS 예산 기여 0B**다. prebuild 검증의 77파일 수치는 자기 manifest를 제외한 계약이므로 위 78파일과 단위가 다르다. 동일 설치의 core/editor는 모든 점에서 0.8.6이며 버전 교체 효과를 측정했다고 주장하지 않는다.
- P2 구간은 Base UI/shadcn 신규 runtime dependency 추가가 없고 S2/S3 모두 **79개 JS chunk**다. UI 전환은 기존 화면/entry 청크에 반영됐다. S2→S3 app JS 증가 상위 10개는 다음과 같으며 전체 CSS는 **−10,780B (−10.53KiB)**다.

| P2 구간 기존 chunk | 증가 B | KiB |
| --- | ---: | ---: |
| `PdfEditorPage.js` | +4,095 | +4.00 |
| `VideoStudioPage.js` | +3,780 | +3.69 |
| `ImageStudioPage.js` | +3,737 | +3.65 |
| `index.html (entry)` | +2,919 | +2.85 |
| `DocumentCompareResultPage.js` | +1,783 | +1.74 |
| `AudioStudioPage.js` | +1,648 | +1.61 |
| `DocumentComparePage.js` | +1,432 | +1.40 |
| `ExcelComparePage.js` | +1,400 | +1.37 |
| `TimezoneCalculatorPage.js` | +1,374 | +1.34 |
| `OfficeEditorAppPage.js` | +1,217 | +1.19 |

**실행 결과·최종 판정** — S0 빌드/측정 exit 0, S1 빌드 성공 후 누적 예산 **exit 1**, S1→S2·S2→S3 및 병합 전→병합 후 비교는 전부 **exit 0 / all five deltas within fixed limits**다. S1/S2/S3/Mpre/Mpost 새 빌드는 각각 **72.46/72.35/73.62/74.71/78.84초**, S0 Vite 보고는 **57.50초**다. 측정기 문법·`git diff --check`와 잘못된 multiplier 5종의 빌드 전 거부 검증을 통과했다. 제품 변경에 대한 build·unit·static·orphan·manifest·QA UI/a11y 재검증은 위 자체 감사 절의 실제 실행 결과를 따른다.

**“P2 자체가 누적 예산을 초과했다”는 귀속은 기각하고, “U3 기능 추가만으로 누적 실패·P2 UI 자체는 5종 상한 이내”로 확정한다.** 원래 S0 누적 수치는 여전히 route/app 두 종 실패이며 예산 면제나 기준 변경을 승인한 것은 아니다. 사용자 지시대로 `origin/ui-migration`과 main 모두 push하지 않는다. 작업지시서의 기준점·예산 숫자는 수정하지 않았다.

## 2026-09-05

### P2 P-final — legacy 잔여·토큰 단일화·orphan·누적 예산 판정 (Codx)

- **실행 게이트**: fetch 뒤 `HEAD=origin/ui-migration=3588ebafab3dd876746e356ea652d923eda0f5e5`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`로 지시 기준과 일치했다. B-shared 160장 전수 차단 결함 0·`[배포 가능]`과 열린 계획서 무충돌을 확인했다. U4 PDF는 비정본 초안, 네이버 랜딩은 별도 main worktree 소유라 P-final CSS/검증 표면과 상반되지 않는다. 사용자 DOCX 2개·네이버 확인 파일과 기존 QA 캡처는 제외했다.
- **legacy 6엔트리 재대조**: manifest는 실제로 **149 removed·1 split·5 active**이며 인계된 `004·005·006·007·132·134` 6개가 전부 남아 있었다. `legacy-004`의 `.eyebrow`는 정적 SEO fallback 2곳과 명시 제외 `WordComparePage`·`HwpComparePage` 2곳, `005`의 `.eyebrow.success`와 `006/007/134`의 `.content-heading` 계열은 두 도달 불가 화면이 소비한다. `132`의 raw button/secondary/result arm도 같은 두 화면이 소비하므로 **refcount 0 엔트리는 0개**다. 소스 refcount 0인 `.ui-eyebrow`와 primary-link selector arm만 분리 제거했고 manifest의 current selector를 갱신했다. 도달 불가 컴포넌트 3종은 명시 제외대로 수정하지 않았다.
- **토큰 단일화**: repo-wide `rg` 소비 집계에서 `--blue`·`--orange`·`--pink`·`--legacy-radius-sm`·`--legacy-radius-md`가 모두 `definitions=0 / consumers=0`이 되도록 라이트·다크 정의를 제거했다. 남은 legacy 변수는 AppShell·홈·도구 목록·공개 정책 화면과 도달 불가 비교 화면의 surface/text/accent 호환 CSS가 실제 소비한다: `--bg` 4, `--bg-elevated` 11, `--bg-muted` 18, `--bg-solid` 18, `--label` 34, `--label-secondary` 48, `--label-tertiary` 23, `--separator` 45, glass/shadow 1~7, soft/accent 2~12, radius 1~5회다. shadcn core는 `--background` 1·`--foreground` 3·`--primary` 6·`--primary-foreground` 2·`--radius` 7회 등 전부 소비가 있고 `src/styles/tailwind.css` diff는 **0**이라 안전한 `--primary` 팔레트는 건드리지 않았다.
- **orphan 판정**: `npm run css:orphans`를 신설해 `.cjs/.html/.js/.jsx/.json/.mjs/.ts/.tsx`를 저장소 전체 재귀 탐색한다. 문서·테스트/fixture·빌드 산출·vendor·npm·Git metadata는 owner와 목적을 출력하는 8개 명시 예외로 분리하고, 정적 SEO markup 생성기 1개는 다시 포함한다. prefix wildcard 대신 AppShell/OperationProgress의 exact 동적 class 15개와 Fabric runtime class 2개만 허용했다. 최초 **63 zero-reference classes / 152 selector arms**를 확인하고 삭제했으며 `.drop-hint-segment`·`.file-list` legacy class도 0이다(동명 `data-ui-*` 속성은 CSS class 소비가 아님). 최종은 **238 class tokens / 263 owned runtime sources / orphan selector arm 0**, PostCSS **612 rules·2,126 declarations**다.
- **시각 기준선 누락 판정**: 최초 전체 visual은 35/172가 기존 기준선과 달랐으나 `3588eba` 임시 worktree도 같은 **35/172**를 냈다. 양쪽 actual 35장 중 33장은 pixel-identical, 나머지도 0.0050%·0.0028%라 orphan 삭제 영향이 아니었다. B-shared에서 승인된 accent 변경이 부분 visual만 돌아 전 화면 기준선에 반영되지 않은 공백으로 확정하고 35장만 갱신했다. 이후 `ko_KR.UTF-8` **172/172·1m46.46s**, `en_US.UTF-8` **172/172·1m45.47s**가 같은 기준선으로 통과했다.
- **스모크 하네스 교정**: 전체 실행이 처음 드러낸 세 stale/race를 제품 변경 없이 수정했다. utilities의 video route는 이전 문서의 `crossOriginIsolated`를 오인하지 않도록 path+격리 marker까지 기다리고, new-tools crop 단축키는 이전 form focus를 명시적으로 해제하며, Excel Compare는 B-shared가 의도적으로 제거한 nested interactive를 기대하지 않고 비상호작용 drop target+단일 버튼을 단언한다. 각각 동일 명령 재실행이 통과했다. Excel Cleaner 최초 route 대기 실패 1회는 재현되지 않아 코드 변경 없이 같은 전체 명령 통과로 환경성으로 판정했다.
- **P-final 자체 증분**: B-shared 기록 대비 entry **+2B**, 전체 route **+7B**, shared **+3B**, app JS **+12B**, CSS **−2,446B**라 자체 변경은 5종 한도 안이다.
- **누적 예산 — 차단**: 측정기를 임의 worktree에도 적용할 수 있게 `BUNDLE_SOURCE_ROOT`, 묶음 합산 한도를 재현할 `BUNDLE_BUDGET_MULTIPLIER`를 추가하고 같은 설치/도구로 `4a8405c`를 재빌드했다. 기준→P-final은 entry `289,574→297,901B`(**+8.13KiB / +120KiB 통과**), route `1,507,461→2,439,997B`(**+910.68KiB / +360KiB 실패**), shared `2,615,772→2,716,475B`(**+98.34KiB / +180KiB 통과**), app JS `4,412,807→5,454,373B`(**+1,017.15KiB / +480KiB 실패**), CSS `49,015→38,545B`(**−10.22KiB / +60KiB 통과**)다. 분기 직후 U3 QR bulk의 full CJK PDF/font·입력 경로까지 포함한 누적치지만 사용자 지시의 기준점은 `4a8405c`이므로 임의 제외하지 않았다. **누적 게이트 실패로 push 금지**다.

### P2 P-QA — 20도구 전수 캡처·접근성·렌더링 기준선 (Codx)

- **QA 환경·추적 차단**: `VITE_LOCAL_QA=1 npm run build`, Chrome 152, `VISUAL_TEST_PORT=4270`, consent granted로 `tests/visual-artifacts/p2-final/`에 채집했다. 캡처마다 외부 origin 요청을 실패 처리하는 계약에서 **외부 요청 0**이고, QA `dist`의 `data-worklazy-google-analytics`·`data-worklazy-naver-analytics`·`data-worklazy-adsense` 재귀 집계도 **0/0/0**이다.
- **전수 매트릭스**: 20도구·77 scenario를 제품 적용 locale의 light/dark×desktop/mobile로 전개해 **604장**이다. 상태 합계는 initial **156**·bottom **156**·interaction **292**, 누락·잉여 0이다. PDF 4모드와 Image batch/collage/GIF는 각각 독립 상태로 포함했다. 최초 604장 중 PDF→이미지 KO/dark/desktop 1장이 썸네일 대기 race로 실패했으나 같은 PDF 48장 재채집에서 해당 장이 통과했고, 첫 세트에서 이미 통과한 반대 convert 장과 합쳐 최종 604장을 고정했다.

| 도구 | initial | bottom | interaction | 합계 |
|---|---:|---:|---:|---:|
| excel-merger | 8 | 8 | 8 | 24 |
| excel-compare | 8 | 8 | 16 | 32 |
| excel-cleaner | 8 | 8 | 16 | 32 |
| pdf-editor | 8 | 8 | 32 | 48 |
| document-compare | 8 | 8 | 32 | 48 |
| hwp-editor | 4 | 4 | 4 | 12 |
| office-editor | 8 | 8 | 8 | 24 |
| video-studio | 8 | 8 | 16 | 32 |
| audio-studio | 8 | 8 | 16 | 32 |
| image-studio | 8 | 8 | 48 | 64 |
| text-merger | 8 | 8 | 8 | 24 |
| text-tools | 8 | 8 | 8 | 24 |
| text-formatter | 8 | 8 | 8 | 24 |
| work-calculator | 8 | 8 | 8 | 24 |
| timezone-calculator | 8 | 8 | 8 | 24 |
| payroll-calculator | 8 | 8 | 8 | 24 |
| image-privacy | 8 | 8 | 8 | 24 |
| security-tools | 8 | 8 | 8 | 24 |
| qr-studio | 8 | 8 | 24 | 40 |
| data-converter | 8 | 8 | 8 | 24 |
| **합계** | **156** | **156** | **292** | **604** |

- **접근성 최종 게이트**: axe-core **4.13.0**·Playwright **1.63.0**·1280×800·light에서 홈 25/0, 문서 비교 41/0, 도구 목록 39/0, Excel 비교 46/0, PDF 도구 43/0으로 **violations 0(critical 0·serious 0·moderate 0)**이다. 라이브 기준 10(1·5·4) 대비 **−10**, 외부 요청 0이다. 문서 placeholder는 `rgb(105,105,111)` on `rgb(242,242,247)` = **4.8871:1**, 라이브 4.61 대비 +0.2771이다.
- **렌더링 로컬 기준선**: `npm run test:rendering`은 QA production build·Chrome 152·1280×800 DPR1·light·ko-KR·cache off·service worker block·loopback 무스로틀·페이지별 cold context 3회 median·3초 settle을 고정한다. Lighthouse TBT 대신 FCP 이후 long task마다 `max(0,duration−50ms)`를 합산한 동등 blocking 지표를 썼다. 외부 요청은 0이다.

| 페이지 | LCP | CLS | long-task blocking | FCP |
|---|---:|---:|---:|---:|
| 홈 | 91.34ms | 0.038332 | 146ms | 91.34ms |
| 문서 비교 | 90.67ms | 0.114199 | 49ms | 90.67ms |
| PDF 도구 | 512.32ms | 0.114199 | 52ms | 94.39ms |

- **판정**: 캡처·접근성·렌더링 3종은 Gemini 최종 검수 입력으로 준비됐다. 누적 예산은 위 P-final 판정대로 route/app 두 지표가 실패했으므로 **`origin/ui-migration` push도 금지**, main 병합·배포는 물론 수행하지 않는다. 원격 상태는 `origin/ui-migration=3588eba`, `origin/main=073da56`으로 유지한다.

### P2 B-shared — 접근성 기준선 교정·공용 legacy 종료·Image Studio 대안 조작 판정 (Codx)

- **게이트와 0단계 표본 교정**: `HEAD=origin/ui-migration=556a8b169752a1496599655ab6ae071afbf16da5`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`에서 시작했고 B6 재검수 차단 결함 0·회귀 0을 확인했다. 기존 `test:a11y`가 “home”을 `/ko`로 열고 저장 언어까지 주입해 실제 `.recommended`가 있는 루트 언어 랜딩을 건너뛰는 결함을 찾았다. 루트 `/`로 교정한 브랜치 기준선은 **9건(critical 1·serious 4·moderate 4)**이다: 홈 20/1 color-contrast(2노드), 문서 비교 42/2 nested-interactive+region, 도구 목록 39/1 region, Excel 비교 47/2 nested-interactive+region, PDF 44/3 label+nested-interactive+region. 라이브 10건 중 PDF 활성 탭 대비 1건만 이미 해소됐고 9건 잔존·신규 0이었다.
- **공용 접근성 판정**: desktop 언어 전환기를 이름 있는 `nav`에 귀속하고, 공용/Excel 전용 드롭존은 비상호작용 drop target과 단일 파일 선택 버튼으로 역할을 분리했다. 숨김 file input에도 접근 가능한 이름을 주었다. `ToggleRow`는 visible label↔button 연결과 설명 ID의 `aria-describedby`를 추가했으며 전 스코프 browser 스모크에서 Space·Enter·label click과 설명 연결을 모두 실동작 확인했다. 완료 axe는 홈 25/0·문서 41/0·도구 39/0·Excel 46/0·PDF 43/0, **총 0건·외부 요청 0**이다. 문서 placeholder는 `rgb(105,105,111)`/`rgb(242,242,247)` = **4.8871:1**로 라이브 4.61:1보다 개선됐다.
- **개선 ③ 채택 — 카드 선택 상태**: PDF 선택 썸네일은 브랜치 재측정에서 선택/비선택 배경이 라이트·다크 모두 **1.00:1**로 테두리/링에만 의존했다. 약한 배경 틴트와 4px 좌측 인디케이터를 함께 채택했다. 최종 배경 대비는 light 1.09:1·dark 1.11:1이지만 인디케이터 대비가 각각 **6.27:1·9.81:1**로 완료 기준 3:1을 넘으므로 WCAG 1.4.1의 색 단독 의존을 해소했다. 배경만 과도하게 진하게 만드는 안은 정보 계층을 무너뜨려 기각했다.
- **개선 ④ 채택 — 사이드바 활성 항목**: `NavLink` 상수 class 때문에 브랜치 직접 진입 `/ko`에서 active class와 `aria-current`가 모두 없고 light/dark **1.00:1**이던 회귀를 확인했다. 경로 정규화, `aria-current=page`, 현재색 3px 인디케이터를 적용했다. 최종 인디케이터 대비는 light **17.72:1**, dark **14.05:1**이며 `/ko`·`/ko/`·도구 하위 경로에서 활성 상태를 확인했다.
- **개선 ⑥ 채택/기각 — legacy accent만 제거**: shadcn `--primary` 톤다운은 기존 8.09:1 실측을 근거로 **기각**하고 값도 바꾸지 않았다. `var(--blue)` 35·`var(--orange)` 16·`var(--pink)` 8 호출을 Tailwind/shadcn 토큰 소비로 옮겨 `src` 전체 **0/0/0**으로 만들었다. 흰 텍스트와 쓰이는 대체 색 대비는 blue-700 **6.70:1**, orange-700 **5.18:1**, pink-700 **6.29:1**이다.
- **Image Studio 이관 6건**: 상위 4모드에 `aria-pressed`, 캔버스에 유효한 named region과 focus 표시를 부여하고 빈 선택 도움말의 부모 opacity를 제거해 별도 axe **41 passes/0 violations**를 얻었다. 화면 안내와 함께 Enter 영역 생성·방향키 이동·Shift+방향키 크기 조절, 일반 모드 방향키 pan, 레이어 이름의 Alt+↑/↓ 재정렬을 제공했다. 레이어 선택/표시/삭제와 GIF drag/위/아래/삭제 라벨은 번호와 실제 이름을 포함하며, 복제 라벨은 선택 종류/개수를 포함한다. 전용 스모크에서 키보드 영역 생성·이동·크기·취소와 레이어 ID 순서 왕복을 확인했다.
- **B6 말줄임 공백 해소**: `interaction-layers-panel`이 긴 텍스트 레이어를 실제로 만들고 해당 레이어 이름에 `assert-truncated`를 수행한다. 모바일 실측은 **clientWidth 104px < scrollWidth 409px**, `overflow:hidden`·`text-overflow:ellipsis`·`white-space:nowrap`이며 시각/QA 8프로필에서 assertion이 통과했다.
- **legacy/refcount와 P-final 인계**: B6의 45개 비제거 수치는 **37 active + 8 split**이라 차이는 중복/누락이 아니었다. B-shared 후 manifest는 **149 removed·1 split·5 active**다. P-final 인계는 6엔트리 `legacy-004`, `005`, `006`, `007`, `132`, `134`; 실제 소비는 명시 제외인 도달 불가 `WordComparePage`·`HwpComparePage`의 `.eyebrow(.success)`·`.content-heading`과 raw `.tool-page` arm이다. `.sample-diff`는 repo refcount 0을 확인해 B-shared에서 제거했다.
- **예산·검증**: B6 `556a8b1`을 임시 worktree에서 같은 `bundle:measure`로 재생성한 기준은 entry 296,948B·영향 route 2,439,031B·shared 2,716,468B·앱 JS 5,452,447B·CSS 41,067B다. B-shared는 297,899B·2,439,990B·2,716,472B·5,454,361B·40,991B로 각각 **+951B·+959B·+4B·+1,914B·−76B**, 5종 상한 통과. 표준 build 2,830 modules·정적 61페이지, unit 193/193, utilities, browser 전 스코프, UI migration, control geometry 92표본/20페이지, static, 대표 시각 46/46을 통과했다. 추적 제외 QA는 `VISUAL_TEST_PORT=4252`, `tests/visual-artifacts/p2-bshared/` **160/160**(initial 40·bottom 24·interaction 96), 외부 요청 0이며 contact sheet와 대표 원본에서 차단 결함 0으로 판정했다.

### P2 묶음 검수 판정 B1~B3 — 검수 입력 결함과 오탐 걸러내기 (Claude)

「배포 전 로컬 시각 검수」 규칙으로 신설한 게이트를 세 묶음에 적용하면서, **검수 자체가 틀릴 수 있다**는 것이 이 단계의 가장 큰 교훈이었다. 판정 근거는 다음과 같다.

- **B1 1차 검수는 무효로 판정했다 — 검수 입력 결함.** Gemini 가 "전 도구 모바일 하단 가림" 차단 결함 10건을 냈지만, 캡처 세트에 `bottom`(스크롤 최하단) 상태가 **0장**이었다(initial 48 + interaction 48 뿐 — Claude 실측). 첫 화면만 보고 하단 가림을 판정하는 것은 성립할 수 없다. **결함이 아니라 검수 입력이 틀린 것**으로 판정하고, 캡처 절차를 3상태(initial·bottom·interaction) 필수로 고쳐 공용 적용한 뒤 144장으로 재채집했다. 재검수는 차단 결함 0·[배포 가능].
- **토글/탭 썸 이탈 지적은 오탐으로 확정했다.** 라이브 사고의 실제 증상과 같은 이름이라 그대로 믿기 쉬웠으나, Codex DOM 실측 4도구 **60 샘플 전부 이탈 0px·수직 중심 오차 0px**(썸이 트랙 안쪽 사방 2~4px 여유), legacy 클래스 방출 0건이었다. 「증거 없는 반박은 무게 0」 규칙의 화폐는 실행 출력이므로 육안 인상보다 기하 실측을 채택했다. 회귀는 `test:control-geometry`로 고정했다.
- **B2**: Gemini 전수 108장(initial 36·bottom 36·interaction 36) 차단 결함 0·개선 권고 0·[배포 가능].
- **B3(라이브 사고 지점)은 세 경로로 교차 확인했다.** 같은 화면을 두 번 망가뜨릴 수는 없으므로 단일 판정자를 두지 않았다. ① Codex DOM 실측 — 토글 32표본 이탈 0px·중심 오차 0px, 문서 쌍 텍스트 폭 747px·전부 `horizontal-tb`·세로 낙하 0건, 버튼 190×48px·`w-full` 충돌 0건 ② Gemini 전수 80장 — 사고 증상 3종 전부 **미관찰**, 차단 결함 0 ③ Claude 육안 — `document-compare-empty__interaction-toggle-on__ko__light__desktop.png`에서 토글 6개 썸이 모두 트랙 내부. **B4 착수 조건 충족으로 판정.**

**남긴 규칙**: 검수 보고에 차단 결함이 실려 오면 수정에 착수하기 전에 **검수 입력이 그 판정을 뒷받침하는지 먼저 본다**. 상태 커버리지가 없는 캡처로 내려진 판정은 결함 보고가 아니라 하네스 버그 보고다.

### P2 B6 1차 디스패치 무효 판정 · 위임 오염 2건 (Claude)

**B6 1차 시도(`task-mtnvm1uy-5sk6c0`)를 무효로 판정하고 재디스패치했다.** 태스크가 `completed / Phase: done / Duration 56m 26s` 로 보고됐으나 **산출물이 0**이다(Claude 실측): `origin/ui-migration` = `2b1aabd`(B5b) 그대로 · `tests/visual-artifacts/p2-b6/` 부재 · 해당 job 의 `.log`/`.json` 파일 자체 부재 · `codex-companion status` 목록에서도 소실 · 워킹트리에 image-studio 변경 없음.

**남긴 규칙**: **완료 보고를 읽기 전에 산출물로 먼저 확인한다**(`git log origin/<branch>` · 산출물 디렉터리 · `git status`). 이 확인 없이 검수를 디스패치했다면 존재하지 않는 캡처를 검수시키고 한 사이클을 더 버렸을 것이다. 감시 스크립트에도 "No job found" 를 정상 종료와 구별해 경고하는 분기를 추가했다.

**위임 오염 — Gemini 가 저장소에 의존성을 설치했다.** 라이브 접근성 감사 위임 프롬프트에 "저장소 파일의 생성·수정·삭제 금지"를 명시했음에도, Gemini 가 측정 도구를 `npm i -D` 로 설치해 `@axe-core/playwright ^4.13.0`·`playwright ^1.63.0` 이 devDependencies 에, lock 에 54줄이 추가됐다. **"파일 수정 금지"가 npm install 을 막지 못한 Claude 의 지시 결함**이다 — 앞으로 npm 명령을 명시적으로 금지하고, 위임 결과 수거 시 `git status` 로 오염을 확인한다.
**처리**: 되돌리지 않고 **Codex 판단으로 넘겼다.** 정본 「배포 계약」이 접근성 재측정(axe-core 4.13.0)을 배포 게이트로 박았으므로 도구가 저장소에 있는 편이 재현에 일관적이다. 다만 기존 하네스가 `puppeteer-core` 를 쓰므로 **브라우저 자동화 스택 이중화**가 쟁점이라, 유지 시 정식 커밋 + 고정 npm script, 기각 시 되돌리기 + 게이트 재현 대안을 요구했다(「코드 단일 작성자」 — Claude 는 package.json 을 직접 커밋하지 않는다).

### P2 B6 Image Studio UI 전환 · 접근성/상태 분리 판정 (Codx)

- **실행 게이트·범위**: fetch 뒤 `HEAD=origin/ui-migration=2b1aabdc840ea01458ddefef46241130a587dd9d`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`로 지시 기준과 일치했고 B5b 32장 전수 `[배포 가능]` 판정 및 열린 계획서 무충돌을 확인했다. 사용자 DOCX 2개·네이버 확인 파일·`p2-b5b` 캡처는 제외했다. Image Studio TSX 10개와 CSS/테스트만 바꿨고 `src/features/image-studio/*.ts` diff는 **0건**이라 이미지 처리·Fabric 좌표/렌더·리사이즈/모자이크/워터마크·GIF 인코딩·배치 오케스트레이션은 불변이다.
- **의존성 판정 — Playwright 유지**: Gemini가 남긴 `@axe-core/playwright`·`playwright`는 정본이 같은 조합의 재측정을 요구하므로 되돌리지 않고 각각 **4.13.0/1.63.0 exact** devDependency로 고정했다. 기존 Puppeteer 스택과 이중화되지만 제품 하네스를 교체하지 않고 5페이지 접근성 감사만 담당한다. `npm run test:a11y`는 1280×800·light·ko-KR·Chrome에서 라이브 기준 한도(critical 1·serious 5·총 10)와 외부 요청 0을 기계적으로 검사한다. 추적 제외 브랜치 재측정은 **9건(critical 1·serious 3·moderate 5), 외부 요청 0**으로 통과했다. devDependency는 번들 예산 실측상 제품 청크에 편입되지 않았다.
- **화면·primitive 판정**: 편집기 도구/viewport/미니바/컨텍스트/레이어/스티커와 batch/collage/GIF 폼·행·작업 버튼을 기존 `UtilityPage/SectionCard/Field/Input/Select/Notice`, shadcn `Button`·`Card`·기존 Switch/SegmentedControl로 옮겼다. 새 primitive 소비처가 없어 `shadcn add`는 실행하지 않았다. 모바일 스티커 카테고리가 36px로 줄고, 레이어 Sortable 핸들의 SVG가 Button의 pointer-events 계약과 충돌하고, 접힌 패널에 Card의 flex가 남는 세 회귀를 스모크에서 검출해 각각 44px·span 핸들·데스크톱 hidden으로 복구했다.
- **legacy/refcount**: B6 소유/마지막 소비 12개(`legacy-001`, `105`, `114`~`120`, `133`, `143`, `145`)를 제거했다. 최종 manifest는 **110 removed·8 split·37 active**, PostCSS는 **795 rules·2,756 declarations**다. B6 화면 소스 10개와 legacy 52 token/동적 prefix 3종의 교집합은 **0건**이다. B-shared 인계는 **45개 비제거 규칙** — p2-shared 21개, cross-shared 23개(15 active·8 split), AppShell brand compact 1개다. 상세 selector/소유권은 `docs/legacy-css-owner-manifest.json`의 이 45개 entry를 정본으로 한다.
- **상태·QA**: 일반 scenario를 initial·bottom·`interaction-canvas-loaded`·`interaction-size-panel`·`interaction-batch-mode`·`interaction-collage-mode`·`interaction-gif-mode`로 분리했다. 일반 profile은 interaction당 EN/dark/desktop 1개로 축약하고 initial/bottom이 나머지 locale/theme/viewport 축을 보완한다는 `profileReductionReason`을 기록했다. 일반 visual은 **11/11·18.12초·concurrency 4/실제 2**. 추적 제외 QA는 포트 **4246**에서 **56/56·32.94초·4/4**, initial 8·bottom 8·interaction 40(상호작용 5종 각 8)이며 모바일 bottom assertion 6종·외부 요청 0·tracking loader 0을 통과했다. 상태별 contact sheet와 모바일 원본을 직접 확인한 차단 결함은 0이다.
- **접근성 실측 — 수정은 B-shared 판정으로 보류**: 충족 항목은 편집 toolbar의 `aria-pressed`, Switch `role=switch/aria-checked`, 단일 도구 아이콘 버튼의 접근 가능한 이름, GIF 순서 변경의 위/아래 버튼 대안, 모바일 44px 이상 타깃이다. 남은 공백은 ① 상위 4모드 버튼에 tab/pressed/selected 상태 없음 ② canvas stage의 generic `div`에 금지된 `aria-label`(axe serious) ③ 빈 선택 안내 대비(serious) ④ crop/effect 영역 생성과 pan이 drag 전용 ⑤ layer 재정렬이 drag 전용 ⑥ 같은 종류 레이어의 숨기기/삭제와 GIF 프레임 이동/삭제 라벨에 대상 이름·번호 없음이다. 공용 FileDropZone의 file input label(critical)·nested-interactive(serious), desktop language switcher region(moderate)도 함께 재현됐다. axe는 초기 5건→레이어 로드 뒤 공용 3건으로 줄었다. 지시대로 B6에서 이 공백을 고치지 않고 B-shared 입력으로 남겼다.
- **예산·검증**: `2b1aabd` 대비 gzip은 entry **+9B**, image route **+2,697B**, shared **−7B**, 전체 앱 JS **+2,672B**, CSS **−887B**로 5종 상한을 통과했다. 표준 build **2,829 modules·정적 61페이지**, unit **193/193**, `TEST_ONLY_IMAGE=1 test:new-tools`, `TEST_ONLY_IMAGE_SIZING=1 test:new-tools`, static, manifest, bundle, diff check가 통과했다. 추적 제외 빌드에서 UI migration과 control geometry **92 samples/20 pages**가 통과했다. 일반 visual은 위 11/11이고 QA는 56/56이다. stale selector·sticky 스크롤 좌표·하단 패널 가림으로 드러난 하네스 실패는 data-testid, 정확 픽셀 행렬 선택, 실제 렌더 bounds 가시점으로 교정했으며 엔진 허용치와 제품 로직은 완화하지 않았다.

### P2 B6 수정 — 모바일 캡처 좌표 판정·레이어 검증 표면 복구 (Codx)

- **실행 게이트**: fetch 뒤 `HEAD=origin/ui-migration=a2d74ba64866ddb5db5fabbeb430c875d84c6acc`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`였고 열린 계획서에서 같은 Image Studio·시각 하네스 표면의 상반된 정본은 없었다. 사용자 DOCX 2개·네이버 확인 파일과 기존 `p2-b5b` 캡처는 제외했고 B-shared에는 착수하지 않았다.
- **결함 1 판정 — 가설 B, 캡처 아티팩트**: Chrome 152·390×844에서 파일 선택 영역을 중앙에 둔 같은 실제 업로드 흐름은 전환 전/후 모두 헤더 겹침 0이고 도구 모음 전체가 보였다. 전환 전 `origin/main`은 헤더 `top 9 / bottom 63 / height 54px / position fixed / z-index 50`, 도구 모음 `top 655.97 / height 64px / position static / z-index auto`; 수정 전 브랜치는 도구 모음 `top 633.14 / height 100px`였다. 반면 문제의 `workspace scrollIntoView + offset -88`을 그대로 적용하면 전환 전도 workspace `top 87.97px`, 도구 모음 `top 9.97 / bottom 73.97px`, 헤더 겹침 **53.03px**, 비가림 노출 **10.97px**였고 브랜치는 workspace `top 88.14px`, 도구 모음 `top -34.86 / bottom 65.14px`, 겹침 **54px**, 비가림 노출 **11.14px**였다. 양쪽에 같은 방식으로 재현되므로 상단 잘림 자체는 전환 회귀가 아니라 워크스페이스만 헤더 아래로 당긴 시나리오 산물이다. 모바일 캔버스 열은 양쪽 모두 `position sticky / top 72px / z-index 8`이고 헤더보다 낮은 평면이다. 모바일 toolbar+canvas를 새로 고정하는 구조 변경은 기존 sticky 캔버스·AdSense 경계와 충돌하므로 기각하고, canvas 상태는 toolbar `offset -72`, size 상태는 panel `offset -72`로 실제 헤더 여백을 반영했다.
- **캡처 교정 뒤 드러난 실제 B6 회귀 4건**: Card의 기본 `flex-column`이 원래 구조 속성을 이겨 도구 모음의 첫 도구들이 좌우로 잘리고, 뷰포트 컨트롤·레이어 행·선택 미니바가 세로로 늘어났다. 구조 재설계 없이 각 소유 컴포넌트에 toolbar `grid`, viewport/minibar `flex-row`, layer row 3열 `grid`를 명시했다. 최종 모바일 실측은 toolbar `top 72.14 / bottom 136.14 / height 64px / display grid`로 헤더 아래 여백 **9.14px**, 탭 rect `left 44 / right 190px`로 카드 내부, workspace `top 159.14px`; viewport는 **230.53×44px** 가로 flex다.
- **결함 2 검증**: `interaction-layers-panel`을 추가해 충분히 긴 실제 fixture 이름을 업로드하고 별 9개를 더해 base 포함 10개 레이어를 만든다. 파일명은 `clientWidth 130 < scrollWidth 2,345px`, `overflow hidden / text-overflow ellipsis / nowrap`; 레이어 목록은 `clientHeight 420 < scrollHeight 596px`, `overflow-y auto`; 모바일 행은 `166/44/44px` 3열 grid·높이 54px, 미니바는 **298×58px** 가로 flex로 실측됐다. 하네스가 이 말줄임과 세로 overflow를 캡처 전에 직접 단언한다.
- **시각·제품 영향**: 추적 제외 프로덕션 빌드에서 `tests/visual-artifacts/p2-b6/` **64/64**(initial 8·bottom 8·interaction 48; canvas/size/layers/batch/collage/GIF 각 8)를 41.93초에 채집했다. 16개 desktop/mobile contact sheet 전수와 모바일 원본을 확인해 헤더 겹침·수평 잘림·레이어 세로 확장·미니바 확장·하단 가림이 모두 0이었다. 기능·ko/en 문구·SEO/정적 route·광고 배치/격리·캔버스/worker/이미지 엔진은 불변이다.
- **예산·검증**: `a2d74ba`→수정본 gzip은 entry `296,958→296,948B`(**−10B**), image route `131,818→131,846B`(**+28B**), shared `2,716,482→2,716,468B`(**−14B**), 앱 JS `5,452,437→5,452,447B`(**+10B**), CSS `41,043→41,067B`(**+24B**)로 5종 상한을 통과했다. 표준 build **2,829 modules·정적 61페이지**, unit **193/193**, 이미지 전체/크기 스모크, UI migration tracking 0, control geometry **92 samples/20 pages**, B6 visual **12/12**, static, bundle, diff check가 통과했다. 초기 unit의 신규 action allowlist 누락, 가로 미니바가 덮은 고정 터치 좌표, 표준 빌드에서 잘못 실행한 QA 전용 두 검사는 각각 manifest 수치/비가림 캔버스 좌표/추적 제외 빌드 전제로 교정한 뒤 같은 명령을 재실행해 통과했다.

### 라이브 배포 검증 · UI 전환 배포 전 기준선 (Claude — Gemini 브라우저 점검 + Claude 실측)

`073da56` 배포분(네이버 소유확인 파일 · 루트 소셜 메타 한/영 병기 · RHWP 0.8.6)을 **라이브에서 처음 확인**했다. 곧 P2 UI 전환 6묶음이 한꺼번에 배포되므로 **비교 기준선 확보**가 두 번째 목적이었다.

- **네이버 서치어드바이저 권고 해소 확인**: `<meta name="description">` 는 **69자**(Claude 실측 — `[...d].length`. Gemini 보고의 64자는 오차이나 **둘 다 80자 이내라 판정은 동일**). OG 12종·Twitter 5종·canonical 모두 라이브에 존재. 한/영 병기 노출 정상.
- 소유확인 파일 200·내용 정상. `/vendor/rhwp-studio/0.8.6/` **200**, 구버전 `0.8.4/` **404**(정리 확인). 오피스 편집기 화면 실제 렌더 확인.
- **라이브 기준선**: 홈·도구 목록·문서 비교·Excel 비교·PDF 도구를 데스크톱(1280×800)·모바일(375×812)에서 육안 확인 — **전부 정상, 차단 결함 0**. 특히 **과거 파손 지점인 문서 비교에서 토글 썸이 트랙 내부·문서 쌍 텍스트 정렬 정상**을 재확인했다(revert 가 유효함을 라이브에서 증명).
- **의심했다가 기각한 건 — 루트 `og:locale=en_US`**: 한국어 우선 사이트인데 en 이라 부정합으로 의심했으나, 실측하니 **루트는 의도된 언어 중립 게이트웨이**다(`generate-static-pages.mjs:181` — `<html lang="en">`, 본문이 "Choose your language / 언어를 선택하세요" 분기, `hreflang x-default → en`). 언어별 페이지는 `:125` 에서 조건부로 올바르게 갈린다. **설계와 정합하므로 변경 제안하지 않는다.** 코드를 읽지 않고 지시했다면 일관된 설계를 깨뜨릴 뻔했다.

### P2 B5b Video Studio UI 전환 · 엔진 격리·그룹/트림 상태 판정 (Codx)

- **실행 게이트·범위**: fetch 뒤 `HEAD=origin/ui-migration=9c2b38c35887f1defb7dfcfb01fd443ba724c1e9`, `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`로 지시 기준과 일치했다. 구현 완료된 두 비디오 후속 정본은 회귀 계약이고 상반 지시가 아니며, 그 밖의 열린 계획서에도 B5b UI 표면 충돌이 없었다. 사용자 소유 DOCX 2개·네이버 확인 파일과 병행 작성된 Claude의 라이브 검증 기록은 보존했다.
- **화면·primitive 판정**: `VideoStudioPage`·`VideoGroupSection`·`VideoTrimLane`의 입력, 그룹/미리보기, 이중 range 트림, 출력 설정·호환 안내·진행, 결과/다운로드 표면을 기존 `UtilityPage`·`UtilitySectionCard`·`UtilityField/Input/Select/Notice`와 shadcn `Button`·`Card`·`Switch`, 기존 `SegmentedControl`로 옮겼다. 새 primitive가 필요하지 않아 `shadcn add`는 실행하지 않았다. 문구·기능·route·SEO·정적 페이지·광고 격리 계약은 변경하지 않았다.
- **엔진 격리 증명**: `git diff --exit-code 9c2b38c -- src/features/video-studio/*.ts`는 exit 0이고 feature diff는 TSX 3개뿐이다. 인코딩·WebCodecs/FFmpeg 판정·concat·오디오 폴백·worker 오케스트레이션·진행률 산출 파일은 diff 0이며, 측정 빌드의 video-probe/videoHybridAudio/video/video-zip/videoStream worker 해시 파일명도 기준과 동일했다.
- **legacy/refcount 판정**: B5b 소유 `legacy-076`·`legacy-110`을 refcount 0 도달 시 제거했고, 교차 공용 규칙에서는 `tool:video-studio` 소비자만 빼고 나머지 selector arm을 보존했다. manifest는 **98 removed·9 split·48 active**, PostCSS는 **873 rules·3,123 declarations**다. B5b TSX 3개와 전역 CSS 325 class token 및 legacy 52 token/동적 prefix 3종의 교집합은 0건이다.
- **상태·시각 판정**: 일반 시각 회귀는 `VISUAL_ONLY=video-studio`, 포트 `4230`에서 **8/8·14.21초·concurrency 설정 4/실제 2**로 재현 일치했다. 상호작용 profile은 initial/bottom이 locale·theme·viewport 축을 보존하므로 EN/dark/desktop 1개로 축약했으며 이 `profileReductionReason`을 scenario에 기록했다. interaction은 **group-editing**(두 파일→그룹 이동→다른 그룹 범위 적용 패널)과 **trim-range**(시작 0.50초 선택)를 분리했다. 첫 QA 육안에서 모바일 숫자 입력이 과축소된 것을 찾아 2열 배치·64px 필드로 보정하고 기준선/QA를 전량 재생성했다.
- **QA 입력·추적 제외**: `VITE_LOCAL_QA=1 npm run build` 뒤 `VISUAL_TEST_PORT=4231`, `VISUAL_ONLY=video-studio`, `VISUAL_CAPTURE_DIR=tests/visual-artifacts/p2-b5b`로 **32/32·34.98초·concurrency 4/4**를 채집했다. 분포는 initial **8**·bottom **8**·interaction **16**(group-editing 8·trim-range 8)이며 `stateId`가 파일명에 있다. 네 mobile bottom profile 모두 최하단 거리·main padding·footer/대체 target·수평 overflow·viewport 캡처의 공용 assertion 6종을 통과했다. ko/en 별도 DOM/네트워크 실측은 외부 요청 각 0, Google/Naver/AdSense loader 각 0이다. 32장 전수 육안에서 최종 차단 결함과 사고 증상 3종은 0이었다.
- **예산**: `9c2b38c`→최종 gzip은 entry **296,955→296,949B(−6B)**, worker 포함 video route **173,198→176,982B(+3,784B)**, shared **2,716,455→2,716,489B(+34B)**, 전체 앱 JS **5,445,913→5,449,765B(+3,852B)**, CSS **43,663→41,930B(−1,733B)**로 5종 상한을 모두 통과했다. 도구 단독 묶음이라 네 화면 커밋의 합산을 기준선과 비교했다.
- **검증·하네스 실패 기록**: 표준 build **2,829 modules·정적 61페이지**, unit **192/192**, `TEST_ONLY_VIDEO=1 test:new-tools`, `test:video-hybrid`(6초 단일·12초 concat의 재생/전체 decode/단조 DTS/동기 한계/잔재 0), UI migration(7 switches·action 190px·legacy/tracking 0), control geometry **92 samples/20 pages**, visual 8/8, static, manifest, bundle, diff check가 통과했다. 첫 비디오 스모크는 제거된 `.audio-encoding-fields` 대기 300초, 다음은 `.video-audio-removal-suggestion` 대기 60초에서 각각 종료됐고 제품/worker 오류가 아니라 전환 후 stale selector였다. `data-testid`/`data-removal-only`로 하네스를 교정한 뒤 같은 전체 명령이 연속 통과했다.
- **커밋 분할 사유**: 단독 도구지만 feature 전체가 7,870줄이므로 입력 `5d7848e` → 그룹/트림 `27da026` → 출력/진행 `f932ddc` → 결과·manifest/scenario `aac3b2c` → 모바일 트림 QA 보정·기준선 `d0d0b89`로 화면 책임을 분리했다. 예산·기능 스모크는 최종 묶음 합산으로 판정했다.

### P2 B4 검수 판정 · 이관 개선 2건 채택 (Claude)

- **검수**: Gemini 전수 96장(initial 24·bottom 24·interaction 48 — 시트 선택·비교 쌍/키 모드·QR 생성/스캔/일괄) 차단 결함 0·[배포 가능], 사고 증상 3종 **미관찰**.
- **이관 개선 ② excel-compare 다크 선택 카드 테두리 대비 — 채택.** Codex 실측 대비 **14.29:1**(WCAG AA 3:1 기준을 크게 상회), Gemini 판정 "충분".
- **이관 개선 ⑤ Swap/Add 버튼 체급·affordance — 채택.** Codex 실측 Add `128.25×44px` · Swap `44×44px` · focus-visible ring 3px. 44px 은 터치 타깃 최소 권고를 만족한다. Claude 육안으로 사용자 원 요청(파일 2개 드래그 시 좌우 자동 분배 + `⇄` 아이콘으로 위치 교환)이 화면에서 실제 동작함을 `excel-compare-empty__interaction-pair__ko__{dark__desktop,light__mobile}.png` 로 확인했다.
- **관찰(차단 아님)**: Swap 버튼이 비교 쌍 카드 **우상단 구석**에 있고 좌/우 파일 카드는 그 아래에 있어, 무엇을 교환하는지의 시각적 연결이 약간 멀다. 차단 결함이 아니고 Gemini 도 지적하지 않았으므로 이번 묶음에서 손대지 않는다. **B-shared 또는 P-QA 에서 배치 재검토 후보로만 남긴다** — 지금 옮기면 「명시 제외」의 레이아웃 재설계에 해당한다.
- legacy manifest **82 removed·5 split·68 active**. **B5a 착수 조건 충족으로 판정.**

### P2 B5a Audio Studio·PDF 도구 UI 전환 · 모바일 탭 단서 판정 (Codx)

- **실행 게이트·범위**: `HEAD=origin/ui-migration=c60f221aa9d309025315d97b8f8378b0d0f66acd`와 지시 기준이 일치했고, fetch 뒤 `origin/ui-migration`도 같았다. 열린 U4 PDF 마무리 문서는 비정본 초안이며 최신 사용자 결정이 B5a 선행·순수 UI 전환으로 충돌을 해소했으므로 U4 기능·PDF/오디오 엔진·문구·route·SEO·정적 페이지·광고 격리 경계는 변경하지 않았다. 사용자 소유 DOCX 2개와 네이버 확인 파일, 선행 Claude의 B4 검수 기록은 보존했다.
- **primitive 판정**: Audio Studio의 파형/선택/transport/편집/음성 효과/내보내기와 PDF 4모드의 탭/썸네일/출력 workspace를 기존 shadcn `Button`·`Card`·`Switch` 계열, 공용 `UtilitySurface`와 Tailwind로 옮겼다. 현행 primitive만으로 실제 소비처가 충족돼 `shadcn add`는 실행하지 않았다. 첫 오디오 effect 캡처에서 legacy `PrimaryButton` 폭 계약 때문에 미리 듣기 버튼이 왼쪽으로 넘친 현상을 발견해, 190px 소유 wrapper로 폭을 한정한 뒤 재채집에서 겹침·수평 overflow 0을 확인했다.
- **이관 개선 ① 채택 — PDF 모바일 탭 가로 스크롤 단서**: 레이아웃이나 탭 수는 바꾸지 않고 실제 `scrollWidth/clientWidth/scrollLeft`를 관찰해 남은 방향에만 페이드 마스크를 표시했다. Chrome 152·390×844에서 navigation은 **500/366px**, 시작 `scrollLeft=0`에 오른쪽 페이드, 끝 `scrollLeft=134`·remaining **0px**에 왼쪽 페이드였고 페이지 수평 overflow는 **0px**였다. 항상 보이는 페이드나 탭 재배치는 끝에서도 더 있다는 거짓 단서·레이아웃 재설계가 되므로 기각했다. 키보드 link 탐색·현재 모드 `data-active`·focus-visible ring은 유지했다.
- **legacy/refcount 판정**: B5a 소스 8개와 전역 CSS 394 class token의 교집합은 **0건**이다. `legacy-099`~`104`·`111`~`113`·`121`·`130`~`131`·`140`·`146` 14개를 refcount 0에서 완전 제거했고, `legacy-065`~`069`는 raw `.settings-row` arm만 제거해 `.ui-settings-row`를 보존했다. 기존 split `legacy-133`·`151`에서도 PDF/raw settings arm만 추가 제거했다. B2에서 HWP arm만 제거하고 PDF arm을 남겼던 `legacy-121`은 이번에 refcount 0이 되어 완전 제거됐다. 최종 manifest는 **96 removed·9 split·50 active**, PostCSS는 **1,106 rules·3,986 declarations**이며 `global.css`는 10줄 추가·322줄 삭제(순감 312줄)다.
- **상태·로컬 QA**: 시각 scenario는 오디오 `interaction-waveform`·`interaction-effect-robot`, PDF `interaction-organize-thumbnails`·`interaction-image-to-pdf-thumbnails`·`interaction-pdf-to-image-thumbnails`·`interaction-convert-thumbnails`로 분리해 한 장으로 4모드를 대표하지 않았다. 일반 회귀는 **18/18, 25.80초**, 동시성 설정 4/실제 2, filter `audio-studio,pdf-editor`. QA는 **80/80, 47.87초**, 설정/실제 동시성 4/4이며 initial **16**·bottom **16**·interaction **48**(상호작용 stateId 각 8장)이다. 모바일 bottom 8장 모두 공용 6개 assertion을 통과했고 80장 전체 외부 요청 0, B5a 두 route의 Google/Naver/AdSense loader 각각 0을 별도 DOM 실측했다.
- **예산**: `c60f221`→B5a gzip은 entry **296,941→296,955B(+14B)**, 영향 route 합 **196,090→201,758B(+5,668B)**(audio **28,321→29,965B**, PDF **167,769→171,793B**), shared **2,716,494→2,716,455B(−39B)**, 앱 JS **5,440,319→5,445,913B(+5,594B)**, CSS **45,803→43,663B(−2,140B)**로 5개 상한을 모두 통과했다.
- **검증·실패 기록**: 표준 build(2,829 modules·정적 61페이지), unit **191/191**, PDF browser, Audio new-tools, UI migration, control geometry **92 samples/20 pages**, visual 18/18, static, manifest, bundle, diff check가 통과했다. 최초 PDF browser는 서버 미기동으로 `ERR_CONNECTION_REFUSED`, UI/control 최초 실행은 표준 빌드의 추적 로더 때문에 QA 전제에서 실패해 각각 서버 기동·`VITE_LOCAL_QA=1` 빌드 후 동일 명령을 통과했다. QA 첫 80장 시도는 IntersectionObserver 썸네일보다 이미지 selector를 먼저 기다린 3장이 실패했으며 카드→scroll→image 순으로 하네스를 고친 뒤 80장 전량 재채집했다. Audio 첫 production-preview 실행의 undo 직후 redo listener 갱신 경합은 redo 버튼 enabled 대기를 추가해 재실행 통과했다. 이는 제품 엔진 변경 없이 하네스 동기화를 정확히 한 판정이다.

### P2 B4 Excel 병합·Excel 비교·QR Studio UI 전환 (Codx)

- **개선 ② 채택 — Excel 비교 다크 선택 카드 경계 보강.** 선택 카드에는 공용 green 토큰의 다크 경계를 적용하고 배경·ring도 같은 계열 토큰으로 한정했다. Chrome 152 다크 렌더에서 선택 경계와 인접 비선택 카드 배경의 대비는 **14.29:1**로 비텍스트 경계 3:1 기준을 넘었다. 전역 토큰 변경이나 카드 레이아웃 재설계는 범위를 벗어나므로 기각했다.
- **개선 ⑤ 채택 — Swap/Add 체급·affordance 보강.** Add는 **128.25×44px**, Swap은 **44×44px**로 측정됐고 두 버튼 모두 green 토큰 hover 계약과 키보드 `:focus-visible` **3px ring**을 가진다. headless Chrome은 `(hover: hover)`가 false라 hover 색의 렌더 실측은 할 수 없으므로 생성된 hover class 계약을 확인하고, focus-visible은 실제 box-shadow 변화로 교차 확인했다. 버튼을 전체 폭으로 늘리는 안과 파일 쌍 레이아웃 재설계는 기각했다.
- 세 도구는 기존 shadcn Button/Card/SegmentedControl과 UtilitySurface를 재사용했으며 새 primitive add는 없다. 기능·ko/en 문구·SEO·정적 route·광고 격리·엔진 경계는 불변이다. Excel 병합의 시트 카드/내부 스크롤/44px 모바일 칩/sticky 요약, Excel 비교의 2파일 자동 좌우 분배·Swap, QR 생성·일괄 생성·사진 스캔 계약을 브라우저 스모크로 보존했다.
- legacy manifest는 기준 155개에서 B4 종료 시 **82 removed·5 split·68 active**다. B3에서 보존한 `legacy-150`을 Excel Compare 소비 종료 뒤 제거했고, 이번 묶음에서 총 51개가 refcount 0으로 제거됐다. 혼합 selector는 해당 arm만 분리했으며 B4 소스와 전역 legacy token 교집합은 0이다. PostCSS 실측은 **1,394 rules·5,128 declarations**다.
- `84e8091` 대비 gzip 예산 증분은 entry **+1.82KiB**, 영향 lazy route(Excel Compare·QR Studio; Excel 병합은 eager entry 귀속) 합 **+2.24KiB**, shared **−0.80KiB**, 전체 앱 JS **+3.00KiB**, 전체 CSS **−2.31KiB**로 다섯 상한을 모두 통과했다.
- 검증은 build 2,829 modules·정적 61페이지, unit **190/190**, Excel browser·XLS 보존·XLS 최초 진입·Excel 비교·utilities·QR bulk, ui-migration, control geometry **92 samples/20 pages**, static, manifest, diff check를 통과했다. 일반 B4 시각 회귀는 **24/24**(25.22초·동시성 4/유효 3) 일치다.
- 추적 제외 QA 입력은 `tests/visual-artifacts/p2-b4/`의 **96/96**이며 initial 24·bottom 24·interaction 48이다. interaction은 병합 시트 선택·비교 key 모드·비교 파일 쌍·QR bulk/create/scan이 각 8장이고, `stateId`를 파일명에 보존했다. 모바일 bottom 공용 6개 assertion, `captureBeyondViewport:false`, 외부 요청 0·tracking loader 0을 확인했다. 별도 Gemini 판정 전에는 B5a를 시작하지 않는다.

## 2026-09-04

### P2 B3 문서 비교·Excel 정리 UI 전환 · 라이브 사고 지점 판정 (Codx)

- **실행 게이트·범위**: `ui-migration`에서 `HEAD=origin/ui-migration=4ecda007163d41866f099a5a473962c262f02a06`을 확인하고 fetch 뒤 착수했다. B1·B2의 Gemini `[배포 가능]` 판정과 열린 계획서 무충돌을 확인했으며 `origin/main=073da56226f7bc1bdbef682a477e05ec28862074`에는 checkout·commit·push하지 않았다. 도달 가능한 `DocumentComparePage`, `DocumentCompareResultPage`가 연결하는 `WordCompareResultPage`, 실제 Word/HWP 처리 경로, `ExcelCleanerPage`만 전환했고 도달 불가 `HwpComparePage`·`HwpCompareResultPage`·`WordComparePage`는 수정하지 않았다. 사용자 미추적 DOCX 2개와 네이버 확인 파일도 제외했다.
- **전환·primitive 판정**: 문서 입력 쌍·페어링 미리보기·비교 옵션·작업 영역·Word 결과 표와 Excel 정리의 업로드·시트/규칙·미리보기·실행/결과를 기존 shadcn Button/Card/Switch 및 공용 UtilitySurface와 Tailwind로 옮겼다. 현재 primitive로 실소비가 모두 충족되어 `shadcn add`는 실행하지 않았다. role/aria·키보드 동작과 ko/en 문구·SEO/정적 route·AdSense 격리·GitHub Pages 경계 및 비교/정리 엔진은 유지했다.
- **legacy 소유권·제거**: B3 전용 owner ID 14개(`legacy-070`~`073`, `087`~`094`, `141`, `149`)를 refcount 0에서 제거하고 혼합 `legacy-132`에서는 `.ios-switch` arm만 분리 제거했다. 조사 중 `legacy-150`은 Excel Cleaner가 아니라 B4 Excel Compare의 `.excel-status-filters button:not(.selected)` 소비임을 확인해 소유권을 Excel Compare로 바로잡고 유지했다. manifest 최종값은 전체 **155**, removed **31**, split **3**, active **121**이며 PostCSS는 B2의 1,807 rules/6,550 declarations에서 **1,634/5,973(-173/-577)**으로 줄었다. B3 소스 6개를 전역 legacy token 564개와 대조한 격리 검사는 방출 **0건**이었다.
- **사고 증상 1 — 토글 썸**: `test:control-geometry`에 문서 비교 4개 프로필과 각 7개 토글의 초기/전환 표본을 넣어 **32 samples**를 측정했다. track **43×25px**, thumb **21×21px**, 상·하·좌·우 최대 이탈이 모두 **0px**, 최대 수직 중심 오차 **0px**, 최소 내부 inset은 네 방향 모두 **2px**였다. 따라서 썸의 트랙 이탈·수직 편심은 0이다.
- **사고 증상 2 — 문서 쌍 텍스트**: 작업 문구 컨테이너/강조/보조문의 실측 폭은 모두 **747px**, 높이는 각각 **42.5625/20/18.5625px**, `writing-mode`는 모두 **horizontal-tb**였고 페이지 가로 overflow는 **0px**였다. 1~2자 폭으로 붕괴해 세로로 낙하하는 항목은 0이다.
- **사고 증상 3 — 버튼 폭·legacy 충돌**: 문서 비교 작업 버튼은 **190×48px**이며 `.tool-action-bar`와 `w-full`의 동시 방출은 **0건**, 해당 화면의 legacy selector match도 **0건**이었다. Excel Cleaner에서 기존 `PrimaryButton`의 `.ui-primary-button { width:100% }`가 실행 버튼을 **1,016px**로 늘리고 미리보기 버튼을 sidebar 아래로 미는 실제 충돌을 재현해 순수 shadcn Button으로 교체했다. 최종 미리보기/실행 버튼은 **158.890625/142.265625px**, 부모 **1,016px**, 좌·우 이탈 **0px**, legacy primary class 방출 **false**다.
- **시각 검수에서 발견한 보정**: 영문 모바일 Word 결과 탭이 겹치는 현상을 캡처로 발견해 3등분 `min-width:0`과 정상 줄바꿈으로 고쳤다. DOCX 결과가 18%에서 멈춘 최초 하네스는 Puppeteer 25.6.0의 request interception이 same-origin Web Worker 요청에서 null frame을 만드는 테스트 문제로 판정했다. 추적 코드는 `VITE_LOCAL_QA=1`로 빌드 제외한 채 interception만 제거하고 모든 외부 요청을 별도로 수집·0건 단언해 실제 DOCX 처리를 약 6초 안에 완료했다.
- **5종 번들 예산**: 동일 명령·zlib 기준 baseline→최종은 entry JS **295,063→295,079B gzip(+16B, 한도 +20,480)**, 영향 route JS **24,264→28,567B(+4,303B, +61,440)**, shared JS **2,717,343→2,717,317B(-26B, +30,720)**, app JS **5,432,960→5,437,246B(+4,286B, +81,920)**, CSS **49,003→48,168B(-835B, +10,240)**로 모두 통과했다.
- **3상태 캡처·검수 준비**: 추적 차단 빌드에서 `tests/visual-artifacts/p2-b3/`에 initial **16장**, bottom **16장**, interaction **48장**, 합계 **80장**을 채집했다. interaction은 toggle-on/off·DOCX 결과·HWP 결과·Cleaner 규칙/결과가 각 **8장**이고 도구별로 문서 비교 **48장**, Excel Cleaner **32장**이다. 최종 캡처는 외부 요청·tracking request 각각 0건이며 contact sheet와 대표 원본으로 데스크톱/모바일·한/영·명/암 화면의 최종 배치를 확인했다.
- **완료 검증**: `npm run build` exit 0(2,829 modules·RHWP 77개/60,680,448B·정적 61페이지), `npm run test:unit` 189/189, `TEST_SCOPE=word npm run test:browser`, `TEST_ONLY_HWP=1 npm run test:new-tools`(3,584B fixture·1 page·sentinel 재파싱·Studio 재개방), `npm run test:ui-migration`, `npm run test:excel-cleaner`, `npm run test:static`, `npm run test:control-geometry`, `npm run legacy:manifest`, B3 `VISUAL_ONLY` 18/18 및 QA 80/80, `npm run bundle:measure`, `git diff --check`가 모두 통과했다. B3 Gemini 검수 판정은 아직 요청 전이며 다음 묶음은 착수하지 않았다.

### P2 B2 도구 내부 UI 전환 · 문서 편집 focus 경계 판정 (Codx)

- **실행 게이트·main 선행 병합**: 사용자 지정 `ui-migration`의 `HEAD=4180f88580a868bfe4270925ec1c2bb210b659a7`를 확인한 뒤 fetch했고, `origin/main=073da562968efbcc61ff45fd0a577a7b9b820d05`의 RHWP 0.8.6·루트 SEO 변경을 `ui-migration`에 병합했다. 충돌은 `CHANGELOG.md`·`docs/review-notes.md`·`package.json`·`package-lock.json` 네 파일이었다. 기록은 양쪽 항목을 모두 보존했고, package script는 B1의 `vendor:qr-font`와 main의 `vendor:rhwp:prune`을 함께 실행하며, 의존성은 shadcn/QR와 RHWP 0.8.6 양쪽 집합을 보존했다. `src/config/rhwp.ts`·`public/vendor/rhwp-studio/**`·`docs/OFFICE_EDITOR_ASSETS.md`·`tests/new-tools-smoke.mjs`에는 내용 충돌이 없었다. 기본 npm cache의 `EROFS`는 `/tmp/worklazytools-npm-cache`로 우회해 `npm install`을 완료했고 기존 audit 상태는 6 low/4 moderate였다. 병합 직후 build(2,829 modules·RHWP 77개/60,680,448B·정적 61페이지)와 unit 187/187을 통과한 뒤 별도 merge commit `26eb56e`로 고정했다. `main`에는 checkout·commit·push하지 않았고 `/tmp/worklazytools-rhwp-0.8.6` 및 사용자 미추적 파일 3개를 건드리지 않았다.
- **B2 전환·primitive 판정**: data-converter는 형식 route·입출력 편집기·작업 버튼, timezone-calculator는 기준/추가 도시·지도·핀·세계 시계·회의 시간, text-merger는 소스 카드·순서 변경·미리보기·구분자·결과, hwp-editor는 진입 화면과 문서 로드 뒤 focus toolbar/shell, office-editor는 안내 landing과 격리 app toolbar/canvas/drop overlay를 기존 shadcn Button/Card와 공용 UtilitySurface·Tailwind로 옮겼다. 새 primitive로만 해결되는 소비처가 없어 `shadcn add`는 실행하지 않았다. ko/en 문구·SEO/정적 route·AdSense 격리·GitHub Pages 서버리스 경계와 HWP/Office 엔진 코드는 바꾸지 않았다.
- **focus·격리 경계 판정**: HWP의 실제 3,584B fixture 로드 시 공용 UtilityPage의 진입 padding/animation이 focus fixed layout에 남아 viewport를 밀어내는 것을 캡처에서 발견했다. `flush` 상태가 진입 장식만 제거하도록 고쳐 sidebar 바깥 가용 viewport를 채웠고, 모바일은 기존 전체 화면 z-index 경계를 유지했다. Office의 `/tools/office-editor/app/` 직접 경로는 기존 엔진·자산 격리를 보존한 채 동일한 focus geometry를 명시했다. HWP iframe host와 Office canvas는 화면 소유 data attribute만 추가하고 런타임 통신·저장 의미는 변경하지 않았다.
- **legacy refcount 판정**: B2 8개 화면 소스가 기준 52 exact token·3 dynamic prefix와 현재 전역 CSS의 643 class token을 방출하지 않는 AST 검사를 추가해 교집합 **0건**을 확인했다. manifest 기준 B2 전용 규칙 13개를 `removed`, PDF와 섞인 규칙 1개는 B2 arm만 제거해 `split`으로 전환했다. 결과는 155개 중 **17 removed·2 split·136 active**다. `global.css` diff는 **250줄 삭제·2줄 추가, 순감 248줄**이며 최종 PostCSS AST는 **1,807 rules/6,550 declarations**다. 살아 있는 PDF/공용 소비 arm은 보존했고 생성물·벤더 산출물은 직접 수정하지 않았다.
- **상호작용·기능 보존**: `test:utilities`는 B2의 데이터 형식 전환·도시/지도·텍스트 병합과 HWP 영문 redirect를, `TEST_ONLY_HWP=1 test:new-tools`는 고정 fixture 열기→3,584B 저장→core sentinel/1페이지 파싱→Studio 재개방을 통과했다. `test:office`는 **95 download states·7 cached states·한국어 Calc 키보드 편집·5,089B DOCX 저장**을 통과했다. 스모크는 제거된 class selector 대신 안정적인 `data-tool-page`/`data-testid` 계약을 사용한다.
- **시각 scenario·검수 입력**: B2 다섯 도구 모두 initial·bottom·interaction을 가지며 interaction은 JSON 원본 선택·기준 도시 변경·쉼표 구분자·실제 HWP 문서 로드·격리 Office workspace다. 일반 부분 회귀는 HWP 영문 redirect 2장을 포함해 Chrome 152에서 **34/34, 25.76초**로 통과했다. `VITE_LOCAL_QA=1` 추적 차단 build 뒤 `tests/visual-artifacts/p2-b2/`에 **108/108, 1분 6.20초**를 채집했고 외부 추적은 0이었다. 상태별로 initial **36**·bottom **36**·interaction **36**이며, 정확한 interaction state는 JSON 8·기준 도시 8·쉼표 8·HWP 로드 4(한국어 전용)·Office workspace 8장이다. 다섯 contact sheet를 직접 열어 ko/en·light/dark·desktop/mobile의 겹침·잘림·수평 overflow·다크 모드·하단 nav 가림을 확인했으며 차단 결함은 보이지 않았다. 이는 **Codx 로컬 육안 판정**이며 정본의 별도 Gemini 검수 판정을 대체하지 않는다; 다음 묶음 착수 전 외부 판정 입력으로 108장을 인계한다.
- **고정 번들 예산**: main 병합 직후 기준→B2는 entry JS gzip **295,065→295,063B(−2B/−0.00KiB, 상한 +20KiB)**, 영향 route 합 **101,867→107,457B(+5,590B/+5.46KiB, +60KiB)**, shared **2,717,095→2,717,343B(+248B/+0.24KiB, +30KiB)**, 앱 JS **5,427,141→5,432,960B(+5,819B/+5.68KiB, +80KiB)**, CSS **49,275→49,003B(−272B/−0.27KiB, +10KiB)**로 5종 모두 통과했다. 다섯 도구가 공용 surface·전역 CSS와 두 focus layout을 같은 단위로 소비하므로 B2 묶음 합산을 채택했다.
- **완료 검증·재시도**: 최종 일반 `npm run build`는 exit 0(2,829 modules·RHWP 77개/60,680,448B·정적 61페이지), `npm run test:unit` **188/188**, `npm run test:static`, `npm run legacy:manifest`, `npm run test:utilities`, `TEST_ONLY_HWP=1 npm run test:new-tools`, `npm run test:office`, `npx tsc -b`, `git diff --check`가 모두 통과했다. 추가 `test:control-geometry`도 60 samples/16페이지에서 overflow·중심 오차·tracking·legacy match 0으로 통과했다. 정적 검사의 첫 시도는 직전 `VITE_LOCAL_QA=1` 산출물에 분석 설정이 의도대로 compile-out되어 실패했고, 일반 production build로 `dist/`를 복원한 뒤 동일 검사가 통과했다. 기존 vm-browserify eval·500kB chunk 경고 외 신규 빌드 오류는 없다.

### P2 B1 검수 입력 3상태 교정 · 모바일 컨트롤 정밀 판정 (Codx)

- **실행 게이트·결함 확정**: 사용자 지정 메인 워킹트리 `/home/better0101/projects/worklazytools`의 `ui-migration`에서 `HEAD=origin/ui-migration=5298c13d4fd518204942474e6aa550373f33adbd`를 확인하고 시작했다. 추적 파일 변경은 없었으며 사용자 소유 미추적 `before.docx`·`after.docx`·네이버 확인 HTML과 다른 worktree는 건드리지 않았다. 기존 `p2-b1` PNG 파일명 분포는 initial **48** + interaction **48** + bottom **0**이었다. 원인은 B1 전용 QA scenario 파생 코드가 공용 manifest에서 `stateType === initial || interaction`만 선택해 bottom을 명시적으로 버린 것이며, 따라서 최초 검수의 모바일 하단 차단 판정은 필수 입력이 빠진 상태에서 내려진 것으로 확정했다.
- **공용 QA 계약**: B1 전용 `VISUAL_B1_CAPTURE_ONLY` 경로를 제거하고 `npm run test:visual:qa`(`VISUAL_QA_CAPTURE_ONLY=1`)로 통합했다. 이 모드는 `VISUAL_ONLY` 묶음 식별자를 필수로 받고, 선택 결과에 initial·bottom·interaction 중 하나라도 없으면 캡처 전에 실패한다. 공용 manifest의 세 상태를 제품상 적용 가능한 locale에 대해 ko/en × light/dark × mobile/desktop 전체 프로필로 확장하므로 B2~B6와 B-shared 대표 도구도 같은 명령을 사용한다. locale N/A는 기존 명시 사유를 보존한다. 파일 저장 뒤 stateType과 정확한 stateId별 장수를 모두 출력해 검수 입력 누락을 자동으로 드러낸다.
- **최하단 도달 판정·재채집**: bottom은 actions 이후 촬영 직전에 모든 viewport에서 `abs(scrollHeight-clientHeight-scrollTop) ≤ 1px`를 재단언한다. mobile은 이어 기존 공용 assertion의 main padding ≥ bottom-tabs 높이, footer 또는 마지막 조작부가 tabs 위, 수평 overflow ≤1px도 단언한다. `VITE_LOCAL_QA=1` build와 consent granted에서 B1 6도구를 재채집한 결과 Chrome 152로 **144/144, 1분 18.93초**, 외부 요청 시도 0이었다. 상태 분포는 initial **48** · bottom **48** · interaction **48**이고, 정확한 stateId는 initial 48 · bottom 48 · interaction-clean-result/format-result/leave-result/net-mode/password-strength/text-cleanup 각각 **8**이다. 48개 bottom은 모두 실제 최하단이며 그중 mobile **24**개는 하단 네비 assertion까지 통과했다. 파일명 독립 재집계도 같은 분포였고 대표 mobile bottom 6장을 직접 열어 footer·FAQ·법적 링크가 nav 위에서 끝남을 확인했다.
- **컨트롤 DOM 실측 방식**: 추적 차단 build의 390×844 DPR 1에서 ko/en × light/dark **16페이지**를 열고 총 **60 samples**를 측정했다. Switch는 Base UI root를 track, 실제 `[data-slot=switch-thumb]`를 thumb로 checked/unchecked 양쪽에서 측정했다. 별도 thumb DOM이 없는 SegmentedControl은 group을 track, 각 옵션을 차례로 선택한 active button을 selection indicator로 측정했다. 이탈 수치는 `max(0, track edge - indicator edge)`의 상·하·좌·우, 수직 중심 오차는 두 rect 중심 Y의 절댓값이다.
- **도구별 수치·판정**: `security-tools` 20 samples는 track **43×25px**, thumb **21×21px**, 최소 inset 상/하/좌/우 각 **2px**, 이탈 상/하/좌/우 각 **0px**, 최대 수직 중심 오차 **0px**였다. `work-calculator` 16 samples(주 모드+연차 기준)는 track **358×52px 또는 316×52px**, indicator **173×44px 또는 152×44px**, 최소 inset 사방 **4px**, 이탈 사방 **0px**, 중심 오차 **0px**였다. `payroll-calculator` 12 samples는 **358×52px / 114×44px**, 최소 inset 사방 **4px**, 이탈 사방 **0px**, 중심 오차 **0px**였다. `text-formatter` 12 samples는 **316×52px / 100×44px**, 최소 inset 사방 **4px**, 이탈 사방 **0px**, 중심 오차 **0px**였다. 네 도구 모두 실제 이탈이 없어 Gemini 2차 지적은 **오탐**으로 판정했고 제품 CSS는 수정하지 않았다. 상세 rect는 `tests/visual-artifacts/p2-b1/control-geometry.json`에 고정했다.
- **legacy 충돌 확인**: P1a 사고 유형의 옛 B1 컨트롤 클래스 `.ios-switch`·`.mode-switch`·`.sub-segment`·`.formatter-toolbar`·`.toggle-card-grid`가 위 16페이지의 도구 root 아래에서 방출되는지 함께 검사한 결과 **0건**이었다. `.ui-segmented-control`은 공용 shadcn adapter의 의도된 selector이며 페이지 전용 legacy wrapper가 아니다. 실제 이탈도 legacy 교차도 없으므로 무근거 CSS 보정·공용 adapter 제거는 기각했다.
- **검증·재시도**: 추적 차단 build와 일반 `npm run build`는 각각 exit 0(2,828 modules·정적 61페이지), 일반 build의 B1 `VISUAL_ONLY` `npm run test:visual`은 **42/42, 26.17초**로 기존 기준선과 일치했고 mobile bottom 12장을 재확인했다. 하단 음성 대조도 padding 0px에서 footer overlap을 검출하고 padding 80px 복원 뒤 통과했다. `npm run test:control-geometry`는 60/60 samples·tracking 0·legacy match 0, `npm run test:utilities`와 `npm run test:static`은 exit 0이었다. 최초 전체 unit은 새 기하 검증 파일의 광고 부재 검사 문자열을 repo-wide 명시 allowlist가 잡아 **186/187**로 실패했고, 검증 소유 파일로 최소 허용목록에 추가한 뒤 `npm run test:unit` **187/187**로 통과했다. 사용자 ko/en 문구·SEO/정적 입력·AdSense 제품 경로·GitHub Pages 런타임은 변경하지 않았다.

### P2 선행 owner/refcount manifest · B1 도구 내부 UI 전환 (Codx)

- **실행 게이트**: 사용자 지정 기준 `454d7c8964d1a2f301c8661a6c6cc00f6304b49f`에서 `HEAD=origin/ui-migration` 일치를 확인하고 시작했다. 열린 `docs/jobs/todo`에는 B1 또는 같은 CSS 표면을 상반되게 지시하는 계획이 없었다. `/tmp/worklazytools-rhwp-0.8.6`과 사용자 소유 미추적 파일 `before.docx`·`after.docx`·네이버 확인 HTML은 건드리지 않았고, `main`에는 checkout·commit·push를 하지 않았다.
- **manifest 판정**: `docs/legacy-css-owner-manifest.json`을 검증 가능한 JSON으로 채택했다. 기준 selector·원래 줄·legacy token·소유 범주·소비 도구/공용 화면·`refCount`·`lastRemovalBundle`·현재 상태를 155개 모두 기록하고 생성기가 기준 커밋의 CSS를 직접 파싱해 143 non-compact + 12 compact 및 18개 범주 분포를 고정한다. orphan `.drop-hint-segment`·`.file-list`를 포함한 4개 규칙은 완전 제거, 모바일 혼합 selector 1개는 B1 arm만 제거해 현재 150 active/4 removed/1 split이다. 전체 CSS rule은 2,132→2,052로 80개 줄었으며 그중 orphan 2개를 제외한 78개가 B1 전용 규칙이다.
- **B1 전환·primitive 판정**: 여섯 도구에 공통 `UtilitySurface` 래퍼와 설치돼 있던 shadcn Button/Card/ToggleGroup 어댑터를 실제 사용했다. 새 shadcn primitive 설치는 필요하지 않아 `add`를 실행하지 않았다. 포맷터는 설정·고정 높이 양쪽 편집기·작업 결과, 영업일/연차는 모드·입력·지표·상세 결과, 급여는 3모드·숫자 입력·결과/공제·공식 출처, 보안은 출력·옵션 toggle·강도 meter, 사진은 drop/result/metadata/download/share, 텍스트는 양쪽 편집기·8개 동작·검사 결과를 Tailwind/shadcn 표면으로 옮겼다. B1 소스가 현재 `global.css` class token을 직접 방출하지 않는 단위 검사를 추가했고, 원시 worker 오류 대신 현지화된 일반 오류를 유지했다.
- **기능·제품 경계 판정**: `test:utilities`는 work-calculator의 기본 영업일 문자열뿐 아니라 연차 모드로 바꾼 뒤 결과까지 단언하도록 보강했다. ko/en 제품 문구와 SEO route·정적 페이지 입력은 변경하지 않았고, AdSense/분석 격리 경로도 불변이다. 추적 제외 빌드는 기존 `VITE_LOCAL_QA=1` 계약을 사용했으며 새 QA 캡처 96장 실행에서 외부 요청 시도 0으로 통과했다.
- **scenario·하단 assertion**: B1 6개 모두 `data-tool-page` 기반 initial/bottom/interaction selector를 갖고, 실제 포맷 결과·연차 결과·급여 net 모드·고정 비밀번호 강도·생성 PNG 정리 결과·텍스트 공백 정돈을 실행한다. 전체 manifest는 153 capture로 늘었고 B1 부분 실행은 initial 24 + mobile bottom 12 + interaction 6 = **42/42, 26.15초**였다. bottom 12장은 최하단 거리·main padding·footer/대체 대상·수평 overflow의 공용 assertion을 모두 통과했다. 캡처 전용 12 scenario는 8 profile 완전 직곱으로 **96/96, 53.23초**에 완료했으며 경로는 `tests/visual-artifacts/p2-b1/`이다. 12장 대표 contact sheet로 레이아웃을 확인했고, 이 산출물은 Gemini 검수 입력이다. Gemini의 별도 판정 전에는 다음 묶음 B2를 시작하지 않는다.
- **고정 번들 예산 실측**: `scripts/measure-bundle-budget.mjs`는 `vite build --manifest --outDir dist-measure` 후 전용 디렉터리를 삭제하고 SHA-256 중복 제거·manifest route graph·worker 경로 귀속을 적용한다. `454d7c8` 기준→B1은 entry JS gzip **294,993→295,057B(+64B/+0.06KiB, 상한 +20KiB)**, B1 route 합 **821,979→824,635B(+2,656B/+2.59KiB, +60KiB)**, shared **2,715,659→2,716,496B(+837B/+0.82KiB, +30KiB)**, 앱 JS **5,420,234→5,423,800B(+3,566B/+3.48KiB, +80KiB)**, CSS **49,308→49,275B(−33B/−0.03KiB, +10KiB)**로 5종 모두 통과했다. 여섯 도구가 한 공용 래퍼와 전역 CSS를 함께 소비하므로 기능적으로 일관된 B1 묶음 합산을 채택했고, 도구별 commit 측정은 해시 변경에 따른 shared 중복 변동이 판정을 흐려 기각했다.
- **검증·재시도 기록**: `npm run build`는 2,828 modules/정적 61페이지, `npm run test:unit`은 **186/186**, `npm run test:static`, `npm run legacy:manifest`, `git diff --check`, `npx tsc -b --pretty false`, B1 `test:visual` 42/42와 `npm run test:utilities`가 통과했다. utilities 첫 실행의 4173 preview 부재 `ERR_CONNECTION_REFUSED`와 두 재시도의 B1 이후 외부 분석 요청 60초 대기는 환경/실행 순서 실패로 기록하며, 일반 빌드와 명시 preview를 사용한 최종 재실행은 전 경로를 완주했다. 시각 기준선 갱신 중 baseline-set 검사가 개별 오류를 먼저 가리던 순서도 고쳐 이후 실패 원인을 보존한다. 기존 vm-browserify `eval`·500kB chunk 경고 외 신규 빌드 오류는 없다.

### P2 선행 — 시각 회귀 실행 비용 개선 판정 (Codx)

- **게이트·병렬화 판정**: `ui-migration`의 `HEAD=origin/ui-migration=7b3222b7233401a9a48eeccc49f4b1def6b8f7c8`에서 시작했고 열린 계획서에 같은 하네스 표면의 상반된 지시는 없었다. 사용자 소유 미추적 파일 3개와 `/tmp/worklazytools-rhwp-0.8.6`은 건드리지 않았다. 가용 CPU의 절반을 최대 4로 제한하는 `min(4, floor(core/2))`를 기본값으로 채택해 16코어 호스트에서는 4이며, `VISUAL_CONCURRENCY=1..32`로 명시 조정할 수 있다. 캡처를 locale별·최대 12장 배치로 나눠 각 배치에 전용 Chrome과 순차 페이지를 주고 배치만 병렬 실행했다. 서로 다른 locale과 origin 저장소를 같은 브라우저 context에서 섞는 방식은 결정성 저하 위험 때문에 기각했다.
- **재현 계약 유지**: 각 작업자는 기존 `--lang`, 중립 `LANG/LC_ALL`, `LANGUAGE`, `Accept-Language`, CDP locale override와 `navigator.language` 단언을 그대로 거치며 UTC, DPR 1, 저장소 Noto CJK font, animation/transition/caret/smooth-scroll 제거, 200ms+2 RAF paint settle도 변경하지 않았다. 완료 순서가 달라도 실패 보고는 원래 capture matrix 순서로 정렬하고 baseline/capture/artifact 파일은 고유 이름만 쓰게 했다. 브라우저 launch·페이지·cleanup 실패도 해당 실행을 실패시키되 남은 독립 배치는 끝까지 수집한다.
- **부분 실행 계약·사용법**: `VISUAL_ONLY`는 쉼표로 구분한 정확한 `scenarioId`, `routeId`, 또는 묶음 사용용 `toolId`를 받는다. 예시는 `VISUAL_ONLY=excel-compare,document-compare VISUAL_TEST_PORT=4911 npm run test:visual`이며, 미지정/빈 값은 기존과 같이 전량, 알 수 없는 값은 무음 0건 통과 대신 즉시 실패한다. 부분 실행 중에도 전체 151장 baseline 집합의 누락·잉여 검사는 유지한다. 출력 마지막에는 총 소요, 완료/선택 캡처 수, 설정 출처와 실제 동시성, 필터를 고정 형식으로 남긴다.
- **개선 전후 전체 실측**: 같은 호스트·Chrome 152에서 순차 구현의 직전 기록은 KO **151/151 5:16.32**, EN **151/151 5:14.96**였다. 병렬화 뒤 기본 동시성 4의 `LANG=ko_KR.UTF-8 VISUAL_TEST_PORT=4913 npm run test:visual`은 **151/151 1:33.35**, `LANG=en_US.UTF-8 VISUAL_TEST_PORT=4914 npm run test:visual`은 **151/151 1:35.84**로 모두 기준선과 일치했다. 두 실행 평균은 315.64초에서 94.60초로 **3.34배, 70.0% 단축**됐다. 별도 CPU 경합에서 보고된 개선 전 약 3시간 수치는 부하 조건이 달라 직접 배수 비교에는 쓰지 않았다.
- **부분·플레이키 실측**: 개선 전에는 부분 필터 자체가 없어 부분 실행 시간은 N/A다. 개선 뒤 대표 두 도구 필터는 정확히 해당 6 scenario/**14 capture**만 실행해 **16.53초**, 즉시 같은 명령 재실행은 **16.05초**였고 둘 다 14/14·diff 0으로 같았다. 선택량이 locale별 한 배치씩이라 설정 4 중 실제 동시성은 2였다. 목표 20분 대비 약 1.4%로 묶음 검증 ≤20분 계약을 충족했다.
- **완료 검증·제품 영향**: `npm run build` exit 0(2,827 modules·정적 61페이지), `npm run test:unit` **184/184**, `npm run test:static`, `node --check tests/visual-regression.mjs`, `git diff --check`가 통과했다. 기존 vm-browserify eval·500kB chunk 경고 외 신규 오류는 없다. 변경은 테스트 하네스·단위 테스트·기록뿐이라 사용자 ko/en 문구, SEO·정적 route, AdSense 격리, GitHub Pages 런타임은 불변이다.

### P2 선행 — 시각 하네스 재현성·scenario·모바일 하단 계약 (Codx)

- **게이트·원인 확정**: `ui-migration`의 `HEAD=origin/ui-migration=62f9031ecc87fef37ca55b3d64f511cfc9b2b407`, `origin/main=311c59e310734e9206629b05752f4228e842dbf0`에서 시작했고 main에는 손대지 않았다. Claude 실측은 같은 HEAD에서 57건(en 48·ko 9, 5~7%) 실패와 영어 화면에 한국어 native file-input 문구가 찍힌 diff를 남겼다. 수정 전 소스의 `puppeteer.launch`에 `--lang`이 없음을 재확인했다. 이 호스트의 수정 전 독립 실행은 두 셸 모두 96/96로 Chrome이 같은 UI 언어를 골라 직접 실패를 재현하지 못했으나, 이는 환경 선택이 우연히 같았을 뿐 명시 계약이 없는 결함을 반박하지 않는다. 수정 후 실 PNG에서 KO는 `파일 선택/선택된 파일 없음`, EN은 `Choose File/No file chosen`으로 분리됨을 확인했다.
- **고정 방식·선택 근거**: 캡처를 manifest locale별로 묶고 각 묶음 전용 Chrome을 `--lang=ko-KR`/`--lang=en-US`로 실행한다. 자식 브라우저의 셸 locale은 `LANG=C.UTF-8`·`LC_ALL=C.UTF-8`로 중립화하고 `LANGUAGE`, HTTP `Accept-Language`, CDP `Emulation.setLocaleOverride`를 같은 locale로 일치시킨 뒤 `navigator.language`를 런타임 단언한다. 151장 장기 실행의 상태 누적을 제한하려고 같은 locale 안에서 12장마다 브라우저를 재생성하되 locale을 섞지 않는다. 이미 점유된 preview 포트를 다른 서버로 오인하는 경합은 자식 Vite가 자기 주소를 출력한 뒤에만 ready로 인정하도록 막았다.
- **나머지 환경 계약**: timezone은 브라우저 env·Puppeteer emulation 모두 `UTC`로 고정하고 런타임 단언한다. DPR은 viewport와 Chrome flag 모두 1, font는 저장소 고정 Noto CJK Sans 2.004 OTF를 테스트 전용 `@font-face`로 강제하고 로드 완료를 단언하며 font hinting/LCD text 차이도 끈다. animation·transition·smooth scroll·caret를 끄고 font 완료 뒤 200ms+2 RAF paint settle을 둔다. 오디오 상호작용은 작업 성공 상태와 WaveSurfer shadow canvas의 유효 크기까지 기다려 비동기 paint 누락을 제거했다.
- **scenario 규모·축약**: `visual-regression.scenarios.mjs`는 필수 필드와 축약 사유를 가진 **59 scenario/151 capture**다. 구성은 홈·도구 목록을 포함한 initial 22, 등록 도구 20개의 mobile bottom 20, toggle/select가 있는 도구 interaction 16, HWP English redirect 1이다. 상호작용 N/A 4개 도구에는 사유를 명시했다. 파일명은 `routeId__stateId__locale__theme__viewport.png`라 상태 간 덮어쓰기가 없다. HWP KO mobile bottom은 1개 도구 통과로 세고, English 2 profile의 `/en/tools` redirect는 별도 기록해 하단 통과에 포함하지 않는다.
- **하단 공용 계약·음성 대조**: `assertMobileBottomLayout`으로 bottom distance ≤1px, main padding ≥ bottom-tabs 높이, footer 또는 명시 bottom target의 탭 상단+1px 이하, horizontal overflow ≤1px를 전 도구 bottom scenario와 Excel 비교 스모크에 공용 적용했고 모든 screenshot은 `captureBeyondViewport:false`다. 의도적으로 `.main-content` padding을 0으로 만든 음성 대조는 `0 < 62px`와 footer `844.34375 > 773px`를 함께 검출해 실패했다. style 제거 뒤 bottom distance 0, padding 80px, tabs 62px, footer 764.34375px ≤ tabs top 773px, overflow 0으로 통과했다.
- **기준선·육안 검수**: locale·scenario·브라우저 수명주기·paint 완료 조건을 모두 적용한 Chrome 152.0.7977.64 기준선을 전면 재생성했다. **96장/16,635,920B → 151장/21,823,497B**, +55장/+5,187,577B(+31.18%)다. EN/KO data-converter native file label, 모바일 최하단 FAQ/footer와 tabs 간격, document toggle, audio waveform/loop, video GIF, QR bulk 등 대표 화면을 직접 열어 lazy 잔상·겹침·잘림이 없음을 확인했다.
- **검증·제품 영향**: 최종 `LANG=ko_KR.UTF-8`는 **151/151**(5:16.32), `LANG=en_US.UTF-8`는 **151/151**(5:14.96)으로 같은 기준선과 일치했다. `npm run build` exit 0(2,827 modules·정적 61페이지), unit **182/182**, static, 공용 하단 음성 대조, Excel 비교 모바일 스모크, 문법 검사와 `git diff --check`가 통과했다. 빌드의 기존 vm-browserify eval·500kB chunk 경고 외 신규 오류는 없다. 변경은 테스트 하네스·기준선·기록에 한정돼 사용자 ko/en 문구·SEO/정적 route·AdSense 격리·GitHub Pages 런타임은 불변이다.

### U3 QR 일괄 생성 — 구현 완료·3자 검수 대기 (Codx)

- **게이트·범위**: fetch 뒤 `HEAD=origin/ui-migration=4a8405c7458ca72e454326e798592330478c67e4`, `main=origin/main=311c59e310734e9206629b05752f4228e842dbf0`, merge-base=`311c59e`, `origin/main...HEAD=0 9`를 확인하고 `ui-migration`에서만 작업했다. U3 신규 표면은 기존 shadcn adapter와 Tailwind만 사용해 legacy class 방출을 0으로 유지했다. 기존 adapter로 필요한 Button·Card·입력 표면을 모두 표현할 수 있어 사용하지 않을 새 shadcn component 추가는 기각했다. 기존 단일 생성·스캔 표면의 P2 전면 이관은 후속 B4 범위로 보존했다.
- **QR·표·출력 경계**: jsQR 순수 디코더를 기존 스캔 worker와 bulk worker가 공유하고 래스터 경로는 `QRCode.create`+OffscreenCanvas로 분리했다. bulk는 4모듈 기본 여백, 로고 한 변 22%·H 강제·최소 2모듈, 투명 PNG 흰 배경 합성 뒤 최종 read-back을 적용한다. C1 전체 파싱 뒤 열 번호와 `displayValue`/`sourceRow`로 행별 처리하고 중복·미존재 템플릿 참조를 실행 전에 거부한다. C2에는 segment·NFC·case-fold 충돌을 막는 `SafeZipEntryPath`, C3에는 기존 배열 API를 보존한 add/close/discard 증분 writer를 병설했다.
- **R4 실측·채택**: 저장소 `rhwp-studio` WOFF2는 **562,220B**, SHA-256 `d1bf8649914a4fe9477a8735bf056383e44e466141fb3d61897252e06d900c1a`였다. fontkit가 embed/save까지는 받아들였으나 Poppler가 embedded font invalid로 판정했고 subset/full 모두 동일한 빈 **1,247B PNG**가 되어 재사용을 기각했다. 고정 Noto CJK Sans 2.004 OTF(**4,644,748B**, SHA-256 `69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68`)와 OFL(**4,301B**, SHA-256 `6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2`)를 생성 스크립트로 공급한다. 같은 OTF의 `subset:true` PDF **37,116B**는 한글이 tofu/누락됐고 full PDF **3,833,195B**는 정상이라 subset 버그를 재현했으며 `subset:false`를 채택했다. 실브라우저 25라벨은 **2페이지·4,102,716B**로 정상 출력됐다.
- **페이로드·예산 판정**: 텍스트 원문, mailto UTF-8 percent-encoding, tel, 개행·콜론 보존 SMSTO, 특수문자 escape WIFI, CRLF vCard 3.0, http/https URL의 7종을 실제 worker 생성→jsQR 재판독으로 대조했다. 한글·백슬래시·쉼표·세미콜론·콜론·따옴표·개행 표본은 고정 문자열 골든으로 두었다. 입력 50MB·선택 시트 200만 셀·행 5,000·라벨 2,400·예상 출력 200MB 경고/500MB 거부를 적용했고, 1,000행 초과에는 72ms/행 추정 시간을 표시한다. OPFS quota가 예상 출력보다 작으면 실행 전 거부하며 OPFS 미지원은 1,000행 memory Blob 경로로 제한한다.
- **현지화·정적·개인정보**: `/tools/qr-studio/bulk`의 ko/en canonical·FAQ·정적 페이지·사이트맵·소셜 이미지를 추가하고 기존 QR 카드만 갱신했다. QR·표·결과는 브라우저 안에서 처리한다. `VITE_LOCAL_QA=1` 추적·광고 제외 빌드에서 동의를 granted로 둔 Chrome 152가 빈/결과 ko/en×light/dark×desktop/mobile **16장**을 캡처하는 동안 외부 요청 시도 **0**이었다. 증거는 `tests/visual-artifacts/qr-bulk-r1/`에 고정했다.
- **번들·검증**: 일반 production entry는 **936,132B/293,472B gzip**으로 U3 직전 289,568B 대비 **+3,904B gzip**(P2 +20KB 이내), CSS는 **286,693B/49,294B gzip**으로 직전 49,015B 대비 **+279B gzip**(P2 +10KB 이내)이다. `npm run build`(2,827 modules·정적 61페이지), unit **182/182**, QR bulk 실브라우저(취소/정리/재실행·7종·투명/로고·ZIP 2개·manifest 2시트·25라벨/2페이지·외부 요청 0), visual **96/96**, static, utilities, Excel 비교, Excel 정리, UI migration(7 switches·190px·tracking 0)을 모두 통과했다.

### shadcn 브랜치 재적용·legacy 충돌 교정 — Gemini 검수 대기 (Codx)

- **실행 게이트·브랜치 격리**: `main`과 `origin/main`이 모두 라이브 복구 기준 `311c59e310734e9206629b05752f4228e842dbf0`임을 확인하고 그 지점에서 신규 `ui-migration`을 만들었다. 열린 계획서의 배포 방식 정정과 충돌하는 지시는 없었다. 복구 대상은 P0a `c43e1a7` → P0b `df8e85c` → P1a `fdfb6c3` → P1b `d998afa` → polish `00bd3fd` → P1c `415e35b` 순서로 각각 revert-of-revert 커밋 `72632c9` → `932c5eb` → `4804a45` → `7ba78b0` → `c3b2acd` → `f866bed`로 재적용했다. `main`에는 커밋·push하지 않으며 사용자 MP4 3개와 DOCX 2개는 읽기·수정·스테이징에서 제외했다.
- **사고 기전·교정**: shadcn adapter가 구조와 Tailwind utility를 바꾼 뒤에도 legacy component class를 함께 내보내면서 두 규칙 체계가 한 DOM에 중첩된 것이 원인이었다. 특히 `.ios-switch`의 기존 track/thumb 규칙이 Base UI `Switch`를 다시 변형해 썸의 트랙 이탈·하단 처짐을 만들었고, `.tool-action-bar .primary-button { width:190px }`와 adapter의 `w-full` 조합이 버튼 팽창과 옆 설명의 세로 낙하를 만들었다. 전환 컴포넌트는 `ui-*`와 `data-ui-component`/`data-ui-part` 소유권으로 분리하고, PrimaryButton의 `w-full`을 제거해 action bar가 190px 계약을 단독 소유하게 했다. 전역 form reset은 최초 `button:not([data-slot])`가 specificity를 올려 raw Excel sheet chip radius를 덮는 반례가 있어 기각하고 `button:where(:not([data-slot]))`로 낮췄다.
- **legacy 전수 범위**: TypeScript AST 검사가 PageHeader·SectionCard·SegmentedControl·ToggleRow·FileDropZone·FileList·PrimaryButton·ResultCard 8종과 ToolGuide·OperationProgress·ToolCard·LanguageSwitcher 4종, 총 12종의 6개 소스에서 52개 exact legacy token과 3개 동적 prefix를 검사하며 adapter DOM 교집합 **0건**을 단언한다. PostCSS AST 기준 CSS 전체는 재적용 직후 2,122 rules/7,766 declarations, 교정 후 2,132/7,788이다. 52개 legacy token이 들어간 unique selector rule은 **281→143, 138개 제거**됐고 남은 143개는 Word 비교 결과·pair drop zone 등 실제 raw legacy DOM 전용이다. 컴포넌트군별 재적용 직후 매칭 규칙 수는 PageHeader 9, SectionCard 21, SegmentedControl 36, ToggleRow 23, FileDropZone 34, FileList 20, PrimaryButton 29, ResultCard 18, ToolGuide 34, OperationProgress 45, ToolCard 35, LanguageSwitcher 41이며 복합 selector 중복 때문에 합은 unique 281과 다르다.
- **문서 비교 증상 부재 단언**: 추적 제외 production QA build의 1365×900 실브라우저에서 7개 Switch 전부 track **43×25px**, thumb **21×21px**, 좌우 inset **2/20px**, 수직 중심 오차 **0px**로 측정되어 트랙 이탈·하단 처짐이 없다. action button은 **190×48px**, 옆 copy/strong/small은 모두 `writing-mode:horizontal-tb`, copy 폭 **316.375px**, page overflow **0px**라 버튼 팽창·텍스트 세로 낙하가 없다. 계산 스타일 JSON과 해당 영역 PNG를 함께 고정했다.
- **배포 전 로컬 시각 검수**: `VITE_LOCAL_QA=1`에서 Google·Naver·AdSense script/event를 opt-in으로 차단하고 동의를 `granted`로 둔 브라우저에서도 각 추적 수와 외부 요청은 모두 **0**이었다. registry AST가 찾은 가용 도구 20개를 ko-light-desktop·ko-dark-mobile·en-light-mobile·en-dark-desktop 4조합으로 캡처한 80장과 home/tools의 ko/en×light/dark×desktop/mobile 16장, 총 **96개 기준선**을 Chrome 152로 전수 비교하고 4개 contact sheet와 문서 비교 전용 2장을 Codx가 직접 열어 보았다. 레이아웃 파손·정렬 쏠림·문구 잘림·수평 overflow·비정상 버튼 확장·스위치 내부 오정렬은 보이지 않았다. HWP editor의 English URL이 정책상 All Tools로 redirect되는 것은 기대 동작으로 판정했다. 최종 증거 `tests/visual-artifacts/branch-qa-r1/`은 전 도구 80장+문서 비교 전용 2장+계산 JSON, 총 **82 PNG/83파일**이다.
- **결정성·시각 하네스 판정**: Security Tools의 무작위 비밀번호 때문에 동일 코드도 기준선이 달라지는 경로는 제품 동작 변경 없이 QA 페이지에 고정값을 주입해 안정화했다. 기준선 갱신은 명시 플래그에서만 가능하고 누락·잉여 baseline도 실패한다. 최종 `npm run test:visual`은 **96/96**, pixel threshold 0.100% 이내로 일치했다.
- **번들 예산**: 최종 일반 production build의 CSS `index-GjN0JepF.css`는 284,837B/**49,015B gzip**, P1c 48,261B 대비 **+754B**(한도 +10KB)다. entry JS `index-DkLkJJ-v.js`는 919,989B/**289,568B gzip**, P1c 289,140B 대비 **+428B**(한도 +50KB)로 둘 다 통과했다. QA 빌드는 tracking compile-out 때문에 entry gzip 288,590B로 더 작으며 예산 판정에는 일반 build를 사용했다.
- **완료 검증**: 최종 `npm run build` exit 0(2,630 modules·정적 59페이지), `npm run test:unit` **174/174**, `npm run test:static`, `npm run test:ui-migration`(Switch 7개·action 190px·horizontal copy·tracking 0), `npm run test:visual` **96/96**, production preview의 `test:browser`·`test:office`·`test:xls-preserve`·`test:xls-first-load`·`test:excel-compare`·`test:excel-cleaner`·`test:utilities`·`test:video-hybrid`·`test:new-tools`, `git diff --check`가 모두 exit 0이었다. 사용자 문구·ko/en 리소스·SEO/정적 route·AdSense 배치/격리·GitHub Pages 서버리스 계약은 변경하지 않았다. 구현·Codx 로컬 육안 검수는 완료됐으며 브랜치 상태는 **Gemini 전수 검수 대기**다.

### RHWP 0.8.6 업그레이드 — 벤더 무결성·왕복 저장·로컬 QA 판정 (Codx)

- **실행 게이트·설치 판정**: 다른 작업이 사용하는 기본 워킹트리는 건드리지 않고 `/tmp/worklazytools-rhwp-0.8.6`에 `8d91b6221b75d5326d90e2a5e5ccf1acfbd19f87` 기준 별도 `rhwp-0.8.6` 브랜치를 만들었다. `npm install` 뒤 package manifest·lock의 루트/설치 블록·실제 `node_modules`·`npm ls`에서 `@rhwp/core`와 `@rhwp/editor`가 모두 정확히 0.8.6임을 확인한 뒤에만 벤더링했다. `modern-tar` 0.8.4는 지시 범위 밖이라 그대로 유지했다.
- **상류 소스·플래그 판정**: GitHub `v0.8.6` 태그와 clone HEAD가 모두 `f1f9c6ae58344ee9368996d3543f76b9345cf227`임을 확인했다. 같은 clone·의존성에서 `RHWP_WITHOUT_HWPCTRL=0`은 payload 78개·60,735,019B이고 54,385B `studio-plugin` chunk를 포함했다. `RHWP_WITHOUT_HWPCTRL=1`은 payload 77개·60,680,448B로 1개·54,571B 감소했고 Studio 단독 사용에 불필요한 플러그인 chunk가 사라져 채택했다. 외부 웹폰트 비활성 플래그는 유지했다.
- **스냅샷·manifest 판정**: 최종 payload는 77개·60,680,448B, manifest 포함 전체는 78개·60,692,284B다. manifest는 11,836B, SHA-256 `a559f14562af337834843d3f9e207f93005faaa205a948e6110537f0acfc3440`이며 각 파일의 bytes와 SHA-256을 기록한다. validator는 실제 재귀 파일 집합과 manifest 집합의 완전 일치, 개별 bytes/hash, 설치 패키지 버전, 설정 플래그를 검사한다. 두 빌드 모두 생성된 PWA 파일 4개를 재귀 규칙으로 제거했고 최종 `workbox-*`·`registerSW.js`·`sw.js`·`manifest.webmanifest` 잔존은 0건이었다.
- **생성·정리 판정**: root notices와 공개 라이선스 2종은 동일 생성기가 lock의 실제 버전을 읽어 재생성하며 정적 검사가 core/editor 0.8.6 표기를 각각 고정한다. 구 0.8.4 벤더 스냅샷은 현재 버전 보호와 명시 allowlist가 있는 전용 스크립트로만 제거했다. 생성기 첫 실행은 새 worktree에 ZetaOffice·Twemoji 선행 라이선스가 없어 실패했고 각 공식 벤더 스크립트를 실행한 뒤 독립 재실행과 prebuild 재실행이 통과했다. 기본 npm cache의 읽기 전용 `EROFS`는 `/tmp` cache 지정으로 해소했다.
- **HWP 왕복 판정**: test-only 필터를 fixture 생성보다 앞으로 옮겨 HWP 단독 실행에서 미디어 fixture를 만들지 않게 했다. 고정 3,584B fixture(SHA-256 `35c590e316c18e7310bb7b2f954b87d32f1d45416179466aee2bebb99d7e706f`)를 Studio에서 열고 canvas에 sentinel을 편집한 뒤 제품의 `HWP 저장`으로 받은 Blob을 `@rhwp/core` 0.8.6으로 재파싱했다. sentinel·1페이지·section/paragraph 구조를 확인하고 같은 Blob을 Studio에 다시 열어 파일명과 1페이지를 확인했다. 0.8.6은 기존 load/export와 JSON 봉투 계약으로 통과해 제품 통합 API 변경은 불필요하다고 판정했다.
- **검증 판정**: `npm run prebuild` exit 0(77개·60,680,448B), `npm run build` exit 0(2,431 modules·정적 59페이지), `npm run test:unit` 158/158, `TEST_ONLY_HWP=1 npm run test:new-tools` exit 0(3,584B·1페이지·sentinel 파싱·Studio 재개방), `npm run test:office` exit 0(96 download states·7 cached states·5,089B DOCX), `npm run test:static` exit 0, `npm run test:visual` 24/24(Chrome 152.0.7977.64·diff ≤0.100%)였다. 4173 포트가 다른 작업에 점유돼 제품 preview는 4175에서 기동하고 두 브라우저 스모크에만 `TEST_BASE_URL`을 지정했다. 구 snapshot 제거 뒤 최종 build와 validator도 재통과했고 구 벤더 URL 참조 grep 및 PWA 잔존은 각각 0건이었다.
- **로컬 QA 판정**: UI migration 커밋을 가져오지 않고 `VITE_LOCAL_QA=1` 플래그와 Analytics·AdSense 두 로더 차단만 독립 변경으로 구현했다. 해당 환경의 production build는 2,431 modules·정적 59페이지로 통과했고 HWP 경로에서 동의 후 Google·Naver·AdSense script와 관련 네트워크 요청이 모두 0임을 확인했다. 이번 범위는 검수 준비까지이며 사람의 로컬 시각 판정은 후속 단계로 남긴다.
- **Codex 브라우저 검수·병합 보류 판정**: `VITE_LOCAL_QA=1 npm run build` 후 4903 preview를 Chrome 152에서 1440×900·390×844로 직접 조작했다. 고정 3,584B fixture를 열어 `WL_CODEX_UI_QA_086`을 입력하고 제품 `HWP 저장`으로 3,584B 파일(SHA-256 `c2b44d74e7193db6860fb72976edd300147b668585f3cb537de59c184e4c3764`)을 실제 다운로드했으며 core 재파싱에서 sentinel·1페이지·1 section·1 paragraph를 확인했다. Studio 파일 메뉴의 HTML·Word 내보내기와 표 메뉴는 잘림 없이 렌더됐고, 모바일은 host/iframe 수평 overflow 0px·하단 네비게이션 비가림·최하단 쪽 맞춤 조작부 노출을 통과했다. 요청 23건은 local origin 17건과 data URL 6건뿐이라 GA·Naver·AdSense 요청은 0건이었다. 그러나 데스크톱 언어 전환기(z-index 45)가 HWPX 678.82px²와 HML 2,124.68px²를 덮어 HML 조작부가 사실상 가려졌고, fixture open 단계에서 Studio 콘솔 오류 `[CanvasView] 페이지 0 정보가 없습니다` 1건(경고·pageerror·request failure 0)이 재현됐다. 증거는 `/tmp/rhwp-qa-shots-codex/qa-result.json`, `console.json`, `network-requests.json`과 PNG 8장에 보존했다. 차단 결함 0 게이트를 충족하지 못해 main 병합·push·Pages·라이브 검증·worktree 정리를 모두 보류한다.

### RHWP 0.8.4 ↔ 0.8.6 차단 결함 A/B 판정 (Codx)

동일한 1440×900·DPR 1 Chrome 152, 고정 3,584B fixture(SHA-256 `35c590e316c18e7310bb7b2f954b87d32f1d45416179466aee2bebb99d7e706f`), `VITE_LOCAL_QA=1 npm run build`와 별도 preview(0.8.4 `4926`, 0.8.6 `4927`) 조건으로 두 차례 반복했다.

| 비교군 | 언어 전환기 ↔ HWPX | 언어 전환기 ↔ HML | `[CanvasView] 페이지 0 정보가 없습니다` |
|---|---:|---:|---|
| main `6d08c97` · RHWP 0.8.4 | 678.73px² | 2,124.77px² | 미발생, 0건(2/2회) |
| `rhwp-0.8.6` `9e2fa06` · RHWP 0.8.6 | 678.73px² | 2,124.77px² | 발생, fixture open에서 1~2건(2/2회; +263/+279ms, 반복 +300ms) |

- **겹침 판정**: 언어 전환기 rect `(1321,22)–(1416,64)`, HWPX/HML 버튼 rect까지 양쪽 버전이 동일했다. 기존 host UI 결함이며 0.8.6에서 면적 악화가 없어 RHWP 회귀가 아니다.
- **콘솔 회귀·원인**: 0.8.4에는 없고 0.8.6에서만 재현돼 진짜 회귀다. 상류 `61baa678357f05a0a9c9d674255a1c06d58bf14f`(`#5617`)가 full Studio 시작의 `openBlankDocumentIfIdle()`와 파일 열기 전 `canvasView.showBlankPage()`를 추가했다. `showBlankPage()`는 `pages=[]`로 비우지만 VirtualScroll의 이전 page 0 치수를 남겨 전환 중 viewport 갱신이 stale page 0을 렌더한다. ready 후 1초 지연 대조에서도 1건이 남아 이 전환 결함을 확인했고, 즉시 열기에서는 시작 빈 문서 초기화까지 겹쳐 1~2건으로 변동했다.
- **수정 방향·기각**: 상류에서 `showBlankPage()`/`reset()` 시 VirtualScroll page dimensions를 함께 비우거나 `updateVisiblePages()`가 `pages.length === 0`이면 렌더를 건너뛰고, RPC `ready()`가 시작 빈 문서 promise까지 기다리거나 문서 수명주기를 직렬화해야 한다. Worklazy에서 `?chrome=embed`를 붙이면 해당 경로를 우회하지만 파일 메뉴의 HTML·Word 내보내기·인쇄 등도 제거하므로 현 제품 계약의 수정안으로는 기각했다. 공식 벤더 스냅샷을 수기 패치하지 않는다.
- **최종 판정**: 두 결함 중 콘솔 오류가 0.8.6 전용 회귀이므로 main 병합·push·Pages 배포·라이브 확인을 금지하고 `rhwp-0.8.6` worktree를 보존한다. 증거는 `/tmp/rhwp-ab-20260904/`, `/tmp/rhwp-ab-20260904-r2/`, `/tmp/rhwp-ab-20260904-delayed/`에 있다. 두 버전 QA 빌드는 각각 exit 0(0.8.4 2,429 modules, 0.8.6 2,431 modules)이었다.

### 네이버 SEO — 루트 랜딩 가치 전달 문구 개선 (Codx)

- **변경 사유·문구 판정**: 사용자 결정에 따라 언어 선택 안내에 그치던 루트 메타를 사이트가 제공하는 작업 가치를 드러내는 한·영 병기 제목과 설명으로 교체했다. 정적 호스팅에서는 방문자 언어별 메타 응답을 제공할 수 없어 한 문장 안에 두 언어를 병기했다.
- **범위 판정**: 기본 소셜 이미지 `worklazy-tools-share.png`는 한·영 병기 자산이 없어 그대로 유지했다. Open Graph·Twitter 태그 구성과 순서, URL·locale, 화면의 `seo-static-fallback` 언어 선택 본문은 변경하지 않았다.
- **산출물·검증 실측**: `dist/index.html`의 title·description·og:title·og:description·twitter:title·twitter:description은 각각 정확히 1개였고 확정 문구와 일치했다. 제목은 48 code points·UTF-8 69B, 설명은 69 code points·UTF-8 110B였다. `npm run build` exit 0(2,429 modules·Vite 56.93초·정적 59페이지), `npm run test:static` exit 0, `npm run test:unit` exit 0(158/158), `git diff --check` exit 0이었다.

### 네이버 SEO — 루트 언어 선택 랜딩 메타 보강 (Codx)

- **진단·문구 실측**: 배포 기준 루트 description은 85 code points·UTF-8 123B이고 Open Graph·Twitter 태그는 0개였다. 확정 문구 `Choose English or Korean. 무료 업무 도구의 언어를 선택하세요.`로 교체한 빌드 결과는 description 정확히 1개·46 code points·76B였다.
- **소셜 메타 판정**: 기존 `getSocialImageDefinition("en", "/")`를 재사용해 기본 이미지 `https://worklazy.net/social/worklazy-tools-share.png`(1200×630 PNG·199,195B)를 절대 URL로 생성했다. 정본의 순서대로 canonical, ko/en/x-default, 나열된 Open Graph 전 항목과 Twitter 5종을 배치했다. “OG 12종” 표제와 달리 확정 목록은 `og:locale:alternate`와 `og:image:alt`를 포함해 실제 13태그이므로, 목록 우선 계약에 따라 13개 모두 각각 1개로 생성·검증했다.
- **중복·범위 판정**: `dist/index.html`에서 title·canonical·hreflang 3종·Open Graph 13개·Twitter 5개는 모두 각각 1개였고 나열 순서는 단조 증가했다. 루트 `worklazy-route-jsonld`는 0개를 유지했으며 `src/app/seo.ts`, 언어/도구 페이지, 사이트맵, 광고·격리 경로는 수정하지 않았다. 메타 전용 변경이라 화면 배치와 ko/en 런타임 문구에는 영향이 없다.
- **검증 실측**: `npm run build` exit 0(2,429 modules·Vite 57.48초·정적 59페이지), `npm run test:static` exit 0, `npm run test:unit` exit 0(158/158), `git diff --check` exit 0이었다.

### RHWP 0.8.6 CanvasView 콘솔 회귀 — 화면·기능 영향 판정 (Codx)

- **관찰 조건·증거**: 기본 워킹트리는 건드리지 않고 보존된 0.8.4 `/tmp/worklazytools-rhwp-0.8.4`와 0.8.6 `/tmp/worklazytools-rhwp-0.8.6`의 기존 QA 산출물을 Chrome 152.0.7977.64, 1440×900·DPR 1에서 비교했다. 정상 속도 20fps 연속 캡처는 `/tmp/rhwp-visual-impact-20260904/0.8.4/transition-normal-{00-pre,01..23}.jpg`와 `/tmp/rhwp-visual-impact-20260904/0.8.6/transition-normal-{00-pre,01..25}.jpg`, 6배 CPU 지연 재현은 양 디렉터리의 `transition-stretched-*`(0.8.4 `00-pre,01..29`; 0.8.6 `00-pre,01..28`)다. 각 버전에서 +200ms 부근부터 10장 연속 구간을 포함한다. 정상 속도 0.8.6에서는 오류가 +82.1ms로 앞당겨졌으나 +47.8/+99.1ms 인접 프레임과 +235.2/+279.1/+322.7ms 프레임이 모두 정상 로딩 화면이었다. 6배 지연에서는 오류 +391.4ms와 가장 가까운 `transition-stretched-08.jpg`(+391.0ms)를 확보했고 +203.6~+635.9ms 10장 연속 프레임에서도 깨진 화면·빈 화면·이전 페이지 노출은 없었다. 0.8.4 대조군의 +204.4~+651.1ms 10장도 동일하게 정상 로딩 화면이며 대상 오류는 0건이었다.
- **오류 순간 DOM·가시성**: 0.8.6 지연 재현의 오류 시점(+386~387ms 표본)에서 host editor shell은 `(x=369,y=1119.16,w=982,h=702)`, iframe은 `(370,1120.16,980,700)`이고 CSS는 `display:block; visibility:visible; opacity:1`이지만 900px viewport와 교차하지 않았다. iframe 안 `#scroll-content`는 `980×1353.08px`, 자식 1개로 stale 높이가 남았고 scroll container/editor area는 각각 `960×538px`/`980×558px`였으나, 페이지 canvas는 0개(전체 비페이지 canvas 2개)였다. 새 페이지 canvas `941×1330px`, `display:block; visibility:visible; opacity:1`은 약 +994ms에 복구됐고 host가 iframe을 화면에 올린 것은 +1244ms 이후여서 빈 페이지 canvas가 사용자에게 노출될 시간 순서가 없었다. 정상 속도에서도 canvas 복구(+458ms)가 host 노출(+650ms)보다 먼저였다. 0.8.4 대응 전환(+281ms)은 페이지 canvas 0개·`#scroll-content 980×0px`·자식 0개이고 마찬가지로 iframe이 viewport 밖이었으며 오류는 없었다. 두 버전 모두 최초 노출 직후 쪽 맞춤 폭을 한 프레임 조정했지만 동일한 기존 동작이고 페이지 소실은 아니었다.
- **판정**: `화면 영향 없음(콘솔 노이즈)`. 0.8.6 내부에는 `pages=[]` 중 VirtualScroll 높이가 남는 DOM 불일치와 `[CanvasView] 페이지 0 정보가 없습니다`가 실제로 존재하지만, Worklazy host의 로딩 화면 뒤에서 끝나며 관찰한 모든 프레임에서 사용자 가시 결함은 없었다. 이 판정은 언어 전환기 겹침을 기존 공통 결함으로 제외한 결과다.
- **기능 영향**: 오류 뒤 0.8.6 고정 fixture는 1페이지와 page canvas 1개(`941×1330px`)로 정상 표시됐다. canvas에 `WL_VISUAL_IMPACT_0_8_6`을 입력하고 제품 저장으로 받은 3,584B Blob을 core로 재파싱해 sentinel·1페이지·1 section·1 paragraph를 확인했으며, 같은 Blob을 `qa-roundtrip-reopened.hwp`로 재개방해 sentinel 표시를 확인했다(`/tmp/rhwp-visual-impact-20260904/0.8.6/functional-roundtrip-reopened.png`). 같은 원본 fixture 3회 연속 열기는 859.6/755.2/752.3ms, 매회 page canvas 1개·`#scroll-content` 자식 3개·DOM counters Nodes 7,228/Documents 10/Frames 10으로 일정했고, 강제 GC 뒤 JS heap은 7,662,280B→7,828,476B(+166,196B, +2.17%)로 작은 변동만 있어 누적 악화가 관찰되지 않았다. 최종 화면은 `functional-repeat-3-final.png`다.
- **빈 문서 경로**: 파일을 열지 않은 시작에서 대상 콘솔 오류는 양 버전 모두 0건이었다. 0.8.6은 page canvas 1개 `941×1330px`, `#scroll-content 1460×1353.08px`·자식 3개의 정상 빈 1페이지를 표시했고(`/tmp/rhwp-visual-impact-20260904/0.8.6/blank-editor-shell.png`), 0.8.4는 page canvas 0개·`#scroll-content 980×0px`의 파일 선택 대기 화면이었다(`/tmp/rhwp-visual-impact-20260904/0.8.4/blank-editor-shell.png`). 어느 쪽에도 화면 이상은 없었다.
- **상류 보고 결론**: 원인 후보는 기존 A/B에서 확정한 `61baa678357f05a0a9c9d674255a1c06d58bf14f`(`#5617`)의 `showBlankPage()`와 VirtualScroll 상태 불일치다. 기대 동작은 `pages=[]` 전환 중 stale page 0 갱신을 시도하지 않아 콘솔 오류가 없는 것이고, 실제 동작은 파일 열기 중 오류가 1건 발생하되 이 통합에서는 host 로딩 상태 뒤에 가려지고 표시·편집·저장 왕복에는 영향이 없는 것이다. 벤더·제품 코드는 수정하지 않았고 merge·push도 수행하지 않았다.

### RHWP 0.8.6 배포 승인 — main 통합·재검증 판정 (Codx)

- **차단 해제 판정**: 후속 시각 검수에서 대상 콘솔 오류가 Worklazy 로딩 화면 뒤에서만 발생하고 새 page canvas가 host 노출 전에 복구되며, 표시·편집·저장 왕복·재개방·3회 반복 열기가 모두 정상임을 확인했다. 사용자가 이 영향 범위를 확인하고 배포를 승인해 앞선 임시 배포 금지를 해제했다. 언어 전환기 겹침은 0.8.4와 면적·좌표가 같은 기존 UI 항목이므로 이번 RHWP 배포 범위에서 제외한다.
- **main 통합 판정**: 원격 `main` `6d08c973aab49ee7e76be9dcd7b7d13269a80ad4`를 `rhwp-0.8.6`에 `--no-ff`로 병합한 커밋은 `740d797448df43ac0bc8b7f5554d0c5138ee411f`다. 충돌은 같은 날짜에 양쪽이 추가한 `CHANGELOG.md`·`docs/review-notes.md` 두 파일뿐이었고, RHWP 기록과 main의 루트 SEO·네이버 소유 확인 기록을 모두 보존했다. 정적 페이지 생성기와 검증기는 자동 병합됐으며 RHWP 벤더 검증과 새 루트 메타 검증을 함께 유지했다.
- **병합 후 재검증**: `npm run prebuild` exit 0(0.8.6 벤더 77개·60,680,448B), `npm run build` exit 0(2,431 modules·정적 59페이지), `npm run test:unit` 158/158, `TEST_BASE_URL=http://127.0.0.1:4936 TEST_ONLY_HWP=1 npm run test:new-tools` exit 0(3,584B·1페이지·sentinel 재파싱·Studio 재개방), 같은 preview의 `npm run test:office` exit 0(96 download states·7 cached states·5,089B DOCX), `npm run test:static` exit 0이었다. HWP 스모크에서 알려진 CanvasView 로그 2건은 재현됐지만 사용자 결과 계약은 모두 통과했다.
- **배포 게이트 판정**: 검증 실패 0건으로 main push와 Pages·라이브 확인을 진행할 수 있다. 공식 0.8.6 벤더 스냅샷은 수정하지 않고, 제출 전용 상류 재현 자료만 오프라인 작업 문서로 분리한다.

## 2026-09-03

### shadcn 마이그레이션 라이브 UI 복구 — 6개 revert 판정 (Codx)

- **파손·복구 범위 판정**: 라이브 문서 비교 화면에서 스위치가 얼룩처럼 렌더되고 문서 쌍 영역 텍스트가 세로로 낙하한 현상은 사용자 실측으로 확정됐다. 신규 Excel 비교 U1·Excel 정리 U2와 테스트 전용 P-V(`10a4b72`)는 유지하고, P1c `415e35b` → P1-polish `00bd3fd` → P1b `d998afa` → P1a `fdfb6c3` → P0b `df8e85c` → P0a `c43e1a7` 순서로 revert했다. 6건 모두 충돌 없이 적용되어 수동 충돌 해소는 없었다.
- **트리·의존성 판정**: revert 뒤 `git diff --exit-code 10a4b72 HEAD --`와 `git diff dac13bb HEAD -- src/`는 모두 출력 없이 exit 0이었다. 따라서 `src/` 잔차는 tests 제외나 U1/U2 예외를 적용하기 전부터 0이며, 실제 이력상 U2는 `dac13bb` 자체이고 U1은 그 이전이라 둘 다 보존됐다. package manifest/lock의 shadcn·Tailwind 참조는 0건이고 `components.json`·`src/lib/utils.ts`·`src/styles/tailwind.css`·`src/components/ui/`는 모두 제거됐다. `global.css`·`ui.tsx`·ToolGuide·OperationProgress·ToolCard·LanguageSwitcher·AppShell은 `dac13bb`와 일치했다.
- **P-V 시각 판정**: 기준선을 갱신하지 않은 `npm run test:visual`이 Chrome 152.0.7977.64에서 원본 24/24를 일치시켰다(per-pixel threshold 0.1, 전체 diff ≤0.100%, 기존 footer 허용 영역만 적용). 후속 마이그레이션이 재생성했던 기준선이 P-V 원본으로 복원됐다는 점과 전환 이전 UI 복구를 함께 증명한다.
- **문서 비교 실측**: production build 로컬 preview의 `/ko/tools/document-compare/`를 1440×1200에서 캡처한 `/tmp/worklazytools-live-recovery/document-compare-restored-ko-desktop.png`를 직접 확인했다. 스위치 7개는 모두 43×25px·`border-radius: 999px`의 캡슐형이며 21×21px 원형 노브가 정상 분리됐다. 수정 전/후 문서 영역은 각각 484px 너비로 나란히 놓였고 `writing-mode: horizontal-tb`·페이지 수평 overflow 0으로 텍스트 세로 낙하가 없었다.
- **추적 제외 로컬 검수**: dev build에서 개인정보 동의를 `granted`로 고정하고 `/tmp/worklazytools-live-recovery/document-compare-restored-ko-dev-no-tracking.png`를 추가 캡처해 같은 정상 배치를 직접 확인했다. Google·Naver 분석 script 0, AdSense script/slot 0, 외부 요청 0으로 로컬 검수 중 추적·광고 로더가 비활성임을 확인했다.
- **검증 판정**: `npm run build` exit 0(2,429 modules·정적 59페이지), `npm run test:unit` 158/158, `test:visual` 24/24, `test:excel-compare`, `test:excel-cleaner`, `test:utilities`, `test:static`, `test:office`, `test:xls-preserve`, `test:xls-first-load`, `test:new-tools`, `test:video-hybrid`가 모두 exit 0이었다. `test:browser`는 서버 미기동 1회와 Vite cold dependency optimize/reload(Excel·Word·PDF) 중단 뒤 모든 lazy dependency가 warm인 동일 전체 명령에서 Excel·Word·PDF 스모크가 exit 0으로 통과했다. 제품 URL·ko/en 문구·SEO·광고/격리·GitHub Pages 구조에는 전환 이전 상태 이외의 변경을 넣지 않았다.

### shadcn 마이그레이션 P1c — AppShell 소유권·광고 격리 보존 판정 (Codx)

- **실행 게이트·CLI 범위**: P1-polish push·fetch 뒤 `HEAD` = `origin/main` = `00bd3fd7223aea75fa4cefdec2cacd63ed3aa437`였고 열린 계획서에 P1c와 상반된 지시는 없었다. `npm_config_cache=/tmp/worklazytools-npm-cache npx --yes shadcn@4.20.1 add sheet --yes`만 실행해 `src/components/ui/sheet.tsx` 하나를 생성했으며, registry가 함께 확인한 `button.tsx`는 동일해 건너뛰었다. package manifest·lockfile과 다른 shadcn 컴포넌트에는 diff가 없다. 사용자 MP4 3개·DOCX 2개와 `dummyfortest/`·`.codex/`는 제외했다.
- **AppShell·포커스 소유권 판정**: 기존 수동 `keydown`/ref 포커스 트랩을 Base UI Sheet의 modal·portal·trigger/close 계약으로 교체했다. 실제 390×844 스모크에서 마지막 링크→Tab→닫기→Shift+Tab→마지막 링크 순환, Escape 종료, 종료 뒤 `mobile-navigation-trigger` 포커스 복귀를 단언했다. route 변경 닫힘과 820px 초과 전환 닫힘, sidebar·mobile header·bottom nav·footer 및 ko/en 문구는 유지했다. 21개 바로가기 목록은 시트 안 전용 `overflow-y:auto` 영역(가시 699px, 전체 KO 1,478px/EN 1,407px)으로 만들어 종전 하단 정렬에서 상단 항목이 화면 밖으로 밀리던 문제를 해소했다.
- **SEO·격리 redirect·로더 위치 판정**: source 계약 테스트가 `RouteSeo` → video/office/XLS 세 경계 → `AnalyticsLoader` → 조건부 `AdSenseLoader`의 렌더 순서를 고정하고, redirect 목적지 `/tools/video-studio/`·`/tools/office-editor/app/`·`/tools/excel-merger/xls-preserve/`를 단언한다. AdSense 조건은 active와 isolation-document 6상태를 모두 제외하는 기존 식 그대로다. `AdSenseLoader`는 계속 `null`을 반환하고 동의 뒤 async script를 `document.head`에만 붙이므로 AppShell layout node/광고 슬롯 이동은 없고 이번 변경의 loader 기인 CLS 영향은 0으로 판정했다.
- **광고 격리 회귀 증명**: 12개 공식 테스트 중 Office·XLS·new-tools 스모크와 정적 검사가 격리 경계를 통과했다. 별도 `granted` 동의 실브라우저 양성/음성 매트릭스에서 일반 Excel Cleaner는 AdSense DOM **1**·pagead 요청 **1**, video/office/XLS 격리 문서는 각각 isolation marker **true**·공통 nav **true**·AdSense DOM **0**·pagead 요청 **0**이었다. video는 기존 계약대로 분석 로더 1개를 유지하고 office/XLS는 0개였다. 실행 가능한 저장소 파일 전체 스캔은 `public/vendor/` 생성 벤더만 명시 제외하고 광고 문자열 소유 파일을 고정 allowlist와 대조해 통과했다. 최초 보조 매트릭스가 일반 페이지의 `crossOriginIsolated=false`까지 양성 조건으로 가정한 것은 origin-wide service worker 아래에서 일반 페이지가 광고 DOM/요청을 가지면서도 true일 수 있어 기각했고, route marker와 실제 광고 DOM/요청으로 고친 매트릭스가 통과했다.
- **시각·접근성 판정**: Chrome 152로 기존 24개 닫힌 상태 기준선을 재생성했으며 이전 PNG와 pixelmatch 차이는 전부 **0px**라 무의미한 인코딩 차이는 커밋하지 않았다. 열린 시트의 ko/en×light/dark before/after/diff 12장은 `tests/visual-artifacts/p1c/`에 고정했다. diff는 EN dark **31,325px/9.5166%**, EN light **33,825px/10.2762%**, KO dark **28,484px/8.6535%**, KO light **32,540px/9.8858%**다. 최초 light eyebrow 3.17:1은 AA 미달로 기각하고 보조 본문색으로 올렸다. 재측정 최소 대비는 light **5.45:1**, dark **5.62:1**, 시트 안정 rect는 좌우 10px·상하 약 10px, document/sheet 수평 overflow와 의도하지 않은 텍스트 잘림은 모두 **0**이었다. 일반 `test:visual`은 24/24(≤0.100%) 일치했다.
- **번들 예산·완료 검증**: CSS `index-D1a-8v2B.css`는 280,255B/**48,261B gzip** = polish 47,225B 대비 **+1,036B**(한도 +10KB), entry JS `index-BL-4egRy.js`는 918,640B/**289,140B gzip** = polish 271,292B 대비 **+17,848B**(한도 +50KB)로 통과했다. `npm run build` exit 0(2,629 modules·정적 59페이지), `test:unit` 170/170, `test:static`, `test:visual` 24/24, `test:browser`·`test:office`·`test:xls-preserve`·`test:xls-first-load`·`test:excel-compare`·`test:excel-cleaner`·`test:new-tools`·`test:video-hybrid`·`test:utilities`가 모두 exit 0이었다. Excel 비교 모바일도 content padding **80px** ≥ nav **62px**, footer 763.64px < nav 상단 773px와 overflow 0을 재확인했다.
### shadcn 마이그레이션 P1-polish — P1a 시각 검토 수용 3건 판정 (Codx)

- **실행 게이트·범위**: 착수 시 `HEAD` = `origin/main` = `d998afab3c6774f765e59cf6604d11129e5d0398`로 사용자 지시 기준 `d998afa`와 일치했다. 열린 계획서에 상반 지시는 없었고, 미추적 MP4 3개·DOCX 2개와 `dummyfortest/`·`.codex/`는 제외했다.
- **줄바꿈·radius 판정**: 지정 폭에서 `SpreadsheetML`/확장자를 쪼개던 `overflow-wrap:anywhere`는 실제 재현 시 단어 자체를 `Spread`/`sheetML`로 나누어 기각했다. 24자 이하의 짧은 구분 항목만 구분자를 앞 항목에 붙여 `wbr`로 나누고 항목 내부는 nowrap하는 공용 `DropZoneHint`를 채택했다. 화면·접근성 textContent는 기존 ko/en 문구와 동일하다. 점선 드롭존과 카드의 computed radius는 모두 **36.4px**로 일치했다.
- **모바일 하단 격리 판정**: 820px 이하 공통 `.main-content`의 하단 padding을 `80px + safe-area`로 고정했다. 390×844 실측에서 콘텐츠 padding **80px** ≥ 하단 nav **62px**, 최하단 footer **763.64px** < nav 상단 **773px**로 겹침이 없었다. 공용 브라우저 스모크의 기존 100ms smooth-scroll 가정은 길이가 달라지면 sticky 위치를 애니메이션 중간에 읽어 불안정했으므로 즉시 스크롤 계약으로 보정했다.
- **시각·번들 예산**: Chrome 152에서 24개 기준선을 갱신한 뒤 일반 `test:visual`이 24/24(≤0.100%) 일치했다. before/after/diff 12장은 `tests/visual-artifacts/p1-polish/`에 고정했다. 대표 diff는 KO light mobile **788px/0.2394%**, KO dark mobile **572px/0.1738%**, EN light desktop **478px/0.0389%**, EN dark desktop **12px/0.0010%**였다. CSS는 273,854B/**47,225B gzip** = P1b 47,198B 대비 **+27B**, entry JS는 863,742B/**271,292B gzip** = P1b 271,025B 대비 **+267B**로 P1 예산(+10KB/+50KB)을 통과했다.
- **완료 검증·동반 영향**: `npm run build` exit 0(2,538 modules·정적 59페이지), `npm run test:unit` 167/167, production preview의 `test:excel-compare`(모바일 overflow 0·힌트 보호·radius·nav 여백 단언), `test:browser`, `test:static`, `test:visual` 24/24와 `git diff --check`가 통과했다. 공개 ko/en 문구·URL·SEO/정적 페이지·광고 배치/격리 경로·GitHub Pages 구조는 불변이다.
### shadcn 마이그레이션 P1b — 공용 컴포넌트군 호환 판정 (Codx)

- **실행 게이트·CLI 범위**: 착수 시 `git rev-parse HEAD` = `git rev-parse origin/main` = `fdfb6c389692272e6c49143be7a8fb04639116c1`로 지시 기준 `fdfb6c3`와 일치했다. 열린 계획서 검색에서 P1b와 충돌하는 지시는 없고, 비디오 W-D의 stage-key 계약과 U3의 P1 선행 의존만 일치하는 항목으로 확인했다. 실행한 add는 `npm_config_cache=/tmp/worklazytools-npm-cache npx --yes shadcn@4.20.1 add progress --yes` 하나뿐이며 `src/components/ui/progress.tsx`만 생성됐다. package manifest·lockfile·다른 shadcn 컴포넌트에는 diff가 없다. 사용자 MP4 3개와 DOCX 2개는 전 과정에서 제외했다.
- **구현·DOM 판정**: ToolGuide는 Card 기반 `<section>`과 guide `<article>`로 바꾸되 `content-heading`→guide grid→FAQ `details/summary/p` 구조, `aria-labelledby`, `t("guide.eyebrow")`의 한국어 `안내`를 유지했다. OperationProgress는 Card·Button·Base UI Progress를 사용하되 root `<section>`, 제어형 값/label, 로그 `<ol>/<li>`, 접기 버튼과 상태 class를 보존하고 6색 indicator/state map을 명시했다. ToolCard는 Card에 polymorphic `as={Link}`를 허용해 실제 `<a>`·경로·analytics 호출과 카드/아이콘의 동일한 6색 accent를 유지했다. LanguageSwitcher는 ToggleGroup으로 전환해 `<div role="group">`, 현지화 label, KO/EN `aria-pressed`, roving focus와 ArrowRight+Space 전환을 보존했다.
- **공개 API·사용처 판정**: 기준 해시와 현재 네 파일의 export interface·function parameter를 TypeScript AST로 비교해 모두 동일했다. U2 Excel Cleaner 추가 뒤 실제 feature 사용처는 지시서 작성 당시의 ToolGuide 21·OperationProgress 13이 아니라 각각 **22·14파일**이며, 호출부 수정 없이 중앙 컴포넌트로 전부 전환됐다. 전용 계약 단위 테스트 4건과 `npx tsc -b`가 통과했다.
- **W-D 행동 회귀 증명**: 소스 계약은 `entry.id === activeLogId || (stageKey === activeStageKey)`의 current 판정, running current의 `LoaderCircle.spin`, `key={entry.id}`, `entry.progress%`를 그대로 유지했다. `npm run test:excel-compare`는 보고서 1쌍/다중쌍·취소·모바일 overflow 0을 포함해 exit 0이었다. `npm run test:new-tools`의 실제 512MiB×2=1GiB sparse 비디오 작업은 **14개로 제한된 진행 행 전부의 퍼센트**와 **마지막 행이 아닌 activeStageKey 행의 스피너**를 MutationObserver로 관측해 exit 0이었다. `test:browser`도 완료 상태마다 Card section·Base UI progress slot·`aria-valuenow=100`·모든 로그 행 퍼센트를 검사해 통과했다.
- **시각·접근성 판정**: 의도한 Card/Progress/Toggle 외형을 반영해 Chrome 152.0.7977.64의 24개 기준선을 갱신했고 일반 `npm run test:visual`은 24/24, diff threshold ≤0.100%로 일치했다. 대표 before/after/diff는 `tests/visual-artifacts/p1b/`에 4화면×3장으로 고정했다. P1a before 대비 diff는 Excel 비교 모바일 963px/0.2926%, 홈 EN dark desktop 67,488px/5.4935%, 도구 목록 EN dark mobile 8,037px/2.4417%, KO light desktop 21,410px/1.7428%였다. ko/en×light/dark×desktop/mobile 실측은 document overflow 0·clipped text 0이고, 새 카드/언어/가이드 보조 텍스트 대비 최솟값은 light **4.89:1**, dark **6.04:1**로 WCAG AA를 통과했다. 최초 대비 검사에서 낮게 나온 guide/card eyebrow는 `text-muted-foreground`로 보정한 뒤 재측정·기준선 재생성했다.
- **번들 예산**: 동일 `npm run build` 산출물을 zlib level 6으로 측정했다. 전체 CSS `index-BvxQVj6w.css`는 273,707B/**47,198B gzip**, P1a 46,844B 대비 **+354B**(한도 +10KB). entry `index-Dz4QDSyz.js`는 863,110B/**271,025B gzip**, P1a 268,432B 대비 **+2,593B**(한도 +50KB)로 통과했다.
- **완료 검증**: `npm run build` exit 0(2,537 modules·정적 59페이지), `npm run test:unit` 167/167, `npm run test:browser`·`test:office`·`test:xls-preserve`·`test:xls-first-load`·`test:excel-compare`·`test:excel-cleaner`·`test:new-tools`·`test:video-hybrid`·`test:utilities`·`test:static` 모두 exit 0, `npm run test:visual` 24/24였다. 브라우저 스모크의 개발 서버 사전 실행은 Vite lazy dependency 최적화 reload 뒤 Word 비교 사용자 오류 1회와 unminified 처리의 CDP timeout 1회가 있었으나, 현재 production build를 표준 5173 포트에 둔 동일 전체 명령과 별도 Word 범위는 모두 통과해 제품 회귀가 아님을 교차 확인했다. 공개 ko/en 문구·번역 리소스·URL·SEO/정적 route·AdSense 배치/격리 경로·GitHub Pages 구조는 변경하지 않았다.
### shadcn 마이그레이션 P1a — 공용 UI 8종 호환 adapter 판정 (Codx)

- **CLI 선택·추가 범위**: `shadcn 4.20.1 view tabs`의 Base UI 생성물은 `tablist`/`tab`·`aria-selected`, `view toggle-group`과 설치된 Base UI 원문은 root `role="group"`·item `aria-pressed`를 제공했다. 기존 `SegmentedControl` 계약과 정확히 맞는 **toggle-group**을 선택하고 tabs는 기각했다. 실행한 add는 `button card switch toggle-group`뿐이며, registry 의존으로 `toggle.tsx`가 함께 생성됐다. 생성 파일은 button/card/switch/toggle/toggle-group 5개이고 tabs 파일은 없다.
- **8종 adapter·호출부 불변**: PageHeader는 header/h1 계층, SectionCard는 Card 기반 `<section>`·step·className 병합, SegmentedControl은 제어형 단일 선택 group/pressed, ToggleRow는 제어형 native button switch/checked/disabled, FileDropZone은 Card+Button 내부 부품과 파일 누적·async 완료 후 input reset·Enter/Space·drag, FileList는 Card 기반 `<ul>`/`<li>`와 제거, PrimaryButton은 loading/disabled/`aria-busy`, ResultCard는 `<section>`/`aria-live="polite"`를 보존했다. `ToolAccent` green/blue/violet/orange/pink/sky는 네 variant map으로 전부 명시했다. 기준 해시의 8개 공개 prop type 텍스트와 현재 선언을 TypeScript AST로 대조해 동일했고, 현재 HEAD의 `ui.tsx` import 호출부는 지시서의 옛 39개가 아니라 U2 반영 후 **40개**였다. 호출부 40개 수정 0 상태로 `npx tsc -b`가 exit 0이었다.
- **NavigationRow 제거**: TypeScript AST 기준 호출 0, 저장소 검색도 사용 0이므로 export·ChevronRight import·전용 CSS 2개를 제거했다.
- **행동·레이아웃 회귀 판정**: production Chrome에서 FileDropZone Enter 업로드/async reset, SegmentedControl ArrowLeft/Right+Space, ToggleRow Space+Enter 복원을 실동작으로 확인했다. 첫 스모크에서 shadcn Card의 `overflow-hidden`이 Excel 모바일 sticky를 막고, 기본 padding이 HWP focus shell 높이를 736.5px로 줄이는 충돌을 발견했다. SectionCard는 일반 화면 `overflow-visible`, HWP focus 컨텍스트만 padding 0·overflow hidden으로 보정해 shell 784.5px/section 884px/focus 900px를 회복했다. XLS 보존 route 전환 직후 upload race는 input selector 대기를 추가해 안정화했다.
- **시각 판정·증거**: P-V 기준선과 최초 비교에서는 의도한 preset 전환 때문에 24개 중 16개가 달랐고 최대 diff는 `excel-compare-empty__en__dark__desktop` **11.3402%**였다. 변경 route의 ko/en × light/dark × desktop/mobile 16행렬을 검사해 document overflow 0·adapter 경계 overflow 0·clipped text 0이었다. 대표 텍스트 최소 대비는 **4.73:1**, 흰색 대비 6색 primary는 green 4.95, blue 6.83, violet 7.30, orange 5.22, pink 5.91, sky 5.86으로 WCAG AA를 통과했다. 4개 대표 화면의 before/after/diff 12장은 `tests/visual-artifacts/p1a/`에 고정했고 새 기준선 24장은 Chrome 152.0.7977.64로 갱신했다. 갱신 후 일반 `test:visual`은 24/24가 임계값 ≤0.100%로 일치했다.
- **번들 예산**: 동일 `npm run build` 산출물을 zlib level 6으로 측정했다. 전체 CSS `index-q6-lP6rN.css`는 271,697B/**46,844B gzip**, P0b 40,929B 대비 **+5,915B**(한도 +10KB). entry `index-C3yIRznh.js`는 859,382B/**268,432B gzip**, P0b 246,772B 대비 **+21,660B**(한도 +50KB)로 통과했다.
- **완료 검증**: `npm run build` exit 0(2,522 modules·정적 59페이지), `npm run test:unit` 163/163, `test:browser`(공용 adapter 키보드 계약 포함)·`test:office`·`test:xls-preserve`·`test:xls-first-load`·`test:excel-compare`·`test:excel-cleaner`·`test:new-tools`·`test:video-hybrid`·`test:utilities`·`test:static` 모두 exit 0, `test:visual` 24/24였다. 사용자 ko/en 문구·번역 리소스·SEO/정적 route·소셜 이미지·AdSense 배치/격리 경로·GitHub Pages 구조는 변경하지 않았다.
### shadcn 마이그레이션 P0b — 전역 preflight·legacy 보정 판정 (Codx)

- **전역 적용 판정**: Tailwind 4.3.3 generated `preflight.css` 원문은 398줄·SHA-256 `ace8310eed6dc5568a56fc16e1d695cf58da7528d81d66d81649e93cce644df6`이며 `:host`·`::backdrop`·`::file-selector-button`·WebKit/Firefox 폼 pseudo-element·`[hidden]`을 함께 다룬다. 설치한 Base UI 1.7.0의 `FloatingPortal`은 container 미지정 시 `document.body`를 쓰고 number-field cursor도 body에 portal한다. `#root` scoped reset은 이 body portal과 host/browser pseudo 계약을 누락하므로 기각하고 `tailwindcss/preflight.css`를 전역 `layer(base)`로 확정했다. 브라우저에서 `#root` 밖 body 직속 임시 `<p>`가 `margin-block: 0px`·`border-style: solid`로 계산되어 실제 전역 적용도 확인했다.
- **무보정 충돌과 보정 8개**: 전역 import만 둔 1차 실측은 P-V 24/24가 실패했고 diff는 2.3848%~12.2323%였다. legacy layer에 ① `::before`·`::after`·`::backdrop`·`::file-selector-button`의 기존 `content-box`, ② `h1`~`h6`의 UA font size/weight, ③ `small`의 `smaller`, ④ `.tool-guide-grid ul`·`.prose-card ul`의 disc marker, ⑤ `.prose-card ol`의 decimal marker, ⑥ button/input/select/optgroup/textarea/file-selector-button의 기존 margin·padding·border·radius·background·font·letter-spacing·color·opacity, ⑦ textarea의 양방향 resize 기본값, ⑧ `html`의 기존 normal line-height를 명시해 상쇄했다. 이후 실측은 hero/page heading `font-weight: 700`, prose ul `disc`, 동적 prose ol `decimal`, hero pseudo-element `content-box`였다.
- **시각·예산 판정**: Chrome 152 production preview에서 ko/en × light/dark × desktop/mobile 24/24가 P-V 기준선과 임계값 ≤0.100%로 일치했다. 전체 CSS 단일 파일은 232,664B/40,929B gzip으로 P0a 39,730B 대비 **+1,199B**(한도 +10KB), entry JS는 793,774B/246,772B gzip으로 P0a 246,773B 대비 **-1B**(원시 크기 동일, 한도 +0KB)라 통과했다.
- **불변 계약·제품 영향**: layer 선언은 `theme < base < legacy < components < utilities`, preflight 소유는 base, 기존 CSS 소유는 legacy로 유지했다. `prefers-color-scheme: dark` 토큰 브리지와 `.dark` 비사용 계약은 수정하지 않았다. 사용자 문구·ko/en 리소스·SEO/정적 route·광고 배치/격리 경로·GitHub Pages 구조·JS 동작은 변경하지 않았다.
- **완료 검증**: `npm run build` exit 0(2,430 modules·정적 59페이지), `npm run test:unit` 158/158, production preview의 `test:visual` 24/24와 `test:browser`·`test:office`·`test:xls-preserve`·`test:excel-compare`·`test:excel-cleaner`·`test:new-tools`·`test:utilities`, 자체 서버의 `test:xls-first-load`, 단일/concat `test:video-hybrid`, `test:static`, `git diff --check`가 모두 exit 0이었다.

### shadcn 마이그레이션 P0a — preflight 없는 기반 설치 판정 (Codx)

- **CLI·preset 실측**: 최초 체크포인트 `npx shadcn@latest init --help`에서 `--template <next|start|vite|react-router|laravel|astro>`, `--base <base|radix|aria>`, `--preset [name]`을 확인했고 `--version`은 4.20.1이었다. `preset decode b1aK6UEDo --json`은 version `b`, style `luma`, baseColor `olive`, theme `indigo`, chartColor `blue`, iconLibrary `lucide`, font `noto-sans`, radius `large`, menuAccent `subtle`, menuColor `default`를 반환했다. 고정 명령 `npx shadcn@4.20.1 init --template vite --base base --preset b1aK6UEDo --yes` 적용 뒤 `shadcn info`가 `style=base-luma`, `base=base`, 같은 preset, Tailwind v4, alias `@`, 설치 component 0개를 확인했다.
- **CLI 선행 조건·생성물 판정**: 첫 init은 Tailwind/alias 부재, 두 번째는 CLI 4.20.1이 모듈별 Tailwind import를 CSS 진입점으로 인정하지 않아 각각 변경 없이 중단됐다. 앱이 import하지 않는 임시 전체 import로 탐지만 통과시킨 세 번째 init은 `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, preset CSS와 의존성을 생성했다. P0a component add 금지 때문에 자동 생성 button과 임시 CSS, element 대상 `@layer base` apply 규칙은 제거했고 최종 `shadcn info`의 Installed Components는 `No components installed`다. 최종 생성 파일은 `components.json`·`src/lib/utils.ts`·`src/styles/tailwind.css`, 변경 파일은 package/lock·라이선스 생성물·Vite/TS alias·main CSS import·`global.css`다.
- **의존성 diff**: runtime/build 기반은 `@base-ui/react@1.7.0`, `@fontsource-variable/noto-sans@5.3.0`, `class-variance-authority@0.7.1`, `clsx@2.1.1`, exact `shadcn@4.20.1`, `tailwind-merge@3.6.0`, `tw-animate-css@1.4.0`; dev 기반은 exact `tailwindcss@4.3.3`·`@tailwindcss/vite@4.3.3`이다. `npm install` 보고의 기존 audit 상태는 6 low/4 moderate였고 자동 fix는 범위 밖이라 적용하지 않았다.
- **preflight·layer·다크 판정**: `tailwindcss/theme.css`와 `tailwindcss/utilities.css`만 모듈 import하고 `preflight.css`와 전체 `@import "tailwindcss"`는 0건이다. 선언 순서는 `theme < base < legacy < components < utilities`; theme은 실제 `layer(theme)`이며 Tailwind가 custom property 초기화용 내부 `properties` layer를 별도로 만든다. 현행 2,648줄 CSS 본문은 `legacy`로 옮기고 충돌하던 radius 4개만 `--legacy-radius-*`로 이름을 분리했다. `.dark` variant는 0건이며 shadcn surface/text/border 토큰을 기존 변수에 연결하고 indigo/chart 값은 preset을 유지한 채 `prefers-color-scheme: dark` 안에서 다시 연결했다.
- **scan 오염 기각**: 최초 성공 빌드에서 Tailwind 자동 scan이 `public/vendor/rhwp-studio`의 `[file:open]` 로그를 arbitrary property로 오인해 5개 경고를 냈다. repo-wide 자동 scan은 기각하고 utilities에 `source(none)`을 지정한 뒤 `@source "../"`로 소유 `src/`만 허용했다. 재빌드는 해당 경고 0건이고 산출 CSS의 `[file:open]` 0건, preflight `box-sizing:border-box;border:0 solid` 패턴 0건이었다.
- **시각·예산 판정**: Chrome 152의 production preview에서 before 24장과 24/24 일치해 diff 비율이 모두 ≤0.100%였다. 정식 build 산출은 전체 CSS 단일 파일 228,206B/39,730B gzip으로 정본 37,148B 대비 **+2,582B**(한도 +20KB), entry JS 793,774B/246,773B gzip으로 정본 245,738B 대비 **+1,035B**(한도 +10KB)라 모두 통과했다.
- **완료 검증·제품 영향**: `npm run build` exit 0(2,430 modules·정적 59페이지), `npm run test:unit` 158/158, production preview에서 `test:browser`·`test:office`·`test:xls-preserve`·`test:excel-compare`·`test:excel-cleaner`·`test:new-tools`·`test:utilities`, 자체 서버의 `test:xls-first-load`, 단일/concat `test:video-hybrid`, `test:static`, `test:visual` 24/24와 `git diff --check`가 모두 통과했다. 공개 문구·route·SEO 입력·광고 배치와 격리 경로·서버리스 구조는 불변이다.

### shadcn 마이그레이션 P-V — 시각 회귀 기준선 판정 (Codx)

- **고정 매트릭스**: 홈 기본 상태·도구 목록의 `category=media` 필터 상태·Excel 비교 빈 상태 3개를 ko/en × light/dark × desktop 1365×900/mobile 390×844(DPR 1)로 전개해 정확히 24개 viewport PNG를 고정했다. Chrome 152.0.7977.64에서 채집한 before 기준선은 4,979,977B(약 4.8MiB)이며 대표 desktop/mobile 화면을 직접 확인해 lazy route 로딩 잔상과 빈 화면이 없음을 확인했다.
- **재현 계약**: `npm run test:visual`이 고정 포트의 로컬 Vite를 자체 기동하고 외부 origin 요청과 서비스워커를 차단한다. privacy consent는 denied, locale은 route와 localStorage에 일치시키고 `prefers-color-scheme`을 명시한다. 모든 animation·transition·smooth scroll·caret를 비활성화하고 폰트 준비와 2 RAF 뒤 viewport만 캡처한다. 허용 영역은 시간 의존적인 `.global-footer > span:first-child` 한 곳뿐이다.
- **회귀 0 판정**: pixelmatch per-pixel threshold 0.1, antialiasing 제외, 전체 픽셀 중 diff 비율 ≤0.100%를 “시각 회귀 0”으로 정의했다. 크기 불일치·기준선 누락/잉여·페이지 오류는 비율과 무관하게 실패하며, 초과 시 actual/diff PNG를 `/tmp/worklazytools-visual-regression`에 남긴다. 기준 갱신은 명시적인 `UPDATE_VISUAL_BASELINES=1`에서만 가능하다.
- **도구·검증 실측**: 비교기는 exact dev dependency `pixelmatch@7.1.0`·`pngjs@7.0.0`을 사용한다. 최초 `npm install`은 기본 `~/.npm` 캐시가 read-only여서 `EROFS`로 중단됐고, `/tmp/worklazytools-npm-cache`를 지정한 동일 설치는 성공했다. 기준선 채집 뒤 연속 자기 비교 2회가 24/24 통과했고 `npm run build` exit 0(2,429 modules, 정적 59페이지), `npm run test:unit` 158/158, `npm run test:static`, `git diff --check`가 통과했다.
- **제품 영향**: 테스트 전용 코드·dev dependency·license 생성물만 변해 사용자 문구·ko/en 리소스·SEO·정적 route·광고 배치/격리·GitHub Pages 런타임에는 제품 코드 변경이 없다.

### Excel 데이터 정리 U2 — 규칙 파이프라인·수식·출력·메모리 판정 (Codx)

- **스키마·lineage 판정**: version 1 discriminated union에 고정 type ID 28종을 두고 규칙 100개·JSON 256KiB·일반 문자열 1,000자·정규식 500자·수치 범위를 runtime에서 검사한다. variant별 unknown key, 필수 키, 기본값, 경계값, `y` flag, 잘못된 정규식을 거부한다. 첫 선택 시트의 `column:N`을 기준으로 다른 시트는 NFC 헤더명에 결합하고, 파생 열 ID는 JSON에 영속화해 생성 후 참조는 허용하되 기존/과거 파생 ID 재사용·삭제된 ID 참조·불완전 재정렬은 실행 전에 차단한다.
- **28종 구현 매트릭스**: 구조 13종은 `trim-edge-empty`·`remove-empty-rows`·`remove-empty-columns`·`collapse-consecutive-empty`·`unmerge-cells`·`unmerge-fill-down`·`rename-column`·`reorder-columns`·`delete-columns`·`combine-columns`·`split-column`·`add-constant-column`·`add-row-number-column`; 텍스트 7종은 `trim-whitespace`·`collapse-spaces`·`normalize-newlines`·`remove-invisible-chars`·`normalize-unicode`·`find-replace`·`regex-replace`; 행 필터 3종은 `dedupe-rows`·`dedupe-by-columns`·`filter-rows`; 값 변환 5종은 `fill-empty-cells`·`convert-numeric-strings`·`unify-date-format`·`format-phone-number`·`format-business-number`로 구현했다. split 초과 조각은 마지막 조각에 남기고, latest 중복의 빈 값/실패는 최구·동률은 앞 행 유지, 변환 실패는 원값 보존+오류 행 기록, 수식 셀 판정은 저장 계산값을 사용한다. 숫자·날짜·전화·사업자 변환은 텍스트 타입/`@` 서식/선행 0 보존 경계를 적용했다.
- **수식 골든 판정**: 문자열 리터럴을 건드리지 않는 A1 token 변환에서 행 삭제 `A2+$B$3+SUM(C2:D5)+"A2"`→`#REF!+$B$2+SUM(C2:D4)+"A2"`, 열 삭제 `B2+A2:C2`→`#REF!+A2:B2`, 열 삽입 `B2+A2:C2`→`C2+A2:D2`, 저장 후 재개봉 `B3+C3`→`B2+C2`를 확인했다. `$`는 보존하고 범위 부분 삭제는 남은 직사각형으로 축소하며 전체 삭제는 `#REF!`로 바꾼다. 재정렬·결합·분리로 범위가 비연속이면 그 수식 셀만 저장값으로 강등하고 오류 행을 남긴다.
- **preflight·병합 판정**: 합성 OOXML fixture에서 normal/shared/array와 캐시, shared master/ref, defined name, table, 병합, 1900/1904 날짜계를 실제 저장·재개봉했다. 교차 시트·동적·structured/shared/array/named/table 또는 비OOXML 수식은 모든 캐시가 있을 때만 사용자 확인 후 값으로 강등하고, 캐시 누락은 `시트!셀` 목록으로 차단한다. 살아 있는 병합보다 구조 규칙이 앞선 파이프라인은 차단하며 `unmerge-fill-down`은 master와 범위를 먼저 snapshot한 뒤 병합 해제·채움을 원자 적용한다. ExcelJS splice는 사용하지 않고 투영 모델에서 재구성한다.
- **실행·출력 판정**: 명시 미리보기는 이전 워커 abort+generation 폐기, 규칙 변경 뒤 stale 표시로 고정했다. worker는 규칙 시작/진행 메시지와 ID를 보내며 부모 30초 inactivity watchdog은 실제 `(a+)+$` fixture를 종료하고 UUID를 포함한 지역화 오류로 사용자 취소와 구분했다. 최종은 파일별 순차 워커로 실패를 격리한다. 입력당 선택 시트+변경 요약·처리 규칙·오류 행·제외 행의 XLSX 하나, 선택 시트별 CSV, 결과 둘 이상 ZIP을 만들며 시트명과 파일명 충돌은 결정적 suffix로 해소한다. CSV 기본은 위험 원문을 보존하고 다운로드 전에 경고하며 opt-in 모드는 작은따옴표를 붙인다. Chrome 실다운로드에서 XLSX 2개+ZIP 1개, ZIP entry 2개, 원본 byte 불변, URL 교체 정리, 취소 후 재실행을 확인했다.
- **heap 게이트 판정**: Chrome 152 `--enable-precise-memory-info`에서 CSV 파싱→C1 투영→날짜 변환 실패 100,000행→필터 제외 100,000행→4시트 XLSX 보고서 직렬화의 100,000×10 전체 경로를 실행했다. 오류/제외 capped buffer는 각각 정확히 100,000행, 누락 0행, 출력 5,040,747B였다. 단계 heap은 baseline 52,118,291B·parse 233,365,803B·투영 265,934,431B·엔진 302,740,227B·보고서 직렬화 697,908,835B·해제 뒤 152,852,193B, CDP polling peak **916,061,264B(873.62MiB)**로 합격 한도 1,258,291,200B(1,200MiB) 이하였다. 입력 buffer는 parse 직후, C1 원본 투영은 consume 직후, 엔진 모델·capped buffer는 출력 전사 직후, 출력 buffer는 인계 직후 참조를 끊는다. 보고서: `/tmp/worklazy-excel-cleaner-heap-final/excel-cleaner-heap-100000.json`.
- **현지화·SEO·광고 판정**: `/tools/excel-cleaner` route·registry와 ko/en 전 화면·오류·가이드·FAQ, 언어별 SEO title/description/application, 정적 페이지·사이트맵·소셜 이미지 생성 입력을 함께 추가했다. 일반 AdSense 경로를 유지하고 비디오·오피스·Excel 보존 격리 meta를 반입하지 않았으며 GitHub Pages 정적 실행만 사용한다. 390×844에서 가로 overflow 0, 파일·규칙 버튼 44px와 드래그의 위/아래 버튼 대안을 확인했다.
- **완료 검증**: 최종 연속 실행에서 `npm run build` exit 0(2,429 modules, Excel Cleaner page 31.65kB/9.66kB gzip, worker 1,504.81kB, 정적 59페이지), `npm run test:unit` 158/158, `npm run test:excel-cleaner`, `npm run test:excel-compare`, `npm run test:utilities`, `npm run test:static`, `npm run bench:excel-cleaner`, JS 구문 검사와 `git diff --check`가 모두 exit 0이었다. U2 코드는 `dummyfortest`를 참조하지 않고, 기존 MP4 3개·DOCX 2개는 읽기·수정·스테이징하지 않았다.

### Excel 데이터 정리 U0.1 — 편집 메타데이터·append 경계 판정 (Codx)

- OOXML 의미 모델은 ExcelJS 단일 파싱을 유지했다. ExcelJS가 빈 문자열 수식 캐시의 `<v></v>`를 `undefined`로 축약하므로, 이미 형식 판별에 연 OOXML ZIP의 worksheet XML에서 수식 셀별 `<v>` 존재 여부만 읽어 `present|missing`을 보존한다. `0`·`false`·`""`·오류 캐시와 캐시 누락 골든을 통과했다.
- shared master/slave·array ref, workbook defined name, table 범위·열, 원본 행/열 lineage를 공용 투영에 추가했다. 보고서 append helper는 기존 선택 시트를 보존하고 Excel 31자/금지문자 규칙과 대소문자·NFC 충돌을 결정적 `(2)` suffix로 해소한다.
- 표적 검증: `npx tsc -b --pretty false`와 `node --test --experimental-strip-types tests/unit/spreadsheet-core.test.ts` 6/6, `git diff --check` exit 0.

### Excel 비교 U1 후속 X-A~X-C — 보고서·파일 배치·선택 대사 판정 (Codx)

- **X-A 보고서 무결성 판정**: worker는 생성 직후 양수 byteLength와 `PK\x03\x04`를 검사하고 transfer와 별개인 `reportByteLength`를 동봉한다. client는 수신 buffer 길이, page는 Blob 크기를 각각 대조하며 세 실패는 `REPORT_INTEGRITY_FAILED`의 ko/en 재실행·재다운로드 안내로만 노출한다. 0바이트와 길이 불일치 page 주입은 다운로드 링크 없이 같은 안전 문구로 귀결됐다. 브라우저가 OS 다운로드로 넘긴 뒤의 저장 파일은 앱이 사후 검사할 수 없으므로, 재발 시 저장 파일 크기와 브라우저 이름을 받는 안내를 결과와 오류에 함께 두었다.
- **X-A URL·실다운로드 판정**: 이전 결과 URL 목록을 스냅샷한 뒤 `completed`/ZIP 제거가 DOM에 커밋된 다음 effect에서만 revoke하고, 언마운트에서는 소유 URL 전부를 정리한다. Chrome CDP 다운로드 설정으로 실제 디스크 파일을 내려받아 15,392B, PK 서명, ExcelJS 재개방, 정확한 9시트와 Summary `matched=8`·`changed=2`를 확인했다. 다음 실행에서 이전 앵커 부재가 먼저 확인된 뒤 그 URL의 revoke 호출이 관측됐다. preview 상태는 `COOP=same-origin`·`COEP=require-corp`·`crossOriginIsolated=true`·기존 서비스워커 제어였고 같은 환경에서 실다운로드가 정상이라 Excel 경로의 서비스워커/격리 상태를 빈 파일 원인으로 연결하지 않았다.
- **X-B 파일 배치·교환 판정**: 공용 단일 파일 drop zone 대신 `PairFileDropZone`을 두고, `assignPairFiles`가 빈 슬롯을 왼쪽부터 채우며 점유 슬롯을 보존하고 초과 파일 수를 알린다. 빈2+2·빈2+1·빈1+1·빈1+2·빈0+N의 5종 단위표가 통과했다. 교환은 file·inspection·검사 상태·error·sheet·header row·기본/보조 key·금액/날짜/거래처 mapping을 모두 맞바꾸고 검사 중 비활성화한다. Chrome에서 검사 중 비활성→완료 후 활성, 점유 쌍에 추가한 2개 파일 전량 거부 안내와 기존 이름 불변, 교환 전 `added=2/removed=0`에서 교환 후 `added=0/removed=2` 방향 반전을 확인했다.
- **X-C 선택 대사·한도 판정**: 금액 열은 필수로 유지하고 날짜·거래처/설명은 좌우 동시 사용/미사용 validator를 UI와 엔진이 공유한다. 정·역방향 partner/day 후보 필터는 활성 기준만 적용하며 비활성 기준에서 `INVALID_DATE`/`INVALID_PARTNER`를 만들지 않는다. 활성 오류는 `INVALID_AMOUNT`·`INVALID_DATE`·`INVALID_PARTNER`로 나뉜다. 정확 금액 후보에도 대상당 10개 상한을 적용해 초과 시 `RECON_SEARCH_LIMIT`로 자동 확정하지 않고, 역방향 복수 조합은 관여한 미확정 좌측 거래마다 Ambiguous 한 행으로 회계한다. 비적용 Parameters는 빈 문자열·거짓 기본값 대신 `UNUSED`로 기록한다.
- **X-C 골든 판정**: 날짜 미사용·거래처 미사용·금액 단독, 좌우 불변식 위반, 활성 오류 3종, 정방향·역방향 대칭, 후보 11개 초과, 전역 조합 한도를 단위 검사했다. 브라우저 금액 단독 fixture는 15,151B의 9시트 보고서로 재개방됐고 Summary는 `ambiguous=2`·`unmatched=3`·`error=0`, 날짜·거래처·날짜 허용치는 `UNUSED`, 후보 상한은 실제값과 같은 `10`이었다.
- **신고 파일 로컬 비게이팅 확인**: `dummyfortest/2026년 설 선물 발송처_20260204_취합.xlsx`와 `_김민정.xlsx`를 읽기 전용으로 현행 엔진에 직접 전달했다. `최종` 시트 78행×10열에서 770 records(`matched=761`, `changed=9`, 나머지 0), 보고서 49,958B·`504b0304`·ExcelJS 재개방·9시트를 확인했다. 보고서 데이터 행은 Summary 8·Parameters 46·Matched 761·Changed 9·Added/Removed/Duplicates/Ambiguous/Errors 각 0이었다. `src/`·`tests/`·`scripts/`·`package.json`의 `dummyfortest` 참조는 0건이며 신고 파일은 CI 게이트와 스테이징에서 제외했다.
- **현지화·SEO·광고 판정**: 변경된 사용자 문구와 접근성 라벨을 ko/en 동형으로 추가했고 내부 실행 명칭·원시 오류를 노출하지 않는다. 기존 `/tools/excel-compare` URL·registry·SEO 정적 페이지·사이트맵·FAQ·소셜 이미지 생성 입력과 일반 AdSense 배치, 광고 제외 격리 경로는 바뀌지 않았다.
- **완료 검증**: 최종 연속 실행에서 `npm run build` exit 0(2,423 modules, Excel Compare page 170.02kB/70.55kB gzip, worker 1,488.10kB, 정적 57페이지), `npm run test:unit` 147/147, `TEST_BASE_URL=http://127.0.0.1:4174 npm run test:excel-compare`, `npm run test:static`, `git diff --check`가 모두 exit 0이었다. 합성 fixture만 게이트에 사용했고 `dummyfortest` 코드·테스트 참조 0건을 유지했다.

### 비디오 W-A~W-D — DV base layer·호환 사유·음향 대안·진행 로그 판정 (Codx)

- **DV 판정·격리**: `dvcC`/`dvvC` 첫 5바이트에서 version 1.0·profile 8·BL present·compat 1/2/4만 허용하고, config 누락/단축·그 밖의 version/profile/compat·BL 없음·dual box는 구체 parser cause로 거부한다. `dvh1`/`dvhe`는 target encode/hybrid parse에서만 HEVC base layer로 열고 stream-copy는 계속 거부한다. hvcC에서 만든 base codec string은 32비트 compatibility를 unsigned bit reversal하고 constraint 원순서와 후행 0 생략을 보존한다. job의 compat ID는 중복 제거해 HDR10/SDR/HLG 단일 또는 혼합 안내로 preflight·결과 화면에 유지한다.
- **사유·용량 판정**: probe 실패는 parser/capability discriminated union으로 보존하고 모든 확정 cause를 사용자 행동 중심 ko/en 호환 변환 안내에 전사했다. 우선순위는 구제 CTA → 안전 용량 차단 → 구체 cause → decision 사유다. 1.5GiB predicate는 정확 임계만 허용하고 +1·NaN·음수를 거부하며 route fallback과 UI가 공유한다. UI 차단은 신뢰 가능한 예상치가 있는 target-bitrate video encode에만 적용하고 copy·CRF·GIF·음향은 제외한다. 4K 해상도는 시간·메모리 비차단 경고만 낸다.
- **음향 대안 판정**: WebCodecs parser 1회 결과로 현재 모드와 remove/encode 대안을 함께 평가한다. AAC 인코더 지원 여부로 선택하는 기존 hybrid와 달리, E-AC-3 등 소스 음향 부적합 구제는 `AUDIO_ENCODER_SUPPORTED`에 막히지 않게 분리했다. 두 대안이 가능하면 192kbps·원본 샘플레이트의 음향 변환을 기본 CTA, 음향 제외를 보조 CTA로 제시하고 job별 override와 결과 경고까지 유효 모드를 전파한다. copy 경로는 기존대로 변환을 제안하지 않는다. Chrome H.264+E-AC-3 target 스모크에서 encode/remove 두 선택이 각각 출력 1개로 완주했다.
- **진행 로그 판정**: worker→controller→`VideoWorkerProgress`→hook에 job/stage key를 전달해 같은 stage 행을 제자리 갱신하고, 현재 스피너는 배열 끝이 아니라 active ID/key를 따른다. coalescer는 정수 % 변경·100ms heartbeat·명시 완료 중 하나일 때만 내보내며 최종 mux/write 명시 완료는 중복 100%여도 보존한다. fake clock 50,000회 보고는 명시 완료 전 최대 101회로 제한됐고, mux/write 30쌍은 종전 63행에서 start 포함 3행(성공 추가 4행)으로 줄었다. stream-copy·WebCodecs는 audio 15%를 제외해 재정규화하고 hybrid·FFmpeg는 기존 가중치를 유지하며 mixed batch는 job별 활성 가중치를 쓴다.
- **fixture·실파일 실측**: `hvc1+hvcC`에 20-byte `btrt`를 재사용해 `dvh1`/`dvhe` × `dvcC`/`dvvC` 4종을 만들고 ffprobe tag·MP4Box hvcC+DOVI box·FFmpeg 전체 디코드를 모두 확인했다. 일반 codec string `hvc1.2.4.L30.90`, 고비트 `hvc1.B5.80000005.H123.12.34`, version/profile/BL/compat/dual/missing/short와 지원 true/false 주입이 단위를 통과했다. 이 Chrome host는 DV base-layer 스트리밍 route를 노출하지 않아 실제 HEVC encode만 skip하고 deterministic capability 단위와 FFmpeg 결과·HDR10 안내를 확인했다. 512MiB×2 희소 패스스루는 퍼센트가 있는 14행으로 완주했다. 사용자 제공 H.264/AAC 실파일 3개(3840×1600 2.37GiB + 2560×1080 1.06GiB×2, 합계 4.49GiB)는 read-only로 26.9초에 출력 3개를 만들었고 progress 이력 33개가 단조, 로그는 stage/job당 한 행인 20행이었다. 원본은 수정·스테이징하지 않았다.
- **범위·제품 표면 판정**: DV RPU/metadata 보존, profile 5/7, DV stream-copy, E-AC-3 pass-through, copy 경로 음향 변환, 해상도 hard block, 비video 용량 가드는 확정 제외를 유지했다. URL·SEO 메타·정적 페이지·사이트맵·FAQ·광고 배치와 비디오 광고 제외 격리 경로는 바뀌지 않았다. ko/en key 동형·내부 구현 명칭 비노출과 GitHub Pages 정적 실행 구조를 유지했다. 기준 커밋에서 Excel Compare 추가 뒤 유틸리티 카탈로그 기대치가 ko 18/en 17에 남은 선행 누락은 실제 registry의 ko 19/en 18로만 교정했다.
- **완료 검증**: 최종 연속 실행에서 `npm run build` exit 0(2,419 modules, stream worker 260.76kB, Video Studio 92.61kB/25.41kB gzip, 정적 57페이지), `npm run test:unit` 134/134, `npm run test:new-tools` 전체 HWP·이미지·오디오·비디오, `npm run test:utilities`, `npm run test:static`, `npm run test:video-hybrid`, `npm run test:excel-compare`, `node --check tests/new-tools-smoke.mjs`, `git diff --check`가 모두 exit 0이었다. 하이브리드는 6초 단일/12초 concat 모두 전체 decode·브라우저 재생·단조 DTS·A/V drift 한계·취소 후 부분 파일 0을 통과했고, Excel 비교는 공용 진행 훅 사용 상태에서 단일/다중/격리 실패/취소/모바일 회귀를 통과했다.

### 신규 도구 U0 — 스프레드시트·파일명·ZIP·보고서 공통 경계 판정 (Codx)

- **입력 경계 판정**: 확장자가 아니라 ZIP 내부 `xl/workbook.xml`/`xl/workbook.bin`과 content type, OLE·SpreadsheetML 서명을 우선해 XLSX/XLSM/XLS/XLSB/SpreadsheetML/CSV를 분류한다. OOXML은 ExcelJS 한 번, BIFF8·XLSB·SpreadsheetML은 SheetJS 한 번, CSV는 PapaParse 한 번만 파싱하며 기존 Excel 병합의 일괄 선버퍼링은 편입하지 않았다. 시트명·헤더 행 선택 모델과 수식/캐시값/표시값/numFmt/병합/OOXML 서식 공통 모델을 고정했다.
- **재사용 경계 판정**: OLE·SpreadsheetML 서명과 CDATA 전개, theme+tint RGB 베이크 구현을 `spreadsheet-core`로 옮기고 기존 병합 표면은 얇은 재노출만 남겼다. `requiresLegacySpreadsheetConversion`은 보존 변환 판정기로 기존 영역에 유지했다. XLS·XLSB 스타일은 어댑터가 비교 가능으로 승격하지 않는다.
- **파일명·ZIP 판정**: NFC 뒤 빈 이름·경로 구분자/상위 경로·제어/Windows 금지 문자·예약 이름·말단 점/공백·255 UTF-8 byte·대소문자/NFC 충돌을 검사하고 결정적 `-N` 이름을 만든다. 중립 ZIP writer는 branded 이름을 런타임 재검사한 뒤 파일을 한 번에 하나씩 Blob stream으로 읽고 강제 ZIP64로 쓴다. 기존 비디오 경로는 이 공용 writer를 호출하며 회귀에서 전체 `arrayBuffer()` 0회·다중 chunk·ZIP64 EOCD·외부 `unzip -t/-p` 및 SHA-256 왕복을 통과했다.
- **주입 경계 판정**: `writeUntrustedText`는 값 객체를 수용하지 않고 `String(value)` primitive와 text numFmt로 기록한다. `=`·`+`·`-`·`@`·탭·CR/LF·선행 공백·formula-object 음성 대조를 XLSX 재개봉 후 문자열 타입으로 확인했다.
- **U0 검증**: TypeScript build 검사 exit 0, 표적 U0/테마/legacy 단위 9/9, 전체 unit 110/110, `video-zip-streaming` 1/1, 정적 산출 검사 exit 0. URL·사용자 문구·광고 배치·격리 경로는 U0 공개 화면이 없어 바뀌지 않았다.

### 신규 도구 U1 — Excel 비교·재조정·보고서 판정 (Codx)

- **형식·파서 판정**: XLSX/XLSM은 ExcelJS, BIFF8 XLS·XLSB·SpreadsheetML은 SheetJS, CSV는 PapaParse라는 U0 단일 파서 경계를 그대로 사용했다. XLSX/XLSM만 numFmt·글꼴·솔리드 패턴 채움·테두리·정렬·보호를 비교하고 gradient와 XLS/XLSB 서식은 제외했다. OOXML `date1904`는 `xl/workbook.xml`을 직접 확인하고 ExcelJS의 Date 변환 여부를 대조해 1462일 보정이 중복되지 않게 했으며, 1900/1904 fixture의 날짜·시각이 동일하게 정규화됐다.
- **비교 판정**: 위치 방식은 열을 먼저 대응한 뒤 행의 FNV 서명과 실제 셀 내용을 재확인하고, patience anchor 사이의 제한 DP를 사용한다. 키 방식은 복합 키와 보조 열·발생 순서·오류 처리 중복 정책을 지원한다. 재조정 방식은 후보 10개, 부분집합 1,023개, 전체 평가 1,000,000회 상한에서 1:N/N:1을 찾고 복수 최적해는 모호함으로 분리한다. 정렬·재조정 루프는 4,096회 이내마다 취소를 확인하며, 상한 초과는 각각 `ALIGN_LIMIT_FALLBACK`·`RECON_SEARCH_LIMIT`의 사용자용 설명으로 강등한다.
- **정규화·결과 판정**: NFC·공백·줄바꿈·대소문자·날짜·숫자 문자열·수치 허용 오차를 독립 옵션으로 두고 선행 0과 text numFmt `@`는 숫자 승격에서 제외했다. 수식 원문·캐시값·표시값과 수식 캐시 누락 상태를 구분한다. 결과는 Summary·Parameters·Matched·Changed·Added·Removed·Duplicates·Ambiguous·Errors의 정확히 9개 시트이며 외부 유래 값은 모두 문자열 셀로 기록해 재개봉 시 수식 셀이 0개였다.
- **수명주기·배치 판정**: 비교 쌍을 순차 처리하고 현재 쌍의 ArrayBuffer만 worker로 넘긴다. 성공·실패·취소 모든 종결에서 worker를 종료하며 같은 File은 다음 쌍에서 다시 읽는다. 각 성공 쌍의 보고서는 즉시 개별 다운로드하고 성공 보고서가 2개 이상일 때만 안전 파일명 검사를 거친 ZIP64 묶음을 제공한다. 손상 파일 한 쌍은 실패해도 나머지 두 쌍의 보고서와 ZIP이 생성됐다.
- **브라우저 스모크**: Chrome 152, 390×844/DPR2/touch에서 단일 쌍은 `left-vs-right.xlsx`만, 2성공+1손상 쌍은 개별 보고서 2개와 `worklazy-excel-comparisons.zip`을 만들었고 ZIP 항목명도 두 보고서와 일치했다. 9시트·전 셀 문자열·수식 0, 상태 색상+텍스트 필터 8종, 검색, 취소, 실패 격리, XLSB/XLSM 지원 문구를 확인했다. 모바일 가로 overflow는 0px, 쌍 카드 열 폭 294px, 파일 선택 동작 높이는 44px였다.
- **정렬 성능 게이트**: Chrome 152/V8 heap 512MiB·CPU 4배 throttling·390×844에서 3,000×3,000(9,000,000 cell product) 세 표본 `683.4/694.7/643.9ms`, 중앙값 `683.4ms`, peak heap `20,603,501B`, checksum `4018493048`, fallback 없음이었다. 3,465×3,465(12,006,225)은 `2.9ms`에 결정적 위치 대응 3,465개와 `ALIGN_LIMIT_FALLBACK`을 반환했다. 보고서는 `/tmp/worklazy-excel-compare-alignment-final/excel-compare-alignment-mobile-golden.json`이다.
- **실형식 fixture 판정**: 생성 스크립트가 BIFF8 Formula record, XLSB `BrtFmlaNum`, 수식·서식을 포함한 XLSM과 실제 VBA project, SpreadsheetML 수식, CSV, OOXML 1900/1904 날짜, 손상 파일, 5,000행 취소 입력을 매번 임시 디렉터리에 만든다. BIFF8 수식 `7`, XLSB 참조 수식 `A1`, XLSM 수식 `B2+C2`, VBA project 15,872B와 Module1 stream을 재파싱해 형식 이름만 바꾼 fixture를 배제했다.
- **현지화·SEO·광고 판정**: ko/en 기능 key 동형과 사용자용 오류·가이드의 내부 명칭 비노출을 단위 검사했다. `/tools/excel-compare` ko/en 정적 페이지·canonical/hreflang·사이트맵·FAQ 각 3개·소셜 이미지 2개를 생성기 입력에서 추가했다. 이 도구는 일반 AppShell 경로이므로 기존 AdSense loader가 활성화되고 비디오·Office App·XLS 보존 격리/광고 제외 목록에는 편입하지 않았다. 스모크에서 광고 loader 존재와 isolation marker 부재를 확인했다.
- **검증**: U1 표적·fixture·공통 정렬 단위 13/13, SEO·문서 정렬·Excel 비교 단위 19/19, 전체 unit 119/119, 비디오 ZIP 스트리밍 1/1, 제품 브라우저 스모크와 정렬 벤치가 통과했다. 최종 `npm run build`는 exit 0(2,416 modules, Excel Compare page 164.18kB/68.86kB gzip, worker 1,486.75kB, 정적 57페이지), `npm run test:static`은 localized pages·hreflang·self-hosted runtime·ads.txt·robots.txt·sitemap 검증으로 exit 0이었다. `git diff --check`도 커밋 직전 실행한다.

### 비디오 V-A+V-B — copy 사유 안내·오디오 선행 하이브리드 판정 (Codx)

- **V-A 사유·선택 판정**: `VideoProcessingJobRoute`에 stream-copy/WebCodecs/hybrid probe의 상세 사유를 보존하고, copy 실패 job만 `audio=remove`로 다시 probe해 성공한 job에만 기존 remove 모드 override를 제안한다. 배치의 형제 job 설정은 바꾸지 않는다. ko/en copy 오류·WebM 경고는 음향 변환을 구제책으로 제안하지 않고 음향 제외만 안내한다. 제품 Chrome 스모크에서 faststart H.264+E-AC-3 MP4를 `2,147,483,649B` 희소 파일로 확장해 사유 문구·제안 버튼·수락 후 stream-copy 결과 생성을 확인했고, `2,147,483,650B` `dvhe` sample-entry fixture는 음향 제안 없이 대용량 가드의 화면 압축 방식 안내로 분리했다. 작은 비호환 영상의 기존 FFmpeg 폴백은 유지한다.
- **V-B 파이프라인·동기 판정**: 오디오 encode와 실제 AAC `AudioEncoder` 미지원이 함께 확인될 때만 hybrid route를 선택한다. 원본 hybrid parse는 오디오 codec을 거부하지 않고 video track과 원본 음향 메타데이터만 취득한다. FFmpeg WORKERFS에서 각 구간을 `atrim→asetpts→aresample/aformat`한 뒤 concat·AAC M4A 생성을 먼저 끝내고, MEMFS 사본 삭제·unmount·FFmpeg terminate 후 M4A를 worker로 transfer한다. mp4box edit list의 `media_time`(AAC priming 1,024 samples)을 뺀 비음수 packet만 0 기준으로 다시 놓아 video encoded chunk와 시간순으로 mux하며, demux 뒤 원본 M4A buffer 참조와 완료 뒤 packet queue를 해제한다.
- **취소·실패·진행률 판정**: 진행률에 audio 15% 구간을 신설하고 demux/decode/encode/mux/write를 8/20/35/12/10%로 재배분했다. 오디오 워커의 유휴 취소는 FS 정리 후 terminate, 활성 FFmpeg 취소는 terminate 뒤 FS API를 호출하지 않는 강제 분기로 나눴다. 스트리밍 워커는 `audio-demux`·`video-codec`·`mux-write`·`quota`를 오류에 태깅하고 오디오 FFmpeg의 `audio` 행과 함께 각 행이 예상 출력 ≤1.5GiB일 때만 전체 FFmpeg로 폴백한다. 소형 Chrome 스모크에서 idle=`idle`, 실행 중 audio=`forced`, video abort 관측=true, OPFS `result-*` 잔재 0을 확인했다.
- **추정·4K 선행 결함 판정**: target 예상 bytes를 `((video bps + audio bps) / 8) × duration × 1.1`로 고쳤다. audio는 remove=0, encode=설정값, copy=입력별 probe bitrate의 최댓값이며 입력 하나라도 미상이면 320kbps를 쓴다. 같은 값을 quota, 1.5GiB 단계별 폴백, OPFS expected size, write 진행률 가중에 전달한다. 중간 M4A 상한은 `(audio bps / 8) × duration × 1.2`다. 최초 4K 정식 실행은 출력 H.264가 해상도와 무관하게 Level 3.1로 고정된 선행 결함 때문에 `video-codec` 실패 뒤 FFmpeg 폴백 OOM으로 실패했다. 직접 단계 진단으로 원인을 확정하고 macroblock/frame·macroblock/s·bitrate에 맞는 최소 H.264 level(4K30 8Mbps는 Level 5.1)을 선택한 뒤 동일 조건을 통과했다.
- **4K 계약 실측**: `node scripts/benchmark-video-hybrid.mjs --output-dir /tmp/worklazy-video-hybrid-4k-20260903-final` 실행. fixture 생성 명령은 `ffmpeg -hide_banner -loglevel error -y -f lavfi -i testsrc2=size=3840x2160:rate=30:duration=60 -f lavfi -i sine=frequency=997:sample_rate=48000:duration=60 -c:v libx264 -preset ultrafast -crf 23 -g 60 -bf 2 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest -movflags +faststart /tmp/worklazy-video-hybrid-4k-20260903-final/hybrid-fixture-3840x2160-60s.mp4`; fixture `489,072,912B`, SHA-256 `326d557f27d9149c38fdc679992fa8919f57ea2f24b5a00737fee295363d7ac8`. Chrome 제품 오케스트레이터는 `AUDIO_ENCODER_UNSUPPORTED→HYBRID_READY`, 예상 `67,584,000B`, 실행 `105,136.980ms`, 출력 `61,512,687B`였다. ffprobe packet 수식은 `Δstart=0s`, `Δend=-1.0547118733938987e-15s`, `|Δend−Δstart|=1.0547118733938987e-15s ≤ 1024/48000=0.021333333333333333s`; H.264 3840×2160@30+Aac 48kHz, packet DTS 단조, 전체 FFmpeg decode exit 0, 브라우저 재생 성공, OOM=false, 진행률 단조·100%였다. 보고서: `/tmp/worklazy-video-hybrid-4k-20260903-final/video-hybrid-benchmark.json`.
- **concat·CI·실파일 보조 판정**: `npm run test:video-hybrid`는 640×360 6초 개별과 동일 입력 2개 12초 concat을 모두 hybrid로 실행했다. concat `Δstart=0s`, `Δend=7.216449660063518e-16s`, drift 한도 `0.021333333333333333s`, 전체 decode/재생/OOM=false였고 CI Pages build에 같은 명령을 추가했다. 실파일 `2026_0820_074240_000094F.MP4`는 스테이징 없이 ffprobe/SHA만 보조 확인했다: H.264 3840×1600@30 + AAC 48kHz mono, `382.485313s`, `2,548,039,680B`, SHA-256 `0e2cd865245cc4241aaa5ba9c987c20711aff9c263c2862c3c7f7035e04306da`.
- **범위·현지화·검증 판정**: WebM/MKV 스트리밍·CRF WebCodecs·E-AC-3 pass-through·Dolby Vision metadata 보존은 추가하지 않았다. URL·SEO 메타·정적 페이지 수·광고 위치·비디오 격리의 광고 제외·GitHub Pages 서버리스 구조는 바뀌지 않았고 ko/en key 동형·내부 명칭 비노출·정적 산출 검사가 통과했다. 최종 `npm run build` exit 0(2,363 modules, hybrid audio worker 8.36kB, stream worker 255.88kB, 정적 55페이지), `npm run test:unit` exit 0(106/106), `npm run test:new-tools` exit 0(HWP·이미지·오디오·비디오 전체), `npm run test:utilities` exit 0, `npm run test:static` exit 0, `npm run test:video-hybrid` exit 0, `git diff --check` exit 0. 전체 new-tools 최초 실행 1회는 비디오 도달 전 기존 오디오 redo 대기 60초 timeout이었고, `TEST_ONLY_AUDIO=1 npm run test:new-tools` 및 동일 전체 명령 재실행은 각각 exit 0이었다.
- **배포 CI 환경 교정**: 첫 push `29ba546`의 self-hosted Pages runner에는 시스템 `ffmpeg`/`ffprobe`가 없어 신규 스모크가 fixture 생성 전 `spawn ffmpeg ENOENT`로 종료됐다(제품·테스트 로직 실패 아님). 첫 설치 시도 `986765c`의 AnimMouse action도 runner에 `gh` CLI가 없어 release-id 조회에서 exit 127이었다. 외부 CLI를 요구하지 않는 `FedericoCarboni/setup-ffmpeg` v3.1 commit `37062fbf7149fc5578d6c57e08aed62458b375d6`으로 교체하고 재실행 결과를 배포 run으로 확인했다.

### Excel E-A+E-B — 위장 XLS 서식·입력별 테마색 판정 (Codx)

- **legacy 라우팅·강등 판정**: OLE/SpreadsheetML 시그니처를 공용 헬퍼로 통합하되 보존 화면에서만 두 종류를 정밀 변환 대상으로 삼았다. 일반 화면의 SpreadsheetML은 기존 SheetJS 값 경로와 CDATA 전개를 유지한다. 변환 명령의 파일별 실패는 별도 `degradedLegacy` 경고 상태로 두고 서식·수식을 끈 저장값 경로로 재검사해 병합 가능 상태를 유지한다. 이 값 경로까지 실패하면 해당 파일에 XLSX 재저장 안내를 표시하고, 격리·자산·기동 조건 실패는 추가 배치 전체를 중단한다. Chrome 이벤트 주입 스모크에서 세 분기를 각각 단언했다.
- **테마 판정·명시 제외**: 검사 워커가 각 XLSX의 `xl/theme/theme1.xml`만 ZIP에서 읽어 dk1/lt1/dk2/lt2/accent1~6/hlink/folHlink 순서의 파일 id별 팔레트를 만들고 병합 워커 payload에 전달한다. 누락·손상 팔레트는 오류 없이 현행 theme 참조를 유지한다. ExcelJS가 노출한 솔리드 pattern fill의 fg/bg, font, border 단색만 입력 팔레트 RGB로 베이크하고 gradient fill·rich-text run·DXF·차트/도형/그림은 건드리지 않았다. RGB·indexed(64 포함)·auto도 그대로 둔다.
- **색 정확성 실측**: ECMA-376 HSL 휘도식(음수 `L'=L(1+tint)`, 양수 `L'=L(1-tint)+tint`)과 채널별 최근접 정수/[0,255] 클램프를 적용했다. 6개 accent×tint `-0.25/0/0.6` 고정값 테스트와 서로 다른 테마 2파일 브라우저 병합이 통과했다. 실파일 `(회신필요) 금융기관별 시스템 구축 가능여부 및 담당자 확인 요청.xlsx`의 A1 `accent4=FFC000`, `tint=0.7999816888943144`는 출력 `ARGB=FFFFF2CC`(표시 RGB `#FFF2CC`)였고 `styles.xml`에도 `rgb="FFFFF2CC"`로 기록됐다.
- **AC285·XML 정합 실측**: `dummyfortest/AC285_202606.xls`와 `AC285_20260８５８6.xls`를 보존 화면(formula=1, format=1)에서 함께 병합해 2시트/15,800B 출력 생성. 첫 시트는 33×11, 스타일 셀 330·솔리드 채움 200·글꼴색 330, 둘째는 108×12, 스타일 셀 1,236·솔리드 채움 666·글꼴색 1,236으로 확인했다. 이 출력과 테마 실파일 출력의 `xl/styles.xml`은 각각 `xmllint --noout` exit 0이었다.
- **성능 판정**: 동일 production build·Chrome에서 150×80=12,000개 theme fill/font/border 스타일 셀 병합을 3회 측정했다. 변경 전 `1086.17/1080.28/1076.01ms`(중앙값 `1080.28ms`), 변경 후 `929.00/900.94/950.18ms`(중앙값 `929.00ms`)로 14.0% 감소했다. 입력별 WeakMap 스타일 캐시로 같은 원본 스타일의 반복 베이크/복제를 피했으며 성능 악화 없음으로 판정했다.
- **제품 범위 판정**: 신규 경고·상태 문구는 ko/en 동형이며 사용자에게 내부 처리 명칭이나 원시 예외를 노출하지 않는다. URL·SEO 메타·가이드 의미·정적 페이지 수·광고 배치·광고 제외 격리 경로·GitHub Pages 서버리스 구조는 변하지 않아 SEO/AdSense 코드 변경은 불필요하다.
- **완료 검증**: `npm run build` exit 0(2,358 modules, Excel worker 2,479.26kB, 정적 55페이지), `npm run test:unit` exit 0(103/103), `TEST_SCOPE=excel npm run test:browser`, `npm run test:xls-preserve`, `npm run test:xls-first-load`, `npm run test:static`, 두 출력의 `styles.xml` xmllint, 실파일 재현 및 성능 벤치가 모두 exit 0이었다. `TEST_SCOPE=excel` 최초 실행 1회는 Vite가 새 의존성을 처음 최적화한 직후 자동 reload되어 빈 DOM으로 종료됐고, 서버 로그에서 원인을 확인한 뒤 warm 상태의 동일 명령 재실행이 통과했다.

### 비디오 B3 — 목표 비트레이트 브라우저 인코딩 판정 (Codx)

- **범위·라우팅 판정**: MP4 H.264/HEVC 목표 비트레이트 job만 실제 입력 decoder와 사용자가 선택한 output encoder의 `isConfigSupported()`를 통과한 뒤 새 경로로 보낸다. 코덱을 바꾸지 않고 `hardwareAcceleration:"no-preference"`를 고정했다. CRF·VP9·WebM·MKV, 코덱 설정 미지원, concat 입력 중 FPS unknown은 FFmpeg로 유지했다. 오디오는 remove면 영상만 점진 처리, copy면 AAC mux 호환 시 encoded sample을 보존, encode면 decoder+encoder 설정을 모두 지원할 때만 처리하며 어느 하나라도 미지원이면 오디오-only 하이브리드 없이 job 전체를 FFmpeg로 보낸다. 무음 소스는 오디오 인코더가 필요하지 않은 것으로 판정한다.
- **변환·자원 수명 판정**: B2 점진 MP4 parser와 `mp4-muxer@5.2.2`를 재사용해 keyframe부터 decode하되 선택 범위 밖 frame을 버리고, worker의 `OffscreenCanvas`에서 중앙 aspect crop 또는 concat source 비율 letterbox/pillarbox, scale, 0/90/180/270도 rotation, 최종 수평 flip을 적용한다. concat은 모든 입력의 실측 FPS 중 최댓값과 첫 입력 기반 공통 해상도로 CFR 샘플링한다. video decode 합산 큐 8, encode 큐 6, audio decode 합산 큐 12, encode 큐 8에서 backpressure를 걸고 모든 decoded/generated `VideoFrame`·`AudioData`를 닫는다. 정상·실패·취소 모두 codec flush/close를 시도하고 OPFS 부분 파일을 폐기하며, worker 기동 제한 60초는 ready 이후 해제해 장시간 인코딩을 중단하지 않는다.
- **출력·오케스트레이터 판정**: job별 B4 오케스트레이터의 demux/decode/encode/mux/write 진행률과 1.5GiB 안전 폴백 계약을 유지하고 B2 random-access target에 `StreamTarget(chunked:true, chunkSize:1MiB)`·`fastStart:false`로 기록한다. Chrome 계측은 입력 전체 `arrayBuffer()` 0회, slice 4회/최대 725,642B, output write 3회/최대 1,048,576B·누적 단조, decoded 180/encoded 180/closed video frame 360, 최대 decode/encode queue 8/5를 확인했다. 취소 뒤 `result-*` 부분 파일은 0건이었다.
- **속도·정확성 실측**: Chrome 152/Linux, COI=true, 고정 fixture `tests/fixtures/video-vp9-benchmark.mp4`(725,642B, SHA-256 `15115424e7ed5e2bd589c392b87fea726e204f685151b744a5b3baa299b276c5`)에서 H.264 2Mbps+AAC sample copy를 warm-up 1회 후 각각 3회 측정했다. 제품 오케스트레이터 worker 실행부터 결과 완료까지 새 경로 `362.385/351.585/354.490ms`(중앙값 `354.490ms`), FFmpeg.wasm `1648.970/1545.495/1581.195ms`(중앙값 `1581.195ms`)로 새 경로가 `4.460×` 빨랐다. 1,603,615B 출력은 H.264/avc1 640×360 30fps+Aac, 전체 decode exit 0, 브라우저 재생 성공, `mdat` 뒤 `moov`였다.
- **변환·동기·폴백 실측**: 9:16 crop+90도 rotation+flip+audio remove의 2입력 concat은 새 route, 640×360/12초/2,134,342B로 재생됐다. 1.650–4.450초 trim은 video 2.800000초, audio 2.808667초이고 첫 video/audio DTS 정렬 오차 `0ms`(기준 ≤50ms), 전체 decode와 브라우저 재생이 통과했다. 이 Chrome에는 `AudioEncoder` 생성자는 있으나 AAC 설정 지원이 false여서 capability `AUDIO_ENCODER_UNSUPPORTED`, 최종 route `ffmpeg`를 실제 확인했다. 누락 AudioEncoder와 선택 video codec 지원 거부도 단위 테스트에서 전체-job 폴백으로 고정했다. 보고서: `/tmp/worklazy-video-webcodecs-b3-final/video-webcodecs-benchmark.json`.
- **현지화·배포 표면·검증 판정**: 사용자 문구는 처리 방식 대신 행동·결과 중심 ko/en으로 맞췄고 DOM 금칙어에 VideoEncoder/VideoDecoder/AudioEncoder/AudioDecoder/OffscreenCanvas를 추가했다. URL·SEO 메타·정적 페이지·광고 위치·광고 제외 격리·GitHub Pages 서버리스 계약은 변하지 않아 별도 SEO/AdSense 변경은 불필요하다. `npm run build` exit 0(2,358 modules, 스트리밍 worker 249.95kB, 정적 55페이지), `npm run test:unit` exit 0(100/100), `npm run test:new-tools`, `npm run test:utilities`, `npm run test:static`, `git diff --check`, 벤치 명령이 모두 exit 0이었다.

### 비디오 B2 — MP4/MOV 패스스루 스트리밍 판정 (Codx)

- **의존성·지연 로드 판정**: B1b에서 Mediabunny 1.55.5가 B-frame trim 종료 오차 2프레임으로 기각된 판정을 유지하고 `mp4box@2.4.1`(BSD-3-Clause)과 deprecated를 감수한 `mp4-muxer@5.2.2`(MIT)를 exact lock했다. 라이선스 생성기가 두 패키지와 타입 의존성 고지를 자동 반영했다. 두 라이브러리는 별도 `videoStream.worker` chunk 안에서만 정적 import하며 Chrome 요청 계측에서 비디오 페이지 진입·파일 선택까지 요청 0건, 패스스루 preflight/실행 때만 요청됨을 확인했다. 빌드 결과 워커는 `232.46kB` 독립 chunk였다.
- **preflight·route 판정**: `File.slice()`와 `fileStart`를 붙인 점진 append로 실제 video/audio track을 읽고 codec 이름·sample entry·`avcC`/`hvcC`·AAC AudioSpecificConfig·해상도·채널·sample rate·edit/sample table을 비교한다. H.264+AAC MP4, H.264+AAC MOV, HEVC+hvc1 MP4, 동일 파라미터 concat은 stream-copy, VP9 WebM·VP9 MKV와 해상도/구성 불일치 concat은 FFmpeg로 판정했다. 상위 오케스트레이터는 한 요청 안에서도 job별로 두 경로를 혼합 실행한다. 스트리밍 실패 예상 출력이 `1.5GiB` 이하일 때만 FFmpeg 재시도, 초과 시 ko/en 안전 오류로 종결하고 1.5GiB 사전 가드는 FFmpeg job에만 남겼다.
- **샘플·출력 계약 판정**: 선택 시작 이전 최근접 video sync sample부터 decode timestamp가 선택 종료보다 작은 sample까지 복사하고, audio는 스냅된 video 첫 DTS부터 선택한다. concat은 완전 동일한 track profile만 segment offset으로 이어 붙인다. 입력 sample은 최대 `8MiB` window, metadata는 `1MiB` chunk로 읽고, 출력은 `StreamTarget(chunked:true, chunkSize:1MiB)`·`fastStart:false`로 A4 세션의 random-access 임시 파일에 직접 기록한다. `fastStart:"in-memory"`, WebM 스트리밍, WebCodecs 인코딩은 도입하지 않았다.
- **2GiB 초과 실측**: `node scripts/benchmark-video-stream-copy.mjs --output-dir /tmp/worklazy-video-stream-copy-b2-final`로 70.4초/2,112-frame 합성 H.264 fixture를 실제 Chrome 제품 워커 경로에 넣었다. 입력과 ffprobe 확인 출력은 모두 `2,214,602,200B`로 2GiB를 `67,118,552B` 초과했다. 입력 전체 `arrayBuffer()`는 `0`회, slice read `267`회/총 `2,215,650,779B`/최대 `8,388,608B`; 출력은 `2,114`회 write/최대 `1,048,576B`, 누적 write byte는 끝까지 단조 증가했다. 출력 video는 H.264/avc1, `70.400000s`, 2,112 packets의 DTS가 단조 증가했고 취소 뒤 `result-*` 부분 파일은 `0`건이었다. 보고서는 `/tmp/worklazy-video-stream-copy-b2-final/video-stream-copy-benchmark.json`이다.
- **키프레임·A/V 수치 판정**: 1.650–4.450초 B-frame trim에서 원본의 선택 이전 최근접 keyframe PTS는 `1.000000s`였고 신규 스냅도 `1.000000s`로 오차 `0ms`였다. 원본·현행 FFmpeg copy·신규 출력 첫 video packet SHA-256은 모두 `80c25aaf78cda8b121abd10e1a1692074587ca096892671042d3ac2edee30a09`로 동일했다. FFmpeg와 신규 video duration은 모두 `3.533333s`로 오차 `0프레임`, 신규 첫 video/audio DTS는 모두 `0.000000s`로 정렬 오차 `0ms`; 신규 271개 packet의 stream별 DTS도 단조 증가했다. 동일 profile 2구간 concat 출력도 H.264/AAC 354 packets의 DTS 단조성을 통과했다.
- **현지화·SEO·배포 표면 판정**: 점진 저장·원본 화질 복사·대용량 안전 오류를 ko/en 동일 키로 추가하고 UI/DOM에서 OPFS·SyncAccessHandle·zip.js·mp4box·mp4-muxer·WebCodecs·remux·worker 비노출을 검사했다. URL·검색 의미·정적 페이지·광고 위치·광고 제외 격리 경로·GitHub Pages 서버리스 계약은 변하지 않아 별도 SEO/AdSense 변경은 불필요로 판정했다.
- **완료 검증**: `npm run build` exit 0(2,358 modules, 정적 55페이지), `npm run test:unit` exit 0(97/97), `npm run test:new-tools` exit 0(HWP·이미지·오디오·비디오 전체와 스트리밍 워커 지연 로드), `npm run test:utilities` exit 0, `npm run test:static` exit 0. `git diff --check`와 2GiB 실측 명령도 exit 0이었다.

### 비디오 B4 — route·오케스트레이터·진행률 기반 판정 (Codx)

- **route 결정표 판정**: 순수 함수 입력을 컨테이너(MP4/MOV/MKV/WebM)·코덱(H.264/HEVC/VP9)·bitrate(copy/CRF/target)·audio(copy/remove/encode)·OPFS 가용성·quota(enough/insufficient/unknown)로 고정했다. MP4/MOV+H.264/HEVC의 copy는 stream-copy, target bitrate는 WebCodecs 후보로 분류하되, B2/B3 미구현 상태에서는 648개 범주 조합 전부를 사유 코드와 함께 FFmpeg로 확정했다. MKV/WebM·VP9·CRF·copy+audio encode는 적합성 단계에서 FFmpeg로 남고, OPFS 미지원·quota 미확인/부족은 별도 사유로 구분했다.
- **용량·폴백 판정**: job 선택 구간의 예상 출력 크기를 route 계획에 저장하고, 스트리밍 실패 시 `1.5GiB` 이하만 FFmpeg 폴백, 초과·미확정은 reject로 고정했다. 페이지는 job 생성→OPFS/quota route preflight→`decision.route === "ffmpeg"` job의 1.5GiB 가드 순서로 바꿨다. 현재 route가 모두 FFmpeg이므로 기존 패스스루 제한과 사용자 동작은 동일하다.
- **오케스트레이터·진행률 판정**: `videoProcessingClient.ts`가 job route 계획과 실행을 소유하고 `videoWorkerClient.ts`는 FFmpeg 전용 어댑터로 유지했다. 단계 가중치는 demux/decode/encode/mux/write=`10/25/40/15/10%`로 두고, job별 영상 처리는 선택 duration, 결과 쓰기는 예상 bytes로 전체 진행률을 집계한다. 하위 콜백의 하락 값은 단조 가드가 이전 값으로 유지하고, resolve/reject 종결 후는 모든 이벤트를 차단한다. `useOperationProgress` 역시 단조 정규화와 종결 상태 지연 update 차단을 적용했다.
- **공통화·동작 동등성 판정**: `video.worker.ts` private이던 출력 이름·MIME·warning·오류 정규화·output count를 `videoProcessingShared.ts`로 추출했다. 이름/MIME 전 출력군, warning 조합·다중 route 개수 합산, quota/OOM/codec/일반 오류를 단위 테스트했다. 실제 브라우저 전체 스모크에서 개별·그룹 concat 비디오 결과, A3 세그먼트 정리, A4 File/ZIP64·오디오 handoff가 전부 통과해 사용자 가시 변화 0을 확인했다.
- **현지화·SEO·AdSense·범위 판정**: 새 사용자 문구를 추가하지 않아 ko/en 번역 변경은 불필요했다. 두 locale의 비디오 문구와 브라우저 DOM에서 OPFS·SyncAccessHandle·zip.js·WebCodecs·remux·worker 비노출을 검사했다. URL·SEO 메타·정적 페이지·광고 배치·격리 경로·서버 전제는 변화가 없고 정적 검증이 통과했다. B2/B3 스트리밍 워커·실제 스트리밍 분기는 추가하지 않았다.
- **완료 검증**: `npm run build` exit 0(2,355 modules, video worker 26.87kB, 정적 55페이지), `npm run test:unit` exit 0(94/94), `npm run test:new-tools` exit 0(HWP·이미지·오디오·비디오 전체), `npm run test:utilities` exit 0(ko/en·비디오 호환 포함), `npm run test:static` exit 0. `test:new-tools` 최초 1회는 preview 미기동으로 `ERR_CONNECTION_REFUSED`로 검증 시작 전 종료되었고, 빌드 산출물 preview 기동 후 동일 명령 재실행이 통과했다. `git diff --check`도 exit 0.

### 이미지 P3 — 레이어·다중 선택·컨텍스트 메뉴 판정 (Codx)

- **고정 블록·공통 순서 판정**: `[base,effects…,additional…,overlay…]`를 만드는 공통 helper를 신설하고 미니바 front/back, 레이어 패널 Sortable 재정렬, 컨텍스트 메뉴가 모두 같은 이동 함수만 사용하게 했다. `back`은 effect 개수와 무관하게 고정 블록 바로 위, `front`는 추가 레이어 최상단으로 제한하며 base·effect·crop overlay의 이동 요청은 거부한다. effect는 목록에 노출하지 않고 base 표시 상태를 강제 상속한다. 단위 테스트에서 뒤섞인 6객체를 고정 순서로 복원하고 세 이동 경로의 base/effect 거부를 확인했다.
- **레이어 상태·히스토리 판정**: 목록은 Fabric z순을 역순으로 표시하고 객체별 WeakMap ID로 선택을 연결한다. `moveObjectTo`와 `visible`이 이벤트를 내지 않는 전제를 따라 재정렬·표시 변경마다 즉시 snapshot과 패널 동기화를 수행했다. 활성 레이어 숨김은 단일 선택을 해제하거나 남은 ActiveSelection을 재구성하며, base 숨김은 모든 effect를 함께 숨긴다. Chrome에서 추가 레이어와 base 표시 변경 각각의 undo→redo→undo, 패널 재정렬 undo, 정렬 undo/redo, 다중 복제 undo/redo 뒤 패널 상태와 고정 순서를 직접 읽어 일치함을 확인했다. 숨긴 텍스트 레이어의 PNG data URL이 표시 상태와 달라 export 제외도 확정했다.
- **선택·정렬·복제 판정**: 데스크톱에서 Fabric `selectionKey=shiftKey`와 러버밴드를 켜고, selection hook이 base를 제거한 뒤 잔여 0/1/복수에 맞춰 해제·단일·ActiveSelection으로 강등/재구성한다. 실제 base 우선 Shift 선택은 base+텍스트에서 텍스트 단일로 강등되고 두 번째 도형 추가 시 base 없는 2객체 선택이 됐다. 러버밴드는 unlocked base를 후보로 포함시킨 상태에서도 추가 레이어 3개만 남겼다. 회전 `-8°/23°/-17°`, 비균일 scale 3객체를 scene `getBoundingRect()` 기준으로 좌·가로중앙·우·상·세로중앙·하 6종 × zoom 100/200%에서 정렬했고 12조합 모두 bbox 좌표 편차 0.75px 이하를 통과했다. 다중 복제는 구성 객체를 z순으로 각각 clone하고 24px scene translation을 합성해 활성 clone의 종류·상대 z순을 원본과 같게 유지했다.
- **우클릭·보호 경로 판정**: document 전역 contextmenu 공급은 기각하고 Fabric 7.4의 `instance.on("contextmenu")`만 사용했다. 일반 객체 메뉴는 복제·삭제·앞/뒤, IText는 편집 진입을 추가하며 ActiveSelection은 복제·삭제·6정렬만 제공한다. base·effect·빈 캔버스는 메뉴를 만들지 않고 Fabric upper canvas의 기본 메뉴만 억제했으며 캔버스 밖 우클릭은 `defaultPrevented=false`를 유지했다. Escape·외부 pointerdown·resize·scroll 네 닫힘 조건과 ko/en 문구를 실제 우클릭으로 확인했다. 객체 붙여넣기 공급원이 없고 복제로 요구를 충족하므로 클립보드 상태·붙여넣기 항목은 도입하지 않았다.
- **P4 입력 교차·모바일 판정**: 기존 touch-safe 비주버튼 guard와 crop 박스 target 조기 반환을 유지했다. zoom 200%에서 Space+드래그는 VPT만 바꾸고 ActiveSelection을 만들지 않았으며 crop 모드 드래그는 crop overlay가 소유하고 러버밴드를 만들지 않았다. 기존 P4 crop/effect 동작과 crop overlay 8조합(변형 유무×zoom 100/200%×지우개 유무)은 geometry/saved error 모두 0px로 재통과했다. 390×844에서는 `selection=false`, `selectionKey=null`, layers 하단 시트·44px 이상 행 버튼·패널 유지·삭제 동기화를 확인해 모바일 다중 선택 제외를 고정했다.
- **현지화·SEO·배포 표면 판정**: layers/유형/표시/삭제/정렬/우클릭/다중 선택 문구를 ko/en 동일 키로 추가했고 내부 Fabric 명칭·원시 예외는 화면에 노출하지 않았다. 기존 도구 메타와 SEO featureList가 이미 통합 편집 및 “텍스트·도형·스티커 레이어”를 명시하므로 URL·검색 의미·가이드 정합은 유지되며 별도 SEO 문구 변경은 불필요로 판정했다. 정적 페이지 수, GitHub Pages 단일 페이지 전제, 광고 위치와 광고 제외 격리 경로는 바뀌지 않았다.
- **완료 검증**: `npm run build` exit 0(2,351 modules, Image Studio 416.67KB/129.16KB gzip, 정적 55페이지), `npm run test:unit` exit 0(82/82), `TEST_ONLY_IMAGE=1 npm run test:new-tools` exit 0(P3 전체+P4 전체+DPR/effect), `npm run test:utilities` exit 0, `npm run test:static` exit 0. `git diff --check`와 `node --check tests/new-tools-smoke.mjs`도 exit 0.

### 비디오 A4 — 결과 저장 추상화·스트리밍 ZIP 판정 (Codx)

- **결과 계약·완료 순서**: `VideoWorkerOutput`을 buffer 전용에서 buffer/File/브라우저 임시 파일 참조 공통 계약으로 확장했다. 처리 워커는 완성 바이트를 워커 전용 동기 파일 핸들(미지원 시 비동기 writable)에 먼저 기록한 뒤 참조만 전달한다. 클라이언트의 출력 콜백은 직렬 Promise 큐로 대기해 마지막 `result` 이벤트가 먼저 와도 모든 File 해석·UI 저장이 끝나기 전 작업 성공을 resolve하지 않는다.
- **수명주기·폴백 판정**: 실행마다 난수 세션·소유 ID와 24시간 lease를 만들고, 시작 시 공유 루트 전체가 아니라 만료된 `session-*`만 청소한다. 소유 메타데이터가 다른 세션은 release하지 않으며 성공 파일은 유지하고 실패·취소 시 부분 파일만 삭제한다. 저장 방식 미지원 또는 일반 쓰기 실패는 기존 메모리 결과로 자동 전환한다. 용량 부족은 결과 예상 크기와 16MiB/5% 여유를 검사해 128MiB 이하만 메모리 폴백하고 그보다 크면 내부 명칭·원시 예외 없이 안전 오류를 표시한다. 단위 테스트에서 성공·미지원·소유권 불일치 폴백·용량 부족 소/대 분기·활성 쓰기 취소·TTL 잔재 청소·소유자 전용 해제를 통과했다.
- **메인 힙 실측**: Chrome 152/Linux/16 logical CPU·16.69GB RAM에서 `node scripts/benchmark-video-result-storage.mjs --runs 3 --outputs 4 --bytes-per-output 67108864 --output-dir /tmp/worklazy-video-result-storage-a4`를 실행했다. 64MiB 결과 4개(총 `268,435,456B`)의 File wrapper와 object URL을 모두 유지하고 강제 GC 뒤 측정한 세 실행의 메인 JS 힙 증분은 모두 `69,604B`, worker→main 전송 ArrayBuffer는 `0`이었다. 출력 바이트/힙 바이트 비율은 `3,856.61`, 결과 크기 대비 힙 상주 비율은 `0.02593%`였다.
- **ZIP 구현·스트리밍 실측**: 비디오 경로의 JSZip 참조를 0건으로 만들고 `@zip.js/zip.js@2.9.0`을 exact lock했다. `BlobReader` 입력을 `for` 루프의 순차 `await ZipWriter.add`로만 추가하고 입력·출력 모두 `bufferedWrite:false`, 각 add와 close에 `zip64:true`를 강제했다. 프로덕션 helper의 `8,388,731B` 계측 입력은 전체 `arrayBuffer()` `0`회, stream `1`회, `129`개 입력 구간·최대 `65,536B`; ZIP 출력은 `8,389,205B`를 `136`회 write·최대 `65,536B`로 기록했다. ZIP64 EOCD·locator·classic EOCD를 모두 확인하고 런타임 fixture를 시스템 `unzip -t/-p`로 왕복해 payload SHA-256 동일성을 통과했다.
- **브라우저 회귀·번들 판정**: 실제 Chrome 비디오 스모크에서 그룹 결과 2개가 세션 임시 파일로 남고 ZIP도 같은 세션의 ZIP64 파일로 생성됨을 확인했다. ZIP 워커 요청은 화면·결과 생성 전 `0`건, ZIP 버튼 뒤 정확히 `1`건으로 지연 로드를 유지했다. 사용자 화면에는 내부 저장/라이브러리 명칭이나 원시 번역 토큰이 없고, 새 ko/en 임시 파일 안내와 오디오 스튜디오 BroadcastChannel handoff도 통과했다. URL·검색 의미·정적 SEO 페이지·광고 위치·광고 제외 격리 경로·서버 전제는 바뀌지 않아 추가 SEO/AdSense 코드는 불필요로 판정했다.
- **의존성·범위 판정**: 라이선스 생성기가 zip.js 2.9.0 BSD-3-Clause 고지를 자동 반영했다. JSZip은 다른 도구가 사용하므로 전역 제거하지 않고 비디오 경로에서만 교체했다. B1b에서 기각된 Mediabunny는 manifest·lock·소스에 추가하지 않았고 B4·B2·B3은 진행하지 않았다.
- **완료 검증**: `npm run build` → exit 0(2,348 modules, video worker 26.76kB, ZIP worker 144.66kB, 정적 55페이지), `npm run test:unit` → 79/79, `npm run test:new-tools` → HWP·이미지·오디오·비디오 전체 통과, `npm run test:utilities` → ko/en·비디오 호환 포함 통과, `npm run test:static` → 현지화 페이지·self-hosted 런타임·ads/robots/sitemap 통과. `git diff --check`와 비디오 경로 JSZip 0건 검사도 통과했다.

## 2026-09-02

### 비디오 A3 — concat 세그먼트 오프로드 실측·판정 (Codx)

- **구현 판정**: 각 세그먼트 생성 직후 `readFile`→`Blob`→`deleteFile` 순서로 MEMFS 파일을 즉시 해제하고, 전체 Blob을 `processConcatJob` 지역 mount 수명주기에서 WORKERFS로 재마운트했다. concat list는 `-safe 0`과 `/worklazy-concat-segments-<job>/...` 절대경로를 쓴다. mount 디렉터리는 operation 성공·실패 모두 `finally` unmount/delete하며 전역 `mountedDirectories`에 소유권을 넘기지 않는다.
- **1GB급 실측 절차**: Chrome 152/Linux/16 logical CPU·16GiB·COI=true에서 배포 MT FFmpeg.wasm 0.12.10을 사용했다. `node scripts/benchmark-video-concat-memory.mjs --output-dir /tmp/worklazy-video-concat-memory-a3 --runs 3 --comparison-inputs 8 --boundary-high 40 --case-timeout-ms 720000` → 14초 640×360 H.264 고엔트로피 fixture `149,833,058B`, SHA-256 `7fd34d3d…fc02a`를 8개 논리 입력(`1,198,664,464B`)으로 마운트하고 각 4.5초를 패스스루 세그먼트로 만들었다. warm-up 1회 후 before/after 각 3회, Chrome 루트+모든 하위 프로세스 RSS를 100ms로 표본화했다.

| 지표(3회 중앙값) | before: 세그먼트 MEMFS 누적 | after: Blob+WORKERFS 오프로드 | 변화 |
|---|---:|---:|---:|
| MEMFS 파일 합계 피크 | 750,799,433B | 375,397,665B | -50.00% |
| Chrome 프로세스 합산 RSS 피크 | 4,271,190,016B | 3,424,997,376B | -19.81% |
| 경과 시간 | 8,780ms | 10,102ms | +15.06% |
| 출력 크기 | 375,397,362B | 375,397,362B | 동일 |

- **바이트 동일성**: before/after 6회 출력 SHA-256은 모두 `0f5f880412bbe00e1d461d1ec8aa95f77831c01a721aa6070758f8e648d9eefb`, 전체 decode exit 0. 현행 1.5GiB 패스스루 출력 가드 내 최대인 33개 입력(`4,944,490,914B` 논리 합계, 선택분 예상 `1,589,300,651B`)도 양쪽 모두 성공해 **성공 상한 증가는 관측되지 않았고 34개부터 기존 가드가 먼저 차단**한다. 33개 출력은 양쪽 `1,548,511,476B`, SHA-256 `614f7778…10a` 동일이며 MEMFS 피크는 `3,097,045,045B`→`1,548,512,752B`.
- **효과 범위**: 결론은 **“고정 wasm/MEMFS 압박 해제”**로 한정한다. `readFile`→Blob→delete 순간의 MEMFS+JS/Blob 일시 중복은 남고 총 메모리 감소를 보장하지 않는다. 실제로 1GB급 3회 중앙 RSS는 낮았지만 33개 단일 상한 실행에서는 after RSS `7,134,687,232B`가 before `6,894,424,064B`보다 높았다. 따라서 wasm buffer 1GiB는 측정 지표에서 제외하고 MEMFS 파일 합계와 브라우저 프로세스 RSS를 분리해 기록했다.
- **정리 스모크**: 실 FFmpeg WORKERFS mount 후 조인 실패형 `Error`와 취소형 `AbortError`를 각각 강제했고 루트 `listDir` 잔재가 모두 0건이었다. 단위 테스트도 `read`→`delete` 순서와 성공·실패·취소 정리 4건을 통과했다. 외부 취소는 현행 클라이언트가 전용 Worker를 종료하므로 해당 인스턴스의 MEMFS/WORKERFS 자체가 폐기된다.
- **완료 검증**: `npm run build` → exit 0(2,346 modules, video worker 22.46kB, 정적 55페이지), `npm run test:unit` → 69/69, `TEST_ONLY_VIDEO=1 npm run test:new-tools` → grouped concat 포함 비디오 스모크 통과, `npm run test:new-tools` → HWP·이미지·오디오·비디오 전체 통과, `npm run test:utilities` → ko/en·비디오 격리 포함 통과, `npm run test:static` → 현지화 페이지·self-hosted 런타임·ads/robots/sitemap 통과.
- **동반 영향**: 사용자 문구·URL·SEO·정적 페이지·광고 배치·광고 제외 격리 경로·서버 전제는 바뀌지 않아 ko/en·SEO·AdSense에 추가 코드 변경은 불필요로 판정했다.

### 이미지 P4 착수 3묶음 — 크기·내보내기·접이식 패널 판정 (Codx)

- **리샘플 판정**: 작업 캔버스 상한을 4096px로 두고 base·회전 도형·그리기 등 일반 객체의 기존 `calcTransformMatrix()` 앞에 전역 scale 행렬을 합성해 `util.applyTransformToObject`로 적용했다. region-effect는 직접 변환에서 제외하고 base의 원본 로컬 anchor로 다시 동기화했다. 1800×1200 fixture를 둔 900×600 작업공간에서 회전 도형·base를 1200×720 비균일 리샘플했을 때 합성 행렬과 일치했고 효과 행렬도 anchor 산식과 일치했다. 비율 잠금은 가로 1200 입력을 1200×800으로 계산했고, 잠금 해제 뒤 1200×720을 독립 적용했으며 5000 입력은 4096×2731로 제한됐다. 치수 변경 뒤 view는 100%로 초기화됐다.
- **캔버스·히스토리 판정**: 1200×720→400×300 변경은 모든 객체에 중앙 이동 `dx=-400`, `dy=-210`을 적용했고 캔버스 밖으로 잘린 객체를 포함해 객체 수를 보존했다. 치수 undo/redo 모두 1200×720↔400×300과 100% view reset을 복원했다. 모든 메모리 스냅샷에 `outputMultiplier`가 저장됨을 확인하고 이전 스냅샷 값을 1로 강제한 검증에서 undo 결과 안내가 900×600, redo가 원본 화질 배율 결과로 되돌아와 restore 배선을 확정했다. 파일 로드·빈 캔버스·restore 외 크기 작업에서는 multiplier를 바꾸지 않았다.
- **내보내기 판정**: 원본 화질은 기존 multiplier 렌더를 유지하되 4096px 작업 폭에서 결과 폭이 8192px을 넘지 않도록 유효 multiplier를 자동 축소하고 실제 8192px 결과 안내를 표시했다. 지정 크기는 VPT identity의 1× 결과를 목적지 캔버스에 재렌더한다. 잠금 ON 600×400과 잠금 OFF 600×600 결과에서 녹색 대조군 가로폭은 동일하고 세로만 1.4배 이상 늘어 균일/스트레치 분기를 확인했으며, 200% view에서도 data URL이 byte-identical이었다. 9000 입력은 8192로 제한됐다.
- **접이식 판정**: 우측 패널 토글은 `sessionStorage`로 기억되고 821·1020·1440px에서 패널이 사라진 만큼 stage 폭과 반응형 canvas fit이 증가했으며 ResizeObserver가 선택 미니바를 재계산했다. 1020px 접힘 뒤 reload에서도 유지됐고 820·390px에서는 저장값을 무시해 패널을 상대 위치 하단 시트로 강제 표시하고 토글을 비활성화했다. 821px로 돌아오면 저장된 접힘이 다시 적용됐다. sticky canvas는 데스크톱 전 구간에서 유지됐고 ko/en 라벨·aria를 확인했다.
- **완료 검증·동반 영향**: `npm run build`(2,346 modules, Image Studio lazy chunk 402.23KB/125.51KB gzip, 정적 55페이지) · `npm run test:unit`(65/65) · `TEST_ONLY_IMAGE=1 npm run test:new-tools`(P4 1·2묶음과 DPR/effect 회귀 포함) · `npm run test:utilities` · `npm run test:static` 전부 통과했다. 크기·출력 기능은 ko/en UI와 이미지 가이드·도구 메타·SEO featureList를 함께 갱신했다. URL·사이트맵 구조·광고 위치·광고 제외 격리 경로·서버 전제는 바뀌지 않아 AdSense/GitHub Pages 계약에 추가 변경이 없다.

### 이미지 P4 착수 2묶음 — 편집 가능한 자르기 박스·비율 경계 판정 (Codx)

- **박스 편집 판정**: crop overlay만 selectable/evented인 전용 객체로 두고 코너4+변4 컨트롤을 구성했다. 회전·skew 컨트롤은 없고 flip lock을 고정했으며, 박스 위 좌클릭은 Fabric 이동/scale에 위임하고 밖 좌클릭만 한 개의 새 박스로 교체한다. 이동·scale 중 캔버스 경계를 넘지 않았고 scale 동안 패널/플로팅 px 라벨이 변한 뒤 `object:modified`가 정확히 1회 발생해 `scaleX=scaleY=1`·정수 width/height로 정규화됐다. 일반 선택·Delete·미니바·히스토리에는 잡히지 않았다.
- **비율 판정**: `cropTo`의 900px 캔버스 재구성을 폐기하고 1:1·4:3·3:4·16:9·9:16+자유를 박스 상태로 분리했다. 기존 박스는 `w'=min(w,h×r)` 축소 우선 뒤 중심 유지·경계 이동·최소 확대 순으로 바뀌고 모든 preset이 ±1px 비율 오차를 통과했다. preset에서는 코너 4개만, 자유에서는 8개가 노출됐다. 경계의 9:16 최소 결과는 `10×18px`, 10×10 캔버스에서는 9:16이 ko 사유 tooltip과 함께 비활성화됐다. 무박스 preset 드래그와 적용 뒤 비율 유지, 자유 상태 Shift 드래그/핸들 1:1, Alt 드래그/핸들 중심 유지도 통과했다. Fabric 전역 `uniformScaling=true`는 바꾸지 않았다.
- **입력·소유권·출력 판정**: 박스 안/밖 좌클릭과 안/밖 우클릭 네 분기, 단일 touch 드래그, 200% zoom+Space pan 후 핸들 적중, 두 손가락 pinch 뒤 박스 기하 동일을 실동작으로 검증했다. crop↔effect 전환 시 상대 overlay 수는 항상 0이었고, crop 박스를 직접 제거해 내보낸 결과는 박스 취소 뒤 결과와 byte-identical data URL이었다. 핸들 조정 뒤 적용 캔버스 치수는 선택 정수 치수와 정확히 같고 합성 fixture의 녹색 대조군 픽셀도 보존됐다.
- **회귀·완료 검증**: `npm run build`(TypeScript+Vite, 2,346 modules, 55 정적 페이지) · `npm run test:unit`(65/65) · `TEST_ONLY_IMAGE=1 npm run test:new-tools` · `npm run test:utilities` · `npm run test:static` 전부 통과. P4-0 합성 8조합도 표시/저장·적용 오차 `0px`, 저장 치수 오차 `0px`, 펜·지우개·녹색 대조군 보존을 유지했다. 최초 이미지 스모크 사전 시도 1회는 preview 미기동으로 `ERR_CONNECTION_REFUSED`가 나 검증 시작 전 중단됐고, 로컬 preview 기동 후 동일 명령을 재실행해 통과했다.
- **동반 영향 검토**: crop 조작 안내와 극단 비율 사유는 ko/en을 함께 갱신했다. 기능 URL·핵심 검색 의미·SEO 메타데이터·가이드 정적 페이지·광고 위치·광고 제외 격리 경로는 바뀌지 않아 추가 변경 불필요로 판정했다. P4-3 크기 도구와 P4-4 접이식 패널은 건드리지 않았다.

### 이미지 P4 착수 1묶음 — overlay 좌표·상태 의미·선택 UI 판정 (Codx)

- **P4-0 판정**: crop/effect `Rect`의 `originX/Y`를 `left/top`으로 고정하고 비선택·비이벤트·내보내기 제외 속성을 유지했다. effect anchor는 계속 원본 이미지 로컬 좌표이고 히스토리는 세션 메모리뿐이므로 마이그레이션은 불필요하다. 합성 fixture(600×400 회색 바탕+녹색 대조군, `dummyfortest` 미사용)에서 없음/이동+90° 회전+flip × crop zoom 100/200% × 지우개 유무 8조합 모두 stroke 제외 overlay 표시-저장·적용 최대 오차 `0px`, 박스 안 펜 보존, 대조군 보존을 통과했다.

| base 변형 | zoom | 지우개 | 펜 픽셀 적용 전→후 | 지우개 투명 픽셀 | 녹색 대조군 | 기하/저장 오차 |
|---|---:|---:|---:|---:|---:|---:|
| 없음 | 100% | 없음 | 5,563→5,560 | 0→0 | 2,400→2,360 | 0/0px |
| 없음 | 100% | 있음 | 3,987→3,981 | 1,962→1,944 | 2,400→2,360 | 0/0px |
| 없음 | 200% | 없음 | 5,554→5,560 | 0→0 | 2,400→2,399 | 0/0px |
| 없음 | 200% | 있음 | 4,030→4,033 | 1,962→1,973 | 2,400→2,399 | 0/0px |
| 이동+회전+flip | 100% | 없음 | 5,545→5,549 | 0→0 | 2,400→2,399 | 0/0px |
| 이동+회전+flip | 100% | 있음 | 3,984→3,980 | 1,962→1,944 | 2,400→2,399 | 0/0px |
| 이동+회전+flip | 200% | 없음 | 5,553→5,559 | 0→0 | 2,400→2,400 | 0/0px |
| 이동+회전+flip | 200% | 있음 | 4,026→4,024 | 1,962→1,973 | 2,400→2,400 | 0/0px |

- **P4-1 판정**: crop/effect overlay ref·selection·clear와 Escape 분기를 분리했다. 자르기는 버튼·Enter 적용 때만 interaction mode와 active panel이 함께 select로 바뀌며 취소·Escape는 박스만 지우고 crop을 유지했다. effect 취소·Escape도 박스만 지우고 effect 모드/패널을 유지했다. `cropTo`와 P4-2/3/4 표면은 변경하지 않았다.
- **P4-5 판정**: 자르기 적용 버튼을 항상 렌더하고 영역 전에는 disabled + 눈에 보이는 ko/en 사유 + `aria-describedby`를 연결했으며, 활성 상태는 기존 `accent-sky` gradient를 재사용했다. crop/effect 모두 드래그 중 패널 W×H와 박스 우하단 라벨이 갱신됐고 두 overlay 기하 오차는 각각 `0px`였다.
- **동반 영향 검토**: 사용자 문구는 ko/en 동시 반영했다. 기능 URL·의미·SEO 메타데이터·가이드·정적 페이지·광고 위치·광고 제외 격리 경로는 바뀌지 않아 추가 변경 불필요로 판정했다.

### Word 비교 후속(서식 위양성·작성자 통일) — 8왕복 계획·재현 판정 (Claude·Codx·Gemini)

- 위양성 기전: 서명이 런 경계를 `||`로 포함해 proofErr/rsid 분절이 서식 변경으로 오인 — Gemini 전수 분석(127건)·Claude 독립 재계산(124건)·Codex 기본 UI 실측(133건, 방법론 차 정정). 시각 서식 실차이는 highlight 4건뿐(당시 웹 미검출).
- 기각·정정: tracked_docx에 동일 병합 적용안은 문자 토큰 실측으로 기각(Claude 판정 오류 정정) / (작성자,본문) 집합 메모 매칭은 중복 반례로 기각 → durableId→paraId→one-to-one 소비 채택(실 DOCX 식별자 실측) / "생성기 미산출·운영 404" 가설 기각.
- 구현 재현: dummyfortest 계약서에서 웹 133→4, OFF 추적 DOCX cyan highlight 4건, ON 신규 리비전 10건 통일·기존 메모 6건 보존·SML 신규 2건 재작성, identity 3파트 바이트 동일, LibreOffice 변환 성공. 데스크톱판(../word-compare)의 AcceptAll+RevisedAuthor 선례와 의미론 일치.

### 비디오 A2 — 스레드 캡 상향 기각 (Codx)

MT 스레드 상향안 `min(8,max(4,hc-1))`을 실측 후 **기각**. Chrome 152/Linux/16 logical CPU·COI=true에서 배포 MT 코어 0.12.10의 1GiB 고정 힙 선언과 SHA-256(core `270a2e6f…0de`, wasm `be2c9760…c41a`, pthread worker `f77898d6…ca3`)을 검증하고, 기존 fixture `15115424…76c5`에서 만든 24-frame 1080p `0e12db4a…b268`(1,159,714B)·4K `bd5d66f8…e677`(3,303,654B)를 `node --experimental-strip-types scripts/benchmark-video-threads.mjs --output-dir /tmp/worklazy-video-thread-benchmark-a2 --runs 3 --browser-timeout-ms 180000 --vp9-timeout-ms 45000 --resume`로 warm-up 후 3회 측정.

- 브라우저 4→8스레드: H.264 1080p `1,560.385/1,569.560/1,640.370ms`(중앙값 1,569.560ms·143,819B·decode 0)에서 8스레드 warm-up 180초 timeout으로 퇴행. H.264 4K 양쪽 OOM, HEVC 1080p·4K 양쪽 warm-up timeout, VP9 1080p·4K 양쪽 OOM.
- host 격리 대체 측정 4→8스레드 중앙값(ms/bytes/peak RSS KiB): H.264 1080p `437.593/143886/402648 → 340.648/141747/484764`, 4K `1751.354/394724/1244604 → 1477.708/397404/1449180`; HEVC 1080p `725.026/159821/541552 → 657.139/159821/615800`, 4K `1666.618/312940/1732880 → 1535.939/312940/2018652`; VP9 1080p `1525.762/306592/462648 → 1289.052/306592/487816`, 4K `4154.374/568351/1437528 → 3232.429/568351/1462640`. 전부 decode 0·host OOM 0.
- **판정**: host 시간 7.84–22.19% 감소에도 RSS 전 조합 1.75–20.39% 증가, 4K는 4스레드부터 이미 1GiB 초과, 실제 브라우저 성공 경로가 후보에서 정지 → 속도 이득·힙 안전 게이트 미충족으로 기각. `multiThreaded` 배선은 무해·유용하여 유지.

### 이미지 Phase 2 — 스티커 후보 스파이크 (Codx)

Twemoji v17.0.3(4,009개, 10,121,593B, 개별 gzip 합 4,475,637B) vs Noto Emoji v2.051(3,731개, 32,128,362B, 11,225,395B)을 경로별 라이선스 원문까지 비교해 **Twemoji 채택, Noto는 원시 3.17배·gzip 2.51배 규모로 기각**. 상한 120종 중 7카테고리 112종을 코드포인트·바이트·SHA-256 manifest로 고정(실제 합계 142,436B/개별 gzip 71,573B). Image Studio lazy chunk 356.23→384.87KB(gzip 109.76→120.86KB), SVG 본문 미포함.

### XLS 보존 첫 진입 실패 — 기전 확정·가설 기각 (Codx)

전역 격리 헤더 없는 GitHub Pages 동형 서버 재현으로 기전 확정: 표준 Excel 화면의 전역 SW 제어 뒤 보존 화면 첫 이동 시 문서는 `COEP: require-corp`로 격리되지만 `/assets/excel.worker-*.js` 응답은 무헤더 → Chrome `ERR_BLOCKED_BY_RESPONSE` 차단 → 합성 4파일 전부 "파일 처리를 시작하지 못했습니다". ko·en 보존 정적 페이지는 `332d8f7`부터 생성·검증되고 착수 시 운영도 200이어서 **"생성기 상수만 존재·운영 404" 가설(Claude C1 일부)은 기각**. `credentialless` 비디오 문서에서 `require-corp` 워커 스크립트 호환은 실기동으로 확인.

### 이미지 I2 줌·팬 — 기각안 (Codx)

보기 변환(VPT)을 반응형 fit이나 편집 기록에 섞는 안, DPR을 재유입하는 `getTotalObjectScaling` 계산은 각각 의미 충돌·강도 회귀로 **기각**. 강도 계약은 `getObjectScaling()+getZoom()` 유지 — DPR 1·2 × 100·200%에서 같은 16px·8px 소스 블록 실측.

### 엑셀 위장 XLS — F0 판정·기각 (Codx)

실파일 4개 재현에서 고정 ZetaOffice는 두 SpreadsheetML을 모두 열고 변환·4파일 병합까지 성공 → **"ZetaOffice SpreadsheetML 미지원"·"전각 파일명 단독 원인" 가설(Claude C1·C3) 기각**. SheetJS 0.20.3은 `AC285_202606.xls` 성공·`AC285_20260８５８6.xls` 실패(XLML CDATA)로 파일별 지원 편차 판정. OLE 헤더만 붙인 빈 fixture는 ZetaOffice가 정상 변환해 실패 fixture로 기각(→ 이벤트 주입식 결정론 테스트로 대체). 모든 `.xls`에 문자열 파싱을 적용하는 안은 기존 OLE 경로 회귀 위험으로 기각.

### 이미지 I1+I3 — 기각안 (Codx)

광고 공간을 침범하는 뷰포트 전체 고정 레이아웃은 AdSense 정책 충돌로 기각(Gemini 검증)·sticky 캔버스 채택. `src/app/seo.ts`·ko/en `tools.json`·이미지 가이드는 기능 의미가 정확해 변경 불필요 판단.

### 비디오 A1·B1b — 실측·기각 (Codx)

- A1 VP9 `-deadline good -cpu-used 4`: host libvpx 3회 중앙값 7,882.015ms→2,462.353ms(68.76% 감소·3.201×), 출력 672,326→720,187B(+7.12%), SSIM 0.971567→0.971193·PSNR 28.713933→28.708202dB, 전체 디코드 통과. 브라우저 FFmpeg.wasm VP9은 작은 fixture도 메모리 오류 — 별도 런타임 결함으로 기록.
- B1b: zip.js 2.9.0 게이트 3항목(순차 Blob 스트림·강제 ZIP64·외부 unzip 왕복) 통과. **Mediabunny 1.55.5는 B-frame fixture trim duration이 FFmpeg보다 2프레임 길어(계획 허용치 1프레임 초과) B2 후보 기각** → mp4box.js+고정 mp4-muxer 대안 회귀.

### 앱 아이콘 — 기각안 (Codx)

그라데이션 미지원 래스터라이저 재사용(색상 소실), 투명 라운드 아이콘의 Apple·maskable 겸용(마스크 크롭 문제) 각각 기각 → Chrome 렌더링 생성기 + purpose 분리 채택.

### 2026-08-15–16 신뢰성 작업지시서 종결 검토 (Codx)

- 라운드 요약: 1차는 전 도구 영역 약 120항목 감사(P0 데이터 무결성·주요 P1 수정), 2차는 수정 회귀·부분 해결 재검증, 3차는 R1–R14 해결과 블러·비디오 회귀 S1–S14 추적, 4차는 S1–S14 해결 확인.
- 3차 이의 제기 판정 보존: 규칙 출처 표기 일부 수용 / `w:trackRevisions` 삭제 지시는 정식 OOXML 요소 증거로 기각(잘못된 `trackChanges`만 제거) / 오디오 워커 파일 전환 종료는 메모리 정리 정책상 유지 / Excel 끝단 트림 안전장치 완화는 불변식 검증 전까지 기각 / 비디오 memo 콜백 비교는 의도적 무시 계약을 주석·테스트로 확정.
- 4차 T1–T7 재검증(`72981cc` 기준): T1·T2·T3·T5·T6·T7 해결, T4 미해결(`resolveConcatFrameRate(..., fallback = 30)` 잔존 → `docs/backlog.md` 이관). 근거는 `rg` 실측 — T1 `getObjectScaling`·DPR 비의존 테스트, T2 유효 구간 export readiness·60초 probe timeout, T3 `frameRateProbeStatus` 1회 가드, T5 base 위 효과 재정렬·Safari 2–3 pass, T6 선택 영역 소스 픽셀 렌더, T7 주석·가이드·테스트·시트 참조 인덱스. FPS 필터 단순 생략안은 stream-copy 결합 호환성 상실로 기각.
- 종결 검증: `npm run build`(2,336 modules·55 pages) · `npm run test:unit`(15/15) · `npm run test:static` 통과.
