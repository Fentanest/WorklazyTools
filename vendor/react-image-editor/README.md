# Local image editor fork

The current unpublished package is **1.3.0-worklazy.5**. It is derived from the
MIT fork commit `263b8cfc347c822ff1bf4d2d85b5a95c0efe51d4`, based on upstream
`125ae084c4f68dc516702440e4e0d20ab17e581c` (1.3.0), **plus
`ie1-safari-fixes.patch`**. The base source archive alone is not the current code.
The patch includes the local package/lock version and source-export/BG UI fixes.

`manifest.json` names the active package in `packageFile`, the required patch in
`sourcePatch`, and pins all three retained inputs by bytes and SHA-256:

- `ascentsparksoftware-react-image-editor-1.3.0-worklazy.5.tgz`: installed package.
- `source-263b8cf.tar.gz`: original source, MIT license and archived npm lock.
- `ie1-safari-fixes.patch`: required source delta before rebuilding.

The application lockfile also pins the active tarball's SHA-512 integrity.
Prebuild verifies the artifacts and package/manifest reference. The unused
`ascentsparksoftware-react-image-editor-1.3.0.tgz` was removed; it is not an input
to the current build. Historical Git commits retain that earlier package.

## Rebuild

Run from the application repository root with Node22.17.1 and npm matching the
archived lock. Use a private temporary directory; do not edit installed/generated
files or the original source archive.

```sh
ie_vendor_dir="$PWD/vendor/react-image-editor"
node scripts/verify-image-editor-vendor.mjs
ie_build_dir="$(mktemp -d)"
tar -xzf "$ie_vendor_dir/source-263b8cf.tar.gz" -C "$ie_build_dir"
cd "$ie_build_dir"
patch --dry-run -p1 < "$ie_vendor_dir/ie1-safari-fixes.patch"
patch -p1 < "$ie_vendor_dir/ie1-safari-fixes.patch"
npm ci --no-audit --no-fund
npm run build -w @ascentsparksoftware/react-image-editor
npm pack ./packages/react-image-editor
```

The resulting package version must be `1.3.0-worklazy.5` for the current pinned
inputs. Do not omit or silently skip a patch failure. Compare the rebuilt package
contents; do not assume a new npm pack has identical gzip/tar metadata. When
changing the source, keep the source patch, generated package, manifest and
application dependency/lock together. Record new expected hashes only after
reviewing the input change. Refresh license notices through their generator when
the dependency input changes.

Do not publish this package/fork or send an upstream PR without separate approval.

## Transparent canvas and eraser

worklazy.4 adds a 900×600 transparent sample. Eraser strokes are undoable
`destination-out` mask layers: they clear earlier layers (including the source
image) to alpha; later layers remain on top. PNG/WebP keep alpha. JPEG fills the
completed result white (or the host export fill), including erased holes. SVG
with an eraser embeds the composited PNG because Fabric SVG does not implement
this canvas compositing operator. JSON/templates preserve the editable masks
and original objects and continue to use the concealment export warning.

worklazy.5 reports actual raster alpha via optional `onJpegTransparencyChange`
immediately before JPEG matting. The shared `hasCanvasTransparency` helper reads
at most 64 output rows at once and includes partial alpha. Opaque preview margins
are not inferred from file type or the editor's checkerboard.
