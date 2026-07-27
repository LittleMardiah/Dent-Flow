import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface PatientHistory {
  encounters: EncounterHistory[];
  invoices: InvoiceHistory[];
  bookings: BookingHistory[];
}

export interface EncounterHistory {
  id: string;
  encounterDate: Date;
  doctorName: string;
  specialization: string;
  complaint: string;
  treatment: string;
  diagnosis?: string;
  icd10Code?: string;
  prescription?: string;
  status: string;
  branchId: string;
}

export interface InvoiceHistory {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  paymentStatus: 'UNPAID' | 'PAID';
  paymentMethod?: string;
  paidAt?: Date;
}

export interface BookingHistory {
  id: string;
  bookingDate: Date;
  doctorName: string;
  specialization: string;
  sessionStart: Date;
  sessionEnd: Date;
  status: string;
  checkInCode: string;
}

export class PatientHistoryService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
  }

  /**
   * Get complete patient history (encounters, invoices, bookings)
   * Filtered by branch_id and sorted by date descending
   */
  async getPatientHistory(patientId: string, branchId: string): Promise<PatientHistory> {
    try {
      // 1. Get encounters (EMR)
      const encountersResult = await this.pool.query(
        `
        SELECT 
          e.id,
          e.created_at as encounter_date,
          u.full_name as doctor_name,
          u.doctor_specialization as specialization,
          e.complaint,
          e.treatment,
          e.diagnosis,
          e.icd10_code,
          e.prescription,
          e.status,
          e.branch_id
        FROM emr e
        JOIN users u ON e.dokter_id = u.id
        WHERE e.pasien_id = $1 AND e.branch_id = $2
          AND e.deleted_at IS NULL
        ORDER BY e.created_at DESC
        `,
        [patientId, branchId]
      );

      // 2. Get invoices
      const invoicesResult = await this.pool.query(
        `
        SELECT 
          i.id,
          i.invoice_number,
          i.created_at as invoice_date,
          i.total_amount,
          i.payment_status,
          i.payment_method,
          i.paid_at
        FROM invoices i
        WHERE i.pasien_id = $1 AND i.branch_id = $2
          AND i.deleted_at IS NULL
        ORDER BY i.created_at DESC
        `,
        [patientId, branchId]
      );

      // 3. Get bookings
      const bookingsResult = await this.pool.query(
        `
        SELECT 
          b.id,
          b.created_at as booking_date,
          u.full_name as doctor_name,
          u.doctor_specialization as specialization,
          b.session_start,
          b.session_end,
          b.status,
          b.check_in_code
        FROM bookings b
        JOIN users u ON b.dokter_id = u.id
        WHERE b.pasien_id = $1 AND b.branch_id = $2
          AND b.deleted_at IS NULL
        ORDER BY b.created_at DESC
        `,
        [patientId, branchId]
      );

      return {
        encounters: encountersResult.rows.map(row => ({
          id: row.id,
          encounterDate: row.encounter_date,
          doctorName: row.doctor_name,
          specialization: row.specialization || 'General',
          complaint: row.complaint,
          treatment: row.treatment,
          diagnosis: row.diagnosis,
          icd10Code: row.icd10_code,
          prescription: row.prescription,
          status: row.status,
          branchId: row.branch_id,
        })),
        invoices: invoicesResult.rows.map(row => ({
          id: row.id,
          invoiceNumber: row.invoice_number,
          invoiceDate: row.invoice_date,
          totalAmount: parseFloat(row.total_amount),
          paymentStatus: row.payment_status,
          paymentMethod: row.payment_method,
          paidAt: row.paid_at,
        })),
        bookings: bookingsResult.rows.map(row => ({
          id: row.id,
          bookingDate: row.booking_date,
          doctorName: row.doctor_name,
          specialization: row.specialization || 'General',
          sessionStart: row.session_start,
          sessionEnd: row.session_end,
          status: row.status,
          checkInCode: row.check_in_code,
        })),
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error fetching patient history');
      throw new Error('Failed to fetch patient history');
    }
  }

  /**
   * Get medical records for a patient (includes diagnosis and ICD-10)
   * Doctor-only access
   */
  async getMedicalRecords(patientId: string, branchId: string): Promise<EncounterHistory[]> {
    try {
      const result = await this.pool.query(
        `
        SELECT 
          e.id,
          e.created_at as encounter_date,
          u.full_name as doctor_name,
          u.doctor_specialization as specialization,
          e.complaint,
          e.treatment,
          e.diagnosis,
          e.icd10_code,
          e.prescription,
          e.status,
          e.branch_id
        FROM emr e
        JOIN users u ON e.dokter_id = u.id
        WHERE e.pasien_id = $1 AND e.branch_id = $2
          AND e.deleted_at IS NULL
        ORDER BY e.created_at DESC
        `,
        [patientId, branchId]
      );

      return result.rows.map(row => ({
        id: row.id,
        encounterDate: row.encounter_date,
        doctorName: row.doctor_name,
        specialization: row.specialization || 'General',
        complaint: row.complaint,
        treatment: row.treatment,
        diagnosis: row.diagnosis,
        icd10Code: row.icd10_code,
        prescription: row.prescription,
        status: row.status,
        branchId: row.branch_id,
      }));
    } catch (error: unknown) {
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error fetching medical records');
      throw new Error('Failed to fetch medical records');
    }
  }
}
