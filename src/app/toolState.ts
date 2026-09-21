import { useEffect } from "react";

// Unsaved-work registry (S9/WU3B). Tools report whether the user currently
// holds work that SPA navigation would destroy (selected files, unsaved
// edits, unsaved results). AppShell reads this registry *before* the route
// changes and shows an in-app confirmation dialog instead of navigating.
//
// Nothing here persists user content: only booleans and scope paths are kept.

export type UnsavedWorkKind = "files" | "edits";

export interface UnsavedWorkRegistration {
  hasWork: boolean;
  kind: UnsavedWorkKind;
  /** Stripped (language-prefix-free) path prefix of the owning tool. */
  scopePath: string;
}

interface StoredRegistration {
  hasWork: boolean;
  kind: UnsavedWorkKind;
  scopePath: string;
}

const entries = new Map<string, StoredRegistration>();
const listeners = new Set<() => void>();
let generation = 0;

function notify(): void {
  generation += 1;
  for (const listener of listeners) listener();
}

/** Monotonic identity for the current in-memory unsaved-work registrations. */
export function getUnsavedWorkGeneration(): number {
  return generation;
}

export function setUnsavedWork(toolId: string, registration: UnsavedWorkRegistration): void {
  const current = entries.get(toolId);
  if (
    current &&
    current.hasWork === registration.hasWork &&
    current.kind === registration.kind &&
    current.scopePath === registration.scopePath
  ) {
    return;
  }
  entries.set(toolId, { ...registration });
  notify();
}

export function clearUnsavedWork(toolId: string): void {
  if (entries.delete(toolId)) notify();
}

/** True when at least one tool currently holds work worth protecting. */
export function hasUnsavedWork(): boolean {
  for (const entry of entries.values()) {
    if (entry.hasWork) return true;
  }
  return false;
}

/**
 * Message variant for the guard dialog. File selections take precedence
 * because losing chosen files is the wider loss.
 */
export function getUnsavedWorkKind(): UnsavedWorkKind {
  let sawEdits = false;
  for (const entry of entries.values()) {
    if (!entry.hasWork) continue;
    if (entry.kind === "files") return "files";
    sawEdits = true;
  }
  return sawEdits ? "edits" : "files";
}

function withinScope(strippedTargetPath: string, scopePath: string): boolean {
  if (strippedTargetPath === scopePath) return true;
  return strippedTargetPath.startsWith(scopePath.endsWith("/") ? scopePath : `${scopePath}/`);
}

/**
 * Whether navigating to `strippedTargetPath` (language prefix already
 * removed) would abandon registered work. Targets inside the owning tool's
 * own scope (e.g. document-compare -> its results page) are safe.
 */
export function isGuardedTarget(strippedTargetPath: string): boolean {
  for (const entry of entries.values()) {
    if (!entry.hasWork) continue;
    if (withinScope(strippedTargetPath, entry.scopePath)) continue;
    return true;
  }
  return false;
}

export function subscribeUnsavedWork(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Register `hasWork` for `toolId` and unregister on unmount so stale state
 * never triggers the guard on unrelated screens.
 */
export function useUnsavedWorkGuard(
  toolId: string,
  hasWork: boolean,
  options: { kind: UnsavedWorkKind; scopePath: string },
): void {
  const { kind, scopePath } = options;
  useEffect(() => {
    setUnsavedWork(toolId, { hasWork, kind, scopePath });
    return () => {
      clearUnsavedWork(toolId);
    };
  }, [toolId, hasWork, kind, scopePath]);
}
