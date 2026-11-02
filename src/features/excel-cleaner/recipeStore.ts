import { validateExcelCleanerPipeline } from "./schema.ts";
import type { ExcelCleanerPipeline } from "./types.ts";

export const EXCEL_CLEANER_RECIPES_KEY = "worklazy:excel-cleaner-recipes";
export const MAX_RECIPES = 20;
export const MAX_RECIPE_NAME_LENGTH = 40;
export const MAX_RECIPES_BYTES = 256 * 1024;
export interface ExcelCleanerRecipe { name: string; savedAt: number; pipeline: ExcelCleanerPipeline }
export type RecipeStatus = "ok" | "corrupt" | "storage" | "name" | "limit" | "size" | "invalid";
export interface RecipeResult { status: RecipeStatus; recipes: ExcelCleanerRecipe[] }
type RecipeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
function browserStorage(): RecipeStorage { return window.localStorage; }
function recipeName(value: unknown): string {
  if (typeof value !== "string") throw new Error("name");
  const name = value.trim();
  if (!name || Array.from(name).length > MAX_RECIPE_NAME_LENGTH) throw new Error("name");
  return name;
}

// Reading never repairs or overwrites stored data. Ignore the entire damaged
// collection rather than silently discarding entries during the next save.
export function readRecipes(storage?: RecipeStorage): RecipeResult {
  let raw: string | null;
  try { raw = (storage ?? browserStorage()).getItem(EXCEL_CLEANER_RECIPES_KEY); }
  catch { return { status: "storage", recipes: [] }; }
  if (raw === null) return { status: "ok", recipes: [] };
  try {
    if (bytes(raw) > MAX_RECIPES_BYTES) throw new Error("size");
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.length > MAX_RECIPES) throw new Error("limit");
    const recipes = entries.map((entry): ExcelCleanerRecipe => {
      if (!entry || typeof entry !== "object" || Object.keys(entry).sort().join(",") !== "name,pipeline,savedAt") throw new Error("entry");
      if (!Number.isSafeInteger(entry.savedAt) || entry.savedAt < 0) throw new Error("date");
      return { name: recipeName(entry.name), savedAt: entry.savedAt, pipeline: validateExcelCleanerPipeline(entry.pipeline) };
    });
    return { status: "ok", recipes };
  } catch { return { status: "corrupt", recipes: [] }; }
}
function writeRecipes(recipes: ExcelCleanerRecipe[], storage?: RecipeStorage): RecipeResult {
  const raw = JSON.stringify(recipes);
  if (bytes(raw) > MAX_RECIPES_BYTES) return { status: "size", recipes: [] };
  // A single atomic setItem: never remove the previous value or attempt a
  // fallback write on quota/security errors.
  try { (storage ?? browserStorage()).setItem(EXCEL_CLEANER_RECIPES_KEY, raw); }
  catch { return { status: "storage", recipes: [] }; }
  return { status: "ok", recipes };
}
export function saveRecipe(name: string, pipeline: unknown, storage?: RecipeStorage): RecipeResult {
  let cleanName: string;
  try { cleanName = recipeName(name); } catch { return { status: "name", recipes: [] }; }
  let validated: ExcelCleanerPipeline;
  try { validated = validateExcelCleanerPipeline(pipeline); } catch { return { status: "invalid", recipes: [] }; }
  const current = readRecipes(storage);
  if (current.status !== "ok") return current;
  if (current.recipes.length >= MAX_RECIPES) return { status: "limit", recipes: current.recipes };
  return writeRecipes([...current.recipes, { name: cleanName, savedAt: Date.now(), pipeline: validated }], storage);
}
export function deleteRecipe(recipe: ExcelCleanerRecipe, storage?: RecipeStorage): RecipeResult {
  const current = readRecipes(storage);
  if (current.status !== "ok") return current;
  // Match the selected record, not an index that another tab may have shifted.
  const index = current.recipes.findIndex(item => item.name === recipe.name && item.savedAt === recipe.savedAt && JSON.stringify(item.pipeline) === JSON.stringify(recipe.pipeline));
  if (index < 0) return current;
  return writeRecipes(current.recipes.filter((_item, at) => at !== index), storage);
}
export function clearRecipes(storage?: RecipeStorage): RecipeResult {
  try { (storage ?? browserStorage()).removeItem(EXCEL_CLEANER_RECIPES_KEY); }
  catch { return { status: "storage", recipes: [] }; }
  return { status: "ok", recipes: [] };
}
