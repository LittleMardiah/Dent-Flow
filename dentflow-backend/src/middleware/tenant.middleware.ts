import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

const hasBranchGrant = async (userId: string, branchId: string): Promise<boolean> => {
  const result = await pool.query(
    'SELECT 1 FROM user_branch_access WHERE user_id = $1 AND branch_id = $2 LIMIT 1',
    [userId, branchId]
  );
  return result.rows.length > 0;
};

export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip for public routes
    if (
      req.path.startsWith('/health') ||
      req.path.startsWith('/webhooks') ||
      req.path.startsWith('/auth')
    ) {
      return next();
    }

    const user = (req as any).user;
    if (!user) {
      return next();
    }

    const userBranchId = user.branchId;

    if (user.role === 'ADMIN_BRANCH' || user.role === 'DOCTOR') {
      let targetBranchId: string | undefined =
        req.params?.branchId ||
        (req.query as any)?.branch_id ||
        (req.query as any)?.branchId ||
        (req.body as any)?.branch_id ||
        (req.body as any)?.branchId;

      // Map legacy branch code (e.g. "A") to UUID to avoid PostgreSQL UUID type errors.
      const LEGACY_BRANCH_MAP: Record<string, string> = {
        A: '494a607c-d109-4330-a3a9-68f54326f0c7',
        B: '88d0b0a4-17f8-46c7-a8dc-8755fe8e8d4f',
        C: '7c1f0000-0000-4000-8000-00000000000c',
      };
      if (targetBranchId && LEGACY_BRANCH_MAP[targetBranchId as string]) {
        targetBranchId = LEGACY_BRANCH_MAP[targetBranchId as string];
      }

      // User mengakses branch lain (bukan branch utamanya)
      if (targetBranchId && targetBranchId !== userBranchId) {
        const granted = await hasBranchGrant(user.userId, targetBranchId);
        if (!granted) {
          logger.warn({
            message: 'Tenant isolation violation',
            userBranchId,
            targetBranchId,
            path: req.path,
            userId: user.userId,
          });
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You do not have access to this branch data',
          });
        }
        (req as any).branchId = targetBranchId;
        return next();
      }

      (req as any).branchId = targetBranchId || userBranchId;
      return next();
    }

    (req as any).branchId = userBranchId;
    next();
  } catch (error) {
    next(error);
  }
};