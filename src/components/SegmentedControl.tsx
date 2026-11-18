'use client';

import { useId } from 'react';

export interface Segment<V extends string> {
  readonly value: V;
  readonly label: string;
  /** One line under the control explaining the selected option. */
  readonly hint: string;
}

interface SegmentedControlProps<V extends string> {
  readonly legend: string;
  readonly segments: readonly Segment<V>[];
  readonly value: V;
  readonly onChange: (value: V) => void;
}

/**
 * A choice between a few options, shown side by side. Native radio buttons underneath,
 * so arrow keys and screen readers work as people expect.
 */
export function SegmentedControl<V extends string>({
  legend,
  segments,
  value,
  onChange,
}: SegmentedControlProps<V>) {
  const name = useId();
  const selected = segments.find((segment) => segment.value === value);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-graphite mb-1 text-sm">{legend}</legend>
      <div className="border-rule bg-sheet inline-flex w-fit rounded-full border p-1">
        {segments.map((segment) => (
          <label
            key={segment.value}
            className="has-checked:bg-accent has-checked:text-on-accent hover:text-ink has-checked:hover:text-on-accent has-focus-visible:outline-accent text-graphite flex min-h-10 cursor-pointer items-center rounded-full px-4 text-[0.9375rem] transition-colors duration-200 has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
          >
            <input
              type="radio"
              name={name}
              value={segment.value}
              checked={segment.value === value}
              onChange={() => onChange(segment.value)}
              className="sr-only"
            />
            {segment.label}
          </label>
        ))}
      </div>
      {selected && (
        <p key={selected.value} className="appear text-graphite max-w-[56ch] text-sm">
          {selected.hint}
        </p>
      )}
    </fieldset>
  );
}
