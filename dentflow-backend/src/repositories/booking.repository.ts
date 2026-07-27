import { Pool } from 'pg';

export interface Booking {
  id: string;
  patient_id: string;
  doctor_id: string;
  branch_id: string;
  booking_date: string;
  booking_time: string;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  booking_code: string;
  is_walk_in: boolean;
  temp_profile_flag?: boolean;
  queue_number?: number;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBookingPayload {
  patient_id: string;
  doctor_id: string;
  branch_id: string;
  booking_date: string;
  booking_time: string;
  status?: string;
  booking_code: string;
  is_walk_in?: boolean;
  temp_profile_flag?: boolean;
}

export class BookingRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async countByDoctorAndSlot(
    doctorId: string,
    branchId: string,
    bookingDate: string,
    bookingTime: string
  ): Promise<number> {
    const query = `
      SELECT COUNT(*) as total
      FROM bookings
      WHERE doctor_id = $1
        AND branch_id = $2
        AND booking_date = $3
        AND booking_time = $4
        AND status NOT IN ('CANCELLED', 'NO_SHOW')
    `;
    const result = await this.pool.query(query, [doctorId, branchId, bookingDate, bookingTime]);
    return parseInt(result.rows[0]?.total || '0', 10);
  }

  async create(payload: CreateBookingPayload): Promise<Booking> {
    const query = `
      INSERT INTO bookings (
        patient_id, doctor_id, branch_id, booking_date, booking_time,
        status, booking_code, is_walk_in, temp_profile_flag
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [
      payload.patient_id,
      payload.doctor_id,
      payload.branch_id,
      payload.booking_date,
      payload.booking_time,
      payload.status || 'PENDING',
      payload.booking_code,
      payload.is_walk_in || false,
      payload.temp_profile_flag || false,
    ];
    const result = await this.pool.query(query, values);
    return result.rows[0] as Booking;
  }

  async findById(id: string): Promise<Booking | null> {
    const query = `SELECT * FROM bookings WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByBookingCode(code: string): Promise<Booking | null> {
    const query = `SELECT * FROM bookings WHERE booking_code = $1`;
    const result = await this.pool.query(query, [code]);
    return result.rows[0] || null;
  }

  async findByPatient(
    patientId: string,
    filter: { status?: string; branch_id?: string; limit?: number; offset?: number } = {}
  ): Promise<{ bookings: Booking[]; total: number }> {
    let whereClause = 'patient_id = $1';
    const values: (string | number | boolean | null)[] = [patientId];
    let paramCounter = 2;

    if (filter.branch_id) {
      whereClause += ` AND branch_id = $${paramCounter}`;
      values.push(filter.branch_id);
      paramCounter++;
    }
    if (filter.status) {
      whereClause += ` AND status = $${paramCounter}`;
      values.push(filter.status);
      paramCounter++;
    }

    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    const countQuery = `SELECT COUNT(*) as total FROM bookings WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const dataQuery = `
      SELECT * FROM bookings
      WHERE ${whereClause}
      ORDER BY booking_date DESC, booking_time ASC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `;
    values.push(limit, offset);
    const dataResult = await this.pool.query(dataQuery, values);
    return { bookings: dataResult.rows as Booking[], total };
  }

  async updateStatus(id: string, status: string): Promise<Booking | null> {
    const query = `
      UPDATE bookings
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.pool.query(query, [status, id]);
    return result.rows[0] || null;
  }

  async softDelete(id: string): Promise<Booking | null> {
    const query = `
      UPDATE bookings
      SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status NOT IN ('COMPLETED', 'NO_SHOW')
      RETURNING *
    `;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async isOwnedByPatient(bookingId: string, patientId: string): Promise<boolean> {
    const query = `SELECT id FROM bookings WHERE id = $1 AND patient_id = $2`;
    const result = await this.pool.query(query, [bookingId, patientId]);
    return result.rows.length > 0;
  }
}
