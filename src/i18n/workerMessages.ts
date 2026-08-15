export const FEATURE_MESSAGE_TOKEN_PREFIX = "__worklazy_i18n__:";

export function workerMessage(_language: unknown, key: string, values: Record<string, unknown> = {}) {
  return `${FEATURE_MESSAGE_TOKEN_PREFIX}${JSON.stringify({ key, values })}`;
}
