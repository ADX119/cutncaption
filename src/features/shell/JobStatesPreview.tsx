'use client';

import { useMemo, useState } from 'react';
import { ErrorPanel, JobProgress, ResultCard } from '@/components';
import { t } from '@/i18n';

/** Half a second of silence as a WAV file, so the result card has something real to show. */
function silentWav(): Blob {
  const sampleRate = 8000;
  const samples = sampleRate / 2;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  return new Blob([buffer], { type: 'audio/wav' });
}

const noop = () => undefined;

/**
 * Every state of the shared job UI on one page, for design review and browser tests.
 * Not a tool; unlisted and kept out of search results.
 */
export function JobStatesPreview() {
  const blob = useMemo(() => silentWav(), []);
  const [cancelling, setCancelling] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      <JobProgress label={t('preview.converting')} fraction={0.43} onCancel={noop} />
      <JobProgress
        label={t('preview.converting')}
        fraction={null}
        onCancel={() => setCancelling(true)}
        cancelling={cancelling}
      />
      <ResultCard
        blob={blob}
        filename="holiday clip-audio.wav"
        inputBytes={blob.size * 3}
        onStartOver={noop}
      />
      <ErrorPanel
        message={t('error.unreadable-file')}
        detail={
          'exit code 1\n[mov,mp4,m4a,3gp,3g2,mj2 @ 0x1] moov atom not found\ninput0.mp4: Invalid data found when processing input'
        }
        onRetry={noop}
        onStartOver={noop}
      />
    </div>
  );
}
