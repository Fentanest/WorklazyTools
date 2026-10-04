import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const runtimeEntry = fileURLToPath(new URL("../src/features/product-banner/runtime.ts", import.meta.url));
const virtualId = "virtual:product-banner-runtime";
const heightId = "virtual:product-banner-height-parent";
/** Shared by Vite dev/build and Node tests: no committed generated script or runtime eval. */
export async function buildBannerRuntime() {
  const result = await build({ entryPoints: [runtimeEntry], bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", minify: true, legalComments: "none" });
  return result.outputFiles[0].text;
}
export async function buildHeightParentRuntime() {
  const result = await build({ entryPoints: [fileURLToPath(new URL("../src/features/product-banner/heightParent.ts", import.meta.url))], bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", minify: true, legalComments: "none" });
  return result.outputFiles[0].text;
}
export function productBannerRuntimePlugin() {
  return {
    name: "product-banner-runtime",
    resolveId(id) { if (id === virtualId || id === heightId) return `\0${id}`; },
    async load(id) {
      if (id === `\0${heightId}`) {
        this.addWatchFile(fileURLToPath(new URL("../src/features/product-banner/heightParent.ts", import.meta.url)));
        return `export default ${JSON.stringify(await buildHeightParentRuntime())};`;
      }
      if (id !== `\0${virtualId}`) return;
      this.addWatchFile(runtimeEntry);
      this.addWatchFile(fileURLToPath(new URL("../src/features/product-banner/rotation.ts", import.meta.url)));
      this.addWatchFile(fileURLToPath(new URL("../src/features/product-banner/frameHeight.ts", import.meta.url)));
      return `export default ${JSON.stringify(await buildBannerRuntime())};`;
    },
  };
}
