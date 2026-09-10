import { pool } from '../../src/config/database';
import { auditService } from '../../src/services/audit.service';
import { AuditEventType } from '../../src/models/audit.model';
import { v4 as uuidv4 } from 'uuid';

describe('Audit Trail Immutability Integration Tests', () => {
  let testBranchId: string;
  let persistedLogId: string;
  let persistedDescription: string;

  beforeAll(async () => {
    testBranchId = uuidv4();
    await pool.query(
      `INSERT INTO branches (id, name, address) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [testBranchId, 'Immutable Audit Branch', 'Jl. Immutable Test']
    );
  });

  afterAll(async () => {
    // Audit logs & branch bersifat append-only (immutable) — data sengaja
    // dibiarkan sebagai jejak audit yang tidak bisa diubah/dihapus.
    await pool.end();
  });

  it('should INSERT an audit log via direct SQL (success)', async () => {
    const res = await pool.query(
      `INSERT INTO audit_logs (branch_id, event_type, action, description, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING id, description`,
      [testBranchId, AuditEventType.SYSTEM_HEALTH_CHECK, 'IMMUTABILITY_TEST', 'immutability baseline insert']
    );
    expect(res.rows[0].id).toBeDefined();
    expect(res.rows[0].description).toBe('immutability baseline insert');
    persistedLogId = res.rows[0].id;
    persistedDescription = res.rows[0].description;
  });

  it('should REJECT direct SQL UPDATE on audit_logs (RAISE EXCEPTION)', async () => {
    await expect(
      pool.query(`UPDATE audit_logs SET description = 'HACKED' WHERE id = $1`, [persistedLogId])
    ).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/);
  });

  it('should REJECT direct SQL DELETE on audit_logs (RAISE EXCEPTION)', async () => {
    await expect(
      pool.query(`DELETE FROM audit_logs WHERE id = $1`, [persistedLogId])
    ).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/);
  });

  it('should log an audit event via AuditService.logEvent (success)', async () => {
    await auditService.logEvent({
      branchId: testBranchId,
      eventType: AuditEventType.USER_LOGIN,
      description: 'service logEvent immutability test',
    });

    const res = await pool.query(
      `SELECT * FROM audit_logs
       WHERE branch_id = $1 AND event_type = $2
       ORDER BY created_at DESC LIMIT 1`,
      [testBranchId, AuditEventType.USER_LOGIN]
    );
    expect(res.rows[0]).toBeDefined();
    expect(res.rows[0].event_type).toBe(AuditEventType.USER_LOGIN);
  });

  it('should NOT expose update/delete methods on AuditService (append-only service)', () => {
    const service = auditService as unknown as Record<string, unknown>;
    expect(service.updateEvent).toBeUndefined();
    expect(service.deleteEvent).toBeUndefined();
    expect(service.updateAuditLog).toBeUndefined();
    expect(service.deleteAuditLog).toBeUndefined();
    expect(typeof service.logEvent).toBe('function');
  });

  it('should define 15+ audit event types in AuditEventType enum', () => {
    const eventTypes = Object.values(AuditEventType).map(String);
    expect(eventTypes.length).toBeGreaterThanOrEqual(15);
  });

  it('should record 15+ distinct critical event types via logEvent', async () => {
    const criticalEventTypes = [
      AuditEventType.USER_LOGIN,
      AuditEventType.USER_LOGOUT,
      AuditEventType.USER_REGISTERED,
      AuditEventType.PASSWORD_RESET,
      AuditEventType.BOOKING_CREATED,
      AuditEventType.BOOKING_CONFIRMED,
      AuditEventType.BOOKING_CANCELLED,
      AuditEventType.CHECK_IN_SUCCESS,
      AuditEventType.ENCOUNTER_STARTED,
      AuditEventType.ENCOUNTER_DIAGNOSIS_RECORDED,
      AuditEventType.ENCOUNTER_COMPLETED,
      AuditEventType.PAYMENT_INITIATED,
      AuditEventType.PAYMENT_CONFIRMED,
      AuditEventType.PAYMENT_FAILED,
      AuditEventType.INVOICE_GENERATED,
      AuditEventType.INVOICE_MARKED_PAID,
      AuditEventType.QUEUE_CALLED,
      AuditEventType.QUEUE_COMPLETED,
      AuditEventType.WALK_IN_ADDED,
      AuditEventType.SYSTEM_HEALTH_CHECK,
    ];

    expect(criticalEventTypes.length).toBeGreaterThanOrEqual(15);

    for (const eventType of criticalEventTypes) {
      await auditService.logEvent({
        branchId: testBranchId,
        eventType,
        description: `immutability coverage: ${eventType}`,
      });
    }

    const res = await pool.query(
      `SELECT DISTINCT event_type FROM audit_logs WHERE branch_id = $1`,
      [testBranchId]
    );
    const recorded = new Set<string>(res.rows.map((r: { event_type: string }) => r.event_type));

    for (const eventType of criticalEventTypes) {
      expect(recorded.has(eventType)).toBe(true);
    }
    expect(recorded.size).toBeGreaterThanOrEqual(15);
  });

  it('should keep audit log immutable (unchanged after attempted UPDATE)', async () => {
    const before = await pool.query(`SELECT description FROM audit_logs WHERE id = $1`, [persistedLogId]);
    expect(before.rows[0].description).toBe(persistedDescription);

    try {
      await pool.query(`UPDATE audit_logs SET description = 'HACKED' WHERE id = $1`, [persistedLogId]);
    } catch {
      // expected: AUDIT_LOG_IMMUTABLE raised by trigger
    }

    const after = await pool.query(`SELECT description FROM audit_logs WHERE id = $1`, [persistedLogId]);
    expect(after.rows[0].description).toBe(persistedDescription);
    expect(after.rows[0].description).not.toBe('HACKED');
  });
});