import type { BgMode, VerifiedAsset } from './assets.ts';
import type { BgErrorCode } from './errors.ts';
export interface WorkerRequest { runId: number; mode: BgMode; input: Blob; assets: VerifiedAsset[]; auditRuntime?: boolean }
export interface Diagnostic { type: string; [key: string]: unknown }
export type WorkerResponse = { runId: number } & (
  { type: 'progress'; stage: string; current: number; total: number } |
  { type: 'audit'; data: Diagnostic } | { type: 'result'; blob: Blob; width: number; height: number } |
  { type: 'error'; code: BgErrorCode }
);
