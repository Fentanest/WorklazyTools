# 작업계획서 — 비디오 스튜디오 성능·용량 개선 (2026-09-02)

**상태: 정본 · §5 1~9단계 완료 (2026-09-03, 잔여는 10단계 WebM/AudioEncoder/하이브리드 확대 — 후속)**
기준 해시: `b98efdea71626d26a32ec2f202b96a56a812dc83` (Codex 검증: d64cb9a→HEAD 사이 비디오 관련 파일 무변경)
발동: 사용자 `!계획!` — 단기 묶음 + WebCodecs·스트리밍 remux 전체 포함.

## 0. 배경 (실측 근거 — Codex 1차 검증 통과분)

- 출력은 wasm MEMFS에 쓰인 뒤 `readFile`→Uint8Array→Blob(`video.worker.ts:477-481`, `VideoStudioPage.tsx:305-313`).
- **1.5GB 가드(`VideoStudioPage.tsx:91`)는 패스스루(`bitrate === "copy"`) 사전 검사에만 적용된다**(`VideoStudioPage.tsx:440-448`) — 모든 출력의 공통 한도가 아니다.
- **wasm 메모리 계약(Codex 실측)**: MT 코어는 초기=최대 **1GiB 고정**(pthread 풀 32, growth 시 abort OOM), 싱글 코어는 초기 32MiB·최대 2GiB 성장형. node_modules와 벤더 산출물 SHA-256 일치 확인됨.
- 입력은 WORKERFS 마운트로 무복사(`video.worker.ts:200-211`).
- 인코딩: x264/x265 `-preset veryfast`, `-threads min(4,hc)`(`video.worker.ts:594-596`) — 단 `multiThreaded` 상태가 인자 조립부에 전달되지 않음(`video.worker.ts:119,123,353`). VP9 속도 플래그 부재(`videoEncoding.ts:3-14`). WebCodecs 사용 0건(rg 실측).
- concat: `processConcatJob`(`video.worker.ts:240-311`) — 세그먼트 MEMFS 누적 후 `-f concat -safe 0 -c copy` 조인.
- COEP `credentialless`+COOP(`public/service-worker.js:19-21`). Safari의 credentialless 미지원은 외부 사실 — 정본에는 "Safari에서 crossOriginIsolated 불성립 관측"으로만 서술하고 착수 시 실기기 확인.
- 진행률 계약: `VideoWorkerProgress = (progress: number, message: string)`(`types.ts:100`) — 공통 재사용 가능. 단 `useOperationProgress`는 단조성 가드 없음(`useOperationProgress.ts:24-29`).

## 1. 목표

- **A(단기)**: 인코딩 속도·메모리 압박 개선. 항목별 독립 배포·실측 게이트.
- **B(스트리밍)**: 적합 조건을 만족하는 작업에 한해 스트리밍 remux/WebCodecs 경로 신설로 용량 한계 해제·속도 향상. FFmpeg 경로 100% 보존.
- **"용량 한계 해제"의 정확한 조건**: ① 스트리밍 mux+OPFS 가용 ② `navigator.storage.estimate()` quota가 예상 출력 수용 ③ 컨테이너·코덱·작업 옵션이 스트리밍 경로 적합 ④ 스트리밍 실패 시 예상 출력이 안전 한도 이하일 때만 FFmpeg 폴백, 초과 시 안전한 사용자 오류(폴백 아님).

## 2. Phase A — 단기 (항목별 독립 커밋·배포)

### A0. 벤치마크 기반 확정 (모든 실측 게이트의 전제)
- 고정 fixture(경로+SHA-256), 브라우저/버전, OS/CPU/RAM, COI 여부, warm-up 후 **최소 3회 반복 중앙값**, 출력 크기, 디코드 성공 확인, 품질 지표(SSIM/PSNR 또는 고정 프레임 비교)를 기록하는 벤치 절차·스크립트를 먼저 만든다.

### A1. VP9 속도 플래그
- `videoEncoding.ts` VP9 분기에 `-deadline good -cpu-used 4` 추가(Codex가 FFmpeg.wasm 0.12.10 실행으로 인자 유효성 확인, exit 0).
- 완료 기준: A0 절차로 시간·크기·품질 실측 기록. 단위 테스트는 `includes()` 단편이 아니라 **VP9 인자 배열 전체 단언**으로 강화.

### A2. 스레드 캡 (실측 게이트 — 기각 가능)
- 계약 기록: pthread 풀 32 · 초기=최대 1GiB · growth=false(abort OOM). `-threads 8`은 풀과 충돌하지 않으나 고해상도 프레임 버퍼가 고정 힙을 압박.
- 산식: **저코어 회귀 금지** — MT 시 `min(8, max(4, hc-1))`(hc≤4에서 현행 이상 보장), 싱글 코어는 현행 정확히 보존. `multiThreaded` 상태를 인자 조립부까지 전달하는 배선 포함.
- 완료 기준: H.264·HEVC·VP9 × 1080p·4K에서 시간·크기·OOM 비교(A0 절차). 이득 없거나 고해상도 OOM 증가 시 **기각하고 사유를 CHANGELOG에 기록**.

### A3. concat MEMFS 압박 해제
- 세그먼트 인코딩 직후 `readFile`→Blob 보관→MEMFS 삭제, 조인 시 Blob들을 WORKERFS 재마운트해 `-f concat -safe 0` 입력. **Codex 실증 완료**: WORKERFS blobs 마운트 + `-safe 0` 절대경로 조인 성공, MEMFS 조인과 결과 SHA-256 동일.
- 효과 서술: "전체 메모리 감소"가 아니라 **"고정 wasm/MEMFS 압박 해제"**. `readFile→Blob→delete` 순간의 일시적 중복은 존재 — 총 메모리는 별도 측정.
- 정리 경로: 세그먼트 mount 디렉터리를 `finally`에서 unmount/delete. mount 소유권은 `processConcatJob` 내부로 한정(또는 mountedDirectories 전달) — 실패·취소 시 잔재 0 보장.
- 측정 지표: wasm buffer 크기(1GiB 고정이라 무의미) 대신 **MEMFS 파일 합계 · 브라우저 프로세스 메모리 · 성공 가능한 입력 상한**. 결과 바이트 동일성 해시 검증 포함.

### A4. 결과 저장 추상화 + 스트리밍 ZIP (구조 변경 — A1~A3와 분리 배포)
- 대상: `VideoStudioPage.tsx` · `types.ts` · `video.worker.ts` · `videoWorkerClient.ts` · 결과 저장 신모듈 · ZIP 교체.
- 출력 계약: `VideoWorkerOutput.buffer: ArrayBuffer` 전용을 **File/OPFS 결과까지 표현하는 공통 결과 타입**으로 확장. `onOutput` 콜백이 Promise를 기다리지 않는 현행 결함 수정(저장 완료 전 result resolve 방지).
- ZIP: JSZip은 입력 Blob 전체를 `FileReader.readAsArrayBuffer`로 읽고 출력도 누적(Codex 소스 검증) — **종단간 스트리밍 불가**. `@zip.js/zip.js`로 교체(B1a 채택·B1b 버전 lock). **엔트리 순차 `await add` 계약 준수**(병렬 추가 금지 — B1a 참조), ZIP64 필수.
- OPFS 수명주기: 세션별 디렉터리 + 소유 ID + TTL 잔재 청소(시작 시 전체 삭제 금지 — 다중 탭 충돌), 취소/실패 시 부분 파일 삭제, quota 부족 시 소용량은 Blob 폴백·대용량은 안전한 사용자 오류.
- **사용자 문구 변경 있음**: 현행 ko/en ZIP·메모리 안내(`src/locales/{ko,en}/features.json:503` "결과와 ZIP을 함께 메모리에 두므로…")가 거짓이 되므로 갱신 + 해당 문구를 검사하는 스모크도 수정(「현지화·SEO·AdSense 동시 검토」).
- SyncAccessHandle은 워커 전용(Gemini 검증) — 고성능 쓰기는 워커 내부에서.

### ~~A5. 속도/품질 토글~~ — **이번 계획에서 제외** (Codex 반박 수용)
- VideoTask에 preset 필드 부재, VP9는 preset 체계가 다름, CRF/비트레이트 모드별 의미 상이, UI 복잡도. 정본화 시 backlog에 "코덱별 전문가 옵션" 후속 설계로 이관.

## 3. Phase B — 스트리밍 경로

### B1a. 라이브러리 적합성 판정 (완료 — 2차 왕복 Codex 스파이크)
- **demux/mux 채택: `mediabunny`**(MPL-2.0 — npm 실측, 선례: exifreader·Pyodide·ZetaOffice; mp4-muxer/webm-muxer는 deprecated). Codex 소스 검증 완료: ① `EncodedVideoPacketSource.add()` — 디코드/재인코딩 없는 encoded packet 직접 전달, backpressure 전파 ② `BlobSource` — 8MiB 캐시·slice 스트림 부분 읽기(전체 적재 없음) ③ `StreamTarget` — `FileSystemWritableFileStream` 계약 호환(write+position), chunked 옵션 ④ WebM은 Matroska demuxer/muxer 완전 구현이나 런타임 roundtrip 미확인 → v1은 FFmpeg 경로 유지 ⑤ `sideEffects:false` ESM — `ALL_FORMATS` 대신 필요한 포맷만 import.
- **ZIP 채택: `@zip.js/zip.js`**(BSD-3-Clause). Codex 소스 검증 완료: Web Streams 입출력, BlobReader 64KiB 구간 읽기, ZIP64 지원(>4GB 자동). **구현 계약**: 엔트리는 순차 `await add`(병렬 추가는 `bufferedWrite` 자동 활성화로 엔트리 전체가 메모리 버퍼링됨 — 금지) 또는 `createOPFSTempStream`/SyncAccessHandle temp stream 명시.
- 라이선스 자동 반영: lockfile 기반 `generate-third-party-licenses.mjs`가 production 의존성 자동 순회 — `THIRD_PARTY_NOTICES.md` 수동 갱신 금지.

### B1b. 런타임 실측 (착수 1단계 — A4·B2의 선행 게이트, 미확인을 완료로 처리하지 않음)
- Codex 읽기 전용 샌드박스에서 npm 설치·번들 빌드가 불가해 다음이 미확인이다: 정확한 npm 버전 lock(zip.js 포함), 프로젝트 fixture로 mediabunny remux 실행(H.264/HEVC/AAC sample entry·codec configuration 보존, trim/keyframe timestamp 동등성), Vite production chunk 크기(최소 import vs ALL_FORMATS 비교)와 페이지 진입 시 미요청 확인, Safari BlobSource fallback 메모리 거동.
- **착수 후 첫 작업으로 실측하고 결과(명령+출력)를 기록한다. 실측이 적합성을 뒤집으면 대안(mp4box.js+고정 버전 mp4-muxer)으로 회귀하고 사유를 기록한다.**
- **ZIP 검증 게이트(A4 착수 조건)**: ① `@zip.js/zip.js` 버전 lock ② 순차 `await add` 경로에서 입력 Blob 전체 적재 없음 계측(구간 읽기 확인) ③ 강제 `zip64:true` 소형 fixture의 EOCD64/locator 구조 + 외부 압축해제(unzip/7z) roundtrip 성공. 세 항목 전부 통과가 게이트 기준이다.
- 번들: 스트리밍 워커 생성 시에만 관련 chunk 로드(정적 import 금지).

### B2. 패스스루 스트리밍 remux (MP4/MOV 1차)
- **아키텍처(Codex 설계 수용)**: 상위 오케스트레이터 `videoProcessingClient.ts` 신설. 현행 `videoWorkerClient.ts`는 FFmpeg 전용 어댑터로 유지, 별도 `videoStreamWorkerClient.ts`+스트리밍 워커 신설. **route preflight를 1.5GB 가드보다 먼저 수행**(현행은 가드가 라우터 앞에 있어 2GB 입력이 라우터에 도달 불가 — `VideoStudioPage.tsx:440-459` 순서 재배치).
- **라우팅 단위: job별 혼합**(한 batch 안에서 job마다 스트리밍/FFmpeg 경로 선택) — 결정 확정.
- preflight: 확장자가 아니라 **새 demuxer로 실제 트랙 판독**(현행 VideoProbeResult에는 코덱·sample entry·extradata·키프레임 정보 없음). copy 적합성은 codec 이름 + sample entry + codec configuration + 해상도 + 오디오 config/channels/sample rate까지 비교.
- quota: `navigator.storage.estimate()` 사전 검사. 스트리밍 실패 시 예상 출력 ≤ 한도일 때만 FFmpeg 폴백.
- 키프레임 스냅: 현행 `-ss` 선입력 seek 동작(이전 키프레임 시작 가능)을 회귀 테스트로 고정하고 스트리밍 경로도 동등 동작.
- MP4 출력 모드: **`fastStart: false` 명시**(moov 후단 — 로컬 저장 용도 충분, 현행도 512MB 초과 소스는 faststart 미적용). mediabunny `fastStart:"in-memory"`는 전체 media chunk를 finalize까지 메모리 보관하므로 **대용량 경로 금지**, 미지정 자동 결정에도 의존하지 않는다. fragmented는 호환성 판정 전 미사용.
- 완료 기준(2GB+): 출력 실제 2GB 초과 · 입력 전체 `arrayBuffer()` 호출 없음 계측 · OPFS write 바이트 단조 증가 · ffprobe stream/packet 타임스탬프 검사 · 취소 후 부분 파일 0건 · **수치 기준(채택값)**: 시작점 = 선택 시작 이전 최근접 키프레임과 동일 샘플(FFmpeg copy 결과와 동일 키프레임에서 시작, 타임스탬프 반올림 오차 ≤ 1ms) / 종료 duration 오차 ≤ 1프레임(1/fps초) / A/V 첫 샘플 정렬 오차 ≤ 50ms.

### B3. WebCodecs 인코딩 (1차 범위 축소 — Codex 반박 수용)
- **1차 범위**: 목표 비트레이트 모드 job만 WebCodecs 라우팅. **CRF 모드 job은 FFmpeg 유지**(WebCodecs 설정은 bitrate 중심, CRF 의미 이식 불가 — DOM 타입 실측). 사용자가 고른 코덱을 임의 변경 금지 — 해당 코덱 `isConfigSupported()` 실패 시 FFmpeg 폴백.
- **기능 동등성**: 단순 스케일이 아니라 aspect crop · scale/pad · rotation · flip · concat 공통 해상도/FPS 정규화 전부를 워커 내 OffscreenCanvas/VideoFrame 변환으로 구현. `decodeQueueSize`/`encodeQueueSize` backpressure, VideoFrame/AudioData `close()` 규율, 취소 시 flush·close 포함.
- **오디오 1차 규칙**: `remove`→스트리밍 경로 / `copy`→mux 호환 시 encoded 샘플 패스스루 / `encode`→AudioEncoder 지원 시 WebCodecs, **미지원 시 job 전체 FFmpeg 폴백**(오디오만 FFmpeg 하이브리드는 중간 컨테이너 왕복·A/V sync 위험이 커 후속 분리 — Codex 증거 수용).
- 스트리밍 concat의 출력 FPS 규칙 독자 정의: 모든 입력 fps 실측 확보 필수, unknown 포함 시 FFmpeg 경로로 라우팅(T4의 30fps 폴백 문제를 스트리밍 경로에 들여오지 않음).
- hardwareAcceleration `"no-preference"`(강제 금지 — CI/GPU 부재 환경).
- MKV 출력, WebM(스파이크 결과 확정 전): **명시적 FFmpeg 경로**.

### B4. 라우팅·진행률·UI
- 진행률: 현행 `(progress: number, message: string)` 계약 유지(재작성 불필요 — Codex 확인). 오케스트레이터가 단계 가중치(demux/decode/encode/mux/write) · duration/bytes 기반 전체 진행률 · **단조 증가 보장** · 종결 후 이벤트 차단을 소유. `useOperationProgress`에 단조성 가드 추가.
- 공통화: 출력 이름 생성 · MIME 결정 · warning 생성 · 오류 분류 · output count 집계를 `video.worker.ts:483` 인근 private 함수에서 공유 모듈로 추출(두 경로 복제 금지).
- 메시지: 행동·결과 중심 ko/en. WebCodecs·OPFS·remux·worker·원시 예외 노출 금지 — **기존 내부 명칭 자동 검사에 이 용어들 추가**.

### B5. 검증
- 정확한 명령: `npm run build` · `npm run test:unit` · `npm run test:new-tools` · `npm run test:utilities` · `npm run test:static`.
- 추가 테스트: route 결정표(컨테이너·코덱·bitrate·audio mode·OPFS·quota) / 진행률 단조성·종결 후 무이벤트 / OPFS 성공·미지원·quota 실패·취소·잔재 청소 / ZIP 입출력 스트리밍 계측 + **강제 `zip64:true` 소형 fixture로 EOCD64/locator 구조·외부 압축해제 roundtrip 검증** / H.264+AAC MP4 copy · HEVC MP4 · VP9 WebM(**FFmpeg 경로로 라우팅되는지 확인** — §4 제외와 정합) · MKV 폴백 / CRF job의 FFmpeg 잔류 확인 / aspect·rotation·flip·concat 조합 / AudioEncoder 부재 → job 전체 폴백 / 2GB+ 실파일 / A/V sync 허용오차 수치 / 신규 내부 명칭 UI 비노출 / 스트리밍 chunk 지연 로드.
- CI 헤드리스는 소프트웨어 인코더 허용 구성(하드웨어 가속은 합격 조건 아님).
- 오디오 스튜디오 BroadcastChannel handoff 스모크 통과 유지(결과가 File/Blob 호환인 한 코드 수정 불요).

## 4. 명시 제외 (고아처럼 보여도 살아있는 계약)

- A5 속도/품질 토글(→ backlog: 코덱별 전문가 옵션 설계).
- WebM 스트리밍(v1) — 채택 조건: B1 스파이크에서 Mediabunny WebM read/write 검증 통과 시 후속 확대. MKV 스트리밍 — 제외(FFmpeg 경로 유지).
- FFmpeg 오디오-only 하이브리드(중간 컨테이너 왕복) — 후속 분리.
- FFmpeg 코어 커스텀 빌드 — 1GiB MT 계약 전제로 설계.
- smart-cut(GOP 경계 재인코딩) — B2 키프레임 스냅은 현행 copy 동작 보존이며 별개.
- COOP/COEP 변경(credentialless 유지 — 광고 계약). 기존 격리 테스트를 회귀 기준으로 유지.
- T4(`resolveConcatFrameRate` 30fps 폴백) — FFmpeg 경로는 별건 유지. 단 B3 concat은 위의 독자 FPS 규칙 적용.
- 오디오·이미지 스튜디오 등 타 도구 코드.

## 5. 실행 순서 (독립 배포·측정 가능한 커밋 묶음 — Codex 권고 수용)

1. **B1b 런타임 실측**(버전 lock·fixture remux·번들 측정·**ZIP 검증 게이트** — A4·B2의 선행 게이트) + A0 벤치 기반 확정(병행 가능) → 2. A1 배포 → 3. A2 실측 게이트(채택/기각) → 4. A3 배포 → 5. A4 배포(B1b ZIP 검증 게이트 통과 후) → 6. route 결정표 확정 → 7. **B4 기반 구축**(오케스트레이터 `videoProcessingClient` · 진행률 단조성 · 공통 모듈 추출 — B2 배포에 선행) → 8. B2 배포 → 9. B3(비트레이트 모드+지원 오디오 모드) 배포 → 10. WebM/AudioEncoder/하이브리드 확대(후속).
- **B5 검증의 배치**: 각 단계의 완료 기준에 해당 B5 테스트를 포함한다 — A4 단계: ZIP 스트리밍 계측·ZIP64 구조·OPFS 수명주기 테스트 / B4 단계: 진행률 단조성·종결 후 무이벤트·공통 모듈 단위 테스트 / B2 단계: route 결정표·2GB+·copy 적합성·키프레임 스냅 테스트 / B3 단계: 코덱·오디오 폴백·변환 조합·A/V sync 테스트. 별도 "검증 단계"는 두지 않는다(테스트 없는 배포 단계 금지).
- **완료 상태 (2026-09-03, Codx)**: 1~9단계 완료. 잔여는 10단계 **WebM/AudioEncoder/하이브리드 확대 — 후속**뿐이다.
(B1a 적합성 판정은 정본화 전 완료됨 — §7 2차 왕복 기록.)

## 6. 규칙 점검

- 「GitHub Pages 스택」: 전부 브라우저 워커·OPFS·WebCodecs·정적 번들 — 서버 전제 없음 [Codex 동의].
- 「현지화·SEO·AdSense 동시 검토」: **문구 변화 있음** — 1.5GB 안내·ZIP 메모리 안내 ko/en 갱신 + 해당 스모크 수정. 글로벌 초기 chunk와 비디오 route chunk를 구분 측정.
- 「내부 구현 비노출」: 신규 용어를 자동 검사에 추가 [Codex 동의].

## 7. 반박 기록

### Gemini 보충 (2026-09-02, 완료)
- mp4-muxer/webm-muxer deprecated → Mediabunny(MPL-2.0): **Claude npm 실측 검증** → B1 반영. MPL 선례 검증. WebCodecs/OPFS/CI 특성은 런타임 감지 규약으로 반영(버전 수치 하드코딩 금지).

### Codex 1차 (2026-09-02, 완료 — 수정 목록 28건 전원 수용; 2차 검수에서 27건 완전 반영 + #15는 v2 내부 상충으로 판정되어 v3에서 해소)
- 실증 3건: WORKERFS blobs+`-safe 0` 조인 성공·결과 해시 동일(A3 채택 근거), VP9 플래그 유효(A1), MT 코어 1GiB 고정·pthread 32(A2·배경 정정).
- 구조 반박 수용: 1.5GB는 copy 전용 가드(배경 정정) / JSZip 스트리밍 불가(A4 ZIP 교체) / 가드가 라우터 선행(B2 순서 재배치) / CRF 이식 불가(B3 범위 축소) / 오디오 하이브리드 후속 분리 / A5 제외 / A 묶음 일괄 배포 금지(순서 §5).
- v1 → v2 반영 당시의 기록(현재 문서는 v4).

### Codex 2차 (2026-09-02, 완료 — 판정 "수정 후 재왕복", 잔여 이견 4건 → v3 반영)
- v2 검수: 27건 완전 반영 확인, #15(B1 순서 상충) 반박 → §5에서 B1b를 1단계로 이동·A4를 ZIP 검증 뒤로 배치(v3).
- 스파이크: mediabunny 조건부 적합(EncodedVideoPacketSource 패스스루·BlobSource 부분 읽기·StreamTarget OPFS 호환·WebM 구현 완전하나 런타임 미검증) → B1a로 확정, 런타임 미확인 항목은 B1b로 분리(완료 처리 금지 — 반박 수용). zip.js 조건부 적합(BSD-3·Web Streams·ZIP64) → 채택 + 순차 add 계약.
- fastStart:"in-memory" 금지·`fastStart:false` 명시(B2 반영), ZIP64 구조 테스트·VP9 WebM 라우팅 확인 문구(B5 반영).

### Codex 3차 (2026-09-02, 완료 — 이전 4건 해소 확인, 신규 이견 4건 → v4 반영)
- 해소 확인: B1a/B1b 분리·순서(#15), 미확인 완료 처리 금지, fastStart:false, ZIP 계약·ZIP64·WebM 라우팅.
- 신규 이견 반영: ① B4를 실행 순서 7단계(기반 구축, B2 선행)로, B5를 각 단계 완료 기준으로 배치 ② B1b에 ZIP 검증 게이트(3항목 통과 기준) 정의 ③ B2 수치 기준 채택값 확정(키프레임 동일 샘플·duration ≤1프레임·A/V ≤50ms) ④ §7 버전 표기 모순 정정.

### Codex 4차 (2026-09-02, 완료 — 4건 전부 해소 확인, 새 모순 없음, **"[정본화 가능] 이견 0" 선언**)
- 본 문서를 정본으로 확정. 착수는 §5 실행 순서대로 — 1단계: B1b 런타임 실측 + A0 벤치 기반.

## B1b 실측 기록 (2026-09-02, Codx)

### 환경·버전 lock

- 실행 환경: Node `v22.17.1`, npm `10.9.2`, Vite `6.4.3`, FFmpeg/ffprobe `6.1.1-3ubuntu5`, Chrome `152.0.7977.64`, Linux `7.0.0-30-generic`, AMD EPYC 7352 16 logical CPU, RAM 16,690,388,992 bytes.
- `npm_config_cache=/tmp/worklazytools-npm-cache npm view mediabunny version && npm_config_cache=/tmp/worklazytools-npm-cache npm view @zip.js/zip.js version` → `1.55.5`, `2.9.0`.
- `npm_config_cache=/tmp/worklazytools-npm-cache npm install --save-exact mediabunny@1.55.5 @zip.js/zip.js@2.9.0` → 4 packages 추가, package/lock exact pin. `npm ls --depth=0 mediabunny @zip.js/zip.js` → 두 버전 일치. lock integrity: mediabunny `sha512-m0v6…KeAA==`, zip.js `sha512-Abla…FcUeA==`.

### Mediabunny remux·trim 판정 — B2 채택 뒤집힘

- fixture 생성: `ffmpeg -f lavfi -i testsrc2=size=640x360:rate=30:duration=6 -f lavfi -i sine=frequency=997:sample_rate=48000:duration=6 ... -g 30 -bf 2 -c:a aac ... h264-aac-fixture.mp4`; `sha256sum` → `15115424e7ed5e2bd589c392b87fea726e204f685151b744a5b3baa299b276c5`, 725,642 bytes.
- `node scratch/video-performance-b1b/remux.mjs ...` → H.264 `avc1.64001e`/47-byte configuration SHA-256 `f183ab34…40983`, AAC 5-byte configuration SHA-256 `643b0e23…e409`가 full remux 뒤 동일. `ffprobe` sample entry도 입력/출력 모두 `avc1`·`mp4a`, profile High/LC로 보존.
- FFmpeg 기준: `ffmpeg -ss 1.600 -i fixture.mp4 -t 1.800 -map 0:v:0 -c:v copy -map '0:a:0?' -c:a copy -avoid_negative_ts make_zero ffmpeg-trim.mp4`.
- packet hash 대조 결과 Mediabunny/FFmpeg 모두 같은 직전 키프레임(입력 PTS 1.000000, SHA-256 `80c25aaf…0a09`)과 동일한 영상 packet 74개를 보존. 첫 영상 PTS는 `0.082674` 대 `0.082031`로 차이 `0.643ms`(≤1ms), 첫 오디오는 둘 다 `0.000000`.
- 그러나 `ffprobe -show_entries format=duration:stream=duration`에서 영상 duration이 Mediabunny `2.533333s`, FFmpeg `2.466667s`로 **66.666ms(2프레임) 차이**. 동일 packet의 PTS는 보존되지만 `EncodedPacket` 공개 계약이 입력 DTS를 노출하지 않고 MP4 muxer가 GOP별 DTS를 재구성해, §B2의 종료 오차 ≤1프레임을 충족하지 못했다.
- **판정: Mediabunny는 B2 trim remux용으로 기각하고 계획의 대안 `mp4box.js + 고정 버전 mp4-muxer`로 회귀.** A4 ZIP과 A1은 독립이므로 계속 진행. 실제 Safari 장비는 이 Linux 호스트에 없어 메모리 피크 실기기 측정은 못 했으나, `BlobSource({ useStreamReader:false })` 모사(`node .../blob-fallback.mjs fixture.mp4`)는 16MiB padded Blob/463 packets에서 전체 `arrayBuffer()` 0회, 12회 range slice, 최대 131,072 bytes로 bounded였다.

### Vite import 표면

- `B1B_IMPORT_MODE=minimal node node_modules/vite/bin/vite.js build --config scratch/video-performance-b1b/vite.config.mjs` → 70 modules, `357,345 bytes`, gzip `80,362 bytes`.
- `B1B_IMPORT_MODE=all ...` → 70 modules, `611,475 bytes`, gzip `133,355 bytes`. `ALL_FORMATS`는 최소 MP4 import보다 raw `+254,130 bytes`(+71.12%), gzip `+52,993 bytes`(+65.94%). 따라서 필요한 MP4 심볼만 import하는 계약 유지.
- `rg -n 'mediabunny|@zip.js/zip.js' src` → 0건. 현재 페이지 초기 entry에는 정적 import가 없으며, 후속 대안도 스트리밍 worker 생성 시에만 동적 로드해야 한다.

### ZIP 검증 게이트 — 통과

- Chrome에서 `node scratch/video-performance-b1b/run-zip-browser.mjs ...`로 8,388,731-byte 계측 Blob을 **순차 `await add`** 두 엔트리로 작성: `streamCalls=1`, `chunkCount=10`, `maxChunkBytes=2,097,152`, `totalStreamedBytes=8,388,731`, 원본 Blob 전체 `arrayBuffer()` 호출 `0`. zip.js 2.9.0은 `BlobReader` 전체 구간에서 브라우저 native `Blob.stream()` fast path를 사용하므로 실제 Chrome chunk는 설정 기본값 64KiB가 아니라 최대 2MiB였지만, 입력 전체 단일 적재는 없고 backpressure 구간 스트림임을 확인.
- 강제 `zip64:true`: ZIP64 EOCD offset `8,389,107`, locator `8,389,163`, classic EOCD `8,389,183` 모두 확인. `zipinfo -v`는 각 엔트리에 extract version 4.5와 PKWARE 64-bit size extra field를 보고.
- `unzip -t browser-zip64-gate.zip` → 두 엔트리 `OK`, 오류 0. `unzip -p ... payload.bin | sha256sum`과 원본 `sha256sum` → 둘 다 `a29508afd1193afb85bb9e4103759c815279348e3f69996da9cbac3b3f99bf7a`.
- **A4 ZIP 선행 게이트 3항목(정확 버전 lock·전체 적재 없음·ZIP64 외부 roundtrip) 전부 통과.**

## A0·A1 실측 기록 (2026-09-02, Codx)

- 재사용 스크립트: `node --experimental-strip-types scripts/benchmark-video-vp9.mjs --label <before|after> --output-dir /tmp/worklazy-video-vp9-benchmark --runs 3`. fixture `tests/fixtures/video-vp9-benchmark.mp4`, 725,642 bytes, SHA-256 `15115424e7ed5e2bd589c392b87fea726e204f685151b744a5b3baa299b276c5`; 640×360/30fps/6s H.264+Aac. Chrome 152에서 COI=true 확인, warm-up 1회 뒤 3회 중앙값, FFprobe/전체 decode/SSIM/PSNR 자동 검사.
- 브라우저 FFmpeg.wasm 0.12.10의 libvpx-vp9은 MT에서 640×360 `memory access out of bounds`, single/`-threads 1`에서도 128×72 첫 프레임 뒤 `Failed to allocate packet ... Out of memory`로 중단. A1 인자 영향만 분리하기 위해 같은 libvpx 1.13.1의 host FFmpeg 6.1.1에 실제 `appendVideoRateControl` 결과를 적용해 before/after를 측정했다.
- before: `8281.618 / 7882.015 / 7828.392ms`, 중앙값 `7882.015ms`; 672,326 bytes; SSIM `0.971567`; PSNR `28.713933dB`; 전체 decode exit 0.
- after(`-deadline good -cpu-used 4`): `2444.185 / 2462.353 / 2490.547ms`, 중앙값 `2462.353ms`; 720,187 bytes; SSIM `0.971193`; PSNR `28.708202dB`; 전체 decode exit 0.
- 결과: 중앙값 시간 `-68.76%`(3.201×), 출력 크기 `+7.12%`, SSIM `-0.000374`, PSNR `-0.005731dB`. 품질 변화는 미미하고 속도 이득이 명확해 A1 채택.

## A3 실행 게이트 (2026-09-02, Codx)

- `git rev-parse HEAD` → `4f85e58c67a1efde91c7c9a5586763f88aed6526`, `git status --short --branch` → `main...origin/main` 동기. 추적 변경은 없고 사용자의 기존 MP4 3개·DOCX 2개만 untracked로 확인했으며 A3 스테이징에서 명시적으로 제외한다.
- 계획 기준 `b98efde` 이후 비디오 표면 변경은 A1 `38736ef`(`videoEncoding.ts`·VP9 벤치/픽스처·인자 단위 테스트)과 A2 `732e654`(`video.worker.ts`·`videoEncoding.ts`·스레드 벤치·인자 단위 테스트)뿐임을 `git log --name-only b98efde..HEAD -- <video 표면>`로 확인했다. A2 이후 `git diff --name-status 732e654..HEAD -- <video 표면>`는 출력 0건이고, 사이 커밋은 Word·기록 이원화·이미지 작업이므로 A3 전제를 깨지 않는다.
- `docs/jobs/todo` 열린 계획서는 본 문서와 이미지 스튜디오 UX 계획서 1건이다. 후자는 image-studio 코드·이미지 DOM 스모크가 대상이고 A3의 `video.worker.ts`·concat 스모크 계약과 상반되는 지시가 없다. 공유 기록 파일과 `tests/new-tools-smoke.mjs`는 현행 `HEAD` 기준을 보존해 A3 내용만 추가한다.
- 게이트 판정: 충돌 없음. 새 전제 A1·A2 커밋을 포함한 `4f85e58`에서 계획 §3 A3 범위만 착수한다. A4·B 단계는 진행하지 않는다.

## A4 실행 게이트 (2026-09-02, Codx)

- 기준 해시 게이트: 사용자가 지정한 현행 `HEAD=b0b4d6fbfc2a0d72d624c8b539d6b564af7859c0`을 `git rev-parse HEAD`로 확인했고 `origin/main`도 같은 `b0b4d6f`이다. `git show --stat b0b4d6f`에서 A3의 `video.worker.ts`·`videoConcatSegments.ts`·단위 테스트·벤치·이원 기록만 추가된 것을 확인했다. 계획 기준 `b98efde`이후 비디오 표면의 A1·A2·A3 변경은 정본 계획에 기록된 선행 전제와 일치하며 A4 계약을 깨는 후속 변경은 없다.
- ZIP 선행 게이트: 본 문서 B1b 실측 기록의 `@zip.js/zip.js@2.9.0` 정확 버전, 순차 `await add`의 입력 전체 `arrayBuffer()` 0회, 강제 ZIP64 EOCD64·locator 및 외부 `unzip` 왕복 성공을 재확인했다. 현재 manifest/lock은 아직 JSZip을 지향하므로 A4에서 zip.js 2.9.0을 정식 정확 버전 의존성으로 교체하고, B2에서 기각된 Mediabunny는 설치·추가하지 않는다.
- 열린 계획서 충돌 검사: `docs/jobs/todo`의 다른 문서는 이미지 스튜디오 UX 계획 1건이다. 그 문서의 Phase 3은 비디오 A3·A4 후 착수를 명시하고, 본 계획은 이미지 스튜디오를 명시 제외한다. 공유 표면인 `features.json`·`tests/new-tools-smoke.mjs`·이원 기록에서도 현행 이미지 계약을 보존하며 A4 추가만 하므로 상반 지시가 없다.
- 워킹트리 보호: 착수 전 추적 변경은 0건이고 미추적 `*.MP4` 3개·`before.docx`·`after.docx`만 있다. 모두 범위 밖 사용자 파일로 보존하고 명시 스테이징에서 제외한다.
- 게이트 판정: 충돌 없음. A1·A2·A3가 반영된 `b0b4d6f`에서 계획 §2 A4와 해당 B5 검증만 착수한다. B4·B2·B3은 진행하지 않는다.

## A4 실행 기록 (2026-09-03, Codx)

- 결과 계약을 buffer/File/브라우저 임시 파일 참조로 확장하고, 처리 워커가 임시 파일 저장을 완료한 뒤 참조를 보내며 클라이언트가 비동기 `onOutput` 직렬 큐를 끝까지 기다리도록 구현했다. 세션별 소유 ID·24시간 lease·만료 세션만 청소·소유자 전용 해제·성공 파일 보존/부분 파일 삭제를 적용했다. 미지원/일반 실패는 기존 메모리 경로, 용량 부족은 128MiB 이하만 메모리 폴백하고 큰 결과는 안전 오류로 종결한다.
- 비디오 ZIP을 `@zip.js/zip.js@2.9.0` exact lock으로 교체했다. `BlobReader`를 순차 `await add`하고 `bufferedWrite:false`·강제 `zip64:true`로 같은 세션 임시 파일에 출력하며, 미지원 시 File 폴백한다. ZIP 워커는 버튼 실행 전 로드되지 않고 실제 Chrome 스모크에서 실행 뒤 1회만 요청됐다.
- 힙 실측: 64MiB×4=`268,435,456B` 결과를 File+object URL로 유지한 Chrome 3회에서 worker→main ArrayBuffer `0`, 메인 JS 힙 증분 중앙값 `69,604B`(결과 대비 `0.02593%`). 보고서: `/tmp/worklazy-video-result-storage-a4/video-result-storage-benchmark.json`.
- ZIP 실측: `8,388,731B` 입력 전체 `arrayBuffer()` `0`, stream `1`, 입력 구간 `129`개/최대 `65,536B`; 출력 `8,389,205B`, write `136`회/최대 `65,536B`. 강제 ZIP64 EOCD64·locator·classic EOCD와 외부 `unzip -t/-p` SHA 왕복을 통과했다.
- 임시 파일 성공·미지원·quota 소/대 분기·활성 취소 부분 파일 삭제·TTL 잔재·소유권·일반 실패 폴백, 실제 브라우저 ZIP64 파일, 오디오 BroadcastChannel handoff를 검증했다. `npm run build`, `npm run test:unit`(79/79), `npm run test:new-tools`, `npm run test:utilities`, `npm run test:static` 전부 exit 0. B4·B2·B3과 Mediabunny는 범위 밖으로 유지했다.

## B4 실행 게이트 (2026-09-03, Codx)

- 기준 해시 게이트: `git rev-parse HEAD` 및 `git rev-parse origin/main` 결과가 모두 `9dce5270ddf7eacc3bbf47e76cf0089b7661f7f7`로 일치했다. 사용자가 새 전제로 지정한 A4 완료 커밋 `0d643b329749c0732a8fcec4f98345b0ba3f74f5`까지가 현행 기준에 포함되었다.
- `git log --stat 0d643b3..HEAD` 및 비디오 표면 경로 제한 `git diff --name-only 0d643b3..HEAD -- <video 소스·테스트·스크립트>`를 확인했다. 기준 이후는 이미지 스튜디오 레이어 UI 커밋 `9dce527` 1건이고, 비디오 표면 차이는 0건이다. 공유 `features.json`·`tests/new-tools-smoke.mjs`의 diff에도 비디오/ZIP/OPFS 계약 변경이 없어 B4 전제와 무관함을 확인했다.
- 열린 계획서 충돌 검사: `docs/jobs/todo` 열린 문서는 본 정본 1건뿐이어서 상반 지시가 없다.
- 워킹트리 보호: 추적 변경은 0건이고, 미추적 MP4 3개·DOCX 2개는 범위 밖 사용자 파일로 보존하며 명시 스테이징에서 제외한다.
- 판정: 충돌 없음. `9dce527`에서 계획 §5 6–7단계(route 결정표 확정 + B4 기반)와 해당 B5 검증만 착수하고 B2·B3 스트리밍 워커는 구현하지 않는다.

## B4 실행 기록 (2026-09-03, Codx)

- MP4/MOV·H.264/HEVC 조합의 copy/target 후보와 MKV/WebM·VP9·CRF·audio·OPFS·quota 폴백 사유를 순수 route 결정표로 고정했다. 예상 출력 `1.5GiB` 이하만 스트리밍 실패 후 FFmpeg 폴백을 허용하며, B2/B3 미구현 상태의 648개 조합은 전부 사유 코드를 가진 FFmpeg route로 남겼다.
- `videoProcessingClient.ts`를 job별 route·실행·진행률 소유자로 추가하고 기존 클라이언트는 FFmpeg 전용 어댑터로 유지했다. preflight를 1.5GiB 가드 앞으로 옮기고 FFmpeg로 판정된 job에만 가드를 적용했다. 진행률은 demux/decode/encode/mux/write 가중치, duration/bytes job 집계, 단조 증가, 종결 후 무이벤트를 표현하고 `useOperationProgress`에도 단조성 가드를 더했다.
- 출력 이름·MIME·warning·오류 정규화·output count를 `videoProcessingShared.ts`로 추출하고 워커가 공통 계약만 사용하게 했다. 새 사용자 문구는 없고 ko/en 비노출 검사 용어만 확장했으며 SEO·정적 페이지·광고·격리 경로 변경은 없다. B2/B3 스트리밍 워커는 생성하지 않았다.
- 검증: `npm run build` exit 0(2,355 modules, 정적 55페이지), `npm run test:unit` 94/94, `npm run test:new-tools` 전체, `npm run test:utilities`, `npm run test:static` 모두 exit 0. `test:new-tools` 최초 1회는 preview 미기동 `ERR_CONNECTION_REFUSED`로 검증 시작 전 종료되었고 preview 기동 후 재실행이 통과했다.

## B2 실행 게이트 (2026-09-03, Codx)

- 기준 해시 게이트: `git rev-parse HEAD`와 `git rev-parse origin/main`이 모두 `681012017cbbd02c07abe7b92b59600be74653bc`로 일치했다. 사용자가 새 전제로 지정한 B4 완료 커밋이며, `git diff --name-status 6810120..HEAD -- src tests scripts package.json package-lock.json`는 출력 0건이다.
- 선행 판정: B1b 기록과 `docs/review-notes.md`를 재확인했다. Mediabunny 1.55.5는 B-frame trim duration이 FFmpeg보다 2프레임 길어 B2 허용치 1프레임을 넘었으므로 재도입하지 않고, 정본 대안인 `mp4box.js` 점진 demux + 정확 버전 `mp4-muxer`를 채택한다. zip.js 2.9.0 게이트는 A4에서 이미 통과·반영되어 있다.
- 열린 계획서 충돌 검사: `docs/jobs/todo`의 열린 문서는 본 정본 1건뿐이므로 같은 비디오 표면의 상반 지시는 없다.
- 워킹트리 보호: 착수 전 추적 변경은 0건이고 미추적 MP4 3개·DOCX 2개만 있다. 모두 범위 밖 사용자 파일로 보존하고 명시 경로 스테이징에서 제외한다.
- 판정: 충돌 없음. B4가 반영된 `6810120`에서 계획 §5 8단계 B2와 해당 B5 검증만 착수한다. B3 WebCodecs와 WebM 스트리밍은 구현하지 않는다.

## B2 실행 기록 (2026-09-03, Codx)

- `mp4box@2.4.1`+`mp4-muxer@5.2.2`를 exact lock하고 별도 지연 로드 워커에서 `File.slice` 점진 demux, 실제 track profile preflight, 키프레임 스냅, 동일 profile concat, `fastStart:false` 1MiB chunk mux를 A4 임시 파일 random-access target에 연결했다. route는 job별로 stream-copy/FFmpeg를 혼합하고, 스트리밍 실패는 예상 출력 1.5GiB 이하만 FFmpeg로 폴백한다. B3와 WebM 스트리밍은 제외했다.
- 실제 Chrome 2GiB 초과 실측 출력 `2,214,602,200B`, 전체 입력 `arrayBuffer()` `0`회, 최대 입력 slice `8,388,608B`, 출력 write `2,114`회/최대 `1,048,576B`·누적 단조 증가, 2,112 packets DTS 단조 증가, 취소 뒤 부분 파일 `0`건을 확인했다. 1.650–4.450초 trim은 원본/FFmpeg/신규 첫 keyframe SHA-256 동일, 시작 오차 `0ms`, duration 오차 `0프레임`, A/V 첫 DTS 오차 `0ms`였다. 보고서: `/tmp/worklazy-video-stream-copy-b2-final/video-stream-copy-benchmark.json`.
- H.264 MP4·MOV, HEVC MP4, 동일 profile concat은 stream-copy, VP9 WebM·MKV와 profile 불일치 concat은 FFmpeg로 라우팅됐다. `npm run build`, `npm run test:unit`(97/97), `npm run test:new-tools`, `npm run test:utilities`, `npm run test:static` 모두 exit 0. ko/en 내부 명칭 비노출과 워커 요청 지연 로드도 통과했다.

## B3 실행 게이트 (2026-09-03, Codx)

- 기준 해시 게이트: `git rev-parse HEAD`와 `git rev-parse origin/main`이 모두 `a4c638e6c27393f8f68d4556a2448b17fe8efab2`로 일치했다. 사용자가 새 전제로 지정한 B2 완료 커밋이며, `git diff --name-status a4c638e..HEAD -- src tests scripts package.json package-lock.json docs CHANGELOG.md`는 출력 0건이다.
- 열린 계획서 충돌 검사: `rg --files docs/jobs/todo` 결과 열린 문서는 본 정본 1건뿐이므로 같은 비디오 표면의 상반 지시는 없다.
- 워킹트리 보호: 착수 전 추적 변경은 0건이고 미추적 MP4 3개·DOCX 2개만 있다. 모두 범위 밖 사용자 파일로 보존하고 명시 경로 스테이징에서 제외한다.
- 판정: 충돌 없음. B2 스트리밍 워커·오케스트레이터·OPFS 출력 기반이 반영된 `a4c638e`에서 계획 §5 9단계 B3와 해당 B5 검증만 착수한다. WebM/MKV 스트리밍과 FFmpeg 오디오 하이브리드는 구현하지 않는다.

## B3 실행 기록 (2026-09-03, Codx)

- MP4 H.264/HEVC 목표 비트레이트 job은 입력 decoder·선택 encoder 지원 판정 뒤 WebCodecs로 보내고 CRF·VP9·WebM·MKV·unknown concat FPS와 설정 미지원은 FFmpeg로 유지했다. 코덱 자동 변경 없이 `hardwareAcceleration:"no-preference"`를 적용했다. 오디오는 remove/copy/지원되는 encode만 처리하며 encode 설정 미지원은 전체 job FFmpeg 폴백이다.
- B2의 점진 MP4 demux·1MiB chunk `mp4-muxer`·OPFS random-access target·`fastStart:false`를 재사용하고, worker 내 aspect crop·scale/pad·rotation·flip·concat 공통 해상도/최대 실측 FPS CFR 정규화를 구현했다. decode/encode queue backpressure, frame/audio close, 취소 flush/close와 부분 파일 삭제를 고정했다.
- Chrome 152/Linux/COI=true에서 고정 H.264+Aac 640×360/30fps/6초 fixture를 warm-up 1회+3회 측정했다. 새 경로 `362.385/351.585/354.490ms`(중앙값 `354.490ms`) 대 FFmpeg.wasm `1648.970/1545.495/1581.195ms`(중앙값 `1581.195ms`)로 `4.460×`였다. 입력 전체 `arrayBuffer()` 0회, output write 최대 1MiB·단조 증가, queue 최대 decode/encode 8/5, decoded/encoded 180/180과 video frame close 360을 확인했다.
- 9:16+rotation+flip+audio remove concat은 640×360/12초로 재생됐고, 1.650–4.450초 trim의 첫 A/V DTS 오차는 `0ms`(≤50ms), 전체 decode exit 0이었다. 취소 뒤 부분 파일 0건, AAC AudioEncoder 설정 미지원 시 `AUDIO_ENCODER_UNSUPPORTED`→FFmpeg route를 실제 확인했다. 보고서: `/tmp/worklazy-video-webcodecs-b3-final/video-webcodecs-benchmark.json`.
- `npm run build`(2,358 modules·정적 55페이지), `npm run test:unit`(100/100), `npm run test:new-tools`, `npm run test:utilities`, `npm run test:static`, `git diff --check` 모두 exit 0. §5의 1~9단계는 완료됐고 잔여는 10단계 WebM/AudioEncoder/하이브리드 확대(후속)뿐이다.
