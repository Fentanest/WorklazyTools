import fontkit, { type Font, type Glyph, type TypeFeatures } from "@pdf-lib/fontkit";
import {
  CustomFontEmbedder,
  PDFDocument,
  PDFHexString,
  PDFString,
  StandardFonts,
  degrees,
  rgb,
  type CreateOptions,
  type LoadOptions,
  type PDFContext,
  type PDFFont,
  type PDFRef,
} from "pdf-lib";

export { degrees, rgb };
export type { PDFDocument, PDFFont, CreateOptions, LoadOptions };

export function createPdfDocument(options?: CreateOptions) {
  return PDFDocument.create(options);
}

export function loadPdfDocument(bytes: ArrayBuffer | Uint8Array, options: LoadOptions = {}) {
  return PDFDocument.load(bytes, { updateMetadata: false, ...options });
}

export function embedHelvetica(document: PDFDocument) {
  return document.embedFont(StandardFonts.Helvetica);
}

export function embedCustomPdfFont(document: PDFDocument, bytes: ArrayBuffer | Uint8Array): Promise<PDFFont> {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const font = fontkit.create(source) as CidCffFont;
  const cff = font["CFF "];
  const cffRecord = font.directory?.tables?.["CFF "];
  if (!cff?.isCIDFont || !cffRecord || cffRecord.offset < 0 || cffRecord.length <= 0
      || cffRecord.offset + cffRecord.length > source.length) {
    document.registerFontkit(fontkit);
    return document.embedFont(source, { subset: false });
  }

  // pdf-lib's full embedder writes glyph IDs as Identity-H character codes.
  // CID-keyed CFF fonts instead need an explicit character-code-to-CID map,
  // and the embedded FontFile3 stream must contain raw CFF rather than OTTO.
  const cffBytes = source.slice(cffRecord.offset, cffRecord.offset + cffRecord.length);
  const embedded = createCidCffPdfFont(document, font, cff, cffBytes);
  document.registerFontkit(fontkit);
  return embedded;
}

export function getPdfFontCharacterSet(bytes: ArrayBuffer | Uint8Array): number[] {
  return fontkit.create(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).characterSet;
}

interface CffCharsetRange {
  first: number;
  nLeft: number;
  offset: number;
}

interface CidCffTable {
  isCIDFont: boolean;
  string(sid: number): string;
  topDict: {
    ROS: [number, number, number];
    charset: number[] | { ranges: CffCharsetRange[] };
  };
}

type CidCffFont = Font & {
  directory?: { tables?: Record<string, { offset: number; length: number }> };
  "CFF "?: CidCffTable;
};

interface GlyphMapping {
  code: number;
  cid: number;
  unicode: number[];
  width: number;
}

class CidCffFontEmbedder extends CustomFontEmbedder {
  private readonly cff: CidCffTable;
  private readonly glyphMappings = new Map<string, GlyphMapping>();
  private readonly cidWidths = new Map<number, number>();
  private nextCode = 1;

  constructor(font: Font, cffBytes: Uint8Array, cff: CidCffTable, fontFeatures?: TypeFeatures) {
    super(font, cffBytes, undefined, fontFeatures);
    this.cff = cff;
  }

  override encodeText(text: string) {
    const glyphs = this.font.layout(text, this.fontFeatures).glyphs;
    const unicode = sourceCodePointsForGlyphs(text, glyphs);
    const codes = glyphs.map((glyph, index) => this.mappingFor(glyph, unicode[index]).code);
    return PDFHexString.of(codes.map(hex16).join(""));
  }

  protected override isCFF() {
    return true;
  }

  protected override async embedFontDict(context: PDFContext, ref?: PDFRef) {
    const cidFontDictRef = await this.embedCIDFontDict(context);
    const encodingRef = context.register(context.flateStream(createEncodingCmap(this.sortedMappings(), this.cidSystemInfo())));
    const unicodeRef = this.embedUnicodeCmap(context);
    const fontDict = context.obj({
      Type: "Font",
      Subtype: "Type0",
      BaseFont: this.baseFontName,
      Encoding: encodingRef,
      DescendantFonts: [cidFontDictRef],
      ToUnicode: unicodeRef,
    });
    if (ref) {
      context.assign(ref, fontDict);
      return ref;
    }
    return context.register(fontDict);
  }

  protected override async embedCIDFontDict(context: PDFContext) {
    const fontDescriptorRef = await this.embedFontDescriptor(context);
    const { registry, ordering, supplement } = this.cidSystemInfo();
    return context.register(context.obj({
      Type: "Font",
      Subtype: "CIDFontType0",
      BaseFont: this.baseFontName,
      CIDSystemInfo: {
        Registry: PDFString.of(registry),
        Ordering: PDFString.of(ordering),
        Supplement: supplement,
      },
      FontDescriptor: fontDescriptorRef,
      W: this.computeWidths(),
    }));
  }

  protected override embedUnicodeCmap(context: PDFContext) {
    return context.register(context.flateStream(createUnicodeCmap(this.sortedMappings())));
  }

  protected override computeWidths(): (number | number[])[] {
    const widths = [...this.cidWidths.entries()].sort(([left], [right]) => left - right);
    const result: (number | number[])[] = [];
    let previousCid = -2;
    let section: number[] = [];
    for (const [cid, width] of widths) {
      if (cid !== previousCid + 1) {
        if (section.length > 0) result.push(section);
        result.push(cid);
        section = [];
      }
      section.push(width);
      previousCid = cid;
    }
    if (section.length > 0) result.push(section);
    return result;
  }

  private mappingFor(glyph: Glyph, unicode: number[]) {
    const cid = glyphIdToCid(this.cff.topDict.charset, glyph.id);
    if (cid === undefined || cid < 0 || cid > 0xffff) {
      throw new Error(`Unsupported CID mapping for glyph ${glyph.id}.`);
    }
    const key = `${cid}:${unicode.join(",")}`;
    const existing = this.glyphMappings.get(key);
    if (existing) return existing;
    if (this.nextCode > 0xffff) throw new Error("The embedded font exceeded the 16-bit PDF character-code limit.");
    const mapping = {
      code: this.nextCode,
      cid,
      unicode,
      width: glyph.advanceWidth * this.scale,
    };
    this.nextCode += 1;
    this.glyphMappings.set(key, mapping);
    this.cidWidths.set(cid, mapping.width);
    return mapping;
  }

  private sortedMappings() {
    return [...this.glyphMappings.values()].sort((left, right) => left.code - right.code);
  }

  private cidSystemInfo() {
    const [registrySid, orderingSid, supplement] = this.cff.topDict.ROS;
    return {
      registry: this.cff.string(registrySid),
      ordering: this.cff.string(orderingSid),
      supplement,
    };
  }
}

function createCidCffPdfFont(document: PDFDocument, font: CidCffFont, cff: CidCffTable, cffBytes: Uint8Array) {
  const localFontkit = { create: () => font };
  document.registerFontkit(localFontkit);
  return document.embedFont(cffBytes, { subset: false }).then((embedded) => {
    const replacement = new CidCffFontEmbedder(font, cffBytes, cff);
    const internal = embedded as unknown as { embedder: CustomFontEmbedder };
    if (!(internal.embedder instanceof CustomFontEmbedder)) {
      throw new Error("The installed pdf-lib custom font embedder is incompatible.");
    }
    internal.embedder = replacement;
    return embedded;
  });
}

function glyphIdToCid(charset: CidCffTable["topDict"]["charset"], glyphId: number) {
  if (glyphId === 0) return 0;
  if (Array.isArray(charset)) return charset[glyphId];
  const offset = glyphId - 1;
  for (const range of charset.ranges) {
    if (range.offset <= offset && offset <= range.offset + range.nLeft) {
      return range.first + offset - range.offset;
    }
  }
  return undefined;
}

function sourceCodePointsForGlyphs(text: string, glyphs: Glyph[]) {
  const source = [...text].map((character) => character.codePointAt(0) ?? 0);
  const result: number[][] = [];
  let cursor = 0;
  for (const glyph of glyphs) {
    let matched: number[] | undefined;
    for (let length = 1; cursor + length <= source.length; length += 1) {
      const candidate = source.slice(cursor, cursor + length);
      if (unicodeSequencesMatch(candidate, glyph.codePoints)) {
        matched = candidate;
        cursor += length;
        break;
      }
    }
    if (!matched) matched = glyph.codePoints.length > 0 ? [...glyph.codePoints] : [0xfffd];
    result.push(matched);
  }
  return cursor === source.length ? result : glyphs.map((glyph) => glyph.codePoints.length > 0 ? [...glyph.codePoints] : [0xfffd]);
}

function unicodeSequencesMatch(source: number[], shaped: number[]) {
  const normalized = [...String.fromCodePoint(...source).normalize("NFC")].map((character) => character.codePointAt(0) ?? 0);
  if (normalized.length !== shaped.length) return false;
  return normalized.every((codePoint, index) => codePoint === shaped[index]
    || (shaped[index] === 0x20 && isUnicodeSpace(codePoint)));
}

function isUnicodeSpace(codePoint: number) {
  return /^\s$/u.test(String.fromCodePoint(codePoint));
}

function createEncodingCmap(mappings: GlyphMapping[], systemInfo: { registry: string; ordering: string; supplement: number }) {
  return fillCmap(
    "Worklazy-CID-H",
    1,
    chunkedSections(mappings, (mapping) => `<${hex16(mapping.code)}> ${mapping.cid}`, "begincidchar", "endcidchar"),
    systemInfo,
  );
}

function createUnicodeCmap(mappings: GlyphMapping[]) {
  return fillCmap(
    "Worklazy-Identity-UCS",
    2,
    chunkedSections(mappings, (mapping) => `<${hex16(mapping.code)}> <${utf16Hex(mapping.unicode)}>`, "beginbfchar", "endbfchar"),
    { registry: "Adobe", ordering: "UCS", supplement: 0 },
  );
}

function fillCmap(name: string, type: number, mappings: string, systemInfo: { registry: string; ordering: string; supplement: number }) {
  return `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo <<\n  /Registry (${escapePdfString(systemInfo.registry)})\n  /Ordering (${escapePdfString(systemInfo.ordering)})\n  /Supplement ${systemInfo.supplement}\n>> def\n/CMapName /${name} def\n/CMapType ${type} def\n1 begincodespacerange\n<0000><ffff>\nendcodespacerange\n${mappings}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
}

function escapePdfString(value: string) {
  return value.replace(/([\\()])/gu, "\\$1");
}

function chunkedSections<T>(values: T[], format: (value: T) => string, begin: string, end: string) {
  const sections: string[] = [];
  for (let offset = 0; offset < values.length; offset += 100) {
    const chunk = values.slice(offset, offset + 100);
    sections.push(`${chunk.length} ${begin}\n${chunk.map(format).join("\n")}\n${end}`);
  }
  return sections.join("\n");
}

function utf16Hex(codePoints: number[]) {
  const units: number[] = [];
  for (const codePoint of codePoints) {
    if (codePoint <= 0xffff) units.push(codePoint);
    else {
      const value = codePoint - 0x10000;
      units.push(0xd800 + (value >> 10), 0xdc00 + (value & 0x3ff));
    }
  }
  return units.map(hex16).join("");
}

function hex16(value: number) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}
