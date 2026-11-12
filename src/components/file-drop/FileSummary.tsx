import { t } from '@/i18n';
import { formatBytes } from '@/lib';

interface FileSummaryProps {
  readonly file: Pick<File, 'name' | 'size'>;
  readonly onClear: () => void;
}

/** The chosen file, with a way to pick a different one. */
export function FileSummary({ file, onClear }: FileSummaryProps) {
  return (
    <div
      data-testid="file-summary"
      className="appear border-rule bg-sheet flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3"
    >
      <p className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-medium" title={file.name}>
          {file.name}
        </span>
        <span className="text-graphite text-sm">{formatBytes(file.size)}</span>
      </p>
      <button
        type="button"
        onClick={onClear}
        className="pressable border-rule hover:bg-accent-wash min-h-11 rounded-full border px-4 text-[0.9375rem]"
      >
        {t('file.chooseAnother')}
      </button>
    </div>
  );
}
