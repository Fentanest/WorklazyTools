import { useState } from 'react';
import { Button } from '../../components/ui/button';
import type { RenameGroup, RenameResult } from './selected.ts';
import type { SelectedPair } from './SelectedPanel.tsx';
function Group({ group, paths, label, choose }: { group: RenameGroup; paths: Map<string, string>; label: (key: string) => string; choose: (pair: SelectedPair) => void }) {
  const [open, setOpen] = useState(false), [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(Math.max(group.left.length, group.right.length) / 100));
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>{group.left.length} ↔ {group.right.length}</summary>{open && <div>
    {(['left', 'right'] as const).map(side => <div key={side}><strong>{label(side)}</strong>{group[side].slice(page * 100, (page + 1) * 100).map(id => <p key={id} className="break-all">{paths.get(id)}</p>)}</div>)}
    <div className="my-2 flex gap-3"><Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>{label('previous')}</Button><span>{label('page')} {page + 1} / {pages}</span><Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{label('next')}</Button></div>
    {group.left.length === 1 && group.right.length === 1 && <Button variant="outline" onClick={() => choose({ leftId: group.left[0], rightId: group.right[0], name: label('candidatePair') })}>{label('candidatePair')}</Button>}
  </div>}</details>;
}
export function RenameGroups({ result, paths, label, choose }: { result: RenameResult; paths: Map<string, string>; label: (key: string) => string; choose: (pair: SelectedPair) => void }) {
  const [page, setPage] = useState(0); const pages = Math.max(1, Math.ceil(result.groups.length / 100));
  return <div><p>{label(result.state)} · {label('readBytes')}: {result.readBytes.toLocaleString()}</p>{result.unreadable.length > 0 && <p>{label('unreadable')}: {result.unreadable.length}</p>}
    {result.groups.slice(page * 100, (page + 1) * 100).map((group, index) => <Group key={page * 100 + index} group={group} paths={paths} label={label} choose={choose} />)}
    <div className="my-2 flex gap-3"><Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>{label('previous')}</Button><span>{label('page')} {page + 1} / {pages}</span><Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{label('next')}</Button></div>
  </div>;
}
