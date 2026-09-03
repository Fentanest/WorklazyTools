import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const configuredBase = process.env.VITE_BASE_PATH || "/";
const base = `${configuredBase.startsWith("/") ? "" : "/"}${configuredBase.replace(/\/$/, "")}/`;

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
  plugins: [react(), browserNodePolyfills()],
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
