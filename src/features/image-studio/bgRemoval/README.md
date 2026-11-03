# IE-BG prototype (not the IE1 editor replacement)

The original default `/webgpu` + jsep ABI mismatch is corrected by the approved
fix1: `/webgpu` now receives its matching, lock-verified asyncify binary. The new
expectation was committed before vendoring/execution. Product GPU inference still
requires a shader-f16 adapter and IE0b validation. A degenerate GPU alpha mask now
retries the same verified graph once on the WASM CPU provider, using the already verified asyncify runtime. No different model or
asset pin is loaded. The GPU tensors/session are released before CPU initialization.

The model/person-runtime pins were first committed in `2aa1044`. The corrected
asyncify expectation was separately committed in `85fffcb` before fix1 vendoring
and runtime evaluation. The wasm files were compared with the
npm tarball after checking its SHA-512 against package-lock integrity. Model
source URLs are public Hugging Face fixed revisions and require no credentials.

```ts
import { BackgroundRemovalController, createBackgroundRemovalLoader, requestDownloadConsent } from './bgRemoval';
const controller = new BackgroundRemovalController({
  confirm: requestDownloadConsent,
  notice: showLocalizedNotice,
});
const backgroundRemovalLoader = createBackgroundRemovalLoader(controller, () => selectedMode);
// Pass the loader to the IE-F ImageEditor when IE1 is implemented.
// On source replacement / leaving the editor:
controller.onImageReplaced(); // or controller.dispose()
// Explicit user action:
await controller.clearStoredModels();
```

The adapter implements the fork's `Blob | string` contract. Strings are limited to
data:/blob: sources and are normalized inside the run's cancellation scope.
Remote source strings are rejected before any request. User images/results are
never put in Cache Storage. Error text comes from `messages.ko/en`; cancellation
has no visible error message. Product mode never switches models automatically.
Only an unusable GPU mask
(nonfinite, near-constant or sigmoid-saturated) retries the same model on CPU once.

`defaultMode()` probes a WebGPU adapter for shader-f16, without creating a Worker
or downloading assets. The UI can let the user override this purpose selection.
For a cache miss, the host must confirm the exact model+wasm missing byte sum.
Program JS is disclosed separately (about 0.21 MB for this prototype worker).
A warm verified cache can skip the download prompt. The prompt API returns only
a decision; the controller rechecks cancellation and generation before starting.

Every cache hit is rehashed. Invalid items are deleted and treated as misses.
Only complete, verified assets are put in `worklazy-models-v1`. Cache unavailable /
quota failures produce a notice but keep the current verified in-memory buffers.
The buffers are transferred to one dedicated Worker, verified again, and supplied
as `env.wasm.wasmBinary` and the `InferenceSession.create(ArrayBuffer)` argument.
The worker imports the default bundled-glue ESM exports of `onnxruntime-web/wasm`
or `/webgpu`; no external-wasm resolution condition is enabled. Proxy is false
and numThreads is conservatively 1 even when isolated. Session resources are
released on completion, and the Worker is always terminated by the controller.
Run IDs reject late responses. AbortController owns downloads and pending consent.
There is a 180-second total inference/Worker timeout, including any same-model
CPU retry; cancellation terminates the worker during either provider.

MODNet keeps the short edge exactly512 and aligns only the long edge to32 using
integer division (BigInt block counts),
RGB /255 normalized by mean/std .5, NCHW. Its output alpha is bilinearly expanded
with half-pixel coordinates and multiplied into existing alpha. Product mode uses
512x512 RGB/ImageNet mean/std, NCHW, and externally sigmoid-transformed logits.
Before composition both modes reject nonfinite alpha, alpha range <=1/255 or
alpha variance <=1e-6. A failed retry returns `bg-mask-unusable` with ko/en feedback
and no result Blob, preserving the editor source. This guard detects degenerate
masks; it does not establish semantic segmentation quality.
PNG output keeps the input's decoded, orientation-corrected dimensions. This
prototype does not establish BiRefNet's PyTorch/reference trust or visual quality.

The main site does not import this adapter yet. The test harness builds it with
Vite and runs actual MODNet inference without changing site routing or the service
worker. A narrowly scoped Vite worker plugin removes unused fallback wasm copies only
from BG worker builds and only when their bytes/hash match the manifest. Unknown
wasm assets fail the build. Actual runtime files remain vendored once and are
verified before injection. Runtime/network probes verify no fallback requests.

Commands from repository root:

```sh
npm run build # hydrate pinned model/runtime files first
npm run test:bg-removal
node src/features/image-studio/bgRemoval/tests/build-harness.mjs
node src/features/image-studio/bgRemoval/tests/serve.mjs # 127.0.0.1:4192, no SW/COEP
BG_TEST_OUTPUT=/tmp/sol-ie-bg-fix1 node src/features/image-studio/bgRemoval/tests/browser.mjs
```

`BG_REMOVAL_MODELS=person` makes the vendor steps remove product-only assets from
public output. Both are vendored by default. Models use the existing ignored
`.cache/image-studio-assets/bg-removal` cache; generated public model/ORT directories
are build artifacts, not committed binaries. The CI size guard runs immediately
before Pages upload after all deployment data additions, enforces 1 GiB and at
least 50 MiB headroom, and rejects unexpected symlinks.

Current environment has no shader-f16 adapter. Person-mode cache/lifecycle and
1/12/24 MP dimension/registration tests pass; product mode is checked only for its
localized unsupported result with zero downloads. A real GPU and the 30-image
reference comparison remain IE0b tasks. Model license texts are under `licenses/`;
no MODNet NOTICE file exists in the recursively checked pinned upstream tree.

## iOS product-mode choice

iOS/iPadOS WebKit alone warns rather than blocks. Portrait remains the default
recommendation; product selection is enabled when feature requirements permit it.
The controller checks an explicitly reported deviceMemory bucket <=4 first, then
GPU capability, then calls optional `confirmProductRisk` on every product run
(including warm-cache runs), before cache/model access and download consent.
The host uses a ko/en choice dialog; adapters without the hook use a native confirm.
Declining or cancelling invalidates the operation before download. A missing memory
signal is unknown, not a low-memory measurement. No warning acknowledgement is saved.

`tests/ie1/bg-restrict-notice.mjs` verifies simulated device signals and modal/alert
lifecycle with a controlled person worker, not actual iOS inference or crash safety.

## Interrupted iOS product runs

After explicit iOS risk approval the controller writes only `1` to the dedicated
per-tab sessionStorage key. It clears the flag on result return, handled failure,
cancellation/replacement/disposal and uses an in-memory owner so older finally
callbacks cannot erase a newer flag. A reopened document may consume a leftover
flag and suggest portrait mode once; it does not claim a confirmed crash or
restore an image. No filename, receipt, image, timestamp or run ID is stored.
Storage denial is best effort and does not prevent an otherwise permitted run.
SessionStorage survival depends on browser tab restoration; a completely new tab
or discarded session cannot be guaranteed to retain the hint.

## Mask-quality regression probes (2026-11-04)

`npm run test:bg-removal` includes degenerate masks, saturated logits, source-byte
preservation and bounded same-model provider retry. `npm run test:unit` includes
the same regression file.

After building/serving the harness, run `node
src/features/image-studio/bgRemoval/tests/quality-browser.mjs`. It generates two
geometric fixtures and a shaded product composite with exact foreground masks,
compares providers and portrait mode, and records raw tensor statistics, alpha
histograms and IoU. An explicitly simulated constant GPU output also exercises
the shared retry policy with real pinned-model WASM inference. GPU tests on
adapters without shader-f16 are recorded as unsupported, not GPU quality passes.
Use `BG_QUALITY_OUTPUT` for artifacts and `BG_QUALITY_CASES` (comma-separated
`mode:provider:fixture[:constant-gpu]`) to run only the required cases.

`node --test tests/ie1/bg-mask-quality.mjs` verifies ko/en error feedback and
pixel-exact source export after a controlled worker guard rejection. This is a
UI/transport test, not actual GPU inference.
