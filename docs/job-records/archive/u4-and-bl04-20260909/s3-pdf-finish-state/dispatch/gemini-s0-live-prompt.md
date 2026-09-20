먼저 /home/better0101/projects/worklazytools/GEMINI.md 와 PROJECT_RULES.md 를 읽어라.

## 임무 — S0(빈 페이지 결함 수정) 배포 후 라이브 재검수. 읽기 전용.
- 저장소 파일 생성·수정·삭제 절대 금지. `package.json`·`package-lock.json` 변경 금지. 저장소에서 `npm install`·`npm i`·`npm ci` 실행 금지. 도구가 필요하면 `npx` 일회 실행 또는 /tmp 별도 프로젝트. 임시 파일·산출물은 전부 `/tmp/worklazy-s0/gemini-live` 아래에만.
- 대상: https://worklazy.net 라이브. 배포 커밋 `b7e3977 (사후 기록 37d4e69, 라이브 entry index-CqlI-bD5.js)`.

## 절차(전수 · 산출물 강제)
1. `curl -sI https://worklazy.net/ko/` 와 `/en/` 로 `cache-control`·`etag`·`last-modified` 기록. 라이브 `index.html` 의 entry 스크립트 해시를 추출해 기록.
2. Playwright(`npx playwright@<설치된 버전>` 또는 저장소 `node_modules/.bin/playwright` 를 **실행만**)로 **20개 도구 × ko/en = 40 route** 를 데스크톱(1365×900)과 Android 에뮬레이션(Pixel 7 프로파일) 각 1회 직접 진입. route 목록은 `src/app/toolRegistry.ts` 에서 뽑고 목록 자체를 산출물에 저장.
3. 각 진입마다 **route 단위 JSON 1엔트리**(`/tmp/worklazy-s0/gemini-live/results.jsonl`): `{route, lang, viewport, url, status, mainTextLength, visibleElements, blank(boolean), loadingVisible, errorBoundaryVisible, consoleErrors[], failedRequests[], screenshot}` 와 **스크린샷 1장**(`/tmp/worklazy-s0/gemini-live/shots/<lang>-<route>-<viewport>.png`). 빈 화면 판정 = `mainTextLength=0 && visibleElements=0` 이 5초 이상 지속.
4. 광고 격리 확인: `/ko/tools/office-editor/app/`·`/ko/tools/excel-merger/xls-preserve/` 류 격리 문서에서 `googlesyndication`·`adsbygoogle` 요청 0 인지 네트워크 로그로 기록. 일반 도구 페이지 1곳에서는 광고 로더 요청이 정상 발생하는지 기록.
5. 오류 경계·정적 안내 문구가 **정상 진입에서 보이지 않는지**(false positive 0) 확인 — 보이면 route·스크린샷 첨부.

## 보고 형식(표 열 고정)
| route | lang | viewport | blank | loading | boundary | consoleErrors 수 | failedRequests 수 | screenshot 경로 |
- 마지막에 **집계: 결과 JSON 엔트리 수 · distinct route 수 · 스크린샷 파일 수** 를 `ls | wc -l` 출력 원문과 함께 적어라. 표의 행 수와 이 수가 다르면 다른 이유를 적어라.
- 모든 수치·경로·해시에 산출 명령을 병기. 실행하지 않은 것은 "미실행"으로 적고 정상이라고 쓰지 마라.
