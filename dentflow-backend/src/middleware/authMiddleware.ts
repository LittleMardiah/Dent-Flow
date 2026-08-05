import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../utils/jwt.utils';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        branchId: string;
        role: string;
        email?: string;
      };
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(`🔍 [authMiddleware] CALLED for path: ${req.path}`);
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('🔍 [authMiddleware] No token provided');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = JwtService.verifyToken(token);
    req.user = {
      userId: decoded.userId,
      branchId: decoded.branchId,
      role: decoded.role,
      email: decoded.email,
    };
    console.log(`🔍 [authMiddleware] SUCCESS for user: ${decoded.userId} role: ${decoded.role}`);
    console.log('🔐 Auth success - user:', JSON.stringify(req.user, null, 2));
    next();
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    console.log('🔍 [authMiddleware] FAILED:', message);
    logger.error({ error: message, stack }, 'Auth middleware error');
    res.status(401).json({ error: 'Unauthorized' });
  }
};

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log(`🛡️ [EXEC] roleMiddleware path: ${req.path} user.role: ${req.user?.role} allowedRoles (exec): ${allowedRoles}`);
    console.log(`🔍 [EXEC] DEBUG: allowedRoles: ${allowedRoles} user.role: ${req.user?.role} path: ${req.path}`);
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      console.log(`❌ Role check FAILED - user: ${req.user.role} allowed: ${allowedRoles}`);
      return res.status(403).json({ error: 'Forbidden' });
    }
    console.log(`🛡️ Role check PASSED - user: ${req.user.role} allowed: ${allowedRoles}`);
    next();
  };
};
