import { describe, expect, it } from 'vitest';
import { extractReport } from './probe';

describe('extractReport', () => {
  it('returns the JSON object from stdout lines', () => {
    const stdout = ['{', '    "streams": [],', '    "format": {}', '}'];
    expect(JSON.parse(extractReport(stdout) ?? '')).toEqual({ streams: [], format: {} });
  });

  it('skips leftovers from an earlier run that arrive first', () => {
    const stdout = ['FFprobe: Cleanup done.', 'ffmpeg version 5.1.4 Copyright', '{', '}'];
    expect(extractReport(stdout)).toBe('{\n}');
  });

  it('returns null when there is no report', () => {
    expect(extractReport([])).toBeNull();
    expect(extractReport(['Invalid data found when processing input'])).toBeNull();
  });
});
