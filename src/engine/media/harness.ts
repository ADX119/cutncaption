import { FfmpegSession } from './ffmpeg/loader';
import { withWorkspace } from './ffmpeg/workspace';

/**
 * Hooks for the browser tests, attached to `window.__cncEngine` on the Engine check
 * page only. They drive the real engine with files the test supplies, on the local
 * build and on the live site. They read nothing from the page and send nothing
 * anywhere, so exposing them gives a visitor no ability they did not already have.
 */

/** A file as the test passes it in (bytes travel as base64). */
export interface HarnessFile {
  readonly name: string;
  readonly type: string;
  readonly base64: string;
}

function toFile({ name, type, base64 }: HarnessFile): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type });
}

/** Folders at the root of ffmpeg's file system that a workspace could have left behind. */
async function leftovers(session: FfmpegSession): Promise<string[]> {
  const entries = await session.fs.listDir('/');
  return entries.map((entry) => entry.name).filter((name) => name.startsWith('job'));
}

export interface WorkspaceCheck {
  readonly outputBytes: number;
  readonly outputType: string;
  readonly leftoversAfterSuccess: readonly string[];
  readonly errorMessage: string;
  readonly leftoversAfterError: readonly string[];
}

/** M1.7: a mounted input can be processed, and nothing is left behind, even on error. */
async function workspaceCheck(input: HarnessFile): Promise<WorkspaceCheck> {
  const session = await FfmpegSession.load({ variant: 'st' });
  try {
    const file = toFile(input);
    const output = await withWorkspace(session.fs, [file], async (ws) => {
      const { exitCode } = await session.exec([
        '-hide_banner',
        '-i',
        ws.input(),
        '-c',
        'copy',
        ws.path('copy.mp4'),
      ]);
      if (exitCode !== 0) throw new Error(`ffmpeg exited with ${exitCode}`);
      return ws.readOutput('copy.mp4', 'video/mp4');
    });
    const leftoversAfterSuccess = await leftovers(session);

    let errorMessage = '';
    try {
      await withWorkspace(session.fs, [file], async (ws) => {
        await ws.writeFile('partial.bin', new Uint8Array([1, 2, 3]));
        throw new Error('simulated failure');
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    return {
      outputBytes: output.size,
      outputType: output.type,
      leftoversAfterSuccess,
      errorMessage,
      leftoversAfterError: await leftovers(session),
    };
  } finally {
    session.terminate();
  }
}

export const engineHarness = { workspaceCheck };
export type EngineHarness = typeof engineHarness;
