import test from 'node:test';import assert from 'node:assert/strict';
import {runAllUnitSuites} from '../../scripts/run-all-unit-tests.mjs';
test('both unit suites run even after public failure',()=>{const calls:string[][]=[];const status=runAllUnitSuites((args:string[])=>{calls.push(args);return{status:calls.length===1?1:0}});assert.equal(calls.length,2);assert.ok(calls[1].includes('src/features/image-studio/bgRemoval/tests/unit.test.ts'));assert.equal(status,1)});
test('BG failure and startup failure remain failing',()=>{for(const statuses of [[0,1],[null,0]]){let i=0;assert.equal(runAllUnitSuites(()=>({status:statuses[i++]})),1);assert.equal(i,2)}});
test('both passing suites succeed',()=>assert.equal(runAllUnitSuites(()=>({status:0})),0));
