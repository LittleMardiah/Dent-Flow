-- ============================================
-- SEED TEST USERS (IDEMPOTENT)
-- ============================================

-- Insert test branch (skip if exists)
INSERT INTO branches (id, name, address, phone, is_active)
VALUES (gen_random_uuid(), 'Cabang Test A', 'Jl. Contoh No. 123, Jakarta', '08123456789', true)
ON CONFLICT DO NOTHING;

-- Insert test users (skip if exists)
DO $$
DECLARE
    v_branch_id UUID;
BEGIN
    -- Get branch ID
    SELECT id INTO v_branch_id FROM branches WHERE name = 'Cabang Test A' LIMIT 1;
    
    -- Insert test patient
    INSERT INTO users (branch_id, role, email, username, password_hash, is_active)
    VALUES (
        v_branch_id,
        'PATIENT',
        'patient@test.com',
        'patient_001',
        crypt('Patient123!', gen_salt('bf', 10)),
        true
    )
    ON CONFLICT (email) DO NOTHING;

    -- Insert test admin
    INSERT INTO users (branch_id, role, email, username, password_hash, is_active)
    VALUES (
        v_branch_id,
        'ADMIN_BRANCH',
        'admin@test.com',
        'admin_001',
        crypt('Admin123!', gen_salt('bf', 10)),
        true
    )
    ON CONFLICT (username) DO NOTHING;

    -- Insert test doctor
    INSERT INTO users (branch_id, role, email, username, password_hash, is_active)
    VALUES (
        v_branch_id,
        'DOCTOR',
        'doctor@test.com',
        'dr_general_a',
        crypt('Doctor123!', gen_salt('bf', 10)),
        true
    )
    ON CONFLICT (username) DO NOTHING;

    RAISE NOTICE '✅ Test users seeded successfully!';
    RAISE NOTICE '   - Patient: patient@test.com / Patient123!';
    RAISE NOTICE '   - Admin: admin@test.com / Admin123!';
    RAISE NOTICE '   - Doctor: doctor@test.com / Doctor123!';
END $$;
