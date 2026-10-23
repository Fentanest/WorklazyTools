import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PrivacyBanner } from '../../components/PrivacyBanner';
import { PageHeader } from '../../components/ui';
import { Button } from '../../components/ui/button';
import { UtilityField, UtilityInput, UtilityNotice, UtilityPage, UtilitySectionCard, UtilitySelect } from '../../components/UtilitySurface';
import { FOLDER_COPY } from './copy.ts';
import type { MatchOptions } from './core.ts';
import type { FolderView, RowView, SourceInput } from './owner.ts';
import type { ReadonlyDirectory } from './directory.ts';
interface PathNode { name: string; children: Map<string, PathNode>; row?: RowView }
function pathTree(rows: RowView[]) {
  const root: PathNode = { name: '', children: new Map() };
  for (const row of rows) {
    let node = root;
    const parts = row.key.split('/');
    // Bound render recursion while keeping complete original paths in entry details.
    const displayParts = parts.length > 24 ? [...parts.slice(0, 23), parts.slice(23).join('/')] : parts;
    for (const name of displayParts) {
      if (!node.children.has(name)) node.children.set(name, { name, children: new Map() });
      node = node.children.get(name)!;
    }
    node.row = row;
  }
  return root;
}
export function FolderComparePage() {
  const { t, i18n } = useTranslation('features');
  const language = i18n.resolvedLanguage?.startsWith('ko') ? 'ko' : 'en';
  const tr = (key: keyof typeof FOLDER_COPY.en) => t(`folderCompare.${key}`, { defaultValue: FOLDER_COPY[language][key] });
  const [sources, setSources] = useState<Partial<Record<'left' | 'right', SourceInput>>>({});
  const [labels, setLabels] = useState<Partial<Record<'left' | 'right', string>>>({});
  const [options, setOptions] = useState<MatchOptions>({});
  const [view, setView] = useState<FolderView>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('all'), [page, setPage] = useState(0);
  const worker = useRef<Worker | undefined>(undefined), revision = useRef(0), selections = useRef({ left: 0, right: 0 });
  const invalidate = () => { revision.current++; worker.current?.postMessage({ type: 'clear', revision: revision.current }); setView(undefined); setBusy(false); setError(''); setPage(0); };
  useEffect(() => () => { selections.current.left++; selections.current.right++; revision.current++; worker.current?.terminate(); worker.current = undefined; }, []);
  const select = (side: 'left' | 'right', source: SourceInput, label: string) => {
    selections.current[side]++; invalidate(); setSources(previous => ({ ...previous, [side]: source })); setLabels(previous => ({ ...previous, [side]: label }));
  };
  const openDirectory = async (side: 'left' | 'right') => {
    const token = ++selections.current[side];
    try {
      const picker = (window as unknown as { showDirectoryPicker?: (options: { mode: 'read' }) => Promise<ReadonlyDirectory> }).showDirectoryPicker;
      if (!picker) throw new Error('unavailable');
      const handle = await picker.call(window, { mode: 'read' });
      if (selections.current[side] === token) select(side, { kind: 'directory', handle }, handle.name);
    } catch (reason) { if (selections.current[side] === token && !(reason instanceof DOMException && reason.name === 'AbortError')) setError(tr('pickerError')); }
  };
  const compare = () => {
    if (!sources.left || !sources.right) return;
    const run = ++revision.current; setBusy(true); setError(''); setView(undefined); setPage(0);
    try {
      if (!worker.current) {
        const created = new Worker(new URL('./folderCompare.worker.ts', import.meta.url), { type: 'module' }); worker.current = created;
        created.onmessage = (event: MessageEvent<FolderView>) => {
          if (created !== worker.current || event.data.revision !== revision.current) return;
          setView(event.data); setBusy(['loading', 'comparing'].includes(event.data.phase));
        };
        const failed = () => { if (worker.current !== created) return; created.terminate(); worker.current = undefined; revision.current++; setBusy(false); setError(tr('workerError')); };
        created.onerror = failed; created.onmessageerror = failed;
      }
      worker.current.postMessage({ type: 'compare', revision: run, left: sources.left, right: sources.right, options });
    } catch { setBusy(false); setError(tr('workerError')); }
  };
  const status = (row: RowView) => row.pairing === 'matched' ? row.content : row.pairing;
  const filtered = (view?.rows ?? []).filter(row => (filter === 'all' || status(row) === filter) && [...row.left, ...row.right].some(e => e.path.toLowerCase().includes(search.toLowerCase())));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 300)); const currentPage = Math.min(page, pageCount - 1);
  const tree = pathTree(filtered.slice(currentPage * 300, (currentPage + 1) * 300));
  const renderEntries = (row: RowView) => <div className="ml-4 text-sm"><p>{tr('details')}</p>{(['left', 'right'] as const).map(side => <div key={side}>{tr(side)}{row[side].map(e => <p key={e.id}>{e.path} · {e.size.toLocaleString()} B{e.issue && ` · ${tr('unreadable')}`}</p>)}</div>)}</div>;
  const renderNode = (node: PathNode, key: string): ReactNode => <li key={key} className="ml-4 py-1 break-all">
    {node.children.size ? <details><summary>{node.name}/ {node.row && <span>— {tr(status(node.row) as keyof typeof FOLDER_COPY.en)}</span>}</summary>{node.row && renderEntries(node.row)}<ul>{[...node.children].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, child]) => renderNode(child, key + '/' + name))}</ul></details> : node.row && <details><summary>{node.name} — {tr(status(node.row) as keyof typeof FOLDER_COPY.en)} · {tr(node.row.integrity as keyof typeof FOLDER_COPY.en)}</summary>{renderEntries(node.row)}</details>}
  </li>;
  return <UtilityPage toolId="folder-compare">
    <PageHeader eyebrow={tr('eyebrow')} title={tr('title')} description={tr('description')}><PrivacyBanner compact /></PageHeader>
    <UtilityNotice>{tr('privacy')}</UtilityNotice><p className="my-2 text-sm">{tr('limits')}</p><p className="my-2 text-sm">{tr('snapshot')}</p>
    {error && <UtilityNotice kind="error" role="alert">{error}</UtilityNotice>}
    <div className="grid gap-4 md:grid-cols-2">{(['left', 'right'] as const).map(side => <UtilitySectionCard key={side} title={tr(side)} description={labels[side] ?? tr('none')}>
      <UtilityField>{tr('files')}<input type="file" multiple {...{ webkitdirectory: '' }} aria-label={`${tr(side)} ${tr('files')}`} onChange={event => { const files = Array.from(event.target.files ?? []); if (files.length) select(side, { kind: 'files', files }, `${files.length} ${tr('entries')}`); event.target.value = ''; }} /></UtilityField>
      <UtilityField className="mt-3">{tr('zip')}<input type="file" accept=".zip,application/zip" aria-label={`${tr(side)} ${tr('zip')}`} onChange={event => { const file = event.target.files?.[0]; if (file) select(side, { kind: 'zip', file }, file.name); event.target.value = ''; }} /></UtilityField>
      {'showDirectoryPicker' in window && <Button variant="outline" className="mt-3" onClick={() => void openDirectory(side)}>{tr('directory')}</Button>}
    </UtilitySectionCard>)}</div>
    <UtilitySectionCard title={tr('options')} className="mt-4">
      {(['nfc', 'ignoreCase', 'stripRoot'] as const).map(key => <label key={key} className="flex gap-2 py-2"><input type="checkbox" checked={!!options[key]} onChange={event => { invalidate(); setOptions(previous => ({ ...previous, [key]: event.target.checked })); }} />{tr(key)}</label>)}
      <div className="mt-3 flex gap-2"><Button disabled={!sources.left || !sources.right || busy} onClick={compare}>{tr('compare')}</Button><Button variant="secondary" disabled={!busy} onClick={() => worker.current?.postMessage({ type: 'cancel', revision: revision.current })}>{tr('cancel')}</Button></div>
    </UtilitySectionCard>
    {view && <UtilitySectionCard title={tr('result')} className="mt-4">
      <p role="status" aria-live="polite">{tr(view.phase)} {view.completed.toLocaleString()} / {view.total.toLocaleString()} {tr('completed')}</p>
      {view.total > 0 && <progress className="my-2 w-full" max={view.total} value={view.completed} aria-label={tr('result')} />}
      <p className="my-3 text-sm">{tr('distinction')}</p>
      <div className="flex flex-wrap gap-3"><UtilityInput value={search} placeholder={tr('search')} aria-label={tr('search')} onChange={event => { setSearch(event.target.value); setPage(0); }} /><UtilitySelect value={filter} aria-label={tr('all')} onChange={event => { setFilter(event.target.value); setPage(0); }}><option value="all">{tr('all')}</option>{['equal', 'different', 'pending', 'unreadable', 'canceled', 'unknown', 'ambiguous', 'left-only', 'right-only'].map(key => <option key={key} value={key}>{tr(key as keyof typeof FOLDER_COPY.en)}</option>)}</UtilitySelect></div>
      <ul className="my-3">{[...tree.children].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, node]) => renderNode(node, name))}</ul>
      <div className="flex items-center gap-3"><Button variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{tr('previous')}</Button><span>{tr('page')} {currentPage + 1} / {pageCount}</span><Button variant="outline" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>{tr('next')}</Button></div>
    </UtilitySectionCard>}
  </UtilityPage>;
}
