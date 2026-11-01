import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] },
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 1050 } } }],
  webServer: { command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run preview -- --port 4173 --strictPort`, url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 30000 },
})
