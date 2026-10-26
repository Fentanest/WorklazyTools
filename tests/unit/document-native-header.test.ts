import test from 'node:test';import assert from 'node:assert/strict';import {hasNativeHeader} from '../../src/features/document-compare/nativeHeader.ts';
test('UI hint reads exactly8 bytes and never requests full file',async()=>{
 const calls:Array<[number|undefined,number|undefined]>=[];
 const file={slice:(start?:number,end?:number)=>{calls.push([start,end]);return new Blob([new Uint8Array([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])]);}};
 assert.equal(await hasNativeHeader(file),true);assert.deepEqual(calls,[[0,8]]);
});
test('unknown ZIP and short files keep DOCX controls as hint; actual normalization remains client-owned',async()=>{
 assert.equal(await hasNativeHeader(new File([new Uint8Array([0x50,0x4b,3,4,0,0,0,0])],'unknown.zip')),false);assert.equal(await hasNativeHeader(new File(['small'],'short.doc')),false);
});
import {compareDocumentModels} from '../../src/features/document-compare/documentComparison.ts';
test('event extraction facts do not rename existing source decisions',()=>{
 const source={part:'word/document.xml',path:[0],kind:'p',rawText:'Same',opaqueSignature:'opaque',copySignature:'copy'};
 const model=(eventFacts:boolean)=>{const ref={...source,...(eventFacts?{objectEventsSupported:true}:{})};return {sourceInventory:[ref],blocks:[{type:'paragraph' as const,text:'Same',source:ref,format:'',location:'Body'}],headerFooter:[],notes:[],warnings:[]};};
 const compare=(facts:boolean)=>compareDocumentModels('before','after',model(facts),model(facts),{formatting:false,tables:true,metadata:true},'en');
 assert.equal(compare(false).manifest.decisions[0].id,compare(true).manifest.decisions[0].id);
});
