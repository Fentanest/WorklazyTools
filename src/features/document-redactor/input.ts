import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { RedactorError, type PageSize } from './types.ts';
import { OwnedLedger, MiB } from './ledger.ts';
export const LIMITS = { files: 20, fileBytes: 32 * MiB, batchBytes: 64 * MiB, pages: 100, batchPages: 200, imagePixels: 16000000, masks: 1000 };
export function checkFiles(files: readonly File[]) {
    if (!files.length || files.length > LIMITS.files || files.some(f => !f.size || f.size > LIMITS.fileBytes) || files.reduce((n, f) => n + f.size, 0) > LIMITS.batchBytes)
        throw new RedactorError('limit');
}
const ascii = (b: Uint8Array, p: number, n: number) => String.fromCharCode(...b.subarray(p, p + n));
export function crc32(bytes: Uint8Array) {
    let n = 0xffffffff;
    for (const b of bytes) {
        n ^= b;
        for (let k = 0; k < 8; k++)
            n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0);
    }
    return (n ^ 0xffffffff) >>> 0;
}
export function pngPlan(bytes: Uint8Array, strict = false) {
    if (bytes.length < 33 || ascii(bytes, 0, 8) !== '\x89PNG\r\n\x1a\n')
        throw new RedactorError('damaged');
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const parts: Array<{
        start: number;
        end: number;
        kind: string;
    }> = [];
    let p = 8, total = 8, headers = 0, idat = false, ended = false;
    while (p < bytes.length) {
        if (p + 12 > bytes.length)
            throw new RedactorError('damaged');
        const len = v.getUint32(p), end = p + 12 + len;
        if (end > bytes.length)
            throw new RedactorError('damaged');
        const kind = ascii(bytes, p + 4, 4);
        if (crc32(bytes.subarray(p + 4, end - 4)) !== v.getUint32(end - 4))
            throw new RedactorError('damaged');
        if (kind === 'acTL')
            throw new RedactorError('unsupported');
        if (kind === 'IHDR') {
            headers++;
            if (p !== 8 || len !== 13)
                throw new RedactorError('damaged');
        }
        if (kind === 'PLTE' && (idat || len === 0 || len > 768 || len % 3))
            throw new RedactorError('damaged');
        if (kind === 'IDAT')
            idat = true;
        if (kind === 'IEND') {
            if (len !== 0)
                throw new RedactorError('damaged');
            ended = true;
        }
        if (['IHDR', 'IDAT', 'IEND'].includes(kind)) {
            parts.push({ start: p, end, kind });
            total += end - p;
        }
        else if (strict || (kind[0] === kind[0].toUpperCase() && kind !== 'PLTE'))
            throw new RedactorError('unsupported');
        p = end;
        if (ended)
            break;
    }
    if (p !== bytes.length || headers !== 1 || !idat || !ended)
        throw new RedactorError('damaged');
    return { parts, total, width: v.getUint32(16), height: v.getUint32(20) };
}
export function stripPngInto(bytes: Uint8Array, plan: ReturnType<typeof pngPlan>, out: Uint8Array) {
    if (out.length !== plan.total)
        throw new RedactorError('verification');
    out.set(bytes.subarray(0, 8));
    let p = 8;
    for (const part of plan.parts) {
        out.set(bytes.subarray(part.start, part.end), p);
        p += part.end - part.start;
    }
}
export function imageSize(bytes: Uint8Array): PageSize {
    let width = 0, height = 0;
    if (ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') {
        ({ width, height } = pngPlan(bytes));
    }
    else if (bytes[0] === 255 && bytes[1] === 216) {
        let p = 2;
        while (p + 3 < bytes.length) {
            if (bytes[p++] !== 255)
                throw new RedactorError('damaged');
            while (bytes[p] === 255)
                p++;
            const marker = bytes[p++];
            if (marker === 217 || marker === 218)
                break;
            if (marker === 1 || (marker >= 208 && marker <= 215))
                continue;
            const len = (bytes[p] << 8) | bytes[p + 1];
            if (len < 2 || p + len > bytes.length)
                throw new RedactorError('damaged');
            if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
                height = (bytes[p + 3] << 8) | bytes[p + 4];
                width = (bytes[p + 5] << 8) | bytes[p + 6];
            }
            p += len;
        }
    }
    else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
        const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (v.getUint32(4, true) + 8 !== bytes.length)
            throw new RedactorError('damaged');
        let p = 12;
        while (p < bytes.length) {
            if (p + 8 > bytes.length)
                throw new RedactorError('damaged');
            const kind = ascii(bytes, p, 4), len = v.getUint32(p + 4, true), a = p + 8;
            if (a + len > bytes.length)
                throw new RedactorError('damaged');
            if (kind === 'ANIM' || kind === 'ANMF')
                throw new RedactorError('unsupported');
            if (kind === 'VP8X' && len >= 10) {
                if (bytes[a] & 2)
                    throw new RedactorError('unsupported');
                width = 1 + bytes[a + 4] + (bytes[a + 5] << 8) + (bytes[a + 6] << 16);
                height = 1 + bytes[a + 7] + (bytes[a + 8] << 8) + (bytes[a + 9] << 16);
            }
            else if (kind === 'VP8 ' && len >= 10 && !width) {
                if (ascii(bytes, a + 3, 3) !== '\x9d\x01\x2a')
                    throw new RedactorError('damaged');
                width = v.getUint16(a + 6, true) & 16383;
                height = v.getUint16(a + 8, true) & 16383;
            }
            else if (kind === 'VP8L' && len >= 5 && !width) {
                if (bytes[a] !== 47)
                    throw new RedactorError('damaged');
                const bits = v.getUint32(a + 1, true);
                width = (bits & 16383) + 1;
                height = ((bits >>> 14) & 16383) + 1;
            }
            p = a + len + (len % 2);
            if (p > bytes.length)
                throw new RedactorError('damaged');
        }
    }
    else
        throw new RedactorError('unsupported');
    if (!width || !height || width * height > LIMITS.imagePixels)
        throw new RedactorError('dimensions');
    return { width, height };
}
export const isPdf = (bytes: Uint8Array) => ascii(bytes, 0, 5) === '%PDF-';
/** Parser stream copies are owned independently of source bytes; no source object enters composer. */
export async function withParsedPdf<T>(bytes: Uint8Array, ledger: OwnedLedger, owner: string, fn: (pdf: PDFDocument) => T | Promise<T>): Promise<T> {
    const reservation = ledger.reserve(owner, 'parser-stream-copies', 'binary', bytes.byteLength);
    const handles: any[] = [];
    let pdf: PDFDocument | undefined;
    try {
        ledger.event('allocation-start', { reservation: reservation.id, owner, label: 'PDFDocument.load' });
        pdf = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
        for (const [, obj] of pdf.context.enumerateIndirectObjects())
            if (obj instanceof PDFRawStream)
                handles.push(ledger.bind(reservation, obj.getContents()));
        ledger.close(reservation);
        return await fn(pdf);
    }
    catch (e) {
        if (e instanceof Error && /encrypted/i.test(e.message))
            throw new RedactorError('encrypted');
        throw e;
    }
    finally {
        pdf = undefined;
        for (const h of handles)
            ledger.release(h);
        ledger.close(reservation);
    }
}
export function inspectPdfStructure(pdf: PDFDocument): number {
    if (pdf.isEncrypted)
        throw new RedactorError('encrypted');
    const form = pdf.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
    if (form?.has(PDFName.of('XFA')))
        throw new RedactorError('xfa');
    const pending = [{ node: pdf.catalog.lookup(PDFName.of('Pages'), PDFDict), depth: 0 }], seen = new Set<PDFDict>();
    let leaves = 0;
    while (pending.length) {
        const { node, depth } = pending.pop()!;
        if (seen.has(node) || depth > 128)
            throw new RedactorError('damaged');
        seen.add(node);
        if (seen.size > 10000)
            throw new RedactorError('limit');
        const type = node.get(PDFName.of('Type'));
        if (type === PDFName.of('Page')) {
            if (++leaves > LIMITS.pages)
                throw new RedactorError('limit');
            continue;
        }
        if (type !== PDFName.of('Pages'))
            throw new RedactorError('damaged');
        const kids = node.lookup(PDFName.of('Kids'), PDFArray);
        if (kids.size() > 10000 || pending.length + kids.size() > 10000)
            throw new RedactorError('limit');
        for (const ref of kids.asArray()) {
            const child = pdf.context.lookup(ref);
            if (!(child instanceof PDFDict))
                throw new RedactorError('damaged');
            pending.push({ node: child, depth: depth + 1 });
        }
    }
    if (!leaves)
        throw new RedactorError('damaged');
    const pages = pdf.getPages();
    if (pages.length !== leaves)
        throw new RedactorError('damaged');
    for (const page of pages) {
        const inherited = (name: string) => {
            let node: PDFDict | undefined = page.node;
            const visited = new Set<PDFDict>();
            while (node) {
                if (visited.has(node))
                    throw new RedactorError('damaged');
                visited.add(node);
                const value = node.get(PDFName.of(name));
                if (value)
                    return pdf.context.lookup(value);
                node = node.lookupMaybe(PDFName.of('Parent'), PDFDict);
            }
            return undefined;
        };
        const box = (name: string, required = false) => {
            const value = inherited(name);
            if (value === undefined && !required)
                return undefined;
            if (!(value instanceof PDFArray) || value.size() !== 4)
                throw new RedactorError('damaged');
            const a = value.asArray().map(x => {
                const n = pdf.context.lookup(x);
                if (!(n instanceof PDFNumber) || !Number.isFinite(n.asNumber()))
                    throw new RedactorError('damaged');
                return n.asNumber();
            });
            if (a[2] <= a[0] || a[3] <= a[1])
                throw new RedactorError('damaged');
            return a;
        };
        const media = box('MediaBox', true)!, crop = box('CropBox');
        if (crop && (Math.min(crop[2], media[2]) <= Math.max(crop[0], media[0]) || Math.min(crop[3], media[3]) <= Math.max(crop[1], media[1])))
            throw new RedactorError('damaged');
        const unit = page.node.get(PDFName.of('UserUnit'));
        if (unit) {
            const n = pdf.context.lookup(unit);
            if (!(n instanceof PDFNumber) || !Number.isFinite(n.asNumber()) || n.asNumber() <= 0)
                throw new RedactorError('damaged');
        }
        const rotation = inherited('Rotate');
        if (rotation !== undefined && (!(rotation instanceof PDFNumber) || !Number.isFinite(rotation.asNumber()) || rotation.asNumber() % 90 !== 0))
            throw new RedactorError('damaged');
    }
    return pages.length;
}
