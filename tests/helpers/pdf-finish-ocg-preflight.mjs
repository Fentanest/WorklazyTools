import { register } from "node:module";

const productModule = new URL("../../src/features/pdf-editor/finish/preflight.ts", import.meta.url);
const nativeTypeStripping = process.execArgv.includes("--experimental-strip-types")
  || process.env.NODE_OPTIONS?.includes("--experimental-strip-types");

if (!nativeTypeStripping) {
  const loader = `
    import { readFile } from "node:fs/promises";
    import { stripTypeScriptTypes } from "node:module";

    export async function load(url, context, nextLoad) {
      if (url === ${JSON.stringify(productModule.href)}) {
        const source = await readFile(new URL(url), "utf8");
        return {
          format: "module",
          source: stripTypeScriptTypes(source, { mode: "strip" }),
          shortCircuit: true,
        };
      }
      return nextLoad(url, context);
    }
  `;
  register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url);
}

const { classifyOcgPreflight } = await import(productModule.href);

export { classifyOcgPreflight };
