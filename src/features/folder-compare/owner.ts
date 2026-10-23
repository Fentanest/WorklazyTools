import { Admission, FolderRun, fileSource, pairEntries } from './core.ts';
import type { FolderEntry, FolderRow, FolderSource, MatchOptions } from './core.ts';
import { directorySource, type ReadonlyDirectory } from './directory.ts';
import { zipSource } from './zip.ts';
export type SourceInput = { kind: 'files'; files: File[] } | { kind: 'zip'; file: File } | { kind: 'directory'; handle: ReadonlyDirectory };
export interface EntryView { id: string; path: string; size: number; directory: boolean; issue?: string }
export interface RowView { key: string; left: EntryView[]; right: EntryView[]; pairing: FolderRow['pairing']; content: FolderRow['content']; integrity: FolderRow['integrity']; reason?: string }
export interface FolderView { revision: number; phase: 'loading' | 'comparing' | 'done' | 'canceled' | 'error'; rows: RowView[]; warnings: string[]; completed: number; total: number }
export const entryView = (e: FolderEntry): EntryView => ({ id: e.id, path: e.rawPath, size: e.size, directory: e.directory, issue: e.issue });
export const rowView = (r: FolderRow): RowView => ({ key: r.key, left: r.left.map(entryView), right: r.right.map(entryView), pairing: r.pairing, content: r.content, integrity: r.integrity, reason: r.reason });
/** Runs in one dedicated worker. Jobs and source disposal share the same ownership queue. */
export class FolderOwner {
  private revision = 0;
  private controller?: AbortController;
  private run = new FolderRun();
  private tail: Promise<void> = Promise.resolve();
  private sources: FolderSource[] = [];
  private canceled = false;
  cancel() { this.canceled = true; this.controller?.abort(); this.run.cancel(); }
  async clear(revision: number) {
    this.revision = revision; this.cancel(); this.run.invalidate();
    const work = this.tail.catch(() => {}).then(() => this.closeSources());
    this.tail = work; await work;
  }
  private async closeSources() { const sources = this.sources; this.sources = []; await Promise.allSettled(sources.map(s => s.close())); }
  compare(revision: number, left: SourceInput, right: SourceInput, options: MatchOptions, emit: (view: FolderView) => void): Promise<void> {
    this.revision = revision; this.cancel(); this.run.invalidate();
    const control = new AbortController(); this.controller = control; this.canceled = false;
    const current = () => revision === this.revision;
    const work = this.tail.catch(() => {}).then(async () => {
      if (!current()) return;
      await this.closeSources(); if (!current()) return;
      const admission = new Admission(); let rows: FolderRow[] = [], warnings: string[] = [], last = 0;
      const publish = (phase: FolderView['phase'], force = false) => {
        if (!current() || (!force && performance.now() - last < 120)) return;
        last = performance.now();
        emit({ revision, phase, rows: rows.map(rowView), warnings, completed: rows.filter(r => r.content !== 'pending').length, total: rows.length });
      };
      const load = async (input: SourceInput, side: string): Promise<FolderSource> => {
        const id = `${revision}:${side}`;
        if (input.kind === 'zip') return zipSource(input.file, id, admission, control.signal);
        if (input.kind === 'directory') return directorySource(input.handle, id, admission, control.signal);
        control.signal.throwIfAborted(); return fileSource(input.files, id, admission);
      };
      try {
        publish('loading', true);
        const a = await load(left, 'left'); this.sources.push(a);
        control.signal.throwIfAborted();
        const b = await load(right, 'right'); this.sources.push(b);
        control.signal.throwIfAborted(); if (!current()) return;
        warnings = [...new Set([...a.warnings, ...b.warnings])];
        // ZIP root stripping is a ZIP view option; FileList and DirectoryHandle already omit their selected root.
        const strip = (entries: readonly FolderEntry[], input: SourceInput) => input.kind === 'zip' && options.stripRoot
          ? entries.map(e => ({ ...e, rawPath: e.rawPath.split('/').slice(1).join('/') || e.rawPath })) : entries;
        // Matching views retain immutable entry identities and originals in result rows.
        const keys = pairEntries(strip(a.entries, left), strip(b.entries, right), { ...options, stripRoot: false });
        const originals = new Map([...a.entries, ...b.entries].map(e => [e.id, e]));
        rows = keys.map(r => ({ ...r, left: r.left.map(e => originals.get(e.id)!), right: r.right.map(e => originals.get(e.id)!) }));
        publish('comparing', true);
        await this.run.compare(rows, () => publish('comparing'));
        publish(control.signal.aborted || this.canceled ? 'canceled' : 'done', true);
      } catch {
        if (current()) publish(control.signal.aborted ? 'canceled' : 'error', true);
        await this.closeSources();
      } finally { if (current()) this.controller = undefined; }
    });
    this.tail = work; return work;
  }
}
