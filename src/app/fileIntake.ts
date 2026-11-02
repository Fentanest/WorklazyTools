import { fileAccepts, isolatedFileAccepts, type IsolatedReceiverId, type ReceiverId } from "./fileAccepts.ts";

export type FileKind = "spreadsheet" | "pdf" | "image" | "office" | "video" | "other";
export interface IntakeCandidate { receiverId: ReceiverId | IsolatedReceiverId | "office"; entryPath: string; files: File[]; roles?: ("template" | "data")[]; tab?: "edit" | "batch" }
export interface IntakeGroup { kind: FileKind | "mailmerge"; files: File[]; candidates: IntakeCandidate[]; hint?: "excel" | "data" | "pdf" | "image" | "template" }
export interface FileIntake { groups: IntakeGroup[]; count: number; tooMany: boolean; mixed: boolean }
const sheets = fileAccepts["excel-cleaner"].extensions as readonly string[];
const images = fileAccepts["image-batch"].extensions as readonly string[];
const office = ["docx", "doc", "odt", "pptx", "ppt", "odp", "ods", "xlsx", "xls"];
const extension = (file: File) => file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";

export async function classifyFile(file: File): Promise<{ file: File; kind: FileKind }> {
  let ext = extension(file);
  if (!ext) {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
    if (ascii(0, 4) === "%PDF") ext = "pdf";
    else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ext = "jpg";
    else if ([137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) ext = "png";
    else if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") ext = "webp";
    // Receivers intentionally share an extension contract. Add the sniffed
    // suffix locally so preflight and the existing tool parser agree.
    if (ext) file = new File([file], `${file.name}.${ext}`, { type: file.type, lastModified: file.lastModified });
  }
  const kind = sheets.includes(ext) ? "spreadsheet" : ext === "pdf" ? "pdf" : images.includes(ext) ? "image"
    : office.includes(ext) || ["hwp", "hwpx"].includes(ext) ? "office" : /^(mp4|webm|mov|avi|mkv|m4v|mpeg|mpg|ogv)$/.test(ext) ? "video" : "other";
  return { file, kind };
}
function candidate(receiverId: ReceiverId, files: File[], extra: Partial<IntakeCandidate> = {}): IntakeCandidate {
  return { receiverId, entryPath: fileAccepts[receiverId].paths[0], files, ...extra };
}
function group(kind: FileKind, files: File[]): IntakeGroup {
  const first = files[0];
  const candidates: IntakeCandidate[] = [];
  let hint: IntakeGroup["hint"];
  if (kind === "spreadsheet") {
    candidates.push(candidate(files.length === 1 ? "excel-cleaner" : "excel-merger", files));
    if (files.length > 1 || extension(first) === "csv") candidates.push(candidate(files.length === 1 ? "excel-merger" : "excel-cleaner", files));
    else if (office.includes(extension(first))) candidates.push({ receiverId: "office", entryPath: "/tools/office-editor/app", files });
    hint = files.every(file => ["xlsx", "csv"].includes(extension(file))) ? "data" : "excel";
  } else if (kind === "pdf") {
    candidates.push(candidate("pdf-organize", files, { entryPath: files.length === 1 ? "/tools/pdf-editor" : "/tools/pdf-editor/merge" }), candidate("pdf-finish", files));
    if (files.length === 1) hint = "pdf";
  } else if (kind === "image") {
    candidates.push(candidate(files.length === 1 ? "image-edit" : "image-batch", files, { tab: files.length === 1 ? "edit" : "batch" }), candidate("image-privacy", files));
    if (files.length === 1) { candidates.push(candidate("image-batch", files, { tab: "batch" })); hint = "image"; }
  } else if (kind === "office" && files.length === 1) {
    if (office.includes(extension(first))) candidates.push({ receiverId: "office", entryPath: "/tools/office-editor/app", files });
    if (extension(first) === "docx") hint = "template";
  }
  // H2: append isolated choices without changing the existing primary choices.
  for (const receiverId of Object.keys(isolatedFileAccepts) as IsolatedReceiverId[]) {
    const definition = isolatedFileAccepts[receiverId];
    if (receiverId === "xls-preserve" && !files.some(file => extension(file) === "xls")) continue;
    if (files.length <= definition.max && files.every(file => (definition.extensions as readonly string[]).includes(extension(file))))
      candidates.push({ receiverId, entryPath: definition.path, files });
  }
  return { kind, files, candidates, hint };
}
export async function intakeFiles(input: File[]): Promise<FileIntake> {
  if (!input.length || input.length > 50) return { groups: [], count: input.length, tooMany: input.length > 50, mixed: false };
  const classified = await Promise.all(input.map(classifyFile));
  const buckets = new Map<FileKind, File[]>();
  for (const item of classified) buckets.set(item.kind, [...(buckets.get(item.kind) ?? []), item.file]);
  const groups = [...buckets].map(([kind, files]) => group(kind, files));
  const templates = classified.filter(item => extension(item.file) === "docx");
  const data = classified.filter(item => ["xlsx", "csv"].includes(extension(item.file)));
  if (templates.length === 1 && data.length >= 1 && data.length <= 49 && data.length + 1 === input.length) {
    const files = [templates[0].file, ...data.map(item => item.file)];
    groups.unshift({ kind: "mailmerge", files, candidates: [candidate("document-generator", files, { roles: files.map((_, index) => index ? "data" : "template") })] });
  }
  return { groups, count: input.length, tooMany: false, mixed: buckets.size > 1 };
}
