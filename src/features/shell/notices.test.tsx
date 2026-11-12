// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InAppNotice } from './InAppNotice';
import { UnsupportedNotice } from './UnsupportedNotice';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const URL = 'https://example.test/tools/trim-video/';

function stubClipboard(writeText: (text: string) => Promise<void>) {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
}

describe('InAppNotice', () => {
  it('names the app and shows the link to open elsewhere', () => {
    render(<InAppNotice app="instagram" url={URL} />);
    const notice = screen.getByTestId('browser-notice');
    expect(notice.textContent).toContain('Instagram');
    expect(notice.textContent).toContain(URL);
  });

  it('copies the link and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<InAppNotice app="tiktok" url={URL} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(URL);
    expect(screen.getByRole('button').textContent).toBe('Link copied');
  });

  it('says what to do when copying is blocked', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    render(<InAppNotice app="facebook" url={URL} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(screen.getByRole('alert').textContent).toMatch(/press and hold/i);
  });
});

describe('UnsupportedNotice', () => {
  it('lists what is missing in plain words', () => {
    render(<UnsupportedNotice missing={['wasm-simd', 'cache-storage']} />);
    const text = screen.getByTestId('browser-notice').textContent ?? '';
    expect(text).toContain('WebAssembly SIMD, file caching');
    expect(text).toMatch(/Chrome, Edge, Firefox or Safari/);
  });
});
