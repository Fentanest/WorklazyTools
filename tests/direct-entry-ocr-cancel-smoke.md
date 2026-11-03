# Direct-entry OCR cancellation smoke

Run from the repository after dependencies and local runtime assets are prepared
(`npm run build` prepares the assets as well as checking the build):

```sh
node --test tests/direct-entry-ocr-cancel-smoke.mjs
# Or choose an installed Chromium executable:
BROWSER_PATH=/usr/bin/google-chrome node --test tests/direct-entry-ocr-cancel-smoke.mjs
```

The test owns its Vite dev server, uses `envFile: false`, and requests a free
loopback port. `OCR_CANCEL_PORT` selects a fixed port; an occupied port fails
without falling back or terminating its owner. `TEST_BASE_URL` is intentionally
unused: this test must exercise its own source/server. `DIRECT_ENTRY_OUTPUT`
selects an existing parent directory for a unique `ocr-cancel-*` artifact folder
(default: the OS temporary directory). Each run writes its own generated
three-page scan PDF, SHA-256, JSON evidence and screenshots. Vite's separate
cache stays under this worktree's ignored `node_modules/.cache/ocr-cancel-*`.
Without `BROWSER_PATH`, Playwright uses its installed Chromium.

Both the Cancel conversion button and the confirmed OCR-to-document task change
must close the actual OCR owner and nested Tesseract worker, retain all three
selected pages and the selected file, and register no result. The first page's
genuine local OCR result is held before client delivery, keeping the three-page
conversion pending. After cancellation it is delivered to the original
listeners, including listeners removed during abort, to exercise an already
queued result race. A MutationObserver rejects even a transient download card.
This is a controlled lifecycle/race test using actual OCR, not an OCR accuracy
benchmark or a timing test of mid-instruction native cancellation.

All cross-origin HTTP requests are aborted and logged; service workers and
WebSockets are blocked. No external login or production provider is required.
Page errors fail the test. The JSON report records the live owner/child target
IDs before cancellation, their absence afterwards, the owner close event,
dispose/terminate calls, held result ID/text length and late delivery count.

Negative controls deliberately break product contracts **in Vite's in-memory
transform only**. They do not edit product files and must exit nonzero:

```sh
OCR_CANCEL_NEGATIVE=owner node --test tests/direct-entry-ocr-cancel-smoke.mjs
OCR_CANCEL_NEGATIVE=selection node --test tests/direct-entry-ocr-cancel-smoke.mjs
```

`owner` removes the real OCR owner's terminate call, so the CDP/close-event
check must fail even though the dispose message was sent. `selection` clears
the selected file when accepting the new task, so the retained-page assertion
must fail. Each mutation must match exactly once and be applied; an unknown
control is rejected.
