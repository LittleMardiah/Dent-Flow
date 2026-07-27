-- Migration: Perpanjang kolom invoice_number menjadi VARCHAR(255)
-- Karena format INV-{UUID}-{YYYYMMDD}-{SEQ} bisa melebihi 50 karakter

ALTER TABLE invoices ALTER COLUMN invoice_number TYPE VARCHAR(255);
