import { pool } from '../../src/config/database';

describe('Phase 1 Completion Tests (Core)', () => {
  beforeAll(async () => {
    // Ensure database connection
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should have database connection', async () => {
    const result = await pool.query('SELECT 1 as connected');
    expect(result.rows[0].connected).toBe(1);
  });

  it('should have required tables', async () => {
    const tables = ['users', 'bookings', 'queues', 'encounters', 'invoices', 'audit_logs'];
    for (const table of tables) {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )`,
        [table]
      );
      expect(result.rows[0].exists).toBe(true);
    }
  });
});

// Webhook Idempotency tests are skipped (deprecated endpoint /webhooks/payment)
// Will be re-enabled in Phase 3 with /webhooks/midtrans endpoint
describe.skip('Webhook Idempotency (skipped - deprecated endpoint)', () => {
  it('should skip all webhook tests', () => {
    expect(true).toBe(true);
  });
});
