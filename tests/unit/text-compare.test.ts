import assert from "node:assert/strict";
import test from "node:test";
import { compareTexts } from "../../src/features/text-compare/core.ts";
import { literalSpans, mapText } from "../../src/features/text-compare/ignore.ts";
import { DEFAULT_TEXT_OPTIONS as defaults } from "../../src/features/text-compare/resultTypes.ts";
import { decodeText, encodeText } from "../../src/features/text-compare/input.ts";
import { mergeRow, TextHistory } from "../../src/features/text-compare/session.ts";
import { transformText } from "../../src/features/text-compare/transforms.ts";
import { textRenderPieces, syntaxSpans, MAX_TEXT_RENDER_PIECES } from "../../src/features/text-compare/viewProjection.ts";
import { applyEditorChange, rawEditorOffset, editorText } from "../../src/features/text-compare/editor.ts";

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
  assert.deepEqual(literalSpans("abc",["abc","abc","bc"]),[{start:0,end:3,rules:[0,2]}]);
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
test("repeated lines align exactly and retain every source byte",()=>{
  const left="repeat\n".repeat(4000),right="repeat\n".repeat(4001);
  const result=compareTexts(left,right,defaults);
  assert.equal(result.quality,"full");assert.equal(result.counts.added,1);assert.equal(result.counts.changed,0);
  // One line inserted into the middle of 3,000 alternating lines is one added line.
  const braces=Array.from({length:3000},(_,i)=>i%2?"}":"{"),inserted=[...braces.slice(0,1500),"inserted",...braces.slice(1500)];
  assert.deepEqual(compareTexts(braces.join("\n"),inserted.join("\n"),defaults).counts,{changed:0,added:1,deleted:0,ignored:0,equal:3000});
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
  const history=new TextHistory(3,1024),small={left:"a",right:"b",options:defaults,revision:1};
  history.record(small);history.record(small);
  assert.deepEqual(history.undo({...small,left:"x".repeat(1000)}),small);
  assert.equal(history.canRedo,false);assert.equal(history.canUndo,false);
});
test("input line admission and long character spans remain bounded",()=>{
  assert.throws(()=>compareTexts("x\n".repeat(200001),"",defaults),/TEXT_LINE_LIMIT/);
  assert.throws(()=>compareTexts("x\n".repeat(200000)+"x","",defaults),/TEXT_LINE_LIMIT/);
  const result=compareTexts("a".repeat(60000),"b".repeat(60000),{...defaults,mode:"character"});
  assert.equal(result.quality,"line-coarse");assert.equal(result.counts.changed,1);
  assert.equal(result.rows[0].left?.raw.length,60000);
});
test("dense single-line highlighting is bounded without changing raw comparison results",()=>{
  const left=Array.from({length:1000},(_,i)=>String.fromCharCode(0x4e00+i)+"X").join("");
  const right=Array.from({length:1000},(_,i)=>String.fromCharCode(0x4e00+i)+"Y").join("");
  const result=compareTexts(left,right,{...defaults,mode:"character"}),before=structuredClone(result);
  const rendered=textRenderPieces(result.rows[0].left!,result.rows[0].leftMarks,"plain");
  assert.equal(rendered.coarse,true);assert.ok(rendered.pieces.length<=MAX_TEXT_RENDER_PIECES);
  assert.equal(rendered.pieces.map(p=>p.text).join(""),left);assert.deepEqual(result,before);
});
test("linear rendering keeps changed/ignored spans and code colors separate",()=>{
  const result=compareTexts('"abIGNOREcd": 3','"xyIGNOREuv": 4',{...defaults,mode:"word",ignoreRules:["IGNORE"]});
  const row=result.rows[0],rendered=textRenderPieces(row.left!,row.leftMarks,"json");
  assert.equal(rendered.coarse,false);assert.equal(rendered.pieces.map(p=>p.text).join(""),row.left?.raw);
  assert.equal(rendered.pieces.filter(p=>p.mark==="ignored").map(p=>p.text).join(""),"IGNORE");
});
test("textarea edits and selection offsets preserve unrelated CRLF/mixed endings",()=>{
  assert.equal(applyEditorChange("a\r\nold\r\nz\r\n","a\nnew\nz\n"),"a\r\nnew\r\nz\r\n");
  const mixed="a\r\nb\rc\nz",normalized=editorText(mixed);
  assert.equal(applyEditorChange(mixed,normalized.replace("c","C")),"a\r\nb\rC\nz");
  assert.equal(applyEditorChange("a\r\nb","a\nb\nnew"),"a\r\nb\r\nnew");
  assert.equal(rawEditorOffset("a\r\n👩‍💻old",3),4);
  const raw="a\r\n old \r\nz";const start=rawEditorOffset(raw,2),end=rawEditorOffset(raw,7);
  assert.equal(transformText(raw,"trim",start,end),"a\r\nold\r\nz");
});
test("real edit range disambiguates repeated mixed-EOL lines",()=>{
  const raw="x\r\nx\n";
  assert.equal(applyEditorChange(raw,"x\n","\r\n",{start:0,end:2,inputType:"deleteContentBackward"}),"x\n");
  assert.equal(applyEditorChange(raw,"x\n","\r\n",{start:2,end:4,inputType:"deleteByCut"}),"x\r\n");
  assert.equal(applyEditorChange(raw,"xx\n","\r\n",{start:2,end:2,inputType:"deleteContentBackward"}),"xx\n");
});
test("unterminated code tokens are scanned once without repeated suffix searches",()=>{
  const text="/*aaaa".repeat(30000);
  assert.deepEqual(syntaxSpans(text,"javascript"),[{start:0,end:text.length,kind:"comment"}]);
  const quoted='"'+"\\x".repeat(30000);
  assert.deepEqual(syntaxSpans(quoted,"json"),[{start:0,end:quoted.length,kind:"string"}]);
});

test("whole-document transforms preserve CRLF and mixed terminator positions",()=>{
  assert.equal(transformText(" b \r\n a \r\n","trim"),"b\r\na\r\n");
  assert.equal(transformText("b\r\na","sort"),"a\r\nb");
  assert.equal(transformText("c\r\nb\ra\n","sort"),"b\ra\r\nc\n");
  assert.equal(transformText("a\r\n  \r\nb\r\n","removeEmpty"),"a\r\nb\r\n");
  assert.equal(transformText("a\r\n  \rb\n","trim"),"a\r\nb\n");
  assert.equal(transformText("PRE| b \r\n a |POST","trim",4,12),"PRE|b\r\na|POST");
});

test("combined trim preset preserves LF/CRLF in one transformation",()=>{
 assert.equal(transformText(" a \r\n  \r\n b \n","trimRemoveEmpty"),"a\r\nb\n");
 assert.equal(transformText("PREFIX| a \r\n \r\n b |END","trimRemoveEmpty",7,18),"PREFIX|a\r\nb|END");
});
test("history clearing and option-string reservation bound both undo and redo",()=>{
 const history=new TextHistory(20,1024),source={left:"a",right:"b",options:defaults,revision:1};history.record(source);history.undo(source);assert.equal(history.canRedo,true);history.clear();assert.equal(history.canUndo,false);assert.equal(history.canRedo,false);
 history.record({...source,options:{...defaults,ignoreRules:['x'.repeat(500)]}});assert.equal(history.canUndo,false);
});

test("a line appended after a last line without a terminator is one added line, and merges cleanly", () => {
  const result = compareTexts("a\nb", "a\nb\nc", defaults);
  assert.deepEqual(result.rows.map((row) => row.kind), ["equal", "equal", "added"]);
  const merged = mergeRow({ left: "a\nb", right: "a\nb\nc", options: defaults, revision: 0 }, result, result.rows[2].id, "left");
  assert.equal(merged.left, "a\nb\nc");
  const removed = mergeRow({ left: "a\nb", right: "a\nb\nc", options: defaults, revision: 0 }, result, result.rows[2].id, "right");
  assert.equal(removed.right, "a\nb");
});

test("a merged line takes the target's line ending", () => {
  const options = { ...defaults, normalizeLineEndings: true };
  const snapshot = { left: "a\r\nb\r\nc\r\n", right: "a\nB\nc\n", options, revision: 0 };
  const result = compareTexts(snapshot.left, snapshot.right, options);
  const row = result.rows.find((item) => item.kind === "changed")!;
  assert.equal(mergeRow(snapshot, result, row.id, "left").left, "a\r\nB\r\nc\r\n");
});

test("word mode keeps grapheme clusters whole and pairs re-indented lines", () => {
  const word = { ...defaults, mode: "word" as const };
  const emoji = compareTexts("family \u{1F468}‍\u{1F469}‍\u{1F467} end", "family \u{1F468}‍\u{1F469}‍\u{1F466} end", word);
  assert.deepEqual(emoji.rows[0].leftMarks.map((mark) => [mark.start, mark.end]), [[7, 15]]);
  const accent = compareTexts("café x", "cafè x", word);
  assert.deepEqual(accent.rows[0].leftMarks.map((mark) => [mark.start, mark.end]), [[3, 5]]);
  const indented = compareTexts("if (a) {\n  call();\n}\nother\n", "if (a) {\n    call();\n}\nanother\n", { ...defaults, mode: "smart" });
  assert.deepEqual(indented.rows.map((row) => [row.kind, row.left?.raw.trim(), row.right?.raw.trim()]), [["equal", "if (a) {", "if (a) {"], ["changed", "call();", "call();"], ["equal", "}", "}"], ["changed", "other", "another"]]);
});

test("ignore rules with many matches stay within limits", () => {
  const result = compareTexts("x ".repeat(150_000), "y ".repeat(150_000), { ...defaults, ignoreRules: ["x", "y"] });
  assert.equal(result.counts.ignored, 1);
  assert.equal(literalSpans("aaaa", ["a"]).length, 1);
});

test("a one-character change inside a 1 MB line is highlighted exactly in every mode", () => {
  const left = "a".repeat(500_000) + " " + "b".repeat(500_000), inserted = "a".repeat(500_000) + " X" + "b".repeat(500_000);
  const deleted = "a".repeat(500_000) + "b".repeat(500_000), replaced = "a".repeat(500_000) + "Z" + "b".repeat(500_000);
  for (const mode of ["smart", "word", "character"] as const) {
    const options = { ...defaults, mode };
    const insert = compareTexts(left, inserted, options);
    assert.equal(insert.quality, "full", mode);
    const insertMarks = insert.rows[0].rightMarks.filter(mark => mark.kind === "changed");
    assert.equal(insertMarks.reduce((sum, mark) => sum + mark.end - mark.start, 0) < 1_000, true, mode);
    assert.ok(insertMarks.some(mark => mark.start <= 500_001 && mark.end >= 500_002), mode);
    const remove = compareTexts(left, deleted, options).rows[0].leftMarks.filter(mark => mark.kind === "changed");
    assert.ok(remove.length && remove.every(mark => mark.end - mark.start < 1_000), mode);
    const replace = compareTexts(deleted, replaced, options).rows[0];
    for (const marks of [replace.leftMarks, replace.rightMarks]) assert.ok(marks.every(mark => mark.end - mark.start < 1_000), mode);
  }
  // Character mode marks exactly the inserted grapheme, also next to emoji clusters.
  const emoji = "👍🏽".repeat(3_000);
  const character = compareTexts(emoji + emoji, emoji + "é" + emoji, { ...defaults, mode: "character" }).rows[0].rightMarks;
  assert.deepEqual(character.map(mark => [mark.start, mark.end]), [[emoji.length, emoji.length + 1]]);
});

test("a final line terminator present on one side only is a mergeable change", () => {
  for (const [left, right] of [["a", "a\n"], ["a\nb", "a\nb\n"], ["a\r\n", "a"]]) {
    const result = compareTexts(left, right, defaults);
    const last = result.rows.at(-1)!;
    assert.equal(last.kind, "changed", JSON.stringify([left, right]));
    assert.ok([...last.leftMarks, ...last.rightMarks].some(mark => mark.kind === "changed"));
    const snapshot = { left, right, options: defaults, revision: 0 };
    assert.equal(mergeRow(snapshot, result, last.id, "left").left, right);
    assert.equal(mergeRow(snapshot, result, last.id, "right").right, left);
  }
  // A line appended after a last line without a terminator stays an addition next to an equal line.
  const appended = compareTexts("a\nb", "a\nb\nc", defaults);
  assert.deepEqual(appended.rows.map(row => row.kind), ["equal", "equal", "added"]);
});

test("long-line cuts and word edges never split a long combining or ZWJ cluster", () => {
  const cluster = (last: string) => "👩" + "́".repeat(80) + "‍" + last;
  const left = "a".repeat(6000) + cluster("👩"), right = "a".repeat(6000) + cluster("👨");
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const starts = (text: string) => new Set([...segmenter.segment(text)].map(item => item.index).concat(text.length));
  for (const mode of ["smart", "word", "character"] as const) {
    const row = compareTexts(left, right, { ...defaults, mode }).rows[0];
    for (const [marks, text] of [[row.leftMarks, left], [row.rightMarks, right]] as const) {
      const bounds = starts(text);
      for (const mark of marks.filter(item => item.kind === "changed")) assert.ok(bounds.has(mark.start) && bounds.has(mark.end), `${mode} ${mark.start}-${mark.end}`);
      assert.ok(marks.some(mark => mark.kind === "changed" && mark.start === 6000), mode);
    }
  }
  // A long line made only of emoji clusters is still cut quickly and on cluster edges.
  const emoji = "👍🏽".repeat(100_000), started = performance.now();
  const row = compareTexts(emoji + "x" + emoji, emoji + "y" + emoji, { ...defaults, mode: "character" }).rows[0];
  assert.deepEqual(row.rightMarks.map(mark => [mark.start, mark.end]), [[emoji.length, emoji.length + 1]]);
  assert.ok(performance.now() - started < 5_000);
});

// Behaviour checked against Diffchecker 7.3.0's own worker on the same inputs (48 of 51 cases equal;
// the rest differ only because a text ending in a newline has no extra empty last line here).
test("moved blocks of three or more lines are linked on both sides like Diffchecker", () => {
  const lines = (from: number, to: number, edit?: (line: string, i: number) => string) => Array.from({ length: to - from }, (_, i) => { const line = `line ${from + i} alpha beta gamma`; return edit ? edit(line, i) : line; });
  const movesOf = (left: string, right: string) => {
    const result = compareTexts(left, right, defaults), groups = new Map<number, number[]>();
    for (const row of result.rows) if (row.left && row.leftMove) {
      const g = groups.get(row.leftMove.group) ?? [Infinity, -Infinity, row.leftMove.start, row.leftMove.end, row.leftMove.score];
      g[0] = Math.min(g[0], row.left.number); g[1] = Math.max(g[1], row.left.number + 1); groups.set(row.leftMove.group, g);
    }
    return { result, moves: [...groups.values()].map(g => [g[0], g[1], g[2], g[3], Math.round(g[4] * 1e4) / 1e4]) };
  };
  // A four-line block moved up.
  const up = movesOf([...lines(0, 10)].join("\n"), [...lines(5, 9), ...lines(0, 5), ...lines(9, 10)].join("\n"));
  assert.deepEqual(up.moves, [[6, 10, 1, 5, 1]]);
  assert.ok(up.result.rows.every(row => !row.rightMove || row.right!.number >= 1 && row.right!.number < 5));
  assert.equal(up.result.moves, 1);
  // Moved and partly edited: similarity 0.93 like the original.
  const edited = movesOf(lines(0, 10).join("\n"), [...lines(0, 2), ...lines(6, 9, (line, i) => i === 1 ? line.replace("alpha", "ALPHA") : line), ...lines(2, 6), ...lines(9, 10)].join("\n"));
  assert.deepEqual(edited.moves, [[7, 10, 3, 6, 0.9306]]);
  // One or two moved lines, or every line edited, are not moves.
  assert.deepEqual(movesOf(lines(0, 8).join("\n"), [...lines(7, 8), ...lines(0, 7)].join("\n")).moves, []);
  assert.deepEqual(movesOf(lines(0, 8).join("\n"), [...lines(0, 2), ...lines(6, 8), ...lines(2, 6)].join("\n")).moves, []);
  assert.deepEqual(movesOf(lines(0, 10).join("\n"), [...lines(0, 2), ...lines(6, 9, line => `${line} edited`), ...lines(2, 6), ...lines(9, 10)].join("\n")).moves, []);
  // Short lines and a blank line inside a block still move.
  assert.deepEqual(movesOf("}\na\nb\nc\nx\ny\nz\n{", "x\ny\nz\n}\na\nb\nc\n{").moves, [[5, 8, 1, 4, 1]]);
  assert.deepEqual(movesOf("head\nm1 moved text\n\nm2 moved text\nmid one\nmid two\nmid three\ntail", "head\nmid one\nmid two\nmid three\nm1 moved text\n\nm2 moved text\ntail").moves, [[2, 5, 5, 8, 1]]);
  // Row kinds and counts are those of the comparison without moves.
  assert.deepEqual(up.result.counts, { changed: 0, added: 4, deleted: 4, ignored: 0, equal: 6 });
});
