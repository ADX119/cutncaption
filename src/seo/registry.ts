/** The tool UIs a page can mount. Several pages share one tool with different presets. */
export type ToolId =
  | 'trim'
  | 'compress'
  | 'compress-to-size'
  | 'convert'
  | 'video-to-mp3'
  | 'mute'
  | 'meme'
  | 'captions'
  | 'crop';

export interface ToolPageEntry {
  /** URL segment: /tools/<slug>/ */
  readonly slug: string;
  readonly tool: ToolId;
  /** Page-specific starting options, read by the tool when it mounts. */
  readonly preset: Readonly<Record<string, string | number>>;
}

/** The 20 tool pages, in the order of docs/ARCHITECTURE.md §11. */
export const TOOL_PAGES: readonly ToolPageEntry[] = [
  { slug: 'trim-video', tool: 'trim', preset: {} },
  { slug: 'compress-video', tool: 'compress', preset: { quality: 'balanced' } },
  { slug: 'compress-video-to-size', tool: 'compress-to-size', preset: {} },
  { slug: 'compress-video-for-whatsapp', tool: 'compress-to-size', preset: { targetMb: 16 } },
  { slug: 'compress-video-for-discord', tool: 'compress-to-size', preset: { targetMb: 10 } },
  { slug: 'convert-to-mp4', tool: 'convert', preset: {} },
  { slug: 'mov-to-mp4', tool: 'convert', preset: { accept: '.mov' } },
  { slug: 'video-to-mp3', tool: 'video-to-mp3', preset: { bitrateKbps: 192 } },
  { slug: 'mute-video', tool: 'mute', preset: {} },
  { slug: 'video-meme-maker', tool: 'meme', preset: { format: 'mp4' } },
  { slug: 'video-to-gif', tool: 'meme', preset: { format: 'gif' } },
  { slug: 'video-to-whatsapp-sticker', tool: 'meme', preset: { format: 'sticker' } },
  { slug: 'video-to-image', tool: 'meme', preset: { format: 'still' } },
  { slug: 'auto-captions', tool: 'captions', preset: { lang: 'en' } },
  { slug: 'hindi-captions', tool: 'captions', preset: { lang: 'hi', script: 'native' } },
  { slug: 'hinglish-captions', tool: 'captions', preset: { lang: 'hi', script: 'roman' } },
  { slug: 'video-to-srt', tool: 'captions', preset: { lang: 'en', export: 'srt' } },
  { slug: 'crop-video-for-reels', tool: 'crop', preset: { platform: 'reels' } },
  { slug: 'crop-video-for-youtube-shorts', tool: 'crop', preset: { platform: 'shorts' } },
  { slug: 'crop-video-for-tiktok', tool: 'crop', preset: { platform: 'tiktok' } },
];

export function getToolPage(slug: string): ToolPageEntry | undefined {
  return TOOL_PAGES.find((page) => page.slug === slug);
}

export function toolPath(slug: string): string {
  return `/tools/${slug}/`;
}
