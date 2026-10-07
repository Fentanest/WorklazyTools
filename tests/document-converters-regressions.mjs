import {test} from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
for(const script of ['tests/office-editor-smoke.mjs','tests/xls-preserve-smoke.mjs']) {
 test('existing '+script+' remains functional', {timeout:420000}, async()=>{
  const {stdout,stderr}=await run(process.execPath,[script],{cwd:process.cwd(),env:process.env,timeout:400000,maxBuffer:2*1024*1024});
  console.log(stdout);if(stderr)console.error(stderr);
 });
}
