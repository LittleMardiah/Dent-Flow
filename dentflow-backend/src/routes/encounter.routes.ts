import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { validateBody } from '../middleware/validation';
import { StartEncounterSchema } from '../middleware/validation/encounter.validation';
import {
  startEncounter,
  updateEncounter,
  completeEncounter,
  getEncounter,
  listEncounters,
  uploadEncounterDocument,
  listEncounterDocuments,
} from '../handlers/encounter.handler';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadSingleDocument = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Ukuran file maksimal 5MB' });
      }
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
    next();
  });
};

router.use(authMiddleware);

router.get('/', roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']), listEncounters);
router.post('/', roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']), validateBody(StartEncounterSchema), startEncounter);
router.put('/:id', roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']), updateEncounter);
router.post('/:id/complete', roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']), completeEncounter);
router.post('/:id/documents', roleMiddleware(['DOCTOR']), uploadSingleDocument, uploadEncounterDocument);
router.get('/:id/documents', roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']), listEncounterDocuments);
router.get('/:id', getEncounter);

export default router;
