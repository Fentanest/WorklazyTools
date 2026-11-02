import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { ReceiverId } from "./fileAccepts";
import { claimHandoff, closeDelivery, deliverHandoff, findDelivery, getDelivery, retainDelivery, subscribeHandoff, wasHandoffConsumed, type Delivery, type DeliveryResult, type HandoffAdapter, type HandoffToken } from "./memoryHandoff";
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
  return { notReceived, result, recoveryFiles: owned.current.flatMap(item => item.closed ? [] : item.files),
    dismiss: () => { for (const item of owned.current) closeDelivery(item); owned.current = []; record.current = null; setResult(undefined); setNotReceived(false); } };
}
