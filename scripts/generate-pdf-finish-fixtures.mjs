import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const defaultOutputDirectory = path.join(repositoryRoot, "tests", "fixtures", "pdf-finish");
const ocgSeedPath = path.join(scriptDirectory, "assets", "pdf-finish", "ocg-snapshots.json.gz");
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const md5 = (bytes) => crypto.createHash("md5").update(bytes).digest();
const pdfPasswordPadding = Buffer.from("28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a", "hex");

function pdfObject(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value, "binary");
}

function pdfStream(contents, dictionary = "") {
  const bytes = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, "binary");
  const prefix = dictionary ? `${dictionary.trim()} ` : "";
  return Buffer.concat([
    Buffer.from(`<< ${prefix}/Length ${bytes.length} >>\nstream\n`, "binary"),
    bytes,
    Buffer.from("\nendstream", "binary"),
  ]);
}

function assemblePdf(objects, { root = 1, info, trailer = "", version = "1.7" } = {}) {
  const parts = [Buffer.from(`%PDF-${version}\n%\xE2\xE3\xCF\xD3\n`, "binary")];
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(parts.reduce((total, part) => total + part.length, 0));
    parts.push(Buffer.from(`${index + 1} 0 obj\n`), pdfObject(object), Buffer.from("\nendobj\n"));
  }
  const xref = parts.reduce((total, part) => total + part.length, 0);
  const rows = offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  const infoEntry = info ? ` /Info ${info} 0 R` : "";
  parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${rows}trailer\n<< /Size ${objects.length + 1} /Root ${root} 0 R${infoEntry}${trailer ? ` ${trailer.trim()}` : ""} >>\nstartxref\n${xref}\n%%EOF\n`));
  return Buffer.concat(parts);
}

function simplePdf({ contents = "0 0 1 rg 20 20 80 80 re f", contentsEntry = "5 0 R", catalog = "", page = "", extraObjects = [] } = {}) {
  return assemblePdf([
    `<< /Type /Catalog /Pages 2 0 R${catalog ? ` ${catalog}` : ""} >>`,
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents ${contentsEntry}${page ? ` ${page}` : ""} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    pdfStream(contents),
    ...extraObjects,
  ]);
}

function rc4(key, input) {
  const state = Array.from({ length: 256 }, (_, index) => index);
  let swapIndex = 0;
  for (let index = 0; index < 256; index += 1) {
    swapIndex = (swapIndex + state[index] + key[index % key.length]) & 255;
    [state[index], state[swapIndex]] = [state[swapIndex], state[index]];
  }
  let left = 0;
  swapIndex = 0;
  return Buffer.from([...input].map((byte) => {
    left = (left + 1) & 255;
    swapIndex = (swapIndex + state[left]) & 255;
    [state[left], state[swapIndex]] = [state[swapIndex], state[left]];
    return byte ^ state[(state[left] + state[swapIndex]) & 255];
  }));
}

function paddedPassword(password) {
  return Buffer.concat([Buffer.from(password), pdfPasswordPadding]).subarray(0, 32);
}

function createR2Pdf(userPassword, permissions) {
  const owner = rc4(md5(paddedPassword("owner-secret")).subarray(0, 5), paddedPassword(userPassword));
  const id = md5(Buffer.from(`u4-r4-r2-${userPassword}`));
  const permissionBytes = Buffer.alloc(4);
  permissionBytes.writeInt32LE(permissions);
  const fileKey = md5(Buffer.concat([paddedPassword(userPassword), owner, permissionBytes, id])).subarray(0, 5);
  const user = rc4(fileKey, pdfPasswordPadding);
  const objectKey = md5(Buffer.concat([fileKey, Buffer.from([5, 0, 0, 0, 0])])).subarray(0, 10);
  const encryptedContents = rc4(objectKey, Buffer.from("BT /F1 18 Tf 30 120 Td (R2 fixture) Tj ET"));
  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    pdfStream(encryptedContents),
    `<< /Filter /Standard /V 1 /R 2 /O <${owner.toString("hex")}> /U <${user.toString("hex")}> /P ${permissions} >>`,
  ], {
    version: "1.4",
    trailer: `/Encrypt 6 0 R /ID [<${id.toString("hex")}> <${id.toString("hex")}>]`,
  });
}

function deterministicBytes(label, length) {
  return crypto.createHash("sha256").update(label).digest().subarray(0, length);
}

function aes(mode, key, iv, input, autoPadding = false) {
  const cipher = crypto.createCipheriv(mode, key, iv);
  cipher.setAutoPadding(autoPadding);
  return Buffer.concat([cipher.update(input), cipher.final()]);
}

function r6Hash(password, salt, userKey = Buffer.alloc(0)) {
  let key = crypto.createHash("sha256").update(Buffer.concat([password, salt, userKey])).digest();
  let encrypted = Buffer.from([0]);
  let iteration = 0;
  while (iteration < 64 || encrypted[encrypted.length - 1] > iteration - 32) {
    const block = Buffer.concat([password, key, userKey]);
    encrypted = aes("aes-128-cbc", key.subarray(0, 16), key.subarray(16, 32), Buffer.concat(Array(64).fill(block)));
    const algorithm = ["sha256", "sha384", "sha512"][encrypted.subarray(0, 16).reduce((sum, byte) => sum + byte, 0) % 3];
    key = crypto.createHash(algorithm).update(encrypted).digest();
    iteration += 1;
  }
  return key.subarray(0, 32);
}

function createR6Pdf(name, userPassword, permissions) {
  const password = Buffer.from(userPassword);
  const ownerPassword = Buffer.from("owner-secret");
  const fileKey = deterministicBytes(`${name} filekey`, 32);
  const userValidationSalt = deterministicBytes(`${name} uv`, 8);
  const userKeySalt = deterministicBytes(`${name} uk`, 8);
  const ownerValidationSalt = deterministicBytes(`${name} ov`, 8);
  const ownerKeySalt = deterministicBytes(`${name} ok`, 8);
  const user = Buffer.concat([r6Hash(password, userValidationSalt), userValidationSalt, userKeySalt]);
  const owner = Buffer.concat([r6Hash(ownerPassword, ownerValidationSalt, user), ownerValidationSalt, ownerKeySalt]);
  const encryptedUserKey = aes("aes-256-cbc", r6Hash(password, userKeySalt), Buffer.alloc(16), fileKey);
  const encryptedOwnerKey = aes("aes-256-cbc", r6Hash(ownerPassword, ownerKeySalt, user), Buffer.alloc(16), fileKey);
  const plainPermissions = Buffer.alloc(16, 255);
  plainPermissions.writeInt32LE(permissions);
  plainPermissions.write("Tadb", 8, "ascii");
  deterministicBytes(`${name} perms`, 4).copy(plainPermissions, 12);
  const encryptedPermissions = aes("aes-256-ecb", fileKey, null, plainPermissions);
  const text = `R6 fixture ${name}`;
  const plainContents = Buffer.from(`BT /F1 18 Tf 30 120 Td (${text}) Tj ET\n`);
  const initializationVector = deterministicBytes(`${name} stream`, 16);
  const encryptedContents = Buffer.concat([initializationVector, aes("aes-256-cbc", fileKey, initializationVector, plainContents, true)]);
  const hex = (bytes) => `<${bytes.toString("hex")}>`;
  const id = hex(deterministicBytes(`${name} id`, 16));
  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R /Extensions << /ADBE << /BaseVersion /1.7 /ExtensionLevel 8 >> >> >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    pdfStream(encryptedContents),
    `<< /Filter /Standard /V 5 /R 6 /Length 256 /O ${hex(owner)} /U ${hex(user)} /OE ${hex(encryptedOwnerKey)} /UE ${hex(encryptedUserKey)} /P ${permissions} /Perms ${hex(encryptedPermissions)} /EncryptMetadata true /CF << /StdCF << /CFM /AESV3 /AuthEvent /DocOpen /Length 32 >> >> /StmF /StdCF /StrF /StdCF >>`,
  ], { trailer: `/Encrypt 6 0 R /ID [${id} ${id}]` });
}

function createBackgroundFixtures() {
  const shared = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  return [
    ["empty-contents.pdf", assemblePdf([shared[0], shared[1], "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents [] >>", shared[2]]), { contentsKind: "empty-array", streamCount: 0 }],
    ["single-stream.pdf", simplePdf(), { contentsKind: "single-reference", streamCount: 1 }],
    ["multiple-streams.pdf", assemblePdf([shared[0], shared[1], "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents [4 0 R 5 0 R] >>", pdfStream("q 0 0 1 rg 20 20 80 80 re f Q"), pdfStream("q 1 0 0 rg 100 100 40 40 re f Q")]), { contentsKind: "reference-array", streamCount: 2 }],
    ["malformed-contents-type.pdf", assemblePdf([shared[0], shared[1], "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>", "<< /Type /NotAStream >>"]), { contentsKind: "non-stream-reference", streamCount: 0 }],
  ];
}

function createOrdinaryPropertiesPdf() {
  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Properties << /TextInfo 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Lang (en) /MCID 0 >>",
    pdfStream("/Span /TextInfo BDC q 0 0 1 rg 20 20 80 80 re f Q EMC"),
  ]);
}

function createNoResourcesPdf() {
  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>",
    pdfStream(""),
  ]);
}

function createTaggedPdf() {
  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R /MarkInfo << /Marked true >> /StructTreeRoot 6 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /StructParents 0 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    pdfStream("/P << /MCID 0 >> BDC BT /F1 18 Tf 30 100 Td (Tagged fixture) Tj ET EMC"),
    "<< /Type /StructTreeRoot /K [7 0 R] /ParentTree << /Nums [0 [7 0 R]] >> /ParentTreeNextKey 1 >>",
    "<< /Type /StructElem /S /P /P 6 0 R /Pg 3 0 R /K 0 >>",
  ]);
}

function createDangerousActionsPdf() {
  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R /OpenAction 6 0 R /Names << /JavaScript << /Names [(startup) 7 0 R] >> >> >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Annots [8 0 R] >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    pdfStream("BT /F1 18 Tf 30 100 Td (Dangerous action fixture) Tj ET"),
    "<< /S /JavaScript /JS (app.alert\\(\\'fixture\\'\\)) >>",
    "<< /S /JavaScript /JS (this.print\\(\\)) >>",
    "<< /Type /Annot /Subtype /Link /Rect [20 20 180 50] /A << /S /Launch /F (fixture.exe) >> >>",
  ]);
}

function createRemovalPdf() {
  const annotations = [12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 27, 32, 33, 34, 35, 36].map((objectNumber) => `${objectNumber} 0 R`).join(" ");
  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R /Outlines 7 0 R /Names 8 0 R /Dests << /LegacyTarget [4 0 R /Fit] >> /PageLabels 9 0 R /ViewerPreferences << /HideToolbar true /Duplex /DuplexFlipLongEdge >> /Metadata 10 0 R /AcroForm 11 0 R /AF [25 0 R] >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R /Annots [${annotations}] >>`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    pdfStream("BT /F1 16 Tf 30 260 Td (Removal structures fixture) Tj ET"),
    "<< /Type /Outlines /First 28 0 R /Last 28 0 R /Count 1 >>",
    "<< /EmbeddedFiles 31 0 R /Dests << /Names [(namedTarget) [4 0 R /Fit]] >> /JavaScript << /Names [(fixtureScript) 29 0 R] >> >>",
    "<< /Nums [0 << /S /r /St 1 >> 1 << /S /D /P (A-) /St 1 >>] >>",
    pdfStream("<?xpacket begin='﻿' id='W5M0MpCehiHzreSzNTczkc9d'?><x:xmpmeta xmlns:x='adobe:ns:meta/'><rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'><rdf:Description rdf:about='' xmlns:pdf='http://ns.adobe.com/pdf/1.3/'><pdf:Producer>Worklazy fixture</pdf:Producer><pdf:Keywords>remove-me</pdf:Keywords></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end='w'?>", "/Type /Metadata /Subtype /XML"),
    "<< /Fields [20 0 R] /NeedAppearances true /DA (/Helv 12 Tf 0 g) >>",
    "<< /Type /Annot /Subtype /Link /Rect [20 220 140 245] /A << /S /URI /URI (https://example.invalid/fixture) >> >>",
    "<< /Type /Annot /Subtype /Link /Rect [20 190 140 215] /Dest [4 0 R /Fit] >>",
    "<< /Type /Annot /Subtype /Link /Rect [20 160 140 185] /Dest (namedTarget) >>",
    "<< /Type /Annot /Subtype /Text /Rect [160 220 180 240] /Contents (note fixture) >>",
    "<< /Type /Annot /Subtype /FreeText /Rect [160 180 280 215] /Contents (free text fixture) /DA (/Helv 10 Tf 0 g) >>",
    "<< /Type /Annot /Subtype /Highlight /Rect [20 120 140 145] /QuadPoints [20 145 140 145 20 120 140 120] >>",
    "<< /Type /Annot /Subtype /Ink /Rect [160 120 280 155] /InkList [[160 120 200 150 280 125]] >>",
    "<< /Type /Annot /Subtype /Stamp /Rect [20 70 100 105] /Name /Approved >>",
    "<< /Type /Annot /Subtype /Widget /Rect [110 70 280 105] /FT /Tx /T (fixtureField) /V (fixture value) /P 3 0 R /AP << /N 21 0 R >> >>",
    pdfStream("q 0.9 0.9 0.9 rg 0 0 170 35 re f Q", "/Type /XObject /Subtype /Form /BBox [0 0 170 35] /Resources << >>"),
    "<< /Type /Annot /Subtype /FileAttachment /Rect [20 20 40 40] /FS 25 0 R /Name /PushPin >>",
    "<< /Type /Annot /Subtype /Square /Rect [50 20 90 55] /C [1 0 0] >>",
    "<< /Type /Annot /Subtype /Circle /Rect [100 20 140 55] /C [0 0 1] >>",
    "<< /Type /Filespec /F (fixture.txt) /UF (fixture.txt) /Desc (embedded fixture) /EF << /F 26 0 R /UF 26 0 R >> /AFRelationship /Data >>",
    pdfStream("PDF finish embedded attachment sentinel\n", "/Type /EmbeddedFile /Subtype /text#2Fplain /Params << /Size 40 >>"),
    "<< /Type /Annot /Subtype /Popup /Rect [150 20 210 55] /Parent 15 0 R >>",
    "<< /Title (Fixture outline) /Parent 7 0 R /Dest [3 0 R /Fit] >>",
    "<< /S /JavaScript /JS (app.alert\\(\\'remove me\\'\\)) >>",
    "<< /Producer (Worklazy fixture generator) /Title (Removal metadata fixture) >>",
    "<< /Names [(fixture.txt) 25 0 R] >>",
    "<< /Type /Annot /Subtype /Line /Rect [20 60 90 80] /L [20 60 90 80] >>",
    "<< /Type /Annot /Subtype /Polygon /Rect [100 60 180 100] /Vertices [100 60 140 100 180 60] >>",
    "<< /Type /Annot /Subtype /Caret /Rect [190 60 220 90] /Sy /P >>",
    "<< /Type /Annot /Subtype /Redact /Rect [225 60 285 90] /QuadPoints [225 90 285 90 225 60 285 60] /OverlayText (redact fixture) >>",
    "<< /Type /Annot /Subtype /Text /Rect [220 20 240 40] /Contents (reply fixture) /IRT 15 0 R >>",
  ], { info: 30 });
}

function encryptedOracle(revision, variant, permissions) {
  const openPermissions = [4, 8, 16, 32, 256, 512, 1024, 2048];
  const restrictedPermissions = revision === 2 ? [256, 512, 1024, 2048] : [];
  const passwordRequired = variant === "open";
  return {
    revision: `R${revision}`,
    variant,
    permissionsValue: permissions,
    expectedText: revision === 2 ? "R2 fixture" : `R6 fixture ${variant}`,
    finishAcceptance: "reject-permissions-not-null",
    attempts: {
      omitted: passwordRequired ? { result: "PasswordException", code: 1 } : { result: "OPEN", permissions: restrictedPermissions },
      empty: passwordRequired ? { result: "PasswordException", code: 1 } : { result: "OPEN", permissions: restrictedPermissions },
      wrong: { result: "PasswordException", code: 2 },
      correct: { result: "OPEN", permissions: variant === "open" ? openPermissions : restrictedPermissions },
      owner: { result: "OPEN", permissions: variant === "open" ? openPermissions : restrictedPermissions },
    },
  };
}

export async function generatePdfFinishFixtures(outputDirectory = defaultOutputDirectory) {
  const resolvedOutput = path.resolve(outputDirectory);
  await fs.mkdir(resolvedOutput, { recursive: true });
  for (const ownedPath of ["encrypted", "damage", "background", "risk", "removal", "ordinary", "ocg", "manifest.json"]) {
    await fs.rm(path.join(resolvedOutput, ownedPath), { recursive: true, force: true });
  }
  const records = [];
  const writeFixture = async (category, name, bytes, expectation) => {
    const directory = path.join(resolvedOutput, category);
    await fs.mkdir(directory, { recursive: true });
    const file = path.posix.join(category, name);
    await fs.writeFile(path.join(resolvedOutput, file), bytes);
    const record = { file, category, bytes: bytes.length, sha256: sha256(bytes), expectation };
    records.push(record);
    return record;
  };

  const encrypted = [
    ["encrypted-r2-open.pdf", createR2Pdf("open-secret", -4), encryptedOracle(2, "open", -4)],
    ["encrypted-r2-restricted.pdf", createR2Pdf("", -64), encryptedOracle(2, "restricted", -64)],
    ["encrypted-r6-open.pdf", createR6Pdf("open", "open-secret", -4), encryptedOracle(6, "open", -4)],
    ["encrypted-r6-restricted.pdf", createR6Pdf("restricted", "", -3904), encryptedOracle(6, "restricted", -3904)],
  ];
  for (const fixture of encrypted) await writeFixture("encrypted", ...fixture);

  const validDamageSource = simplePdf({ contents: "BT /F1 18 Tf 30 100 Td (Damage fixture) Tj ET" });
  const truncated = validDamageSource.subarray(0, Math.floor(validDamageSource.length / 2));
  const badXref = Buffer.from(validDamageSource.toString("binary").replace(/\d{10} 00000 n/g, "9999999999 00000 n"), "binary");
  const unknownCommand = simplePdf({ contents: "q 0 0 1 rg 20 20 80 80 re f UNKNOWN_FINISH_COMMAND Q" });
  await writeFixture("damage", "truncated-half.pdf", truncated, { pdfjs: "InvalidPDFException", open: false });
  await writeFixture("damage", "xref-offset-all-9.pdf", badXref, { pdfjs: "OPEN", pages: 1, recovery: true });
  await writeFixture("damage", "malformed-contents.pdf", unknownCommand, { pdfjs: "OPEN", pages: 1, warningIncludes: "Unknown command" });

  for (const fixture of createBackgroundFixtures()) await writeFixture("background", ...fixture);
  await writeFixture("risk", "graphics-state-imbalance.pdf", simplePdf({ contents: "q q 0 0 1 rg 20 20 80 80 re f Q" }), { risk: "unbalanced-q-Q", q: 2, Q: 1 });
  await writeFixture("risk", "tagged-structure.pdf", createTaggedPdf(), { risk: "tagged-pdf", catalogKeys: ["MarkInfo", "StructTreeRoot"] });
  await writeFixture("risk", "dangerous-actions.pdf", createDangerousActionsPdf(), { risk: "active-content", catalogKeys: ["OpenAction", "Names.JavaScript"], annotationActions: ["Launch"] });
  await writeFixture("removal", "removal-structures.pdf", createRemovalPdf(), {
    catalogKeys: ["Outlines", "Names", "Dests", "PageLabels", "ViewerPreferences", "Metadata", "AcroForm", "AF"],
    namesKeys: ["EmbeddedFiles", "Dests", "JavaScript"],
    annotationSubtypes: ["Link", "Text", "FreeText", "Highlight", "Ink", "Stamp", "Widget", "FileAttachment", "Square", "Circle", "Popup", "Line", "Polygon", "Caret", "Redact"],
    annotationRelationships: ["Popup.Parent", "Text.IRT"],
    linkKinds: ["URI", "direct-destination", "named-destination"],
    embeddedSentinel: "PDF finish embedded attachment sentinel",
    xmpSentinel: "<pdf:Keywords>remove-me</pdf:Keywords>",
  });
  await writeFixture("ordinary", "named-properties.pdf", createOrdinaryPropertiesPdf(), {
    preflight: { allowed: true, reason: "allow" },
    markedContent: "/Span /TextInfo BDC",
    pixelOracle: {
      poppler: [{ page: 1, width: 200, height: 200, sha256: "04ce6cfbce82aad25e57dc2c640efdad56a16de829925daa0fdbaf473c9a101b" }],
      pdfjs: [{ page: 1, width: 200, height: 200, sha256: "04ce6cfbce82aad25e57dc2c640efdad56a16de829925daa0fdbaf473c9a101b" }],
    },
  });
  await writeFixture("ordinary", "no-resources.pdf", createNoResourcesPdf(), {
    preflight: { allowed: true, reason: "allow" },
    resources: "omitted",
    pixelOracle: {
      poppler: [{ page: 1, width: 200, height: 200, sha256: "cdbf6c0880cfbeebfa8480444fef83685e70091bf1f23a5e8a71564d1f8be33a" }],
      pdfjs: [{ page: 1, width: 200, height: 200, sha256: "cdbf6c0880cfbeebfa8480444fef83685e70091bf1f23a5e8a71564d1f8be33a" }],
    },
  });

  const ocgSeed = JSON.parse(zlib.gunzipSync(await fs.readFile(ocgSeedPath)));
  if (ocgSeed.schemaVersion !== 1 || ocgSeed.fixtures.length !== 87) throw new Error("Unsupported OCG snapshot seed.");
  const ocgRecords = [];
  for (const fixture of ocgSeed.fixtures) {
    const bytes = Buffer.from(fixture.bytes, "base64");
    if (sha256(bytes) !== fixture.sha256) throw new Error(`OCG snapshot SHA mismatch for ${fixture.name}`);
    const record = await writeFixture("ocg", `${fixture.name}.pdf`, bytes, {
      cohort: fixture.cohort,
      representativeGroup: fixture.representativeGroup,
      preflight: { allowed: fixture.expectedAllowed, reason: fixture.expectedReason },
      pixelOracle: fixture.pixelOracle,
    });
    ocgRecords.push(record);
  }

  const counts = Object.fromEntries([...Map.groupBy(records, ({ category }) => category)].map(([category, values]) => [category, values.length]));
  const manifest = {
    schemaVersion: 1,
    generator: "scripts/generate-pdf-finish-fixtures.mjs",
    deterministicInputs: "fixed test-only keys, salts, strings, object ordering, and canonical OCG snapshot bytes",
    counts: { total: records.length, byCategory: counts, ocg: ocgSeed.counts },
    passwords: { user: "open-secret", owner: "owner-secret", wrong: "incorrect" },
    ocg: {
      exactShaRequired: true,
      pixelOracleCohorts: ["allowed", "direct-array-regression", "representative"],
      preflightCohorts: ["allowed", "excluded", "direct-array-regression", "representative"],
      exploration: ocgSeed.exploration,
      files: ocgRecords.map(({ file, sha256: hash, expectation }) => ({ file, sha256: hash, ...expectation })),
    },
    fixtures: records,
  };
  await fs.writeFile(path.join(resolvedOutput, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputDirectory = process.argv[2] ? path.resolve(process.argv[2]) : defaultOutputDirectory;
  const manifest = await generatePdfFinishFixtures(outputDirectory);
  console.log(JSON.stringify({ outputDirectory, counts: manifest.counts }, null, 2));
}
