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

/** Containers a stream copy can keep, by output extension. */
const CONTAINERS = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
} as const;
type Container = keyof typeof CONTAINERS;

/**
 * The container a stream copy should write, so the output plays like the input.
 * The file's own extension decides (ffprobe reports MP4 and MOV alike); otherwise
 * ffprobe's container name; MP4 as the last resort.
 */
export function sourceContainer(fileName: string, info: MediaInfo): Container {
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'm4v') return 'mp4';
  if (extension in CONTAINERS) return extension as Container;
  if (info.container.includes('matroska')) return 'mkv';
  if (info.container.includes('avi')) return 'avi';
  return 'mp4';
}

/** Seconds as ffmpeg should see them: millisecond precision, no trailing zeros. */
const secs = (seconds: number) => String(Math.round(seconds * 1000) / 1000);

export function planJob(job: MediaJob): Plan {
  switch (job.kind) {
    case 'trim': {
      const { file, info, start, end } = job;
      const length = Math.max(0, end - start);
      const total = info.durationSec ?? length;
      const share = total > 0 ? Math.min(1, length / total) : 1;
      const select = ['-ss', secs(start), '-i'];

      if (job.mode === 'fast') {
        const container = sourceContainer(file.name, info);
        const output = `out.${container}`;
        const faststart = container === 'mp4' || container === 'mov' ? MP4 : [];
        return {
          path: 'copy',
          reencodesVideo: false,
          outputName: output,
          mime: CONTAINERS[container],
          filename: outputFilename(file.name, 'trimmed', container),
          expectedDurationSec: length,
          footprint: {
            inputBytes: file.size,
            estimatedOutputBytes: Math.round(file.size * share),
          },
          args: (ws) => [
            '-hide_banner',
            ...select,
            ws.input(),
            '-t',
            secs(length),
            // The main picture and every audio track; extra data tracks some cameras
            // add can make a copy fail.
            '-map',
            '0:v:0?',
            '-map',
            '0:a?',
            '-c',
            'copy',
            '-avoid_negative_ts',
            'make_zero',
            ...faststart,
            ws.path(output),
          ],
        };
      }

      return {
        path: 'ffmpeg',
        reencodesVideo: true,
        outputName: 'out.mp4',
        mime: 'video/mp4',
        filename: outputFilename(file.name, 'trimmed', 'mp4'),
        expectedDurationSec: length,
        footprint: {
          inputBytes: file.size,
          estimatedOutputBytes: estimateEncodedBytes({ ...info, durationSec: length }),
          reencodeSeconds: length,
        },
        args: (ws) => [
          '-hide_banner',
          ...select,
          ws.input(),
          '-t',
          secs(length),
          ...x264(20),
          ...(info.audio ? aac(128) : ['-an']),
          ...MP4,
          ws.path('out.mp4'),
        ],
      };
    }
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
