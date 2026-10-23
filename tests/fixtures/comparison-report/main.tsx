import React from 'react';import{createRoot}from'react-dom/client';
import{ReportExportControl}from'../../../src/features/comparison-report/ReportExportControl';
import{createExportSnapshot}from'../../../src/features/comparison-report/snapshot';
import{writeSnapshotPng}from'../../../src/features/comparison-report/png';
import '../../../src/styles/tailwind.css';import '../../../src/styles/global.css';import '../../../src/styles/worklazy-theme.css';
const snapshot=createExportSnapshot({language:'en',tool:'image',sources:[{id:'image',revision:'r1',label:'image.png'}],appliedOptions:{view:'overlay',opacity:0.5},coordinates:{matrix:[1,0,0,1,0,0],unit:'working-pixels'},warnings:['reduced-resolution'],completion:'partial',rows:[],view:{width:2,height:1,alpha:'preserved',renderOptions:{view:'overlay',opacity:0.5}}});
const capture=async()=>{const canvas=document.createElement('canvas');canvas.width=2;canvas.height=1;const context=canvas.getContext('2d')!;context.globalAlpha=0.5;context.fillStyle='#ff0000';context.fillRect(1,0,1,1);return{canvas,snapshotId:snapshot.id,view:snapshot.view!,release(){canvas.width=canvas.height=0;}};};
Object.assign(window,{createTestPng:async()=>Array.from(new Uint8Array(await(await writeSnapshotPng(snapshot,new AbortController().signal,capture)).arrayBuffer()))});
const root=createRoot(document.getElementById('root')!);root.render(<React.StrictMode><main className="p-6"><h1>Comparison report</h1><ReportExportControl snapshot={snapshot} isCurrent={()=>true} capture={capture} language="en"/></main></React.StrictMode>);

Object.assign(window,{renderMissingGlyph:()=>{const model=createExportSnapshot({language:'en',tool:'text',sources:[{id:'left',revision:'r1',label:'left'}],appliedOptions:{},coordinates:{unit:'utf16'},warnings:[],completion:'complete',rows:[{id:'emoji',status:'changed',left:'😀',right:''}]});root.render(<React.StrictMode><main className="p-6"><h1>Comparison report</h1><ReportExportControl snapshot={model} isCurrent={()=>true} language="en"/></main></React.StrictMode>);}});
