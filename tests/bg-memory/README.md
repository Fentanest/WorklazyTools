# Background asset memory profile

Linux + desktop Chrome benchmark for `prepareAssets` / `acquireAssets`, with the
real pinned product model and its runtime. This measures download, verification
and Cache Storage. It does **not** measure ORT session/GPU inference or establish
an iOS memory budget. Production device restrictions are unchanged.

Build the same harness with each candidate's `assets.ts` in separate checkouts:

```sh
npm ci
node scripts/vendor-browser-runtimes.mjs
node scripts/vendor-bg-removal-model.mjs
BG_MEMORY_DIST=/tmp/bg-baseline node tests/bg-memory/build.mjs
# In the changed checkout, using the identical harness:
BG_MEMORY_DIST=/tmp/bg-candidate node tests/bg-memory/build.mjs
BG_MEMORY_BASELINE_DIST=/tmp/bg-baseline \
BG_MEMORY_DIST=/tmp/bg-candidate \
BG_MEMORY_OUTPUT=/tmp/bg-results \
node tests/bg-memory/measure.mjs
```

`CHROME_EXECUTABLE` overrides `/usr/bin/google-chrome`.
`BG_MEMORY_REPETITIONS` defaults to 3. Each round interleaves baseline/candidate
cold and warm trials, each with a fresh browser. The owned HTTP server binds an
ephemeral localhost port and closes after the run. Models stay local; no provider
or analytics endpoints are involved.

Metrics are sampled CDP `Runtime.getHeapUsage().backingStorageSize` (ArrayBuffer
storage, distinct from JS heap) and Linux PSS across the Chrome process tree.
RSS is also recorded, but its shared-page double counting makes PSS preferable.
PSS permission failures fail the benchmark. The loop requests a 25 ms pause;
actual sample timestamps/gaps must be reported because sampling itself takes time.
These are observed sample maxima, not guaranteed instantaneous high-water marks.

Warm trials seed the cache before measurement. A DevTools GC runs before each
trial; none is forced within the measured interval. Results retain per-trial
baselines, peaks and raw samples. Compare the median and range of trial peaks.
Do not describe loader peaks as full editor/inference peaks.

After sampling stops, every acquired buffer is rehashed, transferred (detachment
asserted), rehashed in its new ownership, and reloaded/reverified from Cache
Storage. Thus a lower peak cannot pass by dropping bytes, skipping the cache,
removing integrity checks or invalidating the worker's transferred input.
