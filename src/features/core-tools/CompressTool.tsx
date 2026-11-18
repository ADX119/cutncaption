'use client';

import { useState } from 'react';
import {
  ErrorPanel,
  FileSummary,
  JobProgress,
  ResultCard,
  type Segment,
  SegmentedControl,
} from '@/components';
import type { CompressJob, CompressQuality } from '@/engine/media';
import { type ReadyFile, describeFile, getEngine, useJob } from '@/features/shell';
import { t } from '@/i18n';
import { formatBytes } from '@/lib';
import { LimitNotice, NotSmallerPanel } from './shared';

/** Compress: make a video smaller with one of three presets. */
export function CompressTool({
  file,
  info,
  startOver,
  initialQuality = 'balanced',
}: ReadyFile & { readonly initialQuality?: CompressQuality }) {
  const [quality, setQuality] = useState<CompressQuality>(initialQuality);
  const { state, run, cancel, reset } = useJob();

  const job: CompressJob = { kind: 'compress', file, info, quality };
  const assessment = getEngine().assess(job);
  const estimate = assessment.estimatedOutputBytes ?? 0;
  const worthIt = estimate > 0 && estimate < file.size * 0.9;

  const presets: Segment<CompressQuality>[] = [
    { value: 'light', label: t('compress.light'), hint: t('compress.lightHint') },
    { value: 'balanced', label: t('compress.balanced'), hint: t('compress.balancedHint') },
    { value: 'small', label: t('compress.small'), hint: t('compress.smallHint') },
  ];

  if (state.status === 'running') {
    return (
      <JobProgress
        label={t('compress.running')}
        fraction={state.fraction}
        onCancel={cancel}
        cancelling={state.cancelling}
      />
    );
  }
  if (state.status === 'done') {
    if (state.result.blob.size >= file.size) {
      return (
        <NotSmallerPanel
          original={file}
          onTrySmaller={
            quality === 'small'
              ? undefined
              : () => {
                  setQuality('small');
                  reset();
                }
          }
          onStartOver={startOver}
        />
      );
    }
    return (
      <ResultCard
        blob={state.result.blob}
        filename={state.result.filename}
        inputBytes={file.size}
        onStartOver={startOver}
      />
    );
  }
  if (state.status === 'error') {
    return (
      <ErrorPanel
        message={state.message}
        detail={state.detail}
        onRetry={() => void run(state.job)}
        onStartOver={reset}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="compress-tool">
      <FileSummary file={file} details={describeFile(file, info)} onClear={startOver} />

      <SegmentedControl
        legend={t('compress.quality')}
        segments={presets}
        value={quality}
        onChange={setQuality}
      />

      <p className="tabular-nums" data-testid="compress-estimate">
        <span className="display text-2xl">
          {t('compress.estimate', { size: formatBytes(estimate) })}
        </span>
        {/* The message starts with a space, so the text reads correctly, not just looks right. */}
        <span className="text-graphite">
          {t('compress.from', { size: formatBytes(file.size) })}
        </span>
      </p>
      {!worthIt && (
        <p className="text-graphite max-w-[60ch] text-sm" data-testid="compress-small-already">
          {t('compress.alreadySmall')}
        </p>
      )}

      <LimitNotice assessment={assessment} />

      <div>
        <button
          type="button"
          disabled={assessment.blocks.length > 0}
          onClick={() => void run(job)}
          className="pressable bg-accent text-on-accent hover:bg-accent-strong min-h-12 rounded-full px-7 font-medium disabled:opacity-50"
        >
          {t('compress.run')}
        </button>
      </div>
    </div>
  );
}
