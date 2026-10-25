// ============================================================
// Realtime broadcast helper — Batch 6.3b (Realtime Publisher)
// Helper di lib/ (bukan api/* function) → TIDAK dihitung ke limit
// 12 Vercel functions. Fire-and-forget: broadcast error TIDAK boleh
// menggagalkan request utama (R6).  Payload ping-only, tanpa PII (R8).
// Endpoint: POST {SUPABASE_URL}/realtime/v1/api/broadcast
// Prevent: env absen → no-op. Timeout 2s (AbortController).
// ============================================================

const BROADCAST_TIMEOUT_MS = 2000;

export async function publishBroadcast(
  topic: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Guard: env absen → no-op (tidak boleh throw).
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[realtime] broadcast skipped: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY belum di-set');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BROADCAST_TIMEOUT_MS);

  try {
    const res = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
      signal: controller.signal,
    });

    if (res.status !== 200 && res.status !== 202) {
      console.warn(`[realtime] broadcast failed: HTTP ${res.status}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.warn('[realtime] broadcast failed:', message);
  } finally {
    clearTimeout(timeout);
  }
}