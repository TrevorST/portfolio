import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

/** Smoke tests against the production build (`npm run build` first). */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // One worker on CI: the 3D tests render WebGL in software (SwiftShader) and
  // starve a parallel worker's timers on the 2-core runner.
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // WebGL on GPU-less CI runners, for the 3D hero
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
