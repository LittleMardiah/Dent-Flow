-- ====================================================================
-- MIGRATION 021: Service Pricing Table (TD-PAY-016 (2))
-- ====================================================================
-- Membuat tabel service_pricing sebagai sumber biaya treatment.
-- Digunakan oleh InvoiceGenerationService untuk menghitung amount_due.

CREATE TABLE IF NOT EXISTS service_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data untuk treatment umum
INSERT INTO service_pricing (id, name, code, price, category, is_active) VALUES
    (gen_random_uuid(), 'Scaling / Poles', 'SCALING', 200000, 'Perawatan', true),
    (gen_random_uuid(), 'Filling (Tambal) Amalgam', 'FILLING_AMALGAM', 150000, 'Perawatan', true),
    (gen_random_uuid(), 'Filling (Tambal) Composite', 'FILLING_COMPOSITE', 250000, 'Perawatan', true),
    (gen_random_uuid(), 'Check-up / Konsultasi', 'CHECKUP', 100000, 'Konsultasi', true),
    (gen_random_uuid(), 'Ekstraksi Gigi', 'EXTRACTION', 300000, 'Bedah', true),
    (gen_random_uuid(), 'Root Canal (Saluran Akar)', 'ROOT_CANAL', 500000, 'Perawatan', true),
    (gen_random_uuid(), 'Crown / Mahkota', 'CROWN', 1000000, 'Prostho', true),
    (gen_random_uuid(), 'Bleaching / Pemutihan', 'BLEACHING', 500000, 'Estetika', true),
    (gen_random_uuid(), 'Orthodonti (Kawat Gigi)', 'ORTHO', 1500000, 'Ortodonti', true),
    (gen_random_uuid(), 'Periodontal Treatment', 'PERIO', 350000, 'Periodonsia', true),
    (gen_random_uuid(), 'Bedah Mulut Minor', 'ORAL_SURGERY', 400000, 'Bedah', true),
    (gen_random_uuid(), 'Pemasangan Behel', 'BRACES', 2500000, 'Ortodonti', true)
ON CONFLICT (code) DO UPDATE SET
    price = EXCLUDED.price,
    name = EXCLUDED.name,
    updated_at = CURRENT_TIMESTAMP;

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_service_pricing_code ON service_pricing(code);
CREATE INDEX IF NOT EXISTS idx_service_pricing_name ON service_pricing(name);
