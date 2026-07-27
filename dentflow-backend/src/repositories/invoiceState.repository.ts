import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export class InvoiceStateRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
  }

  /**
   * Transition invoice status from UNPAID to PAID
   * Uses database trigger and constraint to enforce rules
   */
  async transitionState(
    invoiceId: string,
    fromState: string,
    toState: string,
    transitionReason: string,
    paymentMethod?: string,
    transactionId?: string,
    amount?: number
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Validate transition in application layer (extra safety)
      if (fromState !== 'UNPAID' || toState !== 'PAID') {
        throw new Error('INVALID_TRANSITION');
      }

      // Update invoice status
      const updateQuery = `
        UPDATE invoices
        SET status = $1,
            previous_status = $2,
            payment_method = $3,
            paid_at = NOW(),
            amount_paid = COALESCE($4, amount_due),
            updated_at = NOW()
        WHERE id = $5
          AND status = $2  -- Ensure current status is UNPAID
        RETURNING *
      `;
      const result = await client.query(updateQuery, [
        toState,       // $1
        fromState,     // $2
        paymentMethod, // $3
        amount,        // $4
        invoiceId,     // $5
      ]);

      if (result.rows.length === 0) {
        throw new Error('TRANSITION_FAILED');
      }

      await client.query('COMMIT');
      logger.info(`Invoice ${invoiceId} transitioned ${fromState} → ${toState} (${transitionReason})`);
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error({ error: error.message, stack: error.stack }, 'State transition failed');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get invoice with payment history
   */
  async getInvoiceWithHistory(invoiceId: string): Promise<any> {
    const invoiceResult = await this.pool.query(
      'SELECT * FROM invoices WHERE id = $1',
      [invoiceId]
    );
    if (invoiceResult.rows.length === 0) {
      throw new Error('INVOICE_NOT_FOUND');
    }
    const invoice = invoiceResult.rows[0];

    const historyResult = await this.pool.query(
      `SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY paid_at ASC`,
      [invoiceId]
    );
    invoice.payment_history = historyResult.rows;
    return invoice;
  }
}
