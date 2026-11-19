'use client';

import { VIDEO_ACCEPT } from '@/components';
import {
  type CompressQuality,
  CompressTool,
  CompressToSizeTool,
  ConvertTool,
  Mp3Tool,
  MuteTool,
  type SizePresetId,
  TrimTool,
  mp3Bitrate,
} from '@/features/core-tools';
import { EXPORT_FORMATS, type ExportFormat, MemeStudio } from '@/features/meme-studio';
import { FileIntake } from '@/features/shell';
import type { ToolId, ToolPageEntry } from './registry';

const SIZE_PRESETS: readonly string[] = ['whatsapp', 'discord', 'email'];
const QUALITIES: readonly string[] = ['light', 'balanced', 'small'];

/** A registry preset value, if it is one of the allowed ones. */
function oneOf<T extends string>(allowed: readonly string[], value: unknown): T | undefined {
  return typeof value === 'string' && allowed.includes(value) ? (value as T) : undefined;
}

/**
 * The working tool for a tool page, started with the page's preset. Tools not built
 * yet (captions, crop) take a file and read it with the engine.
 */
export function ToolMount({ tool, preset }: { tool: ToolId; preset: ToolPageEntry['preset'] }) {
  switch (tool) {
    case 'trim':
      return <FileIntake accept={VIDEO_ACCEPT}>{(ready) => <TrimTool {...ready} />}</FileIntake>;
    case 'compress':
      return (
        <FileIntake accept={VIDEO_ACCEPT}>
          {(ready) => (
            <CompressTool
              {...ready}
              initialQuality={oneOf<CompressQuality>(QUALITIES, preset.quality)}
            />
          )}
        </FileIntake>
      );
    case 'compress-to-size':
      return (
        <FileIntake accept={VIDEO_ACCEPT}>
          {(ready) => (
            <CompressToSizeTool
              {...ready}
              initialPreset={oneOf<SizePresetId>(SIZE_PRESETS, preset.target)}
            />
          )}
        </FileIntake>
      );
    case 'convert':
      return <FileIntake accept={VIDEO_ACCEPT}>{(ready) => <ConvertTool {...ready} />}</FileIntake>;
    case 'video-to-mp3':
      return (
        <FileIntake>
          {(ready) => <Mp3Tool {...ready} initialBitrate={mp3Bitrate(preset.bitrateKbps)} />}
        </FileIntake>
      );
    case 'mute':
      return <FileIntake accept={VIDEO_ACCEPT}>{(ready) => <MuteTool {...ready} />}</FileIntake>;
    case 'meme':
      return (
        <FileIntake accept={VIDEO_ACCEPT}>
          {(ready) => (
            <MemeStudio
              {...ready}
              initialFormat={oneOf<ExportFormat>(EXPORT_FORMATS, preset.format)}
            />
          )}
        </FileIntake>
      );
    case 'captions':
    case 'crop':
      return <FileIntake />;
  }
}
