/**
 * /api/admin – Benutzerverwaltung, nur für Admins (Issue #26)
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listUsers, deleteUser, updateUserRole, getBackupConfig, updateBackupConfig,
  triggerBackupNow, getAiConfig, updateAiConfig,
} from '../controllers/adminController.js';
import { listReportedLibraryEntries } from '../controllers/libraryController.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/users', listUsers);
router.delete('/users/:id', [param('id').isUUID(), validate], deleteUser);
router.put('/users/:id/role', [
  param('id').isUUID(),
  body('role').isIn(['admin', 'user']).withMessage('Ungültige Rolle'),
  validate,
], updateUserRole);

router.get('/library-reports', listReportedLibraryEntries);

router.get('/backup-config', getBackupConfig);
router.put('/backup-config', [
  body('enabled').isBoolean().withMessage('enabled muss boolean sein'),
  body('schedule').isIn(['daily', 'weekly']).withMessage('Ungültiger Rhythmus'),
  body('retention').isInt({ min: 1, max: 90 }).withMessage('Aufbewahrung 1-90'),
  validate,
], updateBackupConfig);
router.post('/backup-run', triggerBackupNow);

router.get('/ai-config', getAiConfig);
router.put('/ai-config', [
  body('baseUrl').trim().isLength({ max: 300 }).withMessage('Basis-URL max. 300 Zeichen'),
  body('model').trim().isLength({ max: 150 }).withMessage('Modell max. 150 Zeichen'),
  body('timeoutMs').isInt({ min: 1000, max: 120000 }).withMessage('Timeout 1000-120000ms'),
  body('apiKey').optional().isLength({ max: 500 }).withMessage('API-Key max. 500 Zeichen'),
  validate,
], updateAiConfig);

export default router;
