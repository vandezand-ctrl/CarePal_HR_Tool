import { defineConfig, devices } from '@playwright/test';

// Smoke-test config: boots the backend (port 4000) and the Vite frontend (port
// 5173) automatically and points the tests at http://localhost:5173. Uses
// AUTH_MODE=mock on the backend + VITE_AUTH_MODE=mock on the frontend so we can
// authenticate by setting the `devUserEmail` localStorage key.
//
// VITE_BASE='/' overrides the default GitHub Pages base path so the app loads
// at root, not at /CarePal_HR_Tool/.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // shared backend, shared SQLite — keep serial
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Boot order isn't strictly enforced — Playwright waits for both. The backend
  // resets + reseeds the SQLite DB on every run so tests start from a known
  // state.
  webServer: [
    {
      command: 'npm run db:reset && npm run dev',
      cwd: './carepal-backend',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        AUTH_MODE: 'mock',
        NODE_ENV: 'development',
      },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_AUTH_MODE: 'mock',
        VITE_BASE: '/',
      },
    },
  ],
});
