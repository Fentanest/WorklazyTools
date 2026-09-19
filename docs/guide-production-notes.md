# Guide production notes

## Route-specific FAQ policy

- A route listed in `pathFaqs` renders only the FAQ IDs in that route's selection.
- Every configured selection must contain at least one ID. `scripts/validate-guides.mjs` rejects empty selections.
- A route without a `pathFaqs` entry falls back to every FAQ in the resolved guide.
- `/tools/pdf-editor/convert` and `/tools/pdf-editor/ocr` always require explicit selections in `pdfEditor.convert`.

## Removed production notes

Content-writing instructions removed from user-facing guides are recorded here by guide key and JSON path. This section is populated during the 39-item content review.
