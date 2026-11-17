import { EngineError } from '../../errors';
import type { FfmpegSession } from '../ffmpeg/loader';
import { withWorkspace } from '../ffmpeg/workspace';
import { type MediaInfo, parseProbe } from './parse';

/**
 * The JSON report out of ffprobe's stdout lines. Lines a previous run left in the
 * buffer can arrive first, so everything before the first "{" is ignored.
 */
export function extractReport(stdout: readonly string[]): string | null {
  const text = stdout.join('\n');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}

/**
 * Reads a file's duration, streams and rotation with ffprobe.
 *
 * This ffprobe build returns -1 even when it succeeds and ignores `-o`, so the
 * report is read from stdout and success means "a valid report came back".
 */
export async function probeFile(session: FfmpegSession, file: File): Promise<MediaInfo> {
  return withWorkspace(session.fs, [file], async (ws) => {
    const { stdout, log } = await session.ffprobe([
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      ws.input(),
    ]);

    const report = extractReport(stdout);
    if (report === null) {
      throw new EngineError('unreadable-file', `no ffprobe report: ${log.slice(-3).join(' ')}`);
    }

    let info: MediaInfo;
    try {
      info = parseProbe(report);
    } catch (error) {
      throw new EngineError('unreadable-file', `ffprobe report: ${String(error)}`, {
        cause: error,
      });
    }
    if (!info.video && !info.audio) {
      throw new EngineError('unreadable-file', 'no audio or video stream');
    }
    return info;
  });
}
