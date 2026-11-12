import type { ToolPageEntry } from './registry';

/** Placeholder until each tool lands (M2–M5) and the full template (M6.1). */
export function ToolPage({ entry }: { entry: ToolPageEntry }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16" data-tool={entry.tool} data-slug={entry.slug}>
      <h1 className="text-3xl font-bold">{entry.slug}</h1>
    </main>
  );
}
