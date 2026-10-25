/**
 * Subsets a CID-keyed CFF font program without renumbering glyphs.
 *
 * Glyph IDs, CIDs, the charset, FDSelect and every subroutine index stay as they are, so the
 * PDF character-code-to-CID map and subroutine biases do not change. Outlines of glyphs that are
 * not drawn become a bare `endchar`, and subroutines no drawn glyph calls become a bare `return`.
 * Every rewritten DICT stores offsets as fixed 5-byte integers, so the layout is computed once.
 */

export interface CffGlyphUse {
  glyph: number;
  /** Local subroutine indexes (bias included) of the glyph's Font DICT that the outline calls. */
  localSubrs: Iterable<number>;
  /** Global subroutine indexes (bias included) that the outline calls. */
  globalSubrs: Iterable<number>;
}

const ENDCHAR = Uint8Array.of(14);
const RETURN = Uint8Array.of(11);
const OP_CHARSET = 15, OP_CHARSTRINGS = 17, OP_PRIVATE = 18, OP_SUBRS = 19;
const OP_ROS = 1230, OP_FDARRAY = 1236, OP_FDSELECT = 1237;

interface Index { items: Uint8Array[]; end: number }
interface DictEntry { op: number; operands: number[]; raw: Uint8Array }

function fail(): never {
  throw new Error("Unsupported CFF font program.");
}

function readIndex(bytes: Uint8Array, start: number): Index {
  if (start + 2 > bytes.length) fail();
  const count = (bytes[start] << 8) | bytes[start + 1];
  if (count === 0) return { items: [], end: start + 2 };
  const offSize = bytes[start + 2];
  if (offSize < 1 || offSize > 4) fail();
  const offsetsStart = start + 3;
  const dataStart = offsetsStart + (count + 1) * offSize - 1;
  const offset = (index: number) => {
    let value = 0;
    for (let byte = 0; byte < offSize; byte++) value = value * 256 + bytes[offsetsStart + index * offSize + byte];
    return value;
  };
  const items: Uint8Array[] = [];
  let previous = offset(0);
  for (let index = 1; index <= count; index++) {
    const next = offset(index);
    if (next < previous || dataStart + next > bytes.length) fail();
    items.push(bytes.subarray(dataStart + previous, dataStart + next));
    previous = next;
  }
  return { items, end: dataStart + previous };
}

function writeIndex(items: readonly Uint8Array[]): Uint8Array {
  if (items.length > 0xffff) fail();
  if (items.length === 0) return new Uint8Array(2);
  const total = items.reduce((sum, item) => sum + item.length, 0);
  const offSize = total + 1 < 0x100 ? 1 : total + 1 < 0x10000 ? 2 : total + 1 < 0x1000000 ? 3 : 4;
  const output = new Uint8Array(3 + (items.length + 1) * offSize + total);
  output[0] = items.length >> 8;
  output[1] = items.length & 0xff;
  output[2] = offSize;
  let cursor = 3 + (items.length + 1) * offSize;
  let relative = 1;
  for (let index = 0; index <= items.length; index++) {
    for (let byte = 0; byte < offSize; byte++) output[3 + index * offSize + byte] = Math.floor(relative / 256 ** (offSize - 1 - byte)) & 0xff;
    if (index < items.length) {
      output.set(items[index], cursor);
      cursor += items[index].length;
      relative += items[index].length;
    }
  }
  return output;
}

function parseDict(bytes: Uint8Array): DictEntry[] {
  const entries: DictEntry[] = [];
  let operands: number[] = [];
  let operandStart = 0;
  let position = 0;
  while (position < bytes.length) {
    const b0 = bytes[position];
    if (b0 <= 21) {
      const op = b0 === 12 ? 1200 + bytes[position + 1] : b0;
      position += b0 === 12 ? 2 : 1;
      if (position > bytes.length) fail();
      entries.push({ op, operands, raw: bytes.subarray(operandStart, position) });
      operands = [];
      operandStart = position;
    } else if (b0 === 28) {
      operands.push(((bytes[position + 1] << 24) | (bytes[position + 2] << 16)) >> 16);
      position += 3;
    } else if (b0 === 29) {
      operands.push((bytes[position + 1] << 24) | (bytes[position + 2] << 16) | (bytes[position + 3] << 8) | bytes[position + 4]);
      position += 5;
    } else if (b0 === 30) {
      // Real numbers are never offsets; keep their bytes and a placeholder value.
      position += 1;
      while (position < bytes.length && (bytes[position] & 0x0f) !== 0x0f && (bytes[position] >> 4) !== 0x0f) position += 1;
      position += 1;
      operands.push(Number.NaN);
    } else if (b0 >= 32 && b0 <= 246) {
      operands.push(b0 - 139);
      position += 1;
    } else if (b0 >= 247 && b0 <= 250) {
      operands.push((b0 - 247) * 256 + bytes[position + 1] + 108);
      position += 2;
    } else if (b0 >= 251 && b0 <= 254) {
      operands.push(-(b0 - 251) * 256 - bytes[position + 1] - 108);
      position += 2;
    } else fail();
  }
  if (operands.length > 0 || position !== bytes.length) fail();
  return entries;
}

function int32(value: number) {
  return [29, (value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

/** Re-encodes a DICT, replacing the operands of `replace` operators with fixed 5-byte integers. */
function writeDict(entries: readonly DictEntry[], replace: ReadonlyMap<number, readonly number[]>): Uint8Array {
  const parts: number[] = [];
  for (const entry of entries) {
    const values = replace.get(entry.op);
    if (!values) {
      parts.push(...entry.raw);
      continue;
    }
    for (const value of values) parts.push(...int32(value));
    if (entry.op >= 1200) parts.push(12, entry.op - 1200);
    else parts.push(entry.op);
  }
  return Uint8Array.from(parts);
}

function operandsOf(entries: readonly DictEntry[], op: number) {
  return entries.find((entry) => entry.op === op)?.operands;
}

function offsetOf(entries: readonly DictEntry[], op: number, length: number) {
  const value = operandsOf(entries, op)?.at(-1);
  if (value === undefined || !Number.isSafeInteger(value) || value < 0 || value >= length) fail();
  return value;
}

function charsetLength(bytes: Uint8Array, start: number, glyphs: number) {
  const format = bytes[start];
  if (format === 0) return 1 + 2 * (glyphs - 1);
  if (format !== 1 && format !== 2) fail();
  let position = start + 1;
  for (let covered = 0; covered < glyphs - 1;) {
    if (position + 2 + format > bytes.length) fail();
    covered += 1 + (format === 1 ? bytes[position + 2] : (bytes[position + 2] << 8) | bytes[position + 3]);
    position += 2 + format;
  }
  return position - start;
}

function readFdSelect(bytes: Uint8Array, start: number, glyphs: number) {
  const fds = new Uint16Array(glyphs);
  const format = bytes[start];
  if (format === 0) {
    if (start + 1 + glyphs > bytes.length) fail();
    fds.set(bytes.subarray(start + 1, start + 1 + glyphs));
    return { fds, length: 1 + glyphs };
  }
  if (format !== 3) fail();
  const ranges = (bytes[start + 1] << 8) | bytes[start + 2];
  const length = 1 + 2 + ranges * 3 + 2;
  if (start + length > bytes.length) fail();
  for (let range = 0; range < ranges; range++) {
    const at = start + 3 + range * 3;
    const first = (bytes[at] << 8) | bytes[at + 1];
    const next = (bytes[at + 3] << 8) | bytes[at + 4];
    if (next < first || next > glyphs) fail();
    fds.fill(bytes[at + 2], first, next);
  }
  return { fds, length };
}

export function subsetCidCff(cff: Uint8Array, uses: readonly CffGlyphUse[]): Uint8Array {
  const headerSize = cff[2];
  if (cff[0] !== 1 || headerSize < 4) fail();
  const names = readIndex(cff, headerSize);
  const topDicts = readIndex(cff, names.end);
  const strings = readIndex(cff, topDicts.end);
  const globalSubrs = readIndex(cff, strings.end);
  if (topDicts.items.length !== 1) fail();
  const top = parseDict(topDicts.items[0]);
  if (!operandsOf(top, OP_ROS) || operandsOf(top, OP_PRIVATE)) fail();

  const charStrings = readIndex(cff, offsetOf(top, OP_CHARSTRINGS, cff.length));
  const glyphs = charStrings.items.length;
  const charsetStart = offsetOf(top, OP_CHARSET, cff.length);
  const charset = cff.subarray(charsetStart, charsetStart + charsetLength(cff, charsetStart, glyphs));
  const fdSelectStart = offsetOf(top, OP_FDSELECT, cff.length);
  const fdSelect = readFdSelect(cff, fdSelectStart, glyphs);
  const fdDicts = readIndex(cff, offsetOf(top, OP_FDARRAY, cff.length)).items.map((bytes) => {
    const dict = parseDict(bytes);
    const [size, offset] = operandsOf(dict, OP_PRIVATE) ?? fail();
    if (!Number.isSafeInteger(size) || !Number.isSafeInteger(offset) || offset < 0 || offset + size > cff.length) fail();
    const privateDict = parseDict(cff.subarray(offset, offset + size));
    const subrsOffset = operandsOf(privateDict, OP_SUBRS)?.at(-1);
    const subrs = subrsOffset === undefined ? undefined : readIndex(cff, offset + subrsOffset).items;
    return { dict, privateDict, subrs, used: new Set<number>() };
  });

  const usedGlyphs = new Set<number>([0]);
  const usedGlobal = new Set<number>();
  for (const use of uses) {
    if (!Number.isSafeInteger(use.glyph) || use.glyph < 0 || use.glyph >= glyphs) fail();
    usedGlyphs.add(use.glyph);
    const fd = fdDicts[fdSelect.fds[use.glyph]] ?? fail();
    for (const subr of use.localSubrs) fd.used.add(subr);
    for (const subr of use.globalSubrs) usedGlobal.add(subr);
  }

  const globalIndex = writeIndex(globalSubrs.items.map((item, index) => usedGlobal.has(index) ? item : RETURN));
  const charStringIndex = writeIndex(charStrings.items.map((item, index) => usedGlyphs.has(index) ? item : ENDCHAR));
  const privates = fdDicts.map((fd) => {
    const subrs = fd.subrs && writeIndex(fd.subrs.map((item, index) => fd.used.has(index) ? item : RETURN));
    // With every operand fixed-width the dict length does not depend on the Subrs value.
    const length = writeDict(fd.privateDict, new Map([[OP_SUBRS, [0]]])).length;
    const dict = writeDict(fd.privateDict, new Map([[OP_SUBRS, [length]]]));
    return { dict, subrs };
  });
  const fdArrayLength = writeIndex(fdDicts.map((fd) => writeDict(fd.dict, new Map([[OP_PRIVATE, [0, 0]]])))).length;
  const topLength = writeIndex([writeDict(top, new Map([[OP_CHARSET, [0]], [OP_CHARSTRINGS, [0]], [OP_FDARRAY, [0]], [OP_FDSELECT, [0]]]))]).length;

  const header = cff.subarray(0, headerSize);
  const nameIndex = cff.subarray(headerSize, names.end);
  const stringIndex = cff.subarray(topDicts.end, strings.end);
  const fdSelectBytes = cff.subarray(fdSelectStart, fdSelectStart + fdSelect.length);
  let cursor = headerSize + nameIndex.length + topLength + stringIndex.length + globalIndex.length;
  const charsetAt = cursor; cursor += charset.length;
  const fdSelectAt = cursor; cursor += fdSelectBytes.length;
  const charStringsAt = cursor; cursor += charStringIndex.length;
  const fdArrayAt = cursor; cursor += fdArrayLength;
  const privateAt = privates.map((entry) => {
    const at = cursor;
    cursor += entry.dict.length + (entry.subrs?.length ?? 0);
    return at;
  });

  const topIndex = writeIndex([writeDict(top, new Map([[OP_CHARSET, [charsetAt]], [OP_CHARSTRINGS, [charStringsAt]], [OP_FDARRAY, [fdArrayAt]], [OP_FDSELECT, [fdSelectAt]]]))]);
  const fdArray = writeIndex(fdDicts.map((fd, index) => writeDict(fd.dict, new Map([[OP_PRIVATE, [privates[index].dict.length, privateAt[index]]]]))));
  if (topIndex.length !== topLength || fdArray.length !== fdArrayLength) fail();

  const output = new Uint8Array(cursor);
  let position = 0;
  for (const part of [header, nameIndex, topIndex, stringIndex, globalIndex, charset, fdSelectBytes, charStringIndex, fdArray,
    ...privates.flatMap((entry) => entry.subrs ? [entry.dict, entry.subrs] : [entry.dict])]) {
    output.set(part, position);
    position += part.length;
  }
  if (position !== cursor) fail();
  return output;
}
