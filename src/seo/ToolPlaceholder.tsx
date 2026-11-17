'use client';

import { FileIntake } from '@/features/shell';

/** Stands in for a tool until it is built: takes a file and reads it with the engine. */
export function ToolPlaceholder() {
  return <FileIntake />;
}
