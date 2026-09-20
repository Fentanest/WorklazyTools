먼저 /home/better0101/projects/worklazytools/GEMINI.md 와 /home/better0101/projects/worklazytools/PROJECT_RULES.md 를 읽어라(특히 「배포 전 로컬 시각 검수」의 "깨짐" 정의).

## 임무 — S2b(QR 라벨 PDF 한글 폰트 감량 — 사용자 화면 문구·레이아웃 변경 0 이 계약. 변경은 PDF 생성 시 폰트 자산 선택 로직만) 배포 전 로컬 시각 검수. 읽기 전용.
- 저장소 파일 생성·수정·삭제 절대 금지. `package.json`·`package-lock.json` 변경 금지. 저장소에서 `npm install`·`npm i`·`npm ci`·`npx playwright install` 금지. 산출물은 전부 `/tmp/worklazy-s2b/gemini-local/` 아래에만.
- Playwright 는 저장소에 설치돼 있다: cwd 를 저장소로 두고 `node /tmp/worklazy-s2b/gemini-local/<스크립트>.mjs` 에서 `import { chromium, devices } from "playwright"`. 브라우저 다운로드 금지.
- 로컬 QA 서버(분석·광고 코드 제외 빌드)가 http://127.0.0.1:4188 에 떠 있다(S2b QA 빌드). 새로 띄우거나 죽이지 마라.
- 위험 지점: 이 변경은 **UI 문구·레이아웃 변경이 0** 이어야 한다. 검수 목적은 ① QR 스튜디오 화면(단일 생성·일괄 생성 모드) ko/en desktop/mobile 이 이전과 같이 정상 렌더되는지 ② 일괄 생성 → 라벨 PDF 흐름이 끝까지 동작하고 **다운로드된 PDF 가 정상(페이지 2, 한글 라벨 표시)** 인지 ③ PDF 단계에서 요청되는 폰트 자산이 **서브셋(`…ksx1001-v1/NotoSansKR-Regular.ksx1001.otf`, 931,704B)** 인지(네트워크 로그) — 라벨에 KS X 1001 밖 문자(예: `똠`)를 넣은 두 번째 실행에서는 **전체 OTF(`noto-cjk-sans-2.004/NotoSansKR-Regular.otf`, 4,644,748B)** 로 폴백하는지 ④ 오류 경계·정적 안내·원시 예외 문구가 화면에 나오지 않는지.

## 검수 대상
- A. 정상 렌더: ko/en × desktop/mobile — `/{lang}/tools/qr-studio/`, `/{lang}/tools/qr-studio/bulk/` 스크린샷(뷰포트+fullPage), 빈 화면·경계·`#startup-help`·가로 스크롤 없음.
- B. 라벨 PDF 흐름(ko desktop 1회 + en desktop 1회): `/ko/tools/qr-studio/bulk/` 에서 CSV 파일 업로드(Playwright `setInputFiles` 로 /tmp 에 만든 25행 CSV `Primary,Label` — 한글 라벨 "한글 라벨 1"…"한글 라벨 25") → 생성 완료 대기 → "라벨 PDF" 버튼 클릭 → 다운로드 이벤트 수신 → 저장 후 `pdf-lib` 또는 `pdfjs-dist`(저장소 node_modules) 로 페이지 수·텍스트 추출 확인 → 네트워크 로그에서 `qr-label-font` 요청 URL·크기 기록.
- C. 폴백 흐름(ko desktop 1회): 첫 Label 만 "똠 라벨" 로 바꾼 CSV 로 B 반복 → 전체 OTF 요청 확인, PDF 정상.
- 각 단계 스크린샷: 업로드 후·생성 완료·PDF 클릭 직후.
- 판정 기준: 빈 화면 아님 · 오류 경계(`[data-route-error]`)·정적 안내(`#startup-help` 표시)·원시 예외 문구 없음 · 레이아웃 파손 없음 · B/C 의 폰트 요청이 기대 자산과 일치.

## 산출물·보고(강제)
- 스크린샷 `/tmp/worklazy-s2b/gemini-local/shots/<lang>-<route>-<desktop|mobile>[-full].png`. 결과 `/tmp/worklazy-s2b/gemini-local/results.jsonl` 한 화면당 1엔트리 `{route, lang, viewport, url, finalUrl, blank, boundary, helpVisible, hOverflow, consoleErrors, verdict, note, screenshot}` — **verdict 는 표와 동일하게 jsonl 에도 기록**.
- 보고 표 열 고정: | route | lang | viewport | verdict(정상/깨짐/차단) | 근거 한 줄 | screenshot |
- 마지막에 집계: jsonl 엔트리 수 · distinct route 수 · 스크린샷 파일 수(`ls shots | wc -l` 원문). 표 행 수와 다르면 이유.
- 깨짐·차단에는 스크린샷 경로 + DOM 근거(selector·bounding box). 실행하지 않은 것은 "미실행"으로.
