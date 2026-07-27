import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const tenantMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip for public routes
  if (req.path.startsWith('/health') || 
      req.path.startsWith('/webhooks') || 
      req.path.startsWith('/auth')) {
    return next();
  }

  const user = (req as any).user;
  if (!user) {
    return next();
  }

  const userBranchId = user.branchId;
  (req as any).branchId = userBranchId;

  if (user.role === 'ADMIN_BRANCH' || user.role === 'DOCTOR') {
    const requestedBranch = req.params.branchId || req.query.branchId || req.body.branchId;
    
    if (requestedBranch && requestedBranch !== userBranchId) {
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
  }

  next();
};
