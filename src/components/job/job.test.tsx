// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorPanel } from './ErrorPanel';
import { JobProgress } from './JobProgress';
import { ResultCard, sizeChange } from './ResultCard';

beforeEach(() => {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${(n += 1)}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('JobProgress', () => {
  it('shows the percentage and exposes it to assistive technology', () => {
    render(<JobProgress label="Converting" fraction={0.426} onCancel={() => undefined} />);
    const bar = screen.getByRole('progressbar', { name: 'Converting' });
    expect(bar.getAttribute('aria-valuenow')).toBe('43');
    expect(screen.getByTestId('job-progress').textContent).toContain('43%');
  });

  it('shows an indeterminate state when the length is unknown', () => {
    render(<JobProgress label="Converting" fraction={null} onCancel={() => undefined} />);
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
    expect(screen.getByTestId('job-progress').textContent).toContain('Working…');
  });

  it('cancels once, then shows that it is stopping', async () => {
    const onCancel = vi.fn();
    const { rerender } = render(<JobProgress label="X" fraction={0.5} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();

    rerender(<JobProgress label="X" fraction={0.5} onCancel={onCancel} cancelling />);
    const button = screen.getByRole('button', { name: 'Cancelling…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('keeps out-of-range values sane', () => {
    render(<JobProgress label="X" fraction={1.7} onCancel={() => undefined} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });
});

describe('ResultCard', () => {
  const video = new Blob([new Uint8Array(600)], { type: 'video/mp4' });

  it('offers the file for download under its name', () => {
    render(
      <ResultCard
        blob={video}
        filename="clip-converted.mp4"
        inputBytes={1000}
        onStartOver={() => undefined}
      />,
    );
    const link = screen.getByRole('link', { name: 'Download' });
    expect(link.getAttribute('download')).toBe('clip-converted.mp4');
    expect(link.getAttribute('href')).toMatch(/^blob:/);
    expect(document.querySelector('video')?.getAttribute('src')).toMatch(/^blob:/);
  });

  it('shows the size before and after', () => {
    render(
      <ResultCard blob={video} filename="a.mp4" inputBytes={1000} onStartOver={() => undefined} />,
    );
    expect(screen.getByTestId('result-size').textContent).toBe('1000 B → 600 B · 40% smaller');
  });

  it('gives the memory back when it goes away', () => {
    const { unmount } = render(
      <ResultCard blob={video} filename="a.mp4" inputBytes={1000} onStartOver={() => undefined} />,
    );
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });

  it('offers Share only where the device can share files', async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share: shareFn });
    render(
      <ResultCard blob={video} filename="a.mp4" inputBytes={1} onStartOver={() => undefined} />,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    expect(shareFn).toHaveBeenCalledOnce();
    expect((shareFn.mock.calls[0]?.[0] as ShareData).files?.[0]?.name).toBe('a.mp4');
  });

  it('hides Share where files cannot be shared', () => {
    vi.stubGlobal('navigator', { ...navigator, canShare: () => false });
    render(
      <ResultCard blob={video} filename="a.mp4" inputBytes={1} onStartOver={() => undefined} />,
    );
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('previews audio with an audio player', () => {
    const audio = new Blob([new Uint8Array(10)], { type: 'audio/mpeg' });
    render(
      <ResultCard blob={audio} filename="a.mp3" inputBytes={100} onStartOver={() => undefined} />,
    );
    expect(document.querySelector('audio')).not.toBeNull();
    expect(document.querySelector('video')).toBeNull();
  });

  it('starts over', async () => {
    const onStartOver = vi.fn();
    render(<ResultCard blob={video} filename="a.mp4" inputBytes={1} onStartOver={onStartOver} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(onStartOver).toHaveBeenCalledOnce();
  });
});

describe('sizeChange', () => {
  it.each([
    [1000, 600, { percent: 40, smaller: true }],
    [1000, 1500, { percent: 50, smaller: false }],
    [1000, 1001, null],
    [0, 100, null],
  ])('%d -> %d', (before, after, expected) => {
    expect(sizeChange(before, after)).toEqual(expected);
  });
});

describe('ErrorPanel', () => {
  it('shows the message and keeps the detail behind "Details"', () => {
    render(
      <ErrorPanel
        message="This file could not be read."
        detail="exit code 1\nmoov atom not found"
        onStartOver={() => undefined}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('This file could not be read.');
    const details = document.querySelector('details');
    expect(details?.open).toBe(false);
    expect(details?.querySelector('summary')?.textContent).toBe('Details');
  });

  it('offers Try again only when the caller can retry', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorPanel message="m" onStartOver={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();

    rerender(<ErrorPanel message="m" onRetry={onRetry} onStartOver={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('has no Details toggle without detail', () => {
    render(<ErrorPanel message="m" onStartOver={() => undefined} />);
    expect(document.querySelector('details')).toBeNull();
  });
});
