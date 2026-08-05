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

  /**
   * Get treatment price from service_pricing table
   * Returns price or 0 if not found (with warning log)
   */
  async getTreatmentPrice(treatment: string): Promise<number> {
    if (!treatment) return 0;

    try {
      // Try exact match first
      let result = await this.pool.query(
        'SELECT price FROM service_pricing WHERE name ILIKE $1 AND is_active = true LIMIT 1',
        [treatment]
      );

      // If not found, try partial match
      if (result.rows.length === 0) {
        const keywords = treatment.split(' ').filter(w => w.length > 3);
        if (keywords.length > 0) {
          const searchPattern = keywords.map(k => `%${k}%`).join(' AND ');
          result = await this.pool.query(
            `SELECT price FROM service_pricing 
             WHERE name ILIKE $1 AND is_active = true 
             LIMIT 1`,
            [`%${treatment}%`]
          );
        }
      }

      if (result.rows.length === 0) {
        logger.warn(`⚠️ No pricing found for treatment: "${treatment}", using 0`);
        return 0;
      }

      return parseFloat(result.rows[0].price);
    } catch (error: any) {
      logger.error({ error: error.message }, `Failed to get price for treatment: ${treatment}`);
      return 0;
    }
  }

  async generateInvoiceForEncounter(
    encounterId: string,
    branchId: string,
    amountDue: number = 0,
    treatment?: string
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

      // Check if invoice already exists (from trigger)
      const existingInvoice = await client.query(
        'SELECT * FROM invoices WHERE encounter_id = $1',
        [encounterId]
      );

      // Calculate amount due
      let dpAmount = 0;
      if (encounter.booking_id) {
        const bookingResult = await client.query(
          'SELECT dp_amount FROM bookings WHERE id = $1',
          [encounter.booking_id]
        );
        if (bookingResult.rows.length > 0) {
          dpAmount = parseFloat(bookingResult.rows[0].dp_amount) || 0;
        }
      }

      let treatmentPrice = 0;
      if (treatment) {
        treatmentPrice = await this.getTreatmentPrice(treatment);
      }

      const finalAmount = dpAmount + treatmentPrice;

      // If invoice exists, update it
      if (existingInvoice.rows.length > 0) {
        const invoice = existingInvoice.rows[0];
        await client.query(
          `UPDATE invoices 
           SET amount_due = $1, 
               updated_at = NOW() 
           WHERE id = $2`,
          [finalAmount, invoice.id]
        );

        logger.info(`✅ Invoice ${invoice.invoice_number} updated with amount ${finalAmount} (dp: ${dpAmount}, treatment: ${treatmentPrice})`);
        await client.query('COMMIT');
        return invoice;
      }

      // Generate new invoice number
      const invoiceNumberResult = await client.query(
        'SELECT get_next_invoice_number($1, CURRENT_DATE) as invoice_number',
        [branchId]
      );
      const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;

      const invoiceResult = await client.query(
        `INSERT INTO invoices (
          id, branch_id, encounter_id, patient_id, booking_id,
          invoice_number, amount_due, amount_paid, status
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, 0, 'UNPAID'
        ) RETURNING *`,
        [
          branchId,
          encounterId,
          encounter.patient_id,
          encounter.booking_id || null,
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
        description: `Invoice generated for encounter ${encounterId} (${invoiceNumber}) - amount: ${finalAmount}`,
        newValues: {
          invoice_number: invoiceNumber,
          amount_due: finalAmount,
          status: 'UNPAID',
          dp_amount: dpAmount,
          treatment_price: treatmentPrice,
          treatment: treatment || null,
        },
      });

      await client.query('COMMIT');
      logger.info(`✅ Invoice ${invoiceNumber} generated for encounter ${encounterId} (amount: ${finalAmount})`);
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

      const invoice = await this.generateInvoiceForEncounter(
        encounterId,
        branchId,
        0,
        treatment
      );

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
      logger.info(`✅ Encounter ${encounterId} completed, invoice generated`);
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
