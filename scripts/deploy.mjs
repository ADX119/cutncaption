// Builds the production site, deploys it to Cloudflare, and waits until the new
// version is fully served: `pnpm deploy:cf`.
//
// Production-only settings are applied here rather than in an .env file, so that
// ordinary builds (dev, tests, CI) never include analytics or contact Cloudflare.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://cutncaption.inyourbrowser.workers.dev';
// Pages whose scripts must all be served before the deploy counts as done.
const CHECK_PAGES = ['/', '/tools/engine-check/', '/tools/trim-video/'];
const READY_TIMEOUT_MS = 3 * 60 * 1000;

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

/** Script URLs a built page references, read from the local build output. */
function scriptsOf(page) {
  const file = path.join(root, 'out', page, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  return [...new Set(html.match(/\/_next\/static\/[^"']+\.js/g) ?? [])];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cloudflare can serve the old version, or 404s for new files, for a short while
 * after a deploy. Wait until every script of the new build answers 200.
 */
async function waitUntilServed() {
  const urls = [...new Set(CHECK_PAGES.flatMap(scriptsOf))].map((p) => `${SITE}${p}`);
  const deadline = Date.now() + READY_TIMEOUT_MS;
  process.stdout.write(`\nWaiting for ${urls.length} new files and ${CHECK_PAGES.length} pages`);

  /** The live page refers to exactly the scripts of this build (not the old HTML). */
  const pageIsNew = async (page) => {
    try {
      const html = await (await fetch(`${SITE}${page}`, { cache: 'no-store' })).text();
      const live = new Set(html.match(/\/_next\/static\/[^"']+\.js/g) ?? []);
      return scriptsOf(page).every((script) => live.has(script));
    } catch {
      return false;
    }
  };

  for (;;) {
    const statuses = await Promise.all(
      urls.map((url) =>
        fetch(url, { method: 'HEAD', cache: 'no-store' }).then(
          (response) => response.status,
          () => 0,
        ),
      ),
    );
    const pagesNew = await Promise.all(CHECK_PAGES.map(pageIsNew));
    if (statuses.every((status) => status === 200) && pagesNew.every(Boolean)) {
      console.log(' ready.');
      return;
    }
    if (Date.now() > deadline) {
      console.error(`\nStill not fully served after ${READY_TIMEOUT_MS / 1000} s.`);
      process.exit(1);
    }
    process.stdout.write('.');
    await sleep(3000);
  }
}

run('next', ['next', 'dist', 'bin', 'next'], ['build']);
run('wrangler', ['wrangler', 'bin', 'wrangler.js'], ['deploy']);
await waitUntilServed();
console.log(`Live: ${SITE}`);
