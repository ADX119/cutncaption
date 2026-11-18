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
import type { CompressToSizeJob } from '@/engine/media';
import { type ReadyFile, describeFile, getEngine, useJob } from '@/features/shell';
import { t } from '@/i18n';
import { formatBytes } from '@/lib';
import { LimitNotice } from './shared';
import {
  SIZE_PRESETS,
  type SizePresetId,
  customTargetBytes,
  presetTargetBytes,
} from './sizePresets';

type Choice = SizePresetId | 'custom';

/** Compress to size: make a video fit a limit, such as WhatsApp's 16 MB. */
export function CompressToSizeTool({
  file,
  info,
  startOver,
  initialPreset,
}: ReadyFile & { readonly initialPreset?: SizePresetId }) {
  const [choice, setChoice] = useState<Choice>(initialPreset ?? 'custom');
  const [customText, setCustomText] = useState('10');
  const { state, run, cancel, reset } = useJob();

  const targetBytes =
    choice === 'custom' ? customTargetBytes(customText) : presetTargetBytes(choice);
  const job: CompressToSizeJob | null =
    targetBytes === null ? null : { kind: 'compressToSize', file, info, targetBytes };
  const assessment = job ? getEngine().assess(job) : null;
  const refusal = assessment?.refusal;
  const canRun = job !== null && !refusal && (assessment?.blocks.length ?? 0) === 0;

  const choices: Segment<Choice>[] = [
    ...(Object.keys(SIZE_PRESETS) as SizePresetId[]).map((id) => ({
      value: id,
      label: t(`size.${id}`),
      hint: t(`size.${id}Hint`, { mb: SIZE_PRESETS[id].labelMb }),
    })),
    { value: 'custom', label: t('size.custom'), hint: t('size.customHint') },
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
    <div className="flex flex-col gap-6" data-testid="size-tool">
      <FileSummary file={file} details={describeFile(file, info)} onClear={startOver} />

      <SegmentedControl
        legend={t('size.fitFor')}
        segments={choices}
        value={choice}
        onChange={setChoice}
      />

      {choice === 'custom' && (
        <label className="flex flex-col gap-1">
          <span className="text-graphite text-sm">{t('size.customLabel')}</span>
          <input
            type="text"
            inputMode="decimal"
            value={customText}
            aria-invalid={targetBytes === null}
            onChange={(event) => setCustomText(event.target.value)}
            className="border-rule bg-sheet aria-[invalid=true]:border-danger min-h-11 w-32 rounded-md border px-3 tabular-nums"
          />
        </label>
      )}

      <div data-testid="size-plan" className="flex flex-col gap-2">
        {targetBytes === null && <p className="text-danger">{t('size.invalid')}</p>}
        {refusal?.code === 'already-under-target' && (
          <p className="max-w-[60ch]">{t('error.already-under-target')}</p>
        )}
        {refusal?.code === 'target-unreachable' && (
          <div className="flex flex-col items-start gap-3">
            <p className="max-w-[60ch]">
              {t('size.tooSmall', { size: formatBytes(refusal.smallestBytes) })}
            </p>
            <button
              type="button"
              onClick={() => {
                setChoice('custom');
                // Round up to a tidy figure the person can read and edit.
                setCustomText(String(Math.ceil(refusal.smallestBytes / 0.97 / 100_000) / 10));
              }}
              className="pressable border-rule hover:bg-accent-wash min-h-11 rounded-full border px-5"
            >
              {t('size.useSmallest')}
            </button>
          </div>
        )}
        {job && !refusal && (
          <p className="tabular-nums">
            <span className="display text-2xl">
              {t('size.under', { size: formatBytes(job.targetBytes) })}
            </span>
            <span className="text-graphite">
              {t('compress.from', { size: formatBytes(file.size) })}
            </span>
          </p>
        )}
      </div>

      {assessment && <LimitNotice assessment={assessment} />}

      <div>
        <button
          type="button"
          disabled={!canRun}
          onClick={() => job && void run(job)}
          className="pressable bg-accent text-on-accent hover:bg-accent-strong min-h-12 rounded-full px-7 font-medium disabled:opacity-50"
        >
          {t('compress.run')}
        </button>
      </div>
    </div>
  );
}
