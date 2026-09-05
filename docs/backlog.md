# Backlog

종결된 작업 묶음에서 살아남은 후속 항목을 여기에 남긴다(「작업지시서 관리」 규칙). 항목마다 배경이 된 작업과 판단 근거를 한 줄로 병기한다.

## 비디오 스튜디오

- **B단계 10단계(확대) 후속** — 비디오 성능·용량 정본 계획(2026-09-02, 1~9단계 완료·아카이브) 잔여: ① WebM 스트리밍 확대(mediabunny 기각으로 보류 — 채택 조건은 대안 demuxer/muxer의 WebM roundtrip 검증) ② 브라우저 네이티브 AudioEncoder 지원 범위 확대(미지원 AAC는 현재 FFmpeg 오디오-only 하이브리드로 처리) ③ copy 모드의 비호환 음향을 FFmpeg로 변환해 영상 패스스루와 합치는 별도 하이브리드(현재는 품질을 암묵 변경하지 않고 job별 음향 제외만 제안). 근거·기각 이력은 `docs/review-notes.md` 참조.
- **A5 · 속도/품질 토글(코덱별 전문가 옵션)** — 계획 왕복에서 제외 확정(VideoTask에 preset 필드 부재·VP9는 cpu-used 체계·CRF/비트레이트 모드별 의미 상이·UI 복잡도). B3 하드웨어 인코딩 배포로 필요성 재평가 후 설계.

- **T4 · 모든 concat 입력의 FPS 확인 실패 시 30fps 강제 폴백** — 4차 신뢰성 작업지시서 후속. 현행 `src/features/video-studio/videoEncoding.ts`의 `resolveConcatFrameRate(frameRates, fallback = 30)`과 `tests/unit/video-encoding.test.ts`의 `[undefined, 0, NaN] -> 30` 단언을 `rg -n 'resolveConcatFrameRate|fallback = 30|undefined, 0, Number.NaN' ...`로 확인했다. 60fps 원본이 모두 probe 실패하면 30fps로 낮아질 수 있다. FPS 필터를 단순 생략하는 안은 재인코딩 세그먼트의 stream-copy 결합 호환성을 깨므로 기각하며, 입력 스트림에서 신뢰 가능한 레이트를 추가 취득하거나 사용자 선택 공통 레이트로 정규화하는 방식이 필요하다. — Codx

## 문서 비교

- **도달 불가 컴포넌트 3종 제거 검토** — P2 UI 마이그레이션 정본(`p2-tool-migration-20260904.md` 확정 2항)에서 **P2 명시 제외 + backlog 이관**으로 판정한 항목. `/word-compare`·`/hwp-compare`는 독립 route 가 아니라 `/document-compare` redirect 이므로 아래 3개 파일은 route 도달성이 없다. 전환 비용을 들일 이유가 없어 P2 에서 손대지 않았고, 제거는 별도 단위로 남긴다.
  - 대상(2026-09-05 Claude 실측 — `grep -rn "<심볼>" src/ --include=*.ts --include=*.tsx`): `src/features/word-compare/WordComparePage.tsx`(318줄) · `src/features/hwp-compare/HwpComparePage.tsx`(231줄) · `src/features/hwp-compare/HwpCompareResultPage.tsx`(19줄). 세 심볼 모두 자기 `export` 선언 외 **참조 0건**.
  - **제거 시 주의 — 같은 디렉터리에 살아 있는 모듈이 섞여 있다.** `WordCompareResultPage`(448줄·외부 참조 1건)는 `DocumentCompareResultPage` 가 소비하는 **현역**이고, `wordWorkerClient`·`hwpWorkerClient`(각 외부 참조 2건)도 현역이다. `wordCompareSession`·`hwpCompareSession`·`docModel`·`word.worker`·`hwp-compare.worker`·`*.py` 는 디렉터리 **외부** 참조가 0이지만 내부에서 현역 client 체인에 물려 있을 수 있으므로, 페이지 3개를 지운 직후 그 자리에서 각 모듈의 남은 사용처를 다시 grep 해 죽은 것만 함께 정리한다(「사용처를 하나 지우면 그 자리에서 다른 사용처를 grep 한다」). 디렉터리 통째 삭제 금지.
  - 완료 기준: `npm run build` · `npx tsc -b` · `TEST_SCOPE=word npm run test:browser` · `TEST_ONLY_HWP=1 npm run test:new-tools` 통과 + `/word-compare`·`/hwp-compare` redirect 동작 유지. — Claude
