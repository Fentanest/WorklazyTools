# 검토 기록 (Review Notes)

검토 과정에서 산출된 사고의 결과물 정본 — 판정·기각 사유·실측 수치·가설 검증을 작업 단위로 기록한다(「작업 기록」 규칙). 코드에 일어난 변경 자체는 `CHANGELOG.md`에 간결히 기록하고, 여기에는 "왜 그렇게 했고 무엇을 기각했나"를 남긴다. 같은 길을 다시 제안하기 전에 이 파일을 먼저 확인한다.

## 2026-09-02

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
