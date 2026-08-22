/**
 * /api/event-types – Custom Events/Tags (Statistik-Architektur Phase 7)
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getEventTypeDefinitions, createEventTypeDefinition, updateEventTypeDefinition, deleteEventTypeDefinition,
} from '../controllers/eventTypeDefinitionsController.js';

const router = Router();

router.use(authenticate);

const validateKey = param('key').trim().notEmpty().isLength({ max: 100 }).withMessage('Ungültiger Ereignistyp-Schlüssel');

router.get('/', getEventTypeDefinitions);
router.post('/', [
  body('label').trim().notEmpty().withMessage('Bezeichnung ist erforderlich').isLength({ max: 50 }),
  body('teamId').optional({ nullable: true }).isUUID().withMessage('Ungültige Team-ID'),
  body('requiresPlayer').optional().isBoolean().withMessage('Ungültiger Wert für requiresPlayer'),
  validate,
], createEventTypeDefinition);
router.put('/:key', [
  validateKey,
  body('label').optional().trim().isLength({ max: 50 }),
  body('requiresPlayer').optional().isBoolean().withMessage('Ungültiger Wert für requiresPlayer'),
  body('active').optional().isBoolean().withMessage('Ungültiger Wert für active'),
  validate,
], updateEventTypeDefinition);
router.delete('/:key', [validateKey, validate], deleteEventTypeDefinition);

export default router;
