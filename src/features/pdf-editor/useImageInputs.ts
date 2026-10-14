import { useEffect, useRef, useState } from 'react';
import { ownImage, ImageInputError, type ImageMetadata, type ImageStage } from './imageInput.ts';
import { rasterImage } from './imageRaster.ts';
import { createLocalId } from './types';

export interface ImageEntry {
  id: string; name: string; size: number; file?: File; metadata?: ImageMetadata;
  status: 'reading' | 'preview' | 'ready' | 'failed'; url?: string; stage?: ImageStage;
}
export function useImageInputs() {
  const [entries, setEntries] = useState<ImageEntry[]>([]);
  const [acquiring, setAcquiring] = useState(false);
  const current = useRef<ImageEntry[]>([]), mounted = useRef(true);
  const jobs = useRef(new Map<string, AbortController>());
  const commit = (next: ImageEntry[]) => { current.current = next; if (mounted.current) setEntries(next); };
  const patch = (id: string, next: Partial<ImageEntry>) => commit(current.current.map(e => e.id === id ? { ...e, ...next } : e));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      jobs.current.forEach(c => c.abort()); jobs.current.clear();
      current.current.forEach(e => { if (e.url) URL.revokeObjectURL(e.url); });
      current.current = [];
    };
  }, []);
  const thumbnail = async (entry: ImageEntry, controller: AbortController) => {
    const blob = await rasterImage(entry.file!, entry.metadata!, true, controller.signal);
    if (controller.signal.aborted || !mounted.current || !current.current.some(e => e.id === entry.id)) return;
    const url = URL.createObjectURL(blob);
    patch(entry.id, { url, status: 'ready', stage: undefined });
  };
  const fail = (id: string, reason: unknown) => {
    const stage = reason instanceof ImageInputError ? reason.stage : 'thumbnail';
    patch(id, { status: 'failed', stage });
    const e = current.current.find(e => e.id === id);
    // Local console only; no pixels, EXIF, paths, or remote telemetry.
    console.debug('image-pdf', { id, name: e?.name, size: e?.size, stage,
      errorName: (reason instanceof Error && reason.cause instanceof Error ? reason.cause : reason as Error)?.name });
  };
  const add = async (sources: File[]) => {
    setAcquiring(true);
    const pending = sources.map(source => ({ id: createLocalId('pdf-image'), name: source.name, size: source.size, status: 'reading' as const }));
    const controllers = pending.map(e => { const c = new AbortController(); jobs.current.set(e.id,c); return c; });
    commit([...current.current, ...pending]);
    for (let i = 0; i < pending.length; i++) {
      const entry = pending[i], controller = controllers[i];
      try {
        const owned = await ownImage(sources[i], controller.signal);
        if (!mounted.current || controller.signal.aborted) continue;
        const ready = { ...entry, ...owned, status: 'preview' as const };
        patch(entry.id, ready);
        await thumbnail(ready, controller);
      } catch (reason) { if (mounted.current && !controller.signal.aborted) fail(entry.id, reason); }
      finally { jobs.current.delete(entry.id); }
    }
    if (mounted.current) setAcquiring(false);
  };
  const remove = (id: string) => {
    jobs.current.get(id)?.abort();
    const entry = current.current.find(e => e.id === id);
    if (entry?.url) URL.revokeObjectURL(entry.url);
    commit(current.current.filter(e => e.id !== id));
  };
  const previewFailed = (id: string) => {
    const entry = current.current.find(e => e.id === id);
    if (entry?.url) URL.revokeObjectURL(entry.url);
    patch(id, { url: undefined, status: 'failed', stage: 'thumbnail' });
  };
  const retry = async (id: string) => {
    const entry = current.current.find(e => e.id === id);
    if (!entry?.file || jobs.current.has(id)) return;
    if (entry.url) URL.revokeObjectURL(entry.url);
    const controller = new AbortController(); jobs.current.set(id, controller);
    patch(id, { status: 'preview', url: undefined, stage: undefined });
    try { await thumbnail(entry, controller); }
    catch (reason) { if (mounted.current && !controller.signal.aborted) fail(id, reason); }
    finally { jobs.current.delete(id); }
  };
  return { entries, acquiring, add, remove, retry, previewFailed, patch,
    cancelPreparation: () => { for (const id of jobs.current.keys()) remove(id); },
    reorder: (oldIndex: number, newIndex: number) => {
      const next = [...current.current], [entry] = next.splice(oldIndex,1); next.splice(newIndex,0,entry); commit(next);
    },
  };
}
