/** Which files a tool takes. A file passes if its extension OR its MIME type matches. */
export interface AcceptSpec {
  /** Lower-case, with the dot: '.mp4'. */
  readonly extensions: readonly string[];
  /** MIME prefixes: 'video/'. */
  readonly mimePrefixes: readonly string[];
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'];

export const VIDEO_ACCEPT: AcceptSpec = {
  extensions: VIDEO_EXTENSIONS,
  mimePrefixes: ['video/'],
};

export const MEDIA_ACCEPT: AcceptSpec = {
  extensions: [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS],
  mimePrefixes: ['video/', 'audio/'],
};

interface FileLike {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

/**
 * Extension is checked as well as MIME type because some systems report no type
 * for MKV and similar files, and shared files can arrive without an extension.
 */
export function matchesAccept(file: Pick<FileLike, 'name' | 'type'>, spec: AcceptSpec): boolean {
  const name = file.name.toLowerCase();
  if (spec.extensions.some((extension) => name.endsWith(extension))) return true;
  return spec.mimePrefixes.some((prefix) => file.type.startsWith(prefix));
}

/** Value for <input accept>. */
export function toAcceptAttribute(spec: AcceptSpec): string {
  return [...spec.mimePrefixes.map((prefix) => `${prefix}*`), ...spec.extensions].join(',');
}

export type FileRejection = 'not-a-file' | 'too-many' | 'wrong-type' | 'empty';

export type FilePick<F extends FileLike> =
  { readonly ok: true; readonly file: F } | { readonly ok: false; readonly reason: FileRejection };

/**
 * Decides what to do with whatever was picked or dropped. A drop with no files is a
 * dragged link or text, which is never accepted: input is a local file only.
 */
export function pickFile<F extends FileLike>(files: ArrayLike<F>, spec: AcceptSpec): FilePick<F> {
  if (files.length === 0) return { ok: false, reason: 'not-a-file' };
  if (files.length > 1) return { ok: false, reason: 'too-many' };
  const file = files[0] as F;
  if (!matchesAccept(file, spec)) return { ok: false, reason: 'wrong-type' };
  if (file.size === 0) return { ok: false, reason: 'empty' };
  return { ok: true, file };
}
