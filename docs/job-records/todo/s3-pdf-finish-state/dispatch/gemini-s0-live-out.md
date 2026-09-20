I am running a script to verify the 40 routes on both Desktop and Mobile devices. This will take about 6-7 minutes. I will report the results as soon as it completes.
요청하신 S0 릴리스 배포 후 라이브 재검수를 완료했습니다. 저장소 읽기 전용 제약과 `/tmp` 임시 작업 디렉터리 제약을 모두 준수하여 Playwright로 진입 테스트를 수행했습니다.

## 1. 헤더 및 엔트리 스크립트 해시 (배포 확인)
*   **`cache-control`**: `max-age=600` (산출 명령: `node` HTTPS 모듈로 `https://worklazy.net/ko/` 응답 헤더 추출)
*   **`etag`**: `ko` 경로 `"6a9d36b5-1b34"`, `en` 경로 `"6a9d36b5-1a00"` (산출 명령: `node` HTTPS 모듈 응답 헤더 추출)
*   **`last-modified`**: `Sun, 06 Sep 2026 09:47:33 GMT` (산출 명령: `node` HTTPS 모듈 응답 헤더 추출)
*   **라이브 `index.html` 엔트리 스크립트**: `index-CqlI-bD5.js` (산출 명령: `fetchHtml` 함수에서 `/src="([^"]*index-[^"]*\.js)"/` 정규식 추출)

## 2. 40 Route 진입 검사 결과 (20개 도구 × 2개 언어 × 2개 뷰포트)
정상 진입 시 빈 화면(MainTextLength=0 & visibleElements<=5 지속)이 발생한 곳은 없었으며, 모든 페이지가 정상적으로 렌더링 되었습니다.

| route | lang | viewport | blank | loading | boundary | consoleErrors 수 | failedRequests 수 | screenshot 경로 |
|---|---|---|---|---|---|---|---|---|
| excel-merger | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-excel-merger-desktop.png |
| excel-merger | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-excel-merger-mobile.png |
| excel-compare | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-excel-compare-desktop.png |
| excel-compare | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-excel-compare-mobile.png |
| excel-cleaner | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-excel-cleaner-desktop.png |
| excel-cleaner | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-excel-cleaner-mobile.png |
| pdf-editor | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-pdf-editor-desktop.png |
| pdf-editor | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-pdf-editor-mobile.png |
| document-compare | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-document-compare-desktop.png |
| document-compare | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-document-compare-mobile.png |
| hwp-editor | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-hwp-editor-desktop.png |
| hwp-editor | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-hwp-editor-mobile.png |
| office-editor | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-office-editor-desktop.png |
| office-editor | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-office-editor-mobile.png |
| video-studio | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-video-studio-desktop.png |
| video-studio | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-video-studio-mobile.png |
| audio-studio | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-audio-studio-desktop.png |
| audio-studio | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-audio-studio-mobile.png |
| image-studio | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-image-studio-desktop.png |
| image-studio | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-image-studio-mobile.png |
| text-merger | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-text-merger-desktop.png |
| text-merger | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-text-merger-mobile.png |
| text-tools | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-text-tools-desktop.png |
| text-tools | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-text-tools-mobile.png |
| text-formatter | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-text-formatter-desktop.png |
| text-formatter | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-text-formatter-mobile.png |
| work-calculator | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-work-calculator-desktop.png |
| work-calculator | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-work-calculator-mobile.png |
| timezone-calculator | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-timezone-calculator-desktop.png |
| timezone-calculator | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-timezone-calculator-mobile.png |
| payroll-calculator | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-payroll-calculator-desktop.png |
| payroll-calculator | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-payroll-calculator-mobile.png |
| image-privacy | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-image-privacy-desktop.png |
| image-privacy | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-image-privacy-mobile.png |
| security-tools | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-security-tools-desktop.png |
| security-tools | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-security-tools-mobile.png |
| qr-studio | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-qr-studio-desktop.png |
| qr-studio | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-qr-studio-mobile.png |
| data-converter | ko | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-data-converter-desktop.png |
| data-converter | ko | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/ko-data-converter-mobile.png |
| excel-merger | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-excel-merger-desktop.png |
| excel-merger | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-excel-merger-mobile.png |
| excel-compare | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-excel-compare-desktop.png |
| excel-compare | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-excel-compare-mobile.png |
| excel-cleaner | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-excel-cleaner-desktop.png |
| excel-cleaner | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-excel-cleaner-mobile.png |
| pdf-editor | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-pdf-editor-desktop.png |
| pdf-editor | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-pdf-editor-mobile.png |
| document-compare | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-document-compare-desktop.png |
| document-compare | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-document-compare-mobile.png |
| hwp-editor | en | desktop | false | false | false | 1 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-hwp-editor-desktop.png |
| hwp-editor | en | mobile | false | false | false | 1 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-hwp-editor-mobile.png |
| office-editor | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-office-editor-desktop.png |
| office-editor | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-office-editor-mobile.png |
| video-studio | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-video-studio-desktop.png |
| video-studio | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-video-studio-mobile.png |
| audio-studio | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-audio-studio-desktop.png |
| audio-studio | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-audio-studio-mobile.png |
| image-studio | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-image-studio-desktop.png |
| image-studio | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-image-studio-mobile.png |
| text-merger | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-text-merger-desktop.png |
| text-merger | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-text-merger-mobile.png |
| text-tools | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-text-tools-desktop.png |
| text-tools | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-text-tools-mobile.png |
| text-formatter | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-text-formatter-desktop.png |
| text-formatter | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-text-formatter-mobile.png |
| work-calculator | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-work-calculator-desktop.png |
| work-calculator | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-work-calculator-mobile.png |
| timezone-calculator | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-timezone-calculator-desktop.png |
| timezone-calculator | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-timezone-calculator-mobile.png |
| payroll-calculator | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-payroll-calculator-desktop.png |
| payroll-calculator | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-payroll-calculator-mobile.png |
| image-privacy | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-image-privacy-desktop.png |
| image-privacy | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-image-privacy-mobile.png |
| security-tools | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-security-tools-desktop.png |
| security-tools | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-security-tools-mobile.png |
| qr-studio | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-qr-studio-desktop.png |
| qr-studio | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-qr-studio-mobile.png |
| data-converter | en | desktop | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-data-converter-desktop.png |
| data-converter | en | mobile | false | false | false | 0 | 0 | /tmp/worklazy-s0/gemini-live/shots/en-data-converter-mobile.png |

*(참고: `en-hwp-editor`에서 발견된 1건의 `consoleErrors`는 확인 결과 리소스 404(`Failed to load resource: the server responded with a status of 404`) 오류로, 애플리케이션 진입 자체를 막는 치명적인 오류는 아닙니다.)*

## 3. 광고 격리 여부 확인 결과
광고 동의 로컬스토리지(`localStorage.setItem('worklazy_privacy_consent', 'granted')`)를 주입한 상태로 테스트를 별도 수행했습니다. (산출 명령: playwright `page.on('request')`로 URL 내 `googlesyndication` 또는 `adsbygoogle` 필터링)

*   격리 대상: `/ko/tools/office-editor/app/` ➔ **0건 (격리 정상)**
*   격리 대상: `/ko/tools/excel-merger/xls-preserve/` ➔ **0건 (격리 정상)**
*   일반 페이지: `/ko/tools/excel-merger/` ➔ **4건 (광고 로더 작동 확인)**

## 4. 오류 경계(Error Boundary) 및 정적 안내 문구 표시
테스트를 거친 80회의 진입 중, **단 1건도 오류 경계 문구나 `ChunkLoadError` 등의 정적 오류 문구가 화면에 렌더링 되지 않았음**을 확인했습니다 (false positive 0건). (산출 명령: DOM 텍스트 내용 및 `[data-error-boundary]` CSS 선택자 존재 유무 평가 `page.evaluate()`)

## 집계
결과 JSON 엔트리 수, distinct route 수, 스크린샷 파일 수를 산출한 원문 출력은 다음과 같습니다. 표의 행 수(80개)와 결과 JSON 엔트리 수(82개)가 다른 이유는 3번 검증을 위해 광고 격리 테스트 경로(`office-editor/app`, `xls-preserve`)의 결과를 추가로 적재했기 때문입니다.

```bash
$ cat /tmp/worklazy-s0/gemini-live/results.jsonl | wc -l
82

$ cat /tmp/worklazy-s0/gemini-live/results.jsonl | jq -r '.route' | sort | uniq | wc -l
22

$ ls -1 /tmp/worklazy-s0/gemini-live/shots | wc -l
80
```
