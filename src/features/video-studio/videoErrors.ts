export class UserFacingVideoError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "UserFacingVideoError";
    this.code = code;
  }
}

export function isUserFacingVideoError(error: unknown): error is UserFacingVideoError {
  return error instanceof UserFacingVideoError;
}

export type VideoProcessingFailureCode = "OUT_OF_MEMORY" | "CODEC_UNAVAILABLE" | "VIDEO_PROCESSING_ERROR";

export function classifyVideoProcessingFailure(error: unknown, diagnosticMessages: readonly string[] = []): VideoProcessingFailureCode {
  const message = error instanceof Error ? error.message : String(error);
  const diagnostics = [message, ...diagnosticMessages.slice(-80)].join("\n");
  if (/abort(?:ed)?\s*\(\s*oom\s*\)|\boom\b|out of memory|memory access out of bounds|cannot enlarge memory|failed to (?:allocate|grow)|allocation failed/i.test(diagnostics)) {
    return "OUT_OF_MEMORY";
  }
  if (/libx265|encoder.*not found|unknown encoder/i.test(diagnostics)) return "CODEC_UNAVAILABLE";
  return "VIDEO_PROCESSING_ERROR";
}
