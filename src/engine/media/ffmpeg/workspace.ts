/**
 * A per-job folder inside ffmpeg's virtual file system.
 *
 *   /job<N>/in/       the person's files, mounted read-only with WORKERFS. The bytes
 *                     stay in the File object and are read on demand; they are never
 *                     copied into wasm memory.
 *   /job<N>/<name>    outputs and small helper files (overlay PNG, subtitles, fonts),
 *                     held in memory (MEMFS) until the job ends.
 *
 * Everything is removed when the job ends, whether it succeeded or failed.
 */

/** The slice of the ffmpeg.wasm file-system API a workspace needs. */
export interface WorkspaceFs {
  createDir(path: string): Promise<unknown>;
  deleteDir(path: string): Promise<unknown>;
  mountFiles(files: readonly File[], mountPoint: string): Promise<unknown>;
  unmount(mountPoint: string): Promise<unknown>;
  writeFile(path: string, data: Uint8Array): Promise<unknown>;
  readFile(path: string): Promise<Uint8Array>;
  deleteFile(path: string): Promise<unknown>;
  listDir(path: string): Promise<readonly { name: string; isDir: boolean }[]>;
}

export interface Workspace {
  /** Path of input `index` (in the order given), for use in an ffmpeg command. */
  input(index?: number): string;
  /** Path for a file ffmpeg will write, or one written with writeFile. */
  path(name: string): string;
  /** Puts a small helper file (overlay PNG, subtitles, font) next to the outputs. */
  writeFile(name: string, data: Uint8Array): Promise<void>;
  /** Reads a finished output as a Blob. */
  readOutput(name: string, type: string): Promise<Blob>;
}

let jobCounter = 0;

/** Lower-case extension if it looks like a real one (".mp4"), otherwise "". */
export function safeExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  const extension = name.slice(dot).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(extension) ? extension : '';
}

/**
 * Inputs are renamed to input0.mp4, input1.png … so nothing in a person's file name
 * (spaces, colons, non-Latin script) can be misread by ffmpeg as an option or a
 * protocol. Wrapping a File in a new File does not copy its bytes.
 */
export function renameInputs(files: readonly File[]): File[] {
  return files.map(
    (file, index) =>
      new File([file], `input${index}${safeExtension(file.name)}`, {
        type: file.type,
        lastModified: file.lastModified,
      }),
  );
}

/** Output and helper names are chosen by our code, never by the person. */
function assertPlainName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new Error(`workspace: invalid file name "${name}"`);
  }
}

export async function withWorkspace<T>(
  fs: WorkspaceFs,
  inputs: readonly File[],
  run: (workspace: Workspace) => Promise<T>,
): Promise<T> {
  jobCounter += 1;
  const root = `/job${jobCounter}`;
  const inDir = `${root}/in`;
  const renamed = renameInputs(inputs);
  let mounted = false;

  try {
    await fs.createDir(root);
    await fs.createDir(inDir);
    if (renamed.length > 0) {
      await fs.mountFiles(renamed, inDir);
      mounted = true;
    }

    return await run({
      input(index = 0) {
        const file = renamed[index];
        if (!file) throw new Error(`workspace: no input ${index}`);
        return `${inDir}/${file.name}`;
      },
      path(name) {
        assertPlainName(name);
        return `${root}/${name}`;
      },
      async writeFile(name, data) {
        assertPlainName(name);
        await fs.writeFile(`${root}/${name}`, data);
      },
      async readOutput(name, type) {
        assertPlainName(name);
        const data = await fs.readFile(`${root}/${name}`);
        // The worker transfers a fresh, unshared buffer; the cast states that for TS.
        return new Blob([data as Uint8Array<ArrayBuffer>], { type });
      },
    });
  } finally {
    await cleanUp(fs, root, inDir, mounted);
  }
}

/**
 * Best effort, step by step: one failing step must not stop the others, and a
 * cleanup problem must never hide the job's own result or error. If the ffmpeg
 * instance was terminated (cancel), every call fails and its memory is gone anyway.
 */
async function cleanUp(fs: WorkspaceFs, root: string, inDir: string, mounted: boolean) {
  const attempt = async (step: () => Promise<unknown>) => {
    try {
      await step();
    } catch {
      // Ignored on purpose; see above.
    }
  };

  if (mounted) await attempt(() => fs.unmount(inDir));
  await attempt(() => fs.deleteDir(inDir));
  await attempt(async () => {
    for (const entry of await fs.listDir(root)) {
      if (entry.name === '.' || entry.name === '..' || entry.isDir) continue;
      await attempt(() => fs.deleteFile(`${root}/${entry.name}`));
    }
  });
  await attempt(() => fs.deleteDir(root));
}
