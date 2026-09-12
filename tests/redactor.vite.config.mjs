import {defineConfig} from 'vite';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import path from 'node:path';
import os from 'node:os';
const root=path.resolve(import.meta.dirname,'..');
export default defineConfig({root,cacheDir:path.join(os.tmpdir(),'worklazy-redactor-vite-cache'),publicDir:false,plugins:[nodePolyfills({include:['buffer','events','stream','util'],globals:{Buffer:true,global:true,process:true},protocolImports:true})],build:{outDir:process.env.REDACTOR_DIST_DIR??path.join(os.tmpdir(),'worklazy-redactor-engine-dist'),rollupOptions:{input:path.join(root,'tests/redactor-browser.html')}},preview:{host:'127.0.0.1',port:Number(process.env.REDACTOR_PORT??4330),strictPort:true}});
