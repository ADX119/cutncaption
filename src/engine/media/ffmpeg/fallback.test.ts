import { describe, expect, it, vi } from 'vitest';
import { EngineError } from '../../errors';
import { type CorePolicy, runOnCore } from './fallback';
import type { CoreVariant, FfmpegSession } from './loader';

const sessionFor = (variant: CoreVariant) => ({ variant }) as unknown as FfmpegSession;

function setup(behaviour: Partial<Record<CoreVariant, 'ok' | 'stall' | 'fail'>>) {
  const policy: CorePolicy = { multiThreadDisabled: false };
  const getSession = vi.fn(async (variant: CoreVariant) => sessionFor(variant));
  const job = vi.fn(async (session: FfmpegSession) => {
    const outcome = behaviour[session.variant] ?? 'ok';
    if (outcome === 'stall') throw new EngineError('stalled', session.variant);
    if (outcome === 'fail') throw new EngineError('unreadable-file', session.variant);
    return `done on ${session.variant}`;
  });
  const onFallback = vi.fn();
  return { policy, getSession, job, onFallback };
}

describe('runOnCore', () => {
  it('reports the core it was given when multi-thread would not start', async () => {
    const s = setup({ st: 'stall' });
    s.getSession.mockImplementation(async () => sessionFor('st'));
    const ok = setup({});
    ok.getSession.mockImplementation(async () => sessionFor('st'));
    expect(await runOnCore({ variant: 'mt', ...ok })).toEqual({
      value: 'done on st',
      variant: 'st',
      fellBack: false,
    });
    // A single-thread stall has nothing to fall back to.
    await expect(runOnCore({ variant: 'mt', ...s })).rejects.toMatchObject({ code: 'stalled' });
    expect(s.job).toHaveBeenCalledOnce();
  });

  it('runs once on the chosen core when it works', async () => {
    const s = setup({});
    const result = await runOnCore({ variant: 'mt', ...s });
    expect(result).toEqual({ value: 'done on mt', variant: 'mt', fellBack: false });
    expect(s.job).toHaveBeenCalledOnce();
    expect(s.policy.multiThreadDisabled).toBe(false);
  });

  it('reruns once on single-thread after a multi-thread stall and remembers it', async () => {
    const s = setup({ mt: 'stall' });
    const result = await runOnCore({ variant: 'mt', ...s });

    expect(result).toEqual({ value: 'done on st', variant: 'st', fellBack: true });
    expect(s.job).toHaveBeenCalledTimes(2);
    expect(s.getSession.mock.calls.map(([variant]) => variant)).toEqual(['mt', 'st']);
    expect(s.policy.multiThreadDisabled).toBe(true);
    expect(s.onFallback).toHaveBeenCalledOnce();
  });

  it('skips multi-thread entirely once it has been switched off', async () => {
    const s = setup({});
    s.policy.multiThreadDisabled = true;
    const result = await runOnCore({ variant: 'mt', ...s });
    expect(result.variant).toBe('st');
    expect(s.getSession.mock.calls.map(([variant]) => variant)).toEqual(['st']);
  });

  it('does not retry other failures', async () => {
    const s = setup({ mt: 'fail' });
    await expect(runOnCore({ variant: 'mt', ...s })).rejects.toMatchObject({
      code: 'unreadable-file',
    });
    expect(s.job).toHaveBeenCalledOnce();
    expect(s.policy.multiThreadDisabled).toBe(false);
  });

  it('does not retry a single-thread stall', async () => {
    const s = setup({ st: 'stall' });
    await expect(runOnCore({ variant: 'st', ...s })).rejects.toMatchObject({ code: 'stalled' });
    expect(s.job).toHaveBeenCalledOnce();
  });

  it('reports the single-thread error if the retry also fails', async () => {
    const s = setup({ mt: 'stall', st: 'fail' });
    await expect(runOnCore({ variant: 'mt', ...s })).rejects.toMatchObject({
      code: 'unreadable-file',
    });
    expect(s.job).toHaveBeenCalledTimes(2);
  });
});
