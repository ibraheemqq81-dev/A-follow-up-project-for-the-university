import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const databasePath = resolve('.e2e-data', 'app.db');
mkdirSync(resolve('.e2e-data'), { recursive: true });
const jwtSecretPath = resolve('.e2e-data', 'jwt-secret.txt');
const jwtSecret = existsSync(jwtSecretPath) ? readFileSync(jwtSecretPath, 'utf8') : randomBytes(48).toString('base64url');
if (!existsSync(jwtSecretPath)) writeFileSync(jwtSecretPath, jwtSecret, { mode: 0o600 });
const passwordFile = resolve('.e2e-data', 'e2e-password.txt');
if (!existsSync(passwordFile)) writeFileSync(passwordFile, randomBytes(24).toString('base64url'), { mode: 0o600 });
const e2ePassword = readFileSync(passwordFile, 'utf8');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3137',
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx tsx scripts/start-e2e-server.ts',
    url: 'http://127.0.0.1:3137/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NODE_ENV: 'development',
      PORT: '3137',
      UOMUS_DB_PATH: databasePath,
      TRUST_PROXY_HOPS: '0',
      JWT_SECRET: jwtSecret,
      UOMUS_E2E_PASSWORD: e2ePassword,
      CORS_ORIGIN: 'http://127.0.0.1:3137',
    },
  },
});
