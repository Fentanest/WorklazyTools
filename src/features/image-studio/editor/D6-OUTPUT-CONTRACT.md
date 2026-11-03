# IE1 D6 output contract

The host uses the pinned fork's `exportArea="image"` path. With an imported photo,
uncropped output uses its actual (orientation-corrected and D6-bounded) source
pixels and image bounds, regardless of the responsive canvas, DPR, zoom or pan.
Preview margins are excluded. A committed crop uses source pixel density in the
crop; an explicit artboard uses its declared pixel size. Blank documents without
a source retain their scene size. The fork's default `scene` API remains available
for callers that explicitly export an entire working scene.

D6 A imports with an edge cap of4096 and B with8192. Crop/flatten allocation is
bounded by4096² or8192² respectively. The cap is a limit, rather than a command to
enlarge every photo. A small input enlarged by the preview still exports at its
own pixel dimensions. PNG/JPEG/WebP, PDF and flattened SVG/JSON/template output
share the image/crop/artboard region and source pixel plan. Detached-copy
flattening preserves the live layers and history. Vector SVG keeps vector/text
content and declares the same output dimensions; ordinary editable JSON/template
retains the original scene, as explained by the concealment warning.

Footer size fields deliberately resample the source-resolution commit. An explicit
larger target can interpolate pixels; it does not recover details. Footer format
selection applies to results, downloads and Send-to. W2 keeps its PNG File contract.

This replaces the earlier host choice that fixed `flattenTarget` to the logical
working canvas. Android and Safari QA showed that this choice and the unbounded
raster fallback silently discarded source pixels and exported preview margins.
Regression expectations are source/policy pixels, not canvas.style dimensions.
