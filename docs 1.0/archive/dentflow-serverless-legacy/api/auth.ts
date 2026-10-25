import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import {
  comparePassword,
  hashPassword,
  signAccessToken,
  signRefreshToken,
} from '../lib/auth';

// ============================================================
// Consolidated /api/auth — B+C pattern (Task 2.3.2f, FINAL)
// - Approach B: vercel.json rewrites /api/auth/:path* -> /api/auth?path=$1
// - Approach C: Express router di-mount prefix '/api/auth'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// 7 route (sebelumnya 7 file, 1 function):
//   POST /login               (auto-detect role)
//   POST /patient/login       (role PATIENT)
//   POST /patient/register
//   POST /admin/login         (role ADMIN_BRANCH)
//   POST /doctor/login        (role DOCTOR)
//   POST /forgot-password
//   POST /reset-password
// Tanpa auth middleware (PUBLIC endpoints). express.json() body parser.
// Parity Express: dentflow-backend/src/routes/auth.routes.ts
// ============================================================

// Response helpers — shape IDENTIK dengan lib/response (success/error).
const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
const fail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, error: code, message, timestamp: new Date().toISOString() });

const router: Router = express.Router();

// POST-only guard (parity: metode selain POST => 405 METHOD_NOT_ALLOWED).
const postOnly =
  (handler: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      return fail(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }
    return handler(req, res);
  };

// ---------- Shared: role-specific login handler ----------
// Parity Express: authService.login(loginId, password, role)
const roleLogin =
  (role: string, wrongCredMsg: string, missingFieldMsg: string) =>
  async (req: Request, res: Response) => {
    if (!process.env.JWT_SECRET) {
      return fail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
    }

    const body = (req.body || {}) as { email?: string; username?: string; password?: string };
    const { email, username, password } = body;

    if (!password) {
      return fail(res, 'Password wajib diisi', 400, 'VALIDATION_ERROR');
    }
    const loginId = (username || email || '').trim();
    if (!loginId) {
      return fail(res, `${missingFieldMsg} wajib diisi`, 400, 'VALIDATION_ERROR');
    }

    try {
      const supabase = getSupabase();

      const selectCols = 'id, email, username, password_hash, branch_id, role, is_active';

      let user: any = null;

      // Try email
      const { data: byEmail, error: e1 } = await supabase
        .from('users')
        .select(selectCols)
        .eq('email', loginId)
        .eq('role', role)
        .maybeSingle();

      if (e1) {
        return fail(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
      }
      user = byEmail;

      // Fallback username
      if (!user) {
        const { data: byUsername, error: e2 } = await supabase
          .from('users')
          .select(selectCols)
          .eq('username', loginId)
          .eq('role', role)
          .maybeSingle();

        if (e2) {
          return fail(res, `Database error: ${e2.message}`, 500, 'DB_ERROR');
        }
        user = byUsername;
      }

      if (!user) {
        return fail(res, wrongCredMsg, 401, 'INVALID_CREDENTIALS');
      }

      if (!user.is_active) {
        return fail(res, 'Akun tidak aktif', 403, 'ACCOUNT_INACTIVE');
      }

      const match = await comparePassword(password, user.password_hash);
      if (!match) {
        return fail(res, wrongCredMsg, 401, 'INVALID_CREDENTIALS');
      }

      const accessToken = signAccessToken({
        userId: user.id,
        branchId: user.branch_id,
        role: user.role,
        email: user.email,
      });
      const refreshToken = signRefreshToken(user.id);

      return ok(res, {
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
      return fail(res, message, 500, 'INTERNAL_ERROR');
    }
  };

// ---------- POST /login (auto-detect role) ----------
// Parity Express: authService.detectRoleAndLogin(loginId, password)
// TANPA filter role; return redirectUrl + role.
router.all('/login', postOnly(async (req, res) => {
  if (!process.env.JWT_SECRET) {
    return fail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }

  const body = (req.body || {}) as { email?: string; username?: string; password?: string };
  const { email, username, password } = body;

  if (!password) {
    return fail(res, 'Password wajib diisi', 400, 'VALIDATION_ERROR');
  }
  const loginId = (username || email || '').trim();
  if (!loginId) {
    return fail(res, 'Email atau username wajib diisi', 400, 'VALIDATION_ERROR');
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
      return fail(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
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
        return fail(res, `Database error: ${e2.message}`, 500, 'DB_ERROR');
      }
      user = byUsername;
    }

    if (!user) {
      return fail(res, 'Email atau password salah', 401, 'INVALID_CREDENTIALS');
    }
    if (!user.is_active) {
      return fail(res, 'Akun tidak aktif', 403, 'ACCOUNT_INACTIVE');
    }

    const match = await comparePassword(password, user.password_hash);
    if (!match) {
      return fail(res, 'Email atau password salah', 401, 'INVALID_CREDENTIALS');
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

    return ok(res, {
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
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- POST /patient/login ----------
router.all('/patient/login', postOnly(
  roleLogin('PATIENT', 'Email atau password salah', 'Email atau username'),
));

// ---------- POST /admin/login ----------
router.all('/admin/login', postOnly(
  roleLogin('ADMIN_BRANCH', 'Username atau password salah', 'Username atau email'),
));

// ---------- POST /doctor/login ----------
router.all('/doctor/login', postOnly(
  roleLogin('DOCTOR', 'Username atau password salah', 'Username atau email'),
));

// ---------- POST /patient/register ----------
// Parity Express: registerPatient (auth.service.ts)
const RegisterSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
    .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
    .regex(/\d/, 'Password harus mengandung angka'),
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter'),
  phone: z.string().optional(),
});

router.all('/patient/register', postOnly(async (req, res) => {
  if (!process.env.JWT_SECRET) {
    return fail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }

  // Validate
  const parsed = RegisterSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return fail(res, 'Validasi gagal', 400, 'VALIDATION_ERROR');
  }
  const { email, password, fullName, phone } = parsed.data;

  try {
    const supabase = getSupabase();

    // Cek duplicate email
    const { data: existing, error: e1 } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (e1) return fail(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    if (existing) {
      return fail(res, 'Email sudah terdaftar', 409, 'EMAIL_ALREADY_EXISTS');
    }

    // Generate username (parity Express: local part + counter kalau duplikat)
    const baseUsername = email.split('@')[0].slice(0, 100);
    let username = baseUsername;
    let usernameTaken = true;
    let counter = 0;
    while (usernameTaken) {
      const { data: clash, error: eU } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      if (eU) return fail(res, `Database error: ${eU.message}`, 500, 'DB_ERROR');
      if (!clash) {
        usernameTaken = false;
      } else {
        counter++;
        username = `${baseUsername}${counter}`.slice(0, 100);
      }
    }

    // Ambil branch pertama (parity Express: SELECT id FROM branches LIMIT 1)
    const { data: branch, error: eBranch } = await supabase
      .from('branches')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (eBranch || !branch) {
      return fail(res, 'No branch available', 500, 'NO_BRANCH');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert users
    const { data: newUser, error: e2 } = await supabase
      .from('users')
      .insert({
        branch_id: branch.id,
        role: 'PATIENT',
        email,
        username,
        password_hash: passwordHash,
        is_active: true,
      })
      .select('id, email, username, role, branch_id')
      .maybeSingle();
    if (e2 || !newUser) {
      return fail(res, `Database error: ${e2?.message || 'insert failed'}`, 500, 'DB_ERROR');
    }

    // Insert patients (compensating rollback kalau gagal)
    const { error: e3 } = await supabase
      .from('patients')
      .insert({
        user_id: newUser.id,
        branch_id: branch.id,
        full_name: fullName,
        phone: phone || null,
      });
    if (e3) {
      // Compensate: hapus user yang baru dibuat
      await supabase.from('users').delete().eq('id', newUser.id);
      return fail(res, `Database error: ${e3.message}`, 500, 'DB_ERROR');
    }

    // Audit log USER_REGISTERED (best-effort, jangan block register kalau gagal)
    try {
      await supabase.from('audit_logs').insert({
        branch_id: branch.id,
        user_id: newUser.id,
        event_type: 'USER_REGISTERED',
        entity_type: 'USER',
        entity_id: newUser.id,
        action: 'CREATE',
        description: `Patient registered: ${email}`,
      });
    } catch { /* skip */ }

    // Sign tokens (payload parity Express JwtService.generateToken)
    const token = signAccessToken({
      userId: newUser.id,
      branchId: newUser.branch_id,
      role: newUser.role,
      email: newUser.email,
    });
    const refreshToken = signRefreshToken(newUser.id);

    return ok(res, {
      userId: newUser.id,
      username: newUser.username,
      token,
      refreshToken,
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- POST /forgot-password ----------
// Parity Express: authService.forgotPassword
router.all('/forgot-password', postOnly(async (req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }

  const body = (req.body || {}) as { email?: string };
  const email = (body.email || '').trim().toLowerCase();
  if (!email) {
    return fail(res, 'Email wajib diisi', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      return ok(res, { message: 'Jika email terdaftar, link reset akan dikirim.' });
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
      return fail(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    }

    // MOCK email sending
    console.log(`[MOCK EMAIL] Reset token untuk ${email}: ${token}`);

    const payload: any = {
      message: 'Jika email terdaftar, link reset akan dikirim.',
    };
    if (process.env.NODE_ENV === 'development') {
      payload.devToken = token;
    }

    return ok(res, payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- POST /reset-password ----------
// Parity Express: authService.resetPassword
router.all('/reset-password', postOnly(async (req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }

  const body = (req.body || {}) as { token?: string; newPassword?: string };
  const { token, newPassword } = body;

  if (!token || !newPassword) {
    return fail(res, 'Token dan password baru wajib diisi', 400, 'VALIDATION_ERROR');
  }

  // Password strength (parity Express)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return fail(
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
    if (e1) return fail(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    if (!resetRow) {
      return fail(res, 'Link reset tidak valid atau sudah kadaluarsa', 400, 'INVALID_TOKEN');
    }
    if (resetRow.used) {
      return fail(res, 'Token sudah digunakan', 400, 'TOKEN_USED');
    }
    if (new Date(resetRow.expires_at) < new Date()) {
      return fail(res, 'Token sudah kadaluarsa', 400, 'TOKEN_EXPIRED');
    }

    const passwordHash = await hashPassword(newPassword);

    const { error: e2 } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', resetRow.user_id);
    if (e2) return fail(res, `Database error: ${e2.message}`, 500, 'DB_ERROR');

    await supabase.from('reset_tokens').update({ used: true }).eq('id', resetRow.id);

    return ok(res, { message: 'Password berhasil direset' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- 404 fallback domain auth ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain auth.', 404, 'NOT_FOUND');
});

// ============================================================
// Vercel handler: mount router di prefix '/api/auth'
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix '/api/auth' match semua sub-path. Safeguard: kalau runtime strip
  // URL jadi destination saja (/api/auth) dan suffix masuk ?path=, rekonstruksi.
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/api/auth/${suffix}`;
    }
  }
  return app(r, res as any);
}
