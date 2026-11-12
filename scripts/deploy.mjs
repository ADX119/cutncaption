// Builds the production site and deploys it to Cloudflare: `pnpm deploy:cf`.
//
// Production-only settings are applied here rather than in an .env file, so that
// ordinary builds (dev, tests, CI) never include analytics or contact Cloudflare.
import { spawnSync } from 'node:child_process';

const PRODUCTION_ENV = {
  // Cloudflare Web Analytics site token. Public by design: it is in the page HTML.
  NEXT_PUBLIC_CF_BEACON_TOKEN: 'e7275f62a3f34c81854cbc0c33b9dc77',
};

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    // pnpm is a .cmd shim on Windows, which needs a shell to launch.
    shell: process.platform === 'win32',
    env: { ...process.env, ...PRODUCTION_ENV },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('pnpm', ['exec', 'next', 'build']);
run('pnpm', ['exec', 'wrangler', 'deploy']);
