import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4196';
const b=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();p.setDefaultTimeout(90_000);
const fixture=await fs.readFile('tests/fixtures/redaction-export/photo.png');
await p.goto(`${base}/tests/ie1/engine.html`);await p.waitForFunction(()=>window.ready);
try { await test('installed fork warning and z-order contracts',async t=>{
 const run=fn=>p.evaluate(fn,fixture.toString('base64'));
 await t.test('nested tags and session flag survive cloning, undo/delete, template reload; new image resets',async()=>{
  const result=await run(async data=>{
   const e=await window.newEngine();await e.loadImage('data:image/png;base64,'+data);
   e.addRedactionMarquee();e.setMarquee({left:140,top:170,width:360,height:120});await e.applyRedaction('solid');
   const object=e.canvas.getObjects().find(o=>o.get('aspRole')==='redaction');
   const clone=await object.clone();e.canvas.remove(object);e.canvas.add(new window.api.fabric.Group([new window.api.fabric.Group([clone])]));
   const nested=e.hasConcealment,marker=JSON.stringify(e.canvas.toJSON()).includes('aspConcealment');
   await e.undo();const undo=e.hasConcealment;
   e.canvas.getObjects().filter(o=>o.get('aspId')!=='base').forEach(o=>e.canvas.remove(o));const removed=e.hasConcealment;
   const template=await e.exportTemplate();await e.loadScene(template);const reloaded=e.hasConcealment;
   await e.loadImage('data:image/png;base64,'+data);return {nested,marker,undo,removed,reloaded,reset:e.hasConcealment};
  });assert.deepEqual(result,{nested:true,marker:true,undo:true,removed:true,reloaded:true,reset:false});
 });
 await t.test('all download/API/template paths gate outputs; cancelling leaves source intact',async()=>{
  const result=await run(async data=>{
   const calls=[];const e=await window.newEngine({onBeforeExport:context=>{calls.push(context);return 'cancel';}});
   await e.loadImage('data:image/png;base64,'+data);e.addRedactionMarquee();e.setMarquee({left:100,top:100,width:100,height:80});await e.applyRedaction('solid');
   const source=JSON.stringify(e.canvas.toJSON()),codes=[];
   for(const path of ['api','download','commit'])for(const format of ['png','jpeg','webp','pdf','svg','json'])try{await e.exportImage(format,95,[format],path);}catch(error){codes.push(error.code);}
   try{await e.exportTemplate();}catch(error){codes.push(error.code);}
   let syncBlocked=false;try{e.exportScene();}catch{syncBlocked=true;}
   return{calls,codes,syncBlocked,unchanged:source===JSON.stringify(e.canvas.toJSON())};
  });assert.equal(result.calls.length,19);assert.equal(result.codes.length,19);assert.ok(result.codes.every(code=>code==='export-cancelled'));assert.ok(result.calls.every(call=>call.hasConcealment));assert.ok(result.unchanged&&result.syncBlocked);
 });
 await t.test('remote and nested SVG template sources fail before any external request',async()=>{
  const requests=[];p.on('request',r=>{if(!r.url().startsWith(base+'/'))requests.push(r.url());});
  const result=await run(async data=>{
   const e=await window.newEngine();await e.loadImage('data:image/png;base64,'+data);const template=JSON.parse(await e.exportTemplate()),codes=[];
   for(const src of ['https://example.invalid/private.png','/remote.png','data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.invalid/x"/></svg>')]) {
    template.snapshot.json.objects[0].src=src;try{await e.loadScene(JSON.stringify(template));}catch(error){codes.push(error.code);}
   }return codes;
  });assert.deepEqual(result,['template-remote-source','template-remote-source','template-remote-source']);assert.deepEqual(requests,[]);
 });
 await t.test('real background removal inserted below existing solid patch',async()=>{
  const result=await run(async data=>{
   const e=await window.newEngine();await e.loadImage('data:image/png;base64,'+data);e.addRedactionMarquee();e.setMarquee({left:140,top:170,width:360,height:120});await e.applyRedaction('solid');
   const before=e.canvas.getObjects().map(o=>({id:o.get('aspId'),role:o.get('aspRole')}));await e.removeImageBackground('replace');
   const after=e.canvas.getObjects().map(o=>({id:o.get('aspId'),role:o.get('aspRole')}));
   const c=e.canvas.toCanvasElement(1),d=c.getContext('2d').getImageData(160,190,1,1).data;
   return{before,after,pixel:Array.from(d),concealment:e.hasConcealment};
  });assert.deepEqual(result.after,result.before);assert.deepEqual(result.pixel,[11,15,26,255]);assert.ok(result.concealment);
 });
 });} finally{await b.close();}
