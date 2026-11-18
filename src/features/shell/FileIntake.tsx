'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  type AcceptSpec,
  EngineDownload,
  ErrorPanel,
  FileDrop,
  FileSummary,
  JobProgress,
  MEDIA_ACCEPT,
} from '@/components';
import { EngineError } from '@/engine/errors';
import type { MediaInfo } from '@/engine/media';
import { t } from '@/i18n';
import { formatBytes, formatDuration } from '@/lib';
import { ensureEngineReady, getEngine, prewarmEngine } from './engineInstance';

type State =
  | { readonly step: 'pick' }
  | {
      readonly step: 'download';
      readonly file: File;
      readonly loaded: number;
      readonly total: number;
    }
  | { readonly step: 'reading'; readonly file: File }
  | { readonly step: 'ready'; readonly file: File; readonly info: MediaInfo }
  | {
      readonly step: 'error';
      readonly file: File;
      readonly message: string;
      readonly detail: string;
    };

/** "0:05 · 1280 × 720 · 95 KB" */
export function describeFile(file: File, info: MediaInfo): string {
  const duration = formatDuration(info.durationSec);
  const size = formatBytes(file.size);
  return info.video
    ? t('file.detailsVideo', {
        duration,
        width: info.video.displayWidth,
        height: info.video.displayHeight,
        size,
      })
    : t('file.details', { duration, size });
}

/**
 * Takes a file from the person and reads it with the engine: download the engine if
 * this device does not have it yet (with progress), then probe the file.
 * Tools build on the "ready" state; until they exist, tool pages stop there.
 */
export interface ReadyFile {
  readonly file: File;
  readonly info: MediaInfo;
  /** Back to choosing a file. */
  readonly startOver: () => void;
}

/** Renders the tool for a ready file; a component so the tool is not built during intake's render. */
function ReadyTool({ render, ...ready }: ReadyFile & { render: (ready: ReadyFile) => ReactNode }) {
  return render(ready);
}

export function FileIntake({
  accept = MEDIA_ACCEPT,
  children,
}: {
  readonly accept?: AcceptSpec;
  /** The tool, once a file is chosen and read. Without it, only the file summary shows. */
  readonly children?: (ready: ReadyFile) => ReactNode;
}) {
  const [state, setState] = useState<State>({ step: 'pick' });
  // Ignores results for a file the person has already moved on from.
  const current = useRef<File | null>(null);

  useEffect(() => prewarmEngine(), []);

  async function intake(file: File) {
    current.current = file;
    const stillCurrent = () => current.current === file;
    try {
      if (await getEngine().needsDownload()) {
        setState({ step: 'download', file, loaded: 0, total: 0 });
        await ensureEngineReady(({ loadedBytes, totalBytes }) => {
          if (stillCurrent())
            setState({ step: 'download', file, loaded: loadedBytes, total: totalBytes });
        });
      } else {
        await ensureEngineReady();
      }
      if (!stillCurrent()) return;
      setState({ step: 'reading', file });
      const info = await getEngine().probe(file);
      if (stillCurrent()) setState({ step: 'ready', file, info });
    } catch (error) {
      if (!stillCurrent()) return;
      const known = error instanceof EngineError ? error : undefined;
      setState({
        step: 'error',
        file,
        message: known ? t(known.messageKey) : t('error.job-failed'),
        detail: known?.detail ?? String(error),
      });
    }
  }

  function startOver() {
    current.current = null;
    setState({ step: 'pick' });
  }

  switch (state.step) {
    case 'pick':
      return (
        <FileDrop
          accept={accept}
          onFile={(file) => void intake(file)}
          title={t('file.drop.title')}
          hint={t('file.drop.hint')}
        />
      );
    case 'download':
      return <EngineDownload loadedBytes={state.loaded} totalBytes={state.total} />;
    case 'reading':
      return <JobProgress label={t('file.reading')} fraction={null} onCancel={startOver} />;
    case 'ready':
      if (children) {
        return (
          <ReadyTool render={children} file={state.file} info={state.info} startOver={startOver} />
        );
      }
      return (
        <FileSummary
          file={state.file}
          details={describeFile(state.file, state.info)}
          onClear={startOver}
        />
      );
    case 'error':
      return (
        <ErrorPanel
          message={state.message}
          detail={state.detail}
          onRetry={() => void intake(state.file)}
          onStartOver={startOver}
        />
      );
  }
}
