import { getErrorMessage, getErrorStack } from "../utils/error.util";
import { Pool } from 'pg';

import { logger } from '../utils/logger';
import { pool } from '../config/database';

export class InvoiceNumberService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async generateInvoiceNumber(branchId: string, date: Date = new Date()): Promise<string> {
    const sequenceDate = date.toISOString().split('T')[0];
    try {
      const result = await this.pool.query(
        'SELECT get_next_invoice_number($1, $2) as invoice_number',
        [branchId, sequenceDate]
      );
      const invoiceNumber = result.rows[0]?.invoice_number;
      if (!invoiceNumber) {
        throw new Error('Failed to generate invoice number');
      }
      logger.info(`✅ Invoice number generated: ${invoiceNumber}`);
      return invoiceNumber;
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Failed to generate invoice number');
      throw new Error('INVOICE_NUMBER_GENERATION_FAILED');
    }
  }
}

export const invoiceNumberService = new InvoiceNumberService();
