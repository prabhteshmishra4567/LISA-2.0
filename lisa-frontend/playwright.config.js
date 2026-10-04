import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node ../lisa2-backend/fixtures/e2e-server.js', url: 'http://127.0.0.1:5000/api/health', reuseExistingServer: false },
    { command: 'node node_modules/vite/bin/vite.js', url: 'http://127.0.0.1:5173', reuseExistingServer: false },
  ],
});
