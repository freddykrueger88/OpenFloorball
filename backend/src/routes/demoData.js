/**
 * demoData Routes – GET/POST/DELETE /api/demo-data (Onboarding-Ausbau)
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getStatus, createDemoData, deleteDemoData } from '../controllers/demoDataController.js';

const router = Router();
router.use(authenticate);

router.get('/', getStatus);
router.post('/', createDemoData);
router.delete('/', deleteDemoData);

export default router;
