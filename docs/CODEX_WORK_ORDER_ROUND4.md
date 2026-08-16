# Codex 작업지시서 4차 — 3차 반영 검증 후속 (2026-08-16)

3차 지시서(S1~S14)의 워킹트리 반영을 검증한 결과, **지시 항목은 전부 실질 해결**됐다(빌드·단위 테스트 27/27·핵심 항목 실행 검증 통과). 예정에 없던 Word/HWP 비교 페이지 공용화(F15)도 데이터 정합성 리그레션 없이 등가 이동으로 확인됐다. 아래는 이번 검증에서 새로 발견된 항목으로, T1 한 건만 배포 전 수정을 권장하고 나머지는 경미하다.

## P1 — 배포 전 수정 권장

### [T1] 이미지 영역 효과: HiDPI 화면에서 블러·모자이크 강도가 DPR만큼 약해짐
- 파일: `src/features/image-studio/ImageStudioPage.tsx:429-431`
- 문제: 효과 강도를 `image.getTotalObjectScaling()`으로 나누는데, fabric 7.4에서 이 값은 `objectScale × zoom × retinaScaling`이고 캔버스가 `enableRetinaScaling` 기본 활성이라 DPR이 곱해진다. DPR 2(맥북)·DPR 3(폰)에서 소스픽셀 기준 강도가 1/2·1/3로 줄어 — 블러 최소 강도 10이 radius 2.75px/2px가 되어 S13(텍스트 판독 방지)이 무력화되고, 모자이크 최소 4는 블록 2px로 사실상 무효가 된다. 결과물이 사용자 모니터의 DPR에 좌우되는 것 자체가 비정합. 스모크는 DPR 2에서 강도 32·대형 이미지만 검사해 못 잡는다.
- 수정: `image.getObjectScaling()` 사용(또는 `getTotalObjectScaling()` 값을 `instance.getRetinaScaling()`으로 나누기). 스모크 또는 단위 테스트에 DPR 2 + 최소 강도 케이스 추가.

## P2 — 경미

- **[T2]** `VideoStudioPage.tsx:147, 600` — `ready`에 `!item.probing`이 추가되어 모든 영상(브라우저는 frameRate 미제공)이 보강 프로브 완료까지 내보내기 비활성. 프로브는 직렬 큐 + 매회 FFmpeg 기동이라 다중 파일 시 수 초~수십 초 지연되고, 경고 문구("메타데이터를 읽지 못해 차단")가 실제 상황과 불일치하며, `probeVideoMetadata`에 타임아웃이 없어 프로브 워커가 멈추면 무기한 차단. 수정: frameRate 보강 프로브(duration이 이미 유효한 항목)는 내보내기를 막지 않게 분리(프레임 스텝 버튼만 비활성), 프로브에 타임아웃 추가, 경고 문구 상황 구분.
- **[T3]** `VideoGroupSection.tsx:188`, `VideoStudioPage.tsx:217` — 프로브가 fps를 못 찾으면 `frameRate: 0`이 저장되는데 완료 가드가 `> 0`이라 `<video>` 리마운트(그룹 이동·재정렬)마다 프로브 재실행. `frameRateProbed` 플래그(또는 0도 완료로 간주)로 1회만 시도.
- **[T4]** `videoEncoding.ts:23-26` — concat 재인코딩에서 모든 입력의 프로브 실패 시 fallback 30fps로 60fps 소스 저하 가능(이중 엣지). fallback을 원본 미변경(fps 필터 생략)으로 하는 것 검토.
- **[T5]** 블러 잔존 2건: ① base 잠금 해제 후 "맨 앞으로" 실행 시 효과 패치가 base에 가려져 가린 내용 노출(`ImageStudioPage.tsx:744` `bringObjectToFront`) — 효과 패치가 있으면 base를 패치 아래로 유지하거나 경고. ② Safari 폴백 블러가 단일 패스 다운/업스케일이라 품질 차선 — 2~3회 반복으로 개선(선택).
- **[T6]** 문서 비교 공용화의 HWP 시각 결함: 교차 컬럼 드래그 시 drop 허용 커서 표시(실제는 no-op — `DocumentFileColumn.tsx:66-70`의 무조건 `preventDefault`), 반대 컬럼의 파란 `drag-over` 하이라이트 잔류 가능(global.css:781 — HWP 오렌지 악센트와도 불일치), move-across 버튼 `title` 툴팁 탈락. 컬럼 간 드래그는 `dropEffect = "none"` 처리 + DragEnd에서 하이라이트 정리 + 툴팁 복원.
- **[T7]** 명세화·테스트 보강(선택): 두 번째 효과부터 `image.getSrc()` 원본에서 샘플링하는 의미론(기존 효과·그리기 획 미포함)을 주석/가이드로 명시. `mapSelectionToImagePixels` 단위 테스트 추가(현재 helper 3케이스만). `videoMemo` 테스트에 "콜백 prop 변경은 무시된다" 계약 단언 추가. S7 가드의 O(시트수²×셀수) 스캔은 시트 수가 많은 워크북에서 참조 인덱스 1회 구축으로 최적화 가능.

## 확인 완료 (재작업 불필요)

- S1~S14 전부 해결: 오버레이 내보내기 제외(스모크가 판별력 있게 검증), Safari 폴백(무음 실패 해소), 변환 연동(`regionEffectTransform` — 회전·스케일·flip 정합을 손 계산 검증), 영역 크롭 렌더(전체 래스터화 제거), 진행 메시지 중첩 values 방식(3단계 중첩 시뮬레이션 통과, ko/en 57키 존재), metadataSource "browser" 유지 + 오버레이 조건 수정, audio.progress.* 분리·진행 문구 복원, performSheetTrim 참조 가드(ExcelJS 실행 검증), collapseSql 정리(10만 케이스 퍼즈 등가), trackChanges만 제거·trackRevisions 유지(판정 기록대로), toolRegistry 아이콘 정렬, formatTime 통일, videoMemo 주석+판별력 있는 테스트.
- 문서 비교 공용화: 파일 쌍 관리·세션 revoke·보고서 파이프라인·진행률 분배·HWP 암호 흐름 모두 HEAD와 등가. HWP 교차 재정렬 방지(1차 F1)는 로컬 state 방식으로 기능 등가 유지.
- AGENTS.md·CLAUDE.md: 규칙 2가 양쪽에 존재해 일치(검증 중 제기된 불일치 의혹은 오독).
- 빌드·단위 테스트 27/27·tsc 클린.
