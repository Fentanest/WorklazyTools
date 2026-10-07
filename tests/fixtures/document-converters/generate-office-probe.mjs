import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const root=path.resolve(import.meta.dirname,'../../..');
const require=createRequire(root+'/package.json');
const puppeteer=require('puppeteer-core');
const {PDFDocument}=require('pdf-lib');
const out=process.env.CONVERTER_FIXTURE_DIR || '/tmp/worklazy-office-pdf-fixture-regeneration';
await fs.mkdir(out,{recursive:true});
const vendor=root+'/public/vendor/zetaoffice/2026-10-07';
const thread=`'use strict';
Module.zetajs.then(z=> {
const css=z.uno.com.sun.star, desktop=css.frame.Desktop.create(z.getUnoComponentContext());
const prop=(Name,Value)=>new css.beans.PropertyValue({Name,Value});
z.mainPort.onmessage=({data})=>{
 let model;
 try{
  if(data.cmd==='create'){
   model=desktop.loadComponentFromURL('private:factory/'+data.factory,'_blank',0,[prop('Hidden',true)]);
   if(data.factory==='swriter') {model.getText().setString('한글 문서 PDF 확인\\nOffice PDF probe');model.getText().createTextCursor().setPropertyValue('CharFontName','NanumGothic');}
   if(data.factory==='scalc') {const s=model.getSheets().getByIndex(0); s.getCellByPosition(0,0).setString('한글 표 PDF 확인');s.getCellByPosition(1,0).setString('Second cell');s.getCellByPosition(0,1).setValue(42);s.getCellRangeByName('A1:B2').setPropertyValue('CharFontName','NanumGothic');}
   if(data.factory==='simpress') {const slide=model.getDrawPages().getByIndex(0); const shape=model.createInstance('com.sun.star.drawing.TextShape'); slide.add(shape);shape.setPosition(new css.awt.Point({X:1000,Y:1000}));shape.setSize(new css.awt.Size({Width:22000,Height:6000}));shape.setString('한글 발표 PDF 확인');shape.setPropertyValue('CharFontName','NanumGothic');}
  }else{
   model=desktop.loadComponentFromURL('file:///tmp/'+data.input,'_blank',0,[prop('Hidden',true),prop('MacroExecutionMode',0),prop('UpdateDocMode',0)]);
  }
  if(!model)throw Error('no model');
  model.storeToURL('file:///tmp/'+data.output,[prop('FilterName',data.filter),prop('Overwrite',true)]);
  z.mainPort.postMessage({ok:true,output:data.output});
 }catch(e){z.mainPort.postMessage({ok:false,error:String(e),data});}
 finally{try{model?.dispose();}catch{}}
};z.mainPort.postMessage({ready:true});
});`;
const html=`<html><body><canvas id="qtcanvas"></canvas><script>
window.probeMessages=[];
window.Module={canvas:document.getElementById('qtcanvas'),uno_scripts:[location.origin+'/assets/zeta.js',location.origin+'/thread.js'],locateFile:p=>location.origin+'/assets/'+p,mainScriptUrlOrBlob:new Blob(["importScripts('"+location.origin+"/assets/soffice.js');"],{type:'text/javascript'}),preRun:[()=>{for(const p of ['/usr','/usr/share','/usr/share/fonts'])try{FS.mkdir(p)}catch{};FS.writeFile('/usr/share/fonts/NanumGothic-Regular.ttf',new Uint8Array(window.fontBytes));}]};
(async()=>{window.fontBytes=await(await fetch('/assets/NanumGothic-Regular.ttf')).arrayBuffer();const script=document.createElement('script');script.src='/assets/soffice.js';script.onload=async()=>{window.probePort=await Module.uno_main;probePort.onmessage=e=>probeMessages.push(e.data);};document.body.append(script);})();
</script></body></html>`;
const server=http.createServer(async(req,res)=>{try{
res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);}
else if(req.url==='/thread.js'){res.setHeader('Content-Type','text/javascript');res.end(thread);}
else if(/^\/assets\/[\w.-]+$/.test(req.url)){const name=req.url.slice(8);res.setHeader('Content-Type',name.endsWith('.wasm')?'application/wasm':name.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(await fs.readFile(path.join(vendor,name)));}
else{res.statusCode=404;res.end();}
}catch(e){res.statusCode=500;res.end(String(e));}});
await new Promise(r=>server.listen(4191,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],protocolTimeout:180000});
try{
 const page=await browser.newPage();page.on('console',m=>console.log('[browser]',m.type(),m.text()));page.on('pageerror',e=>console.error('[pageerror]',e.message));
 await page.goto('http://127.0.0.1:4191');await page.waitForFunction(()=>window.probeMessages?.some(m=>m.ready),{timeout:180000});
 console.log('RUNTIME_READY',await page.evaluate(()=>({isolated:crossOriginIsolated,font:FS.stat('/usr/share/fonts/NanumGothic-Regular.ttf').size})));
 const results=[];
 for(const [factory,ext,filter,pdfFilter] of [['swriter','docx','Office Open XML Text','writer_pdf_Export'],['swriter','doc','MS Word 97','writer_pdf_Export'],['scalc','xlsx','Calc MS Excel 2007 XML','calc_pdf_Export'],['scalc','xls','MS Excel 97','calc_pdf_Export'],['simpress','pptx','Impress MS PowerPoint 2007 XML','impress_pdf_Export'],['simpress','ppt','MS PowerPoint 97','impress_pdf_Export']]){
  const send=async(data)=>{await page.evaluate(data=>{probeMessages.length=0;probePort.postMessage(data);},data);await page.waitForFunction(()=>probeMessages.length,{timeout:90000});const result=await page.evaluate(()=>probeMessages[0]);if(!result.ok)throw Error(JSON.stringify(result));};
  try{
   await send({cmd:'create',factory,output:'sample.'+ext,filter});
   await send({cmd:'convert',input:'sample.'+ext,output:ext+'.pdf',filter:pdfFilter});
   const [input,pdf]=await page.evaluate(ext=>[Array.from(FS.readFile('/tmp/sample.'+ext)),Array.from(FS.readFile('/tmp/'+ext+'.pdf'))],ext);
   await fs.writeFile(out+'/sample.'+ext,Buffer.from(input));await fs.writeFile(out+'/'+ext+'.pdf',Buffer.from(pdf));
   const doc=await PDFDocument.load(Uint8Array.from(pdf));results.push({ext,inputBytes:input.length,pdfBytes:pdf.length,pages:doc.getPageCount(),ok:true});
  }catch(e){results.push({ext,ok:false,error:String(e)});}
  console.log('RESULT',JSON.stringify(results.at(-1)));
 }
 await fs.writeFile(out+'/result.json',JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
