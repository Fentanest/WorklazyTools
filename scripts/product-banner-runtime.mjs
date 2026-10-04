import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const runtimeEntry = fileURLToPath(new URL("../src/features/product-banner/runtime.ts", import.meta.url));
const virtualId = "virtual:product-banner-runtime";
/** Shared by Vite dev/build and Node tests: no committed generated script or runtime eval. */
export async function buildBannerRuntime() {
  const result = await build({ entryPoints: [runtimeEntry], bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", minify: true, legalComments: "none" });
  return result.outputFiles[0].text;
}
export function productBannerRuntimePlugin() {
  return {
    name: "product-banner-runtime",
    resolveId(id) { if (id === virtualId) return `\0${virtualId}`; },
    async load(id) {
      if (id !== `\0${virtualId}`) return;
      this.addWatchFile(runtimeEntry);
      this.addWatchFile(fileURLToPath(new URL("../src/features/product-banner/rotation.ts", import.meta.url)));
      return `export default ${JSON.stringify(await buildBannerRuntime())};`;
    },
  };
}
