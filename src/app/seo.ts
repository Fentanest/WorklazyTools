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
  "/tools/foliotrace": "foliotrace",
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
  "/tools/foliotrace": { title: "FolioTrace | 국민연금 공개 공시 추적", description: "국민연금의 국내주식 DART 대량보유 공시를 근거로 공개 추적 범위를 살펴봅니다. 실제 계좌 잔고나 전체 자산을 뜻하지 않습니다." },
  "/tools/document-redactor": {title: "PDF·이미지 개인정보 가리기 - 직접 영역 선택 | Worklazy Tools", description: "PDF와 이미지 파일에서 민감한 개인정보 영역을 검정색으로 가리고 안전하게 사본을 저장하세요.", application: {name: "개인정보 가리기", featureList: ["직접 영역 선택", "검정 픽셀 마스킹", "모든 PDF 페이지 재생성", "PNG 이미지 저장", "결과 확인"]}},
  "/": {
    title: "무료 문서·PDF·비디오·이미지 업무 도구 | Worklazy Tools",
    description: "설치와 로그인 없이 문서·미디어 편집, 텍스트·데이터 변환, 일정·급여 계산과 보안 도구를 실행하세요. 입력은 브라우저에서 처리합니다.",
  },
  "/tools": {
    title: "무료 업무 파일 도구 모음 | Worklazy Tools",
    description: "문서·미디어 편집부터 텍스트, 데이터, 일정, 급여, 보안, QR 도구까지 브라우저에서 무료로 실행하세요.",
  },
  "/tools/excel-merger": {
    title: "엑셀 파일 합치기·시트 병합 | Worklazy Tools",
    description: "여러 엑셀 파일의 시트나 자료를 하나의 XLSX로 합치기(병합)하세요. 수식·서식을 보존하고 암호 입출력을 지원합니다.",
    application: {
      name: "엑셀 병합",
      featureList: ["XLSX·XLS·XLSB·XLSM·CSV 병합", "엑셀 시트 합치기", "세로·가로 병합", "끝 여백 정리", "중간의 연속 빈 행·열 삭제", "XLSX 수식·서식 개별 보존", "XLS 수식·서식 개별 보존", "암호화 파일 입출력"],
    },
  },
  "/tools/excel-compare": {
    title: "엑셀 파일 비교 - 값·수식·기준 항목별 차이 | Worklazy Tools",
    description: "Excel·CSV 파일 쌍을 위치나 키 기준으로 비교하세요. 값·수식·서식 차이를 XLSX 보고서로 확인할 수 있습니다.",
    application: {
      name: "엑셀 비교",
      featureList: ["XLSX·XLSM·XLS·XLSB·SpreadsheetML·CSV", "머리글 후보 선택·직접 변경", "위치·키·회계 대사 비교", "중복 키 좌우 원본 행 묶음", "수식·캐시값 비교", "XLSX·XLSM 서식 비교", "쌍별 9개 시트 보고서", "다중 쌍 ZIP"],
    },
  },
  "/tools/excel-cleaner": {
    title: "엑셀 데이터 정리 - 공백·빈 행·중복 정리 | Worklazy Tools",
    description: "Excel·CSV 파일에 공백 제거, 빈 행 삭제, 중복 정리 등 28종 규칙을 순서대로 적용하여 데이터를 깔끔하게 정리하세요.",
    application: {
      name: "엑셀 정리",
      featureList: ["Excel·CSV 다중 파일", "구조 규칙 13종", "텍스트 규칙 7종", "행 필터 3종", "값 변환 5종", "수식 참조 갱신·안전 강등", "XLSX·CSV·ZIP 결과"],
    },
  },
  "/tools/document-generator": {
    title: "워드 문서 일괄 생성 - 엑셀 명단으로 메일머지 | Worklazy Tools",
    description: "워드 템플릿의 변수를 엑셀 데이터로 치환하여 한 번에 수많은 개별 문서를 자동으로 완성하세요.",
    application: { name: "워드 메일머지", featureList: ["워드 일괄 생성", "DOCX 템플릿 변수 매핑", "Excel·CSV 여러 파일", "시트·머리글 행 선택", "행별 순차 생성", "개별·ZIP·XLSX 보고서"] },
  },
  "/tools/document-compare": {
    title: "워드·한글 문서 비교 - 수정 전후 차이 확인 | Worklazy Tools",
    description: "DOCX·DOC 또는 HWP·HWPX 문서의 문단·표·서식 차이를 비교하고 변경된 내용을 쉽게 확인하세요.",
    application: {
      name: "문서 비교",
      featureList: ["DOCX·DOC Word 문서 비교", "HWP·HWPX 한글 문서 비교", "문단 이동·분할·병합 판정", "표 구조 변경 비교", "머리말·꼬리말·메모 비교", "Excel 비교 보고서", "DOCX 전용 Word 변경 추적"],
    },
  },
  "/tools/pdf-compare": {
    title: "PDF 파일 비교 - 화면·텍스트 변경사항 확인 | Worklazy Tools",
    description: "여러 수정 전후 PDF 쌍을 비교하여 페이지별 렌더 픽셀 및 추출 텍스트 차이를 파악하세요.",
    application: { name: "PDF 비교", featureList: ["여러 PDF 쌍", "쪽 번호·수동 페이지 대응", "페이지 렌더 픽셀 비교", "추출 텍스트 비교", "추가·삭제 페이지", "쌍별 XLSX·다중 ZIP"] },
  },
  "/tools/pdf-editor": {
    title: "PDF 페이지 편집 - 순서 변경·병합·분할 | Worklazy Tools",
    description: "PDF 페이지를 병합, 추출, 변환하거나 한국어·영어 OCR을 통해 다양한 문서 형식으로 만드세요.",
    application: {
      name: "PDF 편집",
      featureList: ["PDF 페이지 편집·병합·추출", "체크박스 범위 선택·연속 분할", "페이지 순서 변경·회전", "이미지를 PDF로 변환", "PDF를 PNG·JPG로 변환", "PDF DOCX·XLSX·TXT 변환", "한국어·영어 OCR"],
    },
  },
  "/tools/pdf-editor/image-to-pdf": {
    title: "사진 PDF 변환 - JPG·PNG를 한 파일로 | Worklazy Tools",
    description: "여러 장의 JPG, PNG 이미지를 나열하고 하나의 깔끔한 PDF 파일로 묶어 변환하세요.",
    application: { name: "사진을 PDF로", featureList: ["JPG PDF 변환", "PNG PDF 변환", "이미지 순서 변경", "A4 자동 맞춤"] },
  },
  "/tools/pdf-editor/pdf-to-image": {
    title: "PDF JPG·PNG 변환 - 페이지별 이미지 저장 | Worklazy Tools",
    description: "PDF의 모든 페이지를 고해상도 PNG 또는 JPG 이미지로 변환하여 ZIP 파일로 한 번에 다운로드하세요.",
    application: { name: "PDF를 이미지로", featureList: ["PDF PNG 변환", "PDF JPG 변환", "해상도 선택", "ZIP 일괄 다운로드"] },
  },
  "/tools/pdf-editor/convert": {
    title: "PDF 워드·엑셀 변환 - DOCX·XLSX·TXT | Worklazy Tools",
    description: "원하는 PDF 페이지를 OCR 기술을 이용해 DOCX, XLSX, TXT 파일로 변환하세요.",
    application: { name: "PDF 파일 변환", featureList: ["처리 페이지 범위 선택", "PDF DOCX 변환", "PDF XLSX 변환", "PDF TXT 변환", "로컬 한국어·영어 OCR", "검색 가능한 PDF"] },
  },
  "/tools/pdf-editor/finish": {
    title: "PDF 페이지 번호·워터마크·도장 넣기 | Worklazy Tools",
    description: "여러 PDF에 페이지 번호, 머리글, 바닥글, 워터마크 및 도장 이미지를 일괄 적용하세요.",
    application: { name: "PDF 워터마크·번호", featureList: ["페이지 번호", "머리글·바닥글", "텍스트·이미지 워터마크", "도장·서명 이미지", "여러 PDF 일괄 처리", "ZIP 다운로드"] },
  },
  "/tools/pdf-editor/page-numbers": {
    title: "PDF 페이지 번호 넣기 - 표지 제외·시작 번호 | Worklazy Tools",
    description: "표지를 제외하거나 시작 번호를 지정하여 PDF에 원하는 형식의 페이지 번호를 삽입하세요.",
    application: { name: "PDF 번호 매기기", featureList: ["시작 번호", "시작 페이지", "표지 제외", "페이지 범위", "홀짝 필터", "썸네일 선택"] },
  },
  "/tools/pdf-editor/header-footer": {
    title: "PDF 머리글·바닥글 넣기 - 파일명·날짜 | Worklazy Tools",
    description: "PDF 파일명, 날짜, 페이지 번호 등의 문구를 원하는 위치에 머리글이나 바닥글로 추가하세요.",
    application: { name: "PDF 머리글/바닥글", featureList: ["파일명 토큰", "작업 시작 날짜", "페이지 번호", "6개 표시 위치", "글자 크기·색상", "오버레이 미리보기"] },
  },
  "/tools/pdf-editor/watermark": {
    title: "PDF 워터마크 넣기 - 글자·이미지 표시 | Worklazy Tools",
    description: "PDF 문서의 배경이나 전면에 텍스트 또는 이미지 워터마크를 반복 배치하고 투명도를 조절하세요.",
    application: { name: "PDF 워터마크", featureList: ["벡터 텍스트", "PNG·JPEG 이미지", "앞·뒤 레이어", "단일·반복 배치", "회전·불투명도", "오버레이 미리보기"] },
  },
  "/tools/pdf-editor/stamp": {
    title: "PDF 도장·서명 이미지 넣기 | Worklazy Tools",
    description: "서명이나 도장 이미지를 PDF에 자유롭게 배치하고 크기를 조절하여 여러 페이지에 한 번에 적용하세요.",
    application: { name: "PDF 도장 삽입", featureList: ["PNG·JPEG 이미지", "직접 이동·크기 조절", "고정 비율", "선택 페이지 적용", "같은 상대 위치", "실행 취소·다시 실행"] },
  },
  "/tools/pdf-editor/merge": {
    title: "PDF 합치기 - 여러 파일을 순서대로 병합 | Worklazy Tools",
    description: "여러 개의 PDF 문서를 원하는 순서대로 합쳐 하나의 PDF 파일로 간편하게 저장하세요.",
    application: { name: "PDF 합치기", featureList: ["여러 PDF 합치기", "페이지 순서 확인", "병합 출력", "브라우저 처리"] },
  },
  "/tools/pdf-editor/split": {
    title: "PDF 분할·페이지 추출 - 필요한 구간 저장 | Worklazy Tools",
    description: "PDF 파일에서 원하는 범위를 선택하여 자르고, 필요한 구간만 따로 저장하세요.",
    application: { name: "PDF 분할", featureList: ["나누기 위치 선택", "범위별 저장", "최초 전체 범위", "브라우저 처리"] },
  },
  "/tools/pdf-editor/delete": {
    title: "PDF 페이지 삭제 - 불필요한 쪽 제거 | Worklazy Tools",
    description: "PDF에서 불필요한 페이지를 직접 선택해 삭제한 뒤, 나머지 페이지를 하나의 문서로 저장하세요.",
    application: { name: "PDF 페이지 삭제", featureList: ["페이지 선택 삭제", "나머지 병합 저장", "첫 작업 안내", "자동 삭제 없음"] },
  },
  "/tools/pdf-editor/rotate": {
    title: "PDF 회전 저장 - 페이지 방향 바꾸기 | Worklazy Tools",
    description: "방향이 잘못된 PDF 페이지를 선택하여 올바른 방향으로 회전시키고 저장하세요.",
    application: { name: "PDF 회전", featureList: ["페이지 선택 회전", "向き 바로잡기", "첫 작업 안내", "자동 회전 없음"] },
  },
  "/tools/pdf-editor/ocr": {
    title: "PDF OCR - 스캔 문서를 검색 가능한 PDF로 | Worklazy Tools",
    description: "스캔된 PDF 문서를 한국어 및 영어 OCR로 분석하여 텍스트 검색이 가능한 PDF로 변환하세요.",
    application: { name: "PDF OCR", featureList: ["전체 페이지 OCR", "한국어·영어", "검색 가능한 PDF", "브라우저 처리"] },
  },
  "/tools/image-studio/resize": {
    title: "사진 크기 조절 - 이미지 픽셀·비율 변경 | Worklazy Tools",
    description: "이미지 비율을 유지하면서 원하는 정확한 픽셀 크기로 사진 크기를 조절하고 저장하세요.",
    application: { name: "사진 크기 조절", featureList: ["픽셀 크기 지정", "비율 유지", "크기 패널 바로 열기", "브라우저 처리"] },
  },
  "/tools/image-studio/mosaic": {
    title: "사진 모자이크 - 원하는 영역 직접 가리기 | Worklazy Tools",
    description: "사진에서 가리고 싶은 개인정보나 민감한 영역을 선택해 모자이크 효과를 적용하세요.",
    application: { name: "사진 모자이크", featureList: ["선택 영역 모자이크", "효과 패널 바로 열기", "브라우저 처리"] },
  },
  "/tools/image-studio/watermark": {
    title: "사진 워터마크 넣기 - 글자·출처 표시 | Worklazy Tools",
    description: "사진에 텍스트 워터마크를 입력하여 저작권 표시나 출처 문구를 쉽게 추가하세요.",
    application: { name: "사진 워터마크", featureList: ["글자 워터마크", "텍스트 패널 바로 열기", "자동 삽입 없음", "브라우저 처리"] },
  },
  "/tools/video-studio/trim": {
    title: "동영상 자르기 - 필요한 구간을 MP4로 | Worklazy Tools",
    description: "영상 파일에서 필요한 특정 구간만 선택하여 불필요한 부분을 잘라내고 MP4로 저장하세요.",
    application: { name: "동영상 자르기", featureList: ["구간 선택", "MP4 저장", "구간 안내", "브라우저 처리"] },
  },
  "/tools/video-studio/merge": {
    title: "동영상 합치기 - 여러 영상을 하나로 | Worklazy Tools",
    description: "여러 개의 영상 파일을 순서대로 배열하여 하나의 MP4 동영상 파일로 합치세요.",
    application: { name: "동영상 합치기", featureList: ["여러 영상 합치기", "그룹 순서", "MP4 저장", "브라우저 처리"] },
  },
  "/tools/video-studio/extract-audio": {
    title: "동영상 음원 추출 - MP4를 MP3로 | Worklazy Tools",
    description: "영상 파일에서 소리만 따로 추출하여 고음질 MP3 형식의 오디오 파일로 저장하세요.",
    application: { name: "음원 추출", featureList: ["음원 추출", "MP3 저장", "구간 안내", "브라우저 처리"] },
  },
  "/tools/audio-studio/trim": {
    title: "MP3·오디오 자르기 - 필요한 구간 저장 | Worklazy Tools",
    description: "오디오나 녹음 파일에서 필요한 구간을 선택하여 원하는 부분만 잘라 저장하세요.",
    application: { name: "오디오 자르기", featureList: ["구간 선택", "선택 구간 저장", "자동 처리 없음", "브라우저 처리"] },
  },
  "/tools/hwp-editor": {
    title: "한글 파일 편집 - HWP·HWPX 온라인 편집 | Worklazy Tools",
    description: "HWP와 HWPX 문서를 브라우저에서 바로 열어 본문과 서식을 편집하고 저장하세요.",
    application: { name: "한글 편집", featureList: ["HWP·HWPX·HML 문서 열기", "본문과 글자 서식 편집", "표·그림·도형·수식 편집", "실행 취소와 문서 찾기", "HWP·HWPX 저장", "HWP 재열기 검증"] },
  },
  "/tools/office-editor": {
    title: "온라인 문서 편집 - Word·Excel·PowerPoint | Worklazy Tools",
    description: "Word, Excel, PowerPoint 문서를 브라우저에서 간편하게 편집하고 저장할 수 있습니다.",
    application: { name: "오피스 편집", featureList: ["파일 드롭 자동 시작", "전체 화면 집중 편집", "한글 대체 글꼴", "DOCX·DOC·ODT Writer", "XLSX·XLS·ODS Calc", "PPTX·PPT·ODP Impress", "실제 다운로드 진행률", "매크로·외부 갱신 차단", "브라우저 내 파일 처리"] },
  },
  "/tools/video-studio": {
    title: "온라인 동영상 편집 - 자르기·합치기·변환 | Worklazy Tools",
    description: "영상 자르기, 이어붙이기, 음원 추출을 지원합니다. 브라우저에서 빠르고 간편하게 영상을 편집하세요.",
    application: { name: "동영상 편집", featureList: ["영상 수 제한 없는 추가·10개 그룹", "빠른 무손실 자르기", "그룹 간 구간 일괄 적용", "그룹별 개별 출력·이어붙이기", "동기 재생·분할 전체화면", "개별·폴더·ZIP 저장", "영상 속 음성 복사·제거·변환", "화질·음질 설정", "GIF·MP3·AAC 출력"] },
  },
  "/tools/audio-studio": {
    title: "온라인 오디오 편집 - 음소거·피치 조절 | Worklazy Tools",
    description: "오디오 파형에서 구간을 자르고 음소거, 복사, 붙여넣기를 하거나 피치 조절 효과를 적용하세요.",
    application: { name: "오디오 편집", featureList: ["고해상도 오디오 파형", "구간 자르기·음소거", "복사·붙여넣기", "피치·음색 효과", "선택 구간 미리 듣기", "실행 취소·다시 실행", "WAV·MP3 저장"] },
  },
  "/tools/image-studio": {
    title: "온라인 사진 편집 - 자르기·그리기·콜라주 | Worklazy Tools",
    description: "사진 크기 조절, 자르기, 모자이크, 필터 적용 및 자유 그리기 기능을 제공하는 다목적 사진 편집기입니다.",
    application: { name: "사진 편집", featureList: ["사진·빈 캔버스 통합 편집", "선택 영역 모자이크·블러", "블러 강도 조절", "연필·붓·지우개", "Undo·Redo", "자르기·이미지·캔버스 크기 조절", "내보내기 크기 지정", "텍스트·도형·스티커 레이어", "일괄 리사이즈", "워터마크", "콜라주", "GIF 애니메이션"] },
  },
  "/tools/text-merger": {
    title: "텍스트 파일 합치기 - TXT·메모 순서대로 병합 | Worklazy Tools",
    description: "여러 TXT 파일을 원하는 순서대로 정렬하고 줄바꿈이나 쉼표 등의 구분자로 하나로 합치세요.",
    application: { name: "텍스트 병합", featureList: ["직접 입력 텍스트 추가", "여러 TXT 파일 불러오기", "직접 입력과 파일 통합 순서 변경", "구분자 선택", "앞뒤 공백 제거", "빈 텍스트 제외", "결과 복사와 TXT 다운로드"] },
  },
  "/tools/text-tools": {
    title: "텍스트 정리 - 줄바꿈·공백·중복 줄 제거 | Worklazy Tools",
    description: "불필요한 공백과 줄바꿈, 중복 줄을 제거하고 대소문자 변환 및 한국어 문장 검사를 실행하세요.",
    application: { name: "텍스트 정돈", featureList: ["공백 정돈", "줄바꿈 합치기", "중복 줄 제거", "Camel Case", "Snake Case", "Kebab Case", "한국어 띄어쓰기 가이드"] },
  },
  "/tools/text-formatter": {
    title: "JSON·SQL·XML 포맷터 - 정렬·들여쓰기 | Worklazy Tools",
    description: "JSON, SQL, XML 텍스트의 문법 오류를 확인하고 읽기 좋게 들여쓰기하여 깔끔하게 정돈하세요.",
    application: { name: "코드 포맷터", featureList: ["JSON 포맷", "SQL 정렬", "XML 포맷", "한 줄 축소", "문법 오류 탐지"] },
  },
  "/tools/work-calculator": {
    title: "영업일·연차 계산기 - 휴일·산정 기준 확인 | Worklazy Tools",
    description: "주말과 대한민국 법정 공휴일을 제외한 정확한 영업일과 입사일 기준 예상 연차를 계산하세요.",
    application: { name: "영업일 계산", featureList: ["대한민국 공휴일", "음력 공휴일", "대체공휴일", "직접 휴일 추가", "입사일 기준 연차", "회계연도 기준 연차"] },
  },
  "/tools/timezone-calculator": {
    title: "시차 계산기 - 도시별 시간·회의 시간 비교 | Worklazy Tools",
    description: "세계지도에서 도시를 선택해 국제 표준 시간대와 서머타임을 반영한 현지 시각 및 회의 시간을 비교하세요.",
    application: { name: "시차 계산", featureList: ["인터랙티브 세계지도", "44개 주요 도시 핀", "도시 검색", "국제 표준 도시 시간대(IANA)", "서머타임 자동 반영", "최대 6개 도시 비교", "30분 단위 회의 추천"] },
  },
  "/tools/payroll-calculator": {
    title: "월급 실수령액·주휴수당·퇴직금 간이 계산기 | Worklazy Tools",
    description: "최신 사회보험 기준으로 주휴수당, 월급 실수령액과 법정 퇴직금을 간편하게 계산하세요.",
    application: { name: "급여 계산", featureList: ["주휴수당", "국민연금", "건강보험", "장기요양보험", "고용보험", "근로소득세 추정", "퇴직금"] },
  },
  "/tools/image-privacy": {
    title: "사진 위치정보 삭제 - EXIF·GPS 확인 및 제거 | Worklazy Tools",
    description: "사진에 숨겨진 GPS 위치 및 촬영 기기 정보(EXIF)를 확인하고 완전히 삭제하세요.",
    application: { name: "위치정보 삭제", featureList: ["JPG·PNG·WebP 지원", "숨은 촬영 정보(EXIF) 확인", "GPS 위치 확인", "촬영 기기·시각 확인", "사진 내용만 새 파일로 저장", "메타데이터 제거"] },
  },
  "/tools/security-tools": {
    title: "비밀번호 생성기 - 무작위 생성·강도 확인 | Worklazy Tools",
    description: "보안 난수를 기반으로 무작위 비밀번호를 생성하고, 예상 해독 시간과 패턴으로 안전성을 측정하세요.",
    application: { name: "비밀번호 생성", featureList: ["보안 난수 비밀번호 생성", "8~64자 길이", "문자 종류 선택", "패턴 강도 분석", "추측 난이도", "초당 100억 회 기준 예상 해독 시간"] },
  },
  "/tools/qr-studio": {
    title: "QR 코드 만들기·읽기 - 로고 삽입·사진 스캔 | Worklazy Tools",
    description: "URL, 텍스트 등으로 QR 코드를 만들거나 카메라 및 사진 업로드로 기존 QR 코드를 스캔하세요.",
    application: { name: "QR 스튜디오", featureList: ["URL QR 생성", "텍스트 QR 생성", "중앙 로고", "실시간 카메라 스캔", "사진 QR 스캔", "모바일 공유·저장"] },
  },
  "/tools/qr-studio/bulk": {
    title: "QR 코드 일괄 생성 - 엑셀·CSV로 대량 생성 | Worklazy Tools",
    description: "엑셀(Excel)이나 CSV 데이터 목록을 이용하여 한 번에 수많은 QR 코드를 일괄 생성하세요.",
    application: { name: "QR 일괄 생성", featureList: ["Excel·CSV 행별 QR", "7종 표준 페이로드", "열 번호 매핑·머리글 템플릿", "로고·투명 PNG", "생성 후 재판독", "증분 ZIP", "A4·Letter 라벨 PDF", "XLSX 생성·실패 보고서"] },
  },
  "/tools/data-converter": {
    title: "CSV·JSON·HTML 표 변환기 | Worklazy Tools",
    description: "CSV 파일, JSON 배열, HTML 표 데이터를 브라우저 환경에서 자유롭게 변환하고 저장하세요.",
    application: { name: "데이터 변환", featureList: ["CSV JSON 변환", "JSON CSV 변환", "HTML 표 변환", "CSV 파일 불러오기", "브라우저 내 파싱", "파일 다운로드"] },
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
  "foliotrace": "FolioTrace | NPS Disclosed Holdings",
  "document-redactor": "Redact PDF & Images - Blackout Private Info | Worklazy Tools",
  "excel-merger": "Excel Merger - Combine Files & Merge Sheets | Worklazy Tools",
  "excel-compare": "Compare Excel Files - Find Differences in Values & Formulas | Worklazy Tools",
  "excel-cleaner": "Excel Data Cleaner - Remove Spaces, Blank Rows & Duplicates | Worklazy Tools",
  "document-generator": "Batch Word Document Generator - Excel to Word Mail Merge | Worklazy Tools",
  "pdf-editor": "PDF Editor - Reorder, Merge, Split & Convert | Worklazy Tools",
  "document-compare": "Compare Word & HWP Documents - Track Changes | Worklazy Tools",
  "pdf-compare": "Compare PDF Files - Check Visual & Text Differences | Worklazy Tools",
  "hwp-editor": "HWP Editor - Edit HWP & HWPX Online | Worklazy Tools",
  "office-editor": "Online Office Editor - Word, Excel & PowerPoint | Worklazy Tools",
  "video-studio": "Online Video Editor - Trim, Merge & Convert | Worklazy Tools",
  "audio-studio": "Online Audio Editor - Mute, Trim & Pitch Shift | Worklazy Tools",
  "image-studio": "Online Photo Editor - Crop, Draw & Collage | Worklazy Tools",
  "text-merger": "Merge Text Files - Combine TXT & Notes | Worklazy Tools",
  "text-tools": "Text Cleaner - Remove Line Breaks & Spaces | Worklazy Tools",
  "text-formatter": "JSON, SQL & XML Formatter - Align & Indent | Worklazy Tools",
  "work-calculator": "Business Day & PTO Calculator - Working Days | Worklazy Tools",
  "timezone-calculator": "Timezone Converter - Compare World & Meeting Times | Worklazy Tools",
  "payroll-calculator": "Salary, Holiday Pay & Severance Calculator | Worklazy Tools",
  "image-privacy": "Remove Photo Location - Delete EXIF & GPS Data | Worklazy Tools",
  "security-tools": "Password Generator - Secure Random Passwords | Worklazy Tools",
  "qr-studio": "QR Code Generator & Scanner - Add Logo | Worklazy Tools",
  "data-converter": "CSV, JSON & HTML Table Converter | Worklazy Tools",
};

const englishPageSeo: Record<string, SeoDefinition> = {
  "/tools/foliotrace": { title: "FolioTrace | NPS Disclosed Holdings", description: "Explore an estimate based on Korea National Pension Service DART large-shareholding filings. It does not represent actual account balances or total assets." },
  "/tools/document-redactor": {title: "Document Redaction | Mask PDF and Image Areas", description: "Cover selected PDF, JPG, PNG and WebP areas with black masks and save a new copy. Original files remain unchanged; every PDF page is rasterized.", application: {name: "Document Redaction", featureList: ["Manual area selection", "Solid black pixel masks", "Rasterize every PDF page", "PNG image output", "Review results"]}},
  "/": { title: "Free Browser Tools for Documents, Media & Work | Worklazy Tools", description: "Edit documents and media, convert text and data, plan work across time zones, and use practical privacy tools without installing software." },
  "/tools": { title: "All Free Browser Tools | Worklazy Tools", description: "Browse free tools for documents, media, text, data, work planning, Korean payroll, privacy and sharing." },
  "/tools/excel-merger": { title: "Excel Merger | Combine XLSX, XLS & CSV Files", description: "Combine XLSX, XLS, XLSB, XLSM and CSV files into one XLSX with separate formula and formatting controls for XLSX and XLS input.", application: { name: "Excel Merger", featureList: ["XLSX, XLS, XLSB, XLSM and CSV merging", "Separate-sheet, vertical and horizontal layouts", "Empty-area cleanup", "Independent XLSX formula and formatting preservation", "Independent XLS formula and formatting preservation", "Encrypted input and output"] } },
  "/tools/excel-compare": { title: "Excel Compare | Compare XLSX, XLS, XLSB & CSV Files", description: "Check a suggested header, compare Excel and CSV pairs by position, keys or reconciliation rules, and download a nine-sheet XLSX report.", application: { name: "Excel Compare", featureList: ["XLSX, XLSM, XLS, XLSB, SpreadsheetML and CSV", "Suggested header selection and manual changes", "Position, key and reconciliation matching", "Grouped left and right rows for duplicate keys", "Formula and cached-value comparison", "XLSX and XLSM formatting comparison", "Nine-sheet report per pair", "ZIP for multiple successful pairs"] } },
  "/tools/excel-cleaner": { title: "Excel Data Cleaner | Clean XLSX, XLS & CSV Files", description: "Apply 28 ordered structure, text, row-filter, and value-conversion rules to Excel and CSV files, then download cleaned XLSX, CSV, reports, and ZIP results.", application: { name: "Excel Data Cleaner", featureList: ["Multiple Excel and CSV files", "13 structure rules", "7 text rules", "3 row-filter rules", "5 value-conversion rules", "Formula-reference updates and safe fallback", "XLSX, CSV, and ZIP results"] } },
  "/tools/document-generator": { title: "Word Mail Merge | Template-based Bulk Document Generator", description: "Replace variables in a Word template with Excel data to automatically generate hundreds of individual documents at once, just like Mail Merge.", application: { name: "Template-based Bulk Document Generator", featureList: ["Word Mail Merge", "DOCX template variables", "Multiple Excel and CSV files", "Sheet and header-row selection", "Sample DOCX", "Individual files, ZIP and XLSX reports"] } },
  "/tools/pdf-compare": { title: "PDF Compare | Visual and Extracted Text Differences", description: "Compare before-and-after PDF pairs by page, inspect rendered pixel and extracted-text differences, and download XLSX or ZIP reports in your browser.", application: { name: "PDF Compare", featureList: ["Multiple PDF pairs", "Page-number and manual mapping", "Rendered pixel comparison", "Extracted text comparison", "Added and deleted pages", "XLSX and ZIP reports"] } },
  "/tools/qr-studio/bulk": { title: "Bulk QR Code Generator - Excel & CSV | Worklazy Tools", description: "Create a massive number of QR codes all at once using data lists from Excel or CSV files.", application: { name: "Bulk QR Generator", featureList: ["Excel and CSV row mapping", "Seven standard payload types", "Header templates", "Logo and transparent PNG", "Read-back verification", "Incremental ZIP", "A4 and Letter label PDF", "XLSX manifest and failures"] } },
  "/tools/pdf-editor/image-to-pdf": { title: "Image to PDF - Convert JPG & PNG to PDF | Worklazy Tools", description: "Arrange multiple JPG or PNG images and combine them into a single, clean PDF file.", application: { name: "Image to PDF", featureList: ["JPG to PDF", "PNG to PDF", "Image ordering", "Automatic A4 fitting"] } },
  "/tools/pdf-editor/pdf-to-image": { title: "PDF to JPG & PNG - Save Pages as Images | Worklazy Tools", description: "Convert every page of a PDF into high-resolution PNG or JPG images, and download them all at once in a ZIP file.", application: { name: "PDF to Image", featureList: ["PDF to PNG", "PDF to JPG", "Resolution selection", "ZIP download"] } },
  "/tools/pdf-editor/convert": { title: "Convert PDF to Word & Excel - DOCX, XLSX, TXT | Worklazy Tools", description: "Use OCR technology to convert selected PDF pages into editable DOCX, XLSX, or TXT files.", application: { name: "Convert PDF", featureList: ["Page-range selection", "PDF to DOCX", "PDF to XLSX", "PDF to TXT", "Local OCR", "Searchable PDF"] } },
  "/tools/pdf-editor/finish": { title: "PDF Page Numbers, Watermarks & Stamps | Worklazy Tools", description: "Batch apply page numbers, headers, footers, watermarks, and stamp images across multiple PDFs.", application: { name: "PDF Finish", featureList: ["Page numbers", "Headers and footers", "Text and image watermarks", "Stamp and signature images", "Multiple PDF processing", "ZIP download"] } },
  "/tools/pdf-editor/page-numbers": { title: "Add PDF Page Numbers - Skip Cover & Set Start | Worklazy Tools", description: "Insert page numbers in your preferred format, with options to skip the cover page or set a custom starting number.", application: { name: "PDF Page Numbers", featureList: ["Starting number", "Starting page", "Cover exclusion", "Page ranges", "Parity filter", "Thumbnail selection"] } },
  "/tools/pdf-editor/header-footer": { title: "Add PDF Header & Footer - Filename & Date | Worklazy Tools", description: "Add text such as filenames, dates, or page numbers to desired header or footer positions in your PDF.", application: { name: "PDF Header & Footer", featureList: ["Filename token", "Batch-start date", "Page-number tokens", "Six positions", "Size and color", "Overlay preview"] } },
  "/tools/pdf-editor/watermark": { title: "Add PDF Watermark - Text & Image Marks | Worklazy Tools", description: "Place repeating text or image watermarks in the background or foreground of your PDF, and adjust the transparency.", application: { name: "PDF Watermark", featureList: ["Vector text", "PNG and JPEG images", "Background and foreground layers", "Single and repeated placement", "Rotation and opacity", "Overlay preview"] } },
  "/tools/pdf-editor/stamp": { title: "Add PDF Stamps & Signatures | Worklazy Tools", description: "Freely position and resize signature or stamp images, and apply them across multiple PDF pages at once.", application: { name: "PDF Stamp", featureList: ["PNG and JPEG images", "Direct move and resize", "Fixed aspect ratio", "Selected-page placement", "Same relative position", "Undo and redo"] } },
  "/tools/pdf-editor/merge": { title: "Merge PDF - Combine Multiple Files in Order | Worklazy Tools", description: "Combine several PDF documents in your preferred order and easily save them as a single PDF file.", application: { name: "Merge PDF", featureList: ["Combine multiple PDFs", "Check page order", "Merged output", "Browser processing"] } },
  "/tools/pdf-editor/split": { title: "Split PDF & Extract Pages - Save Needed Sections | Worklazy Tools", description: "Select specific page ranges to extract from your PDF, and save only the sections you need.", application: { name: "Split PDF", featureList: ["Split positions", "Save by range", "Initial full range", "Browser processing"] } },
  "/tools/pdf-editor/delete": { title: "Delete PDF Pages - Remove Unwanted Pages | Worklazy Tools", description: "Select and remove unwanted pages from a PDF, then save the remaining pages as a single document.", application: { name: "Delete PDF Pages", featureList: ["Select pages to delete", "Save the rest merged", "First-task guidance", "No automatic deletion"] } },
  "/tools/pdf-editor/rotate": { title: "Rotate PDF - Change Page Orientation | Worklazy Tools", description: "Select PDF pages that are facing the wrong way, rotate them to the correct orientation, and save the file.", application: { name: "Rotate PDF", featureList: ["Select pages to rotate", "Correct orientation", "First-task guidance", "No automatic rotation"] } },
  "/tools/pdf-editor/ocr": { title: "PDF OCR - Make Scanned PDFs Searchable | Worklazy Tools", description: "Analyze scanned PDF documents using Korean and English OCR to transform them into text-searchable PDFs.", application: { name: "PDF OCR", featureList: ["Full-page OCR", "Korean and English", "Searchable PDF", "Browser processing"] } },
  "/tools/image-studio/resize": { title: "Resize Image - Change Photo Pixels & Ratio | Worklazy Tools", description: "Adjust your photos to exact pixel dimensions while maintaining the original aspect ratio.", application: { name: "Resize Image", featureList: ["Exact pixel size", "Keep aspect ratio", "Size panel opens directly", "Browser processing"] } },
  "/tools/image-studio/mosaic": { title: "Image Mosaic - Blur Specific Areas | Worklazy Tools", description: "Select and apply a mosaic blur to personal information or sensitive areas you want to hide in a photo.", application: { name: "Image Mosaic", featureList: ["Selected-area mosaic", "Effect panel opens directly", "Browser processing"] } },
  "/tools/image-studio/watermark": { title: "Add Image Watermark - Text & Copyright | Worklazy Tools", description: "Easily insert text watermarks into your photos to indicate copyright or source information.", application: { name: "Image Watermark", featureList: ["Text watermark", "Text panel opens directly", "No automatic insertion", "Browser processing"] } },
  "/tools/video-studio/trim": { title: "Trim Video - Save Specific Sections as MP4 | Worklazy Tools", description: "Select only the specific sections you need from a video file, cut out the unwanted parts, and save it as an MP4.", application: { name: "Trim Video", featureList: ["Section selection", "MP4 output", "Section guidance", "Browser processing"] } },
  "/tools/video-studio/merge": { title: "Merge Video - Combine Multiple Videos | Worklazy Tools", description: "Arrange several video files in order and merge them into a single MP4 video file.", application: { name: "Merge Video", featureList: ["Combine multiple videos", "Group order", "MP4 output", "Browser processing"] } },
  "/tools/video-studio/extract-audio": { title: "Extract Audio from Video - MP4 to MP3 | Worklazy Tools", description: "Extract only the sound track from a video file and save it as a high-quality MP3 audio file.", application: { name: "Extract Audio", featureList: ["Audio extraction", "MP3 output", "Section guidance", "Browser processing"] } },
  "/tools/audio-studio/trim": { title: "Trim Audio & MP3 - Save Needed Sections | Worklazy Tools", description: "Select the specific sections you need from an audio or recording file, cut out the rest, and save the result.", application: { name: "Trim Audio", featureList: ["Section selection", "Save selection", "No automatic processing", "Browser processing"] } },
  "/about": { title: "About | Worklazy Tools", description: "Learn how Worklazy Tools processes documents and media in the browser and where each tool's compatibility boundaries apply." },
  "/privacy": { title: "Privacy Policy | Worklazy Tools", description: "Read how local file processing, Google and Naver Analytics, advertising and cookies are handled by Worklazy Tools." },
  "/terms": { title: "Terms of Use | Worklazy Tools", description: "Review the conditions, supported scope, user responsibilities and limitations for Worklazy Tools browser utilities." },
  "/contact": { title: "Contact, Suggestions & Bug Reports | Worklazy Tools", description: "Report a bug, suggest a feature or contact Worklazy Tools about privacy without attaching sensitive work files." },
  "/licenses": { title: "Licenses & Third-Party Notices | Worklazy Tools", description: "Review Worklazy Tools copyright terms and licenses for rhwp, ffmpeg.wasm and other open-source components." },
};

export const toolSlugByPath: Record<string, keyof typeof enTools.items> = {
  "/tools/foliotrace": "foliotrace",
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
