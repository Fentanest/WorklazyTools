import {
  EXCEL_CLEANER_MAX_JSON_BYTES,
  EXCEL_CLEANER_MAX_RULES,
  EXCEL_CLEANER_RULE_TYPES,
  type ExcelCleanerDateFormat,
  type ExcelCleanerPipeline,
  type ExcelCleanerRule,
  type ExcelCleanerRuleType,
  type FilterOperator,
} from "./types.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RULE_TYPES = new Set<string>(EXCEL_CLEANER_RULE_TYPES);
const DATE_FORMATS = new Set<ExcelCleanerDateFormat>(["yyyy-mm-dd", "yyyy.mm.dd", "yyyy/mm/dd", "yyyymmdd", "mm/dd/yyyy", "dd/mm/yyyy", "yyyy-mm-dd hh:mm", "yyyy-mm-dd hh:mm:ss"]);
const FILTER_OPERATORS = new Set<FilterOperator>(["equals", "contains", "regex", "empty", "number-gt", "number-gte", "number-lt", "number-lte", "number-eq"]);

export class ExcelCleanerValidationError extends Error {
  readonly code = "INVALID_PIPELINE";
  readonly path: string;

  constructor(path: string) {
    super("INVALID_PIPELINE");
    this.name = "ExcelCleanerValidationError";
    this.path = path;
  }
}

export function validateExcelCleanerPipeline(input: unknown): ExcelCleanerPipeline {
  const rawText = typeof input === "string" ? input : JSON.stringify(input);
  if (new TextEncoder().encode(rawText).byteLength > EXCEL_CLEANER_MAX_JSON_BYTES) invalid("$");
  let value: unknown = input;
  if (typeof input === "string") {
    try { value = JSON.parse(input); }
    catch { invalid("$"); }
  }
  const root = object(value, "$", ["version", "rules"]);
  exactKeys(root, "$", ["version", "rules"]);
  if (root.version !== 1) invalid("$.version");
  if (!Array.isArray(root.rules) || root.rules.length > EXCEL_CLEANER_MAX_RULES) invalid("$.rules");
  const instanceIds = new Set<string>();
  const outputIds = new Set<string>();
  const rules = root.rules.map((candidate, index) => {
    const rule = validateRule(candidate, `$.rules[${index}]`);
    if (instanceIds.has(rule.id)) invalid(`$.rules[${index}].id`);
    instanceIds.add(rule.id);
    for (const outputId of generatedColumnIds(rule)) {
      if (outputIds.has(outputId)) invalid(`$.rules[${index}].outputColumnId`);
      outputIds.add(outputId);
    }
    return rule;
  });
  return { version: 1, rules };
}

function validateRule(value: unknown, path: string): ExcelCleanerRule {
  const rule = object(value, path, ["type", "id"]);
  const typeValue = string(rule.type, `${path}.type`, 100, 1);
  if (!RULE_TYPES.has(typeValue)) invalid(`${path}.type`);
  const type = typeValue as ExcelCleanerRuleType;
  const id = string(rule.id, `${path}.id`, 36);
  if (!UUID.test(id)) invalid(`${path}.id`);
  const base = { type, id };
  switch (type) {
    case "trim-edge-empty":
      exactKeys(rule, path, ["type", "id", "axis"]);
      return { ...base, type, axis: optionalEnum(rule.axis, `${path}.axis`, ["rows", "columns", "both"]) ?? "both" };
    case "remove-empty-rows": case "remove-empty-columns": case "unmerge-cells": case "unmerge-fill-down": case "dedupe-rows":
      exactKeys(rule, path, ["type", "id"]);
      return base as ExcelCleanerRule;
    case "collapse-consecutive-empty":
      exactKeys(rule, path, ["type", "id", "axis", "minRun"]);
      return { ...base, type, axis: enumValue(rule.axis, `${path}.axis`, ["rows", "columns"]), minRun: integer(rule.minRun, `${path}.minRun`, 1, 1000) };
    case "rename-column":
      exactKeys(rule, path, ["type", "id", "columnId", "newName"]);
      return { ...base, type, columnId: identifier(rule.columnId, `${path}.columnId`), newName: string(rule.newName, `${path}.newName`, 1000) };
    case "reorder-columns":
      exactKeys(rule, path, ["type", "id", "order"]);
      return { ...base, type, order: identifiers(rule.order, `${path}.order`, 1) };
    case "delete-columns":
      exactKeys(rule, path, ["type", "id", "columnIds"]);
      return { ...base, type, columnIds: identifiers(rule.columnIds, `${path}.columnIds`, 1) };
    case "combine-columns":
      exactKeys(rule, path, ["type", "id", "columnIds", "separator", "outputColumnId", "outputName", "removeSources"]);
      return { ...base, type, columnIds: identifiers(rule.columnIds, `${path}.columnIds`, 2), separator: optionalString(rule.separator, `${path}.separator`) ?? "", outputColumnId: identifier(rule.outputColumnId, `${path}.outputColumnId`), outputName: string(rule.outputName, `${path}.outputName`, 1000), removeSources: optionalBoolean(rule.removeSources, `${path}.removeSources`) ?? true };
    case "split-column": {
      exactKeys(rule, path, ["type", "id", "columnId", "mode", "pattern", "maxParts", "outputColumnIds", "outputNames", "removeSource"]);
      const mode = enumValue(rule.mode, `${path}.mode`, ["delimiter", "regex"]);
      const pattern = string(rule.pattern, `${path}.pattern`, mode === "regex" ? 500 : 1000);
      if (mode === "regex") compileRegex(pattern, "", `${path}.pattern`);
      const maxParts = integer(rule.maxParts, `${path}.maxParts`, 1, 50);
      const outputColumnIds = identifiers(rule.outputColumnIds, `${path}.outputColumnIds`, maxParts, maxParts);
      const outputNames = strings(rule.outputNames, `${path}.outputNames`, maxParts, maxParts);
      return { ...base, type, columnId: identifier(rule.columnId, `${path}.columnId`), mode, pattern, maxParts, outputColumnIds, outputNames, removeSource: optionalBoolean(rule.removeSource, `${path}.removeSource`) ?? true };
    }
    case "add-constant-column":
      exactKeys(rule, path, ["type", "id", "value", "outputColumnId", "outputName", "position"]);
      if (!("value" in rule)) invalid(`${path}.value`);
      return { ...base, type, value: scalar(rule.value, `${path}.value`), outputColumnId: identifier(rule.outputColumnId, `${path}.outputColumnId`), outputName: string(rule.outputName, `${path}.outputName`, 1000), position: optionalEnum(rule.position, `${path}.position`, ["start", "end"]) ?? "end" };
    case "add-row-number-column":
      exactKeys(rule, path, ["type", "id", "startAt", "outputColumnId", "outputName", "position"]);
      return { ...base, type, startAt: optionalInteger(rule.startAt, `${path}.startAt`, 0, Number.MAX_SAFE_INTEGER) ?? 1, outputColumnId: identifier(rule.outputColumnId, `${path}.outputColumnId`), outputName: string(rule.outputName, `${path}.outputName`, 1000), position: optionalEnum(rule.position, `${path}.position`, ["start", "end"]) ?? "start" };
    case "trim-whitespace": case "collapse-spaces": case "remove-invisible-chars": case "normalize-unicode": case "convert-numeric-strings":
      exactKeys(rule, path, ["type", "id", "columnIds"]);
      return { ...base, type, columnIds: optionalIdentifiers(rule.columnIds, `${path}.columnIds`) } as ExcelCleanerRule;
    case "normalize-newlines":
      exactKeys(rule, path, ["type", "id", "columnIds", "replaceWith"]);
      return { ...base, type, columnIds: optionalIdentifiers(rule.columnIds, `${path}.columnIds`), replaceWith: optionalEnum(rule.replaceWith, `${path}.replaceWith`, ["space", "lf", "remove"]) ?? "space" };
    case "find-replace":
      exactKeys(rule, path, ["type", "id", "columnIds", "find", "replace", "caseSensitive"]);
      return { ...base, type, columnIds: optionalIdentifiers(rule.columnIds, `${path}.columnIds`), find: string(rule.find, `${path}.find`, 1000, 1), replace: optionalString(rule.replace, `${path}.replace`) ?? "", caseSensitive: optionalBoolean(rule.caseSensitive, `${path}.caseSensitive`) ?? true };
    case "regex-replace": {
      exactKeys(rule, path, ["type", "id", "columnIds", "pattern", "flags", "replace"]);
      const pattern = string(rule.pattern, `${path}.pattern`, 500);
      const flags = optionalString(rule.flags, `${path}.flags`) ?? "g";
      if (!/^[gimsu]*$/u.test(flags) || flags.includes("y")) invalid(`${path}.flags`);
      compileRegex(pattern, flags, `${path}.pattern`);
      return { ...base, type, columnIds: optionalIdentifiers(rule.columnIds, `${path}.columnIds`), pattern, flags, replace: optionalString(rule.replace, `${path}.replace`) ?? "" };
    }
    case "dedupe-by-columns": {
      exactKeys(rule, path, ["type", "id", "columnIds", "keep", "dateColumnId"]);
      const keep = enumValue(rule.keep, `${path}.keep`, ["first", "last", "latest"]);
      const dateColumnId = rule.dateColumnId === undefined ? undefined : identifier(rule.dateColumnId, `${path}.dateColumnId`);
      if (keep === "latest" && !dateColumnId) invalid(`${path}.dateColumnId`);
      return { ...base, type, columnIds: identifiers(rule.columnIds, `${path}.columnIds`, 1), keep, dateColumnId };
    }
    case "filter-rows": {
      exactKeys(rule, path, ["type", "id", "mode", "columnId", "operator", "value", "caseSensitive"]);
      const operator = enumValue(rule.operator, `${path}.operator`, [...FILTER_OPERATORS]);
      if (operator !== "empty" && !("value" in rule)) invalid(`${path}.value`);
      const filterValue = "value" in rule ? scalar(rule.value, `${path}.value`) : undefined;
      if (operator === "regex") compileRegex(String(filterValue ?? ""), "", `${path}.value`);
      return { ...base, type, mode: enumValue(rule.mode, `${path}.mode`, ["keep", "delete"]), columnId: identifier(rule.columnId, `${path}.columnId`), operator, value: filterValue, caseSensitive: optionalBoolean(rule.caseSensitive, `${path}.caseSensitive`) ?? true };
    }
    case "fill-empty-cells": {
      exactKeys(rule, path, ["type", "id", "columnIds", "source", "value"]);
      const source = enumValue(rule.source, `${path}.source`, ["above", "constant"]);
      if (source === "constant" && !("value" in rule)) invalid(`${path}.value`);
      return { ...base, type, columnIds: optionalIdentifiers(rule.columnIds, `${path}.columnIds`), source, value: "value" in rule ? scalar(rule.value, `${path}.value`) : undefined };
    }
    case "unify-date-format": {
      exactKeys(rule, path, ["type", "id", "columnIds", "outputFormat", "inputHint"]);
      const outputFormat = string(rule.outputFormat, `${path}.outputFormat`, 32) as ExcelCleanerDateFormat;
      if (!DATE_FORMATS.has(outputFormat)) invalid(`${path}.outputFormat`);
      return { ...base, type, columnIds: identifiers(rule.columnIds, `${path}.columnIds`, 1), outputFormat, inputHint: optionalEnum(rule.inputHint, `${path}.inputHint`, ["auto", "serial", "text"]) ?? "auto" };
    }
    case "format-phone-number": case "format-business-number":
      exactKeys(rule, path, ["type", "id", "columnIds", "style"]);
      return { ...base, type, columnIds: identifiers(rule.columnIds, `${path}.columnIds`, 1), style: optionalEnum(rule.style, `${path}.style`, ["dash", "none"]) ?? "dash" } as ExcelCleanerRule;
  }
}

function generatedColumnIds(rule: ExcelCleanerRule) {
  if (rule.type === "split-column") return rule.outputColumnIds;
  if (rule.type === "combine-columns" || rule.type === "add-constant-column" || rule.type === "add-row-number-column") return [rule.outputColumnId];
  return [];
}

function exactKeys(value: Record<string, unknown>, path: string, allowed: string[]) {
  const allow = new Set(allowed);
  for (const key of Object.keys(value)) if (!allow.has(key)) invalid(`${path}.${key}`);
}
function object(value: unknown, path: string, required: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(path);
  const result = value as Record<string, unknown>;
  for (const key of required) if (!(key in result)) invalid(`${path}.${key}`);
  return result;
}
function string(value: unknown, path: string, max = 1000, min = 0) {
  if (typeof value !== "string" || value.length < min || value.length > max) invalid(path);
  return value;
}
function optionalString(value: unknown, path: string) { return value === undefined ? undefined : string(value, path); }
function identifier(value: unknown, path: string) { return string(value, path, 1000, 1); }
function strings(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Array.isArray(value) || value.length < min || value.length > max) invalid(path);
  return value.map((item, index) => string(item, `${path}[${index}]`));
}
function identifiers(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const result = strings(value, path, min, max).map((item, index) => identifier(item, `${path}[${index}]`));
  if (new Set(result).size !== result.length) invalid(path);
  return result;
}
function optionalIdentifiers(value: unknown, path: string) { return value === undefined ? undefined : identifiers(value, path); }
function integer(value: unknown, path: string, min: number, max: number) {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) invalid(path);
  return value as number;
}
function optionalInteger(value: unknown, path: string, min: number, max: number) { return value === undefined ? undefined : integer(value, path, min, max); }
function optionalBoolean(value: unknown, path: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") invalid(path);
  return value;
}
function enumValue<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) invalid(path);
  return value as T;
}
function optionalEnum<T extends string>(value: unknown, path: string, allowed: readonly T[]) { return value === undefined ? undefined : enumValue(value, path, allowed); }
function scalar(value: unknown, path: string) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length <= 1000) return value;
  invalid(path);
}
function compileRegex(pattern: string, flags: string, path: string) {
  try { new RegExp(pattern, flags); }
  catch { invalid(path); }
}
function invalid(path: string): never { throw new ExcelCleanerValidationError(path); }
