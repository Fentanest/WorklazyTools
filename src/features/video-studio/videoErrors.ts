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
