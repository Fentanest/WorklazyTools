# 검토 기록 (Review Notes)

검토 과정에서 산출된 사고의 결과물 정본 — 판정·기각 사유·실측 수치·가설 검증을 작업 단위로 기록한다(「작업 기록」 규칙). 코드에 일어난 변경 자체는 `CHANGELOG.md`에 간결히 기록하고, 여기에는 "왜 그렇게 했고 무엇을 기각했나"를 남긴다. 같은 길을 다시 제안하기 전에 이 파일을 먼저 확인한다.

## 2026-09-02

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
