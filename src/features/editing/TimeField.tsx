'use client';

import { useState } from 'react';
import { formatClock, parseClock } from '@/editor/timeline';
import { t } from '@/i18n';

interface TimeFieldProps {
  readonly label: string;
  readonly value: number;
  /** Receives what was typed; the caller clamps it to the allowed range. */
  readonly onCommit: (seconds: number) => void;
}

/**
 * A typed time ("1:02.5"). Commits on Enter or when focus leaves; an unreadable
 * entry is pointed out and the last good value is kept.
 */
export function TimeField({ label, value, onCommit }: TimeFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const shown = draft ?? formatClock(value);

  function commit() {
    if (draft === null) return;
    const seconds = parseClock(draft);
    if (seconds === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(null);
    onCommit(seconds);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-graphite text-sm">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${label}-error` : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            setDraft(null);
            setInvalid(false);
          }
        }}
        className="border-rule bg-sheet aria-[invalid=true]:border-danger min-h-11 w-32 rounded-md border px-3 tabular-nums"
      />
      {invalid && (
        <span id={`${label}-error`} className="text-danger text-sm">
          {t('timeline.invalidTime')}
        </span>
      )}
    </label>
  );
}
