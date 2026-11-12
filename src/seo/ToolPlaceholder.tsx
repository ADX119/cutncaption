'use client';

import { useState } from 'react';
import { FileDrop, FileSummary, MEDIA_ACCEPT } from '@/components';
import { t } from '@/i18n';

/** Stands in for a tool until it is built: takes a file and shows what was chosen. */
export function ToolPlaceholder() {
  const [file, setFile] = useState<File | null>(null);

  if (file) return <FileSummary file={file} onClear={() => setFile(null)} />;

  return (
    <FileDrop
      accept={MEDIA_ACCEPT}
      onFile={setFile}
      title={t('file.drop.title')}
      hint={t('file.drop.hint')}
    />
  );
}
