import { BrowserGate } from '@/features/shell';
import type { ToolPageEntry } from './registry';
import { ToolPlaceholder } from './ToolPlaceholder';

/** Placeholder until each tool lands (M2–M5) and the full template (M6.1). */
export function ToolPage({ entry }: { entry: ToolPageEntry }) {
  return (
    <main
      className="mx-auto max-w-5xl px-4 pt-14 sm:px-6"
      data-tool={entry.tool}
      data-slug={entry.slug}
    >
      <h1 className="display text-4xl">{entry.slug}</h1>
      <div className="mt-8">
        <BrowserGate>
          <ToolPlaceholder tool={entry.tool} />
        </BrowserGate>
      </div>
    </main>
  );
}
