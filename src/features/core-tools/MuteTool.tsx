'use client';

import type { ReadyFile } from '@/features/shell';
import { t } from '@/i18n';
import { OneStepTool } from './OneStepTool';

/** Mute: remove the sound, keep the picture untouched. */
export function MuteTool(ready: ReadyFile) {
  return (
    <OneStepTool
      {...ready}
      testId="mute-tool"
      job={{ kind: 'mute', file: ready.file, info: ready.info }}
      explain={() => t('mute.explain')}
      runLabel={t('mute.run')}
      runningLabel={t('mute.running')}
    />
  );
}
