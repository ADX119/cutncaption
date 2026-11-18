'use client';

import {
  CompressTool,
  CompressToSizeTool,
  ConvertTool,
  Mp3Tool,
  mp3Bitrate,
  type SizePresetId,
  TrimTool,
} from '@/features/core-tools';
import { VIDEO_ACCEPT } from '@/components';
import { FileIntake } from '@/features/shell';
import type { ToolId, ToolPageEntry } from './registry';

const SIZE_PRESET_IDS: readonly string[] = ['whatsapp', 'discord', 'email'];
const sizePreset = (value: unknown): SizePresetId | undefined =>
  typeof value === 'string' && SIZE_PRESET_IDS.includes(value)
    ? (value as SizePresetId)
    : undefined;

/**
 * The working tool for a page. Tools are added here as they are built; until then a
 * page takes a file and reads it with the engine.
 */
export function ToolPlaceholder({
  tool,
  preset,
}: {
  tool: ToolId;
  preset: ToolPageEntry['preset'];
}) {
  switch (tool) {
    case 'trim':
      return <FileIntake>{(ready) => <TrimTool {...ready} />}</FileIntake>;
    case 'compress':
      return (
        <FileIntake accept={VIDEO_ACCEPT}>{(ready) => <CompressTool {...ready} />}</FileIntake>
      );
    case 'compress-to-size':
      return (
        <FileIntake accept={VIDEO_ACCEPT}>
          {(ready) => <CompressToSizeTool {...ready} initialPreset={sizePreset(preset.target)} />}
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
    default:
      return <FileIntake />;
  }
}
