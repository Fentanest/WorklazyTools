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
  /**
   * Exact set of normalized absolute paths treated as safe (W1).
   * When registered, the scope-prefix rule is NOT applied (no OR).
   * Entries must be full paths with at least two segments
   * (e.g. "/tools/pdf-editor/merge"); relative notations and
   * root-level guesses like "/merge" are rejected at registration.
   */
  safePaths?: string[];
  /** Localization key for the guard dialog description (W1). */
  messageKey?: string;
}

interface StoredRegistration {
  hasWork: boolean;
  kind: UnsavedWorkKind;
  scopePath: string;
  safePaths?: string[];
  messageKey?: string;
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
  const normalizedSafePaths = registration.safePaths?.map((candidate) => {
    const normalized = normalizeSafePath(candidate);
    if (!normalized) {
      throw new Error(`setUnsavedWork: refusing non-canonical safePaths entry for "${toolId}": ${JSON.stringify(candidate)}`);
    }
    return normalized;
  });
  const current = entries.get(toolId);
  if (
    current &&
    current.hasWork === registration.hasWork &&
    current.kind === registration.kind &&
    current.scopePath === registration.scopePath &&
    joinPaths(current.safePaths) === joinPaths(normalizedSafePaths) &&
    (current.messageKey ?? "") === (registration.messageKey ?? "")
  ) {
    return;
  }
  entries.set(toolId, {
    hasWork: registration.hasWork,
    kind: registration.kind,
    scopePath: registration.scopePath,
    ...(normalizedSafePaths ? { safePaths: normalizedSafePaths } : {}),
    ...(registration.messageKey ? { messageKey: registration.messageKey } : {}),
  });
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
 *
 * When a registration carries `safePaths`, that exact set replaces the
 * scope-prefix rule (no OR): only a normalized exact match is safe.
 * A one-shot grant (grantOneShotSafeTarget) lets the granting tool's entry
 * pass one evaluation of its exact path.
 */
export function isGuardedTarget(strippedTargetPath: string): boolean {
  const normalizedTarget = normalizeTargetPath(strippedTargetPath);
  for (const [toolId, entry] of entries) {
    if (!entry.hasWork) continue;
    if (entry.safePaths) {
      if (entry.safePaths.includes(normalizedTarget)) continue;
      if (consumeOneShotSafeTarget(toolId, normalizedTarget)) continue;
      return true;
    }
    if (withinScope(normalizedTarget, entry.scopePath)) continue;
    return true;
  }
  return false;
}

/**
 * First registered custom dialog message, in registration order.
 * Callers fall back to the kind-based message when this is undefined.
 */
export function getUnsavedWorkMessageKey(): string | undefined {
  for (const entry of entries.values()) {
    if (!entry.hasWork) continue;
    if (entry.messageKey) return entry.messageKey;
  }
  return undefined;
}

/**
 * Normalize a safePaths/one-shot entry to a canonical absolute path.
 * Returns null for relative notations, dot segments, query/hash suffixes,
 * and root-level guesses like "/merge" (full paths carry ≥2 segments).
 */
export function normalizeSafePath(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.includes("\\")) return null;
  if (/(^|\/)\.\.?(?:\/|$)/.test(trimmed)) return null;
  if (/[\s?#]/.test(trimmed)) return null;
  const collapsed = trimmed.replace(/\/{2,}/g, "/");
  const stripped = collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
  if (stripped.split("/").filter(Boolean).length < 2) return null;
  return stripped;
}

function normalizeTargetPath(strippedTargetPath: string): string {
  const collapsed = strippedTargetPath.replace(/\/{2,}/g, "/");
  return (collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed) || "/";
}

function joinPaths(paths: readonly string[] | undefined): string {
  return (paths ?? []).join("\n");
}

/** Test hook: last consumed grant that a failed perform() may restore. */
export function __clearToolStateForTests(): void {
  entries.clear();
  oneShotSafeTarget = null;
  lastConsumedOneShot = null;
  generation = 0;
  for (const listener of [...listeners]) listener();
}

interface OneShotSafeTarget {
  toolId: string;
  path: string;
  expiresAt: number;
  href: string;
}

/** One-shot allowances live outside registrations (W1, plan §4.1). */
let oneShotSafeTarget: OneShotSafeTarget | null = null;
let lastConsumedOneShot: OneShotSafeTarget | null = null;

/** How long a one-shot allowance survives without being evaluated. */
export const ONE_SHOT_SAFE_TARGET_TTL_MS = 5000;

/**
 * Grant the exact normalized target path a single evaluation pass for
 * `toolId`. Consumed by the first isGuardedTarget evaluation of that path;
 * any other path, a second evaluation, a document-URL change, or the TTL
 * expiry removes it. hasWork is untouched, so all other targets stay guarded.
 */
export function grantOneShotSafeTarget(toolId: string, targetPath: string): void {
  const normalized = normalizeSafePath(targetPath);
  if (!normalized) {
    throw new Error(`grantOneShotSafeTarget: refusing non-canonical target path: ${JSON.stringify(targetPath)}`);
  }
  oneShotSafeTarget = {
    toolId,
    path: normalized,
    expiresAt: Date.now() + ONE_SHOT_SAFE_TARGET_TTL_MS,
    href: typeof window !== "undefined" ? window.location.href : "",
  };
  lastConsumedOneShot = null;
  notify();
}

/** Drop a pending one-shot grant (e.g. the handoff was cancelled). */
export function revokeOneShotSafeTarget(toolId: string): void {
  if (oneShotSafeTarget?.toolId === toolId) {
    oneShotSafeTarget = null;
    lastConsumedOneShot = null;
    notify();
  }
}

/**
 * Restore the most recently consumed grant when perform() reported failure
 * (the navigation did not happen). A grant invalidated by another path,
 * a route change, or TTL expiry is not restored.
 */
export function restoreLastOneShotSafeTarget(): void {
  if (!oneShotSafeTarget && lastConsumedOneShot && Date.now() <= lastConsumedOneShot.expiresAt) {
    oneShotSafeTarget = { ...lastConsumedOneShot };
  }
  lastConsumedOneShot = null;
  notify();
}

/** Test hook: inspect the pending one-shot grant, if any. */
export function __peekOneShotSafeTargetForTests(): { toolId: string; path: string } | null {
  return oneShotSafeTarget ? { toolId: oneShotSafeTarget.toolId, path: oneShotSafeTarget.path } : null;
}

function consumeOneShotSafeTarget(toolId: string, normalizedTarget: string): boolean {
  if (!oneShotSafeTarget) return false;
  const href = typeof window !== "undefined" ? window.location.href : "";
  const grant = oneShotSafeTarget;
  const expired =
    Date.now() > grant.expiresAt || (grant.href !== "" && href !== "" && href !== grant.href);
  oneShotSafeTarget = null;
  if (expired || grant.toolId !== toolId || grant.path !== normalizedTarget) {
    lastConsumedOneShot = null;
    return false;
  }
  lastConsumedOneShot = grant;
  return true;
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
  options: { kind: UnsavedWorkKind; scopePath: string; safePaths?: string[]; messageKey?: string },
): void {
  const { kind, scopePath, safePaths, messageKey } = options;
  // Join for the dep: a fresh-but-equal array must not re-register (N5-1).
  const safePathsKey = (safePaths ?? []).join("\n");
  useEffect(() => {
    setUnsavedWork(toolId, {
      hasWork,
      kind,
      scopePath,
      ...(safePaths ? { safePaths: [...safePaths] } : {}),
      ...(messageKey ? { messageKey } : {}),
    });
    return () => {
      clearUnsavedWork(toolId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId, hasWork, kind, scopePath, safePathsKey, messageKey]);
}
