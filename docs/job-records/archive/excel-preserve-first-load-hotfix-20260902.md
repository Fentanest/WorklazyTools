# 작업지시서 — XLS 보존 경로 첫 진입 실패·404 후속 핫픽스 (2026-09-02)

**상태: 수정 지시서 (사용자 신고 2건차 — Codex는 F0 재현으로 기전 판정을 확정하고, 어긋나면 증거와 함께 반박 후 조정하라.)**
기준 해시: 착수 시 HEAD 재확인. 선행: 이미지 I2 태스크 완료 후 착수(직렬화).

## 0. 증상 (사용자 신고, 프로덕션)

XLS 수식 보존을 켜면 페이지가 이동/새로고침되고, 그 직후 파일을 올리면 4개 전부 "확인 필요 + **파일 처리를 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.**" 사용자가 **한 번 더 수동 새로고침해야** 정상 동작.

## 1. 확정 사실 (Claude 실측)

- 오류 문구는 **엑셀 워커 기동 실패**(`excelWorkerClient.ts:66` — `worker.onerror`)다. 격리/자산 오류와 별개.
- **프로덕션 `/tools/excel-merger/xls-preserve/`는 HTTP 404**(curl 실측 — ko·en 공통 추정, en도 확인할 것). `dist/tools/excel-merger/`에 index.html만 있고 xls-preserve 정적 페이지가 생성되지 않는다. `scripts/generate-static-pages.mjs:20`에 `excelPreserveRoute` 상수는 있으나 산출물이 없다 — 화면은 `404.html` SPA 폴백으로 뜨는 상태.
- 메인 SW(`public/service-worker.js`)는 `/tools/excel-merger/xls-preserve` 경로 응답에 COEP `require-corp`를 주입한다. 그러나 엑셀 워커 스크립트는 `/assets/excel.worker-*.js`로 이 경로 밖 — **COEP 헤더 없이 서빙**된다.
- vite dev/preview는 **전역** COEP 헤더를 보내므로(`vite.config.ts:30-41`) 기존 스모크에서 이 계열 결함이 가려진다. 프로덕션(GitHub Pages)은 SW 주입뿐.

## 2. 기전 가설 (F0 검증 대상)

- **H1 (유력)**: require-corp 문서에서 dedicated worker 스크립트 응답에 호환 COEP 헤더가 없으면 워커 생성이 차단된다(COEP 상속 검사) → `/assets/` 워커 스크립트가 무헤더라 기동 실패. "두 번째 새로고침 성공"은 SW 제어 상태 변화(404 폴백·SW 갱신·캐시 경로)에 따른 문서 COEP 부재 시 성공으로 추정 — 정확 기전은 재현으로 확정.
- **H2**: 404 폴백 문서와 SW 제어 타이밍의 상호작용(첫 제어 획득 직후 문서에 헤더 미적용 등).

## 3. 수정 내용

### G0. 프로덕션 동형 재현 (구현 전 — 반박 기회)
- **전역 헤더 없는 정적 서버**(예: dist를 plain http 서버로) + 실제 SW 등록 + 404.html 폴백 구성으로 프로덕션과 동형 재현. 첫 진입 실패·재새로고침 성공의 기전을 파일·헤더 단위로 확정하고 기록. dev/preview로는 재현 불가함을 유의.

### G1. xls-preserve 정적 페이지 생성 (404 해소)
- `generate-static-pages.mjs`가 ko·en xls-preserve 페이지를 실제로 산출하도록 수정. **SEO 동반 검토(「현지화·SEO·AdSense 동시 검토」)**: sitemap·hreflang·메타 포함 여부를 기존 excel-merger 페이지와 일관되게 결정하고 판단을 기록(색인 제외가 의도면 noindex 명시). `validate-static-output.mjs` 검사 추가.

### G2. 워커 스크립트 COEP 정합 (H1 확정 시)
- SW에서 **요청 destination이 worker/sharedworker이고 same-origin인 응답**(또는 격리 경로 클라이언트발 요청)에 `Cross-Origin-Embedder-Policy: require-corp`+`Cross-Origin-Resource-Policy: same-origin`을 부여해 상속 검사를 통과시킨다. 비디오(credentialless 소유 문서)의 워커에도 require-corp 스크립트가 호환되는지 재현으로 확인(비호환이면 클라이언트 URL 기반 분기). 기존 격리 스모크(utility) 회귀 유지.

### G3. 첫 진입 자동 회복 (수동 새로고침 제거)
- 격리 필요 경로에서 기대 상태(문서 COEP/SW 제어) 미충족 시 **1회 자동 리로드**(무한 루프 가드 포함 — `office_coi_serviceworker.js:42`의 기존 패턴 참조). 실패 시 현행 안내 문구 유지.

### G4. 프로덕션 동형 회귀 테스트
- G0 하네스를 스모크로 정착: 전역 헤더 없는 정적 서버 모드에서 xls-preserve 첫 진입 → 파일 업로드 → 워커 기동 성공을 검증(기존 preview 기반 스모크와 별도). dummyfortest 참조 금지 — 합성 fixture 사용.

## 4. 검증·완료 기준

- G0 재현: 수정 전 첫 진입 실패 재현 → 수정 후 **첫 진입에서 곧바로 업로드·검사 성공**(수동 새로고침 불요).
- `/tools/excel-merger/xls-preserve/` ko·en HTTP 200(배포 후 curl 확인 포함).
- `npm run build` · `npm run test:unit` · `TEST_SCOPE=excel npm run test:browser` · `npm run test:xls-preserve` · `npm run test:static` + G4 신규 스모크 통과.
- CHANGELOG Codx(기전 판정 포함) → 커밋 → push → 배포 후 프로덕션 curl로 200 확인.

## 5. 명시 제외

- 광고 격리 정책(credentialless) 변경 / ZetaOffice 스냅샷 / 시트 그리드·CDATA 수정분 재변경.

## 6. 실행 게이트 기록 (2026-09-02, Codx)

- 기준 해시: `git rev-parse HEAD` → `b11f7465ed93ec25f0105a033bd05491e353e1cd`로 지시 기준과 일치했다.
- 워킹트리: 사용자 소유 미추적 MP4 3개와 DOCX 2개만 있었고 작업에서 제외했다.
- 최근 커밋 충돌: `git show --name-only --format= HEAD`의 변경은 이미지 스튜디오 소스·문구·CSS·테스트와 `CHANGELOG.md`뿐이라 이번 정적 생성기·SW·Excel 워커·신규 스모크와 겹치지 않았다.
- 열린 계획서: 이미지 UX 계획은 이미지 편집기, 비디오 계획은 비디오 처리 코드가 대상이다. 비디오 계획의 `credentialless` 문서 정책은 변경하지 않고 워커 응답 호환성만 재현하기로 해 상반 지시가 없다.

## 7. G0 기전 판정 기록 (2026-09-02, Codx)

### 정적 페이지·404 전제 반박

- `git blame -L 35,52 scripts/generate-static-pages.mjs`와 `git show 332d8f7:scripts/generate-static-pages.mjs`에서 ko·en `xls-preserve/index.html` 생성 루프가 `332d8f7`(2026-08-26)부터 존재함을 확인했다. `scripts/validate-static-output.mjs:98-109`에도 두 산출물의 noindex·격리·canonical·광고 제외 검사가 이미 있다.
- 수정 전 `npm run build`는 exit 0, `Generated 55 localized crawlable pages`였고 두 파일을 실제 생성했다. 2026-09-02 착수 시 `curl`도 운영 ko·en 경로 모두 HTTP 200이었다. 따라서 “현행 생성기는 상수만 있고 산출물이 없어 운영 404”라는 G1 전제는 현행 `b11f746`에는 틀렸다.
- G0 서버는 없는 파일에만 `dist/404.html`을 HTTP 404로 돌려주며 COEP·COOP·CORP 전역 헤더를 전혀 넣지 않는다. 현행 보존 경로는 실제 파일이 있어 200으로 서빙됐다. 404 폴백은 별도 미존재 경로 프로브에서 `noindex, nofollow` 본문·HTTP 404·세 격리 헤더 부재를 확인했다.

### H1 채택·H2 수정

- 수정 전 신규 무헤더 스모크에서 표준 Excel 문서는 원서버 HTTP 200, COEP/COOP/CORP 모두 없음이었다. 전역 `/service-worker.js`가 제어를 얻은 뒤 보존 경로 문서 요청은 `fromServiceWorker=true`, HTTP 200, `COEP=require-corp`, `COOP=same-origin`, `CORP=same-origin`이었고 `crossOriginIsolated=true`, `SharedArrayBuffer`도 존재했다.
- 같은 첫 진입에서 `/assets/excel.worker-fgfZFVI1.js` 원서버 요청은 HTTP 200이었지만 전역 SW의 대상 밖이라 격리 헤더가 없었고 Chrome이 `net::ERR_BLOCKED_BY_RESPONSE`로 차단했다. `worker.onerror`가 발생해 합성 XLSX 4개 모두 신고 문구(“파일 처리를 시작하지 못했습니다…”)로 끝났다. 따라서 H1을 채택한다.
- 이 동형 환경에서는 수동 새로고침 후에도 controller가 계속 `/service-worker.js`였고 워커 요청이 같은 이유로 다시 차단되어 4개 모두 실패했다. 신고 당시 “수동 새로고침 성공”은 당시 등록·갱신·캐시 상태의 부수 효과이며 필수 기전이 아니다. 현행 정적 200 문서에서는 404 폴백 H2도 원인이 아니다.
- 수정 방향: same-origin `worker`/`sharedworker` destination 응답을 전역 SW가 가로채 `COEP=require-corp`, `CORP=same-origin`을 부여한다. 문서별 `credentialless`/`require-corp` 정책은 유지한다.

## 8. G1~G4 구현·검증 기록 (2026-09-02, Codx)

- G1: ko·en 정적 산출 자체는 기존 구현을 유지했다. 이 화면은 검색 진입용 페이지가 아니라 광고·분석 제외 작업 화면이므로 `noindex, nofollow`, sitemap 제외, hreflang 제외, 각 언어의 색인 가능한 Excel Merger 가이드로 canonical이라는 기존 정책을 확정했다. 정적 검사를 exact canonical·hreflang 부재까지 강화했다.
- G2: 전역 SW가 same-origin `worker`/`sharedworker` destination을 처리해 `COEP=require-corp`, `CORP=same-origin`을 부여한다. 수정 후 엑셀 워커 응답은 SW 경유 HTTP 200과 두 헤더를 받았고 합성 4개가 첫 진입에서 전부 ready였다. 비디오 문서는 기존 `COEP=credentialless`, `CORP=cross-origin`을 유지하면서 실제 `video-probe.worker`만 `require-corp`/`same-origin`으로 기동해 호환됨을 확인했다.
- G3: 문서 범위 격리 준비 스크립트가 worker 활성화를 기다린 뒤 sessionStorage 경로별 가드로 최대 1회만 자동 리로드한다. 별도 깨끗한 영어 직접 진입은 원서버 문서 요청 정확히 2회(최초+자동 1회) 뒤 `crossOriginIsolated=true`, `SharedArrayBuffer` 존재, 문서 범위 `coi-serviceworker.js` 제어가 됐다. 가드 이후에도 준비가 안 되면 추가 리로드하지 않으며 현행 사용자 오류 경로는 바꾸지 않았다.
- G4: `tests/xls-preserve-first-load-smoke.mjs`와 `npm run test:xls-first-load`를 추가했다. dist·실제 SW·무헤더 정적 서버·404.html/404 상태 폴백, 합성 XLSX 4개, ffmpeg 합성 비디오를 사용하며 dummyfortest·사용자 실파일을 참조하지 않는다.
- 검증: `npm run build` exit 0(2,342 modules, 55 pages), `npm run test:unit` exit 0(60/60), `TEST_SCOPE=excel npm run test:browser` exit 0, `npm run test:xls-preserve` exit 0(4 XLSX states·3 XLS states·83 progress states), `npm run test:static` exit 0, `npm run test:xls-first-load` exit 0. 추가로 `npm run test:office` exit 0과 `npm run test:utilities` exit 0.
