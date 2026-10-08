# Office → PDF 변환 엔진 이식 기록

## 원본과 버전

- BentoPDF `3a5f146d1b89d54dc7ca576aa6797c8bd3e42b97`의 `src/js/utils/libreoffice-loader.ts`: WorkerBrowserConverter, gzip 자산의 Blob URL 해제, 파일 확장자별 `inputFormat`, 배치에서 단일 인스턴스 재사용을 참조했다.
- BentoPDF `package-lock.json`은 `@matbee/libreoffice-converter` **2.6.0**을 고정한다. 공식 upstream [`v2.6.0`](https://github.com/matbeedotcom/libreoffice-document-converter/tree/v2.6.0)의 커밋은 `1bfae4a495b9fb17a0e6b20a13d0ad30ad58d343`이다. npm 2.6.0 tarball의 `dist/browser.js`, `dist/browser.worker.global.js`, `wasm/soffice.js`, `wasm/soffice.worker.js`, `wasm/soffice.wasm`, `wasm/soffice.data`를 실제 API와 정적 실행 파일로 사용한다.
- BentoPDF checkout의 `public/libreoffice-wasm/` 파일은 압축 해제 후에도 npm 2.6.0 tarball과 SHA-256이 다르다. 패키지와 엔진 바이너리 혼합을 피하려고 npm tarball의 일치하는 자산만 `scripts/vendor-libreoffice-converter.mjs`로 복사·gzip 생성한다. 스크립트는 배포물의 버전과 각 원본 SHA-256을 검증하며 생성 경로는 `public/vendor/libreoffice-converter/2.6.0/`이다. 이 디렉터리는 생성물이고 Git에서 제외한다.
- 한글 글꼴은 기존 Worklazy의 고정 `NanumGothic-Regular.ttf` 정적 자산을 변환 Worker의 초기화 전에 주입한다. 이 파일은 기존 `vendor-browser-runtimes.mjs`의 ZetaOffice 자산 단계에서 제공한다.

## Worklazy 연결부

- `bentoOfficeLoader.ts`: Bento의 gzip 해제와 WorkerBrowserConverter 호출을 가져와 초기화 Promise 공유, 압축 Blob URL 수명 관리, 취소 시 fetch 중단, 재시도 가능한 초기화 실패 처리, 한글 글꼴 주입, 파일 확장자 지정, PDF 헤더 확인을 추가했다.
- `officePdfFrame.ts`: 기존 숨김 iframe 경계를 유지하면서 그 안의 package Worker를 한 세션에 유지한다. 정상 변환은 패키지 Worker의 `handleConvert`가 문서 포인터와 가상 입력·출력 파일을 `finally`에서 정리한다. 취소와 시간 초과는 iframe 소유 Worker를 `terminate()`하고 iframe을 제거한다. package `destroy()`는 Worker 응답을 기다리므로 강제 중단에는 사용하지 않는다.
- `officePdfClient.ts`: 같은 세션 안에서는 파일을 순차 처리한다. 요청 ID와 세션 식별로 이전 응답을 배제한다. 대기 중 취소는 실행 중인 다른 파일을 중단하지 않는다. 정상 결과 뒤 30초의 유휴 수명 또는 `releaseOfficePdfSession()` 호출에 따라 세션을 해제한다. 초기화·변환 실패 후에는 새 세션을 만든다. 파일 서명 검사로 잘못된 Office 입력을 PDF 정상 결과로 오인하지 않게 한다.
- 첫 Writer PDF 저장에서는 LibreOffice 글꼴·레이아웃 서비스의 첫 사용이 발생한다. 풍부한 DOCX를 첫 입력으로 준 브라우저 실험에서 `lok_documentSaveAs`가 60~180초 멈췄고, 작은 DOCX를 먼저 변환한 동일 엔진에서는 원본 DOCX가 정상 처리됐다. `tests/fixtures/document-converters/sample.docx`의 SHA-256을 고정해 생성한 `warmup.docx`를 초기화 때 한 번 변환하고 결과를 버린다. 이 예열은 최초 로딩 시간에 포함된다. 세 차례 독립적인 새 브라우저 cold-rich 검증에서는 모두 성공했으나 모든 입력에 대한 무중단 보증은 아니다.
- Bento 2.6.0으로 `sample.hwp`, `sample.hwpx`를 실제 입력 형식으로 직접 변환하면 두 파일 모두 `loadComponentFromURL returned an empty reference`로 실패했다. HWP/HWPX를 Office WASM 지원 형식에 추가하지 않았고 기존 RHWP·브라우저 인쇄 경로를 유지한다.

## 재현과 검증

- 입력: `tests/fixtures/document-converters/`의 synthetic sample/rich 파일. 풍부한 DOCX SHA-256 `da5e2c1587da5bbb63306f6d5287cbd18107950ae93d07a86d7407ed1bfef473`.
- `npx tsc -b --pretty false`: 성공. `npx vite build`와 정적 페이지 생성: 성공. 프로덕션 `vite preview`의 단일 변환 UI에서 rich.docx 선택·PDF 생성·다운로드·PDF 재열기: 2페이지, 한글/표/둘째 페이지 텍스트와 그림 확인, 외부 요청 0건.
- `TEST_BASE_URL=http://127.0.0.1:4271 EVIDENCE_DIR=docs/jobs/todo/converter-office-20261008/smoke node tests/office-bento-smoke.mjs`: DOC·DOCX·XLS·XLSX·PPT·PPTX·rich XLSX·rich DOCX 8개의 출력 PDF를 Poppler로 다시 열어 페이지·글자·표·이미지를 검사했다. rich XLSX는 인쇄 영역과 두 시트, 계산 결과 42 및 두 페이지 이미지를 확인했다. 대기 중 취소가 실행 중 파일을 막지 않음, 실행 중·로딩 중 취소 뒤 다음 파일 성공, 강제 초기화 실패 뒤 새 세션 성공, 잘못된 파일 뒤 다음 파일 성공, 명시 해제 후 iframe 0개, 외부 요청 0건을 확인했다.
- 같은 rich.docx와 Chrome/Vite 개발 서버의 직접 API 계측: 기존 엔진 첫 파일 11,446.71ms, 후속 6,233.04ms/6,412.00ms. Bento 예열 세션의 별도 새 브라우저 두 실행은 첫 파일 3,930.66ms/4,243.08ms(준비 완료 3,644.88ms/3,933.35ms), 후속 147.83ms/175.29ms 및 140.24ms/130.79ms. 같은 기기에서 다른 개발 작업도 진행 중이었고 이 수치는 조건부 관찰값이다. JS heap은 WASM 전체 메모리를 나타내지 않는다.

## 남은 제한

- 상류 2.6.0 Worker는 드물게 첫 변환 뒤 pthread `std::length_error`를 콘솔에 출력했고, 예열 전 rich DOCX가 `lok_documentSaveAs`에서 멈춘 사례가 있었다. 이식 경로는 취소·시간 초과 시 즉시 Worker를 종료하고 다음 요청에 새 세션을 사용한다. 패키지 내부의 모든 LibreOffice 문서에 대해 오류가 없다고 주장하지 않는다.
- 원본 서식과 설치되지 않은 글꼴, Excel 인쇄 설정, PowerPoint 슬라이드 설정에 따라 PDF가 달라질 수 있다. 이번 검증에서는 synthetic 예제의 글자·표·그림·페이지·시트만 확인했다.
