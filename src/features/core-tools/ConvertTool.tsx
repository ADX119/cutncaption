'use client';

import type { ReadyFile } from '@/features/shell';
import { t } from '@/i18n';
import { OneStepTool } from './OneStepTool';

/** Convert to MP4: make any video play everywhere. Instant when no re-encode is needed. */
export function ConvertTool(ready: ReadyFile) {
  return (
    <OneStepTool
      {...ready}
      testId="convert-tool"
      job={{ kind: 'toMp4', file: ready.file, info: ready.info }}
      explain={(path) => (path === 'copy' ? t('convert.copy') : t('convert.reencode'))}
      runLabel={t('convert.run')}
      runningLabel={t('convert.running')}
    />
  );
}
