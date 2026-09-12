import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFObjectParser, decodePDFRawStream } from 'pdf-lib';
import { OwnedLedger, MiB } from './ledger.ts';
import { normalizedToPixelRect, rowIntervals } from './geometry.ts';
import { RedactorError, type MaskRect, type PageSize } from './types.ts';
export interface PixelMetrics {
    inside: number;
    badBlack: number;
    outside: number;
    badOutside: number;
    ratio: number;
    mean: number;
}
function fail(): never { throw new RedactorError('verification'); }
export async function comparePixels(source: HTMLCanvasElement, output: HTMLCanvasElement, masks: readonly MaskRect[], ledger: OwnedLedger, owner: string, checkpoint: () => Promise<void>): Promise<PixelMetrics> {
    if (source.width !== output.width || source.height !== output.height)
        fail();
    const width = source.width, height = source.height;
    const size = { width, height };
    const inner = masks.map(r => normalizedToPixelRect(size, r, 1)), outer = masks.map(r => normalizedToPixelRect(size, r, 2));
    let inside = 0, badBlack = 0, outside = 0, badOutside = 0, difference = 0;
    for (let y = 0; y < height; y += 32) {
        await checkpoint();
        const rows = Math.min(32, height - y), bytes = width * rows * 4;
        const a = await ledger.allocate(owner, 'verify-source-ImageData', 'raw', bytes, () => source.getContext('2d')!.getImageData(0, y, width, rows).data);
        let b: any;
        try {
            b = await ledger.allocate(owner, 'verify-output-ImageData', 'raw', bytes, () => output.getContext('2d')!.getImageData(0, y, width, rows).data);
            for (let row = 0; row < rows; row++) {
                const required = rowIntervals(inner, y + row), excluded = rowIntervals(outer, y + row);
                let ip = 0, op = 0;
                for (let x = 0; x < width; x++) {
                    while (ip < required.length && x >= required[ip][1])
                        ip++;
                    while (op < excluded.length && x >= excluded[op][1])
                        op++;
                    const i = (row * width + x) * 4;
                    if (ip < required.length && x >= required[ip][0]) {
                        inside++;
                        if (b.value[i] || b.value[i + 1] || b.value[i + 2] || b.value[i + 3] !== 255)
                            badBlack++;
                    }
                    else if (op >= excluded.length || x < excluded[op][0]) {
                        outside++;
                        let bad = false;
                        for (let c = 0; c < 4; c++) {
                            const d = Math.abs(a.value[i + c] - b.value[i + c]);
                            difference += d;
                            if (d > 2)
                                bad = true;
                        }
                        if (bad)
                            badOutside++;
                    }
                }
            }
        }
        finally {
            ledger.release(a);
            ledger.release(b);
        }
    }
    const metric = { inside, badBlack, outside, badOutside, ratio: outside ? badOutside / outside : 0, mean: outside ? difference / (4 * outside) : 0 };
    if ((masks.length > 0 && !inside) || badBlack || metric.ratio > .001 || metric.mean > .25)
        fail();
    return metric;
}
export function verifyPdfStructure(bytes: Uint8Array, pdf: PDFDocument, sizes: readonly PageSize[], ledger: OwnedLedger, owner: string) {
    const ensure = (dict: PDFDict, keys: readonly string[]) => {
        for (const k of dict.keys())
            if (!keys.includes(k.asString().slice(1)))
                fail();
    };
    ensure(pdf.catalog, ['Type', 'Pages']);
    let trailerOffset = -1;
    for (let i = bytes.length - 7; i >= 0; i--) {
        if (bytes[i] === 116 && bytes[i + 1] === 114 && bytes[i + 2] === 97 && bytes[i + 3] === 105 && bytes[i + 4] === 108 && bytes[i + 5] === 101 && bytes[i + 6] === 114) {
            trailerOffset = i;
            break;
        }
    }
    if (trailerOffset < 0)
        fail();
    const trailer = PDFObjectParser.forBytes(bytes.subarray(trailerOffset + 7), pdf.context).parseObject();
    if (!(trailer instanceof PDFDict))
        fail();
    ensure(trailer, ['Size', 'Root', 'Info', 'ID']);
    if (pdf.context.trailerInfo.Encrypt)
        fail();
    const info = pdf.context.lookup(pdf.context.trailerInfo.Info);
    if (info) {
        if (!(info instanceof PDFDict) || info.keys().length)
            fail();
    }
    const visited = new Set<unknown>([pdf.catalog]);
    const tree = (ref: unknown) => {
        const node = pdf.context.lookup(ref as PDFRef);
        if (!(node instanceof PDFDict) || visited.has(node) || visited.size > sizes.length * 2 + 2)
            fail();
        visited.add(node);
        if (node.get(PDFName.of('Type')) === PDFName.of('Page'))
            return;
        ensure(node, ['Type', 'Kids', 'Count', 'Parent']);
        const kids = node.lookup(PDFName.of('Kids'), PDFArray);
        for (const child of kids.asArray())
            tree(child);
    };
    tree(pdf.catalog.get(PDFName.of('Pages')));
    const pages = pdf.getPages();
    if (pages.length !== sizes.length)
        fail();
    const imageRefs = new Set<unknown>();
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        ensure(page.node, ['Type', 'Parent', 'MediaBox', 'Resources', 'Contents']);
        const box = page.getMediaBox();
        if (box.x !== 0 || box.y !== 0 || box.width !== sizes[i].width || box.height !== sizes[i].height)
            fail();
        const resources = page.node.Resources();
        if (!resources)
            fail();
        ensure(resources!, ['XObject', 'ProcSet']);
        const procSet = resources!.lookup(PDFName.of('ProcSet'));
        if (procSet !== undefined) {
            if (!(procSet instanceof PDFArray))
                fail();
            for (const entry of procSet.asArray()) {
                if (!(entry instanceof PDFName) || !['/PDF', '/ImageB', '/ImageC', '/ImageI'].includes(entry.toString()))
                    fail();
            }
        }
        const objects = resources!.lookup(PDFName.of('XObject'), PDFDict);
        if (objects.keys().length !== 1)
            fail();
        const image = objects.lookup(objects.keys()[0]);
        if (!(image instanceof PDFRawStream) || imageRefs.has(image))
            fail();
        imageRefs.add(image);
        visited.add(image);
        ensure(image.dict, ['Type', 'Subtype', 'Width', 'Height', 'ColorSpace', 'BitsPerComponent', 'Filter', 'Length', 'DecodeParms']);
        if (image.dict.get(PDFName.of('Subtype')) !== PDFName.of('Image') || image.dict.get(PDFName.of('ColorSpace')) !== PDFName.of('DeviceRGB') || image.dict.lookup(PDFName.of('BitsPerComponent'), PDFNumber).asNumber() !== 8)
            fail();
        const decodeParms = image.dict.lookup(PDFName.of('DecodeParms'));
        if (decodeParms !== undefined) {
            if (!(decodeParms instanceof PDFDict))
                fail();
            ensure(decodeParms, ['Predictor', 'Colors', 'BitsPerComponent', 'Columns']);
            for (const key of decodeParms.keys()) {
                const value = decodeParms.lookup(key);
                if (!(value instanceof PDFNumber) || !Number.isSafeInteger(value.asNumber()))
                    fail();
                const n = value.asNumber();
                if (key === PDFName.of('Predictor') && ![1, 10, 11, 12, 13, 14, 15].includes(n))
                    fail();
                if (key === PDFName.of('Colors') && n !== 3)
                    fail();
                if (key === PDFName.of('BitsPerComponent') && n !== 8)
                    fail();
                if (key === PDFName.of('Columns') && n !== image.dict.lookup(PDFName.of('Width'), PDFNumber).asNumber())
                    fail();
            }
        }
        const contents = page.node.Contents();
        let stream: unknown = contents;
        if (contents instanceof PDFArray) {
            if (contents.size() !== 1)
                fail();
            stream = pdf.context.lookup(contents.get(0));
        }
        if (!(stream instanceof PDFRawStream))
            fail();
        visited.add(stream);
        ensure(stream.dict, ['Filter', 'Length']);
        const reservation = ledger.reserve(owner, 'verify-content-decode', 'binary', MiB);
        let lease: any;
        try {
            ledger.event('allocation-start', { reservation: reservation.id, owner, label: 'verify-content-decode' });
            lease = ledger.bind(reservation, decodePDFRawStream(stream).decode());
            ledger.close(reservation);
            const tokens = new TextDecoder().decode(lease.value).trim().split(/\s+/);
            let draws = 0, depth = 0;
            const operands: string[] = [];
            const number = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
            for (const token of tokens) {
                if (token === 'q' || token === 'Q') {
                    if (operands.length !== 0)
                        fail();
                    depth += token === 'q' ? 1 : -1;
                    if (depth < 0)
                        fail();
                }
                else if (token === 'cm') {
                    if (operands.length !== 6 || !operands.every(value => number.test(value) && Number.isFinite(Number(value))))
                        fail();
                    operands.length = 0;
                }
                else if (token === 'Do') {
                    if (operands.length !== 1 || operands[0] !== objects.keys()[0].toString())
                        fail();
                    operands.length = 0;
                    draws++;
                }
                else if (/^\/[\w-]+$/.test(token) || number.test(token)) {
                    operands.push(token);
                    if (operands.length > 6)
                        fail();
                }
                else
                    fail();
            }
            if (draws !== 1 || depth !== 0 || operands.length !== 0)
                fail();
        }
        finally {
            ledger.release(lease);
            ledger.close(reservation);
        }
    }
    for (const [, object] of pdf.context.enumerateIndirectObjects())
        if (!visited.has(object) && object !== info)
            fail();
    return { pages: pages.length, images: imageRefs.size };
}
