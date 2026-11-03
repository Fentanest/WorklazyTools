import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { JSDOM } from "jsdom";
import { startRecoveryServer } from "./recovery-server.mjs";

const output=process.env.MENU_OUTPUT||await fs.mkdtemp("/tmp/worklazy-menu-smoke-");
let browser,server,base;
before(async()=>{
  await fs.mkdir(output,{recursive:true});
  if(!process.env.TEST_BASE_URL)server=await startRecoveryServer({root:"dist"});
  base=process.env.TEST_BASE_URL||server.url;
  browser=await chromium.launch({executablePath:"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage"]});
});
after(async()=>{await browser?.close();await server?.close();console.log(`Menu screenshots: ${output}`);});
async function settle(page){await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function position(locator){await locator.evaluate(el=>{el.scrollIntoView({block:"start",behavior:"instant"});let p=el.parentElement;while(p){if(p.scrollHeight>p.clientHeight&&/(auto|scroll)/.test(getComputedStyle(p).overflowY)){p.scrollTop-=110;return;}p=p.parentElement;}window.scrollBy({top:-110,behavior:"instant"});});}

for(const lang of["ko","en"])for(const theme of["light-coral","dark-coral"])for(const width of[1440,390])test(`${lang} ${theme} ${width}px image editor menu identity and alignment`,async()=>{
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme.startsWith("dark")?"dark":"light",reducedMotion:"reduce"});
  await context.addInitScript(theme=>{try{localStorage.setItem("worklazy-theme",theme);}catch{}},theme);
  await context.route("**/*",route=>{const url=new URL(route.request().url());return ["data:","blob:"].includes(url.protocol)||url.origin===new URL(base).origin?route.continue():route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(20000);const name=lang==="ko"?"이미지 편집":"Image Editor",stem=path.join(output,`${lang}-${theme}-${width}`);
  try{
    await page.goto(`${base}/${lang}/tools/?category=media`,{waitUntil:"domcontentloaded"});
    const cards=page.locator('[data-testid="tool-results"] [data-ui-component="tool-card"]');await cards.first().waitFor();await settle(page);
    assert.equal(await cards.first().getAttribute("href"),`/${lang}/tools/image-studio`);
    assert.equal(await cards.first().getByRole("heading").innerText(),name);
    assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
    const sidebarImage=page.locator(`.sidebar-link[href="/${lang}/tools/image-studio"]`);
    const group=sidebarImage.locator('xpath=..');assert.equal(await group.locator("a").first().getAttribute("href"),`/${lang}/tools/image-studio`);
    let alignment;
    if(width===1440){
      await group.evaluate(el=>{const nav=el.closest(".sidebar-nav");nav.scrollTop+=el.getBoundingClientRect().y-nav.getBoundingClientRect().y-24;});
      alignment=await group.locator("a").evaluateAll(es=>es.map(e=>({href:e.getAttribute("href"),icon:e.firstElementChild.getBoundingClientRect().width,textX:e.lastElementChild.getBoundingClientRect().x})));
      for(const row of alignment){assert.ok(Math.abs(row.icon-30)<.5,JSON.stringify(row));assert.ok(Math.abs(row.textX-alignment[0].textX)<.5,JSON.stringify(alignment));}
    }
    await position(page.locator("#tool-category-media"));await settle(page);await page.screenshot({path:stem+"-catalog.png"});
    if(width===390){
      await page.getByRole("button",{name:lang==="ko"?"사이드바 접기/펼치기":"Toggle sidebar",exact:true}).click();
      const links=page.locator('.sheet-tool-item[href*="/tools/"]');await links.first().waitFor();
      const media=await links.evaluateAll(es=>es.map(e=>e.getAttribute("href")).filter(h=>/\/(image-studio|image-compare|product-banner|audio-studio)$/.test(h)));
      assert.equal(media[0],`/${lang}/tools/image-studio`);
      const banner=page.locator('.sheet-tool-item[href$="/product-banner"]');await banner.scrollIntoViewIfNeeded();
      alignment=await links.evaluateAll(es=>es.filter(e=>/\/(image-studio|image-compare|product-banner|audio-studio)$/.test(e.getAttribute("href"))).map(e=>({href:e.getAttribute("href"),icon:e.firstElementChild.getBoundingClientRect().width,textX:e.lastElementChild.getBoundingClientRect().x})));
      for(const row of alignment){assert.ok(Math.abs(row.icon-43)<.5,JSON.stringify(row));assert.ok(Math.abs(row.textX-alignment[0].textX)<.5,JSON.stringify(alignment));}
      await settle(page);await page.screenshot({path:stem+"-menu.png"});
      await page.getByRole("dialog").getByRole("button",{name:lang==="ko"?"닫기":"Close",exact:true}).click();
    }
    await fs.writeFile(stem+"-geometry.json",JSON.stringify(alignment,null,2));
    await page.goto(`${base}/${lang}/`,{waitUntil:"domcontentloaded"});
    const home=page.locator(`[data-ui-component="tool-card"][href="/${lang}/tools/image-studio"]`);await home.waitFor();assert.equal(await home.getByRole("heading").innerText(),name);await position(home);await settle(page);await page.screenshot({path:stem+"-home.png"});
    await page.goto(`${base}/${lang}/tools/image-studio/`,{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{level:1,name,exact:true}).waitFor();await page.getByTestId("library-image-editor").waitFor();await settle(page);
    assert.match(await page.title(),lang==="ko"?/온라인 이미지 편집/:/Online Image Editor/);
    assert.doesNotMatch(await page.locator('meta[name="description"]').getAttribute("content"),/사진 편집기|photo editor/i);
    assert.equal(new URL(page.url()).pathname,`/${lang}/tools/image-studio/`);
    await page.screenshot({path:stem+"-page.png"});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No page-level horizontal overflow");
  }finally{await context.close();}
});

test("generated metadata, feeds, catalog order and sitemap keep the same image-editor URLs",{skip:!!process.env.TEST_BASE_URL},async()=>{
  for(const lang of["ko","en"]){
    const name=lang==="ko"?"이미지 편집":"Image Editor",html=await fs.readFile(`dist/${lang}/tools/image-studio/index.html`,"utf8"),doc=new JSDOM(html).window.document;
    assert.match(doc.title,lang==="ko"?/온라인 이미지 편집/:/Online Image Editor/);
    assert.equal(doc.querySelector('link[rel="canonical"]').href,`https://worklazy.net/${lang}/tools/image-studio/`);
    assert.doesNotMatch(html,/사진 편집|Photo Editor|Image Studio|이미지 스튜디오/);
    assert.ok(doc.querySelector('script[type="application/ld+json"]').textContent.includes(name));
    const hub=new JSDOM(await fs.readFile(`dist/${lang}/tools/index.html`,"utf8")).window.document;
    const media=[...hub.querySelectorAll('a[href]')].filter(e=>/\/(image-studio|image-compare|product-banner|audio-studio)\/$/.test(e.getAttribute("href")));
    assert.ok(media.length>=4);assert.equal(media[0].getAttribute("href"),`/${lang}/tools/image-studio/`);assert.equal(media[0].textContent.trim(),name);
    const rss=new JSDOM(await fs.readFile(`dist/${lang}/rss.xml`,"utf8"),{contentType:"text/xml"}).window.document;
    const item=[...rss.querySelectorAll("item")].find(e=>e.querySelector("link").textContent===`https://worklazy.net/${lang}/tools/image-studio/`);assert.ok(item);assert.match(item.querySelector("title").textContent,lang==="ko"?/이미지 편집/:/Image Editor/);
  }
  const xml=await fs.readFile("dist/sitemap.xml","utf8");for(const lang of["ko","en"])for(const slug of["image-studio","image-studio/resize","image-studio/mosaic","image-studio/watermark"])assert.ok(xml.includes(`https://worklazy.net/${lang}/tools/${slug}/`));
});
