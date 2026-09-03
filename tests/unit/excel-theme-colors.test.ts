import assert from "node:assert/strict";
import test from "node:test";

import {
  applyExcelTint,
  bakeThemeColorsInStyle,
  parseThemePalette,
  THEME_COLOR_KEYS,
} from "../../src/features/excel-merger/excelThemeColors.ts";

const OFFICE_2022_COLORS = [
  "000000", "FFFFFF", "44546A", "E7E6E6", "4472C4", "ED7D31",
  "A5A5A5", "FFC000", "5B9BD5", "70AD47", "0563C1", "954F72",
];

test("parses the twelve ordered colors from theme1.xml and rejects incomplete themes", () => {
  const sections = THEME_COLOR_KEYS.map((key, index) => index < 2
    ? `<a:${key}><a:sysClr val="system" lastClr="${OFFICE_2022_COLORS[index]}"/></a:${key}>`
    : `<a:${key}><a:srgbClr val="${OFFICE_2022_COLORS[index]}"/></a:${key}>`).join("");
  const xml = `<a:theme xmlns:a="urn:test"><a:themeElements><a:clrScheme name="fixture">${sections}</a:clrScheme></a:themeElements></a:theme>`;
  assert.deepEqual(parseThemePalette(xml), OFFICE_2022_COLORS);
  assert.equal(parseThemePalette(xml.replace(/<a:accent6>[\s\S]*?<\/a:accent6>/, "")), undefined);
  assert.equal(parseThemePalette("<not-a-theme/>"), undefined);
});

test("applies ECMA-376 HSL tint to six theme colors at three levels", () => {
  const expected = [
    ["2F5597", "4472C4", "B4C7E7"],
    ["C55A11", "ED7D31", "F8CBAD"],
    ["7C7C7C", "A5A5A5", "DBDBDB"],
    ["BF9000", "FFC000", "FFE699"],
    ["2E75B6", "5B9BD5", "BDD7EE"],
    ["548235", "70AD47", "C5E0B4"],
  ];
  OFFICE_2022_COLORS.slice(4, 10).forEach((color, themeIndex) => {
    assert.deepEqual([-.25, 0, .6].map((tint) => applyExcelTint(color, tint)), expected[themeIndex]);
  });
  assert.equal(applyExcelTint("FFC000", 0.7999816888943144), "FFF2CC");
});

test("bakes exposed solid-fill, font and border theme colors without changing excluded colors", () => {
  const style = {
    fill: { type: "pattern", pattern: "solid", fgColor: { theme: 7, tint: 0.7999816888943144 }, bgColor: { indexed: 64 } },
    font: { color: { theme: 1 } },
    border: {
      top: { style: "thin", color: { theme: 4, tint: -.25 } },
      bottom: { style: "thin", color: { argb: "FF123456" } },
    },
  };
  assert.deepEqual(bakeThemeColorsInStyle(structuredClone(style), OFFICE_2022_COLORS), {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" }, bgColor: { indexed: 64 } },
    font: { color: { argb: "FFFFFFFF" } },
    border: {
      top: { style: "thin", color: { argb: "FF2F5597" } },
      bottom: { style: "thin", color: { argb: "FF123456" } },
    },
  });

  const gradient = { fill: { type: "gradient", stops: [{ color: { theme: 4 } }] }, font: { color: { indexed: 64 } } };
  assert.deepEqual(bakeThemeColorsInStyle(structuredClone(gradient), OFFICE_2022_COLORS), gradient);
  assert.deepEqual(bakeThemeColorsInStyle(structuredClone(style), undefined), style);
});
