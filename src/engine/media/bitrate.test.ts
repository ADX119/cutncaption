import { describe, expect, it } from 'vitest';
import { MIN_VIDEO_KBPS, correctedVideoKbps, planBitrate } from './bitrate';

const MB = 1024 * 1024;
const input = (targetMb: number, durationSec: number, sourceMb = 500, hasAudio = true) => ({
  targetBytes: targetMb * MB,
  durationSec,
  sourceBytes: sourceMb * MB,
  hasAudio,
});

describe('planBitrate', () => {
  it('fits a one-minute clip into WhatsApp’s 16 MB at 720p', () => {
    // 16 MB over 60 s: about 2147 kbps in total after the 4% margin.
    const plan = planBitrate(input(16, 60));
    expect(plan).toEqual({ kind: 'ok', videoKbps: 2051, audioKbps: 96, maxShortSide: 720 });
  });

  it.each([
    [100, 60, 1080],
    [16, 60, 720],
    [16, 120, 480],
    [10, 120, 360],
    [10, 300, 240],
  ])('%d MB for %d s -> %dp', (targetMb, seconds, shortSide) => {
    const plan = planBitrate(input(targetMb, seconds));
    expect(plan.kind).toBe('ok');
    if (plan.kind === 'ok') expect(plan.maxShortSide).toBe(shortSide);
  });

  it('drops audio to 64k when bits are tight', () => {
    const plan = planBitrate(input(10, 300));
    expect(plan.kind === 'ok' && plan.audioKbps).toBe(64);
  });

  it('gives all the bits to video when there is no audio', () => {
    const plan = planBitrate(input(16, 60, 500, false));
    expect(plan).toMatchObject({ kind: 'ok', audioKbps: 0, videoKbps: 2147 });
  });

  it('keeps the result under the target, margin included', () => {
    for (const [targetMb, seconds] of [
      [16, 60],
      [10, 45],
      [25, 600],
      [8, 30],
    ] as const) {
      const plan = planBitrate(input(targetMb, seconds));
      if (plan.kind !== 'ok') throw new Error(`${targetMb} MB / ${seconds} s should fit`);
      const bytes = (((plan.videoKbps + plan.audioKbps) * 1000) / 8) * seconds;
      expect(bytes).toBeLessThanOrEqual(targetMb * MB);
    }
  });

  it('refuses a target too small to watch, and says what would work', () => {
    const plan = planBitrate(input(5, 600));
    expect(plan.kind).toBe('unreachable');
    if (plan.kind === 'unreachable') {
      // (150 + 64) kbps for 600 s, plus the margin: about 16.7 MB.
      expect(plan.smallestBytes / MB).toBeGreaterThan(15.5);
      expect(plan.smallestBytes / MB).toBeLessThan(16.5);
      expect(planBitrate({ ...input(1, 600), targetBytes: plan.smallestBytes }).kind).toBe('ok');
    }
  });

  it('does nothing when the file is already under the target', () => {
    expect(planBitrate(input(16, 60, 12))).toEqual({ kind: 'already-small' });
    expect(planBitrate(input(16, 60, 16))).toEqual({ kind: 'already-small' });
  });

  it('refuses when the length is unknown', () => {
    expect(planBitrate(input(16, 0)).kind).toBe('unreachable');
  });
});

describe('correctedVideoKbps', () => {
  it('scales down by the overshoot, with extra margin', () => {
    expect(correctedVideoKbps(2000, 16 * MB, 18 * MB)).toBe(1653);
  });

  it('never goes below the watchable minimum', () => {
    expect(correctedVideoKbps(200, 1 * MB, 10 * MB)).toBe(MIN_VIDEO_KBPS);
  });

  it('leaves the rate alone if nothing came out', () => {
    expect(correctedVideoKbps(800, MB, 0)).toBe(800);
  });
});
