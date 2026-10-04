import { useEffect, useRef, useState } from "react";
import { FileDropZone } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { UtilityField, UtilityInput, UtilitySelect } from "../../components/UtilitySurface";
import { clientErrorCode, inspectProductFile, readProductFiles } from "./inputClient";
import type { BannerInputProduct, MappingOverrides, InputErrorCode, ProductField, SheetSelection, SheetSummary } from "./inputTypes";
import type { BannerUiText } from "./uiMessages";

type PendingFile = { file: File; sheets: SheetSummary[]; selections: SheetSelection[] };
const fields: ProductField[] = ["imageUrl", "promotionUrl", "name", "productId", "originPrice", "discountPrice", "discount", "currency", "videoUrl"];
export function ImportSelection({ text, onImport, errorText, onBusy, onPending }: { text: BannerUiText; onImport: (products: BannerInputProduct[]) => boolean; errorText: (code: InputErrorCode) => string; onBusy: (busy: boolean) => void; onPending: (pending: boolean) => void }) {
  const [files, setFiles] = useState<PendingFile[]>([]), [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  const controller = useRef<AbortController | null>(null), importRef = useRef(onImport); importRef.current = onImport;
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { onPending(files.length > 0); }, [files.length, onPending]);
  function running(value: boolean) { setBusy(value); onBusy(value); }
  async function inspect(incoming: File[]) {
    const abort = new AbortController(); controller.current = abort; running(true); setStatus("");
    const next: PendingFile[] = [];
    try {
      for (const file of incoming) {
        if (abort.signal.aborted) break;
        try {
          const sheets = await inspectProductFile(file, { signal: abort.signal });
          next.push({ file, sheets, selections: sheets.map((s) => ({ sheetIndex: s.sheetIndex, headerRow: s.suggestedHeaderRow ?? 1, mapping: s.headerCandidates.find((h) => h.rowNumber === s.suggestedHeaderRow)?.mapping ?? {} })) });
        } catch (error) { if (!abort.signal.aborted) setStatus(errorText(clientErrorCode(error))); }
      }
      if (!abort.signal.aborted) setFiles((previous) => [...previous, ...next]);
    } finally { controller.current = null; running(false); }
  }
  function update(index: number, selection: SheetSelection) {
    setFiles((previous) => previous.map((entry, i) => i === index ? { ...entry, selections: [...entry.selections.filter((s) => s.sheetIndex !== selection.sheetIndex), selection].sort((a, b) => a.sheetIndex - b.sheetIndex) } : entry));
  }
  async function extract() {
    if (files.some((entry) => entry.selections.some((s) => s.mapping?.imageUrl === null || s.mapping?.promotionUrl === null))) {
      setStatus(errorText("MAPPING_REQUIRED")); return;
    }
    const abort = new AbortController(); controller.current = abort; running(true); setStatus("");
    try {
      const selectionsByFile = Object.fromEntries(files.map((entry, i) => [i, entry.selections]));
      const result = await readProductFiles(files.map((entry) => entry.file), { selectionsByFile, signal: abort.signal, onProgress: () => setStatus(text.reading) });
      if (abort.signal.aborted) { setStatus(text.cancel); return; }
      const errors = [...result.failures.map((f) => f.code), ...result.files.flatMap((f) => f.issues.map((i) => i.code))];
      setStatus(errors.map(errorText).join(" · "));
      if (result.products.length) { if (importRef.current(result.products)) setFiles([]); }
    } catch (error) { setStatus(errorText(clientErrorCode(error))); }
    finally { controller.current = null; running(false); }
  }
  return <div className="space-y-4">
    <FileDropZone label={text.import} hint={text.hint} accept=".xls,.xlsx,.csv" multiple files={[]} onFiles={inspect} disabled={busy} />
    {files.map((entry, index) => <div key={index} className="space-y-3 rounded-2xl border border-border p-3">
      <p className="break-all">{index + 1}. {entry.file.name}</p>
      <div className="flex gap-2"><Button variant="secondary" disabled={busy || index === 0} onClick={() => setFiles((previous) => { const next = [...previous]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>{text.up}</Button><Button variant="secondary" disabled={busy} onClick={() => setFiles((previous) => previous.filter((_, i) => i !== index))}>{text.delete}</Button></div>
      {entry.sheets.map((sheet) => {
        const selected = entry.selections.find((s) => s.sheetIndex === sheet.sheetIndex), candidate = sheet.headerCandidates.find((h) => h.rowNumber === selected?.headerRow);
        return <div key={sheet.sheetIndex} className="space-y-2">
          <label className="flex gap-2"><input type="checkbox" checked={!!selected} disabled={busy} onChange={(e) => e.target.checked ? update(index, { sheetIndex: sheet.sheetIndex, headerRow: sheet.suggestedHeaderRow ?? 1, mapping: {} }) : setFiles((previous) => previous.map((f, i) => i === index ? { ...f, selections: f.selections.filter((s) => s.sheetIndex !== sheet.sheetIndex) } : f))} />{sheet.sheetIndex + 1}. {sheet.name}</label>
          {selected && <>
            <UtilityField><span>{text.headerRow}</span><UtilityInput type="number" min={1} max={sheet.rowCount} value={selected.headerRow ?? 1} disabled={busy} onChange={(e) => { const row = e.target.valueAsNumber; if (Number.isInteger(row) && row > 0 && row <= sheet.rowCount) update(index, { ...selected, headerRow: row, mapping: sheet.headerCandidates.find((h) => h.rowNumber === row)?.mapping ?? {} }); }} /></UtilityField>
            <details><summary>{text.mapping}</summary>{fields.map((field) => <UtilityField key={field}><span>{text.fields[field]}</span><UtilitySelect disabled={busy} value={selected.mapping?.[field] === null ? "" : selected.mapping?.[field] ?? candidate?.mapping[field] ?? ""} onChange={(e) => { const mapping: MappingOverrides = { ...selected.mapping, [field]: e.target.value === "" ? null : Number(e.target.value) }; update(index, { ...selected, mapping }); }}><option value="">—</option>{Array.from({ length: sheet.columnCount }, (_, c) => <option key={c} value={c}>{c + 1}. {candidate?.labels[c] ?? ""}</option>)}</UtilitySelect></UtilityField>)}</details>
          </>}
        </div>;
      })}
    </div>)}
    <div role="status">{busy ? text.reading : status}</div>
    {busy ? <Button variant="secondary" onClick={() => controller.current?.abort()}>{text.cancel}</Button> : <Button disabled={!files.length || files.some((f) => !f.selections.length)} onClick={() => void extract()}>{text.confirmImport}</Button>}
  </div>;
}
