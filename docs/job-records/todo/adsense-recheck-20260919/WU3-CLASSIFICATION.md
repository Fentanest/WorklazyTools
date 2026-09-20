# WU3 저장소 부산물 분류표

- 작업 ID: `adsense-recheck-20260919 / WU3`
- 기준 HEAD: `1d6302785ffb16163a501948d465f0c687683e85`
- 정본: PLAN v0.3, SHA-256 `40c69eeb25b6ec4c…`, §5
- 대상 산식: `git ls-files evidence scratch 'patch_*.py' test-drag.html integration_status.md`
- 전수성: **138개 입력 / 138행**. 아래 표는 위 명령의 경로를 정렬 변경 없이 그대로 싣는다.
- 6종 패턴: 이메일·전화·토큰·비밀번호·주민번호·계좌. 후보값은 마스킹 문맥으로 재판별했다.

| 경로 | 종류 | 민감정보 확인 방법·결과 | 재생성 가능 | 테스트·스크립트 사용처 | 공개 필요 | 처리 | 근거 |
|---|---|---|---|---|---|---|---|
| evidence/corpus/fixtures/blank.pdf | 합성 PDF fixture | pdftotext 전 페이지: 공백; pdfimages: 0개; pdfdetach: 첨부 0개; 6종 패턴 0건 → **미확인** | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/changed-color-cmap.txt | 합성 ToUnicode CMap | 텍스트 6종 패턴: 0건 | 예(격리 생성 확인) | fixture 생성·검증 보조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물 |
| evidence/corpus/fixtures/changed-color.pdf | 합성 PDF fixture | pdftotext 전 페이지 + pdfimages(0) + pdfdetach(첨부 0) + 6종 패턴: 0건 | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/changed-ko-cmap.txt | 합성 ToUnicode CMap | 텍스트 6종 패턴: 0건 | 예(격리 생성 확인) | fixture 생성·검증 보조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물 |
| evidence/corpus/fixtures/changed-ko.pdf | 합성 PDF fixture | pdftotext 전 페이지 + pdfimages(0) + pdfdetach(첨부 0) + 6종 패턴: 0건 | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/changed-number-cmap.txt | 합성 ToUnicode CMap | 텍스트 6종 패턴: 0건 | 예(격리 생성 확인) | fixture 생성·검증 보조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물 |
| evidence/corpus/fixtures/changed-number.pdf | 합성 PDF fixture | pdftotext 전 페이지 + pdfimages(0) + pdfdetach(첨부 0) + 6종 패턴: 0건 | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/changed-word-cmap.txt | 합성 ToUnicode CMap | 텍스트 6종 패턴: 0건 | 예(격리 생성 확인) | fixture 생성·검증 보조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물 |
| evidence/corpus/fixtures/changed-word.pdf | 합성 PDF fixture | pdftotext 전 페이지 + pdfimages(0) + pdfdetach(첨부 0) + 6종 패턴: 0건 | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/historical.pdf | 합성 PDF fixture | pdftotext 전 페이지 + pdfimages(0) + pdfdetach(첨부 0) + 6종 패턴: 0건 | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/image.pdf | 합성 PDF fixture | pdftotext 전 페이지: 공백; pdfimages: 1개; pdfdetach: 첨부 0개; 6종 패턴 0건 → **미확인** | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/large-blank.pdf | 합성 PDF fixture | pdftotext 전 페이지: 공백; pdfimages: 0개; pdfdetach: 첨부 0개; 6종 패턴 0건 → **미확인** | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/manifest.json | fixture manifest | 텍스트 6종 패턴: 0건 | 예(격리 생성, 원본과 byte 동일) | PDF 비교 smoke/golden 입력 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물·참조 정본 |
| evidence/corpus/fixtures/multi.pdf | 합성 PDF fixture | pdftotext 전 페이지 + pdfimages(0) + pdfdetach(첨부 0) + 6종 패턴: 0건 | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/normal-ascii-cmap.txt | 합성 ToUnicode CMap | 텍스트 6종 패턴: 0건 | 예(격리 생성 확인) | fixture 생성·검증 보조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물 |
| evidence/corpus/fixtures/normal-ascii.pdf | 합성 PDF fixture | pdftotext 전 페이지 + pdfimages(0) + pdfdetach(첨부 0) + 6종 패턴: 0건 | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/normal-ko-cmap.txt | 합성 ToUnicode CMap | 텍스트 6종 패턴: 0건 | 예(격리 생성 확인) | fixture 생성·검증 보조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물 |
| evidence/corpus/fixtures/normal-ko.pdf | 합성 PDF fixture | pdftotext 전 페이지 + pdfimages(0) + pdfdetach(첨부 0) + 6종 패턴: 0건 | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/normal-number-cmap.txt | 합성 ToUnicode CMap | 텍스트 6종 패턴: 0건 | 예(격리 생성 확인) | fixture 생성·검증 보조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물 |
| evidence/corpus/fixtures/normal-number.pdf | 합성 PDF fixture | pdftotext 전 페이지 + pdfimages(0) + pdfdetach(첨부 0) + 6종 패턴: 0건 | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/corpus/fixtures/small-blank.pdf | 합성 PDF fixture | pdftotext 전 페이지: 공백; pdfimages: 0개; pdfdetach: 첨부 0개; 6종 패턴 0건 → **미확인** | 예(격리 생성 확인) | `tests/pdf-compare-{smoke,golden}.mjs`가 디스크 URL로 참조 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 생성기 산출물; manifest 연결 또는 경계조건 fixture |
| evidence/empty-failed.xlsx | XLSX 테스트 산출물 | ZIP package 10개 항목 전수(sharedStrings·sheet·docProps 작성자·rels target 포함); 테마 각도값만 전화 후보 오탐, 민감 0건 | 예(테스트 산출물) | 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | PLAN §5 기본 처리안 |
| evidence/multi.zip | ZIP 테스트 산출물 | 목록 2개 + 내부 XLSX 각 10개 항목 전수; docProps·rels 포함; 테마 각도값만 오탐, 민감 0건 | 예(테스트 산출물) | 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | PLAN §5 기본 처리안 |
| evidence/partial.xlsx | XLSX 테스트 산출물 | ZIP package 10개 항목 전수(sharedStrings·sheet·docProps 작성자·rels target 포함); 테마 각도값만 전화 후보 오탐, 민감 0건 | 예(테스트 산출물) | 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | PLAN §5 기본 처리안 |
| evidence/smoke-results.json | JSON 테스트 결과 | 텍스트 6종 패턴: 0건 | 예(스모크 결과) | 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | PLAN §5 기본 처리안 |
| evidence/unchanged.xlsx | XLSX 테스트 산출물 | ZIP package 10개 항목 전수(sharedStrings·sheet·docProps 작성자·rels target 포함); 테마 각도값만 전화 후보 오탐, 민감 0건 | 예(테스트 산출물) | 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | PLAN §5 기본 처리안 |
| evidence/vite-cache/deps/@zip__js_zip__js.js | Vite 최적화 캐시 | 텍스트 6종 패턴; 후보는 해시·상수·API명·공개 OSS 저자 표기로 판별, 민감 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/@zip__js_zip__js.js.map | Vite 최적화 캐시 | 텍스트 6종 패턴; 후보는 해시·상수·API명·공개 OSS 저자 표기로 판별, 민감 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/_metadata.json | Vite 최적화 캐시 | 텍스트 6종 패턴; 후보는 해시·상수·API명·공개 OSS 저자 표기로 판별, 민감 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/chunk-5C6BLAQG.js | Vite 최적화 캐시 | 텍스트 6종 패턴; 후보는 해시·상수·API명·공개 OSS 저자 표기로 판별, 민감 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/chunk-5C6BLAQG.js.map | Vite 최적화 캐시 | 텍스트 6종 패턴; 후보는 해시·상수·API명·공개 OSS 저자 표기로 판별, 민감 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/chunk-VUNV25KB.js | Vite 최적화 캐시 | 텍스트 6종 패턴: 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/chunk-VUNV25KB.js.map | Vite 최적화 캐시 | 텍스트 6종 패턴: 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/exceljs.js | Vite 최적화 캐시 | 텍스트 6종 패턴; 후보는 해시·상수·API명·공개 OSS 저자 표기로 판별, 민감 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/exceljs.js.map | Vite 최적화 캐시 | 텍스트 6종 패턴; 후보는 해시·상수·API명·공개 OSS 저자 표기로 판별, 민감 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/jszip.js | Vite 최적화 캐시 | 텍스트 6종 패턴; 후보는 해시·상수·API명·공개 OSS 저자 표기로 판별, 민감 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/jszip.js.map | Vite 최적화 캐시 | 텍스트 6종 패턴; 후보는 해시·상수·API명·공개 OSS 저자 표기로 판별, 민감 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/package.json | Vite 최적화 캐시 | 텍스트 6종 패턴: 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/tesseract__js.js | Vite 최적화 캐시 | 텍스트 6종 패턴: 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/tesseract__js.js.map | Vite 최적화 캐시 | 텍스트 6종 패턴; 후보는 해시·상수·API명·공개 OSS 저자 표기로 판별, 민감 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/zip-reader-YA4FT6BJ.js | Vite 최적화 캐시 | 텍스트 6종 패턴: 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| evidence/vite-cache/deps/zip-reader-YA4FT6BJ.js.map | Vite 최적화 캐시 | 텍스트 6종 패턴: 0건 | 예(Vite 재생성) | 제품 소스의 직접 경로 참조 없음 | 아니오 | `git rm --cached`; 디스크 보존; `evidence/` ignore | 재생성 캐시 |
| integration_status.md | 내부 현황표 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/integration_status.md` 이동 | 내부 작업 현황; archive는 git 제외 |
| patch_adsense.py | 루트 일회성 패치 스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/patch_adsense.py` 이동; root ignore | 내부 일회성 스크립트 |
| patch_app.py | 루트 일회성 패치 스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/patch_app.py` 이동; root ignore | 내부 일회성 스크립트 |
| patch_appshell.py | 루트 일회성 패치 스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/patch_appshell.py` 이동; root ignore | 내부 일회성 스크립트 |
| patch_desc.py | 루트 일회성 패치 스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/patch_desc.py` 이동; root ignore | 내부 일회성 스크립트 |
| patch_guide_data.py | 루트 일회성 패치 스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/patch_guide_data.py` 이동; root ignore | 내부 일회성 스크립트 |
| patch_hwp.py | 루트 일회성 패치 스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/patch_hwp.py` 이동; root ignore | 내부 일회성 스크립트 |
| patch_makepage.py | 루트 일회성 패치 스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/patch_makepage.py` 이동; root ignore | 내부 일회성 스크립트 |
| patch_notes.py | 루트 일회성 패치 스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/patch_notes.py` 이동; root ignore | 내부 일회성 스크립트 |
| patch_pdf_editor.py | 루트 일회성 패치 스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/patch_pdf_editor.py` 이동; root ignore | 내부 일회성 스크립트 |
| scratch/add-test-i18n.js | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/add-test-i18n.js` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/add-test-i18n.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/add-test-i18n.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/content_plan.md | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/content_plan.md` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/current_seo.txt | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/current_seo.txt` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/dom.html | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/dom.html` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/dump-dom.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/dump-dom.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/en-guides-in-en.json | scratch 내부 자료/스크립트 | 텍스트 6종 패턴; 후보는 제품 문구·URL 숫자·커밋 ID로 판별, 민감 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/en-guides-in-en.json` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/en_pages.json | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/en_pages.json` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/en_paths.json | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/en_paths.json` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/en_tools.json | scratch 내부 자료/스크립트 | 텍스트 6종 패턴; 후보는 제품 문구·URL 숫자·커밋 ID로 판별, 민감 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/en_tools.json` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/extract-all-guides.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/extract-all-guides.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/extract-ko-guides.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/extract-ko-guides.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/extract-seo-faqs.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/extract-seo-faqs.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/extract-seo.js | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/extract-seo.js` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/extract_prompt.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/extract_prompt.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/extract_subagent.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/extract_subagent.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/find-guides.js | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/find-guides.js` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/find-guides.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/find-guides.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/fix-document-redactor.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/fix-document-redactor.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/fix-guides-content.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/fix-guides-content.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/fix-guides-faqs.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/fix-guides-faqs.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/fix-guides.js | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/fix-guides.js` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/full_plan.md | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/full_plan.md` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/full_seo_en.json | scratch 내부 자료/스크립트 | 텍스트 6종 패턴; 후보는 제품 문구·URL 숫자·커밋 ID로 판별, 민감 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/full_seo_en.json` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/full_seo_ko.json | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/full_seo_ko.json` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/generate_seo.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/generate_seo.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/generate_status.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/generate_status.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/inspect.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/inspect.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/integrated_prompt.txt | scratch 내부 자료/스크립트 | 텍스트 6종 패턴; 후보는 제품 문구·URL 숫자·커밋 ID로 판별, 민감 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/integrated_prompt.txt` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/ko-guides-in-en.json | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/ko-guides-in-en.json` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/merge-guides.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/merge-guides.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/move-pdf-guides.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/move-pdf-guides.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/parse_full_plan.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/parse_full_plan.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/parse_path_blocks.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/parse_path_blocks.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/parse_plan.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/parse_plan.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/parse_seo_prompts.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/parse_seo_prompts.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/parsed_pages.json | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/parsed_pages.json` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/parsed_paths.json | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/parsed_paths.json` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/parsed_seo.json | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/parsed_seo.json` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/parsed_tools.json | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/parsed_tools.json` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-audio-colors.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-audio-colors.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-audio.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-audio.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-fallback.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-fallback.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-featureMessage.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-featureMessage.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-image-privacy-colors.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-image-privacy-colors.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-notice.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-notice.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-office-f07.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-office-f07.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-office-smoke.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-office-smoke.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-pdf-config.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-pdf-config.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-pdfPreview.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-pdfPreview.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-pdfeditor.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-pdfeditor.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-pdfjs-dist.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-pdfjs-dist.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-security-colors.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-security-colors.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-seo.js | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-seo.js` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-smoke-auto.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-smoke-auto.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-smoke2.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-smoke2.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-theme.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-theme.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch-withfaq.js | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch-withfaq.js` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch_guides.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch_guides.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch_guides_en.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch_guides_en.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch_pdf.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch_pdf.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch_seo.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch_seo.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch_seo_en.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch_seo_en.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch_tools.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch_tools.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/patch_tools_en.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/patch_tools_en.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/refactor.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/refactor.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/replace-toolguide-final.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/replace-toolguide-final.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/replace-toolguide-real.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/replace-toolguide-real.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/replace-toolguide.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/replace-toolguide.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/replace-toolguide.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/replace-toolguide.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/replace-toolguide2.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/replace-toolguide2.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/replace-toolguide3.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/replace-toolguide3.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/replace-toolguide4.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/replace-toolguide4.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/replace-toolguide5.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/replace-toolguide5.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/save_en_translations.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/save_en_translations.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/seo-faqs.js | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/seo-faqs.js` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/seo_agent_prompt.txt | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/seo_agent_prompt.txt` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/seo_en_prompt.txt | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/seo_en_prompt.txt` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/test-css-var-canvas.html | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/test-css-var-canvas.html` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/test-dom.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/test-dom.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/test-hsl-canvas.html | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/test-hsl-canvas.html` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/test-string.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/test-string.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/test_static.mjs | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/test_static.mjs` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/update_en_guides.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴; 후보는 제품 문구·URL 숫자·커밋 ID로 판별, 민감 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/update_en_guides.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| scratch/update_ko_guides.py | scratch 내부 자료/스크립트 | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/scratch/update_ko_guides.py` 이동; `scratch/` ignore | 내부 프롬프트·계획 원문·일회성 자료 |
| test-drag.html | 일회성 HTML | 텍스트 6종 패턴: 0건 | 아니오(보존 대상) | src/scripts/tests/package/.github 참조 없음 | 아니오 | 추적 해제 후 `archive/test-drag.html` 이동; root ignore | 수동 실험 파일 |

## 참조 조사 요약

- `tests/pdf-compare-smoke.mjs`와 `tests/pdf-compare-golden.mjs`가 `evidence/corpus/fixtures/manifest.json` 및 PDF URL을 참조한다. 디스크 파일을 보존하므로 추적 해제와 양립한다.
- 나머지 `evidence` 결과는 직접 경로 참조가 없고, 검색된 다른 “evidence” 문자열은 일반 변수·증거 개념 또는 별도 출력 디렉터리다.
- `scratch`, 루트 `patch_*.py`, `test-drag.html`, `integration_status.md`의 실행 경로 참조는 없다.

## 대상 밖 보존 항목

원본 작업트리 `/home/better0101/projects/worklazytools`의 untracked `patch_*.py` 4개·`scratch/*.py` 14개와 `patch_notes.py` 로컬 수정은 이 worktree에 없으므로 **원본 작업트리·WU3 미처리·보존**이다. WU3에서는 읽기·복사·수정·삭제하지 않았다.

## 미확인 목록

- `evidence/corpus/fixtures/blank.pdf`: 전 페이지 추출 텍스트 공백, 이미지 0, 첨부 0.
- `evidence/corpus/fixtures/small-blank.pdf`: 전 페이지 추출 텍스트 공백, 이미지 0, 첨부 0.
- `evidence/corpus/fixtures/large-blank.pdf`: 전 페이지 추출 텍스트 공백, 이미지 0, 첨부 0.
- `evidence/corpus/fixtures/image.pdf`: 전 페이지 추출 텍스트 공백, 이미지 1, 첨부 0.

네 파일은 내용 기반 민감정보 검사를 완료로 판정하지 않았다. 다만 저장소의 합성 fixture 생성기가 동일 경로를 재생성하고, 디스크 원본은 삭제하지 않고 보존한다.
