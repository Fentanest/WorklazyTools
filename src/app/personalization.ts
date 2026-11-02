import { useSyncExternalStore } from "react";
import { tools } from "./toolRegistry.ts";

export const PERSONALIZATION_KEYS = {
  recent: "worklazy:recent-tools",
  favorites: "worklazy:favorite-tools",
} as const;
type Kind = keyof typeof PERSONALIZATION_KEYS;
type StorageAccess = () => Pick<Storage, "getItem" | "setItem" | "removeItem">;
const toolIds = new Set(tools.map(tool => tool.id));
const empty = { recent: [] as readonly string[], favorites: [] as readonly string[], recentEnabled: true, favoritesEnabled: true };

/** Only published tool IDs cross the storage boundary. Invalid bytes stay untouched. */
export function createPersonalizationStore(storage: StorageAccess) {
  let snapshot = empty;
  let initialized = false;
  const listeners = new Set<() => void>();
  function read(kind: Kind) {
    try {
      const raw = storage().getItem(PERSONALIZATION_KEYS[kind]);
      if (raw === null) return { ids: [] as string[], enabled: true };
      const ids: unknown = JSON.parse(raw);
      if (!Array.isArray(ids) || ids.length > (kind === "recent" ? 6 : toolIds.size)
        || !ids.every(id => typeof id === "string" && toolIds.has(id)) || new Set(ids).size !== ids.length) {
        return { ids: [] as string[], enabled: false };
      }
      return { ids: ids as string[], enabled: true };
    } catch { return { ids: [] as string[], enabled: false }; }
  }
  function load() {
    const recent = read("recent"), favorites = read("favorites");
    snapshot = { recent: recent.ids, favorites: favorites.ids, recentEnabled: recent.enabled, favoritesEnabled: favorites.enabled };
    initialized = true;
  }
  function getSnapshot() { if (!initialized) load(); return snapshot; }
  function publish() { listeners.forEach(listener => listener()); }
  function save(kind: Kind, update: (latest: readonly string[]) => readonly string[], clear = false) {
    const before = getSnapshot();
    if (!before[`${kind}Enabled`]) return false;
    try {
      // Apply this action to the latest valid storage value: storage events from
      // another tab may still be queued when this tab handles a click or visit.
      const latest = read(kind);
      if (!latest.enabled) throw new Error("Storage unavailable");
      const ids = update(latest.ids);
      if (clear) storage().removeItem(PERSONALIZATION_KEYS[kind]);
      else storage().setItem(PERSONALIZATION_KEYS[kind], JSON.stringify(ids));
      snapshot = { ...before, [kind]: ids };
      publish();
      return true;
    } catch {
      snapshot = { ...before, [kind]: [], [`${kind}Enabled`]: false };
      publish();
      return false;
    }
  }
  return {
    getSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh() { load(); publish(); },
    record(id: string) {
      if (!toolIds.has(id)) return;
      save("recent", recent => [id, ...recent.filter(item => item !== id)].slice(0, 6));
    },
    toggle(id: string) {
      if (!toolIds.has(id)) return;
      save("favorites", favorites => favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id]);
    },
    clear(kind: Kind) { return save(kind, () => [], true); },
  };
}

export const personalization = createPersonalizationStore(() => window.localStorage);
export function usePersonalization() {
  return useSyncExternalStore(personalization.subscribe, personalization.getSnapshot, () => empty);
}

/** Receives a normalized pathname only; never persist a URL, search, title or filename. */
export function toolIdForPersonalization(path: string) {
  const pathname = path.replace(/\/+$/, "");
  return tools.find(tool => pathname === tool.path || pathname.startsWith(`${tool.path}/`))?.id;
}
