/**
 * Error handling has one rule: the parent sees a sentence written by a human,
 * the developer sees the detail in the log sink. `AppError` carries both.
 */
export type AppErrorCode =
  | 'network'
  | 'auth'
  | 'not_found'
  | 'permission'
  | 'validation'
  | 'upload'
  | 'generation'
  | 'unknown';

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** Never rendered. Goes to the log sink. */
  readonly detail: string | undefined;

  constructor(code: AppErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
  }
}

export function toAppError(error: unknown, fallback: AppErrorCode = 'unknown'): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return new AppError('network', error.message);
    }
    return new AppError(fallback, error.message);
  }
  return new AppError(fallback, String(error));
}

export interface ErrorCopy {
  genericTitle: string;
  generic: string;
  network: string;
  auth: string;
  upload: string;
  generation: string;
  notFound: string;
}

/** Maps a code to the parent-facing sentence from the string catalogue. */
export function friendlyMessage(error: unknown, copy: ErrorCopy): string {
  const appError = toAppError(error);
  switch (appError.code) {
    case 'network':
      return copy.network;
    case 'auth':
      return copy.auth;
    case 'not_found':
      return copy.notFound;
    case 'upload':
      return copy.upload;
    case 'generation':
      return copy.generation;
    default:
      return copy.generic;
  }
}
