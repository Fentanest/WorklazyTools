/** Read-only snapshots. Matching never mutates identity or raw paths. */
export const LIMITS = Object.freeze({ entries: 50_000, logical: 1024 ** 3, entry: 256 * 1024 ** 2,
  archive: 1024 ** 3, allocation: 2 * 1024 ** 2, chunk: 1024 ** 2 });
export type ContentState = 'pending' | 'equal' | 'different' | 'unreadable' | 'canceled' | 'unknown';
export type Integrity = 'pending' | 'verified' | 'failed' | 'unchecked';
export interface OpenedBytes { reader: ReadableStreamDefaultReader<Uint8Array>; done: Promise<void>; close(): Promise<void> }
export interface FolderEntry {
  readonly id: string; readonly rawPath: string; readonly rawFilename?: Uint8Array;
  readonly size: number; readonly directory: boolean; readonly issue?: string;
  open(signal: AbortSignal): OpenedBytes;
}
export interface FolderSource { readonly entries: readonly FolderEntry[]; readonly warnings: readonly string[]; close(): Promise<void> }
export interface MatchOptions { nfc?: boolean; ignoreCase?: boolean; stripRoot?: boolean }
export interface FolderRow { key: string; left: FolderEntry[]; right: FolderEntry[];
  pairing: 'matched' | 'left-only' | 'right-only' | 'ambiguous'; content: ContentState; integrity: Integrity; reason?: string }
export function checkAbort(signal: AbortSignal) { signal.throwIfAborted(); }
export function validSize(size: number) { return Number.isSafeInteger(size) && size >= 0; }
export function pathIssue(path: string): string | undefined {
  if (!path || path.includes('\0') || path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) return 'unsafe-path';
  const parts = path.replace(/\/$/, '').split('/');
  if (parts.some(p => !p || p === '.' || p === '..')) return 'unsafe-path';
}
/** Entire-job admission, shared by both source adapters. No rereads charged as logical data. */
export class Admission {
  entries = 0; logical = 0;
  add(size: number) {
    if (!validSize(size) || size > LIMITS.entry || this.entries + 1 > LIMITS.entries || this.logical + size > LIMITS.logical) throw new Error('folder-limit');
    this.entries++; this.logical += size;
  }
}
export function fileSource(files: readonly File[], revision: string, admission: Admission): FolderSource {
  const entries = files.map((file, ordinal): FolderEntry => {
    admission.add(file.size);
    // webkitRelativePath contains exactly one selected root component.
    const path = file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name;
    return Object.freeze({ id: `${revision}:files:${ordinal}`, rawPath: path, size: file.size, directory: false,
      issue: pathIssue(path), open: (signal: AbortSignal) => blobBytes(file, signal) });
  });
  return { entries: Object.freeze(entries), warnings: ['snapshot-only', 'empty-directories-and-metadata-unavailable'], close: async () => {} };
}
export function blobBytes(blob: Blob, signal: AbortSignal): OpenedBytes {
  let position = 0, closed = false;
  let pendingRead: Promise<void> = Promise.resolve(), closing: Promise<void> | undefined;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) {
    pendingRead = (async () => {
      try {
        checkAbort(signal); if (position === blob.size) { controller.close(); return; }
        const length = Math.min(LIMITS.chunk, blob.size - position);
        const bytes = new Uint8Array(await blob.slice(position, position + length).arrayBuffer());
        checkAbort(signal);
        if (bytes.length !== length) throw new Error('blob-short-read');
        if (closed) return;
        position += bytes.length; controller.enqueue(bytes);
      } catch (error) { if (!closed) controller.error(error); }
    })();
    return pendingRead;
  } }, { highWaterMark: 0 });
  const reader = stream.getReader();
  return { reader, done: Promise.resolve(), close: () => {
    if (!closing) {
      closed = true;
      closing = (async () => {
        await reader.cancel().catch(() => {});
        // Blob reads cannot be interrupted by AbortSignal or stream cancellation.
        await pendingRead; reader.releaseLock();
      })();
    }
    return closing;
  } };
}
export function pairEntries(left: readonly FolderEntry[], right: readonly FolderEntry[], options: MatchOptions = {}): FolderRow[] {
  const rows = new Map<string, FolderRow>();
  for (const [side, entries] of [['left', left], ['right', right]] as const) {
    for (const entry of entries) {
      let key = entry.rawPath.replace(/\/$/, '');
      if (options.stripRoot) key = key.split('/').slice(1).join('/');
      if (options.nfc) key = key.normalize('NFC');
      if (options.ignoreCase) key = key.toLowerCase();
      let row = rows.get(key);
      if (!row) { row = { key, left: [], right: [], pairing: 'matched', content: 'pending', integrity: 'pending' }; rows.set(key, row); }
      row[side].push(entry);
    }
  }
  for (const row of rows.values()) {
    const issues = [...row.left, ...row.right].map(e => e.issue).filter(Boolean);
    if (row.left.length > 1 || row.right.length > 1 || (row.left[0] && row.right[0] && row.left[0].directory !== row.right[0].directory)) {
      row.pairing = 'ambiguous'; row.content = 'unknown'; row.reason = 'path-collision';
    } else if (!row.left.length || !row.right.length) { row.pairing = row.left.length ? 'left-only' : 'right-only'; row.content = 'unknown'; }
    if (issues.length) { row.content = 'unreadable'; row.reason = issues.join(','); }
    if (row.left[0]?.directory || row.right[0]?.directory) { row.content = 'unknown'; row.reason ??= 'directory-metadata-unavailable'; }
  }
  return [...rows.values()];
}
/** Reads independent chunk boundaries and drains both inputs before declaring integrity verified. */
export async function compareBytes(left: FolderEntry, right: FolderEntry, signal: AbortSignal): Promise<{ equal: boolean; integrity: Integrity }> {
  checkAbort(signal);
  const a = left.open(signal); a.done.catch(() => {}); let b: OpenedBytes | undefined;
  try {
    b = right.open(signal);
    // Attach rejection handlers immediately; extraction can fail before its consumer reaches EOF.
    const settled = Promise.all([a.done, b.done]); settled.catch(() => {});
    const failed = settled.then(() => new Promise<never>(() => {})); failed.catch(() => {});
    let ac = new Uint8Array(0), bc = new Uint8Array(0), ai = 0, bi = 0, ae = false, be = false;
    let an = 0, bn = 0, turns = 0, equal = left.size === right.size;
    while (!ae || !be || ai < ac.length || bi < bc.length) {
      if (++turns % 16 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      checkAbort(signal);
      if (ai === ac.length && !ae) { const next = await Promise.race([a.reader.read(), failed]); ae = !!next.done; ac = next.value ?? new Uint8Array(0); ai = 0; an += ac.length; }
      if (bi === bc.length && !be) { const next = await Promise.race([b.reader.read(), failed]); be = !!next.done; bc = next.value ?? new Uint8Array(0); bi = 0; bn += bc.length; }
      if (an > left.size || bn > right.size || an > LIMITS.entry || bn > LIMITS.entry) throw new Error('expanded-size-mismatch');
      const length = Math.min(ac.length - ai, bc.length - bi);
      for (let i = 0; i < length; i++) if (ac[ai + i] !== bc[bi + i]) equal = false;
      ai += length; bi += length;
      if (ae && ai === ac.length) { if (bi < bc.length) equal = false; bi = bc.length; }
      if (be && bi === bc.length) { if (ai < ac.length) equal = false; ai = ac.length; }
    }
    await settled; checkAbort(signal);
    if (an !== left.size || bn !== right.size) throw new Error('expanded-size-mismatch');
    return { equal, integrity: 'verified' };
  } finally { await Promise.all([a.close(), b?.close()]); }
}
/** Serial ownership bounds buffers and prevents an obsolete run from committing results. */
export class FolderRun {
  private generation = 0;
  private controller?: AbortController;
  private tail: Promise<void> = Promise.resolve();
  cancel() { this.controller?.abort(); }
  invalidate() { this.generation++; this.cancel(); }
  async compare(rows: FolderRow[], update: (rows: FolderRow[]) => void) {
    this.invalidate(); const generation = this.generation; const controller = new AbortController(); this.controller = controller;
    const previous = this.tail;
    const work = previous.catch(() => {}).then(async () => {
      // Queued replacements can be superseded without ever opening a source.
      if (generation !== this.generation) return;
      let processed = 0;
      for (const row of rows) {
        if (++processed % 32 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        if (generation !== this.generation) return;
        if (row.pairing !== 'matched' || row.content !== 'pending') continue;
        if (controller.signal.aborted) { row.content = 'canceled'; row.integrity = 'unchecked'; continue; }
        try { const result = await compareBytes(row.left[0], row.right[0], controller.signal);
          if (generation !== this.generation) return;
          row.content = result.equal ? 'equal' : 'different'; row.integrity = result.integrity;
        } catch { if (generation !== this.generation) return; row.content = controller.signal.aborted ? 'canceled' : 'unreadable'; row.integrity = controller.signal.aborted ? 'unchecked' : 'failed'; }
        if (generation === this.generation) update([...rows]);
      }
      if (generation === this.generation) { this.controller = undefined; update([...rows]); }
    });
    this.tail = work;
    return work;
  }
}
