# P-QA 차단 2건 수정 증거 — Codx, 2026-09-06

기준: `ui-migration`, `0663c7449f94f8d046e36c8ec16502582dd4f001`. 이전 실행에서는 미커밋으로 남겼으며, 2026-09-06 최신 사용자 지시로 수정·기준선·이 증거를 함께 커밋한다. push는 금지한다. 판정·명령별 최종 결과는 [review-notes](../../../docs/review-notes.md)의 **P-QA 차단 2건** 절에 기록한다.

## 동일 조건 전후 캡처

Chrome 152.0.7977.64, desktop 1365×900 / mobile 390×844, DPR 1, UTC, 고정 Noto CJK 폰트, ko/en 브라우저 로케일, 추적 제외 QA 빌드. 재캡처는 `initial 12 + bottom 12 + interaction 12 = 36장`이다.

| 확인 대상 | 원본 P-QA | 수정 후 |
|---|---|---|
| Excel EN dark mobile: 긴 라벨 2줄 | [전](../p2-final/excel-merger-empty__interaction-sheet-selection__en__dark__mobile.png) | [후](../pqa-fix-after/excel-merger-empty__interaction-sheet-selection__en__dark__mobile.png) |
| Excel KO dark mobile: 기존 1줄 보존 | [전](../p2-final/excel-merger-empty__interaction-sheet-selection__ko__dark__mobile.png) | [후](../pqa-fix-after/excel-merger-empty__interaction-sheet-selection__ko__dark__mobile.png) |
| HWP KO light desktop: 언어 전환기와 액션 분리 | [전](../p2-final/hwp-editor-empty__interaction-document-loaded__ko__light__desktop.png) | [후](../pqa-fix-after/hwp-editor-empty__interaction-document-loaded__ko__light__desktop.png) |
| HWP KO dark mobile: 3+2줄 액션·언어 전환기 노출 | [전](../p2-final/hwp-editor-empty__interaction-document-loaded__ko__dark__mobile.png) | [후](../pqa-fix-after/hwp-editor-empty__interaction-document-loaded__ko__dark__mobile.png) |
| Excel EN dark desktop 대조 | [전](../p2-final/excel-merger-empty__interaction-sheet-selection__en__dark__desktop.png) | [후](../pqa-fix-after/excel-merger-empty__interaction-sheet-selection__en__dark__desktop.png) |
| HWP 로드 전 KO light desktop 대조 | [전](../p2-final/hwp-editor-empty__initial__ko__light__desktop.png) | [후](../pqa-fix-after/hwp-editor-empty__initial__ko__light__desktop.png) |

Excel KO mobile·EN desktop은 [픽셀 비교](control-pixel-diffs.json) 차이 0이다. HWP 로드 전 대조는 41px(0.0034%)로 기존 0.1% 기준 이내다. HML 비활성은 fixture의 저장 가능 조건이며 가림 문제와 구분한다.

## DOM 실측 재현

[수정 전 6표본](../pqa-fix-before-geometry/geometry.json), [수정 후 24표본](../pqa-fix-after-geometry/geometry.json): 폭 320·390·620·621·820·821·1020·1365px, Excel ko/en·HWP ko. 전후 각각 별도 PNG도 함께 보존한다.

```sh
VITE_LOCAL_QA=1 npm run build
npm run preview -- --host 127.0.0.1 --port 4291 --strictPort
# 다른 터미널에서 실행. probe는 현재 워킹트리 빌드를 검사한다.
node tests/visual-artifacts/pqa-fix-evidence/probe.mjs after
TEST_BASE_URL=http://127.0.0.1:4291 VISUAL_ONLY=excel-merger,hwp-editor VISUAL_CAPTURE_DIR=tests/visual-artifacts/pqa-fix-recheck VISUAL_CONSENT_GRANTED=1 npm run test:visual:qa
```

probe의 `before` 인수는 실패 단언을 끄고 전 상태를 기록할 때만 사용한다. 이 작업의 수정 전 측정은 실제 수정 전 QA 빌드에서 수행했다. disabled 버튼의 hit 측정은 잠시 `pointer-events:auto`를 사용하고 즉시 복원하므로 기능 활성화나 제품 코드 변경이 아니다.

## 전체 시각 회귀의 범위 밖 실패

변경하지 않은 `timezone-calculator-empty__initial__en__light__mobile`의 [차이 화면](timezone-initial-en-mobile.diff.png)과 [실제 화면](timezone-initial-en-mobile.actual.png)을 보존한다. KO 셸 전체 실행 및 단독 재검사에서 363px(0.1103%, 상한 0.1%), EN 셸 전체에서 362px(0.1100%)로 실패해 전체 결과는 **각 174/175**다. 현재 날짜·시간 입력과 eyebrow의 렌더 차이가 포함된다. `TimezoneCalculatorPage.tsx`는 `DateTime.now()`로 초기화하고, 시각 하네스는 시간대만 UTC로 고정하며 날짜·시각은 고정하지 않는다. [해당 제품·공용 화면 diff](unchanged-surfaces.diff)는 0B다. 관련 코드·기준선·임계값을 바꾸지 않았다.

원본 QA 604장과 사용자 파일 3개는 [원본 QA 해시](original-qa-hashes.json)·[사용자 파일 해시](user-files.sha256)로 변경 없음을 확인했다.
