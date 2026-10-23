import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit.service';
import { logger } from '../utils/logger';

/***
 * GET /api/admin/audit-logs?branchId=...&entityType=...&entityId=...&limit=...&offset=...
 * Get audit logs for a branch, optionally filtered by entity
 * Admin-only endpoint
 */
export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = Array.isArray(req.query.branchId) 
      ? req.query.branchId[0] 
      : req.query.branchId;
    const entityType = Array.isArray(req.query.entityType) 
      ? req.query.entityType[0] 
      : req.query.entityType;
    const entityId = Array.isArray(req.query.entityId) 
      ? req.query.entityId[0] 
      : req.query.entityId;
    
    // CAST query params to string safely
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const offset = parseInt(String(req.query.offset || '0'), 10);

    if (!branchId) {
      return res.status(400).json({ success: false, message: 'branchId query parameter is required' });
    }

    let logs;
    if (entityType && entityId) {
      logs = await auditService.getEventsByEntity(entityType as string, entityId as string);
    } else {
      logs = await auditService.getEventsByBranch(branchId as string, limit);
    }

    // Apply pagination manually
    const paginated = logs.slice(offset, offset + limit);

    res.status(200).json({
      success: true,
      data: paginated,
      pagination: {
        total: logs.length,
        limit,
        offset,
        next: offset + limit < logs.length ? offset + limit : null,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error fetching audit logs');
    next(error);
  }
};

const escapeCsvValue = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

/**
 * GET /api/admin/audit-logs/export?branchId=...
 * Export audit logs for a branch as CSV (no pagination).
 */
export const exportAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = Array.isArray(req.query.branchId)
      ? req.query.branchId[0]
      : req.query.branchId;

    if (!branchId) {
      return res.status(400).json({ success: false, message: 'branchId query parameter is required' });
    }

    const logs = await auditService.getEventsByBranch(String(branchId), 10000);

    const header = ['Timestamp', 'User', 'Action', 'Entity', 'Description'];
    const lines = [header.map(escapeCsvValue).join(',')];

    logs.forEach((log) => {
      const entity = log.entity_type
        ? `${log.entity_type}${log.entity_id ? `:${log.entity_id}` : ''}`
        : '';
      const action = log.event_label || log.event_type || log.action || '';
      lines.push(
        [
          log.created_at ? new Date(log.created_at).toISOString() : '',
          log.user_id || 'SYSTEM',
          action,
          entity,
          log.description || '',
        ]
          .map(escapeCsvValue)
          .join(',')
      );
    });

    const csv = lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs-export.csv"');
    return res.status(200).send(csv);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error exporting audit logs');
    return next(error);
  }
};
