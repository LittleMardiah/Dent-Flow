#!/bin/bash
set -e

echo "========================================="
echo " DEBUG MIDDLEWARE CREATION"
echo "========================================="

# Backup authMiddleware
cp src/middleware/authMiddleware.ts src/middleware/authMiddleware.ts.bak

# Inject debug log + stack trace di roleMiddleware
cat > src/middleware/authMiddleware.ts << 'MIDDLEWARE_EOF'
import { Request, Response, NextFunction } from 'express';
import { JwtService, TokenPayload } from '../utils/jwt.utils';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      requestId?: string;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }

    const token = authHeader.substring(7);
    const payload = JwtService.verifyToken(token);
    req.user = payload;
    console.log('🔐 Auth success - user:', { userId: payload.userId, role: payload.role, branchId: payload.branchId });
    next();
  } catch (error: any) {
    logger.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

export const roleMiddleware = (allowedRoles: string[]) => {
  // 🔍 DEBUG: Log creation time with stack trace
  console.log('🔍 [CREATE] roleMiddleware called with allowedRoles:', allowedRoles);
  console.trace('🔍 [CREATE] roleMiddleware stack trace:');

  return (req: Request, res: Response, next: NextFunction) => {
    console.log('🛡️ [EXEC] roleMiddleware path:', req.path, 'user.role:', req.user?.role, 'allowedRoles (exec):', allowedRoles);
    console.log("🔍 [EXEC] DEBUG: allowedRoles:", allowedRoles, "user.role:", req.user?.role, "path:", req.path);

    if (!req.user || !allowedRoles.includes(req.user.role)) {
      console.log('🛡️ Role check FAILED - user:', req.user, 'allowed:', allowedRoles);
      return res.status(403).json({ 
        success: false, 
        message: 'Forbidden: Insufficient permissions' 
      });
    }
    console.log('🛡️ Role check PASSED - user:', req.user.role, 'allowed:', allowedRoles);
    next();
  };
};
MIDDLEWARE_EOF

echo "✅ Debug log + trace added to roleMiddleware"

echo ""
echo "========================================="
echo " RUNNING INTEGRATION TEST"
echo "========================================="
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

# Restore original middleware
mv src/middleware/authMiddleware.ts.bak src/middleware/authMiddleware.ts
echo "✅ Restored original authMiddleware"
