import type { ReactNode } from 'react';

/** A calm, full-width message shown in place of a tool that cannot run here. */
export function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      data-testid="browser-notice"
      className="appear border-rule bg-sheet flex flex-col items-start gap-4 rounded-lg border px-6 py-8"
    >
      <h2 className="display text-2xl text-balance">{title}</h2>
      {children}
    </section>
  );
}
