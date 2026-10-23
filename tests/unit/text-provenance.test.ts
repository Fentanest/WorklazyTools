import test from 'node:test';import assert from 'node:assert/strict';
import {compareTexts} from '../../src/features/text-compare/core.ts';
import {mapText} from '../../src/features/text-compare/ignore.ts';
import {DEFAULT_TEXT_OPTIONS} from '../../src/features/text-compare/resultTypes.ts';
import {TEXT_NORMALIZATION_POLICY} from '../../src/features/text-compare/normalizationPolicy.ts';
test('literal attribution and normalized positions survive the result boundary without duplicating raw text',()=>{
 const options={...DEFAULT_TEXT_OPTIONS,ignoreRules:['ab','bc','ab'],ignoreCase:true,normalizeLineEndings:true};
 const left='İabc\r\n👩‍💻Z',right='i̇\n👩‍💻z';const result=compareTexts(left,right,options,7);const original=mapText(left,options),p=result.provenance;
 assert.equal(p.policyVersion,TEXT_NORMALIZATION_POLICY.version);assert.deepEqual(p.rules,[{id:0,literal:'ab'},{id:1,literal:'bc'},{id:2,literal:'ab'}]);
 assert.deepEqual(p.left.removedSpans,[{start:1,end:4,rules:[0,1]}]);assert.deepEqual([...p.left.starts],original.starts);assert.deepEqual([...p.left.ends],original.ends);assert.equal(p.left.rawLength,left.length);assert.equal(p.left.normalizedLength,original.value.length);
 assert.deepEqual(result.rows.flatMap(row=>row.leftMarks).filter(mark=>mark.kind==='ignored').map(mark=>mark.ruleIds),[[0,1]]);
 const cloned=structuredClone(result,{transfer:[p.left.starts.buffer,p.left.ends.buffer,p.right.starts.buffer,p.right.ends.buffer]});assert.equal(p.left.starts.byteLength,0);assert.deepEqual([...cloned.provenance.left.starts],original.starts);
});
test('versioned quote dash and whitespace policy preserves the previous character set exactly',()=>{
 const options={...DEFAULT_TEXT_OPTIONS,ignoreQuotes:true,ignoreDashes:true,ignoreWhitespace:true};
 assert.equal(mapText('‘’‚‛“”„‟‐‑‒–—―−\t \v\f\u00a0',options).value,"''''\"\"\"\"-------\u00a0");
 const removed=mapText('abc',[options][0]);assert.deepEqual(removed.removed,[]);
});
