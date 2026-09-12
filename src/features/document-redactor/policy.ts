import { OwnedLedger, MiB } from './ledger.ts';
import { RedactorError, type PageSize } from './types.ts';
export function dimensions(size: PageSize, scale: number) {
    const width = Math.ceil(size.width * scale), height = Math.ceil(size.height * scale);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 4096 ** 2)
        throw new RedactorError('dimensions');
    return { width, height };
}
export function earlyAdmission(context: {
    ledger: OwnedLedger;
    owner: string;
}, size: PageSize, pdf: boolean) {
    const { ledger, owner } = context;
    const raw = 4 * size.width * size.height;
    for (const [label, kind, bytes] of [
        ['PNG-early-admission', 'binary', 2 * raw + MiB],
        ['comparison-early-admission', 'raw', 2 * raw + 8 * size.width * Math.min(32, size.height)],
        ...(pdf ? [['embed-scratch-early-admission', 'raw', 4 * raw + MiB]] : []),
    ] as const) {
        const reservation = ledger.reserve(owner, label as string, kind as 'binary' | 'raw', bytes as number);
        ledger.close(reservation);
    }
}
