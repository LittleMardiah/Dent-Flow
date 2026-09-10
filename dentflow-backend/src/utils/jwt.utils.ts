import { getErrorMessage, getErrorStack } from "../utils/error.util";
﻿import jwt, { JwtPayload } from 'jsonwebtoken';
import { config } from '../config';
import { logger } from './logger';

export interface TokenPayload extends JwtPayload {
  userId: string;
  branchId: string;
  role: 'PATIENT' | 'ADMIN_BRANCH' | 'DOCTOR';
  email?: string;
}

export class JwtService {
  static generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    try {
      // PERBAIKAN: Pastikan secret adalah string dengan type assertion
      const secret = config.jwt.secret as string;
      return jwt.sign(payload, secret, {
        expiresIn: config.jwt.expiry,
      } as jwt.SignOptions);
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) });
      throw error;
    }
  }

  static generateRefreshToken(userId: string): string {
    try {
      const secret = config.jwt.secret as string;
      return jwt.sign({ userId }, secret, {
        expiresIn: config.jwt.refreshExpiry,
      } as jwt.SignOptions);
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) });
      throw error;
    }
  }

  static verifyToken(token: string): TokenPayload {
    try {
      const secret = config.jwt.secret as string;
      return jwt.verify(token, secret) as TokenPayload;
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) });
      throw new Error('Invalid or expired token');
    }
  }

  static decodeToken(token: string): any {
    return jwt.decode(token);
  }
}
