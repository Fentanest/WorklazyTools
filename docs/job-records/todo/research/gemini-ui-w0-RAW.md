지시하신 원칙(`main` 브랜치 읽기 전용, 설치 금지, 수치별 산출 명령 병기)에 따라 현행 `main`(`2d0ff3a`) 브랜치를 기준으로 UI 전면 개편 W0 사전 측정을 완료했습니다. 

조사 결과는 아래의 표로 정리했습니다.

### 표 1. 규모 측정
| 항목 | 값 | 산출 명령 |
|---|---|---|
| `dark:` 클래스를 쓰는 파일 수 | 50 | `git grep -lE "dark:" main -- 'src/**/*.tsx' 'src/**/*.ts' \| wc -l` |
| UI 프리미티브 소비 파일 수<br/>(`src/components/ui/**` 를 import 하는 파일) | 61 | `git grep -lE "import .* from ['\"].*/ui(/.*)?['\"]" main -- 'src/**/*.tsx' 'src/**/*.ts' \| wc -l` |
| 시각 회귀 기준선 PNG 파일 수 | 183 | `git ls-tree -r main:tests/visual-baselines \| grep '\.png$' \| wc -l` |
| 등록된 도구 수(ko / en) | ko 20 / en 19 | 도구 목록: `git show main:src/app/toolRegistry.ts \| grep -E "^[[:space:]]+id: \"[a-z-]+\"" \| grep -v "category" \| wc -l` <br/> 제외 로직: `git grep "hwp-editor" main:src/i18n/useToolCatalog.ts` (`language === "ko" \|\| tool.id !== "hwp-editor"`) |
| `src/app/seo.ts` 의 route 등록 수 | 45 | `git show main:src/app/seo.ts \| grep '^  \"/.*\": {' \| wc -l` |
| ko/en `features.json` 최상위 키 수 | 18 | `git show main:src/locales/ko/features.json \| jq 'keys \| length'` |

---

### 표 2. 색 토큰 현황

**CSS 변수로 정의된 색 토큰 전체 목록 (light / dark 값이 모두 선언된 토큰)**
- **`src/styles/global.css`**: `--bg`, `--bg-elevated`, `--bg-solid`, `--bg-muted`, `--label`, `--label-secondary`, `--label-tertiary`, `--separator`, `--glass-border`, `--glass-shadow`, `--card-shadow`, `--blue-soft`, `--green`, `--green-soft`, `--orange-soft`, `--pink-soft`, `--sky`, `--sky-soft`, `--success` 
- **`src/styles/tailwind.css`**: `--primary`, `--sidebar-primary`, `--destructive`

**하드코딩된 색(`#`, `rgb(`, `hsl(`)이 남아 있는 파일과 줄 번호 목록 (TypeScript / TSX 기준)**
> **산출 명령**: `git grep -nE "(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()" main -- 'src/**/*.tsx' 'src/**/*.ts' | awk -F: '{print $2":"$3}' | awk -F: '{a[$1]=a[$1]==""?$2:a[$1]", "$2} END{for(i in a) print i": "a[i]}'`

- `src/features/qr-studio/QrStudioPage.tsx`: 22, 272, 337
- `src/features/document-compare/DocumentFileColumn.tsx`: 65, 66
- `src/features/video-studio/videoStream.worker.ts`: 942
- `src/features/pdf-editor/PdfImagePanel.tsx`: 201
- `src/components/AppShell.tsx`: 185, 191
- `src/features/video-studio/VideoTrimLane.tsx`: 41
- `src/features/qr-studio/QrBulkPanel.tsx`: 88, 89
- `src/features/video-studio/VideoGroupSection.tsx`: 221, 231, 243, 244, 246, 256, 261, 278, 291, 348, 349, 350, 351, 353, 354, 355, 356, 366, 372, 373, 374, 376
- `src/features/office-editor/OfficeEditorPage.tsx`: 45
- `src/features/image-studio/ImageStudioPage.tsx`: 190, 196, 498, 499, 595, 706, 795, 1186, 1571, 1787, 1808, 1965, 1966, 1967, 2407, 2408
- `src/features/pdf-editor/pdf.worker.ts`: 114
- `src/features/image-studio/ImageProcessingPanels.tsx`: 55, 77, 125, 153
- `src/features/pdf-editor/pdfWorkerClient.ts`: 128
- `src/features/word-compare/WordCompareResultPage.tsx`: 208, 209, 210, 243, 257, 260, 275, 277, 279, 280, 281, 282, 283, 284, 331, 364
- `src/features/image-studio/imageEditorTypes.ts`: 42, 43
- `src/features/document-compare/DocumentComparePage.tsx`: 136
- `src/features/hwp-editor/HwpEditorPage.tsx`: 200
- `src/features/audio-studio/AudioStudioPage.tsx`: 120, 138, 144, 145, 146, 168, 608
- `src/features/pdf-editor/PdfThumbnail.tsx`: 104
- `src/features/qr-studio/qr-scan.worker.ts`: 12
- `src/features/image-studio/image.worker.ts`: 192, 193, 239
- `src/features/qr-studio/qrLabelPdf.ts`: 59, 66
- `src/features/qr-studio/qr-bulk.worker.ts`: 94
- `src/features/timezone-calculator/WorldTimeMap.tsx`: 86, 89, 90, 145
- `src/features/office-editor/OfficeEditorAppPage.tsx`: 226, 233, 236, 237, 241
- `src/features/pdf-editor/pdfPreview.ts`: 156, 172, 250, 362
- `src/features/image-studio/imageEditorShapes.ts`: 27, 30, 33, 36, 39, 44, 45, 53, 59, 62
- `src/features/pdf-editor/PdfOrganizePanel.tsx`: 489
- `src/components/ToolCard.tsx`: 29

---

### 표 3. 현행 메인 페이지 구조

| 구분 | 현행 상태 및 파일 경로 기준 트리 |
|---|---|
| **컴포넌트 트리** | `src/components/AppShell.tsx` (셸 레이아웃)<br/>└── `<main className="main-content">`<br/>&nbsp;&nbsp;&nbsp;&nbsp;└── `src/pages/HomePage.tsx`<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── `<section className="hero compact-home-hero">`<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── `<section className="home-section">`<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── `<div className="tool-grid">`<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── `src/components/ToolCard.tsx`<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── `<PrivacyBanner />`<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── `<section className="home-how">` |
| **상단 바** | **데스크톱에는 상단 바가 존재하지 않음** (`<nav className="desktop-language-switcher">`만 별도로 우상단에 플로팅 됨). 모바일 뷰어용 `<header className="mobile-header glass-bar">`만 존재. |
| **사이드바** | `<aside className="desktop-sidebar glass-panel">` 형태로 데스크톱 레이아웃에 고정 **존재**. |
| **카드 그리드** | 홈 화면의 `<div className="tool-grid">` 하위에 20개의 `<ToolCard>` 요소들이 매핑되어 **존재**. |

---

### 표 4. 정본 계획과 현행의 차이
(`docs/jobs/todo/ui-theme-redesign-20260907.md` 에서 전제한 수치와 현행 `main` 실측치의 불일치 항목)

| 항목 | 정본 계획서 전제 수치 | 현행 실측 수치 |
|---|---|---|
| **시각 회귀 기준선 PNG 파일 수** | `175장` (v2 기준) | **`183장`** |
| **정적 생성 라우트 / SEO 페이지 수** | 정적 생성 HTML `61페이지` (v1 기준) | `src/app/seo.ts` 등록 기준(ko/en 합산) **`45개`** |

> ※ `dark:` 50파일, UI import 61파일, 등록된 도구 ko 20 / en 19 등의 핵심 수치는 계획서 v2 변경분(S3 브랜치 수치에서 `5bc6854` 현행 기준으로 정정된 수치)과 현재 `main`(`2d0ff3a`) 실측치가 정확히 일치했습니다. 차이가 나는 부분은 위 두 항목뿐입니다.
