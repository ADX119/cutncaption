'use client';

import { useId } from 'react';
import type { MemeLayoutId } from '@/editor/meme';
import { t } from '@/i18n';

const LAYOUTS: readonly MemeLayoutId[] = ['top-bottom', 'caption-bar', 'freeze-zoom'];

/** A small drawing of each layout: the frame, and where the text goes. */
function Diagram({ layout }: { layout: MemeLayoutId }) {
  return (
    <svg viewBox="0 0 64 44" className="h-10 w-14" fill="none" aria-hidden="true">
      {layout === 'caption-bar' ? (
        <>
          <rect x="1" y="1" width="62" height="42" rx="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 15h62" stroke="currentColor" strokeWidth="1.5" />
          <rect x="16" y="6.5" width="32" height="3" rx="1.5" fill="currentColor" />
          <rect x="5" y="19" width="54" height="20" rx="2" fill="currentColor" opacity="0.18" />
        </>
      ) : (
        <>
          <rect x="1" y="1" width="62" height="42" rx="4" fill="currentColor" opacity="0.18" />
          <rect x="1" y="1" width="62" height="42" rx="4" stroke="currentColor" strokeWidth="1.5" />
          {layout === 'top-bottom' ? (
            <rect x="14" y="7" width="36" height="4" rx="2" fill="currentColor" />
          ) : (
            <rect
              x="20"
              y="9"
              width="24"
              height="16"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />
          )}
          <rect x="14" y="33" width="36" height="4" rx="2" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/** The three layouts as pictures; native radios underneath for keyboards and screen readers. */
export function LayoutPicker({
  value,
  onChange,
}: {
  value: MemeLayoutId;
  onChange: (layout: MemeLayoutId) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-graphite mb-1 text-sm">{t('meme.layout')}</legend>
      <div className="grid grid-cols-3 gap-2">
        {LAYOUTS.map((layout) => (
          <label
            key={layout}
            className="pressable border-rule text-graphite hover:text-ink has-checked:border-accent has-checked:bg-accent-wash has-checked:text-ink has-focus-visible:outline-accent flex cursor-pointer flex-col items-center gap-2 rounded-lg border px-2 py-3 text-center text-[0.9375rem] leading-tight transition-colors duration-200 has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
          >
            <input
              type="radio"
              name={name}
              value={layout}
              checked={layout === value}
              onChange={() => onChange(layout)}
              className="sr-only"
            />
            <Diagram layout={layout} />
            {t(`meme.layout.${layout}`)}
          </label>
        ))}
      </div>
      <p key={value} className="appear text-graphite max-w-[56ch] text-sm">
        {t(`meme.layout.${value}.hint`)}
      </p>
    </fieldset>
  );
}
