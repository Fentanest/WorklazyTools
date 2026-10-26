import { waitForPdfRender } from "../pdf-editor/pdfRenderLifecycle.ts";
import { waitWithAbort } from "../../utils/pdfOwnedDocument.ts";
import { openComparisonPdf } from "./runtime.ts";
import { checkAbort } from "./kernel.ts";
import { PAGE_CANDIDATE_POLICY, pageFingerprint, selectPageCandidates, readCandidateBytes } from "./pageCandidates.ts";

export async function suggestPdfPages(before:File,after:File,signal:AbortSignal,progress:(done:number,total:number)=>void){
  checkAbort(signal);
  if([before,after].some(file=>file.size>PAGE_CANDIDATE_POLICY.maxFileBytes))throw new Error("PAGE_CANDIDATE_LIMIT");
  const owners:Awaited<ReturnType<typeof openComparisonPdf>>[]=[];const hashes:Array<Array<Uint8Array|null>>=[];
  try {
    owners.push(await openComparisonPdf(before,signal,await readCandidateBytes(before,signal)));checkAbort(signal);
    owners.push(await openComparisonPdf(after,signal,await readCandidateBytes(after,signal)));checkAbort(signal);
    if(owners.some(owner=>owner.document.numPages>PAGE_CANDIDATE_POLICY.maxPages))throw new Error("PAGE_CANDIDATE_LIMIT");
    const total=owners.reduce((n,owner)=>n+owner.document.numPages,0);let done=0;
    for(const owner of owners){
      const pages:Array<Uint8Array|null>=[];hashes.push(pages);
      for(let index=0;index<owner.document.numPages;index++){
        checkAbort(signal);const page=await waitWithAbort(owner.document.getPage(index+1),signal);checkAbort(signal);
        const canvas=document.createElement("canvas"),square=document.createElement("canvas");
        try {
          const natural=page.getViewport({scale:1}),scale=128/Math.max(natural.width,natural.height),viewport=page.getViewport({scale});
          if(!Number.isFinite(scale)||scale<=0)throw new Error("PAGE_CANDIDATE_RENDER");
          canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));square.width=square.height=128;
          const context=canvas.getContext("2d"),target=square.getContext("2d");if(!context||!target)throw new Error("PAGE_CANDIDATE_RENDER");
          context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);owner.deferAbortUntilRenderSettles();
          await waitForPdfRender(page.render({canvas,canvasContext:context,viewport,background:"rgb(255,255,255)",annotationMode:1}),page,{signal,cleanupOnCancel:false});checkAbort(signal);
          target.fillStyle="#fff";target.fillRect(0,0,128,128);target.drawImage(canvas,0,0,128,128);
          pages.push(pageFingerprint(target.getImageData(0,0,128,128).data));
        }finally{canvas.width=canvas.height=square.width=square.height=0;page.cleanup();}
        progress(++done,total);await new Promise<void>(resolve=>setTimeout(resolve,0));checkAbort(signal);
      }
    }
    return selectPageCandidates(hashes[0],hashes[1]);
  }finally{await Promise.allSettled(owners.map(owner=>owner.close()));}
}
