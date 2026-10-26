import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: {
    timeout: 10000
  },
  reporter: 'list',
  use: {
    baseURL: process.env.CONEXA_E2E_BASE_URL || 'http://127.0.0.1:3132',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure'
  }
});