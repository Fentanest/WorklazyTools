# 작업계획서 — 이미지 스튜디오 편집 탭 UX 개편 (2026-09-02)

**상태: Phase 1·2 — 정본(4왕복 이견 0)·구현 완료(108006c·b11f746·ba91557 배포) / Phase 3(§4) — 정본 (2026-09-02, 3차 왕복에서 "[정본화 가능] 이견 0" 판정).**
기준 해시: Phase 1·2는 `b98efde`(완료됨). **Phase 3 기준 해시: `4920453`**(Phase 2 완료 커밋 이후 — 착수 시 HEAD 재대조·실행 게이트 수행 후 §4 하단에 기록할 것. 비디오 A2 커밋이 사이에 있을 수 있음 — 이미지 표면 무변경 확인 필수.)
발동: 사용자 `!계획!`.

## 0. 배경 (실측 근거)

- 편집 탭: 230px 좌측 사이드바에 8개 도구 그룹 상시 노출(`ImageStudioPage.tsx:748-758`, `global.css:1607`), 캔버스 비고정, 820px 이하 1열 붕괴(`global.css:2240`). 도형 3종·스티커 이모지 4개.
- 편집기 구조(Codex 실측): `ImageEditor` 679줄(`ImageStudioPage.tsx:93-771`), `EditorMode = select|pencil|brush|erase|crop|effect`, `addObject()`가 삽입 직후 무조건 `mode="select"` 복귀(`:558-568`), 효과 선택 중에도 밝기·대비·색조 병행 조절 가능(`:598-618`), 모드 전환 시 선택 영역 소거(`:277-279`).
- 효과 강도 계약: `getObjectScaling() + instance.getZoom()`(`:412-438`) — DPR 비의존(기존 T1 수리). 반응형 fit은 CSS-only 축소(`:944-968`).
- 터치 타깃: 모바일 브레이크포인트 44px 보정 기존재(`global.css:2092`).

## 1. 목표

편집 탭을 "캔버스 상시 가시 + 활성 도구 옵션만 노출" 구조로 재구성하고 자산을 확충한다. 다른 탭 워크플로 무변경.

## 2. Phase 1 — 작업공간 구조

### I1. 상태 모델과 레이아웃
- **상태 분리(Codex 반박 수용)**: Fabric 이벤트를 제어하는 `interactionMode`는 **현행 `EditorMode` 전체(select/pencil/brush/erase/crop/effect)를 그대로 유지**하고, UI 패널을 제어하는 `activePanel`(select/crop/effect/draw/text/shapes/stickers/canvas)을 별도로 둔다. `mode` 하나에 패널을 연결하면 삽입 직후 select 복귀로 피커가 닫히는 회귀 발생.
- **draw 패널 서브도구 계약**: draw 패널은 연필(pencil)/붓(brush)/지우개(erase)를 서브도구로 담고, **마지막 선택 서브도구·색·굵기를 별도 상태로 보존**한다 — 패널 전환·select 복귀·객체 삽입 후에도 유지되며, draw 패널 재진입 시 보존된 서브도구로 `interactionMode`를 복원한다.
- **패널 매핑(8그룹 → 신규 패널)**: 조정(밝기·대비·색조)은 **effect 패널에 동거**(현행 병행 조절 계약 유지 — 배타 전환 시 `:277-279`의 선택 소거 회귀). 배경색·투명 배경·추가 레이어 전체 삭제는 **canvas 패널**. 선택 객체 스타일은 select 패널에서 객체 종류별 파생, 레이어 조작은 I3 미니바 담당.
- **삽입 후 규칙**: 텍스트·도형·스티커 삽입 시 `interactionMode`만 select 복귀, `activePanel` 유지(연속 삽입 가능).
- 레이아웃: 캔버스 sticky(광고 공간 유지 — Gemini AdSense 검증 반영, 뷰포트 전체 고정 기각) + 상단 도구줄 + 데스크톱 우측 패널/모바일 하단 시트(44px 타깃).
- **컴포넌트 분리**: 679줄 `ImageEditor` 직접 확장 대신 도구줄·패널·미니바를 별도 컴포넌트로 분리.

### I2. 줌·팬 (view-only 계약 — Codex 반박 수용)
- **책임 분리**: 반응형 fit은 현행 CSS-only 축소 유지, Fabric viewportTransform(VPT)은 **사용자 zoom/pan 전용**.
- **내보내기 보장**: export 시 VPT를 임시 identity로 전환(또는 view 무관 export helper) 후 반드시 복구 — Fabric `toCanvasElement()`는 zoom·pan을 출력에 포함하므로(Fabric 소스 실측) 이 계약 없이는 저장 결과 손상.
- **강도 계약 유지**: `getObjectScaling() + getZoom()` 그대로 사용, `getTotalObjectScaling()` 사용 금지(DPR 재유입 — T1 수리 역행).
- **의미 정의**: `100% = VPT 1`, fit = CSS 배율. **view reset 우선순위(충돌 해소)**: ① **캔버스 치수가 바뀌는 모든 전이**(파일 교체·새 캔버스·crop 적용, **치수를 바꾸는 undo/redo 포함**)에서는 VPT 초기화 후 fit ② 치수가 불변인 undo/redo에서는 view(VPT) 유지(toJSON에 VPT 미직렬화 — Fabric 실측). "undo/redo는 항상 view 불변"이 아니라 치수 변경 여부가 판정 기준이다.
- 좌표: crop·효과 드래그는 `scenePoint`(VPT 역적용) 기존 방식 유지, `mapCanvasSelectionToImagePixels`에 VPT 직접 전달 금지.
- **모바일 중재**: Fabric은 첫 터치를 객체 이벤트로 선점(`allowTouchScrolling=false`, upper canvas `touch-action:none`) — capture-phase 제스처 리스너로 **두 번째 포인터 감지 시 진행 중 Fabric transform/그리기 취소·억제** 후 pinch/pan 전환. "두 손가락=스테이지" 선언만으로는 불충분.
- **회귀 매트릭스(완료 기준)**: zoom/pan 전후 export 픽셀 동일성 / non-identity VPT에서 crop·효과 선택 위치 / DPR 1·2 × zoom 100·200% 강도 계약 / overlay export 제외 유지 / base 변형 후 effect 정렬·undo/redo / 파일 교체·빈 캔버스·비율 crop 후 fit·reset / 한 손가락 객체 vs 두 손가락 pinch 분리 / 미니바 위치 추종.

### I3. 플로팅 미니바
- base+region-effect를 **원자적 레이어 블록**으로 취급: 순서 조작은 현행 "맨 앞/맨 뒤"만 제공(기존 `mutateActive`+`keepRegionEffectsAboveBase()` 경로 재사용 — 단계별 앞/뒤 신설 금지), effect 객체는 비선택·비이벤트 유지, base에는 복제·삭제 disabled.
- 미니바 DOM 위치: scene 좌표를 VPT·CSS 배율로 변환, selection/move/scale/rotate/zoom/pan/resize 이벤트마다 갱신.

## 3. Phase 2 — 자산 확충

### I4. 도형 7종 — 타입·스타일 행렬 (Codex 2차 반박 수용)

| 도형 | Fabric 타입(단일 객체) | fill | stroke | strokeWidth | 비고 |
|---|---|---|---|---|---|
| 둥근 사각형 | `Rect`(rx/ry) | O | O | O | |
| 삼각형 | `Triangle` | O | O | O | |
| 별 | `Polygon` | O | O | O | |
| 다각형(육각) | `Polygon` | O | O | O | |
| 말풍선 | `Path` | O | O | O | 꼬리 포함 단일 Path |
| 화살표(단·양방향) | `Polygon`(머리+몸통 일체) | O(주 색) | O(외곽선) | O(외곽선 폭) | 몸통 폭은 고정 기하 — 두께 조절은 Fabric 스케일 핸들로(별도 기하 파라미터 없음) |
| 형광펜 | `Rect`(고정 opacity 0.45) | O | — (무시) | — (무시) | fill+opacity만, line cap 불요 |

- Group 사용 금지(스타일 적용·선택 경계 복잡화). `shape 판정(:169)`과 `syncSelectedShape`/`setSelectedShapeStyle`(`:576-588`)을 신규 타입(`Triangle`·`Polygon`·`Path`)까지 확장하되 **행렬의 비적용 속성은 무시**하도록 구현. 형광펜의 opacity 고정값과 히스토리 직렬화 포함.
- 스모크 기대값: 7종 각각 삽입 후 **행렬상 적용 가능 속성 변경이 반영되고 비적용 속성 변경은 무시됨**을 단언. `strokeWidth`는 전 도형에서 **외곽선 폭 의미로 통일**(Fabric `ctx.lineWidth` — 기하 `points`/`width`/`height` 불변을 화살표 케이스로 단언; 몸통 폭 동적 조절은 v1 범위 밖, 필요 시 후속에서 기하 파라미터+`setDimensions()` 재계산으로 설계).

### I5. SVG 스티커 (후보 확정은 착수 1단계 스파이크)
- **후보 미확정(Codex 반박 수용)**: Twemoji·Noto 모두 로컬 실측 불가였고 라이선스도 경로별 상이(Noto는 Apache-2.0/SIL 혼재 실측). **착수 1단계에서 upstream 버전/commit·실제 SVG 합계/gzip/파일 수·SHA·해당 경로 LICENSE를 실측해 확정**하고, 결과로 큐레이션 상한을 정한다. 수치 없는 "수십~수백 종" 약속 금지.
- 배포 구조: curated manifest(코드포인트·크기·SHA-256 고정) + **별도 `scripts/vendor-image-studio-assets.mjs`**(런타임 벤더와 성격 분리) + dev/prebuild 연결 + `public/vendor/emoji/<version>` 생성물 취급(`.gitignore` 추가) + `validate-static-output.mjs` 검사 추가 + 라이선스 생성·표시 경로 반영.
- 로딩: SVG를 JS 정적 import 하지 않고 manifest+개별 정적 URL — 이미지 스튜디오 lazy chunk(현 341KB/105KB gzip 실측)에 전량 포함 금지.
- 시스템 이모지: 별도 피커 불요 — 기존 텍스트 입력이 이미 임의 이모지를 IText로 추가 가능(`:571-574`). curated 스티커 버튼만 SVG `FabricImage`.

## 4. Phase 3 — 상세 사양 — **구현 완료 (`9dce527`)** (2026-09-02 사용자 승인 "다 진행" — **정본 확정: 3차 왕복 이견 0**, 문서 상단 상태·§4 왕복 기록 참조)

Phase 1·2 배포 완료(108006c·b11f746·ba91557)를 전제로 한다.

### P3-0. z-order 공통 계약 (1차 왕복 반영)
- **block-aware clamp 공통 헬퍼** 신설: 모든 z-order 조작 경로(I3 미니바 맨앞/맨뒤·레이어 패널 드래그·컨텍스트 메뉴)가 이 헬퍼를 경유 — "맨 뒤" = base+effect 블록 **바로 위**, "맨 앞" = 추가 레이어 최상단, 어떤 경로로도 base 아래 배치 불가. **I3 미니바는 대체가 아니라 공존**(front/back 버튼 유지, 내부 구현만 clamp로 통일), 기존 미니바 스모크는 clamp 의미론으로 기대값 갱신.
- **base 선택 시 미니바 정책(2차 왕복 확정)**: front/back 버튼도 복제·삭제와 동일하게 **disabled**(no-op·숨김 아님 — 일관성). 스모크 기대값: base 선택 시 미니바 4버튼(front/back/복제/삭제) 전부 disabled 단언.

### P3-1. 레이어 패널
- **별도 layers 패널로 확정**(select 패널 동거 아님 — 모바일 시트 완료 기준 명확화). **`activePanel` 열거에 `layers` 추가**(I1 상태 모델 확장 — select/crop/effect/draw/text/shapes/stickers/canvas/**layers**). **패널 유지 규칙**: 레이어 항목 클릭으로 캔버스 선택이 바뀌어도 `activePanel=layers` 유지(삽입 후 유지 규칙과 동일 원리 — select 패널로 자동 전환하지 않음). 객체 목록: 위→아래 z순, 유형 아이콘+짧은 라벨(ko/en), 클릭 시 캔버스 선택 연동, 표시/숨김 토글(fabric `visible`), 삭제 버튼.
- 원자성: base+effect 블록 최하단 고정·목록 재정렬 불가(base 잠금 표시, effect 비노출), 드래그 재정렬은 추가 레이어 사이만(P3-0 clamp 경유). **base 숨김 시 effect 동반 숨김, base 삭제 항상 금지.**
- **스냅샷·동기화 계약(1차 왕복 — fabric 실측: `moveObjectTo`·`visible` 변경은 이벤트 미발생)**: 재정렬·표시/숨김 핸들러에서 **명시적 `pushSnapshot()` + 패널 상태 갱신 + 활성 객체 숨김 시 selection 해제(또는 ActiveSelection 재구성) + restore 후 base-block invariant 재적용**. order·visible의 toJSON 왕복 보존은 프로브로 확인됨(별도 스키마 불요).

### P3-2. 다중 선택·정렬 (데스크톱 전용)
- shift-클릭·러버밴드 ActiveSelection. **base 배제 알고리즘 명시**: `selection:created/updated` 훅에서 selection에 base 포함 시 base를 제외하고 ActiveSelection 재구성(잔여 0~1개면 단일 선택/해제로 강등).
- **입력 우선순위 명문화**: Space 팬 > crop/effect 모드 드래그 > select 모드 러버밴드. 러버밴드는 select 모드 한정. **crop/effect `mouse:down`에 좌클릭 guard(`event.e.button !== 0` 무시)** — fabric은 우클릭에도 mouse:down 발생(실측).
- 정렬 6종(좌·수평중앙·우·상·수직중앙·하)은 다중 선택 미니바에 노출 — scene bbox 기준(I2 VPT 계약). 다중 미니바 동작: 삭제·복제·정렬. **다중 복제는 구성 객체 각각 clone + 상대 z-order 유지**(`mutateActive` 단일 경로 재사용 금지 — 1차 왕복).
- **모바일 러버밴드·다중 선택 미지원(명시 제외).**

### P3-3. 컨텍스트 메뉴 (데스크톱 전용)
- **`instance.on("contextmenu")` 경로 사용**(fabric 7.4 기본 `stopContextMenu`·`fireRightClick` 실측 — 억제 범위가 upper canvas로 자연 한정, document 전역 리스너 금지).
- 대상별 정책: 일반 객체 = 복제·삭제·맨 앞·맨 뒤(+IText 편집 진입) / ActiveSelection = 복제(위 다중 복제 규칙)·삭제·정렬 / **base·effect·빈 캔버스 = 메뉴 없음**(기본 억제만 — base 잠금 시 target 판정 왜곡 이슈 회피). **붙여넣기 항목 제거·객체 클립보드 미도입**(복제로 충분 — 1차 왕복 공급원 부재 지적 수용).
- 닫힘 조건: Escape·외부 클릭·resize/scroll. ko/en, 내부 명칭 비노출.

### P3 검증 (1차 왕복 확장)
- 기존 이미지 스모크·`image-region-effect` 단위 테스트 유지 + 미니바 스모크 clamp 기대값 갱신.
- 신규: 레이어 목록-선택 동기·재정렬 반영·base 재정렬 불가(드래그·컨텍스트·미니바 3경로 모두 base 아래 불가) / base 우선 shift 선택·러버밴드 양쪽의 base 배제 / 정렬 6종 × 회전·스케일 객체 × zoom 100·200% scene bbox / 표시/숨김·재정렬·정렬·다중 복제의 undo/redo / **다중 복제 결과의 상대 z-order 유지 단언** / **base 숨김 시 effect 동반 숨김 + 그 undo/redo** / **base 삭제 금지(패널·컨텍스트·키보드 전 경로)** / 숨긴 활성 객체 selection 해제·export 제외 / restore·export·효과 추가 후 `[base,effects…,additional…]` 순서 유지 / Space팬 vs 러버밴드 vs crop/effect 드래그 vs 우클릭 우선순위 / **일반 객체 메뉴 각 항목 동작(복제·삭제·맨앞·맨뒤·IText 편집 진입) 개별 단언** / base·effect·ActiveSelection·IText 우클릭 정책 + **빈 캔버스 내부 우클릭(메뉴 없음·기본 메뉴 억제)** 및 캔버스 밖(기본 메뉴 유지) / base 선택 시 미니바 4버튼 disabled / ko/en 메뉴 문구·닫힘 조건 / 모바일 390×844 레이어 패널 시트.
- 명시 제외: 레이어 잠금·그룹화·마스크·모바일 길게 누르기·모바일 다중 선택·객체 클립보드(복사/붙여넣기).

### P3 왕복 기록
- Codex 1차 (2026-09-02, 완료 — 판정 "재왕복 필요", 6건 반영): I3 공존·clamp 통일(P3-0) / base 배제 알고리즘·입력 우선순위·좌클릭 guard(P3-2) / 스냅샷·동기화 계약(P3-1 — moveObjectTo 이벤트 미발생 실측) / contextmenu 경로·대상별 정책·클립보드 제거(P3-3) / 검증 목록 확장·모바일 범위 확정.
- Codex 2차 (2026-09-02, 완료 — 3·4·5 해소 확인, 부분 3건+문서 상태·기준 해시 모순 → v7 반영): base 선택 시 미니바 front/back disabled 확정(P3-0) / activePanel에 layers 추가·패널 유지 규칙(P3-1) / 검증 단언 5종 추가 / 문서 상태를 Phase 1·2 정본/완료 vs Phase 3 초안으로 분리·P3 전용 기준 해시 4920453 기록.
- Codex 3차 (2026-09-02, 완료 — 2차 잔여 5건 전부 해소 확인, **"[정본화 가능] 이견 0" 선언** → Phase 3 정본 확정). 착수는 계획 §4 순서: 비디오 A3·A4 이후(코드 단일 작성자 직렬화), 착수 시 기준 해시 재대조·게이트 기록.

## 4b. Phase 4 — 자르기·크기·레이아웃 개선 (사용자 `!계획!` 2026-09-02)

**상태: 구현 완료 (2026-09-02 — P4 전 묶음: `385a88d` P4-0/1/5 · `c9458e3` P4-2 · `4f85e58` P4-3/4. "확정 사항" 1~23항 구현·검증·push 완료.)**
기준 해시: `d93ff06`(착수 시 재대조). 사용자 신고 #1~#7 + 사용자 결정(접이식 패널). 재현 상세는 본 절 하단 "브라우저 재현 기록" 참조.

### P4-0. overlay 원점 좌표 수정 (신고 #2·#7 공통 근본 원인 — 재현 확정)
- **재현 확정**: crop/effect overlay `Rect`가 fabric 7.4 기본 원점(center/center)을 쓰는데 코드는 left/top을 좌상단으로 저장·적용 → ① 자유 드래그 박스가 **시작점 중심으로 확장 표시**(신고 #2의 실제 원인 — "코너 기준" 가설 기각) ② **화면 박스와 저장 crop 영역이 반폭 어긋남**(실측: 저장 (279.8,179.8) vs 표시 (109.0,58.9)) → 박스 안으로 보이던 낙서가 실제 crop 밖이라 적용 후 음수 좌표로 잘림(신고 #7 — Path 이동 자체는 8/8 정상, 낙서 가설 3종 기각).
- **수정**: crop·effect overlay 생성에 `originX:"left", originY:"top"` 명시(또는 일관 bounding-box 변환). 표시=저장=적용 좌표 일치가 이 계약의 완료 조건. **effect overlay도 동일 수정**(비선택·비이벤트 계약은 유지 — Codex 검토 판정).
- 검증: 재현 매트릭스 8조합(변형×줌×지우개) 전부에서 "화면 박스 안 낙서 = 적용 후 보존" + 대조군 픽셀 유지(펜 2,504→2,492·지우개 7,645→7,665 수준) 단언, 표시-저장 좌표 오차 0.

### P4-1. 자르기 모드-패널·취소 의미 동기화 (신고 #1)
- 재현 확정: 적용 후 패널 crop 잔존+select 동작(이후 드래그가 객체를 실제 이동 — +35,+24px 실측). **수정: 자르기 "적용"(버튼·Enter)에만 interactionMode·activePanel을 함께 select로 전환**(비율 버튼은 박스 수정이므로 crop 유지 — Codex 검토 반영). **취소·Escape 의미 확정: "박스만 취소·crop 모드/패널 유지"**(도구 종료는 패널 전환으로만).

### P4-2. 자르기 박스 편집·비율 재설계 (신고 #2·#6 — Codex 검토 계약 반영)
- **cropTo 폐기**: 재현 확정 — 5개 비율 버튼이 900px 캔버스 강제(900×900/675/1200/506/1600)+중앙 cover+**사용자 이동·배율 리셋**+줌 100% 초기화. 기존 스모크(`new-tools-smoke.mjs:520-546`)의 구 의미 고정은 **의도적 기대값 교체**로 처리.
- **자르기 박스 직접 편집(#6, 재현 확정: 현행은 박스 위 드래그도 새 박스 생성)**: crop 모드에서 박스가 조작 가능한 객체가 된다 — **crop 전용 컨트롤**(이동+8핸들, 회전·스큐 제거), 캔버스 경계 clamp(이동·스케일 중), **스케일 조정 시 scale→width/height 정규화**(fabric 핸들은 scaleX/Y만 변경 — 실측), 조정마다 selection 상태·px 라벨 실시간 갱신. `event.target===cropBox`면 fabric transform에 위임, 빈 영역이면 새 박스 분기. **crop/effect overlay 소유권 분리**(모드 전환 시 상대 박스 명시 폐기 — 현행 공유 구조의 누출 차단). 박스는 일반 선택 동기·미니바·히스토리 스냅샷에서 제외, `excludeFromExport`+export 시 직접 제거 유지, **좌클릭 guard(`event.e.button!==0` 무시) 선반영**(P3 계약 이관). 핀치 시작 시 박스 처리(현행: 삭제)는 "유지"로 변경 검토 — 왕복 판정.
- **비율 버튼**: **기존 5종(1:1·4:3·3:4·16:9·9:16)+자유 버튼 신설**. 박스가 있으면 그 박스 비율 즉시 변경 — 산식 `w'=min(w, h×r), h'=w'/r`(축소 우선, 중심 유지 후 경계 clamp 시 이동 허용 — clamp가 중심 유지에 우선), 최소 10px·정수 반올림. 박스가 없으면 이후 드래그 비율 잠금(자유로 해제). 적용 후 비율 상태는 유지.
- 보강: **Shift=드래그 중 비율 잠금, Alt=중심 확장 드래그** — **crop 전용 핸들에서 구현**(fabric 전역 uniformScaling 계약 변경 금지 — Codex 실측 반영).

### P4-3. 크기 지정 (신고 #3 전반 — Gemini 권고 + Codex 검토 반영)
- **별도 "크기 조절" 도구/패널 신설**(자르기와 혼합 금지 — Gemini 관례 검토): ① **이미지 리샘플** — W·H px 입력+비율 유지 토글. 구현은 **base 교체가 아니라 전 객체 전역 변환**(텍스트·도형·스티커 포함; 회전 객체는 `util.applyTransformToObject` 계열 행렬 합성 — 단순 left×sx 금지), region-effect는 base anchor에서 재동기화 ② **캔버스 크기 변경** — 콘텐츠 불변, 중앙 기준 dx/dy 이동, **잘린 객체 비삭제**. 치수 변경 전이므로 I2 view reset(100% fit) 적용. 유효성 1~8192px, ko/en.
- **`outputMultiplier` 정리(Codex 검토 발견)**: 히스토리 스냅샷에 미저장되는 기존 구멍 수정(undo/redo 복원), 리샘플 도입 후의 의미(표시 배율 vs 내보내기 배율) 확정.
- 내보내기 동작부에 **내보내기 크기 지정**(원본/사용자 지정 px — 비율 불일치 시 정책 명시) 옵션.

### P4-4. 레이아웃 — **접이식 우측 패널** (사용자 결정 2026-09-02: Gemini 대안 2안 채택, 2행 스트립은 기각)
- 기각 근거(Gemini 검토): 2행 가로 스트립은 슬라이더·다수 버튼의 발견성 하락과 상단 광고 노출 영역 침해 리스크.
- 사양: 우측 패널 유지 + **접기/펼치기 토글**(원클릭). 접힘 시 캔버스 좌우 풀폭 + CSS fit·미니바 좌표 재계산(I2 계약), 펼침 시 현행 폭 복귀. 접힘 상태는 세션 내 기억. 토글 버튼은 도구줄 우측 또는 패널 경계에 상시 노출(ko/en 라벨·aria). sticky 캔버스·광고 공간 계약(I1) 불변, 모바일 하단 시트 불변.

### P4-5. '선택 영역으로 자르기' 버튼 상태 (신고 #5 — 재현·검토 반영)
- 재현 확정: 영역 없으면 버튼이 **DOM에서 사라지고**, 있어도 accent 클래스 부재로 **회색 배경+흰 글자**(활성인데 비활성처럼 보임 — 신고 그대로). W×H 표시는 기존재하나 **mouseup에만 갱신**.
- 수정: 버튼 **항상 렌더** + `disabled={!selection}` + 가시 사유·`aria-describedby`("영역을 먼저 드래그하세요" ko/en 신규 키), 활성 시 accent 클래스 신설 적용. px 표시는 **드래그·핸들 조정 중 실시간** + **박스 우측 하단 플로팅 오버레이 라벨**(효과 영역 동일 적용).

### P4 참고 — 확정(1차 왕복)
- 자르기 진입 시 기본 박스 즉시 표시: **v1 미채택**(드래그 시작이 명확 — 후속 검토 backlog).
- 핀치 중 박스: **유지로 확정**(현행 삭제 동작 변경 — 박스가 편집 가능해졌으므로 유지가 자연).

### v3 확정 사항 (1차 왕복 19건 — 우선 계약)
1. **P4-0 호환 근거**: effect anchor는 `regionEffectTransform`의 **원본 이미지 로컬 좌표**로 저장되어 overlay 원점과 무관, 히스토리는 세션 내 메모리 스냅샷뿐 → **마이그레이션 불필요**. "좌표 오차 0"의 측정 대상은 **stroke 제외 overlay 기하(fill 경계)**.
2. **취소 의미 분리**: crop과 effect의 적용/취소/Escape 핸들러를 분리 구현. **effect도 "박스만 취소·모드/패널 유지"로 통일**.
3. **overlay 상태 완전 분리**: crop/effect 각각 독립 ref·selection state·clear 함수(공유 금지).
4. **crop 전용 컨트롤**: 코너 4+변 4의 8컨트롤, 회전·skew 컨트롤 제거, **flip 금지**(음수 스케일 차단), fabric 기본 `uniformScaling`의 Shift 반전 의미는 crop 컨트롤에서 자체 처리(Shift=비율 잠금으로 재정의).
5. **좌클릭 guard(touch-safe)**: `pointerType==="mouse"`일 때만 `button!==0` 무시 — 터치는 통과. P3 이관 계약도 동일 문구로 수정.
6. **clamp·정규화 순서**: 이동·스케일 **중** 실시간 clamp(`object:moving`/`object:scaling`), **`object:modified`에서 1회** scale→width/height 정규화(scale=1 복원).
7. **비율 경계 규칙**: 정수 반올림 후 비율 허용오차 ±1px / 변환 결과가 최소 10px 미만이면 **비율 유지 채 양변 확대로 최소 보장** / free 상태에서 Shift 드래그 = 1:1 / 캔버스가 목표 비율을 수용 못 하면 캔버스 내 최대 크기로 축소 배치.
8. **스모크 교체 범위**: `new-tools-smoke.mjs:520-546`의 900px 캔버스 단언 전체를 "박스 비율 변경" 의미로 교체, 그 안의 치수 undo/redo 검증은 P4-3 크기 도구 검증으로 이전.
9. **리샘플 경로**: 일반 객체 전부에 scale 행렬을 `util.applyTransformToObject`로 합성 → region-effect는 변환 대상에서 제외하고 base 완료 후 anchor 재동기 → 캔버스 setDimensions → viewreset 순.
10. **outputMultiplier 계약**: 히스토리 스냅샷에 저장·restore 복원, 변경 지점은 내보내기 옵션 UI뿐. "원본 내보내기" = **base 원본 해상도 기준**.
11. **대형 치수 전략**: 작업(논리) 캔버스 상한 **4096px** — 리샘플 입력도 4096 상한. 내보내기 크기 지정은 **8192px까지** — 달성 수단은 **20항의 목적지 캔버스 재렌더 경로**(20항이 본 항의 구현 수단을 대체; multiplier 경로는 21항 "원본 화질" 전용). 8192 논리 캔버스 직접 생성 금지.
12. **내보내기 비율 정책**: W·H 입력에 비율 잠금 토글 **기본 ON**(한쪽 입력 시 자동 계산), 해제 시 스트레치 허용(명시적 선택).
13. **접이식 패널 구현**: 접힘 상태 `sessionStorage`, 모바일(≤820px)은 접힘 무시하고 시트 강제 표시, 기존 `ResizeObserver` 재사용으로 fit 재계산.
14. **버튼 색**: 신규 accent 클래스 대신 **기존 `accent-sky` 체계 재사용**. 항상-렌더 전환에 따른 스모크(버튼 존재 가정) 확장 포함.
15. **패널 열거 누적 계약**: `EditorPanelName`에 P4의 `size` 추가, 후속 P3의 `layers`와 누적 호환 명시.
16. **stale 문구 정정**: §5의 "그림판 탭" 제외 문구를 현행 구조(Phase 1 통합 이후) 기준으로 갱신.
17. **실행 순서 명시**: **P4 → 비디오 A3 → A4 → P3** (P4 선착수 확정).

### v4 추가 확정 (2차 왕복 잔여 해소)
18. **비율 우선순위 단일 사슬**: ① 비율 유지 ② 캔버스 경계 clamp(초과 시 비율 유지 축소·이동) ③ 최소 10px(미만 시 비율 유지 확대). 극단(캔버스가 해당 비율로 10px 박스 수용 불가) 처리는 **모든 비율 잠금 진입 경로에 적용** — preset 버튼은 비활성(사유 툴팁), **Shift 드래그는 잠금 무시(자유 드래그로 동작)** — 충돌 자체를 제거.
19. **preset 후 핸들 잠금**: 비율 preset이 활성인 동안 핸들 조절도 **비율 잠금 유지**(코너 핸들만 활성, 변 핸들 비활성), "자유" 선택 시 8핸들·자유 변형 복귀. "적용 후 비율 상태 유지"와 일관.
20. **내보내기 크기 지정 = 목적지 캔버스 재렌더 경로**(fabric multiplier는 스칼라라 비균일 불가 — 실측 수용): VPT identity 상태의 export 결과를 지정 W×H 목적지 캔버스에 `drawImage`(잠금 ON=균일, OFF=스트레치). **이 경로에 8192px 상한 적용.** 기존 multiplier 경로는 "원본 화질" 모드 전용으로 존속.
21. **"원본 화질" 모드 의미 확정**: 현행 의미 유지 — base가 원본 픽셀 밀도로 렌더(출력 전체 치수 = 작업 캔버스 × multiplier, 원본 전체 치수와 다를 수 있음). ko/en 라벨을 "원본 화질"로 명확화. **이 모드에도 8192 상한 적용** — 초과 시 8192에 맞게 multiplier 자동 축소 + 결과 치수 안내.
22. **outputMultiplier 변경 지점 예외**: 내보내기 옵션 UI 외에 **파일 로드 초기화·빈 캔버스 초기화·history restore**가 정당한 변경 지점(확정 10항 보완).
23. §5 stale 문구는 v4에서 **실제 수정 완료**(지시 잔존 아님).

### P4 검증
- **P4-0**: 표시=저장 좌표 오차 0, 재현 매트릭스 8조합 낙서 보존, 대조군 픽셀 유지 / **P4-1**: 적용 후 패널·모드 일치, 취소·Escape의 박스만 취소, 비율 버튼 후 crop 유지 / **박스 편집**: 그리기→핸들 이동·크기조정(scale 정규화 포함)→적용 픽셀 정확성, 경계 clamp, 박스 위/밖·**좌/우클릭** 분기, crop↔effect 박스 누출 없음, 미니바·히스토리·선택 동기 배제, 줌·팬 상태 핸들 좌표(I2) / **비율**: 5종+자유, 기존 박스 즉시 변경(축소 우선·clamp 우선순위)·무박스 잠금, 경계 접촉·최소 10px·정수 반올림·9:16 극단, Shift·Alt / **크기**: 캔버스 변경·리샘플 치수·콘텐츠(회전 객체 포함)·효과 정렬·viewreset·undo/redo·`outputMultiplier` 히스토리 / 내보내기 크기 / **접이식 패널**: 접힘 풀폭 fit·미니바 재계산, 상태 기억, 821·1020·1440px, 390×844 불변 / 버튼 상태(항상 렌더·accent·en 사유 포함)·px 실시간 / 박스 export·효과 미포함. 기존 이미지 스모크는 **비율 버튼 구 의미 스모크의 의도적 교체** 외 전부 유지.
- 명시 제외: 다른 탭 영향 / crop 박스 회전·스큐 / effect 박스 핸들화 / overlay의 히스토리 저장 / 레이어 flatten / 리샘플 보간 방식 선택 UI / P3 항목 동시 구현(입력 이벤트 표면은 P4 선반영분만).
- **P3 정합 메모**: 접이식 패널 채택으로 P3 layers 패널 충돌 해소. P3의 좌클릭 guard는 P4에서 선반영되며, P3 착수 시 crop 박스 이벤트 소유권과의 교차를 P3 게이트에서 재확인.

### P4 왕복 기록
- 입력 3종(2026-09-02): Gemini UX 검토(2-WAY 기각→접이식 대안·크기 도구 분리·px 라벨 관례) · Codex 코드 검토(핸들 계약 8건·리샘플 전역 변환·outputMultiplier 구멍·5비율 실태) · 브라우저 재현(원점 불일치 근본 원인 확정 — #2·#7 통합, #1·#5·#6 가설 채택, 비율 900px 실측). 사용자 결정: 접이식 패널(2안).
- Codex 반박 1차 (2026-09-02, 완료 — 조건부 4·반박 3, 수정 목록 19건 → v3 "확정 사항" 절로 전원 반영): 핵심 확정 — effect anchor 호환 근거·취소 의미 분리·8컨트롤/flip 금지·touch-safe guard·clamp/정규화 순서·비율 경계 4규칙·리샘플 순서·outputMultiplier 계약·작업 4096/내보내기 8192 이원 상한·accent-sky 재사용·핀치 중 박스 유지·기본 박스 미채택·실행 순서 P4→A3→A4→P3.
- Codex 반박 2차 (2026-09-02, 완료 — 대부분 우선 선언으로 해소 확인, 잔여 4건 → v4 확정 18~23항 반영): fabric export multiplier 스칼라 실측 수용 → 내보내기 재렌더 경로 분리(20항) / "원본 화질" 의미·8192 정책(21항) / 비율 우선순위 단일 사슬+극단 비활성(18항) / preset 핸들 잠금(19항) / multiplier 변경 지점 예외(22항) / §5 문구 실수정(23항).
- Codex 반박 3차 (2026-09-02, 완료 — 2·4 해소 확인, 잔여 4건 → v5 반영): Shift 극단을 모든 잠금 경로 규칙으로 확장(잠금 무시) / 11항이 20항 재렌더 경로를 구현 수단으로 명시 / §6 기록을 이원 체계로 정정 / §4 P3 상태 표기 정합.
- Codex 반박 4차 (2026-09-02, 완료 — 4건 전부 해소·새 모순 없음, **"이견 0·[정본화 가능]" 선언** → P4 정본 확정).
- 착수 분할: ① P4-0+P4-1+P4-5(버그 수정 묶음 — 선배포) ② P4-2(박스 편집) ③ P4-3+P4-4(크기 도구+접이식 패널). 순서: P4 → 비디오 A3 → A4 → P3.

### 브라우저 재현 기록 (2026-09-02, Codx)

#### 환경·실행 게이트·계측 방법

- 기준 해시: 계획의 Phase 3 기준 `4920453`과 재현 시점 `HEAD=d93ff06`을 대조했다. `git diff --name-status 4920453..HEAD -- src/features/image-studio src/styles/global.css tests/new-tools-smoke.mjs tests/unit/image-region-effect.test.ts`는 출력 0건이었다. 사이 변경은 비디오 A2·Word 비교·기록 이원화이며 이미지 코드 전제를 바꾸지 않는다.
- 열린 계획서: `docs/jobs/todo`의 다른 문서는 비디오 성능 계획 1개이며 명시 제외에 이미지 스튜디오를 둔다. 코드 표면·지시 충돌 없음.
- `npm run build` exit 0(2,346 modules, 정적 55페이지) 후 `npm run preview -- --host 127.0.0.1`의 `http://127.0.0.1:4173/ko/tools/image-studio`를 Chrome `152.0.7977.64`, Linux, 1440×1000, DPR 1에서 실제 조작했다. 1,800×1,200 색상/중앙표식 PNG를 로드했고 Fabric 논리 캔버스 초기값은 900×600이다. 브라우저 page error 0건.
- 스크린샷 대신 production DOM의 패널·aria·계산 스타일, lower-canvas 색/알파 픽셀 bbox·개수, React DOM이 보유한 실제 Fabric Canvas의 VPT와 객체 `left/top/origin/pathOffset/getBoundingRect()`를 함께 기록했다. 임시 재현 스크립트는 실행 중 `scratch/image-p4-browser-repro.mjs`에만 두고 기록 전사 후 제거했으며 production 코드·테스트는 수정하지 않았다.

#### 신고별 판정표

| 신고 | 재현 절차 요약 | 판정 | 초안 가설 |
|---|---|---|---|
| #1 | 펜 획 포함 자유 crop 적용 후 패널/스테이지 확인 → 같은 획을 +35,+24px 드래그 | **재현**: 패널은 crop 잔존, interaction은 select; 후속 드래그는 Path 이동 | 채택 |
| #2 | 자유 드래그 중/후 Rect 실좌표 → 5개 비율 버튼(이동·회전·flip된 base+펜, zoom 200%) → 동일 화면 구간의 zoom 조합 | **재현·원인 정정**: 자유 드래그 자체가 중앙 확장. 비율 버튼도 900px 폭+중앙 cover+이동/배율 초기화, zoom 적용 시 100% reset이 체감을 가중 | `cropTo` 단독 원인은 부분 채택, “자유 드래그는 코너 기준”은 기각 |
| #5 | 영역 없음 → 드래그 중 → mouseup 뒤 DOM·계산 스타일 비교 | **재현**: 없음/드래그 중 DOM 0, mouseup 뒤만 DOM 1·W×H 갱신. 나타난 버튼도 accent 채움 아님 | DOM 소거·mouseup 가설 채택, 현행 accent 가설 기각 |
| #6 전제 | 239×150 박스 안을 다시 65×45만큼 드래그 | **재현**: 기존 박스 이동이 아니라 64×45 새 박스로 교체, active object/minibar 없음 | 채택 |
| #7 | 변형 유무 × crop zoom 100/200% × 지우개 포함 여부 8조합 + 브러시/그리기 zoom/역방향/비율 선행 확대 | **8/8 재현**, 단 펜·지우개 객체 이동 자체는 **8/8 정상** | 증상 채택, Path/지우개/zoom 좌표계 원인 가설 기각 → crop Rect 원점 불일치로 확정 |

#### #1 — 적용 뒤 crop 패널 잔존, 실제 동작은 select

1. 펜 Path를 그리고 scene `≈(279.5,179.8)`에서 340×240 영역을 만든 뒤 `선택 영역으로 자르기`를 눌렀다.
2. 적용 전 DOM은 `data-panel=crop`, crop toolbar `aria-pressed=true`, `.fabric-stage.is-crop-mode=true`였다. 적용 후에도 `data-panel=crop`, crop `aria-pressed=true`, select `aria-pressed=false`가 그대로지만 `.is-crop-mode=false`; Fabric은 `selection=true`, Path `selectable/evented=true`였다.
3. Path 중심은 crop 전 `(449.331,299.436)` → 적용 후 `(169.837,119.599)`로 이동했다. crop 패널이 열린 상태에서 그 Path를 +35,+24 드래그하자 active object가 Path가 되고 `(204.837,143.599)`가 됐다. magenta 픽셀 bbox도 `(50,54,239×131)` → `(85,78,239×131)`로 정확히 +35,+24 이동했다.
4. **원인 판정**: `applyCropSelection`은 `setInteractionMode("select")`만 수행하고(`ImageStudioPage.tsx:497-499`) `setActivePanel("select")`은 호출하지 않는다. UI와 상호작용 모드 불일치가 실재한다.

#### #2 — “중심부터 넓어짐”의 실제 발생 지점

**① 자유 드래그가 이미 중앙 확장이다.** scene `(260,180)→(500,330)` 드래그에서 overlay 저장값은 `left=259.435, top=179.635, width=239.376, height=149.868`이고 실제 원점은 `center/center`였다. 따라서 화면 bbox는 `(138.747,103.700,241.376×151.868)`로, 시작점에서 우하단으로 그려진 것이 아니라 시작점을 중심으로 좌상단까지 절반씩 확장됐다(2px stroke 포함). 반면 mouseup의 `regionSelection`과 적용 로직이 해석하는 실제 crop은 대략 `x=259.4..498.8, y=179.6..329.5`다. **보이는 박스는 `x=138.7..380.1, y=103.7..255.6`이므로 표시와 실제 적용 영역이 서로 다르다.**

- 코드 원인: Rect 생성·갱신에서 `originX/originY`를 지정하지 않고 `left/top`을 좌상단처럼 넣는다(`ImageStudioPage.tsx:303-323`). 이 프로젝트의 Fabric 7.4 객체 기본 원점은 브라우저 실측 `center/center`다. mouseup은 그대로 `overlay.left/top/width/height`를 저장한다(`:326-332`). 따라서 “기본은 코너 기준”이라는 초안은 현행 사실로는 기각한다.

**② 비율 버튼 5종은 모두 레거시 canvas 재구성이다.** 원본 base를 `(450,300,scale=.467)`에서 `(504.829,332.071,scale=.467,angle=90°)`로 이동·회전·flip하고 zoom 200%에서 각 버튼을 눌렀다.

| 버튼 | 결과 canvas | base 결과 `(left,top,scale)` | 펜 Path 결과 `(left,top,scale)` |
|---|---:|---:|---:|
| 1:1 | 900×900 | `(450,450,.750)` | `(449.331,449.154,1)` |
| 4:3 | 900×675 | `(450,337.5,.563)` | `(449.331,336.866,1)` |
| 3:4 | 900×1200 | `(450,600,1)` | `(449.331,598.872,1)` |
| 16:9 | 900×506 | `(450,253,.500)` | `(449.331,252.525,1)` |
| 9:16 | 900×1600 | `(450,800,1.333)` | `(449.331,798.497,1)` |

- 5종 모두 canvas 폭을 900으로 강제하고 base 중심을 `(450,height/2)`로 되돌린 뒤 `max(width/image.width,height/image.height)` cover scale을 적용했다(`cropTo`, `ImageStudioPage.tsx:626-643`). 중앙 표식도 `(504,332)`에서 각각 정확한 새 canvas 중앙으로 돌아갔다. **이동·배율 초기화 가설은 채택**하되, 회전은 90°로 유지되어 “모든 변형 초기화”는 아니다.
- 추가 Path는 `left/top`만 구 canvas 대비 비례 이동하고 scale은 1, bbox 크기 `239.356×130.953`을 그대로 유지했다(`:644-647`). 즉 base cover 배율과 사용자 레이어 배율이 따로 움직인다.
- 5종 모두 zoom `200%→100%`, interaction `crop→select`로 바뀌지만 패널은 crop으로 남았다. 따라서 preset 클릭은 **canvas 치수 변경 + base 중앙 cover/이동·배율 reset + 사용자 레이어 위치만 비례 재배치 + view reset**을 한 번에 일으킨다.

**③ zoom 조합.** zoom 200% VPT는 `[2,0,0,2,-450,-300]`이었다. 같은 화면 폭/높이의 35%→65% 구간을 드래그하면 scene 선택은 135×90px였고 적용 뒤 canvas 135×90, VPT identity/100%가 됐다. zoom만 바꿀 때는 content 좌표가 바뀌지 않지만, crop/preset 적용 순간의 100% reset이 화면 확대가 풀리는 체감을 더한다.

**종합 판정:** 사용자가 말한 “중심부터 넓어짐”의 직접 원인은 ① 자유 crop Rect의 `center/center` 원점 불일치다. ② preset은 별도로 실제 콘텐츠를 중앙 cover로 재배치하고, ③ 200% 조합은 완료 시 100% reset까지 겹친다. 초안의 `cropTo` 폐기 근거는 유효하지만 단독 원인으로 쓰면 불완전하다.

#### #5 — 버튼 외관과 W×H 갱신 시점

- crop 패널 진입 직후와 mouse button을 누른 채 239×150px까지 이동한 동안 `[data-testid=image-editor-crop-selection]`은 모두 DOM 0개였다. mouseup 직후에만 DOM 1개가 생기고 `선택 영역 239 × 150px`가 표시됐다. 따라서 W×H는 `mouse:move`가 아니라 `mouse:up`의 `setRegionSelection()`에서만 갱신된다.
- 영역 없음 상태에는 버튼 자체가 없어 비활성 외관·사유 tooltip도 없다. 영역 있음 상태의 적용 버튼은 enabled, `.primary-button`, 206×36px, opacity 1이었지만 accent modifier가 없었다. 계산 스타일은 배경 `rgb(239,239,239)`, 글자/테두리 `rgb(255,255,255)`, `background-image:none`이었다. `ImageEditorPanel.tsx:195-197`이 기본 클래스만 주고, `global.css:763-768`의 색 배경은 `accent-*` modifier에만 있으므로 **현행 활성 버튼은 액센트 채움이 아니고 대비도 매우 약하다.** P4-5의 활성/비활성 사양은 현행 설명이 아니라 필요한 개선으로 유지한다.

#### #6 — 박스는 그은 뒤 조작 불가

- 첫 239×150 박스 안의 scene `(340,230)→(405,275)`를 드래그하자 기존 박스 이동/리사이즈가 아니라 `64×45px` 새 박스로 즉시 교체됐다. 새 Rect도 `selectable=false`, `evented=false`, `origin=center/center`; active object는 `null`, 미니바/핸들은 없었다.
- 화면 bbox는 `(306.578,205.563,66.190×47.434)`이고 저장값은 `(left=339.673,top=229.280,width=64.190,height=45.434)`였다. 기존 박스를 잡는 분기 없이 모든 `mouse:down`이 `clearRegionSelection()` 후 새 Rect를 만드는 현행 코드(`ImageStudioPage.tsx:303-314`)와 일치한다.

#### #7 — 8조합 재현과 코드 수준 원인 확정

**재현 배치:** 화면에 그려진 파란 박스 안이지만 실제 저장 crop의 왼쪽 밖인 scene x≈224..259에 magenta 펜 획을 뒀다. 변형 있음은 펜 뒤 base를 `(450,300)→(504.829,332.071)` 이동하고 90° 회전+좌우 flip한 상태다. 지우개 포함은 `globalCompositeOperation=destination-out` Path를 펜 위에 추가했다. crop은 scene `(280,180)→(620,420)`이며 100%에서 저장 `(279.495,179.837,339.673×239.198)`/화면 bbox `(108.658,59.238,341.673×241.198)`, 200%에서 저장 `(279.829,179.785,339.673×239.866)`/화면 bbox `(108.993,58.852,341.673×241.866)`였다.

| base 변형 | crop zoom | 지우개 | 펜 픽셀 적용 전→후 | 펜/지우개 좌표 이동 | 증상 |
|---|---:|---:|---:|---|---|
| 없음 | 100% | 없음 | 1,795→0 | `(-279.495,-179.837)`, 오차 0 | 재현 |
| 없음 | 100% | 있음 | 787→0 | 둘 다 같은 Δ, 최대 오차 .001px | 재현 |
| 없음 | 200% | 없음 | 1,795→0 | `(-279.829,-179.785)`, 오차 0 | 재현 |
| 없음 | 200% | 있음 | 787→0 | 둘 다 같은 Δ, 최대 오차 .001px | 재현 |
| 이동+회전+flip | 100% | 없음 | 1,837→0 | `(-279.495,-179.837)`, 오차 0 | 재현 |
| 이동+회전+flip | 100% | 있음 | 810→0 | 둘 다 같은 Δ, 최대 오차 .001px | 재현 |
| 이동+회전+flip | 200% | 없음 | 1,837→0 | `(-279.829,-179.785)`, 오차 0 | 재현 |
| 이동+회전+flip | 200% | 있음 | 810→0 | 둘 다 같은 Δ, 최대 오차 .001px | 재현 |

- 대표 케이스(변형+200%+지우개): 일반 Path 중심 `(241.392,246.652)`/bbox `(224.027,199.216,34.730×94.873)`가 적용 후 `(-38.437,66.867)`/bbox `(-55.802,19.431,34.730×94.873)`가 됐다. 지우개도 `(242.051,247.989)` → `(-37.779,68.204)`로 같은 Δ를 받았다. 두 Path 모두 내부 `pathOffset`은 각각 `(241.392,246.652)`·`(242.051,247.989)`로 불변이다.
- **대조군:** 실제 저장 crop 내부에 둔 펜+지우개는 같은 변형+200%에서 일반/지우개 Path 모두 정확히 `(-279.829,-179.785)` 이동했고 bbox 크기가 유지됐다. 펜 픽셀 2,504→2,492, 지우개 투명 픽셀 7,645→7,665로 화면에도 남았다.
- 확대 탐색도 동일: 붓으로 200%에서 그림+역방향 200% crop(2,615→0), 펜을 200%에서 그리고 100% crop(1,781→0), base 변형을 먼저 하고 붓+지우개(2,640→0), 4:3 preset 뒤 펜+지우개+200% 자유 crop(786→0). 전부 객체 좌표 이동은 오차 ≤.001px로 정상이고 화면상 박스 안 획만 사라졌다.

**원인 확정:** `applyCropSelection`의 모든 객체 일괄 이동(`ImageStudioPage.tsx:489-492`)은 정상이다. Path의 중앙 원점/내부 획 좌표(`pathOffset`)도 translation에 장애가 아니며, 지우개 Path도 객체 배열에 들어 있어 같은 이동을 받는다. zoom 200% 역시 `scenePoint` 역변환 뒤 동일 좌표가 저장되어 원인이 아니다. **실제 결함은 #2와 같은 crop overlay Rect 원점 불일치**다. 사용자는 화면 bbox의 왼쪽/위쪽에 든 획을 “선택 안”으로 보지만, 적용은 `overlay.left/top`을 좌상단으로 삼은 오른쪽/아래쪽 영역을 사용한다. 그 결과 획은 정확히 이동한 뒤 음수 좌표로 가서 새 canvas에 clip되며 “낙서가 따라오지 않은” 것으로 보인다. P4-6은 독립 Path 재배치 버그가 아니라 P4-2의 overlay geometry 버그와 같은 근원으로 합쳐야 한다.

## 5. 명시 제외

- 편집(단일 편집) 탭 외 탭(배치·콜라주·GIF 등)의 워크플로 변경 / 효과·필터 알고리즘 변경 / 전문 편집 기능 / 광고 배치 위치 변경. (그리기 도구는 Phase 1에서 편집 탭 draw 패널로 통합됨 — 별도 탭 아님.)

## 6. 검증·완료 기준

- 명령: `npm run build` · `npm run test:unit` · `TEST_ONLY_IMAGE=1 npm run test:new-tools` · `npm run test:utilities` · `npm run test:static` (Codex 실측 확정).
- **DOM 의존 테스트 갱신 목록(개편과 동시)**: `new-tools-smoke.mjs:178-389`의 `.image-editor-controls`·`.shape-style-controls`·`.region-effect-options`·`.editor-draw-tools`·overlay export·history 셀렉터, `utility-tools-smoke.mjs:233`의 `nth-child(2)` — 안정적 aria-label/data-testid 기반으로 교체.
- 신규: I2 회귀 매트릭스 전체 / 모바일 390×844 하단 시트 테스트(현 이미지 스모크는 데스크톱 DPR2 전용 — 신설) / 도형 7종·스티커 스모크.
- 문서·메타: 신규 문구 ko/en(`features.json`) + `seo.ts:202-205`·`tools.json`·가이드·정적 페이지 영향 검토 + **이원 기록 체계(「작업 기록」 규칙)**: 코드 변경은 `CHANGELOG.md` 간결 기록, 판정·기각 사유·실측은 `docs/review-notes.md`.

## 7. 반박 기록

### Gemini 보충 (2026-09-02, 완료 — 검증 후 반영)
- 줌·팬 1순위 승격 / 미니바 > 레이어 패널 / AdSense 뷰포트 고정 기각 / 이모지 SVG 에셋화 / 핀치줌 분리 — 수용. 터치 타깃 결함 주장은 부분 정정(모바일 44px 보정 기존재).

### Codex 1차 (2026-09-02, 완료 — 수정 목록 13건 전원 수용, 판정 "재왕복 필요" → v2 반영)
- 핵심 수용: interactionMode/activePanel 분리·패널 매핑(I1) / view-only VPT·export identity 보장·강도 계약 유지·터치 중재(I2 — 최대 위험 지점 명세화) / base+effect 원자 블록(I3) / 신규 도형 타입·스타일 판정 확장(I4) / 이모지 후보 미확정 처리·별도 벤더 스크립트·정적 import 금지(I5) / 정확한 검증 명령·셀렉터 갱신 목록·모바일 테스트 신설·SEO/CHANGELOG 반영(§6).

### Codex 2차 (2026-09-02, 완료 — 13건 중 10건 해소 확인, 잔여 이견 3건 → v3 반영)
- 잔여 반영: ① `interactionMode`를 현행 EditorMode 전체로 유지 + draw 패널 서브도구(연필/붓/지우개) 보존 계약(I1) ② view reset 우선순위 — 치수 변경 여부가 판정 기준(치수 바꾸는 undo/redo는 reset, 불변이면 유지)(I2) ③ 도형별 Fabric 타입·적용 스타일 행렬 + 비적용 속성 무시·스모크 기대값(I4).

### Codex 3차 (2026-09-02, 완료 — I1·I2 해소 확인, I4 화살표 두께 계약 1건 잔여 → v4 반영)
- 반영: 화살표 `strokeWidth`를 외곽선 폭 의미로 한정(전 도형 통일), 몸통 폭은 고정 기하 + 스케일 핸들 조절(동적 기하 파라미터는 v1 범위 밖·후속 설계 경로 명시), 스모크에 "strokeWidth 변경 시 기하 불변" 단언 추가.

### Codex 4차 (2026-09-02, 완료 — 화살표 계약 해소 확인·새 모순 없음, Fabric 7.4 런타임 프로브(strokeWidth 2→10 시 points·width·height 불변, scaleY가 표시 폭 변경)로 정합 검증, **"[정본화 가능] 이견 0" 선언** → 정본 확정)
- 착수 순서: 비디오 1단계 → 엑셀 → 이미지(코드 단일 작성자 직렬화). Phase 1(I1~I3)·Phase 2(I4~I5)는 별도 커밋 묶음.

## 실행 게이트 기록 (2026-09-02, Codx)

- 기준 해시 게이트: 현행 `HEAD`는 `3bd76f1c3e4ba46c694f313d589285f7b7524f7f`이며 기준 `b98efde` 이후 비디오 VP9·역할 문서·Excel 시트 그리드 3커밋이다. `git diff b98efde..HEAD -- src/styles/global.css`에서 Excel 전용 selector와 `.accent-context-green .workflow-main`만 바뀌고 이미지 편집기 selector 변경은 0건임을 확인했다.
- 기능 전제 실측(Chrome headless): 1440×900에서 `.image-editor-layout`은 `230px 739px`, 도구 그룹 8개, 논리 캔버스 900×600 대비 CSS 표시 713×475였다. 821px에서는 `230px 232px`, 820px에서는 단일 740px 열로 전환되어 820px 붕괴점이 유지됐다. 390×844(DPR 2)에서는 문서 `scrollWidth=390`, 캔버스 논리 backing 1800×1200 대비 CSS 312×208로 CSS-only fit이 유지됐고 history/icon 버튼은 모두 44×44px였다. 따라서 230px·8그룹·820px·44px·CSS-only fit 전제는 깨지지 않았다.
- 열린 계획서 충돌 검사: `docs/jobs/todo`의 다른 정본은 Excel 시트 그리드와 비디오 성능 계획이다. Excel 구현은 이미 종결되어 `ExcelMergerPage`·Excel selector CSS·browser smoke만 변경했고, 비디오 계획은 video-studio 코드·런타임·video smoke가 대상이다. 공용 테스트 파일을 사용하더라도 이미지 I1+I3의 상태·패널·미니바 계약과 상반된 지시는 없어 충돌 없음으로 판정했다.

## I1+I3 구현·검증 기록 (2026-09-02, Codx)

- 구현: `interactionMode`(기존 6모드)와 `activePanel`(8패널)을 분리하고 툴바·패널·미니바를 별도 컴포넌트로 만들었다. draw 서브도구/색/굵기 재진입 복원, 삽입 뒤 패널 유지, effect 조정 동거, canvas 배경·정리 매핑, 객체 종류별 select 스타일을 반영했다.
- 레이아웃·미니바: 데스크톱 우측 패널/모바일 하단 시트, sticky 캔버스, 44px 모바일 타깃을 적용했다. 미니바는 CSS 배율로 선택 경계를 매핑하고 selection/move/scale/rotate/skew/modified/ResizeObserver에서 갱신한다. base 맨 앞/맨 뒤는 기존 `mutateActive`+`keepRegionEffectsAboveBase()`를 재사용했고 base 복제·삭제 disabled와 effect 비선택을 유지했다. VPT·줌·팬(I2) 코드는 추가하지 않았다.
- 동반 검토: 신규 ko/en 문구와 aria/data-testid 셀렉터, 390×844 스모크를 반영했다. `src/app/seo.ts`·ko/en `tools.json`·이미지 가이드는 현 기능 설명이 정확해 변경 불필요, 정적 페이지·AdSense 배치·격리 경로 영향 없음으로 판단했다.
- `npm run build` → exit 0, 2,340 modules transformed, 55 localized crawlable pages generated.
- `npm run test:unit` → exit 0, 58 tests / 58 pass / 0 fail.
- `TEST_ONLY_IMAGE=1 npm run test:new-tools` → exit 0. 고해상도/DPR 내보내기, 블러 fallback, 효과 undo/redo·원자 레이어, overlay export 제외, crop, 390×844 하단 시트·draw 복원·미니바 추종 통과.
- `npm run test:utilities` → exit 0, Korean/English routes·hreflang·utility/image draw history·video compatibility·PDF range 통과.
- `npm run test:static` → exit 0, localized pages·hreflang·self-hosted runtimes·ads.txt·robots.txt·sitemap.xml 통과. `git diff --check`도 exit 0.

## I5 upstream 스파이크 기록 (2026-09-02, Codx)

- 비교 스냅샷: `git ls-remote`로 Twemoji 최신 태그 `v17.0.3` = `b6b55fef1e8636b540a6d016a4729ca8cdf2e60b`, Noto Emoji 최신 2.x 태그 `v2.051`의 peeled commit = `8998f5dd683424a73e2314a8c1f1e359c19e8742`를 확인하고 두 commit의 GitHub codeload archive를 `/tmp`에 받아 측정했다. archive는 각각 5,924,838 bytes(SHA-256 `705d79de1460e5e775f362f0d0f01fbe3ef8d65bf4648c490e4649704584f747`)와 210,342,539 bytes(`22b9de1e4f01876f876aee12fde409b2b1ef1731ae05b40730221947b23506c9`)였다.
- 라이선스 원문: Twemoji SVG 경로 `assets/svg/*.svg`에는 저장소 루트 `LICENSE-GRAPHICS`의 CC BY 4.0이 적용되며 원문은 18,524 bytes/SHA-256 `8ae9438818c26e4873b91d8c6ad620526c011e27e125677f13031eda903f007c`였다. Noto의 `svg/*.svg`에는 경로별 `svg/LICENSE`의 Apache-2.0이 적용되며 원문은 574 bytes/SHA-256 `611ceab36dae96644ca84e8ace6873821790192bf6f73b0d0624a21b24b4b332`였다. Noto 루트 `LICENSE`의 OFL과 SVG 경로 라이선스를 혼용하지 않았다.
- SVG 전량 실측(`find ... -name '*.svg'`, 원시 파일 크기 합, 각 파일을 `gzip -9 -c`한 개별 응답 기준 합): Twemoji 4,009 files / 10,121,593 raw bytes / 4,475,637 gzip bytes(평균 2,524.7 / 1,116.4 bytes), Noto 3,731 files / 32,128,362 raw bytes / 11,225,395 gzip bytes(평균 8,611.2 / 3,008.7 bytes). Twemoji가 Noto보다 원시 합계 68.50%, gzip 합계 60.13% 작다.
- 후보·상한 판정: **Twemoji v17.0.3 채택**, Noto는 같은 범위에서 3.17배의 원시 크기와 2.51배의 gzip 크기 때문에 기각한다. 큐레이션 상한은 **120종**으로 고정한다. Twemoji 전량 평균 기준 상한 비용은 약 302,966 raw bytes / 133,968 gzip bytes이고, SVG는 개별 정적 URL로만 요청하므로 실제 세션 전송은 사용자가 본 썸네일·삽입 자산에 한정한다. 초기 manifest의 실제 파일 합계와 이미지 스튜디오 lazy chunk 변화는 구현 뒤 별도로 측정한다.

## I4+I5 구현·실측 기록 (2026-09-02, Codx)

- I4: 둥근 사각형 `Rect`, 삼각형 `Triangle`, 별·육각형·단/양방향 화살표 `Polygon`, 말풍선 단일 `Path`, 형광펜 `Rect`를 추가했다. 모두 단일 객체이며 `Group`은 0건이다. 직렬화되는 `worklazyShapeKind`로 말풍선 Path와 자유 그리기를 구분하고 스타일 행렬을 적용했다. 형광펜은 fill만 적용되고 stroke/strokeWidth는 무시되며 opacity 0.45가 JSON에 남는다. 단/양방향 화살표는 strokeWidth 4→18 뒤에도 points·width·height 서명이 동일했다.
- I5: 상한 120종 중 표정·손짓·동물·음식·자연·활동·기호 각 16개, 총 112종을 manifest에 고정했다. 실제 SVG 합계는 142,436 raw bytes, 각 파일 `gzip -9 -c` 합은 71,573 bytes이고 manifest 자체는 31,902 bytes다. 별도 벤더 스크립트가 8개씩 내려받아 고정 commit·크기·SHA-256과 CC BY 4.0 원문을 검증한 뒤 `public/vendor/emoji/17.0.3`을 생성하며 dev/prebuild·라이선스 생성·dist 검증에 연결했다.
- 로딩·번들: UI는 manifest만 번들에 포함하고 SVG는 `/vendor/emoji/17.0.3/<codepoint>.svg` 개별 URL로 사용한다. Phase 2 전 production 빌드의 Image Studio lazy chunk 356.23KB/109.76KB gzip에서 384.87KB/120.86KB gzip으로 각각 +28.64KB/+11.10KB 증가했다. SVG 본문은 chunk에 정적 import하지 않았다.
- UI·동반 검토: 7카테고리·ko/en 이름 검색·검색 결과 없음·로드 실패·라이선스 표기, 선택 시 `FabricImage` 삽입과 내보내기를 구현했다. 기존 텍스트 칸의 임의 이모지 `IText` 경로는 유지했다. ko/en 기능 문구·가이드·도구 highlights·SEO featureList를 갱신했다. 기능 URL·광고 위치·광고 격리 경로는 바뀌지 않아 정적 페이지 구조와 AdSense 코드는 변경하지 않았다.

## P4 착수 1묶음 실행 게이트 기록 (2026-09-02, Codx)

- 기준 해시 게이트: 착수 시 현행 `HEAD=d93ff06`으로 P4 기준 해시 `d93ff06`과 정확히 일치했다. Word 커밋 `509c61a` 이후 기록 이원화 커밋 `d93ff06`만 추가된 상태이며, `git diff --name-status d93ff06..HEAD -- src/features/image-studio src/styles/global.css tests/new-tools-smoke.mjs tests/unit/image-region-effect.test.ts` 출력은 0건이었다. 따라서 P4 브라우저 재현의 이미지 코드·스타일·스모크 전제가 그대로 유지됐다.
- 열린 계획서 충돌 검사: `docs/jobs/todo`의 다른 열린 문서는 `video-studio-performance-plan-20260902.md` 1개이며 명시 제외에 "오디오·이미지 스튜디오 등 타 도구 코드"를 둔다. P4-0·P4-1·P4-5 대상 표면과 상반된 지시가 없어 충돌 없음으로 판정했다.
- 워킹트리 보호: 착수 전 추적 파일 변경은 0건이고 미추적 `*.MP4` 3개·`before.docx`·`after.docx`만 존재했다. 모두 작업 범위 밖 사용자 파일로 보존하며 스테이징·커밋 대상에서 제외한다.

## P4 착수 2묶음 실행 게이트 기록 (2026-09-02, Codx)

- 기준 해시 게이트: 착수 시 현행 `HEAD=385a88dd63ff6326f67ddef8064443fc2e6147af`로 사용자 지정 2묶음 기준 `385a88d`와 정확히 일치했다. `git show --stat 385a88d`에서 1묶음(P4-0/1/5)의 코드·ko/en 문구·스타일·스모크·이원 기록 8개 파일 변경을 확인했고, 추적 파일의 후속 변경은 0건이었다. 따라서 분리된 crop/effect 소유권과 overlay 원점·라벨·상태 계약을 P4-2의 새 전제로 채택한다.
- 열린 계획서 충돌 검사: `docs/jobs/todo`의 다른 열린 문서는 `video-studio-performance-plan-20260902.md` 1개이며 §4에서 “오디오·이미지 스튜디오 등 타 도구 코드”를 명시 제외한다. P4-2 대상 표면과 상반된 지시가 없어 충돌 없음으로 판정했다.
- 워킹트리 보호: 착수 전 추적 파일 변경은 0건이고 미추적 `*.MP4` 3개·`before.docx`·`after.docx`만 존재했다. 모두 작업 범위 밖 사용자 파일로 보존하며 스테이징·커밋 대상에서 제외한다.

## P4 착수 3묶음 실행 게이트 기록 (2026-09-02, Codx)

- 기준 해시 게이트: 착수 시 현행 `HEAD=c9458e3f2840274deb0d394c22d2b0e71a5022c0`로 사용자 지정 3묶음 기준 `c9458e3`과 정확히 일치했다. `git show --stat 385a88d`와 `git show --stat c9458e3`에서 각각 1묶음(P4-0/1/5)과 2묶음(P4-2)의 코드·ko/en 문구·스타일·스모크·이원 기록 변경을 확인했고, 추적 파일의 후속 변경은 0건이었다. 따라서 분리된 crop/effect overlay와 편집 가능한 crop 박스·비율 preset 계약을 P4-3/P4-4의 새 전제로 채택한다.
- 열린 계획서 충돌 검사: `docs/jobs/todo`의 다른 열린 문서는 `video-studio-performance-plan-20260902.md` 1개이며 §4에서 “오디오·이미지 스튜디오 등 타 도구 코드”를 명시 제외한다. P4-3/P4-4 대상 표면과 상반된 지시가 없어 충돌 없음으로 판정했다.
- 워킹트리 보호: 착수 전 추적 파일 변경은 0건이고 미추적 `*.MP4` 3개·`before.docx`·`after.docx`만 존재했다. 모두 작업 범위 밖 사용자 파일로 보존하며 스테이징·커밋 대상에서 제외한다.

## P4 착수 3묶음 구현·검증 기록 (2026-09-02, Codx)

- P4-3: `EditorPanelName`에 P3 `layers` 누적 전제 주석과 함께 `size`를 추가했다. 전 일반 객체의 기존 행렬 앞에 전역 scale을 합성하는 리샘플, region-effect 제외 후 base anchor 재동기, 중앙 translation 캔버스 변경, 치수 view reset·undo/redo, 4096px 작업 상한을 구현했다. `outputMultiplier`는 스냅샷과 restore에 포함하고 파일 로드·빈 캔버스 초기화를 유지했다. 내보내기는 원본 화질 multiplier 경로(8192px 자동 축소+결과 안내)와 VPT identity 1× 결과를 지정 목적지에 균일/스트레치 재렌더하는 경로(8192px 상한)로 분리했다.
- P4-4: 툴바 우측 ko/en·aria 토글, `sessionStorage` 기억, 접힘 풀폭 grid와 기존 ResizeObserver fit·미니바 재계산을 구현했다. 820px 이하에서는 저장된 접힘을 무시하고 하단 시트를 표시하며 토글을 비활성화했다. sticky 캔버스·광고 위치·격리 경로는 바꾸지 않았다.
- 브라우저 실측: 900×600→1200×720 비균일 리샘플에서 회전 도형/base 전역 합성 행렬과 region-effect anchor 행렬 일치, 1200×720→400×300 중앙 이동 `dx=-400,dy=-210`·잘린 객체 수 보존, 치수 undo/redo 100% reset, 스냅샷 multiplier 복원을 확인했다. 지정 출력 600×400 잠금/600×600 스트레치와 200% VPT byte-identical 결과, 작업 4096·출력 8192 상한을 확인했다. 접힘은 821·1020·1440px fit/미니바, reload 기억, 820·390px 시트 강제 표시, ko/en 라벨을 통과했다.
- 검증: `npm run build` exit 0(2,346 modules, Image Studio 402.23KB/125.51KB gzip, 정적 55페이지), `npm run test:unit` exit 0(65/65), `TEST_ONLY_IMAGE=1 npm run test:new-tools` exit 0(P4 전 묶음+DPR/effect), `npm run test:utilities` exit 0, `npm run test:static` exit 0. `git diff --check`도 exit 0.
- 배포: `4f85e58 Add image sizing and collapsible editor panel`을 `main`에 push했다. `HEAD`·`origin/main`·`git ls-remote origin refs/heads/main`이 모두 `4f85e58c67a1efde91c7c9a5586763f88aed6526`으로 일치했다. P4 1~3묶음 전체 구현 완료.

## P3 실행 게이트 기록 (2026-09-03, Codx)

- 기준 해시 게이트: 사용자가 지정한 현행 `HEAD=0d643b329749c0732a8fcec4f98345b0ba3f74f5`를 확인했고 `origin/main`도 같은 `0d643b3`이다. P3 기준 `4920453` 이후 이미지 표면에는 Phase 1·2 완료분과 P4 `385a88d`·`c9458e3`·`4f85e58`만 반영됐고, 그 뒤 A3·A4 커밋은 비디오 코드와 ko/en 비디오 문구·스모크만 바뀌었다. 따라서 P4→A3→A4→P3 순서와 새 P4 전제를 그대로 채택한다.
- 열린 계획서 충돌 검사: `docs/jobs/todo`에는 본 문서와 비디오 성능 계획서 1건만 있다. 비디오 계획은 이미지 스튜디오를 명시 제외하고, 공유 `features.json`·`new-tools-smoke.mjs`에도 비디오 A4 추가만 있어 P3 레이어·선택·우클릭 계약과 상반되는 지시가 없다. 추적 수정은 0건이고 미추적 MP4 3개·DOCX 2개는 사용자 파일로 보존하며 명시 스테이징에서 제외한다.
- P4↔P3 입력 소유권 재확인: P4의 `mouse:down`은 `crop|effect` 모드에서만 영역 드래그를 시작하고 touch-safe `isNonPrimaryMouseEvent`로 마우스 왼클릭만 통과시킨다. crop 박스 자체가 target이면 즉시 반환해 Fabric 이동·핸들 transform이 소유하고, 두 모드에서 `instance.selection=false`이다. P3 러버밴드는 `select`만으로 제한하고 Space pan이 활성이면 Fabric 선택을 먼저 취소하므로 **Space 팬 > crop/effect 상자 드래그·transform > select 러버밴드** 순서를 유지할 수 있다. 우클릭은 P4 상자 생성을 유발하지 않고 P3 `contextmenu`에서만 억제·대상 판정하도록 한다.
- 게이트 판정: 충돌 없음. P4의 분리 overlay·crop 박스 이벤트 소유권·접이식 패널을 보존하며 `0d643b3`에서 P3-0~P3-3 전체를 착수한다.

## P3 구현 완료 기록 (2026-09-03, Codx)

- 상태: **구현 완료 (`9dce527 Add layer panel with multi-select and context menu`)**. P3-0 공통 block clamp와 base 미니바 보호, P3-1 layers 패널·표시/삭제/재정렬·복원 invariant, P3-2 데스크톱 base-free 다중 선택·6정렬·개별 clone, P3-3 Fabric contextmenu 대상 정책과 닫힘 조건을 전부 반영했다.
- 검증: `npm run build`(2,351 modules, 정적 55페이지), `npm run test:unit`(82/82), `TEST_ONLY_IMAGE=1 npm run test:new-tools`(P3+기존 P4 전체·390×844 layers 시트), `npm run test:utilities`, `npm run test:static`, `git diff --check` 모두 exit 0.
- 배포 동기화: `main` push 뒤 `HEAD`·`origin/main`·`git ls-remote origin refs/heads/main`이 모두 `9dce5270ddf7eacc3bbf47e76cf0089b7661f7f7`로 일치했다. 사용자 MP4 3개·DOCX 2개는 미추적 상태로 보존했다.
