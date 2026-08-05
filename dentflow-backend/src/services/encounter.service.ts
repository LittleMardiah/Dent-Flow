import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { InvoiceGenerationService } from './invoiceGeneration.service';

export interface EncounterData {
  id: string;
  bookingId: string;
  doctorId: string;
  patientId: string;
  branchId: string;
  complaint: string;
  treatment: string;
  diagnosis: string;
  prescription: string;
  notes: string;
  status: 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EncounterService {
  private pool: Pool;
  private invoiceService: InvoiceGenerationService;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
    this.invoiceService = new InvoiceGenerationService();
  }

  private mapEncounter(row: any): EncounterData {
    return {
      id: row.id,
      bookingId: row.booking_id,
      doctorId: row.doctor_id,
      patientId: row.patient_id,
      branchId: row.branch_id,
      complaint: row.complaint,
      treatment: row.treatment,
      diagnosis: row.diagnosis,
      prescription: row.prescription,
      notes: row.notes,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async startEncounter(
    bookingId: string,
    doctorUserId: string,
    branchId: string
  ): Promise<EncounterData> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const bookingResult = await client.query(
        `SELECT b.id, b.patient_id, b.doctor_id, b.status 
         FROM bookings b 
         WHERE b.id = $1`,
        [bookingId]
      );
      if (bookingResult.rows.length === 0) {
        throw new Error('BOOKING_NOT_FOUND');
      }
      const booking = bookingResult.rows[0];

      if (booking.status !== 'CHECKED_IN' && booking.status !== 'PAYMENT_CONFIRMED') {
        throw new Error('BOOKING_NOT_READY_FOR_ENCOUNTER');
      }

      const result = await client.query(
        `INSERT INTO encounters (
          id, branch_id, booking_id, doctor_id, patient_id, status, started_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, 'ONGOING', NOW()
        ) RETURNING *`,
        [branchId, bookingId, booking.doctor_id, booking.patient_id]
      );
      const encounter = result.rows[0];

      await auditService.logEvent({
        branchId,
        userId: doctorUserId,
        eventType: AuditEventType.ENCOUNTER_STARTED,
        entityType: 'ENCOUNTER',
        entityId: encounter.id,
        description: `Encounter started for booking ${bookingId}`,
      });

      await client.query('COMMIT');
      return this.mapEncounter(encounter);
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error starting encounter');
      throw error;
    } finally {
      client.release();
    }
  }

  async recordDiagnosis(
    encounterId: string,
    diagnosis: string,
    icd10Code?: string,
    doctorUserId?: string
  ): Promise<EncounterData> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT * FROM encounters WHERE id = $1`,
        [encounterId]
      );
      if (result.rows.length === 0) {
        throw new Error('ENCOUNTER_NOT_FOUND');
      }
      const encounter = result.rows[0];
      if (encounter.status !== 'ONGOING') {
        throw new Error('ENCOUNTER_NOT_ONGOING');
      }

      const updateResult = await client.query(
        `UPDATE encounters 
         SET diagnosis = $1, icd10_code = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [diagnosis, icd10Code || null, encounterId]
      );
      const updated = updateResult.rows[0];

      await auditService.logEvent({
        branchId: encounter.branch_id,
        userId: doctorUserId || encounter.doctor_id,
        eventType: AuditEventType.ENCOUNTER_DIAGNOSIS_RECORDED,
        entityType: 'ENCOUNTER',
        entityId: encounterId,
        description: 'Diagnosis dicatat',
        oldValues: { diagnosis: encounter.diagnosis, icd10Code: encounter.icd10_code },
        newValues: { diagnosis, icd10Code },
      });

      await client.query('COMMIT');
      return this.mapEncounter(updated);
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error recording diagnosis');
      throw error;
    } finally {
      client.release();
    }
  }

  async recordTreatment(
    encounterId: string,
    treatment: string,
    notes?: string,
    doctorUserId?: string
  ): Promise<EncounterData> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT * FROM encounters WHERE id = $1`,
        [encounterId]
      );
      if (result.rows.length === 0) {
        throw new Error('ENCOUNTER_NOT_FOUND');
      }
      const encounter = result.rows[0];
      if (encounter.status !== 'ONGOING') {
        throw new Error('ENCOUNTER_NOT_ONGOING');
      }

      const updateResult = await client.query(
        `UPDATE encounters 
         SET treatment = $1, notes = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [treatment, notes || null, encounterId]
      );
      const updated = updateResult.rows[0];

      await auditService.logEvent({
        branchId: encounter.branch_id,
        userId: doctorUserId || encounter.doctor_id,
        eventType: AuditEventType.ENCOUNTER_TREATMENT_RECORDED,
        entityType: 'ENCOUNTER',
        entityId: encounterId,
        description: 'Treatment dicatat',
        oldValues: { treatment: encounter.treatment, notes: encounter.notes },
        newValues: { treatment, notes },
      });

      await client.query('COMMIT');
      return this.mapEncounter(updated);
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error recording treatment');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateEncounter(
    encounterId: string,
    data: {
      complaint?: string;
      treatment?: string;
      diagnosis?: string;
      prescription?: string;
      notes?: string;
    },
    doctorUserId: string
  ): Promise<EncounterData> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT * FROM encounters WHERE id = $1`,
        [encounterId]
      );
      if (result.rows.length === 0) {
        throw new Error('ENCOUNTER_NOT_FOUND');
      }
      const encounter = result.rows[0];
      if (encounter.status !== 'ONGOING') {
        throw new Error('ENCOUNTER_NOT_ONGOING');
      }

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (data.complaint !== undefined) {
        updates.push(`complaint = $${idx++}`);
        values.push(data.complaint);
      }
      if (data.treatment !== undefined) {
        updates.push(`treatment = $${idx++}`);
        values.push(data.treatment);
      }
      if (data.diagnosis !== undefined) {
        updates.push(`diagnosis = $${idx++}`);
        values.push(data.diagnosis);
      }
      if (data.prescription !== undefined) {
        updates.push(`prescription = $${idx++}`);
        values.push(data.prescription);
      }
      if (data.notes !== undefined) {
        updates.push(`notes = $${idx++}`);
        values.push(data.notes);
      }

      updates.push(`updated_at = NOW()`);

      if (updates.length === 1) {
        throw new Error('NO_FIELDS_TO_UPDATE');
      }

      const query = `
        UPDATE encounters 
        SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING *
      `;
      values.push(encounterId);

      const updateResult = await client.query(query, values);
      const updated = updateResult.rows[0];

      await auditService.logEvent({
        branchId: encounter.branch_id,
        userId: doctorUserId,
        eventType: AuditEventType.EMR_UPDATED,
        entityType: 'ENCOUNTER',
        entityId: encounterId,
        description: 'EMR updated',
      });

      await client.query('COMMIT');
      return this.mapEncounter(updated);
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error updating encounter');
      throw error;
    } finally {
      client.release();
    }
  }

  async completeEncounter(
    encounterId: string,
    doctorUserId: string,
    treatment?: string
  ): Promise<{ encounter: EncounterData; invoice: any }> {
    console.log("🔍 [EncounterService.completeEncounter] START for encounterId:", encounterId);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT * FROM encounters WHERE id = $1`,
        [encounterId]
      );
      if (result.rows.length === 0) {
        throw new Error('ENCOUNTER_NOT_FOUND');
      }
      const encounter = result.rows[0];
      if (encounter.status !== 'ONGOING') {
        throw new Error('ENCOUNTER_NOT_ONGOING');
      }

      // Get treatment value: use provided or existing
      const finalTreatment = treatment || encounter.treatment;

      const updateResult = await client.query(
        `UPDATE encounters 
         SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [encounterId]
      );
      const updated = updateResult.rows[0];

      await auditService.logEvent({
        branchId: encounter.branch_id,
        userId: doctorUserId,
        eventType: AuditEventType.ENCOUNTER_COMPLETED,
        entityType: 'ENCOUNTER',
        entityId: encounterId,
        description: 'Pemeriksaan selesai',
        oldValues: { status: encounter.status },
        newValues: { status: 'COMPLETED' },
      });

      // Generate invoice with treatment for pricing
      const invoice = await this.invoiceService.generateInvoiceForEncounter(
        encounterId,
        encounter.branch_id,
        0,
        finalTreatment
      );

      await client.query('COMMIT');
      return { encounter: this.mapEncounter(updated), invoice };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error completing encounter');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEncounterById(encounterId: string, userId: string, userRole: string): Promise<EncounterData> {
    const result = await this.pool.query(
      `SELECT e.* FROM encounters e
       LEFT JOIN bookings b ON e.booking_id = b.id
       WHERE e.id = $1`,
      [encounterId]
    );
    if (result.rows.length === 0) {
      throw new Error('ENCOUNTER_NOT_FOUND');
    }
    const encounter = result.rows[0];

    if (userRole === 'PATIENT') {
      const patientCheck = await this.pool.query(
        'SELECT id FROM patients WHERE user_id = $1',
        [userId]
      );
      if (patientCheck.rows.length === 0 || patientCheck.rows[0].id !== encounter.patient_id) {
        throw new Error('ACCESS_DENIED');
      }
    }

    if (userRole === 'DOCTOR' && encounter.doctor_id !== userId) {
      throw new Error('ACCESS_DENIED');
    }

    return this.mapEncounter(encounter);
  }
}
