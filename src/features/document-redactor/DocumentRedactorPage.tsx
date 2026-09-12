import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import { FileDropZone, PrimaryButton } from '../../components/ui';
import { OperationProgress } from '../../components/OperationProgress';
import { UtilityField, UtilityInput, UtilityNotice, UtilityPage, UtilitySectionCard, UtilitySelect } from '../../components/UtilitySurface';
import { Button } from '../../components/ui/button';
import { resources } from '../../i18n/resources';
import { useAppLanguage } from '../../i18n/routing';
import { useOperationProgress } from '../../hooks/useOperationProgress';
import { prepareRedactorClient, type RedactorClient } from './redactorClient';
import { safeError, type ErrorCode, type InputInfo, type MaskRect, type PreviewLease, type RedactorDpi, type ResultInfo } from './types';
import { MaskEditor } from './MaskEditor';
import { clampMask, commitMasks, countMasks, emptyMaskHistory, redoMasks, undoMasks, unmaskedPages, type MaskHistory, type MasksByPage } from './uiState';
import './documentRedactor.css';

type Copy = typeof resources.ko.features.documentRedactor;
interface UiResult { info: ResultInfo; url: string }
interface Failure { index:number; code:ErrorCode }

export function DocumentRedactorPage() {
  const language=useAppLanguage(); const c=(resources[language].features.documentRedactor as Copy);
  const [ready,setReady]=useState(false); const [fatal,setFatal]=useState(false); const [imageEnabled,setImageEnabled]=useState(false); const client=useRef<RedactorClient|undefined>(undefined);
  const mounted=useRef(true); const urls=useRef(new Set<string>()); const lease=useRef<PreviewLease|undefined>(undefined); const previewToken=useRef(0); const previewSettled=useRef<Promise<void>>(Promise.resolve());
  const [files,setFiles]=useState<File[]>([]); const [inputs,setInputs]=useState<InputInfo[]>([]); const [failures,setFailures]=useState<Failure[]>([]);
  const [histories,setHistories]=useState<Record<string,MaskHistory>>({}); const [fileId,setFileId]=useState(''); const [pageIndex,setPageIndex]=useState(0);
  const [selectedMask,setSelectedMask]=useState(-1); const [dpi,setDpi]=useState<RedactorDpi>(150); const [zoom,setZoom]=useState(100);
  const [results,setResults]=useState<Record<string,UiResult>>({}); const resultsRef=useRef(results); useEffect(()=>{resultsRef.current=results},[results]);
  const [resultMode,setResultMode]=useState(false); const [confirmed,setConfirmed]=useState(false); const [running,setRunning]=useState(false); const [selecting,setSelecting]=useState(false); const busy=running||selecting;
  const operation=useOperationProgress(); const [jobFailures,setJobFailures]=useState<Failure[]>([]); const [zipUrl,setZipUrl]=useState('');
  const [notice,setNotice]=useState(''); const canvasHost=useRef<HTMLDivElement>(null); const abort=useRef<AbortController|undefined>(undefined);
  const input=inputs.find(value=>value.id===fileId); const history=input ? histories[input.id] ?? emptyMaskHistory() : emptyMaskHistory();
  const masks=history.present[pageIndex] ?? []; const currentPage=input?.pages[pageIndex]; const currentResult=input ? results[input.id] : undefined;
  const revoke=useCallback((url:string)=>{if(url){URL.revokeObjectURL(url);urls.current.delete(url)}},[]);
  const revokeZip=useCallback(()=>{setZipUrl(old=>{revoke(old);return ''})},[revoke]);

  useEffect(() => {
    mounted.current = true;
    if (!document.querySelector('meta[name="worklazy-redactor-isolation"][content="document-scope"]')) { setFatal(true); return; }
    let keep = true;
    const preparing = new AbortController();
    const release = () => {
      keep = false; mounted.current = false; preparing.abort(); abort.current?.abort();
      document.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(input => { input.disabled = true; });
      previewToken.current++; lease.current?.release(); lease.current = undefined;
      urls.current.forEach(URL.revokeObjectURL); urls.current.clear();
      const value = client.current; client.current = undefined;
      if (value) { value.cancel(); void value.dispose(); }
    };
    const onPageHide = () => { document.documentElement.inert = true; setReady(false); release(); };
    window.addEventListener('pagehide', onPageHide);
    void prepareRedactorClient({signal: preparing.signal}).then(async value => {
      if (!keep) { await value.dispose(); return; }
      client.current = value; setImageEnabled(value.capabilities.image); setReady(true);
    }).catch(() => { if (keep) setFatal(true); });
    return () => { window.removeEventListener('pagehide', onPageHide); release(); };
  }, []);

  const releaseAllResults=useCallback(()=>{const value=client.current; Object.values(resultsRef.current).forEach(result=>{revoke(result.url);try{value?.releaseResult(result.info.id)}catch{}}); resultsRef.current={};setResults({});revokeZip();},[revoke,revokeZip]);
  const replaceInputs=useCallback(async(next:File[])=>{const value=client.current;if(!value||running||selecting)return;setSelecting(true);setNotice('');setJobFailures([]);try{
    const selection=await value.setInputs(next); if(!mounted.current)return; releaseAllResults(); const accepted=selection.inputs.map(info=>next[info.index]); setFiles(accepted);setInputs(selection.inputs);setFailures(selection.failures);
    setHistories(Object.fromEntries(selection.inputs.map(info=>[info.id,emptyMaskHistory()])));setFileId(selection.inputs[0]?.id??'');setPageIndex(0);setSelectedMask(-1);setConfirmed(false);setResultMode(false);
  }catch(error){if(mounted.current)setNotice(c.errors[safeError(error).code]);}finally{if(mounted.current)setSelecting(false)}},[c,releaseAllResults,running,selecting]);

  const commit=useCallback((next:MasksByPage)=>{if(!input)return;setHistories(old=>({...old,[input.id]:commitMasks(old[input.id]??emptyMaskHistory(),next)}));setConfirmed(false);},[input]);
  const setPageMasks=(next:MaskRect[])=>commit({...history.present,[pageIndex]:next});
  const updateSelected=(field:keyof MaskRect,value:number)=>{if(!currentPage||selectedMask<0)return;setPageMasks(masks.map((m,i)=>i===selectedMask?clampMask({...m,[field]:value/100},currentPage):m));};

  useEffect(()=>{const value=client.current;if(!ready||!value||!input||!currentPage||busy)return;const token=++previewToken.current;lease.current?.release();lease.current=undefined;canvasHost.current?.replaceChildren();let active=true;
    value.cancel(); const run=async()=>{await previewSettled.current.catch(()=>undefined);if(!active||token!==previewToken.current)return;try{const next=resultMode&&currentResult?await value.renderResultPreview(currentResult.info.id,pageIndex,dpi):await value.renderPreview(input.id,pageIndex,dpi);
      if(!active||token!==previewToken.current){next.release();return}lease.current=next;next.canvas.className='redactor-preview-canvas';canvasHost.current?.replaceChildren(next.canvas);
    }catch(error){if(active&&safeError(error).code!=='cancelled')setNotice(c.errors[safeError(error).code]);}}; const task=run();previewSettled.current=task;return()=>{active=false;if(token===previewToken.current){lease.current?.release();lease.current=undefined;canvasHost.current?.replaceChildren();}};
  },[ready,input?.id,pageIndex,dpi,resultMode,currentResult?.info.id,busy]);

  const runExport=async()=>{const value=client.current;if(!value||busy||!confirmed)return;setRunning(true);setNotice('');setJobFailures([]);operation.start(c.progress.file.replace('{{current}}','1').replace('{{total}}',String(inputs.length)));++previewToken.current;lease.current?.release();lease.current=undefined;value.cancel();await previewSettled.current.catch(()=>undefined);if(!mounted.current)return;const controller=new AbortController();abort.current=controller;let cancelled=false;
    for(let i=0;i<inputs.length;i++){const info=inputs[i];const masksByPage=histories[info.id]?.present??{};if(countMasks(masksByPage)===0){setJobFailures(old=>[...old,{index:i,code:'no-masks'}]);continue}
      try{operation.update(Math.max(1,Math.floor(i/inputs.length*95)),c.progress.file.replace('{{current}}',String(i+1)).replace('{{total}}',String(inputs.length)),`file-${i}`);const result=await value.processFile(info.id,{dpi,masksByPage},{signal:controller.signal,onProgress:p=>mounted.current&&operation.update(Math.min(99,Math.floor((i+(p.page+1)/Math.max(1,p.pages))/inputs.length*95)),c.progress[p.phase].replace('{{page}}',String(p.page+1)).replace('{{pages}}',String(p.pages)),`file-${i}-${p.phase}`)});
        if(!mounted.current)return;revokeZip();const url=URL.createObjectURL(result.blob);urls.current.add(url);setResults(old=>{const previous=old[info.id];if(previous)revoke(previous.url);const next={...old,[info.id]:{info:result,url}};resultsRef.current=next;return next});
      }catch(error){if(!mounted.current)return;const code=safeError(error).code;if(code==='cancelled'){cancelled=true;break}setJobFailures(old=>[...old,{index:i,code}]);if(code==='limit')break;}
    }if(!mounted.current)return;setRunning(false);abort.current=undefined;if(cancelled)operation.fail(c.errors.cancelled);else operation.succeed(c.progress.done);setConfirmed(false);};

  const createZip=async()=>{const value=client.current;if(!value||busy)return;setRunning(true);operation.start(c.progress.zip.replace('{{page}}','1').replace('{{pages}}',String(Object.keys(results).length)));++previewToken.current;lease.current?.release();lease.current=undefined;value.cancel();await previewSettled.current.catch(()=>undefined);if(!mounted.current)return;try{const blob=await value.createZip({onProgress:p=>mounted.current&&operation.update(Math.min(99,Math.floor((p.page+1)/Math.max(1,p.pages)*95)),c.progress[p.phase].replace('{{page}}',String(p.page+1)).replace('{{pages}}',String(p.pages)))});if(!mounted.current)return;const url=URL.createObjectURL(blob);urls.current.add(url);setZipUrl(old=>{revoke(old);return url});operation.succeed(c.progress.done);}catch(error){if(!mounted.current)return;const message=c.errors[safeError(error).code];setNotice(message);operation.fail(message);}finally{if(mounted.current)setRunning(false)}};
  const rename=(item:UiResult,name:string)=>{try{const info=client.current!.renameResult(item.info.id,name);setResults(old=>({...old,[info.fileId]:{...old[info.fileId],info}}));revokeZip();return true;}catch(error){setNotice(c.errors[safeError(error).code]);return false;}};
  const totalUnmasked=inputs.flatMap((value,i)=>unmaskedPages(histories[value.id]?.present??{},value.pages.length).map(page=>c.summary.page.replace('{{document}}',String(i+1)).replace('{{page}}',String(page+1))));

  if(fatal)return <UtilityPage toolId="document-redactor"><UtilityNotice tone="error" role="alert">{c.errors['not-ready']}</UtilityNotice></UtilityPage>;
  return <UtilityPage toolId="document-redactor"><header className="mb-5"><h1 className="text-2xl font-extrabold">{c.title}</h1><p className="mt-2 text-muted-foreground">{c.description}</p></header>
    <UtilitySectionCard title={c.files.title} description={c.files.description}>{ready?<div className="redactor-file-picker"><FileDropZone label={c.files.label} hint={imageEnabled?c.files.hint:c.files.pdfHint} accept={imageEnabled?'application/pdf,image/jpeg,image/png,image/webp':'application/pdf'} multiple files={files} onFiles={replaceInputs} disabled={busy}/></div>:<p role="status">{c.preparing}</p>}<UtilityNotice>{c.files.limits}</UtilityNotice>{ready&&!imageEnabled&&<UtilityNotice tone="warning">{c.files.imageUnavailable}</UtilityNotice>}
      {failures.length>0&&<UtilityNotice className="text-red-800 dark:text-red-300" tone="error"><ul>{failures.map((f,i)=><li key={i}>{c.document.replace('{{number}}',String(f.index+1))}: {c.errors[f.code]}</li>)}</ul></UtilityNotice>}
      {inputs.length>0&&<ol className="redactor-document-list">{inputs.map((value,i)=><li key={value.id}><button type="button" disabled={busy} aria-current={value.id===fileId?'true':undefined} onClick={()=>{setFileId(value.id);setPageIndex(0);setResultMode(false)}}>{c.document.replace('{{number}}',String(i+1))} · {value.pages.length} {c.pages}</button><Button type="button" variant="ghost" disabled={busy} aria-label={`${c.remove} ${i+1}`} onClick={()=>void replaceInputs(files.filter((_,n)=>n!==i))}><Trash2 size={16}/></Button></li>)}</ol>}
    </UtilitySectionCard>
    {input&&currentPage&&<><UtilitySectionCard title={c.editor.title} description={c.editor.description}>
      <div className="redactor-toolbar"><Button type="button" variant="secondary" disabled={pageIndex===0||busy} onClick={()=>setPageIndex(p=>p-1)}>{c.editor.previous}</Button><span data-testid="redactor-page-counter">{pageIndex+1} / {input.pages.length}</span><Button type="button" variant="secondary" disabled={pageIndex+1===input.pages.length||busy} onClick={()=>setPageIndex(p=>p+1)}>{c.editor.next}</Button>
        <UtilitySelect disabled={busy} aria-label={c.editor.zoom} value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value="50">50%</option><option value="100">100%</option><option value="150">150%</option><option value="200">200%</option></UtilitySelect>
        {currentResult&&<Button disabled={busy} type="button" variant="secondary" onClick={()=>setResultMode(v=>!v)}><Eye size={16}/>{resultMode?c.editor.source:c.editor.result}</Button>}</div>
      <div className="redactor-preview-scroll" role="region" aria-label={c.editor.canvas} tabIndex={0}><div className="redactor-preview" style={{width:`${zoom}%`,aspectRatio:`${currentPage.width}/${currentPage.height}`}}><div ref={canvasHost}/>{!resultMode&&<MaskEditor page={currentPage} masks={masks} selected={selectedMask} onSelect={setSelectedMask} onCommit={setPageMasks} disabled={busy} labels={c.editor}/>}</div></div>
      {!resultMode&&<><div className="redactor-toolbar"><Button type="button" onClick={()=>{const next=clampMask({x:.375,y:.45,w:.25,h:.1},currentPage);setPageMasks([...masks,next]);setSelectedMask(masks.length)}} disabled={busy}><Plus size={16}/>{c.editor.add}</Button><Button type="button" variant="secondary" disabled={!history.past.length||busy} onClick={()=>{setHistories(old=>({...old,[input.id]:undoMasks(history)}));setConfirmed(false)}}><Undo2 size={16}/>{c.editor.undo}</Button><Button type="button" variant="secondary" disabled={!history.future.length||busy} onClick={()=>{setHistories(old=>({...old,[input.id]:redoMasks(history)}));setConfirmed(false)}}><Redo2 size={16}/>{c.editor.redo}</Button><Button type="button" variant="secondary" disabled={selectedMask<0||busy} onClick={()=>setPageMasks(masks.filter((_,i)=>i!==selectedMask))}><Trash2 size={16}/>{c.remove}</Button></div>
      {selectedMask>=0&&masks[selectedMask]&&<div className="redactor-number-grid">{(['x','y','w','h'] as const).map(field=><UtilityField key={field}>{c.editor[field]} (%)<UtilityInput disabled={busy} type="number" min={(field==='w'||field==='h') ? .01 : 0} max="100" step="0.1" value={Number((masks[selectedMask][field]*100).toFixed(3))} onChange={e=>updateSelected(field,Number(e.target.value))}/></UtilityField>)}</div>}</>}
    </UtilitySectionCard><UtilitySectionCard title={c.output.title} description={c.output.description}><UtilityField>{c.output.dpi}<UtilitySelect disabled={busy} value={dpi} onChange={e=>{setDpi(Number(e.target.value) as RedactorDpi);setConfirmed(false)}}><option value="150">150 DPI</option><option value="200">200 DPI</option><option value="300">300 DPI</option></UtilitySelect></UtilityField><UtilityNotice>{c.output.dpiNotice}</UtilityNotice>
      <div><strong>{c.summary.title}</strong>{totalUnmasked.length?<ul>{totalUnmasked.map(value=><li key={value}>{value}</li>)}</ul>:<p>{c.summary.allMasked}</p>}</div>
      <label className="redactor-confirm"><input data-testid="redactor-confirm" type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy}/>{c.output.confirm}</label><div data-testid="redactor-run"><PrimaryButton accent="violet" disabled={selecting||!inputs.length||inputs.some(value=>countMasks(histories[value.id]?.present??{})===0)||!confirmed} loading={running} onClick={()=>void runExport()}>{c.output.run}</PrimaryButton></div>{running&&<Button className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950/70 dark:text-red-300 dark:hover:bg-red-950" data-testid="redactor-cancel" type="button" variant="destructive" onClick={()=>{abort.current?.abort();client.current?.cancel()}}>{c.output.cancel}</Button>}<OperationProgress {...operation} accent="violet" title={c.progress.title}/>
    </UtilitySectionCard></>}
    {(Object.keys(results).length>0||jobFailures.length>0)&&<UtilitySectionCard title={c.results.title}><ul className="redactor-results">{inputs.map((value,i)=>results[value.id]&&<li key={value.id}><span>{c.document.replace('{{number}}',String(i+1))}</span><UtilityInput disabled={busy} key={results[value.id].info.name} aria-label={c.results.name} defaultValue={results[value.id].info.name} onBlur={e=>{if(!rename(results[value.id],e.target.value))e.target.value=results[value.id].info.name}}/><a className="redactor-download" href={results[value.id].url} download={results[value.id].info.name}><Download size={16}/>{c.results.download}</a><Button disabled={busy} type="button" variant="secondary" onClick={()=>{setFileId(value.id);setPageIndex(0);setResultMode(true)}}>{c.results.preview}</Button></li>)}</ul>{jobFailures.length>0&&<UtilityNotice tone="error"><ul>{jobFailures.map((f,i)=><li key={i}>{c.document.replace('{{number}}',String(f.index+1))}: {c.errors[f.code]}</li>)}</ul></UtilityNotice>}{Object.keys(results).length>=2&&<><Button type="button" onClick={()=>void createZip()} disabled={busy}>{c.results.zip}</Button>{zipUrl&&<a className="redactor-download" href={zipUrl} download="redacted-results.zip"><Download size={16}/>{c.results.downloadZip}</a>}</>}</UtilitySectionCard>}
    {notice&&<UtilityNotice tone="error" role="alert">{notice}</UtilityNotice>}</UtilityPage>;
}
