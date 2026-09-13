import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../lib/supabase';
import { success, error } from '../../lib/response';
import { hashPassword } from '../../lib/auth';

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 * Parity Express: authService.resetPassword
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return error(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }

  const body = (req.body || {}) as { token?: string; newPassword?: string };
  const { token, newPassword } = body;

  if (!token || !newPassword) {
    return error(res, 'Token dan password baru wajib diisi', 400, 'VALIDATION_ERROR');
  }

  // Password strength (parity Express)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return error(
      res,
      'Password minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka',
      400,
      'WEAK_PASSWORD'
    );
  }

  try {
    const supabase = getSupabase();

    const { data: resetRow, error: e1 } = await supabase
      .from('reset_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', token)
      .maybeSingle();
    if (e1) return error(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    if (!resetRow) {
      return error(res, 'Link reset tidak valid atau sudah kadaluarsa', 400, 'INVALID_TOKEN');
    }
    if (resetRow.used) {
      return error(res, 'Token sudah digunakan', 400, 'TOKEN_USED');
    }
    if (new Date(resetRow.expires_at) < new Date()) {
      return error(res, 'Token sudah kadaluarsa', 400, 'TOKEN_EXPIRED');
    }

    const passwordHash = await hashPassword(newPassword);

    const { error: e2 } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', resetRow.user_id);
    if (e2) return error(res, `Database error: ${e2.message}`, 500, 'DB_ERROR');

    await supabase.from('reset_tokens').update({ used: true }).eq('id', resetRow.id);

    return success(res, { message: 'Password berhasil direset' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return error(res, message, 500, 'INTERNAL_ERROR');
  }
}
