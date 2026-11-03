// R30: run the actual Word worker with real Pyodide/TS modules, without UI/network.
// One case per Node process keeps WASM high-water memory from prior cases out.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { loadPyodide } from 'pyodide';
import { documentCapabilities, documentProvenance } from '../src/features/document-compare/documentCapabilities.ts';
import { compareDocumentModels, diffText } from '../src/features/document-compare/documentComparison.ts';
import { serializeManifestForTracked } from '../src/features/document-compare/manifestWire.ts';
import { sniffDocumentFormat } from '../src/features/document-compare/documentFormat.ts';
import { restoreModelTransport } from '../src/features/word-compare/modelTransport.ts';
import { isOutOfMemory, outOfMemoryMessage, trackedOutOfMemoryMessage } from '../src/features/document-compare/memoryFailure.ts';
import { screenResult } from '../src/features/document-compare/screenResult.ts';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const at = arg.indexOf('='); assert.ok(at > 2, 'Use --name=value arguments');
  return [arg.slice(2, at), arg.slice(at + 1)];
}));
for (const key of ['before', 'after', 'output']) assert.ok(args[key], `--${key}= is required`);
fs.mkdirSync(path.dirname(args.output), { recursive: true });
const source = path.resolve(args.source || 'src/features/word-compare');
const read = name => fs.readFileSync(path.join(source, name), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const phases = {}, calls = {}, models = [], manifests = [], messages = [];
const phase = (name, fn) => (...values) => {
  if (args.trace === 'true') console.log(JSON.stringify({ phase: name, event: 'start', at: performance.now() }));
  const started = performance.now();
  try { return fn(...values); }
  finally {
    phases[name] = (phases[name] || 0) + performance.now() - started; calls[name] = (calls[name] || 0) + 1;
    if (args.trace === 'true') console.log(JSON.stringify({ phase: name, event: 'end', at: performance.now() }));
  }
};
const before = fs.readFileSync(args.before), after = fs.readFileSync(args.after);
const start = performance.now();
const py = await loadPyodide();
phases.runtimeInit = performance.now() - start;
const runPython = py.runPython.bind(py), get = py.globals.get.bind(py.globals);
let scripts = 0;
const runTimedPython = (code, ...rest) => {
  const result = phase('pythonSetup', runPython)(code, ...rest);
  if (++scripts === 3) runPython(`
import datetime as _r30_datetime, types as _r30_types
class _R30Fixed(_r30_datetime.datetime):
    @classmethod
    def now(cls, tz=None): return cls(2026, 1, 1, tzinfo=_r30_datetime.timezone.utc)
datetime = _r30_types.ModuleType('datetime')
datetime.__dict__.update(_r30_datetime.__dict__)
datetime.datetime = _R30Fixed
_r30_extractions = 0
_r30_extract_object = _extract_document_model_object
def _extract_document_model_object(*args, **kwargs):
    global _r30_extractions
    _r30_extractions += 1
    return _r30_extract_object(*args, **kwargs)
${args.profile === 'true' ? 'import cProfile\n_r30_profile = cProfile.Profile()\n_r30_profile.enable()' : ''}
`);
  return result;
};
const timedGet = name => {
  const value = get(name);
  const key = ({ extract_document_model_compact: 'extractAndEncode', accept_tracked_document: 'accept',
    rewrite_new_comment_authors: 'commentAuthors', generate_tracked_document: 'generate',
    tracked_source_facts: 'saveFacts', restore_tracked_source_facts: 'restoreFacts',
    keep_tracked_source_facts: 'keepFacts' })[name];
  if (!key || typeof value !== 'function') return value;
  const wrapped = phase(key, value); wrapped.destroy = () => value.destroy(); return wrapped;
};
const names = ['documentCapabilities','documentProvenance','acceptRevisionsScript','compareScript','trackedDocxScript','formattingPolicy','pyodidePackage',
  'compareDocumentModels','diffText','serializeManifestForTracked','sniffDocumentFormat','extractLegacyDocModel','restoreModelTransport',
  'isOutOfMemory','outOfMemoryMessage','trackedOutOfMemoryMessage','screenResult','self','injectedPyodide'];
let workerSource = read('word.worker.ts').replace(/^import .*;\r?\n/gm, '').replace('export {};', '')
  .replace('import.meta.env.BASE_URL', '"/"').replace('await import(/* @vite-ignore */ PYODIDE_MODULE_URL)', 'injectedPyodide');
assert.ok(!/^import /m.test(workerSource) && workerSource.includes('= injectedPyodide;'), 'worker harness source shape');
// Surface the cause hidden by the production worker's localized error boundary.
workerSource = workerSource.replace('const rawMessage =', 'console.error("BENCHMARK_WORKER_ERROR", String(error.stack || error).slice(0, 2400)); const rawMessage =');
workerSource = ts.transpileModule(workerSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
globalThis.location = { origin: 'http://localhost' };
globalThis.postMessage = value => { if (value.type !== 'progress') messages.push(value); };
const compare = phase('compare', (...values) => { const result = compareDocumentModels(...values); manifests.push(result.manifest); return result; });
const restore = phase('restoreTransport', value => { const model = restoreModelTransport(value); models.push(model); return model; });
const values = [documentCapabilities, documentProvenance, read('accept_revisions.py'), read('compare.py'), read('tracked_docx.py'),
  JSON.parse(read('formatting-policy.json')), { version: 'benchmark-local' }, compare, phase('diff', diffText),
  phase('manifestWire', serializeManifestForTracked), sniffDocumentFormat, () => { throw new Error('DOC is outside this benchmark'); }, restore,
  isOutOfMemory, outOfMemoryMessage, trackedOutOfMemoryMessage, phase('screenProjection', screenResult), globalThis,
  { loadPyodide: async () => ({ FS: py.FS, globals: { get: timedGet, set: py.globals.set.bind(py.globals) }, runPython: runTimedPython }) }];
new Function(...names, workerSource)(...values);
const workerStart = performance.now();
await globalThis.onmessage({ data: { pairs: [{ beforeName: 'before.docx', afterName: 'after.docx', beforeBuffer: Uint8Array.from(before).buffer, afterBuffer: Uint8Array.from(after).buffer }], language: 'en',
  options: { trackedDocument: true, rewriteRevisionAuthor: args.accept !== 'false', revisionAuthor: 'R30', formatting: true, tables: true, metadata: true } } });
const workerMs = performance.now() - workerStart;
const memory = { rss: process.memoryUsage().rss, maxRssKiB: process.resourceUsage().maxRSS, jsHeap: process.memoryUsage().heapUsed,
  wasmHeapBytes: py._module?.HEAPU8?.buffer.byteLength ?? null };
const result = messages.find(value => value.type === 'screen');
const tracked = messages.find(value => value.type === 'tracked');
assert.ok(result?.result, 'positive screen result: ' + JSON.stringify(messages));
assert.ok(tracked?.trackedBuffer?.byteLength > 0, JSON.stringify(messages.map(m => ({ type: m.type, warnings: m.warnings, error: m.error }))));
// Profile is separate from unprofiled timing runs; never compare its wall times.
if (args.profile === 'true') {
  const text = runPython(`_r30_profile.disable()\nimport pstats, io\n_r30_stream = io.StringIO()\npstats.Stats(_r30_profile, stream=_r30_stream).sort_stats('cumtime').print_stats(65)\n_r30_stream.getvalue()`);
  fs.writeFileSync(args.output + '.profile.txt', text);
}
py.FS.writeFile('/tmp/r30-output.docx', new Uint8Array(tracked.trackedBuffer));
const parts = JSON.parse(runPython(`import hashlib, json, zipfile\nwith zipfile.ZipFile('/tmp/r30-output.docx') as _r30_z:\n    assert _r30_z.testzip() is None\n    _r30_parts = [[n, hashlib.sha256(_r30_z.read(n)).hexdigest()] for n in sorted(_r30_z.namelist())]\njson.dumps(_r30_parts)`));
const output = { schemaVersion: 1, label: args.label || '', profile: args.profile === 'true', accept: args.accept !== 'false',
  node: process.version, pyodide: JSON.parse(fs.readFileSync('node_modules/pyodide/package.json')).version,
  inputHashes: { before: sha(before), after: sha(after) }, sourceHashes: Object.fromEntries(['compare.py','accept_revisions.py','tracked_docx.py','word.worker.ts'].map(n => [n,sha(read(n))])),
  timeOriginMs: performance.timeOrigin,
  workerMs, coldTotalMs: workerMs + phases.runtimeInit, phasesMs: phases, calls, memory,
  extractions: Number(runPython('_r30_extractions')),
  hashes: { models: models.map(model => sha(JSON.stringify(model))), manifests: manifests.map(m => sha(JSON.stringify(m))),
    screen: sha(JSON.stringify(result.result)), packageParts: sha(JSON.stringify(parts)) }, parts,
  warnings: tracked.warnings || [] };
fs.mkdirSync(path.dirname(args.output), { recursive: true }); fs.writeFileSync(args.output, JSON.stringify(output, null, 2));
if (args.docx) fs.writeFileSync(args.docx, new Uint8Array(tracked.trackedBuffer));
console.log(JSON.stringify({ output: args.output, workerMs, phasesMs: phases, memory }));
