import assert from "node:assert/strict";
import test from "node:test";

import { getSeoDefinition, getSocialImageDefinition } from "../../src/app/seo.ts";

const toolRoutes = [
  "/tools/excel-merger", "/tools/word-compare", "/tools/pdf-editor", "/tools/pdf-editor/image-to-pdf",
  "/tools/pdf-editor/pdf-to-image", "/tools/pdf-editor/convert", "/tools/hwp-editor", "/tools/hwp-compare",
  "/tools/video-studio", "/tools/audio-studio", "/tools/image-studio", "/tools/text-tools",
  "/tools/text-formatter", "/tools/work-calculator", "/tools/timezone-calculator", "/tools/payroll-calculator",
  "/tools/image-privacy", "/tools/security-tools", "/tools/qr-studio", "/tools/data-converter",
];

test("tool metadata keeps a distinct identity in Korean and English", () => {
  const expected = {
    ko: {
      "/tools/video-studio": "비디오 스튜디오 | 영상 자르기·이어붙이기·음원 추출",
      "/tools/audio-studio": "오디오 스튜디오 | 파형 편집·구간 자르기·피치 조절",
      "/tools/image-studio": "이미지 스튜디오 | 사진 편집·모자이크·콜라주·GIF",
      "/tools/image-privacy": "사진 메타데이터 제거 | EXIF·GPS 확인 및 삭제",
      "/tools/qr-studio": "QR 스튜디오 | QR 코드 만들기·카메라 스캔",
      "/tools/data-converter": "표 데이터 변환기 | CSV·JSON·HTML 상호 변환",
    },
    en: {
      "/tools/video-studio": "Video Studio | Trim, Join & Extract Audio",
      "/tools/audio-studio": "Audio Studio | Waveform Editing, Trimming & Pitch",
      "/tools/image-studio": "Image Studio | Edit Photos, Mosaic, Collage & GIF",
      "/tools/image-privacy": "Photo Metadata Remover | Inspect & Remove EXIF and GPS",
      "/tools/qr-studio": "QR Studio | Create & Scan QR Codes",
      "/tools/data-converter": "Table Data Converter | Convert CSV, JSON & HTML",
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
