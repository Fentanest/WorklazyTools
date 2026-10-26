import type {Bounds} from './types.ts';
import type {AlignmentFeatureRois,Point} from './alignmentTypes.ts';
export function validateFeatureRoi(roi:Bounds|undefined,width:number,height:number):Bounds{
 if(!roi)return {x:0,y:0,width,height};
 if(![roi.x,roi.y,roi.width,roi.height].every(Number.isSafeInteger)||roi.x<0||roi.y<0||roi.width<64||roi.height<64||roi.x+roi.width>width||roi.y+roi.height>height)throw new Error('ALIGNMENT_ROI');
 return {...roi};
}
export function snapshotFeatureRois(rois:AlignmentFeatureRois|undefined,lw:number,lh:number,rw:number,rh:number){return {left:validateFeatureRoi(rois?.left,lw,lh),right:validateFeatureRoi(rois?.right,rw,rh)};}
export function pointInFeatureRoi(p:Point,roi:Bounds){return p.x>=roi.x&&p.y>=roi.y&&p.x<roi.x+roi.width&&p.y<roi.y+roi.height;}
/** ORB runs on the original-sized Mat with a mask: its points already include ROI origin. */
export function roiRelativePoint(p:Point,roi:Bounds):Point{return {x:p.x-roi.x,y:p.y-roi.y};}
