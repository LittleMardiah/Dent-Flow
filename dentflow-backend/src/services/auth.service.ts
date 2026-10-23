import { Pool } from 'pg';

import { logger } from '../utils/logger';
import { JwtService } from '../utils/jwt.utils';
import { PasswordService } from '../utils/password.utils';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { pool } from '../config/database';

export class AuthService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async registerPatient(
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    branchId?: string
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        throw new Error('Email already registered');
      }

      let username = email.split('@')[0];
      let usernameExists = true;
      let counter = 0;
      while (usernameExists) {
        const check = await client.query('SELECT id FROM users WHERE username = $1', [username]);
        if (check.rows.length === 0) {
          usernameExists = false;
        } else {
          counter++;
          username = `${email.split('@')[0]}${counter}`;
        }
      }

      let finalBranchId = branchId;
      if (!finalBranchId) {
        const branch = await client.query('SELECT id FROM branches LIMIT 1');
        if (branch.rows.length === 0) {
          throw new Error('No branch available');
        }
        finalBranchId = branch.rows[0].id;
      }

      const passwordHash = await PasswordService.hashPassword(password);

      const userResult = await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
         RETURNING id, username`,
        [finalBranchId, 'PATIENT', email, username, passwordHash]
      );
      const userId = userResult.rows[0].id;
      const createdUsername = userResult.rows[0].username as string;

      await client.query(
        `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
        [finalBranchId, userId, fullName, phone]
      );

      await auditService.logEvent({
        branchId: finalBranchId!, // guaranteed string because we set it or threw
        userId,
        eventType: AuditEventType.USER_REGISTERED,
        entityType: 'USER',
        entityId: userId,
        description: `Patient registered: ${email}`,
      });

      await client.query('COMMIT');

      const token = JwtService.generateToken({
        userId,
        branchId: finalBranchId!,
        role: 'PATIENT',
        email,
      });
      const refreshToken = JwtService.generateRefreshToken(userId);

      logger.info(`✅ Patient registered: ${email} (username: ${createdUsername})`);
      return { token, refreshToken, userId, username: createdUsername };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      logger.error({ error }, 'Registration error:');
      throw error;
    } finally {
      client.release();
    }
  }

  async detectRoleAndLogin(loginId: string, password: string) {
    const client = await this.pool.connect();
    try {
      const userResult = await client.query(
        `SELECT id, email, username, password_hash, branch_id, role, is_active
         FROM users
         WHERE email = $1 OR username = $1`,
        [loginId]
      );
      if (userResult.rows.length === 0) {
        throw new Error('Invalid username or password');
      }
      const user = userResult.rows[0];
      if (!user.is_active) {
        throw new Error('Account is inactive');
      }

      const isPasswordValid = await PasswordService.comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid username or password');
      }

      const role = user.role as 'PATIENT' | 'ADMIN_BRANCH' | 'DOCTOR';
      const token = JwtService.generateToken({
        userId: user.id,
        branchId: user.branch_id,
        role,
        email: user.email,
      });
      const refreshToken = JwtService.generateRefreshToken(user.id);

      await auditService.logEvent({
        branchId: user.branch_id,
        userId: user.id,
        eventType: AuditEventType.USER_LOGIN,
        entityType: 'USER',
        entityId: user.id,
        description: `${role} login: ${user.username || user.email}`,
      });

      logger.info(`✅ ${role} login: ${user.username || user.email}`);

      const redirectUrl =
        role === 'ADMIN_BRANCH' ? '/admin/queue'
        : role === 'DOCTOR' ? '/doctor/queue'
        : '/patient/dashboard';

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role,
          branchId: user.branch_id,
        },
        role,
        redirectUrl,
        token,
        refreshToken,
      };
    } catch (error: unknown) {
      logger.error({ error }, 'Login error:');
      throw error;
    } finally {
      client.release();
    }
  }

  async login(loginId: string, password: string, role: string) {
    const client = await this.pool.connect();
    try {
      const userResult = await client.query(
        `SELECT id, email, username, password_hash, branch_id, is_active 
         FROM users 
         WHERE (email = $1 OR username = $1) AND role = $2`,
        [loginId, role]
      );
      if (userResult.rows.length === 0) {
        throw new Error('Invalid username or password');
      }
      const user = userResult.rows[0];
      if (!user.is_active) {
        throw new Error('Account is inactive');
      }

      const isPasswordValid = await PasswordService.comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid username or password');
      }

      const token = JwtService.generateToken({
        userId: user.id,
        branchId: user.branch_id,
        role: role as 'PATIENT' | 'ADMIN_BRANCH' | 'DOCTOR',
        email: user.email,
      });
      const refreshToken = JwtService.generateRefreshToken(user.id);

      await auditService.logEvent({
        branchId: user.branch_id,
        userId: user.id,
        eventType: AuditEventType.USER_LOGIN,
        entityType: 'USER',
        entityId: user.id,
        description: `${role} login: ${user.username || user.email}`,
      });

      logger.info(`✅ ${role} login: ${user.username || user.email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role,
          branchId: user.branch_id,
        },
        token,
        refreshToken,
      };
    } catch (error: unknown) {
      logger.error({ error }, 'Login error:');
      throw error;
    } finally {
      client.release();
    }
  }

  async forgotPassword(email: string) {
    const client = await this.pool.connect();
    try {
      const userResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      if (userResult.rows.length === 0) {
        return { message: 'Jika email terdaftar, link reset akan dikirim.', devToken: null };
      }

      const token = JwtService.generateToken({
        userId: userResult.rows[0].id,
        branchId: 'system',
        role: 'PATIENT',
        email,
      });
      await auditService.logEvent({
        branchId: 'system',
        userId: userResult.rows[0].id,
        eventType: AuditEventType.PASSWORD_RESET,
        entityType: 'USER',
        entityId: userResult.rows[0].id,
        description: `Password reset requested for: ${email}`,
      });

      return {
        message: 'Jika email terdaftar, link reset akan dikirim.',
        devToken: token,
      };
    } catch (error: unknown) {
      logger.error({ error }, 'Forgot password error:');
      throw error;
    } finally {
      client.release();
    }
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const payload = JwtService.verifyToken(token);
      const userId = payload.userId;
      const hashed = await PasswordService.hashPassword(newPassword);
      const client = await this.pool.connect();
      await client.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [hashed, userId]
      );
      client.release();

      await auditService.logEvent({
        branchId: 'system',
        userId,
        eventType: AuditEventType.PASSWORD_RESET,
        entityType: 'USER',
        entityId: userId,
        description: `Password reset successful for user: ${userId}`,
      });
      return { message: 'Password berhasil direset.' };
    } catch (error: unknown) {
      logger.error({ error }, 'Reset password error:');
      throw new Error('Invalid or expired token');
    }
  }

  async refreshToken(token: string) {
    try {
      const payload = JwtService.verifyToken(token);
      const userId = payload.userId;

      const client = await this.pool.connect();
      try {
        const userResult = await client.query(
          `SELECT id, email, branch_id, role, is_active
           FROM users
           WHERE id = $1`,
          [userId]
        );
        if (userResult.rows.length === 0) {
          throw new Error('Invalid token');
        }
        const user = userResult.rows[0];
        if (!user.is_active) {
          throw new Error('Account is inactive');
        }

        const newToken = JwtService.generateToken({
          userId: user.id,
          branchId: user.branch_id,
          role: user.role as 'PATIENT' | 'ADMIN_BRANCH' | 'DOCTOR',
          email: user.email,
        });
        const newRefreshToken = JwtService.generateRefreshToken(user.id);

        return { token: newToken, refreshToken: newRefreshToken };
      } finally {
        client.release();
      }
    } catch (error: unknown) {
      logger.error({ error }, 'Refresh token error:');
      throw new Error('Invalid or expired token');
    }
  }
}

// Singleton instance
export const authService = new AuthService();
