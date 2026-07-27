import { AttendanceReportService } from '../../../src/services/attendanceReport.service';
import { Pool } from 'pg';

jest.mock('pg');

describe('AttendanceReportService', () => {
  let service: AttendanceReportService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    service = new AttendanceReportService();
    (service as any).pool = mockPool;
    jest.clearAllMocks();
  });

  describe('getPatientAttendanceRate', () => {
    it('should return correct attendance statistics', async () => {
      const mockRows = {
        rows: [{
          total_bookings: '10',
          completed: '7',
          no_shows: '2',
          cancellations: '1',
        }],
      };
      mockPool.query = jest.fn().mockResolvedValue(mockRows);

      const result = await service.getPatientAttendanceRate('patient1');
      expect(result.totalBookings).toBe(10);
      expect(result.completed).toBe(7);
      expect(result.noShows).toBe(2);
      expect(result.cancellations).toBe(1);
      expect(result.showRate).toBe(70);
      expect(result.patientId).toBe('patient1');
    });

    it('should return zeros if patient has no bookings', async () => {
      const mockRows = {
        rows: [{
          total_bookings: '0',
          completed: '0',
          no_shows: '0',
          cancellations: '0',
        }],
      };
      mockPool.query = jest.fn().mockResolvedValue(mockRows);

      const result = await service.getPatientAttendanceRate('patient1');
      expect(result.totalBookings).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.noShows).toBe(0);
      expect(result.cancellations).toBe(0);
      expect(result.showRate).toBe(0);
    });
  });

  describe('getNoShowSummary', () => {
    it('should return no-show summary sorted by count descending', async () => {
      const mockRows = {
        rows: [
          { patient_id: 'p1', patient_name: 'John Doe', phone: '08123456789', no_show_count: '5', last_no_show_date: new Date(), total_bookings: '10' },
          { patient_id: 'p2', patient_name: 'Jane Doe', phone: '08123456788', no_show_count: '3', last_no_show_date: new Date(), total_bookings: '8' },
        ],
      };
      mockPool.query = jest.fn().mockResolvedValue(mockRows);

      const result = await service.getNoShowSummary('A', 10);
      expect(result).toHaveLength(2);
      expect(result[0].noShowCount).toBe(5);
      expect(result[1].noShowCount).toBe(3);
    });

    it('should return empty array if no no-shows', async () => {
      const mockRows = { rows: [] };
      mockPool.query = jest.fn().mockResolvedValue(mockRows);

      const result = await service.getNoShowSummary('A', 10);
      expect(result).toEqual([]);
    });
  });
});
