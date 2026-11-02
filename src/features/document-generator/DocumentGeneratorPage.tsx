import { acceptsFile } from "../../app/fileAccepts";
import { useHandoffReceiver } from "../../app/useHandoffReceiver";
import { setUnsavedWork, useUnsavedWorkGuard } from "../../app/toolState";
import type { DeliveryResult, IntakeContext } from "../../app/memoryHandoff";
import { Download, FileText, Package, Play, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OperationProgress } from '../../components/OperationProgress';
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";
import { FileDropZone, PageHeader, PrimaryButton, formatBytes } from '../../components/ui';
import { Button } from '../../components/ui/button';
import { UtilityField, UtilityInput, UtilityNotice, UtilityPage, UtilitySectionCard, UtilitySelect } from '../../components/UtilitySurface';
import { useOperationProgress } from '../../hooks/useOperationProgress';
import { createDocumentGeneratorClient } from './client';
import { GeneratorError, generatorMessage } from './errors';
import type { GeneratorDownload, GeneratorPlan, GeneratorSelection, GeneratorSnapshot, GeneratorSource } from './types';

const DATA_ACCEPT = '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';
const DOCX_ACCEPT = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
type SelectionDraft = { sheetName: string; headerRow: number; aliases: Record<number, string> };
type LooseT = (key: string, options?: Record<string, unknown>) => string;

export function DocumentGeneratorPage() {
  const { t: ht } = useTranslation("common");
  const intakeRoot = useRef<HTMLDivElement>(null);
  const intakeGeneration = useRef(0);
  const intakeMount = useRef(0);
  useEffect(() => { const mount = ++intakeMount.current; return () => { queueMicrotask(() => { if (mount === intakeMount.current) intakeGeneration.current++; }); }; }, []);
  const { t, i18n } = useTranslation(['features', 'common']);
  const tr = t as unknown as LooseT;
  const language = i18n.language.startsWith('en') ? 'en' : 'ko';
  const clientRef = useRef<ReturnType<typeof createDocumentGeneratorClient> | null>(null);
  if (!clientRef.current) clientRef.current = createDocumentGeneratorClient();
  const client = clientRef.current;
  const pendingHandoff = useRef<{ client: typeof client; signal: AbortSignal } | null>(null);
  const clientMount = useRef(0);
  const [snapshot, setSnapshot] = useState<GeneratorSnapshot>(() => client.snapshot());
  const [dataFiles, setDataFiles] = useState<File[]>([]);
  const [templateFile, setTemplateFile] = useState<File>();
  const [templateVariables, setTemplateVariables] = useState<readonly string[]>([]);
  const [sources, setSources] = useState<GeneratorSource[]>([]);
  const [sourceFailures, setSourceFailures] = useState<Array<{ index: number; code: string }>>([]);
  const [drafts, setDrafts] = useState<Record<string, SelectionDraft>>({});
  const [namePattern, setNamePattern] = useState('document-{file}-{row}.docx');
  const [plan, setPlan] = useState<GeneratorPlan>();
  const [sampleRow, setSampleRow] = useState('');
  const [sample, setSample] = useState<GeneratorDownload>();
  const [zip, setZip] = useState<GeneratorDownload>();
  const [zipAttemptId, setZipAttemptId] = useState<number>();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const operation = useOperationProgress();

  const releaseDownload = useCallback((value?: GeneratorDownload) => value?.release(), []);
  useEffect(() => client.subscribe(setSnapshot), [client]);
  useEffect(() => () => { releaseDownload(sample); }, [releaseDownload, sample]);
  useEffect(() => () => { releaseDownload(zip); }, [releaseDownload, zip]);
  useEffect(() => {
    const mount = ++clientMount.current;
    return () => { queueMicrotask(() => { if (clientMount.current === mount) void client.dispose(); }); };
  }, [client]);
  useEffect(() => { if (snapshot.results.length) void client.acknowledgeResults(snapshot.version); }, [client, snapshot.results.length, snapshot.version]);
  useEffect(() => {
    if (!zip || zipAttemptId === snapshot.resultAttemptId) return;
    releaseDownload(zip); setZip(undefined); setZipAttemptId(undefined);
  }, [releaseDownload, snapshot.resultAttemptId, zip, zipAttemptId]);
  useEffect(() => {
    if (operation.status !== 'running' || !snapshot.attempt?.rows.length) return;
    const done = snapshot.attempt.rows.filter(row => row.status !== 'not-started').length;
    operation.update(Math.max(1, Math.round(done / snapshot.attempt.rows.length * 99)), tr('features:documentGenerator.progress.rows', {done, total:snapshot.attempt.rows.length}));
  }, [operation.status, operation.update, snapshot.attempt, tr]);

  const busy = pending || snapshot.state !== 'idle';
  const errorText = (error: unknown) => generatorMessage(error instanceof GeneratorError ? error.code : 'GENERATION_FAILED', language);
  const clearPrepared = () => { setPlan(undefined); setSampleRow(''); releaseDownload(sample); setSample(undefined); };

  const columnsFor = useCallback((source: GeneratorSource, draft: SelectionDraft) => {
    const sheet = source.book.sheets.find(item => item.name === draft.sheetName);
    if (!sheet) return [];
    const cells = new Map(sheet.cells.filter(cell => cell.row === draft.headerRow).map(cell => [cell.column, cell]));
    return Array.from({length: sheet.columnCount}, (_, index) => {
      const column = index + 1; const cell = cells.get(column);
      const display = cell?.displayValue ?? (cell?.value == null ? '' : String(cell.value));
      return {column, display};
    });
  }, []);

  const makeDraft = useCallback((source: GeneratorSource, sheetName = source.book.sheets[0]?.name ?? '', headerRow = 1): SelectionDraft => {
    const base = {sheetName, headerRow, aliases: {}};
    const columns = columnsFor(source, base);
    const counts = new Map<string, number>(); columns.forEach(({display}) => counts.set(display, (counts.get(display) ?? 0) + 1));
    return {...base, aliases: Object.fromEntries(columns.map(({column, display}) => [column, display && counts.get(display) === 1 ? display : '']))};
  }, [columnsFor]);

  const replaceData = async (files: File[], context?: IntakeContext): Promise<File[]> => {
    const generation = ++intakeGeneration.current;
    const currentIntake = () => generation === intakeGeneration.current && !context?.signal.aborted;
    if (busy) return []; setPending(true); setMessage(''); clearPrepared(); releaseDownload(zip); setZip(undefined); setZipAttemptId(undefined);
    try {
      await client.reset();
      if (!currentIntake()) return [];
      const retained = new Map(dataFiles.map((file, index) => [file, sources[index]]));
      const accepted: File[] = []; const loaded: GeneratorSource[] = []; const failures: Array<{index:number;code:string}> = [];
      for (let index = 0; index < files.length; index++) {
        if (!currentIntake()) return [];
        try { const source = retained.get(files[index]) ?? (await client.loadSources([files[index]]))[0]; accepted.push(files[index]); loaded.push(source); }
        catch (error) { failures.push({index, code: error instanceof GeneratorError ? error.code : 'DAMAGED_DATA'}); }
      }
      if (!currentIntake()) return [];
      setDataFiles(accepted); setSources(loaded); setSourceFailures(failures);
      setDrafts(old => Object.fromEntries(loaded.map(source => [source.id, old[source.id] ?? makeDraft(source)])));
      if (accepted.length && !context && handoff.notReceived) handoff.dismiss();
      return accepted;
    } catch (error) { if (currentIntake()) setMessage(errorText(error)); return []; }
    finally { if (currentIntake()) setPending(false); }
  };

  const replaceTemplate = async (files: File[], context?: IntakeContext): Promise<boolean> => {
    const file = files.at(-1); if (!file || busy) return false;
    const generation = ++intakeGeneration.current;
    const currentIntake = () => generation === intakeGeneration.current && !context?.signal.aborted;
    setPending(true); setMessage(''); clearPrepared(); releaseDownload(zip); setZip(undefined); setZipAttemptId(undefined);
    try {
      await client.reset(); if (!currentIntake()) return false;
      const inspected = await client.inspectTemplate(file); if (!currentIntake()) return false;
      setTemplateFile(file); setTemplateVariables(inspected.variables);
      if (!context && handoff.notReceived) handoff.dismiss();
      return true;
    } catch (error) { if (currentIntake()) { setTemplateFile(undefined); setTemplateVariables([]); setMessage(errorText(error)); } return false; }
    finally { if (currentIntake()) setPending(false); }
  };

  const updateDraft = (source: GeneratorSource, next: Partial<SelectionDraft>) => {
    setDrafts(current => {
      const previous = current[source.id] ?? makeDraft(source); const merged = {...previous, ...next};
      if (next.sheetName !== undefined || next.headerRow !== undefined) return {...current, [source.id]: makeDraft(source, merged.sheetName, merged.headerRow)};
      return {...current, [source.id]: merged};
    }); clearPrepared();
  };

  const prepare = async () => {
    if (!templateFile || busy) return; setPending(true); setMessage(''); clearPrepared();
    try {
      const selections: GeneratorSelection[] = sources.map(source => ({source, sheetName: drafts[source.id].sheetName, headerRow: drafts[source.id].headerRow, aliases: drafts[source.id].aliases}));
      const next = await client.prepare(templateFile, selections, namePattern); setPlan(next);
      setSampleRow(next.rows.find(row => !row.error)?.id ?? next.rows[0]?.id ?? '');
    } catch (error) { setMessage(errorText(error)); }
    finally { setPending(false); }
  };

  const createSample = async () => {
    if (!plan || !sampleRow || busy) return; setPending(true); setMessage(''); releaseDownload(sample); setSample(undefined);
    try { setSample(await client.sample(plan, sampleRow)); } catch (error) { setMessage(errorText(error)); } finally { setPending(false); }
  };
  const selectSampleRow = (rowId: string) => {
    releaseDownload(sample); setSample(undefined); setSampleRow(rowId);
  };
  const generate = async () => {
    if (!plan || busy) return; setMessage(''); operation.start(tr('features:documentGenerator.progress.start'));
    try { const attempt = await client.generate(plan); const done = attempt.rows.filter(row => row.status !== 'not-started').length; operation.update(Math.max(1, Math.round(done / Math.max(1, attempt.rows.length) * 99)), tr('features:documentGenerator.progress.rows', {done, total:attempt.rows.length})); if (attempt.rows.some(row=>row.status==='canceled')) operation.fail(tr('features:documentGenerator.progress.canceled')); else operation.succeed(tr('features:documentGenerator.progress.done')); }
    catch (error) { const text = errorText(error); setMessage(text); operation.fail(text); }
  };
  const downloadResult = async (id: string) => {
    if (busy) return; setPending(true); try { const value = await client.readResult(id); activateDownload(value, snapshot.results.find(result=>result.id===id)?.fileName); } catch(error) { setMessage(errorText(error)); } finally { setPending(false); }
  };
  const createZip = async () => {
    if (busy) return; setMessage('');
    try { const next=await client.exportZip(); setZip(current=>{releaseDownload(current);return next;}); setZipAttemptId(snapshot.resultAttemptId); } catch(error) { setMessage(errorText(error)); }
  };
  const exportManifest = async (which: 'attempt'|'results') => {
    if (busy) return; try { activateDownload(await client.exportManifest(language, which), which === 'attempt' ? 'document-generation-latest.xlsx' : 'document-generation-results.xlsx'); } catch(error) { setMessage(errorText(error)); }
  };
  const resetAll = async () => { if (busy) return; setPending(true); try { await client.reset(); setDataFiles([]); setSources([]); setDrafts({}); setTemplateFile(undefined); setTemplateVariables([]); setSourceFailures([]); clearPrepared(); releaseDownload(zip); setZip(undefined); setZipAttemptId(undefined); setMessage(''); operation.reset(); } finally { setPending(false); } };

  useUnsavedWorkGuard("document-generator", dataFiles.length > 0 || !!templateFile || snapshot.results.length > 0, { kind: "files", scopePath: "/tools/document-generator" });
  const handoff = useHandoffReceiver("document-generator", {
    kind: "inspection",
    invalidate: () => {
      const intake = pendingHandoff.current;
      if (!intake?.signal.aborted) return;
      pendingHandoff.current = null;
      intakeGeneration.current++;
      intake.client.cancel();
      void intake.client.dispose().catch(() => {});
      setPending(false);
    },
    receive: async (entry, context) => {
      const template = entry.files.filter((file, index) => entry.roles?.[index] === "template" && /\.docx$/i.test(file.name));
      const data = entry.files.filter((file, index) => entry.roles?.[index] === "data" && /\.(xlsx|csv)$/i.test(file.name));
      const rejected = (): DeliveryResult => ({ status: "rejected", accepted: [], rejected: entry.files.map(file => ({ file, reasonCode: "inspection" })) });
      if (entry.roles?.length !== entry.files.length || template.length !== 1 || !data.length || data.length > 49 || data.length + 1 !== entry.files.length || !entry.files.every(file => acceptsFile("document-generator", file))) return rejected();
      if (busy || context.signal.aborted) return rejected();
      // Inspect in an isolated client. Until commit, the existing input,
      // prepared plan and downloadable results retain their original owner.
      const incoming = createDocumentGeneratorClient();
      const intake = { client: incoming, signal: context.signal };
      pendingHandoff.current = intake;
      const generation = ++intakeGeneration.current;
      const currentIntake = () => generation === intakeGeneration.current && !context.signal.aborted;
      setPending(true);
      let adopted = false;
      try {
        const inspected = await incoming.inspectTemplate(template[0]);
        if (!currentIntake()) return rejected();
        const loaded: GeneratorSource[] = [], acceptedData: File[] = [];
        const failures: Array<{ index: number; code: string }> = [];
        for (let index = 0; index < data.length; index++) {
          try {
            const source = (await incoming.loadSources([data[index]]))[0];
            if (!currentIntake()) return rejected();
            loaded.push(source); acceptedData.push(data[index]);
          } catch (error) {
            if (!currentIntake()) return rejected();
            failures.push({ index, code: error instanceof GeneratorError ? error.code : "DAMAGED_DATA" });
          }
        }
        clearPrepared(); releaseDownload(zip); setZip(undefined); setZipAttemptId(undefined);
        clientRef.current = incoming; adopted = true;
        setSnapshot(incoming.snapshot());
        void client.dispose().catch(() => {});
        setTemplateFile(template[0]); setTemplateVariables(inspected.variables);
        setDataFiles(acceptedData); setSources(loaded); setSourceFailures(failures);
        setDrafts(Object.fromEntries(loaded.map(source => [source.id, makeDraft(source)])));
        setMessage("");
        const accepted = [template[0], ...acceptedData];
        setUnsavedWork("document-generator", { hasWork: true, kind: "files", scopePath: "/tools/document-generator" });
        return { status: accepted.length === entry.files.length ? "accepted" : "partial", accepted, rejected: entry.files.filter(file => !accepted.includes(file)).map(file => ({ file, reasonCode: "inspection" })) };
      } catch (error) {
        if (currentIntake()) setMessage(errorText(error));
        return rejected();
      } finally {
        if (!adopted) void incoming.dispose().catch(() => {});
        if (pendingHandoff.current === intake) { pendingHandoff.current = null; setPending(false); }
      }
    },
  });
  const successfulRows = snapshot.results.length;
  const attemptIsPublished = snapshot.attempt?.id === snapshot.resultAttemptId;
  const progressRows = snapshot.attempt?.rows ?? [];
  const selectedRow = plan?.rows.find(row=>row.id===sampleRow);
  const guide = tr('features:documentGenerator.guide', {returnObjects:true}) as any;

  return <UtilityPage toolId="document-generator"><div ref={intakeRoot} className="contents">
      {(handoff.notReceived || (handoff.result && handoff.recoveryFiles.length > 0)) && <UtilityNotice kind="warning" role="status" className="mb-4 flex-col items-start gap-2" data-handoff-recovery>
        <p>{handoff.result?.status === "partial" && templateFile && !dataFiles.length
          ? tr("features:documentGenerator.handoffTemplateOnly")
          : ht(handoff.recoveryFiles.length ? "handoff.partial" : "handoff.notReceived", { count: handoff.recoveryFiles.length })}</p>
        <ul className="max-w-full break-all">{handoff.recoveryFiles.map((file, index) => <li key={index}>{file.name}</li>)}</ul>
        <div className="flex flex-wrap gap-2">
          {!!handoff.recoveryFiles.length && <Button type="button" variant="outline" onClick={() => {
            for (const file of handoff.recoveryFiles) { const url = URL.createObjectURL(file); const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
            setTimeout(() => handoff.dismiss(), 0);
          }}>{ht("handoff.downloadReceived")}</Button>}
          <Button type="button" variant="outline" disabled={busy} onClick={() => intakeRoot.current?.querySelector<HTMLInputElement>('input[type="file"]')?.click()}>{ht("handoff.selectAgain")}</Button>
          <Button type="button" variant="ghost" onClick={() => handoff.dismiss()}>{ht("handoff.close")}</Button>
        </div>
      </UtilityNotice>}

    <PageHeader eyebrow={tr('features:documentGenerator.eyebrow')} title={tr('features:documentGenerator.title')} description={tr('features:documentGenerator.description')} />
    <UtilitySectionCard title={tr('features:documentGenerator.files.title')} description={tr('features:documentGenerator.files.description')}>
      <FileDropZone label={tr('features:documentGenerator.files.template')} hint={tr('features:documentGenerator.files.templateHint')} accept={DOCX_ACCEPT} files={templateFile?[templateFile]:[]} onFiles={async files => { await replaceTemplate(files); }} disabled={busy}/>
      <div className="mt-4"><FileDropZone label={tr('features:documentGenerator.files.data')} hint={tr('features:documentGenerator.files.dataHint')} accept={DATA_ACCEPT} multiple files={dataFiles} onFiles={async files => { await replaceData(files); }} disabled={busy}/></div>
      <UtilityNotice className="mt-3">{tr('features:documentGenerator.files.limits')}</UtilityNotice>
      {sourceFailures.length>0&&<UtilityNotice className="mt-3" kind="error" role="alert"><ul>{sourceFailures.map(item=><li key={item.index}>{tr('features:documentGenerator.document', {number:item.index+1})}: {generatorMessage(item.code as never,language)}</li>)}</ul></UtilityNotice>}
      {templateVariables.length>0&&<p className="mt-3 text-sm"><strong>{tr('features:documentGenerator.variables')}:</strong> {templateVariables.join(', ')}</p>}
    </UtilitySectionCard>

    {sources.map((source, index) => { const draft=drafts[source.id]; if(!draft)return null; const sheet=source.book.sheets.find(item=>item.name===draft.sheetName); const columns=columnsFor(source,draft); return <UtilitySectionCard key={source.id} title={tr('features:documentGenerator.mapping.title',{number:index+1})} description={tr('features:documentGenerator.mapping.description')}>
      <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1"><UtilityField>{tr('features:documentGenerator.mapping.sheet')}<UtilitySelect disabled={busy} value={draft.sheetName} onChange={e=>updateDraft(source,{sheetName:e.target.value})}>{source.book.sheets.map(item=><option key={item.name}>{item.name}</option>)}</UtilitySelect></UtilityField><UtilityField>{tr('features:documentGenerator.mapping.header')}<UtilityInput disabled={busy} type="number" min="1" max={Math.max(1,sheet?.rowCount??1)} value={draft.headerRow} onChange={e=>updateDraft(source,{headerRow:Math.max(1,Number(e.target.value)||1)})}/></UtilityField></div>
      <div className="mt-3 grid grid-cols-2 gap-2 max-[620px]:grid-cols-1">{columns.map(({column,display})=><UtilityField key={column}>{tr('features:documentGenerator.mapping.column',{column,header:display||tr('features:documentGenerator.mapping.blank')})}<UtilityInput disabled={busy} value={draft.aliases[column]??''} placeholder={tr('features:documentGenerator.mapping.alias')} onChange={e=>updateDraft(source,{aliases:{...draft.aliases,[column]:e.target.value}})}/></UtilityField>)}</div>
    </UtilitySectionCard>; })}

    {sources.length>0&&templateFile&&<UtilitySectionCard title={tr('features:documentGenerator.preview.title')} description={tr('features:documentGenerator.preview.description')}>
      <UtilityField>{tr('features:documentGenerator.preview.pattern')}<UtilityInput disabled={busy} value={namePattern} onChange={e=>{setNamePattern(e.target.value);clearPrepared();}}/></UtilityField>
      <div className="mt-3 flex flex-wrap gap-2"><PrimaryButton accent="blue" disabled={busy||!sources.length} loading={pending} onClick={()=>void prepare()}>{tr('features:documentGenerator.preview.prepare')}</PrimaryButton>{plan&&<><UtilitySelect className="max-w-sm" aria-label={tr('features:documentGenerator.preview.row')} disabled={busy} value={sampleRow} onChange={e=>selectSampleRow(e.target.value)}>{plan.rows.map(row=><option key={row.id} value={row.id}>{tr('features:documentGenerator.row',{file:row.sourceFile,row:row.row,name:row.fileName??'—'})}</option>)}</UtilitySelect><Button type="button" disabled={busy||!sampleRow} onClick={()=>void createSample()}>{tr('features:documentGenerator.preview.sample')}</Button></>}</div>
      {selectedRow&&<div className="mt-3 rounded-xl border p-3" data-testid="document-generator-selected-row"><p className="font-bold break-all">{selectedRow.fileName??generatorMessage(selectedRow.error??'INVALID_NAME',language)}</p><dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 max-[620px]:grid-cols-1">{Object.entries(selectedRow.values).map(([name,value])=><div className="min-w-0" key={name}><dt className="font-semibold">{name}</dt><dd className="break-all text-muted-foreground">{value||tr('features:documentGenerator.preview.empty')}</dd></div>)}</dl></div>}
      {plan&&<div className="mt-3" data-testid="document-generator-plan"><strong>{tr('features:documentGenerator.preview.rows',{count:plan.rows.length})}</strong><ul className="mt-2 max-h-48 overflow-auto rounded-xl border p-3" tabIndex={0}>{plan.rows.map(row=><li key={row.id}>{tr('features:documentGenerator.row',{file:row.sourceFile,row:row.row,name:row.fileName??generatorMessage(row.error??'INVALID_NAME',language)})}</li>)}</ul></div>}
      {sample&&<a className="mt-3 inline-flex items-center gap-2 font-bold text-primary underline dark:text-primary" href={sample.url} download="document-sample.docx"><Download size={16}/>{tr('features:documentGenerator.preview.download')}</a>}
    </UtilitySectionCard>}

    {plan&&<UtilitySectionCard title={tr('features:documentGenerator.run.title')} description={tr('features:documentGenerator.run.description')}>
      <div className="flex flex-wrap gap-2"><PrimaryButton accent="blue" disabled={busy} onClick={()=>void generate()}><Play size={17}/>{tr('features:documentGenerator.run.start')}</PrimaryButton>{snapshot.state!=='idle'&&<Button type="button" variant="destructive" onClick={()=>client.cancel()}><X size={17}/>{tr('features:documentGenerator.run.cancel')}</Button>}<Button type="button" variant="secondary" disabled={busy} onClick={()=>void resetAll()}><RotateCcw size={17}/>{tr('features:documentGenerator.run.reset')}</Button></div>
      <OperationProgress {...operation} accent="blue" title={tr('features:documentGenerator.progress.title')}/>
      {snapshot.attempt?.fallback&&<UtilityNotice className="mt-3">{tr('features:documentGenerator.progress.memoryFallback')}</UtilityNotice>}
    </UtilitySectionCard>}

    {(successfulRows>0||progressRows.length>0)&&<UtilitySectionCard title={tr('features:documentGenerator.results.title')} description={attemptIsPublished?tr('features:documentGenerator.results.latest'):tr('features:documentGenerator.results.preserved')}>
      {successfulRows>0&&<ul className="space-y-2" data-testid="document-generator-results">{snapshot.results.map(result=><li className="flex flex-wrap items-center gap-2 rounded-xl border p-3" key={result.id}><FileText size={17}/><span className="min-w-0 flex-1 break-all"><strong>{result.fileName}</strong><small className="ml-2 text-muted-foreground">{formatBytes(result.bytes)}</small></span><Button type="button" variant="secondary" disabled={busy} onClick={()=>void downloadResult(result.id)}><Download size={16}/>{tr('features:documentGenerator.results.download')}</Button></li>)}</ul>}
      {progressRows.length>0&&<div className="mt-4"><strong>{tr('features:documentGenerator.results.attempt')}</strong><ul className="mt-2 max-h-56 overflow-auto rounded-xl border p-3" tabIndex={0}>{progressRows.map(row=><li key={row.id}>{tr('features:documentGenerator.statusRow',{row:row.row,status:tr(`features:documentGenerator.status.${row.status}`),reason:row.error?generatorMessage(row.error,language):''})}</li>)}</ul></div>}
      <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={busy||!snapshot.attempt} onClick={()=>void exportManifest('attempt')}><Download size={16}/>{tr('features:documentGenerator.results.latestManifest')}</Button><Button type="button" variant="secondary" disabled={busy||!successfulRows} onClick={()=>void exportManifest('results')}><Download size={16}/>{tr('features:documentGenerator.results.resultManifest')}</Button>{successfulRows>=2&&<Button type="button" disabled={busy} onClick={()=>void createZip()}><Package size={16}/>{tr('features:documentGenerator.results.zip')}</Button>}</div>
      {zip&&zipAttemptId===snapshot.resultAttemptId&&<a className="mt-3 inline-flex items-center gap-2 font-bold text-primary underline dark:text-primary" href={zip.url} download="generated-documents.zip"><Download size={16}/>{tr('features:documentGenerator.results.downloadZip')}</a>}
    </UtilitySectionCard>}
    {message&&<UtilityNotice kind="error" role="alert">{message}</UtilityNotice>}
    <ToolGuideWrapper slug="documentGenerator" />
  </div></UtilityPage>;
}

function activateDownload(value: GeneratorDownload, name?: string) {
  const anchor=document.createElement('a'); anchor.href=value.url; if(name)anchor.download=name; else anchor.download=''; anchor.click(); setTimeout(()=>value.release(),0);
}
