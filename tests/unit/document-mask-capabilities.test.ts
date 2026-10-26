import test from 'node:test';import assert from 'node:assert/strict';
import {formattingScopeForPair} from '../../src/features/document-compare/documentCompareClient.ts';
import {defaultFormattingMask} from '../../src/features/document-compare/formattingMask.ts';
import {documentCapabilities,documentProvenance} from '../../src/features/document-compare/documentCapabilities.ts';
import {compareDocumentModels} from '../../src/features/document-compare/documentComparison.ts';
const options={formatting:true,tables:true,metadata:true,trackedDocument:true,rewriteRevisionAuthor:false,revisionAuthor:'Test',formattingMask:{...defaultFormattingMask,size:false}};
test('native and mixed dispatch keeps requested mask, normalizes applied mask, and preserves user options',()=>{
 const snapshot=JSON.stringify(options);
 for(const docx of [true,false,true,false]){const applied=formattingScopeForPair(docx,options);assert.equal(applied.formattingMask?.size,docx?false:true);assert.equal(applied.requestedFormattingMask?.size,docx?undefined:false);}
 assert.equal(JSON.stringify(options),snapshot);
 const off=formattingScopeForPair(false,{...options,formatting:false});assert.equal(off.formatting,false);assert.equal(off.requestedFormattingMask?.size,false);
});
test('capabilities accurately distinguish native partial sources and DOCX validated subset',()=>{
 for(const format of ['doc','hwp','hwpx'] as const){const caps=documentCapabilities(format);assert.equal(caps.detailedFormattingMasks,false);assert.equal(caps.sourceCoverage,'partial-native-model');assert.equal(caps.opaqueObjects,'may-be-omitted');assert.equal(caps.emptyResultProvesEquality,false);}
 assert.equal(documentCapabilities('docx').detailedFormattingMasks,true);
 assert.equal(documentCapabilities('docx',{blocks:[],sourceInventory:[{kind:'p',opaqueSignature:'drawing'}]}).contentStatus,'structure-only');
 assert.equal(documentCapabilities('docx',{blocks:[],sourceInventory:[]}).contentStatus,'empty');
 assert.equal(documentCapabilities('doc',{blocks:[]}).contentStatus,'unknown-native');
});
test('raw and accepted snapshot hashes/policy are independent and bytes remain unchanged',async()=>{
 const raw=new TextEncoder().encode('raw').buffer,accepted=new TextEncoder().encode('accepted').buffer;
 const provenance=await documentProvenance(raw,accepted,true);assert.notEqual(provenance.rawSha256,provenance.comparisonSha256);assert.equal(provenance.revisionPolicy,'accepted-with-revised-comments');assert.equal(new TextDecoder().decode(raw),'raw');assert.deepEqual(await documentProvenance(raw,raw),{rawSha256:provenance.rawSha256,comparisonSha256:provenance.rawSha256,revisionPolicy:'raw',sourceBytes:'local-file'});
});
test('native defaults retain historical results and refuse unnormalized nondefault masks',()=>{
 const model={blocks:[{type:'paragraph' as const,text:'Same',format:'native',location:'Body'}],headerFooter:[],notes:[],warnings:[],capabilities:documentCapabilities('doc')};
 const ordinary=compareDocumentModels('before','after',model,model,{formatting:true,tables:true,metadata:true},'en');
 const normalized=compareDocumentModels('before','after',model,model,formattingScopeForPair(false,options),'en');assert.deepEqual(normalized.summary,ordinary.summary);assert.deepEqual(normalized.views,ordinary.views);assert.equal(normalized.manifest.formattingMask.inactiveRequested?.size,false);
 assert.throws(()=>compareDocumentModels('before','after',model,model,options,'en'),/two DOCX/);
});
test('actual sniffed mixed batch dispatch normalizes each pair and preserves returned order',async()=>{
 const {compareDocumentFilePairs}=await import('../../src/features/document-compare/documentCompareClient.ts');
 const zip=(path:string)=>new Uint8Array([0x50,0x4b,3,4,...new TextEncoder().encode(path)]);
 const cfb=(stream:string)=>new Uint8Array([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1,...Array.from(stream).flatMap(char=>[char.charCodeAt(0),0])]);
 const files=[new File([cfb('WordDocument')],'native-renamed.docx'),new File([zip('word/document.xml')],'xml-renamed.doc'),new File([cfb('FileHeader')],'hwp-renamed.docx')];
 const observed:Array<{options:typeof options;names:string[]}>=[];const originalWorker=globalThis.Worker;
 class MockWorker {
  onmessage:((event:MessageEvent)=>void)|null=null;onerror:unknown;onmessageerror:unknown;
  terminate(){}
  postMessage(packet:{pairs:Array<{beforeName:string;afterName:string}>;options:typeof options}){
   observed.push({options:packet.options,names:packet.pairs.map(pair=>pair.beforeName)});
   queueMicrotask(()=>this.onmessage?.({data:{type:'result',result:packet.pairs.map(pair=>({result:{beforeName:pair.beforeName,afterName:pair.afterName,summary:{added:0,deleted:0,changed:0,format:0,unchanged:1},changes:[],tables:[],warnings:[],views:{document:[],headerFooter:[],note:[]}}}))}} as MessageEvent));
  }
 }
 globalThis.Worker=MockWorker as unknown as typeof Worker;
 try{
  const results=await compareDocumentFilePairs(files.map(file=>({beforeFile:file,afterFile:file})),options,undefined,'en');
  assert.deepEqual(results.map(item=>item.result.beforeName),files.map(file=>file.name));
  assert.equal(observed.find(item=>item.names[0]==='xml-renamed.doc')?.options.formattingMask.size,false);
  for(const name of ['native-renamed.docx','hwp-renamed.docx'])assert.equal(observed.find(item=>item.names[0]===name)?.options.formattingMask.size,true);
  assert.ok(results[0].result.warnings.some(warning=>warning.includes('DOCX pairs only')));assert.ok(results[2].result.warnings.some(warning=>warning.includes('DOCX pairs only')));assert.equal(options.formattingMask.size,false);
 }finally{globalThis.Worker=originalWorker;}
});
test('numbering mask excludes generated list labels while preserving raw text and default visibility',()=>{
 const fact={supported:{},unsupported:{},history:false};const source={part:'word/document.xml',path:[0],kind:'p',rawText:'Item',normalizedProperties:{pPr:fact}};const run={part:source.part,path:[0,0],kind:'r',paragraphPath:[0],textRange:[0,4] as [number,number],normalizedProperties:{rPr:fact}};
 const model=(label:string)=>({blocks:[{type:'paragraph' as const,text:label+' Item',rawText:'Item',source,format:'list',location:'Body'}],sourceInventory:[source,run],headerFooter:[],notes:[],warnings:[]});
 const before=model('1.'),after=model('2.');const original=JSON.stringify([before,after]);
 const masked=compareDocumentModels('before','after',before,after,{formatting:true,tables:true,metadata:true,formattingMask:{numbering:false}},'en');assert.equal(masked.views.document[0].before,'Item');assert.equal(masked.views.document[0].after,'Item');assert.equal(masked.summary.changed+masked.summary.added+masked.summary.deleted,0);
 const ordinary=compareDocumentModels('before','after',before,after,{formatting:true,tables:true,metadata:true},'en');assert.ok(ordinary.summary.changed+ordinary.summary.added+ordinary.summary.deleted>0);assert.equal(JSON.stringify([before,after]),original);
});
