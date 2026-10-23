import { ReportSession } from './session.ts';
import { assertReport, type ExportSnapshot } from './snapshot.ts';
export interface ImageDownloadLease { done:Promise<void>;release():void }
/** Includes the download URL lifetime in the page's exclusive image-memory reservation. */
export class ImageReportOwner {
  private session=new ReportSession();private active=false;private bytes=0;private job:Promise<void>=Promise.resolve();private releaseDownload?:()=>void;private listeners=new Set<(busy:boolean)=>void>();
  get busy(){return this.active;}get retainedBytes(){return this.bytes;}
  subscribe(listener:(busy:boolean)=>void){this.listeners.add(listener);listener(this.active);return()=>{this.listeners.delete(listener);};}
  private publish(){for(const listener of this.listeners)listener(this.active);}
  cancel(){this.session.cancel();this.releaseDownload?.();}
  async drain(){this.cancel();await this.session.dispose();await this.job;}
  run(snapshot:ExportSnapshot,current:()=>boolean,writer:(signal:AbortSignal)=>Promise<Blob>,deliver:(blob:Blob)=>ImageDownloadLease,reservation:number,notify:(busy:boolean)=>void){
    assertReport(!this.active,'REPORT_BUSY');this.active=true;this.bytes=reservation;this.publish();notify(true);
    const work=(async()=>{let lease:ImageDownloadLease|undefined;
      try{await this.session.run(snapshot,()=>current(),writer,blob=>{lease=deliver(blob);this.releaseDownload=lease.release;});if(lease)await lease.done;}
      finally{lease?.release();this.releaseDownload=undefined;this.active=false;this.bytes=0;this.publish();notify(false);}
    })();this.job=work.catch(()=>{});return work;
  }
}
export function imageDownloadLease(blob:Blob):ImageDownloadLease{
 const url=URL.createObjectURL(blob),link=document.createElement('a');let finish!:()=>void,closed=false,timer:ReturnType<typeof setTimeout>|undefined;
 const done=new Promise<void>(resolve=>{finish=resolve;});const release=()=>{if(closed)return;closed=true;if(timer)clearTimeout(timer);URL.revokeObjectURL(url);finish();};
 try{link.href=url;link.download='image-working-report.png';link.click();timer=setTimeout(release,1000);return{done,release};}catch(error){release();throw error;}
}

export const sharedImageReportOwner=new ImageReportOwner();
