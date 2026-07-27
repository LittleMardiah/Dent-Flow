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
