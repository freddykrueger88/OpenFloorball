/**
 * /api/games/:id/events – Live-Match-Ereignisse (Roadmap-Audit).
 * Gemountet in routes/index.js.
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getEvents, addEvent, deleteEvent } from '../controllers/gameEventsController.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

const validateGameId  = param('id').isUUID().withMessage('Ungültige Spiel-ID');
const validateEventId = param('eventId').isUUID().withMessage('Ungültige Ereignis-ID');

router.get   ('/', [validateGameId, validate], getEvents);
router.post  ('/', [
  validateGameId,
  // eventType wird bewusst NICHT mehr gegen ein festes Array geprüft
  // (ADR-0001, docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md) –
  // die eigentliche Prüfung "existiert dieser Typ und ist aktiv?" läuft
  // im Controller gegen event_type_definitions, damit neue (auch
  // vereinsspezifische) Event-Typen ohne Code-Änderung hier möglich sind.
  body('eventType').trim().notEmpty().isLength({ max: 50 }).withMessage('Ereignistyp erforderlich'),
  body('rosterPlayerId').optional({ nullable: true }).isUUID().withMessage('Ungültige Kader-Spieler-ID'),
  body('secondaryRosterPlayerId').optional({ nullable: true }).isUUID().withMessage('Ungültige Kader-Spieler-ID'),
  body('isOpponent').optional().isBoolean().withMessage('Ungültiger Wert für isOpponent'),
  body('outcome').optional({ nullable: true }).isString().isLength({ max: 50 }),
  body('shotType').optional({ nullable: true }).isString().isLength({ max: 50 }),
  body('strengthState').optional({ nullable: true }).isString().isLength({ max: 50 }),
  body('x').optional({ nullable: true }).isFloat({ min: 0, max: 1 }).withMessage('x muss zwischen 0 und 1 liegen'),
  body('y').optional({ nullable: true }).isFloat({ min: 0, max: 1 }).withMessage('y muss zwischen 0 und 1 liegen'),
  body('zone').optional({ nullable: true }).isString().isLength({ max: 50 }),
  body('videoTimestampSeconds').optional({ nullable: true }).isFloat({ min: 0 }),
  body('metadata').optional().isObject().withMessage('metadata muss ein Objekt sein'),
  validate,
], addEvent);
router.delete('/:eventId', [validateGameId, validateEventId, validate], deleteEvent);

export default router;
