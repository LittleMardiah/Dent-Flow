import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail-soft: jangan throw di module load. Konsumen (useRealtime)
  // harus handle null client.
  console.warn('[supabase] env missing: NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY');
}

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 10 } }, // throttle
      })
    : null;

export type SupabaseClient = NonNullable<typeof supabase>;