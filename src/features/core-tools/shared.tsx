'use client';

import { useEffect, useState } from 'react';
import type { LimitCode } from '@/engine/device';
import type { Assessment } from '@/engine/media';
import { t } from '@/i18n';

/** The message for a hard device limit. Warnings never block, so they have none. */
export function blockMessage(code: LimitCode | undefined): string {
  switch (code) {
    case 'input-too-large':
    case 'output-too-large':
    case 'caption-audio-too-long':
      return t(`error.${code}`);
    default:
      return t('error.job-failed');
  }
}

/** Device-limit warning or block for the job a tool is about to run. */
export function LimitNotice({ assessment }: { readonly assessment: Assessment }) {
  const [block] = assessment.blocks;
  if (block) {
    return (
      <p className="text-danger max-w-[60ch]" role="alert" data-testid="limit-block">
        {blockMessage(block.code)}
      </p>
    );
  }
  if (assessment.warnings.length > 0) {
    return (
      <p className="text-graphite max-w-[60ch] text-sm" data-testid="limit-warning">
        {t('limits.slowWarning')}
      </p>
    );
  }
  return null;
}

/**
 * Shown when a compression came out no smaller than the original (PRD 4.1): say so
 * and offer the original, rather than handing over a bigger file.
 */
export function NotSmallerPanel({
  original,
  onTrySmaller,
  onStartOver,
}: {
  readonly original: File;
  readonly onTrySmaller?: () => void;
  readonly onStartOver: () => void;
}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const objectUrl = URL.createObjectURL(original);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with an external resource
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [original]);

  return (
    <section
      data-testid="not-smaller"
      className="appear border-rule bg-sheet flex flex-col gap-4 rounded-lg border px-5 py-5"
    >
      <p className="display text-xl">{t('compress.notSmallerTitle')}</p>
      <p className="text-graphite max-w-[60ch]">{t('compress.notSmallerBody')}</p>
      <div className="flex flex-wrap gap-3">
        {onTrySmaller && (
          <button
            type="button"
            onClick={onTrySmaller}
            className="pressable bg-accent text-on-accent hover:bg-accent-strong min-h-12 rounded-full px-6 font-medium"
          >
            {t('compress.trySmall')}
          </button>
        )}
        {url && (
          <a
            href={url}
            download={original.name}
            className="pressable border-rule hover:bg-accent-wash flex min-h-12 items-center rounded-full border px-5"
          >
            {t('compress.keepOriginal')}
          </a>
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
