export interface SeoDefinition {
  title: string;
  description: string;
  noIndex?: boolean;
  application?: {
    name: string;
    featureList: string[];
  };
}

export const seoByPath: Record<string, SeoDefinition> = {
  "/": {
    title: "무료 문서·PDF·비디오·이미지 업무 도구 | Worklazy Tools",
    description: "설치와 로그인 없이 Excel·Word·HWP·PDF·비디오·이미지 작업을 실행하세요. 작업 파일은 서버에 업로드하지 않고 브라우저에서 처리합니다.",
  },
  "/tools": {
    title: "무료 업무 파일 도구 모음 | Worklazy Tools",
    description: "Excel 병합, Word·HWP 문서 비교, HWP 문서 편집, PDF 편집·변환·OCR, 비디오와 이미지 편집을 브라우저에서 실행하세요.",
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
    description: "PDF 내장 텍스트와 브라우저 한국어·영어 OCR로 DOCX, XLSX, TXT와 검색 가능한 PDF를 만드세요.",
    application: { name: "PDF 문서 변환·OCR", featureList: ["PDF DOCX 변환", "PDF XLSX 변환", "PDF TXT 변환", "한국어·영어 OCR", "검색 가능한 PDF"] },
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
    description: "최대 6개 영상을 6개 그룹으로 나누고 구간·순서·동기 재생·분할 전체화면을 확인한 뒤 개별 저장하거나 이어붙이세요.",
    application: { name: "Video Studio", featureList: ["최대 6개 영상·6개 그룹", "그룹별 동기 재생과 분할 전체화면", "드래그 순서 변경", "그룹별 개별 출력·이어붙이기", "인코딩 없는 패스스루", "원본 비율 유지·해상도 일괄 변경", "GIF·MP3·AAC 변환"] },
  },
  "/tools/image-studio": {
    title: "온라인 이미지 편집 - 일괄 리사이즈·워터마크·콜라주·GIF",
    description: "클립보드 이미지를 붙여넣고 자르기·필터·레이어 편집, 일괄 리사이즈·워터마크, 미리보기가 있는 이어붙이기·콜라주와 GIF 생성을 실행하세요.",
    application: { name: "Image Studio", featureList: ["클립보드 이미지 붙여넣기", "이미지 레이어 편집", "필터와 자르기", "일괄 리사이즈", "워터마크", "이어붙이기 실시간 미리보기", "GIF 애니메이션"] },
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

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
