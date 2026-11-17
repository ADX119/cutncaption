import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: __dirname });

async function ruleIds(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(__dirname, file) });
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'fatal');
}

describe('no hardcoded UI strings', () => {
  it('rejects a string literal in JSX', async () => {
    const code = 'export const A = () => <p>Hello</p>;';
    expect(await ruleIds('src/components/x.tsx', code)).toContain('react/jsx-no-literals');
  });

  it('allows text that comes from t()', async () => {
    const code =
      "import { t } from '@/i18n';\nexport const A = () => <p className=\"x\">{t('app.name')}</p>;";
    expect(await ruleIds('src/components/x.tsx', code)).not.toContain('react/jsx-no-literals');
  });
});

describe('e2e privacy guard', () => {
  it('rejects a spec that imports test straight from Playwright', async () => {
    const code = "import { test } from '@playwright/test';\ntest('x', async () => {});";
    expect(await ruleIds('tests/e2e/x.spec.ts', code)).toContain('no-restricted-imports');
  });

  it('allows the guarded test function', async () => {
    const code = "import { test } from './support/test';\ntest('x', async () => {});";
    expect(await ruleIds('tests/e2e/x.spec.ts', code)).not.toContain('no-restricted-imports');
  });
});

describe('module boundaries', () => {
  it.each([
    ['components -> engine', 'src/components/x.ts', "import '@/engine/media';"],
    ['components -> features', 'src/components/x.ts', "import '@/features/captions';"],
    ['editor -> engine', 'src/editor/captions/x.ts', "import '@/engine/media';"],
    ['engine -> features', 'src/engine/media/x.ts', "import '@/features/captions';"],
    ['app -> engine', 'src/app/x.ts', "import '@/engine/media';"],
    ['seo -> engine', 'src/seo/x.ts', "import '@/engine/media';"],
    ['relative path escape', 'src/components/x.ts', "import '../engine/media';"],
  ])('rejects %s', async (_name, file, code) => {
    expect(await ruleIds(file, code)).toContain('boundaries/dependencies');
  });

  it.each([
    ['React in editor', 'src/editor/captions/x.ts', "import 'react';"],
    ['React in engine', 'src/engine/media/x.ts', "import 'react';"],
    ['ffmpeg outside engine', 'src/features/captions/x.ts', "import '@ffmpeg/ffmpeg';"],
    [
      'transformers outside engine',
      'src/editor/captions/x.ts',
      "import '@huggingface/transformers';",
    ],
    [
      'engine internals from a feature',
      'src/features/captions/x.ts',
      "import '@/engine/media/ffmpeg';",
    ],
  ])('rejects %s', async (_name, file, code) => {
    expect(await ruleIds(file, code)).toContain('no-restricted-imports');
  });

  it.each([
    ['features -> engine index', 'src/features/captions/x.ts', "import '@/engine/media';"],
    ['features -> editor', 'src/features/captions/x.ts', "import '@/editor/captions';"],
    ['engine -> editor', 'src/engine/media/x.ts', "import '@/editor/captions';"],
    ['engine -> ffmpeg', 'src/engine/media/x.ts', "import '@ffmpeg/ffmpeg';"],
    ['engine internals inside engine', 'src/engine/media/x.ts', "import '@/engine/assets/cache';"],
    ['app -> features', 'src/app/x.ts', "import '@/features/captions';"],
    ['seo -> features', 'src/seo/x.ts', "import '@/features/captions';"],
  ])('allows %s', async (_name, file, code) => {
    const ids = await ruleIds(file, code);
    expect(ids).not.toContain('boundaries/dependencies');
    expect(ids).not.toContain('no-restricted-imports');
  });
});
