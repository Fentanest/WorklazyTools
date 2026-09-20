# Excel 비교 중복키·머리글 S4 최종 통합 보고서

## 판정

**통합 준비 완료.** 새 기능은 추가하지 않았다. 전체 회귀에서 확인된 통합 결함은 S3의 Excel 비교 카드 문구 변경을 반영하지 못한 공용 desktop 시각 기준선 5장뿐이었고, 실제 광고·분석 제외 QA 화면을 직접 대조한 뒤 해당 5장만 갱신했다. 전체 시각 회귀를 처음부터 재실행해 183/183 일치를 확인했다.

- 대상: `/tmp/worklazy-xd`
- 브랜치: `excel-dupkey-20260907`
- 시작 HEAD: `657dec8bb6b7479ee93e54708544aef7b559ebc1`
- 통합 커밋: `3131258` (`3131258cb36d8f052b393abe4c6ec7b60547431d`)
- main 병합·push·배포: 수행하지 않음
- BL01~BL05: 수리하지 않고 `docs/backlog.md`에 실측·재현 경로만 기록

## 실행 게이트와 격리

- 시작 시 지정 브랜치·HEAD·clean 상태를 확인했다.
- S0 bundle 기준 `/tmp/worklazy-excel-s0/evidence/bundle-baseline.json`의 SHA-256은 `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`이었다.
- 대상 worktree에는 ignored `docs/jobs/todo`가 없었다. S0/S3가 보존한 19개 열린 계획서 스캔과 v3 정본 사본을 사용했고 상반 지시는 0건이었다.
- 실행 규칙 로드 외에는 원 워킹트리를 조사하지 않았다. `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`은 읽거나 수정하지 않았다.
- 사용자 파일은 `/tmp/worklazy-userfiles/`의 사본만 읽었다. 사용자명 포함 캡처·결과 보고서는 `/tmp/worklazy-xd-s4/evidence/private/`에만 두었고 저장소에 넣지 않았다.
- 로컬 포트는 4350~4351만 `--strictPort`로 사용했다. 빌드·브라우저 회귀는 heap 4 GiB, concurrency 1로 직렬 실행했다. 종료 시 4350~4359 listener는 없다.

## 전체 회귀 실행 결과

모든 원출력과 명령·시작/종료 시각·exit code는 `/tmp/worklazy-xd-s4/evidence/`의 같은 이름 `.log`와 `.meta`에 있다.

| 검사 | 결과 | 시간 |
| --- | ---: | ---: |
| `tsc -b` | exit 0 | 18.605s |
| `npm run test:unit` | 396/396, exit 0 | 4.346s |
| production `npm run build` | 2,836 modules, 정적 61페이지, exit 0 | 93.483s |
| `npm run test:static` | 정적 104문서, exit 0 | 0.814s |
| `npm run test:browser` | exit 0 | 53.760s |
| `npm run test:excel-compare` | exit 0 | 70.406s |
| `npm run test:excel-cleaner` | exit 0 | 55.474s |
| `npm run test:qr-bulk` | exit 0 | 51.050s |
| `npm run test:new-tools` | exit 0 | 116.862s |
| `npm run test:utilities` | exit 0 | 100.556s |
| `npm run test:office` | exit 0 | 26.232s |
| `npm run test:recovery` | desktop/android 147사례, exit 0 | 279.436s |
| `VITE_LOCAL_QA=1 npm run build` | 2,836 modules, 정적 61페이지, exit 0 | 96.927s |
| 첫 `npm run test:visual` | 178/183 기준 일치, 5 mismatch | 442.340s |
| 기준선 5장 교정 후 전체 visual 재실행 | 183/183, exit 0 | 417.092s |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | 16페이지, 자동 violation 0, exit 0 | 67.902s |
| 머리글 노드 직접 접근성 probe | 16프로필·48측정, violation 0 | 20.714s |
| 사용자 1행/B 최종 확인 | exit 0 | 5.504s |
| 사용자 자동 4행/B·A 최종 확인 | ko/en, exit 0 | 16.769s |
| 사용자 결과 XLSX XML/rels 재개방 | 2개 보고서, exit 0 | 0.092s |
| `npm run bundle:measure` | 5종 예산 통과, exit 0 | 76.862s |
| `npm run css:orphans` | orphan 0, exit 0 | 0.627s |
| registry route 검사 | 20도구, missing/unexpected/duplicate 0 | 0.529s |
| `git diff --check` | exit 0 | 0.021s |

기록 작성 후 `npm run test:unit`도 다시 실행해 396/396을 재확인했다. QA 산출물에서 광고·분석 식별자 검색 결과는 0파일이었다.

## 정본 완료 회귀 5군

1. **중복 엔진** — 2:3·2:1·2:0·0:2·1:1, 빈 키, 숫자/문자·공백·Unicode 정규화, 복합키, 복수 쌍, 그룹 순서와 3정책을 모두 실행했다.
2. **결과 화면** — 접힌 마지막 값·전체 원본 행번호 검색, 필터, 500그룹 제한, 50개 더보기, 좌·우 독립 펼침과 안정 key를 실행했다.
3. **보고서** — 9시트, Duplicates 13열, Summary/Parameters, 주입 문자열, 32,767/32,768 및 16,000/16,001 경계, LF/CRLF·surrogate 안전 연속 분할, 유한 너비·가시성, 직접 다운로드와 ZIP 안 XLSX 재개방을 실행했다.
4. **머리글 감지·수명주기** — 원형 22패턴과 세로 병합 접두 23번째를 XLSX/XLSM/XLS/XLSB/SpreadsheetML/CSV 각 기대표로 검사했고, 다중 시트, 수동 캐시·왕복, swap, 완료 역전, 제거/unmount, pre-abort를 포함했다.
5. **실제 결과 상태** — ko/en × desktop/mobile × light/dark 중복 결과 8상태를 visual과 a11y 양쪽에서 실행했다. 빈 상태 검사로 대체하지 않았다.

## 시각 통합 결함과 수리

첫 전체 실행의 5개 mismatch는 다음과 같다.

| 기준선 | 차이 픽셀 | 비율 |
| --- | ---: | ---: |
| `home-default__initial__ko__light__desktop.png` | 4,014 | 0.3267% |
| `home-default__initial__ko__dark__desktop.png` | 3,908 | 0.3181% |
| `home-default__initial__en__light__desktop.png` | 3,872 | 0.3152% |
| `home-default__initial__en__dark__desktop.png` | 3,705 | 0.3016% |
| `hwp-editor-empty__redirect-en-tools__en__dark__desktop.png` | 3,705 | 0.3016% |

실제/기준/diff를 직접 열어 S3에서 바뀐 Excel 비교 카드 설명·태그만 차이를 만들었고 정렬·토글·잘림 파손이 없음을 확인했다. 첫 실행 actual을 위 5개 공식 기준선에만 반영했다. threshold는 `0.100%`, per-pixel threshold는 `0.1` 그대로이며 reset·허용치 변경은 하지 않았다. 전체 재실행 결과는 Chrome 152.0.7977.64에서 183/183이다.

- 최초 actual/baseline/diff: `/tmp/worklazy-xd-s4/evidence/visual-captures-initial/`
- 최종 183장 actual: `/tmp/worklazy-xd-s4/evidence/visual-captures-final/`
- 실행 로그: `visual.log`, `visual-rerun.log`, `baseline-update.log`

## 사용자 파일 최종 결과

두 입력 모두 초기 감지가 **4행**을 제안했다.

| 설정 | 중복 그룹 | matched | changed | added |
| --- | ---: | ---: | ---: | ---: |
| 수동 1행 / B열 | 1 | 713 | 37 | 48 |
| 자동 4행 / B열 | **0** | 703 | 37 | 48 |
| 자동 4행 / A열 | **6** | 486 | 134 | 31 |

A열 표시 키 1~6은 각각 왼쪽 2행·오른쪽 2행 배열이었다. 첫 그룹은 왼쪽 `[5,73]`, 오른쪽 `[5,79]`이고, 실제 UI에서 왼쪽 2개를 펼친 뒤 오른쪽 2개를 별도로 펼쳐 DOM 4항목을 확인했다. ko/en 결과 보고서는 각각 9시트, Duplicates 13열, 열 너비 12~48이었다. 각 ZIP의 XML/rels 18개(총 entry 24개)를 Python ElementTree로 재개방했다.

- 실제 결과 캡처: `evidence/private/user-{ko,en}-{suggestion4,B0,A6-lists}.png`
- 수동 1행 캡처: `evidence/private/user-ko-row1-B1.png`
- 결과 보고서: `evidence/private/user-{ko,en}-A6.xlsx`
- 구조화 결과: `evidence/header-browser.json`, `evidence/user-one.json`

## 접근성 판정 분리

전체 axe 실행은 자동 **violations 0**, 외부 요청 0이었다. 다만 `incomplete`는 통과로 세지 않았다.

- 자동 판정 불가 총계: **1,274노드**
- `color-contrast`: 1,271노드
- `aria-prohibited-attr`: 3노드
- 이번 중복 결과 노드 6종: 8프로필 × 6 = **48 직접 측정**, light 최저 **5.272954:1**, dark 최저 **5.732903:1**
- 이번 머리글 guidance/help/input: suggested/fallback × ko/en × light/dark × desktop/mobile = 16상태 × 3 = **48 직접 측정**, 최저 **5.272954:1**

직접 측정한 이번 기능 노드는 해결 판정했다. 공용 shell·도구 카드·기존 표/guide/footer·모바일 탭과 기존 ARIA 보류는 기능 노드와 합산해 통과시키지 않았으며, UI 재설계 계획 소유의 공용 부채로 기록만 했다. 자동 보고 원문은 `evidence/a11y.json`, 머리글 직접 측정은 `evidence/header-a11y.json`과 16개 캡처에 있다.

## BL01~BL05 이관

다음 기존 결함은 이번 커밋에서 수리하지 않았다. 측정값과 재현 경로는 `docs/backlog.md`의 **Excel 비교 — 중복키·머리글 후속**에 기록했다.

- BL01: 마지막 더보기 소진 뒤 초점이 `BODY`로 이동, ko/en × light/dark 4/4
- BL02: 모바일 390px dark에서 한국어 guide의 긴 시트명 나열 잘림
- BL03: desktop 결과 toggle `y=-19.53125..24.46875`, 인접 상태 `y=0.46875`, 두 테마 6상태
- BL04: **높은 우선순위(spreadsheet-core)**. XLSX/XLSM 오류 타입 소실로 감지가 `suggested(1)`이 되지만 타입 보존 XLS/XLSB/SpreadsheetML 대조는 `uncertain(null)`이며 감지 정확도에 직접 영향
- BL05: 결과 검색 입력 중앙 가시성 71/72, `y=44.5/44.53125`, header bottom 63, 중앙 hit `HEADER`

## 번들·제품 규칙

S0 기준 대비 gzip 증분은 모두 예산 안이다. overrides는 `{}`, multiplier는 1이다.

| 항목 | 현재 | 증분 | 한도 |
| --- | ---: | ---: | ---: |
| entry JS | 301,530 B | +2,242 B | +20,480 B |
| affected routes JS | 2,455,589 B | +4,008 B | +61,440 B |
| shared JS | 2,716,274 B | +1,766 B | +30,720 B |
| app JS | 5,473,393 B | +8,016 B | +81,920 B |
| CSS | 37,839 B | +146 B | +10,240 B |

ko/en features·guide/FAQ·tools·SEO/static 입력의 동시 변경, URL·canonical·hreflang·사이트맵 집합, 20도구 registry, 광고 격리 allowlist, 서버 전제 부재, 내부 identity/reason/error 비노출을 unit/static/route/browser 검사로 재확인했다. `Parameters` 계약명은 다운로드 XLSX metadata에만 남는다. 생성물·vendor 산출물은 수정하지 않았다.

## 정본 규칙 19 차이

정본은 Gemini 직접 시각 검수를 요구하지만 이번 S4 dispatch는 이를 Codex의 실제 화면 실측·캡처 보존과 Claude 확인으로 대체했다. 따라서 Gemini가 직접 화면을 본 것으로 주장하지 않는다. 광고·분석을 뺀 `VITE_LOCAL_QA=1` build에서 183장 전체와 사용자 ko/en 결과·머리글 16상태를 직접 열어 증거로 남겼다.

## 저장소 변경

- 공용 desktop 시각 기준선 5장
- `CHANGELOG.md`
- `docs/review-notes.md`
- `docs/backlog.md`

그 밖의 제품 코드·생성물·사용자 파일은 커밋하지 않는다.
