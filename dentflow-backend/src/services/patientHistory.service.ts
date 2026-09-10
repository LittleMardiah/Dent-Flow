import { Pool } from 'pg';

import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { pool } from '../config/database';

export interface EncounterHistory {
  id: string;
  encounter_date: Date;
  doctor_name: string;
  specialization: string;
  complaint: string;
  treatment: string;
  prescription?: string;
  diagnosis?: string; // only for doctor view
  status: string;
}

export interface PatientHistory {
  encounters: EncounterHistory[];
  invoices: any[];
  bookings: any[];
}

export class PatientHistoryService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async getPatientHistory(
    patientId: string,
    branchId: string,
    includeDiagnosis: boolean = false
  ): Promise<PatientHistory> {
    try {
      const selectFields = [
        'e.id',
        'e.created_at as encounter_date',
        'd.full_name as doctor_name',
        'd.specialization',
        'e.complaint',
        'e.treatment',
        'e.prescription',
        ...(includeDiagnosis ? ['e.diagnosis'] : []),
        'e.status'
      ];

      const encounterQuery = `
        SELECT ${selectFields.join(', ')}
        FROM encounters e
        JOIN doctors d ON e.doctor_id = d.id
        WHERE e.patient_id = $1 
          AND e.branch_id = $2
        ORDER BY e.created_at DESC
      `;
      const encounterResult = await this.pool.query(encounterQuery, [patientId, branchId]);

      const invoiceQuery = `
        SELECT 
          i.id,
          i.invoice_number,
          i.amount_due,
          i.status as payment_status,
          i.created_at as invoice_date
        FROM invoices i
        WHERE i.patient_id = $1 
          AND i.branch_id = $2
        ORDER BY i.created_at DESC
      `;
      const invoiceResult = await this.pool.query(invoiceQuery, [patientId, branchId]);

      const bookingQuery = `
        SELECT 
          b.id,
          b.booking_date,
          b.status,
          b.created_at
        FROM bookings b
        WHERE b.patient_id = $1 
          AND b.branch_id = $2
        ORDER BY b.created_at DESC
      `;
      const bookingResult = await this.pool.query(bookingQuery, [patientId, branchId]);

      return {
        encounters: encounterResult.rows,
        invoices: invoiceResult.rows,
        bookings: bookingResult.rows,
      };
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Error fetching patient history');
      throw new Error('Failed to fetch patient history');
    }
  }

  async getMedicalRecords(patientId: string, branchId: string): Promise<EncounterHistory[]> {
    try {
      const query = `
        SELECT 
          e.id,
          e.created_at as encounter_date,
          d.full_name as doctor_name,
          d.specialization,
          e.complaint,
          e.treatment,
          e.prescription,
          e.diagnosis,
          e.status
        FROM encounters e
        JOIN doctors d ON e.doctor_id = d.id
        WHERE e.patient_id = $1 
          AND e.branch_id = $2
        ORDER BY e.created_at DESC
      `;
      const result = await this.pool.query(query, [patientId, branchId]);
      return result.rows;
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Error fetching medical records');
      throw new Error('Failed to fetch medical records');
    }
  }
}
