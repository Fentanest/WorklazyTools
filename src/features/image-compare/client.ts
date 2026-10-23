import {snapshotFeatureRois} from "./alignmentRoi.ts";
import {effectiveRegionOptions} from "./regionOptions.ts";
import { inspectImageHeader } from "./input.ts";
import type { AlignmentCandidate, Matrix3, AlignmentFeatureRois } from "./alignmentTypes.ts";
import { assertAlignmentBudget } from "./memory.ts";
import { projectPoint, invertProjective, projectiveGeometry, overlapRatio, warpedCorners } from "./projective.ts";
import { assertImageBudget, validateImageFileSizes, discardOwnedBuffer } from "./memory.ts";
import { sourcePolygon } from "./geometry.ts";
import { runModuleWorker } from "../../utils/workerLifecycle.ts";
import type { ImageCompareResult, PixelOptions, Transform, RegionOptions, RegionPass } from "./types.ts";
export async function compareImages(left: File, right: File, options: PixelOptions, transform: Transform, signal: AbortSignal, onProgress: (value: number) => void, previousViewBytes = 0, alignment?: Matrix3) {
  if (signal.aborted) throw new DOMException("Canceled", "AbortError");
  validateImageFileSizes([left, right]);
  assertImageBudget(0, 0, left.size + right.size, previousViewBytes);
  const [a, b] = await Promise.all([left.arrayBuffer(), right.arrayBuffer()]);
  if (signal.aborted) { discardOwnedBuffer(a); discardOwnedBuffer(b); throw new DOMException("Canceled", "AbortError"); }
  return runModuleWorker<object, ImageCompareResult>(() => new Worker(new URL("./compare.worker.ts", import.meta.url), { type: "module" }), { leftName: left.name, rightName: right.name, left: a, right: b, options, transform, previousViewBytes, alignment, runId: crypto.randomUUID() }, { transfer: [a, b], signal, onProgress: ({ progress }) => onProgress(progress), canceledMessage: "Canceled", startErrorMessage: "IMAGE_PROCESSING_FAILED", resultErrorMessage: "IMAGE_PROCESSING_FAILED", inactivityTimeoutMs: 60_000, hardTimeoutMs: 30_000 }).finally(()=>{discardOwnedBuffer(a);discardOwnedBuffer(b);});
}
export function scanRegions(result: ImageCompareResult, options: RegionOptions, signal: AbortSignal, onProgress: (value: number) => void = () => undefined, retainedSessionBytes = 0) {
  if (signal.aborted) return Promise.reject(new DOMException("Canceled", "AbortError"));
  const resources = assertImageBudget(result.quality.resources.sourcePixels, result.width * result.height, result.sources.left.bytes + result.sources.right.bytes,0,retainedSessionBytes);
  const workingScale=result.quality.scale,effectiveOptions=effectiveRegionOptions(options,workingScale);
  const delta = result.channelDelta.slice();
  return runModuleWorker<object, RegionPass>(() => new Worker(new URL(`${import.meta.env.BASE_URL}vendor/opencv/4.13.0-dev/regions-v2.worker.js`, location.origin)), { delta, resources, width: result.width, height: result.height, options:effectiveOptions, runId: result.runId, id: crypto.randomUUID() }, { transfer: [delta.buffer], signal, onProgress: ({ progress }) => onProgress(progress), canceledMessage: "Canceled", startErrorMessage: "REGION_PROCESSING_FAILED", resultErrorMessage: "REGION_PROCESSING_FAILED", inactivityTimeoutMs: 60_000 }).then((pass) => ({ ...pass,requestedOptions:{...options},workingScale,optionUnits:"original-image-pixels" as const, regions: pass.regions.map((region) => ({ ...region, sourcePolygons: { left: sourcePolygon(result.geometry.leftMatrix, region.bounds), right: result.geometry.rightProjective ? [{x:region.bounds.x,y:region.bounds.y},{x:region.bounds.x+region.bounds.width,y:region.bounds.y},{x:region.bounds.x+region.bounds.width,y:region.bounds.y+region.bounds.height},{x:region.bounds.x,y:region.bounds.y+region.bounds.height}].map(p=>projectPoint(invertProjective(result.geometry.rightProjective!),p)) : sourcePolygon(result.geometry.rightMatrix, region.bounds) } })) }));
}

export async function proposeAlignment(left:File,right:File,mode:AlignmentCandidate['mode'],sourceRevision:string,retainedBytes:number,signal:AbortSignal,onProgress:(value:number)=>void,featureRois?:AlignmentFeatureRois){
  if(signal.aborted)throw new DOMException('Canceled','AbortError');validateImageFileSizes([left,right]);const roiSnapshot=featureRois?structuredClone(featureRois):undefined;assertAlignmentBudget(0,left.size+right.size,retainedBytes);
  const [a,b]=await Promise.all([left.arrayBuffer(),right.arrayBuffer()]);if(signal.aborted){discardOwnedBuffer(a);discardOwnedBuffer(b);throw new DOMException('Canceled','AbortError');}
  let lw:number,lh:number,rw:number,rh:number;
  try{const l=inspectImageHeader(left.name,a),r=inspectImageHeader(right.name,b);[lw,lh]=l.exifOrientation>=5?[l.height,l.width]:[l.width,l.height];[rw,rh]=r.exifOrientation>=5?[r.height,r.width]:[r.width,r.height];snapshotFeatureRois(roiSnapshot,lw,lh,rw,rh);assertAlignmentBudget(lw*lh+rw*rh,left.size+right.size,retainedBytes);}
  catch(error){discardOwnedBuffer(a);discardOwnedBuffer(b);throw error;}
  return runModuleWorker<object,AlignmentCandidate>(()=>new Worker(new URL(`${import.meta.env.BASE_URL}vendor/opencv/4.13.0-dev/alignment-v2.worker.js`,location.origin)),{left:a,right:b,leftName:left.name,rightName:right.name,mode,sourceRevision,retainedBytes,featureRois:roiSnapshot},{transfer:[a,b],signal,onProgress:({progress})=>onProgress(progress),canceledMessage:'Canceled',startErrorMessage:'ALIGNMENT_FAILED',resultErrorMessage:'ALIGNMENT_FAILED',inactivityTimeoutMs:10000,hardTimeoutMs:20000,validateResult:(value):value is AlignmentCandidate=>{
    const c=value as AlignmentCandidate;const valid=!!c&&typeof c.id==='string'&&['strict','lenient'].includes(c.profile)&&typeof c.inverted==='boolean'&&[c.matches,c.trainingMatches,c.inliers,c.holdoutCount].every(v=>Number.isInteger(v)&&v>=0&&v<=1000)&&[c.inlierRatio,c.sourceCoverage,c.targetCoverage,c.overlapRatio].every(Number.isFinite)&&c.sourceRevision===sourceRevision&&c.mode===mode&&Array.isArray(c.matrix)&&c.matrix.length===9&&c.matrix.every(Number.isFinite)&&Number.isFinite(c.holdoutMedianError)&&c.holdoutMedianError>=0&&c.holdoutMedianError<=1.5&&c.holdoutCount>=4&&c.inliers>=(mode==='homography'?10:8)&&c.trainingMatches>=c.inliers&&c.trainingMatches+c.holdoutCount===c.matches&&c.inlierRatio>=0&&c.inlierRatio<=1&&Math.abs(c.inlierRatio-c.inliers/c.trainingMatches)<1e-9&&c.overlapRatio>=.35&&c.overlapRatio<=1.000001&&c.sourceCoverage>=.12&&c.sourceCoverage<=1.000001&&c.targetCoverage>=.12&&c.targetCoverage<=1.000001;
    if(!valid)return false;
    const expected=roiSnapshot?snapshotFeatureRois(roiSnapshot,lw,lh,rw,rh):undefined;
    if(expected&&![c.holdoutSourceCoverage,c.holdoutTargetCoverage].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=.12&&v<=1))return false;
    if(c.coverageReference!==(expected?'feature-roi':'full-frame')||JSON.stringify(c.featureRois)!==JSON.stringify(expected)||JSON.stringify(c.originalDimensions)!==JSON.stringify({left:{width:lw,height:lh},right:{width:rw,height:rh}}))return false;projectiveGeometry(lw,lh,rw,rh,c.matrix,left.size+right.size,retainedBytes);return overlapRatio(warpedCorners(c.matrix,rw,rh),lw,lh)>=.35;
  }}).finally(()=>{discardOwnedBuffer(a);discardOwnedBuffer(b);});
}
