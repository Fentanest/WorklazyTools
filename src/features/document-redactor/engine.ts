import { dimensions, earlyAdmission } from './policy.ts';
import { PDFDocument, PDFName, PDFStream } from 'pdf-lib';
import { OwnedLedger, MiB } from './ledger.ts';
import { RedactorRuntime, encodeCanvas } from './runtime.ts';
import { imageSize, pngPlan, stripPngInto, withParsedPdf } from './input.ts';
import { normalizedToPixelRect, validatePageMasks } from './geometry.ts';
import { comparePixels, verifyPdfStructure, type PixelMetrics } from './verify.ts';
import { RedactorError, type InputInfo, type ProcessOptions, type PageSize, type JobCallbacks, type MaskRect } from './types.ts';
import { waitForPdfRender } from '../pdf-editor/pdfRenderLifecycle.ts';
import { throwIfAborted, yieldToEventLoop } from '../../utils/cooperativeCancel.ts';
export interface EngineContext {
    runtime: RedactorRuntime;
    ledger: OwnedLedger;
    owner: string;
    signal: AbortSignal;
    callbacks?: JobCallbacks;
}
export interface EngineOutput {
    lease: any;
    pages: PageSize[];
    unmaskedPages: number[];
    metrics: PixelMetrics[];
}
export async function ownedCanvas(context: EngineContext, size: PageSize, label: string) {
    const { ledger, owner } = context;
    const canvas = document.createElement('canvas');
    return ledger.allocate(owner, label, 'raw', size.width * size.height * 4, () => {
        try {
            canvas.width = size.width;
            canvas.height = size.height;
            return canvas;
        }
        catch (error) {
            canvas.width = 0;
            canvas.height = 0;
            throw error;
        }
    }, { size: size.width * size.height * 4, dispose: (value: HTMLCanvasElement) => { value.width = 0; value.height = 0; } });
}
export async function checkpoint(context: EngineContext) { throwIfAborted(context.signal); await yieldToEventLoop(); throwIfAborted(context.signal); }
async function bitmapCanvas(context: EngineContext, bytes: Uint8Array, size: PageSize, label: string) {
    const { ledger, owner } = context;
    const blob = await ledger.allocate(owner, label + '-Blob', 'binary', bytes.byteLength, () => new Blob([bytes]));
    let bitmap: any, canvas: any;
    try {
        bitmap = await ledger.allocate(owner, label + '-bitmap', 'raw', 4 * size.width * size.height, async () => {
            const value = await createImageBitmap(blob.value, { imageOrientation: 'from-image' });
            if (value.width * value.height !== size.width * size.height) {
                value.close();
                throw new RedactorError('damaged');
            }
            return value;
        }, { size: 4 * size.width * size.height, dispose: (value: ImageBitmap) => value.close() });
        await checkpoint(context);
        canvas = await ownedCanvas(context, { width: bitmap.value.width, height: bitmap.value.height }, label + '-canvas');
        canvas.value.getContext('2d').drawImage(bitmap.value, 0, 0);
        return canvas;
    }
    catch (error) {
        ledger.release(canvas);
        throw error;
    }
    finally {
        ledger.release(bitmap);
        ledger.release(blob);
    }
}
export async function renderSource(context: EngineContext, bytes: Uint8Array, kind: 'pdf' | 'image', pageIndex: number, dpi: number, label: string) {
    if (kind === 'image')
        return bitmapCanvas(context, bytes, dimensions(imageSize(bytes), 1), label);
    const opened = await context.runtime.open(bytes, context.ledger, context.owner, context.signal);
    let canvas: any, task: any;
    try {
        const page = await opened.document.getPage(pageIndex + 1), viewport = page.getViewport({ scale: dpi / 72 });
        const size = dimensions({ width: viewport.width, height: viewport.height }, 1);
        canvas = await ownedCanvas(context, size, label + '-canvas');
        task = page.render({ canvas: canvas.value, canvasContext: canvas.value.getContext('2d', { willReadFrequently: true }), viewport, background: 'rgb(255,255,255)' });
        await waitForPdfRender(task, page, { signal: context.signal });
        return canvas;
    }
    catch (error) {
        if (task) {
            task.cancel();
            await task.promise.catch(() => { });
        }
        context.ledger.release(canvas);
        throw error;
    }
    finally {
        await opened.close();
    }
}
export async function executeFile(context: EngineContext, input: any, info: InputInfo, options: ProcessOptions): Promise<EngineOutput> {
    const { ledger, owner } = context;
    const scale = info.kind === 'pdf' ? options.dpi / 72 : 1;
    if (![150, 200, 300].includes(options.dpi))
        throw new RedactorError('dimensions');
    validatePageMasks(options.masksByPage, info.pages.length);
    const unmaskedPages = info.pages.flatMap((_, i) => options.masksByPage[i]?.length ? [] : [i]);
    const metrics: PixelMetrics[] = [];
    let pdf: PDFDocument | undefined = info.kind === 'pdf' ? await PDFDocument.create({ updateMetadata: false }) : undefined;
    const streams: any[] = [];
    const seenStreams = new Set<PDFStream>();
    let standalone: any;
    const progress = (phase: 'reading' | 'rendering' | 'encoding' | 'verifying' | 'saving', page: number) => { context.callbacks?.onProgress?.({ phase, page, pages: info.pages.length }); };
    for (let index = 0; index < info.pages.length; index++) {
        await checkpoint(context);
        const size = dimensions(info.pages[index], scale);
        earlyAdmission(context, size, info.kind === 'pdf');
        const masks: readonly MaskRect[] = options.masksByPage[index] ?? [];
        progress('rendering', index);
        let source: any, png: any;
        try {
            source = await renderSource(context, input.value, info.kind, index, options.dpi, 'masked-source');
            const ctx = source.value.getContext('2d');
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#000000';
            for (const mask of masks) {
                const rect = normalizedToPixelRect(size, mask);
                ctx.fillRect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
            }
            progress('encoding', index);
            const blob = await ledger.allocate(owner, 'PNG-Blob', 'binary', 2 * 4 * size.width * size.height + MiB, () => encodeCanvas(source.value));
            let bytes: any;
            try {
                await checkpoint(context);
                bytes = await ledger.allocate(owner, 'PNG-arraybuffer', 'binary', blob.value.size, async () => new Uint8Array(await blob.value.arrayBuffer()));
            }
            finally {
                ledger.release(blob);
            }
            try {
                const plan = pngPlan(bytes.value);
                png = await ledger.allocate(owner, 'PNG-strip-copy', 'binary', plan.total, () => { const value = new Uint8Array(plan.total); stripPngInto(bytes.value, plan, value); return value; });
            }
            finally {
                ledger.release(bytes);
            }
        }
        finally {
            ledger.release(source);
        }
        try {
            progress('verifying', index);
            const decoded = await bitmapCanvas(context, png.value, size, 'encoded-PNG');
            let original: any;
            try {
                original = await renderSource(context, input.value, info.kind, index, options.dpi, 'independent-original');
                metrics.push(await comparePixels(original.value, decoded.value, masks, ledger, owner, () => checkpoint(context)));
            }
            finally {
                ledger.release(original);
                ledger.release(decoded);
            }
            if (!pdf) {
                standalone = png;
                png = null;
                continue;
            }
            const scratch = ledger.reserve(owner, 'pdf-lib-scratch', 'raw', 16 * size.width * size.height + MiB);
            let image: any, rgb: any;
            try {
                ledger.event('allocation-start', { reservation: scratch.id, owner, label: 'embed-PNG' });
                image = await pdf.embedPng(png.value);
                rgb = ledger.bind(scratch, image.embedder.image.rgbChannel);
                if (image.embedder.image.alphaChannel)
                    throw new RedactorError('verification');
            }
            finally {
                ledger.close(scratch);
            }
            try {
                const base = info.pages[index], page = pdf.addPage([base.width, base.height]);
                const width = size.width / (options.dpi / 72), height = size.height / (options.dpi / 72);
                page.drawImage(image, { x: 0, y: base.height - height, width, height });
                page.node.delete(PDFName.of('Annots'));
                page.node.Resources()?.delete(PDFName.of('Font'));
                page.node.Resources()?.delete(PDFName.of('ExtGState'));
                const reserve = ledger.reserve(owner, 'compressed-stream-cap', 'binary', 2 * 4 * size.width * size.height + MiB);
                try {
                    ledger.event('allocation-start', { reservation: reserve.id, owner, label: 'embed-flush' });
                    await image.embed();
                    await pdf.flush();
                    for (const [, object] of pdf.context.enumerateIndirectObjects())
                        if (object instanceof PDFStream && !seenStreams.has(object)) {
                            streams.push(ledger.bind(reserve, object.getContents()));
                            seenStreams.add(object);
                        }
                }
                finally {
                    ledger.close(reserve);
                }
            }
            finally {
                image = null;
                ledger.release(rgb);
            }
        }
        finally {
            ledger.release(png);
        }
    }
    let output: any;
    if (pdf) {
        await checkpoint(context);
        progress('saving', info.pages.length - 1);
        pdf.context.trailerInfo.Info = undefined;
        const retained = streams.reduce((n, h) => n + h.record.size, 0);
        output = await ledger.allocate(owner, 'save-Uint8Array', 'binary', 2 * retained + MiB, () => pdf!.save({ useObjectStreams: false, updateFieldAppearances: false }));
        pdf = undefined;
        seenStreams.clear();
        streams.forEach(h => ledger.release(h));
        await withParsedPdf(output.value, ledger, owner, parsed => verifyPdfStructure(output.value, parsed, info.pages, ledger, owner));
        const reopened = await context.runtime.open(output.value, ledger, owner, context.signal);
        try {
            if (reopened.document.numPages !== info.pages.length)
                throw new RedactorError('verification');
            for (let index = 0; index < info.pages.length; index++) {
                const page = await reopened.document.getPage(index + 1), view = page.getViewport({ scale: 1 });
                if (view.width !== info.pages[index].width || view.height !== info.pages[index].height || (await page.getTextContent()).items.some(x => 'str' in x && x.str.length))
                    throw new RedactorError('verification');
            }
        }
        finally {
            await reopened.close();
        }
        for (let index = 0; index < info.pages.length; index++) {
            await checkpoint(context);
            progress('verifying', index);
            const original = await renderSource(context, input.value, 'pdf', index, options.dpi, 'verify-original');
            let final: any;
            try {
                final = await renderSource(context, output.value, 'pdf', index, options.dpi, 'verify-output');
                metrics.push(await comparePixels(original.value, final.value, options.masksByPage[index] ?? [], ledger, owner, () => checkpoint(context)));
            }
            finally {
                ledger.release(original);
                ledger.release(final);
            }
        }
    }
    else {
        output = standalone;
        pngPlan(output.value, true);
    }
    await checkpoint(context);
    const lease = await ledger.allocate(owner, 'published-result-Blob', 'binary', output.value.byteLength, () => new Blob([output.value], { type: info.kind === 'pdf' ? 'application/pdf' : 'image/png' }));
    ledger.release(output);
    return { lease, pages: info.pages, unmaskedPages, metrics };
}
