# Excel 중복키 S2 fix-2 구현 보고

- 작업 브랜치: `excel-dupkey-20260907`
- 기준 HEAD: `ab00de3a6c47e07a15e8554c5ff0a466a130c209`
- 구현 커밋: `5dfe4139cf042090ef6a5207f67843e2e4ef9ce3`
- 작업 범위: S2-R04 모바일 키보드 초점 가시성만 수정
- 상태: 구현·검증·커밋 완료, main 병합·push·배포·S3 착수 없음

## 1. 착수·범위 게이트

- 지정 worktree `/tmp/worklazy-xd`, 지정 브랜치, 기준 HEAD, clean 상태를 확인한 뒤 착수했다.
- `docs/jobs/todo`에 열린 계획서가 없어 충돌 계획은 없었다.
- 원 워킹트리, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`에는 접근하지 않았다.
- 사용자 Excel은 `/tmp/worklazy-userfiles/` 사본만 읽었다.
- 브라우저 포트는 4350~4359의 strict 포트만 사용했고 종료 뒤 잔류 listener는 0이다.
- astra 원본 probe와 검수 evidence는 `bwrap`의 read-only root 위에서 실행하고, 출력 경로만 이 보고서의 `evidence/`로 bind했다. 원본 probe·검수 산출물은 수정하지 않았다.

## 2. R04 원인과 수리

390×844 결과 표에서 브라우저 기본 focus scroll은 고정 `.mobile-header`와 `.bottom-tabs`의 실제 가시 경계를 알지 못했다. 가로 방향에서도 overflow region 안으로 버튼 일부만 이동해 영문 오른쪽 라벨과 3px focus ring이 잘렸다. 목록 펼침이나 50건 추가 로드처럼 focus 뒤 레이아웃이 변하는 경우에는 최초 좌표만으로 보정할 수도 없었다.

수리는 Excel 결과 Card의 focus capture에 한정했다. 표시 대상 버튼을 명시적으로 표시하고, focus 직후 및 레이아웃 반영 뒤 두 프레임에 다음 실제 좌표를 다시 측정한다.

- 세로: 모바일 헤더 `bottom`과 하단 탭 `top` 사이에 4px 여백을 확보하도록 document를 이동
- 가로: 결과 scroll region의 border가 아닌 실제 client 경계 안에 4px 여백을 확보하도록 해당 region만 이동
- 펼침·추가 로드: click에 따른 DOM 변화 뒤 같은 보정을 재실행
- 전역 `html { scroll-behavior: smooth }`와 빠른 Tab→Enter가 경합하지 않도록 접근성 보정은 `behavior: "instant"` 사용
- `(max-width: 820px)`가 아니면 즉시 반환하므로 데스크톱 레이아웃·스크롤 동작은 유지

초점 표시, Tab 순서, 고정 하단 탭, 최소 44px 타깃은 제거하거나 축소하지 않았다.

## 3. 원본 overlap probe 무수정 재현

실행 대상은 `/tmp/worklazy-xd-s2-review2/probes/overlap-review.mjs` 원본이다. 원출력의 현재 구현 판정은 다음과 같다(`evidence/overlap-review.log`).

```text
Keyboard-only user1/B ko-light-current obscured []
Keyboard-only user1/B ko-dark-current obscured []
Keyboard-only user1/B en-light-current obscured []
Keyboard-only user1/B en-dark-current obscured []
```

원본 probe는 각 프로필에서 결과 region 및 하단 탭 이동을 포함해 16단계를 기록했다. 이 중 펼침·전체 값·Escape 복귀 버튼 초점은 12단계씩, 네 프로필 합계 48단계이며 모두 9/9 hit point가 가시였다. 직전 검수 evidence의 실패 인덱스와 이번 원본 출력을 동일 프로필·동일 단계로 대응한 20개도 중앙 hit **20/20**, 9점 hit **20/20**이다.

```json
{
  "priorFailures": 20,
  "nowCenterVisible": 20,
  "nowAllNineVisible": 20
}
```

대응 원자료는 `evidence/prior-20-focus-contract.json`, 전체 측정은 `evidence/overlap-review.json`이다. 원본 `focus-contract.py`의 실패 원출력은 빈 배열 `[]`이다(`evidence/focus-contract.log`). probe에 포함된 `pre-fix-classes` 결과는 고장 상태를 의도적으로 재현하는 진단 대조군이며 현재 구현 판정에 포함하지 않았다.

## 4. 390×844 단계별 초점 가시성

| 프로필 | 확인 단계 | 현재 버튼 초점 9점 hit | 직전 실패 단계 재검증 | 가림/오류 |
|---|---|---:|---:|---:|
| ko / light | 좌 toggle Tab·Enter, 좌 full Tab·Escape 2회, 우 toggle Tab·Enter, 우 full Tab·Escape 2회 | 12/12 | 4/4 | 0 |
| ko / dark | 동일 | 12/12 | 4/4 | 0 |
| en / light | 동일 | 12/12 | 6/6 | 0 |
| en / dark | 동일 | 12/12 | 6/6 | 0 |
| 합계 | 펼침·전체 값·대화상자 복귀 | **48/48** | **20/20** | **0** |

대표 실측:

- ko 전체 값: y=724.5~768.5, 하단 탭 top=773, 높이 44px
- en 오른쪽 전체 값: x=117.969~203.891, region client x=30~360, 높이 44px
- 고정 헤더 bottom=63, 하단 탭 top=773

제품 스모크에도 CSS smooth scroll을 켠 실제 390×844 키보드 경로를 추가했다. 검색 → 결과 region → 좌 toggle → Enter → 좌 full → Escape → 좌 추가 로드 경유 → 우 toggle → Enter → 우 full → Escape 전 단계에서 중앙 hit, 헤더·탭·가로 client 경계 3px 이상 여백, 44px 높이, focus 반환을 단언한다. 상세 좌표는 `evidence/smoke-compare.log`에 있다.

## 5. 사용자 파일 재현과 기존 기능

| 설정 | 중복 | 일치 | 변경 | 추가 | 최초 화면 내부 키 노출 | 오류/외부 요청 |
|---|---:|---:|---:|---:|---:|---:|
| 머리글 1 / B | 1 | 713 | 37 | 48 | 0 | 0 |
| 머리글 4 / A | 6 | 486 | 134 | 31 | 0 | 0 |
| 머리글 4 / B | 0 | 703 | 37 | 48 | 0 | 0 |

원자료: `evidence/private/user-review.json`, 실행 로그: `evidence/user-review.log`.

추가 원본 `ui-review.mjs`도 무수정 실행했다. 타입이 다른 `1`, 구분자가 포함된 복합키의 독립 중복 그룹, 500그룹 페이징·전체 검색, 좌우 목록 독립 전개, nested button 0, 내부 키 노출 0을 모두 유지했다(`evidence/ui-review.json`). 상태·판정 문구는 ko/en × desktop/mobile의 접힘·좌측·양측 전개에서 모두 1줄이고 기존 열 폭도 유지했다(`evidence/layout-review.json`).

## 6. 데스크톱·시각 무회귀

Excel 비교 visual regression은 Chrome 152, ko/en, light/dark, desktop/mobile의 지정 16개를 모두 기존 기준선과 일치시켰다.

```text
Visual regression matched: 16 captures, Chrome/152.0.7977.64.
Visual run report: captures=16/16; concurrency=1; filter=excel-compare.
```

기준선 파일 변경은 없다. 이번 제품 코드는 모바일 media query에서 focus가 실제로 이동할 때만 scroll 좌표를 바꾸므로 정적 레이아웃과 데스크톱 렌더에는 변화가 없어야 하며, 16/16 결과와 layout probe가 이를 확인했다(`evidence/visual.log`, `evidence/layout-review.log`).

## 7. 접근성 판정

- 공식 `test:a11y`: 16페이지, violations 0, external requests 0
- 공식 incomplete: 19 rules, 1,265 node instances. 이를 자동 통과로 세지 않았다.
- 원본 수동 probe: ko/en × light/dark × desktop/mobile 8프로필과 modal focus 순환·복귀 실행
- 원본 target 대조: 16페이지의 incomplete target 누락 0
- 수동 판정: 기존 저대비 node 153, 이번에도 동일 153, 새 저대비 node 0
- S2 소유 incomplete node 14 중 저대비 0, 최소 대비 12.7995:1
- S2 텍스트 실측 608건, 실패 0, 최소 대비 5.2730:1
- 배경 이미지로 자동 해석 불가한 target 535건은 미판정으로 명시적으로 유지

판정 원문은 `evidence/a11y-adjudicate.log`, 공식 결과는 `evidence/a11y.json`, 원본 수동 결과는 `evidence/a11y-manual.json`, incomplete target 대조는 `evidence/official-incomplete-manual.json`이다.

## 8. 번들 5종

S0 기준선 SHA-256 `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`에 대해 모두 예산 안이다.

| 지표 | 현재 gzip bytes | delta | 허용 delta | 판정 |
|---|---:|---:|---:|---|
| entry JS | 300,703 | +1,415 | +20,480 | 통과 |
| affected routes JS | 2,453,580 | +1,999 | +61,440 | 통과 |
| shared JS | 2,715,925 | +1,417 | +30,720 | 통과 |
| app JS | 5,470,208 | +4,831 | +81,920 | 통과 |
| CSS | 37,839 | +146 | +10,240 | 통과 |

원자료: `evidence/bundle.json`, 실행 로그: `evidence/bundle.log`. 기준선 재설정·예산 증가·override는 없다.

## 9. 전체 검증

| 명령/검사 | 결과 |
|---|---|
| `./node_modules/.bin/tsc -b --pretty false` | 통과 |
| `npm run test:unit` | 381/381 통과 |
| `npm run build` | 2,835 modules, 정적 페이지 61개 통과 |
| `npm run test:static` | 문서 104개 통과 |
| `npm run test:excel-compare` | 통과; 모바일 focus 경로 포함 |
| `npm run test:excel-cleaner` | 통과 |
| `npm run test:qr-bulk` | strict 4351, 통과 |
| `npm run test:browser` | Excel·Word 비교, PDF 편집/분할/변환 통과 |
| `VITE_LOCAL_QA=1 npm run build` | 2,835 modules, 정적 페이지 61개 통과 |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | 16페이지 violations 0; incomplete 별도 판정 |
| `npm run bundle:measure` | 5종 모두 예산 내 |
| `npm run css:orphans` | orphan 0 |
| `node tests/tool-registry-routes.mjs` | route 20, 누락·초과·중복 0 |
| `git diff --check` | 통과 |
| 원본 `overlap-review.mjs` / `focus-contract.py` | current obscured 0 / `[]` |
| 원본 `user-review.mjs` / `layout-review.mjs` / `ui-review.mjs` | 통과 |
| Excel compare visual | 16/16 일치, 기준선 변경 0 |

초기 진단 중 QA 전용 build에 production 광고 단언을 적용한 실행과, 전역 smooth scroll 경합을 확인한 두 실행은 실패 로그를 숨기지 않고 각각 `evidence/smoke-compare-initial.log`, `evidence/smoke-compare-debug*.log`로 보존했다. 최종 판정은 production build의 `evidence/smoke-compare.log`이며, smooth 경합은 제품 코드의 명시적 instant 보정으로 해결한 뒤 통과했다.

## 10. 변경·git 상태

커밋된 파일은 정확히 다음 4개다.

- `src/features/excel-compare/ExcelComparePage.tsx`
- `tests/excel-compare-smoke.mjs`
- `CHANGELOG.md`
- `docs/review-notes.md`

생성물·벤더·시각 기준선·의존성·한영 문구·SEO·canonical·사이트맵·광고 경로는 변경하지 않았다. 커밋 직후 `git status --short --branch`는 브랜치 헤더만 출력해 clean이며, 4350~4359 listener는 0이다(`evidence/postcommit-status.log`).
