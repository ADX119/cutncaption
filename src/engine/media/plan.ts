import type { JobFootprint } from '../device';
import type { Workspace } from './ffmpeg/workspace';
import { type MediaJob, outputFilename } from './jobs';
import type { MediaInfo } from './probe/parse';

/** How the engine will carry out a job, worked out before anything runs. */
export interface Plan {
  /** 'copy' = stream copy, no re-encode (near-instant); 'ffmpeg' = re-encode. */
  readonly path: 'copy' | 'ffmpeg';
  readonly reencodesVideo: boolean;
  readonly outputName: string;
  readonly mime: string;
  readonly filename: string;
  readonly expectedDurationSec: number | undefined;
  /** For the device limit check (engine/device/limits.ts). */
  readonly footprint: JobFootprint;
  /** The ffmpeg command, given the job's workspace. */
  readonly args: (ws: Workspace) => string[];
}

// Common output settings (docs/ARCHITECTURE.md §7).
const MP4 = ['-movflags', '+faststart'];
const aac = (kbps: number) => ['-c:a', 'aac', '-b:a', `${kbps}k`, '-ac', '2'];
const x264 = (crf: number) => [
  '-c:v',
  'libx264',
  '-preset',
  'veryfast',
  '-crf',
  String(crf),
  '-pix_fmt',
  'yuv420p',
  '-fpsmax',
  '30',
];

/**
 * Rough output size of a re-encode, only used to check device memory limits.
 * Typical CRF 20–23 H.264 bitrates by height, plus audio.
 */
export function estimateEncodedBytes(info: MediaInfo): number {
  const seconds = info.durationSec ?? 0;
  const height = Math.min(info.video?.displayWidth ?? 0, info.video?.displayHeight ?? 0);
  const videoBps = height >= 1000 ? 5_000_000 : height >= 700 ? 2_500_000 : 1_200_000;
  const audioBps = info.audio ? 128_000 : 0;
  return Math.round(((videoBps + audioBps) * seconds) / 8);
}

/** H.264 video with AAC audio, or no audio, can go into MP4 without re-encoding. */
export function isMp4Compatible(info: MediaInfo): boolean {
  if (info.video?.codec !== 'h264') return false;
  return info.audio === null || info.audio.codec === 'aac';
}

export function planJob(job: MediaJob): Plan {
  switch (job.kind) {
    case 'toMp4': {
      const { file, info } = job;
      const copy = isMp4Compatible(info);
      const seconds = info.durationSec ?? undefined;
      return {
        path: copy ? 'copy' : 'ffmpeg',
        reencodesVideo: !copy,
        outputName: 'out.mp4',
        mime: 'video/mp4',
        filename: outputFilename(file.name, 'converted', 'mp4'),
        expectedDurationSec: seconds,
        footprint: {
          inputBytes: file.size,
          estimatedOutputBytes: copy ? file.size : estimateEncodedBytes(info),
          reencodeSeconds: copy ? undefined : (seconds ?? 0),
        },
        args: (ws) =>
          copy
            ? ['-hide_banner', '-i', ws.input(), '-c', 'copy', ...MP4, ws.path('out.mp4')]
            : [
                '-hide_banner',
                '-i',
                ws.input(),
                ...x264(22),
                ...(info.audio ? aac(128) : ['-an']),
                ...MP4,
                ws.path('out.mp4'),
              ],
      };
    }
  }
}
