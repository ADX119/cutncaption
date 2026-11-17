/**
 * What the shipped ffmpeg core can do, and what the tools need from it.
 * The requirement list mirrors the command table in docs/ARCHITECTURE.md §7:
 * when a command there gains a codec, filter or format, add it here too.
 */

export type CapabilityKind = 'encoder' | 'decoder' | 'filter' | 'muxer' | 'demuxer';

export interface Requirement {
  readonly kind: CapabilityKind;
  /** Satisfied if the core has any one of these names. */
  readonly anyOf: readonly string[];
  /** Which tool or input needs it. */
  readonly why: string;
}

const req = (kind: CapabilityKind, anyOf: string | string[], why: string): Requirement => ({
  kind,
  anyOf: typeof anyOf === 'string' ? [anyOf] : anyOf,
  why,
});

export const REQUIRED_CAPABILITIES: readonly Requirement[] = [
  // Output encoders.
  req('encoder', 'libx264', 'every re-encoded MP4'),
  req('encoder', 'aac', 'MP4 audio'),
  req('encoder', 'libmp3lame', 'video to MP3'),
  req('encoder', 'gif', 'meme GIF export'),
  req('encoder', ['libwebp_anim', 'libwebp'], 'WhatsApp sticker'),

  // Inputs people will bring. iPhones record HEVC by default.
  req('decoder', 'h264', 'most phone and web video'),
  req('decoder', 'hevc', 'iPhone and many Android recordings'),
  req('decoder', ['vp9', 'libvpx-vp9'], 'WebM'),
  req('decoder', ['vp8', 'libvpx'], 'older WebM'),
  req('decoder', 'mpeg4', 'older AVI and camera files'),
  req('decoder', 'aac', 'MP4 and MOV audio'),
  req('decoder', ['mp3float', 'mp3'], 'MP3 and AVI audio'),
  req('decoder', ['opus', 'libopus'], 'WebM and MKV audio'),
  req('decoder', ['vorbis', 'libvorbis'], 'older WebM and OGG audio'),
  req('decoder', 'pcm_s16le', 'WAV audio'),
  req('decoder', 'png', 'meme caption overlay image'),

  // Filters used by the command builders.
  ...[
    'scale',
    'crop',
    'pad',
    'overlay',
    'split',
    'trim',
    'setpts',
    'concat',
    'zoompan',
    'fps',
    'format',
    'palettegen',
    'paletteuse',
  ].map((name) => req('filter', name, 'video filter graphs')),
  ...['atrim', 'asetpts', 'apad'].map((name) => req('filter', name, 'freeze-frame audio')),
  req('filter', 'subtitles', 'burned-in captions (libass)'),

  // Containers written. Fast trim and mute keep the source container.
  req('muxer', 'mp4', 'MP4 output'),
  req('muxer', 'mov', 'fast trim of MOV'),
  req('muxer', 'matroska', 'fast trim of MKV'),
  req('muxer', 'webm', 'fast trim of WebM'),
  req('muxer', 'avi', 'fast trim of AVI'),
  req('muxer', 'mp3', 'MP3 output'),
  req('muxer', 'gif', 'GIF output'),
  req('muxer', 'webp', 'sticker output'),
  req('muxer', 'f32le', 'audio for Whisper'),

  // Containers read.
  req('demuxer', 'mov', 'MP4, MOV and M4A input'),
  req('demuxer', 'matroska', 'MKV and WebM input'),
  req('demuxer', 'avi', 'AVI input'),
  req('demuxer', 'mp3', 'MP3 input'),
  req('demuxer', 'wav', 'WAV input'),
  req('demuxer', 'ogg', 'OGG input'),
  req('demuxer', 'aac', 'raw AAC input'),
  req('demuxer', ['image2', 'png_pipe'], 'meme caption overlay image'),
];

export type CapabilitySet = Readonly<Record<CapabilityKind, ReadonlySet<string>>>;

/** The ffmpeg flag that lists each kind. */
export const LIST_FLAGS: Readonly<Record<CapabilityKind, string>> = {
  encoder: '-encoders',
  decoder: '-decoders',
  filter: '-filters',
  muxer: '-muxers',
  demuxer: '-demuxers',
};

/** Lines after the "------" separator of `-encoders` / `-decoders`: " V....D libx264  …". */
export function parseCodecList(log: readonly string[]): Set<string> {
  const names = new Set<string>();
  let started = false;
  for (const line of log) {
    if (!started) {
      started = /^\s*-{4,}\s*$/.test(line);
      continue;
    }
    const match = /^\s*[VASFXDB.]{6}\s+(\S+)/.exec(line);
    if (match?.[1]) names.add(match[1]);
  }
  return names;
}

/** Filter lines look like " TSC zoompan   V->V   Apply Zoom & Pan effect." */
export function parseFilterList(log: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const line of log) {
    const match = /^\s*[TSC.]{3}\s+(\S+)\s+\S*->\S*\s/.exec(line);
    if (match?.[1]) names.add(match[1]);
  }
  return names;
}

/**
 * Lines after the "--" separator of `-muxers` / `-demuxers`: "  E mp4  MP4 (MPEG-4 Part 14)".
 * Demuxers can list several names at once: " D  mov,mp4,m4a,3gp,3g2,mj2  QuickTime / MOV".
 */
export function parseFormatList(log: readonly string[]): Set<string> {
  const names = new Set<string>();
  let started = false;
  for (const line of log) {
    if (!started) {
      started = /^\s*--\s*$/.test(line);
      continue;
    }
    const match = /^\s*[D ][E ]\s?d?\s+(\S+)/.exec(line);
    for (const name of match?.[1]?.split(',') ?? []) if (name) names.add(name);
  }
  return names;
}

export function parseCapabilityLog(kind: CapabilityKind, log: readonly string[]): Set<string> {
  if (kind === 'filter') return parseFilterList(log);
  if (kind === 'muxer' || kind === 'demuxer') return parseFormatList(log);
  return parseCodecList(log);
}

/** Requirements the core does not meet, as "kind name" strings. Empty means all present. */
export function missingCapabilities(
  available: CapabilitySet,
  required: readonly Requirement[] = REQUIRED_CAPABILITIES,
): string[] {
  return required
    .filter(
      (requirement) => !requirement.anyOf.some((name) => available[requirement.kind].has(name)),
    )
    .map((requirement) => `${requirement.kind} ${requirement.anyOf.join('/')}`);
}
