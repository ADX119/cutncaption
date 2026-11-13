// Shared by scripts/assets.mjs and its tests: finds the large engine files and
// describes each one by size and SHA-256, so the browser can verify what it downloads.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Every file under `dir`, as sorted forward-slash paths relative to it. */
export function listAssets(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  const walk = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), relative);
      else found.push(relative);
    }
  };
  walk(dir, '');
  return found.sort();
}

/** { "<key>": { bytes, sha256 } } for every file under `dir`. Keys are the R2 object keys. */
export function buildManifest(dir) {
  const manifest = {};
  for (const key of listAssets(dir)) {
    const data = fs.readFileSync(path.join(dir, key));
    manifest[key] = {
      bytes: data.length,
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
    };
  }
  return manifest;
}

const CONTENT_TYPES = {
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.onnx': 'application/octet-stream',
};

export function contentTypeFor(key) {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream';
}
