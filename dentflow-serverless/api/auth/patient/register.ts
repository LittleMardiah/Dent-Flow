import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getSupabase } from '../../../lib/supabase';
import { success, error } from '../../../lib/response';
import {
  hashPassword,
  signAccessToken,
  signRefreshToken,
} from '../../../lib/auth';

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

/**
 * POST /api/auth/patient/register
 * Parity Express: registerPatient (auth.service.ts:17)
 *
 * Flow:
 *  1. Zod validate (parity PatientRegisterSchema)
 *  2. Cek duplicate email
 *  3. Generate username dari email -> kalau sudah ada, append counter
 *     (parity Express: user, user1, user2, ...)
 *  4. Ambil branch pertama (parity: SELECT id FROM branches LIMIT 1)
 *  5. Insert users (role PATIENT)
 *  6. Insert patients (user_id FK)
 *     -> jika gagal, kompensasi: delete users (rollback manual)
 *  7. Audit log USER_REGISTERED
 *  8. Sign access + refresh token
 *  9. Response: { userId, username, token, refreshToken } status 201
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

  // Validate
  const parsed = RegisterSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return error(res, 'Validasi gagal', 400, 'VALIDATION_ERROR');
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
    if (e1) return error(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    if (existing) {
      return error(res, 'Email sudah terdaftar', 409, 'EMAIL_ALREADY_EXISTS');
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
      if (eU) return error(res, `Database error: ${eU.message}`, 500, 'DB_ERROR');
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
      return error(res, 'No branch available', 500, 'NO_BRANCH');
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
      return error(res, `Database error: ${e2?.message || 'insert failed'}`, 500, 'DB_ERROR');
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
      return error(res, `Database error: ${e3.message}`, 500, 'DB_ERROR');
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

    return success(res, {
      userId: newUser.id,
      username: newUser.username,
      token,
      refreshToken,
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return error(res, message, 500, 'INTERNAL_ERROR');
  }
}