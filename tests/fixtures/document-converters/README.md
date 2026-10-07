# Synthetic document conversion fixtures

Created by `generate-office-probe.mjs` using the repository-pinned LibreOffice WASM runtime. Writer contains two Korean/English lines; Calc contains three cells; Impress contains one text shape. No user document or remote input is used. Inputs are actual Office files, not renamed text files. `sample.pdf` is the generated `docx.pdf`. The generator writes into an explicit temporary directory by default and does not overwrite these pinned files.

`markdown-expected.json` records unmodified Microsoft MarkItDown 0.1.8 `MarkItDown(enable_plugins=False).convert()` outputs in CPython 3.12.3. Browser tests compare exact normalized Markdown. The primary success criterion is converter compatibility and text correctness on these small inputs, not rich-document fidelity. Initial spreadsheet column widths are default; they do not establish a layout-quality guarantee.

See SHA256.json for the input identities. The same controlled fixtures were tested with Pyodide 0.29.4 / Chromium, with all external requests blocked.

`generate-rich.mjs` creates two-page Korean DOCX/XLSX/PDF files with tables, numeric cell 42, and a synthetic coral rectangle. The PDF embeds the full locally pinned Nanum font; the earlier subset-font fixture rendered missing glyphs and is retained only in the ignored job diagnostics. `scanned.pdf` rasterizes the corrected first page at 150 dpi. The original paragraph OCR segmenter recognized the heading but omitted the numeric table cell. The converter now exposes sparse/table and paragraph segmentation; the unchanged numeric 42 assertion is rechecked with its table default. This fixture does not establish general OCR accuracy.

`encrypted.docx` is a genuine encrypted Office container produced with the repository's officeCrypto helper using the test-only password `fixture-only`.

`generate-hwp.mjs` uses official rhwp 0.8.7 createEmpty/insertText/createTable/insertPicture/insertPageBreak and export methods to create simple HWP/HWPX plus a two-page HWP with Korean, cells and an image. Exporting that richer source to HWPX hit an upstream unresolved character/paragraph style ID error; rich HWPX fidelity is not established. No user files are used.

Browser HWP tests capture the official vector/text print surface and feed that exact HTML to Chromium PDF printing. They verify searchable text and pages; they do not automate or claim success of the operating system's save dialog.
