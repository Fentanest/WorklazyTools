export type SafeFileName = string & { readonly __safeFileName: unique symbol };

export type FileNameSafetyReason =
  | "EMPTY"
  | "PATH"
  | "CONTROL_CHARACTER"
  | "WINDOWS_CHARACTER"
  | "WINDOWS_RESERVED"
  | "TRAILING_CHARACTER"
  | "TOO_LONG"
  | "DUPLICATE";

export class UnsafeFileNameError extends Error {
  readonly reason: FileNameSafetyReason;

  constructor(reason: FileNameSafetyReason) {
    super(reason);
    this.reason = reason;
    this.name = "UnsafeFileNameError";
  }
}

export class SafeFileNameRegistry {
  private readonly names = new Set<string>();

  has(fileName: string) {
    return this.names.has(collisionKey(fileName));
  }

  add(fileName: SafeFileName) {
    const key = collisionKey(fileName);
    if (this.names.has(key)) throw new UnsafeFileNameError("DUPLICATE");
    this.names.add(key);
    return fileName;
  }
}

export function validateSafeFileName(value: string): SafeFileName {
  const normalized = String(value).normalize("NFC");
  if (!normalized || normalized.trim().length === 0 || normalized === "." || normalized === "..") {
    throw new UnsafeFileNameError("EMPTY");
  }
  if (normalized.includes("/") || normalized.includes("\\") || normalized.includes("../") || normalized.includes("..\\")) {
    throw new UnsafeFileNameError("PATH");
  }
  if (/[\u0000-\u001F\u007F]/u.test(normalized)) throw new UnsafeFileNameError("CONTROL_CHARACTER");
  if (/[<>:"|?*]/u.test(normalized)) throw new UnsafeFileNameError("WINDOWS_CHARACTER");
  if (/[. ]$/u.test(normalized)) throw new UnsafeFileNameError("TRAILING_CHARACTER");
  if (isWindowsReserved(normalized)) throw new UnsafeFileNameError("WINDOWS_RESERVED");
  if (new TextEncoder().encode(normalized).byteLength > 255) throw new UnsafeFileNameError("TOO_LONG");
  return normalized as SafeFileName;
}

export function createUniqueSafeFileName(
  value: unknown,
  registry: SafeFileNameRegistry,
  fallback = "result",
): SafeFileName {
  const raw = String(value ?? "").normalize("NFC");
  const sanitized = sanitizeFileName(raw, fallback);
  const { base, extension } = splitExtension(sanitized);
  let sequence = 1;
  let candidate = validateSafeFileName(sanitized);
  while (registry.has(candidate)) {
    sequence += 1;
    const suffix = `-${sequence}`;
    candidate = validateSafeFileName(limitUtf8(`${base}${suffix}${extension}`, 255));
  }
  return registry.add(candidate);
}

export function reserveSafeFileName(value: string, registry: SafeFileNameRegistry) {
  return registry.add(validateSafeFileName(value));
}

function sanitizeFileName(value: string, fallback: string) {
  let safe = value
    .replace(/[\u0000-\u001F\u007F<>:"/\\|?*]+/gu, "_")
    .replace(/^[. ]+|[. ]+$/gu, "")
    .trim();
  if (!safe || safe === "." || safe === "..") safe = fallback;
  if (isWindowsReserved(safe)) safe = `_${safe}`;
  return limitUtf8(safe, 255);
}

function splitExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0
    ? { base: fileName.slice(0, dot), extension: fileName.slice(dot) }
    : { base: fileName, extension: "" };
}

function collisionKey(fileName: string) {
  return fileName.normalize("NFC").toLocaleLowerCase("en-US");
}

function isWindowsReserved(fileName: string) {
  const base = fileName.split(".", 1)[0].toUpperCase();
  return /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/u.test(base);
}

function limitUtf8(value: string, maxBytes: number) {
  if (new TextEncoder().encode(value).byteLength <= maxBytes) return value;
  const { base, extension } = splitExtension(value);
  const extensionBytes = new TextEncoder().encode(extension).byteLength;
  const budget = Math.max(1, maxBytes - Math.min(extensionBytes, 32));
  let result = "";
  for (const character of base) {
    if (new TextEncoder().encode(result + character).byteLength > budget) break;
    result += character;
  }
  return `${result || "result"}${extensionBytes <= 32 ? extension : ""}`;
}
