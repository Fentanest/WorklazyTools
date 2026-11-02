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
    [[file("pdf")], ["pdf-organize", "pdf-finish"]], [[file("pdf"),file("pdf")], ["pdf-organize", "pdf-finish"]],
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
