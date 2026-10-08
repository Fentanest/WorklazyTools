// BentoPDF uses @bentopdf/pymupdf-wasm 0.11.16. Keep its Pyodide/wheel set
// together and patch the published wrapper at this single, checked entrypoint.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const source = path.join(root, "node_modules", "@bentopdf", "pymupdf-wasm");
const manifest = JSON.parse(await fs.readFile(path.join(source, "package.json"), "utf8"));
const destination = path.join(root, "public", "vendor", "bento-pymupdf", manifest.version);
if (manifest.version !== "0.11.16") throw new Error(`Unexpected Bento PyMuPDF version: ${manifest.version}`);
const requiredAssets = [
  "pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip",
  "pymupdf-1.26.3-cp313-none-pyodide_2025_0_wasm32.whl",
  "pdf2docx-0.5.8-py3-none-any.whl", "python_docx-1.2.0-py3-none-any.whl",
];
for (const name of requiredAssets) await fs.access(path.join(source, "assets", name));
await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(destination, { recursive: true });
await fs.cp(path.join(source, "assets"), path.join(destination, "assets"), { recursive: true });

let wrapper = await fs.readFile(path.join(source, "dist", "index.js"), "utf8");
const originalSha256 = createHash("sha256").update(wrapper).digest("hex");
if (originalSha256 !== "8dccc58daed71e6898edf99200334e1db665a39265c93ff7cc1ca46101b4eab7") throw new Error("Bento PyMuPDF wrapper source hash changed");
const begin = wrapper.indexOf("  async pdfToDocx(pdf, pages) {");
const end = wrapper.indexOf("  async merge(pdfs) {", begin);
if (begin < 0 || end < 0 || !wrapper.slice(begin, end).includes('cv.convert("/output.docx", pages=${pagesArg})')) {
  throw new Error("Bento PyMuPDF 0.11.16 wrapper layout changed; review the DOCX patch");
}
// Source: github.com/alam00000/bentopdf-pymupdf-wasm src/pymupdf.ts,
// a104fd5de9c74d06eb030ee35ab6fa4f6e92694b. Changes: per-job FS paths,
// strict pdf2docx page errors, try/finally cleanup and no full-document RGB pass.
wrapper = wrapper.slice(0, begin) + `  async pdfToDocx(pdf, pages) {
    const pyodide = await this.getPyodide();
    const job = ++this.docCounter;
    const input = \`/input_docx_\${job}.pdf\`;
    const output = \`/output_docx_\${job}.docx\`;
    pyodide.FS.writeFile(input, new Uint8Array(await pdf.arrayBuffer()));
    const pagesArg = pages ? \`[\${pages.join(", ")}]\` : "None";
    try {
      pyodide.runPython(\`
import pymupdf
from pdf2docx import Converter
from pdf2docx.image.ImagesExtractor import ImagesExtractor
_wl_orig_to_raw_dict = ImagesExtractor._to_raw_dict
_wl_orig_descriptor = vars(ImagesExtractor)['_to_raw_dict']
def _wl_rgb_image(image, bbox):
    pix = image
    if getattr(pix, 'colorspace', None) and pix.colorspace.name.upper() not in ('DEVICEGRAY', 'GRAY', 'DEVICERGB', 'RGB', 'SRGB'):
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    return _wl_orig_to_raw_dict(pix, bbox)
ImagesExtractor._to_raw_dict = staticmethod(_wl_rgb_image)
try:
    cv = Converter(\${JSON.stringify(input)})
    try:
        cv.convert(\${JSON.stringify(output)}, pages=\${pagesArg}, ignore_page_error=False)
    finally:
        cv.close()
finally:
    ImagesExtractor._to_raw_dict = _wl_orig_descriptor
    for _wl_name in ('cv', '_wl_orig_to_raw_dict', '_wl_orig_descriptor', '_wl_rgb_image'):
        globals().pop(_wl_name, None)
    globals().pop('_wl_name', None)
\`);
      return new Blob([new Uint8Array(pyodide.FS.readFile(output))], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });
    } finally {
      for (const file of [input, output]) {
        try { pyodide.FS.unlink(file); } catch { /* conversion may have failed before writing */ }
      }
    }
  }
  async pageImagesToDocx(pages) {
    const pyodide = await this.getPyodide();
    const job = ++this.docCounter;
    const output = \`/page_images_\${job}.docx\`;
    const records = [];
    try {
      for (let index = 0; index < pages.length; index++) {
        const input = \`/page_image_\${job}_\${index}.jpg\`;
        pyodide.FS.writeFile(input, new Uint8Array(await pages[index].blob.arrayBuffer()));
        records.push({ input, width: pages[index].width, height: pages[index].height });
      }
      const serialized = JSON.stringify(records);
      pyodide.runPython(\`
import json
from docx import Document
from docx.shared import Pt
from docx.enum.section import WD_SECTION_START
_wl_pages = json.loads(\${JSON.stringify(serialized)})
_wl_doc = Document()
for _wl_index, _wl_page in enumerate(_wl_pages):
    _wl_section = _wl_doc.sections[0] if _wl_index == 0 else _wl_doc.add_section(WD_SECTION_START.NEW_PAGE)
    _wl_section.page_width = Pt(_wl_page['width'])
    _wl_section.page_height = Pt(_wl_page['height'])
    _wl_section.top_margin = Pt(0)
    _wl_section.bottom_margin = Pt(0)
    _wl_section.left_margin = Pt(0)
    _wl_section.right_margin = Pt(0)
    _wl_paragraph = _wl_doc.add_paragraph()
    _wl_paragraph.paragraph_format.space_before = Pt(0)
    _wl_paragraph.paragraph_format.space_after = Pt(0)
    _wl_paragraph.paragraph_format.line_spacing = 1
    _wl_scale = min((_wl_page['width'] - 2) / _wl_page['width'], (_wl_page['height'] - 2) / _wl_page['height'])
    _wl_paragraph.add_run().add_picture(_wl_page['input'], width=Pt(_wl_page['width'] * _wl_scale), height=Pt(_wl_page['height'] * _wl_scale))
_wl_doc.save(\${JSON.stringify(output)})
del _wl_pages, _wl_doc, _wl_index, _wl_page, _wl_section, _wl_paragraph, _wl_scale
\`);
      return new Blob([new Uint8Array(pyodide.FS.readFile(output))], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });
    } finally {
      for (const entry of records) { try { pyodide.FS.unlink(entry.input); } catch { /* absent */ } }
      try { pyodide.FS.unlink(output); } catch { /* absent */ }
    }
  }
  async inspectTextLayers(pdf, pages) {
    const pyodide = await this.getPyodide();
    const job = ++this.docCounter;
    const input = \`/layer_profile_\${job}.pdf\`;
    pyodide.FS.writeFile(input, new Uint8Array(await pdf.arrayBuffer()));
    try {
      const requested = pages ? JSON.stringify(pages) : "None";
      pyodide.runPython(\`
import pymupdf, json
_wl_profile = []
def _wl_image_union(images, page):
    boxes = []
    for image in images:
        box = pymupdf.Rect(image['bbox']) * page.rotation_matrix
        x0 = max(0, box.x0)
        y0 = max(0, box.y0)
        x1 = min(page.rect.width, box.x1)
        y1 = min(page.rect.height, box.y1)
        if x1 > x0 and y1 > y0:
            boxes.append((x0, y0, x1, y1))
    if not boxes:
        return 0
    edges = sorted({x for box in boxes for x in (box[0], box[2])})
    area = 0
    for left, right in zip(edges, edges[1:]):
        rows = sorted((box[1], box[3]) for box in boxes if box[0] < right and box[2] > left)
        end = float('-inf')
        height = 0
        for top, bottom in rows:
            if bottom > end:
                height += bottom - max(top, end)
                end = bottom
        area += (right - left) * height
    return min(1, area / max(1, page.rect.width * page.rect.height))
with pymupdf.open(\${JSON.stringify(input)}) as _wl_document:
    for _wl_index in (\${requested} if \${requested} is not None else range(len(_wl_document))):
        _wl_page = _wl_document[_wl_index]
        _wl_images = _wl_page.get_image_info()
        _wl_coverage = _wl_image_union(_wl_images, _wl_page)
        _wl_hidden = []
        _wl_visible = []
        _wl_visible_chars = 0
        for _wl_span in _wl_page.get_texttrace():
            _wl_text = ''.join(chr(char[0]) for char in _wl_span['chars'] if 0 < char[0] <= 0x10ffff)
            _wl_box = list(pymupdf.Rect(_wl_span['bbox']) * _wl_page.rotation_matrix)
            if _wl_span['type'] == 3 or _wl_span.get('opacity', 1) < 0.05:
                if _wl_text.strip():
                    _wl_hidden.append({'text': _wl_text, 'bbox': _wl_box, 'type': _wl_span['type']})
            else:
                _wl_visible_chars += len(_wl_text.strip())
                if _wl_text.strip():
                    _wl_visible.append({'text': _wl_text, 'bbox': _wl_box, 'type': _wl_span['type']})
        _wl_profile.append({'pageIndex': _wl_index, 'rotation': _wl_page.rotation, 'width': _wl_page.rect.width, 'height': _wl_page.rect.height, 'imageCoverage': _wl_coverage, 'visibleCharacters': _wl_visible_chars, 'hiddenSpans': _wl_hidden, 'visibleSpans': _wl_visible})
_wl_profile_json = json.dumps(_wl_profile, ensure_ascii=False)
for _wl_name in ('_wl_profile', '_wl_image_union', '_wl_document', '_wl_index', '_wl_page', '_wl_images', '_wl_coverage', '_wl_hidden', '_wl_visible', '_wl_visible_chars', '_wl_span', '_wl_text', '_wl_box'):
    globals().pop(_wl_name, None)
globals().pop('_wl_name', None)
\`);
      return JSON.parse(pyodide.runPython("_wl_profile_json"));
    } finally {
      try { pyodide.FS.unlink(input); } catch { /* absent */ }
      try { pyodide.runPython("globals().pop('_wl_profile_json', None)"); } catch { /* absent */ }
    }
  }
` + wrapper.slice(end);

// Failure must evict both the pending promise and the instance's failed state.
const oldInit = "    this.pyodide = await this.pyodidePromise;\n    return this.pyodide;";
const newInit = "    try {\n      this.pyodide = await this.pyodidePromise;\n      return this.pyodide;\n    } catch (error) {\n      this.pyodidePromise = null;\n      this.pyodide = null;\n      throw error;\n    }";
if (!wrapper.includes(oldInit)) throw new Error("Bento PyMuPDF initialization layout changed");
wrapper = wrapper.replace(oldInit, newInit);
const oldClose = `  close() {
    if (this.closed) return;
    try {
      this.runPython(\`\${this.docVar}.close()\`);
      this.pyodide.FS.unlink(this.inputPath);
    } catch {
    }
    this.closed = true;
  }`;
const newClose = `  close() {
    if (this.closed) return;
    try { this.runPython(\`\${this.docVar}.close()\`); } finally {
      try { this.runPython(\`globals().pop(\${JSON.stringify(this.docVar)}, None)\`); } catch { /* no Python binding */ }
      try { this.pyodide.FS.unlink(this.inputPath); } catch { /* no input file */ }
      this.closed = true;
    }
  }`;
if (!wrapper.includes(oldClose)) throw new Error("Bento PyMuPDF document close layout changed");
wrapper = wrapper.replace(oldClose, newClose);
const oldOpen = `    pyodide.FS.writeFile(inputPath, new Uint8Array(buf));
    pyodide.runPython(\`\${docVar} = pymupdf.open("\${inputPath}")\`);
    return new PyMuPDFDocument(pyodide, docVar, inputPath);`;
const newOpen = `    pyodide.FS.writeFile(inputPath, new Uint8Array(buf));
    try {
      pyodide.runPython(\`\${docVar} = pymupdf.open("\${inputPath}")\`);
      return new PyMuPDFDocument(pyodide, docVar, inputPath);
    } catch (error) {
      try { pyodide.runPython(\`globals().pop(\${JSON.stringify(docVar)}, None)\`); } catch { /* no binding */ }
      try { pyodide.FS.unlink(inputPath); } catch { /* no input file */ }
      throw error;
    }`;
if (!wrapper.includes(oldOpen)) throw new Error("Bento PyMuPDF document open layout changed");
wrapper = wrapper.replace(oldOpen, newOpen);
const oldTables = `json.dumps(result)
\`);
    return JSON.parse(result);
  }
  tablesToMarkdown(options)`;
const newTables = `_wl_table_json = json.dumps(result)
for _wl_name in ('page', 'tables', 'result', 'table', 'bbox', 'header', 'header_data', 'header_bbox', 'rows', 'markdown'):
    globals().pop(_wl_name, None)
globals().pop('_wl_name', None)
_wl_table_json
\`);
    try { return JSON.parse(result); }
    finally { this.runPython("globals().pop('_wl_table_json', None)"); }
  }
  tablesToMarkdown(options)`;
if (!wrapper.includes(oldTables)) throw new Error("Bento PyMuPDF table extraction layout changed");
wrapper = wrapper.replace(oldTables, newTables);
await fs.mkdir(path.join(destination, "dist"), { recursive: true });
await fs.writeFile(path.join(destination, "dist", "index.js"), wrapper);
const assetHashes = Object.fromEntries(await Promise.all((await fs.readdir(path.join(source, "assets"))).map(async name => [name, createHash("sha256").update(await fs.readFile(path.join(source, "assets", name))).digest("hex")])));
await fs.writeFile(path.join(destination, "manifest.json"), JSON.stringify({ version: manifest.version, originalSha256, patchedSha256: createHash("sha256").update(wrapper).digest("hex"), assetHashes }, null, 2));
