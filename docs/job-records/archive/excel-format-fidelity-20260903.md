# 작업지시서 — Excel 병합 서식 충실도 2건 (2026-09-03)

**상태: 구현 완료 (`162207a`, 2026-09-03)**
기준 해시: 착수 시 재확인(현행 5bf9dba 이후). 근거: 2026-09-03 원인 분석(확정 2건 — `docs/review-notes.md`·분석 태스크 보고).
재현 파일: `dummyfortest/`(CI 참조 금지). **명시 제외: 복구 프롬프트(신고 ③) — 미재현·사용자 파일 대기, ZetaOffice·CDATA 유래는 배제 확정됨.**

## E-A. 보존 모드에서 위장 XML .xls의 서식 보존 (신고 ① — 확정 원인 수정)

- 원인(확정): F1 시그니처 라우팅이 SpreadsheetML .xls를 보존 모드에서도 ZetaOffice 변환 제외 → SheetJS 값 경로 → 서식 부재.
- 수정: **보존 모드(xls-preserve route)에 한해** legacy 변환 대상을 "OLE .xls **또는** SpreadsheetML 시그니처 .xls"로 확장(일반 모드는 현행 유지 — 값 경로). 로컬 ZetaOffice가 이 XML들을 열고 변환함은 F0에서 실증됨.
- **폴백 필수**: 과거 production convert-failed 이력(원인 미재현)이 있으므로, 변환 실패 시 기존 F2 파일별 격리를 타되 **배치를 죽이지 않고 해당 파일만 SheetJS 값 경로로 강등 + "이 파일은 서식 없이 병합됩니다" 개별 안내(ko/en)**.
- 검증: 보존 모드에서 AC285 2파일 병합 결과에 원본 서식(채움·글꼴 등) 존재 확인, 변환 실패 주입 시 강등·안내·배치 생존, 일반 모드 현행 동작 불변, 기존 xls-preserve·첫 진입 스모크 회귀.

## E-B. 테마 참조 색 RGB 베이크 (신고 ② — 확정 원인 수정)

- 원인(확정): 셀 스타일의 theme+tint 참조는 복사되나 원본 theme1.xml은 미복사 → ExcelJS 내장 2007 테마로 재해석(실측: accent4 FFC000→8064A2).
- 수정: **테마 복사가 아니라 RGB 베이크 채택** — 다중 파일 병합은 파일마다 테마가 달라 출력 테마 하나로는 원리적으로 해결 불가. 병합 워커가 **입력 파일별 theme1.xml을 파싱**해, 스타일 복사 시 theme 참조 색(fill fg/bg·font·border)을 **해당 입력의 테마 기준 RGB로 해석해 기록**.
- tint 산식: ECMA-376 규정(양수 tint = 밝게 — HLS 휘도 보정) 정확 구현 + 단위 테스트(A1 케이스: accent4 FFC000 + tint 0.79998… → 기대 RGB 산출값 명시). indexed 색·`indexed="64"` 특수값·auto는 현행 유지.
- ExcelJS 읽기 표면: `fill.fgColor.theme/tint` 등 theme 정보 노출 여부를 실측한다. **미노출 항목은 해당 속성의 베이크를 생략**(현행 동작 유지 — styles.xml 직접 파싱은 하지 않음, 확정 7항과 일치).
- 검증: (회신필요) A1이 출력에서 **원본 표시색과 동일 RGB**(연노랑 계열)로 기록됨 — 원본을 Excel 계산식으로 해석한 기대값과 대조. 테마 6종×tint 3단계 합성 fixture, 서로 다른 테마 2파일 혼합 병합, 기존 스타일 회귀(비테마 RGB·indexed 불변).

## 공통

- 검증 명령: `npm run build` · `npm run test:unit` · `TEST_SCOPE=excel npm run test:browser` · `npm run test:xls-preserve` · `npm run test:static`.
- 기록 이원 체계(CHANGELOG 간결/review-notes 판정·실측). SEO·정적 페이지 영향 없음 판단 기록. 신규 문구 ko/en.

## v2 확정 사항 (1차 왕복 9건 — 우선 계약)

1. **공용 SpreadsheetML 판별기(2차 정정)**: 시그니처 판별은 **이미 양 모드 공용**이다(F1의 OLE/XML 판정·F5의 CDATA 경로가 일반 모드에서도 사용) — 공용 헬퍼로 정리하되 호출 제거 아님. **보존 모드 한정인 것은 "legacy 변환 대상 포함 판정"뿐**: 보존 route에서만 `OLE ∨ SpreadsheetML`이 변환 대상이 되고, 일반 모드의 SpreadsheetML은 현행대로 SheetJS 값 경로(변환 비대상).
2. **강등 상태 분리**: 기존 F2 오류 상태와 별개로 `degradedLegacy`(서식 없이 값 병합됨) 상태 신설 — UI는 오류가 아니라 **경고 배지+개별 안내**("이 파일은 서식 없이 병합됩니다" ko/en), ready 조건에 포함(병합 진행 가능).
3. **폴백 범위 분리**: ① 개별 변환 명령 실패(convert-failed 등) → 해당 파일만 SheetJS 값 경로 강등(2항 상태) ② 런타임 기동 실패(격리·자산·타임아웃) → 현행대로 해당 추가 배치 전체 중단(기존 계약 유지).
4. **SheetJS 실패 계약**: 강등 후 SheetJS(CDATA 전개 포함)도 실패하면 현행 F1 폴백(XLSX 재저장 안내, 파일별 격리). 값 경로의 계약 명시: SpreadsheetML 강등 병합은 **값만**(수식 미보존 — 안내 문구에 포함).
5. **팔레트 자료구조**: 입력 파일 id→테마 팔레트(dk1·lt1·dk2·lt2·accent1~6·hlink 등 색 배열) 맵을 검사 단계에서 구축·워커 페이로드에 동승. **theme1.xml 누락/손상 시 해당 파일은 베이크 생략(현행 동작 = 테마 참조 그대로)** — 오류 아님.
6. **tint 산식·기대값**: ECMA-376 tint(양수 = lum 밝게: `lum' = lum·(1−tint)+tint`, HSL 경유) 구현 + 반올림은 채널별 최근접 정수·[0,255] 클램프. **A1 기대값 `#FFF2CC`**(accent4 FFC000 + tint 0.79998…)를 단위 테스트에 고정.
7. **파싱 범위 한정**: ZIP 직접 파싱은 **theme1.xml만**. 스타일의 theme/tint는 ExcelJS 노출 표면(fill·font·border) 사용 — styles.xml 직접 파싱 제외.
8. **명시 제외 확장**: gradient fill·rich text 부분 색(run 단위)·DXF(조건부 서식) 색·차트/도형/그림 색 — 베이크 대상 아님(솔리드 fill·font·border 단색 참조만).
9. **검증 추가**: `npm run test:xls-first-load` 포함, 강등 3분기(개별 변환 실패/런타임 기동 실패/SheetJS 실패) 각각 스모크, 출력 styles.xml 정합(xmllint), 스타일 다량 파일 성능 회귀(병합 시간 상한 없는 악화 금지 — before/after 측정 기록).

## 반박 기록
### Codex 1차 (2026-09-03, 완료 — 수정 목록 9건 전원 수용 → v2 확정 사항으로 반영. 판정 "재왕복 필요")
### Codex 2차 (2026-09-03, 완료 — 8건 해소, 1건(판별기 표면 모순) → v3 정정)
### Codex 3차 (2026-09-03, 완료 — 판별기 문구 해소, 신규 1건(:19↔확정7 상충) → v4 본문 직접 정정)
### Codex 4차 (2026-09-03, 완료 — 전문 무모순, **"[정본화 가능] 이견 0" 선언** → 정본 확정. 즉시 착수).

## 실행 기록

### 실행 게이트 (Codx, 2026-09-03)

- 기준 해시: `HEAD=5bf9dba309f9a10b3cdbd721e29fbd491b35c813`, `origin/main=5bf9dba309f9a10b3cdbd721e29fbd491b35c813`로 정본 전제와 일치.
- 열린 계획서: 본 정본 외 `video-followup-20260903.md` 1건은 초안 v5·왕복 중이며 비디오 라우팅/오디오 표면만 다룬다. Excel 병합 코드·테스트·문구 표면과 상반 지시 없음.
- 기존 워킹트리: `docs/backlog.md` 수정 및 MP4 3개·DOCX 2개 미추적 파일은 선행/타 작업 소유로 보존하고, 본 작업 스테이징에서 명시적으로 제외.
- 판정: 기준 해시 게이트 및 열린 계획서 충돌 검사 통과. E-A+E-B 착수 가능.

### 구현·검증 완료 (Codx, 2026-09-03)

- E-A: 보존 화면의 OLE∨SpreadsheetML 변환, `degradedLegacy` 경고/값 전용 강등, 기동 실패 배치 중단, 값 읽기 실패 XLSX 재저장 안내 구현.
- E-B: 검사 단계 입력 id별 theme1.xml 팔레트, ECMA-376 tint, 솔리드 fill·font·border RGB 베이크 구현. A1 출력 표시 RGB `#FFF2CC`(`ARGB=FFFFF2CC`).
- AC285 실파일 2개 병합: 2시트/15,800B. 스타일 셀 330·1,236, 솔리드 채움 200·666. `styles.xml` xmllint 통과.
- 성능: 12,000 스타일 셀 3회 중앙값 변경 전 1,080.28ms → 변경 후 929.00ms(14.0% 감소).
- 검증: build exit 0, unit 103/103, Excel browser, XLS preserve(3분기 포함), first-load, static 모두 exit 0. 최초 browser 1회는 Vite 신규 의존성 warm-up reload로 빈 DOM 종료 후 동일 명령 재실행 통과.
- 커밋: `162207a Preserve disguised XLS formatting and bake theme colors`.
- push·동기화: `main -> origin/main` 성공, fetch 후 양쪽 모두 `162207af1bdc21b21f025c01a317a0c29ed8573a` 확인.
