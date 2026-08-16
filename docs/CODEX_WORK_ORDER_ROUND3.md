# Codex 작업지시서 3차 — 2차 수정·리팩터링·블러 신기능 검증 후속 (2026-08-16)

커밋 `9e0855e`·`815a7cf`(2차 수정 + 컴포넌트 분리·i18n 이관)와 워킹트리의 블러 신기능을 검증한 결과다. **2차 지시서 R1~R14는 사실상 전부 해결**됐고(R1·R3·R5·R13은 실행으로 재확인), PDF·엑셀·텍스트 리팩터링은 리그레션 없이 합격이다. 그러나 **비디오 리팩터링에서 사용자 눈에 바로 보이는 신규 버그 2건**, **블러 기능에서 배포 전 수정이 필요한 4건**, R15 미해결 1건이 남았다. 공통 지침은 1차 지시서 0절 + AGENTS.md:4(번역·SEO·AdSense 영향 검토 — CLAUDE.md 규칙 2와 동일 내용)를 따른다.

> **개정 이력**: Codex의 이의 제기 5건을 재검증해 반영했다 — 말미 "이의 제기 판정 기록" 참조. 특히 S12의 trackRevisions 관련 지시는 오류였으므로 정정했다.

---

## P0 — 배포 차단 (사용자에게 즉시 보이거나 결과물 오염)

### [S1] 블러: 내보내기 시 선택 오버레이(점선 사각형)가 결과 파일에 구워짐
- 파일: `src/features/image-studio/ImageStudioPage.tsx:643-668` (exportImage)
- 문제: fabric 7.4의 `excludeFromExport`는 `toObject`/`toSVG` 직렬화에만 적용되고 래스터 경로(`toCanvasElement`/`toDataURL`)는 `_objects` 전체를 렌더링한다(fabric 소스 대조 확인). `applyRegionEffect`는 굽기 전 오버레이를 제거하지만 `exportImage`는 제거하지 않아, 효과/자르기 모드에서 영역을 드래그해 둔 채 "이미지 다운로드"를 누르면 보라/파란 점선 사각형이 JPG·PNG·WebP 모두에 박힌다. 스모크 테스트는 효과 전에 내보내기를 검사해 못 잡는다.
- 수정: `exportImage` 시작 시 `clearRegionSelection()` 호출, 또는 `toDataURL`/`toCanvasElement`에 `filter: (o) => o !== regionOverlay.current` 전달.
- 완료 기준: 영역 선택 상태에서 내보낸 파일에 오버레이 없음(스모크 테스트에 케이스 추가).

### [S2] 비디오: 인코딩 진행줄에 원시 i18n 토큰이 그대로 표시됨 (i18n 이관 회귀)
- 파일: `src/features/video-studio/video.worker.ts:85, 99` (reportFfmpegProgress)
- 문제: `` `${progressStage.label}… ${percent}%${eta}` ``로 `workerMessage()` 토큰(`__worklazy_i18n__:{...}`)에 평문을 이어 붙인다. 클라이언트 `resolveFeatureMessage`의 `JSON.parse`가 뒤에 붙은 `… 45%` 때문에 실패해 원문 토큰이 그대로 노출된다(시뮬레이션 재현). 모든 인코딩·이어붙이기 실행 중 계속 표시되는 메시지다.
- 수정: 문자열 합성 금지 — 진행 메시지를 단일 키(예: `video.messages.progressWithEta`)로 만들고 stage 라벨·percent·eta를 `values`에 중첩 토큰/값으로 전달(139행 `preparing` 키의 중첩 방식이 이미 정상 동작하는 선례).

### [S3] 비디오: 정상 미리보기 위에 "브라우저 미리보기 없음" 오버레이 영구 표시 (프레임 스텝 기능 회귀)
- 파일: `src/features/video-studio/VideoGroupSection.tsx:187, 221-222`, `VideoStudioPage.tsx:215-242`
- 문제: `onLoadedMetadata` 성공 후에도 frameRate가 없으면 프로브를 트리거하는데(브라우저는 frameRate를 안 주므로 **모든 영상**이 해당), `probeItem` 성공 경로가 `metadataSource: "ffmpeg"`를 무조건 설정해 88% 불투명 `.video-preview-fallback` 오버레이가 정상 재생 미리보기 위에 영구히 덮인다. 프로브 직렬화로 다중 파일 시 수십 초 "확인 중" 상태도 발생.
- 수정: frameRate 보강 목적의 프로브는 `metadataSource`를 기존 값("browser")으로 유지하고 frameRate만 병합. probing 오버레이도 미리보기가 이미 성공한 항목에는 표시하지 않기.

## P1

### [S4] 블러: Safari 17 이하에서 블러가 무음 실패 (민감정보 가리기 실패)
- 파일: `ImageStudioPage.tsx:768`
- 문제: `context.filter = "blur(...)"`는 Safari 18부터 지원. 미지원 브라우저에서 할당이 조용히 무시되어 **원본 그대로의 패치가 오류 없이 적용**된다 — 가리기 도구로서 최악의 실패 형태.
- 수정: `"filter" in CanvasRenderingContext2D.prototype` 감지 → 미지원 시 다운스케일→업스케일 반복 근사 블러 폴백(또는 최소한 `effectError` 표시). 모자이크 경로는 영향 없음.

### [S5] 블러: 효과 패치가 원본 이미지 변환을 추적하지 않아 가린 내용이 노출됨
- 파일: `ImageStudioPage.tsx:490-514, 714-721`
- 문제: 패치가 고정 위치 레이어라서 (a) 비율 자르기 시 base는 cover 재배치되는데 패치는 left/top 비례 이동만 되어 어긋남 — 가려야 할 내용 노출, (b) 원본 잠금 해제 후 base 이동·회전 시 패치가 제자리에 잔류(패치는 선택 불가라 따라 옮길 수도 없음), (c) 효과 후 밝기/대비 변경 시 패치 영역만 옛 보정 상태로 남아 이음새 발생.
- 수정(권장): 효과를 레이어가 아니라 **base 이미지 픽셀에 직접 굽기**(`setElement`로 원본 교체) — 세 문제를 구조적으로 해결. 차선: 효과 레이어 존재 시 비율 자르기·잠금 해제에 경고.

### [S6] 블러: 효과 적용마다 캔버스 전체를 원본 해상도로 렌더링
- 파일: `ImageStudioPage.tsx:404`
- 문제: 작은 영역 하나를 위해 `toCanvasElement(multiplier)`로 전체(예: 26MP)를 래스터화 — 메인 스레드 수백 ms 블로킹 + iOS Safari 캔버스 면적 한도(~16.7MP) 초과 시 빈 캔버스가 되어 투명 패치가 무음 생성될 수 있음.
- 수정: fabric 7.4의 `toCanvasElement(multiplier, { left, top, width, height })` 장면 좌표 크롭으로 패딩 포함 선택 영역만 렌더.

### [S7] Excel: 중간 빈 행·열 트림(performSheetTrim)에 시트 간 참조 보호 미적용 (R15 미해결)
- 파일: `src/features/excel-merger/excel.worker.ts:519-552` (스킵 판정 527행), 유틸 `sheetReferences.ts`
- 문제: 2차에서 추가된 `hasIncomingSheetReference` 가드가 좌표 이동이 없는 끝단(edge) 트림에만 적용됐다. 실제 위험 경로 — 수식 없는 시트 B가 splice로 잘려 Summary 시트의 B 참조가 어긋나는 중간 트림 — 는 여전히 자기 시트의 수식·병합만 검사한다.
- 수정: 527행 스킵 조건에 `hasIncomingSheetReference(output, worksheet)` 추가(+경고). 유틸·테스트는 이미 있으므로 한 줄 수준.

## P2

- **[S8]** `src/locales/{ko,en}/features.json` `audio.edit.FADE_IN/FADE_OUT/GAIN/NORMALIZE/TRIM` — 버튼 라벨 이관 시 같은 키를 재사용해 기존 **진행 문구가 소실**됨(워커 `commandProgressKey`가 여전히 이 키로 진행 메시지 전송 → 작업 중 "페이드 인"만 표시, MUTE/CUT 등과 비일관). 라벨용 키와 진행용 키를 분리하고 원 진행 문구("선택 구간 페이드 인 적용 중…" 등) 복원.
- **[S9]** 블러 경미 결함 4건: ① `ImageStudioPage.tsx:430` 모자이크 `imageSmoothing`이 undo/redo 직렬화에서 소실 — `FabricObject.customProperties`에 `"imageSmoothing"` 추가. ② `:762-780` 캔버스 가장자리 선택 시 블러 경계 반투명(알파 ~0.5)으로 원본 부분 노출 — 클램프 방향 edge-clamp 패딩 또는 이중 합성. ③ `:197-209, 435` 적용 진행 중 새 드래그 시작 시 이전 오버레이가 고아로 영구 잔류 — busy 중 `mouse:down` 무시 + 성공 경로에서 `clearRegionSelection()`. ④ `:463-488` Enter/Escape 단축키에 입력 필드 포커스 가드 없음(Delete 분기에는 있음) — 동일 가드 적용.
- **[S10]** AGENTS.md:4 규칙: `image.guide.blocks`/`faq`(ko·en)에 모자이크·블러 미반영. "가린 내용은 복구 가능한가요?" FAQ 추가 권장 — 정확한 안내: 다운로드 파일은 평탄화되어 원본 픽셀이 남지 않지만, 편집 세션의 실행 취소로는 되돌릴 수 있음(검증 완료된 사실).
- **[S11]** `formatterCore.ts:53` `wouldCreateLineComment` — 증명 가능한 죽은 코드(기존 조건에 포섭, 전수 퍼즈로 구·신 출력 동일)이고 동반 테스트(`p0-data-integrity.test.ts:39-42`)도 구코드로 통과해 판별력 없음. 코드·테스트 정리(참고: 2차 지시서의 `a - -1` 재현 주장은 오진으로 판명 — 실사용 회귀 없음).
- **[S12]** 기타 경미: `VideoTrimLane` vs `VideoGroupSection`의 `formatTime` 표기 불일치. `toolRegistry.ts:194-210` highlights 아이콘-라벨 짝 어긋남. `canvasToBlob` `reject()` 인자 없음. 패치 배치 서브픽셀 시프트(`floor값/multiplier` 배치로 정확화). PDF 패널들 `L()` 제거 자리 들여쓰기 불량. **[정정]** `tracked_docx.py:1127` `SETTINGS_CHILD_ORDER`에서 제거할 항목은 `trackRevisions`가 아니라 **`trackChanges`**다 — `w:trackRevisions`가 ISO/IEC 29500의 정식 settings 요소(부모 §17.15.1.78, MS Learn TrackRevisions 클래스의 SchemaAttr `w:trackRevisions`로 확인)이고 현재 배열 위치(revisionView 뒤, doNotTrackMoves 앞)도 올바르다. `trackChanges`는 CT_Settings에 없는 이름이므로 배열에서 제거(실질 무해하나 목록 정확성 차원).

## P3 (선택)

- **[S13]** 블러 최소 강도(4 ≈ 반경 2.2px)는 텍스트 판독 가능 수준 — 민감정보에는 모자이크 권장 힌트 또는 최소 강도 상향.
- **[S14]** `VideoGroupSection`/`VideoTrimLane` memo 비교자가 콜백 props를 비교하지 않음 — 현재는 안전하나(안정 콜백 + synchronizationKey 커버) 향후 콜백 의존성 추가 시 조용한 stale closure 위험. **주석 명시 + 회귀 테스트로 확정**(Codex 합의).

## 이의 제기 판정 기록 (2026-08-16)

Codex가 3차 지시서 초안에 제기한 이의 5건의 재검증 결과다.

1. **규칙 출처 (일부 수용)** — 해당 규칙은 AGENTS.md:4에 있고, CLAUDE.md에도 **동일한 내용의 규칙 2**가 존재한다(두 파일이 같은 "Project Rules"를 담음). Codex는 AGENTS.md를 읽으므로 본 지시서의 표기를 AGENTS.md:4 기준으로 정정했다. 규칙의 실체·요구사항에는 차이 없음.
2. **trackRevisions (전면 수용 — 지시서 오류)** — Codex가 인용한 MS Learn 문서로 확인: `TrackRevisions` 클래스는 `w:trackRevisions`로 직렬화되며(`SchemaAttr("w:trackRevisions")`), ISO/IEC 29500 발췌에 `<w:settings><w:trackRevisions/></w:settings>` 예시와 부모 settings(§17.15.1.78)가 명시된다. 즉 `w:trackRevisions`가 정식 요소이고, 2차 검증 시 "실제 요소명은 w:trackChanges"라던 진단이 오진이었다(SDK 클래스명↔요소명 혼동의 역방향). 정리 대상은 배열의 `trackChanges` 항목이며 S12에 반영했다. 참고: 이 오진에서 비롯된 R5의 "앵커에 trackChanges 추가" 지시도 불필요했던 것이므로, 현 코드에서 `trackChanges` 문자열만 제거하면 된다.
3. **오디오 파일 전환 시 워커 종료 (수용)** — README의 메모리 정리 원칙("작업이 끝나면 종료")에 부합하는 정책 판단으로 인정. 같은 파일 세션 내 효과 미리듣기의 FFmpeg 재사용(B14의 핵심 시나리오)은 유지되고 있음을 확인했으므로 현행 유지. 캐시를 더 오래 유지하려면 유휴 타임아웃·메모리 압박 시 해제 같은 별도 정책이 선행되어야 한다는 조건도 타당. 지시 철회.
4. **Excel 끝단 트림 보수적 스킵 (수용)** — 안전장치 유지 결정 존중. 완화하려면 "끝단 트림은 셀 좌표를 이동시키지 않는다"는 불변식을 검증하는 테스트를 먼저 추가하는 것을 선행 조건으로 함. 지시 철회(선택적 이월).
5. **VideoGroupSection 콜백 비교 (합의)** — 원 지시(S14)도 "주석 명시 또는 비교자 보강"이었으므로 이견 없음. 주석 + 회귀 테스트로 확정.

## 확인 완료 (재작업 불필요)

- R1~R14 전부 해결(핵심은 실행 재검증): CSV abort 레이스(R1), PDF 차단 완화(R2), AAC 스냅(R3), settings.xml 스키마 순서 — 6종 케이스 실행 검증(R5), JPEG 원본 해상도 재렌더(R6), Sortable 안정화(R7), 로케일 키(R8), 압축 동시성 4·이중 재인코딩 해소(R9), QR input(R10), R11 하위 9건, 판별력 있는 테스트 보강(R13 — 2028/2030 설날은 dangi/chinese가 실제 1일 차이 나는 연도임을 실측 확인).
- PDF·엑셀·텍스트 리팩터링(wordReport 분리, PDF i18n 이관) 동등 이동 확인 — 리그레션 없음. 비디오·오디오도 핵심 로직(동기 재생·드리프트·취소·generation 가드·히스토리·세션 재사용)은 보존.
- i18n: 코드 참조 285키 전부 ko/en 존재·슬롯 일치(스크립트 검사), 인라인 `L()` 잔존 0건(word-compare 페이지 제외 — 이관 범위 밖).
- 블러 기능의 잘 된 점: HiDPI 배제 원본 해상도 정합, blob URL 수명 관리, `worklazyRole` 직렬화 경로(fabric 소스 대조), 실패 시 오버레이 복원, undo/redo 스모크 테스트 동반. tools.json·seo.ts·README 반영 완료(가이드/FAQ만 누락 — S10).
- 빌드·단위 테스트 24/24·정적 검증 통과.
