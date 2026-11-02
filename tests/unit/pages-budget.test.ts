import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { enforcePagesBudget, PAGES_BUDGET } from '../../scripts/check-pages-budget.mjs';
async function fixture(run: (root: string) => Promise<void>) { const root=await mkdtemp(path.join(os.tmpdir(),'ie1-pages-budget-'));try{await run(root)}finally{await rm(root,{recursive:true,force:true})} }
test('Pages limits remain 1 GiB with 50 MiB headroom',()=>assert.deepEqual(PAGES_BUDGET,{limit:1073741824,minimumHeadroom:52428800}));
test('Pages budget counts recursive uncompressed bytes and accepts exact headroom',()=>fixture(async root=>{await mkdir(path.join(root,'assets'));await writeFile(path.join(root,'index.html'),'a');await writeFile(path.join(root,'assets','x'),Buffer.alloc(89));assert.deepEqual(await enforcePagesBudget(root,{limit:100,minimumHeadroom:10}),{files:2,bytes:90,limit:100,minimumHeadroom:10,headroom:10})}));
test('Pages budget rejects one byte under minimum headroom',()=>fixture(async root=>{await writeFile(path.join(root,'x'),Buffer.alloc(91));await assert.rejects(enforcePagesBudget(root,{limit:100,minimumHeadroom:10}),/budget exceeded/)}));
test('Pages budget rejects over 1 GiB-equivalent limit',()=>fixture(async root=>{await writeFile(path.join(root,'x'),Buffer.alloc(101));await assert.rejects(enforcePagesBudget(root,{limit:100,minimumHeadroom:10}),/budget exceeded/)}));
test('Pages budget rejects empty and absent trees',()=>fixture(async root=>{await assert.rejects(enforcePagesBudget(root),/empty/);await assert.rejects(enforcePagesBudget(path.join(root,'absent')),/ENOENT/)}));
test('Pages budget rejects symbolic links',()=>fixture(async root=>{await writeFile(path.join(root,'x'),'x');await symlink(path.join(root,'x'),path.join(root,'link'));await assert.rejects(enforcePagesBudget(root),/symlink/)}));
