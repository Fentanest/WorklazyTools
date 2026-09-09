import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { moduleAttributionPlugin } from "./scripts/bundle-output-metadata.mjs";

const configuredBase = process.env.VITE_BASE_PATH || "/";
const base = `${configuredBase.startsWith("/") ? "" : "/"}${configuredBase.replace(/\/$/, "")}/`;
const moduleAttributionOutput = process.env.BUNDLE_MODULE_ATTRIBUTION_OUTPUT;
const bundleSourceRoot = process.env.BUNDLE_SOURCE_ROOT ? path.resolve(process.env.BUNDLE_SOURCE_ROOT) : undefined;

const browserNodePolyfills = () => nodePolyfills({
  globals: {
    Buffer: true,
    global: true,
    process: true,
  },
  protocolImports: true,
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
      "@": bundleSourceRoot ? path.join(bundleSourceRoot, "src") : fileURLToPath(new URL("./src", import.meta.url)),
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
