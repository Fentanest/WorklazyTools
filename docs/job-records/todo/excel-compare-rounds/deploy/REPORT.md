# Excel 보고서 열 너비·문자 안전화 병합·배포 보고

- 판정: **병합·검증·로컬 시각 검수·push·GitHub Pages 배포·라이브 검증 완료**
- 배포 일자: 2026-09-07 (Asia/Seoul)
- 작업 worktree: `/tmp/worklazy-xr-deploy`
- 원본 브랜치/확정 HEAD: `excel-report-width-20260907` / `0654fa74bd3e23bba86c1306501c4f9123fde60a`
- 병합 커밋: `597a92ff56ed9c3eb23755a58df2580b0269b8bd`
- 병합 커밋 부모: `cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be` + `0654fa74bd3e23bba86c1306501c4f9123fde60a`
- 최종 `origin/main`: `597a92ff56ed9c3eb23755a58df2580b0269b8bd`

## 실행 게이트와 병합

착수 직전 `git fetch origin`으로 실제 `origin/main`이 검수 종료 시점과 같은 `cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`임을 확인했다. 공통 기준은 `5bc6854175331bdd73b267784d9633cdccda8446`이었으며, 기준 이후 main 31개 파일·원본 15개 파일의 교집합은 `CHANGELOG.md`, `docs/review-notes.md`뿐이고 실행 코드 교집합은 0개였다. 열린 작업계획서는 0개였다.

원본 계보 `ac9cc4a → 64af7b3 → cbe491a → 3270512 → 88fa10e → 8b5b505 → de66637 → 0654fa7`을 확인하고 `--no-ff` 머지를 수행했다. 두 기록 파일의 충돌은 main과 원본의 내용을 모두 유지하는 방식으로 해소했다. stage 2/3의 고유 행 보존 검사 결과는 양쪽 모두 누락 0개였다. 머지 직전 다시 fetch했을 때도 `origin/main`은 변하지 않았다.

머지 결과는 15개 파일, 1,288행 추가·33행 삭제이며 새 의존성은 없다. `package.json`, `package-lock.json`, `public/**`, `scripts/**`, `src/locales/**` 변경은 0개다. 새 화면·사용자 문구·라우트·SEO·광고 격리 경로 변경이 없으므로 현지화·SEO·AdSense 콘텐츠 반영은 해당 없음으로 판정했다. 다만 정적 검사와 CI의 SEO/AdSense 검사는 실제 실행했다.

## 필수 검증 결과

제품/소스 검증 실패는 없다. 상세 원출력은 `logs/` 아래에 있으며 명령별 종료 코드는 `logs/results.tsv`에 모았다.

| 검증 | 결과 | 핵심 수치 / 원출력 |
|---|---:|---|
| TypeScript | 통과 | `tsc -b`, 17초 — `logs/tsc.log` |
| 단위 테스트 | 통과 | 368 pass, 0 fail — `logs/unit.log` |
| 프로덕션 빌드 | 통과 | 2,835 modules, 정적 페이지 61개 — `logs/build.log` |
| 정적 검사 | 통과 | 시작 문서 104개 — `logs/static.log` |
| Excel 비교 브라우저 | 통과 | 9시트 XLSX/ZIP, 열 너비·텍스트 안전성 재개방 확인 — `logs/excel-compare-final.log` |
| Excel 클리너 브라우저 | 통과 | 5시트, 사용자 폭 33열, U+FFFE/U+FFFF 안전 치환 — `logs/excel-cleaner.log` |
| QR 일괄 | 통과 | 2시트 manifest, PDF/글꼴/취소·재실행 경로 — `logs/qr-bulk.log` |
| 전체 브라우저 | 통과 | Excel·실제 DOCX 비교·PDF — `logs/browser-full.log` |
| 실제 DOCX/HWP 비교 | 통과 | Word 전용 및 HWP 3,584B·1쪽 round-trip — `logs/browser-word.log`, `logs/browser-hwp.log` |
| 문서 비교 동등성 | 통과 | 53개 일치 + 허용 9개, 패키지 거부·보존 계약 통과 — `logs/document-diff-equivalence.log` |
| 문서 비교 golden | 통과 | 98/98 — `logs/document-diff-golden.log` |
| 번들 예산 | 통과 | gzip entry 299,288B; affected 2,451,581B — `logs/bundle.log` |
| CSS orphan / 라우트 | 통과 | orphan 0, 라우트 20개 — `logs/css-orphans.log`, `logs/registry.log` |
| diff 검사 | 통과 | 작업트리 및 머지 범위 공백 오류 0 — `logs/diff-check.log`, `logs/merge-diff-check.log` |

## astra 지정 probe 재실행

검수에 사용된 원본 probe 22개의 SHA-256을 8차 검수 목록과 대조해 불일치 0개를 확인한 뒤 무수정 실행했다(`logs/probe-sha-audit.log`). 검수 디렉터리는 읽기 전용으로만 사용했고, 실행 중 생성물은 이 보고 디렉터리에만 썼다.

- R1~R6, 조합·경계·lexical·writer 계열 전부 통과.
- 문자 전수: Unicode 위치 1,114,112개, ExcelJS 재개방 34개, 길이·위치 보존 전부 통과 (`logs/characters.log`).
- 독립 확장 행렬 2,880/2,880 통과 (`logs/independent-expanded.log`).
- 행 필수성 음성 6/6·양성 4/4 통과 (`logs/data-row-required.log`).
- 폭 경계 `[12,13,47,48,48]`, 50,000/150,000행 대형 입력, 조기 종료·토폴로지·성능·650,021셀 비용 검사 통과.
- 사용자 파일 재실측: 입력 19,605B/20,263B, 요약 713/37/48/4, 보고서 9시트·95열·856행, 폭 유효 (`logs/user-files.log`).
- number format: 원본 13조건, 독립 경계 68개, reachable style, 생성 금지, backstop 계약 통과.
- 16,384열 공개 열 모델과 9×16,384 wide-cost 통과. 생성 호출 0; getter 읽기 수는 정확히 열 수의 2배였다.
- 희소 fixture 43,165B 및 166,209B를 현재 parser→writer→재개방했다. 각각 5시트, 마지막 값 3,901/19,001, XML/rels 파싱 및 spans `512:512` 통과 (`logs/sparse-small.log`, `logs/sparse-large.log`, `logs/sparse-xml.log`).
- 현재 소비처 11개 XLSX의 폭·토폴로지와 ElementTree/LibreOffice/ExcelJS 계열 독립 소비자 검사를 통과했다. LibreOffice는 34개 파일을 모두 재수출했고 70개 셀을 확인했다 (`logs/consumers-current.log`, `logs/three-readers-corrected.log`).
- 과거 CDATA 원본 행렬은 알려진 oracle 한계대로 2,764/2,880에서 예상 종료 코드 1을 냈다. 이어진 의미론 대체 검사는 ElementTree 192/192, scanner mismatch 0으로 통과했다 (`logs/legacy-matrix.log`, `logs/legacy-cdata-semantic.log`). 이는 제품/소스 실패가 아니다.

초기 재실행 중 발생한 실패 표시는 제품 실패가 아니라 실행 하네스 경로·마운트 조건이었다. R2의 읽기 전용 출력 경로, style-gap의 과거 artifact 미마운트, 브라우저 preload 설정 2건, LibreOffice pipe 경로, 시각 캡처 출력 경로 2건을 원로그 그대로 보존하고 각각 수정된 하네스로 재실행해 통과했다. 저장소 추적 파일은 하네스 보정에 사용하지 않았다.

## 배포 전 로컬 시각 검수

`VITE_LOCAL_QA=1` 빌드를 포트 4330 `--strictPort`로 띄우고 추적·광고가 제외된 상태에서 Excel 비교, Excel 정리, QR 일괄 화면을 검사했다. 한국어/영어 × 밝음/어두움 × 데스크톱/모바일 × 초기/하단/상호작용 상태로 104개 캡처를 생성했다 (`shots/captures/`).

- 수동 확인용 contact sheet: `shots/contact-desktop.png`, `shots/contact-mobile.png`.
- 문서 비교 토글·액션 바 직접 확인: `shots/toggle-diagnostics/document-compare__ko__light__desktop-switches.png`, `shots/toggle-diagnostics/document-compare__ko__light__desktop-action-bar.png`.
- UI migration: 토글 7개가 컨테이너 안에 유지되고 track 43×25, thumb 21×21, action button 190px, 세로 문구/legacy selector/tracking 0.
- 모바일 control geometry: 20페이지 92표본, 문서 토글 32표본, 수평 overflow 0, 세로 문구 오류 0, thumb inset 2px.
- 캡처를 직접 열어 수평 잘림, 세로 글자 붕괴, 한쪽 쏠림, 하단 내비게이션 겹침, 토글 썸 이탈, 액션 문구 잘림이 없음을 확인했다.

원출력: `logs/build-local-qa.log`, `logs/visual-excel-qr-final.log`, `logs/ui-migration.log`, `logs/control-geometry.log`.

## push와 GitHub Pages

push 직전 `origin/main` 재확인, 머지 부모·원본 조상 관계, 15개 변경 파일, 깨끗한 tracked status, 포트 4330~4339 미사용을 확인했다 (`logs/pre-push-gate.log`). 이후 `597a92ff56ed9c3eb23755a58df2580b0269b8bd`를 `origin/main`으로 push했다 (`logs/push.log`).

- GitHub Actions run: https://github.com/Fentanest/WorklazyTools/actions/runs/34129562381
- head SHA: `597a92ff56ed9c3eb23755a58df2580b0269b8bd`
- build: 성공 (4분 48초)
- deploy: 성공 (21초)
- 빌드, SEO/AdSense 파일 검사, 하이브리드 비디오 스모크, Pages artifact 업로드가 모두 성공했다 (`logs/actions-watch.log`, `logs/actions-final.json`).
- CI에는 사용 중인 일부 action이 Node.js 20 대상이라는 비차단 deprecation annotation 1건이 있었다. 배포 결론은 success다.

## 배포 후 라이브 확인

`https://worklazy.net`에서 사용자 신고 경로를 그대로 실행했다.

1. Excel 비교: 실제로 보고서를 생성·다운로드하고 ExcelJS로 재개방했다. 단일 보고서 15,360B, 9시트, 요약 8/2/0/0/0/0/0/0, 열 가시성·폭 0 아님, 안전한 문자열, 다중 XLSX/ZIP까지 통과했다 (`logs/live-excel-compare.log`).
2. Excel 정리: 실제 결과를 내려받아 재개방했다. 5시트·보고 시트 4개, 수식 `A2+B2`, 사용자 지정 폭 33열(12~48), 데이터 18행, U+FFFE/U+FFFF number format의 U+FFFD 치환, ZIP 경로를 통과했다 (`logs/live-excel-cleaner.log`). 생성한 경계 산출물은 `artifacts/live-cleaner/`에 보존했다.
3. 오류 감사: 동의 전 실제 사용자 경로에서 두 도구 모두 HTTP 200, console error 0, page error 0, request failure 0이었다 (`logs/live-browser-audit-no-consent.log`). 실제 작업 스모크에서도 page error 0 및 동일 출처 request failure 0을 검증했다. 동의 상태의 별도 진단에서는 제품 요청이 아닌 Google Analytics beacon만 headless Chrome에서 `net::ERR_ABORTED` 1건씩 기록되어 원로그를 보존했다 (`logs/live-browser-audit-final.log`).
4. 게시 체크: 홈, `/ads.txt`, `/sitemap.xml`, Excel 비교, Excel 정리 모두 HTTP 200이었다 (`logs/live-http.log`). 응답 크기는 각각 5,910B, 59B, 21,596B, 9,497B, 9,469B였다.

## 최종 상태

- 마지막 fetch 후 `HEAD == origin/main == 597a92ff56ed9c3eb23755a58df2580b0269b8bd`.
- 원본 `0654fa74bd3e23bba86c1306501c4f9123fde60a`는 머지 커밋의 두 번째 부모이며 조상 검사 통과.
- `/tmp/worklazy-xr-deploy` tracked status 깨끗함.
- 포트 4330~4339 listener 없음.
- 금지된 원 워킹트리와 `/tmp/worklazy-dc-impl`은 접근·조작하지 않았고, 원본/검수 worktree는 읽기 전용으로만 사용했다.

