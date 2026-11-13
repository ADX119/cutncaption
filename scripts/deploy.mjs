// Builds the production site and deploys it to Cloudflare: `pnpm deploy:cf`.
//
// Production-only settings are applied here rather than in an .env file, so that
// ordinary builds (dev, tests, CI) never include analytics or contact Cloudflare.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const PRODUCTION_ENV = {
  // Cloudflare Web Analytics site token. Public by design: it is in the page HTML.
  NEXT_PUBLIC_CF_BEACON_TOKEN: 'e7275f62a3f34c81854cbc0c33b9dc77',
};

/** Runs a package's JS entry with this Node directly: no shell, same on every OS. */
function run(label, entry, args) {
  console.log(`\n> ${label} ${args.join(' ')}`);
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules', ...entry), ...args], {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, ...PRODUCTION_ENV },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('next', ['next', 'dist', 'bin', 'next'], ['build']);
run('wrangler', ['wrangler', 'bin', 'wrangler.js'], ['deploy']);
