import type { GeneratorAttempt, GeneratorDownload, GeneratorLanguage, GeneratorManifestRow, GeneratorPlan, GeneratorResult, GeneratorSelection, GeneratorSnapshot, GeneratorSource, GeneratorTemplate } from './types.ts';
import { GeneratorError, checkAbort, generatorErrorCode } from './errors.ts';
import { mapGeneratorRows } from './mapping.ts';
import { assignGeneratorNames, defaultGeneratorName, nameVariables } from './names.ts';
import { createGeneratorStorage, type GeneratorStorage } from './storage.ts';
import { createGeneratorWorkerBridge, type GeneratorWorkerBridge } from './workerClient.ts';
import type { createIncrementalZipArchiveWriter } from '../../utils/zipArchive.ts';
import { createGeneratorManifest } from './manifest.ts';

interface ResultSet {
  attemptId: number;
  version: number;
  storage: GeneratorStorage;
  results: GeneratorResult[];
  manifest: GeneratorManifestRow[];
  urls: Set<string>;
  zip?: Blob;
}
export interface GeneratorClientDependencies {
  storageFactory?: () => Promise<GeneratorStorage>;
  workerFactory?: () => GeneratorWorkerBridge;
  zipWriterFactory?: typeof createIncrementalZipArchiveWriter;
}
export function createDocumentGeneratorClient(dependencies: GeneratorClientDependencies = {}) {
  const storageFactory = dependencies.storageFactory ?? createGeneratorStorage;
  const bridge = (dependencies.workerFactory ?? createGeneratorWorkerBridge)();
  const listeners = new Set<(snapshot: GeneratorSnapshot) => void>();
  let state: GeneratorSnapshot['state'] = 'idle';
  let sequence = 0;
  let sourceSequence = 0;
  let version = 0;
  let disposed = false;
  let current: ResultSet | undefined;
  let attempt: GeneratorAttempt | undefined;
  let plans = new WeakSet<GeneratorPlan>();
  const retired = new Set<ResultSet>();
  const looseUrls = new Set<string>();
  let active: { controller: AbortController; settled: Promise<void> } | undefined;

  function snapshot(): GeneratorSnapshot {
    return {
      state, version, resultAttemptId: current?.attemptId,
      results: current?.results.map(row => ({...row})) ?? [],
      attempt: attempt ? {...attempt, rows: attempt.rows.map(row => ({...row}))} : undefined,
      zip: current?.zip,
    };
  }
  function emit() { const value = snapshot(); for (const listener of listeners) listener(value); }
  function available() {
    if (disposed) throw new GeneratorError('DISPOSED');
    if (active) throw new GeneratorError('BUSY');
  }
  async function operation<T>(next: GeneratorSnapshot['state'], action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    available();
    const controller = new AbortController();
    let settled!: () => void;
    const job = {controller, settled: new Promise<void>(resolve => { settled = resolve; })};
    active = job; state = next; emit();
    try { return await action(controller.signal); }
    finally {
      bridge.terminate();
      if (active === job) { active = undefined; state = disposed ? 'disposed' : 'idle'; }
      settled(); emit();
    }
  }
  function cancel() {
    if (!active) return;
    state = 'canceling';
    active.controller.abort(); bridge.terminate(); emit();
  }
  async function clearSet(set: ResultSet) {
    for (const url of set.urls) URL.revokeObjectURL(url);
    set.urls.clear(); set.zip = undefined;
    await set.storage.clear();
  }
  async function reset() {
    if (disposed) throw new GeneratorError('DISPOSED');
    cancel(); await active?.settled;
    const sets = [...retired, ...(current ? [current] : [])];
    current = undefined; retired.clear(); attempt = undefined; plans = new WeakSet(); version++;
    for (const url of looseUrls) URL.revokeObjectURL(url);
    looseUrls.clear(); emit();
    await Promise.all(sets.map(clearSet));
  }
  function validatePlan(plan: GeneratorPlan) { if (!plans.has(plan)) throw new GeneratorError('INVALID_SELECTION'); }
  async function inspect(file: File, signal: AbortSignal): Promise<GeneratorTemplate> {
    const buffer = await file.arrayBuffer(); checkAbort(signal);
    const result = await bridge.request({type: 'inspect', buffer}, signal);
    if (result.type !== 'inspect') throw new GeneratorError('DAMAGED_TEMPLATE');
    return {file, variables: Object.freeze([...result.variables])};
  }
  async function render(plan: GeneratorPlan, rowId: string, signal: AbortSignal): Promise<Blob> {
    const row = plan.rows.find(candidate => candidate.id === rowId);
    if (!row || row.error || !row.fileName) throw new GeneratorError(row?.error ?? 'INVALID_SELECTION');
    const buffer = await plan.template.file.arrayBuffer(); checkAbort(signal);
    const result = await bridge.request({type: 'render', buffer, values: row.values}, signal);
    if (result.type !== 'render') throw new GeneratorError('GENERATION_FAILED');
    checkAbort(signal);
    return new Blob([result.buffer], {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }
  function download(blob: Blob, urls = looseUrls): GeneratorDownload {
    const url = URL.createObjectURL(blob); urls.add(url);
    return {blob, url, release() { if (urls.delete(url)) URL.revokeObjectURL(url); }};
  }

  return {
    snapshot,
    subscribe(listener: (value: GeneratorSnapshot) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    cancel,
    /** Mandatory on file replacement/unmount. Cancels, awaits pending writes, then clears every owned result. */
    reset,
    async loadSources(files: readonly File[]): Promise<GeneratorSource[]> {
      return operation('preparing', async signal => {
        const sources: GeneratorSource[] = [];
        for (const file of files) {
          const buffer = await file.arrayBuffer(); checkAbort(signal);
          const result = await bridge.request({type: 'parse', buffer, fileName: file.name}, signal);
          if (result.type !== 'parse') throw new GeneratorError('DAMAGED_DATA');
          sources.push({id: `source-${++sourceSequence}`, fileName: file.name, book: result.book});
        }
        return sources;
      });
    },
    inspectTemplate(file: File) { return operation('preparing', signal => inspect(file, signal)); },
    async prepare(file: File, selections: readonly GeneratorSelection[], pattern = defaultGeneratorName): Promise<GeneratorPlan> {
      return operation('preparing', async signal => {
        const template = await inspect(file, signal);
        const variables = [...new Set([...template.variables, ...nameVariables(pattern)])];
        const rows = assignGeneratorNames(mapGeneratorRows(selections, variables), pattern);
        const plan: GeneratorPlan = Object.freeze({template: Object.freeze(template), rows: Object.freeze(rows.map(row => Object.freeze({...row, values: Object.freeze({...row.values})})))});
        plans.add(plan); return plan;
      });
    },
    sample(plan: GeneratorPlan, rowId = plan.rows.find(row => !row.error)?.id ?? '') {
      validatePlan(plan);
      return operation('preparing', async signal => download(await render(plan, rowId, signal)));
    },
    async generate(plan: GeneratorPlan): Promise<GeneratorAttempt> {
      validatePlan(plan);
      return operation('generating', async signal => {
        const id = ++sequence;
        const rows: GeneratorManifestRow[] = plan.rows.map(row => ({id: row.id, sourceId: row.sourceId, sourceFile: row.sourceFile, sheet: row.sheet, row: row.row,
          fileName: row.fileName ?? '', status: row.error ? 'failed' : 'not-started', error: row.error, bytes: 0}));
        attempt = {id, rows}; emit();
        let next: ResultSet | undefined;
        let committed = false;
        try {
          const storage = await storageFactory();
          next = {attemptId: id, version: version + 1, storage, results: [], manifest: rows, urls: new Set()};
          checkAbort(signal);
          attempt = {id, rows, storageKind: storage.kind, fallback: storage.fallback}; emit();
          for (let index = 0; index < plan.rows.length; index++) {
            const row = plan.rows[index]; const item = rows[index];
            checkAbort(signal);
            if (row.error) continue;
            let written = false;
            let writing = false;
            try {
              const blob = await render(plan, row.id, signal);
              checkAbort(signal);
              writing = true;
              await storage.write(row.id, blob);
              written = true;
              // Storage's noncancelable producer settled before any current-row ownership is released.
              checkAbort(signal);
              if (attempt.id !== id || disposed) throw new GeneratorError('CANCELED');
              const result: GeneratorResult = {id: `${id}:${row.id}`, sourceId: row.sourceId, sourceFile: row.sourceFile, sheet: row.sheet, row: row.row, fileName: row.fileName!, bytes: blob.size};
              if (!committed) {
                if (current) retired.add(current);
                current = next; version++; current.version = version; committed = true;
              }
              next.results.push(result); item.status = 'success'; item.bytes = blob.size;
              emit();
            } catch (error) {
              if (written) await storage.remove(row.id);
              const code = signal.aborted ? 'CANCELED' : generatorErrorCode(error, writing ? 'STORAGE_WRITE' : 'GENERATION_FAILED');
              item.error = code; item.status = code === 'CANCELED' ? 'canceled' : 'failed';
              if (code === 'CANCELED') throw new GeneratorError(code);
              if (writing || code === 'STORAGE_LIMIT' || code === 'STORAGE_WRITE') break;
            }
          }
        } catch (error) {
          const code = signal.aborted ? 'CANCELED' : generatorErrorCode(error, 'STORAGE_WRITE');
          for (const row of rows) if (row.status === 'not-started') { row.error = code; if (code === 'CANCELED') row.status = 'canceled'; }
        } finally {
          if (next && !committed) await next.storage.clear();
          emit();
        }
        return {...attempt, rows: rows.map(row => ({...row}))};
      });
    },
    /** Invoke from the UI's post-commit effect after links from the old snapshot were removed. */
    async acknowledgeResults(committedVersion: number) {
      if (committedVersion !== version) return;
      const old = [...retired].filter(set => set.version < committedVersion);
      old.forEach(set => retired.delete(set));
      await Promise.all(old.map(clearSet));
    },
    async readResult(id: string): Promise<GeneratorDownload> {
      if (disposed) throw new GeneratorError('DISPOSED');
      const set = current;
      const result = set?.results.find(row => row.id === id);
      if (!set || !result) throw new GeneratorError('NO_RESULTS');
      const blob = await set.storage.read(id.slice(id.indexOf(':') + 1));
      if (current !== set || disposed) throw new GeneratorError('CANCELED');
      return download(blob, set.urls);
    },
    async exportZip(): Promise<GeneratorDownload> {
      return operation('exporting', async signal => {
        const set = current;
        if (!set || set.results.length < 2) throw new GeneratorError('NO_RESULTS');
        const [{BlobWriter}, {createIncrementalZipArchiveWriter}] = await Promise.all([import('@zip.js/zip.js'), import('../../utils/zipArchive.ts')]);
        checkAbort(signal);
        const sink = new BlobWriter('application/zip');
        const writer = (dependencies.zipWriterFactory ?? createIncrementalZipArchiveWriter)(sink, signal, {useWebWorkers: false});
        try {
          for (const result of set.results) {
            checkAbort(signal);
            const blob = await set.storage.read(result.id.slice(result.id.indexOf(':') + 1));
            checkAbort(signal);
            await writer.add(result.fileName, blob);
          }
          const blob = await writer.close() as Blob;
          checkAbort(signal);
          if (disposed || current !== set) throw new GeneratorError('CANCELED');
          set.zip = blob; emit();
          return download(blob, set.urls);
        } catch (error) {
          await writer.discard();
          throw new GeneratorError(signal.aborted ? 'CANCELED' : generatorErrorCode(error, 'EXPORT_FAILED'));
        }
      });
    },
    exportManifest(language: GeneratorLanguage, which: 'attempt' | 'results' = 'attempt') {
      return operation('exporting', async signal => {
        const rows = which === 'results' ? current?.manifest : attempt?.rows;
        if (!rows) throw new GeneratorError('NO_RESULTS');
        const blob = await createGeneratorManifest(rows, language);
        checkAbort(signal); return download(blob);
      });
    },
    async dispose() {
      if (disposed) return;
      disposed = true; cancel(); await active?.settled;
      bridge.terminate();
      for (const url of looseUrls) URL.revokeObjectURL(url);
      looseUrls.clear();
      const sets = [...retired, ...(current ? [current] : [])];
      current = undefined; retired.clear(); attempt = undefined; plans = new WeakSet(); state = 'disposed';
      await Promise.all(sets.map(clearSet)); emit(); listeners.clear();
    },
  };
}
