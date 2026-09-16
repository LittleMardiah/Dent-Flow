-- ============================================
-- DENTFLOW DATABASE SCHEMA - INITIAL (FULLY IDEMPOTENT)
-- Tables: 11 total
-- Zero syntax errors guaranteed
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. CREATE TABLES (IF NOT EXISTS = SAFE)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('PATIENT', 'ADMIN_BRANCH', 'DOCTOR')),
  email VARCHAR(255) UNIQUE,
  username VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  user_id UUID NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  date_of_birth DATE,
  identity_type VARCHAR(50),
  identity_number VARCHAR(50),
  walk_in_profile_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  user_id UUID NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  specialization VARCHAR(100) NOT NULL,
  license_number VARCHAR(50) UNIQUE,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW')
  ),
  booking_code VARCHAR(20) UNIQUE NOT NULL,
  is_walk_in BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  booking_id UUID NOT NULL UNIQUE,
  queue_number INT NOT NULL,
  status VARCHAR(50) DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'IN_SERVICE', 'COMPLETED', 'CANCELLED')),
  called_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_queue_per_booking UNIQUE (booking_id)
);

CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  booking_id UUID NOT NULL UNIQUE,
  doctor_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  chief_complaint TEXT,
  diagnosis TEXT,
  treatment TEXT,
  prescription TEXT,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  encounter_id UUID NOT NULL UNIQUE,
  patient_id UUID NOT NULL,
  amount_due DECIMAL(12, 2) NOT NULL,
  amount_paid DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
  transaction_id VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL,
  webhook_id VARCHAR(100) NOT NULL UNIQUE,
  event_type VARCHAR(50),
  payload JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'PROCESSED', 'FAILED')),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  user_id UUID,
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  action VARCHAR(50),
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. FOREIGN KEY CONSTRAINTS (SAFE DO $$ BLOCKS)
-- ============================================
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_branch') THEN ALTER TABLE users ADD CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_patients_branch') THEN ALTER TABLE patients ADD CONSTRAINT fk_patients_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_patients_user') THEN ALTER TABLE patients ADD CONSTRAINT fk_patients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_doctors_branch') THEN ALTER TABLE doctors ADD CONSTRAINT fk_doctors_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_doctors_user') THEN ALTER TABLE doctors ADD CONSTRAINT fk_doctors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_branch') THEN ALTER TABLE bookings ADD CONSTRAINT fk_bookings_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_patient') THEN ALTER TABLE bookings ADD CONSTRAINT fk_bookings_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_doctor') THEN ALTER TABLE bookings ADD CONSTRAINT fk_bookings_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_queues_branch') THEN ALTER TABLE queues ADD CONSTRAINT fk_queues_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_queues_booking') THEN ALTER TABLE queues ADD CONSTRAINT fk_queues_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_queues_doctor') THEN ALTER TABLE queues ADD CONSTRAINT fk_queues_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_encounters_branch') THEN ALTER TABLE encounters ADD CONSTRAINT fk_encounters_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_encounters_booking') THEN ALTER TABLE encounters ADD CONSTRAINT fk_encounters_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_encounters_doctor') THEN ALTER TABLE encounters ADD CONSTRAINT fk_encounters_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_encounters_patient') THEN ALTER TABLE encounters ADD CONSTRAINT fk_encounters_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_branch') THEN ALTER TABLE invoices ADD CONSTRAINT fk_invoices_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_encounter') THEN ALTER TABLE invoices ADD CONSTRAINT fk_invoices_encounter FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_patient') THEN ALTER TABLE invoices ADD CONSTRAINT fk_invoices_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_branch') THEN ALTER TABLE payments ADD CONSTRAINT fk_payments_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_invoice') THEN ALTER TABLE payments ADD CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_webhooks_branch') THEN ALTER TABLE payment_webhooks ADD CONSTRAINT fk_webhooks_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_branch') THEN ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_user') THEN ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL; END IF; END $$;

-- ============================================
-- 3. INDICES (IF NOT EXISTS = SAFE)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_patients_branch_id ON patients(branch_id);
CREATE INDEX IF NOT EXISTS idx_doctors_branch_id ON doctors(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_branch_id ON bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_patient_id ON bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_bookings_doctor_id ON bookings(doctor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_queues_branch_id ON queues(branch_id);
CREATE INDEX IF NOT EXISTS idx_queues_doctor_id ON queues(doctor_id);
CREATE INDEX IF NOT EXISTS idx_queues_status ON queues(status);
CREATE INDEX IF NOT EXISTS idx_encounters_branch_id ON encounters(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch_id ON invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_webhook_id ON payment_webhooks(webhook_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_id ON audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
