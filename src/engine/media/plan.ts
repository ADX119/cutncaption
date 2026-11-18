import type { JobFootprint } from '../device';
import type { Workspace } from './ffmpeg/workspace';
import { type MediaJob, outputFilename } from './jobs';
import type { MediaInfo } from './probe/parse';
import { type FrameSize, displaySize, outputFps, scaleToShortSide } from './sizing';
import { correctedVideoKbps, planBitrate } from './bitrate';

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
  /**
   * Set when the job should not run at all; the engine rejects with this error and
   * assess() reports it so the tool can explain before anything starts.
   */
  readonly refusal?: Refusal;
  /** A corrected plan if the output came out too big, or null when it is fine. */
  readonly retry?: (outputBytes: number) => Plan | null;
}

export type Refusal =
  | { readonly code: 'already-under-target' }
  | { readonly code: 'target-unreachable'; readonly smallestBytes: number }
  | { readonly code: 'no-audio' };

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

/** Device facts the planner needs (engine/device/limits.ts). */
export interface PlanContext {
  /** Re-encodes are scaled so the short side is at most this. */
  readonly maxShortSide: number;
}

export const DEFAULT_PLAN_CONTEXT: PlanContext = { maxShortSide: 1080 };

/** Compress presets (docs/ARCHITECTURE.md §7). */
export const COMPRESS_PRESETS = {
  light: { maxShortSide: 1080, crf: 23, audioKbps: 128, bitsPerPixel: 0.07 },
  balanced: { maxShortSide: 720, crf: 28, audioKbps: 96, bitsPerPixel: 0.045 },
  small: { maxShortSide: 480, crf: 32, audioKbps: 64, bitsPerPixel: 0.03 },
} as const;
export type CompressQuality = keyof typeof COMPRESS_PRESETS;

/**
 * Expected size of a CRF encode: pixels per second times a typical bits-per-pixel
 * for the preset, plus audio. Shown to the person before running, so it aims to be
 * in the right range for phone footage, not exact.
 */
export function estimateCompressedBytes(
  info: MediaInfo,
  size: FrameSize | null,
  quality: CompressQuality,
): number {
  const preset = COMPRESS_PRESETS[quality];
  const seconds = info.durationSec ?? 0;
  const videoBps = size ? size.width * size.height * outputFps(info) * preset.bitsPerPixel : 0;
  const audioBps = info.audio ? preset.audioKbps * 1000 : 0;
  return Math.round(((videoBps + audioBps) * seconds) / 8);
}

/**
 * The scale filter for a re-encode capped at `maxShortSide`, or nothing when the
 * picture already fits (no needless resampling).
 */
function scaleArgs(info: MediaInfo, maxShortSide: number): string[] {
  const display = displaySize(info);
  if (!display) return [];
  const target = scaleToShortSide(display, maxShortSide);
  if (target.width === display.width && target.height === display.height) return [];
  return ['-vf', `scale=${target.width}:${target.height}`];
}

/** Seconds as ffmpeg should see them: millisecond precision, no trailing zeros. */
const secs = (seconds: number) => String(Math.round(seconds * 1000) / 1000);

export function planJob(job: MediaJob, context: PlanContext = DEFAULT_PLAN_CONTEXT): Plan {
  const deviceScale = (info: MediaInfo) => scaleArgs(info, context.maxShortSide);
  switch (job.kind) {
    case 'toMp3': {
      const { file, info, bitrateKbps } = job;
      const seconds = info.durationSec ?? undefined;
      return {
        path: 'ffmpeg',
        reencodesVideo: false,
        outputName: 'out.mp3',
        mime: 'audio/mpeg',
        filename: outputFilename(file.name, 'audio', 'mp3'),
        expectedDurationSec: seconds,
        footprint: {
          inputBytes: file.size,
          estimatedOutputBytes: Math.round(((bitrateKbps * 1000) / 8) * (seconds ?? 0)),
        },
        refusal: info.audio ? undefined : { code: 'no-audio' },
        args: (ws) => [
          '-hide_banner',
          '-i',
          ws.input(),
          '-vn',
          '-c:a',
          'libmp3lame',
          '-b:a',
          `${bitrateKbps}k`,
          ws.path('out.mp3'),
        ],
      };
    }
    case 'compressToSize': {
      const { file, info, targetBytes } = job;
      const seconds = info.durationSec ?? 0;
      const base = {
        reencodesVideo: info.video !== null,
        outputName: 'out.mp4',
        mime: 'video/mp4',
        filename: outputFilename(file.name, 'compressed', 'mp4'),
        expectedDurationSec: seconds || undefined,
      } as const;
      const bitrate = planBitrate({
        targetBytes,
        durationSec: seconds,
        sourceBytes: file.size,
        hasAudio: info.audio !== null,
      });
      if (bitrate.kind !== 'ok') {
        return {
          ...base,
          path: 'ffmpeg',
          footprint: { inputBytes: file.size },
          args: () => [],
          refusal:
            bitrate.kind === 'already-small'
              ? { code: 'already-under-target' }
              : { code: 'target-unreachable', smallestBytes: bitrate.smallestBytes },
        };
      }
      const cap = Math.min(bitrate.maxShortSide, context.maxShortSide);
      const encodeAt = (videoKbps: number, isRetry: boolean): Plan => ({
        ...base,
        path: 'ffmpeg',
        footprint: {
          inputBytes: file.size,
          estimatedOutputBytes: targetBytes,
          reencodeSeconds: seconds,
        },
        args: (ws) => [
          '-hide_banner',
          '-i',
          ws.input(),
          ...(info.video
            ? [
                ...scaleArgs(info, cap),
                '-c:v',
                'libx264',
                '-preset',
                'veryfast',
                '-b:v',
                `${videoKbps}k`,
                '-maxrate',
                `${videoKbps}k`,
                '-bufsize',
                `${videoKbps * 2}k`,
                '-pix_fmt',
                'yuv420p',
                '-fpsmax',
                '30',
              ]
            : ['-vn']),
          ...(info.audio ? aac(bitrate.audioKbps) : ['-an']),
          ...MP4,
          ws.path('out.mp4'),
        ],
        // One corrective pass if the encoder overshot; never a third.
        retry: isRetry
          ? undefined
          : (outputBytes) =>
              outputBytes > targetBytes
                ? encodeAt(correctedVideoKbps(videoKbps, targetBytes, outputBytes), true)
                : null,
      });
      return encodeAt(bitrate.videoKbps, false);
    }
    case 'compress': {
      const { file, info, quality } = job;
      const preset = COMPRESS_PRESETS[quality];
      const cap = Math.min(preset.maxShortSide, context.maxShortSide);
      const display = displaySize(info);
      const size = display ? scaleToShortSide(display, cap) : null;
      const seconds = info.durationSec ?? undefined;
      return {
        path: 'ffmpeg',
        reencodesVideo: info.video !== null,
        outputName: 'out.mp4',
        mime: 'video/mp4',
        filename: outputFilename(file.name, 'compressed', 'mp4'),
        expectedDurationSec: seconds,
        footprint: {
          inputBytes: file.size,
          estimatedOutputBytes: estimateCompressedBytes(info, size, quality),
          reencodeSeconds: seconds ?? 0,
        },
        args: (ws) => [
          '-hide_banner',
          '-i',
          ws.input(),
          ...(info.video ? [...scaleArgs(info, cap), ...x264(preset.crf)] : ['-vn']),
          ...(info.audio ? aac(preset.audioKbps) : ['-an']),
          ...MP4,
          ws.path('out.mp4'),
        ],
      };
    }
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
          ...deviceScale(info),
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
                ...deviceScale(info),
                ...x264(22),
                ...(info.audio ? aac(128) : ['-an']),
                ...MP4,
                ws.path('out.mp4'),
              ],
      };
    }
  }
}
