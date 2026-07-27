import { PasswordService } from '../../src/utils/password.utils';

describe('PasswordService', () => {
  it('should hash a password', async () => {
    const password = 'TestPassword123!';
    const hashed = await PasswordService.hashPassword(password);
    expect(hashed).not.toBe(password);
    expect(hashed.length).toBeGreaterThan(10);
  });

  it('should validate matching password', async () => {
    const password = 'TestPassword123!';
    const hashed = await PasswordService.hashPassword(password);
    const match = await PasswordService.comparePassword(password, hashed);
    expect(match).toBe(true);
  });

  it('should reject non-matching password', async () => {
    const password = 'TestPassword123!';
    const hashed = await PasswordService.hashPassword(password);
    const match = await PasswordService.comparePassword('WrongPassword', hashed);
    expect(match).toBe(false);
  });

  it('should validate password strength', () => {
    expect(PasswordService.validatePasswordStrength('weak')).toBe(false);
    expect(PasswordService.validatePasswordStrength('WeakPassword')).toBe(false);
    expect(PasswordService.validatePasswordStrength('StrongPass123')).toBe(true);
  });

  it('should generate different hashes for same password', async () => {
    const password = 'TestPassword123!';
    const hash1 = await PasswordService.hashPassword(password);
    const hash2 = await PasswordService.hashPassword(password);
    expect(hash1).not.toBe(hash2);
  });
});
