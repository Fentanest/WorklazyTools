import enTools from "../locales/en/tools.json" with { type: "json" };
import enSeo from "../locales/en/seo.json" with { type: "json" };
import koSeo from "../locales/ko/seo.json" with { type: "json" };
import { stripLanguagePrefix, type AppLanguage } from "../i18n/languages.ts";

export interface SeoDefinition {
  title: string;
  description: string;
  noIndex?: boolean;
  faq?: Array<{
    question: string;
    answer: string;
  }>;
  application?: {
    name: string;
    featureList: string[];
  };
}

import { getFaqsForPath } from "../i18n/guideData.ts";

export interface SocialImageDefinition {
  path: string;
  width: 1200;
  height: 630;
  type: "image/png";
  alt: string;
}

export const socialImages = {
  ko: {
    path: "social/worklazy-tools-share-ko.png",
    width: 1200,
    height: 630,
    type: "image/png",
    alt: koSeo.socialImageAlt,
  },
  en: {
    path: "social/worklazy-tools-share.png",
    width: 1200,
    height: 630,
    type: "image/png",
    alt: enSeo.socialImageAlt,
  },
} as const;

const socialImageSlugByPath: Record<string, string> = {
  "/tools/document-redactor": "document-redactor",
  "/tools/excel-merger": "excel-merger",
  "/tools/excel-compare": "excel-compare",
  "/tools/excel-cleaner": "excel-cleaner",
  "/tools/document-generator": "document-generator",
  "/tools/document-compare": "document-compare",
  "/tools/pdf-compare": "pdf-compare",
  "/tools/pdf-editor": "pdf-tools",
  "/tools/pdf-editor/image-to-pdf": "image-to-pdf",
  "/tools/pdf-editor/pdf-to-image": "pdf-to-image",
  "/tools/pdf-editor/convert": "pdf-convert",
  "/tools/pdf-editor/finish": "pdf-finish",
  "/tools/pdf-editor/page-numbers": "pdf-page-numbers",
  "/tools/pdf-editor/header-footer": "pdf-header-footer",
  "/tools/pdf-editor/watermark": "pdf-watermark",
  "/tools/pdf-editor/stamp": "pdf-stamp",
  "/tools/pdf-editor/merge": "pdf-editor-merge",
  "/tools/pdf-editor/split": "pdf-editor-split",
  "/tools/pdf-editor/delete": "pdf-editor-delete",
  "/tools/pdf-editor/rotate": "pdf-editor-rotate",
  "/tools/pdf-editor/ocr": "pdf-editor-ocr",
  "/tools/image-studio/resize": "image-studio-resize",
  "/tools/image-studio/mosaic": "image-studio-mosaic",
  "/tools/image-studio/watermark": "image-studio-watermark",
  "/tools/video-studio/trim": "video-studio-trim",
  "/tools/video-studio/merge": "video-studio-merge",
  "/tools/video-studio/extract-audio": "video-studio-extract-audio",
  "/tools/audio-studio/trim": "audio-studio-trim",
  "/tools/hwp-editor": "hwp-editor",
  "/tools/office-editor": "office-editor",
  "/tools/video-studio": "video-studio",
  "/tools/audio-studio": "audio-studio",
  "/tools/image-studio": "image-studio",
  "/tools/text-merger": "text-merger",
  "/tools/text-tools": "text-tools",
  "/tools/text-formatter": "code-formatter",
  "/tools/work-calculator": "workday-calculator",
  "/tools/timezone-calculator": "world-time-planner",
  "/tools/payroll-calculator": "payroll-calculator",
  "/tools/image-privacy": "photo-metadata-remover",
  "/tools/security-tools": "password-generator",
  "/tools/qr-studio": "qr-studio",
  "/tools/qr-studio/bulk": "qr-bulk",
  "/tools/data-converter": "table-data-converter",
};

export const seoByPath: Record<string, SeoDefinition> = {
  "/tools/document-redactor": {title: "개인정보 가리기 | PDF·이미지 영역 가리기", description: "PDF와 JPG·PNG·WebP 이미지의 영역을 직접 검정으로 가리고 새 사본을 저장하세요. 원본은 변경하지 않으며 PDF의 모든 페이지를 이미지로 재생성합니다.", application: {name: "개인정보 가리기", featureList: ["직접 영역 선택", "검정 픽셀 마스킹", "모든 PDF 페이지 재생성", "PNG 이미지 저장", "결과 확인"]}},
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
    description: "여러 XLSX, XLS, XLSB, XLSM, CSV 파일을 하나의 XLSX로 병합하세요. XLSX와 XLS의 수식·서식을 각각 선택해 보존하고 암호 입출력을 지원합니다.",
    application: {
      name: "Excel 병합",
      featureList: ["XLSX·XLS·XLSB·XLSM·CSV 병합", "시트별·세로·가로 병합", "끝 여백 정리", "중간의 연속 빈 행·열 삭제", "XLSX 수식·서식 개별 보존", "XLS 수식·서식 개별 보존", "암호화 파일 입출력"],
    },
  },
  "/tools/excel-compare": {
    title: "Excel 파일 비교 - XLSX·XLSM·XLS·XLSB·CSV Diff",
    description: "머리글 후보를 확인한 뒤 Excel·CSV 파일 쌍을 위치, 키 또는 대사 기준으로 비교하고 값·수식·서식 차이를 XLSX 보고서에서 확인하세요.",
    application: {
      name: "Excel 비교",
      featureList: ["XLSX·XLSM·XLS·XLSB·SpreadsheetML·CSV", "머리글 후보 선택·직접 변경", "위치·키·회계 대사 비교", "중복 키 좌우 원본 행 묶음", "수식·캐시값 비교", "XLSX·XLSM 서식 비교", "쌍별 9개 시트 보고서", "다중 쌍 ZIP"],
    },
  },
  "/tools/excel-cleaner": {
    title: "Excel 데이터 정리 - XLSX·XLS·CSV 클리너",
    description: "Excel·CSV 파일에 구조·텍스트·필터·값 변환 28종 규칙을 순서대로 적용하고 정리된 XLSX·CSV와 4시트 처리 보고서를 받으세요.",
    application: {
      name: "Excel 데이터 정리",
      featureList: ["Excel·CSV 다중 파일", "구조 규칙 13종", "텍스트 규칙 7종", "행 필터 3종", "값 변환 5종", "수식 참조 갱신·안전 강등", "XLSX·CSV·ZIP 결과"],
    },
  },
  "/tools/document-generator": {
    title: "워드 일괄 생성 | 템플릿 기반 문서 대량 생성기",
    description: "워드 템플릿의 변수를 엑셀 데이터로 치환하여 한 번에 수많은 개별 문서를 메일머지처럼 자동으로 완성하세요.",
    application: { name: "템플릿 기반 문서 대량 생성기", featureList: ["워드 일괄 생성", "DOCX 템플릿 변수 매핑", "Excel·CSV 여러 파일", "시트·머리글 행 선택", "행별 순차 생성", "개별·ZIP·XLSX 보고서"] },
  },
  "/tools/document-compare": {
    title: "Word·HWP 문서 비교 - DOCX·DOC·HWP·HWPX Diff",
    description: "DOCX·DOC 또는 HWP·HWPX 문서의 문단·표·서식 차이를 같은 기준으로 비교하세요. 문단 이동과 분할을 구분하고 웹·Excel 결과와 DOCX 변경 추적을 제공합니다.",
    application: {
      name: "문서 비교",
      featureList: ["DOCX·DOC Word 문서 비교", "HWP·HWPX 한글 문서 비교", "문단 이동·분할·병합 판정", "표 구조 변경 비교", "머리말·꼬리말·메모 비교", "Excel 비교 보고서", "DOCX 전용 Word 변경 추적"],
    },
  },
  "/tools/pdf-compare": {
    title: "PDF 파일 비교 | 페이지 화면·추출 텍스트 차이",
    description: "여러 수정 전후 PDF 쌍을 쪽 번호 또는 수동 대응으로 비교하고 페이지별 렌더 픽셀, 추출 텍스트 차이와 XLSX·ZIP 보고서를 확인하세요.",
    application: { name: "PDF 비교", featureList: ["여러 PDF 쌍", "쪽 번호·수동 페이지 대응", "페이지 렌더 픽셀 비교", "추출 텍스트 비교", "추가·삭제 페이지", "쌍별 XLSX·다중 ZIP"] },
  },
  "/tools/pdf-editor": {
    title: "PDF 도구 | 페이지 편집·병합·변환·OCR",
    description: "PDF 페이지를 편집·병합·추출하고 JPG·PNG 이미지와 PDF를 서로 변환하거나 한국어·영어 OCR로 DOCX·XLSX·TXT를 만드세요.",
    application: {
      name: "PDF Tools",
      featureList: ["PDF 페이지 편집·병합·추출", "체크박스 범위 선택·연속 분할", "페이지 순서 변경·회전", "이미지를 PDF로 변환", "PDF를 PNG·JPG로 변환", "PDF DOCX·XLSX·TXT 변환", "한국어·영어 OCR"],
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
  "/tools/pdf-editor/finish": {
    title: "PDF 페이지 번호·워터마크·도장 함께 넣기",
    description: "여러 PDF에 페이지 번호, 머리글·바닥글, 워터마크와 도장을 함께 적용하고 개별 파일과 ZIP으로 내려받으세요.",
    application: { name: "PDF 마무리", featureList: ["페이지 번호", "머리글·바닥글", "텍스트·이미지 워터마크", "도장·서명 이미지", "여러 PDF 일괄 처리", "ZIP 다운로드"] },
  },
  "/tools/pdf-editor/page-numbers": {
    title: "PDF 페이지 번호 넣기 - 시작 번호·표지 제외",
    description: "PDF 페이지 범위와 홀짝 조건을 고르고 시작 페이지·시작 번호·표지 제외 기준으로 페이지 번호를 넣으세요.",
    application: { name: "PDF 페이지 번호", featureList: ["시작 번호", "시작 페이지", "표지 제외", "페이지 범위", "홀짝 필터", "썸네일 선택"] },
  },
  "/tools/pdf-editor/header-footer": {
    title: "PDF 머리글·바닥글 넣기 - 파일명·날짜 토큰",
    description: "PDF 머리글이나 바닥글에 파일명, 날짜, 페이지 번호와 직접 입력한 문구를 원하는 위치와 색상으로 넣으세요.",
    application: { name: "PDF 머리글·바닥글", featureList: ["파일명 토큰", "작업 시작 날짜", "페이지 번호", "6개 표시 위치", "글자 크기·색상", "오버레이 미리보기"] },
  },
  "/tools/pdf-editor/watermark": {
    title: "PDF 워터마크 넣기 - 텍스트·이미지 반복 배치",
    description: "PDF에 텍스트 또는 PNG·JPEG 워터마크를 내용 앞이나 뒤에 넣고 회전·불투명도·크기와 반복 간격을 조절하세요.",
    application: { name: "PDF 워터마크", featureList: ["벡터 텍스트", "PNG·JPEG 이미지", "앞·뒤 레이어", "단일·반복 배치", "회전·불투명도", "오버레이 미리보기"] },
  },
  "/tools/pdf-editor/stamp": {
    title: "PDF 도장·서명 이미지 넣기 - 여러 페이지 같은 위치",
    description: "PNG·JPEG 도장이나 서명 이미지를 PDF 미리보기에서 옮기고 비율을 유지해 크기를 조절한 뒤 선택한 페이지에 넣으세요.",
    application: { name: "PDF 도장·서명 이미지", featureList: ["PNG·JPEG 이미지", "직접 이동·크기 조절", "고정 비율", "선택 페이지 적용", "같은 상대 위치", "실행 취소·다시 실행"] },
  },
  "/tools/pdf-editor/merge": {
    title: "PDF 합치기 - 여러 PDF를 순서대로 하나로",
    description: "여러 PDF를 순서대로 합쳐 하나의 PDF로 저장하세요. 페이지를 확인하고 출력 영역에서 바로 내려받으세요.",
    application: { name: "PDF 합치기", featureList: ["여러 PDF 합치기", "페이지 순서 확인", "병합 출력", "브라우저 처리"] },
  },
  "/tools/pdf-editor/split": {
    title: "PDF 나누기 - 범위별로 자르기",
    description: "PDF에서 나누기 위치를 정해 범위별로 자르고 필요한 구간만 저장하세요. 전체 페이지가 들어오는 최초 범위를 유지합니다.",
    application: { name: "PDF 나누기", featureList: ["나누기 위치 선택", "범위별 저장", "최초 전체 범위", "브라우저 처리"] },
  },
  "/tools/pdf-editor/delete": {
    title: "PDF 페이지 삭제 - 원하는 페이지만 빼기",
    description: "PDF에서 삭제할 페이지를 고르고 나머지를 하나의 PDF로 저장하세요. 파일을 열면 첫 페이지 삭제 안내부터 시작합니다.",
    application: { name: "PDF 페이지 삭제", featureList: ["페이지 선택 삭제", "나머지 병합 저장", "첫 작업 안내", "자동 삭제 없음"] },
  },
  "/tools/pdf-editor/rotate": {
    title: "PDF 페이지 회전 - 원하는 페이지만 돌리기",
    description: "PDF에서 회전할 페이지를 고르고 방향을 바로잡아 저장하세요. 파일을 열면 첫 페이지 회전 안내부터 시작합니다.",
    application: { name: "PDF 페이지 회전", featureList: ["페이지 선택 회전", "向き 바로잡기", "첫 작업 안내", "자동 회전 없음"] },
  },
  "/tools/pdf-editor/ocr": {
    title: "PDF OCR - 검색 가능한 PDF 만들기",
    description: "PDF 전체 페이지를 한국어·영어 OCR로 읽어 검색 가능한 PDF를 만드세요. 별도 설정 없이 전체 범위를 처리합니다.",
    application: { name: "PDF OCR", featureList: ["전체 페이지 OCR", "한국어·영어", "검색 가능한 PDF", "브라우저 처리"] },
  },
  "/tools/image-studio/resize": {
    title: "이미지 크기 조절 - 원하는 픽셀 크기로",
    description: "이미지 크기를 원하는 픽셀 크기로 조절하고 저장하세요. 편집 화면의 크기 패널이 바로 열립니다.",
    application: { name: "이미지 크기 조절", featureList: ["픽셀 크기 지정", "비율 유지", "크기 패널 바로 열기", "브라우저 처리"] },
  },
  "/tools/image-studio/mosaic": {
    title: "이미지 모자이크 - 선택 영역 가리기",
    description: "이미지에서 가릴 영역을 선택해 모자이크를 적용하세요. 효과 패널이 바로 열립니다.",
    application: { name: "이미지 모자이크", featureList: ["선택 영역 모자이크", "효과 패널 바로 열기", "브라우저 처리"] },
  },
  "/tools/image-studio/watermark": {
    title: "이미지 워터마크 - 글자 넣기",
    description: "이미지에 글자 워터마크를 넣고 저장하세요. 텍스트 패널이 바로 열리며 자동으로 그림을 넣지 않습니다.",
    application: { name: "이미지 워터마크", featureList: ["글자 워터마크", "텍스트 패널 바로 열기", "자동 삽입 없음", "브라우저 처리"] },
  },
  "/tools/video-studio/trim": {
    title: "비디오 자르기 - 구간 선택해 MP4로",
    description: "영상에서 필요한 구간을 골라 MP4로 저장하세요. 구간 안내부터 시작하며 그룹 안내를 확인하세요.",
    application: { name: "비디오 자르기", featureList: ["구간 선택", "MP4 저장", "구간 안내", "브라우저 처리"] },
  },
  "/tools/video-studio/merge": {
    title: "비디오 합치기 - 여러 영상을 하나로",
    description: "여러 영상을 순서대로 합쳐 하나의 MP4로 저장하세요. 그룹 안내부터 시작합니다.",
    application: { name: "비디오 합치기", featureList: ["여러 영상 합치기", "그룹 순서", "MP4 저장", "브라우저 처리"] },
  },
  "/tools/video-studio/extract-audio": {
    title: "비디오 음원 추출 - MP3로 저장",
    description: "영상에서 소리만 빼내 MP3로 저장하세요. 구간 안내부터 시작합니다.",
    application: { name: "비디오 음원 추출", featureList: ["음원 추출", "MP3 저장", "구간 안내", "브라우저 처리"] },
  },
  "/tools/audio-studio/trim": {
    title: "오디오 자르기 - 구간 선택해 저장",
    description: "오디오 파일에서 구간을 고르고 필요한 부분만 저장하세요. 파일 입문 뒤 구간 선택이 바로 켜집니다.",
    application: { name: "오디오 자르기", featureList: ["구간 선택", "선택 구간 저장", "자동 처리 없음", "브라우저 처리"] },
  },
  "/tools/hwp-editor": {
    title: "HWP·HWPX 문서 편집기 - 무료 온라인 HWP 편집",
    description: "HWP와 HWPX 문서를 공식 rhwp Studio에서 열어 본문·서식·표·개체를 편집하고 HWP·HWPX·HML로 저장하세요.",
    application: { name: "HWP 편집", featureList: ["HWP·HWPX·HML 문서 열기", "본문과 글자 서식 편집", "표·그림·도형·수식 편집", "실행 취소와 문서 찾기", "HWP·HWPX 저장", "HWP 재열기 검증"] },
  },
  "/tools/office-editor": {
    title: "브라우저 오피스 편집기 - DOCX·XLSX·PPTX 온라인 편집",
    description: "DOCX·XLSX·PPTX 파일을 놓으면 LibreOffice 기반 전체 화면 편집기를 자동으로 준비하고, 한글 대체 글꼴로 브라우저 안에서 편집·저장합니다.",
    application: { name: "오피스 편집기", featureList: ["파일 드롭 자동 시작", "전체 화면 집중 편집", "한글 대체 글꼴", "DOCX·DOC·ODT Writer", "XLSX·XLS·ODS Calc", "PPTX·PPT·ODP Impress", "실제 다운로드 진행률", "매크로·외부 갱신 차단", "브라우저 내 파일 처리"] },
  },
  "/tools/video-studio": {
    title: "비디오 스튜디오 | 영상 자르기·이어붙이기·음원 추출",
    description: "영상 수 제한 없이 최대 10개 그룹에서 영상을 자르거나 이어붙이세요. 빠른 무손실 저장, 영상 속 음성 제어와 GIF·MP3·AAC 출력을 지원합니다.",
    application: { name: "비디오 스튜디오", featureList: ["영상 수 제한 없는 추가·10개 그룹", "빠른 무손실 자르기", "그룹 간 구간 일괄 적용", "그룹별 개별 출력·이어붙이기", "동기 재생·분할 전체화면", "개별·폴더·ZIP 저장", "영상 속 음성 복사·제거·변환", "화질·음질 설정", "GIF·MP3·AAC 출력"] },
  },
  "/tools/audio-studio": {
    title: "오디오 스튜디오 | 파형 편집·구간 자르기·피치 조절",
    description: "오디오 파형에서 구간을 자르고 음소거·복사·붙여넣기하거나 피치와 음색 효과를 적용한 뒤 WAV 또는 MP3로 저장하세요.",
    application: { name: "오디오 스튜디오", featureList: ["고해상도 오디오 파형", "구간 자르기·음소거", "복사·붙여넣기", "피치·음색 효과", "선택 구간 미리 듣기", "실행 취소·다시 실행", "WAV·MP3 저장"] },
  },
  "/tools/image-studio": {
    title: "이미지 스튜디오 | 사진 편집·모자이크·콜라주·GIF",
    description: "사진 편집과 그림판을 하나로 합쳐 선택 영역 모자이크·블러, 자르기·크기 조절·필터·자유 그리기·Undo를 사용하고 원하는 픽셀 크기로 저장하세요.",
    application: { name: "이미지 스튜디오", featureList: ["사진·빈 캔버스 통합 편집", "선택 영역 모자이크·블러", "블러 강도 조절", "연필·붓·지우개", "Undo·Redo", "자르기·이미지·캔버스 크기 조절", "내보내기 크기 지정", "텍스트·도형·스티커 레이어", "일괄 리사이즈", "워터마크", "콜라주", "GIF 애니메이션"] },
  },
  "/tools/text-merger": {
    title: "텍스트 병합 | 직접 입력·TXT 파일 순서대로 합치기",
    description: "직접 붙여넣은 텍스트와 여러 TXT 파일을 한 목록에서 자유롭게 정렬하고 줄바꿈·공백·쉼표·사용자 지정 구분자로 하나로 합치세요.",
    application: { name: "텍스트 병합", featureList: ["직접 입력 텍스트 추가", "여러 TXT 파일 불러오기", "직접 입력과 파일 통합 순서 변경", "구분자 선택", "앞뒤 공백 제거", "빈 텍스트 제외", "결과 복사와 TXT 다운로드"] },
  },
  "/tools/text-tools": {
    title: "텍스트 정돈·케이스 변환 - 공백·줄바꿈·중복 줄 제거",
    description: "불필요한 공백과 줄바꿈, 중복 줄을 제거하고 Camel·Snake·Kebab·Title Case 변환과 로컬 한국어 문장 검사를 실행하세요.",
    application: { name: "텍스트 정돈", featureList: ["공백 정돈", "줄바꿈 합치기", "중복 줄 제거", "Camel Case", "Snake Case", "Kebab Case", "한국어 띄어쓰기 가이드"] },
  },
  "/tools/text-formatter": {
    title: "JSON·SQL·XML 포맷터 - 들여쓰기·한 줄 축소·문법 검사",
    description: "JSON, SQL, XML 텍스트의 문법 오류를 확인하고 읽기 좋은 들여쓰기 또는 한 줄 형식으로 정돈하세요.",
    application: { name: "JSON SQL XML Formatter", featureList: ["JSON 포맷", "SQL 정렬", "XML 포맷", "한 줄 축소", "문법 오류 탐지"] },
  },
  "/tools/work-calculator": {
    title: "영업일·연차 계산기 - 대한민국 공휴일·대체공휴일 반영",
    description: "주말과 대한민국 법정·대체공휴일을 제외한 영업일과 입사일·회계연도 기준 예상 연차를 계산하세요.",
    application: { name: "영업일 연차 계산기", featureList: ["대한민국 공휴일", "음력 공휴일", "대체공휴일", "직접 휴일 추가", "입사일 기준 연차", "회계연도 기준 연차"] },
  },
  "/tools/timezone-calculator": {
    title: "세계지도 시차·글로벌 회의 시간 계산기 - 도시 시간 비교",
    description: "세계지도에서 도시 핀을 선택하고 국제 표준 도시 시간대(IANA)와 서머타임을 반영한 현지 시각과 회의 가능 시간을 비교하세요.",
    application: { name: "글로벌 시차 계산기", featureList: ["인터랙티브 세계지도", "44개 주요 도시 핀", "도시 검색", "국제 표준 도시 시간대(IANA)", "서머타임 자동 반영", "최대 6개 도시 비교", "30분 단위 회의 추천"] },
  },
  "/tools/payroll-calculator": {
    title: "주휴수당·월 실수령액·퇴직금 간이 계산기",
    description: "2026년 최신 사회보험 기준으로 주휴수당, 월급 실수령액과 법정 퇴직금을 서버 전송 없이 간이 계산하세요.",
    application: { name: "급여 간이 계산기", featureList: ["주휴수당", "국민연금", "건강보험", "장기요양보험", "고용보험", "근로소득세 추정", "퇴직금"] },
  },
  "/tools/image-privacy": {
    title: "사진 메타데이터 제거 | EXIF·GPS 확인 및 삭제",
    description: "JPG·PNG·WebP 사진에 숨은 GPS 위치, 촬영 기기와 촬영 시각 정보(EXIF)를 확인하고 메타데이터가 제거된 새 사본을 만드세요.",
    application: { name: "사진 메타데이터 제거", featureList: ["JPG·PNG·WebP 지원", "숨은 촬영 정보(EXIF) 확인", "GPS 위치 확인", "촬영 기기·시각 확인", "사진 내용만 새 파일로 저장", "메타데이터 제거"] },
  },
  "/tools/security-tools": {
    title: "안전한 비밀번호 생성기·강도 측정기",
    description: "운영체제의 보안 난수로 무작위 비밀번호를 만들고 패턴·추측 난이도·예상 해독 시간으로 강도를 확인하세요.",
    application: { name: "비밀번호 생성기", featureList: ["보안 난수 비밀번호 생성", "8~64자 길이", "문자 종류 선택", "패턴 강도 분석", "추측 난이도", "초당 100억 회 기준 예상 해독 시간"] },
  },
  "/tools/qr-studio": {
    title: "QR 스튜디오 | QR 코드 만들기·카메라 스캔",
    description: "URL과 텍스트를 로고 포함 QR로 만들고 휴대폰 카메라 또는 업로드한 사진 속 QR 데이터를 브라우저에서 읽으세요.",
    application: { name: "QR 스튜디오", featureList: ["URL QR 생성", "텍스트 QR 생성", "중앙 로고", "실시간 카메라 스캔", "사진 QR 스캔", "모바일 공유·저장"] },
  },
  "/tools/qr-studio/bulk": {
    title: "QR 일괄 생성 | Excel·CSV 행별 PNG·ZIP·라벨 PDF",
    description: "Excel·CSV 표의 각 행을 텍스트, 이메일, 전화, 문자, Wi-Fi, vCard 또는 URL QR로 만들고 재판독한 PNG·ZIP·라벨 PDF와 보고서를 받으세요.",
    application: { name: "QR 일괄 생성", featureList: ["Excel·CSV 행별 QR", "7종 표준 페이로드", "열 번호 매핑·머리글 템플릿", "로고·투명 PNG", "생성 후 재판독", "증분 ZIP", "A4·Letter 라벨 PDF", "XLSX 생성·실패 보고서"] },
  },
  "/tools/data-converter": {
    title: "표 데이터 변환기 | CSV·JSON·HTML 상호 변환",
    description: "CSV, JSON 객체 배열과 HTML 표(table) 데이터를 브라우저에서 서로 변환하고 파일로 저장하세요.",
    application: { name: "표 데이터 변환기", featureList: ["CSV JSON 변환", "JSON CSV 변환", "HTML 표 변환", "CSV 파일 불러오기", "브라우저 내 파싱", "파일 다운로드"] },
  },
  "/about": {
    title: "서비스 소개 | Worklazy Tools",
    description: "Worklazy Tools가 파일을 서버에 올리지 않고 브라우저에서 문서, PDF, 비디오와 이미지 작업을 처리하는 방법과 지원 범위를 안내합니다.",
  },
  "/privacy": {
    title: "개인정보처리방침 | Worklazy Tools",
    description: "Worklazy Tools의 로컬 파일 처리, Google·Naver 방문 분석, 광고와 쿠키에 관한 개인정보 처리 방침을 확인하세요.",
  },
  "/terms": {
    title: "이용약관 | Worklazy Tools",
    description: "Worklazy Tools의 무료 브라우저 도구 이용 조건, 지원 범위, 사용자 책임과 면책 사항을 안내합니다.",
  },
  "/contact": {
    title: "문의·건의·버그 제보 | Worklazy Tools",
    description: "Worklazy Tools의 버그·오류 제보, 기능 제안, 개인정보 관련 문의 방법을 안내합니다.",
  },
  "/licenses": {
    title: "라이선스 및 제3자 고지 | Worklazy Tools",
    description: "Worklazy Tools 자체 저작물의 이용 조건과 rhwp, ffmpeg.wasm 등 주요 오픈소스 구성요소의 라이선스를 안내합니다.",
  },
};

const englishToolTitles: Record<keyof typeof enTools.items, string> = {
  "document-redactor": "Document Redaction | Mask PDF and Image Areas",
  "excel-merger": "Excel Merger | Combine Excel & CSV Files",
  "excel-compare": "Excel Compare | Compare XLSX, XLS, XLSB & CSV Files",
  "excel-cleaner": "Excel Data Cleaner | Clean XLSX, XLS & CSV Files",
  "document-generator": "Word Mail Merge | Template-based Bulk Document Generator",
  "pdf-editor": "PDF Tools | Edit, Merge, Convert & OCR PDFs",
  "document-compare": "Document Compare | Compare DOCX, DOC, HWP & HWPX",
  "pdf-compare": "PDF Compare | Visual and Extracted Text Differences",
  "hwp-editor": "HWP Editor | Edit HWP & HWPX Documents",
  "office-editor": "Browser Office Editor | Edit DOCX, XLSX & PPTX",
  "video-studio": "Video Studio | Trim, Join & Extract Audio",
  "audio-studio": "Audio Studio | Waveform Editing, Trimming & Pitch",
  "image-studio": "Image Studio | Edit Photos, Mosaic, Collage & GIF",
  "text-merger": "Text Merger | Combine Pasted Text & TXT Files",
  "text-tools": "Text Cleanup | Whitespace, Lines & Case Conversion",
  "text-formatter": "Code Formatter | Format & Validate JSON, SQL & XML",
  "work-calculator": "Korean Workday Calculator | Business Days & Leave",
  "timezone-calculator": "World Time Planner | Time Zones & Meeting Hours",
  "payroll-calculator": "Korean Payroll Calculator | Take-Home & Severance Pay",
  "image-privacy": "Photo Metadata Remover | Inspect & Remove EXIF and GPS",
  "security-tools": "Password Generator | Create & Check Strong Passwords",
  "qr-studio": "QR Studio | Create & Scan QR Codes",
  "data-converter": "Table Data Converter | Convert CSV, JSON & HTML",
};

const englishPageSeo: Record<string, SeoDefinition> = {
  "/tools/document-redactor": {title: "Document Redaction | Mask PDF and Image Areas", description: "Cover selected PDF, JPG, PNG and WebP areas with black masks and save a new copy. Original files remain unchanged; every PDF page is rasterized.", application: {name: "Document Redaction", featureList: ["Manual area selection", "Solid black pixel masks", "Rasterize every PDF page", "PNG image output", "Review results"]}},
  "/": { title: "Free Browser Tools for Documents, Media & Work | Worklazy Tools", description: "Edit documents and media, convert text and data, plan work across time zones, and use practical privacy tools without installing software." },
  "/tools": { title: "All Free Browser Tools | Worklazy Tools", description: "Browse free tools for documents, media, text, data, work planning, Korean payroll, privacy and sharing." },
  "/tools/excel-merger": { title: "Excel Merger | Combine XLSX, XLS & CSV Files", description: "Combine XLSX, XLS, XLSB, XLSM and CSV files into one XLSX with separate formula and formatting controls for XLSX and XLS input.", application: { name: "Excel Merger", featureList: ["XLSX, XLS, XLSB, XLSM and CSV merging", "Separate-sheet, vertical and horizontal layouts", "Empty-area cleanup", "Independent XLSX formula and formatting preservation", "Independent XLS formula and formatting preservation", "Encrypted input and output"] } },
  "/tools/excel-compare": { title: "Excel Compare | Compare XLSX, XLS, XLSB & CSV Files", description: "Check a suggested header, compare Excel and CSV pairs by position, keys or reconciliation rules, and download a nine-sheet XLSX report.", application: { name: "Excel Compare", featureList: ["XLSX, XLSM, XLS, XLSB, SpreadsheetML and CSV", "Suggested header selection and manual changes", "Position, key and reconciliation matching", "Grouped left and right rows for duplicate keys", "Formula and cached-value comparison", "XLSX and XLSM formatting comparison", "Nine-sheet report per pair", "ZIP for multiple successful pairs"] } },
  "/tools/excel-cleaner": { title: "Excel Data Cleaner | Clean XLSX, XLS & CSV Files", description: "Apply 28 ordered structure, text, row-filter, and value-conversion rules to Excel and CSV files, then download cleaned XLSX, CSV, reports, and ZIP results.", application: { name: "Excel Data Cleaner", featureList: ["Multiple Excel and CSV files", "13 structure rules", "7 text rules", "3 row-filter rules", "5 value-conversion rules", "Formula-reference updates and safe fallback", "XLSX, CSV, and ZIP results"] } },
  "/tools/document-generator": { title: "Word Mail Merge | Template-based Bulk Document Generator", description: "Replace variables in a Word template with Excel data to automatically generate hundreds of individual documents at once, just like Mail Merge.", application: { name: "Template-based Bulk Document Generator", featureList: ["Word Mail Merge", "DOCX template variables", "Multiple Excel and CSV files", "Sheet and header-row selection", "Sample DOCX", "Individual files, ZIP and XLSX reports"] } },
  "/tools/pdf-compare": { title: "PDF Compare | Visual and Extracted Text Differences", description: "Compare before-and-after PDF pairs by page, inspect rendered pixel and extracted-text differences, and download XLSX or ZIP reports in your browser.", application: { name: "PDF Compare", featureList: ["Multiple PDF pairs", "Page-number and manual mapping", "Rendered pixel comparison", "Extracted text comparison", "Added and deleted pages", "XLSX and ZIP reports"] } },
  "/tools/qr-studio/bulk": { title: "Bulk QR Generator | Excel & CSV to PNG, ZIP and Label PDF", description: "Create text, email, telephone, SMS, Wi-Fi, vCard or web QR codes from Excel and CSV rows, verify every final PNG, and export ZIP, label PDF and XLSX reports.", application: { name: "Bulk QR Generator", featureList: ["Excel and CSV row mapping", "Seven standard payload types", "Header templates", "Logo and transparent PNG", "Read-back verification", "Incremental ZIP", "A4 and Letter label PDF", "XLSX manifest and failures"] } },
  "/tools/pdf-editor/image-to-pdf": { title: "Convert JPG & PNG Images to PDF | Worklazy Tools", description: "Reorder JPG and PNG images and combine them into one browser-generated PDF with A4 fit or original-size pages.", application: { name: "Image to PDF", featureList: ["JPG to PDF", "PNG to PDF", "Image ordering", "Automatic A4 fitting"] } },
  "/tools/pdf-editor/pdf-to-image": { title: "Convert PDF Pages to PNG or JPG | Worklazy Tools", description: "Render PDF pages as PNG or JPG images at your chosen resolution and download them together as a ZIP file.", application: { name: "PDF to Image", featureList: ["PDF to PNG", "PDF to JPG", "Resolution selection", "ZIP download"] } },
  "/tools/pdf-editor/convert": { title: "Convert PDF to DOCX, XLSX or TXT with OCR | Worklazy Tools", description: "Convert selected PDF pages to DOCX, XLSX, TXT or searchable PDF using self-hosted English and Korean OCR in your browser.", application: { name: "PDF Document Conversion and OCR", featureList: ["Page-range selection", "PDF to DOCX", "PDF to XLSX", "PDF to TXT", "Local OCR", "Searchable PDF"] } },
  "/tools/pdf-editor/finish": { title: "Add PDF Page Numbers, Watermarks & Stamps | Worklazy Tools", description: "Apply page numbers, headers, footers, watermarks, and stamps together to multiple PDFs, then download individual files or a ZIP.", application: { name: "PDF Finish", featureList: ["Page numbers", "Headers and footers", "Text and image watermarks", "Stamp and signature images", "Multiple PDF processing", "ZIP download"] } },
  "/tools/pdf-editor/page-numbers": { title: "Add Page Numbers to PDF | Worklazy Tools", description: "Add page numbers to an exact PDF page range with starting-page, starting-number, cover-exclusion, and parity controls.", application: { name: "PDF Page Numbers", featureList: ["Starting number", "Starting page", "Cover exclusion", "Page ranges", "Parity filter", "Thumbnail selection"] } },
  "/tools/pdf-editor/header-footer": { title: "Add PDF Headers & Footers | Worklazy Tools", description: "Add custom headers and footers with filename, date, page-number tokens, position, size, and color controls.", application: { name: "PDF Headers and Footers", featureList: ["Filename token", "Batch-start date", "Page-number tokens", "Six positions", "Size and color", "Overlay preview"] } },
  "/tools/pdf-editor/watermark": { title: "Add Text or Image Watermarks to PDF | Worklazy Tools", description: "Add text, PNG, or JPEG watermarks in front of or behind PDF content with rotation, opacity, sizing, and repeated tile controls.", application: { name: "PDF Watermark", featureList: ["Vector text", "PNG and JPEG images", "Background and foreground layers", "Single and repeated placement", "Rotation and opacity", "Overlay preview"] } },
  "/tools/pdf-editor/stamp": { title: "Add Stamp or Signature Images to PDF | Worklazy Tools", description: "Move and resize a PNG or JPEG stamp or signature image in the PDF preview, then place it at the same relative position on selected pages.", application: { name: "PDF Stamp and Signature Image", featureList: ["PNG and JPEG images", "Direct move and resize", "Fixed aspect ratio", "Selected-page placement", "Same relative position", "Undo and redo"] } },
  "/tools/pdf-editor/merge": { title: "Merge PDFs | Combine Multiple PDFs in Order", description: "Combine multiple PDFs in order into one PDF and download it from the output area.", application: { name: "Merge PDFs", featureList: ["Combine multiple PDFs", "Check page order", "Merged output", "Browser processing"] } },
  "/tools/pdf-editor/split": { title: "Split PDF | Cut by Ranges", description: "Mark split positions in a PDF, cut it by ranges and save only the sections you need.", application: { name: "Split PDF", featureList: ["Split positions", "Save by range", "Initial full range", "Browser processing"] } },
  "/tools/pdf-editor/delete": { title: "Delete PDF Pages | Remove Selected Pages", description: "Choose pages to delete from a PDF and save the rest as one PDF.", application: { name: "Delete PDF Pages", featureList: ["Select pages to delete", "Save the rest merged", "First-task guidance", "No automatic deletion"] } },
  "/tools/pdf-editor/rotate": { title: "Rotate PDF Pages | Fix Selected Pages", description: "Choose pages to rotate in a PDF and save them with corrected orientation.", application: { name: "Rotate PDF Pages", featureList: ["Select pages to rotate", "Correct orientation", "First-task guidance", "No automatic rotation"] } },
  "/tools/pdf-editor/ocr": { title: "PDF OCR | Make a Searchable PDF", description: "Read every PDF page with Korean and English OCR and create a searchable PDF.", application: { name: "PDF OCR", featureList: ["Full-page OCR", "Korean and English", "Searchable PDF", "Browser processing"] } },
  "/tools/image-studio/resize": { title: "Resize Image | Save at Exact Pixel Size", description: "Resize an image to an exact pixel size and save it.", application: { name: "Resize Image", featureList: ["Exact pixel size", "Keep aspect ratio", "Size panel opens directly", "Browser processing"] } },
  "/tools/image-studio/mosaic": { title: "Image Mosaic | Cover a Selected Area", description: "Select an area in an image and apply a mosaic effect.", application: { name: "Image Mosaic", featureList: ["Selected-area mosaic", "Effect panel opens directly", "Browser processing"] } },
  "/tools/image-studio/watermark": { title: "Image Watermark | Add Text", description: "Add a text watermark to an image and save it. No objects are inserted automatically.", application: { name: "Image Watermark", featureList: ["Text watermark", "Text panel opens directly", "No automatic insertion", "Browser processing"] } },
  "/tools/video-studio/trim": { title: "Trim Video | Save a Section as MP4", description: "Pick a section of a video and save it as MP4.", application: { name: "Trim Video", featureList: ["Section selection", "MP4 output", "Section guidance", "Browser processing"] } },
  "/tools/video-studio/merge": { title: "Join Videos | Combine into One MP4", description: "Combine multiple videos in order into one MP4.", application: { name: "Join Videos", featureList: ["Combine multiple videos", "Group order", "MP4 output", "Browser processing"] } },
  "/tools/video-studio/extract-audio": { title: "Extract Audio from Video | Save as MP3", description: "Take only the sound from a video and save it as MP3.", application: { name: "Extract Audio from Video", featureList: ["Audio extraction", "MP3 output", "Section guidance", "Browser processing"] } },
  "/tools/audio-studio/trim": { title: "Trim Audio | Save a Selected Section", description: "Pick a section of an audio file and save only that part.", application: { name: "Trim Audio", featureList: ["Section selection", "Save selection", "No automatic processing", "Browser processing"] } },
  "/about": { title: "About | Worklazy Tools", description: "Learn how Worklazy Tools processes documents and media in the browser and where each tool's compatibility boundaries apply." },
  "/privacy": { title: "Privacy Policy | Worklazy Tools", description: "Read how local file processing, Google and Naver Analytics, advertising and cookies are handled by Worklazy Tools." },
  "/terms": { title: "Terms of Use | Worklazy Tools", description: "Review the conditions, supported scope, user responsibilities and limitations for Worklazy Tools browser utilities." },
  "/contact": { title: "Contact, Suggestions & Bug Reports | Worklazy Tools", description: "Report a bug, suggest a feature or contact Worklazy Tools about privacy without attaching sensitive work files." },
  "/licenses": { title: "Licenses & Third-Party Notices | Worklazy Tools", description: "Review Worklazy Tools copyright terms and licenses for rhwp, ffmpeg.wasm and other open-source components." },
};

const toolSlugByPath: Record<string, keyof typeof enTools.items> = {
  "/tools/excel-merger": "excel-merger", "/tools/excel-compare": "excel-compare", "/tools/excel-cleaner": "excel-cleaner", "/tools/document-compare": "document-compare", "/tools/pdf-compare": "pdf-compare", "/tools/pdf-editor": "pdf-editor",
  "/tools/hwp-editor": "hwp-editor", "/tools/office-editor": "office-editor", "/tools/video-studio": "video-studio",
  "/tools/audio-studio": "audio-studio", "/tools/image-studio": "image-studio", "/tools/text-tools": "text-tools",
  "/tools/text-merger": "text-merger",
  "/tools/text-formatter": "text-formatter", "/tools/work-calculator": "work-calculator", "/tools/timezone-calculator": "timezone-calculator",
  "/tools/payroll-calculator": "payroll-calculator", "/tools/image-privacy": "image-privacy", "/tools/security-tools": "security-tools",
  "/tools/qr-studio": "qr-studio", "/tools/data-converter": "data-converter", "/tools/document-generator": "document-generator", "/tools/document-redactor": "document-redactor",
};

export function getSeoDefinition(language: AppLanguage, pathname: string): SeoDefinition {
  const path = normalizeSeoPath(stripLanguagePrefix(pathname));
  if (language === "ko") return withFaq(language, path, seoByPath[path] ?? seoByPath["/"]);
  if (englishPageSeo[path]) return withFaq(language, path, englishPageSeo[path]);
  const slug = toolSlugByPath[path];
  if (!slug) return withFaq(language, path, englishPageSeo["/"]);
  const tool = enTools.items[slug];
  return withFaq(language, path, {
    title: englishToolTitles[slug],
    description: tool.description,
    application: { name: tool.title, featureList: tool.highlights },
  });
}

function withFaq(language: AppLanguage, path: string, definition: SeoDefinition): SeoDefinition {
  let slug = toolSlugByPath[path];
  if (!slug) {
    // try to find by prefix
    for (const p of Object.keys(toolSlugByPath)) {
      if (path.startsWith(p + "/")) {
        slug = toolSlugByPath[p];
        break;
      }
    }
  }
  const faq = slug ? getFaqsForPath(language, slug, path) : [];
  return faq.length > 0 ? { ...definition, faq } : definition;
}
export function normalizeSeoPath(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

export function canonicalSeoPath(pathname: string) {
  const path = normalizeSeoPath(pathname);
  return ["/tools/pdf-editor/page-numbers", "/tools/pdf-editor/header-footer", "/tools/pdf-editor/watermark", "/tools/pdf-editor/stamp"].includes(path)
    ? "/tools/pdf-editor/finish"
    : path;
}

export function getSiteBaseUrl() {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined;
  if (configured) return ensureTrailingSlash(configured);
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}

export function getCanonicalUrl(language: AppLanguage, pathname: string) {
  const path = canonicalSeoPath(stripLanguagePrefix(pathname));
  const localized = path === "/" ? `${language}/` : `${language}${path}/`;
  return new URL(localized, getSiteBaseUrl()).href;
}

export function getSocialImageDefinition(language: AppLanguage, pathname = "/"): SocialImageDefinition {
  const path = normalizeSeoPath(stripLanguagePrefix(pathname));
  const slug = socialImageSlugByPath[path];
  if (!slug) return socialImages[language];
  return {
    path: `social/tools/${slug}-${language}.png`,
    width: 1200,
    height: 630,
    type: "image/png",
    alt: getSeoDefinition(language, path).title,
  };
}

export function getSocialImageUrl(language: AppLanguage, pathname = "/") {
  return new URL(getSocialImageDefinition(language, pathname).path, getSiteBaseUrl()).href;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
