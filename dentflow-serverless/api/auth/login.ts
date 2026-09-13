import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../lib/supabase';
import { success, error } from '../../lib/response';
import {
  comparePassword,
  signAccessToken,
  signRefreshToken,
} from '../../lib/auth';

/**
 * POST /api/auth/login
 * Body: { email?, username?, password }
 * Login ID = username || email
 *
 * Parity Express: /auth/login (dentflow-backend/src/routes/auth.routes.ts)
 *                  -> authService.detectRoleAndLogin(loginId, password)
 * Behavior: deteksi role (PATIENT/ADMIN_BRANCH/DOCTOR) dari user yang match,
 *           TANPA filter role (pola auto-detect Express), return user + token +
 *           refreshToken + role + redirectUrl.
 *
 * Response shape: { success, data: { user, token, refreshToken, role, redirectUrl } }
 * (identik Express: data di-wrap supaya frontend bisa baca seperti API lama)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return error(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }
  if (!process.env.JWT_SECRET) {
    return error(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }

  const body = (req.body || {}) as { email?: string; username?: string; password?: string };
  const { email, username, password } = body;

  if (!password) {
    return error(res, 'Password wajib diisi', 400, 'VALIDATION_ERROR');
  }
  const loginId = (username || email || '').trim();
  if (!loginId) {
    return error(res, 'Email atau username wajib diisi', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    // Select hanya kolom yang Express pakai. Auto-detect: TANPA filter role.
    // Query by email dulu, fallback username (2 query biar aman dari .or() injection).
    const selectCols = 'id, email, username, role, branch_id, password_hash, is_active';

    let user: any = null;

    // Try email
    const { data: byEmail, error: e1 } = await supabase
      .from('users')
      .select(selectCols)
      .eq('email', loginId)
      .maybeSingle();

    if (e1) {
      return error(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    }
    user = byEmail;

    // Fallback username
    if (!user) {
      const { data: byUsername, error: e2 } = await supabase
        .from('users')
        .select(selectCols)
        .eq('username', loginId)
        .maybeSingle();

      if (e2) {
        return error(res, `Database error: ${e2.message}`, 500, 'DB_ERROR');
      }
      user = byUsername;
    }

    if (!user) {
      return error(res, 'Email atau password salah', 401, 'INVALID_CREDENTIALS');
    }
    if (!user.is_active) {
      return error(res, 'Akun tidak aktif', 403, 'ACCOUNT_INACTIVE');
    }

    const match = await comparePassword(password, user.password_hash);
    if (!match) {
      return error(res, 'Email atau password salah', 401, 'INVALID_CREDENTIALS');
    }

    const accessToken = signAccessToken({
      userId: user.id,
      branchId: user.branch_id,
      role: user.role,
      email: user.email,
    });
    const refreshToken = signRefreshToken(user.id);

    // redirectUrl parity Express detectRoleAndLogin:
    // ADMIN_BRANCH -> /admin/queue, DOCTOR -> /doctor/queue, else -> /patient/dashboard
    const redirectUrl =
      user.role === 'ADMIN_BRANCH' ? '/admin/queue'
      : user.role === 'DOCTOR' ? '/doctor/queue'
      : '/patient/dashboard';

    return success(res, {
      user: {
        id: user.id,
        email: user.email,
        username: user.username ?? null,
        role: user.role,
        branchId: user.branch_id,
      },
      token: accessToken,
      refreshToken,
      role: user.role,
      redirectUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return error(res, message, 500, 'INTERNAL_ERROR');
  }
}