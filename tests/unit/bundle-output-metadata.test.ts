import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import crypto from "node:crypto";
import { build } from "vite";
import { moduleAttributionPlugin } from "../../scripts/bundle-output-metadata.mjs";
import { measureOutput, assertMeasuredDeploymentExecutionAssets } from "../../scripts/measure-bundle-budget.mjs";
import { buildModuleContributions, moduleInventoryEntry } from "../../scripts/bundle-module-attribution.mjs";

// Real Rollup output, not inferred kinds or fabricated module gzip weights.
test("Vite output evidence distinguishes raw assets and chunks without changing historical attribution", async (t) => {
  const root = fs.mkdtempSync(path.join(tmpdir(), "bundle-output-kind-"));
  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  try {
    fs.mkdirSync(path.join(root, "node_modules"));
    const routes = Array.from({ length: 18 }, (_, i) => `route-${i}`);
    write("src/app/App.tsx", routes.map((id) => `lazy(() => import("../features/${id}/Page"))`).join("\n"));
    write("index.html", '<script type="module" src="/entry.js"></script>');
    write("entry.js", routes.map((id) => `globalThis[${JSON.stringify(id)}]=()=>import('./src/features/${id}/Page.tsx');`).join("\n"));
    write("payload.js", 'globalThis.rawAsset = "not a transformed module";');
    for (const [i, id] of routes.entries()) write(`src/features/${id}/Page.tsx`, i < 2
      ? `import url from '../../../payload.js?url&no-inline'; export default [url,${i}];`
      : `export default ${i};`);
    const metadataPath = path.join(root, "main.json");
    await build({ configFile: false, root, publicDir: false, logLevel: "silent", plugins: [
      moduleAttributionPlugin(metadataPath),
      { name: "fixture-identical-asset-alias", generateBundle(_options, bundle) {
        const chunk = Object.values(bundle).find((item) => item.type === "chunk" && item.facadeModuleId?.endsWith("/route-2/Page.tsx"));
        assert.ok(chunk && chunk.type === "chunk");
        this.emitFile({ type: "asset", fileName: "assets/identical-alias.js", source: chunk.code });
      } },
    ], build: { manifest: true, outDir: "dist", rollupOptions: { output: {
      entryFileNames: "assets/entry-[hash].mjs", chunkFileNames: "assets/[name]-[hash].mjs",
    } } } });
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const receipt = fs.readFileSync(`${metadataPath}.sha256`, "utf8").trim();
    const options = { directory: path.join(root, "dist"), sourceRoot: root, moduleChunks: metadata, metadataSha256: receipt };
    const report = measureOutput(options);
    const raw = metadata.outputs.find((item: { kind: string; file: string }) => item.kind === "asset" && item.file !== "assets/identical-alias.js");
    assert.ok(raw);
    await t.test("raw .js bytes are charged once and reach both referring routes; real .mjs chunks retain modules", () => {
      const record = report.files.find((file) => file.paths.includes(raw.file));
      assert.ok(record && record.bytes > 0 && record.gzipBytes > 0);
      assert.deepEqual(record.routeOwners, ["route-0", "route-1"]);
      assert.equal(report.moduleInventory.find((entry) => entry.file === raw.file)?.attribution, "opaque");
      assert.ok(report.modules.every((chunk) => chunk.file.endsWith(".mjs")));
      assert.equal(buildModuleContributions(report).reduce((sum, row) => sum + row.bytes, 0), report.metrics.appJsGzip);
    });
    await t.test("receipt detects kind changes; a same-SHA raw alias cannot excuse a missing chunk graph", () => {
      const mutated = structuredClone(metadata);
      const chunk = mutated.outputs.find((item: { kind: string; sha256: string }) => item.kind === "chunk"
        && mutated.outputs.some((other: { kind: string; sha256: string }) => other.kind === "asset" && other.sha256 === item.sha256));
      assert.ok(chunk);
      chunk.kind = "asset";
      assert.throws(() => measureOutput({ ...options, moduleChunks: mutated }), /retained SHA receipt/);
      const missing = structuredClone(metadata);
      missing.chunks = missing.chunks.filter((item: { file: string }) => item.file !== chunk.file);
      // Test-only receipt recomputation reaches the internal coverage check.
      const internalReceipt = crypto.createHash("sha256").update(`${JSON.stringify(missing)}\n`).digest("hex");
      assert.throws(() => measureOutput({ ...options, moduleChunks: missing, metadataSha256: internalReceipt }), /Missing actual chunk module metadata/);
      const partial = structuredClone(report);
      partial.modules = partial.modules.filter((item) => item.file !== chunk.file);
      assert.throws(() => buildModuleContributions(partial), /missing main chunk metadata/);
    });
    await t.test("same path and length cannot hide changed bytes from metadata or deployment checks", () => {
      const file = path.join(options.directory, raw.file), bytes = fs.readFileSync(file), changed = Buffer.from(bytes);
      changed[0] ^= 1;
      try {
        fs.writeFileSync(file, changed);
        assert.throws(() => measureOutput(options), /bytes\/SHA mismatch/);
        assert.throws(() => assertMeasuredDeploymentExecutionAssets(report, options.directory), /bytes\/SHA mismatch/);
      } finally { fs.writeFileSync(file, bytes); }
    });
    await t.test("historical version 3 keeps its classifier and rejects this unsupported raw .js graph", () => {
      assert.equal(moduleInventoryEntry(raw.file).attribution, "modules");
      assert.throws(() => measureOutput({ ...options, moduleChunks: metadata.chunks }), /missing Vite main chunks/);
    });
    assert.deepEqual(measureOutput(options).files, report.files);
    assertMeasuredDeploymentExecutionAssets(report, options.directory);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
