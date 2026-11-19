'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  ErrorPanel,
  FileSummary,
  JobProgress,
  ResultCard,
  type Segment,
  SegmentedControl,
} from '@/components';
import { TEXT_SCALE } from '@/editor/meme';
import { fonts } from '@/engine/fonts';
import type { MemeJob } from '@/engine/media';
import { LimitNotice } from '@/features/core-tools';
import { type ReadyFile, describeFile, getEngine, useJob } from '@/features/shell';
import { t } from '@/i18n';
import { LayoutPicker } from './LayoutPicker';
import { MemeStage } from './MemeStage';
import { MomentPicker } from './MomentPicker';
import { EXPORT_FORMATS, type ExportFormat, MAX_TEXT_LENGTH, createMemeStore } from './store';

function CaptionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-graphite text-sm">{label}</span>
      <textarea
        value={value}
        rows={2}
        maxLength={MAX_TEXT_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        className="border-rule bg-sheet min-h-11 w-full resize-y rounded-md border px-3 py-2 leading-snug"
      />
    </label>
  );
}

/**
 * Meme Studio: mark a moment, choose a layout, type the caption, and see it drawn over
 * the video exactly as it will be saved.
 */
export function MemeStudio({
  file,
  info,
  startOver,
  initialFormat,
}: ReadyFile & { initialFormat?: ExportFormat }) {
  const duration = info.durationSec ?? 0;
  const [store] = useState(() => createMemeStore({ duration, format: initialFormat }));
  const state = useStore(store);
  const [fontsReady, setFontsReady] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const job = useJob();

  useEffect(() => {
    let live = true;
    // The preview waits for the fonts; if they fail, the export step reports it.
    void fonts()
      .loadAll()
      .then(() => live && setFontsReady(true))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const seek = (seconds: number) => {
    if (video.current) video.current.currentTime = seconds;
    setPlayhead(seconds);
  };
  const togglePlay = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play();
    else element.pause();
  };

  const videoSize = {
    width: info.video?.displayWidth ?? 0,
    height: info.video?.displayHeight ?? 0,
  };
  const formats: Segment<ExportFormat>[] = EXPORT_FORMATS.map((format) => ({
    value: format,
    label: t(`meme.format.${format}`),
    hint: t(`meme.format.${format}.hint`),
  }));
  const single = state.layout !== 'top-bottom';

  // Caption bar (M3.8), freeze-frame zoom (M3.9), GIF (M3.11), sticker (M3.12) and
  // image (M3.13) are not saved yet.
  const canSave = state.layout === 'top-bottom' && state.format === 'mp4';
  const memeJob: MemeJob = {
    kind: 'meme',
    file,
    info,
    start: state.range.start,
    end: state.range.end,
    layout: state.layout,
    text: state.text,
    textScale: state.textScale,
    format: 'mp4',
  };
  const assessment = getEngine().assess(memeJob);

  if (job.state.status === 'running') {
    return (
      <JobProgress
        label={t('meme.saving')}
        fraction={job.state.fraction}
        onCancel={job.cancel}
        cancelling={job.state.cancelling}
      />
    );
  }
  if (job.state.status === 'done') {
    // Back to the studio with everything kept, to adjust and save again.
    return (
      <ResultCard
        blob={job.state.result.blob}
        filename={job.state.result.filename}
        inputBytes={file.size}
        onStartOver={job.reset}
      />
    );
  }
  if (job.state.status === 'error') {
    const failed = job.state.job;
    return (
      <ErrorPanel
        message={job.state.message}
        detail={job.state.detail}
        onRetry={() => void job.run(failed)}
        onStartOver={job.reset}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="meme-studio">
      <FileSummary file={file} details={describeFile(file, info)} onClear={startOver} />

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <MemeStage
            file={file}
            videoSize={videoSize}
            spec={{ layout: state.layout, text: state.text, textScale: state.textScale }}
            fontsReady={fontsReady}
            videoRef={video}
            loop={state.range}
            onTime={setPlayhead}
            onPlayingChange={setPlaying}
          />
          <MomentPicker
            duration={duration}
            fps={info.video?.fps ?? null}
            range={state.range}
            onRangeChange={state.setRange}
            playhead={playhead}
            onSeek={seek}
            playing={playing}
            onTogglePlay={togglePlay}
          />
        </div>

        <div className="flex flex-col gap-6">
          <LayoutPicker value={state.layout} onChange={state.setLayout} />

          <div className="flex flex-col gap-4">
            <CaptionField
              label={single ? t('meme.text.caption') : t('meme.text.top')}
              value={state.text.top}
              onChange={(value) => state.setText('top', value)}
            />
            {single ? null : (
              <CaptionField
                label={t('meme.text.bottom')}
                value={state.text.bottom}
                onChange={(value) => state.setText('bottom', value)}
              />
            )}
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-graphite flex justify-between text-sm">
              {t('meme.size')}
              <span className="tabular-nums">
                {t('meme.size.value', { percent: String(Math.round(state.textScale * 100)) })}
              </span>
            </span>
            <input
              type="range"
              min={TEXT_SCALE.min}
              max={TEXT_SCALE.max}
              step={0.05}
              value={state.textScale}
              onChange={(event) => state.setTextScale(Number(event.target.value))}
              className="accent-accent h-11 w-full cursor-pointer"
            />
          </label>

          <SegmentedControl
            legend={t('meme.format')}
            segments={formats}
            value={state.format}
            onChange={state.setFormat}
          />

          {canSave ? (
            <div className="flex flex-col gap-3">
              <LimitNotice assessment={assessment} />
              <button
                type="button"
                disabled={assessment.blocks.length > 0}
                onClick={() => void job.run(memeJob)}
                className="pressable bg-accent text-on-accent hover:bg-accent-strong min-h-12 w-fit rounded-full px-7 font-medium disabled:opacity-50"
              >
                {t('meme.save')}
              </button>
            </div>
          ) : (
            <p className="text-graphite max-w-[56ch] text-sm" data-testid="meme-not-yet">
              {t('meme.notYet')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
