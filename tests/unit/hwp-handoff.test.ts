import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import {createRoot} from "react-dom/client";
import {JSDOM} from "jsdom";
import {acceptsFile} from "../../src/app/fileAccepts.ts";
import type {HandoffAdapter, HandoffEntry, DeliveryResult} from "../../src/app/memoryHandoff.ts";
const deferred = <T,>() => { let resolve!: (value:T)=>void; const promise=new Promise<T>(done=>resolve=done); return {promise,resolve}; };
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const file=()=>new File(["synthetic"],"input.HWP");
const entry=(input:File):HandoffEntry=>({files:[input],receiverId:"hwp-editor",entryPath:"/tools/hwp-editor",origin:"user-input",source:"unit",schema:1,id:"id",nonce:"nonce",createdAt:0,expiresAt:60000});
async function fixture(run:(f:{adapter:()=>HandoffAdapter; select:(files:File[])=>void; editors:any[]; dom:JSDOM; protected:()=>boolean; unmount:()=>Promise<void>; ready:ReturnType<typeof deferred<void>>; load:ReturnType<typeof deferred<void>>; hml:ReturnType<typeof deferred<void>>})=>Promise<void>,block:"ready"|"load"|"hml"|"fail"|"none") {
 const dom=new JSDOM("<div id='root'></div>",{url:"https://example.test/en/tools/hwp-editor"});
 const saved=new Map(["window","document","IS_REACT_ACT_ENVIRONMENT"].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{configurable:true,value});
 const ready=deferred<void>(),load=deferred<void>(),hml=deferred<void>();
 let adapter:HandoffAdapter,select:(files:File[])=>void,protectedInput=false;
 const editors:any[]=[];
 const noop=()=>{},t=(key:string,options?:Record<string,unknown>)=>key+(options?.name?':'+options.name:'');
 const i18n={t,resolvedLanguage:"en"};
 const progress={status:"idle",message:"",logs:[],start:noop,succeed:noop,fail:noop,reset:noop};
 const box=({children,...props}:any)=>React.createElement("div",Object.fromEntries(Object.entries(props).filter(([key])=>key.startsWith('data-'))),children);
 const stub=new Proxy({}, {get:()=>()=>null});
 const context=vm.createContext({exports:{},DOMException,window:dom.window,require:(id:string)=>{
  if(id==='react')return React;if(id==='react/jsx-runtime')return jsx;
  if(id==='lucide-react')return stub;
  if(id==='react-i18next')return {useTranslation:()=>({t,i18n})};
  if(id==='../../app/fileAccepts')return {acceptsFile};
  if(id==='../../app/useHandoffReceiver')return {useHandoffReceiver:(_id:string,next:HandoffAdapter)=>{adapter=next;return {recoveryFiles:[],dismiss:noop};}};
  if(id==='../../app/toolState')return {setUnsavedWork:()=>{protectedInput=true;},useUnsavedWorkGuard:noop};
  if(id==='../../hooks/useOperationProgress')return {useOperationProgress:()=>progress};
  if(id==='../../config/rhwp')return {getRhwpStudioUrl:()=>'/studio'};
  if(id==='../../lib/utils')return {cn:()=>''};
  if(id==='../../components/AppShell')return {useFocusMode:()=>noop};
  if(id==='@rhwp/editor')return {createEditor:async()=>{
   const index=editors.length;
   const editor={element:dom.window.document.createElement('iframe'),destroyed:false,calls:0,
    destroy(){this.destroyed=true;},
    async loadFile(){this.calls++;if(index===0&&block==='load')await load.promise;if(block==='fail')throw Error('corrupt');return {pageCount:2};},
    async getHmlSaveState(){if(index===0&&block==='hml')await hml.promise;return {hmlSavable:true,blockers:[]};}};
   editors.push(editor);if(index===0&&block==='ready')await ready.promise;return editor;
  }};
  if(id==='../../components/ui')return {SectionCard:box,PageHeader:box,PrimaryButton:box,FileList:()=>null,FileDropZone:({onFiles}:any)=>{select=onFiles;return null;}};
  if(id==='../../components/UtilitySurface')return {UtilityPage:box,UtilityNotice:box};
  return stub;
 }});
 const source=readFileSync(new URL('../../src/features/hwp-editor/HwpEditorPage.tsx',import.meta.url),'utf8');
 vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 const root=createRoot(dom.window.document.getElementById('root')!);let mounted=true;
 const unmount=async()=>{if(mounted){mounted=false;await React.act(async()=>root.unmount());}};
 try{
  await React.act(async()=>{root.render(React.createElement(context.exports.HwpEditorPage));await tick();});
  await run({adapter:()=>adapter!,select:files=>select!(files),editors,dom,protected:()=>protectedInput,unmount,ready,load,hml});
 }finally{
  ready.resolve();load.resolve();hml.resolve();await unmount();dom.window.close();
  for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
}
test('HWP inspection waits for editor initialization and installs protection before accepted',async()=>fixture(async f=>{
 let receiving!:Promise<DeliveryResult>;const input=file();
 await React.act(async()=>{receiving=Promise.resolve(f.adapter().receive(entry(input),{signal:new AbortController().signal}));await tick();});
 assert.equal(f.editors[0].calls,0);assert.equal(f.protected(),false);
 let result!:DeliveryResult;await React.act(async()=>{f.ready.resolve();result=await receiving;});
 assert.equal(result.status,'accepted');assert.equal(result.accepted[0],input);assert.equal(f.protected(),true);
 assert.ok(f.dom.window.document.querySelector('[data-testid=hwp-focus-document]'));
},'ready'));
for(const block of ['load','hml'] as const)test('HWP abort during '+block+' destroys instance and prevents late success/newer input reset',async()=>fixture(async f=>{
 let receiving!:Promise<DeliveryResult>;const abort=new AbortController();const old=f.adapter();
 await React.act(async()=>{receiving=Promise.resolve(old.receive(entry(file()),{signal:abort.signal}));await tick();});
 assert.equal(f.protected(),false);assert.equal(f.editors[0].calls,1);
 await React.act(async()=>{abort.abort();old.invalidate!();await tick();});
 assert.equal(f.editors[0].destroyed,true);assert.equal(f.editors.length,2);
 await React.act(async()=>{f.select([new File(['new'],'newer.hwpx')]);await tick();});
 assert.match(f.dom.window.document.body.textContent!,/newer.hwpx/);
 let result!:DeliveryResult;
 await React.act(async()=>{f[block].resolve();result=await receiving;old.invalidate!();await tick();});
 assert.equal(result.accepted.length,0);assert.match(f.dom.window.document.body.textContent!,/newer.hwpx/);
 assert.equal(f.editors[1].destroyed,false);
},block));
test('HWP load failure rejects original without input protection or open UI',async()=>fixture(async f=>{
 let result!:DeliveryResult;const input=file();await React.act(async()=>{result=await f.adapter().receive(entry(input),{signal:new AbortController().signal});});
 assert.equal(result.status,'rejected');assert.equal(result.rejected[0].file,input);assert.equal(f.protected(),false);
 assert.equal(f.dom.window.document.querySelector('[data-testid=hwp-focus-document]'),null);
},'fail'));
test('HWP unmount invalidates pending initialization before load/protection',async()=>fixture(async f=>{
 const receiving=f.adapter().receive(entry(file()),{signal:new AbortController().signal});
 await f.unmount();f.ready.resolve();const result=await receiving;
 assert.equal(result.accepted.length,0);assert.equal(f.editors[0].calls,0);assert.equal(f.editors[0].destroyed,true);assert.equal(f.protected(),false);
},'ready'));

test('P3b HWP incoming handoff preserves a manually opened document',async()=>fixture(async f=>{
 await React.act(async()=>{f.select([new File(['manual'],'manual.hwpx')]);await tick();});
 assert.match(f.dom.window.document.body.textContent!,/manual.hwpx/);
 const before=f.editors[0].calls;let result!:DeliveryResult;
 await React.act(async()=>{result=await f.adapter().receive(entry(file()),{signal:new AbortController().signal});});
 assert.equal(result.status,'rejected');assert.equal(result.rejected[0].reasonCode,'busy');
 assert.equal(f.editors[0].calls,before);assert.equal(f.editors[0].destroyed,false);
 assert.match(f.dom.window.document.body.textContent!,/manual.hwpx/);
},'none'));
test('P3b HWP successful handoff cannot be closed by a late same-generation invalidate',async()=>fixture(async f=>{
 let result!:DeliveryResult;const input=file();const old=f.adapter();
 await React.act(async()=>{result=await old.receive(entry(input),{signal:new AbortController().signal});});
 assert.equal(result.status,'accepted');
 await React.act(async()=>{old.invalidate!();await tick();});
 assert.equal(f.editors[0].destroyed,false);assert.equal(f.editors.length,1);
 assert.ok(f.dom.window.document.querySelector('[data-testid=hwp-focus-document]'));
},'none'));
test('P3b HWP second handoff cannot cancel an already pending manual open',async()=>fixture(async f=>{
 await React.act(async()=>{f.select([new File(['manual'],'manual.hwpx')]);await tick();});
 const old=f.adapter();let result!:DeliveryResult;
 await React.act(async()=>{result=await old.receive(entry(file()),{signal:new AbortController().signal});await tick();});
 assert.equal(result.status,'rejected');assert.equal(result.rejected[0].reasonCode,'busy');assert.equal(f.editors[0].destroyed,false);
 await React.act(async()=>{f.load.resolve();await tick();});
 assert.match(f.dom.window.document.body.textContent!,/manual.hwpx/);
},'load'));
