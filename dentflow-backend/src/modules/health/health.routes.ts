import { Router } from 'express';

const router = Router();

// Health check endpoint yang lebih lengkap (nanti diisi)
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
