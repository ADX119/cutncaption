'use client';

import { type ChangeEvent, type DragEvent, useRef, useState } from 'react';
import { t } from '@/i18n';
import { type AcceptSpec, type FileRejection, pickFile, toAcceptAttribute } from './accept';

interface FileDropProps {
  readonly accept: AcceptSpec;
  readonly onFile: (file: File) => void;
  readonly title: string;
  readonly hint: string;
}

/**
 * The only way a file enters the app: a picker or a drop. There is deliberately no
 * URL field, and dropped links or text are refused.
 */
export function FileDrop({ accept, onFile, title, hint }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // dragenter/dragleave fire for every child element; count them to know when the drag really left.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [rejection, setRejection] = useState<FileRejection | null>(null);

  function take(files: FileList | null) {
    const pick = pickFile(files ?? [], accept);
    if (pick.ok) {
      setRejection(null);
      onFile(pick.file);
    } else {
      setRejection(pick.reason);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    take(event.target.files);
    // Lets the same file be chosen again after a rejection.
    event.target.value = '';
  }

  function onDragEnter(event: DragEvent) {
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    take(event.dataTransfer.files);
  }

  return (
    <div
      data-testid="file-drop"
      data-dragging={dragging}
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="border-rule bg-sheet data-[dragging=true]:border-accent data-[dragging=true]:bg-accent-wash flex min-h-64 flex-col items-center justify-center gap-4 rounded-lg border px-6 py-10 text-center transition-colors duration-200"
    >
      <p className="display text-2xl text-balance">{title}</p>
      <p className="text-graphite max-w-[40ch]">{hint}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="pressable bg-accent text-on-accent hover:bg-accent-strong mt-2 min-h-12 rounded-full px-6 font-medium"
      >
        {t('file.choose')}
      </button>
      {/* The button above is the keyboard and screen-reader control; the input only opens the picker. */}
      <input
        ref={inputRef}
        type="file"
        accept={toAcceptAttribute(accept)}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      {rejection && (
        <p role="alert" className="appear text-danger max-w-[44ch]">
          {t(`file.reject.${rejection}`)}
        </p>
      )}
    </div>
  );
}
