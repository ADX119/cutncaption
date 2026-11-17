import { describe, expect, it } from 'vitest';
import { classifyFailure } from './failure';

describe('classifyFailure', () => {
  it.each([
    [['/job1/in/input0.mp4: Invalid data found when processing input'], 'unreadable-file'],
    [['[mov,mp4,m4a,3gp,3g2,mj2 @ 0x1] moov atom not found'], 'unreadable-file'],
    [['Output file #0 does not contain any stream'], 'unreadable-file'],
    [['Stream map 0:a matches no streams.'], 'unreadable-file'],
    [['[libx264 @ 0x2] malloc of size 4194304 failed', 'Cannot allocate memory'], 'out-of-memory'],
    [['Conversion failed!'], 'job-failed'],
  ] as const)('%j -> %s', (log, code) => {
    expect(classifyFailure({ exitCode: 1, log }).code).toBe(code);
  });

  it('recognises a wasm crash from the exception', () => {
    const error = classifyFailure({
      log: ['frame= 10'],
      thrown: new Error('RuntimeError: memory access out of bounds'),
    });
    expect(error.code).toBe('out-of-memory');
    expect(error.detail).toContain('crashed');
  });

  it('keeps the end of the log as detail, without blank lines', () => {
    const log = ['', ...Array.from({ length: 20 }, (_, i) => `line ${i}`), ''];
    const detail = classifyFailure({ exitCode: 1, log }).detail ?? '';
    expect(detail).toContain('exit code 1');
    expect(detail).toContain('line 19');
    expect(detail).not.toContain('line 11');
  });
});
