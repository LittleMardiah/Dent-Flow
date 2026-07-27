import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { InvoiceGenerationService } from './invoiceGeneration.service';

export interface EncounterData {
  id: string;
  bookingId: string;
  patientId: string;
  doctorId: string;
  branchId: string;
  complaint?: string;
  diagnosis?: string;
  icd10Code?: string;
  treatment?: string;
  prescription?: string;
  notes?: string;
  status: 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  startedAt: Date;
  completedAt?: Date;
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
      patientId: row.patient_id,
      doctorId: row.doctor_id,
      branchId: row.branch_id,
      complaint: row.complaint,
      diagnosis: row.diagnosis,
      icd10Code: row.icd10_code,
      treatment: row.treatment,
      prescription: row.prescription,
      notes: row.notes,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async startEncounter(bookingId: string, doctorUserId: string, branchId: string): Promise<EncounterData> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Ambil booking
      const bookingResult = await client.query(
        `SELECT b.*, b.patient_id, b.doctor_id 
         FROM bookings b
         WHERE b.id = $1 AND b.branch_id = $2`,
        [bookingId, branchId]
      );
      if (bookingResult.rows.length === 0) {
        throw new Error('BOOKING_NOT_FOUND');
      }
      const booking = bookingResult.rows[0];

      if (!['CHECKED_IN', 'PAYMENT_CONFIRMED'].includes(booking.status)) {
        throw new Error('BOOKING_NOT_READY_FOR_ENCOUNTER');
      }

      // 🔥 2. Mapping user ID → doctor record ID
      const doctorResult = await client.query(
        `SELECT id FROM doctors WHERE user_id = $1 AND branch_id = $2`,
        [doctorUserId, branchId]
      );
      if (doctorResult.rows.length === 0) {
        throw new Error('DOCTOR_NOT_FOUND');
      }
      const doctorRecordId = doctorResult.rows[0].id;

      // 3. Validasi: pastikan doctor ini sesuai dengan doctor di booking
      if (doctorRecordId !== booking.doctor_id) {
        throw new Error('DOCTOR_NOT_AUTHORIZED');
      }

      // 4. Cek apakah encounter sudah ada
      const existing = await client.query(
        `SELECT id FROM encounters WHERE booking_id = $1`,
        [bookingId]
      );
      if (existing.rows.length > 0) {
        throw new Error('ENCOUNTER_ALREADY_EXISTS');
      }

      // 5. 🔥 INSERT dengan doctorRecordId (bukan user ID)
      const result = await client.query(
        `INSERT INTO encounters 
         (booking_id, patient_id, doctor_id, branch_id, status, started_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [bookingId, booking.patient_id, doctorRecordId, branchId, 'ONGOING', new Date()]
      );
      const encounter = result.rows[0];

      await auditService.logEvent({
        branchId,
        userId: doctorUserId,
        eventType: AuditEventType.ENCOUNTER_STARTED,
        entityType: 'ENCOUNTER',
        entityId: encounter.id,
        description: 'Pemeriksaan dimulai untuk pasien',
        newValues: { bookingId, doctorRecordId },
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

  // === METHOD LAINNYA (recordDiagnosis, recordTreatment, updateEncounter, completeEncounter, getEncounterById) ===
  // Sama seperti sebelumnya, hanya dengan perubahan parameter doctorId menjadi doctorUserId di beberapa method
  // Untuk efisiensi, kita copy dari versi sebelumnya dengan penyesuaian.


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
        description: 'Pengobatan dicatat',
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
    data: Partial<Pick<EncounterData, 'complaint' | 'diagnosis' | 'icd10Code' | 'treatment' | 'prescription' | 'notes'>>,
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
      if (data.diagnosis !== undefined) {
        updates.push(`diagnosis = $${idx++}`);
        values.push(data.diagnosis);
      }
      if (data.icd10Code !== undefined) {
        updates.push(`icd10_code = $${idx++}`);
        values.push(data.icd10Code);
      }
      if (data.treatment !== undefined) {
        updates.push(`treatment = $${idx++}`);
        values.push(data.treatment);
      }
      if (data.prescription !== undefined) {
        updates.push(`prescription = $${idx++}`);
        values.push(data.prescription);
      }
      if (data.notes !== undefined) {
        updates.push(`notes = $${idx++}`);
        values.push(data.notes);
      }

      if (updates.length === 0) {
        throw new Error('NO_FIELDS_TO_UPDATE');
      }

      updates.push(`updated_at = NOW()`);
      values.push(encounterId);

      const query = `UPDATE encounters SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
      const updateResult = await client.query(query, values);
      const updated = updateResult.rows[0];

      await auditService.logEvent({
        branchId: encounter.branch_id,
        userId: doctorUserId,
        eventType: AuditEventType.EMR_UPDATED,
        entityType: 'ENCOUNTER',
        entityId: encounterId,
        description: 'EMR diperbarui',
        oldValues: { complaint: encounter.complaint, diagnosis: encounter.diagnosis, treatment: encounter.treatment },
        newValues: data,
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

  async completeEncounter(encounterId: string, doctorUserId: string): Promise<{ encounter: EncounterData; invoice: any }> {
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

      const invoice = await this.invoiceService.generateInvoiceForEncounter(
        encounterId,
        encounter.branch_id,
        
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
    try {
      const result = await this.pool.query(
        `SELECT * FROM encounters WHERE id = $1`,
        [encounterId]
      );
      if (result.rows.length === 0) {
        throw new Error('ENCOUNTER_NOT_FOUND');
      }
      const encounter = result.rows[0];

      if (userRole === 'PATIENT' && encounter.patient_id !== userId) {
        throw new Error('ACCESS_DENIED');
      }
      if (userRole === 'DOCTOR' && encounter.doctor_id !== userId) {
        // Untuk doctor, userId di sini adalah user ID, bukan doctor record ID
        // Kita perlu cek mapping
        const doctorCheck = await this.pool.query(
          `SELECT id FROM doctors WHERE user_id = $1`,
          [userId]
        );
        if (doctorCheck.rows.length === 0 || doctorCheck.rows[0].id !== encounter.doctor_id) {
          throw new Error('ACCESS_DENIED');
        }
      }
      if (userRole === 'ADMIN_BRANCH') {
        // Admin bisa lihat semua encounter di branch-nya
        // Kita asumsikan handler sudah filter branch
      }

      return this.mapEncounter(encounter);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error getting encounter');
      throw error;
    }
  }
}
