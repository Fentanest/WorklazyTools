먼저 /home/better0101/projects/worklazytools/GEMINI.md 와 /home/better0101/projects/worklazytools/PROJECT_RULES.md 를 읽어라(특히 「배포 전 로컬 시각 검수」 규칙의 "깨짐" 정의).

## 임무 — S0(빈 페이지 결함 수정) 배포 전 로컬 시각 검수. 읽기 전용.
- 저장소 파일 생성·수정·삭제 절대 금지. `package.json`·`package-lock.json` 변경 금지. 저장소에서 `npm install`·`npm i`·`npm ci`·`npx playwright install` 실행 금지. 산출물은 전부 `/tmp/worklazy-s0/gemini-local/` 아래에만.
- Playwright 는 저장소에 이미 설치돼 있다: `node /tmp/worklazy-s0/gemini-local/<스크립트>.mjs` 로 `import { chromium, devices } from "playwright"` 를 쓰면 된다(cwd 가 저장소여야 모듈 해석됨). 브라우저 다운로드 금지 — 이미 있다.
- 로컬 서버 3개가 이미 떠 있다(분석·광고 추적 코드가 제외된 VITE_LOCAL_QA 빌드): 
  - 정상: http://127.0.0.1:4188
  - 오류 경계 재현(오디오 스튜디오 청크 404): http://127.0.0.1:4189
  - entry 미기동 재현(entry 스크립트 404): http://127.0.0.1:4190
  서버를 새로 띄우거나 죽이지 마라.

## 검수 대상(전수 · 각각 desktop 1365×900 과 Pixel 7 모바일)
A. 정상(4188) — ko/en 각: `/{lang}/`, `/{lang}/tools/`, `/{lang}/tools/audio-studio/`, `/{lang}/tools/image-studio/`, `/{lang}/tools/data-converter/`, `/{lang}/tools/text-tools/`, `/{lang}/tools/text-formatter/`, `/{lang}/tools/video-studio/`, `/{lang}/tools/excel-merger/`, `/{lang}/tools/document-compare/`, `/{lang}/tools/pdf-editor/`, `/{lang}/tools/qr-studio/` + `/ko/tools/hwp-editor/` → 각 페이지 로드 후 6초 대기, 스크린샷 1장(뷰포트)·1장(fullPage). 판정: 빈 화면 아님 · 오류 안내가 **보이지 않아야** 함(`#startup-help` hidden, `[data-route-error]` 부재) · 레이아웃 파손·문구 잘림·정렬 붕괴(글자 쏠림·세로 낙하)·토글 썸 이탈 없음.
B. 오류 경계(4189) — `/ko/tools/audio-studio/`, `/en/tools/audio-studio/` → 로드 후 8초 대기(자동 새로고침 1회가 일어난다), 스크린샷. 판정: 안내 문구 ko/en 이 화면 중앙에 읽히고 "다시 시도/Try again" 버튼이 보이고 클릭 가능한지 · 원시 예외·영문 스택·내부 용어 노출 없음 · 헤더·푸터 정상 · 그 상태에서 사이드바로 다른 도구(예: 데이터 변환) 이동 시 정상 렌더되는지 스크린샷.
C. entry 미기동(4190) — `/ko/tools/audio-studio/`, `/en/tools/audio-studio/`, `/` → 로드 후 4초 대기, 스크린샷. 판정: 정적 안내(ko 또는 en, 루트는 양어) 가 보이고 "새로고침/Refresh" 버튼이 보임 · 기존 정적 SEO 본문과 겹쳐 읽기 불가하지 않은지 · 레이아웃 파손 없음.

## 산출물·보고 형식(강제)
- 모든 스크린샷은 `/tmp/worklazy-s0/gemini-local/shots/<A|B|C>-<lang>-<route>-<desktop|mobile>[-full].png`.
- 결과는 `/tmp/worklazy-s0/gemini-local/results.jsonl` 에 한 화면당 1엔트리: `{case, route, lang, viewport, url, blank, helpVisible, boundaryVisible, consoleErrors, verdict, note, screenshot}`.
- 보고 표(열 고정): | case | route | lang | viewport | verdict(정상/깨짐/차단) | 근거 한 줄 | screenshot 경로 |
- 마지막에 **집계: results.jsonl 엔트리 수 · distinct route 수 · 스크린샷 파일 수(`ls shots | wc -l` 원문)** 를 적어라. 표 행 수와 다르면 이유를 적어라.
- 깨짐·차단 판정에는 반드시 스크린샷 경로와 해당 요소의 DOM 근거(selector·bounding box)를 붙여라. 실행하지 않은 것은 "미실행"으로 적고 정상이라 쓰지 마라.
