'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EngineError } from '@/engine/errors';
import type { JobResult, MediaJob } from '@/engine/media';
import { t } from '@/i18n';
import { getEngine } from './engineInstance';

export type JobState =
  | { readonly status: 'idle' }
  | { readonly status: 'running'; readonly fraction: number | null; readonly cancelling: boolean }
  | { readonly status: 'done'; readonly result: JobResult }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly detail: string;
      readonly job: MediaJob;
    };

/**
 * Runs one engine job for a tool: progress, cancel, result or a plain-language error.
 * Cancelling returns quietly to idle; it is not an error to the person.
 */
export function useJob() {
  const [state, setState] = useState<JobState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);

  // Leaving the page mid-job stops it, so it does not keep the device busy.
  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(async (job: MediaJob) => {
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'running', fraction: null, cancelling: false });
    try {
      const result = await getEngine().run(job, {
        signal: abort.signal,
        onProgress: (fraction) =>
          setState((s) => (s.status === 'running' ? { ...s, fraction } : s)),
      });
      setState({ status: 'done', result });
    } catch (error) {
      if (error instanceof EngineError && error.code === 'cancelled') {
        setState({ status: 'idle' });
        return;
      }
      const known = error instanceof EngineError ? error : undefined;
      setState({
        status: 'error',
        message: known ? t(known.messageKey) : t('error.job-failed'),
        detail: known?.detail ?? String(error),
        job,
      });
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    setState((s) => (s.status === 'running' ? { ...s, cancelling: true } : s));
    controller.current?.abort();
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, run, cancel, reset };
}
