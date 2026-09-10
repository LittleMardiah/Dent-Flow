import { getErrorMessage, getErrorStack } from "../utils/error.util";
﻿import bcrypt from 'bcryptjs';
import { logger } from './logger';

export class PasswordService {
  private static readonly SALT_ROUNDS = 10;

  static async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
      return await bcrypt.hash(password, salt);
    } catch (error: unknown) {
      // PERBAIKAN: Pakai object untuk logger.error
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) });
      throw error;
    }
  }

  static async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error: unknown) {
      // PERBAIKAN: Pakai object untuk logger.error
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) });
      return false;
    }
  }

  static validatePasswordStrength(password: string): boolean {
    // Minimum 8 chars, at least 1 uppercase, 1 lowercase, 1 number
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return regex.test(password);
  }
}
