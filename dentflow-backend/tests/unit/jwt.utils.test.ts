import { JwtService } from '../../src/utils/jwt.utils';

describe('JwtService', () => {
  it('should generate a valid JWT token', () => {
    const payload = {
      userId: 'test-user-123',
      branchId: 'test-branch-456',
      role: 'PATIENT' as const,
    };
    const token = JwtService.generateToken(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('should verify a valid token', () => {
    const payload = {
      userId: 'test-user-123',
      branchId: 'test-branch-456',
      role: 'PATIENT' as const,
    };
    const token = JwtService.generateToken(payload);
    const verified = JwtService.verifyToken(token);
    expect(verified.userId).toBe(payload.userId);
    expect(verified.branchId).toBe(payload.branchId);
  });

  it('should throw error for invalid token', () => {
    expect(() => JwtService.verifyToken('invalid.token.here')).toThrow();
  });

  it('should decode token without verification', () => {
    const payload = {
      userId: 'test-user-123',
      branchId: 'test-branch-456',
      role: 'PATIENT' as const,
    };
    const token = JwtService.generateToken(payload);
    const decoded = JwtService.decodeToken(token);
    expect(decoded.userId).toBe(payload.userId);
  });

  it('should generate different refresh tokens', () => {
    const token1 = JwtService.generateRefreshToken('user-1');
    const token2 = JwtService.generateRefreshToken('user-2');
    expect(token1).not.toBe(token2);
  });
});
