import { Pool } from 'pg';
import { config } from '../src/config';
import { PasswordService } from '../src/utils/password.utils';
import { logger } from '../src/utils/logger';

const seedTestUsers = async () => {
  const pool = new Pool({ connectionString: config.database.url });

  try {
    // 1. Cari atau buat branch test
    let branchId = '';
    const branchCheck = await pool.query('SELECT id FROM branches LIMIT 1');
    
    if (branchCheck.rows.length === 0) {
      const branchResult = await pool.query(
        'INSERT INTO branches (name, address, phone) VALUES ($1, $2, $3) RETURNING id',
        ['Cabang Test A', 'Jl. Contoh No. 123, Jakarta', '08123456789']
      );
      branchId = branchResult.rows[0].id;
      logger.info('✅ Test branch created');
    } else {
      branchId = branchCheck.rows[0].id;
      logger.info('✅ Using existing branch');
    }

    // 2. Buat Test Patient
    const patientPass = await PasswordService.hashPassword('Patient123!');
    await pool.query(
      `INSERT INTO users (branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      [branchId, 'PATIENT', 'patient@test.com', 'patient_001', patientPass, true]
    );

    // 3. Buat Test Admin
    const adminPass = await PasswordService.hashPassword('Admin123!');
    await pool.query(
      `INSERT INTO users (branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username) DO NOTHING`,
      [branchId, 'ADMIN_BRANCH', 'admin@test.com', 'admin_001', adminPass, true]
    );

    // 4. Buat Test Doctor
    const doctorPass = await PasswordService.hashPassword('Doctor123!');
    await pool.query(
      `INSERT INTO users (branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username) DO NOTHING`,
      [branchId, 'DOCTOR', 'doctor@test.com', 'dr_general_a', doctorPass, true]
    );

    logger.info('✅ Test users seeded successfully!');
    logger.info('   - Patient: patient@test.com / Patient123!');
    logger.info('   - Admin: admin@test.com / Admin123!');
    logger.info('   - Doctor: doctor@test.com / Doctor123!');

  } catch (error: any) {
    // PERBAIKAN: Pakai object untuk logger.error
    logger.error({ error: error.message, stack: error.stack });
  } finally {
    await pool.end();
  }
};

seedTestUsers();
