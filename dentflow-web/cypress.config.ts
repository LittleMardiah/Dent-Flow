import { defineConfig } from 'cypress';
import * as path from 'path';
import { execSync } from 'child_process';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    video: false,
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    setupNodeEvents(on) {
      on('task', {
        seedE2E(): boolean {
          const seedPath = path.resolve(__dirname, '../dentflow-backend/scripts/seed-e2e.cjs');
          const { seedE2eData } = require(seedPath) as { seedE2eData: () => Promise<void> };
          return seedE2eData().then(() => true) as unknown as boolean;
        },
        seedMultiBranch(): boolean {
          const backendDir = path.resolve(__dirname, '../dentflow-backend');
          execSync('npx ts-node scripts/seed-multi-branch.ts', { cwd: backendDir, stdio: 'inherit' });
          return true;
        },
        seedWebhookReplay(): boolean {
          const seedPath = path.resolve(__dirname, '../dentflow-backend/scripts/seed-webhook-replay.cjs');
          const { seedWebhookReplay } = require(seedPath) as { seedWebhookReplay: () => Promise<void> };
          return seedWebhookReplay().then(() => true) as unknown as boolean;
        },
        seedNoShow(): boolean {
          const seedPath = path.resolve(__dirname, '../dentflow-backend/scripts/seed-noshow.cjs');
          const { seedNoShow } = require(seedPath) as { seedNoShow: () => Promise<void> };
          return seedNoShow().then(() => true) as unknown as boolean;
        },
      });
    },
  },
});