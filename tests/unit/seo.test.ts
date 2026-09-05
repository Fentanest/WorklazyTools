import assert from "node:assert/strict";
import test from "node:test";

import { getSeoDefinition, getSocialImageDefinition } from "../../src/app/seo.ts";

const toolRoutes = [
  "/tools/excel-merger", "/tools/excel-compare", "/tools/excel-cleaner", "/tools/document-compare", "/tools/pdf-editor", "/tools/pdf-editor/image-to-pdf",
  "/tools/pdf-editor/pdf-to-image", "/tools/pdf-editor/convert", "/tools/hwp-editor", "/tools/office-editor",
  "/tools/video-studio", "/tools/audio-studio", "/tools/image-studio", "/tools/text-merger", "/tools/text-tools",
  "/tools/text-formatter", "/tools/work-calculator", "/tools/timezone-calculator", "/tools/payroll-calculator",
  "/tools/image-privacy", "/tools/security-tools", "/tools/qr-studio", "/tools/qr-studio/bulk", "/tools/data-converter",
];

test("tool metadata keeps a distinct identity in Korean and English", () => {
  const expected = {
    ko: {
      "/tools/video-studio": "비디오 스튜디오 | 영상 자르기·이어붙이기·음원 추출",
      "/tools/audio-studio": "오디오 스튜디오 | 파형 편집·구간 자르기·피치 조절",
      "/tools/image-studio": "이미지 스튜디오 | 사진 편집·모자이크·콜라주·GIF",
      "/tools/image-privacy": "사진 메타데이터 제거 | EXIF·GPS 확인 및 삭제",
      "/tools/qr-studio": "QR 스튜디오 | QR 코드 만들기·카메라 스캔",
      "/tools/qr-studio/bulk": "QR 일괄 생성 | Excel·CSV 행별 PNG·ZIP·라벨 PDF",
      "/tools/data-converter": "표 데이터 변환기 | CSV·JSON·HTML 상호 변환",
      "/tools/document-compare": "Word·HWP 문서 비교 - DOCX·DOC·HWP·HWPX Diff",
      "/tools/excel-compare": "Excel 파일 비교 - XLSX·XLSM·XLS·XLSB·CSV Diff",
      "/tools/excel-cleaner": "Excel 데이터 정리 - XLSX·XLS·CSV 클리너",
      "/tools/office-editor": "브라우저 오피스 편집기 - DOCX·XLSX·PPTX 온라인 편집",
      "/tools/text-merger": "텍스트 병합 | 직접 입력·TXT 파일 순서대로 합치기",
    },
    en: {
      "/tools/video-studio": "Video Studio | Trim, Join & Extract Audio",
      "/tools/audio-studio": "Audio Studio | Waveform Editing, Trimming & Pitch",
      "/tools/image-studio": "Image Studio | Edit Photos, Mosaic, Collage & GIF",
      "/tools/image-privacy": "Photo Metadata Remover | Inspect & Remove EXIF and GPS",
      "/tools/qr-studio": "QR Studio | Create & Scan QR Codes",
      "/tools/qr-studio/bulk": "Bulk QR Generator | Excel & CSV to PNG, ZIP and Label PDF",
      "/tools/data-converter": "Table Data Converter | Convert CSV, JSON & HTML",
      "/tools/document-compare": "Document Compare | Compare DOCX, DOC, HWP & HWPX",
      "/tools/excel-compare": "Excel Compare | Compare XLSX, XLS, XLSB & CSV Files",
      "/tools/excel-cleaner": "Excel Data Cleaner | Clean XLSX, XLS & CSV Files",
      "/tools/office-editor": "Browser Office Editor | Edit DOCX, XLSX & PPTX",
      "/tools/text-merger": "Text Merger | Combine Pasted Text & TXT Files",
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

test("new document tools expose matching Korean and English static FAQs", () => {
  for (const [route, expectedCount] of [["/tools/document-compare", 3], ["/tools/office-editor", 5]] as const) {
    const koreanFaq = getSeoDefinition("ko", route).faq;
    const englishFaq = getSeoDefinition("en", route).faq;
    assert.equal(koreanFaq?.length, expectedCount);
    assert.equal(englishFaq?.length, expectedCount);
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
    assert.equal(excelCompareFaq?.length, 3);
    assert.ok(excelCompareFaq?.every((item) => item.question && item.answer));
    const excelCleanerFaq = getSeoDefinition(language, "/tools/excel-cleaner").faq;
    assert.equal(excelCleanerFaq?.length, 3);
    assert.ok(excelCleanerFaq?.every((item) => item.question && item.answer));
    const pdfFaq = getSeoDefinition(language, "/tools/pdf-editor").faq;
    assert.equal(pdfFaq?.length, 2);
    assert.ok(pdfFaq?.every((item) => item.question && item.answer));
    const videoFaq = getSeoDefinition(language, "/tools/video-studio").faq;
    assert.equal(videoFaq?.length, 1);
    assert.ok(videoFaq?.every((item) => item.question && item.answer));
    assert.ok(getSeoDefinition(language, "/tools/video-studio").application?.featureList.some((feature) => /구간 일괄|ranges across groups/i.test(feature)));
    const qrBulkFaq = getSeoDefinition(language, "/tools/qr-studio/bulk").faq;
    assert.equal(qrBulkFaq?.length, 3);
    assert.ok(qrBulkFaq?.every((item) => item.question && item.answer));
  }
});
