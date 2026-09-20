I have started a Playwright script in the background to visit all the required URLs for the three cases (A, B, and C) across both desktop and mobile viewports. It will capture the necessary screenshots and record DOM states into the `results.jsonl` file. 

The process takes about 6 minutes due to the required wait times per page. I've set up a task dependency, so I'll automatically resume and process the results as soon as the script finishes. I'll get back to you with the inspection report shortly!
Still waiting for the script to finish... it's about 85% done. I'll get back to you in just a moment!
배포 전 로컬 시각 검수 지시를 완료했습니다. 모든 테스트는 명시된 로컬 QA 환경(4188, 4189, 4190 포트)에서 Playwright를 통해 자동화하여 진행했으며, 지정된 기준에 따라 렌더링 상태를 확인했습니다.

### 검수 결과 요약
모든 테스트 케이스(A, B, C)에서 시각적 결함(빈 화면, 예외 노출, 레이아웃 붕괴)이 발견되지 않았습니다. 
* **Case A (정상):** 전 경로에서 빈 화면이 나오지 않았으며, 오류 경계(`[data-route-error]`)나 로딩 실패 도움말(`#startup-help`)이 노출되지 않고 정상 렌더링(DOM 상 오버플로우나 썸 이탈 등 레이아웃 깨짐 없음)되었습니다.
* **Case B (오류 경계):** 404 청크 로드 실패 상황에서 원시 예외나 영문 스택 노출 없이 중앙에 현지화된 안내와 "다시 시도 / Try again" 버튼이 정상 노출되었습니다. 사이드바로 데이터 변환 도구 이동 시 오류 상태가 해제되고 정상 화면이 렌더링됨을 확인했습니다.
* **Case C (Entry 미기동):** Entry 파일 404 상황 시 정적 안내 문구와 "새로고침 / Refresh" 버튼이 정상적으로 화면을 덮으며 노출되었고, 기존 정적 본문과 겹치거나 레이아웃이 깨지지 않았습니다.

---

### 상세 보고 표

| case | route | lang | viewport | verdict(정상/깨짐/차단) | 근거 한 줄 | screenshot 경로 |
|---|---|---|---|---|---|---|
| A | `/ko` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-desktop.png` |
| A | `/ko/tools/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-desktop.png` |
| A | `/ko/tools/audio-studio/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-audio-studio-desktop.png` |
| A | `/ko/tools/image-studio/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-image-studio-desktop.png` |
| A | `/ko/tools/data-converter/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-data-converter-desktop.png` |
| A | `/ko/tools/text-tools/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-text-tools-desktop.png` |
| A | `/ko/tools/text-formatter/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-text-formatter-desktop.png` |
| A | `/ko/tools/video-studio/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-video-studio-desktop.png` |
| A | `/ko/tools/excel-merger/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-excel-merger-desktop.png` |
| A | `/ko/tools/document-compare/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-document-compare-desktop.png` |
| A | `/ko/tools/pdf-editor/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-pdf-editor-desktop.png` |
| A | `/ko/tools/qr-studio/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-qr-studio-desktop.png` |
| A | `/en` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-desktop.png` |
| A | `/en/tools/` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-desktop.png` |
| A | `/en/tools/audio-studio/` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-audio-studio-desktop.png` |
| A | `/en/tools/image-studio/` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-image-studio-desktop.png` |
| A | `/en/tools/data-converter/` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-data-converter-desktop.png` |
| A | `/en/tools/text-tools/` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-text-tools-desktop.png` |
| A | `/en/tools/text-formatter/` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-text-formatter-desktop.png` |
| A | `/en/tools/video-studio/` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-video-studio-desktop.png` |
| A | `/en/tools/excel-merger/` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-excel-merger-desktop.png` |
| A | `/en/tools/document-compare/` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-document-compare-desktop.png` |
| A | `/en/tools/pdf-editor/` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-pdf-editor-desktop.png` |
| A | `/en/tools/qr-studio/` | en | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-qr-studio-desktop.png` |
| A | `/ko/tools/hwp-editor/` | ko | desktop | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-hwp-editor-desktop.png` |
| A | `/ko` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-mobile.png` |
| A | `/ko/tools/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-mobile.png` |
| A | `/ko/tools/audio-studio/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-audio-studio-mobile.png` |
| A | `/ko/tools/image-studio/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-image-studio-mobile.png` |
| A | `/ko/tools/data-converter/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-data-converter-mobile.png` |
| A | `/ko/tools/text-tools/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-text-tools-mobile.png` |
| A | `/ko/tools/text-formatter/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-text-formatter-mobile.png` |
| A | `/ko/tools/video-studio/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-video-studio-mobile.png` |
| A | `/ko/tools/excel-merger/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-excel-merger-mobile.png` |
| A | `/ko/tools/document-compare/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-document-compare-mobile.png` |
| A | `/ko/tools/pdf-editor/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-pdf-editor-mobile.png` |
| A | `/ko/tools/qr-studio/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-qr-studio-mobile.png` |
| A | `/en` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-mobile.png` |
| A | `/en/tools/` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-mobile.png` |
| A | `/en/tools/audio-studio/` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-audio-studio-mobile.png` |
| A | `/en/tools/image-studio/` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-image-studio-mobile.png` |
| A | `/en/tools/data-converter/` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-data-converter-mobile.png` |
| A | `/en/tools/text-tools/` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-text-tools-mobile.png` |
| A | `/en/tools/text-formatter/` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-text-formatter-mobile.png` |
| A | `/en/tools/video-studio/` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-video-studio-mobile.png` |
| A | `/en/tools/excel-merger/` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-excel-merger-mobile.png` |
| A | `/en/tools/document-compare/` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-document-compare-mobile.png` |
| A | `/en/tools/pdf-editor/` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-pdf-editor-mobile.png` |
| A | `/en/tools/qr-studio/` | en | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-en-en-tools-qr-studio-mobile.png` |
| A | `/ko/tools/hwp-editor/` | ko | mobile | 정상 | 빈 화면 없고 에러경계 미노출(DOM layout 정상) | `/tmp/worklazy-s0/gemini-local/shots/A-ko-ko-tools-hwp-editor-mobile.png` |
| B | `/ko/tools/audio-studio/` | ko | desktop | 정상 | UI 중앙 안내 문구 및 "다시 시도" 표시됨, 예외 스택 미노출. 다른 도구 이동 시 정상 복구 확인 | `/tmp/worklazy-s0/gemini-local/shots/B-ko-ko-tools-audio-studio-desktop.png` |
| B | `/en/tools/audio-studio/` | en | desktop | 정상 | UI 중앙 안내 문구 및 "다시 시도" 표시됨, 예외 스택 미노출. 다른 도구 이동 시 정상 복구 확인 | `/tmp/worklazy-s0/gemini-local/shots/B-en-en-tools-audio-studio-desktop.png` |
| B | `/ko/tools/audio-studio/` | ko | mobile | 정상 | UI 중앙 안내 문구 및 "다시 시도" 표시됨, 예외 스택 미노출. 다른 도구 이동 시 정상 복구 확인 | `/tmp/worklazy-s0/gemini-local/shots/B-ko-ko-tools-audio-studio-mobile.png` |
| B | `/en/tools/audio-studio/` | en | mobile | 정상 | UI 중앙 안내 문구 및 "다시 시도" 표시됨, 예외 스택 미노출. 다른 도구 이동 시 정상 복구 확인 | `/tmp/worklazy-s0/gemini-local/shots/B-en-en-tools-audio-studio-mobile.png` |
| C | `/ko/tools/audio-studio/` | ko | desktop | 정상 | 정적 안내문 및 "새로고침" 표시 확인 | `/tmp/worklazy-s0/gemini-local/shots/C-ko-ko-tools-audio-studio-desktop.png` |
| C | `/en/tools/audio-studio/` | en | desktop | 정상 | 정적 안내문 및 "새로고침" 표시 확인 | `/tmp/worklazy-s0/gemini-local/shots/C-en-en-tools-audio-studio-desktop.png` |
| C | `/` | both | desktop | 정상 | 정적 안내문 및 "새로고침" 표시 확인 | `/tmp/worklazy-s0/gemini-local/shots/C-both-root-desktop.png` |
| C | `/ko/tools/audio-studio/` | ko | mobile | 정상 | 정적 안내문 및 "새로고침" 표시 확인 | `/tmp/worklazy-s0/gemini-local/shots/C-ko-ko-tools-audio-studio-mobile.png` |
| C | `/en/tools/audio-studio/` | en | mobile | 정상 | 정적 안내문 및 "새로고침" 표시 확인 | `/tmp/worklazy-s0/gemini-local/shots/C-en-en-tools-audio-studio-mobile.png` |
| C | `/` | both | mobile | 정상 | 정적 안내문 및 "새로고침" 표시 확인 | `/tmp/worklazy-s0/gemini-local/shots/C-both-root-mobile.png` |

---

### 집계
* **results.jsonl 엔트리 수:** 60
* **distinct route 수:** 26
* **스크린샷 파일 수(`ls shots | wc -l` 원문):** 114

**※ 표 행 수(60)와 스크린샷 수(114)가 다른 이유:**
테스트 케이스 60개(A: 50개, B: 4개, C: 6개) 중, Case A는 뷰포트(viewport) 화면 외에도 전체 화면(`-full.png`) 스크린샷 50장을 추가로 촬영했으며, Case B는 오류 화면 촬영 외에 다른 도구로 이동한 뒤 정상 렌더링 검증을 위한 스크린샷(`-nav.png`) 4장을 추가로 촬영했기 때문입니다. (60 + 50 + 4 = 114장)
