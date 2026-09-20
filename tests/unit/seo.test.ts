import assert from "node:assert/strict";
import test from "node:test";

import { canonicalSeoPath, getSeoDefinition, getSocialImageDefinition } from "../../src/app/seo.ts";

const toolRoutes = [
  "/tools/excel-merger", "/tools/excel-compare", "/tools/excel-cleaner", "/tools/document-generator", "/tools/document-compare", "/tools/pdf-compare", "/tools/pdf-editor", "/tools/pdf-editor/image-to-pdf",
  "/tools/pdf-editor/pdf-to-image", "/tools/pdf-editor/convert", "/tools/hwp-editor", "/tools/office-editor",
  "/tools/pdf-editor/finish", "/tools/pdf-editor/page-numbers", "/tools/pdf-editor/header-footer", "/tools/pdf-editor/watermark", "/tools/pdf-editor/stamp",
  "/tools/video-studio", "/tools/audio-studio", "/tools/image-studio", "/tools/text-merger", "/tools/text-tools",
  "/tools/text-formatter", "/tools/work-calculator", "/tools/timezone-calculator", "/tools/payroll-calculator",
  "/tools/document-redactor", "/tools/image-privacy", "/tools/security-tools", "/tools/qr-studio", "/tools/qr-studio/bulk", "/tools/data-converter",
];

test("tool metadata keeps a distinct identity in Korean and English", () => {
  const expected = {
    ko: {
      "/tools/video-studio": "온라인 동영상 편집 - 자르기·합치기·변환 | Worklazy Tools",
      "/tools/audio-studio": "온라인 오디오 편집 - 음소거·피치 조절 | Worklazy Tools",
      "/tools/image-studio": "온라인 사진 편집 - 자르기·그리기·콜라주 | Worklazy Tools",
      "/tools/image-privacy": "사진 위치정보 삭제 - EXIF·GPS 확인 및 제거 | Worklazy Tools",
      "/tools/qr-studio": "QR 코드 만들기·읽기 - 로고 삽입·사진 스캔 | Worklazy Tools",
      "/tools/qr-studio/bulk": "QR 코드 일괄 생성 - 엑셀·CSV로 대량 생성 | Worklazy Tools",
      "/tools/data-converter": "CSV·JSON·HTML 표 변환기 | Worklazy Tools",
      "/tools/document-compare": "워드·한글 문서 비교 - 수정 전후 차이 확인 | Worklazy Tools",
      "/tools/pdf-compare": "PDF 파일 비교 - 화면·텍스트 변경사항 확인 | Worklazy Tools",
      "/tools/excel-compare": "엑셀 파일 비교 - 값·수식·기준 항목별 차이 | Worklazy Tools",
      "/tools/excel-cleaner": "엑셀 데이터 정리 - 공백·빈 행·중복 정리 | Worklazy Tools",
      "/tools/document-generator": "워드 문서 일괄 생성 - 엑셀 명단으로 메일머지 | Worklazy Tools",
      "/tools/office-editor": "온라인 문서 편집 - Word·Excel·PowerPoint | Worklazy Tools",
      "/tools/text-merger": "텍스트 파일 합치기 - TXT·메모 순서대로 병합 | Worklazy Tools",
    },
    en: {
      "/tools/video-studio": "Online Video Editor - Trim, Merge & Convert | Worklazy Tools",
      "/tools/audio-studio": "Online Audio Editor - Mute, Trim & Pitch Shift | Worklazy Tools",
      "/tools/image-studio": "Online Photo Editor - Crop, Draw & Collage | Worklazy Tools",
      "/tools/image-privacy": "Remove Photo Location - Delete EXIF & GPS Data | Worklazy Tools",
      "/tools/qr-studio": "QR Code Generator & Scanner - Add Logo | Worklazy Tools",
      "/tools/qr-studio/bulk": "Bulk QR Code Generator - Excel & CSV | Worklazy Tools",
      "/tools/data-converter": "CSV, JSON & HTML Table Converter | Worklazy Tools",
      "/tools/document-compare": "Compare Word & HWP Documents - Track Changes | Worklazy Tools",
      "/tools/pdf-compare": "PDF Compare | Visual and Extracted Text Differences",
      "/tools/excel-compare": "Excel Compare | Compare XLSX, XLS, XLSB & CSV Files",
      "/tools/excel-cleaner": "Excel Data Cleaner | Clean XLSX, XLS & CSV Files",
      "/tools/document-generator": "Word Mail Merge | Template-based Bulk Document Generator",
      "/tools/office-editor": "Online Office Editor - Word, Excel & PowerPoint | Worklazy Tools",
      "/tools/text-merger": "Merge Text Files - Combine TXT & Notes | Worklazy Tools",
    },
  } as const;

  for (const language of ["ko", "en"] as const) {
    for (const [route, title] of Object.entries(expected[language])) {
      assert.equal(getSeoDefinition(language, route).title, title);
    }
  }
});

test("every tool route uses a localized tool-specific social image", () => {
  for (const language of ["ko", "en"] as const) {
    const paths = toolRoutes.map((route) => getSocialImageDefinition(language, route).path);
    assert.equal(new Set(paths).size, toolRoutes.length);
    for (const path of paths) {
      assert.match(path, new RegExp(`^social/tools/.+-${language}\\.png$`));
    }
  }
});

test("English tool titles do not fall back to a generic browser-tool label", () => {
  for (const route of toolRoutes) {
    assert.doesNotMatch(getSeoDefinition("en", route).title, /Free Browser Tool/);
  }
});

test("PDF finish aliases retain distinct metadata and canonicalize to the finish guide", () => {
  for (const language of ["ko", "en"] as const) {
    const routes = ["/tools/pdf-editor/finish", "/tools/pdf-editor/page-numbers", "/tools/pdf-editor/header-footer", "/tools/pdf-editor/watermark", "/tools/pdf-editor/stamp"];
    assert.equal(new Set(routes.map((route) => getSeoDefinition(language, route).title)).size, 5);
    assert.ok(routes.every((route) => getSeoDefinition(language, route).faq?.length === 2));
  }
  assert.equal(canonicalSeoPath("/tools/pdf-editor/finish"), "/tools/pdf-editor/finish");
  assert.equal(canonicalSeoPath("/tools/pdf-editor/page-numbers"), "/tools/pdf-editor/finish");
  assert.equal(canonicalSeoPath("/tools/pdf-editor/header-footer/"), "/tools/pdf-editor/finish");
  assert.equal(canonicalSeoPath("/tools/pdf-editor/watermark/"), "/tools/pdf-editor/finish");
  assert.equal(canonicalSeoPath("/tools/pdf-editor/stamp/"), "/tools/pdf-editor/finish");
});

test("new document tools expose matching Korean and English static FAQs", () => {
  for (const [route, expectedCount] of [["/tools/document-redactor", 3], ["/tools/document-generator", 3], ["/tools/document-compare", 5], ["/tools/pdf-compare", 3], ["/tools/office-editor", 5]] as const) {
    const koreanFaq = getSeoDefinition("ko", route).faq;
    const englishFaq = getSeoDefinition("en", route).faq;
    assert.equal(koreanFaq?.length, expectedCount);
    assert.equal(englishFaq?.length, expectedCount);
    assert.equal(koreanFaq?.length, englishFaq?.length);
    assert.ok(koreanFaq?.every((item) => item.question && item.answer));
    assert.ok(englishFaq?.every((item) => item.question && item.answer));
  }
  for (const language of ["ko", "en"] as const) {
    const textMergerFaq = getSeoDefinition(language, "/tools/text-merger").faq;
    assert.equal(textMergerFaq?.length, 3);
    assert.ok(textMergerFaq?.every((item) => item.question && item.answer));
    const excelFaq = getSeoDefinition(language, "/tools/excel-merger").faq;
    assert.equal(excelFaq?.length, 3);
    assert.ok(excelFaq?.every((item) => item.question && item.answer));
    const excelCompareFaq = getSeoDefinition(language, "/tools/excel-compare").faq;
    assert.equal(excelCompareFaq?.length, 5);
    assert.ok(excelCompareFaq?.every((item) => item.question && item.answer));
    assert.ok(excelCompareFaq?.some((item) => /중복 키|duplicate key/i.test(`${item.question} ${item.answer}`)));
    assert.ok(excelCompareFaq?.some((item) => /머리글|header/i.test(`${item.question} ${item.answer}`)));
    const excelCleanerFaq = getSeoDefinition(language, "/tools/excel-cleaner").faq;
    assert.equal(excelCleanerFaq?.length, 3);
    assert.ok(excelCleanerFaq?.every((item) => item.question && item.answer));
    const pdfFaq = getSeoDefinition(language, "/tools/pdf-editor").faq;
    assert.equal(pdfFaq?.length, 4);
    assert.ok(pdfFaq?.every((item) => item.question && item.answer));
    const videoFaq = getSeoDefinition(language, "/tools/video-studio").faq;
    assert.equal(videoFaq?.length, 1);
    assert.ok(videoFaq?.every((item) => item.question && item.answer));
    assert.ok(getSeoDefinition(language, "/tools/video-studio").application?.featureList.some((feature) => /구간 일괄|ranges across groups/i.test(feature)));
    const qrBulkFaq = getSeoDefinition(language, "/tools/qr-studio/bulk").faq;
    assert.equal(qrBulkFaq?.length, 3);
    assert.ok(qrBulkFaq?.every((item) => item.question && item.answer));
  }
  for (const route of ["/tools/text-merger", "/tools/excel-merger", "/tools/excel-compare", "/tools/excel-cleaner", "/tools/pdf-editor", "/tools/video-studio", "/tools/qr-studio/bulk"] as const) {
    assert.equal(getSeoDefinition("ko", route).faq?.length, getSeoDefinition("en", route).faq?.length, `${route} FAQ counts differ between ko and en`);
  }
});
