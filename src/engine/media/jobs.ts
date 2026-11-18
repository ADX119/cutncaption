import type { MediaInfo } from './probe/parse';

/**
 * Everything the engine can do, one variant per tool action. Each job carries the
 * MediaInfo from an earlier probe(), so the file is not read twice. Kinds are added
 * here as their tools are built (docs/ARCHITECTURE.md §3 lists the full set).
 */
export type MediaJob = ToMp4Job | TrimJob | CompressJob;

export interface ToMp4Job {
  readonly kind: 'toMp4';
  readonly file: File;
  readonly info: MediaInfo;
}

export interface CompressJob {
  readonly kind: 'compress';
  readonly file: File;
  readonly info: MediaInfo;
  /** light: up to 1080p; balanced: up to 720p; small: up to 480p. */
  readonly quality: 'light' | 'balanced' | 'small';
}

export interface TrimJob {
  readonly kind: 'trim';
  readonly file: File;
  readonly info: MediaInfo;
  /** Seconds. */
  readonly start: number;
  readonly end: number;
  /**
   * 'fast' copies the streams: near-instant, keeps the format, but cuts at the
   * nearest keyframe so the start can be up to a few seconds early.
   * 'precise' re-encodes to MP4 for exact cut points.
   */
  readonly mode: 'fast' | 'precise';
}

/** How a job's output was produced. */
export type EnginePath = 'copy' | 'webcodecs' | 'ffmpeg-mt' | 'ffmpeg-st' | 'canvas';

export interface JobResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly mime: string;
  readonly path: EnginePath;
  readonly ms: number;
  /** True when the multi-thread core stalled and the job was redone on single-thread. */
  readonly fellBack: boolean;
}

/**
 * "<original name>-<action>.<ext>" (docs/PRD.md G7). Characters that file systems or
 * share sheets reject are replaced; any script, including Devanagari, is kept.
 */
export function outputFilename(original: string, action: string, extension: string): string {
  const dot = original.lastIndexOf('.');
  const stem = (dot >= 0 ? original.slice(0, dot) : original)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 80);
  return `${stem || 'video'}-${action}.${extension}`;
}
