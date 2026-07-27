import bcrypt from 'bcryptjs';
import { logger } from './logger';

export class PasswordService {
  private static readonly SALT_ROUNDS = 10;

  static async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
      return await bcrypt.hash(password, salt);
    } catch (error: any) {
      // PERBAIKAN: Pakai object untuk logger.error
      logger.error({ error: error.message, stack: error.stack });
      throw error;
    }
  }

  static async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error: any) {
      // PERBAIKAN: Pakai object untuk logger.error
      logger.error({ error: error.message, stack: error.stack });
      return false;
    }
  }

  static validatePasswordStrength(password: string): boolean {
    // Minimum 8 chars, at least 1 uppercase, 1 lowercase, 1 number
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return regex.test(password);
  }
}
