import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node ../lisa2-backend/fixtures/e2e-server.js', url: 'http://127.0.0.1:5001/api/health', reuseExistingServer: false, env: { PORT: '5001', ALLOWED_ORIGINS: 'http://127.0.0.1:5174' } },
    { command: 'node node_modules/vite/bin/vite.js --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: false, env: { VITE_API_URL: 'http://127.0.0.1:5001' } },
  ],
});
