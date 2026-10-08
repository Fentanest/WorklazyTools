# PDF 문서 변환 코어의 원본과 연결

## 버전과 정적 자산

- BentoPDF checkout `3a5f146d1b89d54dc7ca576aa6797c8bd3e42b97`의 `src/js/utils/pymupdf-loader.ts`, `src/js/workflow/nodes/pdf-to-xlsx-node.ts`, `src/js/utils/{ocr,hocr-transform,tesseract-runtime}.ts`를 기준으로 했다.
- Bento의 `wasm-provider.ts`가 지정한 `@bentopdf/pymupdf-wasm` **0.11.16**을 정확히 고정했다. 대응 upstream 소스의 확인한 HEAD는 `a104fd5de9c74d06eb030ee35ab6fa4f6e92694b`이며 `src/pymupdf.ts`, `src/page.ts`, `src/document.ts`가 npm 배포물과 일치한다. 패키지에는 PyMuPDF 1.26.3, pdf2docx 0.5.8, python-docx 1.2.0과 Pyodide 2025_0 대상 wheel이 함께 제공된다. 기존 Worklazy `pyodide` 0.29.4 자산을 이 wheel들과 섞지 않는다.
- `scripts/vendor-bento-pymupdf.mjs`가 npm 패키지의 `dist/index.js`와 `assets/`를 `public/vendor/bento-pymupdf/0.11.16/`에 함께 복사하고 원본·수정된 wrapper의 SHA-256을 manifest에 기록한다. 생성 자산은 Git에 넣지 않고 `dev`·`prebuild`에서 다시 만든다.
- wrapper 변경은 이 생성기 한곳에서 버전·원문 구조를 확인한 뒤 적용한다. `pdfToDocx()`의 작업별 FS 경로, `finally`의 파일·Converter·정적 이미지 함수 복원, `ignore_page_error=False`, 불필요한 Ghostscript 전체 문서 전처리 제거, Pyodide 초기화 실패 캐시 정리, `open()/close()`의 임시 파일과 Python 전역 정리, python-docx 페이지 이미지 작성, 텍스트 레이어 프로필이 그 변경이다. 기존 패키지의 CMYK 개별 이미지 RGB 보정은 유지한다.

## Worklazy 연결

- `pdfConversionCore.ts`가 단일·배치의 공통 진입점이다. 0부터 시작하는 선택 페이지를 사용자 순서로 중복 제거하고 빈 선택을 거절한다. 원래 순서 전체 문서는 복사하지 않는다. 재배열이 필요하면 같은 Bento/PyMuPDF 세션의 `selectPages()`로 한 번만 정규화하고, 그 입력에 원본 인덱스를 다시 적용하지 않는다. 결과에 원본·입력 페이지 인덱스, 처리 방식과 경고를 연결한다.
- `bentoPdf.worker.ts`와 `bentoPdfClient.ts`가 Pyodide를 파일 사이에 재사용하고 같은 인스턴스 작업을 순차 처리한다. 취소·시간 초과는 Worker를 즉시 종료하고 다음 요청에 새 세션을 만든다. 출력 Blob의 다운로드·ZIP 수명은 기존 Worklazy UI·배치 큐가 관리한다.
- XLSX 추출은 Bento `pdf-to-xlsx-node.ts`의 `findTables()`→행 조립→SheetJS 작성 경로를 사용한다. 표가 없을 때는 빈 파일을 성공으로 반환하지 않는다. 스캔은 사용자 OCR 설정에 따라 인식 후 같은 표 추출을 재시도하며, 신뢰할 수 있는 셀을 찾지 못하면 해당 파일을 실패로 표시한다. PDF에는 원래 Excel 수식·차트가 없으므로 그 복원을 주장하지 않는다.
- `bentoHocrTransform.ts`와 `bentoOcrTypes.ts`는 Bento hOCR 파서·좌표 변환과 그에 필요한 타입만 분리한 코드다. `pdfSearchableOcr.ts`는 Bento `ocr.ts`의 단어·공백 배치와 투명 텍스트 레이어를 사용한다. 브라우저의 DOMParser/Canvas는 메인 영역에서, Tesseract 인식은 전용 종료 가능한 Worker에서, pdf2docx는 별도 Pyodide Worker에서 수행한다.
- OCR Worker는 Bento `tesseract-runtime.ts`의 언어·자산 경로 구성을 Worklazy 정적 배포 경로에 맞춰 사용하며 배치 파일 사이에 같은 Tesseract 인스턴스를 재사용한다. 취소·시간 초과에는 Tesseract 자식 Worker와 소유 Worker를 종료하고 다음 파일용 세션을 새로 만든다. PDF.js 이미지 배치 영역은 겹침을 제외한 합집합으로 계산하여 두 개의 반쪽 이미지로 된 스캔도 자동 OCR 대상으로 본다. 짧은 제목뿐인 기존 OCR 층은 본문 OCR을 막지 않는다.
- pdf2docx 0.5.8은 기본 `ocr=0`에서 렌더 모드 3의 숨김 글자를 버리고, `ocr=2`에서 일반 글자와 이미지를 버린다. 따라서 혼합 문서 전체에 `ocr=2`를 쓰지 않는다. 새 OCR이나 기존 숨김 OCR이 있는 스캔 페이지만 글자 영역의 중립색 잉크를 지우고 가시적인 편집 글자를 배치한다. 일반 디지털 페이지는 원본 PDF 페이지를 복사한다. 회전된 디지털 페이지에서 pdf2docx가 글자를 누락하는 사례는 전체 페이지 이미지로 보존하고 해당 원본 페이지에 편집 불가 경고를 남긴다.
- 페이지 이미지 DOCX는 패키지의 python-docx를 사용해 원본 페이지별 크기와 순서를 유지한다. PPTX/HWPX의 페이지 이미지와 편집 가능 경로는 `docs/stirling-layout-port.md`에 기록한 Stirling 모델·PDF.js 어댑터·기존 출력기를 사용한다.

## 현재 검증·한계

`tests/fixtures/document-conversion-engines/`는 `node scripts/generate-pdf-conversion-fixtures.mjs`로 다시 만들 수 있다. `TEST_BASE_URL=http://127.0.0.1:4272 node --test tests/pdf-conversion-engines-smoke.mjs`는 실제 브라우저에서 변환하고 DOCX/PPTX를 LibreOffice PDF로 다시 열며, XLSX/ZIP과 검색 가능한 PDF의 내용·그림·표·선택 순서를 검사한다. `node --test tests/pdf-conversion-stamp-smoke.mjs`, `node --test tests/pdf-conversion-batch-smoke.mjs`, `node --test tests/pdf-conversion-cancel-smoke.mjs`, `node tests/pdf-stirling-layout-smoke.mjs`가 색 도장 보존, 배치 실패·재시도와 Worker 취소, 슬라이드/HWPX를 확인한다. 실행한 소스·입력 해시·선택 건수·로그는 이번 작업의 gitignored `docs/jobs/todo/document-conversion-engines-20261008/`에 보관한다.

읽을 수 있지만 복사 권한이 제한된 `restricted-rich.pdf`는 PyMuPDF 1.26.3의 `scripts/generate-pdf-conversion-restricted.py`로 만들었다. AES-256 salt가 매번 달라 재생성 시 바이트 해시는 바뀌지만, 체크인한 입력의 SHA-256과 페이지 수는 fixture manifest에 고정했다. 이 입력의 DOCX 역순 변환은 `ignoreEncryption`만 설정한 PDF가 아니라 실제로 열리고 정규화된 PDF를 사용한다.

스캔 표의 선·셀은 래스터에만 남을 수 있어 OCR 글자를 인식해도 Bento `findTables()`가 표를 찾지 못할 수 있다. 이때는 실패와 구체적인 이유를 보여 준다. OCR 글자 영역에 색상 도장·그림이 겹치면 해당 페이지를 이미지로 보존하고 편집 불가 경고를 남긴다. 흑백 그림이 글자 영역과 겹치거나 특이한 배경색인 경우 자동 잉크 제거를 완전하게 보증하지 않는다. 회전된 디지털 페이지의 이미지 대체 결과는 모양과 글자 그림을 보존하지만 그 페이지 글자 편집은 지원하지 않는다. PDF 원본의 수식·정확한 폰트·모든 벡터 도형 및 Stirling 전체 표/단 분석까지 복원했다고 표시하지 않는다.
