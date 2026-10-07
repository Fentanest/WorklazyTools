// Deterministic, synthetic quality inputs; no user document content.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import {PNG} from 'pngjs';
import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
const directory=import.meta.dirname;
const fixed=new Date('2000-01-01T00:00:00Z');
const png=new PNG({width:160,height:80});
for(let y=0;y<80;y++)for(let x=0;x<160;x++)png.data.set(x<80?[220,40,30,255]:[20,150,70,255],(y*160+x)*4);
const image=PNG.sync.write(png);
const doc=await JSZip.loadAsync(await fs.readFile(path.join(directory,'sample.docx')));
const text=value=>`<w:p><w:r><w:rPr><w:rFonts w:ascii="NanumGothic" w:eastAsia="NanumGothic"/><w:sz w:val="24"/></w:rPr><w:t>${value}</w:t></w:r></w:p>`;
const table=`<w:tbl><w:tblPr><w:tblW w:w="7000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="8"/><w:left w:val="single" w:sz="8"/><w:bottom w:val="single" w:sz="8"/><w:right w:val="single" w:sz="8"/><w:insideH w:val="single" w:sz="8"/><w:insideV w:val="single" w:sz="8"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3500"/><w:gridCol w:w="3500"/></w:tblGrid>${[['항목','금액'],['합계','42']].map(row=>`<w:tr>${row.map(cell=>`<w:tc><w:tcPr><w:tcW w:w="3500" w:type="dxa"/></w:tcPr>${text(cell)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
const drawing=`<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="1524000" cy="762000"/><wp:docPr id="77" name="Synthetic red green image"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="77" name="fixture.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="fixtureImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1524000" cy="762000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
doc.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${text('한글 품질 확인 — FIRST PAGE')}${table}${drawing}<w:p><w:r><w:br w:type="page"/></w:r></w:p>${text('둘째 페이지 SECOND PAGE')}${text('문단과 표, 이미지 및 페이지 나누기 시험')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`);
let relationships=await doc.file('word/_rels/document.xml.rels').async('string');
doc.file('word/_rels/document.xml.rels',relationships.replace('</Relationships>','<Relationship Id="fixtureImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/fixture.png"/></Relationships>'));
let contentTypes=await doc.file('[Content_Types].xml').async('string');if(!contentTypes.includes('Extension="png"'))contentTypes=contentTypes.replace('</Types>','<Default Extension="png" ContentType="image/png"/></Types>');doc.file('[Content_Types].xml',contentTypes);doc.file('word/media/fixture.png',image);
for(const item of Object.values(doc.files))item.date=fixed;
await fs.writeFile(path.join(directory,'rich.docx'),await doc.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
const workbook=new ExcelJS.Workbook();workbook.created=fixed;workbook.modified=fixed;
for(const [index,title] of ['한글 표 FIRST SHEET','둘째 표 SECOND SHEET'].entries()){
 const sheet=workbook.addWorksheet('Sheet '+(index+1),{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:1,printArea:'A1:D15'}});
 sheet.columns=[{width:35},{width:20},{width:20},{width:20}];sheet.addRow([title]);sheet.addRow(['항목','수량','단가','합계']);sheet.addRow(['한글 항목',2,21,{formula:'B3*C3',result:42}]);
 for(const row of [sheet.getRow(2),sheet.getRow(3)])row.eachCell(cell=>{cell.font={name:'NanumGothic',size:12};cell.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};});
 sheet.getCell('A1').font={name:'NanumGothic',size:16,bold:true};
 sheet.addImage(workbook.addImage({buffer:image,extension:'png'}),{tl:{col:0,row:5},ext:{width:160,height:80}});
}
await fs.writeFile(path.join(directory,'rich.xlsx'),await workbook.xlsx.writeBuffer());
const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);pdf.setCreationDate(fixed);pdf.setModificationDate(fixed);
const font=await pdf.embedFont(await fs.readFile(path.resolve(directory,'../../../public/vendor/zetaoffice/2026-10-07/NanumGothic-Regular.ttf')),{subset:false});
const pdfImage=await pdf.embedPng(image);
for(const [i,label] of ['한글 PDF FIRST PAGE','둘째 PDF SECOND PAGE'].entries()){
 const page=pdf.addPage([595.28,841.89]);page.drawText(label,{x:55,y:760,size:18,font});
 for(const [row,values] of [['항목','금액'],['한글 합계','42']].entries())for(const [col,value] of values.entries()) {page.drawRectangle({x:55+col*180,y:660-row*30,width:180,height:30,borderColor:rgb(0,0,0),borderWidth:1});page.drawText(value,{x:60+col*180,y:670-row*30,size:12,font});}
 page.drawImage(pdfImage,{x:55,y:490,width:160,height:80});page.drawText(String(i+1),{x:290,y:40,size:12,font});
}
await fs.writeFile(path.join(directory,'rich.pdf'),await pdf.save());
console.log('Generated synthetic rich DOCX, XLSX and PDF with Korean text, table, image and two pages/sheets.');

// Raster-only PDF: exercises the explicit OCR/off distinction.
const rasterBase='/tmp/worklazy-rich-fixture-raster';
execFileSync('pdftoppm',['-f','1','-singlefile','-r','150','-png',path.join(directory,'rich.pdf'),rasterBase]);
const scan=await PDFDocument.create();scan.setCreationDate(fixed);scan.setModificationDate(fixed);
const bitmap=await scan.embedPng(await fs.readFile(rasterBase+'.png'));
scan.addPage([595.28,841.89]).drawImage(bitmap,{x:0,y:0,width:595.28,height:841.89});
await fs.writeFile(path.join(directory,'scanned.pdf'),await scan.save());
