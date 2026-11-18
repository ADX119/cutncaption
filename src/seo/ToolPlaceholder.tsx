'use client';

import { TrimTool } from '@/features/core-tools';
import { FileIntake } from '@/features/shell';
import type { ToolId } from './registry';

/**
 * The working tool for a page. Tools are added here as they are built; until then a
 * page takes a file and reads it with the engine.
 */
export function ToolPlaceholder({ tool }: { tool: ToolId }) {
  switch (tool) {
    case 'trim':
      return <FileIntake>{(ready) => <TrimTool {...ready} />}</FileIntake>;
    default:
      return <FileIntake />;
  }
}
