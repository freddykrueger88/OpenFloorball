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

// Spieler-Dashboard-Ausbau: Spiel-Logistik, gemeinsam für POST/PUT
const gameLogisticsFields = [
  body('kickoffTime').optional({ nullable: true }).matches(/^\d{2}:\d{2}$/).withMessage('Ungültige Uhrzeit (HH:MM)'),
  body('venueName').optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage('Hallenname max. 150 Zeichen'),
  body('venueAddress').optional({ nullable: true }).trim().isLength({ max: 300 }).withMessage('Adresse max. 300 Zeichen'),
  body('venueLat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('Ungültige Breitengrad-Koordinate'),
  body('venueLng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('Ungültige Längengrad-Koordinate'),
  body('isHome').optional({ nullable: true }).isBoolean().withMessage('isHome muss ein Boolean sein'),
  body('status').optional().isIn(['scheduled', 'postponed', 'cancelled']).withMessage('Ungültiger Status'),
];

router.get   ('/',    getGames);
router.post  ('/',    [
  body('opponent').optional().trim().isLength({ max: 100 }).withMessage('Gegner max. 100 Zeichen'),
  body('playedAt').optional({ nullable: true }).isISO8601().withMessage('Ungültiges Datum').bail().isLength({ max: 10 }),
  body('teamId').optional({ nullable: true }).isUUID().withMessage('Ungültige Team-ID'),
  ...gameLogisticsFields,
  validate,
], createGame);
router.get   ('/:id', [idParam, validate], getGame);
router.put   ('/:id', [
  idParam,
  body('opponent').optional().trim().isLength({ max: 100 }).withMessage('Gegner max. 100 Zeichen'),
  body('playedAt').optional({ nullable: true }).isISO8601().withMessage('Ungültiges Datum').bail().isLength({ max: 10 }),
  body('notes').optional().isLength({ max: 2000 }).withMessage('Notizen max. 2000 Zeichen'),
  body('periodMinutes').optional().isInt({ min: 1, max: 60 }).withMessage('Periodenlänge muss zwischen 1 und 60 Minuten liegen'),
  ...gameLogisticsFields,
  validate,
], updateGame);
router.delete('/:id', [idParam, validate], deleteGame);

export default router;
