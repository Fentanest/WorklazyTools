import { PERSISTENT_RECEIVERS, purgeExpired, takePendingPersistentHandoff, type PersistentReceiverId } from "./persistentHandoff";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { ReceiverId } from "./fileAccepts";
import { claimHandoff, closeDelivery, deliverHandoff, findDelivery, getDelivery, retainDelivery, subscribeHandoff, wasHandoffConsumed, type Delivery, type DeliveryResult, type HandoffAdapter, type HandoffToken, type IntakeContext } from "./memoryHandoff";
import { stripLanguagePrefix } from "../i18n/languages";

/** Attach this hook to the tool's existing intake; it never runs its main job. */
export function useHandoffReceiver(receiverId: ReceiverId, adapter: HandoffAdapter) {
  const location = useLocation();
  const adapterRef = useRef(adapter); adapterRef.current = adapter;
  const record = useRef<Delivery | null>(null);
  const owned = useRef<Delivery[]>([]);
  const [result, setResult] = useState<DeliveryResult>();
  const [notReceived, setNotReceived] = useState(false);
  const [, update] = useState(0);
  useEffect(() => subscribeHandoff(() => update(value => value + 1)), []);
  useEffect(() => {
    const token = location.state?.wlHandoff as HandoffToken | undefined;
    const path = `${window.location.pathname}${window.location.search}`;
    setNotReceived(false);
    setResult(undefined);
    if (token) {
      const existing = getDelivery(token.id);
      const entryPath = stripLanguagePrefix(location.pathname).replace(/\/+$/, "");
      // Existing records can only be reattached by this same route instance.
      if (existing?.locationKey === location.key && existing.entry.nonce === token.nonce && existing.entry.receiverId === receiverId && existing.entry.entryPath === entryPath) record.current = existing;
      else {
        const entry = claimHandoff(token, receiverId, entryPath);
        // Preserve BrowserRouter's key/index and unrelated user state.
        const state = window.history.state;
        const userState = { ...state?.usr }; delete userState.wlHandoff;
        window.history.replaceState({ ...state, usr: userState }, "");
        if (entry) record.current = deliverHandoff(entry, path, location.key, adapterRef.current);
        else {
          record.current = null;
          setNotReceived(!wasHandoffConsumed(token, receiverId, entryPath, location.key, path));
        }
      }
    }
    if (!token) record.current = findDelivery(receiverId, path, location.key) ?? null;
    const delivery = record.current;
    owned.current = owned.current.filter(item => !item.closed);
    if (delivery && !delivery.closed && delivery.path === path && !owned.current.includes(delivery)) owned.current.push(delivery);
    const detach = owned.current.filter(item => item.path === path).map(retainDelivery);
    if (!delivery || delivery.closed || delivery.path !== path) return () => { for (const release of detach) release(); };
    let active = true;
    void delivery.promise.then(value => { if (active) { setResult({ ...value, accepted: [] }); update(tick => tick + 1); } });
    update(value => value + 1);
    return () => { active = false; for (const release of detach) release(); };
  }, [location.key, location.pathname, location.search, receiverId]);
  return { notReceived, result, recoveryTexts: owned.current.flatMap(item => item.closed || item.text === undefined ? [] : [item.text]), recoveryFiles: owned.current.flatMap(item => item.closed ? [] : item.files),
    dismiss: () => { for (const item of owned.current) closeDelivery(item); owned.current = []; record.current = null; setResult(undefined); setNotReceived(false); } };
}

export type TextHandoffAdapter = {
  receiveText: (text: string, context: IntakeContext) => boolean | Promise<boolean>;
} & ({ kind: "selection"; invalidate?: () => void } | { kind: "inspection"; invalidate: () => void });

/** Future text receivers share the token, StrictMode and cleanup lifecycle.
 * Return true only after storing the input and registering its own protection.
 * Inspection callbacks must check signal/generation before any late state write.
 */
export function useTextHandoffReceiver(receiverId: ReceiverId, adapter: TextHandoffAdapter) {
  return useHandoffReceiver(receiverId, {
    kind: adapter.kind, invalidate: adapter.invalidate!, payload: "text",
    receive: async (entry, context) => {
      const textAccepted = entry.text !== undefined && await adapter.receiveText(entry.text, context);
      return { status: textAccepted ? "accepted" : "rejected", textAccepted, accepted: [], rejected: [] };
    },
  });
}

// Isolated documents use their own one-shot tab token rather than Router state.
// H2 connects this hook to the existing parser; no tool is auto-run here.
export type PersistentHandoffAdapter = {
  receive: (files: File[], context: IntakeContext) => DeliveryResult | Promise<DeliveryResult>;
} & ({ kind: "selection"; invalidate?: () => void } | { kind: "inspection"; invalidate: () => void });
interface PersistentDelivery {
  files: File[]; result?: DeliveryResult; notReceived: boolean; pending: boolean;
  abort: AbortController; invalidate?: () => void; owners: number;
  cleanup?: ReturnType<typeof setTimeout>; timeout?: ReturnType<typeof setTimeout>;
  closed: boolean; listeners: Set<() => void>;
}
const persistentDeliveries = new Map<string, PersistentDelivery>();
function notifyPersistent(record: PersistentDelivery) { for (const listener of record.listeners) listener(); }
function closePersistent(record: PersistentDelivery) {
  if (record.closed) return;
  record.closed = true; clearTimeout(record.timeout); clearTimeout(record.cleanup);
  if (record.pending && !record.abort.signal.aborted) { record.abort.abort(); record.invalidate?.(); }
  record.files = []; record.result = undefined; record.pending = false; record.notReceived = false;
  notifyPersistent(record);
}
function startPersistent(receiverId: PersistentReceiverId, entryPath: string, adapter: PersistentHandoffAdapter): PersistentDelivery {
  const record: PersistentDelivery = { files: [], pending: true, notReceived: false,
    abort: new AbortController(), owners: 0, closed: false, listeners: new Set() };
  // take removes the token now; every StrictMode attachment shares this promise.
  void takePendingPersistentHandoff(receiverId, entryPath).then(async files => {
    if (record.closed) return;
    if (!files) { record.pending = false; notifyPersistent(record); return; }
    record.files = files;
    record.invalidate = adapter.invalidate;
    const reject = (reasonCode: string): DeliveryResult => ({ status: "rejected", accepted: [], rejected: files.map(file => ({ file, reasonCode })) });
    const receive = Promise.resolve().then(() => record.closed ? reject("closed") : adapter.receive(files, { signal: record.abort.signal }));
    const timeout = adapter.kind === "inspection" ? new Promise<DeliveryResult>(resolve => {
      record.timeout = setTimeout(() => {
        record.abort.abort(); adapter.invalidate(); resolve(reject("timeout"));
      }, 30_000);
    }) : undefined;
    const cancelled = new Promise<DeliveryResult>(resolve => record.abort.signal.addEventListener("abort", () => {
      if (record.closed) resolve(reject("closed"));
    }, { once: true }));
    const value = await Promise.race(timeout ? [receive, timeout, cancelled] : [receive, cancelled]).catch(() => reject("failed"));
    clearTimeout(record.timeout);
    if (record.closed) return;
    // Accept only input identities explicitly acknowledged by the adapter.
    const accepted = value.status === "cancelled" ? [] : files.filter(file => value.accepted.includes(file));
    const rejected = files.filter(file => !accepted.includes(file)).map(file => ({ file,
      reasonCode: value.rejected.find(item => item.file === file)?.reasonCode ?? "not-accepted" }));
    record.result = { status: accepted.length === files.length ? "accepted" : accepted.length ? "partial" : "rejected", accepted: [], rejected };
    record.files = rejected.map(item => item.file); record.pending = false;
    notifyPersistent(record);
  }).catch(() => {
    if (record.closed) return;
    record.notReceived = true; record.pending = false; notifyPersistent(record);
  });
  return record;
}

/** Return accepted only after intake and the receiver's own leave protection are installed.
 * Inspection adapters must check signal/generation before every asynchronous state write;
 * invalidate must increment that generation before resetting the existing input.
 */
export function usePersistentHandoffReceiver(receiverId: PersistentReceiverId, adapter: PersistentHandoffAdapter) {
  const location = useLocation();
  const adapterRef = useRef(adapter); adapterRef.current = adapter;
  const owned = useRef<PersistentDelivery | null>(null);
  const [, update] = useState(0);
  useEffect(() => {
    const entryPath = stripLanguagePrefix(location.pathname).replace(/\/+$/, "");
    if (PERSISTENT_RECEIVERS[receiverId] !== entryPath) { owned.current = null; update(value => value + 1); return; }
    // Isolated documents do not necessarily mount AppShell. Clean only expired
    // records even when this visit has no token; never reopen earlier inputs.
    void purgeExpired().catch(() => undefined);
    const key = `${receiverId}:${location.key}:${entryPath}`;
    let record = persistentDeliveries.get(key);
    if (!record) { record = startPersistent(receiverId, entryPath, adapterRef.current); persistentDeliveries.set(key, record); }
    owned.current = record;
    clearTimeout(record.cleanup); record.owners++;
    const refresh = () => update(value => value + 1);
    record.listeners.add(refresh); refresh();
    return () => {
      record.listeners.delete(refresh); record.owners--;
      record.cleanup = setTimeout(() => {
        if (record.owners) return;
        closePersistent(record);
        if (persistentDeliveries.get(key) === record) persistentDeliveries.delete(key);
      }, 0);
    };
  }, [receiverId, location.key, location.pathname]);
  const record = owned.current;
  return { pending: record?.pending ?? false, notReceived: record?.notReceived ?? false,
    result: record?.result, recoveryFiles: record?.files ?? [],
    dismiss: () => { if (owned.current) closePersistent(owned.current); } };
}
