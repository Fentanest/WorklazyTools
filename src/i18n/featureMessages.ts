import enFeatures from "../locales/en/features.json";
import koFeatures from "../locales/ko/features.json";
import type { AppLanguage } from "./languages";
import { FEATURE_MESSAGE_TOKEN_PREFIX } from "./workerMessages";

type FeatureMessageValues = Record<string, unknown>;

export function featureMessage(language: AppLanguage, key: string, values: FeatureMessageValues = {}) {
  const template = featureResource<unknown>(language, key);
  if (typeof template !== "string") return key;
  const message = template.replace(/{{\s*([^},\s]+)(?:\s*,[^}]*)?\s*}}/g, (_, name: string) => {
    const value = values[name];
    return value === undefined || value === null ? "" : String(value);
  });
  return message;
}

export function featureResource<T>(language: AppLanguage, key: string): T {
  const resources = language === "ko" ? koFeatures : enFeatures;
  return key.split(".").reduce<unknown>((value, segment) => (
    value && typeof value === "object" ? (value as Record<string, unknown>)[segment] : undefined
  ), resources) as T;
}

export function resolveFeatureMessage(language: AppLanguage, message: string) {
  if (!message.startsWith(FEATURE_MESSAGE_TOKEN_PREFIX)) return message;
  try {
    const payload = JSON.parse(message.slice(FEATURE_MESSAGE_TOKEN_PREFIX.length)) as { key?: unknown; values?: unknown };
    if (typeof payload.key !== "string") return message;
    const values = payload.values && typeof payload.values === "object"
      ? Object.fromEntries(Object.entries(payload.values as FeatureMessageValues).map(([key, value]) => [key, resolveTokenValue(language, value)]))
      : {};
    return featureMessage(language, payload.key, values);
  } catch {
    return message;
  }
}

function resolveTokenValue(language: AppLanguage, value: unknown): unknown {
  if (typeof value === "string") return resolveFeatureMessage(language, value);
  if (Array.isArray(value)) return value.map((item) => resolveTokenValue(language, item));
  return value;
}
