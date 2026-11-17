'use client';

import { useEffect, useMemo, useState } from 'react';
import { t } from '@/i18n';
import { formatBytes } from '@/lib';

interface ResultCardProps {
  readonly blob: Blob;
  readonly filename: string;
  /** Size of the file the person started with, to show what changed. */
  readonly inputBytes: number;
  readonly onStartOver: () => void;
}

/** "−42%" style change from input to output size, or null when it is the same. */
export function sizeChange(
  before: number,
  after: number,
): { percent: number; smaller: boolean } | null {
  if (before <= 0) return null;
  const percent = Math.round(((after - before) / before) * 100);
  if (percent === 0) return null;
  return { percent: Math.abs(percent), smaller: percent < 0 };
}

function canShareFile(file: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** A finished job: preview, size, and ways to keep it. */
export function ResultCard({ blob, filename, inputBytes, onStartOver }: ResultCardProps) {
  const [url, setUrl] = useState<string>();
  const file = useMemo(() => new File([blob], filename, { type: blob.type }), [blob, filename]);
  // Only ever rendered in the browser, after a job; no server render to match.
  const shareable = useMemo(() => typeof navigator !== 'undefined' && canShareFile(file), [file]);
  const kind = blob.type.split('/')[0];
  const change = sizeChange(inputBytes, blob.size);

  // The object URL lives exactly as long as this card, so memory is given back. It is
  // created and revoked in the same effect so React's development double-run cannot
  // leave the card holding a revoked URL.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with an external resource
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  async function share() {
    try {
      await navigator.share({ files: [file] });
    } catch {
      // Closing the share sheet rejects too; there is nothing to report.
    }
  }

  return (
    <section
      data-testid="result-card"
      className="appear border-rule bg-sheet flex flex-col gap-5 rounded-lg border p-4 sm:p-5"
    >
      {url && kind === 'video' && (
        <video
          src={url}
          controls
          playsInline
          className="bg-stage aspect-video w-full rounded-md object-contain"
        />
      )}
      {url && kind === 'audio' && <audio src={url} controls className="w-full" />}
      {url && kind === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob, not a site image
        <img
          src={url}
          alt={filename}
          className="bg-stage max-h-96 w-full rounded-md object-contain"
        />
      )}

      <div className="flex flex-col gap-1">
        <p className="truncate font-medium" title={filename}>
          {filename}
        </p>
        <p className="text-graphite text-sm" data-testid="result-size">
          {t('result.size', { before: formatBytes(inputBytes), after: formatBytes(blob.size) })}
          {change &&
            ` · ${
              change.smaller
                ? t('result.smaller', { percent: change.percent })
                : t('result.larger', { percent: change.percent })
            }`}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {url && (
          <a
            href={url}
            download={filename}
            className="pressable bg-accent text-on-accent hover:bg-accent-strong flex min-h-12 items-center rounded-full px-6 font-medium"
          >
            {t('result.download')}
          </a>
        )}
        {shareable && (
          <button
            type="button"
            onClick={share}
            className="pressable border-rule hover:bg-accent-wash min-h-12 rounded-full border px-5"
          >
            {t('result.share')}
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
