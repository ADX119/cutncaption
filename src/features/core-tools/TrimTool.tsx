'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ErrorPanel,
  FileSummary,
  JobProgress,
  ResultCard,
  type Segment,
  SegmentedControl,
} from '@/components';
import { type TimeRange, clampRange, initialRange } from '@/editor/timeline';
import type { TrimJob } from '@/engine/media';
import { RangeTimeline, TimeField, VideoPreview } from '@/features/editing';
import { type ReadyFile, describeFile, getEngine, useJob } from '@/features/shell';
import { t } from '@/i18n';
import { LimitNotice } from './shared';

type Mode = TrimJob['mode'];

/** Trim: choose a stretch of the video and save just that part. */
export function TrimTool({ file, info, startOver }: ReadyFile) {
  const duration = info.durationSec ?? 0;
  const limits = useMemo(() => ({ duration }), [duration]);
  const [range, setRange] = useState<TimeRange>(() => initialRange(limits));
  const [playhead, setPlayhead] = useState(0);
  const [mode, setMode] = useState<Mode>('precise');
  const video = useRef<HTMLVideoElement>(null);
  const { state, run, cancel, reset } = useJob();

  const job: TrimJob = { kind: 'trim', file, info, start: range.start, end: range.end, mode };
  const assessment = getEngine().assess(job);
  const blocked = assessment.blocks.length > 0;

  const seek = (seconds: number) => {
    if (video.current) video.current.currentTime = seconds;
    setPlayhead(seconds);
  };

  const modes: Segment<Mode>[] = [
    { value: 'precise', label: t('trim.precise'), hint: t('trim.preciseHint') },
    { value: 'fast', label: t('trim.fast'), hint: t('trim.fastHint') },
  ];

  if (state.status === 'running') {
    return (
      <JobProgress
        label={t('trim.running')}
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
    <div className="flex flex-col gap-6" data-testid="trim-tool">
      <FileSummary file={file} details={describeFile(file, info)} onClear={startOver} />

      <VideoPreview
        file={file}
        videoRef={video}
        onTime={setPlayhead}
        loop={range}
        label={t('preview.video')}
      />

      <RangeTimeline
        range={range}
        limits={limits}
        playhead={playhead}
        onRangeChange={setRange}
        onSeek={seek}
      />

      <div className="flex flex-wrap items-end gap-x-8 gap-y-6">
        <div className="flex gap-4">
          <TimeField
            label={t('timeline.startField')}
            value={range.start}
            onCommit={(seconds) => {
              const next = clampRange({ ...range, start: seconds }, limits, 'start');
              setRange(next);
              seek(next.start);
            }}
          />
          <TimeField
            label={t('timeline.endField')}
            value={range.end}
            onCommit={(seconds) => {
              const next = clampRange({ ...range, end: seconds }, limits, 'end');
              setRange(next);
              seek(next.end);
            }}
          />
        </div>
        <SegmentedControl
          legend={t('trim.mode')}
          segments={modes}
          value={mode}
          onChange={setMode}
        />
      </div>

      <LimitNotice assessment={assessment} />

      <div>
        <button
          type="button"
          disabled={blocked}
          onClick={() => void run(job)}
          className="pressable bg-accent text-on-accent hover:bg-accent-strong min-h-12 rounded-full px-7 font-medium disabled:opacity-50"
        >
          {t('trim.run')}
        </button>
      </div>
    </div>
  );
}
