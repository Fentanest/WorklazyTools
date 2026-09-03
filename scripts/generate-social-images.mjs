import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outputDirectory = path.resolve("public/social/tools");

const tools = [
  tool("excel-merger", "#22a65a", "문서·스프레드시트", "Excel 병합기", "여러 파일 · 시트별 · 세로 · 가로 병합", "Documents & spreadsheets", "Excel Merger", "Combine files · sheets · rows · columns"),
  tool("excel-compare", "#22a65a", "스프레드시트 비교", "Excel 파일 비교", "위치 · 키 · 회계 대사 · 쌍별 보고서", "Spreadsheet comparison", "Excel Compare", "Position · keys · reconciliation · reports"),
  tool("document-compare", "#0879d9", "문서 비교", "Word·HWP 문서 비교", "DOCX·DOC · HWP·HWPX · 이동·분할 판정", "Document comparison", "Document Compare", "DOCX & DOC · HWP & HWPX · move detection"),
  tool("pdf-tools", "#7554d8", "PDF 편집·변환", "PDF 도구", "페이지 편집 · 병합 · 변환 · OCR", "PDF editing & conversion", "PDF Tools", "Edit · merge · convert · OCR"),
  tool("image-to-pdf", "#7554d8", "PDF 편집·변환", "이미지를 PDF로 변환", "JPG·PNG · 순서 변경 · A4 맞춤", "PDF editing & conversion", "Image to PDF", "JPG & PNG · reorder · A4 fit"),
  tool("pdf-to-image", "#7554d8", "PDF 편집·변환", "PDF를 이미지로 변환", "PNG·JPG · 해상도 선택 · ZIP 저장", "PDF editing & conversion", "PDF to Image", "PNG & JPG · resolution · ZIP download"),
  tool("pdf-convert", "#7554d8", "PDF 편집·변환", "PDF 문서 변환·OCR", "DOCX·XLSX·TXT · 한국어·영어 OCR", "PDF editing & conversion", "PDF Conversion & OCR", "DOCX · XLSX · TXT · Korean & English OCR"),
  tool("hwp-editor", "#db7a16", "한글 문서", "HWP 편집기", "HWP·HWPX · 본문 · 표 · 개체 편집", "Hangul documents", "HWP Editor", "HWP & HWPX · text · tables · objects"),
  tool("office-editor", "#7554d8", "브라우저 오피스", "오피스 편집기", "Writer · Calc · Impress · 브라우저 저장", "Browser office", "Office Editor", "Writer · Calc · Impress · local saving"),
  tool("video-studio", "#d8468f", "미디어", "비디오 스튜디오", "영상 자르기 · 이어붙이기 · 음원 추출", "Media", "Video Studio", "Trim · join · extract audio"),
  tool("audio-studio", "#7554d8", "미디어", "오디오 스튜디오", "파형 편집 · 구간 자르기 · 피치 조절", "Media", "Audio Studio", "Waveform editing · trimming · pitch"),
  tool("image-studio", "#0b91c9", "미디어", "이미지 스튜디오", "사진 편집 · 모자이크 · 콜라주 · GIF", "Media", "Image Studio", "Photo editing · mosaic · collage · GIF"),
  tool("text-merger", "#0879d9", "텍스트·데이터", "텍스트 병합", "직접 입력 · TXT 파일 · 통합 순서 변경", "Text & data", "Text Merger", "Pasted text · TXT files · unified ordering"),
  tool("text-tools", "#0879d9", "텍스트·데이터", "텍스트 정돈", "공백 · 줄바꿈 · 중복 줄 · 케이스 변환", "Text & data", "Text Cleanup", "Whitespace · lines · duplicates · letter case"),
  tool("code-formatter", "#7554d8", "텍스트·데이터", "코드 포맷터", "JSON · SQL · XML · 문법 검사", "Text & data", "Code Formatter", "JSON · SQL · XML · syntax validation"),
  tool("workday-calculator", "#22a65a", "업무 계산", "영업일·연차 계산기", "대한민국 공휴일 · 입사일 · 회계연도", "Work planning", "Korean Workday Calculator", "Business days · holidays · annual leave"),
  tool("world-time-planner", "#0b91c9", "글로벌 협업", "세계 시간 플래너", "도시 시차 · 서머타임 · 회의 시간", "Global collaboration", "World Time Planner", "City times · daylight saving · meeting hours"),
  tool("payroll-calculator", "#db7a16", "급여·노무", "급여 계산기", "주휴수당 · 실수령액 · 퇴직금", "Korean payroll", "Korean Payroll Calculator", "Weekly holiday · take-home · severance pay"),
  tool("photo-metadata-remover", "#d8468f", "사진 메타데이터", "사진 메타데이터 제거", "EXIF · GPS · 촬영 기기 · 촬영 시각", "Photo metadata", "Photo Metadata Remover", "EXIF · GPS · camera · capture time"),
  tool("password-generator", "#7554d8", "보안", "비밀번호 생성기", "보안 난수 · 강도 분석 · 해독 시간", "Security", "Password Generator", "Secure randomness · strength · crack time"),
  tool("qr-studio", "#0879d9", "보안·공유", "QR 스튜디오", "QR 코드 만들기 · 카메라·사진 스캔", "Privacy & sharing", "QR Studio", "Create QR codes · scan camera & images"),
  tool("table-data-converter", "#22a65a", "텍스트·데이터", "표 데이터 변환기", "CSV · JSON · HTML 상호 변환", "Text & data", "Table Data Converter", "Convert CSV · JSON · HTML tables"),
];

await fs.mkdir(outputDirectory, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: await findBrowser(),
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  for (const item of tools) {
    for (const language of ["ko", "en"]) {
      const copy = item[language];
      const outputPath = path.join(outputDirectory, `${item.slug}-${language}.png`);
      await page.setContent(renderSvg({ ...copy, accent: item.accent, language }), { waitUntil: "load" });
      await page.screenshot({ path: outputPath, type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
    }
  }
} finally {
  await browser.close();
}

console.log(`Generated ${tools.length * 2} localized social images in ${outputDirectory}`);

function tool(slug, accent, koCategory, koTitle, koSubtitle, enCategory, enTitle, enSubtitle) {
  return {
    slug,
    accent,
    ko: { category: koCategory, title: koTitle, subtitle: koSubtitle },
    en: { category: enCategory, title: enTitle, subtitle: enSubtitle },
  };
}

function renderSvg({ accent, category, title, subtitle, language }) {
  const font = language === "ko" ? "Noto Sans CJK KR, Noto Sans, Arial, sans-serif" : "Noto Sans, Arial, sans-serif";
  const titleSize = fittedSize(title, language === "ko" ? 64 : 62, language === "ko" ? 24 : 28);
  const subtitleSize = fittedSize(subtitle, language === "ko" ? 31 : 29, language === "ko" ? 39 : 49);
  const browserLabel = language === "ko" ? "무료 브라우저 도구" : "Free browser tool";
  const accessLabel = language === "ko" ? "설치·로그인 없이" : "No install or sign-in";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="background" x1="60" y1="20" x2="1140" y2="610" gradientUnits="userSpaceOnUse"><stop stop-color="#fbfcff"/><stop offset=".58" stop-color="#f4f5f9"/><stop offset="1" stop-color="${accent}" stop-opacity=".18"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="${accent}" stop-opacity=".24"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    <filter id="shadow" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dy="18" stdDeviation="26" flood-color="#363648" flood-opacity=".14"/></filter>
  </defs>
  <rect width="1200" height="630" fill="url(#background)"/><circle cx="1080" cy="60" r="380" fill="url(#glow)"/>
  <g filter="url(#shadow)"><rect x="82" y="68" width="1036" height="494" rx="58" fill="#fff" fill-opacity=".9"/><rect x="83" y="69" width="1034" height="492" rx="57" fill="none" stroke="#fff" stroke-width="2"/></g>
  <g transform="translate(138 122)"><rect width="84" height="84" rx="24" fill="#111116"/><text x="42" y="59" text-anchor="middle" fill="#fff" font-family="${font}" font-size="48" font-weight="800">W</text></g>
  <text x="246" y="153" fill="#18181b" font-family="${font}" font-size="29" font-weight="800">Worklazy Tools</text>
  <text x="246" y="190" fill="${accent}" font-family="${font}" font-size="20" font-weight="700" letter-spacing="1">${xml(category)}</text>
  <text x="138" y="315" fill="#18181b" font-family="${font}" font-size="${titleSize}" font-weight="800">${xml(title)}</text>
  <text x="141" y="377" fill="#65656c" font-family="${font}" font-size="${subtitleSize}" font-weight="500">${xml(subtitle)}</text>
  <g transform="translate(138 435)"><rect width="250" height="50" rx="25" fill="${accent}" fill-opacity=".11"/><circle cx="26" cy="25" r="7" fill="${accent}"/><path d="m22 25 3 3 6-7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><text x="47" y="33" fill="${accent}" font-family="${font}" font-size="18" font-weight="700">${xml(browserLabel)}</text></g>
  <g transform="translate(406 435)"><rect width="260" height="50" rx="25" fill="#eef1f7"/><path d="M20 25h14M27 18v14" stroke="#4a4a52" stroke-width="2.5" stroke-linecap="round"/><text x="46" y="33" fill="#4a4a52" font-family="${font}" font-size="18" font-weight="700">${xml(accessLabel)}</text></g>
  <text x="1054" y="489" text-anchor="end" fill="#8a8a91" font-family="${font}" font-size="19" font-weight="700">worklazy.net</text>
</svg>`;
}

function fittedSize(value, preferred, threshold) {
  const weightedLength = Array.from(value).reduce((sum, character) => sum + (/[^\u0000-\u00ff]/.test(character) ? 1.65 : 1), 0);
  if (weightedLength <= threshold) return preferred;
  return Math.max(42, Math.floor(preferred * threshold / weightedLength));
}

function xml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function findBrowser() {
  const candidates = [
    process.env.WORKLAZY_CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next common browser path.
    }
  }
  throw new Error("A Chromium or Chrome executable is required. Set WORKLAZY_CHROME_PATH and try again.");
}
