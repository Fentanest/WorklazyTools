import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const configuredBase = process.env.VITE_BASE_PATH || "/";
const base = `${configuredBase.startsWith("/") ? "" : "/"}${configuredBase.replace(/\/$/, "")}/`;
const moduleAttributionOutput = process.env.BUNDLE_MODULE_ATTRIBUTION_OUTPUT;

const browserNodePolyfills = () => nodePolyfills({
  globals: {
    Buffer: true,
    global: true,
    process: true,
  },
  protocolImports: true,
});

const moduleAttributionPlugin = (outputPath: string): Plugin => ({
  name: "worklazy-bundle-module-attribution",
  apply: "build",
  generateBundle(_options, bundle) {
    const chunks = Object.values(bundle).filter((item) => item.type === "chunk").map((chunk) => ({
      file: chunk.fileName,
      modules: Object.entries(chunk.modules).map(([id, module]) => {
        const codeAvailable = typeof module.code === "string";
        const code = codeAvailable ? module.code : "";
        return {
          id,
          renderedLength: module.renderedLength,
          renderedGzip: code.length ? gzipSync(code).length : 0,
          renderedSha256: crypto.createHash("sha256").update(code).digest("hex"),
          codeAvailable,
        };
      }),
    }));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(chunks)}\n`);
  },
});

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    browserNodePolyfills(),
    ...(moduleAttributionOutput ? [moduleAttributionPlugin(path.resolve(moduleAttributionOutput))] : []),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  worker: {
    plugins: () => [browserNodePolyfills()],
    rollupOptions: {
      output: {
        entryFileNames: (chunk) => chunk.facadeModuleId?.includes("/features/video-studio/")
          ? "tools/video-studio/workers/[name]-[hash].js"
          : "assets/[name]-[hash].js",
      },
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
