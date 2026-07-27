import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = (err as any).status || 500;
  logger.error({
    message: err.message,
    stack: err.stack,
    status: statusCode,
    path: req.path,
    method: req.method,
    requestId: (req as any).requestId, // <-- FIX: casting ke any
  });

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Terjadi kesalahan server internal',
    error: {
      code: (err as any).code || 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
  });
};
