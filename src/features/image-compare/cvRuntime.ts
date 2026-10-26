import { CV_INITIAL_MEMORY_BYTES } from "./memory.ts";
import { capCvMemory } from "./cvMemory.ts";
export async function loadCvRuntime<T>(progress:()=>void){
  const scope=self as unknown as DedicatedWorkerGlobalScope & {Module?:object;cv?:Promise<T>};
  const assets=[['opencv.js','5930cd64d2f8f0fa6c572aae761837d95dd8d5b67c972c6a8a9daa37aa63795f',128047],['opencv_js.wasm','8f4e4ff34715a0efc28262ca60248f93ab48b720b33378926321d8eb0dc448bd',8355721]] as const;
  const [script,wasm]=await Promise.all(assets.map(async([name,hash,length])=>{const response=await fetch(new URL(name,scope.location.href));if(!response.ok)throw new Error('REGION_ASSET_UNAVAILABLE');const bytes=await response.arrayBuffer();const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(bytes.byteLength!==length||digest!==hash)throw new Error('REGION_ASSET_INTEGRITY');return bytes;}));
  let memory:WebAssembly.Memory|undefined;
  scope.Module={wasmBinary:wasm,instantiateWasm:(imports:WebAssembly.Imports,receive:(instance:WebAssembly.Instance,module:WebAssembly.Module)=>void)=>{
    const module=new WebAssembly.Module(wasm),instance=new WebAssembly.Instance(module,imports),exported=instance.exports.Y;
    if(!(exported instanceof WebAssembly.Memory))throw new Error('REGION_INITIALIZATION_FAILED');
    memory=capCvMemory(exported,CV_INITIAL_MEMORY_BYTES);receive(instance,module);return instance.exports;
  }};
  const url=URL.createObjectURL(new Blob([script],{type:'application/javascript'}));
  try{scope.importScripts(url);const cv=await scope.cv;if(!cv||!memory)throw new Error('REGION_INITIALIZATION_FAILED');progress();return {cv,memory};}
  finally{URL.revokeObjectURL(url);}
}
