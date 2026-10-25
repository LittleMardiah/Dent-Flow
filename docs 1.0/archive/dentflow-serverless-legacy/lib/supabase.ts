import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('❌ SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY wajib di-set di env');
}

// Service role client (bypass RLS) — untuk server-side operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocket as any,
  },
});

// Factory pattern (MIGRATION_PLAN Batch 3) — return singleton yang sama.
// Backward compat: api/health.ts tetap pakai named export `supabase`.
export function getSupabase() {
  return supabase;
}