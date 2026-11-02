import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { intakeFiles, classifyFile } from "../../src/app/fileIntake.ts";
import { acceptsFile, fileAccepts, isolatedFileAccepts } from "../../src/app/fileAccepts.ts";
const file = (extension: string, body = "synthetic") => new File([body], `fixture.${extension}`);
const receivers = async (files: File[]) => (await intakeFiles(files)).groups[0]?.candidates.map(item => item.receiverId) ?? [];
// ADVISOR-2 rows 1–4 => plan 1/1b/2/3/4; row 5 => mailmerge;
// rows 6–7 => PDF; rows 8–9 => images; row 10 => Office;
// rows 11–12 => mixed/unsupported. Videos and >50 are explicit guards.
test("(a)(b) complete rule rows: candidates belong to receiver table and every file satisfies its accept", async () => {
  const rows: [File[], string[]][] = [
    [[file("xlsx")], ["excel-cleaner", "office"]],
    [[file("xlsm")], ["excel-cleaner"]], [[file("xlsb")], ["excel-cleaner"]],
    [[file("xls")], ["excel-cleaner", "office"]], [[file("csv")], ["excel-cleaner", "excel-merger"]],
    [[file("xlsx"),file("xlsm")], ["excel-merger", "excel-cleaner"]],
    [[file("docx"),file("csv")], ["document-generator"]],
    [[file("pdf")], ["pdf-organize", "pdf-finish"]], [[file("pdf"),file("pdf")], ["pdf-organize", "pdf-finish", "pdf-compare"]],
    [[file("webp")], ["image-edit", "image-privacy", "image-batch"]], [[file("png"),file("jpg")], ["image-batch", "image-privacy"]],
    ...["docx","doc","odt","pptx","ppt","odp","ods"].map(ext => [[file(ext)], ["office"]] as [File[], string[]]),
  ];
  for (const [files, expected] of rows) {
    const result = await intakeFiles(files); assert.deepEqual(result.groups[0].candidates.filter(item => !(item.receiverId in isolatedFileAccepts)).map(item => item.receiverId), expected);
    for (const group of result.groups) for (const item of group.candidates) {
      if (item.receiverId === "office") { assert.equal(item.files.length, 1);
        const officeSource=readFileSync(new URL("../../src/features/office-editor/openInOfficeEditor.ts",import.meta.url),"utf8");
        const extensions=[...officeSource.match(/new Set\(\[([^\]]+)\]/)![1].matchAll(/"([^"]+)"/g)].map(match=>match[1]);
        assert.ok(extensions.includes(item.files[0].name.split(".").pop()!.toLowerCase())); continue; }
      if (Object.hasOwn(isolatedFileAccepts, item.receiverId)) {
        const rule = isolatedFileAccepts[item.receiverId as keyof typeof isolatedFileAccepts];
        assert.equal(item.entryPath, rule.path); assert.ok(item.files.length <= rule.max);
        assert.ok(item.files.every(file => (rule.extensions as readonly string[]).includes(file.name.split(".").pop()!.toLowerCase()))); continue;
      }
      assert.ok(item.receiverId in fileAccepts);
      assert.ok(item.files.every(file => acceptsFile(item.receiverId as keyof typeof fileAccepts, file)));
      assert.ok(item.files.length <= fileAccepts[item.receiverId as keyof typeof fileAccepts].max);
      assert.ok((fileAccepts[item.receiverId as keyof typeof fileAccepts].paths as readonly string[]).includes(item.entryPath));
    }
  }
});
test("(c) count boundaries 0/1/2/49/50/51 and template+49/50 data; never truncate", async () => {
  for (const count of [0,1,2,49,50,51]) {
    const result = await intakeFiles(Array.from({length:count}, () => file("xlsx")));
    assert.equal(result.count,count); assert.equal(result.tooMany,count>50);
    assert.equal(result.groups.length,count===0||count>50?0:1);
    if (count>0&&count<=50) assert.equal(result.groups[0].candidates[0].files.length,count);
  }
  const mail = await intakeFiles([file("docx"), ...Array.from({length:49},()=>file("csv"))]);
  assert.equal(mail.groups[0].kind,"mailmerge"); assert.deepEqual(mail.groups[0].candidates[0].roles,["template",...Array(49).fill("data")]);
  assert.equal((await intakeFiles([file("docx"),...Array.from({length:50},()=>file("csv"))])).tooMany,true);
  assert.ok(!(await receivers([file("docx"),file("xlsm")])).includes("document-generator"));
  assert.ok(!(await receivers([file("docx"),file("docx"),file("xlsx")])).includes("document-generator"));
});
test("(c) case, WebP, extensionless magic: WAV/ZIP/CFB stay other; only no-extension reads 12 bytes", async () => {
  assert.deepEqual(await receivers([file("XLSX")]),["excel-cleaner","office","document-to-pdf"]);
  for (const [body, kind, suffix] of [["%PDF-test","pdf","pdf"],["RIFF0000WEBP","image","webp"],["RIFF0000WAVE","other", ""],["PK\x03\x04","other", ""],["other","other", ""]]) {
    const result = await classifyFile(new File([body],"no-extension")); assert.equal(result.kind,kind);
    if(suffix) assert.ok(result.file.name.endsWith(`.${suffix}`));
  }
  for (const [bytes, suffix] of [[[255,216,255],"jpg"],[[137,80,78,71,13,10,26,10],"png"],[[208,207,17,224,161,177,26,225],""] ] as [number[],string][]) {
    const result = await classifyFile(new File([new Uint8Array(bytes)],"raw")); assert.equal(result.kind,suffix?"image":"other");
  }
  const named=file("unknown","%PDF"); named.slice=()=>{throw Error("must not sniff named file")}; assert.equal((await classifyFile(named)).kind,"other");
  const raw=new File(["%PDF"],"raw"); const original=raw.slice.bind(raw); let sliceArgs: unknown[]=[];
  raw.slice=(...args)=>{sliceArgs=args; return original(...args)}; await classifyFile(raw); assert.deepEqual(sliceArgs,[0,12]);
});
test("mixed groups forward only their own files, unsupported/video have no receiver", async () => {
  const files=[file("csv"),file("pdf"),file("png"),file("mp4"),file("txt")]; const result=await intakeFiles(files);
  assert.equal(result.mixed,true); assert.equal(result.groups.length,5);
  for (const group of result.groups) for (const candidate of group.candidates) assert.deepEqual(candidate.files,group.files);
  assert.equal(result.groups.find(group=>group.kind==="video")!.candidates.length,0);
  assert.equal(result.groups.find(group=>group.kind==="other")!.candidates.length,0);
});
test("(d) intake imports only fileAccepts, never a feature page or network/parser module", () => {
  const source=readFileSync(new URL("../../src/app/fileIntake.ts",import.meta.url),"utf8");
  assert.deepEqual([...source.matchAll(/(?:from\s+|import\s*\()"([^"]+)"/g)].map(match=>match[1]),["./fileAccepts.ts"]);
});

// U5: only a full, same-format pair is eligible; no subset/truncation or cross-family guesses.
test("U5 (a)(b)(c) comparison pairs map roles in input order and honor shared receiver definitions", async () => {
  for (const [kind, extensions, expected] of [
    ["spreadsheet", ["xlsx","xlsm","xlsb","xls","csv"], "excel-compare"],
    ["pdf", ["pdf"], "pdf-compare"], ["image", ["png","jpg","jpeg","webp"], "image-compare"],
    ["office", ["docx","doc","hwp","hwpx"], "document-compare"],
  ] as const) for (const ext of extensions) {
    for (const count of [1,2,3,49,50,51]) {
      const files = Array.from({length:count}, (_,i)=>new File([String(i)], `${i}.${ext.toUpperCase()}`));
      const groups = (await intakeFiles(files)).groups;
      const comparisons = groups.flatMap(group=>group.candidates).filter(item=>item.receiverId.endsWith("-compare"));
      assert.equal(comparisons.length,count===2?1:0,`${ext}:${count}`);
      if (count!==2) continue;
      const candidate = comparisons[0]; assert.equal(candidate.receiverId,expected);
      assert.equal(groups[0].kind,kind); assert.deepEqual(candidate.files,files);
      assert.deepEqual(candidate.roles,["before","after"]);
      assert.equal(candidate.entryPath,fileAccepts[expected].paths[0]);
      assert.equal(fileAccepts[expected].max,2); assert.equal(fileAccepts[expected].kind,"inspection");
      assert.ok(candidate.files.every(file=>acceptsFile(expected,file)));
      if (kind === "office") assert.equal(groups[0].candidates.indexOf(candidate), 0);
      else assert.ok(groups[0].candidates.indexOf(candidate) >= 1);
    }
  }
  for (const files of [[file("xlsx"),file("csv")],[file("png"),file("webp")],[file("docx"),file("doc")],[file("hwp"),file("hwpx")],[file("pptx"),file("pptx")]]) {
    assert.ok(!(await intakeFiles(files)).groups.flatMap(group=>group.candidates).some(item=>item.receiverId.endsWith("-compare")));
  }
  assert.ok((await receivers([file("jpg"),file("jpeg")])).includes("image-compare"));
  const mixed=await intakeFiles([file("pdf"),file("pdf"),file("png")]);
  const candidate=mixed.groups[0].candidates.find(item=>item.receiverId==="pdf-compare")!;
  assert.equal(candidate.files.length,2); assert.ok(candidate.files.every(file=>file.name.endsWith("pdf")));
});

test("H2 exact isolated recommendations and count limits preserve every input", async () => {
  for (const [ext, expected] of [["pdf", ["document-redactor"]], ["png", ["document-redactor"]],
    ["xls", ["document-to-pdf", "xls-preserve"]], ["xlsx", ["document-to-pdf"]],
    ["docx", ["document-to-pdf"]], ["hwp", ["document-to-pdf"]], ["hwpx", ["document-to-pdf"]], ["odt", []]] as [string,string[]][]) {
    const result = await intakeFiles([file(ext)]);
    assert.deepEqual(result.groups[0].candidates.filter(item => item.receiverId in isolatedFileAccepts).map(item => item.receiverId), expected);
  }
  for (const count of [20, 21, 50]) {
    const result = await intakeFiles(Array.from({length:count},()=>file("pdf")));
    const isolated=result.groups[0].candidates.find(item=>item.receiverId==="document-redactor");
    assert.equal(Boolean(isolated),count===20); if(isolated)assert.equal(isolated.files.length,count);
  }
  const mixed=await intakeFiles([file("xls"),file("xlsx")]);
  assert.equal(mixed.groups[0].candidates.find(item=>item.receiverId==="xls-preserve")!.files.length,2);
});

// HWP: route the whole single input, preserving the H2 PDF fallback and U5 pairs.
test("HWP (a)(b)(c) primary editor, PDF fallback, mixed groups and exact count/case boundaries", async () => {
  for (const ext of ["hwp", "hwpx", "hml", "HWP", "HwPx", "HML"]) {
    const input = file(ext);
    const result = await intakeFiles([input]);
    assert.equal(result.groups[0].kind, "office");
    const expected = ["hwp-editor", ...(ext.toLowerCase() === "hml" ? [] : ["document-to-pdf"])];
    assert.deepEqual(result.groups[0].candidates.map(item => item.receiverId), expected);
    for (const candidate of result.groups[0].candidates) assert.deepEqual(candidate.files, [input]);
    assert.ok(acceptsFile("hwp-editor", input));
    assert.deepEqual(fileAccepts["hwp-editor"].paths, ["/tools/hwp-editor"]);
    for (const count of [0, 2, 3, 20, 21, 49, 50, 51]) {
      const batch = await intakeFiles(Array.from({ length: count }, () => file(ext)));
      const candidates = batch.groups.flatMap(group => group.candidates);
      assert.ok(!candidates.some(item => item.receiverId === "hwp-editor"), `${ext}:${count}`);
      assert.equal(candidates.some(item => item.receiverId === "document-compare"), count === 2 && ext.toLowerCase() !== "hml");
      assert.equal(candidates.some(item => item.receiverId === "document-to-pdf"), count > 0 && count <= 20 && ext.toLowerCase() !== "hml");
      assert.equal(batch.tooMany, count > 50);
      for (const candidate of candidates) assert.equal(candidate.files.length, count);
    }
    const pdf = file("pdf");
    const mixed = await intakeFiles([input, pdf]);
    assert.equal(mixed.mixed, true);
    assert.deepEqual(mixed.groups[0].candidates[0].files, [input]);
    assert.deepEqual(mixed.groups[1].candidates[0].files, [pdf]);
  }
  assert.deepEqual(await receivers([new File([], "hwp")]), []);
  for (const name of ["hidden.hwp.exe", "document.hwpx "]) assert.equal(acceptsFile("hwp-editor", new File([], name)), false);
  const mixedFormats = await intakeFiles([file("hwp"), file("hwpx")]);
  assert.deepEqual(mixedFormats.groups[0].candidates.map(item => item.receiverId), ["document-to-pdf"]);
});
