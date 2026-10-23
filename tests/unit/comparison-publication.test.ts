import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {COMPARISON_TOOL_IDS,isComparisonToolPublished,isComparisonPathPublished} from '../../src/app/publicServiceConfig.mjs';
test('one publication setting closes catalog and all comparison/result aliases together',()=>{
 for(const id of COMPARISON_TOOL_IDS){assert.equal(isComparisonToolPublished(id,false),false);for(const prefix of ['','/ko','/en']){assert.equal(isComparisonPathPublished(`${prefix}/tools/${id}/`,false),false);assert.equal(isComparisonPathPublished(`${prefix}/tools/${id}/results/1`,false),false);assert.equal(isComparisonPathPublished(`${prefix}/tools/${id}/`,true),true);}}
 for(const path of ['/ko/tools/word-compare/','/en/tools/hwp-compare/'])assert.equal(isComparisonPathPublished(path,false),false);
 for(const id of ['text-tools','excel-merger','pdf-editor'])assert.equal(isComparisonToolPublished(id,false),true);
});
test('Node build flag and compile-time override select the intended value',()=>{
 const script="const c=await import('./src/app/publicServiceConfig.mjs');console.log(c.COMPARISON_PORT_PUBLIC)";
 const override=spawnSync(process.execPath,['--input-type=module','-e','globalThis.__COMPARISON_PORT_PUBLIC__=false;'+script],{env:{...process.env,WORKLAZY_COMPARISON_PORT:'on'},encoding:'utf8'});assert.equal(override.status,0);assert.equal(override.stdout.trim(),'false');
 for(const [value,want] of [['off','false'],['on','true']]){const child=spawnSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,WORKLAZY_COMPARISON_PORT:value},encoding:'utf8'});assert.equal(child.status,0);assert.equal(child.stdout.trim(),want);}
});
