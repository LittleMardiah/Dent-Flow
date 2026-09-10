import { AuthService } from '../../../src/services/auth.service';
import { Pool } from 'pg';
import { JwtService } from '../../../src/utils/jwt.utils';
import { PasswordService } from '../../../src/utils/password.utils';
import { auditService } from '../../../src/services/audit.service';

jest.mock('pg');
jest.mock('../../../src/utils/jwt.utils');
jest.mock('../../../src/utils/password.utils');
jest.mock('../../../src/services/audit.service');

describe('AuthService', () => {
  let service: AuthService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);

    service = new AuthService();
    (service as any).pool = mockPool;

    jest.clearAllMocks();
  });

  describe('registerPatient', () => {
    const mockEmail = 'test@example.com';
    const mockPassword = 'Password123!';
    const mockFullName = 'Test User';
    const mockPhone = '08123456789';
    const mockBranchId = 'branch-123';

    it('should register patient successfully with existing branch', async () => {
      // Urutan query: BEGIN, email check, username check, INSERT user, INSERT patient, COMMIT
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // email not exists
        .mockResolvedValueOnce({ rows: [] }) // username available
        .mockResolvedValueOnce({ rows: [{ id: 'user-123', username: 'test' }] }) // INSERT user
        .mockResolvedValueOnce({ rows: [] }) // INSERT patient
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (PasswordService.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
      (JwtService.generateToken as jest.Mock).mockReturnValue('mock-token');
      (JwtService.generateRefreshToken as jest.Mock).mockReturnValue('mock-refresh-token');
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.registerPatient(
        mockEmail,
        mockPassword,
        mockFullName,
        mockPhone,
        mockBranchId
      );

      expect(result).toHaveProperty('token', 'mock-token');
      expect(result).toHaveProperty('refreshToken', 'mock-refresh-token');
      expect(result).toHaveProperty('userId', 'user-123');
      expect(result).toHaveProperty('username', 'test');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(auditService.logEvent).toHaveBeenCalledTimes(1);
      expect(mockClient.release).toHaveBeenCalled();
      // Pastikan SELECT branch TIDAK dipanggil (karena branchId diberikan)
      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM branches LIMIT 1'),
        expect.anything()
      );
    });

    it('should register patient with auto-generated branch if none provided', async () => {
      // Urutan query: BEGIN, email, username, SELECT branch (auto), INSERT user, INSERT patient, COMMIT
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // email not exists
        .mockResolvedValueOnce({ rows: [] }) // username available
        .mockResolvedValueOnce({ rows: [{ id: 'auto-branch-456' }] }) // SELECT branch (auto)
        .mockResolvedValueOnce({ rows: [{ id: 'user-123', username: 'test' }] }) // INSERT user
        .mockResolvedValueOnce({ rows: [] }) // INSERT patient
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (PasswordService.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
      (JwtService.generateToken as jest.Mock).mockReturnValue('mock-token');
      (JwtService.generateRefreshToken as jest.Mock).mockReturnValue('mock-refresh-token');
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.registerPatient(
        mockEmail,
        mockPassword,
        mockFullName,
        mockPhone
      );

      expect(result).toHaveProperty('token', 'mock-token');
      expect(result).toHaveProperty('userId', 'user-123');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM branches LIMIT 1')
        // TIDAK ada parameter kedua ([]) karena service panggil client.query(query) tanpa array
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if email already registered', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] }); // email exists

      await expect(service.registerPatient(
        mockEmail,
        mockPassword,
        mockFullName,
        mockPhone,
        mockBranchId
      )).rejects.toThrow('Email already registered');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      // Pastikan SELECT branch TIDAK dipanggil karena sudah error sebelum itu
      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM branches LIMIT 1'),
        expect.anything()
      );
    });

    it('should auto-generate username if conflict', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // email not exists
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }) // username 'test' exists
        .mockResolvedValueOnce({ rows: [] }) // username 'test1' available
        .mockResolvedValueOnce({ rows: [{ id: 'user-123', username: 'test1' }] }) // INSERT user
        .mockResolvedValueOnce({ rows: [] }) // INSERT patient
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (PasswordService.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
      (JwtService.generateToken as jest.Mock).mockReturnValue('mock-token');
      (JwtService.generateRefreshToken as jest.Mock).mockReturnValue('mock-refresh-token');
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.registerPatient(
        mockEmail,
        mockPassword,
        mockFullName,
        mockPhone,
        mockBranchId
      );

      expect(result.username).toBe('test1');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM users WHERE username = $1'),
        ['test1']
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if no branch available', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // email not exists
        .mockResolvedValueOnce({ rows: [] }) // username available
        .mockResolvedValueOnce({ rows: [] }); // no branch

      await expect(service.registerPatient(
        mockEmail,
        mockPassword,
        mockFullName,
        mockPhone
      )).rejects.toThrow('No branch available');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const mockLoginId = 'test@example.com';
    const mockPassword = 'Password123!';
    const mockRole = 'PATIENT';

    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'test',
        password_hash: 'hashed_password',
        branch_id: 'branch-123',
        is_active: true,
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockUser] });

      (PasswordService.comparePassword as jest.Mock).mockResolvedValue(true);
      (JwtService.generateToken as jest.Mock).mockReturnValue('mock-token');
      (JwtService.generateRefreshToken as jest.Mock).mockReturnValue('mock-refresh-token');
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.login(mockLoginId, mockPassword, mockRole);

      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id', 'user-123');
      expect(result.user).toHaveProperty('role', mockRole);
      expect(result).toHaveProperty('token', 'mock-token');
      expect(result).toHaveProperty('refreshToken', 'mock-refresh-token');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] });

      await expect(service.login(mockLoginId, mockPassword, mockRole))
        .rejects.toThrow('Invalid username or password');
    });

    it('should throw error if account is inactive', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'test',
        password_hash: 'hashed_password',
        branch_id: 'branch-123',
        is_active: false,
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockUser] });

      await expect(service.login(mockLoginId, mockPassword, mockRole))
        .rejects.toThrow('Account is inactive');
    });

    it('should throw error if password invalid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'test',
        password_hash: 'hashed_password',
        branch_id: 'branch-123',
        is_active: true,
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockUser] });

      (PasswordService.comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(service.login(mockLoginId, mockPassword, mockRole))
        .rejects.toThrow('Invalid username or password');
    });
  });

  describe('forgotPassword', () => {
    const mockEmail = 'test@example.com';

    it('should return devToken if email exists', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'user-123' }] });

      (JwtService.generateToken as jest.Mock).mockReturnValue('mock-reset-token');
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.forgotPassword(mockEmail);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('devToken', 'mock-reset-token');
      expect(auditService.logEvent).toHaveBeenCalledTimes(1);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return null devToken if email not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.forgotPassword(mockEmail);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('devToken', null);
      expect(auditService.logEvent).not.toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const mockToken = 'valid-token';
    const mockNewPassword = 'NewPassword123!';

    it('should reset password successfully with valid token', async () => {
      const mockPayload = { userId: 'user-123', email: 'test@example.com', role: 'PATIENT' };
      (JwtService.verifyToken as jest.Mock).mockReturnValue(mockPayload);
      (PasswordService.hashPassword as jest.Mock).mockResolvedValue('new_hashed_password');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] });

      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.resetPassword(mockToken, mockNewPassword);

      expect(result).toHaveProperty('message', 'Password berhasil direset.');
      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        ['new_hashed_password', 'user-123']
      );
      expect(auditService.logEvent).toHaveBeenCalledTimes(1);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if token invalid', async () => {
      (JwtService.verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.resetPassword(mockToken, mockNewPassword))
        .rejects.toThrow('Invalid or expired token');

      expect(mockClient.release).not.toHaveBeenCalled();
    });
  });
});
