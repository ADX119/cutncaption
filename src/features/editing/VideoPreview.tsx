'use client';

import { type Ref, useEffect, useState } from 'react';

interface VideoPreviewProps {
  readonly file: File;
  /** Lets the tool read and set the playhead. */
  readonly videoRef: Ref<HTMLVideoElement>;
  readonly onTime?: (seconds: number) => void;
  /** Playback loops inside this stretch when given (preview of a trim). */
  readonly loop?: { readonly start: number; readonly end: number };
  readonly label: string;
}

/**
 * The person's video on the neutral stage (docs/DESIGN.md: nothing tinted around the
 * picture). Plain <video> playback of the local file; nothing is uploaded.
 */
export function VideoPreview({ file, videoRef, onTime, loop, label }: VideoPreviewProps) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with an external resource
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="bg-stage overflow-hidden rounded-lg">
      {url && (
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={label}
          className="mx-auto aspect-video max-h-[60vh] w-full object-contain"
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            if (loop && !video.paused && video.currentTime >= loop.end) {
              video.currentTime = loop.start;
            }
            onTime?.(video.currentTime);
          }}
          onSeeked={(event) => onTime?.(event.currentTarget.currentTime)}
        />
      )}
    </div>
  );
}
