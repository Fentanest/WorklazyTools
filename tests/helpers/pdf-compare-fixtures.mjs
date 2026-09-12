import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const root=process.cwd(), out=process.argv[2];
if (!out) throw new Error('Output directory required');
const require=createRequire(root+'/package.json');
const {PDFDocument,PDFName,rgb}=require('pdf-lib');const fontkit=require('@pdf-lib/fontkit');
await fs.mkdir(out+'/fixtures',{recursive:true});await fs.mkdir(out+'/evidence',{recursive:true});

const bytes=await fs.readFile(root+'/public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf');
const cases=[['normal-ascii','ABC xyz'],['normal-ko','한글 라벨 주소'],['changed-word','ABD xyz'],['changed-ko','한글 라벨 품목'],['normal-number','ABC 123'],['changed-number','ABC 124'],['changed-color','ABC xyz']];
const manifest=[{id:'historical',texts:['김민수 서울 강남구 테헤란로 123','한글 라벨 주소 품목 설명','ABC 123 456 office ffi'],expected:['김민수堺서울堺강남구堺테헤란로 123','한글堺라벨堺주소堺품목堺설명','ABC 塨塩塪 填塬塭 office ffi'],kind:'historical-unmodified'}];
for(const [id,text] of cases){
 const doc=await PDFDocument.create();doc.setCreationDate(new Date('2026-09-09T00:00:00Z'));doc.setModificationDate(new Date('2026-09-09T00:00:00Z'));doc.registerFontkit(fontkit);
 const f=await doc.embedFont(bytes,{subset:false});const page=doc.addPage([600,300]);
 // Explicit per-character glyph stream and known-source ToUnicode oracle, isolated synthetic fixture construction only.
 let x=20;const map=new Map();for(const ch of text){const hex=f.encodeText(ch).toString().slice(1,-1);map.set(hex,ch.charCodeAt(0).toString(16).padStart(4,'0'));page.drawText(ch,{font:f,x,y:200,size:16,color:id==='changed-color'?rgb(1,0,0):rgb(0,0,0)});x+=f.widthOfTextAtSize(ch,16);}
 await doc.flush();const cmap=`/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /SyntheticKnownSource def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${map.size} beginbfchar\n${[...map].map(([a,b])=>`<${a}> <${b}>`).join('\n')}\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
 doc.context.lookup(f.ref).set(PDFName.of('ToUnicode'),doc.context.register(doc.context.flateStream(cmap)));
 await fs.writeFile(out+'/fixtures/'+id+'.pdf',await doc.save());await fs.writeFile(out+'/fixtures/'+id+'-cmap.txt',cmap);
 manifest.push({id,texts:[text],expected:[text],kind:'authored-normal-ToUnicode'});
}
const hist=await PDFDocument.create();hist.registerFontkit(fontkit);const hf=await hist.embedFont(bytes,{subset:false});for(const text of manifest[0].texts)hist.addPage([600,300]).drawText(text,{font:hf,x:20,y:200,size:16});await fs.writeFile(out+'/fixtures/historical.pdf',await hist.save());
for (const [id,dimensions,image] of [['blank',[600,300],false],['small-blank',[500,300],false],['large-blank',[6000,3000],false],['image',[600,300],true]]) { const doc=await PDFDocument.create();const p=doc.addPage(dimensions);if(image){const png=await doc.embedPng(require('pngjs').PNG.sync.write({width:1,height:1,data:Buffer.from([0,0,0,255])}));p.drawImage(png,{x:30,y:30,width:80,height:80});}await fs.writeFile(out+'/fixtures/'+id+'.pdf',await doc.save()); }
const multi=await PDFDocument.create();for (const name of ['normal-ascii','normal-number','normal-ko']){const d=await PDFDocument.load(await fs.readFile(out+'/fixtures/'+name+'.pdf'));const [p]=await multi.copyPages(d,[0]);multi.addPage(p);}await fs.writeFile(out+'/fixtures/multi.pdf',await multi.save());
await fs.writeFile(out+'/fixtures/manifest.json',JSON.stringify(manifest,null,2));console.log('fixed fixtures:',manifest.length,'PDFs',manifest.reduce((a,b)=>a+b.texts.length,0),'pages');
