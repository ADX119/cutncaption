/**
 * Every failure that leaves the engine is an EngineError with a stable code.
 * The UI turns the code into a message (`error.<code>` in src/i18n) and never
 * shows `detail` unless the person opens "Details".
 */
export const ENGINE_ERROR_CODES = [
  'cancelled',
  'asset-unknown',
  'asset-download-failed',
  'asset-corrupt',
] as const;

export type EngineErrorCode = (typeof ENGINE_ERROR_CODES)[number];

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  /** Technical detail for the "Details" panel and logs. Not user-facing copy. */
  readonly detail?: string;

  constructor(code: EngineErrorCode, detail?: string, options?: { cause?: unknown }) {
    super(detail ? `${code}: ${detail}` : code, options);
    this.name = 'EngineError';
    this.code = code;
    this.detail = detail;
  }

  /** Key of the user-facing message in the i18n catalogue. */
  get messageKey(): `error.${EngineErrorCode}` {
    return `error.${this.code}`;
  }
}

export function isEngineError(value: unknown): value is EngineError {
  return value instanceof EngineError;
}

/** True for the DOMException that fetch and streams throw when an AbortSignal fires. */
export function isAbortError(value: unknown): boolean {
  return value instanceof Error && value.name === 'AbortError';
}
