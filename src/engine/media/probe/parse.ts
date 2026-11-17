/** What the tools need to know about a file before working on it. */
export interface MediaInfo {
  /** Seconds, or null when the container does not say (e.g. some browser-recorded WebM). */
  readonly durationSec: number | null;
  /** ffprobe's container name list, e.g. "mov,mp4,m4a,3gp,3g2,mj2". */
  readonly container: string;
  readonly video: VideoInfo | null;
  readonly audio: AudioInfo | null;
}

export interface VideoInfo {
  readonly codec: string;
  /** Size as stored in the file. */
  readonly width: number;
  readonly height: number;
  /** Clockwise rotation a player applies: 0, 90, 180 or 270. */
  readonly rotation: 0 | 90 | 180 | 270;
  /** Size as the person sees it, after rotation. Use this for layout and crop maths. */
  readonly displayWidth: number;
  readonly displayHeight: number;
  /** Frames per second, or null if unknown. */
  readonly fps: number | null;
}

export interface AudioInfo {
  readonly codec: string;
  readonly channels: number | null;
  readonly sampleRate: number | null;
}

// The parts of `ffprobe -print_format json -show_format -show_streams` we read.
interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  channels?: number;
  sample_rate?: string;
  duration?: string;
  disposition?: { attached_pic?: number };
  side_data_list?: { side_data_type?: string; rotation?: number }[];
  tags?: { rotate?: string; DURATION?: string };
}
interface ProbeOutput {
  streams?: ProbeStream[];
  format?: { format_name?: string; duration?: string };
}

const positive = (value: number): number | null =>
  Number.isFinite(value) && value > 0 ? value : null;

/** "30000/1001" -> 29.97, "0/0" -> null. */
export function parseRate(rate: string | undefined): number | null {
  if (!rate) return null;
  const [num, den] = rate.split('/').map(Number);
  if (num === undefined || den === undefined || den === 0) return null;
  return positive(Math.round((num / den) * 1000) / 1000);
}

/** "00:01:02.500000000" (Matroska tag) -> 62.5. */
export function parseClock(value: string | undefined): number | null {
  const match = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value ?? '');
  if (!match) return null;
  return positive(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]));
}

/** Any angle, either sign convention, to the nearest quarter turn in 0–359. */
export function normaliseRotation(degrees: number): 0 | 90 | 180 | 270 {
  const quarter = Math.round(degrees / 90);
  return ((((quarter % 4) + 4) % 4) * 90) as 0 | 90 | 180 | 270;
}

/**
 * ffprobe reports the display matrix angle counter-clockwise ("rotation": -90 means
 * turn 90° clockwise to display). The old "rotate" tag is already clockwise.
 */
function rotationOf(stream: ProbeStream): 0 | 90 | 180 | 270 {
  const matrix = stream.side_data_list?.find((d) => d.side_data_type === 'Display Matrix');
  if (typeof matrix?.rotation === 'number') return normaliseRotation(-matrix.rotation);
  const tag = Number(stream.tags?.rotate);
  return Number.isFinite(tag) ? normaliseRotation(tag) : 0;
}

function durationOf(output: ProbeOutput): number | null {
  const fromFormat = positive(Number(output.format?.duration));
  if (fromFormat !== null) return fromFormat;
  let longest: number | null = null;
  for (const stream of output.streams ?? []) {
    const seconds = positive(Number(stream.duration)) ?? parseClock(stream.tags?.DURATION);
    if (seconds !== null && (longest === null || seconds > longest)) longest = seconds;
  }
  return longest;
}

/** Turns ffprobe's JSON into MediaInfo. Throws if it is not ffprobe output. */
export function parseProbe(json: string): MediaInfo {
  const output = JSON.parse(json) as ProbeOutput;
  if (!output.format && !output.streams) throw new Error('not ffprobe output');
  const streams = output.streams ?? [];

  // Cover art in MP3 and M4A files is a "video" stream; it is not video.
  const videoStream = streams.find(
    (s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1,
  );
  const audioStream = streams.find((s) => s.codec_type === 'audio');

  let video: VideoInfo | null = null;
  if (videoStream?.width && videoStream.height) {
    const rotation = rotationOf(videoStream);
    const sideways = rotation === 90 || rotation === 270;
    video = {
      codec: videoStream.codec_name ?? 'unknown',
      width: videoStream.width,
      height: videoStream.height,
      rotation,
      displayWidth: sideways ? videoStream.height : videoStream.width,
      displayHeight: sideways ? videoStream.width : videoStream.height,
      fps: parseRate(videoStream.avg_frame_rate) ?? parseRate(videoStream.r_frame_rate),
    };
  }

  const audio: AudioInfo | null = audioStream
    ? {
        codec: audioStream.codec_name ?? 'unknown',
        channels: audioStream.channels ?? null,
        sampleRate: positive(Number(audioStream.sample_rate)),
      }
    : null;

  return {
    durationSec: durationOf(output),
    container: output.format?.format_name ?? 'unknown',
    video,
    audio,
  };
}
