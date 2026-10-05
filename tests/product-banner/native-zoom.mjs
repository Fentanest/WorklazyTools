import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { startRecoveryServer } from '../recovery-server.mjs';
import { stateWith } from '../fixtures/product-banner/state.ts';
import { saveProjectJson } from '../../src/features/product-banner/projectJson.ts';
import { exportBanner } from '../../src/features/product-banner/exporter.ts';
import { createDefaultSettings } from '../../src/features/product-banner/settings.ts';
import { buildBannerRuntime, buildHeightParentRuntime } from '../../scripts/product-banner-runtime.mjs';
// Use native Chromium per-host zoom, validated by layout viewport and DPR.
// Partition preference implementation: https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc
assert.ok(process.env.PB_JOB_ROOT,'PB_JOB_ROOT required');
const run=await mkdtemp(process.env.PB_JOB_ROOT+'/runs/native-zoom-');
process.chdir(run);
// A relative TMPDIR keeps Chromium UNIX sockets short; cwd is the unique job run.
process.env.TMPDIR=process.env.TMP=process.env.TEMP='.';
console.log('Native zoom artifacts '+run);
const ready=JSON.parse(await readFile(process.env.PB_JOB_ROOT+'/build-ready.json','utf8'));
const server=await startRecoveryServer({root:ready.outDir,port:0});
const runtime={banner:await buildBannerRuntime(),heightParent:await buildHeightParentRuntime()};
const image=await readFile(new URL('../fixtures/product-banner/local-image.svg',import.meta.url));
const rows=[],shots=[],denied=[];let context;
const capture=async(page,name)=>{await page.waitForTimeout(600);const cdp=await context.newCDPSession(page);const shot=await cdp.send('Page.captureScreenshot',{fromSurface:true,captureBeyondViewport:false});await writeFile(name,Buffer.from(shot.data,'base64'));await cdp.detach();};
const metrics=p=>p.evaluate(()=>({innerWidth,clientWidth:document.documentElement.clientWidth,devicePixelRatio,outerWidth}));
const geometry=root=>root.evaluate(el=>{
 const r=el.getBoundingClientRect();const source=el.querySelector('.wlpb-v1-source'),footer=el.querySelector('footer');
 const inside=x=>!x||(()=>{const b=x.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1&&b.bottom<=r.bottom+1})();
 return {overflow:el.scrollWidth>el.clientWidth+1,sourceFits:inside(source),footerFits:inside(footer),controlsFit:[...el.querySelectorAll('button')].filter(x=>!x.hidden&&x.getBoundingClientRect().width>0).every(inside)};
});
try {
 for(const zoom of [1,2]){
  await mkdir(`./profile${zoom}/Default`,{recursive:true});
  await writeFile(`./profile${zoom}/Default/Preferences`,JSON.stringify({partition:{per_host_zoom_levels:{x:{'127.0.0.1':{zoom_level:Math.log(zoom)/Math.log(1.2)}}}}}));
  context=await chromium.launchPersistentContext(`./profile${zoom}`,{headless:false,viewport:null,args:['--window-size=1280,1000','--ozone-platform=x11']});
  await context.addInitScript(()=>{window.__WORKLAZY_MOCK_PROVIDERS__=true;});
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin===server.url && url.pathname==='/native-host')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:16px}.host{width:100%;max-width:960px}</style><div class="host" id="host"></div>'});
   if(url.origin===server.url)return route.continue();
   if(url.hostname==='example.com'&&url.pathname.startsWith('/img/'))return route.fulfill({body:image,contentType:'image/svg+xml'});
   denied.push({type:route.request().resourceType(),host:url.hostname});return route.abort();
  });
  const deniedBefore=denied.length;const page=context.pages()[0];await page.goto(server.url+'/native-host');
  const measurement={zoom,browser:context.browser().version(),metrics:await metrics(page),cases:[]};rows.push(measurement);
  for(const [design,format] of [['photo-strip','html'],['vertical','iframe']]){
   const project=stateWith(5).project;project.settings={...createDefaultSettings('en',design),autoPlay:false};
   const html=exportBanner(project,runtime)[format];await page.goto(server.url+'/native-host');
   await page.locator('#host').evaluate((host,html)=>{host.innerHTML=html;for(const old of host.querySelectorAll('script')){const script=document.createElement('script');script.textContent=old.textContent;old.replaceWith(script);}},html);
   const frame=format==='html'?page.mainFrame():await (await page.locator('iframe').elementHandle()).contentFrame();
   await frame.waitForFunction(()=>document.querySelector('[data-wlpb-root]')?.getAttribute('data-wlpb-ready')==='true');
   const root=frame.locator('[data-wlpb-root]'),g=await geometry(root);assert.deepEqual(g,{overflow:false,sourceFits:true,footerFits:true,controlsFit:true});
   const next=root.getByRole('button',{name:'Next products',exact:true});await next.click();
   assert.ok(await root.locator('li:not([hidden])').count()>0);await root.locator('.wlpb-v1-source').focus();assert.equal(await root.locator('.wlpb-v1-source').evaluate(el=>document.activeElement===el),true);
   measurement.cases.push({design,format,geometry:g,nextClicked:true,sourceFocused:true});
   if(zoom===2){const name=design+'-'+format+'-200.png';await capture(page,name);shots.push(name);}
  }
  assert.equal(denied.length,deniedBefore,'exported banner makes no external non-image request');await page.goto(server.url+'/en/tools/product-banner/');await page.locator('[data-tool-page="product-banner"]').waitFor();
  await page.locator('input[accept=".json"]').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(saveProjectJson(stateWith(5).project))});
  await page.locator('[data-testid="banner-product"]').first().waitFor();
  await page.getByLabel('Product name',{exact:true}).first().fill('Native 200 edit');
  await page.waitForFunction(()=>[...document.querySelectorAll('textarea')].some(el=>el.value.includes('Native 200 edit')));
  const ui=await page.locator('[data-tool-page="product-banner"]').evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth+1,clipped: [...el.querySelectorAll('button,input,select,textarea')].filter(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&!['file','checkbox'].includes(x.type);}).filter(x=>{const r=x.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1;}).map(x=>x.tagName)}));assert.deepEqual(ui,{overflow:false,clipped:[]});
  const preview=page.locator('[data-testid="banner-preview"]');const frame=await(await preview.elementHandle()).contentFrame();await frame.waitForFunction(()=>document.querySelector('[data-wlpb-root]')?.getAttribute('data-wlpb-ready')==='true');const g=await geometry(frame.locator('[data-wlpb-root]'));assert.deepEqual(g,{overflow:false,sourceFits:true,footerFits:true,controlsFit:true});
  measurement.cases.push({generator:true,metrics:await metrics(page),ui,preview:g,editToExport:true});
  if(zoom===2){await page.evaluate(()=>scrollTo(0,0));await capture(page,'generator-200-top.png');shots.push('generator-200-top.png');await preview.scrollIntoViewIfNeeded();await capture(page,'generator-200-preview.png');shots.push('generator-200-preview.png');await page.getByLabel('Product name',{exact:true}).first().scrollIntoViewIfNeeded();await capture(page,'generator-200-edit.png');shots.push('generator-200-edit.png');await page.getByRole('button',{name:'Copy HTML code',exact:true}).click({trial:true});await capture(page,'generator-200-export.png');shots.push('generator-200-export.png');measurement.cases.at(-1).exportButtonActionable=true;}
  await context.close();context=null;
 }
 assert.equal(rows[0].metrics.outerWidth,rows[1].metrics.outerWidth);assert.equal(rows[0].metrics.innerWidth,rows[1].metrics.innerWidth*2);assert.equal(rows[0].metrics.clientWidth,rows[1].metrics.clientWidth*2);assert.equal(rows[1].metrics.devicePixelRatio,rows[0].metrics.devicePixelRatio*2);assert.ok(denied.every(x=>['wcs.pstatic.net','www.googletagmanager.com','pagead2.googlesyndication.com','ads-partners.coupang.com'].includes(x.host)),'only generator provider requests were aborted');
 console.log('# tests 3\n# pass 3\n# fail 0');
}finally{await context?.close();await server.close();await writeFile('result.json',JSON.stringify({method:'headed Chromium native site zoom preference, two fresh profiles at identical window dimensions; no CSS zoom or emulation',rows,denied,externalTransmitted:0},null,2));await writeFile('MANIFEST.sha256',(await Promise.all(shots.map(async name=>createHash('sha256').update(await readFile(name)).digest('hex')+'  '+name+'\n'))).join(''));}
