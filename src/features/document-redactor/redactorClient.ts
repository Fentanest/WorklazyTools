import { dimensions } from './policy.ts';
import { Reader } from '@zip.js/zip.js';
import { writeZipArchive } from '../../utils/zipArchive.ts';
import { SafeFileNameRegistry, reserveSafeFileName, createUniqueSafeFileName } from '../../utils/fileNameSafety.ts';
import { OwnedLedger, MiB } from './ledger.ts';
import { RedactorRuntime } from './runtime.ts';
import { checkFiles, imageSize, inspectPdfStructure, isPdf, LIMITS, withParsedPdf } from './input.ts';
import { checkpoint, executeFile, renderSource, type EngineContext } from './engine.ts';
import { RedactorError, safeError, type InputInfo, type JobCallbacks, type PreviewLease, type ProcessOptions, type ResultInfo, type InputSelection } from './types.ts';
interface StoredInput {
    file: File;
    info: InputInfo;
}
interface StoredResult {
    info: ResultInfo;
    lease: any;
}
export class RedactorClient {
    private readonly ledger: OwnedLedger;
    private inputs = new Map<string, StoredInput>();
    private results = new Map<string, StoredResult>();
    private active?: {
        controller: AbortController;
        settled: Promise<unknown>;
    };
    private preview?: any;
    private zip?: any;
    private sequence = 0;
    private replacement = 0;
    private disposed = false;
    private readonly runtime: RedactorRuntime;
    constructor(runtime: RedactorRuntime, diagnostics = false) { this.runtime = runtime; this.ledger = new OwnedLedger({ trace: diagnostics }); }
    get capabilities() { return { image: this.runtime.imageSupported, fixedAssetCount: this.runtime.assetCount, fixedAssetBytes: this.runtime.fixedBytes }; }
    /** Numeric resource diagnostics only. It never includes file names, content, or masks. */
    diagnostics() { return this.ledger.snapshot(); }
    cancel() { this.active?.controller.abort(); }
    private releasePreview() { this.ledger.release(this.preview); this.preview = undefined; }
    private run<T>(body: (context: EngineContext) => Promise<T>, callbacks?: JobCallbacks): Promise<T> {
        if (this.disposed)
            return Promise.reject(new RedactorError('not-ready'));
        if (this.active)
            return Promise.reject(new RedactorError('busy'));
        this.releasePreview();
        const controller = new AbortController();
        const owner = 'operation-' + (++this.sequence);
        const abort = () => controller.abort();
        callbacks?.signal?.addEventListener('abort', abort, { once: true });
        if (callbacks?.signal?.aborted)
            controller.abort();
        const context: EngineContext = { runtime: this.runtime, ledger: this.ledger, owner, signal: controller.signal, callbacks };
        const settled = Promise.resolve().then(async () => {
            await checkpoint(context);
            return body(context);
        }).catch(error => {
            if (error instanceof Error && /RESOURCE_LIMIT|ACTUAL_OVER_CAP/.test(error.message))
                throw new RedactorError('limit');
            throw safeError(error);
        }).finally(async () => {
            await this.ledger.settleOwner(owner);
            this.ledger.releaseOwner(owner);
            callbacks?.signal?.removeEventListener('abort', abort);
            this.active = undefined;
        });
        this.active = { controller, settled };
        return settled;
    }
    async setInputs(files: readonly File[]): Promise<InputSelection> {
        files = [...files];
        checkFiles(files);
        const request = ++this.replacement;
        this.cancel();
        await this.active?.settled.catch(() => undefined);
        if (request !== this.replacement || this.disposed)
            throw new RedactorError('cancelled');
        return this.run(async (context) => {
            const next = new Map<string, StoredInput>();
            let totalPages = 0;
            const failures: InputSelection["failures"] = [];
            for (let index = 0; index < files.length; index++) {
                await checkpoint(context);
                const file = files[index];
                const input = await this.ledger.allocate(context.owner, 'inspection-input', 'binary', file.size, async () => new Uint8Array(await file.arrayBuffer()));
                try {
                    const pdf = isPdf(input.value);
                    const pages = [];
                    if (pdf) {
                        await withParsedPdf(input.value, this.ledger, context.owner, inspectPdfStructure);
                        const opened = await this.runtime.open(input.value, this.ledger, context.owner, context.signal);
                        try {
                            for (let pageIndex = 0; pageIndex < opened.document.numPages; pageIndex++) {
                                await checkpoint(context);
                                const view = (await opened.document.getPage(pageIndex + 1)).getViewport({ scale: 1 });
                                if (![view.width, view.height].every(n => Number.isFinite(n) && n > 0))
                                    throw new RedactorError('damaged');
                                pages.push({ width: view.width, height: view.height });
                            }
                        }
                        finally {
                            await opened.close();
                        }
                    }
                    else {
                        if (!this.runtime.imageSupported)
                            throw new RedactorError('unsupported');
                        const size = imageSize(input.value);
                        // Decode once for normalized EXIF dimensions; independent processing will decode again.
                        const canvas = await renderSource(context, input.value, 'image', 0, 150, 'inspection-image');
                        try {
                            if (canvas.value.width * canvas.value.height !== size.width * size.height)
                                throw new RedactorError('damaged');
                            pages.push({ width: canvas.value.width, height: canvas.value.height });
                        }
                        finally {
                            this.ledger.release(canvas);
                        }
                    }
                    totalPages += pages.length;
                    if (totalPages > LIMITS.batchPages)
                        throw new RedactorError('limit');
                    const info: InputInfo = { id: 'file-' + (++this.sequence), index, kind: pdf ? 'pdf' : 'image', pages };
                    next.set(info.id, { file, info });
                }
                catch (error) {
                    if (context.signal.aborted || error instanceof Error && /RESOURCE_LIMIT|ACTUAL_OVER_CAP/.test(error.message))
                        throw error;
                    const failure = safeError(error);
                    if (failure.code === 'limit' || failure.code === 'cancelled')
                        throw failure;
                    failures.push({ index, code: failure.code });
                }
                finally {
                    this.ledger.release(input);
                }
            }
            await checkpoint(context);
            this.inputs = next;
            return { inputs: Array.from(next.values(), value => structuredClone(value.info)), failures };
        });
    }
    async processFile(fileId: string, options: ProcessOptions, callbacks?: JobCallbacks): Promise<ResultInfo> {
        options = structuredClone(options);
        const selected = this.inputs.get(fileId);
        if (!selected)
            throw new RedactorError('unsupported');
        return this.run(async (context) => {
            const input = await this.ledger.allocate(context.owner, 'input-arraybuffer', 'binary', selected.file.size, async () => new Uint8Array(await selected.file.arrayBuffer()));
            const output = await executeFile(context, input, selected.info, options);
            await checkpoint(context);
            const previous = Array.from(this.results.values()).find(result => result.info.fileId === fileId);
            const names = new SafeFileNameRegistry();
            for (const result of this.results.values())
                if (result !== previous)
                    reserveSafeFileName(result.info.name, names);
            const name = previous?.info.name ?? createUniqueSafeFileName(`redacted-${String(selected.info.index + 1).padStart(3, '0')}.${selected.info.kind === 'pdf' ? 'pdf' : 'png'}`, names);
            try {
                if (previous)
                    reserveSafeFileName(name, names);
            }
            catch {
                throw new RedactorError('invalid-name');
            }
            const info: ResultInfo = { id: 'result-' + (++this.sequence), fileId, name, blob: output.lease.value, pages: output.pages, unmaskedPages: output.unmaskedPages };
            this.ledger.reown(output.lease, info.id);
            this.results.set(info.id, { info, lease: output.lease });
            this.ledger.release(this.zip);
            this.zip = undefined;
            if (previous)
                this.dropResult(previous.info.id);
            return { ...info, pages: info.pages.map(page => ({ ...page })), unmaskedPages: [...info.unmaskedPages] };
        }, callbacks);
    }
    renameResult(resultId: string, name: string): ResultInfo {
        if (this.active)
            throw new RedactorError('busy');
        const result = this.results.get(resultId);
        if (!result)
            throw new RedactorError('unsupported');
        const names = new SafeFileNameRegistry();
        try {
            for (const other of this.results.values())
                if (other !== result)
                    reserveSafeFileName(other.info.name, names);
            result.info.name = reserveSafeFileName(name, names);
        }
        catch {
            throw new RedactorError('invalid-name');
        }
        this.ledger.release(this.zip);
        this.zip = undefined;
        return { ...result.info, pages: result.info.pages.map(page => ({ ...page })), unmaskedPages: [...result.info.unmaskedPages] };
    }
    private previewFor(bytes: Blob, kind: 'pdf' | 'image', pageIndex: number, dpi: number, pages: InputInfo['pages']): Promise<PreviewLease> {
        if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pages.length)
            return Promise.reject(new RedactorError('unsupported'));
        dimensions(pages[pageIndex], kind === 'pdf' ? dpi / 72 : 1);
        return this.run(async (context) => {
            const input = await this.ledger.allocate(context.owner, 'preview-arraybuffer', 'binary', bytes.size, async () => new Uint8Array(await bytes.arrayBuffer()));
            const canvas = await renderSource(context, input.value, kind, pageIndex, dpi, 'preview');
            await checkpoint(context);
            this.ledger.reown(canvas, 'preview');
            this.preview = canvas;
            return { canvas: canvas.value, page: { ...pages[pageIndex] }, release: () => {
                    this.ledger.release(canvas);
                    if (this.preview === canvas)
                        this.preview = undefined;
                } };
        });
    }
    renderPreview(fileId: string, pageIndex: number, dpi = 150): Promise<PreviewLease> {
        const input = this.inputs.get(fileId);
        if (!input)
            return Promise.reject(new RedactorError('unsupported'));
        return this.previewFor(input.file, input.info.kind, pageIndex, dpi, input.info.pages);
    }
    renderResultPreview(resultId: string, pageIndex: number, dpi = 150): Promise<PreviewLease> {
        const result = this.results.get(resultId);
        if (!result)
            return Promise.reject(new RedactorError('unsupported'));
        return this.previewFor(result.info.blob, result.info.blob.type === 'application/pdf' ? 'pdf' : 'image', pageIndex, dpi, result.info.pages);
    }
    releaseResult(resultId: string) {
        if (this.active)
            throw new RedactorError("busy");
        this.dropResult(resultId);
    }
    private dropResult(resultId: string) {
        const result = this.results.get(resultId);
        if (result) {
            this.ledger.release(result.lease);
            this.results.delete(resultId);
            this.ledger.release(this.zip);
            this.zip = undefined;
        }
    }
    createZip(callbacks?: JobCallbacks): Promise<Blob> {
        return this.run(async (context) => {
            const results = Array.from(this.results.values());
            if (results.length < 2)
                throw new RedactorError('unsupported');
            const owner = context.owner, ledger = this.ledger;
            const cap = results.reduce((sum, result) => sum + result.info.blob.size, 0) + results.length * 65536 + MiB;
            const reservation = ledger.reserve(owner, 'ZIP-output-cap', 'binary', cap);
            const chunks: any[] = [];
            const sink = new WritableStream<Uint8Array>({ write: chunk => { chunks.push(ledger.bind(reservation, chunk, { label: 'ZIP-output-chunk' })); } });
            const readerFactory = (blob: Blob) => {
                const reader = new Reader<Blob>(blob);
                reader.size = blob.size;
                reader.readUint8Array = async (index, length) => {
                    await checkpoint(context);
                    length = Math.min(length, Math.max(0, blob.size - index));
                    if (length === 0)
                        return new Uint8Array(0);
                    const slice = await ledger.allocate(owner, 'ZIP-reader-Blob-slice', 'binary', length, () => blob.slice(index, index + length));
                    try {
                        const bytes = await ledger.allocate(owner, 'ZIP-reader-arraybuffer', 'binary', length, async () => new Uint8Array(await slice.value.arrayBuffer()));
                        return bytes.value;
                    }
                    finally {
                        ledger.release(slice);
                    }
                };
                return reader;
            };
            const registry = new SafeFileNameRegistry();
            await writeZipArchive(results.map(result => ({ fileName: reserveSafeFileName(result.info.name, registry), blob: result.info.blob })), sink, context.signal, progress => callbacks?.onProgress?.({ phase: 'zip', page: progress.entryIndex, pages: progress.entryCount }), undefined, { useWebWorkers: false, readerFactory });
            ledger.close(reservation);
            await checkpoint(context);
            const size = chunks.reduce((sum, chunk) => sum + chunk.value.byteLength, 0);
            const result = await ledger.allocate(owner, 'published-ZIP-Blob', 'binary', size, () => new Blob(chunks.map(chunk => chunk.value), { type: 'application/zip' }));
            await checkpoint(context);
            const previous = this.zip;
            this.zip = result;
            ledger.reown(result, 'published-zip');
            ledger.release(previous);
            return result.value;
        }, callbacks);
    }
    async dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.replacement++;
        this.cancel();
        await this.active?.settled.catch(() => undefined);
        this.releasePreview();
        for (const id of this.results.keys())
            this.dropResult(id);
        this.ledger.release(this.zip);
        this.zip = undefined;
        this.inputs.clear();
        await this.runtime.dispose();
    }
}
export async function prepareRedactorClient(options: {
    diagnostics?: boolean;
    signal?: AbortSignal;
} = {}): Promise<RedactorClient> {
    const runtime = new RedactorRuntime();
    await runtime.prepare(options.signal);
    return new RedactorClient(runtime, options.diagnostics === true);
}
