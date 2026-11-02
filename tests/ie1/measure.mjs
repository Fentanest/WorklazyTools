import { chromium } from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
const out = process.env.IEF_OUTPUT ?? '.ief'; fs.mkdirSync(`${out}/raw`, { recursive: true }); fs.mkdirSync(`${out}/exports`, { recursive: true });
const scenes = JSON.parse(fs.readFileSync(process.env.IEF_MANIFEST ?? 'tests/fixtures/redaction-export/scenes.json'));
for (const s of scenes.scenes) {
  const bytes = fs.readFileSync(`tests/fixtures/redaction-export/${s.input}`);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== s.sha256) throw new Error('fixture hash mismatch');
  s.src = `data:image/png;base64,${bytes.toString('base64')}`;
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/google-chrome' });
const page = await browser.newPage(); await page.goto('http://127.0.0.1:4196/tests/ie1/engine.html'); await page.waitForFunction(() => window.ready);
const external = []; page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:4196/')) external.push(r.url()); });
const facts = [];
for (const scene of scenes.scenes) {
  
  const result = await page.evaluate(async ({ scene, region, target }) => {
    const w = window;
    const e = await w.newEngine({ fontResolver: () => 'local', flattenTarget: target, onBeforeExport: () => 'flatten' });
    await e.loadImage(scene.src);
    if (scene.requiresIEBG) await e.removeImageBackground('replace');
    e.addRedactionMarquee(); e.setMarquee(region); await e.applyRedaction(scene.mode);
    if (scene.nested) {
      const object = e.canvas.getObjects().find(o => o.get('aspRole') === 'redaction');
      e.canvas.remove(object);
      const group = new w.api.fabric.Group([new w.api.fabric.Group([object])]);
      e.canvas.add(group);
    }
    const original = e.canvas.toObject().objects.find(o => o.aspId === 'base').src;
    const stateBefore = JSON.stringify(e.canvas.toObject());
    const reference = e.canvas.toCanvasElement(1).toDataURL('image/png').split(',')[1];
    const files = {};
    const blobBase64 = async b => {
      const bytes = new Uint8Array(await b.arrayBuffer()); let s = ''; for (const byte of bytes) s += String.fromCharCode(byte); return btoa(s);
    };
    for (const f of ['png', 'jpeg', 'webp', 'pdf', 'svg', 'json']) files[f] = await blobBase64(await e.exportImage(f, f === 'jpeg' ? 95 : 92, [f]));
    const template = await e.exportTemplate(); files.template = btoa(unescape(encodeURIComponent(template)));
    const json = await (await e.exportImage('json', 92, ['json'])).text();
    const svg = await (await e.exportImage('svg', 92, ['svg'])).text();
    const parsed = JSON.parse(json), tp = JSON.parse(template);
    return { files, reference, hasConcealment: e.hasConcealment, unchanged: stateBefore === JSON.stringify(e.canvas.toObject()),
      originalOccurrences: { json: json.split(original).length - 1, template: template.split(original).length - 1, svg: svg.split(original).length - 1 },
      jsonImageCount: parsed.objects.length, templateImageCount: tp.snapshot.json.objects.length,
      templateFlag: tp.concealmentEverApplied, historyKeys: /"(?:history|previousScene|originalSrc)"/.test(json + template),
      jsonSourceCount: (json.match(/"src":"(?:data:|blob:)/g) ?? []).length,
      templateSourceCount: (template.match(/"src":"(?:data:|blob:)/g) ?? []).length };
  }, { scene, region: scenes.region, target: scenes.outputResolution });
  fs.writeFileSync(`${out}/exports/${scene.id}.reference.png`, Buffer.from(result.reference, 'base64'));
  for (const [format, data] of Object.entries(result.files)) fs.writeFileSync(`${out}/exports/${scene.id}.${format === 'template' ? 'template.json' : format}`, Buffer.from(data, 'base64'));
  const { files, reference, ...fact } = result; facts.push({ id: scene.id, mode: scene.mode, ...fact });
}
fs.writeFileSync(`${out}/raw/flatten-facts.json`, JSON.stringify({ fixtureManifest: process.env.IEF_MANIFEST ?? 'tests/fixtures/redaction-export/scenes.json', facts, localFontExternalRequests: external, chromium: browser.version() }, null, 2));
await browser.close(); console.log(JSON.stringify(facts, null, 2));
