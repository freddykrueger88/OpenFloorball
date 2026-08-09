/**
 * /api/formations – Formations-Vorlagen (Issue #46, authentifiziert,
 * nutzer-gebunden statt board-gebunden)
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getFormations, getFormation, createFormation, updateFormation, deleteFormation,
} from '../controllers/formationsController.js';

const router = Router();

router.use(authenticate);

router.get   ('/',    getFormations);
router.get   ('/:id', [param('id').isUUID().withMessage('Ungültige Vorlagen-ID'), validate], getFormation);
router.post  ('/', [
  body('name').trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 40 }),
  body('fieldType').optional().isIn(['large', 'small', 'street', '3v3']),
  body('players').optional().isArray(),
  body('teamId').optional({ nullable: true }).isUUID().withMessage('Ungültige Team-ID'),
  validate,
], createFormation);
router.put   ('/:id', [
  param('id').isUUID().withMessage('Ungültige Vorlagen-ID'),
  body('name').trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 40 }),
  validate,
], updateFormation);
router.delete('/:id', [param('id').isUUID().withMessage('Ungültige Vorlagen-ID'), validate], deleteFormation);

export default router;
