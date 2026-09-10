-- Fix queues table: tambah deleted_at + update status constraint

-- 1. Tambah kolom deleted_at (soft delete) yang dipakai queueManagement.service.ts
ALTER TABLE queues ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- 2. Update status constraint: tambah BEING_CALLED (dipakai queueManagement.service.ts
--    & queue.model.ts). IN_SERVICE tetap dipertahankan agar tidak merusak data lama.
ALTER TABLE queues DROP CONSTRAINT IF EXISTS queues_status_check;
ALTER TABLE queues ADD CONSTRAINT queues_status_check
  CHECK (status::text = ANY (ARRAY[
    'WAITING'::character varying,
    'BEING_CALLED'::character varying,
    'IN_SERVICE'::character varying,
    'COMPLETED'::character varying,
    'CANCELLED'::character varying
  ]::text[]));

-- 3. Index untuk performa filter soft-delete
CREATE INDEX IF NOT EXISTS idx_queues_deleted_at ON queues(deleted_at);