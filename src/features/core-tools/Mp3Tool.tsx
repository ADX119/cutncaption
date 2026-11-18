'use client';

import { useState } from 'react';
import { type Segment, SegmentedControl } from '@/components';
import type { ToMp3Job } from '@/engine/media';
import type { ReadyFile } from '@/features/shell';
import { t } from '@/i18n';
import { OneStepTool } from './OneStepTool';

type Bitrate = ToMp3Job['bitrateKbps'];
const BITRATES: readonly Bitrate[] = [128, 192, 320];

/** The page preset if it is one of the offered bitrates, else High. */
export function mp3Bitrate(value: unknown): Bitrate {
  return BITRATES.find((bitrate) => bitrate === value) ?? 192;
}

/** Video to MP3: keep just the sound. */
export function Mp3Tool({
  initialBitrate = 192,
  ...ready
}: ReadyFile & { readonly initialBitrate?: Bitrate }) {
  const [bitrate, setBitrate] = useState<Bitrate>(initialBitrate);
  const qualities: Segment<`${Bitrate}`>[] = [
    { value: '128', label: t('mp3.standard'), hint: t('mp3.standardHint') },
    { value: '192', label: t('mp3.high'), hint: t('mp3.highHint') },
    { value: '320', label: t('mp3.best'), hint: t('mp3.bestHint') },
  ];

  return (
    <OneStepTool
      {...ready}
      testId="mp3-tool"
      job={{ kind: 'toMp3', file: ready.file, info: ready.info, bitrateKbps: bitrate }}
      explain={() => t('mp3.explain')}
      runLabel={t('mp3.run')}
      runningLabel={t('mp3.running')}
      options={
        <SegmentedControl
          legend={t('mp3.quality')}
          segments={qualities}
          value={`${bitrate}`}
          onChange={(value) => setBitrate(mp3Bitrate(Number(value)))}
        />
      }
    />
  );
}
