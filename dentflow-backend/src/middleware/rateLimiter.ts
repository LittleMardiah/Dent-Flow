import rateLimit from 'express-rate-limit';

// Rate limiter umum: 100 request per menit per IP
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (req.path === '/webhooks/midtrans') {
      return true;
    }
    return false;
  },
});

// Rate limiter khusus untuk public walk-in: 10 request per menit per IP
export const walkInRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many walk-in requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
