'use client';

import { frameDuration, momentLimits, stepFrame } from '@/editor/meme';
import { type TimeRange, clampRange, formatClock } from '@/editor/timeline';
import { RangeTimeline } from '@/features/editing';
import { t } from '@/i18n';

interface MomentPickerProps {
  readonly duration: number;
  /** From the probe; frame stepping assumes 30 fps when unknown. */
  readonly fps: number | null;
  readonly range: TimeRange;
  readonly onRangeChange: (range: TimeRange) => void;
  readonly playhead: number;
  readonly onSeek: (seconds: number) => void;
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const QUIET_ICON =
  'pressable text-graphite hover:bg-accent-wash hover:text-ink flex h-11 w-11 items-center justify-center rounded-full';
const SECONDARY =
  'pressable border-rule hover:bg-accent-wash min-h-11 rounded-full border px-4 text-[0.9375rem]';

/**
 * Marks the 2–15 s moment a meme is made from. Handles stop at the limits; arrow keys
 * move a handle one frame (Shift: 1 s); the frame buttons step the playhead along the
 * video's own frames, and Start here / End here put a handle on the frame showing.
 */
export function MomentPicker({
  duration,
  fps,
  range,
  onRangeChange,
  playhead,
  onSeek,
}: MomentPickerProps) {
  const limits = momentLimits(duration);

  const setEdge = (edge: 'start' | 'end') => {
    const next = clampRange({ ...range, [edge]: playhead }, limits, edge);
    onRangeChange(next);
    onSeek(next[edge]);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="moment-picker">
      <RangeTimeline
        range={range}
        limits={limits}
        playhead={playhead}
        step={frameDuration(fps)}
        onRangeChange={onRangeChange}
        onSeek={onSeek}
      />
      <p className="text-graphite px-4 text-sm">{t('moment.hint')}</p>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('moment.previousFrame')}
            onClick={() => onSeek(stepFrame(playhead, -1, fps, limits.duration))}
            className={QUIET_ICON}
          >
            <Chevron direction="left" />
          </button>
          <span
            className="min-w-[6ch] text-center text-[0.9375rem] tabular-nums"
            data-testid="moment-playhead"
          >
            {formatClock(playhead, 2)}
          </span>
          <button
            type="button"
            aria-label={t('moment.nextFrame')}
            onClick={() => onSeek(stepFrame(playhead, 1, fps, limits.duration))}
            className={QUIET_ICON}
          >
            <Chevron direction="right" />
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEdge('start')} className={SECONDARY}>
            {t('moment.startHere')}
          </button>
          <button type="button" onClick={() => setEdge('end')} className={SECONDARY}>
            {t('moment.endHere')}
          </button>
        </div>
      </div>
    </div>
  );
}
