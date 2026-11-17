import { describe, expect, it } from 'vitest';
import { type WorkspaceFs, renameInputs, safeExtension, withWorkspace } from './workspace';

/** In-memory stand-in for ffmpeg's file system, strict like the real one. */
function fakeFs(options: { failUnmount?: boolean } = {}) {
  const dirs = new Set<string>(['/']);
  const files = new Map<string, Uint8Array>();
  const mounts = new Map<string, readonly File[]>();
  const parent = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';
  const children = (dir: string) => [
    ...[...dirs].filter((d) => d !== dir && parent(d) === dir),
    ...[...files.keys()].filter((f) => parent(f) === dir),
  ];

  const fs: WorkspaceFs = {
    async createDir(path) {
      if (dirs.has(path) || !dirs.has(parent(path))) throw new Error(`EEXIST/ENOENT ${path}`);
      dirs.add(path);
    },
    async deleteDir(path) {
      if (mounts.has(path)) throw new Error(`EBUSY ${path}`);
      if (children(path).length > 0) throw new Error(`ENOTEMPTY ${path}`);
      dirs.delete(path);
    },
    async mountFiles(list, mountPoint) {
      if (!dirs.has(mountPoint)) throw new Error(`ENOENT ${mountPoint}`);
      mounts.set(mountPoint, list);
    },
    async unmount(mountPoint) {
      if (options.failUnmount) throw new Error('unmount failed');
      mounts.delete(mountPoint);
    },
    async writeFile(path, data) {
      if (!dirs.has(parent(path))) throw new Error(`ENOENT ${path}`);
      files.set(path, data);
    },
    async readFile(path) {
      const data = files.get(path);
      if (!data) throw new Error(`ENOENT ${path}`);
      return data;
    },
    async deleteFile(path) {
      files.delete(path);
    },
    async listDir(path) {
      return children(path).map((child) => ({
        name: child.slice(child.lastIndexOf('/') + 1),
        isDir: dirs.has(child),
      }));
    },
  };
  return { fs, dirs, files, mounts };
}

const clip = (name: string) => new File([new Uint8Array(10)], name, { type: 'video/mp4' });

describe('safeExtension', () => {
  it.each([
    ['holiday.MP4', '.mp4'],
    ['clip.webm', '.webm'],
    ['no-extension', ''],
    ['.hidden', ''],
    ['weird.ext with space', ''],
    ['वीडियो.mov', '.mov'],
  ])('%s -> "%s"', (name, expected) => {
    expect(safeExtension(name)).toBe(expected);
  });
});

describe('renameInputs', () => {
  it('gives inputs neutral names and keeps type and size', () => {
    const [renamed] = renameInputs([clip('my clip: final?.MP4')]);
    expect(renamed?.name).toBe('input0.mp4');
    expect(renamed?.type).toBe('video/mp4');
    expect(renamed?.size).toBe(10);
  });
});

describe('withWorkspace', () => {
  it('mounts inputs, lets the job write and read, then removes everything', async () => {
    const { fs, dirs, files, mounts } = fakeFs();
    let seenInput = '';

    const result = await withWorkspace(fs, [clip('a b.mp4')], async (ws) => {
      seenInput = ws.input();
      expect(mounts.size).toBe(1);
      await fs.writeFile(ws.path('out.mp4'), new Uint8Array([1, 2, 3])); // as ffmpeg would
      await ws.writeFile('overlay.png', new Uint8Array([9]));
      const blob = await ws.readOutput('out.mp4', 'video/mp4');
      return { size: blob.size, type: blob.type };
    });

    expect(result).toEqual({ size: 3, type: 'video/mp4' });
    expect(seenInput).toMatch(/^\/job\d+\/in\/input0\.mp4$/);
    expect([...dirs]).toEqual(['/']);
    expect(files.size).toBe(0);
    expect(mounts.size).toBe(0);
  });

  it('cleans up when the job throws, and rethrows the job error', async () => {
    const { fs, dirs, files, mounts } = fakeFs();
    const failure = withWorkspace(fs, [clip('a.mp4')], async (ws) => {
      await ws.writeFile('partial.mp4', new Uint8Array([1]));
      throw new Error('ffmpeg failed');
    });
    await expect(failure).rejects.toThrow('ffmpeg failed');
    expect([...dirs]).toEqual(['/']);
    expect(files.size).toBe(0);
    expect(mounts.size).toBe(0);
  });

  it('keeps cleaning up when a step fails, and never hides the result', async () => {
    const { fs, files } = fakeFs({ failUnmount: true });
    const value = await withWorkspace(fs, [clip('a.mp4')], async (ws) => {
      await ws.writeFile('out.txt', new Uint8Array([1]));
      return 'done';
    });
    expect(value).toBe('done');
    expect(files.size).toBe(0);
  });

  it('gives concurrent jobs separate folders', async () => {
    const { fs } = fakeFs();
    const paths: string[] = [];
    await Promise.all([
      withWorkspace(fs, [clip('a.mp4')], async (ws) => paths.push(ws.input())),
      withWorkspace(fs, [clip('b.mp4')], async (ws) => paths.push(ws.input())),
    ]);
    expect(new Set(paths.map((p) => p.split('/')[1])).size).toBe(2);
  });

  it('works with no inputs (e.g. generated test media)', async () => {
    const { fs, dirs } = fakeFs();
    await withWorkspace(fs, [], async (ws) => ws.path('out.mp4'));
    expect([...dirs]).toEqual(['/']);
  });

  it('refuses output names that could escape the folder or be options', async () => {
    const { fs } = fakeFs();
    await withWorkspace(fs, [], async (ws) => {
      for (const bad of ['../x', '-y', 'a/b', '', '.hidden']) {
        expect(() => ws.path(bad), bad).toThrow();
      }
      expect(() => ws.input(3)).toThrow();
    });
  });
});
