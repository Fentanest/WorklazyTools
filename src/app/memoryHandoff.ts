import { holdAutoReload, release } from "./chunkRecovery.ts";
import { acceptsFile, fileAccepts, type ReceiverId } from "./fileAccepts.ts";
import { clearUnsavedWork, setUnsavedWork } from "./toolState.ts";

export interface HandoffInput {
  receiverId: ReceiverId; entryPath: string; files: File[];
  roles?: ("template" | "data")[]; tab?: "edit" | "batch";
  origin: "user-input" | "generated"; source: string;
}
export interface HandoffEntry extends HandoffInput {
  id: string; nonce: string; schema: 1; createdAt: number; expiresAt: number;
}
export interface HandoffToken { id: string; nonce: string }
export interface DeliveryResult {
  status: "accepted" | "partial" | "rejected" | "cancelled";
  accepted: File[]; rejected: { file: File; reasonCode: string }[];
}
// Inspection receivers must check signal/generation before every state write;
// invalidate increments their generation before calling their existing reset.
export interface IntakeContext { signal: AbortSignal }
export type HandoffAdapter = {
  receive: (entry: HandoffEntry, context: IntakeContext) => DeliveryResult | Promise<DeliveryResult>;
} & ({ kind: "selection"; invalidate?: () => void } | { kind: "inspection"; invalidate: () => void });
export interface Delivery {
  entry: HandoffEntry; path: string; locationKey: string; files: File[];
  promise: Promise<DeliveryResult>; result?: DeliveryResult; closed: boolean;
  owners: number; cleanup?: ReturnType<typeof setTimeout>; abort: AbortController;
  invalidate?: () => void; releaseHold?: () => void;
}
export interface Recovery { files: File[]; source: string; reason: string; path: string }
const TTL = 60_000;
let slot: HandoffEntry | null = null;
let slotRelease: (() => void) | undefined;
let slotTimer: ReturnType<typeof setTimeout> | undefined;
const deliveries = new Map<string, Delivery>();
// Superseded chips are owned by their mounted receiver, not this cache.
const mountedChips = new Set<WeakRef<Delivery>>();
const claimedHolds = new WeakMap<HandoffEntry, () => void>();
let recovery: Recovery | null = null;
let recoveryReleases: (() => void)[] = [];
let deferredError: (() => void) | undefined;
const listeners = new Set<() => void>();
export function subscribeHandoff(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
function emit() { for (const listener of listeners) listener(); }
export function getRecovery(): Recovery | null { return recovery; }
export function acquireGeneratedHold(): () => void {
  holdAutoReload(); let held = true;
  return () => { if (held) { held = false; release(); } };
}
export function validateHandoff(input: HandoffInput): string | null {
  const definition = fileAccepts[input.receiverId];
  if (!definition || !(definition.paths as readonly string[]).includes(input.entryPath)) return "destination";
  if (!input.files.length || input.files.length > definition.max) return "count";
  if (input.receiverId === "document-generator") {
    if (input.roles?.length !== input.files.length || input.roles.filter(role => role === "template").length !== 1
      || !input.roles.includes("data") || input.files.some((file, i) => !((input.roles![i] === "template" ? ["docx"] : ["xlsx", "csv"]).includes(file.name.split(".").pop()?.toLowerCase() ?? "")))) return "roles";
  }
  if ((input.receiverId === "image-edit" && input.tab !== "edit") || (input.receiverId === "image-batch" && input.tab !== "batch")) return "destination";
  return null;
}
function clearSlot() {
  slot = null; clearTimeout(slotTimer); slotTimer = undefined;
  slotRelease?.(); slotRelease = undefined;
}
export function stageHandoff(input: HandoffInput, now = Date.now()): HandoffToken {
  const reason = validateHandoff(input);
  if (reason) throw new Error(reason);
  if (input.origin !== "generated" && input.origin !== "user-input") throw new Error("origin");
  // Mint both values before replacing a previous slot, including crypto failure.
  const id = crypto.randomUUID(), nonce = crypto.randomUUID();
  const nextRelease = input.origin === "generated" ? acquireGeneratedHold() : undefined;
  clearSlot();
  slot = { ...input, files: [...input.files], roles: input.roles && [...input.roles], id, nonce, schema: 1, createdAt: now, expiresAt: now + TTL };
  slotRelease = nextRelease;
  slotTimer = setTimeout(() => { clearSlot(); emit(); }, TTL);
  slotTimer.unref?.();
  return { id, nonce };
}
export function cancelStagedHandoff(token: HandoffToken): void {
  if (slot?.id === token.id && slot.nonce === token.nonce) { clearSlot(); emit(); }
}
/** The caller clears history state immediately when this returns an entry. */
export function claimHandoff(token: HandoffToken, receiverId: ReceiverId, entryPath: string, now = Date.now()): HandoffEntry | null {
  if (slot && now >= slot.expiresAt) clearSlot();
  if (!slot || slot.id !== token.id || slot.nonce !== token.nonce || slot.receiverId !== receiverId || slot.entryPath !== entryPath || slot.schema !== 1) return null;
  const entry = slot;
  // Transfer the existing hold to delivery creation, without a release gap.
  slot = null; clearTimeout(slotTimer); slotTimer = undefined;
  if (slotRelease) claimedHolds.set(entry, slotRelease);
  slotRelease = undefined;
  return entry;
}
function rejected(entry: HandoffEntry, reasonCode: string): DeliveryResult {
  return { status: "rejected", accepted: [], rejected: entry.files.map(file => ({ file, reasonCode })) };
}
function normalizeResult(entry: HandoffEntry, result: DeliveryResult): DeliveryResult {
  const accepted = result.accepted.filter(file => entry.files.includes(file));
  const remaining = entry.files.filter(file => !accepted.includes(file));
  if (result.status === "cancelled") return { ...rejected(entry, "cancelled"), status: "cancelled" };
  return { status: remaining.length ? (accepted.length ? "partial" : "rejected") : "accepted", accepted,
    rejected: remaining.map(file => ({ file, reasonCode: result.rejected.find(item => item.file === file)?.reasonCode ?? "rejected" })) };
}
export function getDelivery(id: string): Delivery | undefined { return deliveries.get(id); }
export function findDelivery(receiverId: ReceiverId, path: string, locationKey: string): Delivery | undefined {
  return [...deliveries.values()].find(record => !record.closed && record.entry.receiverId === receiverId && record.path === path && record.locationKey === locationKey);
}
export function deliverHandoff(entry: HandoffEntry, path: string, locationKey: string, adapter: HandoffAdapter): Delivery {
  const existing = deliveries.get(entry.id);
  if (existing) return existing;
  // The former chip remains owned by its mounted hook, not the active cache.
  deliveries.clear();
  const record: Delivery = { entry, path, locationKey, files: entry.files, promise: null!, closed: false, owners: 0,
    abort: new AbortController(), invalidate: adapter.invalidate, releaseHold: claimedHolds.get(entry) };
  claimedHolds.delete(entry);
  deliveries.set(entry.id, record);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const receive = Promise.resolve().then(() => record.closed ? rejected({ ...entry, files: [] }, "closed") : adapter.receive(entry, { signal: record.abort.signal }));
  const cancelled = new Promise<DeliveryResult>(resolve => {
    record.abort.signal.addEventListener("abort", () => { if (record.closed) resolve(rejected({ ...entry, files: [] }, "closed")); }, { once: true });
  });
  const timeout = adapter.kind === "inspection" ? new Promise<DeliveryResult>(resolve => {
    timer = setTimeout(() => {
      record.abort.abort(); adapter.invalidate?.(); resolve(rejected(entry, "timeout"));
    }, 30_000);
  }) : null;
  record.promise = Promise.race(timeout ? [receive, timeout, cancelled] : [receive, cancelled]).catch(() => rejected(entry, "failed")).then(result => {
    clearTimeout(timer);
    if (record.closed) return rejected({ ...entry, files: [] }, "closed");
    const normalized = normalizeResult(entry, result);
    // Do not retain accepted files in the delivery cache.
    record.result = { ...normalized, accepted: [] };
    record.files = normalized.rejected.map(item => item.file);
    // Successful input ownership is already with the receiver at this point.
    entry.files = [];
    if (!record.files.length) closeDelivery(record);
    emit(); return normalized;
  });
  return record;
}
export function closeDelivery(record: Delivery): void {
  if (record.closed) return;
  record.closed = true; clearTimeout(record.cleanup);
  if (!record.result && !record.abort.signal.aborted) { record.abort.abort(); record.invalidate?.(); }
  record.files = []; record.entry.files = []; record.result = undefined;
  if (deliveries.get(record.entry.id) === record) deliveries.delete(record.entry.id);
  record.releaseHold?.(); record.releaseHold = undefined; emit();
}
export function retainDelivery(record: Delivery): () => void {
  record.owners++; clearTimeout(record.cleanup);
  const reference = new WeakRef(record); mountedChips.add(reference);
  return () => {
    record.owners--; mountedChips.delete(reference);
    record.cleanup = setTimeout(() => {
      if (record.owners || record.closed) return;
      if (`${window.location.pathname}${window.location.search}` !== record.path) closeDelivery(record);
      else if (record.entry.origin === "generated") transferToRecovery("unmount", [record]);
      else closeDelivery(record);
    }, 0);
  };
}
export function transferToRecovery(reason = "route-error", extra: Delivery[] = []): void {
  const candidates: { files: File[]; source: string; release?: () => void }[] = [];
  if (slot?.origin === "generated") {
    candidates.push({ files: slot.files, source: slot.source, release: slotRelease });
    slotRelease = undefined; clearSlot();
  }
  const records = new Set([...deliveries.values(), ...extra]);
  for (const reference of mountedChips) {
    const record = reference.deref();
    if (record) records.add(record); else mountedChips.delete(reference);
  }
  for (const record of records) {
    if (record.entry.origin !== "generated" || record.closed) continue;
    candidates.push({ files: record.files, source: record.entry.source, release: record.releaseHold });
    record.releaseHold = undefined; closeDelivery(record);
  }
  if (!candidates.length) return;
  recovery = { files: [...(recovery?.files ?? []), ...candidates.flatMap(item => item.files)], source: candidates[0].source, reason,
    path: `${window.location.pathname}${window.location.search}` };
  recoveryReleases.push(...candidates.flatMap(item => item.release ? [item.release] : []));
  setUnsavedWork("handoff-recovery", { hasWork: true, kind: "files", scopePath: "/handoff-recovery", safePaths: [], messageKey: "handoff.unsavedResult" });
  emit();
}
/** Preserve the original error-document transition until explicit recovery. */
export function deferErrorNavigation(action: () => void): boolean {
  if (!recovery?.files.length) return false;
  deferredError = action; return true;
}
export function clearRecovery(runDeferred = true): void {
  recovery = null; clearUnsavedWork("handoff-recovery");
  for (const releaseHold of recoveryReleases) releaseHold();
  recoveryReleases = []; const action = deferredError; deferredError = undefined; emit();
  if (runDeferred) action?.();
}
export function reconcileHandoffLocation(): void {
  const path = `${window.location.pathname}${window.location.search}`;
  if (recovery && recovery.path !== path) clearRecovery();
  for (const record of deliveries.values()) if (record.path !== path) closeDelivery(record);
}
export function purgeExpiredHandoffs(now = Date.now()): void {
  if (slot && now >= slot.expiresAt) clearSlot();
  for (const record of deliveries.values()) if (now >= record.entry.expiresAt) closeDelivery(record);
  emit();
}
// bfcache preserves the heap. Reconcile its real age when it returns.
if (typeof window !== "undefined") window.addEventListener("pageshow", event => { if (event.persisted) purgeExpiredHandoffs(); });
/** Selection adapters use the same synchronous filter as the tool input. */
export function selectHandoffFiles(receiverId: ReceiverId, files: File[], remaining = fileAccepts[receiverId].max): DeliveryResult {
  const accepted = files.filter(file => acceptsFile(receiverId, file)).slice(0, Math.max(0, remaining));
  return { status: accepted.length === files.length ? "accepted" : accepted.length ? "partial" : "rejected", accepted,
    rejected: files.filter(file => !accepted.includes(file)).map(file => ({ file, reasonCode: "unsupported-or-limit" })) };
}
