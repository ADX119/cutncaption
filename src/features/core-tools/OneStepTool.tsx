'use client';

import type { ReactNode } from 'react';
import { ErrorPanel, FileSummary, JobProgress, ResultCard } from '@/components';
import type { MediaJob } from '@/engine/media';
import { type ReadyFile, describeFile, getEngine, useJob } from '@/features/shell';
import { t } from '@/i18n';
import { LimitNotice } from './shared';

interface OneStepToolProps extends ReadyFile {
  /** Test id for the tool's main screen. */
  readonly testId: string;
  /** The job to run, built from the tool's current options. */
  readonly job: MediaJob;
  /** What will happen, in a sentence; may depend on the file (copy vs re-encode). */
  readonly explain: (path: string) => string;
  readonly runLabel: string;
  readonly runningLabel: string;
  /** Options shown above the button, if the tool has any. */
  readonly options?: ReactNode;
}

/**
 * The shape shared by tools that are one decision and one button: convert, extract
 * audio, mute. Shows the file, what will happen, any options, then progress, the
 * result or a plain error.
 */
export function OneStepTool({
  file,
  info,
  startOver,
  testId,
  job,
  explain,
  runLabel,
  runningLabel,
  options,
}: OneStepToolProps) {
  const { state, run, cancel, reset } = useJob();
  const assessment = getEngine().assess(job);

  if (state.status === 'running') {
    return (
      <JobProgress
        label={runningLabel}
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
    <div className="flex flex-col gap-6" data-testid={testId}>
      <FileSummary file={file} details={describeFile(file, info)} onClear={startOver} />
      <p className="max-w-[60ch]" data-testid="tool-explain">
        {explain(assessment.path)}
      </p>
      {options}
      {assessment.refusal && (
        <p className="text-danger max-w-[60ch]" role="alert" data-testid="tool-refusal">
          {t(`error.${assessment.refusal.code}`)}
        </p>
      )}
      <LimitNotice assessment={assessment} />
      <div>
        <button
          type="button"
          disabled={assessment.blocks.length > 0 || assessment.refusal !== undefined}
          onClick={() => void run(job)}
          className="pressable bg-accent text-on-accent hover:bg-accent-strong min-h-12 rounded-full px-7 font-medium disabled:opacity-50"
        >
          {runLabel}
        </button>
      </div>
    </div>
  );
}
