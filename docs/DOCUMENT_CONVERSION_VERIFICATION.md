# 문서 변환 엔진 검증 — 2026-10-08 후보

이 기록은 `feat/document-converters`의 미게시 후보에 대한 실제 실행 결과다. 제품 코드는 `47a6020`에서 빌드했고, 뒤의 커밋 `ca2ad01`은 배치 회귀 테스트, `7c1246e`는 문서만 바꿨다. 원래 Worklazy 작업 위치의 미커밋 변경과 Bento/Stirling 참조 checkout은 수정하지 않았다. 원격 반영·배포는 하지 않았다.

## 구현과 출처

| 경로 | 확인한 원본 | Worklazy의 실행 연결 |
| --- | --- | --- |
| Office 6형식→PDF | BentoPDF `3a5f146d`의 LibreOffice 로더; `@matbee/libreoffice-converter` **2.3.1**의 공식 태그 `v2.3.1`/`b94b8a6`와 일치하는 JS·Worker·WASM·data 5개 자산 | `bentoOfficeLoader.ts`, `officePdfClient.ts`, `scripts/vendor-libreoffice-converter.mjs`. NanumGothic을 시작 전에 등록, 배치 Worker 재사용, 취소·실패 시 실제 Worker 종료. 원본 2.6.0의 새 Calc 세션 정지를 재현하여 버전과 자산을 일치시켰다. 구형 엔진 자동 우회는 없다. |
| PDF→DOCX/XLSX | BentoPDF `3a5f146d`의 PyMuPDF 로더/표 추출; `@bentopdf/pymupdf-wasm` **0.11.16**, upstream `a104fd5`; PyMuPDF 1.26.3, pdf2docx 0.5.8, python-docx 1.2.0 | `bentoPdf.worker.ts`, `bentoPdfClient.ts`, `scripts/vendor-bento-pymupdf.mjs`, `pdfConversionCore.ts`. 원본 PDF 입력, 선택 순서, 작업별 임시 파일, 페이지 오류·표 없는 페이지 보고. |
| OCR·검색 PDF | Bento의 `ocr.ts`·`hocr-transform.ts`·`tesseract-runtime.ts` 필요한 코드 | `bentoHocrTransform.ts`, `pdfOcr.worker.ts`, `pdfOcrDocxPreparation.ts`, `pdfSearchableOcr.ts`. OCR 자동 대상 페이지와 기존 숨김/가시 글자층 분리, 취소 시 자식 OCR Worker까지 종료. |
| PDF→PPTX/HWPX | Stirling-PDF `973bff865`가 사용하는 Stirling-Office-Convert **0.2.2**/`673aab8`의 페이지·글자·그림·슬라이드 배치 | `stirlingLayout.ts`, `stirlingPdfAdapter.ts`, `stirlingDocument.worker.ts`. PDF.js 입력을 Stirling 모델에 맞추고 기존 PptxGenJS·HWPX 출력기에 연결. 복잡한 페이지는 원본 이미지와 편집 제한 경고로 보존. |

자산 해시·원본 경로·생성 패치와 남은 포팅 범위는 [Bento PDF 변환](BENTO_PDF_CONVERSION.md), [Stirling 포팅](stirling-layout-port.md), [Bento Office 엔진](OFFICE_BENTO_ENGINE.md)에 적었다. `public/vendor/libreoffice-converter/2.3.1/manifest.json`은 생성 시 5개 자산 원본 해시와 NanumGothic 해시를 검증한다. 버전이 다른 이전 2.6.0 생성 디렉터리는 후보 정적 자산에서 제거했다.

## 실제 검사

| 검사 | 결과 | 확인한 내용 |
| --- | --- | --- |
| `npm run build` | 종료 0 | 타입 검사·Vite 프로덕션 빌드·113개 한영 정적 페이지. `test:guides` 59경로와 정적 런타임 자산 검증 포함. |
| `npm run test:unit` | 공개 76파일, TAP 706/706 | 제품 단위 회귀. |
| `npm run test:static` | 종료 0 | 다국어 페이지·hreflang·자체 호스팅 런타임·정적 보안 회귀. |
| `node --test tests/pdf-conversion-engines-smoke.mjs` | 브라우저 입력 **41/41**, TAP 1/1 | 디지털/스캔/혼합 PDF, OCR 끄기·자동·기존 층, 페이지 역순, DOCX/XLSX/PPTX/HWPX/TXT/검색 PDF, 회전·CropBox·주석·고해상도. DOCX/PPTX는 LibreOffice로 다시 PDF화했고 ZIP 텍스트·표·이미지와 검색 PDF 텍스트층을 확인했다. 외부 요청·브라우저 페이지 오류 0. |
| 별도 `mixed-off-docx` 회귀 | 브라우저 입력 1/1 | OCR 끈 혼합 5페이지 DOCX를 다시 열어 **5페이지**, 디지털 첫 페이지의 한글·표 글자, 이미지 4개 및 빈 원본 페이지를 확인. 스캔/회전 페이지의 `image-preserved` 경고 확인. |
| `node --test tests/office-bento-smoke.mjs` | TAP 1/1 | Office 결과 PDF 12개 재열기·한글·그림·표·슬라이드, 취소/재시도, 초기화 실패와 손상 파일 뒤 정상 변환, Worker 5회 시작/5회 종료, 외부 요청 0. 최초 개발 서버 시도는 Vite 의존성 최적화 탐색으로 변환 전에 중단돼 실패 로그를 보존했고, 같은 소스를 준비된 서버에서 재실행했다. |
| `node --test tests/document-pdf-smoke.mjs` | 프로덕션 화면 12/12 | 파일 선택·결과 다운로드, Office 6형식과 풍부한 DOCX/XLSX의 한글·그림·페이지, 모바일·취소. |
| `node --test tests/conversion-batch-smoke.mjs` | 프로덕션 배치 8/8 | 한영 PDF→HWPX·이미지·Markdown, 페이지 범위, 파일별 실패·재시도, 개별 결과·합본 ZIP, Office 6형식 및 Bento WASM 적재 중 취소 후 다음 파일 성공. |
| PDF Python/OCR 취소 회귀 | 국소 통과 | 로딩·실행 중 취소/시간 초과와 다음 작업 성공, 관찰한 Worker 11/11 종료. |

고정 fixture 생성기는 `node scripts/generate-pdf-conversion-fixtures.mjs`이고 manifest SHA-256은 `af9df29599c33223d29ca342660dbd62f00e49e35d64ac6a78e5b296b18abd3e`다. 실행 로그·재열기 문서·결과 JSON은 gitignored `docs/jobs/todo/document-conversion-engines-20261008/evidence/`에, 동일 입력의 과거/신규 성능 비교와 PSS 원자료는 인접 baseline worktree의 `docs/jobs/todo/converter-baseline-20261008/`에 보존했다. 첫 전체 브라우저 실행은 호스트 메모리 압박과 시험 하네스의 Vite 모듈 중복 import 때문에 22건 후 중단했다. 바인딩을 같은 코어 모듈에서 해제하도록 고친 뒤 위 41건을 새 브라우저에서 전부 다시 실행했다. 앞선 부분 로그는 통과 판정에 사용하지 않는다.

## 동일 입력 성능과 메모리

로컬 Chrome, 같은 브라우저 자동화 스크립트의 3회 순차 실행이다. 최초 시간은 정적 자산·엔진 준비와 파일 변환을 모두 포함하며, 뒤의 두 값은 준비된 세션에서의 변환 시간이다. 다른 사용자 환경의 처리 시간을 보증하지 않는다.

| 입력 SHA-256 / 작업 | 기존 경로 1·2·3회 | 새 경로 1·2·3회 | 결과 확인 |
| --- | --- | --- | --- |
| rich.docx `da5e2c1587da5bbb63306f6d5287cbd18107950ae93d07a86d7407ed1bfef473` → PDF | 11.447 / 6.233 / 6.412초 | **3.229 / 0.108 / 0.090초** | 새 PDF 3개를 다시 열어 한글, 2페이지, 그림·표를 확인. 새 Office 엔진의 준비 진행률 90%는 첫 실행 약 1.937초; 기존 경로는 약 10.441초. |
| rich.pdf `c8ce91d273c252f1bfcfa5622c017b0442aeed762cedd92766cc765a80543b1c` → DOCX | **5.447 / 1.665 / 1.500초** | 11.510 / **1.062 / 1.090초** | 새 DOCX는 한국어, 그림 1개·표 2개; 기존 결과는 같은 입력에서 그림·표 0개. 새 코어의 최초 실행은 더 느리다. PDF 엔진 준비 시간만을 따로 계측하지 않았으므로 최초 11.510초 전체를 적재 시간으로 부르지 않는다. |

별도 Chrome PSS 실측은 rich.pdf 12파일 연속 DOCX와 6페이지 **동일한 30.7MP 스캔 비트맵을 공유하는** PDF→페이지 이미지 PPTX를 순서대로 처리했다. 12파일은 같은 Bento Worker를 재사용했으며, 엔진 초기 적재를 포함한 첫 작업은 11.951초, 뒤 11개는 약 0.994–1.178초였다. PSS는 최초 브라우저 약 508MiB에서 첫 작업 중 최고 약 1,223MiB로 올랐고, 이후 12번째 파일 종료 무렵 약 1,091MiB로 계속 증가하지 않았다. 공유 이미지 고해상도 출력은 4.184초, 화면 50ms heartbeat 최대 지연 236.815ms, 브라우저 프로세스 합산 최고 **1,311.9MiB(1.281GiB)**였다. 명시적 세션 해제 후 마지막 관찰은 약 758.8MiB이고 생성된 Worker 15개가 모두 닫혔다. 브라우저 캐시/GC를 강제하지 않았으므로 초기 508MiB로 돌아갔다고 주장하지 않는다. 서로 다른 고해상도 페이지 6개에 대한 별도 측정은 추가 확인 중이다.

## 확인된 한계

- 스캔 PDF에서 OCR을 끄면 문서의 시각 페이지를 보존하지만 이미지 속 글자는 편집할 수 없다. 디지털 제목과 스캔 본문이 한 페이지에 섞여 있고 OCR을 끈 경우에도 그 페이지는 전체 이미지로 대체될 수 있으며 경고를 남긴다. 회전 디지털 페이지의 DOCX 역시 pdf2docx 누락을 피하려고 이미지 대체를 사용한다.
- OCR 자동은 인식 필요한 페이지를 골라 적용하고 기존 글자층 중복을 줄인다. 글자 영역과 흑백 그림이 겹치는 특수 원본, 모든 폰트·도장·벡터 도형의 편집 가능한 동일 복원은 증명하지 않았다. 색 그림 충돌에서는 원본 이미지로 대체하고 페이지별 경고를 남긴다.
- PDF에 남지 않은 Excel의 원래 수식·차트는 복원하지 않는다. Bento 표 탐지로 찾지 못한 스캔 표는 빈 XLSX 성공 대신 이유를 반환한다. Stirling의 전체 표 셀 유형·다단 분석은 아직 포팅되지 않았다.
- HWP/HWPX **입력→PDF**는 Bento Office 지원 6형식에 포함되지 않아 기존 수동 인쇄 경로를 유지한다. PDF→HWPX 출력은 브라우저 배치 ZIP에서 동작한다.
- 이 기록은 작업 브랜치 검증이다. 정식 묶음 검수·통합 반영·배포 결과로 표기하지 않는다.
