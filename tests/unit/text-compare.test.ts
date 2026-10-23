import assert from "node:assert/strict";
import test from "node:test";
import { compareTexts } from "../../src/features/text-compare/core.ts";
import { literalSpans, mapText } from "../../src/features/text-compare/ignore.ts";
import { DEFAULT_TEXT_OPTIONS as defaults } from "../../src/features/text-compare/resultTypes.ts";
import { decodeText, encodeText } from "../../src/features/text-compare/input.ts";
import { mergeRow, TextHistory } from "../../src/features/text-compare/session.ts";
import { transformText } from "../../src/features/text-compare/transforms.ts";

test("text input preserves encoding, BOM, CRLF and final newline",()=>{
  for(const encoding of ["utf-8","utf-16le","utf-16be"] as const) for(const bom of [true,false]) {
    const text="한글 👨‍👩‍👦\r\nlast\r\n",bytes=encodeText(text,encoding,bom),decoded=decodeText(bytes,"sample.txt",encoding);
    assert.equal(decoded.text,text);assert.equal(decoded.bom,bom);assert.deepEqual(encodeText(decoded.text,encoding,decoded.bom),bytes);
  }
  assert.throws(()=>decodeText(new Uint8Array([0xff,0xaa]),"bad.txt"),/TEXT_ENCODING_INVALID/);
});
test("Ignore finds original literal matches, unions overlaps and never cascades",()=>{
  assert.deepEqual(literalSpans("abXcd",["X","abcd"]),[{start:2,end:3,rules:[0]}]);
  assert.equal(mapText("abXcd",{...defaults,ignoreRules:["X","abcd"]}).value,"abcd");
  assert.deepEqual(literalSpans("abcabc",["abc","bc"]),[{start:0,end:6,rules:[0,1]}]);
  assert.equal(mapText(".* A",{...defaults,ignoreRules:[".*"]}).value," A");
  assert.throws(()=>literalSpans("a",[""]),/IGNORE_RULE_INVALID/);
});
test("ignored differences retain exact source and multiline maps",()=>{
  for(const [left,right,options] of [
    ["prefix\nsecret\nend","prefix\nend",{...defaults,ignoreRules:["secret\n"]}],
    ["secret","",{...defaults,ignoreRules:["secret"]}],
    ["İ\t“one”\r\n","i̇\"one\"\n",{...defaults,ignoreCase:true,ignoreWhitespace:true,ignoreQuotes:true,normalizeLineEndings:true}],
  ] as const) {
    const result=compareTexts(left,right,{...options,ignoreRules:[...options.ignoreRules]});
    assert.equal(result.rows.map(r=>r.left?.raw??"").join(""),left);
    assert.equal(result.rows.map(r=>r.right?.raw??"").join(""),right);
    assert.equal(result.counts.changed+result.counts.added+result.counts.deleted,0);
  }
});
test("character mode respects emoji and combining grapheme boundaries",()=>{
  const left="A👩‍💻éZ\n",right="A👨‍💻èZ\n";
  const result=compareTexts(left,right,{...defaults,mode:"character"});
  const marked=result.rows[0].leftMarks.filter(x=>x.kind==="changed").map(x=>left.slice(x.start,x.end)).join("");
  assert.equal(marked,"👩‍💻é");
});
test("changed marks do not swallow ignored text inside a replacement",()=>{
  const left="abIGNOREcd",right="xyIGNOREuv";
  const result=compareTexts(left,right,{...defaults,mode:"word",ignoreRules:["IGNORE"]});
  const row=result.rows[0];
  assert.equal(row.leftMarks.filter(m=>m.kind==="changed").map(m=>left.slice(m.start,m.end)).join(""),"abcd");
  assert.equal(row.leftMarks.filter(m=>m.kind==="ignored").map(m=>left.slice(m.start,m.end)).join(""),"IGNORE");
});
test("large common files isolate one changed line without whole-file replacements",()=>{
  const left=Array.from({length:10000},(_,i)=>`unique-${i}\n`).join("");
  const right=left.replace("unique-5678\n","revised-5678\n");
  const result=compareTexts(left,right,defaults);
  assert.equal(result.counts.changed,1);assert.equal(result.counts.equal,9999);assert.equal(result.quality,"full");
});
test("repeated lines use bounded fallback and retain every source byte",()=>{
  const left="repeat\n".repeat(4000),right="repeat\n".repeat(4001);
  const result=compareTexts(left,right,defaults);
  assert.equal(result.quality,"line-coarse");assert.equal(result.counts.added,1);
  assert.equal(result.rows.map(r=>r.left?.raw??"").join(""),left);
  assert.equal(result.rows.map(r=>r.right?.raw??"").join(""),right);
});
test("merge uses raw spans and refuses stale changes; undo restores input and options",()=>{
  const snapshot={left:"same\r\nold\r\nsame\r\n",right:"same\r\nnew\r\nsame\r\n",options:defaults,revision:4};
  const result=compareTexts(snapshot.left,snapshot.right,defaults,4),row=result.rows.find(r=>r.kind==="changed")!;
  const changed=mergeRow(snapshot,result,row.id,"left");assert.equal(changed.left,snapshot.right);
  assert.throws(()=>mergeRow(changed,result,row.id,"left"),/STALE_COMPARISON/);
  const history=new TextHistory();history.record(snapshot);assert.deepEqual(history.undo(changed),snapshot);assert.deepEqual(history.redo(snapshot),changed);
  const inserted=compareTexts("A\n","A\nB\n",defaults,5);
  assert.equal(mergeRow({left:"A\n",right:"A\nB\n",options:defaults,revision:5},inserted,inserted.rows[1].id,"left").left,"A\nB\n");
});
test("explicit transforms affect selection only and keep standalone CR",()=>{
  assert.equal(transformText("PRE\n B \n A \nPOST","trim",4,13),"PRE\nB\nA\nPOST");
  assert.equal(transformText("z\na\na","sort"),"a\na\nz");
  assert.equal(transformText("a\rb\r\nc\n","lineSpaces"),"a\rb c ");
});
test("contextual Unicode lowercase keeps original spans",()=>{
  const result=compareTexts("ΟΣ\nİ","ος\ni̇",{...defaults,ignoreCase:true});
  assert.equal(result.counts.changed,0);assert.equal(result.counts.ignored,2);
  assert.equal(result.rows.map(r=>r.left?.raw??"").join(""),"ΟΣ\nİ");
});
test("very large repeated-line fallback has no argument-count limit",()=>{
  const result=compareTexts("a\n".repeat(150000),"b\n".repeat(150000),{...defaults,mode:"word"},0,15000);
  assert.equal(result.rows.length,150000);assert.equal(result.quality,"line-coarse");assert.equal(result.counts.changed,150000);
});
test("undo and redo share a bounded history budget",()=>{
  const history=new TextHistory(3,100),small={left:"a",right:"b",options:defaults,revision:1};
  history.record(small);history.record(small);
  assert.deepEqual(history.undo({...small,left:"x".repeat(100)}),small);
  assert.equal(history.canRedo,false);assert.equal(history.canUndo,false);
});
