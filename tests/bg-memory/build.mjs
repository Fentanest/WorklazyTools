import { build } from 'vite';
import path from 'node:path';
const root = process.cwd();
await build({ configFile: false, root: path.join(root, 'tests/bg-memory'), publicDir: false, base: '/',
  build: { outDir: path.resolve(process.env.BG_MEMORY_DIST || 'scratch/bg-memory/dist'), emptyOutDir: true } });
