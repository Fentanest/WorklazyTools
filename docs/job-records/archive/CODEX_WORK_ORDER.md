# Codex 작업지시서 — Worklazy Tools 전 기능 점검 (2026-08-15)

전 소스(약 1.5만 줄)를 기능 영역별로 정독하고, 핵심 주장(공휴일 계산, zxcvbn 채점, ExcelJS/papaparse/fast-xml-parser 동작, fabric/gifenc 내부 등)은 실제 라이브러리 실행으로 재현·검증한 결과다. 발견 사항을 우선순위·작업 패키지 단위로 정리했다. 각 항목의 파일:라인은 점검 시점(커밋 `a94aab6`) 기준이다.

---

## 0. 공통 지침 (모든 작업에 적용)

1. **스택 제약**: 이 프로젝트는 GitHub Pages 정적 호스팅에서 구동 가능한 스택만 사용한다(CLAUDE.md). 백엔드 API·서버 헤더(COOP/COEP 포함) 추가 금지. 새 의존성은 브라우저 번들 가능해야 하며 벤더링 정책(`scripts/vendor-browser-runtimes.mjs`)을 따른다.
2. **i18n 규칙**: 사용자 노출 문자열은 `src/locales/{ko,en}/*.json` 양쪽에 추가한다. 워커에서 새 메시지를 만들 때는 가능하면 문구 대신 메시지 키/코드를 반환하고 UI에서 `t()`로 변환한다(기존 인라인 `L(ko,en)` 패턴을 확장하는 것은 지양 — 패키지 A17/C15/D13 참조).
3. **검증**: 수정 후 `npm run build`(tsc + vite + 정적 페이지 생성)가 통과해야 한다. UI 스모크는 `npm run test:browser` / `test:new-tools` / `test:utilities`, 정적 출력은 `npm run test:static`. 계산 로직 수정 시 P3-G19의 단위 테스트를 먼저 만들고 고치는 것을 권장한다.
4. **우선순위 정의**
   - **P0**: 조용한 데이터 훼손 또는 명백히 잘못된 결과를 사용자에게 제공 — 즉시 수정
   - **P1**: 주요 버그·핵심 UX 결함(특정 조건에서 기능 불능, 잘못된 출력, 멈춤)
   - **P2**: 경미한 버그·불일치
   - **P3**: 코드 품질/구조 개선
   - **P4**: 기능 추가 제안(구현 전 소유자 확인 권장)
5. **작업 단위**: 패키지(A~G)는 서로 파일이 겹치지 않으므로 병렬 진행 가능. 패키지 내에서는 P0→P1→P2 순서로 진행한다.

## 요약

| 패키지 | 영역 | P0 | P1 | P2 | P3/P4 |
|---|---|---|---|---|---|
| A | 비디오 스튜디오 | – | 4 | 11 | 7 |
| B | 오디오 스튜디오 | – | 2 | 7 | 6 |
| C | 이미지 스튜디오·EXIF·QR | 1 | 4 | 8 | 8 |
| D | PDF 도구 | – | 5 | 5 | 9 |
| E | Excel 병합·데이터·텍스트 | 2 | 7 | 12 | 4 |
| F | Word/HWP 비교·HWP 편집 | – | 3 | 10 | 5 |
| G | 계산기·보안·공통 인프라 | 1 | 7 | 9 | 5 |

---

## 패키지 A — 비디오 스튜디오

대상: `src/features/video-studio/*`

### [A1] P1 · 버그 — H.264/HEVC에서 지정 비트레이트가 CRF에 의해 무시됨
- 파일: `src/features/video-studio/video.worker.ts:328`, `VideoStudioPage.tsx:883`
- 문제: `createEncodeArguments`가 비-VP9 코덱에 `-crf`와 `-b:v`를 항상 동시에 전달한다. libx264/libx265는 `crf >= 0`이면 레이트컨트롤을 CRF로 강제하므로 사용자가 2M/5M/8M/직접입력 비트레이트를 골라도 실제로는 CRF 23으로 인코딩된다. VP9만 `-b:v`+`-crf`가 의도된 CQ 모드다.
- 수정: h264/hevc에서 `task.bitrate !== "0"`이면 `-crf`를 생략하고 `-b:v X -maxrate X -bufsize 2X`를 사용. UI에서 비트레이트 지정 시 CRF 슬라이더 비활성화.
- 완료 기준: 5M 지정 후 출력 파일 비트레이트가 목표치 ±20% 이내.

### [A2] P1 · 버그 — duration이 Infinity/NaN인 영상(화면 녹화 WebM) 미가드
- 파일: `VideoStudioPage.tsx:636-641` (onLoadedMetadata), 참고 `video.worker.ts:431`
- 문제: MediaRecorder 산출 WebM은 Chrome에서 duration이 `Infinity`로 보고된다. 검증 없이 저장되어 트림 슬라이더 `max={Infinity}` 파손 + 내보내기 시 워커 `validateInput`에서 실패하며, UI에서 복구 불가.
- 수정: `Number.isFinite(duration) && duration > 0`이 아니면 ffmpeg probe(`probeItem`)로 폴백하거나 `video.currentTime = 1e101` 후 `durationchange`에서 실제 길이를 취득.

### [A3] P1 · 버그 — 동기 재생의 rAF 기반 `syncing` 가드로 seek 핑퐁 레이스
- 파일: `VideoStudioPage.tsx:289-306, 645`
- 문제: `syncing.current`를 rAF(≈16ms)에서 해제하지만 프로그램적 seek의 `seeked` 이벤트는 수십~수백 ms 뒤 도착한다. 가드가 풀린 뒤 각 동기화 대상이 다시 source가 되어 그룹 전체가 상호 재시킹하는 왕복 루프가 발생 가능. 재현: 동기 재생 ON 그룹에서 네이티브 탐색 바 드래그.
- 수정: 플레이어별 "예상 시킹 값" Map을 두고 `onSeeked`에서 예상값과 일치하면 전파 중단, 또는 source와의 차이가 0.05초 미만이면 `currentTime` 설정 생략(엡실론 가드).

### [A4] P1 · 성능 버그 — `readBytes`의 `data.slice()`가 결과 파일 전체를 불필요 복제
- 파일: `video.worker.ts:445-449`
- 문제: `@ffmpeg/ffmpeg` 0.12의 `readFile`은 이미 독립·정확한 크기의 버퍼를 transfer로 반환하는데 `.slice()`로 한 번 더 전체 복사해 피크 메모리 2배. 최대 1.5GB 결과를 허용하는 도구라 OOM 경계를 좌우한다.
- 수정: `return data;`로 바꾸고 그대로 transfer. 초대형 mp4 출력에서 `-movflags +faststart`(먹싱 2차 패스가 결과 크기만큼 임시 사본 생성) 생략도 검토.

### A-P2 (경미 버그 11건)
- **[A5]** `video.worker.ts:308-311` — GIF 이어붙이기가 무조건 16:9 캔버스로 레터박스. 개별 GIF(`gifFilter`, 379-381)처럼 첫 입력 비율 기준으로 캔버스 계산.
- **[A6]** `video.worker.ts:354-359` + `VideoStudioPage.tsx:936-937` — libopus는 8/12/16/24/48kHz만, libmp3lame은 ≤48kHz만 지원하는데 UI가 44.1kHz·8k~192kHz 직접입력을 무제한 허용. 컨테이너별 선택지 제한 또는 워커에서 지원값으로 스냅.
- **[A7]** `video.worker.ts:362-372, 528-533` — `scale=-2:${res}`가 높이 기준이라 세로 영상에 1080p 선택 시 오히려 축소, 저해상도 원본 업스케일 무가드, `aspect≠source`일 때 resolution "source"가 1080으로 강제됨. 짧은 변 기준 스케일 + `min()` 가드 + aspect/source 조합 시 원본 짧은 변 유지로 수정.
- **[A8]** `video.worker.ts:275-285, 337-342` — concat 시 오디오 `-ar`/`-ac` 비정규화 상태로 `-c copy` 병합되어 파라미터가 다른 원본 조합에서 드리프트/글리치. concat+인코딩 시 세그먼트에 고정 `-ar 48000 -ac 2` 강제.
- **[A9]** `videoWorkerClient.ts:20-26`, `videoZipClient.ts:16-22` — 언어 감지 정규식이 `BASE_URL`을 무시(워커 내부 `video.worker.ts:11`과 불일치). 서브패스 배포 시 coi-serviceworker 스코프를 벗어나 멀티스레드가 조용히 비활성화됨. `import.meta.env.BASE_URL` 기반으로 통일하고 중복 `localizedWorkerUrl` 두 벌을 공용 모듈로 추출.
- **[A10]** `VideoStudioPage.tsx:690` — "구간 재생"이 종료 지점에서 멈추지 않음. `timeupdate`에서 `currentTime >= item.end`이면 pause.
- **[A11]** `VideoStudioPage.tsx:683-685` — 트림 숫자 입력이 `toFixed(1)` 컨트롤드 값이라 타이핑 불가, 빈 값이 0으로 튐, 슬라이더 step(0.01) vs 입력 step(0.1) 불일치. 로컬 문자열 state + blur/Enter 파싱으로 전환.
- **[A12]** `VideoStudioPage.tsx:210-216` — 대형 파일 안내가 기존 파일 포함으로 계산되어 반복 표시되고, rejected 존재 시 표시 자체가 생략됨(삼항 체인). 신규 파일 기준 계산 + 메시지 결합 표시.
- **[A13]** `VideoStudioPage.tsx:1057-1061` — ZIP 다운로드 직후 0ms에 Blob URL revoke. 수 초 지연 또는 unmount 시 정리로 변경.
- **[A14]** `video-probe.worker.ts:46-51` — probe가 회전 메타데이터·attached pic(커버 아트) 스트림을 구분하지 않아 concat 치수 판정이 어긋날 수 있음. rotation/displaymatrix 파싱 반영, attached pic 제외.
- **[A15]** `README.md:71` — "최대 6개 영상·6개 그룹"은 옛 스펙. 실제는 무제한·10그룹(`GROUP_IDS`, `VideoStudioPage.tsx:102`). README 갱신(취소 버튼·오디오 스튜디오 핸드오프 포함).

### A-P3/P4
- **[A16·P3]** `VideoStudioPage.tsx:646-651, 679-680` — 재생·트림 드래그 중 1068줄 컴포넌트 전체 리렌더. 그룹 섹션·트림 레인을 메모이즈된 하위 컴포넌트로 분리, 플레이헤드는 그룹 로컬 state/ref로 격리.
- **[A17·P3]** 페이지·워커·클라이언트의 인라인 `L()` 123회 → `features.json` video 네임스페이스로 이전(현재 features.json에 video 키 전무). A16의 컴포넌트 분리와 함께 진행.
- **[A18·P3]** `video-zip.worker.ts:23` — `blob.arrayBuffer()` 선복사 대신 `zip.file(name, blob)` + `generateAsync({streamFiles:true})`로 피크 메모리 절감.
- **[A19·P4]** 동기 재생 드리프트 보정: `timeupdate`에서 기준 플레이어 대비 0.15초 초과 시 재정렬.
- **[A20·P4]** ±1프레임(또는 ±0.1초) 스텝 버튼·키보드 미세 트림, 회전/좌우반전(`transpose`/`hflip`) 옵션 추가.
- **[A21·P4]** `video.worker.ts:365-369` — concat 인코드 시 `fps=30` 하드코딩으로 60fps 클립 저하. 입력 최대 fps 사용.
- **[A22·P4]** `VideoStudioPage.tsx:172, 776` — 메타데이터 실패 파일 1개가 안내 없이 전체 출력 버튼을 차단. 차단 사유 표시 또는 실패 항목 자동 제외 옵션.

---

## 패키지 B — 오디오 스튜디오

대상: `src/features/audio-studio/*`

### [B1] P1 · 버그 — 초기 로드 중 취소가 동작하지 않거나 진행 UI가 영구 멈춤
- 파일: `AudioStudioPage.tsx:259-283, 636`
- 문제: (1) `activeControllerRef`가 디코드 완료 후에야 생성되어 디코드 중 취소는 no-op이고 `loadGenerationRef`도 증가하지 않는다. (2) PREVIEW 단계에서 취소하면 catch(277-278)가 AbortError를 무시한 채 `progress.fail/succeed`를 호출하지 않아 `busy`가 영원히 true — 스피너·취소 버튼이 남고 재클릭도 no-op. 269행의 조용한 `return`도 같은 멈춤 경로.
- 수정: catch/이상 경로에서 `generation === loadGenerationRef.current`이면 반드시 `progress.fail(...)`로 종결하고, 취소 버튼이 `loadGenerationRef.current += 1`도 수행.

### [B2] P1 · 버그 — `decodeAudioData`가 기기 샘플레이트로 리샘플링, 표시값도 파일 값이 아님
- 파일: `AudioStudioPage.tsx:247, 263`
- 문제: `new AudioContext()`는 하드웨어 레이트(보통 48kHz)로 생성되고 decode 결과가 그 레이트로 리샘플링된다. 44.1kHz MP3가 문서·내보내기 전체에서 48kHz가 되고, 화면의 "48,000Hz"는 기기 값이다. "WAV · 무손실" 안내와 상충.
- 수정: WAV(fmt 청크)·MP3(프레임 헤더) 등은 헤더에서 원본 레이트를 스니핑해 `new AudioContext({ sampleRate })`로 디코드. 스니핑 불가 포맷은 현행 유지 + 안내 문구 정확화.

### B-P2 (경미 버그 7건)
- **[B3]** `AudioStudioPage.tsx:241-242, 261-263, 277-278` — 연속 파일 드롭 시 이전 로드의 늦은 실패/진행 갱신이 새 로드 UI를 덮음. catch·progress 갱신 지점에 `generation !== loadGenerationRef.current`면 return 가드 추가.
- **[B4]** `AudioStudioPage.tsx:341, 358` — PASTE 시 커서를 요청 시점과 완료 후 두 번 읽어 표시 선택 영역과 실제 삽입 위치가 어긋날 수 있음. 커서를 1회 캡처해 양쪽에 사용(+붙여넣기 시 일시정지 권장).
- **[B5]** `audioProcessor.worker.ts:145, 284-312` — 피치 변환 입력을 16비트 WAV로 양자화해 Float32 문서 정밀도 손실(반복 적용 시 누적). 인터리브 Float32를 `-f f32le`로 직접 전달.
- **[B6]** `audioProcessor.worker.ts:235` — 3채널 이상 오디오 MP3 내보내기가 원인 불명 오류로 실패(libmp3lame 최대 2채널). exec에 `-ac 2` 추가 또는 명확한 안내.
- **[B7]** `AudioStudioPage.tsx:574, 576` — 시작·종료 입력이 `toFixed(3)` 컨트롤드 값이라 직접 타이핑 불가. 로컬 문자열 state + blur/Enter 파싱으로 전환(A11과 동일 패턴 — 공용 훅화 권장).
- **[B8]** `audioProcessor.worker.ts:288-292` — WAV 크기 상한 검사가 RIFF 헤더 uint32 오버플로를 완전히 막지 못함. 상한을 `0xffffffff - 44`로 조정.
- **[B9]** `README.md` — 도구 목록에 오디오 스튜디오 섹션 자체가 누락(toolRegistry·SEO에는 정식 등록). 비디오 스튜디오 다음에 섹션 추가.

### B-P3/P4
- **[B10·P3]** `AudioStudioPage.tsx:370-399, 491-541` — `restoreHistory`/`togglePlayback` 미메모이즈로 keydown 리스너가 매 렌더 재등록. `useCallback` 또는 ref 경유.
- **[B11·P3]** `audioProcessor.worker.ts:46, 319-321` — EXPORT_WAV의 `exactBuffer`가 불필요한 전체 복사(피크 메모리 2배). `encodeWav` 산출 버퍼는 그대로 transfer.
- **[B12·P3]** worker `describeCommand`(329-346)와 `features.json audio.edit.*` 문구 이중 관리(이미 드리프트). 워커는 키·진행률만 postMessage.
- **[B13·P3]** 716줄 단일 컴포넌트 분리(`useAudioDocument` + VoiceEffectPanel/ExportPanel), `t: (key: never)`·`as never` 캐스트 제거, `audioHelpers.ts:28-32` 256MB 예산이 undo/redo에 각각 적용되어 실질 2배인 문제 정리.
- **[B14·P4]** 요청당 FFmpeg 재로드(32MB wasm)로 음성 효과 미리듣기가 매번 느림. 세션 단위 워커/인스턴스 유지 또는 wasm ArrayBuffer 캐시.
- **[B15·P4]** 기본 편집 기능 공백(코드로 부재 확인): 페이드 인/아웃·게인·피크 정규화(기존 선택 구간+worker 구조에 명령 추가), 선택 구간만 남기기(트림)·선택 구간만 내보내기, Ctrl+C/X/V·Delete 단축키, undo 후 선택 영역 복원(히스토리에 selection 저장).

---

## 패키지 C — 이미지 스튜디오 · 이미지 개인정보 · QR

대상: `src/features/image-studio/*`, `src/features/image-privacy/*`, `src/features/qr-studio/*`

### [C1] P0 · 버그 — HiDPI 화면에서 JPG 내보내기가 좌상단 일부만 확대되어 저장됨
- 파일: `ImageStudioPage.tsx:427-436`
- 문제: JPEG 경로가 `flattened.width = instance.getWidth()`(논리 크기)로 캔버스를 만들고 `drawImage(instance.getElement(), 0, 0)`을 크기 인자 없이 호출한다. Fabric 7은 `enableRetinaScaling` 기본 활성으로 백킹 스토어가 DPR배이므로, DPR=2에서 장면의 좌상단 1/4이 2배 확대된 JPG가 저장된다. DPR>1인 모든 노트북/모바일에서 재현. (PNG/WebP 경로는 정상.)
- 수정: `context.drawImage(el, 0, 0, flattened.width, flattened.height)`로 목적지 크기 지정, 또는 `instance.toCanvasElement(1)` 결과를 흰 배경 위에 그리기.
- 완료 기준: DPR=2 환경(또는 `devicePixelRatio` 에뮬레이션)에서 JPG 저장 결과가 화면 전체와 일치.

### [C2] P1 · 버그 — GIF 생성: 프레임이 전부 불투명하면 가장 어두운 색이 투명으로 뚫림
- 파일: `image.worker.ts:123-125`
- 문제: `writeFrame`에 항상 `transparent: true`를 주면서 `transparentIndex` 미지정(기본 0). 투명 픽셀이 전혀 없는 프레임(같은 크기 사진 연속 — 가장 흔한 경우)에서는 인덱스 0이 가장 어두운 불투명 클러스터가 되어 검정/어두운 영역이 투명으로 렌더링된다.
- 수정: 프레임에 알파<255 픽셀이 없으면 `transparent: false`, 있으면 팔레트에서 `c[3]===0`인 인덱스를 찾아 `transparentIndex`로 전달.

### [C3] P1 · 버그 — QR 생성 오류가 표시되지 않고 이전 내용의 QR을 그대로 다운로드하게 됨
- 파일: `QrStudioPage.tsx:63-67, 266-276, 295`
- 문제: 오류 UI가 스캔 모드 분기에만 렌더링된다. `errorCorrectionLevel: "H"`는 최대 1,273바이트라 긴 텍스트에서 라이브러리가 throw하는데, 사용자는 안내 없이 마지막 성공한(이전 텍스트의) QR을 다운로드/공유할 수 있다 — 잘못된 QR 배포 위험.
- 수정: 생성 모드에도 오류 배너 렌더링, 성공 시 `setError("")`, 실패 시 캔버스 비우기 또는 다운로드 버튼 비활성화, 용량 초과 전용 메시지.

### [C4] P1 · 버그 — EXIF 도구의 "숨은 정보 감지 개수"가 항상 부풀려짐
- 파일: `image-privacy.worker.ts:14`
- 문제: `Object.keys(tags).length`가 ExifReader의 파일 구조 태그(Image Width/Height, Bit Depth 등)까지 센다. 메타데이터 없는 1×1 PNG 실측 결과 8개 — 깨끗한 사진도 "숨은 정보 8개 감지"로 표시되어 도구 신뢰도를 훼손.
- 수정: `ExifReader.load(buffer, { expanded: true })`로 `exif`·`gps`·`xmp`·`iptc` 그룹 태그만 계수.

### [C5] P1 · 기능 결함 — 편집기 내보내기가 900×600 캔버스 해상도로 고정(원본 해상도 손실)
- 파일: `ImageStudioPage.tsx:196-198, 437`
- 문제: 로드 시 원본을 캔버스에 맞춰 축소(소형 이미지는 상한 없이 확대)하고 `multiplier: 1`로 내보내, 4000×3000 사진 편집 결과가 여백 포함 900×600 파일이 된다.
- 수정: 표시용 스케일과 내보내기 분리 — `toDataURL({ multiplier: 1/scale })`로 원본 해상도 복원(또는 내보내기 크기 선택 UI). 최소한 `Math.min(1, ...)`로 확대 방지.

### C-P2 (경미 버그 8건)
- **[C6]** `image-privacy.worker.ts:12` — GPS 좌표에 남/서반구 부호 누락(시드니 사진이 북위·동경처럼 표시). `expanded: true`의 `tags.gps.Latitude/Longitude`(부호 포함) 사용.
- **[C7]** `ImageStudioPage.tsx:34, 46` — 작업 실행 중 탭 전환 시 `progress.reset()`만 호출되어 취소 버튼이 사라지고, 다음 진행 메시지가 status를 "running"으로 되살려 상태가 꼬이며, 완료 시 보이지 않는 탭의 ZIP이 갑자기 다운로드됨. 탭 전환 시 `activeController.current?.abort()` 호출 또는 실행 중 reset 생략.
- **[C8]** `ImageStudioPage.tsx:187-221, 245, 252, 446` — 손상 이미지 로드 실패가 무음(unhandled rejection). 호출부 catch + 인라인 오류 표시.
- **[C9]** `QrStudioPage.tsx:254-259, 118`, `ImagePrivacyPage.tsx:24` — `file.arrayBuffer()`가 try 밖이라 읽기 실패 시 busy 영구 고착, QR은 input을 읽기 전에 리셋(자체 `ui.tsx:135-137` 주석과 모순). try/catch로 감싸고 리셋은 읽기 완료 후로.
- **[C10]** `ImageStudioPage.tsx:106-131, 387-419` — undo/redo 복원 중 `object:added`의 80ms 디바운스 스냅샷이 `restoringRef` 해제 후 발화해 가드 우회(직렬화가 달라지면 redo 스택 잘림). restore 종료 직전 `clearTimeout` 한 번 더 호출.
- **[C11]** `ImageStudioPage.tsx:691-707, 245` — 전역 paste가 입력 필드 포커스를 무시하고, 편집기 탭에서는 히스토리까지 초기화해 Ctrl+V 실수로 작업 전체가 복구 불가 파괴됨(`newBlankCanvas`는 confirm을 받는 것과 대조). 입력 요소 대상 paste 무시 + 기존 객체 있으면 확인 또는 히스토리 유지.
- **[C12]** `ImageStudioPage.tsx:437`, `image.worker.ts:57, 95` — WebP 인코더 없는 브라우저(구형 Safari)에서 PNG 폴백 데이터가 `.webp` 확장자로 저장됨. 결과 MIME 확인 후 확장자 교정 또는 미지원 안내.
- **[C13]** `image.worker.ts:201-222` — 워터마크 이미지+텍스트 동시 지정 시 텍스트가 조용히 무시(`if/else if`). 둘 다 그리거나 UI에서 상호배타 안내.

### C-P3/P4
- **[C14·P3]** `ImageStudioPage.tsx:715-758` ↔ `image.worker.ts:162-199` — 콜라주 레이아웃·그리기 로직 이중 구현, 이미 `Math.max(1,...)` 클램프 유무로 드리프트 시작. 순수 함수를 `collageLayout.ts`로 추출해 공유.
- **[C15·P3]** `image.worker.ts:310-312` — `sizeError`/`columnError`가 로케일 키와 완전 중복, `clipboardFile()`은 정의된 `image.common.clipboardPrefix` 키를 두고 하드코딩. 워커는 오류 코드만 반환.
- **[C16·P3]** 772줄 파일 분리(패널별), `runImageWorker(message: object)` 타입 상실 — 요청/응답 유니언을 `types.ts`로 옮겨 클라이언트·워커 공유, `event.data` 암묵 any 제거.
- **[C17·P4]** 자르기: 드래그 영역 지정 부재, 세로 프리셋(3:4·9:16) 부재, `cropTo`가 레이어 좌표 미보정. 세로 프리셋 + 비율 변경 시 레이어 상대 위치 유지부터.
- **[C18·P4]** 텍스트(FabricText)·직선(Line) 추가 후 수정 불가 — `IText` 사용 + 스타일 패널의 Line/Text 지원, 레이어 복제.
- **[C19·P4]** GIF: 프레임 순서 변경(의존성에 이미 있는 sortablejs 활용)·결과 미리보기·프레임별 지연·최소 지연 20ms 검증·클립보드 붙여넣기.
- **[C20·P4]** 이미지 개인정보: `slice(-1)` 단일 처리 → 다중 선택+ZIP(batch 워커 패턴 재사용), WebP 입력 허용.
- **[C21·P4]** QR 스캔 결과가 URL이면 "열기" 버튼(`rel="noopener"`), 복사 성공/실패 피드백.

---

## 패키지 D — PDF 도구

대상: `src/features/pdf-editor/*`

### [D1] P1 · 버그 — 소유자 암호(권한 제한) PDF가 편집을 다 마친 뒤 내보내기에서야 실패
- 파일: `pdfPreview.ts:34, 50-53`, `pdf.worker.ts:183`, 참고 `PdfConvertPanel.tsx:38`
- 문제: pdf.js는 owner-password PDF를 정상적으로 열어 검사·썸네일·편집까지 성공하지만, 내보내기의 `PDFDocument.load(buffer, { ignoreEncryption: false })`는 모든 암호화 PDF에서 throw(pdf-lib은 복호화 미지원). 사용자는 수십 페이지를 정리한 뒤 마지막에 실패를 만난다.
- 수정: `inspectPdf`에서 `document.getPermissions()`가 non-null이거나 `/Encrypt` 존재 시 파일 추가 시점에 즉시 거부/경고.

### [D2] P1 · 버그 — rAF 기반 `yieldToBrowser`로 백그라운드 탭에서 OCR·이미지 변환이 무기한 정지
- 파일: `pdfPreview.ts:339-341` (사용처 146, 228)
- 문제: 숨겨진 탭에서 rAF가 발화하지 않아, 오래 걸리는 OCR 중 탭을 전환하면(가장 흔한 시나리오) 작업이 멈췄다가 탭 복귀 시 재개된다 — 사용자에겐 "멈춤/실패"로 보임.
- 수정: `setTimeout(resolve, 0)`(또는 `scheduler.yield?.()` 폴백)로 교체, 혹은 `visibilityState === "hidden"`일 때만 타이머 사용.

### [D3] P1 · 버그 — 이미지→PDF에서 EXIF 회전 무시(미리보기와 다른 방향으로 출력)
- 파일: `pdf.worker.ts:134-160`, 참고 `PdfImagePanel.tsx:192`
- 문제: pdf-lib `embedJpg/embedPng`는 EXIF Orientation을 적용하지 않는데 미리보기 `<img>`는 회전된 모습을 보여준다. 스마트폰 세로 사진이 눕혀져 출력되고 A4 방향 판정(149행)도 틀어진다.
- 수정: 클라이언트에서 `createImageBitmap(file, { imageOrientation: "from-image" })` → 캔버스 재인코딩 후 워커 전달(또는 EXIF 태그를 읽어 페이지 회전 반영).

### [D4] P1 · 버그 — RenderTask 취소 부재 + convert/pdf-to-image의 인덱스 기반 key로 스테일 캔버스
- 파일: `PdfThumbnail.tsx:53-62`, `pdfPreview.ts:77-92`, `PdfConvertPanel.tsx:84`, `PdfImagePanel.tsx:159`
- 문제: 렌더 완료 후 canvas 쓰기가 취소와 무관하게 실행되어 같은 canvas에 두 렌더가 경합하면 늦게 끝난 쪽이 이긴다. 파일 교체 시 key(`convert-${index}`)가 그대로라 이전 파일의 페이지가 표시될 수 있고, 수백 페이지 빠른 스크롤 시 취소 불가 렌더가 CPU를 소모.
- 수정: RenderTask 보관 → cleanup에서 `cancel()`(`RenderingCancelledException` 무시), canvas 쓰기 전 취소 확인, key에 파일 식별자 포함.

### [D5] P1 · 성능 버그 — 내보내기 시 플랜에 없는 원본 PDF까지 전부 직렬화·파싱
- 파일: `PdfOrganizePanel.tsx:150`, `pdf.worker.ts:44-49`, `pdfWorkerClient.ts:58-64`
- 문제: 사용 여부와 무관하게 `sources` 전체를 ArrayBuffer화해 워커로 보내고 모두 pdf-lib으로 파싱 — 대형 PDF 여러 개 중 1개의 몇 페이지만 내보내도 수백 MB 복사·파싱.
- 수정: `new Set(plan.map(p => p.sourceId))`로 필터링해 사용 소스만 전송(merged·ranges·separate 공통).

### D-P2 (경미 버그 5건)
- **[D6]** `pdfOffice.worker.ts:101-103` — `escapeXml`이 XML 비허용 제어문자(\x00-\x08 등)를 제거하지 않아 DOCX가 손상 파일로 열릴 수 있음. `[\u0000-\u0008\u000B\u000C\u000E-\u001F]` 제거 추가.
- **[D7]** `pdf.worker.ts:136-139, 229-233` — 이미지 임베드가 확장자만으로 분기(`.png`로 저장된 JPEG 실패)하고 실패 시 pdf-lib 영어 원문이 그대로 노출. 매직 넘버로 판별 + 현지화 메시지.
- **[D8]** `PdfThumbnail.tsx:43-51` — 렌더된 썸네일 캔버스 무제한 보존(500페이지 ≈ 250MB, 모바일 탭 강제종료 요인). 뷰포트 이탈 시 비우고 재진입 시 재렌더 또는 LRU 상한.
- **[D9]** `PdfOrganizePanel.tsx:99-132, 145-179` — inspecting·내보내기 중 드롭존/페이지 조작이 살아 있어 중복 추가·결과-화면 불일치 가능. `FileDropZone`(ui.tsx:117)에 `disabled` prop 추가해 잠금.
- **[D10]** `PdfThumbnail.tsx:98-100` — 오른쪽 이동 버튼에 `disabled` 누락(왼쪽만 처리). 전체 개수를 받아 `outputIndex === total - 1`에서 비활성.

### D-P3/P4
- **[D11·P3]** `PdfOrganizePanel.tsx:63-80`, `PdfImagePanel.tsx:30-46, 84` — SortableJS 직접 DOM 이동 + React keyed 재조정 조합의 순서 어긋남 위험, 이미지 카드 key의 index 포함으로 재정렬 시 재마운트·깜빡임. onEnd에서 DOM 롤백 후 state 갱신(또는 react-sortablejs), 안정적 id key.
- **[D12·P3]** `pdf.worker.ts:37-68` — `mergePages`가 `loadSources`+`createPlannedPdf`와 중복. 그 외 `moveItem`/`normalizeRotation`/`binaryResult`/`ensureExtension`/파일명 sanitize가 각 2회 이상 정의. 공용 `pdfShared.ts`로 정리.
- **[D13·P3]** PDF 기능 전체가 인라인 `L(ko,en)` 방식(로케일 JSON에는 카드 문자열만 존재). `features.json` pdf 네임스페이스로 이관, 워커는 키만 전송. `PdfEditorPage.tsx:14-52`의 이중 정의도 정리.
- **[D14·P3]** `pdfOffice.worker.ts:50` — XLSX 변환이 수집한 셀 x좌표를 버리고 순서대로만 addRow해 행 간 열 정렬이 어긋남. 페이지 단위 x좌표 클러스터링으로 열 인덱스 배정.
- **[D15·P4]** 썸네일 클릭 확대(라이트박스) — 기존 `renderPageForExport` 재사용.
- **[D16·P4]** PDF→이미지에 페이지 범위 입력 추가(`parsePageRange` 기존 함수 재사용, convert 패널에는 이미 있음).
- **[D17·P4]** 워터마크·페이지 번호 삽입(pdf-lib drawText, 한글은 폰트 서브셋 임베드 필요), "이미지 기반 압축". 암호 설정은 pdf-lib 미지원이므로 라이브러리 검토 선행.
- **[D18·P4]** 병합 결과에 원본 메타데이터(Title/Author 등) 미보존 — 첫 소스에서 복사.
- **[D19·P4]** `pdfPreview.ts:98-125` — `parsePageRange` 열린 범위(`3-`, `-5`) 미지원, 역순(`3-1`)은 오류 대신 역순 해석 검토.

---

## 패키지 E — Excel 병합 · 데이터 변환 · 텍스트 도구

대상: `src/features/excel-merger/*`, `src/features/data-converter/*`, `src/features/text-tools/*`, `src/features/text-formatter/*`

### [E1] P0 · 버그 — CSV 병합 시 셀 값 무단 변환·날짜가 타임존만큼 밀림
- 파일: `excel.worker.ts:297-304`
- 문제: `workbook.csv.read` 기본 value map이 자동 변환을 수행한다. 실행 검증: `"00123"`→숫자 123(선행 0 소실), `"2024-01-05"`→로컬 자정 파싱으로 결과 파일에서 전날 15:00(KST 기준), `"true"`→불리언, `"#N/A"`→오류값. 사번·전화번호·날짜가 있는 일반적인 CSV가 조용히 훼손된다.
- 수정: `csv.read`에 커스텀 `map`(원문 유지 또는 UTC 날짜 파싱) 전달. 숫자 변환 유지 시 선행 0·자리수 보존 검사.
- 완료 기준: `00123`·`2024-01-05`가 포함된 CSV 병합 결과에서 원문 보존.

### [E2] P0 · 버그 — XML 포매터가 텍스트 값을 숫자로 강제 변환, CDATA 소실, 혼합 콘텐츠 공백 유실
- 파일: `text-formatter.worker.ts:21-23`
- 문제: `XMLParser` 기본 옵션 사용. 실행 검증: `<id>007</id>`→`<id>7</id>`, `0x1A`→`26`, `1e3`→`1000`, CDATA 소실, minify 시 `hello <b>world</b>` 공백 유실. FAQ의 "데이터가 달라지는 일을 막기 위해" 약속과 정면 배치.
- 수정: `parseTagValue: false, parseAttributeValue: false, trimValues: false, cdataPropName: "#cdata"` + `XMLBuilder`에도 `cdataPropName` 지정.

### [E3] P1 · 버그 — SQL Minify가 라인 주석 뒤 쿼리 전체를 주석으로 만듦
- 파일: `text-formatter.worker.ts:16, 31-49`
- 문제: `collapseSql`이 `--`/`#` 주석을 인식하지 못한 채 개행을 공백으로 접어, 주석 다음 줄부터의 쿼리 전체가 주석 속으로 들어간다(실행 재현). `'C:\'`류 문자열의 백슬래시 이스케이프 오판도 존재.
- 수정: 축소 전 라인 주석을 `/* */` 치환 또는 제거, 백슬래시 규칙은 MySQL 방언일 때만.

### [E4] P1 · 버그 — 시트 한정 범위 참조(`Sheet2!A1:A10`)의 두 끝점에 서로 다른 오프셋 적용
- 파일: `excel.worker.ts:441-458`
- 문제: `translateFormula`가 참조를 개별 치환해 콜론 뒤 끝점이 시트 한정자를 상속하지 못하고 현재 시트 오프셋을 받는다 — 세로/가로 병합에서 잘못된 범위(예: `SUM('병합 결과'!A4:A3)`)가 생성됨.
- 수정: 범위(`ref:ref`)를 단일 토큰으로 매칭해 뒤 끝점이 앞 끝점의 한정자를 상속하도록 수정.

### [E5] P1 · 버그 — SheetTrim(중간 빈 행·열 삭제)이 수식 참조·병합 셀을 보정하지 않음
- 파일: `excel.worker.ts:493-530`
- 문제: ExcelJS `spliceRows/spliceColumns`의 삭제 경로는 값만 이동하고 수식 재계산·`_merges` 갱신을 하지 않는다(ExcelJS 4.4 소스 확인). 수식 유지 모드에서 트림하면 수식이 옛 좌표를 참조하고, 병합 범위가 어긋나거나 복구 경고 발생.
- 수정: 트림을 복사 이전 plan 단계로 이동(빈 블록 스킵 행 매핑을 `copyWorksheet`·`translateFormula`에 반영), 또는 수식·병합 셀 존재 시 트림 건너뛰고 경고.

### [E6] P1 · 성능 버그 — SheetTrim의 빈 행·열 검사가 전체 그리드를 셀 객체로 실체화
- 파일: `excel.worker.ts:497-544`
- 문제: `getCell(row, column)`을 rowCount×columnCount 전 조합에 호출 — ExcelJS는 없는 셀을 생성하므로 10만 행 파일에서 수백만 객체 할당으로 OOM/수 분 정지(진행률 86%에서 멈춘 것처럼 보임).
- 수정: `row.eachCell({ includeEmpty: false })` + 한 번의 전체 순회로 열별 플래그 배열 구성(O(사용 셀 수)).

### [E7] P1 · 버그 — 행별 열 개수가 다른 CSV는 변환 전체가 실패
- 파일: `data-converter.worker.ts:15`
- 문제: papaparse의 `FieldMismatch`는 데이터가 정상 파싱되는 경고성 오류인데 즉시 reject한다(실행 재현). 마지막 열 쉼표를 생략한 흔한 엑셀 CSV가 전부 거부되고, reject 후 `parser.abort()` 미호출로 대형 파일은 계속 파싱된다.
- 수정: `FieldMismatch`는 무시/경고, `Quotes`/`Delimiter` 등 구조 오류만 실패. `chunk: (results, parser)`에서 reject 시 `parser.abort()`.

### [E8] P1 · 버그 — EUC-KR(CP949) CSV가 깨진 문자로 처리됨
- 파일: `excel.worker.ts:299-302`, `DataConverterPage.tsx:14`
- 문제: UTF-8 고정 해석. 한국어 Windows Excel 기본 CSV는 CP949라 주 사용자층의 파일이 오류 없이 mojibake로 병합·변환된다.
- 수정: `TextDecoder("utf-8", { fatal: true })` 시도 → 실패 시 `TextDecoder("euc-kr")` 폴백 자동 감지(+수동 인코딩 선택 UI)를 두 도구에 추가.

### [E9] P1 · 버그 — 파일명에 `[ ] : * ? / \` 또는 예약어("History")가 있는 CSV는 읽기 자체가 실패
- 파일: `excel.worker.ts:302`
- 문제: 파일명을 그대로 시트명으로 써서 ExcelJS 시트명 setter가 throw(실행 재현: `sales[Q1].csv`, `History.csv`). "파일이 손상되었거나…" 오류로 귀결. 병합 시트명 생성부(`createSafeUniqueName`, 605-616)는 이미 sanitize함.
- 수정: `csv.read` 호출 전 `createSafeUniqueName(stripExtension(fileName), new Set())`로 정리.

### E-P2 (경미 버그 12건)
- **[E10]** `ExcelMergerPage.tsx:699-716` — 시트 순번 패턴 `1-99999999` 입력 시 키 입력마다 메인 스레드에서 수천만 회 루프(탭 정지). 루프 상한을 `sheetCount`로 클램프.
- **[E11]** `excel.worker.ts:370, 378` — 세로 병합에서 한 파일의 숨김 열이 다른 파일 데이터까지 숨김(가로 병합의 숨김 행 동일). 병합 방향과 직교하는 축의 숨김은 전파하지 않음.
- **[E12]** `text-tools.worker.ts:19-21, 30` — 한국어 규칙 구조적 오탐 4종: '한번 해 보세요'(올바른 표기를 정확히 겨냥), '-지 못하다'(보조용언은 붙임), '안되다'(형용사), '결재 완료/취소'(전자결재 문맥 정상). lookahead를 오탐 문맥 제외형으로 수정.
- **[E13]** `text-tools.worker.ts:16-17, 36-44` — CORE와 GUIDE_RULES의 동일 패턴(`할수`, `할것`)으로 같은 발견이 2건 표시. 중복 조합 제외 또는 before+after 키 dedupe.
- **[E14]** `DataConverterPage.tsx:12` — `worker.onerror` 미설정으로 워커 로드 실패 시 busy 영구 고착(text-tools·text-formatter는 처리함). 동일 핸들러 추가.
- **[E15]** `ExcelMergerPage.tsx:281, 493` — 병합 성공 직후 입력 암호를 지우면서 "비밀번호가 필요합니다" 빨간 경고가 표시됨. 정보성 문구로 구분하거나 결과 카드 표시 중 숨김.
- **[E16]** `text-tools.worker.ts:80-83` — 케이스 변환이 여러 줄을 한 토큰으로 합침(실행 재현). 줄 단위 적용.
- **[E17]** `text-tools.worker.ts:71-78` — 중복 줄 제거가 빈 줄까지 삭제(문단 구분 소실), 75행 `return Boolean(key) && false;` 데드 코드. 빈 줄 유지 + 정리.
- **[E18]** `excel.worker.ts:307-313, 329` — XLS·XLSB·XLSM 변환 시 `cellNF: true`로 읽은 숫자 서식(`z`)을 버려 날짜가 일련번호로 표시. `targetCell.numFmt = sourceCell.z` 이관.
- **[E19]** `text-formatter.worker.ts:13` — JSON 포매터가 2^53 초과 정수를 조용히 반올림. 최소한 원본-재파싱 불일치 숫자 감지 시 경고.
- **[E20]** `excel.worker.ts:447-449` — 병합에서 제외된 시트를 참조하는 수식이 무경고로 #REF! 예정 상태가 됨. 이 분기에서 `warnings.add(...)`.
- **[E21]** `ExcelMergerPage.tsx:158, 200-201` — 암호 재검사 성공 시 custom 모드의 시트 선택이 전체 선택으로 초기화. 기존 선택이 새 목록의 부분집합이면 교집합 유지.

### E-P3/P4
- **[E22·P4]** 세로 병합 반복 헤더 행 제거 옵션("첫 시트 이후 상단 N행 건너뛰기") — README가 권장하는 월별 자료 병합 시나리오의 핵심 공백. `ExcelMergeOptions`(types.ts:13-22)에 옵션 추가.
- **[E23·P4]** 장시간 병합 취소 수단 부재(`excelWorkerClient.ts:22-64`) — `runWorker`가 abort 함수를 반환하고 진행 카드에 취소 버튼 노출.
- **[E24·P4]** `text-formatter.worker.ts:15` — SQL 방언 고정으로 T-SQL 대괄호 등 실패. 형식 UI에 방언 셀렉트 추가(sql-formatter 자체 지원).
- **[E25·P3]** `excel.worker.ts:656-845` + `types.ts:40-135` — Excel 워커에 Word 비교 보고서 로직(~190줄)과 Word* 타입 혼재. 별도 워커/공용 모듈로 분리. `ExcelMergerPage.tsx:147-167, 191-209`의 검사 결과 반영 중복도 `applyInspectionResult` 헬퍼로 통합(E21 수정을 한 곳에서). `text-tools.worker.ts:16-31`의 5중 `as` 캐스트는 튜플 타입 선언으로 대체.

---

## 패키지 F — Word 비교 · HWP 비교 · HWP 편집

대상: `src/features/word-compare/*`, `src/features/hwp-compare/*`, `src/features/hwp-editor/*`

### [F1] P1 · 버그 — HWP 파일 목록 간 드래그가 반대편 목록을 잘못 재정렬(쌍 매칭 오염)
- 파일: `HwpComparePage.tsx:297-299`
- 문제: 수정 전/후 목록이 같은 MIME 타입(`application/x-hwp-index`)에 인덱스만 담아, 반대편 목록으로 드래그하면 대상 목록이 소스와 무관한 인덱스로 재정렬된다 — 잘못된 문서끼리 비교될 수 있음. Word 페이지는 컬럼 로컬 state로 이 문제가 없음.
- 수정: MIME에 side 포함(`-before`/`-after`) 또는 Word 방식(컬럼 로컬 `draggedIndex`)으로 전환.

### [F2] P1 · 버그 — 변경 추적 DOCX의 `pPr/rPr` 내 `w:ins`/`w:del` 위치가 OOXML 스키마 순서 위반
- 파일: `src/features/word-compare/tracked_docx.py:620-633`
- 문제: 문단 기호 표식을 `rPr` 끝에 append하는데, `CT_ParaRPr`는 track-change 그룹이 모든 런 속성 앞에 오는 sequence다. 원본 문단 기호에 `rFonts` 등이 있으면 스키마 위반 document.xml이 생성되어 검증기·타 프로세서 거부/복구 경고 가능.
- 수정: `run_properties.insert(0, marker)`로 항상 첫 자식 삽입.

### [F3] P1 · 버그 — 영어 UI에서도 Word 비교의 위치·경고 문자열이 한국어로 고정
- 파일: `compare.py:316, 344, 378-399, 420, 1128-1131`, 참고 `word.worker.ts:58-66`
- 문제: 위치 라벨("본문 N번째 문단", "표 t · r행 c열", "머리말" 등)과 경고가 하드코딩 한국어이고 워커가 언어를 전달하지 않아, 영어 사용자의 웹 화면·Excel 보고서에 한국어가 노출된다(HWP·Excel 워커는 이중 언어 처리됨).
- 수정: `compare_documents`/`generate_tracked_document`에 language 인자 전달 분기, 또는 위치를 구조화 데이터로 반환하고 표시 계층에서 포맷.

### F-P2 (경미 버그 10건)
- **[F4]** `tracked_docx.py:1158-1171` — settings.xml 요소 순서 위반(trackRevisions/revisionView 위치·상대 순서 모두) + `trackRevisions` 강제 삽입으로 결과 문서를 여는 사용자의 이후 편집까지 추적됨. 스키마 순서 준수 + trackRevisions 삽입 재검토.
- **[F5]** `tracked_docx.py:942-945, 979-983` — 삭제된 표 행의 셀 텍스트가 `w:del`/`w:delText`로 감싸지지 않아 취소선 없이 표시. `kind=="del"` 행의 각 셀 문단에 `_whole_paragraph_revision(..., "del")` 적용.
- **[F6]** `tracked_docx.py:580-585` — 삭제 런의 탭·줄바꿈이 `delText` 리터럴 문자로 기록(요소여야 함). deleted 분기에서도 `w:tab`/`w:br` 요소 생성.
- **[F7]** `compare.py:1073-1077` — 짝 없는 before/after 표가 블록 정렬에서 한 그룹이 되면 한쪽 표 뷰만 출력되어 추가된 표가 문서 뷰에서 누락. 서로 다른 table_result면 두 뷰 모두 append.
- **[F8]** `compare.py:713-752` — 메모를 인덱스 순서로만 쌍짓기 — 새 메모 삽입 시 이후 전부 "변경" 표시. id 일치 → author+유사도 순 매칭.
- **[F9]** `hwp-compare.worker.ts:259-268` — 다중 구역 문서에서 각주·미주가 잘못된 구역에 귀속/누락 가능(구역 0부터 첫 `ok`에서 break + `seen` 키 충돌). 컨트롤의 구역 인덱스 확보 또는 `seen` 키 보강.
- **[F10]** `hwp-compare.worker.ts:326-330` — HWP 요약이 뷰 블록 단위 집계라 목록 카드(`changes.length`)·Word 요약(셀 단위)과 수치 불일치. `changes` 기반으로 통일.
- **[F11]** `wordWorkerClient.ts:39-58`, `hpWorkerClient.ts:47-62` — 비교 취소 수단 부재, 페이지 이탈 후에도 pyodide/rhwp 워커가 끝까지 실행. `{ promise, abort }` 반환 + unmount·취소 버튼에서 terminate.
- **[F12]** `word.worker.ts:99-100` — 암호화 DOCX(CFB 컨테이너)가 "손상된 파일"로 안내됨. `D0 CF 11 E0` 시그니처 감지 시 전용 메시지(가능하면 암호 입력 지원).
- **[F13]** `HwpEditorPage.tsx:228-235` — 다운로드 Blob URL을 0ms 뒤 revoke(A13·비교 페이지들과 달리 경합 위험). 지연 revoke로 변경.

### F-P3/P4
- **[F14·P3]** `compare.py:529-591, 791-835` / `tracked_docx.py:313-355` / `hwp-compare.worker.ts:461-616` — 동일 정렬 알고리즘(NW형 DP + 문단 분리 감지, 임계값 0.24/0.58 포함) 3중 구현. 최소한 같은 pyodide 런타임의 두 Python 파일은 공용 모듈로 통합, 임계값 상수 공유.
- **[F15·P3]** `WordComparePage.tsx:444-478` ↔ `HwpComparePage.tsx:316-344` — reorder/dedupe/fileKey/보고서 파이프라인/세션 revoke effect 등 스캐폴딩 중복. 공용 "문서 쌍 비교" 컴포넌트/훅으로 추출(F1 같은 구현 편차 원천 차단).
- **[F16·P3]** `word.worker.ts:7` / `scripts/vendor-browser-runtimes.mjs:13` / `package.json` — pyodide 버전 3곳 독립 하드코딩(rhwp는 교차 검증 있음). vendor 스크립트가 `node_modules/pyodide/package.json`에서 버전을 읽고 prebuild에서 일치 검증.
- **[F17·P3]** `tracked_docx.py:1204-1268` — numbering 정의 전체 복제로 결과 파일 비대화. 참조되는 numId만 선별 복사.
- **[F18·P4]** `WordCompareResultPage.tsx:110-137` — 긴 문서에서 "이전/다음 변경으로 이동" 버튼 부재. 변경 블록 anchor 기반 탐색 추가.

---

## 패키지 G — 계산기 · 보안 도구 · 공통 인프라

대상: `src/features/{work,payroll,timezone}-calculator/*`, `src/features/security-tools/*`, `src/components/*`, `src/app/*`, `scripts/*`

### [G1] P0 · 버그 — zxcvbn 사전·키보드 그래프 미탑재로 비밀번호 강도 측정이 무력화
- 파일: `SecurityToolsPage.tsx:10`, `package.json`
- 문제: `new ZxcvbnFactory()`(옵션 없음)는 사전·인접 그래프가 비어 있다. 실행 검증: `password123` → score 4 "매우 강함", `iloveyou2020` → score 3. 가이드 문구("흔한 단어·반복·연속 문자 패턴 기반")와 다르며 위험한 비밀번호에 잘못된 보안 조언을 제공.
- 수정: `@zxcvbn-ts/language-common`(+`language-en`) 의존성 추가 후 dictionary·graphs·translations를 넣어 초기화. 번들 우려 시 lazy import.
- 완료 기준: `password123`이 score ≤ 1로 채점.

### [G2] P1 · 버그 — 공휴일 겹침 시 대체공휴일이 그룹별로 중복 생성
- 파일: `workCalculator.ts:20-30`
- 문제: 실행 재현 — 2025년 어린이날·부처님오신날 겹침(5/5)에서 5/6과 5/7 두 개의 대체공휴일 생성(실제 정부 발표는 5/6 하루). 해당 기간 영업일이 1일 적게 계산됨.
- 수정: 같은 날짜에 겹친 공휴일 집합에는 대체공휴일 1개만 생성(이미 대체일이 부여된 날짜 집합 추적).

### [G3] P1 · 버그 — 음력 계산이 한국 음력이 아닌 중국 달력(`ca-chinese`) 사용
- 파일: `workCalculator.ts:35`
- 문제: 실행 재현 — 설날이 chinese 기준 2028-01-26 / dangi 기준 2028-01-27, 2030년도 하루 불일치. 설 연휴 3일+대체공휴일이 통째로 밀림.
- 수정: `en-US-u-ca-dangi`로 변경(현행 Node/브라우저 ICU 지원 확인됨).

### [G4] P1 · 버그 — 음력 공휴일이 브라우저 타임존에 따라 달라짐
- 파일: `workCalculator.ts:35-37`
- 문제: formatter는 `Asia/Seoul`인데 순회 Date·결과 기록은 로컬 기준 — 실행 재현: `TZ=Pacific/Auckland`에서 2026년 설날이 2/18로 출력(정답 2/17). UTC+9보다 동쪽 사용자에게 실제 발생.
- 수정: 날짜 생성·포맷·formatter의 기준을 하나로 통일(전 과정 로컬 또는 전 과정 Seoul/UTC).

### [G5] P1 · 버그 — 404.html 미생성으로 GitHub Pages 딥링크가 전면 404
- 파일: `scripts/generate-static-pages.mjs`(생성 목록 17-24), 참고 `App.tsx:50, 93, 96`
- 문제: 사전 생성 경로 밖의 모든 URL(비교 결과 새로고침, `/en/tools/hwp-editor/`, 리다이렉트 전용 라우트, 오타 링크)이 GitHub 기본 404로 떨어져 SPA 폴백 라우트가 실행되지 못함.
- 수정: 빌드 후 `dist/404.html` 생성(index.html 사본 + noindex 메타, 또는 언어 감지 리다이렉트 스크립트).

### [G6] P1 · 버그 — 1년 미만 월개근 연차를 달력상 월 차이로 계산해 과다 산정
- 파일: `workCalculator.ts:65, 67, 71`
- 문제: 실행 재현 — 입사 2026-01-31 → 2026-02-01(재직 2일)에 1일 부여, 만 10.5개월에 11일 부여. 근로기준법 제60조 2항은 만 1개월 개근 단위.
- 수정: `differenceInCalendarMonths` → `differenceInMonths`(만 개월) 교체(71행 회계연도 분기 포함).

### [G7] P1 · 버그 — 언어 전환 시 도구 목록이 이전 언어로 남는 stale useMemo
- 파일: `ToolsPage.tsx:23-42`
- 문제: `groupedTools` 의존성에 `toolCategories`·`tools` 누락. `/ko/tools`에서 en 전환 시 컴포넌트가 리마운트되지 않아 카드 제목·카테고리 헤딩이 한국어로 남고 필터 버튼만 영어인 혼종 화면. (스모크 테스트는 `page.goto`로 새로 로드해 못 잡음.)
- 수정: 의존성 배열에 `toolCategories, tools` 추가.

### [G8] P1 · 컴플라이언스 — 동의(consent) 처리 부재: GA·Naver·AdSense 무조건 로드
- 파일: `AnalyticsLoader.tsx:30-43`, `AdSenseLoader.tsx:6-14`
- 문제: Google Consent Mode 기본값 선언이 코드에 없고 지역·동의 게이팅도 없다. 개인정보처리방침과 `docs/PUBLISHING_CHECKLIST.md:27`은 CMP를 약속하지만 미구현 — en 사이트로 EEA 사용자를 타깃하는 만큼 동의 전 분석 쿠키 설정이 실질 리스크.
- 수정: gtag 설정 전 Consent Mode v2 기본값(`denied`) 선언, Google 인증 CMP 신호에 따라 갱신, Naver 스크립트도 동의 후 로드로 게이팅.

### G-P2 (경미 버그 9건)
- **[G9]** `PayrollCalculatorPage.tsx:28` — 요율 안내에 부동소수점 그대로 노출("13.139999999999999%", 실행 재현). `toFixed(3)` 후 Number 변환 또는 표시용 문자열 상수.
- **[G10]** `payroll.ts:33, 39-40` — 근로소득세액공제가 130만원 초과 구간에서 `calculated * 0.3`으로 계산되어 세액 과대 추정(법정: 71.5만 + 초과분×30%, 한도 적용), 근로소득공제 연 2,000만원 한도 누락. 산식 교정.
- **[G11]** `PayrollCalculatorPage.tsx:15, 20, 27` — 퇴직금 모드가 화면에 없는 주휴수당 탭의 `hours`에 숨은 의존 — 주휴 탭에서 10시간 입력 후 퇴직금 탭에서 원인 불명 "적용 대상 아님". 퇴직금 모드에 주 근로시간 입력 추가 또는 적용값 표시.
- **[G12]** `WorkCalculatorPage.tsx:10`, `PayrollCalculatorPage.tsx:17` — 기본 날짜가 `toISOString()`(UTC) 기준이라 KST 오전에 '어제'로 세팅되고, 모듈 스코프 상수라 탭을 오래 열면 더 벌어짐. 로컬 날짜 포맷 + lazy initializer.
- **[G13]** `src/locales/en/features.json` — `work.days`, `security.time.*`에 `_one` 복수형 누락으로 "1 days", "About 1 seconds"(실행 재현). `_one` 변형 추가 + `WorkCalculatorPage.tsx:34`는 count에 문자열 대신 숫자 전달.
- **[G14]** `WorkCalculatorPage.tsx:22-23, 36` — 연차 모드에서 오류를 삼키고(catch로 undefined) 오류 표시가 business 모드 전용이라 결과 카드만 조용히 사라짐. 연차 모드에도 `.utility-error`(가급적 `role="alert"`) 표시.
- **[G15]** `generate-static-pages.mjs:104-126` ↔ `seo.ts` — 정적 프리렌더 타이틀·설명과 SPA RouteSeo가 이중 관리로 이미 드리프트(ko 도구 페이지가 영문 타이틀로 색인됨, JSON-LD priceCurrency USD vs KRW). 정적 생성이 seo.ts를 단일 소스로 임포트하도록 통합.
- **[G16]** `TimezoneCalculatorPage.tsx:82, 150-159` — DST 갭 시각은 luxon이 자동 보정해 `timezone.invalid` 메시지가 사실상 도달 불가(안내 없이 보정됨), 미팅 슬롯이 48개 고정이라 DST 전환일(23/25시간)에 넘침/누락. 보정 시 안내 표시 + `plus({days:1})`까지 while 순회.
- **[G17]** `AnalyticsLoader.tsx:35-40` — SPA 라우트 전환 page_view가 Naver만 전송, GA는 향상된 측정 설정에 의존. 같은 effect에서 `gtag('event','page_view',...)` 전송.

### G-P3/P4
- **[G18·P3]** `workCalculator.ts:50-58` — 키 입력마다 연도별 365회 `Intl.formatToParts` 재수행. 연 단위 공휴일 캐시(Map). 추가 휴일 입력의 형식 불일치가 무경고 무시되는 문제도 검증·안내 추가.
- **[G19·P3]** 핵심 계산 순수 함수(`getKoreanHolidays`, `calculateAnnualLeave`, `estimateMonthlyIncomeTax`, `calculateSeverance`, `generatePassword`)에 단위 테스트 전무 — `node --test` 기반 추가, 공휴일은 정부 발표 2025~2027 달력을 골든 데이터로. **G2/G3/G6/G10 수정 전에 먼저 작성 권장.**
- **[G20·P4]** 확정 임시공휴일(예: 2026-06-03 지방선거일) 상수 테이블 `EXTRA_HOLIDAYS` 도입 + PUBLISHING_CHECKLIST에 연 1회 갱신 항목 추가.
- **[G21·P3]** 접근성: `ui.tsx:57` SegmentedControl의 role 없는 div aria-label(→`role="group"`), `WorldTimeMap.tsx:86,90` 동일, `AppShell.tsx:139-175` 모바일 시트 포커스 트랩·Esc 부재, SecurityTools 강도 미터·복사 버튼의 aria-live 부재.
- **[G22·P3]** 잔여 정리: `cities.ts:1,9` 미사용 `region` 필드, `GITHUB_ISSUES_URL` 중복 상수(AppShell/HomePage), `AppShell.tsx:181-190` effect 의존성 `language` 누락, `seo.ts:228-231`·`ToolGuide.tsx:45` 하단 배치 import, `TimezoneCalculatorPage.tsx:167,177` `t: (key: never)` 캐스팅.

---

## 부록 — 점검했으나 문제 없음으로 확인된 항목

오탐 방지를 위해, 아래는 의심 지점이었으나 검증 결과 정상으로 확인된 것들이다(재보고 불필요).

- 비디오·오디오·이미지 스튜디오의 objectURL revoke, worker terminate, AbortController 정리, 워커 경계 조건(선택 구간 clamp·전체 삭제 방어)은 전반적으로 올바름.
- PDF 회전 합산 로직, `parsePageRange`("1-3,5") 파싱, tesseract 자산 자체 호스팅(GitHub Pages 규칙 준수).
- 이미지: EXIF 제거는 픽셀 재드로잉 방식이라 완전함, Fabric 7 포인터 좌표 보정 정상, gifenc delay 단위 처리 정상.
- Excel: ExcelJS shared formula 번역, papaparse/fast-csv BOM 처리 정상.
- 문서 비교: 새로고침 시 결과 만료 안내 처리, Excel 보고서 시트명 31자·유니크 처리, HWP 편집기의 한국어 전용 라우트는 의도된 설계.
- i18n: ko/en 전 네임스페이스 키 완전 대칭(en 복수형 `_one` 누락 G13만 예외). 2026년 공휴일 데이터는 정부 발표와 일치(임시공휴일 제외, 문서화됨). 급여 요율은 2026-07-01 기준 최신.
