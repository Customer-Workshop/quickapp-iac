import { defineConfig, devices } from '@playwright/test';

const deployed = process.argv.some(
  (a, i, arr) =>
    a === '--project=deployed' || (a === '--project' && arr[i + 1] === 'deployed'),
);

if (!deployed) {
  process.env.SMOKE_BASE_URL_TEMPLATE ??= 'http://localhost:{port}';
}

const stubProject = {
  name: 'stub',
  use: { ...devices['Desktop Chrome'], ignoreHTTPSErrors: true },
  metadata: { mode: 'stub' },
};

const deployedProject = {
  name: 'deployed',
  use: { ...devices['Desktop Chrome'], ignoreHTTPSErrors: true },
  metadata: { mode: 'deployed' },
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: { timeout: 10_000 },
  webServer: deployed
    ? undefined
    : {
        command: 'npm run stub',
        url: 'http://localhost:4200/healthz',
        reuseExistingServer: !process.env.CI,
        cwd: __dirname,
        timeout: 30_000,
      },
  projects: deployed ? [deployedProject] : [stubProject],
});
