# Worklazy Tools

GitHub Pages에서 실행되는 브라우저 기반 업무 파일 도구입니다. 파일과 암호를 서버로 업로드하지 않고 Web Worker와 WebAssembly에서 처리합니다.

## 제공 기능

모든 긴 작업은 단계별 진행률과 경과 시간이 포함된 처리 로그를 표시합니다. 파일 읽기, 시트·페이지 복사, Python WASM·OCR 초기화, 문서 구조 분석, 결과 저장과 암호화 상태를 작업 후에도 확인할 수 있습니다.

### Excel Merger

- `.xlsx`, `.csv`: ExcelJS로 처리
- `.xls`: SheetJS로 읽은 뒤 XLSX 결과에 병합
- 시트별·세로·가로 병합
- 수식 유지 또는 계산 결과만 복사
- 세로·가로 병합 시 상대 위치에 맞춰 수식 참조 보정
- 암호화된 Excel 입력 감지 및 브라우저 내 복호화
- 결과 `.xlsx`에 파일 열기 암호 적용
- 일반 셀 서식, 병합 셀, 행 높이와 열 너비 복사

셀 위 이미지와 Excel 표 개체 같은 일부 고급 요소는 완전히 보존되지 않을 수 있으며, 결과 화면에서 경고를 표시합니다. CSV는 수식·서식·여러 시트를 저장할 수 없는 입력 형식이므로 결과는 XLSX로 생성합니다.

### Word Compare

- 수정 전·후 `.docx`를 여러 개 선택하고 드래그로 비교 순서 변경
- 같은 순번의 문서를 쌍으로 묶어 본문, 표, 머리말·꼬리말 일괄 비교
- 여러 문서 쌍의 다중 동시 비교 웹 화면 및 개별 `.xlsx` 보고서 생성
- Word 검토 탭에서 수락·거부할 수 있는 변경 추적 `.docx` 생성
- 양쪽 파일 개수가 다르면 오류를 표시하고 비교 차단
- Pyodide의 Python `difflib`을 Web Worker에서 실행
- 기존 작성자의 메모와 변경 기록을 유지한 변경 추적 DOCX 생성

Word가 화면에서 계산하는 자동 번호와 필드 결과, 일부 고급 레이아웃은 Microsoft Word COM 없이 완전히 재현할 수 없어 결과 화면에 한계를 안내합니다.

### PDF Tools

- 여러 PDF 페이지 썸네일을 끌어서 순서 변경, 선택, 삭제, 90도 회전 후 병합·추출
- 화면에서는 CSS로 회전 결과를 즉시 표시하고 출력 PDF에는 원본 각도와 사용자 회전값을 합산해 기록
- 선택 페이지를 하나의 PDF로 추출하거나 페이지별 PDF ZIP으로 분할
- 여러 개의 파일명·페이지 범위 입력 행으로 범위마다 별도 PDF를 생성하고 ZIP 다운로드
- JPG·PNG 이미지 순서 변경 후 A4 맞춤 또는 이미지 크기의 PDF 생성
- PDF 페이지를 PNG·JPG로 순차 렌더링하고 ZIP 다운로드
- PDF 내장 텍스트를 DOCX·XLSX·TXT로 변환
- 스캔 페이지를 한국어·영어 OCR하고 DOCX·XLSX·TXT 또는 검색 가능한 PDF로 출력
- 긴 작업은 Worker 또는 페이지별 비동기 처리와 단계별 진행률 로그 사용

PDF는 원래 문단과 표 구조를 저장하지 않는 경우가 많으므로 DOCX의 읽기 순서와 XLSX의 행·열은 문자 좌표로 추정합니다. 암호로 보호된 PDF는 보호를 해제한 사본이 필요하며, PDF를 수정하면 기존 디지털 서명은 유효하지 않습니다. 검색 가능한 OCR PDF는 페이지를 이미지로 다시 구성합니다.

## 개인정보 보호

- 선택한 파일과 입력한 암호는 브라우저 메모리에서만 사용합니다.
- 문서 업로드 API와 로그인 기능을 사용하지 않습니다.
- 암호 처리와 문서 비교는 별도 Worker에서 실행하고 작업 후 Worker를 종료합니다.
- Word 비교를 처음 실행할 때 jsDelivr에서 버전이 고정된 Pyodide 런타임을 내려받지만 사용자 문서는 전송하지 않습니다.
- PDF OCR을 처음 실행할 때 한국어·영어 학습 모델과 실행 구성요소를 외부 배포망에서 내려받지만 PDF 페이지와 인식 결과는 전송하지 않습니다.
- 정적 호스팅, Pyodide·OCR CDN과 Google AdSense의 일반 웹 요청은 작업 문서 처리와 별개이며, 자세한 내용은 사이트의 개인정보처리방침에 고지합니다.

## SEO 및 AdSense

- History API 기반 경로와 경로별 정적 HTML 출력
- 페이지별 title, description, canonical, Open Graph와 JSON-LD
- `sitemap.xml`, `robots.txt`, Web App manifest와 SVG 아이콘
- 개인정보처리방침, 이용약관, 문의, 서비스 소개 페이지
- AdSense 게시자 메타 태그와 공통 스크립트
- `ads.txt`: `pub-8940087269746960`

AdSense와 Search Console의 배포 후 설정, CMP, GitHub Pages 루트 `ads.txt` 주의점은 [`docs/PUBLISHING_CHECKLIST.md`](docs/PUBLISHING_CHECKLIST.md)에 정리했습니다.

## 개발 및 검증

```bash
npm ci
npm run dev
npm run build
npm run test:static
npm run test:browser
```

브라우저 스모크 테스트는 Chrome과 로컬 Vite 서버가 필요합니다. XLSX·CSV·XLS 병합, 암호 입력과 출력, 수식 보정, DOCX 비교·보고서, PDF 회전 저장, 분할, 이미지 양방향 변환과 DOCX·XLSX·TXT 변환을 확인합니다. PDF 기능만 빠르게 확인하려면 `TEST_SCOPE=pdf npm run test:browser`를 사용합니다.

## GitHub Pages 배포

`.github/workflows/deploy-pages.yml`이 `main` 브랜치 변경을 빌드해 `dist`를 GitHub Pages에 배포합니다. 저장소의 **Settings → Pages → Source**를 **GitHub Actions**로 설정하면 됩니다. 워크플로는 프로젝트 Pages 기본 경로를 자동 적용하고, 알려진 모든 경로에 정적 `index.html`을 생성해 직접 접속과 새로고침도 지원합니다.

배포 기본값은 커스텀 도메인 `https://worklazy.net/`과 루트 경로 `/`로 설정되어 있어 공개 주소에 `/worklazytools`가 붙지 않습니다. GitHub Pages 설정과 DNS 연결 방법, 다른 도메인으로 변경할 때의 점검 항목은 게시 체크리스트를 참고하세요.

## 라이선스와 브랜드

Worklazy Tools가 직접 작성한 코드, UI, 문서와 고유 시각 자료는 [`LICENSE`](LICENSE)의 All Rights Reserved 조건을 적용합니다. 공식 사이트를 이용하는 것은 허용되지만, 별도 서면 허가 없이 복제·재배포·미러 사이트 운영·경쟁 서비스 제공·복제본의 광고 또는 유료 수익화는 허용하지 않습니다. Worklazy Tools 명칭과 로고를 제휴나 공식 서비스로 오인하게 사용하는 것도 허용하지 않습니다.

오픈소스 라이브러리와 제3자 자료는 위 조건의 대상이 아니며 각 원 라이선스가 그대로 적용됩니다. 직접 의존성과 런타임 리소스 고지는 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)에서 확인할 수 있고, 배포 빌드에는 설치된 프로덕션 의존성의 라이선스 전문 묶음이 포함됩니다.
