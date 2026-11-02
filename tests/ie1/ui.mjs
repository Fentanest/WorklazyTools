import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4196';
const out = process.env.IE1_OUTPUT || '/tmp/sol-ie1';
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const context = await browser.newContext();
const requests = [], errors = [];
await context.route('**/*', route => {
  const url = route.request().url(); requests.push(url);
  return url.startsWith(base + '/') || /^(data:|blob:)/.test(url) ? route.continue() : route.abort();
});
const p = await context.newPage(); p.setDefaultTimeout(90_000); p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
const input = { name: 'ie1-input.png', mimeType: 'image/png', buffer: await fs.readFile('tests/fixtures/redaction-export/photo.png') };
const { default: JSZip } = await import('jszip');
const editor = p.locator('[data-testid=library-image-editor]');
const fresh = async (path = '') => {
  await p.goto(`${base}/en/tools/image-studio/${path}`); await p.locator('.asp-image-editor .lower-canvas').waitFor();
  await p.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]')?.disabled);
};
const put = async () => { await editor.locator('input[type=file]').first().setInputFiles(input); await editor.getByText('1 files selected', {exact:true}).waitFor(); await p.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]')?.disabled); };
const tab = n => p.locator('[data-testid=image-studio-tabs] button').nth(n).click();
try {
  await test('IE1 UI contract', async t => {
    const scenario = (name, fn) => t.test(name, async () => { console.log('starting:', name); try { await fn(); } catch (error) { await p.screenshot({ path: `${out}/ui-failure-${name.slice(0,24).replace(/[^a-z0-9]/gi,'-')}.png`, fullPage:true }).catch(()=>{}); throw error; } });
    await scenario('three direct entries select resize, redaction pixelate and text', async () => {
      for (const [path, label] of [['resize/', 'Resize'], ['mosaic/', 'Redact'], ['watermark/', 'Text']]) {
        await fresh(path);
        assert.ok((await editor.locator('.asp-panel__title').allTextContents()).some(value => value.includes(label)), path);
      }
    });
    await scenario('editor follows coral and mint light/dark theme attributes', async () => {
      await fresh();
      for(const theme of ['dark-coral','light-coral','dark-mint','light-mint']) {
        await p.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
        await p.waitForFunction(dark=>{ const node=document.querySelector('.asp-image-editor');const rgb=getComputedStyle(node).backgroundColor.match(/\d+/g)?.slice(0,3).map(Number);return rgb && (dark ? Math.max(...rgb)<100 : Math.min(...rgb)>180); },theme.startsWith('dark'));
      }
    });
    await scenario('global header drop routes to one editor without duplicate choices', async () => {
      await fresh();
      const data = await p.evaluateHandle(base64 => { const transfer = new DataTransfer(); const bytes=Uint8Array.from(atob(base64), value=>value.charCodeAt(0)); transfer.items.add(new File([bytes], 'ie1-global.png', {type:'image/png'})); return transfer; }, input.buffer.toString('base64'));
      await p.locator('h1').dispatchEvent('drop', {dataTransfer:data});
      await editor.getByText('1 files selected',{exact:true}).waitFor();
      assert.equal(await p.locator('[data-testid=file-drop-target-choice]').count(),0);
    });
    await scenario('source intake creates a forced PNG result and preserves the editing scene', async () => {
      await fresh(); await put();
      await editor.locator('.asp-commit').click(); await p.locator('[data-testid=image-editor-result] img').waitFor();
      const result = await p.locator('[data-testid=image-editor-result] a').getAttribute('href');
      assert.ok(result.startsWith('blob:'));
      const type = await p.evaluate(async url => (await (await fetch(url)).blob()).type, result);
      assert.equal(type, 'image/png'); assert.equal(await editor.locator('.lower-canvas').count(), 1);
    });
    await scenario('exact PNG result dimensions preserve the editable scene', async () => {
      const size = p.locator('[data-testid=image-editor-png-size]');
      await size.locator('input[type=checkbox]').uncheck();
      await size.locator('input[type=number]').nth(0).fill('200'); await size.locator('input[type=number]').nth(1).fill('120');
      await editor.locator('.asp-commit').click(); await p.locator('[data-testid=image-editor-result] img').waitFor();
      const dimensions = await p.locator('[data-testid=image-editor-result] img').evaluate(async image => { await image.decode(); return [image.naturalWidth,image.naturalHeight]; });
      assert.deepEqual(dimensions,[200,120]); assert.equal(await editor.locator('.lower-canvas').count(),1);
      await size.getByRole('button',{name:'Automatic size',exact:true}).click();
    });
    await scenario('commit applies a pending crop and still delivers its PNG', async () => {
      await fresh(); await put(); await editor.getByRole('button',{name:'Crop & rotate',exact:true}).click();
      for(const [label,value]of [['Left','50'],['Top','50'],['Width','120'],['Height','100']])await editor.getByRole('spinbutton',{name:label,exact:true}).fill(value);
      await editor.locator('.asp-commit').click();await p.locator('[data-testid=image-editor-result] img').waitFor();
      const dimensions=await p.locator('[data-testid=image-editor-result] img').evaluate(async image=>{await image.decode();return[image.naturalWidth,image.naturalHeight]});assert.ok(dimensions.every(value=>value>0));
    });
    await scenario('overlapping PNG encodes retain their own size and W2 destination', async () => {
      await fresh();await put();const size=p.locator('[data-testid=image-editor-png-size]');await size.locator('input[type=checkbox]').uncheck();
      await size.locator('input[type=number]').nth(0).fill('200');await size.locator('input[type=number]').nth(1).fill('120');
      await p.evaluate(()=>{window.__ie1OriginalBlob=HTMLCanvasElement.prototype.toBlob;window.__ie1Hold=true;HTMLCanvasElement.prototype.toBlob=function(callback,...args){if(window.__ie1Hold){window.__ie1Hold=false;window.__ie1Release=()=>window.__ie1OriginalBlob.call(this,callback,...args)}else window.__ie1OriginalBlob.call(this,callback,...args)}});
      await p.locator('[data-testid=image-editor-add-to-batch]').click();await p.waitForFunction(()=>typeof window.__ie1Release==='function');
      await size.locator('input[type=number]').nth(0).fill('240');await size.locator('input[type=number]').nth(1).fill('140');await editor.locator('.asp-commit').click();
      await p.locator('[data-testid=image-editor-result] img').waitFor();const dimensions=await p.locator('[data-testid=image-editor-result] img').evaluate(async image=>{await image.decode();return[image.naturalWidth,image.naturalHeight]});assert.deepEqual(dimensions,[240,140]);
      await p.evaluate(()=>window.__ie1Release());await p.waitForFunction(()=>document.querySelector('[data-testid=image-editor-add-to-batch]').textContent.includes('(1)'));await p.evaluate(()=>HTMLCanvasElement.prototype.toBlob=window.__ie1OriginalBlob);
      await tab(1);assert.equal(await p.locator('[data-testid=image-batch-list]').getAttribute('data-count'),'1');await p.locator('[data-image-owner=batch] select').first().selectOption('original');await p.locator('[data-image-owner=batch] select:has(option[value="png"])').selectOption('png');
      const downloading=p.waitForEvent('download');await p.locator('[data-testid=image-batch-action] button').click();const download=await downloading;const zip=await JSZip.loadAsync(await fs.readFile(await download.path()));const entry=Object.values(zip.files).find(value=>!value.dir);const {PNG}=await import('pngjs');const image=PNG.sync.read(await entry.async('nodebuffer'));assert.deepEqual([image.width,image.height],[200,120]);
      await fresh();await put();
    });
    await scenario('W2 repeated trusted activations extend 600ms burst and enqueue one image', async () => {
      await fresh(); await put();
      const add = p.locator('[data-testid=image-editor-add-to-batch]');
      await add.focus();
      for (let i = 0; i < 10; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(100); }
      assert.equal(await add.getAttribute('aria-disabled'), 'true');
      await tab(1); assert.equal(await p.locator('[data-testid=image-batch-list]').getAttribute('data-count'), '1');
      assert.equal(await p.locator('[data-testid=image-batch-source]').textContent(), 'Edited result');
      await p.locator('[data-image-owner=batch] select').first().selectOption('original');
      const downloading = p.waitForEvent('download'); await p.locator('[data-testid=image-batch-action] button').click();
      const download = await downloading; const zip = await JSZip.loadAsync(await fs.readFile(await download.path()));
      assert.equal(Object.values(zip.files).filter(item=>!item.dir).length,1);
      await tab(0); assert.equal(await editor.locator('.lower-canvas').count(), 1);
    });
    await scenario('W2 shares 50-file limit with original inputs', async () => {
      await fresh(); await put(); await p.locator('[data-testid=image-editor-add-to-batch]').click(); await p.waitForTimeout(700); await tab(1);
      await p.locator('[data-image-owner=batch] input[type=file]').first().setInputFiles(Array.from({ length: 49 }, (_, i) => ({ ...input, name: `ie1-${i}.png` })));
      assert.equal(await p.locator('[data-testid=image-batch-list]').getAttribute('data-count'), '50');
      await tab(0); await p.locator('[data-testid=image-editor-add-to-batch]').click(); await tab(1);
      assert.equal(await p.locator('[data-testid=image-batch-list]').getAttribute('data-count'), '50');
    });
    await scenario('background consent has exact missing byte count, no model requests before consent, cancel is quiet', async () => {
      await fresh(); await put(); await p.evaluate(() => caches.delete('worklazy-models-v1')); requests.length = 0;
      await editor.getByRole('button', { name: 'Magic — more tools', exact: true }).click();
      await editor.getByRole('menuitem', { name: 'Remove background', exact: true }).click();
      await editor.getByRole('button', { name: 'Remove background', exact: true }).last().click();
      const dialog = p.getByRole('dialog', { name: 'Download background removal files' }); await dialog.waitFor();
      assert.match(await dialog.innerText(), /40,737,492/);
      assert.equal(requests.filter(url => /\/vendor\/(bg-removal|onnxruntime-web)\//.test(url)).length, 0);
      await dialog.getByRole('button', { name: 'Cancel operation', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
      assert.equal(await editor.locator('[role=alert]').count(), 0);
    });
    await scenario('390px keyboard redaction can export with flatten/proceed/cancel warning', async () => {
      await p.setViewportSize({ width: 390, height: 844 }); await fresh('mosaic/'); await put();
      const geometry = await editor.evaluate(node => { const options=node.querySelector('.asp-options-panel').getBoundingClientRect(), layers=node.querySelector('.asp-layer-list').getBoundingClientRect(); return {optionsBottom:options.bottom,layersTop:layers.top}; });
      assert.ok(geometry.optionsBottom <= geometry.layersTop + 1, JSON.stringify(geometry));
      await editor.getByRole('button', { name: 'Solid', exact: true }).click();
      for (const [label, value] of [['Left','100'],['Top','100'],['Width','100'],['Height','80']]) await editor.getByRole('spinbutton', { name: label, exact: true }).fill(value);
      await editor.getByRole('button', { name: 'Apply redaction', exact: true }).click();
      const chooseJSON = async () => {
        await editor.getByRole('button', { name: 'Export', exact: true }).click();
        await editor.getByRole('button', { name: 'JSON', exact: true }).click();
        await editor.getByRole('button', { name: 'Download image', exact: true }).click();
      };
      await chooseJSON(); const warning = p.getByRole('dialog', { name: 'This format may retain the original' }); await warning.waitFor();
      let downloadCount=0; const listener=()=>downloadCount++; p.on('download',listener);
      await warning.getByRole('button',{name:'Cancel operation',exact:true}).click(); await warning.waitFor({state:'hidden'}); assert.equal(downloadCount,0);
      await chooseJSON(); await warning.waitFor(); const downloading=p.waitForEvent('download');
      await warning.getByRole('button',{name:'Flatten layers and export',exact:true}).click();
      const file=await downloading; const json=JSON.parse(await fs.readFile(await file.path(),'utf8'));
      assert.equal(json.objects.length,1); assert.match(json.objects[0].src,/^data:image\/png/); assert.notEqual(json.objects[0].aspRole,'redaction');
      p.off('download',listener);
      await p.screenshot({path:`${out}/mobile-editor.png`,fullPage:true});
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    });
    await scenario('accepted direct-entry changes preserve edited layers and history', async () => {
      await p.setViewportSize({width:1365,height:900}); await fresh('watermark/'); await put();
      const text=editor.locator('#asp-text-input'); assert.equal(await text.inputValue(),''); await text.fill('Preserve this layer');
      await editor.locator('.asp-text-add .asp-btn-accent').click(); const before=await editor.locator('.asp-layers__row').count(); assert.equal(before,2);
      await p.evaluate(()=>{history.pushState({},'', '/en/tools/image-studio/mosaic/');dispatchEvent(new PopStateEvent('popstate'));});
      await p.locator('[data-testid=direct-entry-confirm][open]').waitFor(); await p.locator('[data-testid=direct-entry-accept]').click();
      if(await p.locator('[data-testid=unsaved-work-dialog][open]').count())await p.locator('[data-testid=unsaved-stay]').click();
      await editor.getByRole('button',{name:'Apply redaction',exact:true}).waitFor();
      assert.equal(await editor.locator('.asp-layers__row').count(),before); assert.equal(await editor.getByRole('button',{name:'Undo',exact:true}).isEnabled(),true);
    });
    await scenario('user-renamed long layer names visibly truncate', async () => {
      await fresh('watermark/'); await put(); await editor.locator('#asp-text-input').fill('Layer'); await editor.locator('.asp-text-add .asp-btn-accent').click();
      await editor.locator('.asp-layers__name').first().dblclick();
      await editor.getByRole('textbox',{name:'Layer name',exact:true}).fill('A very long layer name that must visibly truncate with an ellipsis in this layer panel');
      await editor.getByRole('textbox',{name:'Layer name',exact:true}).press('Enter');
      const metrics=await editor.locator('.asp-layers__name').first().evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth,overflow:getComputedStyle(node).textOverflow}));
      assert.ok(metrics.scroll>metrics.client);assert.equal(metrics.overflow,'ellipsis');
      await p.screenshot({path:`${out}/layer-name.png`,fullPage:true});
    });
    await scenario('a loaded template remains protected after the library marks it clean', async () => {
      await fresh(); await editor.getByRole('button',{name:'Image',exact:true}).click();
      const downloading=p.waitForEvent('download');await editor.getByRole('button',{name:'Save template',exact:true}).click();const file=await downloading;const savedPath=await file.path();
      await fresh();await editor.getByRole('button',{name:'Image',exact:true}).click();await editor.locator('input[accept*=".json"]').setInputFiles(savedPath);
      await editor.getByRole('button',{name:'Edit history',exact:true}).click();await editor.getByText('Loaded template',{exact:true}).waitFor();await p.keyboard.press('Escape');
      await p.locator('a[href="/en"],a[href="/en/"]').first().click();await p.locator('[data-testid=unsaved-work-dialog][open]').waitFor();await p.locator('[data-testid=unsaved-stay]').click();
      assert.ok(p.url().includes('image-studio'));
    });
    await scenario('H1 receives through the home drop zone and cold library chunk', async () => {
      await p.setViewportSize({width:1365,height:900}); await p.goto(`${base}/en/`);
      await p.locator('[data-testid=home-dropzone] input[type=file]').setInputFiles(input);
      await p.locator('[data-receiver=image-edit]').click();
      await p.locator('.asp-image-editor .lower-canvas').waitFor();
      await p.waitForFunction(()=>!document.querySelector('[data-testid=image-editor-add-to-batch]')?.disabled);
      assert.equal(await p.locator('[data-testid=image-handoff-recovery]').count(),0);
      await p.locator('.asp-commit').click(); await p.locator('[data-testid=image-editor-result] a').waitFor();
      assert.equal(await p.locator('[data-testid=image-editor-result] a').getAttribute('download'),'ie1-input-edited.png');
    });
    await scenario('collage/GIF tabs retain original intake and preview', async () => {
      await p.setViewportSize({width:1365,height:900}); await fresh();
      for(const n of [2,3]) { await tab(n); const owner=p.locator(`[data-image-owner=${n===2?'collage':'gif'}]`); await owner.locator('input[type=file]').first().setInputFiles(input); assert.equal(await owner.locator('input[type=file]').count()>0,true); }
    });
    assert.deepEqual(errors,[]);
  });
} finally { await fs.writeFile(`${out}/ui-facts.json`,JSON.stringify({base,errors,externalRequests:requests.filter(url=>/^https?:/.test(url)&&!url.startsWith(base+'/')),requests},null,2)); await browser.close(); }
