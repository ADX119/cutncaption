import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import boundaries from 'eslint-plugin-boundaries';

// Module boundaries from docs/ARCHITECTURE.md §3: layer -> layers it may import.
const LAYERS = {
  app: ['features', 'seo', 'components', 'i18n'],
  features: ['engine', 'editor', 'components', 'i18n', 'lib'],
  components: ['i18n', 'lib'],
  engine: ['editor', 'lib'],
  editor: ['lib'],
  seo: ['features', 'components', 'i18n', 'lib'],
  i18n: [],
  lib: [],
};

// Only engine/ may load the wasm, model and codec libraries.
const ENGINE_ONLY_PACKAGES = [
  '@ffmpeg/*',
  '@huggingface/transformers',
  'onnxruntime-web',
  'onnxruntime-web/*',
  'mediabunny',
];
const UI_PACKAGES = ['react', 'react-dom', 'react-dom/*', 'next', 'next/*', 'zustand', 'zustand/*'];

function restrictedImports(layer) {
  const patterns = [];
  if (layer !== 'engine') {
    patterns.push({
      group: ENGINE_ONLY_PACKAGES,
      message: 'Only src/engine may import wasm, model and codec libraries.',
    });
  }
  if (layer === 'engine' || layer === 'editor') {
    patterns.push({
      group: UI_PACKAGES,
      message: `src/${layer} must stay framework-free (no React, Next or Zustand).`,
    });
  }
  if (layer !== 'engine') {
    patterns.push({
      group: ['@/engine/*/*'],
      message: 'Import engines through their public index (e.g. "@/engine/media").',
    });
  }
  return patterns;
}

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': Object.keys(LAYERS).map((type) => ({
        type,
        pattern: `src/${type}`,
      })),
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: Object.entries(LAYERS).map(([layer, allowed]) => ({
            from: { element: { type: layer } },
            allow: { to: { element: { types: [layer, ...allowed] } } },
          })),
        },
      ],
    },
  },
  ...Object.keys(LAYERS).map((layer) => ({
    files: [`src/${layer}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', { patterns: restrictedImports(layer) }],
    },
  })),
  globalIgnores(['.next/**', 'out/**', 'coverage/**', 'next-env.d.ts']),
]);
