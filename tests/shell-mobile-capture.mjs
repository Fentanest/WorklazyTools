import {chromium} from 'playwright';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {startRecoveryServer} from './recovery-server.mjs';
const output=path.resolve(process.env.SHELL_MOBILE_OUTPUT||'scratch/shell-a11y/mobile');await fs.mkdir(output,{recursive:true});
const server=await startRecoveryServer({root:process.env.SHELL_DIST||'dist',port:0});const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});const rows=[];
const tools=['text-tools','text-formatter','data-converter','payroll-calculator','timezone-calculator','product-banner'];
try{for(const lang of ['ko','en'])for(const theme of ['light-coral','dark-coral']){
 const context=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:'block'});
 await context.addInitScript(theme=>{if(window===window.top)localStorage.setItem('worklazy-theme',theme);},theme);
 await context.route('**/*',r=>{const u=new URL(r.request().url());return !/^https?:$/u.test(u.protocol)||u.origin===server.url?r.continue():r.abort();});
 try{for(const tool of tools){const page=await context.newPage();await page.goto(`${server.url}/${lang}/tools/${tool}/`,{waitUntil:'domcontentloaded'});await page.locator('[data-tool-page]').waitFor({timeout:45000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
 const data=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,legacyBanner:document.querySelectorAll('.privacy-consent').length,oldAcceptButtons:[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Accept and continue').length}));assert.equal(data.oldAcceptButtons,0,'retired consent button must not return');assert.equal(data.legacyBanner,0);
 const shot=path.join(output,`${lang}-${theme}-${tool}-320.png`);await page.screenshot({path:shot});rows.push({lang,theme,tool,...data,screenshot:shot});await page.close();}}
 finally{await context.close();}
}
console.log(JSON.stringify({screenshots:rows.length,legacyBanner:rows.reduce((n,r)=>n+r.legacyBanner,0),oldAcceptButtons:rows.reduce((n,r)=>n+r.oldAcceptButtons,0)}));}
finally{await browser.close();await server.close();await fs.writeFile(path.join(output,'results.json'),JSON.stringify(rows,null,2));}
