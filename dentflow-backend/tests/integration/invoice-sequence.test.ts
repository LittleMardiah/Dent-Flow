import { invoiceNumberService } from '../../src/services/invoiceNumber.service';
import { pool } from '../../src/config/database';
import { logger } from '../../src/utils/logger';

describe('Invoice Number Sequence Generation (Atomic)', () => {
  const branchId = '494a607c-d109-4330-a3a9-68f54326f0c7'; // existing branch
  const testDate = new Date('2026-07-22');

  beforeAll(async () => {
    // ===== Ensure table and function exist (self-contained) =====
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'invoice_sequences'
      );
    `);
    if (!tableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE invoice_sequences (
          id SERIAL PRIMARY KEY,
          branch_id UUID NOT NULL,
          sequence_date DATE NOT NULL,
          current_sequence INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(branch_id, sequence_date)
        );
        CREATE INDEX idx_invoice_sequences_branch_date ON invoice_sequences(branch_id, sequence_date);
      `);
      logger.info('✅ Created invoice_sequences table');
    }

    const funcCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc WHERE proname = 'get_next_invoice_number'
      );
    `);
    if (!funcCheck.rows[0].exists) {
      await pool.query(`
        CREATE OR REPLACE FUNCTION get_next_invoice_number(
          p_branch_id UUID,
          p_sequence_date DATE
        ) RETURNS VARCHAR AS $$
        DECLARE
          v_sequence INT;
        BEGIN
          INSERT INTO invoice_sequences (branch_id, sequence_date, current_sequence)
          VALUES (p_branch_id, p_sequence_date, 1)
          ON CONFLICT (branch_id, sequence_date)
          DO UPDATE SET current_sequence = invoice_sequences.current_sequence + 1
          RETURNING current_sequence INTO v_sequence;
          
          RETURN 'INV-' || p_branch_id || '-' || TO_CHAR(p_sequence_date, 'YYYYMMDD') || '-' || LPAD(v_sequence::text, 3, '0');
        END;
        $$ LANGUAGE plpgsql;
      `);
      logger.info('✅ Created get_next_invoice_number function');
    }

    // Ensure branch exists
    const branchCheck = await pool.query('SELECT id FROM branches WHERE id = $1', [branchId]);
    if (branchCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO branches (id, name, phone, address, is_active)
         VALUES ($1, 'Cabang Test', '021-1234567', 'Jl. Test', true)
         ON CONFLICT (id) DO NOTHING`,
        [branchId]
      );
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM invoice_sequences WHERE branch_id = $1', [branchId]);
    await pool.end();
  });

  it('should generate invoice number with correct format', async () => {
    await pool.query(
      'DELETE FROM invoice_sequences WHERE branch_id = $1 AND sequence_date = $2',
      [branchId, testDate.toISOString().split('T')[0]]
    );

    const invoiceNumber = await invoiceNumberService.generateInvoiceNumber(branchId, testDate);
    
    // Use regex to parse: INV-<UUID>-<YYYYMMDD>-<SEQ>
    const match = invoiceNumber.match(/^INV-([0-9a-f-]+)-(\d{8})-(\d{3})$/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe(branchId);
    expect(match![2]).toBe('20260722');
    expect(match![3]).toBe('001');
  });

  it('should generate sequential numbers per branch per day', async () => {
    await pool.query(
      'DELETE FROM invoice_sequences WHERE branch_id = $1 AND sequence_date = $2',
      [branchId, testDate.toISOString().split('T')[0]]
    );

    const num1 = await invoiceNumberService.generateInvoiceNumber(branchId, testDate);
    const num2 = await invoiceNumberService.generateInvoiceNumber(branchId, testDate);
    const num3 = await invoiceNumberService.generateInvoiceNumber(branchId, testDate);

    const seq1 = parseInt(num1.split('-').pop() || '0', 10);
    const seq2 = parseInt(num2.split('-').pop() || '0', 10);
    const seq3 = parseInt(num3.split('-').pop() || '0', 10);

    expect(seq1).toBe(1);
    expect(seq2).toBe(2);
    expect(seq3).toBe(3);
  });

  it('should generate unique numbers under concurrent load (50 requests)', async () => {
    const branchId2 = '22222222-2222-2222-2222-222222222222';
    const testDate2 = new Date('2026-07-23');

    await pool.query(
      `INSERT INTO branches (id, name, phone, address, is_active)
       VALUES ($1, 'Cabang Test 2', '021-1234567', 'Jl. Test 2', true)
       ON CONFLICT (id) DO NOTHING`,
      [branchId2]
    );

    await pool.query(
      'DELETE FROM invoice_sequences WHERE branch_id = $1 AND sequence_date = $2',
      [branchId2, testDate2.toISOString().split('T')[0]]
    );

    const promises = [];
    const count = 50;
    for (let i = 0; i < count; i++) {
      promises.push(invoiceNumberService.generateInvoiceNumber(branchId2, testDate2));
    }
    const results = await Promise.all(promises);
    const sequences = results.map(num => parseInt(num.split('-').pop() || '0', 10));
    const sorted = [...sequences].sort((a, b) => a - b);

    expect(sorted).toHaveLength(count);
    for (let i = 1; i <= count; i++) {
      expect(sorted[i - 1]).toBe(i);
    }
    const unique = new Set(sequences);
    expect(unique.size).toBe(count);
  });

  it('should have independent sequences per branch per day', async () => {
    const branchA = '33333333-3333-3333-3333-333333333333';
    const branchB = '44444444-4444-4444-4444-444444444444';
    const dateA = new Date('2026-07-24');
    const dateB = new Date('2026-07-25');

    await pool.query(
      `INSERT INTO branches (id, name, phone, address, is_active)
       VALUES ($1, 'Cabang A', '021-1234567', 'Jl. A', true)
       ON CONFLICT (id) DO NOTHING`,
      [branchA]
    );
    await pool.query(
      `INSERT INTO branches (id, name, phone, address, is_active)
       VALUES ($1, 'Cabang B', '021-1234567', 'Jl. B', true)
       ON CONFLICT (id) DO NOTHING`,
      [branchB]
    );

    await pool.query(
      'DELETE FROM invoice_sequences WHERE branch_id IN ($1, $2) AND sequence_date IN ($3, $4)',
      [branchA, branchB, dateA.toISOString().split('T')[0], dateB.toISOString().split('T')[0]]
    );

    const numA1 = await invoiceNumberService.generateInvoiceNumber(branchA, dateA);
    const numA2 = await invoiceNumberService.generateInvoiceNumber(branchA, dateA);
    const numB1 = await invoiceNumberService.generateInvoiceNumber(branchB, dateB);
    const numB2 = await invoiceNumberService.generateInvoiceNumber(branchB, dateB);

    const seqA1 = parseInt(numA1.split('-').pop() || '0', 10);
    const seqA2 = parseInt(numA2.split('-').pop() || '0', 10);
    const seqB1 = parseInt(numB1.split('-').pop() || '0', 10);
    const seqB2 = parseInt(numB2.split('-').pop() || '0', 10);

    expect(seqA1).toBe(1);
    expect(seqA2).toBe(2);
    expect(seqB1).toBe(1);
    expect(seqB2).toBe(2);
  });
});
