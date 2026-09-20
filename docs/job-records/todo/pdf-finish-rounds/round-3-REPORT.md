U4 PDF 마무리 v4 — Codex 3차 반박 판정 (Codx, 2026-09-06)

**판정: [재왕복 필요]. 잔여 이견 8건: 설계·검증 계약 7건(D1~D7), 기존 사실 오기 1묶음(D8). Claude–Codex 간 이견 0에 도달하지 않았다.**

결정적인 H2(c) 결과는 **lazy 분리로 route 예산 귀속이 없어지지 않으며, fontkit를 재사용할 때 shared 예산이 먼저 초과한다**는 것이다. 현행 PDF route **171,864B**를 재확인했다. 3,002줄 합성 코드에서 통합/분리 모두 route 증가는 약 13KB였다. fontkit+pdf-lib를 주 스레드에서 재사용하면 shared가 **+507,357/+507,347B** 증가하고, 기존 PDF worker에 fontkit를 추가하는 대안도 shared **+329,507B**, app JS **+342,364B**로 실패했다. 상한·기준점 변경이나 귀속을 숨기는 측정기 변경을 제안하지 않는다.

**범위·선독·실행 게이트**

첫 실행 명령은 `cat PROJECT_RULES.md`였다. 이어 AGENTS, 지정 dispatch 전문, PDF v4 전문(출력 절단 부분은 구간 재독), 상위 두 로드맵, review-notes의 기각 이력, 자산 정본을 읽었다. 과거 1·2차 반박 원문도 세션 로그에서 추출해 읽었다. 추출본은 `prior-rollout-2026-09-05T11-25-13-…md`, `prior-rollout-2026-09-05T13-01-23-…md`다. 과거 scratchpad의 `u4-rebuttal2.md`와 `u4-rebuttal3.md`는 회신 원문이 아닌 당시 dispatch였으므로 대체 자료로 오인하지 않았다.

`docs/jobs/todo` 열린 문서 15개를 열거하고 동일 표면을 검색했다(`logs/open-plans-scan.txt`, 44행). P2/B5a의 과거 UI 변경 제외는 완료된 선행 작업이고, 현행 S3가 U4의 상위 계약이다. S2b는 사용자 목표 대기 상태이며 QR 폰트·JS 경계가 잠재 공통 표면이다. 이번 라운드는 저장소 불변 실험이므로 구현 충돌 없이 진행했다. 실제 U4 착수 전에는 그때의 HEAD와 S2b 변경을 다시 대조해야 한다.

시작 원문:

```text
$ git status --porcelain
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
$ git rev-parse HEAD
1a04f2571109495a76b8468af95b2f4edcd862cf
$ git rev-parse origin/main
1a04f2571109495a76b8468af95b2f4edcd862cf
$ git branch --show-current
main
```

원본은 `git-status-start.txt`, `head-start.txt`, `origin-main-start.txt`. 실험·복제본·로그·PDF·PNG는 모두 이 보고서와 같은 `/tmp/worklazy-u4-r3/` 아래에 보관했다. 원본 저장소에서 build/prebuild/generator, npm 설치, 커밋, push를 실행하지 않았다. 아래 판정은 계획 실행 가능성의 검증이며 미구현 U4의 완료 게이트를 통과했다고 주장하는 것이 아니다.

**재현 명령 색인**

표의 E 번호는 다음 실제 실행과 출력 파일을 가리킨다. `probes/`에는 실행한 스크립트가 있다. 작업 디렉터리는 특별한 표시가 없으면 원본 저장소 루트다.

| ID | 실행 명령 | 결과·원문 |
|---|---|---|
| E1 | `node /tmp/worklazy-u4-r3/probes/r6.mjs` | exit 0; `logs/r6.log` |
| E2 | `node /tmp/worklazy-u4-r3/probes/legacy.mjs` | 최종 exit 0; `logs/legacy.log`, `legacy/summary.json`; 최초 두 probe 연결 오류도 `legacy-attempt1/2.log`에 보존 |
| E3 | `node --experimental-strip-types /tmp/worklazy-u4-r3/probes/lifecycle.mjs` | exit 0, 11개 probe; `logs/lifecycle.log` |
| E4 | `TMPDIR=/tmp/worklazy-u4-r3/temp node --test --experimental-strip-types tests/unit/excel-cleaner.test.ts tests/unit/excel-compare.test.ts tests/unit/visual-clock.test.ts` | exit 0, **26/26**, fail 0; `logs/consumer-unit.log` |
| E5 | `node /tmp/worklazy-u4-r3/probes/contracts.mjs` | exit 0; `logs/contracts.log` — 산술 반례, 실제 PDF.js 좌표, 실제 pdf-lib 재구축/글꼴/다중 행/stream |
| E6 | `NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-u4-r3/probes/bundle.mjs` | 5개 탐색 빌드 완료; `logs/bundle.log`, `bundle-*.json`. 내부 실제 게이트 FAIL도 그대로 기록 |
| E7 | `NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-u4-r3/probes/bundle.mjs lazy-worker-fontkit` | worker 대안 빌드 완료, shared/app 게이트 FAIL; `logs/bundle-worker.log` |
| E8 | `TMPDIR=/tmp/worklazy-u4-r3/temp node /tmp/worklazy-u4-r3/probes/harness.mjs` | 최종 exit 0; runtime clock 성공, config만 수정한 복제본 unit의 **의도된 exit 1** 확인; `logs/harness.log`, `harness/config-only-unit.log`. 첫 복제 경로 오류도 `harness-attempt1.log`에 보존 |
| E9 | `TMPDIR=/tmp/worklazy-u4-r3/temp node /tmp/worklazy-u4-r3/probes/recovery-ready.mjs` | exit 0; `logs/recovery-ready.log` |
| E10 | `python3 /tmp/worklazy-u4-r3/probes/evidence.py` | 14개 읽기 명령 모두 exit 0; **정확한 명령·출력·파일:줄**은 `logs/code-evidence.log`, 명령 목록은 `commands.json` |
| E11 | `python3 /tmp/worklazy-u4-r3/probes/summarize-bundle.py` | exit 0; `logs/bundle-summary.log`, `bundle-forecasts.json` |
| E12 | `pdftoppm -r 72 -png -singlefile /tmp/worklazy-u4-r3/contracts/layers.pdf /tmp/worklazy-u4-r3/contracts/layers` + `node /tmp/worklazy-u4-r3/probes/layer-pixels.mjs` | exit 0; `logs/layers.log`; 배경/원문/전경/도장 = 빨강/파랑/초록/노랑 |
| E13 | `cmp -s /tmp/worklazy-u4-r3/legacy/both-1.pdf /tmp/worklazy-u4-r3/legacy/both-2.pdf` 및 `diff -u /tmp/worklazy-u4-r3/legacy/both-1.structure.json /tmp/worklazy-u4-r3/legacy/both-2.structure.json` | 각각 exit 0, stdout 없음. E2는 옵션 4조합 전부에 두 명령을 수행·기록 |

**v3 잔여 쟁점 5건**

| 항목 | 판정 | 근거(명령·출력·파일:라인) | 정본 반영 문안 |
|---|---|---|---|
| V3-1 암호 fixture 세대 | **[이견] D1** — R6도 U4-0 필수로 고정 | E1: Node crypto만으로 open 1,361B / restricted 1,380B 생성. PDF.js: 무암호 open→PasswordException 1, 오답→2, 정답·owner→OPEN·본문 일치. restricted는 빈 암호로 OPEN·permissions `[]`. pdf-lib는 두 파일 모두 EncryptedPDFError. Poppler 두 파일 본문 일치·exit 0, `algorithm:AES-256`. E10 도구 검색 qpdf/mutool/pdftk 없음. 계획:121의 “R6 때만 qpdf 확보”도 불필요 | “U4-0은 R2와 AES-256/R6 각각 open-password·빈 user-password/permission-restricted fixture를 생성한다. 생성은 Node crypto, R6 생성기 oracle은 PDF.js+Poppler. 암호 입력·편집 지원을 추가하는 것이 아니라 올바른 거부·분류·배치 실패 격리를 검증한다. qpdf는 의존하지 않는다.” |
| V3-2 캔버스 3중 검사 위치 | **[동의]** — 위치는 성립, 총량 정책은 D3 | E10 `pdfPreview.ts:65` inspect, `:137–155` 썸네일, `:346–363` OCR/공용 export, `:431–435` ceil 할당. 실제 마지막 검사 지점은 함수 선언 :356이 아닌 **viewport 취득 뒤 :359 호출 직전**. E5의 viewport/ceil 계산 실행 | “PDF feature의 순수 정책 함수에서 finite·양수·ceil된 width/height·한 변/면적·RGBA·합계 산출 → finish가 모든 대상 페이지 geometry를 읽은 뒤 preflight → 실제 렌더 :359 직전 같은 정책 재검사. 선택 DPI와 실제 적용 DPI를 분리 표시한다. 공용 export 함수에는 finish 전용 optional policy/signal을 추가하고 미전달 기존 OCR/convert 경로는 기존 동작을 유지한다.” inspect의 현행 반환값은 pageCount/permissionRestricted뿐이므로 geometry 수집 반환형/함수도 동반한다. |
| V3-3 legacy 3종 oracle 시점·F5 비교 | **[동의]** | E2/E13: 실제 현행 worker를 /tmp에 bundle해 merge 진입으로 실행. 비영점 CropBox·회전 4종·혼합 크기 입력, 옵션 none/numbers/watermark/both 각각 2회. bytes=1,729/2,766/7,590/7,990; 각 cmp=0, 구조 diff=0, 각 4페이지 렌더 pixel diff `[0,0,0,0]`. 실제 client 함수의 PNG: 420~1,800×92, alpha max 209/255, fillStyle 0.82, 측정은 원문 전체·그리기는 120 UTF-16 단위. `pdf.worker.ts:92–117`, `pdfWorkerClient.ts:118–134` | “U4-0에서 현재 main과 실행 환경을 고정하여 구조·렌더·client oracle을 채취·커밋한다. U4-2 및 F5는 그 사전 oracle과 비교하며 새 코드로 기대값을 재생성하지 않는다. 날짜는 worker realm까지 고정하고 PNG bytes를 고정할 때만 byte equality를 보조로 쓴다. 구조 비교는 ref 번호가 아닌 dereference된 자원·행렬·operator 순서를 기준으로 정규화한다.” |
| V3-4 lifecycle adapter·Excel 회귀 | **[동의]** — PDF 소유 adapter로 선택지를 좁힘 | E10 소비처는 Excel cleaner/compare 두 곳. E3은 **공용 helper를 수정하지 않은 facade**로 nested error→flat code, progress message→phase를 변환하고 PDF client에서 현지화한다. ko/en 성공·오류 모두 현행 결과/문구/경고/code/transfer identity 일치; terminate 1회. pre-abort·abort 후 늦은 result·timeout·post 예외·중복 terminal·error event·생성 예외까지 11개 성공. E4 기존 소비자/clock unit 26/26 | “F0b는 PDF adapter를 선택한다. `workerLifecycle.ts`와 Excel client 두 파일은 무변경을 diff로 확인한다. 공용 helper 변경이 필요해지면 optional adapter 기본 identity를 포함한 별도 회귀 검증을 수행한다. U4-2 게이트에 위 소비자 unit 및 `npm run test:excel-cleaner`, `npm run test:excel-compare`, 기존 PDF 전량+legacy oracle+PDF adapter protocol 단언을 적는다.” 이번 라운드에서 Excel browser smoke를 새로 실행한 것으로 기록하지 않는다. |
| V3-5 확정 9~20 실행 가능성 | **[이견] D2·D3·D4**, 나머지 아래 개별 판정 | E5와 E8/E10. 토큰의 시작 페이지/시작 번호 혼동, F4b 총량/단일 캔버스 혼동, 재구축 보존표 미완성은 남아 있다 | 아래 12항목 표에 분해 |

R6 fixture는 **테스트 전용 고정 salt/key**로 결정적으로 생성했다. 재현 스크립트의 암호화 구현을 제품 암호화 기능으로 제안한 것이 아니다. restricted의 `permissions=[]`는 null이 아니므로 현행 `inspectPdf(requirePdfLibCompatibility)`의 편집 거부 경계와도 일치한다.

legacy 렌더 oracle은 이번에 **Poppler**로 채취했다. PDF.js 렌더까지 동일성을 측정했다고 쓰지 않는다. JS worker 실행은 원본 worker를 Node용으로 bundle한 환경이며, 원본 client PNG는 Chrome 152.0.7977.64에서 실제 생성했다. 정본의 U4-0에는 의존 버전·OS/폰트·renderer/DPI/배경색도 함께 기록하고, F5의 실제 브라우저 경로를 별도로 확인한다.

**확정 9~20의 개별 판정**

| 항목 | 판정 | 근거(명령·출력·파일:라인) | 정본 반영 문안 |
|---|---|---|---|
| 9 토큰 표 | **[이견] D2** | 계획:137–142. “N쪽부터 시작” 행의 예시는 물리 시작 페이지가 아닌 **표시 시작 번호 5**를 설명한다. E5: startPage=4/startNumber=5/표지 제외/물리 4·6 선택 시 `(5,7)`, `(7,9)`, `(5,6)`의 서로 다른 결과가 가능. 파일 총수/물리 홀짝/파일명 의미에는 동의 | `startPage`와 `startNumber`를 별도 필드로 고정. 권고: `anchor=max(startPage, excludeCover?2:1)`, `displayNumber(p)=startNumber+p-anchor`; range/parity/썸네일은 출력 여부만 정하고 카운터를 압축하지 않음. 위 예의 물리 4·6→5·7. N 초과·빈 선택·표지 제외만 켠 경우도 oracle 표에 포함 |
| 10 clock | **[동의]** — v4 H3가 과거 설명 대체 | E8 두 locale의 Date.now/new Date 고정, performance 증가. E10 `visual-regression.mjs:289` 고정 뒤 :309 navigation | batch 시작의 메인 realm에서 1회 clock 호출해 값/locale을 worker로 전달. worker 자체 new Date에 하네스 주입이 자동 전파된다고 가정하지 않음. H3 unit 보완은 D6 |
| 11 Link 보존 | **[이견] D4** | E5: 원본 catalog `/Type,/Pages,/Outlines,/ViewerPreferences,/PageLabels,/Names`; copyPages 재구축 후 `/Type,/Pages`뿐. Annots Link `[4 0 R]`는 남고 그 named destination은 없어짐. 2차에서 요청한 전체 비대상 구조 보존표가 아직 미완성 | 링크의 URI/직접 Dest/이름 기반 Dest를 구분하고 새 page ref로 매핑한다. Outlines·Names/Dests·PageLabels·ViewerPreferences·OCG·tagged structure의 보존/지원 제외 표를 U4-0 전에 채운다. 보존을 구현·검증할 수 없는 입력은 해당 구조 제거 기능에서 사전 지원 제외로 알린다. metadata만 지우면서 다른 구조를 조용히 버리지 않음 |
| 12 복합 순서 | **[동의]** | 계획:150–151의 순서가 명확. E5 저장·리오픈된 stream의 배경→원문→전경/번호/도장 순서, E12 색상 픽셀 4개 전부 일치 | 순서 유지. U4 구현 F5는 구조 제거/양식 처리와 최종 raster까지 포함한 실제 전체 옵션 golden을 별도로 실행해야 함. 이번 작은 probe가 그 전체 golden의 대체는 아님 |
| 13 typed preset | **[동의]** — 23항의 5경로가 우선 | E10 `App.tsx:55–59,131–132`, `PdfEditorPage.tsx:37–57`; 동일 Page+typed prop 확장 가능. 현행 mode 4개의 구조를 1개 finish+4개 preset으로 확장 가능 | 하나의 `PdfFinishPreset`/화면. 직접 진입 5경로와 SPA에서 preset 간 이동 시 초기 탭 적용도 테스트한다. 사용자 탭 변경은 route를 쓰지 않으며 route가 다시 바뀔 때는 초기 preset을 적용한다. 13항에 남은 3경로/4경로 문구는 4 preset/5 route로 통합 |
| 14 5칸 navigation | **[동의]** | E10 현행 `PdfEditorPage.tsx:94` repeat(4)/grid-cols-4, :102–115 selected. H6 규모·폭 검증은 아래 | 모바일 repeat(5), desktop grid-cols-5, finish 두 번째, active 가시성/fade 단언. 320/390/820/821×ko/en DOM 검증, 시각 표본은 아래 |
| 15 navigation 위치 selector 0 | **[동의]** | E10 repo 실행 확장자 재귀 탐색: **4건**, browser-smoke:349 1건 + visual scenarios:233/245/258 3건 | navigation href/data-pdf-nav-mode로 치환, 매 단계 같은 탐색 0. 내부 페이지 순서/출력 모드 목록은 이 계약 대상 아님 |
| 16 legacy oracle | **[동의]** | E2/E13, 위 V3-3 | main에서 U4-0 채취, U4-2/F5 비교, byte 단독 금지 |
| 17 손상 fixture oracle | **[동의]** | 선독한 Codex 2차 원문: truncated InvalidPDFException, xref 복구 OPEN, malformed 경고 OPEN. E10 loader의 실패와 복구 경계 유지 | U4-0 생성기 실행 시 각 fixture의 기대값을 고정. 이번 라운드에서 손상 3종을 다시 생성·실행했다고 주장하지 않음. R6는 E1에서 신규 검증 |
| 18 캔버스 정책 | **[동의]** — 위치 계약 | E5 페이지별 geometry 산출, E10 :358–359 실제 할당 전 삽입점 | V3-2 문안. 면적의 뜻은 D3처럼 바로잡아야 함 |
| 19 취소 정착 순서 | **[동의]** | E10 :151–164의 RenderTask/promise 핸들, :75–83의 loadingTask.destroy. E3 terminal/late result/AbortError 확인 | cancel→promise rejection 정착→page.cleanup→document/loadingTask.destroy. abort listener는 렌더 시작 전 signal.aborted 검사와 finally 해제 포함. 공유 preview 문서를 다른 진행 작업 중 destroy하지 않도록 소유권을 finish가 관리 |
| 20 F4b 결정 규칙 | **[이견] D3** | E5: A4 150DPI 한 페이지 **2,176,714px**는 상한 내지만 8페이지 합 **17,413,712px**가 4,096²=16,777,216을 넘음. 현재 20-3대로면 최저 DPI에서도 정상 8페이지 문서를 거부. 또 48셀 매트릭스에서 photo-scan ratio가 150=1.8/200=2.2/300=4.7이면 기본 포맷이 PNG/JPEG/JPEG로 갈려 전역 선택 규칙이 없음 | 단일 canvas의 `maxSide/maxArea`와 문서/배치 누적 pixels·입력/출력 bytes 예산을 분리한다. 후자는 실측 메모리와 최종 버퍼 기준 별도 상한. 비교 셀/집계(기기·DPI·포맷·반복 횟수), DPI/포맷 결정 순서, 기기 명세, quality 합격 조건, 출력 bytes 사전 추정 방법을 고정한다. “peak heap”이 main JS heap인지 worker/ArrayBuffer/canvas/native 포함인지 명시한다. mobile 에뮬레이션은 실제 모바일 메모리 측정으로 기록하지 않음 |

20항의 256MiB를 보편적 기기 한계로 승격할 수 없다. 페이지별 raw RGBA와 최종 PDF bytes는 E5/E2처럼 서로 다른 지표다. 벤치 뒤 값을 바꿀 수 있다는 문구만으로는 합격 규칙이 정해지지 않는다. **무엇을 측정하고 어떤 순서·집계로 기본값을 정할지 먼저 합의**해야 한다. 150DPI마저 품질/자원 기준을 못 만족할 때의 기능 지원 제외/사용자 결정 경계도 고정해야 한다.

**v4 H1~H7 판정**

| 항목 | 판정 | 근거(명령·출력·파일:라인) | 정본 반영 문안 |
|---|---|---|---|
| H1 / (a) 기준·nth-child 범위 | **[동의]** | 시작 HEAD=origin/main 일치. E10 navigation 4건, 내부 목록 selector 8건. `browser-smoke.mjs:143/146/174/186`은 페이지 순서, :154/155/211/212는 출력 모드 옵션. finish nav 삽입과 다른 목록 | 확정 15는 **navigation 위치 의존만** 대상으로 유지한다. page-card의 2번째 페이지 선택은 테스트 의미 자체가 순서이므로 광역 nth-child 금지로 확대하지 않는다. H1 설명에 누락된 browser nav :349도 교체 대상에 적음. 재귀 탐색 제외는 dependency `node_modules`, generated `dist`, vendored `public/vendor`로 명시; 문서는 실행 확장자 범위 밖 |
| H2 / (b) recovery 표본·경계 상속 | **[동의]** — 정상 표본은 `test:pdf-finish`, 기존 바깥 Suspense 재사용 | E10 recovery:270은 availableToolRoutes 20도구만 순회. E9 현행 ToolReady 코드 그대로 비교: **바깥 Suspense만 재사용하면 준비 전 guard=pending, 완료 후 null**. 중첩 boundary의 표식 없는 fallback은 성공 전에 가드를 삭제하고, 표식만 붙이면 성공 후에도 남김; 내부 ToolReady까지 두면 해소. `RouteErrorBoundary.tsx:37–47` effect 의존성 확인 | 5경로×ko/en×desktop/mobile **20개 정상 진입**과 실제 finish 준비 DOM을 `test:pdf-finish`에 둔다. `test:recovery` 20도구 registry는 유지. **새 lazy는 우선 기존 PdfRoute Suspense를 사용**한다. 별도 내부 boundary가 필요하면 예약/로딩 표식과 내부 ToolReady를 같이 둔다. Page/FinishPanel 청크 각각 404·지속 실패·최대 1회 reload·가드 정착을 테스트한다. 이 선택으로 별도 잔여 이견을 남기지 않음 |
| H2 / (c) 5종 예산 | **[이견] D5** | E6/E7, 아래 상세 표. 통합·분리의 PDF 고유 코드는 둘 다 route. 주 스레드 fontkit는 QR route→shared 이동으로 +507KB, worker안은 실제 중복 포함 +342KB app 증가 | “lazy 분리는 최초 진입 전송량/응답성 목적이며 예산 우회가 아니다. 현재 검증한 설계는 5종 게이트 불통과다. 정본화 전에 고정 기준·상한 안에서 fontkit/PDF 실행 경계를 충족하는 설계를 별도 탐색하여 입증한다.” 근거 없이 lazy안을 예산 해법으로 확정하지 않음 |
| H2 / (d) QR 폰트 자산 정합 | **[동의]** | E10 `qrBulk.ts:18`, `qrLabelPdf.ts:14–15`; OTF 4,644,748B, SHA-256 `69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68`. `OFFICE_EDITOR_ASSETS.md:33–40`, review-notes:1072의 WOFF2/subset 기각. E5 실제 coverage 확인 | U4는 현 pinned 전체 OTF와 `subset:false` 유지. QR이 별도 최적화 자산을 채택하더라도 기존 OTF 경로/파일/벤더 manifest를 덮어쓰거나 제거하지 않는다. 기존 OTF를 복제해 새 자산을 추가하지 않고 동일 원본을 재사용한다. QR 전용 상수의 의미가 변경되면 U4가 그 상수를 추종하지 않도록 **공용 고정 PDF OTF descriptor**와 QR 선택 자산을 분리한다. 벤더 생성기·해시표는 기존 소유. R4의 subset/WOFF2 기각은 유지 |
| H2 / H5 나머지 S2 게이트 | **[동의]**, 등록 단언의 현행 한계 명시 | E10 a11y pages=8/상한0, rendering targets=3/상한0.1. 현행 unit은 각각 현행 배열을 검사할 뿐 미래 finish route 누락을 자동 발견하지 않음. `accessibility-audit.test.ts:23`은 모바일 표본 2개를 정확히 하드코딩, rendering unit:17도 ID 3개 고정 | finish **desktop+412px mobile** 접근성 둘 다 등록. rendering에는 finish 5경로를 독립 ID와 finish-ready selector로 등록하고 지연 로딩/미리보기 로딩 레이아웃도 검사. 등록 목록·unit 독립 기대 목록을 함께 갱신한다. CLS 0은 목표, **차단 기준은 ≤0.1**로 명확히 구분. expectedToolIds=20 유지. 5경로의 ko/en·SEO/static/sitemap/FAQ/social·canonical `/finish` 및 일반 광고 로더 검증 동반 |
| H3 / (e) Date 고정 | **[이견] D6** — 런타임 하네스 수정 불필요는 맞지만 “목록 추가만”은 불완전 | E8: toolId=pdf-editor 목록 확장만으로 두 locale Date=`2026-09-05T03:00:00.000Z`, Date.now=1788577200000 고정. ko `2026. 9. 5.`, en `9/5/2026`. 그러나 config만 확장한 /tmp 복제본의 현행 unit은 **1 pass/1 fail**, expected 목록에 `pdf-editor`가 없다는 실제 assertion. unit:47·48·55·69–70에는 도구 목록/시나리오 수/캡처 수 고정 | `configureVisualClock`/`visual-regression.mjs` runtime은 유지하고 config **및 `visual-clock.test.ts`**의 독립 기대 목록·시나리오/캡처 수·PDF 비대상 가정을 갱신한다. config는 toolId 단위이므로 finish만이 아니라 기존 PDF scenario도 모두 고정된다. clock은 메인 batch에서 캡처해 worker로 전달 |
| H4 / (f) 9단계·1회 배포 | **[동의]** — U4 전체 1회 유지 | 상위 C-A:57–62는 단위=브랜치=배포. 계획 H4:331–344는 U4-0~8. F1 시점은 워터마크/도장/제거/복합 golden이 아직 안 끝남(계획:338–342). E10 현행 한 Page가 mode별 panel/guide/nav를 통합 소유 | `s3-pdf-finish` 한 브랜치, 단계별 커밋/로컬 검증, U4-8 뒤 C-D 전항 통과하여 한 번 배포. F1 중간 배포는 피드백 이점이 있지만 두 번의 9게이트/시각·라이브 검수와 미완성 탭·SEO 지원표 관리가 추가되고 현행 C-A도 다시 합의해야 한다. 이번 범위에서 중간 배포를 추가할 근거 없음. S2b 변화 추종은 합의대로 merge, 예산 기준점 임의 리셋 금지 |
| H6 / (g) scenario·20분 | **[동의]** — 규모 수치·320 설정 보완 | E8 전체 **80 scenario/175 capture**, PDF **6 scenario/10 capture**(initial·bottom+interaction 4). 현재 viewport는 desktop 1365, mobile 390뿐. 시나리오 배열에 locale/profile이 이미 들어 있음. 산식·예상 아래 | finish 탭 4개는 신규 interaction scenario 4개로, 추천 fullProfiles=32캡처. nav 3상태×ko/en×320/390=12캡처. mobile-320 viewport ID 추가, mobile-390는 기존 mobile 사용. 기존의 모든 mobile profile을 320/390으로 전역 중복시키지 않음. 820/821은 `test:pdf-finish` DOM 매트릭스. 정상 완료 시 축약 없이 20분 이내 예상 |
| H7 전체 요청 범위 | **[동의]** — 요청 항목을 모두 본 표와 앞 표에서 판정 | v3 잔여 5건, v4 (a)~(g), H5 9게이트, 자유 반박 검증 완료 | D1~D8을 취합해 Claude가 반영/이의 판단한 다음 재왕복. 이번 보고서로 구현 착수를 허용하지 않음 |

**H2(c) 탐색 빌드 상세**

저장소 파일을 고치지 않고 `src/`, `scripts/`, 설정 입력을 `/tmp/worklazy-u4-r3/project/`로 복제했다. 기존 node_modules를 읽는 symlink만 사용했으며 설치하지 않았다. `configFile:false`, /tmp의 명시 cacheDir, /tmp outDir로 Vite API 빌드를 수행했다. config 번들 임시 파일을 원본 node_modules에 만들지 않도록 설정을 /tmp에서 변환·로드했다. 공용 벤더 복사를 피하고 측정기에 포함되는 기존 public JS/CSS만 출력에 복사했다. 측정 함수는 **원본 `measureOutput`/`compareWithBaseline`/`resolveBudgetLimits` 그대로** 호출했다. 기존 `/tmp/worklazy-s2/bundle-final.json`과 entry/shared/app/CSS **4개 절대값 및 PDF route 171,864B가 모두 정확히 일치**했다. 기존 파일의 affectedRoute 합계는 전체 route이고 이번은 `routes=[pdf-editor]`로 선택한 차이만 있다.

| 기준 지표 | gzip B | 증분 상한 B |
|---|---:|---:|
| entry | 299,283 | +20,480 |
| PDF route | **171,864** | +61,440 |
| shared | 2,716,489 | +30,720 |
| app JS | 5,456,199 | +81,920 |
| CSS | 37,687 | +10,240 |

3,002줄/165,077B 합성 입력은 750개의 실행 가능한 변환 함수를 런타임 인덱스로 호출해 tree shaking으로 지워지지 않게 했다. 반복 문법/숫자/옵션명이 있는 **하나의 코드 밀도 표본**이며 U4 구현을 대체하지 않는다. `synthetic-source.ts`와 `bundle.mjs`에 원문·연결 방법이 있다. baseline·통합·lazy·fontkit 결합 2안·worker 결합 1안, 총 **6개 새 빌드**를 완료했다(각 71.17~78.41초).

| 탐색 설계 | entry Δ B | PDF route Δ B | shared Δ B | app JS Δ B | CSS Δ B | 게이트 |
|---|---:|---:|---:|---:|---:|---|
| integrated-code | +18 | +13,644 | +7 | +13,715 | +0 | PASS |
| lazy-code | -1 | +12,830 | +16 | +12,871 | +0 | PASS |
| integrated-fontkit | +22 | +13,718 | +507,357 | +14,029 | +0 | Bundle budget exceeded: sharedJsGzip 507357 > +30720. |
| lazy-fontkit | +3 | +12,994 | +507,347 | +13,264 | +0 | Bundle budget exceeded: sharedJsGzip 507347 > +30720. |
| lazy-worker-fontkit | +12 | +12,831 | +329,507 | +342,364 | +0 | Bundle budget exceeded: sharedJsGzip 329507 > +30720; appJsGzip 342364 > +81920. |

각 JSON의 `metrics`, `deltas`, `gate`, `files`, main 청크별 `modules`가 검산 근거다. 측정기는 `measure-bundle-budget.mjs:240–254`에서 **imports와 dynamicImports를 모두** 따라가고, :172–182에서 소유 도구가 하나면 그 route에 합산한다. 분리된 `PdfFinishPanel`은 주 스레드 lazy-code 안에서 **12,672B, owners=[pdf-editor], category=route**다. 최초 organize 진입에서 미리 안 받도록 할 수는 있지만 +60KiB 합산 대상에서 빠지지는 않는다.

fontkit/기존 비용의 정확한 귀속:

| 표면 | main 기준 | finish 주 스레드 재사용 | finish 기존 PDF worker 추가 |
|---|---|---|---|
| `qrLabelPdf` JS | **508,018B**, QR route 소유. fontkit main rendered code 1,000,862B 포함 | QR 고유 껍질 882/883B + 공통 PDF/fontkit 청크 **507,328B**, owners=[pdf-editor,qr-studio], shared | QR 청크는 508,017B, 그대로 QR route |
| 기존 `pdf.worker` | **219,622B**, manifest route 도달성 없음→shared | 바이트 동일, shared | **549,116B**, shared. worker 파일 자체 +329,494B |
| pinned OTF | **4,644,748B identity**, vendor 자산 | 동일 자산, JS 5종 지표 기여 **0B** | 동일 자산, JS 5종 지표 기여 **0B** |

주 스레드안의 약 507KB는 주로 **기존 QR route 비용의 shared 이동**이고 전체 앱의 신규 507KB가 아니다. 실제 app 증분은 +14,029/+13,264B다. worker안은 QR의 fontkit 코드가 유지되는 상태에서 worker 쪽 추가 복제가 생겨 app가 +342,364B 늘었다. 현 측정기의 `compareAttribution`은 동일 SHA의 이동만 이름 붙인다(:289–313). 이번 공통 청크 추출은 hash가 바뀌므로 그 필드의 0을 “귀속 이동 없음”으로 읽으면 안 된다. 위 표는 emitted modules/owners 및 QR/worker 청크를 직접 대조한 결과다.

요청한 production **2,850~4,650줄의 조건부 5종 delta 예측**은 다음과 같다. E11에서 `delta_code × (예상 줄 수 / 3002) + 해당 fontkit 연결 추가비용`을 계산했다. 의존 그래프와 코드 gzip 밀도가 이번 표본과 같다는 조건이다. 새 번역 JSON·새 CSS·새로 도입하는 UI 의존·실제 worker 엔진 분배는 아직 없으므로 그 값은 포함하지 않았다. 따라서 아래를 완성 제품의 확정 상한/합격 증거로 쓰면 안 된다.

| 예상 설계 | entry Δ B | PDF route Δ B | shared Δ B | app JS Δ B | CSS Δ B |
|---|---:|---:|---:|---:|---:|
| 통합+주 스레드 fontkit, 같은 코드 밀도 | 약 +22 | **+13,027~21,208** | 약 **+507,357** | +13,335~21,558 | 0(새 스타일 미포함) |
| lazy+주 스레드 fontkit, 같은 코드 밀도 | 약 +3 | **+12,344~20,037** | 약 **+507,347** | +12,612~20,330 | 0(새 스타일 미포함) |

줄 수만으로 entry의 번역 증가나 CSS 증가의 신뢰할 만한 수치를 발명할 수 없다. 실제 추가 문구/스타일 입력이 정해지면 그 입력을 포함한 탐색이 필요하다. 다만 **현재 측정한 최소 fontkit 연결만으로 shared 상한을 이미 476KB 이상 넘는다**는 불합격은 이 불확실성에 의존하지 않는다. “2,850~4,650줄이면 route +60KB를 넘을 가능성이 높다”는 v4의 추론은 이번 실측에서 뒷받침되지 않았다. 분리를 성능 목적의 후보로 유지할 수 있지만 **예산을 해결하는 정본 설계로 확정할 근거는 없다**. 어느 분기도 현재 5종 계약을 통과하지 않았으며, 상한 변경 제안 없이 D5로 남긴다.

**H6 캡처 수·소요 산식**

- 최소(light만): finish `4×2언어×2viewport=16`, 영어 nav `3상태×2폭=6` → **197캡처/실행**.
- 추천(light/dark 포함): finish `4×2언어×2theme×2viewport=32`, nav `3상태×2언어×2폭=12` → **219캡처/실행**, 총 scenario **87**(기존 80+finish 4+nav 상태 3).
- nav 3상태는 **직접 finish 진입(active 가시성), 스크롤 시작, 스크롤 끝**이다. 320/390은 별도 viewport ID로 캡처 이름도 구별한다.
- 상위 C-E의 느린 기준 134.10초/175캡처를 적용하면 `219/175×134.10=167.82초/실행`. 계약대로 두 LANG 명령을 모두 돌려도 **335.63초≈5.59분**, 20분 미만이다. 최소안은 301.92초≈5.03분.
- 이 값은 순회/캡처 수에 비례한다는 **예측**이며 finish 파일 생성·미리보기 대기 비용은 실제 실행에서 다시 잰다. timeout이 누적되는 경우까지 20분을 보장한 것이 아니다.
- E10으로 읽은 기존 S2 로그는 175/175 각각 **104.83초/104.61초**였다(이번 라운드 새 전체 visual 실행 결과가 아님). 또한 `LANG=ko…`/`LANG=en…`은 호스트 LANG이고 **한 번의 하네스 자체가 이미 ko 71+en 104=175를 포함**한다. “175가 언어당 캡처 수”로 이해해 다시 2배의 locale 매트릭스를 만들지 않는다.

**자유 반박**

| 항목 | 판정 | 근거(명령·출력·파일:라인) | 정본 반영 문안 |
|---|---|---|---|
| 확정 22 CSS→canvas→viewport 좌표 | **[이견] D7** | 현행 `pdfPreview.ts:142`는 CSS scale viewport, :143–155는 **별도 outputScale=DPR와 render transform**. E5 실제 PDF.js convert probe 4회전×DPR1/2×CSS shrink1/0.5=16조합. v4 문안대로 bitmap 좌표를 그 viewport에 넣으면 DPR2 **8/16 실패**, 오차 **240.83~268.33 PDF pt**. 예 rotation0 기대 `[170,460]`, 실제 `[290,220]`. bitmap 배율을 포함한 viewport로 바꾸면 16/16 일치 | “입력 좌표는 `convertToPdfPoint`를 호출하는 **해당 viewport의 좌표계**여야 한다. 권고: CSS 상대 위치를 정규화 u/v로 만든 뒤 `viewport.width*u, viewport.height*v`를 변환한다. canvas 좌표를 쓴다면 render의 별도 transform까지 역변환하거나 DPR 포함 viewport를 사용한다. 이미 viewport에 들어 있는 scale/rotation을 다시 나누지는 않는다.” 저장 normalized rectangle·4모서리 변환은 유지 |
| 1·21항 및 A4 표의 남은 사실 오기 | **[이견] D8 — 사실 정정 묶음** | E5: `Résumé €`는 Helvetica 성공; `Δοκιμή`에서 Noto 누락은 `ή U+03AE`. E5 실제 `drawText('One\nTwo')` 저장·리오픈 `TjCount=2`, `18 TL`, `T*` 2개. E10 pdf-lib PDFPage.js:853–855는 lineSplit 또는 maxWidth/breakTextIntoLines 지원. E5 A4 200DPI ceil은 **1654×2339** | 계획:71의 Résumé 실패/Greek 누락 문자 오기를 수정. :209 “drawText는 자동 줄바꿈 내장 안 함”을 “newline/폭 기반 줄바꿈은 지원하나 좌/중/우·6영역·overflow 정책은 직접 산출”로 수정. :101의 2338→2339. 여러 줄 정렬·타일 리소스 1회 임베드 계약은 그대로 유지 |

추가로 확정 25의 위험 문서 경고는 지원 의미에 맞지만 “리오픈 성공=시각 파손 없음”으로 확대하면 안 된다. E5의 **리오픈 가능한 named-link 손실** 자체가 구조 유효성과 의미 보존이 다름을 보여준다. runtime에서 확인 가능한 범위(열기/페이지/대상 객체/렌더 성공)와 U4 fixture의 픽셀 golden을 구분하고, 임의 입력의 레이아웃 완전 보존을 보장하는 문구는 쓰지 않는다. 이는 D4의 보존·지원 제외 표에 함께 정리할 내용이며 별도 이견으로 중복 집계하지 않았다.

**정본 반영 후 필요한 완료 명령**

아래는 U4 구현 단계에 적용할 명령이며 이번 리뷰에서 모두 실행했다는 뜻이 아니다. 기존 H5의 build·tsc·unit·전 스코프·static·recovery·visual·a11y·CLS·bundle·광고 검증·Gemini/Claude/Codex 시각 교차·배포 후 라이브 9게이트를 유지한다. 특히 누락되기 쉬운 것은 다음이다.

- U4-0: R2/R6/손상/위험 문서 생성기와 **고정 main legacy oracle** 생성 명령·파일 목록·기대값을 정본에 실제 이름으로 기입.
- U4-2: `TEST_SCOPE=pdf npm run test:browser`, `npm run test:excel-cleaner`, `npm run test:excel-compare`, lifecycle/PDF adapter unit, 사전 legacy oracle 비교. 공유 helper/Excel 소스 불변 `git diff`.
- U4-3 이후: `npm run test:pdf-finish`에서 5 preset 진입·SPA 전환·20개 정상 진입·실제 child 준비·404·cancel/retry·오류/경고·geometry·영어 모바일 검증. H3와 page-registration unit의 독립 기대값을 동반 변경.
- 최종: 실제 새 locale/CSS/worker 구성까지 포함하여 **같은 기준점·동일 5종 상한**의 bundle 게이트. 변경 범위의 검증을 더한 전체 C-D/H5 명령을 실행하고 원문 기록.

**최종 이견 원장(중복 제외)**

| ID | 잔여 이견 |
|---|---|
| D1 | R6 2종을 U4-0 필수로 고정하고 qpdf 전제 삭제 |
| D2 | physical startPage와 표시 startNumber·anchor의 토큰 의미 확정 |
| D3 | F4b 페이지별 canvas 상한/전체 자원 예산 분리 및 결정·측정 규칙 완성 |
| D4 | 재구축의 비대상 구조·이름 기반 링크 목적지 보존/지원 제외 표 |
| D5 | fontkit/PDF 경계를 포함한 고정 5종 예산 통과 설계 부재 |
| D6 | clock 목록만 변경하면 깨지는 고정 기대 unit의 동반 수정 |
| D7 | 별도 DPR render transform을 누락한 도장 좌표 계약 수정 |
| D8 | 이전 반박 후 남은 glyph/다중 행/A4 수치 오기 정정 |

반영 제안이 구체적이라는 이유만으로 Claude의 수용을 대신 선언하지 않는다. **잔여 이견 8건 · [재왕복 필요].**

**종료 불변 증명**

`python3 /tmp/worklazy-u4-r3/probes/verify-unchanged.py`를 실제 실행해 exit 0을 확인했다. 원문은 `logs/unchanged.log`, `git-status-end.txt`, `head-end.txt`, `origin-main-end.txt`, 기계 판정은 `unchanged.json`이다.

```text
$ git status --porcelain
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
$ git rev-parse HEAD
1a04f2571109495a76b8468af95b2f4edcd862cf
$ git rev-parse origin/main
1a04f2571109495a76b8468af95b2f4edcd862cf

{"snapshotFiles": 2911, "distFiles": 531, "changed": [], "extraDist": [], "statusEqual": true, "headEqual": true, "originEqual": true, "unstagedDiffExit": 0, "stagedDiffExit": 0}
```

추적 파일·계획서·사용자 3파일·dist를 포함한 **2,911파일의 SHA-256/크기/mtime 모두 불변**이다. `dist` **531파일**은 내용·mtime·파일 집합이 같고 추가 파일 0이다. 계획서 SHA-256도 시작/종료 `49d9c294c1b368007f43ead93da9bacdb6f95aaf934d5d340b46fcdb09c36c7e`로 동일하다. `git diff`와 `git diff --cached` 각각 exit 0, 원본 `main` HEAD와 origin/main 불변이다.

**잔여 이견 8건 · [재왕복 필요].**
