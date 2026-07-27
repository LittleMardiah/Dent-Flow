-- Tambahkan kolom invoice_number dan booking_id ke tabel invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS booking_id UUID;
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
