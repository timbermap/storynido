import { defineConfig, devices } from '@playwright/test';

/**
 * E2E (fase 17) contra los emuladores de Firebase, la API y el worker locales con proveedores
 * simulados (IA, pagos, imprenta y mails). Nada cuesta dinero.
 *
 * - Local: con `pnpm emulators`, la API, el worker y la web ya corriendo (`reuseExistingServer`).
 * - CI: `E2E_START=1` levanta la API, el worker, la web y el admin (los emuladores los arranca
 *   `firebase emulators:exec`, ver .github/workflows/e2e.yml).
 */
const start = process.env.E2E_START === '1';
const chrome = process.env.E2E_CHROME_PATH;
const env = {
  APP_ENV: 'local',
  GCP_PROJECT_ID: 'demo-storynido',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
  PRINT_PROVIDERS: 'mock,mock_alt',
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
  NEXT_PUBLIC_API_URL: 'http://localhost:8080',
};

export default defineConfig({
  testDir: './tests',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-MX',
    ...(chrome ? { launchOptions: { executablePath: chrome } } : {}),
  },
  projects: [
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'movil', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: start
    ? [
        {
          command: 'pnpm --filter @storynido/api exec tsx src/server.ts',
          url: 'http://localhost:8080/health',
          env: { ...env, PORT: '8080' },
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter @storynido/worker exec tsx src/server.ts',
          url: 'http://localhost:8081/health',
          env: { ...env, PORT: '8081' },
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter @storynido/web exec next start --port 3000',
          url: 'http://localhost:3000/es',
          env,
          timeout: 180_000,
        },
        {
          command: 'pnpm --filter @storynido/admin exec next start --port 3001',
          url: 'http://localhost:3001',
          env,
          timeout: 180_000,
        },
      ]
    : undefined,
});
