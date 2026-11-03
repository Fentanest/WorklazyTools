import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const output=process.env.BG_QUALITY_OUTPUT ?? 'scratch/bg-quality/comparison';
fs.mkdirSync(output,{recursive:true});
const cases=(process.env.BG_QUALITY_CASES ?? 'product:wasm:shapes,product:wasm:bottle,product:wasm:shaded-bottle,product:webgpu:shapes,product:webgpu:bottle,product:webgpu:shaded-bottle,person:wasm:shapes,person:wasm:bottle,person:wasm:shaded-bottle,product:wasm:bottle:constant-gpu').split(',').map(s=>s.split(':'));
const facts=[];
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-unsafe-swiftshader'],executablePath:'/home/better0101/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'});
try {
const page=await browser.newPage(); page.on('console',m=>{if(m.type()==='error') console.log(m.text().slice(0,300));});
await page.goto('http://127.0.0.1:4192'); await page.waitForFunction(()=>window.ready);
const capabilities=await page.evaluate(async()=>{const a=await navigator.gpu?.requestAdapter();return {gpu:!!a,info:a?.info,features:a?[...a.features]:[],memory:navigator.deviceMemory};});
fs.writeFileSync(`${output}/capabilities.json`,JSON.stringify(capabilities,null,2));
console.log(JSON.stringify(capabilities));
for(const [mode,ep,name,scenario] of cases) await test(`${mode}:${ep}:${name}${scenario?':'+scenario:''}`, async t => {
const r=await page.evaluate(async({mode,ep,name,scenario})=>{
 const c=new OffscreenCanvas(name==='shapes'?960:1000,name==='shapes'?640:1000),x=c.getContext('2d');
 const truth=new OffscreenCanvas(c.width,c.height),t=truth.getContext('2d');
 x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
 if(name==='shapes') { const g=x.createLinearGradient(0,0,c.width,c.height);g.addColorStop(0,'#a8d7ec');g.addColorStop(1,'#efd4b8');x.fillStyle=g;x.fillRect(0,0,c.width,c.height);for(const q of [x,t]){q.fillStyle=q===t?'#fff':'#e32122';q.beginPath();q.arc(350,310,145,0,Math.PI*2);q.fill();q.fillStyle=q===t?'#fff':'#171717';q.fillRect(590,170,210,310);}}
 else {if(name==='shaded-bottle'){let g=x.createLinearGradient(0,0,0,1000);g.addColorStop(0,'#e9e5dd');g.addColorStop(.7,'#faf8f0');g.addColorStop(1,'#c8c1b4');x.fillStyle=g;x.fillRect(0,0,1000,1000);x.save();x.filter='blur(18px)';x.fillStyle='#0004';x.beginPath();x.ellipse(525,866,210,36,0,0,Math.PI*2);x.fill();x.restore();}
 for(const q of [x,t]){q.fillStyle=q===t?'#fff':'#168c42';if(q===x&&name==='shaded-bottle'){let g=x.createLinearGradient(340,0,660,0);g.addColorStop(0,'#083923');g.addColorStop(.25,'#318f53');g.addColorStop(.42,'#73b78a');g.addColorStop(.55,'#297f4c');g.addColorStop(1,'#083b23');q.fillStyle=g;}q.beginPath();q.roundRect(350,320,300,530,45);q.fill();q.fillRect(425,180,150,180);q.fillStyle=q===t?'#fff':'#133d28';q.fillRect(420,150,160,65);}
 if(name==='shaded-bottle'){x.fillStyle='#f4e9ca';x.fillRect(370,470,260,220);x.fillStyle='#29583e';x.font='bold 34px sans-serif';x.textAlign='center';x.fillText('BOTANICAL',500,550);x.font='24px sans-serif';x.fillText('OLIVE OIL',500,600);x.fillStyle='#fff6';x.fillRect(393,356,12,94);}}
 const input=await c.convertToBlob();const r=await window.qualityProbe(mode,ep,input,scenario);
 r.inputPng=Array.from(new Uint8Array(await input.arrayBuffer()));r.truthPng=Array.from(new Uint8Array(await (await truth.convertToBlob()).arrayBuffer()));
 if(r.ok){const b=await createImageBitmap(r.blob),o=new OffscreenCanvas(b.width,b.height),q=o.getContext('2d');q.drawImage(b,0,0);const a=q.getImageData(0,0,b.width,b.height).data,gt=t.getImageData(0,0,b.width,b.height).data;let min=255,max=0,sum=0,sum2=0,zero=0,opaque=0,fg=0,bg=0,fgOpaque=0,bgZero=0,intersection=0,union=0;const hist=new Array(256).fill(0);for(let i=3;i<a.length;i+=4){const v=a[i];min=Math.min(min,v);max=Math.max(max,v);sum+=v;sum2+=v*v;hist[v]++;if(v<=5)zero++;if(v>=250)opaque++;const f=gt[i]>127,p=v>=128;if(f){fg++;if(v>=250)fgOpaque++;}else{bg++;if(v<=5)bgZero++;}if(f&&p)intersection++;if(f||p)union++;}r.alpha={min,max,mean:sum/(a.length/4),variance:sum2/(a.length/4)-(sum/(a.length/4))**2,zero,opaque,hist,fgOpaqueFraction:fgOpaque/fg,bgZeroFraction:bgZero/bg,iou:intersection/union};r.png=Array.from(new Uint8Array(await r.blob.arrayBuffer()));delete r.blob;delete r.mask;}return r;
},{mode,ep,name,scenario});
const id=`${mode}-${ep}-${name}${scenario?'-'+scenario:''}`;
for(const [key,suffix] of [['png','output'],['inputPng','input'],['truthPng','truth']]){if(r[key]){fs.writeFileSync(`${output}/${id}-${suffix}.png`,Buffer.from(r[key]));delete r[key];}}
fs.writeFileSync(`${output}/${id}.json`,JSON.stringify(r,null,2));
facts.push({id,...r});fs.writeFileSync(`${output}/summary.json`,JSON.stringify(facts,null,2));
if(ep==='wasm'||capabilities.features.includes('shader-f16')){assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.maskStats.nonfinite,0);assert.ok(r.maskStats.variance>1e-6);if(mode==='product'){assert.ok(r.alpha.iou>.95);assert.ok(r.alpha.fgOpaqueFraction>.9);assert.ok(r.alpha.bgZeroFraction>.95);}}
if(scenario){assert.equal(r.events.filter(e=>e.simulated).length,1);assert.equal(r.events.filter(e=>e.fallback).length,1);assert.equal(r.events.filter(e=>e.simulated===false&&e.provider==='wasm').length,1);}
if(!r.ok&&!capabilities.features.includes('shader-f16')) t.skip('no shader-f16: raw GPU inference unavailable');
});
}finally{await browser.close();}
