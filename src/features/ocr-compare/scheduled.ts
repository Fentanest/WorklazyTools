import type {OcrPair} from './types.ts';
export type RasterOcrExecute=(work:(signal:AbortSignal)=>Promise<OcrPair>,callerSignal:AbortSignal)=>Promise<OcrPair>;
const canceled=()=>new DOMException('Canceled','AbortError');
/** Scheduling may delay or abort work; this promise never settles before owned provider cleanup. */
export async function runScheduledOcr(work:(signal:AbortSignal)=>Promise<OcrPair>,callerSignal:AbortSignal,execute?:RasterOcrExecute){
 if(callerSignal.aborted)throw canceled();
 const owned=new AbortController();let closed=false,started:Promise<OcrPair>|undefined,providerSignal:AbortSignal|undefined,parentSignal:AbortSignal|undefined,rejectCanceled:(reason:unknown)=>void=()=>{};
 const abort=()=>{owned.abort();rejectCanceled(canceled());},aborted=new Promise<never>((_,reject)=>{rejectCanceled=reject;});void aborted.catch(()=>{});callerSignal.addEventListener('abort',abort,{once:true});const parentAbort=()=>owned.abort();
 const invoke=(signal:AbortSignal)=>{if(closed||callerSignal.aborted)return Promise.reject(canceled());if(started)return Promise.reject(new Error('OCR_SCHEDULER_INVALID'));parentSignal=signal;if(signal.aborted)owned.abort();else signal.addEventListener('abort',parentAbort,{once:true});providerSignal=owned.signal;started=Promise.resolve().then(()=>work(providerSignal!));return started;};
 try{
  const scheduled=execute?execute(invoke,callerSignal):invoke(callerSignal);await Promise.race([scheduled,aborted]);
  if(!started)throw new Error('OCR_SCHEDULER_INVALID');const result=await started;if(callerSignal.aborted||providerSignal?.aborted)throw canceled();return result;
 }finally{closed=true;owned.abort();callerSignal.removeEventListener('abort',abort);parentSignal?.removeEventListener('abort',parentAbort);if(started)await started.catch(()=>{});}
}
