export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export interface ReportRow { readonly id: string; readonly status: string; readonly left: string; readonly right: string; readonly coordinates?: Json; readonly metadata?: Json }
export interface ReportView { readonly width: number; readonly height: number; readonly alpha: 'preserved' | 'flattened'; readonly background?: string; readonly renderOptions: Json }
export interface ExportSnapshot {
  readonly schema: 1; readonly language: 'ko' | 'en'; readonly id: string; readonly tool: string; readonly createdAt: string;
  readonly sources: readonly { readonly id: string; readonly revision: string; readonly label: string }[];
  readonly appliedOptions: Json; readonly coordinates: Json; readonly warnings: readonly string[];
  readonly completion: 'complete' | 'partial' | 'canceled';
  readonly scope: { readonly kind: 'all' | 'selected'; readonly ids?: readonly string[]; readonly label?: string };
  readonly rows: readonly ReportRow[]; readonly rawSources?: { readonly left: string; readonly right: string }; readonly view?: ReportView;
}
export const REPORT_LIMITS = Object.freeze({ rows: 50000, textBytes: 16 * 1024 ** 2, metadataBytes: 1024 ** 2, outputBytes: 64 * 1024 ** 2, xlsxRows: 10000, xlsxCellUnits: 32767, pdfPages: 500, pngPixels: 8_000_000 });
const ownedSnapshots = new WeakSet<object>();
export function assertSnapshot(snapshot: ExportSnapshot) { assertReport(ownedSnapshots.has(snapshot), 'REPORT_INVALID_SNAPSHOT'); }
export class ReportError extends Error { constructor(code: string) { super(code); this.name = 'ReportError'; } }
export function assertReport(condition: unknown, code: string): asserts condition { if (!condition) throw new ReportError(code); }
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter(k=>(value as Record<string,unknown>)[k]!==undefined).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(value);
}
function jsonStringBytes(value:string,remaining:number){let bytes=2;for(let i=0;i<value.length;i++){const c=value.charCodeAt(i),next=value.charCodeAt(i+1);if(c<32)bytes+=[8,9,10,12,13].includes(c)?2:6;else if(c===34||c===92)bytes+=2;else if(c<128)bytes++;else if(c<2048)bytes+=2;else if(c>=0xd800&&c<=0xdbff&&next>=0xdc00&&next<=0xdfff){bytes+=4;i++;}else bytes+=c>=0xd800&&c<=0xdfff?6:3;assertReport(bytes<=remaining,'REPORT_LIMIT');}return bytes;}
function validateJson(value: unknown, depth = 0, seen = new Set<object>(), budget = { nodes: 0, bytes: 0 }): void {
  assertReport(++budget.nodes <= 1_000_000, 'REPORT_LIMIT');
  assertReport(depth <= 20, 'REPORT_LIMIT');
  if(typeof value==='string'){assertReport(value.length<=REPORT_LIMITS.textBytes,'REPORT_LIMIT');budget.bytes+=jsonStringBytes(value,REPORT_LIMITS.textBytes-budget.bytes);assertReport(budget.bytes<=REPORT_LIMITS.textBytes,'REPORT_LIMIT');return;}
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { assertReport(Number.isFinite(value), 'REPORT_INVALID_SNAPSHOT'); return; }
  assertReport(!!value && typeof value === 'object' && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype), 'REPORT_INVALID_SNAPSHOT');
  assertReport(!seen.has(value), 'REPORT_INVALID_SNAPSHOT'); seen.add(value);
  if(Array.isArray(value)){for(const item of value)validateJson(item,depth+1,seen,budget);}
  else for(const [key,item]of Object.entries(value)){if(item===undefined)continue;budget.bytes+=jsonStringBytes(key,REPORT_LIMITS.textBytes-budget.bytes);validateJson(item,depth+1,seen,budget);}
  seen.delete(value);
}
function freeze<T>(value:T,seen=new Set<object>()):T{if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);Object.values(value).forEach(item=>freeze(item,seen));Object.freeze(value);}return value;}
export function reportMetadata(snapshot: ExportSnapshot) {
  const { rows, rawSources, ...metadata } = snapshot;
  return { ...metadata, rowCount: rows.length, rawSourcesAvailable: !!rawSources };
}
/** Freezes existing results only: selection is an explicit projection, never another comparison. */
export function createExportSnapshot(input: Omit<ExportSnapshot, 'schema' | 'id' | 'createdAt' | 'scope' | 'language'> & { language?: 'ko' | 'en'; id?: string; scope?: ExportSnapshot['scope'] }): ExportSnapshot {
  assertReport(Array.isArray(input.rows)&&input.rows.length<=REPORT_LIMITS.rows&&Array.isArray(input.sources)&&input.sources.length<=REPORT_LIMITS.rows,'REPORT_LIMIT');
  const keys=(value:object,allowed:string[])=>assertReport(Object.keys(value).every(k=>allowed.includes(k)),'REPORT_INVALID_SNAPSHOT');
  keys(input,['language','id','tool','sources','appliedOptions','coordinates','warnings','completion','scope','rows','rawSources','view']);
  input.rows.forEach(r=>keys(r,['id','status','left','right','coordinates','metadata']));input.sources.forEach(s=>keys(s,['id','revision','label']));
  if(input.rawSources){keys(input.rawSources,['left','right']);assertReport(typeof input.rawSources.left==='string'&&typeof input.rawSources.right==='string','REPORT_INVALID_SNAPSHOT');}
  if(input.scope)keys(input.scope,['kind','ids','label']);if(input.view)keys(input.view,['width','height','alpha','background','renderOptions']);
  const prepared = { ...input, language: input.language ?? 'ko', schema: 1 as const, id: input.id ?? globalThis.crypto?.randomUUID?.() ?? `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, createdAt: new Date().toISOString(), scope: input.scope ?? { kind: 'all' as const } };
  assertReport(['ko','en'].includes(prepared.language),'REPORT_INVALID_SNAPSHOT'); assertReport(prepared.rows.length <= REPORT_LIMITS.rows, 'REPORT_LIMIT');
  assertReport(['complete', 'partial', 'canceled'].includes(prepared.completion), 'REPORT_INVALID_SNAPSHOT');
  assertReport(prepared.sources.every(s => [s.id,s.revision,s.label].every(v=>typeof v==='string')) && prepared.rows.every(r=>[r.id,r.status,r.left,r.right].every(v=>typeof v==='string')) && prepared.warnings.every(w=>typeof w==='string') && typeof prepared.tool==='string', 'REPORT_INVALID_SNAPSHOT');
  const ids = new Set(prepared.rows.map(r => r.id)); assertReport(ids.size === prepared.rows.length, 'REPORT_INVALID_SNAPSHOT');
  if (prepared.scope.kind === 'selected') {
    assertReport(!prepared.rawSources,'REPORT_INVALID_SCOPE');
    assertReport(prepared.scope.ids?.length && new Set(prepared.scope.ids).size === prepared.scope.ids.length && prepared.scope.ids.every(id => ids.has(id)), 'REPORT_INVALID_SCOPE');
    const selected = new Set(prepared.scope.ids); prepared.rows = prepared.rows.filter(r => selected.has(r.id));
  } else assertReport(prepared.scope.kind === 'all' && !prepared.scope.ids, 'REPORT_INVALID_SCOPE');
  validateJson(prepared);
  const snapshot = structuredClone(prepared) as ExportSnapshot;
  const encoder = new TextEncoder();
  assertReport(encoder.encode(JSON.stringify(snapshot)).length <= REPORT_LIMITS.textBytes, 'REPORT_LIMIT');
  assertReport(encoder.encode(JSON.stringify(reportMetadata(snapshot))).length <= REPORT_LIMITS.metadataBytes, 'REPORT_LIMIT');
  if(snapshot.view)assertReport(['preserved','flattened'].includes(snapshot.view.alpha)&&Number.isSafeInteger(snapshot.view.width)&&Number.isSafeInteger(snapshot.view.height)&&snapshot.view.width>0&&snapshot.view.height>0,'REPORT_INVALID_SNAPSHOT');
  ownedSnapshots.add(snapshot);return freeze(snapshot);
}
export function rawReportText(snapshot: ExportSnapshot): string { assertSnapshot(snapshot); return JSON.stringify(snapshot, null, 2); }
export function assertOutput(blob: Blob) { assertReport(blob.size > 0 && blob.size <= REPORT_LIMITS.outputBytes, 'REPORT_OUTPUT_LIMIT'); return blob; }
