import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getSupabase } from '../../lib/supabase';
import { success, error } from '../../lib/response';

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Parity Express: authService.forgotPassword
 *
 * Response: { success, message, devToken? }
 *  - devToken di-return kalau NODE_ENV === 'development' (parity Express)
 *  - Di production, email harusnya dikirim (saat ini di-mock/log)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return error(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }

  const body = (req.body || {}) as { email?: string };
  const email = (body.email || '').trim().toLowerCase();
  if (!email) {
    return error(res, 'Email wajib diisi', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      return success(res, { message: 'Jika email terdaftar, link reset akan dikirim.' });
    }

    // Generate token (random hex 64 chars)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const { error: e1 } = await supabase.from('reset_tokens').insert({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
      used: false,
    });
    if (e1) {
      return error(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    }

    // MOCK email sending
    console.log(`[MOCK EMAIL] Reset token untuk ${email}: ${token}`);

    const payload: any = {
      message: 'Jika email terdaftar, link reset akan dikirim.',
    };
    if (process.env.NODE_ENV === 'development') {
      payload.devToken = token;
    }

    return success(res, payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return error(res, message, 500, 'INTERNAL_ERROR');
  }
}
