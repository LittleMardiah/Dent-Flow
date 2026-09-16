import { Router } from 'express';

const router = Router();

// Placeholder untuk register
router.post('/register', (req, res) => {
  res.status(201).json({ message: 'Register endpoint - coming soon!' });
});

// Placeholder untuk login
router.post('/login', (req, res) => {
  res.status(200).json({ message: 'Login endpoint - coming soon!' });
});

export default router;
