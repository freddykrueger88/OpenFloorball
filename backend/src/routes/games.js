/**
 * /api/games – Live-Spielnotizen: das Spiel selbst (Gegner/Datum/Team).
 * Die Notizen laufen über /api/games/:id/comments (siehe routes/index.js).
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getGames, createGame, getGame, updateGame, deleteGame } from '../controllers/gamesController.js';

const router = Router();

router.use(authenticate);

const idParam = param('id').isUUID().withMessage('Ungültige Spiel-ID');

router.get   ('/',    getGames);
router.post  ('/',    [
  body('opponent').optional().trim().isLength({ max: 100 }).withMessage('Gegner max. 100 Zeichen'),
  body('playedAt').optional({ nullable: true }).isISO8601().withMessage('Ungültiges Datum').bail().isLength({ max: 10 }),
  body('teamId').optional({ nullable: true }).isUUID().withMessage('Ungültige Team-ID'),
  validate,
], createGame);
router.get   ('/:id', [idParam, validate], getGame);
router.put   ('/:id', [
  idParam,
  body('opponent').optional().trim().isLength({ max: 100 }).withMessage('Gegner max. 100 Zeichen'),
  body('playedAt').optional({ nullable: true }).isISO8601().withMessage('Ungültiges Datum').bail().isLength({ max: 10 }),
  body('notes').optional().isLength({ max: 2000 }).withMessage('Notizen max. 2000 Zeichen'),
  validate,
], updateGame);
router.delete('/:id', [idParam, validate], deleteGame);

export default router;
