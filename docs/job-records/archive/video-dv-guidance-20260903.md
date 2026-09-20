# 작업지시서 — 비디오 후속 4건: DV 소스 인코딩·확정 FFmpeg 사유 안내·음향 전환 제안·진행 로그 (2026-09-03)

**상태: 정본 (2026-09-03 정본화 — 7차 왕복에서 Codex "[정본화 가능] 이견 0" 선언 + 기준 해시 실기입. "확정 사항"이 우선 계약.)**
기준 해시: **`da8aa188ccf62e436b7b6a6a02e42f9b8312f926`**(Claude 실측, `git rev-parse HEAD`=`origin/main`). 근거: 2026-09-03 원인 분석 3건(DV 라우팅 — Codex 01a06578 / 진행 로그 — Gemini 분석+Claude 직독 검증+**Codex 재현 확정(task-mtl1ljlx)**) + 사용자 신고 2건.

## 확정 원인 (1차 왕복 행 번호 정정 반영)

- **W-A**: `dvh1`/`dvhe`가 codec-name 분류(`videoStream.worker.ts:1526` — `avc1.*`/`hvc1.*`만 허용, 호출 `:1164`·거부 `:1165`·sample entry 제한 `:1166`)에서 `isConfigSupported` 전 탈락 → catch(`:286-289`)가 `INPUT_UNSUPPORTED`로 축약 → 음향 모드 무관 FFmpeg 강등 → 4K OOM. E-AC-3은 remove 실패 원인 아님(오디오 거부 throw는 `:1185`·`:1188` — DV에선 도달 전 탈락).
- **W-B**: 신고 문구는 FFmpeg OOM 사후 정규화(`videoErrors.ts:17`→`videoProcessingShared.ts:63`). 사유 안내는 stream-copy 전용(`VideoStudioPage.tsx:963`)·용량 가드 copy 전용(`:502`).
- **W-C**: 오디오 사유 상위 축약, remove 재probe stream-copy 전용(`videoProcessingClient.ts:108`)·hybrid probe는 audio=encode 전용(`:128`).
- **W-D(재현 확정 — Codex task-mtl1ljlx 단위 재현·Gemini 합치)**: 4GB H.264+AAC 패스스루에서 "구간 복사"(mux stage)·"순서 저장"(write stage) 메시지 무한 교대 — `useOperationProgress.ts:34-38`이 **직전 로그 항목과만** 중복 비교해 파이프라인 교대 보고마다 새 항목 누적(30쌍 주입→63행 실측). 작업 자체는 정상 진행(바이트 단조 전진 — UI 스팸).

## v2 확정 사항 (1차 왕복 9건 — 우선 계약)

1. **인용 정정**: 위 확정 원인 절의 행 번호 체계 적용(:1526 분류/:1164-1166/:286-289/:1185·:1188).
2. **W-A base-layer 조건 완전판**: `dvcC`/`dvvC`(둘 다 동일 DOVI record — 실측) 첫 5바이트 판독: major/minor version, `profile = byte2>>1`, `level = ((byte2&1)<<5)|(byte3>>3)`, RPU/EL/**BL present flag**, `compat_id = byte4>>4`. **폴백 조건 = `profile===8 && bl_present_flag===1`**(profile 8 단독 불충분 — bl_present=0 레코드 실측 존재). **(3차 확정) 정책 실값**: ① version은 `major===1 && minor===0`만 허용(그 외 거부) ② `compat_id` 허용 = **{1(HDR10), 2(SDR), 4(HLG)}** — 각 ko/en 안내는 "표준 HDR/SDR/HLG 기준으로 처리, 돌비비전 효과 제외" 동형, **0·그 외 미지정 값은 거부**(W-B 사유 안내) ③ `dvcC`+`dvvC` **동시 존재는 항상 거부**(모호성 — 안전 우선). 골든 목록에 unsupported version·dual-box·compat_id 0/미지정 케이스 추가. **(6차 확정·7차 정정) 성공 안내 전파 계약**: probe 결과에 **`dvBaseLayer?: { compatIds: number[] }`**(입력별 수집·중복 제거 — concat 복수 입력 대응) 필드 추가(`VideoWebCodecsProbeResult` 확장) → `VideoProcessingJobRoute`에 job별 표지 전파 → **표시 위치는 W-B route 안내와 동일한 job별 안내 표면**(preflight 직후 job 카드·결과 화면 유지). 안내 문구: compat 집합이 **단일이면 해당 compat 문구**(HDR10/SDR/HLG 기준 처리), **혼합이면 공통 문구**("각 원본 기준의 표준 형식으로 처리, 돌비비전 효과 제외") — ko/en 동형. **폴백 허용은 입력별 독립 판정**: 모든 DV 입력이 각각 허용 조건(profile 8·bl_present·compat {1,2,4}·version)을 통과해야 job 폴백 — 하나라도 거부면 현행 거부 경로. 전파·혼합 케이스 단위 테스트 포함. box 판독은 기존 `readBoxPayload`(`:1499`) 방식(unknown child box는 sample entry에 동적 부착 — 실측).
3. **HEVC codec string 구성 규칙 완전판**: `hvc1.<profile-space(""|A|B|C)><profile>.<compat 32비트 bit-reversal·unsigned>.<tier L|H><level>.<constraint bytes 원순서·후행 0 생략>`. **compat 계산은 unsigned 필수**(MP4Box 구현 복사 시 고비트에서 음수 실측 — `-7ffffffb` 오류). 골든: 고비트 벡터 `hvc1.B5.80000005.H123.12.34` + 일반 벡터 `hvc1.2.4.L30.90`.
4. **DV 허용 격리**: `parseInput`에 **parse 목적 인자** 전달 — DV base-layer 허용은 **target encode/hybrid 목적에만** 적용, stream-copy parse(`:1104`)는 현행 비호환 유지(copy muxer는 dvcC 미기록 — DV copy 열면 안 됨). 게이트 불통과 문구 정정: "W-A가 새 streaming route를 선택하지 않는다 — 이후 W-B 정책(사유 안내·용량 차단)이 적용된다"(기존 경로와 완전 동일 아님).
5. **W-B 임계·범위 계약**: byte 임계는 **기존 `MAX_SAFE_FFMPEG_OUTPUT_BYTES`(1.5GiB, `videoRouting.ts:4`) 재사용**(신규 값 금지) — 경계: 정확 임계=허용, `+1`·NaN·음수=거부, UI의 단순 `>` 검사를 `failureFallbacks`와 동일한 **안전 predicate 공용화**(NaN 누락 실측). **해상도는 비차단 경고로 한정**(1080p~4K 사이 임계 실측 부재 — hard block은 fallback(bytes 전용)과 모순 유발, 경계 벤치 없이 금지). 적용 범위는 **(6차 정정) target 비트레이트 video encode job 한정** — GIF/음향 `NON_VIDEO_TASK`뿐 아니라 **CRF(`bitrate === "0"`)도 제외**(`videoOutputEstimate.ts:18` — CRF 추정은 입력 크기 합산이라 예상 출력 근거 아님, CRF 출력 추정 계약은 후속·현행 동작 유지).
6. **W-B 사유 타입 표면(4차 정정 — 구조 정합)**: **probe cause는 `parser`·`capability` 2종 discriminated union** — `{ causeKind: "parser"; reasonCode: <videoStreamCopy.ts:3 계열 파싱·코덱·트랙 사유> } | { causeKind: "capability"; reasonCode: <videoWebCodecs.ts:4 계열 디코더/인코더 미지원 사유> }`(worker catch 일괄 축약 폐지, 각 계열의 기존 코드 union 확장). **storage/quota는 probe cause가 아니라 decision 층 사유로 분리 유지**(quota는 probe 뒤 별도 계산 — `videoProcessingClient.ts:139`). **(6차 정정) quota 의미 정합**: quota insufficient/unknown·OPFS 부재는 **차단이 아니라 FFmpeg 라우팅 사유**(`videoRouting.ts:75` 현행 유지) — **차단 표시는 안전 크기 predicate(`MAX_SAFE_FFMPEG_OUTPUT_BYTES`) 실패 시에만**. **UI 표시 우선순위(단일 서열)**: ① W-C 제안 CTA(구제 모드 존재 시 — 확정 8항) ② **용량 한계 차단(안전 크기 predicate 실패)** ③ probe cause(구체 사유 — FFmpeg 라우팅으로 계속 실행되는 경우 포함) ④ decision `reasonCode`(축약 — cause 부재 시만). ②를 표시할 때 ③이 존재하면 부가 설명으로 병기(사유+한계 동시 안내 — W-B 취지). codec×storage 조합 단위 행렬 테스트. `streamCopyProbeReason`을 전 확정 FFmpeg route mapper로 교체(`VideoStudioPage.tsx:950`).
7. **W-C 결합 probe**: 이중 재probe(원+remove+hybrid = 파싱 3회) 대신 **parser가 영상 판정과 오디오 실패 사유를 함께 반환하고 동일 parsed inputs로 remove/encode 두 대안을 평가하는 결합 probe** 채택. **hybrid 거부 조건 분리**: 현행 `AUDIO_ENCODER_SUPPORTED` 거부(`videoWebCodecs.ts:158`)는 "인코더 미지원 폴백" 용도 — **소스 오디오 코덱 부적합 구제** 경로에서는 AAC 인코더 지원 여부와 무관하게 hybrid 평가(E-AC-3 소스는 인코더가 있어도 소스 디코드가 관건).
8. **W-C suggestion·UI 경계**: `audioModeOverride?: "remove"|"encode"` 타입 확장(`types.ts:77`)·`taskForVideoJob` 적용, job별 override는 `Set<jobKey>`→**job별 mode 보존 상태**로, 두 모드 모두 가능 시 **변환을 기본 CTA·제거를 보조**(음향 보존 우선 — 오케스트레이터 결정), encode 적용 값은 기존 encode 기본값 재사용(192kbps·원본 샘플레이트 — 왕복 확인), 선택 job만 override(형제 job·전역 설정 불변), **(5차 보강) job 유효 음향 모드 전파**: 결과 생성(`videoProcessingClient.ts:304`)과 경고 생성(`videoProcessingShared.ts:52-53`)이 전역 `audioMode`가 아니라 **override 반영된 job별 유효 모드**를 기준으로 동작(전역 copy+일부 job encode/remove 시 오경고 방지 — 단위 테스트 포함). target encode 제안이 W-B 차단 표시보다 먼저 평가(안전 대안 없을 때만 차단 표시). copy 경로 smoke의 "변환 미포함" 단언 유지(`new-tools-smoke.mjs:3614`) + **target encode에서만 변환 CTA 노출 대칭 검증** 추가.
9. **fixture·검증 실행 계약**: DV fixture 생성 절차 정본화(실측 방법) — `hvc1`+`hvcC` 생성 → fourcc `dvh1`/`dvhe` 치환 → **동일 크기 20바이트 `btrt` box를 `dvcC`/`dvvC`로 재사용해 payload 주입**(ancestor size·chunk offset 보존) → ffprobe·MP4Box(`hvcC`+`dvcC` 동시)·전체 decode exit 0 확인. 골든 목록: `dvh1`/`dvhe` × `dvcC`/`dvvC` / profile 7 / profile 8+BL 없음 / config box 없음·5바이트 미만 / `hvc1` 회귀 / 고비트 compat string. **브라우저 게이트는 capability 의존** — deterministic unit(support true/false 주입) 필수화, 실제 HEVC decode smoke는 지원 host에서 실행·기록(skip 정책 명시 — 샌드박스 Chrome 기동 불가 실측).

## W-D. 진행 로그 스팸·진행률 회귀 (재현 확정 — Codex task-mtl1ljlx + Gemini 합치)

- 판정(확정): 실제 재시작 루프 아님 — 단일 stream-copy 작업에서 mux(`videoStream.worker.ts:1403`)·write(`:236`) stage가 교대 보고되는데 로그 훅(`useOperationProgress.ts:34-38`)이 직전 항목과만 비교해 새 행 누적(단위 재현: 30쌍→63행, 진행률은 단조 전진). 이 파일 기준 mux ≈46,125회·write ≈3,814회 메시지 예상. **a4c638e부터 존재한 증상**(29ba546 아님). 별도 회귀: **29ba546의 `audio` 15% 가중치 추가로 stream-copy 진행률이 85%→100% 점프**(`videoProcessingClient.ts:181` — stream-copy 분기가 decode/encode만 완료 처리).
- 수정 계약 4건:
  1. **stage 키 기반 로그 행(3차 보강)**: stage key를 **worker→progress controller→`VideoWorkerProgress`→훅까지 전달**, `OperationLogEntry`에 stage key 추가 — 동일 stage 재보고는 해당 행 제자리 갱신. **현재 행(스피너) 판정은 배열 마지막이 아니라 `activeStageKey`/`activeLogId`로**(제자리 갱신 시 마지막 행 오판 방지). **단조 검증은 DOM 행 순서가 아니라 시간순 progress 이벤트/`aria-valuenow` 이력으로** 수행(제자리 갱신 후 DOM 행 값은 비단조가 정상), DOM 행은 개수 상한·값 범위·% 존재만 검사(`new-tools-smoke.mjs:3263`의 DOM 순서 `every()` 단조 검사 대체 + 빈 배열 통과 버그 보강). 직전 항목 한정 비교 폐지. U1 등 동일 훅 사용처 회귀 유지(`test:excel-compare`).
  2. **worker 진행 이벤트 coalesce(3차 확정 — emit 계약)**: `emit = explicitCompletion || integerPercent !== lastIntegerPercent[stage] || now − lastEmittedAt[stage] ≥ 100ms`. **완료는 호출부의 명시 flag로 전달**(100% 값 추론 금지 — write total이 `max(추정, 누적)`이라 조기 100% 실측 가능(`:236`)), **강제 보존 대상은 두 호출 명시: 최종 mux 보고 `:1414` + 최종 write 보고 `:1417`**(직전 write가 이미 100%·100ms 미만이어도 최종 보고 유실 금지). controller의 `Math.max` 단조 계약과 무충돌.
  3. **진행률 가중치 route 행렬(3차 확정)**: **stream-copy·webcodecs = `audio` 단계 제외 후 정규화 / hybrid = `audio` 포함 / FFmpeg 경로 = 현행 유지(변경 없음)**. mixed-route 다중 job은 **job별 활성 가중치** 적용. 85→100 점프(실측 완료열 20→55→63→75→85→100)는 webcodecs route에도 동일 문제 — 함께 수정. 단위 테스트: stream-copy·webcodecs·mixed batch 각각.
  4. **로그 행 진행률 표시**: `OperationProgress.tsx:80` 각 행에 `entry.progress` % 렌더(`global.css:724` grid 열 조정 허용).
- 부속(분석 중 발견 — 현지화 규칙): `ToolGuide.tsx:24`의 하드코딩 `GUIDE` eyebrow를 `t("guide.eyebrow")`로 교체(ko "안내"/en "Guide", common.json 동형 키) — 21개 도구 공통 노출 확인. (신고의 GUIDE 목격 자체는 드래그 포함 오인 — 사용자 확인.)
- 검증(3차 정정 — 3분리): ① 기존 브라우저 스모크(`:3537`)는 실체에 맞게 **"512MiB×2 합계 1GiB sparse integration smoke"로 명칭·주석 정정**(2GB+ 아님·고빈도 이벤트 미재현 — fixture는 1.5초 영상 sparse truncate 실측) + 로그 행 상한·% 존재 단언 ② **coalescer deterministic unit**: fake clock으로 5만 raw 호출→bounded postMessage·명시적 완료 보존 검사 ③ **4GB 실파일 브라우저 완주는 지원 host 실측 기록**(샌드박스 Chrome 기동 불가 실측 — skip 정책 명시). + stage 갱신·activeStageKey 단위 테스트, 활성 가중치 route 행렬 테스트(`video-processing-progress.test.ts:33` 확장).

## 명시 제외

DV RPU/메타데이터 보존 · DV profile 5/7 폴백 · DV stream-copy 허용(확정 4항) · E-AC-3 패스스루 자체 지원 · copy 경로의 음향 변환 제안(V-A 확정 4항 유지) · 해상도 hard block(확정 5항 — 경계 벤치 후 재론) · 비video 작업 용량 가드(estimator 계약 후속).

## 검증

- 확정 9항의 골든·단위(dvcC 판정 필드·codec string 벡터·결합 probe·predicate 경계값) + W-D 검증 절.
- 브라우저 스모크: target H264 + audio copy(E-AC-3)/encode/remove(smoke `:3802` 보완 — dvcC 주입 fixture 사용), DV fixture 인코딩(deterministic 주입 + 지원 host 실측), 확정 FFmpeg 사전 안내 노출, W-C CTA 대칭.
- `npm run build` · `npm run test:unit` · `npm run test:new-tools` · `npm run test:utilities` · `npm run test:static` · 하이브리드·B2/B3 회귀 · `test:excel-compare`(useOperationProgress 공용 — W-D 영향).
- ko/en 신규 문구 전부·내부 명칭 비노출·기록 이원 체계.

## 반박 기록

### Codex 1차 (2026-09-03, 완료 — 9건 전원 수용 → v2 확정 사항. 실측 기여: dvcC 5바이트 필드·bl_present 변형, compat bit-reversal 음수 버그, parseInput 공용성(copy 격리 필요), MAX_SAFE 경계·NaN predicate, 결합 probe 비용, AUDIO_ENCODER_SUPPORTED 거부 조건, btrt 재사용 fixture 주입법. 판정 "재왕복 필요")
### Codex 2차 (2026-09-03, 완료 — 9건 대조(①③④⑤⑦⑧⑨ 일치·②⑥ 부분), W-D 정합 확인. 잔여 6건(W-A 정책 실값·W-B union 실형·W-D stage 행/현재 행 판정·coalesce 완료 flag·가중치 route 행렬·fixture 실체 정정) → v3 정정. 실측 기여: 완료열 20→55→63→75→85→100, :3537 fixture 1GiB sparse 실체, 고비트 골든 독립 계산 확인)
### Codex 3차 (2026-09-03, 완료 — 6건 중 4건 확정(W-A 실값·W-D stage 행·가중치 행렬·검증 3분리), 잔여 2건(W-B 우선순위 자기모순·union 구조 / coalesce 최종 write `:1417` 누락) → v4 정정. 실측 기여: storage 사유군 3파일 분리 구조·quota 계산 위치·`:1417` 최종 write 식별)
### Codex 4차 (2026-09-03, 완료 — 3차 잔여 2건 반영 확인, 신규 3건(W-D 상태 문구 상충·job별 override 경고 기준 전역 참조·행 인용 :1403/:236/:158) → v5 정정)
### Codex 5차 (2026-09-03, 완료 — 4차 잔여 3건 반영 확인(행 인용·유효 모드 결함 실측 정합 포함), 신규 3건(CRF 추정 입력 합산·quota=라우팅 사유(비차단)·DV 성공 안내 전파 계약 부재) → v6 정정)
### Codex 6차 (2026-09-03, 완료 — 5차 잔여 3건 정정 확인(현행 코드 정합 실측), 신규 1건(concat job 복수 입력의 compat 단일 표현 불가 — probe가 입력별 독립 평가 실측) → v7 정정: compatIds 집합·혼합 문구·입력별 독립 판정)
### Codex 7차 (2026-09-03, 완료 — 6차 잔여 해소·신규 모순 없음, **"[정본화 가능] 이견 0" 선언** → 정본 확정. 즉시 착수).

## Codex 실행 게이트 (2026-09-03)

- 기준 해시: `git rev-parse HEAD`와 `git rev-parse --verify origin/main` 모두 `da8aa188ccf62e436b7b6a6a02e42f9b8312f926` — 정본 기준과 정확히 일치.
- 열린 계획서 충돌: 이전 `video-followup-20260903.md`는 구현·배포 완료 기록이며 본 정본의 선행 상태다. Excel cleaner/compare/fidelity 및 로드맵 문서는 비디오 코드 표면과 상반 지시가 없고, 공용 `useOperationProgress`는 본 W-D 구현 후 `test:excel-compare` 회귀 검증 대상으로 유지한다.
- 워킹트리: 추적되지 않은 MP4 3개와 DOCX 2개는 사용자 자료로 분류해 수정·스테이징·커밋에서 제외한다. MP4는 검증 절의 4K/실파일 요청에 한해 read-only 메타데이터·패스스루 실측 대상으로 사용하고 원본은 변경하지 않는다. 착수 시 추적 파일 변경은 없다.
- 판정: 실행 게이트 통과. 정본 순서 W-A → W-B → W-C → W-D로 착수한다.

## Codex 구현 완료 (2026-09-03)

- 상태: **구현 완료** — 커밋 `e44d4564fbae8afbd9ce046402d35c331583a6b2` (`Support Dolby Vision fallback and bounded video progress`). `origin/main` 푸시 후 로컬·원격 해시 일치 확인.
- 구현: W-A의 DV profile 8 base-layer 판정·HEVC codec string·copy 격리, W-B의 구체 사유/안전 용량 안내, W-C의 동일 parsed input 기반 remove/encode 대안과 job별 override, W-D의 stage-key 로그 갱신·100ms coalesce·route별 가중치를 정본 순서와 계약대로 반영.
- 골든/실측: `dvh1`/`dvhe` × `dvcC`/`dvvC` 4조합은 ffprobe 태그·MP4Box `hvcC`+DOVI box·FFmpeg 전체 decode 통과. 30회 mux/write 교대는 기존 63행에서 실행 중 3행(성공 종료 4행)으로 감소했고, fake clock 5만 raw 이벤트는 명시 완료 전 101회 이하로 제한. 512MiB×2 sparse 브라우저 스모크는 bounded progress 14행, 사용자 4.49GB 실파일 3개 패스스루는 33개 단조 이벤트·20개 bounded stage/job 행·출력 3개 완료(26.9초). 사용자 원본은 변경하지 않음.
- 검증: `npm run build`(2,419 modules, 57 pages), `npm run test:unit`(134/134), `test:new-tools`, `test:utilities`, `test:static`, `test:video-hybrid`, `test:excel-compare`, `node --check tests/new-tools-smoke.mjs`, `git diff --check` 전부 exit 0.
- 배포: GitHub Actions `Deploy GitHub Pages` run `33725646777` 성공 — build 3m43s, deploy 21s. Node.js 20 action deprecation 경고 1건은 비차단이며 이번 변경의 실패가 아니다.
