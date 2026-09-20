# Word smoke bounded diagnosis — Codex Astra

판정: 최초 광역 실행의 실패 원인은 미확정이다. 같은 현행 production dist와 같은 합성 fixture 생성기를 사용하는 Word 단독 실행은 관측본과 원본 모두 exit 0이다. 신규 회귀 또는 기존 결함 어느 쪽으로도 귀속하지 않는다. 제품 수정/빌드/광역 테스트 반복/사용자 파일 접근 없음.

## 실제 실행

- 원 실패: `/tmp/worklazy-u6-final/logs/browser.log`, Word 첫 실행 line 965에서 localized fallback. 원 로그에는 원시 exception/worker error/network failure가 없으므로 Pyodide fetch 실패로 확정할 수 없다.
- `TEST_SCOPE=word TEST_BASE_URL=http://127.0.0.1:4173 node /tmp/worklazy-u6-final-word-diagnostic/probe-observe.mjs` — exit 0, `current-observe.log`. 원 browser-smoke의 합성 fixture 및 Word 전체 시나리오를 그대로 사용하고 Worker message/error와 response만 관측했다.
- `/tmp/worklazy-u6-impl`에서 `TEST_SCOPE=word TEST_BASE_URL=http://127.0.0.1:4173 node tests/browser-smoke.mjs` — exit 0, `current-original.log`. 관측을 제거한 원 테스트 대조. 성공 문구에는 Excel/PDF도 나오지만 이 실행의 실제 범위는 Word뿐이다.
- 최초 임시 interception observer는 Puppeteer의 worker request `frame() === null`에서 `logger` TypeError로 exit 1 (`current.log`). 원 제품 실패와 별개의 검사 도구 오류이며 이 실행은 제품 판정에서 제외했다. 제품이나 CSP를 바꾸지 않고 interception 없는 관측으로 대체했다.

## 관측 및 귀속 한계

현행 Word worker와 Pyodide 5개 파일은 실제 HTTP 200이다. 첫 두 DOCX 쌍의 Word worker progress 100, 후속 Excel report 생성 및 테스트의 실제 결과 검산까지 완료됐다. `assets.json`의 Word worker 및 Pyodide 총 6개 파일은 prior immutable P3 dist-fourth와 SHA/bytes가 모두 같다. 이는 자산 동일성의 증거이며 과거 실패/성공 실행의 부모 비교를 대체하지 않는다. 현재 정상 재현이므로 별도 부모 브라우저 반복은 하지 않았다.

`DocumentComparePage.tsx:268`은 허용 목록에 없는 raw message를 동일 fallback으로 바꾼다. 따라서 원 fallback만으로 분석/다운로드/Excel 보고서 단계 중 어느 단계인지 구별할 수 없다. 이번 정상 실행에서 그 실패 원시 오류를 포착했다고 주장하지 않는다.

AppShell의 U6 조건은 exact document-redactor 경로와 marker에 묶여 있다. document-compare 정적 문서에 redactor marker/CSP가 없으며 관측 실행에서도 worker와 Pyodide가 실행됐다. OperationProgress 변경은 ol aria-label/tabIndex 추가이며 worker 처리 분기를 바꾸지 않는다. 이것과 현재 성공은 상시 발생 U6 격리 실패 가설에 반하는 증거지만, 최초 광역 실행의 앞선 Excel 단계/자원/시점 의존성까지 배제하지 않는다.

## 보존 및 다음 조치

start.json/end.json: 선택한 worker/AppShell/OperationProgress/원 smoke SHA 및 git status 동일. assets.json은 현행/prior 산출물 연결이다. 추적 파일 수정 없음.

현재 근거로 제품 수리 또는 테스트 단언 완화는 정당화되지 않는다. 최초 광역 실패를 삭제하거나 광역 PASS로 바꾸지 말고 Word scoped 회수 PASS와 구분한다. 광역 최종 반복은 root의 기존 통합 검증 정책에 따른다. 다시 같은 실패가 발생하면 그 실행에서 worker error/message 및 원시 catch 이유를 임시 관측하는 것이 필요하다. 이번 조사만으로 원인 종결은 불가하다.

추가 전이 소스 확인: 원 `navigateTo`(browser-smoke.mjs:361)는 기존 페이지를 먼저 `about:blank`로 이탈한 뒤 목적 URL로 `page.goto`한다. 최초 Excel→Word는 동일 React 문서의 SPA 전이가 아니므로 U6 anchor capture나 AppShell state 잔류로 직접 설명할 근거가 없다. 브라우저/context 캐시·프로세스 자원·타이밍 영향은 배제하지 않는다.

대표 연결 표본: `TEST_SCOPE=word TEST_BASE_URL=http://127.0.0.1:4173 node /tmp/worklazy-u6-final-word-diagnostic/transition.mjs` actual exit 0 (`transition.log`). 원 `testEncryptedExcelMerge` 후 같은 page/context에서 원 Word 경로를 연결했다. Excel 암호/출력 경로 뒤 Word 첫 두 쌍 및 후속 Word 검산 정상. 최초 광역 실행의 여러 Excel 단계 전체 누적 조건을 재현한 것은 아니므로 최초 원인 미확정 판정은 유지한다. 끝 selected source SHA/status 동일: True.
