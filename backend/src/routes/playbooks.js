/**
 * /api/playbooks – Board-Sammlungen (Issue #52, authentifiziert,
 * nutzer-gebunden statt board-gebunden)
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getPlaybooks, getPlaybook, createPlaybook, updatePlaybook, deletePlaybook,
} from '../controllers/playbooksController.js';

const router = Router();

router.use(authenticate);

router.get   ('/',    getPlaybooks);
router.get   ('/:id', [param('id').isUUID().withMessage('Ungültige Playbook-ID'), validate], getPlaybook);
router.post  ('/', [
  body('name').trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 40 }),
  body('teamId').optional({ nullable: true }).isUUID().withMessage('Ungültige Team-ID'),
  validate,
], createPlaybook);
router.put   ('/:id', [
  param('id').isUUID().withMessage('Ungültige Playbook-ID'),
  body('name').trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 40 }),
  validate,
], updatePlaybook);
router.delete('/:id', [param('id').isUUID().withMessage('Ungültige Playbook-ID'), validate], deletePlaybook);

export default router;
