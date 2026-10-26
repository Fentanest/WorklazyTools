import { assertSnapshot, assertOutput, assertReport, type ExportSnapshot } from './snapshot.ts';
interface Job { snapshot: ExportSnapshot; current: (snapshot: ExportSnapshot) => boolean; writer: (signal: AbortSignal) => Promise<Blob>; deliver: (blob: Blob) => void; resolve(): void; reject(error: unknown): void; control: AbortController; generation: number }
/** One active writer and at most one latest pending snapshot, including noninterruptible writers. */
export class ReportSession {
  private generation = 0; private active?: Job; private pending?: Job; private running = false;
  private idle: Promise<void> = Promise.resolve(); private finishIdle?: () => void;
  cancel() {
    this.generation++; this.active?.control.abort();
    if (this.pending) { this.pending.control.abort(); this.pending.reject(new DOMException('Canceled','AbortError')); this.pending=undefined; }
  }
  async dispose() { this.cancel(); await this.idle; }
  run(snapshot: ExportSnapshot, current: (snapshot: ExportSnapshot) => boolean, writer: (signal: AbortSignal) => Promise<Blob>, deliver: (blob: Blob) => void): Promise<void> {
    assertSnapshot(snapshot);this.cancel();
    const promise = new Promise<void>((resolve,reject)=> { this.pending={snapshot,current,writer,deliver,resolve,reject,control:new AbortController(),generation:this.generation}; });
    promise.catch(()=>{}); this.pump(); return promise;
  }
  private pump() {
    if(this.running)return;this.running=true;this.idle=new Promise(resolve=>{this.finishIdle=resolve;});
    void (async()=>{
      while(this.pending){
        const job=this.pending;this.pending=undefined;this.active=job;
        const check=()=>{job.control.signal.throwIfAborted();assertReport(job.generation===this.generation&&job.current(job.snapshot),'REPORT_STALE');};
        try { check();const blob=await job.writer(job.control.signal);check();assertOutput(blob);job.deliver(blob);job.resolve(); }
        catch(error){job.reject(error);}finally{this.active=undefined;}
      }
      this.running=false;this.finishIdle?.();this.finishIdle=undefined;
    })();
  }
}
export function downloadReport(blob: Blob, fileName: string) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  try{link.href=url;link.download=fileName;link.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
