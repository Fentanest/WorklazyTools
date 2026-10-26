import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { UtilityField, UtilityInput, UtilityNotice, UtilitySectionCard, UtilitySelect } from '../../components/UtilitySurface';
import { DEFAULT_EXCEL_COMPARE_OPTIONS, type ExcelCompareInspection, type ExcelComparePairOptions } from '../excel-compare/types.ts';
import { DeepSession, compareSelected, deepLimit, type DeepKind, type DeepResult } from './deep.ts';
import { DeepView } from './DeepView.tsx';
export interface SelectedPair { leftId: string; rightId: string; name: string }
export function SelectedPanel({ pair, session, request, language, label }: { pair: SelectedPair; session: DeepSession; request: (leftId: string, rightId: string, limit: number, signal: AbortSignal) => Promise<readonly [File, File]>; language: 'ko' | 'en'; label: (key: string) => string }) {
  const [kind, setKind] = useState<DeepKind>('text'), [result, setResult] = useState<DeepResult>(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [sheets, setSheets] = useState<ExcelCompareInspection[]>();
  const [excel, setExcel] = useState<ExcelComparePairOptions>({ mode: 'position', left: { sheetName: '', headerRow: 1 }, right: { sheetName: '', headerRow: 1 }, normalization: { ...DEFAULT_EXCEL_COMPARE_OPTIONS } });
  const generation = useRef(0), taskId = useRef<number | undefined>(undefined);
  const cancelOwned = () => { if (taskId.current !== undefined) session.cancel(taskId.current); };
  const invalidate = () => { generation.current++; cancelOwned(); setResult(undefined); setError(''); setBusy(false); };
  useEffect(() => () => { generation.current++; cancelOwned(); }, [session]);
  const execute = (inspect: boolean) => {
    invalidate(); const run = generation.current; setBusy(true);
    const job = session.run(async signal => {
      const files = await request(pair.leftId, pair.rightId, deepLimit(kind), signal); signal.throwIfAborted();
      if (inspect) {
        const { inspectExcelCompareFile } = await import('../excel-compare/excelCompareClient.ts');
        const a = await inspectExcelCompareFile(files[0], language, signal, [excel.left.headerRow], false);
        const b = await inspectExcelCompareFile(files[1], language, signal, [excel.right.headerRow], false); signal.throwIfAborted();
        if (run === generation.current) { setSheets([a, b]); setExcel(previous => ({ ...previous, left: { ...previous.left, sheetName: '' }, right: { ...previous.right, sheetName: '' } })); }
      } else {
        const value = await compareSelected(kind, files, signal, language, excel);
        // PDF returns useful canceled/partial output. Keep it without changing folder byte status.
        if (run === generation.current) setResult(value);
      }
    });
    taskId.current = session.currentId;
    void job.catch(error => { if (run === generation.current) setError(label(error instanceof DOMException && error.name === 'AbortError' ? 'deepCanceled' : 'deepError')); }).finally(() => { if (run === generation.current) setBusy(false); });
  };
  return <UtilitySectionCard title={label('deep')} description={pair.name} className="mt-4">
    <p className="mb-3 text-sm">{label('deepLimits')}</p>
    <UtilitySelect aria-label={label('deepKind')} value={kind} onChange={event => { invalidate(); setSheets(undefined); setKind(event.target.value as DeepKind); }}>
      {(['text', 'excel', 'image', 'pdf', 'word', 'hwp'] as const).map(value => <option key={value} value={value}>{label(value)}</option>)}
    </UtilitySelect>
    {kind === 'excel' && <div className="my-3"><p>{label('position')}</p>{(['left', 'right'] as const).map((side, index) => <div key={side} className="my-2 flex flex-wrap gap-2"><UtilityField>{label(side)} {label('headerRow')}<UtilityInput type="number" min={1} value={excel[side].headerRow} onChange={e => { invalidate(); setSheets(undefined); setExcel(previous => ({ ...previous, [side]: { sheetName: '', headerRow: Math.max(1, Number(e.target.value) || 1) } })); }} /></UtilityField><UtilityField>{label('sheet')}<UtilitySelect aria-label={`${label(side)} ${label('sheet')}`} value={excel[side].sheetName} onChange={e => { invalidate(); setExcel(previous => ({ ...previous, [side]: { ...previous[side], sheetName: e.target.value } })); }}><option value="">{label('chooseSheet')}</option>{sheets?.[index].sheets.map(sheet => <option key={sheet.name}>{sheet.name}</option>)}</UtilitySelect></UtilityField></div>)}
      <Button variant="outline" disabled={busy} onClick={() => execute(true)}>{label('inspect')}</Button>
      {Object.entries(excel.normalization).filter(([, value]) => typeof value === 'boolean').map(([key, value]) => <label key={key} className="flex gap-2 py-1"><input type="checkbox" checked={value as boolean} onChange={e => { invalidate(); setExcel(previous => ({ ...previous, normalization: { ...previous.normalization, [key]: e.target.checked } })); }} />{label(key)}</label>)}
      {(['absoluteTolerance', 'relativeTolerance'] as const).map(key => <UtilityField key={key}>{label(key)}<UtilityInput type="number" min={0} value={excel.normalization[key]} onChange={e => { invalidate(); setExcel(previous => ({ ...previous, normalization: { ...previous.normalization, [key]: Math.max(0, Number(e.target.value) || 0) } })); }} /></UtilityField>)}
      <UtilitySelect aria-label={label('formulaMode')} value={excel.normalization.formulaMode} onChange={e => { invalidate(); setExcel(previous => ({ ...previous, normalization: { ...previous.normalization, formulaMode: e.target.value as 'formula' | 'cached' | 'both' } })); }}>{['formula', 'cached', 'both'].map(value => <option key={value} value={value}>{label(value)}</option>)}</UtilitySelect>
    </div>}
    <div className="my-3 flex gap-2"><Button disabled={busy || kind === 'excel' && (!excel.left.sheetName || !excel.right.sheetName)} onClick={() => execute(false)}>{label('deepRun')}</Button><Button variant="outline" disabled={!busy} onClick={cancelOwned}>{label('cancel')}</Button></div>
    {busy && <p role="status">{label('deepComparing')}</p>}{error && <UtilityNotice kind="error">{error}</UtilityNotice>}{result && <DeepView key={generation.current} result={result} label={label} />}
  </UtilitySectionCard>;
}
