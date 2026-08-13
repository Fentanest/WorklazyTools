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
  },
});
