/**
 * /api/roster – zentraler Team-Kader (Issue #53, authentifiziert,
 * nutzer-gebunden statt board-gebunden)
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getRosterPlayers, getRosterPlayer, getRosterStats, getRosterPlayerGameLog, getRosterPlayerTrainingLog,
  createRosterPlayer, updateRosterPlayer, deleteRosterPlayer,
} from '../controllers/rosterController.js';
import { getNotes, createNote, updateNote, deleteNote } from '../controllers/playerDevelopmentNotesController.js';

const router = Router();

router.use(authenticate);

const rosterFields = [
  body('name').optional().trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 40 }),
  body('jerseyNumber').optional({ nullable: true }).isInt({ min: 0, max: 99 }).withMessage('Rückennummer muss zwischen 0 und 99 liegen'),
  body('role').optional({ nullable: true }).isIn(['TW', 'V', 'C', 'S']).withMessage('Ungültige Position'),
];

router.get   ('/',      getRosterPlayers);
// Muss VOR /:id stehen, sonst interpretiert param('id').isUUID() den
// literalen Pfad "stats" als ungültige ID (422 statt der Stats-Route).
router.get   ('/stats',  getRosterStats);
router.get   ('/:id',  [param('id').isUUID().withMessage('Ungültige Kader-ID'), validate], getRosterPlayer);
router.get   ('/:id/game-log', [param('id').isUUID().withMessage('Ungültige Kader-ID'), validate], getRosterPlayerGameLog);
router.get   ('/:id/training-log', [param('id').isUUID().withMessage('Ungültige Kader-ID'), validate], getRosterPlayerTrainingLog);
router.get   ('/:id/notes', [param('id').isUUID().withMessage('Ungültige Kader-ID'), validate], getNotes);
router.post  ('/:id/notes', [
  param('id').isUUID().withMessage('Ungültige Kader-ID'),
  body('note').trim().notEmpty().withMessage('Notiz ist erforderlich').isLength({ max: 2000 }).withMessage('Notiz max. 2000 Zeichen'),
  body('trainingSessionId').optional({ nullable: true }).isUUID().withMessage('Ungültige Trainingseinheit-ID'),
  validate,
], createNote);
router.put   ('/:id/notes/:noteId', [
  param('id').isUUID().withMessage('Ungültige Kader-ID'),
  param('noteId').isUUID().withMessage('Ungültige Notiz-ID'),
  body('note').trim().notEmpty().withMessage('Notiz ist erforderlich').isLength({ max: 2000 }).withMessage('Notiz max. 2000 Zeichen'),
  validate,
], updateNote);
router.delete('/:id/notes/:noteId', [
  param('id').isUUID().withMessage('Ungültige Kader-ID'),
  param('noteId').isUUID().withMessage('Ungültige Notiz-ID'),
  validate,
], deleteNote);
router.post  ('/',     [
  body('name').trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 40 }),
  ...rosterFields.slice(1),
  body('teamId').optional({ nullable: true }).isUUID().withMessage('Ungültige Team-ID'),
  validate,
], createRosterPlayer);
router.put   ('/:id',  [param('id').isUUID().withMessage('Ungültige Kader-ID'), ...rosterFields, validate], updateRosterPlayer);
router.delete('/:id',  [param('id').isUUID().withMessage('Ungültige Kader-ID'), validate], deleteRosterPlayer);

export default router;
