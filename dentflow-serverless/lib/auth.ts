import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthUser {
  userId: string;
  branchId: string;
  role: string;
  email?: string;
}

export interface JwtPayload {
  userId: string;
  branchId: string;
  role: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export function verifyJwt(token: string): AuthUser {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('ENV_MISSING: JWT_SECRET belum di-set di Vercel.');
  }
  const decoded = jwt.verify(token, secret) as JwtPayload;
  return {
    userId: decoded.userId,
    branchId: decoded.branchId,
    role: decoded.role,
    email: decoded.email,
  };
}

export function requireRole(user: AuthUser, allowedRoles: string[]): void {
  if (!allowedRoles.includes(user.role)) {
    const err: any = new Error('Forbidden: role tidak diizinkan untuk endpoint ini.');
    err.statusCode = 403;
    throw err;
  }
}

export function unauthorized(message = 'Unauthorized'): any {
  const err: any = new Error(message);
  err.statusCode = 401;
  return err;
}

export function forbidden(message = 'Forbidden'): any {
  const err: any = new Error(message);
  err.statusCode = 403;
  return err;
}

// ============================================================
// AUTH HELPERS EXTENSION (Batch 2 prep — Task 2.2.1)
// ============================================================

export interface LoginUser {
  id: string;
  email: string;
  username: string | null;
  fullName: string;
  role: string;
  branchId: string;
  branchName: string | null;
}

/**
 * Sign access token (24h default). Payload identik dengan Express JwtService.generateToken.
 */
export function signAccessToken(payload: {
  userId: string;
  branchId: string;
  role: string;
  email?: string;
}): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('ENV_MISSING: JWT_SECRET belum di-set.');
  const expiry = process.env.JWT_EXPIRY || '24h';
  return jwt.sign(payload, secret, { expiresIn: expiry } as jwt.SignOptions);
}

/**
 * Sign refresh token (7d default). Payload: { userId }. Sama dengan Express.
 */
export function signRefreshToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('ENV_MISSING: JWT_SECRET belum di-set.');
  const expiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  return jwt.sign({ userId }, secret, { expiresIn: expiry } as jwt.SignOptions);
}

/**
 * Compare plain password vs bcrypt hash.
 */
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Hash password dengan bcrypt (10 rounds, sama dengan Express).
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * Enforce tenant: kalau user request branchId yang beda dari branch user,
 * cek tabel user_branch_access (grant). Parity dengan Express tenantMiddleware.
 *
 * @returns branchId final yang boleh diakses (user.branchId atau granted branch)
 * @throws 403 kalau tidak ada grant
 */
export async function enforceTenant(
  supabase: SupabaseClient,
  user: AuthUser,
  requestedBranchId: string | undefined
): Promise<string> {
  // Kalau gak ada request branch, atau sama dengan user branch → OK
  if (!requestedBranchId || requestedBranchId === user.branchId) {
    return user.branchId;
  }

  // Admin/doctor boleh cross-branch KALAU ada grant di user_branch_access
  if (user.role === 'ADMIN_BRANCH' || user.role === 'DOCTOR') {
    const { data, error } = await supabase
      .from('user_branch_access')
      .select('branch_id')
      .eq('user_id', user.userId)
      .eq('branch_id', requestedBranchId)
      .maybeSingle();

    if (!error && data) {
      return requestedBranchId;
    }
  }

  const err: any = new Error('Forbidden: tidak ada akses ke branch ini.');
  err.statusCode = 403;
  throw err;
}