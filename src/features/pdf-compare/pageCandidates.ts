import type { PageMapping } from "./types.ts";

export const PAGE_HASH_SIZE=128;
export const PAGE_HASH_BITS=1024;
export const PAGE_CANDIDATE_POLICY=Object.freeze({maxDistance:128,ambiguityGap:24,maxPages:200,maxFileBytes:32*1024*1024});
export interface PageCandidate {before:number;after:number;distance:number}
export interface PageCandidateResult {matches:PageCandidate[];unmatchedBefore:number[];unmatchedAfter:number[];mapping:PageMapping[]}
/** Await the actual read even when canceled so the next owner cannot overlap it. */
export async function readCandidateBytes(file:Pick<File,'size'|'arrayBuffer'>,signal:AbortSignal){
  signal.throwIfAborted();if(!Number.isSafeInteger(file.size)||file.size<0||file.size>PAGE_CANDIDATE_POLICY.maxFileBytes)throw new Error("PAGE_CANDIDATE_LIMIT");
  const bytes=await file.arrayBuffer();
  if(signal.aborted||bytes.byteLength>PAGE_CANDIDATE_POLICY.maxFileBytes){structuredClone(undefined,{transfer:[bytes]});signal.throwIfAborted();throw new Error("PAGE_CANDIDATE_LIMIT");}
  return bytes;
}
const cosine=Float64Array.from({length:32*128},(_,i)=>Math.cos((2*(i%128)+1)*Math.floor(i/128)*Math.PI/256));
const bits=Uint8Array.from({length:256},(_,n)=>{let count=0;for(;n;n&=n-1)count++;return count;});

/** Low-frequency DCT/median fingerprint adapted from extracted module77207.
 * Only the32×32 coefficients consumed by that implementation are computed.
 * Unlike its selector, missing/blank/weak/ambiguous candidates are not matched.
 */
export function pageFingerprint(rgba:Uint8ClampedArray):Uint8Array|null {
  if(rgba.length!==128*128*4)throw new Error("PAGE_HASH_INPUT");
  const gray=new Float64Array(128*128);let sum=0,squared=0;
  for(let i=0;i<gray.length;i++){if(rgba[i*4+3]!==255)return null;const value=.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2];gray[i]=value;sum+=value;squared+=value*value;}
  if(squared/gray.length-(sum/gray.length)**2<16)return null;
  const horizontal=new Float64Array(128*32),coefficients=new Float64Array(32*32);
  for(let row=0;row<128;row++)for(let u=0;u<32;u++){let value=0;for(let x=0;x<128;x++)value+=gray[row*128+x]*cosine[u*128+x];horizontal[row*32+u]=value;}
  for(let v=0;v<32;v++)for(let u=0;u<32;u++){let value=0;for(let y=0;y<128;y++)value+=horizontal[y*32+u]*cosine[v*128+y];coefficients[v*32+u]=value;}
  const sorted=Array.from(coefficients.subarray(1)).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)],hash=new Uint8Array(128);
  for(let i=1;i<coefficients.length;i++)if(coefficients[i]>median)hash[i>>3]|=1<<(i&7);
  return hash;
}
export function pageHashDistance(a:Uint8Array,b:Uint8Array){
  if(a.length!==128||b.length!==128)throw new Error("PAGE_HASH_INPUT");
  let distance=0;for(let i=0;i<128;i++)distance+=bits[a[i]^b[i]];return distance;
}
export function selectPageCandidates(before:readonly (Uint8Array|null)[],after:readonly (Uint8Array|null)[]):PageCandidateResult {
  if(before.length>PAGE_CANDIDATE_POLICY.maxPages||after.length>PAGE_CANDIDATE_POLICY.maxPages)throw new Error("PAGE_CANDIDATE_LIMIT");
  const left=before.map(()=>[] as {index:number;distance:number}[]),right=after.map(()=>[] as {index:number;distance:number}[]);
  for(let a=0;a<before.length;a++)for(let b=0;b<after.length;b++)if(before[a]&&after[b]){
    const distance=pageHashDistance(before[a]!,after[b]!);left[a].push({index:b,distance});right[b].push({index:a,distance});
  }
  for(const list of [...left,...right])list.sort((a,b)=>a.distance-b.distance||a.index-b.index);
  const clear=(list:{index:number;distance:number}[])=>list.length>0&&list[0].distance<=PAGE_CANDIDATE_POLICY.maxDistance&&(list.length===1||list[1].distance-list[0].distance>=PAGE_CANDIDATE_POLICY.ambiguityGap);
  const matches:PageCandidate[]=[];
  left.forEach((list,index)=>{if(clear(list)&&clear(right[list[0].index])&&right[list[0].index][0].index===index)matches.push({before:index,after:list[0].index,distance:list[0].distance});});
  const usedLeft=new Set(matches.map(m=>m.before)),usedRight=new Set(matches.map(m=>m.after));
  const unmatchedBefore=before.flatMap((_,i)=>usedLeft.has(i)?[]:[i]),unmatchedAfter=after.flatMap((_,i)=>usedRight.has(i)?[]:[i]);
  const byBefore=new Map(matches.map(m=>[m.before,m.after]));
  const mapping:PageMapping[]=before.map((_,i)=>({before:i,after:byBefore.get(i)??null}));
  mapping.push(...unmatchedAfter.map(i=>({before:null,after:i})));
  return {matches,unmatchedBefore,unmatchedAfter,mapping};
}
