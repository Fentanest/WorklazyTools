# 작업지시서 — 비디오 후속 2건: 라우팅 사유 노출·오디오 하이브리드 (2026-09-03)

**상태: 구현 완료 (`9c4459b`, 2026-09-03 — 5차 왕복 이견 0 정본의 V-A → V-B 순차 구현·검증·push·Pages 배포 완료.)**
기준 해시: 착수 시 재확인(현행 5bf9dba 이후). 근거: 2026-09-03 원인 분석 — ④ DV/E-AC-3 패스스루 FFmpeg 라우팅(확정), ⑤ AAC AudioEncoder 미지원 환경에서 오디오 포함 인코딩 전체 FFmpeg 폴백→4K OOM(B3 실측 `AUDIO_ENCODER_UNSUPPORTED` 근거).

## V-A. 라우팅 사유 노출 + 오디오 제외 선택지 (신고 ④ 대응)

- route 결정표의 부적합 사유 코드를 **행동·결과 중심 ko/en 안내로 매핑**(내부 명칭 비노출): 예 — 오디오 형식 부적합 시 "이 영상의 음향 형식은 브라우저에서 그대로 복사할 수 없습니다. **음향을 제외하면** 큰 용량도 처리할 수 있습니다."(확정 4항 — "음향 변환" 제안 없음). 현행 가드 문구는 사유 없이 1.5GB 제한만 말해 오해 유발.
- **"비디오만 복사(오디오 제외)" 선택지**: 오디오만 부적합(비디오 copy 적합)한 job에 대해 audio=remove 스트리밍 경로를 사용자 선택으로 연결 — 기존 remove 경로 재사용, UI에 상황 감지형 제안 노출.
- 검증: E-AC-3 fixture에서 사유 안내·제외 선택 시 스트리밍 성공(2GB+ 무가드), DV 비디오 부적합 케이스의 별도 사유, 기존 라우팅 회귀.

## V-B. 오디오 하이브리드 — 비디오 WebCodecs + 오디오 FFmpeg (신고 ⑤ 해결)

- 배경: B3에서 "AudioEncoder 미지원 → job 전체 FFmpeg 폴백"으로 1차 축소했으나, **실사용 환경(AAC 인코딩 미지원 Chrome)에서 4K OOM이 그대로 재현**되어 하이브리드 격상이 필요함이 입증됨. A/V sync 위험으로 후속 분리했던 항목 — 이번에 정면 구현.
- 적용 조건: **오디오 encode 모드이고 AudioEncoder가 해당 설정 미지원일 때**, 전체 FFmpeg 폴백 대신 하이브리드. (copy 부적합 소스에는 V-A의 **음향 제외 제안만** 적용 — encode 전환 제안 없음, 확정 4항과 일치.)
- 파이프라인(B3 왕복에서 정의된 왕복 구조): ① 원본 File을 FFmpeg에 WORKERFS 재마운트 ② audio-only trim/concat/encode(AAC — 오디오는 소용량이라 1GiB 힙 안전) ③ 중간 M4A를 MEMFS에서 읽음 ④ mp4box로 demux ⑤ encoded 오디오 샘플을 비디오 WebCodecs 출력과 함께 mp4-muxer에 합류. 타임스탬프 정렬 계약: **A/V 첫 샘플 오차 ≤50ms·전 구간 드리프트 없음**(edit list/시작 오프셋 처리 명시).
- 진행률: 오케스트레이터 단계 가중치에 오디오 FFmpeg 단계 추가(단조성 유지). 취소 시 양 경로 자원 정리(codec close·FFmpeg 중단·OPFS 부분 파일 삭제).
- 실패 처리: 하이브리드 중 오디오 단계 실패 시 — 예상 출력 ≤1.5GB면 전체 FFmpeg 폴백, 초과면 안전 오류(기존 계약 준수).
- 검증: **AAC 미지원 환경(현 호스트)에서 4K 비트레이트 인코딩이 OOM 없이 성공** — 이것이 1차 합격 기준. A/V sync ≤50ms 실측(장시간 구간 드리프트 포함), concat 하이브리드, 취소 잔재 0, 폴백 매트릭스, 기존 B2/B3 회귀.

## 명시 제외

- WebM/MKV 스트리밍 확대·CRF WebCodecs 지원(backlog 유지) / E-AC-3 패스스루 자체 지원(먹서 제약 — 제외 사유 기록) / DV 메타데이터 보존.

## 공통

- 검증 명령: `npm run build` · `npm run test:unit` · `npm run test:new-tools` · `npm run test:utilities` · `npm run test:static`.
- 기록 이원 체계. 신규 문구 ko/en·내부 명칭 비노출.

## v2 확정 사항 (1차 왕복 — 우선 계약)

### V-A 확정
1. **사유 체계 세분화**: `VideoProcessingJobRoute`에 probe 상세 사유(`AUDIO_CODEC_UNSUPPORTED`·`VIDEO_CODEC_UNSUPPORTED`·`EDIT_LIST_UNSUPPORTED` 등) 보존 — boolean 축약 제거. `CONCAT_TRACK_MISMATCH`는 영상/오디오 구분 세분화(또는 재-probe 판정).
2. **"오디오만 문제" 판정은 재-probe로**: 코드 비교 추정 금지 — `audio=remove` 가정으로 재-probe하여 stream-copy 성공이 확인될 때만 제외 제안 노출. 배치에서는 **영향받는 job별** 제안(전 job 설정 일괄 변경 금지).
3. **UI**: 신규 모드가 아니라 기존 `remove` 모드를 선택해 주는 상황 감지형 제안 버튼.
4. **문구 수정**: copy 경로 안내에서 "음향 변환" 제안 삭제(현행 계약상 copy+encode는 FFmpeg 고정이라 구제책 아님) — **"음향 제외"만 제안**. copy+FFmpeg 오디오 하이브리드는 명시 제외(후속 backlog).

### V-B 확정
5. **파서 분리**: 하이브리드 parse mode 신설 — 오디오 트랙은 "FFmpeg 처리 예정"으로 표시하고 비디오만 파싱(E-AC-3 등 오디오 코덱 거부 없이 진행).
6. **단계 순서 변경(오디오 선행)**: ① FFmpeg audio-only 인코딩을 **먼저** 완료(concat은 `atrim→asetpts→aresample/aformat→concat` filter_complex — trimPrefix 다중 적용은 실측 2.3s 오답으로 기각) ② M4A demux(mp4box)·**elst/priming 해석**: `media_time`(실측 1024 samples) 만큼 선두 트림·타임라인 0-기준 재정렬(mp4-muxer는 elst 미작성 — 반영 후 투입) ③ 비디오 WebCodecs 인코딩+mux — **muxer 시작 시 양 트랙 첫 DTS가 이미 확정**되어 cross-track 소급 문제 원천 제거, 오디오 샘플은 큐에서 인터리브 공급.
7. **sync 수식화(4차 정정 — 허용치를 실제 출력 rate에 연동)**: `Δstart = firstAudioPTS − firstVideoPTS`(부호 있음), `Δend = (lastAudioPTS + lastAudioSampleDuration) − (lastVideoPTS + lastVideoFrameDuration)`. 합격: `|Δstart| ≤ 50ms` **그리고** `|Δend − Δstart| ≤ 1024 / 실제출력오디오샘플레이트`(48kHz≈21.33ms·44.1kHz≈23.22ms — 제품이 source/44.1/48/custom 허용). 측정은 ffprobe packet PTS/duration 기준. packet DTS 단조·전체 디코드·실재생 검사 병행.
8. **진행률**: 단계 타입에 `audio` 추가, 가중치 재배분(합 100·단조 계약 유지 — 구체 배분은 구현 재량, 계약은 "오디오 단계가 0~N% 구간을 소유하고 이후 단계와 겹치지 않음").
9. **취소 계약(3차 정정 — FFmpeg API 실측 반영: terminate 후 FS 호출 불가)**: 두 경우 분리 — ① **단계 경계(유휴) 취소**: MEMFS 삭제·unmount 정리 후 `terminate()` ② **실행 중 강제 취소**: `terminate()`가 워커·FS 전체를 폐기하므로 **이후 FFmpeg FS 호출 금지** — JS 참조 해제·codec flush/close·mux target discard·OPFS 부분 파일 삭제만 수행. 오디오 단계·비디오 단계 취소 각각 테스트.
10. **폴백 행렬**: 단계별 분류(오디오 FFmpeg 실패 / M4A demux·elst 처리 실패 / video codec 런타임 실패 / mux·write 실패 / quota 실패) — 각각 "예상 출력 ≤1.5GB → 전체 FFmpeg 폴백, 초과 → 안전 오류". `streamingFailure` 단일 처리 폐지.
11. **출력 크기 추정 교정(3차 정정 — 단위·모드·소비처 확정, 선행 버그 수정·별도 커밋 가능)**: target 모드 예상 출력(**bytes**) = `((videoBitrate_bps + audioBitrate_bps) / 8) × duration_s × 1.1`. audioBitrate: `remove`=0 / `encode`=설정 출력 비트레이트 / `copy`=**원본 오디오 비트레이트**(probe 취득) — **concat(복수 입력)은 입력별 원본 오디오 비트레이트의 최대값**, 미상 입력이 하나라도 있으면 **320kbps 보수 상한** 사용(추정 전용 상한 — copy 적합성 판정과 무관). **소비처 명시**: 이 추정이 quota 판정(`videoProcessingClient.ts:56`)·1.5GB 폴백 판정(`videoRouting.ts:124`)·OPFS 예상·진행률 bytes 가중에 일관 전달. UI의 copy 전용 사전 가드(`VideoStudioPage.tsx:473`)는 현행 유지 — target 모드는 라우팅·폴백 단계에서만 추정 소비(사전 가드 미적용). video copy 모드의 추정(원본×구간 비율)은 현행 유지.
12. **메모리 계약(4차 정정 — bytes 산식 통일)**: 중간 M4A 상한 = `(audioBitrate_bps / 8) × duration_s × 1.2`(예: 192kbps×480초 ≈ 13.8MB — 11항과 동일 단위 체계), FFmpeg 단계 종료·terminate 후 WebCodecs 시작, M4A의 MEMFS 사본은 JS 이관 즉시 삭제, demux 후 원본 Uint8Array 해제 시점 명시.
13. **4K 합격 기준(3차 정정 — 실행 가능한 검증 계약)**: 신규 벤치 `scripts/benchmark-video-hybrid.mjs` 작성 — fixture는 ffmpeg 합성 **3840×2160@30fps·60초·H.264+AAC(48kHz stereo 192kbps)**(생성 명령·SHA-256 기록), 브라우저 하네스(기존 webcodecs 벤치와 동일 방식·타임아웃 600초)에서 **target 8Mbps + audio 192kbps 인코딩** 실행. 단언: route=hybrid(AAC AudioEncoder 미지원 실측 환경에서) · OOM 없음 · 7항 sync 수식 통과 · 전체 디코드. 실행 명령을 지시서와 review-notes에 명기. 실파일(000094F 3840×1600)은 보조 검증. CI 상시 스모크는 소형 fixture(예: 640×360 하이브리드 route·sync 단언)로 별도 추가 — 4K 벤치는 구현 태스크 1회 실측+스크립트 존치.

## 반박 기록
### Codex 1차 (2026-09-03, 완료 — V-A 4건·V-B 9건 전원 수용 → v2 확정 사항 반영. 판정 "재왕복 필요". 실측 기여: FFmpeg→M4A elst 1024 priming·concat filter_complex 검증·mp4-muxer cross-track 소스 분석·출력 추정 오류 실증)
### Codex 2차 (2026-09-03, 완료 — 9건 해소, 4건(7·9·11·13항) 잔여 → v3 정정: Δ 부호·종단 정의 / terminate-FS 순서 API 정합 / bytes 산식·모드별·소비처 / 4K 벤치 실행 계약)
### Codex 3차 (2026-09-03, 완료 — 7·9·13 해소 확인, 잔여 4건(11 concat 집계·copy 안내 문구·sync rate 연동·M4A /8) → v4 정정)
### Codex 4차 (2026-09-03, 완료 — 4건 해소 확인, 신규 1건(15행 괄호 문장 ↔ 확정 4항 충돌) → v5 정정)
### Codex 5차 (2026-09-03, 완료 — 15행 정정 해소 확인·전문(1~54행) 무모순, **"[정본화 가능] 이견 0" 선언** → 정본 확정. 구현은 엑셀 정본 완료 후 착수: V-A → V-B 순).

## 실행 기록

### 실행 게이트 (Codx, 2026-09-03)

- 기준 해시: `HEAD=162207af1bdc21b21f025c01a317a0c29ed8573a`, 브랜치 `main`이 `origin/main`과 동기화되어 사용자 지정 기준 `162207a`와 일치.
- 열린 계획서: `excel-format-fidelity-20260903.md`는 `162207a`로 구현 완료 상태이며 Excel 병합 표면만 다룬다. 본 비디오 라우팅·하이브리드 표면과 상반 지시 없음.
- 기존 워킹트리: `docs/backlog.md` 수정 및 MP4 3개·DOCX 2개 미추적 파일은 선행/타 작업 소유로 보존하고 본 작업 스테이징에서 명시적으로 제외.
- 판정: 기준 해시 게이트 및 열린 계획서 충돌 검사 통과. V-A → V-B 순으로 착수 가능.

### 구현 완료 (Codx, 2026-09-03)

- V-A: probe 상세 사유 보존, `audio=remove` job별 재-probe, 기존 remove 모드를 적용하는 상황 감지형 제안 버튼, ko/en 행동·결과 안내를 구현했다. copy 경로는 음향 제외만 제안하고 음향 변환을 제안하지 않는다.
- V-B: 오디오 선행 FFmpeg AAC M4A → elst/1,024-sample priming 보정 demux → 비디오 WebCodecs+점진 MP4 mux 하이브리드, 단계별 폴백·진행률·두 취소 분기·메모리 해제를 구현했다. target bytes 추정과 H.264 해상도별 level 선택도 교정했다.
- 4K: `node scripts/benchmark-video-hybrid.mjs --output-dir /tmp/worklazy-video-hybrid-4k-20260903-final` 통과. `Δstart=0s`, `Δend=-1.0547118733938987e-15s`, 실행 `105,136.980ms`, OOM=false, 전체 decode·브라우저 재생·DTS 단조 확인.
- 검증: `npm run build`, `npm run test:unit`(106/106), `npm run test:new-tools`, `npm run test:utilities`, `npm run test:static`, `npm run test:video-hybrid`, `git diff --check` 모두 exit 0.
- 커밋·배포: 본 구현 `29ba546` (`Add hybrid audio video processing and route guidance`), CI 도구 설치 기록 `986765c`, portable setup 교정 `9c4459b`를 `origin/main`에 push했다. `HEAD=origin/main=9c4459b9e563e8bffdbe3fbb18cc5a1830367a5b`; Pages run `33708234608`은 build·하이브리드 스모크·deploy 전부 success. 게이트 당시 타 작업 소유로 분류한 `docs/backlog.md`와 `CLAUDE.md`는 공통 규칙의 위임 변경 동반 커밋 조항에 따라 포함했고, MP4 3개·DOCX 2개는 제외했다.
