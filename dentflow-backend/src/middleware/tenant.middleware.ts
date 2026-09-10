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
      const requestedBranch: string | undefined =
        req.params?.branchId || req.query?.branchId || req.body?.branchId;

      // User mengakses branch lain (bukan branch utamanya)
      if (requestedBranch && requestedBranch !== userBranchId) {
        const granted = await hasBranchGrant(user.userId, requestedBranch);
        if (!granted) {
          logger.warn({
            message: 'Tenant isolation violation',
            userBranchId,
            requestedBranch,
            path: req.path,
            userId: user.userId,
          });
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You do not have access to this branch data',
          });
        }
        (req as any).branchId = requestedBranch;
        return next();
      }

      (req as any).branchId = requestedBranch || userBranchId;
      return next();
    }

    (req as any).branchId = userBranchId;
    next();
  } catch (error) {
    next(error);
  }
};