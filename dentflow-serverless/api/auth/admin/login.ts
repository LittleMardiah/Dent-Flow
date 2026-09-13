import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../../lib/supabase';
import { success, error } from '../../../lib/response';
import {
  comparePassword,
  signAccessToken,
  signRefreshToken,
} from '../../../lib/auth';

/**
 * POST /api/auth/admin/login
 * Body: { username?, email?, password }  (username preferred, email accepted)
 * Parity Express: /auth/admin/login (dentflow-backend/src/routes/auth.routes.ts)
 *                  -> authService.login(username, password, 'ADMIN_BRANCH')
 * Express login query: WHERE (email = $1 OR username = $1) AND role = $2
 * Response shape: { success, data: { user, token, refreshToken } }
 * user shape (parity Express): { id, email, username, role, branchId }
 *
 * NOTE: users table TIDAK punya kolom full_name (ada di tabel doctors) — jangan
 * select kolom itu -> DB_ERROR. Login admin pakai loginId: email fallback username
 * (identik dengan Express dan pola patient login task 2.2.2).
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

  const body = (req.body || {}) as {
    email?: string;
    username?: string;
    password?: string;
  };
  const { email, username, password } = body;

  if (!password) {
    return error(res, 'Password wajib diisi', 400, 'VALIDATION_ERROR');
  }
  const loginId = (username || email || '').trim();
  if (!loginId) {
    return error(res, 'Username atau email wajib diisi', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    const selectCols = 'id, email, username, password_hash, branch_id, role, is_active';

    let user: any = null;

    const { data: byEmail, error: e1 } = await supabase
      .from('users')
      .select(selectCols)
      .eq('email', loginId)
      .eq('role', 'ADMIN_BRANCH')
      .maybeSingle();

    if (e1) {
      return error(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    }
    user = byEmail;

    if (!user) {
      const { data: byUsername, error: e2 } = await supabase
        .from('users')
        .select(selectCols)
        .eq('username', loginId)
        .eq('role', 'ADMIN_BRANCH')
        .maybeSingle();

      if (e2) {
        return error(res, `Database error: ${e2.message}`, 500, 'DB_ERROR');
      }
      user = byUsername;
    }

    if (!user) {
      return error(res, 'Username atau password salah', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.is_active) {
      return error(res, 'Akun tidak aktif', 403, 'ACCOUNT_INACTIVE');
    }

    const match = await comparePassword(password, user.password_hash);
    if (!match) {
      return error(res, 'Username atau password salah', 401, 'INVALID_CREDENTIALS');
    }

    const accessToken = signAccessToken({
      userId: user.id,
      branchId: user.branch_id,
      role: user.role,
      email: user.email,
    });
    const refreshToken = signRefreshToken(user.id);

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
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return error(res, message, 500, 'INTERNAL_ERROR');
  }
}