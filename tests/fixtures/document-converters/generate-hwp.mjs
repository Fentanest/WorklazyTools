import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../../..');const require=createRequire(root+'/package.json');const {PNG}=require('pngjs');
const {default:init,HwpDocument}=await import(root+'/node_modules/@rhwp/core/rhwp.js');
await init({module_or_path:await fs.readFile(root+'/node_modules/@rhwp/core/rhwp_bg.wasm')});
const doc=HwpDocument.createEmpty();
const check = result => { const parsed=JSON.parse(result); if (!parsed.ok) throw Error(result); return parsed; };
check(doc.insertText(0,0,0,'한글 HWP PDF 검증 FIRST PAGE'));
const append = () => { const index=doc.getParagraphCount(0); check(doc.insertParagraph(0,index)); return index; };
const table = check(doc.createTable(0,append(),0,2,2));
for(const [index,text] of ['항목','수량','테스트','42'].entries()) check(doc.insertTextInCell(0,table.paraIdx,table.controlIdx,index,0,0,text));
const png=new PNG({width:80,height:40});for(let i=0;i<png.data.length;i+=4)png.data.set([213,50,40,255],i);
check(doc.insertPicture(0,append(),0,'[]',PNG.sync.write(png),6000,3000,80,40,'png','synthetic coral rectangle'));
const second = check(doc.insertPageBreak(0,append(),0));
check(doc.insertText(0,second.paraIdx,0,'한글 SECOND PAGE'));
await fs.writeFile(root+'/tests/fixtures/document-converters/rich.hwp',doc.exportHwp());
try { await fs.writeFile(root+'/tests/fixtures/document-converters/rich.hwpx',doc.exportHwpx()); console.log('rich hwpx exported'); }
catch(error) { console.log('Rich HWPX export unsupported for this synthetic source:',String(error)); }
doc.free();

const simple=HwpDocument.createEmpty();simple.insertText(0,0,0,'한글 HWP PDF 검증 FIRST PAGE');
await fs.writeFile(root+'/tests/fixtures/document-converters/sample.hwp',simple.exportHwp());
await fs.writeFile(root+'/tests/fixtures/document-converters/sample.hwpx',simple.exportHwpx());simple.free();
