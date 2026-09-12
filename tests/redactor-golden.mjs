import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFRawStream, PDFArray, PDFString, decodePDFRawStream } from 'pdf-lib';
import { verifyPdfStructure } from '../src/features/document-redactor/verify.ts';
import { OwnedLedger } from '../src/features/document-redactor/ledger.ts';
import { pngPlan } from '../src/features/document-redactor/input.ts';
const input = process.env.REDACTOR_OUTPUT ?? '/tmp/worklazy-u6-preflight/p1-engine/acceptance-first';
const output = process.env.REDACTOR_GOLDEN_OUTPUT ?? '/tmp/worklazy-u6-preflight/p1-engine/golden.json';
const bytes = new Uint8Array(await fs.readFile(input + '/output.pdf'));
const sizes = (await PDFDocument.load(bytes)).getPages().map(p => p.getSize());
const rows = [];
async function verify(data) {
  const pdf = await PDFDocument.load(data, { updateMetadata: false });
  const ledger = new OwnedLedger();
  try { return verifyPdfStructure(data, pdf, sizes, ledger, 'golden'); }
  finally { ledger.releaseOwner('golden'); assert.deepEqual(ledger.totals, { binary: 0, raw: 0 }); }
}
rows.push({ name: 'actual multipage output', result: await verify(bytes) });
for (const kind of ['metadata', 'annotation', 'font', 'soft-mask', 'orphan', 'text-operator', 'wrong-image-name', 'extra-operand', 'trailer-key', 'nested-procset', 'nested-decode-parms']) {
  const p = await PDFDocument.load(bytes, { updateMetadata: false });
  const page = p.getPage(0), context = p.context;
  if (kind === 'metadata') p.catalog.set(PDFName.of('Metadata'), context.register(context.stream('hidden')));
  if (kind === 'annotation') page.node.set(PDFName.of('Annots'), context.obj([]));
  if (kind === 'font') page.node.Resources().set(PDFName.of('Font'), context.obj({}));
  if (kind === 'soft-mask') {
    const objects = page.node.Resources().lookup(PDFName.of('XObject'));
    objects.lookup(objects.keys()[0]).dict.set(PDFName.of('SMask'), PDFName.of('None'));
  }
  if (kind === 'nested-procset') page.node.Resources().set(PDFName.of('ProcSet'), context.obj([PDFString.of('SYNTHETIC_ORIGINAL_SECRET')]));
  if (kind === 'nested-decode-parms') { const objects = page.node.Resources().lookup(PDFName.of('XObject')); objects.lookup(objects.keys()[0]).dict.set(PDFName.of('DecodeParms'), context.obj({ Hidden: PDFString.of('SYNTHETIC_ORIGINAL_SECRET') })); }
  if (kind === 'orphan') context.register(context.obj({ Hidden: 1 }));
  if (['text-operator', 'wrong-image-name', 'extra-operand'].includes(kind)) {
    let stream = page.node.Contents();
    if (stream instanceof PDFArray) stream = context.lookup(stream.get(0));
    assert.ok(stream instanceof PDFRawStream);
    let source = new TextDecoder().decode(decodePDFRawStream(stream).decode());
    if (kind === 'text-operator') source += '\nBT ET';
    if (kind === 'wrong-image-name') source = source.replace(/\/[^\s]+\s+Do/, '/MissingImage Do');
    if (kind === 'extra-operand') source += '\n12';
    page.node.set(PDFName.of('Contents'), context.register(context.flateStream(source)));
  }
  let mutant = await p.save({ useObjectStreams: false });
  if (kind === 'trailer-key') {
    const str = Buffer.from(mutant).toString('latin1');
    mutant = new Uint8Array(Buffer.from(str.replace(/trailer\s*<</, 'trailer\n<< /Unexpected 1 '), 'latin1'));
  }
  await assert.rejects(verify(mutant), undefined, kind);
  rows.push({ name: kind, rejected: true });
}
const png = new Uint8Array(await fs.readFile(input + '/output.png'));
assert.ok(pngPlan(png, true));
const corrupt = png.slice(); corrupt[corrupt.length - 1] ^= 1;
assert.throws(() => pngPlan(corrupt, true));
rows.push({ name: 'actual strict PNG and corrupt CRC', rejected: true });
await fs.writeFile(output, JSON.stringify({ rows, pass: true }, null, 2));
console.log('PASS: actual multipage minimal structure, 11 structural mutants, strict PNG and CRC mutant');
