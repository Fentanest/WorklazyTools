# Local image editor fork

Pinned MIT fork commit: `263b8cfc347c822ff1bf4d2d85b5a95c0efe51d4`, based on upstream
`125ae084c4f68dc516702440e4e0d20ab17e581c` (1.3.0). No fork publication is required.
`manifest.json` pins the package tarball and source archive by bytes and SHA-256.
The lockfile also pins the installed tarball's SHA-512 integrity. Prebuild verifies
the retained artifacts; source and generated package are changed together.

Rebuild in a private temporary directory: extract `source-263b8cf.tar.gz`, run
`npm ci --no-audit --no-fund`, `npm run build -w @ascentsparksoftware/react-image-editor`,
then `npm pack ./packages/react-image-editor`. Record new expected hashes only after
reviewing the source change. This build uses Node 22.17.1 and the archived npm lock.
The archive includes the MIT license, original package source and lockfile.
Do not publish this package/fork or send an upstream PR without separate approval.
