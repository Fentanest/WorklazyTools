import test from 'node:test';import assert from 'node:assert/strict';
import {rawSearchMatches} from '../../src/features/text-compare/search.ts';
import {projectTextRows,textRenderPieces} from '../../src/features/text-compare/viewProjection.ts';
import {compareTexts} from '../../src/features/text-compare/core.ts';
import {DEFAULT_TEXT_OPTIONS} from '../../src/features/text-compare/resultTypes.ts';
test('search locations address original CRLF and case-expanding Unicode',()=>{
 assert.deepEqual(rawSearchMatches('x\r\nİ 👩‍💻 İ','i',10).ranges,[{start:13,end:14},{start:21,end:22}]);
 assert.deepEqual(rawSearchMatches('ΟΣ ΟΣΑ','ος').ranges,[{start:0,end:2}]);
 assert.deepEqual(rawSearchMatches('x foo foo','FOO',100,1),{matched:true,ranges:[{start:102,end:105}],truncated:true});
});
test('search projection retains result IDs and full data while bounding match decoration',()=>{
 const raw='a'.repeat(3000),result=compareTexts(raw,raw,DEFAULT_TEXT_OPTIONS,3),before=structuredClone(result.counts);
 const view=projectTextRows(result.rows,true,new Set(),'a');assert.equal(view.length,1);const entry=view[0];assert.equal(entry.kind,'row');if(entry.kind!=='row')return;
 assert.equal(entry.row,result.rows[0]);assert.equal(entry.search?.left.length,2500);assert.equal(entry.search?.right.length,0);assert.equal(entry.search?.truncated,true);assert.deepEqual(result.counts,before);assert.equal(result.rows[0].left?.raw,raw);
});

test('search highlight boundaries keep original absolute positions and all raw text',()=>{
 const result=compareTexts('İ right\r\n','İ wrong\r\n',DEFAULT_TEXT_OPTIONS);const entry=projectTextRows(result.rows,false,new Set(),'i')[0];if(entry.kind!=='row')throw Error('missing row');const line=entry.row.left!;
 const rendered=textRenderPieces(line,entry.row.leftMarks,'plain',entry.search?.left);assert.equal(rendered.pieces.map(p=>p.text).join(''),line.raw);assert.deepEqual(rendered.pieces.filter(p=>p.search).map(p=>({start:p.start,text:p.text})),[{start:0,text:'İ'},{start:3,text:'i'}]);
});
