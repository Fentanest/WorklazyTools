import pdfDisplayUrl from 'pdfjs-dist/build/pdf.mjs?url';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import type { PDFDocumentLoadingTask, PDFWorker, PDFDocumentProxy } from 'pdfjs-dist';
import { manifest } from './assetManifest.ts';
import { OwnedLedger } from './ledger.ts';
import { settleOwnedPdfLoad } from '../../utils/pdfOwnedDocument.ts';
import { waitForPdfRender } from '../pdf-editor/pdfRenderLifecycle.ts';
import { RedactorError } from './types.ts';
type PdfJs = typeof import('pdfjs-dist');
export interface OwnedDocument {
    document: PDFDocumentProxy;
    close(): Promise<void>;
}
export class RedactorRuntime {
    private assets = new Map<string, Uint8Array>();
    private pdfjs!: PdfJs;
    private worker!: PDFWorker;
    private nativeWorker?: Worker;
    private workerObjectUrl?: string;
    private readonly onDocumentExit = () => this.terminateNativeWorker();
    readonly fixedBytes = manifest.reduce((n, asset) => n + asset.size, 0);
    readonly assetCount = manifest.length;
    imageSupported = false;
    constructor() {
        // A document can freeze while a non-cancellable encoder is pending. Stop
        // the worker synchronously without releasing that producer's reservations.
        // The isolated document reloads on BFCache restoration; this runtime is
        // never reused after pagehide.
        window.addEventListener('pagehide', this.onDocumentExit);
    }
    async prepare(signal?: AbortSignal): Promise<void> {
        try {
            for (let i = 0; i < manifest.length; i += 12) {
                signal?.throwIfAborted();
                const completed = await Promise.allSettled(manifest.slice(i, i + 12).map(async (asset) => {
                    const response = await fetch(asset.url);
                    if (!response.ok)
                        throw new RedactorError('not-ready');
                    const bytes = new Uint8Array(await response.arrayBuffer());
                    const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('');
                    if (bytes.length !== asset.size || sha !== asset.sha)
                        throw new RedactorError('not-ready');
                    this.assets.set(asset.kind + ':' + asset.filename, bytes);
                }));
                const failure = completed.find(result => result.status === "rejected");
                if (failure?.status === "rejected") throw failure.reason;
            }
            this.pdfjs = await import(/* @vite-ignore */ pdfDisplayUrl) as PdfJs;
            this.pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
            signal?.throwIfAborted();
            const workerUrl = new URL(pdfWorkerUrl, window.location.href);
            if (workerUrl.origin !== window.location.origin) throw new RedactorError('not-ready');
            const wrapper = 'await import(' + JSON.stringify(workerUrl.href) + ');self.postMessage({__fixedWorkerReady:true});';
            this.workerObjectUrl = URL.createObjectURL(new Blob([wrapper], {type: 'text/javascript'}));
            this.nativeWorker = new Worker(this.workerObjectUrl, {type: 'module'});
            await waitNativeWorker(this.nativeWorker, signal);
            // The generated declaration types port as null; the installed runtime supports native Worker ports.
            const PortWorker = this.pdfjs.PDFWorker as unknown as new (options: {port: Worker}) => PDFWorker;
            this.worker = new PortWorker({port: this.nativeWorker});
            await this.worker.promise;
            await this.warmup(signal);
            signal?.throwIfAborted();
            this.imageSupported = await orientationProbe();
            signal?.throwIfAborted();
        }
        catch {
            await this.dispose();
            throw new RedactorError(signal?.aborted ? 'cancelled' : 'not-ready');
        }
    }
    async open(bytes: Uint8Array, ledger: OwnedLedger, owner: string, signal?: AbortSignal): Promise<OwnedDocument> {
        const clone = await ledger.allocate(owner, 'active-document-clone', 'binary', bytes.byteLength, () => bytes.slice());
        const handles: any[] = [];
        const assets = this.assets;
        class MemoryFactory {
            async fetch({ kind, filename }: {
                kind: string;
                filename: string;
            }) {
                const source = assets.get(kind + ':' + filename);
                if (!source)
                    throw new RedactorError('unsupported');
                const handle = await ledger.allocate(owner, 'fixed-asset-clone', 'binary', source.length, () => source.slice());
                handles.push(handle);
                return handle.value;
            }
        }
        let task: PDFDocumentLoadingTask | undefined;
        let closed = false;
        const close = async () => {
            if (closed)
                return;
            closed = true;
            try {
                await task?.destroy();
            }
            finally {
                handles.forEach(h => ledger.release(h));
                ledger.release(clone);
            }
        };
        try {
            task = this.pdfjs.getDocument({
                data: clone.value, worker: this.worker, useWorkerFetch: false, BinaryDataFactory: MemoryFactory,
                cMapUrl: 'memory://cmap/', standardFontDataUrl: 'memory://font/', wasmUrl: 'memory://wasm/', cMapPacked: true,
                verbosity: 0, password: '', enableXfa: false, useSystemFonts: false,
                isOffscreenCanvasSupported: false, isImageDecoderSupported: false,
            });
            const { document } = await settleOwnedPdfLoad(task, signal);
            return { document, close };
        }
        catch (error) {
            await close();
            throw error;
        }
    }
    private async warmup(signal?: AbortSignal) {
        const source = await PDFDocument.create({ updateMetadata: false });
        source.addPage([12, 12]);
        const bytes = await source.save({ useObjectStreams: false });
        const ledger = new OwnedLedger();
        const opened = await this.open(bytes, ledger, 'warm', signal);
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 24;
        try {
            const page = await opened.document.getPage(1);
            await waitForPdfRender(page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: page.getViewport({ scale: 2 }), background: 'white' }), page, {signal});
            const blob = await encodeCanvas(canvas);
            const output = await PDFDocument.create({ updateMetadata: false });
            const image = await output.embedPng(await blob.arrayBuffer());
            output.addPage([12, 12]).drawImage(image, { width: 12, height: 12 });
            const final = await output.save({ useObjectStreams: false });
            const reopened = await this.open(final, ledger, 'warm', signal);
            await reopened.close();
            const sink = new Uint8ArrayWriter();
            const zip = new ZipWriter(sink, { level: 0, useWebWorkers: false });
            await zip.add('warm.pdf', new Uint8ArrayReader(final), { useWebWorkers: false });
            await zip.close();
        }
        finally {
            canvas.width = 0;
            canvas.height = 0;
            await opened.close();
            ledger.releaseOwner('warm');
        }
    }
    private terminateNativeWorker() {
        this.nativeWorker?.terminate();
        this.nativeWorker = undefined;
        if (this.workerObjectUrl) URL.revokeObjectURL(this.workerObjectUrl);
        this.workerObjectUrl = undefined;
    }
    async dispose() {
        window.removeEventListener('pagehide', this.onDocumentExit);
        try { await this.worker?.destroy(); }
        finally {
            this.terminateNativeWorker();
            this.assets.clear();
        }
    }
}
export function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new RedactorError('unsupported')), 'image/png'));
}
async function orientationProbe(): Promise<boolean> {
    const source = document.createElement('canvas');
    source.width = 16;
    source.height = 8;
    const context = source.getContext('2d')!;
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
    colors.forEach((color, i) => { context.fillStyle = color; context.fillRect(i % 2 * 8, Math.floor(i / 2) * 4, 8, 4); });
    const jpeg = await new Promise<Blob | null>(resolve => source.toBlob(resolve, 'image/jpeg', 1));
    source.width = 0;
    source.height = 0;
    if (!jpeg)
        return false;
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    const expected = [[0, 1, 2, 3], [1, 0, 3, 2], [3, 2, 1, 0], [2, 3, 0, 1], [0, 2, 1, 3], [2, 0, 3, 1], [3, 1, 2, 0], [1, 3, 0, 2]];
    try {
        for (let orientation = 1; orientation <= 8; orientation++) {
            const payload = new Uint8Array([69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0, 0, 0, orientation, 0, 0, 0, 0, 0, 0, 0]);
            const encoded = new Uint8Array(bytes.length + payload.length + 4);
            encoded.set(bytes.subarray(0, 2));
            encoded.set([255, 225, 0, payload.length + 2], 2);
            encoded.set(payload, 6);
            encoded.set(bytes.subarray(2), payload.length + 6);
            const bitmap = await createImageBitmap(new Blob([encoded]), { imageOrientation: 'from-image' });
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            try {
                if (bitmap.width !== (orientation >= 5 ? 8 : 16) || bitmap.height !== (orientation >= 5 ? 16 : 8))
                    return false;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(bitmap, 0, 0);
                for (let i = 0; i < 4; i++) {
                    const pixel = ctx.getImageData(Math.floor((i % 2 + .5) * canvas.width / 2), Math.floor((Math.floor(i / 2) + .5) * canvas.height / 2), 1, 1).data;
                    const reference = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
                    const distances = reference.map(rgb => rgb.reduce((sum, value, channel) => sum + (value - pixel[channel]) ** 2, 0));
                    if (distances.indexOf(Math.min(...distances)) !== expected[orientation - 1][i])
                        return false;
                }
            }
            finally {
                bitmap.close();
                canvas.width = 0;
                canvas.height = 0;
            }
        }
        return true;
    }
    catch {
        return false;
    }
}

function waitNativeWorker(worker: Worker, signal?: AbortSignal, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
        const finish = (error?: Error) => {
            clearTimeout(timer);
            worker.removeEventListener('message', message);
            worker.removeEventListener('error', failed);
            signal?.removeEventListener('abort', aborted);
            error ? reject(error) : resolve();
        };
        const message = (event: MessageEvent) => { if (event.data?.__fixedWorkerReady === true) finish(); };
        const failed = (event: ErrorEvent) => { event.preventDefault(); finish(new Error('worker-startup')); };
        const aborted = () => finish(new DOMException('cancelled', 'AbortError'));
        const timer = setTimeout(() => finish(new Error('worker-timeout')), timeoutMs);
        worker.addEventListener('message', message);
        worker.addEventListener('error', failed);
        signal?.addEventListener('abort', aborted, {once: true});
        if (signal?.aborted) aborted();
    });
}
