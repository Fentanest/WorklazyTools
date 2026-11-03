// The 22 original CLI-spawn consumers. Extract only their real server lifecycle
// functions so startup checks do not run unrelated browser assertions/benchmarks.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { startOwnedPreview, stopOwnedPreview } from "./owned-preview.mjs";

export const ownedServerConsumers = [
  ["accessibility-audit", "startPreview", "preview"],
  ["control-geometry-smoke", "startPreview", "preview"],
  ["document-result-entry", "startDevServer", "dev"],
  ["file-drop-smoke", "startPreview", "preview"],
  ["mobile-bottom-negative-control", "startPreviewServer", "preview"],
  ["pdf-filename-limit-smoke", "startPreview", "preview"],
  ["pdf-finish-lifecycle-smoke", "startDevServer", "dev"],
  ["pdf-finish-smoke", "startPreview", "preview"],
  ["pdf-raster-benchmark", "startDevServer", "dev"],
  ["pdf-stamp-golden", "startPreview", "preview"],
  ["pdf-watermark-performance", "startPreview", "preview"],
  ["qr-bulk-smoke", "startServer", "preview"],
  ["qr-stage-metrics", "startPreview", "preview"],
  ["rendering-baseline", "startPreview", "preview"],
  ["ui-home-assets", "startDevServer", "dev"],
  ["ui-isolation-smoke", "startDevServer", "dev"],
  ["ui-migration-layout-smoke", "startPreview", "preview"],
  ["ui-primitives-browser", "startDevServer", "dev"],
  ["ui-shell-search", "startDevServer", "dev"],
  ["ui-theme-bootstrap", "startPreview", "preview"],
  ["ui-theme-surfaces", "startPreview", "preview"],
  ["visual-regression", "startPreviewServer", "preview"],
];

export async function consumerLifecycle([name, startName, mode], options) {
  const url = new URL(`../${name}.mjs`, import.meta.url);
  const source = await fs.readFile(url, "utf8");
  const start = source.match(new RegExp(`^async function ${startName}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`, "m"))?.[0];
  assert.ok(start, `${name}: missing start function`);
  assert.match(source, new RegExp(`await ${startName}\\(`), `${name}: start function must be used`);
  assert.doesNotMatch(source, /\bspawn\(/, `${name}: old CLI spawn remains`);
  assert.match(source, /await stopOwnedPreview\(/, `${name}: cleanup must await child exit`);
  const stop = source.match(/^async function stopServer\(child\) \{[\s\S]*?^\}/m)?.[0];
  const context = vm.createContext({
    ...options, startOwnedPreview, stopOwnedPreview, fileURLToPath: options.fileURLToPath ?? fileURLToPath, URL,
    browserPort: options.port, distDirectory: options.outDir,
    config: { environment: { timezone: "UTC" } }, serverOutput: [],
  });
  const declarations = start.replaceAll("import.meta.url", JSON.stringify(url.href));
  vm.runInContext(`${declarations}\n${stop ?? ""}`, context);
  return {
    async start() {
      const result = await vm.runInContext(`${startName}(port)`, context);
      const child = result.child ?? result;
      const config = JSON.parse(child.spawnargs.at(-1));
      assert.equal(config.mode, mode, `${name}: incorrect server mode`);
      return child;
    },
    stop: (child) => {
      context.child = child;
      return vm.runInContext(stop ? "stopServer(child)" : "stopOwnedPreview(child)", context);
    },
  };
}
