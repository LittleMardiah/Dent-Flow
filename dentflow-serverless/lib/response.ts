import type { VercelResponse } from '@vercel/node';

export function success<T>(res: VercelResponse, data: T, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

export function error(
  res: VercelResponse,
  message: string,
  status = 400,
  code?: string
) {
  return res.status(status).json({
    success: false,
    error: code || 'ERROR',
    message,
    timestamp: new Date().toISOString(),
  });
}