export interface SeoDefinition {
  title: string;
  description: string;
  noIndex?: boolean;
  application?: {
    name: string;
    featureList: string[];
  };
}

export const socialImage = {
  path: "social/worklazy-tools-share.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Worklazy Tools - 파일 업로드 없이 브라우저에서 실행하는 업무 도구",
} as const;

export const seoByPath: Record<string, SeoDefinition> = {
  "/": {
    title: "무료 문서·PDF·비디오·이미지 업무 도구 | Worklazy Tools",
    description: "설치와 로그인 없이 문서·미디어 편집, 텍스트·데이터 변환, 일정·급여 계산과 보안 도구를 실행하세요. 입력은 브라우저에서 처리합니다.",
  },
  "/tools": {
    title: "무료 업무 파일 도구 모음 | Worklazy Tools",
    description: "문서·미디어 편집부터 텍스트, 데이터, 일정, 급여, 보안, QR 도구까지 브라우저에서 무료로 실행하세요.",
  },
  "/tools/excel-merger": {
    title: "Excel 파일 병합 - XLSX·XLS·XLSB·XLSM·CSV 합치기",
    description: "여러 XLSX, XLS, XLSB, XLSM, CSV 파일을 하나의 XLSX로 병합하세요. XLSX 수식·서식 보존과 암호 입출력을 지원하며 파일은 브라우저에서 처리됩니다.",
    application: {
      name: "Excel Merger",
      featureList: ["XLSX·XLS·XLSB·XLSM·CSV 병합", "시트별·세로·가로 병합", "끝 여백 정리", "연속 빈 행·열 SheetTrim", "XLSX 수식·서식 보존", "암호화 파일 입출력"],
    },
  },
  "/tools/word-compare": {
    title: "Word 문서 비교 - DOCX 텍스트 Diff·변경 추적",
    description: "수정 전후 Word 문서의 본문과 문장을 웹에서 Diff 비교하고 추가·삭제 내용을 확인하세요. 계약서·기획 문서·표·서식·메모·개요 번호와 변경 추적 DOCX도 지원합니다.",
    application: {
      name: "Word Compare",
      featureList: ["문단·문장 텍스트 Diff", "추가·삭제 내용 하이라이트", "DOCX 본문·서식 비교", "표 구조 변경 비교", "머리말·꼬리말·메모 비교", "Excel 비교 보고서", "Word 변경 추적 DOCX"],
    },
  },
  "/tools/pdf-editor": {
    title: "PDF 편집·병합·분할·페이지 추출 - 무료 온라인 PDF 도구",
    description: "PDF 페이지를 미리 보며 순서 변경·회전·선택하고 하나의 PDF, 여러 범위별 PDF 또는 페이지별 PDF로 저장하세요.",
    application: {
      name: "PDF 페이지 편집·병합·추출",
      featureList: ["PDF 다중 병합", "페이지 순서 변경", "90도 회전", "선택 페이지 추출", "여러 범위별 PDF 분할", "페이지별 PDF 분할"],
    },
  },
  "/tools/pdf-editor/image-to-pdf": {
    title: "JPG·PNG 이미지를 PDF로 변환 - 무료 온라인 도구",
    description: "여러 JPG·PNG 이미지 순서를 바꾸고 A4 맞춤 또는 이미지 크기의 하나의 PDF로 변환하세요.",
    application: { name: "이미지를 PDF로 변환", featureList: ["JPG PDF 변환", "PNG PDF 변환", "이미지 순서 변경", "A4 자동 맞춤"] },
  },
  "/tools/pdf-editor/pdf-to-image": {
    title: "PDF를 PNG·JPG 이미지로 변환 - ZIP 다운로드",
    description: "PDF의 모든 페이지를 원하는 해상도의 PNG 또는 JPG 이미지로 변환해 ZIP으로 내려받으세요.",
    application: { name: "PDF를 이미지로 변환", featureList: ["PDF PNG 변환", "PDF JPG 변환", "해상도 선택", "ZIP 일괄 다운로드"] },
  },
  "/tools/pdf-editor/convert": {
    title: "PDF를 DOCX·XLSX·TXT로 변환·한국어 OCR",
    description: "원하는 PDF 페이지를 골라 자체 호스팅 한국어·영어 OCR로 DOCX, XLSX, TXT와 검색 가능한 PDF를 만드세요.",
    application: { name: "PDF 문서 변환·OCR", featureList: ["처리 페이지 범위 선택", "PDF DOCX 변환", "PDF XLSX 변환", "PDF TXT 변환", "로컬 한국어·영어 OCR", "검색 가능한 PDF"] },
  },
  "/tools/hwp-editor": {
    title: "HWP·HWPX 문서 편집기 - 무료 온라인 HWP 편집",
    description: "HWP와 HWPX 문서를 공식 rhwp Studio에서 열어 본문·서식·표·개체를 편집하고 HWP·HWPX·HML로 저장하세요.",
    application: { name: "HWP Editor", featureList: ["HWP·HWPX·HML 문서 열기", "본문과 글자 서식 편집", "표·그림·도형·수식 편집", "실행 취소와 문서 찾기", "HWP·HWPX 저장", "HWP 재열기 검증"] },
  },
  "/tools/hwp-compare": {
    title: "HWP 문서 비교 - 한글 문서 텍스트 Diff·표 변경 확인",
    description: "수정 전후 HWP·HWPX 문서의 본문과 문장을 웹에서 Diff 비교하고 추가·삭제 내용을 확인하세요. 계약서·개요 번호·서식·표 구조 변경과 Excel 보고서도 지원합니다.",
    application: { name: "HWP Compare", featureList: ["HWP 문단·문장 텍스트 Diff", "추가·삭제 내용 하이라이트", "HWP·HWPX 본문 비교", "개요 번호·서식 비교", "스마트 표 행·열 비교", "머리말·꼬리말·각주·미주", "Excel 비교 보고서", "다중 동시 비교"] },
  },
  "/tools/video-studio": {
    title: "온라인 비디오 편집·그룹별 이어붙이기 - GIF·MP3·AAC 변환",
    description: "최대 6개 영상을 그룹별로 자르고 이어붙이세요. 지원 브라우저의 멀티스레드 FFmpeg 인코딩과 MKV·AVI 메타데이터 대체 분석을 제공합니다.",
    application: { name: "Video Studio", featureList: ["최대 6개 영상·6개 그룹", "지원 브라우저 멀티스레드 인코딩", "영상별 예상 시간", "MKV·AVI 메타데이터 대체 분석", "그룹별 동기 재생과 분할 전체화면", "드래그 순서 변경", "그룹별 개별 출력·이어붙이기", "인코딩 없는 패스스루", "모바일 권장 설정", "GIF·MP3·AAC 변환"] },
  },
  "/tools/image-studio": {
    title: "온라인 이미지 편집 - 일괄 리사이즈·워터마크·콜라주·GIF",
    description: "사진 편집과 그림판을 하나로 합쳐 자르기·필터·자유 그리기·레이어·Undo를 사용하고, 일괄 리사이즈·콜라주·GIF도 만드세요.",
    application: { name: "Image Studio", featureList: ["사진·빈 캔버스 통합 편집", "연필·붓·지우개", "Undo·Redo", "필터와 자르기", "텍스트·도형 레이어", "일괄 리사이즈", "워터마크", "콜라주", "GIF 애니메이션"] },
  },
  "/tools/text-tools": {
    title: "텍스트 정돈·케이스 변환 - 공백·줄바꿈·중복 줄 제거",
    description: "불필요한 공백과 줄바꿈, 중복 줄을 제거하고 Camel·Snake·Kebab·Title Case 변환과 로컬 한국어 문장 검사를 실행하세요.",
    application: { name: "Text Tools", featureList: ["공백 정돈", "줄바꿈 합치기", "중복 줄 제거", "Camel Case", "Snake Case", "Kebab Case", "한국어 띄어쓰기 가이드"] },
  },
  "/tools/text-formatter": {
    title: "JSON·SQL·XML 포맷터 - 들여쓰기·Minify·문법 검사",
    description: "JSON, SQL, XML 텍스트의 문법 오류를 확인하고 읽기 좋은 들여쓰기 또는 한 줄 Minify 형식으로 정돈하세요.",
    application: { name: "JSON SQL XML Formatter", featureList: ["JSON 포맷", "SQL 정렬", "XML 포맷", "Minify", "문법 오류 탐지"] },
  },
  "/tools/work-calculator": {
    title: "영업일·연차 계산기 - 대한민국 공휴일·대체공휴일 반영",
    description: "주말과 대한민국 법정·대체공휴일을 제외한 영업일과 입사일·회계연도 기준 예상 연차를 계산하세요.",
    application: { name: "영업일 연차 계산기", featureList: ["대한민국 공휴일", "음력 공휴일", "대체공휴일", "직접 휴일 추가", "입사일 기준 연차", "회계연도 기준 연차"] },
  },
  "/tools/timezone-calculator": {
    title: "세계지도 시차·글로벌 회의 시간 계산기 - 도시 시간 비교",
    description: "세계지도에서 도시 핀을 선택하고 IANA 타임존과 서머타임을 반영한 현지 시각과 글로벌 회의 가능 시간을 비교하세요.",
    application: { name: "World Time Planner", featureList: ["인터랙티브 세계지도", "44개 주요 도시 핀", "도시 검색", "IANA 타임존", "서머타임 자동 반영", "최대 6개 도시 비교", "30분 단위 회의 추천"] },
  },
  "/tools/payroll-calculator": {
    title: "주휴수당·월 실수령액·퇴직금 간이 계산기",
    description: "2026년 최신 사회보험 기준으로 주휴수당, 월급 실수령액과 법정 퇴직금을 서버 전송 없이 간이 계산하세요.",
    application: { name: "급여 간이 계산기", featureList: ["주휴수당", "국민연금", "건강보험", "장기요양보험", "고용보험", "근로소득세 추정", "퇴직금"] },
  },
  "/tools/image-privacy": {
    title: "사진 EXIF·GPS 개인정보 제거 - JPG·PNG 메타데이터 삭제",
    description: "JPG·PNG의 GPS 위치, 촬영 기기와 촬영 시각을 확인하고 EXIF가 제거된 사본을 만드세요. HEIC는 지원하지 않습니다.",
    application: { name: "Image Privacy", featureList: ["EXIF 확인", "GPS 위치 확인", "촬영 기기 확인", "촬영 시각 확인", "OffscreenCanvas 재인코딩", "메타데이터 제거"] },
  },
  "/tools/security-tools": {
    title: "안전한 비밀번호 생성기·강도 측정기",
    description: "crypto.getRandomValues 기반 무작위 비밀번호를 만들고 패턴·엔트로피·공격 예상 시간으로 비밀번호 강도를 확인하세요.",
    application: { name: "Password Security", featureList: ["CSPRNG 비밀번호 생성", "8~64자 길이", "문자 종류 선택", "패턴 강도 분석", "엔트로피", "공격 시간 추정"] },
  },
  "/tools/qr-studio": {
    title: "QR 코드 생성기·실시간 카메라 스캐너 - 로고 삽입",
    description: "URL과 텍스트를 로고 포함 QR로 만들고 휴대폰 카메라 또는 업로드한 사진 속 QR 데이터를 브라우저에서 읽으세요.",
    application: { name: "QR Studio", featureList: ["URL QR 생성", "텍스트 QR 생성", "중앙 로고", "실시간 카메라 스캔", "사진 QR 스캔", "모바일 공유·저장"] },
  },
  "/tools/data-converter": {
    title: "CSV·JSON·HTML Table 표 데이터 변환기",
    description: "CSV, JSON 객체 배열과 HTML Table 데이터를 브라우저 Worker에서 서로 변환하고 파일로 저장하세요.",
    application: { name: "Table Data Converter", featureList: ["CSV JSON 변환", "JSON CSV 변환", "HTML Table 변환", "CSV 파일 불러오기", "Worker 파싱", "파일 다운로드"] },
  },
  "/about": {
    title: "서비스 소개 | Worklazy Tools",
    description: "Worklazy Tools가 파일을 서버에 올리지 않고 브라우저에서 문서, PDF, 비디오와 이미지 작업을 처리하는 방법과 지원 범위를 안내합니다.",
  },
  "/privacy": {
    title: "개인정보처리방침 | Worklazy Tools",
    description: "Worklazy Tools의 로컬 파일 처리, 외부 서비스, 광고와 쿠키에 관한 개인정보 처리 방침을 확인하세요.",
  },
  "/terms": {
    title: "이용약관 | Worklazy Tools",
    description: "Worklazy Tools의 무료 브라우저 도구 이용 조건, 지원 범위, 사용자 책임과 면책 사항을 안내합니다.",
  },
  "/contact": {
    title: "문의하기 | Worklazy Tools",
    description: "Worklazy Tools의 오류 제보, 기능 제안, 개인정보 관련 문의 방법을 안내합니다.",
  },
  "/licenses": {
    title: "라이선스 및 제3자 고지 | Worklazy Tools",
    description: "Worklazy Tools 자체 저작물의 이용 조건과 rhwp, ffmpeg.wasm 등 주요 오픈소스 구성요소의 라이선스를 안내합니다.",
  },
};

export function normalizeSeoPath(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

export function getSiteBaseUrl() {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined;
  if (configured) return ensureTrailingSlash(configured);
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}

export function getCanonicalUrl(pathname: string) {
  return new URL(normalizeSeoPath(pathname).replace(/^\//, ""), getSiteBaseUrl()).href;
}

export function getSocialImageUrl() {
  return new URL(socialImage.path, getSiteBaseUrl()).href;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
