/** Browser port of Stirling-Office-Convert 0.2.2 (673aab8d6ac784524cd1d90141c95e74b9fd26ae):
 * extract/{PageData,Glyph,FontInfo}, model/{Paragraph,Picture,RunStyle},
 * slides/{Slide,Frame,PictureShape,PageFit}, and the line segmentation and
 * paragraph pitch rules in layout/{LineBuilder,ParagraphBuilder}. PDFBox input
 * and Java OOXML streams are supplied by PDF.js and the existing browser writers.
 */
export interface FontInfo { family: string; bold: boolean; italic: boolean; serif: boolean; mono: boolean }
export interface Glyph {
  text: string; x: number; width: number; baseline: number; size: number;
  ascent: number; descent: number; font: FontInfo; rgb: number; seq: number;
  spaceWidth: number; invisible: boolean; rotation: number;
}
export interface Frame { x: number; y: number; width: number; height: number; rotation: number }
export interface Picture { blob: Blob; width: number; height: number; cropLeft: number; cropTop: number; cropRight: number; cropBottom: number; rotation: number; description: string }
export interface RunStyle { font: string; size: number; bold: boolean; italic: boolean; rgb: number }
export interface Paragraph { lines: TextLine[]; x: number; top: number; right: number; bottom: number }
export interface TextLine { glyphs: Glyph[]; text: string; x: number; right: number; baseline: number; top: number; bottom: number; size: number }
export interface PageData {
  index: number; width: number; height: number; direction: number;
  glyphs: Glyph[]; hidden: Glyph[]; rotated: Glyph[];
  pictures: Array<{ frame: Frame; picture: Picture; order: number }>;
  annotations: number;
}
export type SlideShape = { kind: "text"; frame: Frame; text: string; style: RunStyle; order: number }
  | { kind: "picture"; frame: Frame; picture: Picture; order: number };
export interface Slide { page: number; background: number; shapes: SlideShape[] }

/** Stirling LineBuilder's 0.9-em segment break, with its row tolerance retained. */
export function buildStirlingLines(glyphs: Glyph[]): TextLine[] {
  const ink = glyphs.filter(g => g.text.trim() && !g.invisible);
  const rows: Glyph[][] = [];
  for (const glyph of [...ink].sort((a, b) => a.baseline - b.baseline || a.x - b.x)) {
    const row = rows.find(group => Math.abs(group[0].baseline - glyph.baseline) <= Math.max(group[0].size, glyph.size) * 0.35);
    if (row) row.push(glyph);
    else rows.push([glyph]);
  }
  const lines: TextLine[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let segment: Glyph[] = [];
    const add = () => {
      if (!segment.length) return;
      lines.push({ glyphs: segment, text: joinGlyphs(segment), x: segment[0].x,
        right: Math.max(...segment.map(g => g.x + g.width)), baseline: segment[0].baseline,
        top: Math.min(...segment.map(g => g.baseline - g.ascent)), bottom: Math.max(...segment.map(g => g.baseline + g.descent)),
        size: median(segment.map(g => g.size)) });
      segment = [];
    };
    for (const glyph of row) {
      const previous = segment.at(-1);
      if (previous && glyph.x - previous.x - previous.width > 0.9 * Math.min(previous.size, glyph.size)) add();
      segment.push(glyph);
    }
    add();
  }
  return lines.sort((a, b) => a.baseline - b.baseline || a.x - b.x);
}

function joinGlyphs(glyphs: Glyph[]) {
  let text = "";
  for (const [index, glyph] of glyphs.entries()) {
    const previous = glyphs[index - 1];
    if (previous && glyph.x - previous.x - previous.width > Math.max(0.1 * glyph.size, 0.4 * Math.min(previous.spaceWidth, glyph.spaceWidth))
      && !/\s$/.test(text) && !/^\s/.test(glyph.text)) text += " ";
    text += glyph.text;
  }
  return text;
}

/** Stirling ParagraphBuilder's pitch and look break rules used for text frames. */
export function buildStirlingParagraphs(lines: TextLine[]): Paragraph[] {
  const output: Paragraph[] = [];
  let current: TextLine[] = [];
  const flush = () => {
    if (!current.length) return;
    output.push({ lines: current, x: Math.min(...current.map(line => line.x)), right: Math.max(...current.map(line => line.right)),
      top: Math.min(...current.map(line => line.top)), bottom: Math.max(...current.map(line => line.bottom)) });
    current = [];
  };
  for (const line of lines) {
    const previous = current.at(-1);
    if (previous) {
      const size = Math.max(previous.size, line.size);
      const pitches = current.slice(1).map((item, index) => item.baseline - current[index].baseline);
      const expected = pitches.length ? median(pitches) : Math.max(size * 1.2, previous.bottom - previous.top);
      const pitch = line.baseline - previous.baseline;
      const look = Math.abs(line.size - previous.size) > 0.12 * size
        || line.glyphs[0].font.mono !== previous.glyphs[0].font.mono;
      if (pitch > expected * 1.28 + 0.8 || pitch < previous.size * 0.5 || look || Math.abs(line.x - previous.x) > 0.6 * size) flush();
    }
    current.push(line);
  }
  flush();
  return output;
}

/** SlideBuilder's page/shape model and paint ordering, fitted with PageFit. */
export function buildStirlingSlide(page: PageData): Slide {
  const shapes: SlideShape[] = [];
  const lines = buildStirlingLines(page.glyphs);
  for (const paragraph of buildStirlingParagraphs(lines)) {
    for (const line of paragraph.lines) {
      const first = line.glyphs[0];
      shapes.push({ kind: "text", frame: { x: line.x, y: line.top, width: Math.max(1, line.right - line.x), height: Math.max(1, line.bottom - line.top), rotation: first.rotation },
        text: line.text, style: { font: first.font.family, size: line.size, bold: first.font.bold, italic: first.font.italic, rgb: first.rgb }, order: first.seq });
    }
  }
  for (const item of page.pictures) shapes.push({ kind: "picture", ...item });
  return { page: page.index, background: 0xffffff, shapes: shapes.sort((a, b) => a.order - b.order) };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}
