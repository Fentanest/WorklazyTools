# UI 구현 정본 (R3 갱신) — 2026-09-14, Muse

상위 정본 `ui-theme-redesign-20260907.md` v3(2026-09-07 13:47 이견 0)와
`ui-theme-rebaseline-procedure-20260909.md`를 이 문서가 현행 HEAD에서 갱신한다.
설계 결정(v3 N1~N7, W0~W5 단계, GATES·PRIMITIVES·CONTRAST·SELECTORS·테마 fixture)은 유지한다.
바뀐 것은 입력 수치와 아래 표류 4항의 처리뿐이다.

## 요청 모드·구현 허가

- 정본 상태: v3 설계 정본 유지 + 본 R3 입력 갱신. `!계획!` 신규 절차가 아니라 정본이 정한 R3다.
- 구현 허가 근거: 2026-09-14 사용자 명시 지시(UI 작업 이어서 진행) + 표류 4항 A안 승인(AAAA).
- 담당: Muse(구현) — 기준 `9ed8ea3`, 작업 브랜치 별도(미생성), 통합·배포 담당 미지정.
- Astra 3차 확인·Claude 지시서는 가용 모델 부재로 미수행이며, 사용자裁决으로 갈음한다.

## R1 입력 갱신 (구 → 현, 기준 9ed8ea3)

| 입력 | 구 정본 | 현행 | 비고 |
|---|---|---|---|
| `dark:` 사용 파일 | 50 | 54 | grep 실측 (셸에 rg 없음) |
| UI import 소비 (AST) | 61 | 53 외부 + 2 내부 | TS import AST, `ui-consumers.json` |
| features 키 | ko 20 / en 19 | ko 20 / en 20 | 대칭화됨 |
| SEO 키 | 36 | 51 | U9 12종 포함 |
| 시각 시나리오/프로파일 | 85 / 246 | 97 / 265 | 매니페스트 실측 |
| 기준선 PNG | 203~246 | 258 | 7 부족분은 아래 표류 3항 |
| 도구 수 | 20 | 23 | U6·U7·U8 소유 |
| 번들 app gzip | 구 기준선 | +878,623B | U6~U8 귀속, 상한 해제 상태 |

원본 목록: `/tmp/worklazy-ui-rebaseline-r1/` (R1-SNAPSHOT.json, dark-files, ui-consumers, features-ko/en, seo-keys, baseline-pngs, manifest-profiles, bundle.json).

## 표류 처리 (사용자 승인 AAAA)

1. **U9 12페이지**: W4 도구 스윕에 자동 포함. 프로파일은 pdf-compare 선례대로 페이지당 6장(초기/하단 × ko/en × 명암·뷰포트 배합)씩 72장 추가. 목표 매니페스트 265 + 72 = 337.
2. **파일명 제한 입력**: 일반 필드로 취급. 추가 설계 없음. 4테마 대비는 W5 기존 게이트가 커버.
3. **7장 차이**: 전량 (a) U6 미생성분(고아 0, 改名 0). `VISUAL_ONLY=document-redactor UPDATE_VISUAL_BASELINES=1` 생성 중. 삭제 승인 불필요.
4. **번들**: 예산 기준을 현행 HEAD로 재고정. W5에서 순증분만 판정. 설계 변경 없음.

## R2 상태

- 번들 계측: 완료(위 표).
- 접근성·렌더링: 미실행.
- 시각 전수: 7장 생성 후 337 매니페스트로 실행 예정.
- a11y incomplete·contrast 판정표는 R2 실행 뒤 본 문서에 추기한다.

## W0~W5 착수 순서

R2 완료 → 본 문서 확정 → W0 토큰·4테마·FOUC부터. 각 단계 후 고정 커밋.
W5에서 337장 + Gemini 육안(광고·분석 제외 로컬 빌드 직접 순회) + astra·Claude 가용 시 검수·감사.

## R2 시각 7장 — wedge 발견 (2026-09-14)

- 7장 중 1장도 기록되지 않았다. `[4/7] bottom__ko__dark__mobile`에서 runner가 멈춘다.
  노드 CPU 19분 소비, 타임아웃·예외 없음. 동일 URL의素朴한 로드·스크롤은 4초면 된다.
- 판정: 제품 페이지가 아니라 하네스+해당 조합 문제. 배치 실행이라 한 장이 막히면 묶음 전체가 기록되지 않는다.
- 후속: per-capture 타임아웃 부재가 하네스 결함. R2 전수 전에 runner에 타임아웃을 넣거나
  해당 캡처를 분리 실행해야 한다. W5 전수 계획에 반영한다.

## R2 접근성 (2026-09-14, 현행 HEAD)

- 43페이지, violations 0, incomplete 2078노드(전부 상속, F2/F3/F4 신규 0).
- 픽셀 해소 50노드. 외부 요청 0. 원자료 `/tmp/worklazy-ui-rebaseline/a11y.json`.
- U4 당시 공용 상속 925 대비 증가분은 U6~U9 신규 화면 귀속이다. W5에서 표시·스크롤 상태 포함 재측정.

## R2 렌더링 (2026-09-14, QA 빌드 분리)

- 9페이지 × 3회, CLS 최대 0.0002(게이트 0.1 통과), 외부 요청 0.
- 원자료 `/tmp/worklazy-ui-rebaseline/rendering.json`.
- 프로덕션 dist로는 광고 요청 384건으로 실패한다. QA 빌드(dist-qa) 분리 서빙으로 측정했다.
  이는 측정 환경 이슈이며 제품 결함이 아니다.

## R2 확정 (2026-09-14)

- 접근성: 43페이지 violations 0, incomplete 2078(상속). 위 「R2 접근성」절 참조.
- 렌더링: CLS 최대 0.0002 통과, 외부 0. 위 「R2 렌더링」절 참조.
- 시각 전수: redactor-bottom wedge로 미완. 7장 미기록 상태 유지.
- 남은 것: wedge 해소 후 7장 + 72장(U9) 기록, a11y incomplete 판정표, 본 문서 확정 서명.

## 시각 러너 수정·7장 기록 (2026-09-14, 작업 브랜치 ui/visual-runner-robustness)

원인 4연쇄 (전부 하네스·시나리오 정의, 제품 무결함):
1. 캡처 URL 슬래시 누락 → 프리뷰가 루트 랜딩을 서빙 → ready 불일치 60초 실패.
2. redactor interaction의 wait-enabled가 <input>에 버튼 단언 → 절대 통과 불가.
3. redactor 엄격 CSP가 안정화 스타일시트 차단 + mount 시 40MB 준비 → networkidle0 불가.
   처방: redactor만 내비게이션 "load" + 테스트 브라우저 한정 CSP 우회(제품 불변, CSP는 test:static이 계속 검증).
4. 본문 글리프 스트리밍 race → 줄바꿈 이동. 처방: 폰트 큐 전체 대기(loadingdone).
그 밖: per-capture 타임아웃(VISUAL_CAPTURE_TIMEOUT_MS, 기본 10분)+브라우저 재생성+[start]/소요 로그.
검증: 7장 기록 후 비교 실행 2회 연속 7/7 일치.

## 브랜치 통합 (2026-09-14)

- `docs/remove-muse-md`(27375c4) + `ui/visual-runner-robustness`(6e477ab)를 main에 병합 → `8b06504`, push 완료.
- 제품 코드 변경 없음(테스트·기준선·Muse.md 삭제만). 기존 build/unit/static 결과 재사용.
- 작업 브랜치 로컬·원격 정리 완료.

## W0 착수 기록 (2026-09-14)

- 작업 ID: UI-W0, 기준 커밋 8b06504, 브랜치 ui/w0-theme-foundation, worktree /tmp/worklazy-ui-w0.
- 담당: Muse. 통합·배포 담당 미지정(별도 지정 필요).
- 소유 범위: 테마 토큰 CSS·index.html FOUC·정적 생성기 테마 전파·tailwind dark variant·순환 버튼·저장·신규 tests/ui-theme-*. 소유 밖(셸·홈·프리미티브·에셋) 손대지 않음.
- 정본 사본: ui-theme-redesign-20260907.md (sha256 0652b276…), rebaseline-procedure, probes-r2, 본 문서. worktree에 복사.
- 검사: 이번=W0 게이트(신규 ui-theme 하네스+관련 unit+영향 smoke), 최종=W5로 이월. 포트 4230대, 산출물 /tmp/worklazy-ui-w0-verify/.
- 구현 허가 근거: 2026-09-14 사용자 명시(UI 작업 이어서 + 표류 AAAA).
