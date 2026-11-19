'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { FileSummary, type Segment, SegmentedControl } from '@/components';
import { TEXT_SCALE } from '@/editor/meme';
import { fonts } from '@/engine/fonts';
import { type ReadyFile, describeFile } from '@/features/shell';
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
        </div>
      </div>
    </div>
  );
}
