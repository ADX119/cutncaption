'use client';

import { type KeyboardEvent, type PointerEvent, useRef } from 'react';
import {
  type RangeEdge,
  type RangeLimits,
  type TimeRange,
  clampRange,
  formatClock,
  nudgeRange,
  timeAt,
} from '@/editor/timeline';
import { t } from '@/i18n';

interface RangeTimelineProps {
  readonly range: TimeRange;
  readonly limits: RangeLimits;
  /** Current playhead, drawn as a thin line. */
  readonly playhead: number;
  readonly onRangeChange: (range: TimeRange) => void;
  /** Called when the person clicks the track or lets go of a handle. */
  readonly onSeek: (seconds: number) => void;
}

/** Arrow keys move 0.1 s, with Shift 1 s; Home and End jump to the limits. */
const STEP = 0.1;
const BIG_STEP = 1;

/**
 * The trim selection: two handles and the span between them, the same shape as the
 * logo. Handles are sliders for keyboards and screen readers; pointers drag them.
 */
export function RangeTimeline({
  range,
  limits,
  playhead,
  onRangeChange,
  onSeek,
}: RangeTimelineProps) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef<RangeEdge | null>(null);
  const { duration } = limits;
  const percent = (seconds: number) => (duration > 0 ? (seconds / duration) * 100 : 0);

  const timeFromPointer = (event: PointerEvent) => {
    const box = track.current?.getBoundingClientRect();
    return box ? timeAt(event.clientX - box.left, box.width, duration) : 0;
  };

  function startDrag(edge: RangeEdge, event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    dragging.current = edge;
  }

  function drag(event: PointerEvent) {
    const edge = dragging.current;
    if (!edge) return;
    onRangeChange(clampRange({ ...range, [edge]: timeFromPointer(event) }, limits, edge));
  }

  function endDrag() {
    const edge = dragging.current;
    dragging.current = null;
    if (edge) onSeek(range[edge]);
  }

  function onKey(edge: RangeEdge, event: KeyboardEvent) {
    const step = event.shiftKey ? BIG_STEP : STEP;
    let next: TimeRange | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
      next = nudgeRange(range, edge, -step, limits);
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
      next = nudgeRange(range, edge, step, limits);
    if (event.key === 'Home') next = clampRange({ ...range, [edge]: 0 }, limits, edge);
    if (event.key === 'End') next = clampRange({ ...range, [edge]: duration }, limits, edge);
    if (!next) return;
    event.preventDefault();
    onRangeChange(next);
    onSeek(next[edge]);
  }

  const handle = (edge: RangeEdge) => (
    <div
      role="slider"
      tabIndex={0}
      data-testid={`handle-${edge}`}
      aria-label={edge === 'start' ? t('timeline.start') : t('timeline.end')}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration * 10) / 10}
      aria-valuenow={range[edge]}
      aria-valuetext={formatClock(range[edge])}
      onPointerDown={(event) => startDrag(edge, event)}
      onPointerMove={drag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => onKey(edge, event)}
      className={`bg-accent absolute inset-y-0 z-10 flex w-4 cursor-ew-resize touch-none items-center justify-center focus-visible:outline-offset-0 ${
        edge === 'start' ? '-translate-x-full rounded-l-md' : 'rounded-r-md'
      }`}
      style={{ left: `${percent(range[edge])}%` }}
    >
      <span className="bg-on-accent h-5 w-0.5 rounded-full opacity-70" aria-hidden="true" />
    </div>
  );

  return (
    <div className="flex flex-col gap-2 px-4">
      <div
        ref={track}
        data-testid="timeline-track"
        onPointerDown={(event) => onSeek(timeFromPointer(event))}
        className="border-rule bg-sheet relative h-16 cursor-pointer touch-none rounded-md border"
      >
        <div
          className="text-rule absolute inset-0 rounded-md"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, currentColor 0 1px, transparent 1px 100%)',
            backgroundSize: '2.5% 100%',
          }}
        />
        <div
          className="bg-accent-wash border-accent absolute inset-y-0 border-y-2"
          style={{ left: `${percent(range.start)}%`, right: `${100 - percent(range.end)}%` }}
          aria-hidden="true"
        />
        <div
          className="bg-ink pointer-events-none absolute -inset-y-1.5 z-20 w-0.5 rounded-full"
          style={{ left: `${percent(Math.min(playhead, duration))}%` }}
          aria-hidden="true"
        />
        {handle('start')}
        {handle('end')}
      </div>
      <p
        className="text-graphite flex justify-between text-sm tabular-nums"
        data-testid="timeline-readout"
      >
        <span>{formatClock(range.start)}</span>
        <span className="text-ink font-medium">
          {t('timeline.length', { length: formatClock(range.end - range.start) })}
        </span>
        <span>{formatClock(range.end)}</span>
      </p>
    </div>
  );
}
