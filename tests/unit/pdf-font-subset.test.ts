import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import fontkit from "@pdf-lib/fontkit";

import { subsetCidCff } from "../../src/utils/cffSubset.ts";

const fontBytes = new Uint8Array(fs.readFileSync(new URL("../../public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf", import.meta.url)));

type ParsedFont = ReturnType<typeof fontkit.create> & {
  directory: { tables: Record<string, { offset: number; length: number }> };
};

/** Same OpenType file with its CFF table replaced, so fontkit parses the subset independently. */
function withCff(source: Uint8Array, cff: Uint8Array) {
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
  const tables = view.getUint16(4);
  const start = Math.ceil(source.length / 4) * 4;
  const output = new Uint8Array(start + cff.length);
  output.set(source);
  output.set(cff, start);
  const out = new DataView(output.buffer);
  for (let index = 0; index < tables; index++) {
    const record = 12 + index * 16;
    if (String.fromCharCode(...source.subarray(record, record + 4)) !== "CFF ") continue;
    out.setUint32(record + 8, start);
    out.setUint32(record + 12, cff.length);
    return output;
  }
  throw new Error("no CFF table");
}

function uses(font: ParsedFont, text: string) {
  const ids = [...new Set(font.layout(text).glyphs.map((glyph) => glyph.id))];
  return ids.map((id) => {
    const glyph = font.getGlyph(id) as ReturnType<ParsedFont["getGlyph"]> & { _usedSubrs: object; _usedGsubrs: object };
    void glyph.path;
    return { glyph: id, localSubrs: Object.keys(glyph._usedSubrs).map(Number), globalSubrs: Object.keys(glyph._usedGsubrs).map(Number) };
  });
}

test("CID CFF subset keeps drawn outlines, glyph IDs and Font DICTs and empties the rest", () => {
  const original = fontkit.create(fontBytes) as ParsedFont;
  const record = original.directory.tables["CFF "];
  const cff = fontBytes.subarray(record.offset, record.offset + record.length);
  // Hangul, Hanja, Latin with a shaped ligature, symbols and kana use several Font DICTs.
  const kept = uses(original, "한글 비교 보고서 漢字 國民年金 office ffi ①※★ ひらがな カタカナ 0123");
  const subset = subsetCidCff(cff, kept);
  assert.ok(subset.length < cff.length / 4, `subset ${subset.length} of ${cff.length}`);
  const parsed = fontkit.create(withCff(fontBytes, subset)) as ParsedFont;
  assert.equal(parsed.numGlyphs, original.numGlyphs);
  const fds = new Set(kept.map(({ glyph }) => (original as unknown as { "CFF ": { fdForGlyph(id: number): number } })["CFF "].fdForGlyph(glyph)));
  assert.ok(fds.size > 2, "fixture must exercise several Font DICTs");
  for (const { glyph } of kept) {
    assert.equal(parsed.getGlyph(glyph).path.toSVG(), original.getGlyph(glyph).path.toSVG(), `glyph ${glyph}`);
    assert.equal(parsed.getGlyph(glyph).advanceWidth, original.getGlyph(glyph).advanceWidth);
  }
  const dropped = original.glyphForCodePoint("뷁".codePointAt(0)!).id;
  assert.ok(!kept.some(({ glyph }) => glyph === dropped));
  assert.notEqual(original.getGlyph(dropped).path.toSVG(), "");
  assert.equal(parsed.getGlyph(dropped).path.toSVG(), "");
});

test("CID CFF subset rejects glyphs outside the font and non-CID programs", () => {
  const original = fontkit.create(fontBytes) as ParsedFont;
  const record = original.directory.tables["CFF "];
  const cff = fontBytes.subarray(record.offset, record.offset + record.length);
  assert.throws(() => subsetCidCff(cff, [{ glyph: original.numGlyphs, localSubrs: [], globalSubrs: [] }]), /Unsupported CFF/);
  assert.throws(() => subsetCidCff(Uint8Array.of(1, 0, 4, 3, 0, 0), []), /Unsupported CFF/);
});

test("FDSelect ranges must cover every glyph from glyph 0 up to the sentinel", async () => {
  const { readFdSelect } = await import("../../src/utils/cffSubset.ts");
  const format3 = (ranges: [number, number][], sentinel: number) => Uint8Array.from([3, 0, ranges.length, ...ranges.flatMap(([first, fd]) => [first >> 8, first & 255, fd]), sentinel >> 8, sentinel & 255]);
  assert.deepEqual([...readFdSelect(format3([[0, 0], [2, 1]], 4), 0, 4).fds], [0, 0, 1, 1]);
  for (const bytes of [format3([[1, 0]], 4), format3([[0, 0]], 3), format3([[0, 0], [2, 1], [2, 0]], 4), format3([], 4)]) {
    assert.throws(() => readFdSelect(bytes, 0, 4), /Unsupported CFF/);
  }
});
