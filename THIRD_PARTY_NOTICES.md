# Worklazy Tools Third-Party Notices

Worklazy Tools includes third-party components. Those components are not covered
by the Worklazy Tools Proprietary License and remain available under their own
licenses. Copyrights and trademarks belong to their respective owners.

The production build generates `public/legal/third-party-licenses.txt` from the
installed production dependency tree so the deployed site carries the available
license and notice texts. The package lock is the source of truth for the exact
resolved dependency versions.

## Direct production dependencies

| Component | Declared license | Purpose / source |
| --- | --- | --- |
| `@ffmpeg/core` 0.12.10 | GPL-2.0-or-later | FFmpeg WebAssembly core · <https://github.com/ffmpegwasm/ffmpeg.wasm> |
| `@ffmpeg/ffmpeg` 0.12.15 | MIT | FFmpeg browser API · <https://github.com/ffmpegwasm/ffmpeg.wasm> |
| `@ffmpeg/util` 0.12.2 | MIT | FFmpeg browser utilities · <https://github.com/ffmpegwasm/ffmpeg.wasm> |
| `@rhwp/core`, `@rhwp/editor` 0.8.4 | MIT | HWP/HWPX parsing and editing · <https://github.com/edwardkim/rhwp> |
| `buffer` 6.0.3 | MIT | Browser binary compatibility |
| `crypto-browserify` 3.12.1 | MIT | Browser cryptographic compatibility |
| `exceljs` 4.4.0 | MIT | XLSX/CSV processing · <https://github.com/exceljs/exceljs> |
| `fabric` 7.4.0 | MIT | Interactive canvas editing · <https://github.com/fabricjs/fabric.js> |
| `gifenc` 1.0.3 | MIT | GIF encoding · <https://github.com/mattdesl/gifenc> |
| `jszip` 3.10.1 | MIT option | ZIP creation · <https://github.com/Stuk/jszip> |
| `lucide-react` | ISC | Icons · <https://github.com/lucide-icons/lucide> |
| `officecrypto-tool` | MIT | Office encryption/decryption |
| `pdf-lib` 1.17.1 | MIT | PDF writing · <https://github.com/Hopding/pdf-lib> |
| `pdfjs-dist` 6.2.108 | Apache-2.0 | PDF parsing/rendering · <https://github.com/mozilla/pdf.js> |
| `react`, `react-dom` | MIT | User interface runtime · <https://github.com/facebook/react> |
| `react-router-dom` | MIT | Client-side routing · <https://github.com/remix-run/react-router> |
| `sortablejs` 1.15.7 | MIT | Drag-and-drop ordering · <https://github.com/SortableJS/Sortable> |
| `tesseract.js` 7.0.0 | Apache-2.0 | Browser OCR · <https://github.com/naptha/tesseract.js> |
| `vite-plugin-node-polyfills` | MIT | Browser compatibility shims |
| `xlsx` 0.20.3 | Apache-2.0 | Legacy and binary Excel input · <https://git.sheetjs.com/sheetjs/sheetjs> |

The production dependency tree also contains transitive packages. Their full
notices are included in the generated deployed notice bundle rather than being
repeated in this summary.

## Runtime resources loaded on demand

- Pyodide 0.29.4 is loaded from jsDelivr for Word comparison and is distributed
  under MPL-2.0. Source: <https://github.com/pyodide/pyodide>
- Tesseract OCR engine resources and Korean/English trained data may be loaded on
  demand by Tesseract.js. Their respective upstream licenses continue to apply.
- Google AdSense is an external service and is governed by Google's terms; it is
  not part of the Worklazy source-code license.

## FFmpeg source and copyleft boundary

`@ffmpeg/core` is a separately distributed WebAssembly component under
GPL-2.0-or-later. The Worklazy proprietary terms do not restrict that component.
Its upstream source, build system, and license information are available from
the ffmpeg.wasm project linked above. Users remain responsible for codec and
media rights applicable to their jurisdiction and use.

This file is an attribution summary, not a replacement for the complete license
texts included in the deployed `third-party-licenses.txt` bundle.
