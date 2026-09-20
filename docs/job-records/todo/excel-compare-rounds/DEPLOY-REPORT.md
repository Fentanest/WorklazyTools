# Excel 중복키 묶기·머리글 자동 감지 배포 보고서

Codx · 2026-09-08 · 최종 판정: **[배포 완료 / 라이브 검증 통과]**

대상은 Worklazy Tools `main`의 Excel 비교 중복키 좌우 묶기와 머리글 후보 자동 감지 기능이다. 진행 중인 PDF U4-5, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`, `newui/`와 사용자 미추적 파일은 병합·stage·수정하지 않았다.

## 1. 실행 게이트와 계보

- 착수 직전 `git fetch origin main` 결과 `origin/main`은 검수 기준과 같은 **`597a92ff56ed9c3eb23755a58df2580b0269b8bd`**였다. push 직전 재확인 때도 같았다.
- 승인 원본은 `excel-dupkey-20260907` **`953ff66aaeddc80b76fdbc87c79ed80828f1c4a6`**로 일치했다.
- `597a92f`는 `953ff66`의 조상이다. main 쪽 독자 변경 파일 수는 **0**, 실행 코드 교집합과 충돌도 **0**이다.
- `git merge-tree --write-tree --name-only 597a92f 953ff66`은 exit 0, 결과 tree **`ae4553a8fd8dc68ede2f97b5b67fb39182105281`**였다. 이는 승인 Excel HEAD tree와 동일하다.
- 열린 계획서 목록을 확인했고 같은 표면의 정본은 `excel-compare-dupkey-header-20260907.md`였다. 기존 Excel 후속 계획과 상반 지시는 없었으며 진행 중 PDF 계획은 사용자 지시대로 대상 밖에 뒀다.
- 실제 Excel 머지 커밋: **`a002c0c5e1cd95a33e46267bb368623417282b18`**
  - 부모: `597a92ff56ed9c3eb23755a58df2580b0269b8bd` + `953ff66aaeddc80b76fdbc87c79ed80828f1c4a6`
  - `--no-ff`, rebase·squash 없음. 승인된 9개 Excel 커밋 계보를 보존했다.
- 정책 문서 별도 커밋: **`2d0ff3a8280bdd1c3149946306d0ca394244fd5c`** (`CLAUDE.md`, `PROJECT_RULES.md`만 포함).
  - 주 저장소 파일과 배포 worktree 사본의 SHA-256을 대조해 내용 그대로임을 확인했다.
  - `CLAUDE.md`: `6029e02f8f22eda2e253e136be586efb614cf0b8c25c806b311d473d23bb983d`
  - `PROJECT_RULES.md`: `f06ba920a3dfaa09e03445bcbbf411e6ae13741ed1ccc26cd95d051684e94905`

자동병합된 ko/en locale, SEO, 접근성·시각 하네스는 충돌 없이 Excel 승인 tree 그대로 들어왔다. unit의 locale/SEO/광역 광고 허용목록 단언, production 정적 검사, 전용·공용 브라우저 스모크로 양쪽 계약을 다시 확인했다. R01~R04 기록, 선행 보고서 너비·XML 무결성, 비교 3정책 계약도 보존됐다.

## 2. 병합 후·배포 전 검증

모든 빌드·브라우저는 `NODE_OPTIONS=--max-old-space-size=4096`, 브라우저 동시성 1, 포트 4350~4352 `--strictPort`로 직렬 실행했다.

| 명령·검증 | 결과 |
|---|---|
| `./node_modules/.bin/tsc -b` | exit 0 |
| `npm run test:unit` | **396/396**, fail 0, skipped 0 |
| production `npm run build` | exit 0, **2,836 modules**, 정적 **61페이지** |
| `npm run test:static` | exit 0; localized pages, canonical/hreflang, browser runtimes, `ads.txt`, robots, sitemap, recovery 104문서 |
| `npm run test:excel-compare` | exit 0; 좌우 독립 목록·검색·접힘/더보기·전체값/Escape·초점 반환, 직접/ZIP XLSX 재개방 |
| `npm run test:excel-cleaner` | exit 0 |
| `npm run test:qr-bulk` | exit 0 |
| `npm run test:browser` 전체 | exit 0; Excel·Word 비교·PDF 편집/분할/변환 |
| `npm run test:new-tools` | exit 0; HWP·Image·Audio·Video |
| `npm run test:utilities` | exit 0 |
| `npm run test:office` | exit 0; 95 download states, 7 cached states |
| `npm run test:recovery` | exit 0, **147 cases** |
| QA `VITE_LOCAL_QA=1 npm run build` | exit 0, 광고·분석 제외 빌드 |
| 전체 `npm run test:visual` | **183/183 일치**, Chrome 152, 기준선·허용치 변경 없음 |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | **16페이지, 자동 violations 0, 외부 요청 0** |
| `BUNDLE_BASELINE=/tmp/worklazy-excel-s0/evidence/bundle-baseline.json npm run bundle:measure` | 5예산 모두 통과; 기준선 SHA `726a2d5be21ca250c76a5a9c9220affb8931da9286769f762f3531fd64d002c8`, multiplier 1, override `{}` |
| `npm run css:orphans` | 212 class tokens, 고아 selector arm 0 |
| `node tests/tool-registry-routes.mjs` | 20 routes, missing/unexpected/duplicate 0 |
| `git diff --check origin/main..HEAD`, `git diff --check` | exit 0 |

S0 대비 gzip 증분은 entry **2,242B / 20,480B**, affected routes **4,008B / 61,440B**, shared **1,766B / 30,720B**, app **8,016B / 81,920B**, CSS **146B / 10,240B**다. 19개 lazy route 전체를 측정했고 귀속 이동은 0이다. 원자료는 `bundle-measure.json`에 있다.

접근성 원자료는 자동 위반 0과 별도로 incomplete **1,274노드**를 보존한다. 결과 화면 8프로필의 520노드는 새 노드 **6 수동 해결** + 기존 상속 **514**, 나머지 기존 프로필 **754**다. 이를 자동 통과 수에 더하거나 삭제하지 않았다.

Dolby Vision base-layer 실제 streaming/target encode는 Chrome 152 호스트에 호환 경로가 없어 **미실행**이다. deterministic capability unit과 fallback 결과 안내는 통과했다. 이 제약으로 다른 필수 명령을 면제하지 않았다.

## 3. 최종 통합본의 신고 경로·사용자 사본

- 합성 2:3: 중복 **1그룹·1레코드**, 좌 행 `[2,3]`, 우 행 `[2,3,4]`, 좌 값 2개·우 값 3개 보존.
- 완료 역전: 수동 5행의 늦은 완료가 새 6행을 덮지 않았고, 구 완료 뒤에도 compare/swap busy가 유지됐다. 새 6행 완료 뒤에만 busy 해제.
- unmount: 보류 응답 중 화면 이탈 뒤 worker terminate **4→5**, 늦은 응답 무효, 페이지 오류·외부 요청 0.
- 사용자 사본 두 파일 모두 초기 **4행 suggested**.
- 수동 1행 / B열: 중복 **1그룹**, matched/changed/added **713/37/48**.
- 자동 4행 / B열: 중복 **0그룹**, **703/37/48**.
- 자동 4행 / A열: 중복 **6그룹**, **486/134/31**.
- A열 6그룹은 각 그룹 좌 2/우 2의 독립 목록이다. 첫 그룹은 좌 `[5,73]`, 우 `[5,79]`.
- ko/en 개별 보고서: **9시트**, `Duplicates` **13열**, 폭 **12~48**, XML/rels 각 18개, ZIP entry 각 24개 재개방.
- 공식 Excel smoke에서 전체 검색·접힘/더보기·전체값/Escape와 머리글 수동 선택·swap·교체·쌍 제거 유지가 통과했다.

사용자 원본·다운로드·원문 캡처는 `/tmp/worklazy-xd-deploy-report/**/evidence/private/`에만 있다. 저장소 fixture, 추적 파일, Pages 산출물에는 포함하지 않았다.

## 4. 광고·분석 제외 로컬 시각 검수

QA 빌드에서 Excel 비교를 ko/en × desktop/mobile × light/dark로 직접 열었다. 전체 QA 캡처는 `excel-result-captures/` **40장**(initial 8, bottom 8, key mode 8, pair 8, duplicate result 8)이다.

중복 결과 8장:

- `excel-compare-empty__interaction-duplicate-result__ko__light__desktop.png`
- `excel-compare-empty__interaction-duplicate-result__ko__light__mobile.png`
- `excel-compare-empty__interaction-duplicate-result__ko__dark__desktop.png`
- `excel-compare-empty__interaction-duplicate-result__ko__dark__mobile.png`
- `excel-compare-empty__interaction-duplicate-result__en__light__desktop.png`
- `excel-compare-empty__interaction-duplicate-result__en__light__mobile.png`
- `excel-compare-empty__interaction-duplicate-result__en__dark__desktop.png`
- `excel-compare-empty__interaction-duplicate-result__en__dark__mobile.png`

요약 몽타주는 `excel-result-montage.png`이다. 빈 상태로 대체하지 않았고 결과 목록 화면에서 정렬 붕괴·세로 낙하·문구 잘림·토글 트리거 이탈·초점 가림을 발견하지 못했다. 라이브 사용자 A6 좌우 목록 캡처도 ko/en에서 직접 열어 같은 행 배치와 좌우 2개씩을 확인했다.

## 5. push·Pages 배포

- `git push origin main`: **`597a92f..2d0ff3a` 성공**.
- GitHub Actions `Deploy GitHub Pages` run **34189553218**: conclusion `success`, head SHA **`2d0ff3a8280bdd1c3149946306d0ca394244fd5c`**.
- build job 5m56s: checkout, 고정 Office 스냅샷, 정적 빌드, SEO/AdSense 검사, FFmpeg 하이브리드 스모크, Pages artifact 업로드 모두 성공.
- deploy job 25s 성공. Actions의 Node 20→24 강제 실행 deprecation annotation은 비차단 운영 경고로 남는다.

## 6. 배포 후 라이브 확인

- `https://worklazy.net/`, ko/en Excel 비교, `ads.txt`, `sitemap.xml`, `robots.txt`: HTTP **200**.
- ko/en Excel 비교 정적 직접 URL과 새로고침 모두 동일 경로 유지. canonical/hreflang은 ko/en/x-default 계약과 일치.
- 라이브 자산: `index-DCjkap9J.js`, `ExcelComparePage-s4F9QBeQ.js`, `index-CydcrfRG.css`.
- 라이브 Excel 시각 회귀: 선택 16장 중 **16/16 일치**, 그 안의 결과 화면 ko/en × desktop/mobile × light/dark **8/8 일치**.
- 라이브 사용자 사본 결과는 3절의 1/6/0 및 **713/37/48·703/37/48·486/134/31**, 첫 그룹 행 번호와 동일.
- 라이브 ko/en 사용자 보고서와 2쌍 ZIP을 실제 다운로드했다. 각 언어에서 직접 XLSX 2개와 ZIP 내부 2개가 **바이트 동일**, 모두 9시트·13열·폭 12~48로 재개방됐다.
- 변경된 홈 Excel 카드: ko `머리글 후보 선택`·`중복 키 좌우 묶음`, en `Suggested header selection`·`Grouped duplicate keys` 확인.
- 영어 HWP 직접 URL은 `/en/tools`로 정상 리다이렉트.
- 일반 Excel 페이지(동의 granted): Google/Naver Analytics + AdSense 태그·요청 확인.
- Video Studio 격리: Google/Naver Analytics 유지, AdSense 제외.
- Office app·XLS preserve 격리: Analytics와 AdSense 모두 제외. 세 격리 문서 marker가 각각 일치.
- `ads.txt` 본문은 게시자 `pub-8940087269746960`, HTTP 200. sitemap에 Excel ko/en과 영어 HWP→tools hreflang 매핑이 있다.

## 7. 비차단 잔여와 실행 중 보정

기존 백로그는 그대로다: BL01 최종 더보기 소진 뒤 BODY 초점(P3), BL02 긴 시트명 잘림(P3), BL03 desktop 상단 toggle 부분 가림(P3), BL04 실제 XLSX 오류 셀 타입 보존(높음), BL05 검색 입력 초점 상단 가림(P3), 공용 a11y 잔여 incomplete 1,268. 이번 배포에서 수리하거나 우선순위를 바꾸지 않았다.

실행 중 비제품 실패는 숨기지 않는다.

- 첫 `npm ci`는 읽기 전용 홈 npm cache로 `EROFS`; `/tmp` 전용 cache 재실행은 성공. 설치 결과는 6 low + 4 moderate advisory를 보고했으며 새 의존 변경은 없다.
- 라이브 XLSX 보조 집계 첫 명령은 stdin ESM에서 `require`를 사용해 실패; CommonJS IIFE 재실행으로 ko/en 9시트·13열·폭 12~48 통과.
- 사용자 ZIP probe 첫 실행은 비동기 ZIP 링크 대기 누락으로 `0 !== 1`; 준비 대기를 추가한 재실행은 ko/en 모두 통과.
- 라이브 홈 probe 첫 실행은 동일 href의 sidebar 링크를 선택했고, 격리 probe는 service worker 강제 차단 설정 때문에 실패했다. 카드 본문 선택과 정상 service worker 설정으로 교정한 최종 실행은 전 항목 통과.
- GitHub Pages deployments REST 보조 조회는 권한/endpoint 404였지만, `gh run view`의 head SHA·성공한 build/deploy jobs와 실제 라이브 자산·기능으로 배포를 확정했다.

## 8. 종료 상태

- `origin/main` 및 `git ls-remote origin main`: **`2d0ff3a8280bdd1c3149946306d0ca394244fd5c`**.
- `git log origin/main`에서 `2d0ff3a` → merge `a002c0c` → Excel `953ff66` 계보 확인.
- `/tmp/worklazy-xd-deploy`는 `main...origin/main`, 추적·미추적 변경 0.
- 포트 4350~4359 리스너 0.
- 사용자 파일·private 증거는 Git에 추가되지 않았다.

**최종 판정: 승인된 Excel 비교 기능과 정책 문서를 계보 보존 방식으로 main에 통합했고, GitHub Pages 배포 및 지정 라이브 확인을 모두 통과했다.**
