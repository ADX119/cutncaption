// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIDEO_ACCEPT } from './accept';
import { FileDrop } from './FileDrop';
import { FileSummary } from './FileSummary';

afterEach(cleanup);

const video = () => new File(['x'.repeat(2048)], 'clip.mp4', { type: 'video/mp4' });
const text = () => new File(['hello'], 'notes.txt', { type: 'text/plain' });

function setup() {
  const onFile = vi.fn();
  const { container } = render(
    <FileDrop accept={VIDEO_ACCEPT} onFile={onFile} title="Drop a video" hint="Stays here" />,
  );
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  return { onFile, input, zone: screen.getByTestId('file-drop') };
}

describe('FileDrop', () => {
  it('hands over a file chosen with the picker', async () => {
    const { onFile, input } = setup();
    const file = video();
    await userEvent.upload(input, file);
    expect(onFile).toHaveBeenCalledExactlyOnceWith(file);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refuses the wrong type and says why', async () => {
    const { onFile, input } = setup();
    await userEvent.upload(input, text(), { applyAccept: false });
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/isn.t supported/);
  });

  it('hands over a dropped file', () => {
    const { onFile, zone } = setup();
    const file = video();
    fireEvent.drop(zone, { dataTransfer: { files: [file], types: ['Files'] } });
    expect(onFile).toHaveBeenCalledExactlyOnceWith(file);
  });

  it('refuses a dropped link or text', () => {
    const { onFile, zone } = setup();
    fireEvent.drop(zone, { dataTransfer: { files: [], types: ['text/uri-list', 'text/plain'] } });
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/links/i);
  });

  it('refuses several files at once', () => {
    const { onFile, zone } = setup();
    fireEvent.drop(zone, { dataTransfer: { files: [video(), video()], types: ['Files'] } });
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/one file/i);
  });

  it('clears the message once a good file arrives', async () => {
    const { input, zone } = setup();
    fireEvent.drop(zone, { dataTransfer: { files: [], types: ['text/plain'] } });
    expect(screen.getByRole('alert')).toBeTruthy();
    await userEvent.upload(input, video());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the drag state only while something is dragged over it', () => {
    const { zone } = setup();
    const child = screen.getByRole('button');
    fireEvent.dragEnter(zone);
    fireEvent.dragEnter(child);
    fireEvent.dragLeave(zone); // moving onto a child fires a leave on the parent
    expect(zone.dataset.dragging).toBe('true');
    fireEvent.dragLeave(child);
    expect(zone.dataset.dragging).toBe('false');
  });

  it('opens the picker from the button, which is the only tab stop', async () => {
    const { input } = setup();
    const click = vi.spyOn(input, 'click');
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button'));
    await userEvent.keyboard('{Enter}');
    expect(click).toHaveBeenCalledOnce();
  });
});

describe('FileSummary', () => {
  it('shows the name and size, and lets you pick another', async () => {
    const onClear = vi.fn();
    render(<FileSummary file={{ name: 'clip.mp4', size: 1.5 * 1024 * 1024 }} onClear={onClear} />);
    const summary = screen.getByTestId('file-summary');
    expect(summary.textContent).toContain('clip.mp4');
    expect(summary.textContent).toContain('1.5 MB');
    await userEvent.click(screen.getByRole('button'));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
