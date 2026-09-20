먼저 /home/better0101/projects/worklazytools/GEMINI.md 와 /home/better0101/projects/worklazytools/PROJECT_RULES.md 를 읽어라(특히 「배포 전 로컬 시각 검수」의 "깨짐" 정의).

## 임무 — S2(하네스 확장 + CLS 레이아웃 예약(`#root` flow-root·로고 width/height·Suspense fallback min-h-screen) + 모바일 하단 탭 비활성 색 `--label-tertiary`→`--label-secondary`(대비 3.07→5.28) + ZIP 옵션) 배포 전 로컬 시각 검수. 읽기 전용.
- 저장소 파일 생성·수정·삭제 절대 금지. `package.json`·`package-lock.json` 변경 금지. 저장소에서 `npm install`·`npm i`·`npm ci`·`npx playwright install` 금지. 산출물은 전부 `/tmp/worklazy-s2/gemini-local/` 아래에만.
- Playwright 는 저장소에 설치돼 있다: cwd 를 저장소로 두고 `node /tmp/worklazy-s2/gemini-local/<스크립트>.mjs` 에서 `import { chromium, devices } from "playwright"`. 브라우저 다운로드 금지.
- 로컬 QA 서버(분석·광고 코드 제외 빌드)가 http://127.0.0.1:4188 에 떠 있다. 새로 띄우거나 죽이지 마라.
- 위험 지점: ① **모바일 하단 탭**(홈·모든 도구·정보) 비활성 라벨 색이 진해졌다 — 활성/비활성 구분이 남아 있는지, 라벨 잘림·줄바꿈 없는지. ② **사이드바 로고**(desktop `img.brand-logo`)에 width/height 속성이 추가됐다 — 로고가 늘어나거나 찌그러지지 않았는지(비율 5:1). ③ 도구 진입 직후 **로딩 자리표시자가 화면 높이만큼 예약**되므로 로딩 중 푸터가 첫 화면에 보이지 않아야 정상이고, 로드 완료 후 화면은 이전과 같아야 한다. ④ 정적 SEO 본문의 margin 처리(`#root` flow-root) — 페이지 상단 여백이 비정상적으로 커지거나 사라지지 않았는지.
- 참고: 이 검수는 로컬 QA 빌드(분석·광고 코드 제외)이며, 의도된 변경은 위 ①②③④ 뿐이다. 그 외의 시각 차이가 보이면 전부 기록하라.

## 검수 대상(전수 · desktop 1365×900 + Pixel 7 모바일)
- ko/en 각: `/{lang}/`, `/{lang}/tools/`, `/{lang}/about/`, `/{lang}/privacy/`(경로가 다르면 사이드바 "정보"·푸터 "개인정보처리방침" 링크를 따라가 실제 경로 기록), `/{lang}/tools/document-compare/`, `/{lang}/tools/image-studio/`, `/{lang}/tools/excel-merger/`, `/{lang}/tools/pdf-editor/`, `/{lang}/tools/excel-compare/`, `/{lang}/tools/qr-studio/`.
- 추가: `/ko/tools/hwp-editor/`(desktop) 로고·헤더 · `/ko/tools/audio-studio/`·`/ko/tools/video-studio/`(desktop/mobile).
- 로딩 예약 확인: `/ko/tools/document-compare/` 를 새 context 로 열며 200ms 간격으로 첫 2초 동안 푸터(`.global-footer`)의 bounding box y 를 기록해, 로드 중 푸터가 뷰포트 안(y < viewport height)으로 들어오는 프레임이 있는지 표로 남겨라(기대: 없음).
- 모바일: 하단 "모든 도구" 탭을 눌러 도구 시트(`.sheet-tool-item`)가 열린 상태 스크린샷 1장(ko).
- 각 화면: 로드 후 5초 대기, 스크린샷(뷰포트 1장 + fullPage 1장). 판정 기준: 빈 화면 아님 · 오류 경계(`[data-route-error]`)·정적 안내(`#startup-help` 표시) 없음 · 가로 스크롤 없음 · 글자 겹침/잘림/정렬 붕괴 없음 · 카드 테두리·여백 정상.

## 산출물·보고(강제)
- 스크린샷 `/tmp/worklazy-s2/gemini-local/shots/<lang>-<route>-<desktop|mobile>[-full].png`. 결과 `/tmp/worklazy-s2/gemini-local/results.jsonl` 한 화면당 1엔트리 `{route, lang, viewport, url, finalUrl, blank, boundary, helpVisible, hOverflow, consoleErrors, verdict, note, screenshot}` — **verdict 는 표와 동일하게 jsonl 에도 기록**.
- 보고 표 열 고정: | route | lang | viewport | verdict(정상/깨짐/차단) | 근거 한 줄 | screenshot |
- 마지막에 집계: jsonl 엔트리 수 · distinct route 수 · 스크린샷 파일 수(`ls shots | wc -l` 원문). 표 행 수와 다르면 이유.
- 깨짐·차단에는 스크린샷 경로 + DOM 근거(selector·bounding box). 실행하지 않은 것은 "미실행"으로.
