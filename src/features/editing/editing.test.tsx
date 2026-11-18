// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimeRange } from '@/editor/timeline';
import { RangeTimeline } from './RangeTimeline';
import { TimeField } from './TimeField';

afterEach(cleanup);

/** The timeline wired to state, as a tool would use it. */
function Harness({
  onSeek = () => undefined,
  maxLength,
}: {
  onSeek?: (s: number) => void;
  maxLength?: number;
}) {
  const [range, setRange] = useState<TimeRange>({ start: 2, end: 6 });
  return (
    <RangeTimeline
      range={range}
      limits={{ duration: 10, maxLength }}
      playhead={3}
      onRangeChange={setRange}
      onSeek={onSeek}
    />
  );
}

const start = () => screen.getByRole('slider', { name: 'Start of selection' });
const end = () => screen.getByRole('slider', { name: 'End of selection' });

describe('RangeTimeline keyboard', () => {
  it('nudges a handle by 0.1 s, or 1 s with Shift, and seeks there', async () => {
    const onSeek = vi.fn();
    render(<Harness onSeek={onSeek} />);
    start().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(start().getAttribute('aria-valuenow')).toBe('2.1');
    expect(onSeek).toHaveBeenLastCalledWith(2.1);
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(start().getAttribute('aria-valuenow')).toBe('1.1');
  });

  it('jumps to the limits with Home and End, never crossing the other handle', async () => {
    render(<Harness />);
    start().focus();
    await userEvent.keyboard('{Home}');
    expect(start().getAttribute('aria-valuenow')).toBe('0');
    await userEvent.keyboard('{End}');
    expect(start().getAttribute('aria-valuenow')).toBe('5.9');

    end().focus();
    await userEvent.keyboard('{End}');
    expect(end().getAttribute('aria-valuenow')).toBe('10');
  });

  it('respects a maximum length', async () => {
    render(<Harness maxLength={5} />);
    end().focus();
    await userEvent.keyboard('{End}');
    expect(end().getAttribute('aria-valuenow')).toBe('7');
  });

  it('reads out times for screen readers and the selection length on screen', () => {
    render(<Harness />);
    expect(start().getAttribute('aria-valuetext')).toBe('0:02.0');
    expect(screen.getByTestId('timeline-readout').textContent).toContain('0:04.0 selected');
  });
});

describe('RangeTimeline pointer', () => {
  function stubTrack() {
    const track = screen.getByTestId('timeline-track');
    track.getBoundingClientRect = () =>
      ({ left: 0, width: 200, top: 0, height: 64, right: 200, bottom: 64 }) as DOMRect;
    return track;
  }

  it('seeks where the track is pressed', () => {
    const onSeek = vi.fn();
    render(<Harness onSeek={onSeek} />);
    fireEvent.pointerDown(stubTrack(), { clientX: 150, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledWith(7.5);
  });

  it('drags a handle, clamped against the other one', () => {
    render(<Harness />);
    stubTrack();
    const handle = start();
    handle.setPointerCapture = () => undefined;
    fireEvent.pointerDown(handle, { clientX: 40, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 20, pointerId: 1 });
    expect(handle.getAttribute('aria-valuenow')).toBe('1');
    fireEvent.pointerMove(handle, { clientX: 190, pointerId: 1 });
    expect(handle.getAttribute('aria-valuenow')).toBe('5.9');
    fireEvent.pointerUp(handle, { pointerId: 1 });
  });
});

describe('TimeField', () => {
  it('commits a typed time on Enter', async () => {
    const onCommit = vi.fn();
    render(<TimeField label="Start" value={2} onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Start' });
    expect((input as HTMLInputElement).value).toBe('0:02.0');
    await userEvent.clear(input);
    await userEvent.type(input, '1:05.2{Enter}');
    expect(onCommit).toHaveBeenCalledWith(65.2);
  });

  it('points out an unreadable time and keeps the last good value', async () => {
    const onCommit = vi.fn();
    render(<TimeField label="Start" value={2} onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Start' });
    await userEvent.clear(input);
    await userEvent.type(input, 'soon{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Type a time like 1:05.2')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect((input as HTMLInputElement).value).toBe('0:02.0');
  });
});
