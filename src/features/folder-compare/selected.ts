import { checkAbort, compareBytes } from './core.ts';
import type { FolderEntry, FolderRow } from './core.ts';
export class ReadWork {
  bytes = 0; comparisons = 0;
  readonly limit: number; readonly comparisonLimit: number;
  constructor(limit = 3 * 1024 ** 3, comparisonLimit = 10000) { this.limit = limit; this.comparisonLimit = comparisonLimit; }
  ensure(bytes: number) { if (this.bytes + bytes > this.limit) throw new Error('reread-limit'); }
  add(bytes: number) { this.bytes += bytes; if (this.bytes > this.limit) throw new Error('reread-limit'); }
  comparison() { if (++this.comparisons > this.comparisonLimit) throw new Error('reread-limit'); }
}
/** Delegating reader adds no buffers; logical admission is never charged again. */
export function counted(entry: FolderEntry, work: ReadWork): FolderEntry {
  return { ...entry, open(signal) {
    const opened = entry.open(signal), source = opened.reader;
    return { ...opened, reader: { get closed() { return source.closed; }, cancel: reason => source.cancel(reason), releaseLock: () => source.releaseLock(),
      read: async () => { const next = await source.read(); if (next.value) work.add(next.value.byteLength); return next; } } };
  } };
}
export async function materialize(entry: FolderEntry, limit: number, work: ReadWork, signal: AbortSignal): Promise<File> {
  checkAbort(signal);
  if (entry.issue || entry.directory || entry.size > limit || ![4 * 1024 ** 2, 16 * 1024 ** 2].includes(limit)) throw new Error('selected-limit');
  work.ensure(entry.size);
  const opened = counted(entry, work).open(signal); opened.done.catch(() => {});
  const failed = opened.done.then(() => new Promise<never>(() => {})); failed.catch(() => {});
  const chunks: BlobPart[] = []; let total = 0;
  try {
    while (true) {
      checkAbort(signal); const next = await Promise.race([opened.reader.read(), failed]);
      if (next.done) break;
      total += next.value.length; if (total > entry.size || total > limit) throw new Error('selected-limit');
      chunks.push(next.value as Uint8Array<ArrayBuffer>);
    }
    await opened.done; checkAbort(signal);
    if (total !== entry.size) throw new Error('expanded-size-mismatch');
    return new File(chunks, entry.rawPath.split('/').at(-1) || 'file');
  } finally { await opened.close(); }
}
export interface RenameGroup { left: string[]; right: string[] }
export interface RenameResult { groups: RenameGroup[]; state: 'complete' | 'limited' | 'canceled'; unreadable: string[]; readBytes: number }
async function fingerprint(entry: FolderEntry, work: ReadWork, signal: AbortSignal) {
  work.ensure(entry.size);
  const opened = counted(entry, work).open(signal); opened.done.catch(() => {});
  const failed = opened.done.then(() => new Promise<never>(() => {})); failed.catch(() => {});
  let hash = 2166136261, total = 0, turns = 0;
  try {
    while (true) {
      checkAbort(signal); const next = await Promise.race([opened.reader.read(), failed]); if (next.done) break;
      total += next.value.length; if (total > entry.size) throw new Error('expanded-size-mismatch');
      for (const byte of next.value) hash = Math.imul(hash ^ byte, 16777619);
      if (++turns % 16 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    await opened.done; checkAbort(signal); if (total !== entry.size) throw new Error('expanded-size-mismatch');
    return `${total}:${hash >>> 0}`;
  } finally { await opened.close(); }
}
/** Fingerprints only narrow candidates. Every member is byte-verified against its group representative. */
export async function renameCandidates(rows: FolderRow[], work: ReadWork, signal: AbortSignal): Promise<RenameResult> {
  const result: RenameResult = { groups: [], state: 'complete', unreadable: [], readBytes: work.bytes };
  const left = rows.filter(r => r.pairing === 'left-only').flatMap(r => r.left).filter(e => !e.directory && !e.issue);
  const right = rows.filter(r => r.pairing === 'right-only').flatMap(r => r.right).filter(e => !e.directory && !e.issue);
  const sizes = new Set(right.map(e => e.size)), leftSizes = new Set(left.map(e => e.size));
  let turns = 0;
  const buckets = new Map<string, { entry: FolderEntry; side: 'left' | 'right' }[]>();
  try {
    for (const side of ['left', 'right'] as const) for (const entry of (side === 'left' ? left : right)) {
      if (++turns % 32 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      if (!(side === 'left' ? sizes : leftSizes).has(entry.size)) continue;
      try { const key = await fingerprint(entry, work, signal); const list = buckets.get(key) ?? []; list.push({ entry, side }); buckets.set(key, list); }
      catch (error) { if (signal.aborted || error instanceof Error && error.message === 'reread-limit') throw error; result.unreadable.push(entry.id); }
    }
    for (const bucket of buckets.values()) {
      const groups: { representative: FolderEntry; left: string[]; right: string[] }[] = [];
      for (const item of bucket) {
        if (++turns % 32 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        checkAbort(signal); let found = false;
        for (const group of groups) {
          work.comparison(); work.ensure(group.representative.size + item.entry.size);
          const verified = await compareBytes(counted(group.representative, work), counted(item.entry, work), signal);
          if (verified.equal) { group[item.side].push(item.entry.id); found = true; break; }
        }
        if (!found) groups.push({ representative: item.entry, left: item.side === 'left' ? [item.entry.id] : [], right: item.side === 'right' ? [item.entry.id] : [] });
      }
      result.groups.push(...groups.filter(g => g.left.length && g.right.length).map(g => ({ left: g.left, right: g.right })));
    }
  } catch { result.state = signal.aborted ? 'canceled' : 'limited'; }
  result.readBytes = work.bytes; return result;
}
