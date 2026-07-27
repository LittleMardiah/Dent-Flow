import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';

export class InvoiceGenerationService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
  }

  async generateInvoiceForEncounter(
    encounterId: string,
    branchId: string,
    amountDue: number = 0
  ): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const encounterResult = await client.query(
        `SELECT e.id, e.booking_id, e.patient_id, e.status, b.booking_code
         FROM encounters e
         LEFT JOIN bookings b ON e.booking_id = b.id
         WHERE e.id = $1`,
        [encounterId]
      );
      if (encounterResult.rows.length === 0) {
        throw new Error('ENCOUNTER_NOT_FOUND');
      }
      const encounter = encounterResult.rows[0];

      const existingInvoice = await client.query(
        'SELECT id FROM invoices WHERE encounter_id = $1',
        [encounterId]
      );
      if (existingInvoice.rows.length > 0) {
        logger.info(`Invoice already exists for encounter ${encounterId}`);
        return existingInvoice.rows[0];
      }

      const invoiceNumberResult = await client.query(
        'SELECT get_next_invoice_number($1, CURRENT_DATE) as invoice_number',
        [branchId]
      );
      const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;

      let finalAmount = amountDue;
      if (finalAmount === 0 && encounter.booking_id) {
        const bookingResult = await client.query(
          'SELECT dp_amount FROM bookings WHERE id = $1',
          [encounter.booking_id]
        );
        if (bookingResult.rows.length > 0) {
          finalAmount = parseFloat(bookingResult.rows[0].dp_amount) || 0;
        }
      }

      const invoiceResult = await client.query(
        `INSERT INTO invoices (
          id, branch_id, encounter_id, patient_id,
          invoice_number, amount_due, amount_paid, status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3,
          $4, $5, 0, 'UNPAID'
        ) RETURNING *`,
        [
          branchId,
          encounterId,
          encounter.patient_id,
          invoiceNumber,
          finalAmount
        ]
      );
      const invoice = invoiceResult.rows[0];

      await auditService.logEvent({
        branchId,
        userId: null as any,
        eventType: AuditEventType.INVOICE_GENERATED,
        entityType: 'INVOICE',
        entityId: invoice.id,
        description: `Invoice generated for encounter ${encounterId} (${invoiceNumber})`,
        newValues: {
          invoice_number: invoiceNumber,
          amount_due: finalAmount,
          status: 'UNPAID',
        },
      });

      await client.query('COMMIT');
      logger.info(`✅ Invoice ${invoiceNumber} generated for encounter ${encounterId}`);
      return invoice;
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error({ error: error.message, stack: error.stack }, 'Failed to generate invoice');
      throw error;
    } finally {
      client.release();
    }
  }

  async completeEncounterAndGenerateInvoice(
    encounterId: string,
    doctorId: string,
    branchId: string,
    diagnosis?: string,
    treatment?: string,
    notes?: string
  ): Promise<{ encounter: any; invoice: any }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updateResult = await client.query(
        `UPDATE encounters
         SET status = 'COMPLETED',
             completed_at = NOW(),
             diagnosis = COALESCE($1, diagnosis),
             treatment = COALESCE($2, treatment),
             notes = COALESCE($3, notes),
             updated_at = NOW()
         WHERE id = $4 AND doctor_id = $5
         RETURNING *`,
        [diagnosis, treatment, notes, encounterId, doctorId]
      );
      if (updateResult.rows.length === 0) {
        throw new Error('ENCOUNTER_NOT_FOUND_OR_NOT_OWNED');
      }
      const encounter = updateResult.rows[0];

      const invoice = await this.generateInvoiceForEncounter(encounterId, branchId);

      await auditService.logEvent({
        branchId,
        userId: doctorId,
        eventType: AuditEventType.ENCOUNTER_COMPLETED,
        entityType: 'ENCOUNTER',
        entityId: encounterId,
        description: `Encounter ${encounterId} completed by doctor ${doctorId}`,
        newValues: {
          status: 'COMPLETED',
          completed_at: encounter.completed_at,
        },
        oldValues: {
          status: 'IN_PROGRESS',
        },
      });

      await client.query('COMMIT');
      logger.info(`✅ Encounter ${encounterId} completed, invoice ${invoice.id} generated`);
      return { encounter, invoice };
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error({ error: error.message, stack: error.stack }, 'Failed to complete encounter');
      throw error;
    } finally {
      client.release();
    }
  }
}
