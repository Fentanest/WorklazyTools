import type { BannerInputProduct } from "./inputTypes.ts";
import { createDefaultSettings, updateSettings, type SettingsPatch } from "./settings.ts";
import { validateDiscount, validateImportedAt, validatePrice, validateProject } from "./projectJson.ts";
import { boolean, integer, oneOf, string } from "./stateValidation.ts";
import { BannerStateError, PROJECT_LIMITS, PROJECT_SCHEMA_VERSION, UNDO_LIMITS, type BannerEditorState, type BannerLanguage, type BannerProject, type EditProduct, type ImageStatus } from "./stateTypes.ts";
import { validateProductUrl } from "./urlPolicy.ts";

export type EditorAction =
  | { type: "select"; ids: readonly string[]; selected: boolean }
  | { type: "select-all"; selected: boolean }
  | { type: "include"; ids: readonly string[]; included: boolean }
  | { type: "delete"; ids: readonly string[] }
  | { type: "move"; id: string; to: number }
  | { type: "move-step"; id: string; direction: "up" | "down" }
  | { type: "edit"; id: string; changes: Partial<Pick<EditProduct, "name" | "imageUrl" | "promotionUrl">> }
  | { type: "image-status"; id: string; url: string; status: ImageStatus }
  | { type: "settings"; patch: SettingsPatch }
  | { type: "append" | "replace"; products: readonly BannerInputProduct[]; importedAt: string; confirmDiscard?: boolean }
  | { type: "load"; project: BannerProject; confirmDiscard?: boolean }
  | { type: "undo" }
  | { type: "mark-saved" };

export function createEditorState(language: BannerLanguage): BannerEditorState {
  const project: BannerProject = { schemaVersion: PROJECT_SCHEMA_VERSION, nextId: 1, products: [], settings: createDefaultSettings(language) };
  return { project, selectedIds: [], past: [], savedProject: project, imageStates: {} };
}
export function hasUnsavedChanges(state: BannerEditorState): boolean { return state.project !== state.savedProject; }
export function hasBannerWork(state: BannerEditorState): boolean { return state.project.products.length > 0 || hasUnsavedChanges(state); }
export function imageStatus(state: BannerEditorState, id: string): ImageStatus {
  const product = state.project.products.find((p) => p.id === id), entry = state.imageStates[id];
  return product && entry?.url === product.imageUrl ? entry.status : "unchecked";
}
export function productReviewFields(product: EditProduct): ("name" | "imageUrl" | "promotionUrl")[] {
  const fields: ("name" | "imageUrl" | "promotionUrl")[] = [];
  if (!product.name.trim()) fields.push("name");
  for (const key of ["imageUrl", "promotionUrl"] as const) if (!validateProductUrl(product[key]).valid) fields.push(key);
  return fields;
}
/** Duplicate annotations are derived, never deletion/sorting instructions. Empty keys are ignored. */
export function detectDuplicates(products: readonly EditProduct[]): { by: "productId" | "promotionUrl"; ids: string[] }[] {
  const groups: { by: "productId" | "promotionUrl"; ids: string[] }[] = [];
  for (const by of ["productId", "promotionUrl"] as const) {
    const index = new Map<string, string[]>();
    for (const p of products) {
      const key = p[by];
      if (key) { const ids = index.get(key); if (ids) ids.push(p.id); else index.set(key, [p.id]); }
    }
    for (const ids of index.values()) if (ids.length > 1) groups.push({ by, ids });
  }
  return groups;
}
function commit(state: BannerEditorState, project: BannerProject, selectedIds = state.selectedIds): BannerEditorState {
  if (project === state.project) return state;
  const past = [...state.past, { project: state.project, selectedIds: state.selectedIds }];
  let slots = past.reduce((total, entry) => total + entry.project.products.length, 0);
  while (past.length > UNDO_LIMITS.steps || slots > UNDO_LIMITS.productSlots) slots -= past.shift()!.project.products.length;
  const imageStates: Record<string, { url: string; status: ImageStatus }> = {};
  for (const p of project.products) {
    const entry = state.imageStates[p.id];
    if (entry?.url === p.imageUrl) imageStates[p.id] = entry;
  }
  return { ...state, project, selectedIds, past, imageStates };
}
function importProducts(products: readonly BannerInputProduct[], start: number, importedAt: string): EditProduct[] {
  validateImportedAt(importedAt);
  integer(start + products.length, 1, 10_000_000_000);
  return products.map((p, i) => ({ id: `pb-${start + i}`, originalOrder: start + i, included: true,
    name: string(p.name), imageUrl: string(p.imageUrl).trim(), promotionUrl: string(p.promotionUrl).trim(),
    originalUrls: { imageUrl: string(p.originalUrls.imageUrl), promotionUrl: string(p.originalUrls.promotionUrl) }, productId: p.productId === null ? null : string(p.productId),
    originPrice: validatePrice(p.originPrice), discountPrice: validatePrice(p.discountPrice), discount: validateDiscount(p.discount),
    source: { fileIndex: integer(p.source.fileIndex), sheetIndex: integer(p.source.sheetIndex), rowNumber: integer(p.source.rowNumber, 1), importedAt } }));
}
function requireReplacementApproval(state: BannerEditorState, confirmation?: boolean): void {
  if (hasBannerWork(state) && confirmation !== true) throw new BannerStateError("REPLACEMENT_CONFIRMATION_REQUIRED");
}
function requireProduct(state: BannerEditorState, id: string): EditProduct {
  const product = state.project.products.find((p) => p.id === id);
  if (!product) throw new BannerStateError("INVALID_ACTION");
  return product;
}
export function reduceEditorState(state: BannerEditorState, action: EditorAction): BannerEditorState {
  const project = state.project;
  switch (action.type) {
    case "select-all": return { ...state, selectedIds: boolean(action.selected) ? project.products.map((p) => p.id) : [] };
    case "select": {
      const ids = new Set(state.selectedIds), selected = boolean(action.selected);
      for (const id of action.ids) { requireProduct(state, id); if (selected) ids.add(id); else ids.delete(id); }
      return { ...state, selectedIds: project.products.filter((p) => ids.has(p.id)).map((p) => p.id) };
    }
    case "include": case "delete": {
      const ids = new Set(action.ids);
      for (const id of ids) requireProduct(state, id);
      const included = action.type === "include" ? boolean(action.included) : false;
      const products = action.type === "delete" ? project.products.filter((p) => !ids.has(p.id))
        : project.products.map((p) => ids.has(p.id) && p.included !== included ? { ...p, included } : p);
      if (products.length === project.products.length && products.every((p, i) => p === project.products[i])) return state;
      const retainedIds = new Set(products.map((p) => p.id));
      return commit(state, { ...project, products }, state.selectedIds.filter((id) => retainedIds.has(id)));
    }
    case "move-step": case "move": {
      requireProduct(state, action.id);
      const from = project.products.findIndex((p) => p.id === action.id);
      const to = action.type === "move" ? integer(action.to, 0, project.products.length - 1)
        : Math.max(0, Math.min(project.products.length - 1, from + (oneOf(action.direction, ["up", "down"]) === "up" ? -1 : 1)));
      if (from === to) return state;
      const products = [...project.products]; products.splice(to, 0, products.splice(from, 1)[0]);
      return commit(state, { ...project, products });
    }
    case "edit": {
      const current = requireProduct(state, action.id);
      const changes: { name?: string; imageUrl?: string; promotionUrl?: string } = {};
      for (const field of ["name", "imageUrl", "promotionUrl"] as const) {
        if (Object.hasOwn(action.changes, field)) changes[field] = field === "name" ? string(action.changes[field]) : string(action.changes[field]).trim();
      }
      if (Object.entries(changes).every(([key, value]) => current[key as keyof typeof changes] === value)) return state;
      return commit(state, { ...project, products: project.products.map((p) => p.id === action.id ? { ...p, ...changes } : p) });
    }
    case "image-status": {
      const product = requireProduct(state, action.id), status = oneOf(action.status, ["unchecked", "checking", "success", "failure"]);
      // Stale load/error callbacks for a previous URL must not mark an edited image as successful.
      if (product.imageUrl !== action.url) return state;
      return { ...state, imageStates: { ...state.imageStates, [action.id]: { url: action.url, status } } };
    }
    case "settings": {
      const settings = updateSettings(project.settings, action.patch);
      return JSON.stringify(settings) === JSON.stringify(project.settings) ? state : commit(state, { ...project, settings });
    }
    case "append": case "replace": {
      if (action.type === "replace") requireReplacementApproval(state, action.confirmDiscard);
      const retained = action.type === "append" ? project.products : [];
      if (retained.length + action.products.length > PROJECT_LIMITS.products) throw new BannerStateError("PROJECT_LIMIT");
      if (action.type === "append" && !action.products.length) return state;
      const products = [...retained, ...importProducts(action.products, project.nextId, action.importedAt)];
      return commit(state, { ...project, products, nextId: project.nextId + action.products.length }, action.type === "append" ? state.selectedIds : []);
    }
    case "load": {
      requireReplacementApproval(state, action.confirmDiscard);
      const loaded = validateProject(action.project), next = commit(state, loaded, []);
      return { ...next, savedProject: loaded, imageStates: {} };
    }
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      // Observed image success is session-local; undo/load do not claim old URLs have just loaded.
      return { ...state, ...previous, past: state.past.slice(0, -1), imageStates: {} };
    }
    case "mark-saved": return { ...state, savedProject: project };
  }
}
