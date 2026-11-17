import { t } from '@/i18n';
import { formatBytes } from '@/lib';

interface EngineDownloadProps {
  readonly loadedBytes: number;
  readonly totalBytes: number;
}

/** First visit only: the editor is being fetched once and kept on this device. */
export function EngineDownload({ loadedBytes, totalBytes }: EngineDownloadProps) {
  const percent = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
  return (
    <section
      data-testid="engine-download"
      aria-label={t('engineDownload.title')}
      className="appear border-rule bg-sheet flex flex-col gap-4 rounded-lg border px-5 py-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="display text-xl">{t('engineDownload.title')}</p>
        <p className="text-graphite tabular-nums">
          {t('engineDownload.amount', {
            loaded: formatBytes(loadedBytes),
            total: formatBytes(totalBytes),
          })}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={t('engineDownload.title')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="bg-accent-wash relative h-2 overflow-hidden rounded-full"
      >
        <span
          className="bg-accent absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-[var(--ease-settle)]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-graphite max-w-[56ch] text-sm">{t('engineDownload.hint')}</p>
    </section>
  );
}
