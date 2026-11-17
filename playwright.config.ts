import { defineConfig, devices } from '@playwright/test';

const PORT = 8788;
// Set E2E_BASE_URL to run the same specs against a deployed preview or production.
const remoteBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Engine tests start up to 32 wasm threads each; more parallel browsers than this
  // overloads a typical dev machine and crashes test browsers.
  workers: process.env.CI ? 2 : 6,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: remoteBaseUrl ?? `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  // Serves the static export through Wrangler so public/_headers is honoured.
  webServer: remoteBaseUrl
    ? undefined
    : {
        command: `pnpm preview --port ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'pixel', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
  ],
});
