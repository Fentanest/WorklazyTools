import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import path from 'node:path'; import os from 'node:os';
const root=path.resolve(import.meta.dirname,'..');
export default defineConfig({root,cacheDir:path.join(os.tmpdir(),'worklazy-redactor-ui-vite-cache'),publicDir:false,resolve:{alias:{'@':path.join(root,'src')}},plugins:[react(),tailwindcss(),nodePolyfills({globals:{Buffer:true,global:true,process:true},protocolImports:true})],build:{outDir:process.env.REDACTOR_UI_DIST_DIR??path.join(os.tmpdir(),'worklazy-redactor-ui-dist'),rollupOptions:{input:path.join(root,'tests/redactor-ui.html')}},preview:{host:'127.0.0.1',port:Number(process.env.REDACTOR_UI_PORT??4340),strictPort:true,headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}}});
