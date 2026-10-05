import { BannerStateError, PROJECT_LIMITS } from "./stateTypes.ts";

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new BannerStateError("INVALID_PROJECT");
  return value as Record<string, unknown>;
}
export function string(value: unknown): string {
  if (typeof value !== "string") throw new BannerStateError("INVALID_PROJECT");
  if (value.length > PROJECT_LIMITS.stringLength) throw new BannerStateError("PROJECT_LIMIT");
  return value;
}
export function nullableString(value: unknown): string | null { return value === null ? null : string(value); }
export function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new BannerStateError("INVALID_PROJECT");
  return value;
}
export function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new BannerStateError("INVALID_PROJECT");
  return value;
}
export function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new BannerStateError("INVALID_PROJECT");
  return value as T;
}
