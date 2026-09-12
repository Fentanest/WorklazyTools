import fs from 'node:fs';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
import { PDFDocument, PDFName, StandardFonts, rgb, degrees } from 'pdf-lib';
const index=process.argv.indexOf('--out');
if(index<0||!process.argv[index+1])throw Error('Use --out with an explicit synthetic fixture directory');
const out=path.resolve(process.argv[index+1]);fs.mkdirSync(out,{recursive:true});
async function normal(){
 const pdf=await PDFDocument.create({updateMetadata:false});const font=await pdf.embedFont(StandardFonts.Helvetica);
 for(let i=0;i<3;i++){
  const page=pdf.addPage(i===1?[260.25,300.5]:[240,320]);page.setCropBox(7,11,i===1?240.125:220,280);page.setRotation(degrees(i*90));
  if(i===2)page.node.set(PDFName.of('UserUnit'),pdf.context.obj(2));
  page.drawText('SYNTHETIC SECRET CANARY '+i,{x:20,y:90,size:12,font,color:rgb(.1,.2,.5)});
  page.drawRectangle({x:30,y:130,width:120,height:60,color:rgb(.8,.4,.1)});
 }
 pdf.setTitle('SYNTHETIC_METADATA_CANARY');return pdf;
}
const write=async(name,pdf)=>fs.writeFileSync(path.join(out,name+'.pdf'),await pdf.save({useObjectStreams:false}));
await write('three-pages',await normal());
for(const kind of ['xfa','bad-unit','bad-crop','duplicate-tree','cyclic-tree','page-limit']){
 const pdf=await normal();
 if(kind==='xfa')pdf.catalog.set(PDFName.of('AcroForm'),pdf.context.obj({XFA:pdf.context.obj('SYNTHETIC_XFA')}));
 if(kind==='bad-unit')pdf.getPage(0).node.set(PDFName.of('UserUnit'),pdf.context.obj(0));
 if(kind==='bad-crop')pdf.getPage(0).node.set(PDFName.of('CropBox'),pdf.context.obj([30,20,10,10]));
 if(kind==='page-limit')for(let i=3;i<101;i++)pdf.addPage([40,40]);
 if(kind==='duplicate-tree'||kind==='cyclic-tree'){
  const tree=pdf.catalog.Pages(),kids=tree.Kids();
  if(kind==='duplicate-tree')kids.push(kids.get(0));else kids.push(pdf.catalog.get(PDFName.of('Pages')));
 }
 await write(kind,pdf);
}
const a4=await PDFDocument.create({updateMetadata:false});a4.addPage([595.28,841.89]);await write('a4',a4);
fs.writeFileSync(path.join(out,'damaged.pdf'),'%PDF-1.7\ncorrupt synthetic document');
console.log('Generated only synthetic PDF fixtures:',out);

function crc(bytes){let c=0xffffffff;for(const v of bytes){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4);data.copy(out,8);out.writeUInt32BE(crc(out.subarray(4,-4)),out.length-4);return out;}
const header=Buffer.alloc(13);header.writeUInt32BE(16);header.writeUInt32BE(16,4);header[8]=8;header[9]=3;const scan=Buffer.alloc(17*16);for(let y=0;y<16;y++)for(let x=0;x<16;x++)scan[y*17+x+1]=x<8?0:1;
const palette=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('PLTE',Buffer.from([255,0,0,0,0,255])),chunk('tRNS',Buffer.from([128,255])),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);fs.writeFileSync(path.join(out,'palette-alpha.png'),palette);
