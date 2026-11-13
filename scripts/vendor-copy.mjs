// Copies the ffmpeg.wasm runtime files out of node_modules so the site can serve them
// from its own origin. Runs on `pnpm install` (postinstall).
//
//   public/vendor/ffmpeg/<wrapper>_<core>/   small JS files, shipped with the site
//     class/   the wrapper (FFmpeg class and its worker) as native ES modules
//     st/      single-thread core loader
//     mt/      multi-thread core loader and its thread worker
//   public/assets/ffmpeg/<core>/{st,mt}/     the ~32 MB wasm files, for `next dev` only.
//                                            Listed in public/.assetsignore, so they are
//                                            never deployed: production and `wrangler dev`
//                                            serve /assets/* from R2 through the Worker.
//
// Also writes src/engine/media/ffmpeg/vendor.json so the engine knows the paths.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = (name) => path.join(root, 'node_modules', ...name.split('/'));
const version = (name) =>
  JSON.parse(fs.readFileSync(path.join(pkg(name), 'package.json'), 'utf8')).version;

const wrapperVersion = version('@ffmpeg/ffmpeg');
const coreVersion = version('@ffmpeg/core');
if (version('@ffmpeg/core-mt') !== coreVersion) {
  console.error('@ffmpeg/core and @ffmpeg/core-mt must be the same version.');
  process.exit(1);
}

const vendorName = `${wrapperVersion}_${coreVersion}`;
const vendorRoot = path.join(root, 'public', 'vendor', 'ffmpeg');
const devAssetRoot = path.join(root, 'public', 'assets', 'ffmpeg');

/** [package, file inside dist/esm, destination folder] */
const VENDOR_FILES = [
  // The whole wrapper, served as native ES modules. It is loaded at runtime, not
  // bundled: bundlers cannot process the way it starts its worker.
  ...['index.js', 'classes.js', 'types.js', 'utils.js', 'const.js', 'errors.js', 'worker.js'].map(
    (file) => ['@ffmpeg/ffmpeg', file, 'class'],
  ),
  ['@ffmpeg/core', 'ffmpeg-core.js', 'st'],
  ['@ffmpeg/core-mt', 'ffmpeg-core.js', 'mt'],
  ['@ffmpeg/core-mt', 'ffmpeg-core.worker.js', 'mt'],
];
const WASM_FILES = [
  ['@ffmpeg/core', 'st'],
  ['@ffmpeg/core-mt', 'mt'],
];

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/** Removes folders left behind by previous versions. */
function keepOnly(dir, name) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    if (entry !== name) fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

keepOnly(vendorRoot, vendorName);
keepOnly(devAssetRoot, coreVersion);

for (const [name, file, folder] of VENDOR_FILES) {
  copy(path.join(pkg(name), 'dist', 'esm', file), path.join(vendorRoot, vendorName, folder, file));
}
for (const [name, folder] of WASM_FILES) {
  copy(
    path.join(pkg(name), 'dist', 'esm', 'ffmpeg-core.wasm'),
    path.join(devAssetRoot, coreVersion, folder, 'ffmpeg-core.wasm'),
  );
}

const vendor = {
  wrapperVersion,
  coreVersion,
  // URL path of the small JS files on the site's own origin.
  vendorBase: `/vendor/ffmpeg/${vendorName}`,
  // Key prefix of the wasm files under /assets/ (R2 in production).
  assetPrefix: `ffmpeg/${coreVersion}`,
};
fs.writeFileSync(
  path.join(root, 'src', 'engine', 'media', 'ffmpeg', 'vendor.json'),
  `${JSON.stringify(vendor, null, 2)}\n`,
);

console.log(`ffmpeg vendor files ready: ${vendor.vendorBase}`);
