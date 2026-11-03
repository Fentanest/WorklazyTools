import { build } from 'vite';
import path from 'node:path';
import { verifiedRuntimeWasmPlugin } from '../verified-runtime-vite.mjs';
const root = process.cwd();
await build({ configFile: false, envDir: false, root: path.join(root, 'src/features/image-studio/bgRemoval/tests'), base: '/', publicDir: path.join(root, 'public'),
  build: { outDir: path.join(root, 'scratch/ie-bg/harness-dist'), emptyOutDir: true, copyPublicDir: false },
  worker: { plugins: () => [verifiedRuntimeWasmPlugin()], format: 'iife', rollupOptions: { output: { inlineDynamicImports: true } } },
});
