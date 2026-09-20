먼저 /home/better0101/projects/worklazytools/GEMINI.md 와 /home/better0101/projects/worklazytools/PROJECT_RULES.md 를 읽어라(특히 「배포 전 로컬 시각 검수」의 "깨짐" 정의).

## 임무 — S1(문서 비교 죽은 코드 제거 + orphan CSS 71규칙 삭제·5규칙 부분 정리) 배포 전 로컬 시각 검수. 읽기 전용.
- 저장소 파일 생성·수정·삭제 절대 금지. `package.json`·`package-lock.json` 변경 금지. 저장소에서 `npm install`·`npm i`·`npm ci`·`npx playwright install` 금지. 산출물은 전부 `/tmp/worklazy-s1/gemini-local/` 아래에만.
- Playwright 는 저장소에 설치돼 있다: cwd 를 저장소로 두고 `node /tmp/worklazy-s1/gemini-local/<스크립트>.mjs` 에서 `import { chromium, devices } from "playwright"`. 브라우저 다운로드 금지.
- 로컬 QA 서버(분석·광고 코드 제외 빌드)가 http://127.0.0.1:4288 에 떠 있다. 새로 띄우거나 죽이지 마라.
- 위험 지점: 삭제된 CSS 가 **다른 도구가 쓰는 selector 를 실수로 포함**했을 가능성. 특히 부분 변경된 5규칙의 보존 arm — `.collage-preview-heading small`·`.collage-preview-stage > span`(이미지 스튜디오 콜라주), `.policy-date`·`.content-callouts small`·`.about-list small`(정보/정책 페이지), `.sheet-tool-item small`(모바일 도구 시트), `.tool-page button:not([data-slot])`·`.tool-page a.secondary-button`, `.about-grid`, `.ui-tool-card`·`.ui-section-card`·`.ui-tool-guide-grid article`·`.prose-card`(전 도구 공통 카드). 이 요소들이 렌더되는 화면을 반드시 포함해 **글자 크기·간격·카드 테두리가 깨지지 않았는지** 본다.

## 검수 대상(전수 · desktop 1365×900 + Pixel 7 모바일)
- ko/en 각: `/{lang}/`, `/{lang}/tools/`, `/{lang}/about/`, `/{lang}/privacy/`(경로가 다르면 사이드바 "정보"·푸터 "개인정보처리방침" 링크를 따라가 실제 경로 기록), `/{lang}/tools/document-compare/`, `/{lang}/tools/image-studio/`, `/{lang}/tools/excel-merger/`, `/{lang}/tools/pdf-editor/`, `/{lang}/tools/excel-compare/`, `/{lang}/tools/qr-studio/`.
- 문서 비교 흐름: `/ko/tools/document-compare/` 에서 파일 선택 카드·옵션·실행 버튼이 정상 표시되는지(파일 없이 UI 만).
- redirect: `/ko/tools/word-compare/`·`/en/tools/word-compare/`·`/ko/tools/hwp-compare/` → 최종 URL 이 `/tools/document-compare` 로 끝나고 정상 렌더.
- 모바일: 하단 "모든 도구" 탭을 눌러 도구 시트(`.sheet-tool-item`)가 열린 상태 스크린샷 1장(ko).
- 각 화면: 로드 후 5초 대기, 스크린샷(뷰포트 1장 + fullPage 1장). 판정 기준: 빈 화면 아님 · 오류 경계(`[data-route-error]`)·정적 안내(`#startup-help` 표시) 없음 · 가로 스크롤 없음 · 글자 겹침/잘림/정렬 붕괴 없음 · 카드 테두리·여백 정상.

## 산출물·보고(강제)
- 스크린샷 `/tmp/worklazy-s1/gemini-local/shots/<lang>-<route>-<desktop|mobile>[-full].png`. 결과 `/tmp/worklazy-s1/gemini-local/results.jsonl` 한 화면당 1엔트리 `{route, lang, viewport, url, finalUrl, blank, boundary, helpVisible, hOverflow, consoleErrors, verdict, note, screenshot}` — **verdict 는 표와 동일하게 jsonl 에도 기록**.
- 보고 표 열 고정: | route | lang | viewport | verdict(정상/깨짐/차단) | 근거 한 줄 | screenshot |
- 마지막에 집계: jsonl 엔트리 수 · distinct route 수 · 스크린샷 파일 수(`ls shots | wc -l` 원문). 표 행 수와 다르면 이유.
- 깨짐·차단에는 스크린샷 경로 + DOM 근거(selector·bounding box). 실행하지 않은 것은 "미실행"으로.
