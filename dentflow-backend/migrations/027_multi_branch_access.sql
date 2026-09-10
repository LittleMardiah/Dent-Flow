-- ============================================
-- MIGRATION 027: Multi-Branch Access
-- Grant user akses tambahan ke branch lain
-- (dipakai tenant.middleware.ts untuk tenant isolation)
-- ============================================

CREATE TABLE IF NOT EXISTS user_branch_access (
  user_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_branch_access_branch_id ON user_branch_access(branch_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_branch_access_user') THEN
    ALTER TABLE user_branch_access ADD CONSTRAINT fk_user_branch_access_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_branch_access_branch') THEN
    ALTER TABLE user_branch_access ADD CONSTRAINT fk_user_branch_access_branch
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
  END IF;
END $$;