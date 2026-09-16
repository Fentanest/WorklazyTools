import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function createLocalId(prefix = "id") {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === "function") return `${prefix}-${randomUuid.call(globalThis.crypto)}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
