import { EngineError, type EngineErrorCode } from '../../errors';

/** Log or exception text that identifies a known kind of failure. First match wins. */
const PATTERNS: ReadonlyArray<readonly [RegExp, EngineErrorCode]> = [
  // The wasm heap is fixed in size; large or long jobs can run out of it.
  [
    /out of memory|Cannot allocate memory|Aborted\(OOM\)|allocation failed|RangeError: Array buffer/i,
    'out-of-memory',
  ],
  [/memory access out of bounds/i, 'out-of-memory'],
  [
    /Invalid data found when processing input|moov atom not found|EBML header parsing failed|could not find codec parameters/i,
    'unreadable-file',
  ],
  [
    /does not contain any stream|Output file #0 does not contain any stream|matches no streams/i,
    'unreadable-file',
  ],
];

/** Last few non-empty log lines, for the "Details" panel. */
function tail(log: readonly string[], lines = 8): string {
  return log
    .filter((line) => line.trim() !== '')
    .slice(-lines)
    .join('\n');
}

/**
 * Turns a failed ffmpeg run into an EngineError. `thrown` is the exception if the
 * run threw (a wasm crash) rather than returning a non-zero exit code.
 */
export function classifyFailure(input: {
  readonly exitCode?: number;
  readonly log: readonly string[];
  readonly thrown?: unknown;
}): EngineError {
  const thrownText = input.thrown === undefined ? '' : String(input.thrown);
  const haystack = `${input.log.join('\n')}\n${thrownText}`;
  const code = PATTERNS.find(([pattern]) => pattern.test(haystack))?.[1] ?? 'job-failed';
  const summary =
    input.exitCode === undefined ? `crashed: ${thrownText}` : `exit code ${input.exitCode}`;
  return new EngineError(code, `${summary}\n${tail(input.log)}`, { cause: input.thrown });
}
