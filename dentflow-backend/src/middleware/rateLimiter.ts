import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 100, // maksimal 100 request per IP per menit
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting untuk webhook (Midtrans)
    if (req.path === '/webhooks/midtrans') {
      return true;
    }
    return false;
  },
});
