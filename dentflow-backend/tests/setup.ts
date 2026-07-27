import { config } from 'dotenv';

// Load test environment
config({ path: '.env.test' });

// Increase timeout for all tests
jest.setTimeout(30000);

// Global setup
beforeAll(async () => {
  console.log('🧪 Starting Phase 1 Integration Tests...');
});

afterAll(async () => {
  console.log('✅ Phase 1 Integration Tests Complete!');
});
