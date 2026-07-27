import { Pool } from 'pg';
import { config } from '../src/config';
import { logger } from '../src/utils/logger';
import bcrypt from 'bcryptjs';

async function seedBookingData() {
  const pool = new Pool({ connectionString: config.database.url });

  try {
    logger.info('🚀 Seeding test data...');

    const branchId = '494a607c-d109-4330-a3a9-68f54326f0c7';
    const userIds: Record<string, string> = {};

    // 1. Insert Branch (Upsert)
    await pool.query(
      `INSERT INTO branches (id, name, address) 
       VALUES ($1, 'Cabang A', 'Jakarta') 
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [branchId]
    );
    logger.info('✅ Branch ready');

    // 2. Insert Users (Upsert)
    const users = [
      { username: 'budi_santoso', email: 'patient@test.com', role: 'PATIENT', password: 'Patient123!' },
      { username: 'admin_a', email: 'admin@clinic.com', role: 'ADMIN_BRANCH', password: 'Admin123!' },
      { username: 'dr_bm_a', email: 'dr_bm_a@clinic.com', role: 'DOCTOR', password: 'Doctor123!' }
    ];

    for (const user of users) {
      const hash = await bcrypt.hash(user.password, 10);
      const result = await pool.query(
        `INSERT INTO users (id, branch_id, role, username, email, password_hash, is_active)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true)
         ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id`,
        [branchId, user.role, user.username, user.email, hash]
      );
      userIds[user.username] = result.rows[0].id;
      logger.info(`✅ User ${user.username} ready`);
    }

    // 3. Insert Doctor record
    const doctorUserId = userIds['dr_bm_a'];
    await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number)
       VALUES (gen_random_uuid(), $1, $2, 'drg. Siti Nurhaliza', 'Sp.BM', '12345')
       ON CONFLICT (user_id) DO NOTHING`,
      [branchId, doctorUserId]
    );
    logger.info('✅ Doctor record ready');

    // 4. Insert Doctor Schedules (Upsert)
    for (let day = 1; day <= 6; day++) {
      await pool.query(
        `INSERT INTO doctor_schedules (branch_id, dokter_id, day_of_week, session_start, session_end, max_patients_per_session)
         VALUES ($1, $2, $3, '09:00', '12:00', 4)
         ON CONFLICT (branch_id, dokter_id, day_of_week, session_start) DO NOTHING`,
        [branchId, doctorUserId, day]
      );
      await pool.query(
        `INSERT INTO doctor_schedules (branch_id, dokter_id, day_of_week, session_start, session_end, max_patients_per_session)
         VALUES ($1, $2, $3, '13:00', '16:00', 4)
         ON CONFLICT (branch_id, dokter_id, day_of_week, session_start) DO NOTHING`,
        [branchId, doctorUserId, day]
      );
    }
    logger.info('✅ Doctor schedules ready');

    // 5. Insert Patient record
    const patientUserId = userIds['budi_santoso'];
    await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
       VALUES (gen_random_uuid(), $1, $2, 'Budi Santoso', '08123456789')
       ON CONFLICT (user_id) DO NOTHING`,
      [branchId, patientUserId]
    );
    logger.info('✅ Patient record ready');

    logger.info('🎉 Seed completed successfully!');
  } catch (error) {
    logger.error({ error }, '❌ Seed error');
    throw error;
  } finally {
    await pool.end();
  }
}

seedBookingData().catch(console.error);
