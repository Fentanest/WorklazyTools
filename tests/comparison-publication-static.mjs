import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {COMPARISON_TOOL_IDS} from '../src/app/publicServiceConfig.mjs';
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'worklazy-publication-'));
try{
 await fs.copyFile('dist/index.html',path.join(directory,'index.html'));
 // Seed stale generated pages: standalone regeneration must remove them too.
 for(const prefix of ['','ko','en'])for(const id of COMPARISON_TOOL_IDS){const dir=path.join(directory,prefix,'tools',id);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'index.html'),'stale');}
 const result=spawnSync(process.execPath,['--experimental-strip-types','scripts/generate-static-pages.mjs'],{env:{...process.env,WORKLAZY_COMPARISON_PORT:'off',WORKLAZY_STATIC_OUTPUT_DIR:directory},encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stderr);
 const publication=JSON.parse(await fs.readFile(path.join(directory,'comparison-publication.json'),'utf8')),sitemap=await fs.readFile(path.join(directory,'sitemap.xml'),'utf8');assert.equal(publication.enabled,false);
 for(const id of COMPARISON_TOOL_IDS){assert.ok(!sitemap.includes(`/tools/${id}/`));for(const prefix of ['','ko','en'])await assert.rejects(fs.access(path.join(directory,prefix,'tools',id,'index.html')));}
 await fs.access(path.join(directory,'en/tools/text-tools/index.html'));console.log('26 passed comparison publication-off static generation checks');
}finally{await fs.rm(directory,{recursive:true,force:true});}
