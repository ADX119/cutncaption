import { type StoreApi, createStore } from 'zustand/vanilla';
import {
  type MemeLayoutId,
  type MemeText,
  TEXT_SCALE,
  clampTextScale,
  initialMoment,
} from '@/editor/meme';
import type { TimeRange } from '@/editor/timeline';

export type ExportFormat = 'mp4' | 'gif' | 'sticker' | 'still';
export const EXPORT_FORMATS: readonly ExportFormat[] = ['mp4', 'gif', 'sticker', 'still'];

/** Longest caption per box; past this a meme stops being readable anyway. */
export const MAX_TEXT_LENGTH = 200;

export interface MemeState {
  readonly layout: MemeLayoutId;
  readonly text: MemeText;
  readonly textScale: number;
  readonly format: ExportFormat;
  readonly range: TimeRange;
}

export interface MemeActions {
  setLayout(layout: MemeLayoutId): void;
  setText(field: keyof MemeText, value: string): void;
  setTextScale(scale: number): void;
  setFormat(format: ExportFormat): void;
  setRange(range: TimeRange): void;
}

export type MemeStore = StoreApi<MemeState & MemeActions>;

/**
 * The studio's state for one video. A store per studio (not a global), so starting
 * over with another file starts clean.
 */
export function createMemeStore({
  duration,
  format = 'mp4',
}: {
  duration: number;
  format?: ExportFormat;
}): MemeStore {
  return createStore<MemeState & MemeActions>()((set) => ({
    layout: 'top-bottom',
    text: { top: '', bottom: '' },
    textScale: TEXT_SCALE.default,
    format,
    range: initialMoment(duration),
    setLayout: (layout) => set({ layout }),
    setText: (field, value) =>
      set((state) => ({ text: { ...state.text, [field]: value.slice(0, MAX_TEXT_LENGTH) } })),
    setTextScale: (scale) => set({ textScale: clampTextScale(scale) }),
    setFormat: (next) => set({ format: next }),
    setRange: (range) => set({ range }),
  }));
}
