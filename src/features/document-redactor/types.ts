export type RedactorDpi = 150 | 200 | 300;
export interface MaskRect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface PageSize {
    width: number;
    height: number;
}
export interface InputInfo {
    id: string;
    index: number;
    kind: 'pdf' | 'image';
    pages: PageSize[];
}
export interface ProcessOptions {
    dpi: RedactorDpi;
    masksByPage: Readonly<Record<number, readonly MaskRect[]>>;
}
export type ErrorCode = 'cancelled' | 'busy' | 'unsupported' | 'damaged' | 'encrypted' | 'xfa' | 'dimensions' | 'limit' | 'no-masks' | 'invalid-masks' | 'verification' | 'not-ready' | 'invalid-name';
export class RedactorError extends Error {
    readonly code: ErrorCode;
    constructor(code: ErrorCode) { super(code); this.code = code; this.name = 'RedactorError'; }
}
export interface ResultInfo {
    id: string;
    fileId: string;
    name: string;
    blob: Blob;
    pages: PageSize[];
    unmaskedPages: number[];
}
/** Client owns canvas. Consumer must call release when hidden; any processing/new preview/dispose also invalidates it. Never resize it. */
export interface PreviewLease {
    canvas: HTMLCanvasElement;
    page: PageSize;
    release(): void;
}
export interface Progress {
    phase: 'reading' | 'rendering' | 'encoding' | 'verifying' | 'saving' | 'zip';
    page: number;
    pages: number;
}
export interface JobCallbacks {
    signal?: AbortSignal;
    onProgress?: (progress: Progress) => void;
}
export function safeError(error: unknown): RedactorError {
    if (error instanceof RedactorError)
        return error;
    if (error instanceof DOMException && error.name === 'AbortError')
        return new RedactorError('cancelled');
    return new RedactorError('damaged');
}
export interface InputSelection {
    inputs: InputInfo[];
    failures: Array<{
        index: number;
        code: ErrorCode;
    }>;
}
