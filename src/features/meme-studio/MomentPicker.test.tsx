// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimeRange } from '@/editor/timeline';
import { MomentPicker } from './MomentPicker';

afterEach(cleanup);

/** The picker wired to state, as the studio uses it. */
function Harness({
  duration = 60,
  fps = 25,
  initial = { start: 10, end: 15 },
  initialPlayhead = 10,
  onSeek,
}: {
  duration?: number;
  fps?: number | null;
  initial?: TimeRange;
  initialPlayhead?: number;
  onSeek?: (seconds: number) => void;
}) {
  const [range, setRange] = useState<TimeRange>(initial);
  const [playhead, setPlayhead] = useState(initialPlayhead);
  return (
    <MomentPicker
      duration={duration}
      fps={fps}
      range={range}
      onRangeChange={setRange}
      playhead={playhead}
      onSeek={(seconds) => {
        setPlayhead(seconds);
        onSeek?.(seconds);
      }}
    />
  );
}

const start = () => screen.getByRole('slider', { name: 'Start of selection' });
const end = () => screen.getByRole('slider', { name: 'End of selection' });
const value = (slider: HTMLElement) => Number(slider.getAttribute('aria-valuenow'));
const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));

describe('MomentPicker limits', () => {
  it('stops the end handle 15 seconds after the start', async () => {
    render(<Harness />);
    end().focus();
    await userEvent.keyboard('{End}');
    expect(value(end())).toBe(25);
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(value(end())).toBe(25);
  });

  it('stops the start handle 15 seconds before the end', async () => {
    render(<Harness />);
    start().focus();
    await userEvent.keyboard('{Home}');
    expect(value(start())).toBe(0);
    expect(value(end())).toBe(15);
  });

  it('keeps at least 2 seconds between the handles', async () => {
    render(<Harness />);
    start().focus();
    await userEvent.keyboard('{End}');
    expect(value(start())).toBe(13);
    end().focus();
    await userEvent.keyboard('{Home}');
    expect(value(end())).toBe(15);
  });

  it('moves a handle one frame per arrow key', async () => {
    render(<Harness fps={25} />);
    start().focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(value(start())).toBeCloseTo(10.08, 6);
  });

  it('selects the whole clip when it is shorter than 2 seconds', async () => {
    render(<Harness duration={1.5} initial={{ start: 0, end: 1.5 }} initialPlayhead={0} />);
    end().focus();
    await userEvent.keyboard('{Home}');
    expect(value(end())).toBe(1.5);
  });

  it('tells the person the limits', () => {
    render(<Harness />);
    expect(screen.getByText('Choose a moment of 2 to 15 seconds.')).toBeTruthy();
  });
});

describe('MomentPicker marking', () => {
  it('puts the end on the frame showing, up to 15 seconds after the start', async () => {
    const onSeek = vi.fn();
    render(<Harness initialPlayhead={40} onSeek={onSeek} />);
    await click('End here');
    expect(value(end())).toBe(25);
    expect(onSeek).toHaveBeenLastCalledWith(25);
  });

  it('puts the start on the frame showing, at least 2 seconds before the end', async () => {
    render(<Harness initialPlayhead={14.5} />);
    await click('Start here');
    expect(value(start())).toBe(13);
  });

  it('moves the start freely within the limits', async () => {
    render(<Harness initialPlayhead={12} />);
    await click('Start here');
    expect(value(start())).toBe(12);
    expect(value(end())).toBe(15);
  });
});

describe('MomentPicker frame stepping', () => {
  it('steps the playhead one frame at a time and shows hundredths', async () => {
    const onSeek = vi.fn();
    render(<Harness fps={25} initialPlayhead={1} onSeek={onSeek} />);
    await click('Next frame');
    expect(onSeek).toHaveBeenLastCalledWith(1.04);
    expect(screen.getByTestId('moment-playhead').textContent).toBe('0:01.04');
    await click('Previous frame');
    await click('Previous frame');
    expect(onSeek).toHaveBeenLastCalledWith(0.96);
  });

  it('does not step before the start of the video', async () => {
    const onSeek = vi.fn();
    render(<Harness initialPlayhead={0} onSeek={onSeek} />);
    await click('Previous frame');
    expect(onSeek).toHaveBeenLastCalledWith(0);
  });
});
