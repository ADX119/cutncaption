import { t } from '@/i18n';

interface JobProgressProps {
  /** What is happening, in the tool's words: "Converting", "Trimming". */
  readonly label: string;
  /** 0–1, or null when the length of the job is not known. */
  readonly fraction: number | null;
  readonly onCancel: () => void;
  /** True once Cancel has been pressed and the job is stopping. */
  readonly cancelling?: boolean;
}

/** A running job: what it is doing, how far it has got, and a way to stop it. */
export function JobProgress({ label, fraction, onCancel, cancelling = false }: JobProgressProps) {
  const percent = fraction === null ? null : Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  return (
    <section
      data-testid="job-progress"
      aria-label={label}
      className="appear border-rule bg-sheet flex flex-col gap-4 rounded-lg border px-5 py-5"
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="display text-xl">{label}</p>
        <p className="text-graphite tabular-nums" aria-hidden="true">
          {percent === null ? t('job.working') : t('job.percent', { percent })}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? t('job.working') : t('job.percent', { percent })}
        className="bg-accent-wash relative h-2 overflow-hidden rounded-full"
      >
        {percent === null ? (
          <span className="progress-indeterminate bg-accent absolute inset-y-0 w-1/4 rounded-full" />
        ) : (
          <span
            className="bg-accent absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-[var(--ease-settle)]"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="pressable border-rule hover:bg-accent-wash min-h-11 rounded-full border px-5 text-[0.9375rem] disabled:opacity-60"
        >
          {cancelling ? t('job.cancelling') : t('job.cancel')}
        </button>
      </div>
    </section>
  );
}
