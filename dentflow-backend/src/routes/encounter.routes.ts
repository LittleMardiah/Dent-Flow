import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { validateBody } from '../middleware/validation';
import { StartEncounterSchema } from '../middleware/validation/encounter.validation';
import {
  startEncounter,
  updateEncounter,
  completeEncounter,
  getEncounter,
} from '../handlers/encounter.handler';

const router = Router();

router.use(authMiddleware);

router.post('/', roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']), validateBody(StartEncounterSchema), startEncounter);
router.put('/:id', roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']), updateEncounter);
router.post('/:id/complete', roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']), completeEncounter);
router.get('/:id', getEncounter);

export default router;
