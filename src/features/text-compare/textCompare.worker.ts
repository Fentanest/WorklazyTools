/// <reference lib="webworker" />
import { compareTexts } from "./core.ts";
import type { TextOptions } from "./resultTypes.ts";
self.onmessage=(event:MessageEvent<{left:string;right:string;options:TextOptions;revision:number}>)=>{
  try {
    const {left,right,options,revision}=event.data;
    if(typeof left!=="string"||typeof right!=="string"||!Array.isArray(options?.ignoreRules)||!Number.isInteger(revision))throw new Error("TEXT_REQUEST_INVALID");
    self.postMessage({type:"result",result:compareTexts(left,right,options,revision)});
  } catch(error){self.postMessage({type:"error",code:error instanceof Error?error.message:"TEXT_COMPARE_FAILED"});}
};
