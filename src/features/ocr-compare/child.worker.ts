/// <reference lib="webworker" />
// Unchanged Tesseract7 runs inside this bounded bridge; no recognition/model code is replaced.
const child=self as unknown as DedicatedWorkerGlobalScope;
const limit=128*1024*1024;let peak=0;
const grow=WebAssembly.Memory.prototype.grow;
WebAssembly.Memory.prototype.grow=function(pages:number){if(this.buffer.byteLength+pages*65536>limit)throw new RangeError('OCR_MEMORY_LIMIT');const result=grow.call(this,pages);peak=Math.max(peak,this.buffer.byteLength);return result;};
const instantiate=WebAssembly.instantiate.bind(WebAssembly);
// Native overloaded boundary; both Instance and instantiated-source forms are retained.
(WebAssembly as unknown as {instantiate:Function}).instantiate=async(...args:unknown[])=>{const result=await (instantiate as Function)(...args);const instance=result instanceof WebAssembly.Instance?result:result.instance;for(const value of Object.values(instance.exports))if(value instanceof WebAssembly.Memory){if(value.buffer.byteLength>limit)throw new Error('OCR_MEMORY_LIMIT');peak=Math.max(peak,value.buffer.byteLength);}return result;};
const streaming=WebAssembly.instantiateStreaming;
if(typeof streaming==='function')WebAssembly.instantiateStreaming=async(source,imports)=>WebAssembly.instantiate(await (await source).arrayBuffer(),imports);
const post=child.postMessage.bind(child);
child.postMessage=((packet: {action?:string;status?:string;data?:Record<string,unknown>})=>{if(packet.action==='recognize'&&packet.status==='resolve'&&packet.data)packet.data.__nativeHeapPeakBytes=peak;post(packet);}) as typeof child.postMessage;
const script=new URL(child.location.href).searchParams.get('script');
if(!script||new URL(script).protocol!=='blob:'||new URL(script).origin!==child.location.origin)throw new Error('OCR_BOOTSTRAP_INVALID');
const modelUrls=JSON.parse(new URL(child.location.href).searchParams.get('models')??'{}') as Record<string,string>;
const fetchAsset=child.fetch.bind(child);
child.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,child.location.href),language=/\/(eng|kor)\.traineddata\.gz$/u.exec(url.pathname)?.[1];if(language){const model=modelUrls[language];if(!model||new URL(model).protocol!=='blob:'||new URL(model).origin!==child.location.origin)return Promise.reject(new Error('OCR_MODEL_UNAVAILABLE'));return fetchAsset(model,init);}return fetchAsset(input,init);};
child.importScripts(script);
export {};
