import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 9999 : 5,
  message: 'Too many requests, please try again later.',
  skip: (_req) => process.env.NODE_ENV === 'test',
});

export const rateLimiter = limiter;
