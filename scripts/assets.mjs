// Manages the large engine files that the site serves from /assets/* (R2).
//
//   node scripts/assets.mjs manifest     write src/engine/assets/manifest.json (runs on install)
//   node scripts/assets.mjs seed-local   copy the files into Wrangler's local R2, for
//                                        `pnpm preview` and the e2e tests. No account needed.
//   node scripts/assets.mjs upload       upload to the real bucket. Ask the owner first.
//
// The source of truth is public/assets/, filled by scripts/vendor-copy.mjs.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, contentTypeFor } from './lib/asset-manifest.mjs';

const BUCKET = 'cutncaption-assets';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetDir = path.join(root, 'public', 'assets');
const manifestPath = path.join(root, 'src', 'engine', 'assets', 'manifest.json');
const seedStamp = path.join(root, '.wrangler', 'assets-seed.json');

function put(key, target) {
  // Wrangler's JS entry is run with this Node directly: no shell, so it behaves the
  // same on Windows, macOS and Linux and paths need no quoting.
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
      'r2',
      'object',
      'put',
      `${BUCKET}/${key}`,
      '--file',
      path.join(assetDir, key),
      '--content-type',
      contentTypeFor(key),
      target,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  if (result.status !== 0) {
    console.error(`Failed to put ${key} (${target}).`);
    process.exit(result.status ?? 1);
  }
}

const command = process.argv[2];
const manifest = buildManifest(assetDir);
const keys = Object.keys(manifest);

if (keys.length === 0) {
  console.error('No files in public/assets/. Run `node scripts/vendor-copy.mjs` first.');
  process.exit(1);
}

if (command === 'manifest') {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`asset manifest written: ${keys.length} files`);
} else if (command === 'seed-local') {
  // Skip when the local bucket already holds exactly these files.
  const wanted = JSON.stringify(manifest);
  const seeded = fs.existsSync(seedStamp) ? fs.readFileSync(seedStamp, 'utf8') : '';
  if (seeded === wanted) {
    console.log('local R2 already seeded');
  } else {
    for (const key of keys) put(key, '--local');
    fs.mkdirSync(path.dirname(seedStamp), { recursive: true });
    fs.writeFileSync(seedStamp, wanted);
    console.log(`local R2 seeded: ${keys.length} files`);
  }
} else if (command === 'upload') {
  for (const key of keys) {
    console.log(`uploading ${key} (${(manifest[key].bytes / 1024 / 1024).toFixed(1)} MB)`);
    put(key, '--remote');
  }
  console.log(`uploaded ${keys.length} files to ${BUCKET}`);
} else {
  console.error('Usage: node scripts/assets.mjs <manifest|seed-local|upload>');
  process.exit(1);
}
