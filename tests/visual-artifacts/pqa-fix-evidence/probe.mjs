import fs from 'node:fs/promises';
import puppeteer from '/home/better0101/projects/worklazytools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const root = '/home/better0101/projects/worklazytools';
const phase = process.argv[2] || 'after';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4291';
const out = `${root}/tests/visual-artifacts/pqa-fix-${phase}-geometry`;
await fs.mkdir(out, {recursive:true});
await fs.mkdir('/tmp/worklazytools-pqa-fix', {recursive:true});
const fixture = '/tmp/worklazytools-pqa-fix/visual-hwp-document.hwp';
await fs.writeFile(fixture, Buffer.from(await fs.readFile(`${root}/tests/fixtures/rhwp-roundtrip-empty.hwp.b64`, 'utf8'), 'base64'));
const samples = [];
for (const tool of ['excel-merger', 'hwp-editor']) {
 for (const locale of tool === 'hwp-editor' ? ['ko'] : ['ko','en']) {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,env:{...process.env,LANG:'C.UTF-8',LC_ALL:'C.UTF-8',LANGUAGE:locale==='ko'?'ko-KR':'en-US'},args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars',`--lang=${locale==='ko'?'ko-KR':'en-US'}`]});
  try {
   for (const width of [390,1365,...(phase==='after'?[320,620,621,820,821,1020]:[])]) {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({width,height:width<=820?844:900,deviceScaleFactor:1});
    await page.setBypassServiceWorker(true);
    await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:width<=820?'dark':'light'},{name:'prefers-reduced-motion',value:'reduce'}]);
    await page.evaluateOnNewDocument(locale=>{localStorage.setItem('worklazy_privacy_consent','granted');localStorage.setItem('worklazy_lang',locale)},locale);
    await page.goto(`${base}/${locale}/tools/${tool}`,{waitUntil:'networkidle0'});
    if (tool==='hwp-editor') {
     await (await page.waitForSelector('[data-tool-page="hwp-editor"] input[type=file]')).uploadFile(fixture);
     await page.waitForSelector('[data-testid="hwp-focus-toolbar"]');
    }
    await page.addStyleTag({content:'@font-face{font-family:"Worklazy Visual Noto Sans KR";src:url("/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf");font-weight:100 900}:root{font-family:"Worklazy Visual Noto Sans KR",sans-serif!important}*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}'});
    await page.evaluate(async()=>{await document.fonts.load('16px "Worklazy Visual Noto Sans KR"','Worklazy 시각 기준');await document.fonts.ready});
    if(tool==='excel-merger') await page.evaluate(()=>{const el=document.querySelectorAll('[data-ui-component="segmented-control"]')[1];window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-150)});
    await new Promise(resolve=>setTimeout(resolve,300));
    const result = await page.evaluate(tool=>{
     const rect = el => {const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
     const area = (a,b) => Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
     const textRects = el => {const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);const result=[];while(walker.nextNode()){if(!walker.currentNode.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(walker.currentNode);for(const r of range.getClientRects())result.push({left:r.left,top:r.top,right:r.right,bottom:r.bottom})}return result};
     const target = tool==='excel-merger'?document.querySelectorAll('[data-ui-component="segmented-control"]')[1]:document.querySelector('[data-testid="hwp-focus-actions"]');
     const controls = [...target.children].filter(el=>el.matches('button,label'));
     const items = controls.map(el=>({text:el.textContent.trim(),rect:rect(el),textRects:textRects(el),hit:[.15,.5,.85].every(f=>{const old=el.style.pointerEvents;el.style.pointerEvents='auto';const r=rect(el),hit=document.elementFromPoint(r.left+r.width*f,r.top+r.height/2);el.style.pointerEvents=old;return hit===el||el.contains(hit)}),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
     const language = document.querySelector(innerWidth<=820?'.mobile-header [data-ui-component="language-switcher"]':'.desktop-language-switcher [data-ui-component="language-switcher"]');
     const issues=[];
     for(const item of items){if(item.rect.left < -1 || item.rect.right > innerWidth+1)issues.push(`${item.text}: viewport overflow`);if(!item.hit)issues.push(`${item.text}: occluded`);if(item.textRects.some(r=>r.left<item.rect.left-1||r.right>item.rect.right+1||r.top<item.rect.top-1||r.bottom>item.rect.bottom+1))issues.push(`${item.text}: label overflow`)}
     for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(area(items[i].rect,items[j].rect)>1)issues.push(`${items[i].text}/${items[j].text}: controls overlap`);
     let switcher=null;
     if(tool==='hwp-editor') {const r=rect(language),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);switcher={rect:r,position:getComputedStyle(language.parentElement).position,zIndex:getComputedStyle(language.parentElement).zIndex,hit:hit===language||language.contains(hit),overlaps:items.map(i=>({text:i.text,area:area(r,i.rect)}))};if(!switcher.hit)issues.push('language switcher: occluded');if(switcher.overlaps.some(i=>i.area>1))issues.push('language switcher: actions overlap')}
     return {items,target:rect(target),toolbar:tool==='hwp-editor'?rect(document.querySelector('[data-testid="hwp-focus-toolbar"]')):null,switcher,issues};
    },tool);
    samples.push({tool,locale,width,...result});
    await page.screenshot({path:`${out}/${tool}-${locale}-${width}.png`,captureBeyondViewport:false});
    console.log(JSON.stringify({tool,locale,width,issues:result.issues}));
    await page.close();
   }
  } finally {await browser.close()}
 }
}
await fs.writeFile(`${out}/geometry.json`,JSON.stringify(samples,null,2)+'\n');
if(phase==='after'&&samples.some(s=>s.issues.length))process.exitCode=1;
