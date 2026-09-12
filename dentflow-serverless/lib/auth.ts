import jwt from 'jsonwebtoken';

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