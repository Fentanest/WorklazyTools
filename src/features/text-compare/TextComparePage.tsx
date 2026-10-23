import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { PageHeader } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";
import { UtilityField, UtilityInput, UtilityNotice, UtilityPage, UtilitySectionCard, UtilitySelect, UtilityTextarea } from "../../components/UtilitySurface";
import { runModuleWorker } from "../../utils/workerLifecycle.ts";
import { encodeText, readText, type TextEncoding } from "./input.ts";
import { DEFAULT_TEXT_OPTIONS, type TextOptions, type TextResult } from "./resultTypes.ts";
import { TextHistory, mergeRow, type TextSnapshot } from "./session.ts";
import { transformText, type TextTransform } from "./transforms.ts";
import { TextDiffView } from "./TextDiffView";
import { applyEditorChange, preferredLineEnding, rawEditorOffset } from "./editor.ts";
import type { TextDisplayStyle } from "./viewProjection.ts";

export function TextComparePage() {
  const {t}=useTranslation(["features","common"]);const tr=useCallback((key:string,values?:Record<string,unknown>)=>t(`features:textCompare.${key}` as never,values??{}),[t]);
  const [state,setState]=useState<TextSnapshot>({left:"",right:"",options:structuredClone(DEFAULT_TEXT_OPTIONS),revision:0});
  const current=useRef(state);current.current=state;
  const sources=state.sources??{};
  const [inputEncoding,setInputEncoding]=useState<TextEncoding|"auto">("auto"),[focusId,setFocusId]=useState<string>(),[focusRequest,setFocusRequest]=useState(0),[display,setDisplay]=useState<TextDisplayStyle>({palette:"standard",bold:false,underline:true,syntax:"plain"});
  const [encoding,setEncoding]=useState<TextEncoding|"original">("original"),[bom,setBom]=useState(false),[result,setResult]=useState<TextResult>(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [live,setLive]=useState(false),[composing,setComposing]=useState(false),[unified,setUnified]=useState(false),[wrap,setWrap]=useState(true),[fold,setFold]=useState(true),[search,setSearch]=useState(""),[rules,setRules]=useState("");
  const [action,setAction]=useState<TextTransform>("trim"),[target,setTarget]=useState<"left"|"right"|"both">("both");
  const history=useRef(new TextHistory()),abort=useRef<AbortController|undefined>(undefined),generation=useRef(0),reads=useRef({left:0,right:0});
  const editors=useRef<Partial<Record<"left"|"right",HTMLTextAreaElement|null>>>({});
  const cancel=useCallback(()=>{generation.current++;abort.current?.abort();setBusy(false);},[]);
  const change=(update:Partial<TextSnapshot>,record=true)=>{cancel();if("left" in update)reads.current.left++;if("right" in update)reads.current.right++;if(record)history.current.record(current.current);const next={...current.current,...update,revision:current.current.revision+1};current.current=next;setState(next);};
  useEffect(()=>()=>{generation.current++;abort.current?.abort();reads.current.left++;reads.current.right++;},[]);
  const compare=useCallback(async()=>{
    const snapshot=current.current;abort.current?.abort();const control=new AbortController();abort.current=control;const run=++generation.current;setBusy(true);setError("");
    try {
      const compared=await runModuleWorker<typeof snapshot,TextResult>(()=>new Worker(new URL("./textCompare.worker.ts",import.meta.url),{type:"module"}),{left:snapshot.left,right:snapshot.right,options:snapshot.options,revision:snapshot.revision},{signal:control.signal,hardTimeoutMs:10000,canceledMessage:tr("canceled"),startErrorMessage:tr("error"),resultErrorMessage:tr("error"),timeoutMessage:tr("timeout"),validateResult:(value:unknown):value is TextResult=>!!value&&typeof value==="object"&&Array.isArray((value as TextResult).rows)&&(value as TextResult).revision===snapshot.revision});
      if(run===generation.current&&snapshot.revision===current.current.revision)setResult(compared);
    }catch(reason){if(run===generation.current&&!(reason instanceof DOMException&&reason.name==="AbortError")){const code=(reason as {code?:string}).code;setError(tr(code==="TEXT_TIMEOUT"||code==="WORKER_DEADLINE"?"timeout":code==="TEXT_LINE_LIMIT"?"lineLimit":code==="TEXT_TOO_LARGE"?"tooLarge":code==="GRAPHEME_UNAVAILABLE"?"graphemeUnavailable":code?.startsWith("IGNORE_")?"rulesError":"error"));}}
    finally{if(run===generation.current)setBusy(false);}
  },[tr]);
  useEffect(()=>{if(!live||composing)return;const timer=setTimeout(()=>void compare(),250);return()=>clearTimeout(timer);},[state.revision,live,composing,compare]);
  const load=async(side:"left"|"right",file?:File)=>{if(!file)return;const version=++reads.current[side];try{const source=await readText(file,inputEncoding==="auto"?undefined:inputEncoding);if(version!==reads.current[side])return;change({[side]:source.text,sources:{...current.current.sources,[side]:source}});setError("");}catch(reason){if(version===reads.current[side])setError(tr(reason instanceof Error&&reason.message==="TEXT_TOO_LARGE"?"tooLarge":"encodingError"));}};
  const download=(side:"left"|"right")=>{const bytes=encodeText(state[side],encoding==="original"?(sources[side]?.encoding??"utf-8"):encoding,encoding==="original"?(sources[side]?.bom??false):bom);const url=URL.createObjectURL(new Blob([Uint8Array.from(bytes)],{type:"text/plain"}));const a=document.createElement("a");a.href=url;a.download=`comparison-${side}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const navigate=(direction:number)=>{if(!result)return;const changes=result.rows.filter(row=>!["equal","ignored"].includes(row.kind));if(!changes.length)return;const index=changes.findIndex(row=>row.id===focusId);setSearch("");setFocusId(changes[index<0?(direction>0?0:changes.length-1):(index+direction+changes.length)%changes.length].id);setFocusRequest(value=>value+1);};
  const setOption=(key:keyof TextOptions,value:unknown)=>change({options:{...state.options,[key]:value}});
  const transform=()=>{const update:Partial<TextSnapshot>={};for(const side of target==="both"?["left","right"] as const:[target]){const editor=editors.current[side],selected=editor&&editor.selectionStart!==editor.selectionEnd;update[side]=transformText(state[side],action,selected?rawEditorOffset(state[side],editor.selectionStart):0,selected?rawEditorOffset(state[side],editor.selectionEnd):state[side].length);}change(update);};
  const travel=(direction:"undo"|"redo")=>{const next=history.current[direction](state);if(next){setRules(next.options.ignoreRules.join("\n"));change(next,false);}};
  return <UtilityPage toolId="text-compare">
    <PageHeader eyebrow={tr("eyebrow")} title={tr("title")} description={tr("description")}><PrivacyBanner compact/></PageHeader>
    {error&&<UtilityNotice kind="error" role="alert">{error}</UtilityNotice>}
    <UtilityField className="mb-3 max-w-xs">{tr("inputEncoding")}<UtilitySelect value={inputEncoding} onChange={e=>setInputEncoding(e.target.value as typeof inputEncoding)}><option value="auto">{tr("autoEncoding")}</option>{["utf-8","utf-16le","utf-16be"].map(value=><option key={value}>{value}</option>)}</UtilitySelect></UtilityField>
    <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
      {(["left","right"] as const).map(side=><UtilitySectionCard key={side} title={tr(side)} description={sources[side]?.name??tr("pasteHint")}>
        <Button variant="secondary" onClick={()=>document.getElementById(`text-file-${side}`)?.click()}>{tr("openFile")}</Button><input hidden id={`text-file-${side}`} type="file" accept="text/*,.txt,.csv,.json,.xml,.md,.js,.ts,.css,.html,.log" aria-label={tr(`${side}File`)} onChange={event=>void load(side,event.target.files?.[0])}/>
        <UtilityTextarea className="mt-3 min-h-60" value={state[side]} aria-label={tr(side)} data-testid={`text-compare-${side}`} onFocus={event=>{editors.current[side]=event.currentTarget;}} onChange={event=>{reads.current[side]++;change({[side]:applyEditorChange(state[side],event.target.value,preferredLineEnding(sources[side]?.text??state[side]))});}} onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)}/>
        <Button variant="ghost" disabled={!sources[side]} onClick={()=>{reads.current[side]++;change({[side]:sources[side]?.text??""});}}>{tr("restore")}</Button>
        <Button variant="secondary" onClick={()=>download(side)}>{tr("download")}</Button>
      </UtilitySectionCard>)}
    </div>
    <UtilitySectionCard title={tr("options")}>
      <div className="flex flex-wrap items-end gap-3"><UtilityField>{tr("mode")}<UtilitySelect data-testid="text-compare-mode" value={state.options.mode} onChange={e=>setOption("mode",e.target.value)}>{["smart","word","character"].map(mode=><option key={mode} value={mode}>{tr(`modes.${mode}`)}</option>)}</UtilitySelect></UtilityField>
        {(["ignoreCase","ignoreWhitespace","ignoreQuotes","ignoreDashes","normalizeLineEndings"] as const).map(key=><label key={key} className="flex gap-2 py-2 text-sm"><input type="checkbox" checked={state.options[key]} onChange={e=>setOption(key,e.target.checked)}/>{tr(key)}</label>)}
      </div>
      <UtilityField className="mt-3">{tr("ignoreRules")}<UtilityTextarea className="min-h-24" value={rules} onChange={event=>{const value=event.target.value;setRules(value);setOption("ignoreRules",value.split("\n").filter(Boolean));}} aria-label={tr("ignoreRules")}/></UtilityField><p className="text-xs text-muted-foreground">{tr("ignoreHint")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2"><Button data-testid="text-compare-run" onClick={()=>void compare()} disabled={busy}>{tr("compare")}</Button><Button variant="secondary" onClick={cancel} disabled={!busy}>{tr("cancel")}</Button><label className="flex gap-2"><input type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)}/>{tr("live")}</label><Button variant="outline" onClick={()=>{reads.current.left++;reads.current.right++;change({left:state.right,right:state.left,sources:{left:sources.right,right:sources.left}});}}>{tr("swap")}</Button><Button variant="outline" disabled={!history.current.canUndo} onClick={()=>travel("undo")}>{tr("undo")}</Button><Button variant="outline" disabled={!history.current.canRedo} onClick={()=>travel("redo")}>{tr("redo")}</Button></div>
      <p className="mt-2 text-xs text-muted-foreground">{tr("historyHelp")}</p><details className="mt-4"><summary className="cursor-pointer">{tr("transforms")}</summary><div className="mt-2 flex flex-wrap items-end gap-3"><UtilityField>{tr("target")}<UtilitySelect value={target} onChange={e=>setTarget(e.target.value as typeof target)}>{["left","right","both"].map(side=><option key={side} value={side}>{tr(side)}</option>)}</UtilitySelect></UtilityField><UtilityField>{tr("transform")}<UtilitySelect value={action} onChange={e=>setAction(e.target.value as TextTransform)}>{["lowercase","sort","trim","removeEmpty","lineSpaces"].map(item=><option key={item} value={item}>{tr(`actions.${item}`)}</option>)}</UtilitySelect></UtilityField><Button variant="secondary" onClick={transform}>{tr("apply")}</Button></div><p className="text-xs text-muted-foreground">{tr("transformHint")}</p></details>
      <div className="mt-4 flex flex-wrap items-center gap-3"><UtilityField>{tr("encoding")}<UtilitySelect value={encoding} onChange={e=>setEncoding(e.target.value as typeof encoding)}><option value="original">{tr("originalEncoding")}</option>{["utf-8","utf-16le","utf-16be"].map(value=><option key={value}>{value}</option>)}</UtilitySelect></UtilityField>{encoding!=="original"&&<label className="flex gap-2"><input type="checkbox" checked={bom} onChange={e=>setBom(e.target.checked)}/>{tr("bom")}</label>}</div>
    </UtilitySectionCard>
    {busy&&<UtilityNotice kind="progress" role="status">{tr("comparing")}</UtilityNotice>}
    {result&&<UtilitySectionCard title={tr("result")}>
      <p aria-live="polite" data-testid="text-compare-summary">{tr("summary",result.counts)}</p>
      {result.revision!==state.revision&&<UtilityNotice kind="warning">{tr("stale")}</UtilityNotice>}
      {result.quality!=="full"&&<UtilityNotice kind="warning">{tr("coarse")}</UtilityNotice>}
      <div className="mb-3 flex flex-wrap gap-3">{[["unified",unified,setUnified],["wrap",wrap,setWrap],["fold",fold,setFold]].map(([key,value,setter])=><label key={key as string} className="flex items-center gap-2"><input type="checkbox" checked={value as boolean} onChange={e=>(setter as (value:boolean)=>void)(e.target.checked)}/>{tr(key as string)}</label>)}<UtilityInput className="max-w-xs" value={search} onChange={e=>setSearch(e.target.value)} aria-label={tr("search")} placeholder={tr("search")}/></div>
      <div className="mb-3 flex flex-wrap items-center gap-2"><Button variant="outline" onClick={()=>navigate(-1)}>{tr("previousChange")}</Button><Button variant="outline" onClick={()=>navigate(1)}>{tr("nextChange")}</Button><UtilitySelect className="max-w-[220px]" aria-label={tr("palette")} value={display.palette} onChange={e=>setDisplay({...display,palette:e.target.value as TextDisplayStyle["palette"]})}><option value="standard">{tr("standardColors")}</option><option value="contrast">{tr("contrastColors")}</option></UtilitySelect><label className="flex gap-2"><input type="checkbox" checked={display.bold} onChange={e=>setDisplay({...display,bold:e.target.checked})}/>{tr("bold")}</label><label className="flex gap-2"><input type="checkbox" checked={display.underline} onChange={e=>setDisplay({...display,underline:e.target.checked})}/>{tr("underline")}</label><UtilitySelect className="max-w-[220px]" aria-label={tr("syntax")} value={display.syntax} onChange={e=>setDisplay({...display,syntax:e.target.value as TextDisplayStyle["syntax"]})}><option value="plain">{tr("plain")}</option><option value="json">JSON</option><option value="javascript">JavaScript</option></UtilitySelect></div>
      <TextDiffView focusRequest={focusRequest} focusId={focusId} display={display} result={result} unified={unified} wrap={wrap} fold={fold} search={search} stale={result.revision!==state.revision} t={tr} onMerge={(id,side)=>{try{change(mergeRow(state,result,id,side));void compare();}catch{setError(tr("stale"));}}}/>
    </UtilitySectionCard>}
    <ToolGuideWrapper slug="textCompare"/>
  </UtilityPage>;
}
