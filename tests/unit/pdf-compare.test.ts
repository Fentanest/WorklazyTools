import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRgb, indexMapping, pairedGeometry, pendingPage, textFromItems, validateMapping } from '../../src/features/pdf-compare/kernel.ts';
test('physical mapping preserves blank positions and tails; manual mapping is bounded and unique', () => {
 assert.deepEqual(indexMapping(3,2),[{before:0,after:0},{before:1,after:1},{before:2,after:null}]);
 assert.deepEqual(validateMapping([{before:2,after:0},{before:null,after:1}],3,2),[{before:2,after:0},{before:null,after:1}]);
 for(const m of [[],[{before:null,after:null}],[{before:0,after:0},{before:0,after:1}],[{before:3,after:null}],[{before:-1,after:null}],[{before:0.5,after:null}]])assert.throws(()=>validateMapping(m,3,2));
});
test('raw text order, EOL, normalization and availability are independent', () => {
 assert.deepEqual(textFromItems([{str:'B ',hasEOL:true},{str:'A\u0301',hasEOL:false}]),{text:'B \nA\u0301',available:true});
 assert.deepEqual(textFromItems([{str:'',hasEOL:true}]),{text:'\n',available:false});
 assert.equal(textFromItems([{str:' ',hasEOL:false}]).available,true);
});
test('one common scale, sizes and page-size-only differences', () => {
 const g=pairedGeometry({width:8000,height:4000},{width:800,height:400});
 assert.equal(g.width,4096);assert.equal(g.beforeWidth,4096);assert.equal(g.afterWidth,410);assert.equal(g.scaleFactor,0.512);assert.equal(g.dpi,49.152);assert.equal(g.pageSizeChanged,true);
 assert.equal(pairedGeometry({width:800,height:400},{width:800,height:400}).pageSizeChanged,false);
 assert.throws(()=>pairedGeometry({width:Infinity,height:2},null));
});
test('RGB threshold strictly greater, opaque oracle and overlay', () => {
 const a=new Uint8ClampedArray([255,255,255,255,10,20,30,255]);
 const b=new Uint8ClampedArray([239,255,255,255,27,20,30,255]);
 assert.equal(compareRgb(a,b,0).count,2);assert.equal(compareRgb(a,b,16).count,1);assert.equal(compareRgb(a,b,32).count,0);
 const result=compareRgb(a,b,16,true);assert.equal(result.ratio,0.5);assert.equal(result.diff![3],0);assert.equal(result.diff![7],180);
 const bad=a.slice();bad[3]=0;assert.throws(()=>compareRgb(a,bad,16));assert.throws(()=>compareRgb(a,b.slice(4),16));
});
test('pending is unknown, unavailable and never a zero pixel claim',()=>{
 const p=pendingPage({before:0,after:0},16);assert.equal(p.status,'unknown');assert.equal(p.textComparison,'unavailable');assert.equal(p.pixelCount,null);assert.equal(p.visualComparison,'unknown');assert.ok(p.warnings.includes('extraction-limit'));assert.ok(!('extractionExact'in p));
});
