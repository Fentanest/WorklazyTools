import type {PixelOptions,Transform,RegionOptions} from './types.ts';
import type {Matrix3,AlignmentFeatureRois} from './alignmentTypes.ts';
export interface ImageWorkingState {left?:string;right?:string;options:PixelOptions;transform:Transform;matrix?:Matrix3;featureRois?:AlignmentFeatureRois;regionOptions?:RegionOptions;alignmentMode?:'affine'|'homography'}
export const IMAGE_HISTORY_LIMITS={steps:20,bytes:64*1024**2} as const;
/** Original File objects live outside the history; only immutable catalog IDs enter transactions. */
export class ImageFileCatalog {
  private files=new Map<string,File>();private next=0;
  add(file:File){const id=String(++this.next);this.files.set(id,file);return id;}
  get(id:string|undefined){return id?this.files.get(id):undefined;}
  retain(ids:readonly (string|undefined)[]){const keep=new Set(ids);for(const id of this.files.keys())if(!keep.has(id))this.files.delete(id);}
}
function copy(value:ImageWorkingState):Readonly<ImageWorkingState>{
  // Explicit projection forbids accidental future result/model/buffer retention.
  const state:ImageWorkingState={left:value.left,right:value.right,options:{threshold:value.options.threshold,includeAA:value.options.includeAA,alphaThreshold:value.options.alphaThreshold,background:value.options.background},transform:{x:value.transform.x,y:value.transform.y,degrees:value.transform.degrees,scale:value.transform.scale,...(value.transform.scaleY===undefined?{}:{scaleY:value.transform.scaleY}),flipX:value.transform.flipX,flipY:value.transform.flipY}};
  if(value.regionOptions){const r=value.regionOptions;state.regionOptions={diffThreshold:r.diffThreshold,groupingRadius:r.groupingRadius,minArea:r.minArea,maxAreaFraction:r.maxAreaFraction};}if(value.alignmentMode)state.alignmentMode=value.alignmentMode;
  if(value.matrix){if(value.matrix.length!==9)throw new Error('IMAGE_HISTORY_INVALID');state.matrix=[...value.matrix];}
  if(value.featureRois){state.featureRois={};for(const side of ['left','right']as const){const b=value.featureRois[side];if(b)state.featureRois[side]={x:b.x,y:b.y,width:b.width,height:b.height};}}
  const validate=(v:unknown):void=>{if(typeof v==='number'&&!Number.isFinite(v))throw new Error('IMAGE_HISTORY_INVALID');if(v&&typeof v==='object'){if(ArrayBuffer.isView(v)||v instanceof ArrayBuffer)throw new Error('IMAGE_HISTORY_INVALID');for(const child of Object.values(v))validate(child);Object.freeze(v);}};
  validate(state);return Object.freeze(state);
}
export class ImageWorkingHistory {
  private states:Readonly<ImageWorkingState>[]=[];private index=0;private gesture?:string;private sizes:number[]=[];
  constructor(initial:ImageWorkingState){this.reset(initial);}
  get current(){return this.states[this.index];}get canUndo(){return this.index>0;}get canRedo(){return this.index<this.states.length-1;}get length(){return this.states.length;}get bytes(){return this.sizes.reduce((a,b)=>a+b,0);}
  reset(value:ImageWorkingState){const state=copy(value),size=this.measure(state);this.states=[state];this.sizes=[size];this.index=0;this.gesture=undefined;return state;}
  endGesture(){this.gesture=undefined;}
  commit(value:ImageWorkingState,gesture?:string){const state=copy(value),size=this.measure(state);if(JSON.stringify(state)===JSON.stringify(this.current))return this.current;
    this.states.length=this.index+1;this.sizes.length=this.index+1;
    if(gesture&&gesture===this.gesture&&this.index>0){this.states[this.index]=state;this.sizes[this.index]=size;}else{this.states.push(state);this.sizes.push(size);this.index++;}
    this.gesture=gesture;while(this.states.length>IMAGE_HISTORY_LIMITS.steps+1||this.bytes>IMAGE_HISTORY_LIMITS.bytes){this.states.shift();this.sizes.shift();this.index--;}
    return state;
  }
  undo(){this.endGesture();if(this.canUndo)this.index--;return this.current;}
  redo(){this.endGesture();if(this.canRedo)this.index++;return this.current;}
  private measure(state:Readonly<ImageWorkingState>){const json=JSON.stringify(state);const bytes=Math.max(json.length*2,new TextEncoder().encode(json).byteLength)+512;if(bytes>IMAGE_HISTORY_LIMITS.bytes)throw new Error('IMAGE_HISTORY_LIMIT');return bytes;}
}
