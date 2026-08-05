import { getErrorMessage } from "../utils/error.util";
import { Router, Request, Response } from 'express';
import { healthService } from '../services/health.service';
import { jobScheduler } from '../jobs/jobScheduler';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const health = await healthService.checkHealth();
    
    // Tambahkan status job scheduler ke response
    const jobStatus = jobScheduler.getStatus();
    
    res.status(200).json({
      ...health,
      jobs: jobStatus,
    });
  } catch (error: unknown) {
    res.status(503).json({ 
      status: 'error', 
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
