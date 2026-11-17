import { t } from '@/i18n';

interface ErrorPanelProps {
  /** Plain-language message: what happened and what to do. */
  readonly message: string;
  /** Technical detail, hidden until the person opens "Details". */
  readonly detail?: string;
  readonly onRetry?: () => void;
  readonly onStartOver: () => void;
}

/** A failed job. The raw log is never shown unless asked for. */
export function ErrorPanel({ message, detail, onRetry, onStartOver }: ErrorPanelProps) {
  return (
    <section
      role="alert"
      data-testid="error-panel"
      className="appear border-rule bg-sheet flex flex-col gap-4 rounded-lg border px-5 py-5"
    >
      <p className="text-danger max-w-[60ch] font-medium">{message}</p>

      {detail && (
        <details className="group">
          <summary className="text-graphite hover:text-ink w-fit cursor-pointer text-sm">
            {t('errorPanel.details')}
          </summary>
          <pre className="border-rule bg-paper text-graphite mt-2 max-h-56 overflow-auto rounded-md border p-3 font-sans text-xs whitespace-pre-wrap">
            {detail}
          </pre>
        </details>
      )}

      <div className="flex flex-wrap gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="pressable bg-accent text-on-accent hover:bg-accent-strong min-h-12 rounded-full px-6 font-medium"
          >
            {t('errorPanel.tryAgain')}
          </button>
        )}
        <button
          type="button"
          onClick={onStartOver}
          className="pressable text-graphite hover:bg-accent-wash hover:text-ink min-h-12 rounded-full px-4"
        >
          {t('result.startOver')}
        </button>
      </div>
    </section>
  );
}
