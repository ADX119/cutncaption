'use client';

import { useState } from 'react';
import { classifyDevice, detectCapabilities, readDeviceEnv } from '@/engine/device';
import { EngineError } from '@/engine/errors';
import { type SelfTestResult, runSelfTest } from '@/engine/media';
import { t } from '@/i18n';

type State =
  | { status: 'idle' }
  | { status: 'running' }
  | {
      status: 'done';
      result: SelfTestResult;
      deviceClass: string;
      isolated: boolean;
      threads: boolean;
    }
  | { status: 'failed'; message: string; detail: string };

function Row({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="border-rule flex flex-wrap justify-between gap-x-6 gap-y-1 border-b py-3">
      <dt className="text-graphite">{label}</dt>
      <dd data-testid={testId} className="font-medium">
        {value}
      </dd>
    </div>
  );
}

/**
 * Diagnostics: loads the real engine in this browser and reports what it found.
 * Not a tool; it exists so a person (or a test) can confirm a device can run them.
 */
export function EngineCheck() {
  const [state, setState] = useState<State>({ status: 'idle' });

  async function run() {
    setState({ status: 'running' });
    try {
      const result = await runSelfTest();
      const capabilities = detectCapabilities();
      setState({
        status: 'done',
        result,
        deviceClass: classifyDevice(readDeviceEnv()),
        isolated: capabilities.crossOriginIsolated,
        threads: capabilities.sharedArrayBuffer && capabilities.crossOriginIsolated,
      });
    } catch (error) {
      const known = error instanceof EngineError ? error : undefined;
      setState({
        status: 'failed',
        message: known ? t(known.messageKey) : t('engineCheck.failed'),
        detail: known?.detail ?? String(error),
      });
    }
  }

  const yesNo = (value: boolean) => (value ? t('engineCheck.yes') : t('engineCheck.no'));

  return (
    <div className="flex flex-col items-start gap-6">
      <button
        type="button"
        onClick={run}
        disabled={state.status === 'running'}
        className="pressable bg-accent text-on-accent hover:bg-accent-strong min-h-12 rounded-full px-6 font-medium disabled:opacity-60"
      >
        {state.status === 'running' ? t('engineCheck.running') : t('engineCheck.run')}
      </button>

      {state.status === 'done' && (
        <dl data-testid="engine-result" className="appear border-rule w-full max-w-xl border-t">
          <Row
            label={t('engineCheck.ffmpeg')}
            value={state.result.ffmpegVersion}
            testId="engine-version"
          />
          <Row
            label={t('engineCheck.features')}
            value={
              state.result.missing.length === 0
                ? t('engineCheck.featuresAll', { count: state.result.requiredCount })
                : t('engineCheck.featuresMissing', { list: state.result.missing.join(', ') })
            }
            testId="engine-features"
          />
          <Row
            label={t('engineCheck.loadTime')}
            value={t('engineCheck.seconds', { seconds: (state.result.loadMs / 1000).toFixed(1) })}
            testId="engine-load-time"
          />
          <Row
            label={t('engineCheck.fromCache')}
            value={yesNo(state.result.fromCache)}
            testId="engine-from-cache"
          />
          <Row
            label={t('engineCheck.deviceClass')}
            value={state.deviceClass}
            testId="engine-device-class"
          />
          <Row
            label={t('engineCheck.isolated')}
            value={yesNo(state.isolated)}
            testId="engine-isolated"
          />
          <Row
            label={t('engineCheck.threads')}
            value={yesNo(state.threads)}
            testId="engine-threads"
          />
        </dl>
      )}

      {state.status === 'failed' && (
        <div role="alert" data-testid="engine-error" className="appear flex flex-col gap-2">
          <p className="text-danger">{state.message}</p>
          <p className="text-graphite text-sm break-all">{state.detail}</p>
        </div>
      )}
    </div>
  );
}
