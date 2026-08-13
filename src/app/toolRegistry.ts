import {
  Columns3,
  FileSearch2,
  FileSpreadsheet,
  FileStack,
  FileText,
  Files,
  Film,
  Images,
  ImageDown,
  LockKeyhole,
  Music2,
  type LucideIcon,
  Rows3,
  ScanText,
  Scissors,
  Sheet,
  Sparkles,
} from "lucide-react";

export type ToolAccent = "green" | "blue" | "violet" | "orange" | "pink" | "sky";

export interface ToolDefinition {
  id: string;
  path: string;
  title: string;
  shortTitle: string;
  description: string;
  eyebrow: string;
  accent: ToolAccent;
  icon: LucideIcon;
  highlights: Array<{ icon: LucideIcon; label: string }>;
  status: "available" | "soon";
}

export const tools: ToolDefinition[] = [
  {
    id: "excel-merger",
    path: "/tools/excel-merger",
    title: "Excel Merger",
    shortTitle: "Excel 병합",
    description: "여러 Excel 파일과 CSV를 원하는 방식으로 하나의 파일에 정리합니다.",
    eyebrow: "스프레드시트",
    accent: "green",
    icon: FileSpreadsheet,
    highlights: [
      { icon: Sheet, label: "시트별 병합" },
      { icon: Rows3, label: "세로 병합" },
      { icon: Columns3, label: "가로 병합" },
      { icon: LockKeyhole, label: "SheetTrim·암호" },
    ],
    status: "available",
  },
  {
    id: "pdf-editor",
    path: "/tools/pdf-editor",
    title: "PDF Tools",
    shortTitle: "PDF 도구",
    description: "PDF 페이지를 편집·병합·범위별 추출하고 이미지·DOCX·XLSX·TXT로 변환하거나 브라우저 OCR을 실행합니다.",
    eyebrow: "PDF 편집·변환",
    accent: "violet",
    icon: FileStack,
    highlights: [
      { icon: Files, label: "편집·범위 추출" },
      { icon: ImageDown, label: "이미지 변환" },
      { icon: FileText, label: "DOCX·TXT" },
      { icon: FileSpreadsheet, label: "XLSX·OCR" },
    ],
    status: "available",
  },
  {
    id: "word-compare",
    path: "/tools/word-compare",
    title: "Word Compare",
    shortTitle: "Word 비교",
    description: "수정 전후 Word 문서의 본문·표·서식 변경을 비교하고 웹·Excel·변경 추적 DOCX로 확인합니다.",
    eyebrow: "문서 비교",
    accent: "blue",
    icon: FileSearch2,
    highlights: [
      { icon: FileSearch2, label: "문단·문장 Diff" },
      { icon: Rows3, label: "표 변경 확인" },
      { icon: FileSpreadsheet, label: "Excel 보고서" },
      { icon: Files, label: "다중 동시 비교" },
    ],
    status: "available",
  },
  {
    id: "hwp-editor",
    path: "/tools/hwp-editor",
    title: "HWP Editor",
    shortTitle: "HWP 편집",
    description: "HWP·HWPX 문서를 공식 rhwp Studio에서 편집하고 다시 HWP·HWPX로 저장합니다.",
    eyebrow: "한글 문서",
    accent: "orange",
    icon: ScanText,
    highlights: [
      { icon: FileText, label: "HWP·HWPX·HML" },
      { icon: ScanText, label: "전체 문서 편집" },
      { icon: Rows3, label: "서식·표·개체" },
      { icon: LockKeyhole, label: "암호 문서" },
    ],
    status: "available",
  },
  {
    id: "hwp-compare",
    path: "/tools/hwp-compare",
    title: "HWP Compare",
    shortTitle: "HWP 비교",
    description: "수정 전후 HWP·HWPX 문서의 본문·표·개요 번호 변경을 웹과 Excel에서 확인합니다.",
    eyebrow: "한글 문서 비교",
    accent: "orange",
    icon: FileSearch2,
    highlights: [
      { icon: FileSearch2, label: "문단·문장 Diff" },
      { icon: Rows3, label: "표 구조 비교" },
      { icon: FileSpreadsheet, label: "Excel 보고서" },
      { icon: Files, label: "다중 동시 비교" },
    ],
    status: "available",
  },
  {
    id: "video-studio",
    path: "/tools/video-studio",
    title: "Video Studio",
    shortTitle: "비디오 스튜디오",
    description: "최대 6개 영상을 6개 그룹으로 나누고 그룹별 구간·동기 재생·개별 출력·이어붙이기를 설정합니다.",
    eyebrow: "비디오 편집",
    accent: "pink",
    icon: Film,
    highlights: [
      { icon: Film, label: "최대 6개 그룹" },
      { icon: Scissors, label: "패스스루 자르기" },
      { icon: Files, label: "그룹별 개별·연결" },
      { icon: Music2, label: "GIF·MP3·AAC" },
    ],
    status: "available",
  },
  {
    id: "image-studio",
    path: "/tools/image-studio",
    title: "Image Studio",
    shortTitle: "이미지 스튜디오",
    description: "이미지를 꾸미고 여러 파일을 일괄 편집하거나 콜라주와 GIF로 만듭니다.",
    eyebrow: "이미지 편집",
    accent: "sky",
    icon: Images,
    highlights: [
      { icon: Sparkles, label: "레이어 편집" },
      { icon: Images, label: "일괄 리사이즈" },
      { icon: FileStack, label: "콜라주" },
      { icon: Film, label: "GIF 애니메이션" },
    ],
    status: "available",
  },
];
