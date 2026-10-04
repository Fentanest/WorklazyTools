import type { Plugin } from "vite";
export function buildBannerRuntime(): Promise<string>;
export function buildHeightParentRuntime(): Promise<string>;
export function productBannerRuntimePlugin(): Plugin;
