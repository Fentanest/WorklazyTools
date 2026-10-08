import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PDFDocument,StandardFonts,rgb,degrees,setTextRenderingMode,TextRenderingMode,pushGraphicsState,popGraphicsState,PDFName,PDFArray} from 'pdf-lib';
import {PNG} from 'pngjs';
const out=path.resolve('tests/fixtures/document-conversion-engines');
await fs.mkdir(out,{recursive:true});
const write=async(name,doc)=>{doc.setCreationDate(new Date('2026-10-08T00:00:00Z'));doc.setModificationDate(new Date('2026-10-08T00:00:00Z'));await fs.writeFile(path.join(out,name),await doc.save({useObjectStreams:false}));};
const rich=await PDFDocument.load(await fs.readFile('tests/fixtures/document-converters/rich.pdf'));
const scan=await PDFDocument.load(await fs.readFile('tests/fixtures/document-converters/scanned.pdf'));
const mixed=await PDFDocument.create();
for(const [src,index] of [[rich,0],[scan,0]])mixed.addPage((await mixed.copyPages(src,[index]))[0]);
mixed.addPage([420,595]);
const short=mixed.addPage((await mixed.copyPages(scan,[0]))[0]);const font=await mixed.embedFont(StandardFonts.Helvetica);
short.drawRectangle({x:15,y:short.getHeight()-29,width:130,height:24,color:rgb(1,1,1)});short.drawText('SHORT TITLE',{x:18,y:short.getHeight()-22,font,size:12});
const rotated=mixed.addPage((await mixed.copyPages(rich,[1]))[0]);rotated.setRotation(degrees(90));
await write('mixed-five.pdf',mixed);
const title=await PDFDocument.create();title.addPage((await title.copyPages(mixed,[3]))[0]);await write('short-title-scan.pdf',title);
const oracle=await PDFDocument.create();const p=oracle.addPage([600,800]);const f=await oracle.embedFont(StandardFonts.Helvetica);
for(const [text,x,y,size] of [['SCAN BODY',50,720,24],['FIRST PAGE',50,665,20],['Item',55,565,18],['Count',305,565,18],['Apples',55,505,18],['42',305,505,18]])p.drawText(text,{x,y,size,font:f});
for(const x of[45,295,545])p.drawLine({start:{x,y:485},end:{x,y:595},thickness:1});
for(const y of[485,545,595])p.drawLine({start:{x:45,y},end:{x:545,y},thickness:1});
p.drawRectangle({x:390,y:650,width:90,height:55,color:rgb(.8,.05,.1)});p.drawText('STAMP',{x:396,y:674,font:f,size:16,color:rgb(1,1,1)});
await write('ocr-oracle-digital.pdf',oracle);
const twoTables=await PDFDocument.create();twoTables.addPage((await twoTables.copyPages(oracle,[0]))[0]);twoTables.addPage((await twoTables.copyPages(oracle,[0]))[0]);await write('two-table-pages.pdf',twoTables);
execFileSync('pdftoppm',['-png','-singlefile','-scale-to','1600',path.join(out,'ocr-oracle-digital.pdf'),path.join(out,'oracle')]);
const png=await fs.readFile(path.join(out,'oracle.png'));
const blankBitmap=new PNG({width:600,height:800});blankBitmap.data.fill(255);const blankScan=await PDFDocument.create();blankScan.addPage([600,800]).drawImage(await blankScan.embedPng(PNG.sync.write(blankBitmap)),{x:0,y:0,width:600,height:800});await write('blank-scan.pdf',blankScan);
const mixedBlank=await PDFDocument.create();mixedBlank.addPage((await mixedBlank.copyPages(rich,[0]))[0]);mixedBlank.addPage((await mixedBlank.copyPages(blankScan,[0]))[0]);await write('mixed-digital-blank-scan.pdf',mixedBlank);
const sourcePng=PNG.sync.read(png), halfHeight=Math.floor(sourcePng.height/2), stride=sourcePng.width*4;
const splitPng=offset=>{const part=new PNG({width:sourcePng.width,height:halfHeight});part.data.set(sourcePng.data.subarray(offset*stride,(offset+halfHeight)*stride));return PNG.sync.write(part);};
const upper=splitPng(0),lower=splitPng(halfHeight);
for(const sparseLayer of[false,true]){
 const d=await PDFDocument.create(),page=d.addPage([600,800]);
 page.drawImage(await d.embedPng(upper),{x:0,y:400,width:600,height:400});
 page.drawImage(await d.embedPng(lower),{x:0,y:0,width:600,height:400});
 if(sparseLayer){const font=await d.embedFont(StandardFonts.Helvetica);page.pushOperators(pushGraphicsState(),setTextRenderingMode(TextRenderingMode.Invisible));page.drawText('SCAN BODY',{x:50,y:720,size:24,font});page.pushOperators(popGraphicsState());}
 await write(sparseLayer?'two-tile-sparse-ocr.pdf':'two-tile-scan.pdf',d);
}
for(const mode of['none','type3','opacity0']){
 const d=await PDFDocument.create();const page=d.addPage([600,800]);page.drawImage(await d.embedPng(png),{x:0,y:0,width:600,height:800});
 if(mode!=='none'){
 const font=await d.embedFont(StandardFonts.Helvetica);
 if(mode==='type3')page.pushOperators(pushGraphicsState(),setTextRenderingMode(TextRenderingMode.Invisible));
 for(const [text,x,y,size] of [['SCAN BODY',50,720,24],['FIRST PAGE',50,665,20],['Item',55,565,18],['Count',305,565,18],['Apples',55,505,18],['42',305,505,18]])page.drawText(text,{x,y,size,font,...(mode==='opacity0'?{opacity:0}:{})});
 if(mode==='type3')page.pushOperators(popGraphicsState());
 }
 await write(`scan-${mode}.pdf`,d);
}
const rotatedScan=await PDFDocument.create(),rotatedPage=rotatedScan.addPage([800,600]);rotatedPage.setRotation(degrees(90));rotatedPage.drawImage(await rotatedScan.embedPng(png),{x:800,y:0,width:600,height:800,rotate:degrees(90)});await write('rotated-upright-scan.pdf',rotatedScan);
const rotatedSparse=await PDFDocument.load(await fs.readFile(path.join(out,'rotated-upright-scan.pdf'))),sparsePage=rotatedSparse.getPage(0),rotatedFont=await rotatedSparse.embedFont(StandardFonts.Helvetica);sparsePage.pushOperators(pushGraphicsState(),setTextRenderingMode(TextRenderingMode.Invisible));sparsePage.drawText('SCAN BODY',{x:80,y:50,size:24,font:rotatedFont,rotate:degrees(90)});sparsePage.pushOperators(popGraphicsState());await write('rotated-sparse-ocr.pdf',rotatedSparse);
const geom=await PDFDocument.create();const g=geom.addPage([600,800]);const gf=await geom.embedFont(StandardFonts.Helvetica);g.setCropBox(40,60,500,660);g.setRotation(degrees(90));
g.drawRectangle({x:40,y:60,width:500,height:660,borderColor:rgb(1,0,0),borderWidth:8});g.drawText('CROP TOP',{x:65,y:675,font:gf,size:26});g.drawText('CROP BOTTOM',{x:65,y:85,font:gf,size:20});
const ann=geom.context.obj({Type:'Annot',Subtype:'Square',Rect:[440,630,520,700],C:[0,0,1],BS:{W:5,S:'S'},F:4});g.node.set(PDFName.of('Annots'),geom.context.obj([geom.context.register(ann)]));await write('rotated-cropped-annotation.pdf',geom);
const noted=await PDFDocument.create(),notePage=noted.addPage([400,400]);const note=noted.context.obj({Type:'Annot',Subtype:'Text',Rect:[200,200,225,225],Contents:'Visible test note',F:4});notePage.node.set(PDFName.of('Annots'),noted.context.obj([noted.context.register(note)]));await write('text-note.pdf',noted);
execFileSync('pdftoppm',['-png','-singlefile','-scale-to','6400',path.join(out,'ocr-oracle-digital.pdf'),path.join(out,'highres')]);
const big=await PDFDocument.create();const bi=await big.embedPng(await fs.readFile(path.join(out,'highres.png')));for(let i=0;i<6;i++)big.addPage([600,800]).drawImage(bi,{x:0,y:0,width:600,height:800});await write('high-resolution-six.pdf',big);
const files=(await fs.readdir(out)).filter(f=>f.endsWith('.pdf'));const manifest={};for(const file of files){const bytes=await fs.readFile(path.join(out,file));let pages;try{pages=(await PDFDocument.load(bytes)).getPageCount();}catch(error){if(!/encrypted/i.test(String(error)))throw error;pages=Number(execFileSync('pdfinfo',[path.join(out,file)],{encoding:'utf8'}).match(/^Pages:\s*(\d+)/m)?.[1]);if(!pages)throw error;}manifest[file]={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),pages};}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
