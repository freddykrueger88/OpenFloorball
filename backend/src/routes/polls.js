/**
 * /api/polls – Umfragen/Polls (Roadmap-Audit, Phase D), authentifiziert,
 * Top-Level-Ressource wie announcements.js.
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getPolls, createPoll, votePoll, closePoll, deletePoll } from '../controllers/pollsController.js';

const router = Router();

router.use(authenticate);

const validatePollId = param('id').isUUID().withMessage('Ungültige Umfrage-ID');

router.get('/', getPolls);
router.post('/', [
  body('teamId').isUUID().withMessage('Ungültige Team-ID'),
  body('question').trim().notEmpty().withMessage('Frage ist erforderlich').isLength({ max: 300 }).withMessage('Frage max. 300 Zeichen'),
  body('multipleChoice').optional().isBoolean().withMessage('Ungültiger Wert für multipleChoice'),
  body('options').isArray({ min: 2, max: 10 }).withMessage('Mindestens 2, maximal 10 Optionen'),
  body('options.*').isString().trim().notEmpty().withMessage('Option darf nicht leer sein').isLength({ max: 100 }).withMessage('Option max. 100 Zeichen'),
  validate,
], createPoll);
router.post('/:id/vote', [
  validatePollId,
  body('optionId').isUUID().withMessage('Ungültige Options-ID'),
  validate,
], votePoll);
router.put('/:id/close', [validatePollId, validate], closePoll);
router.delete('/:id', [validatePollId, validate], deletePoll);

export default router;
