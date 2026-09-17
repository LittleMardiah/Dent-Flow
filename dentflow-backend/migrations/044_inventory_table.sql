-- Migration 044: CREATE TABLE inventory
-- Prasyarat Sub-Task C (api/inventory.ts). Contract: dentflow-web/src/lib/api/inventory.ts
-- TDD legacy branch_id VARCHAR(1) INVALID; live branches.id = UUID (confirmed).

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  quantity_in_stock INTEGER NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  supplier TEXT,
  supplier_contact VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inventory_branch') THEN
    ALTER TABLE inventory ADD CONSTRAINT fk_inventory_branch
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch_deleted ON inventory(branch_id, deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_unique_active_item
  ON inventory(branch_id, item_name) WHERE deleted_at IS NULL;

-- Security hardening (deviation dari 22 tabel existing, lihat TD-2.4.36)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE inventory FROM anon, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE inventory TO authenticated, service_role;

DO $$ BEGIN
  RAISE NOTICE 'Migration 044 applied: inventory table (RLS ON, anon revoked)';
END $$;