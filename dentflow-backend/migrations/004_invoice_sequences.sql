-- ============================================================
-- MIGRATION 004: Invoice Sequences (Atomic Invoice Number)
-- Membuat tabel dan fungsi untuk menghasilkan nomor invoice unik
-- ============================================================

-- 1. Tabel invoice_sequences
CREATE TABLE IF NOT EXISTS invoice_sequences (
    id SERIAL PRIMARY KEY,
    branch_id UUID NOT NULL,
    sequence_date DATE NOT NULL,
    current_sequence INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(branch_id, sequence_date)
);

-- 2. Fungsi untuk menghasilkan nomor invoice atomic
CREATE OR REPLACE FUNCTION get_next_invoice_number(
    p_branch_id UUID,
    p_sequence_date DATE DEFAULT CURRENT_DATE
) RETURNS VARCHAR AS $$
DECLARE
    v_sequence INT;
BEGIN
    INSERT INTO invoice_sequences (branch_id, sequence_date, current_sequence)
    VALUES (p_branch_id, p_sequence_date, 1)
    ON CONFLICT (branch_id, sequence_date)
    DO UPDATE SET current_sequence = invoice_sequences.current_sequence + 1
    RETURNING current_sequence INTO v_sequence;
    
    RETURN 'INV-' || p_branch_id::text || '-' || TO_CHAR(p_sequence_date, 'YYYYMMDD') || '-' || LPAD(v_sequence::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Index untuk performa (opsional)
CREATE INDEX IF NOT EXISTS idx_invoice_sequences_branch_date ON invoice_sequences(branch_id, sequence_date);
