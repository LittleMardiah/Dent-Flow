import { pool } from '../../src/config/database';
import { getOrCreateTestBranch } from '../helpers/testHelpers';

describe('Invoice Sequence Generation', () => {
  let branchId: string;

  beforeAll(async () => {
    branchId = await getOrCreateTestBranch('Invoice Sequence Test');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM invoice_sequences WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    await pool.end();
  });

  it('should generate sequential invoice numbers for a branch', async () => {
    const result1 = await pool.query(
      'SELECT get_next_invoice_number($1, CURRENT_DATE) as invoice_number',
      [branchId]
    );
    const result2 = await pool.query(
      'SELECT get_next_invoice_number($1, CURRENT_DATE) as invoice_number',
      [branchId]
    );
    expect(result1.rows[0].invoice_number).toMatch(/^INV-[0-9a-f-]+-\d{8}-001$/);
    expect(result2.rows[0].invoice_number).toMatch(/^INV-[0-9a-f-]+-\d{8}-002$/);
  });

  it('should handle different branches independently', async () => {
    const branchA = await getOrCreateTestBranch('Branch A Sequence');
    const branchB = await getOrCreateTestBranch('Branch B Sequence');

    const resA1 = await pool.query(
      'SELECT get_next_invoice_number($1, CURRENT_DATE) as invoice_number',
      [branchA]
    );
    const resB1 = await pool.query(
      'SELECT get_next_invoice_number($1, CURRENT_DATE) as invoice_number',
      [branchB]
    );
    const resA2 = await pool.query(
      'SELECT get_next_invoice_number($1, CURRENT_DATE) as invoice_number',
      [branchA]
    );

    expect(resA1.rows[0].invoice_number).toMatch(/^INV-[0-9a-f-]+-\d{8}-001$/);
    expect(resB1.rows[0].invoice_number).toMatch(/^INV-[0-9a-f-]+-\d{8}-001$/);
    expect(resA2.rows[0].invoice_number).toMatch(/^INV-[0-9a-f-]+-\d{8}-002$/);

    await pool.query('DELETE FROM invoice_sequences WHERE branch_id IN ($1, $2)', [branchA, branchB]);
    await pool.query('DELETE FROM branches WHERE id IN ($1, $2)', [branchA, branchB]);
  });
});
