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
const EVENT_TYPES = [
  'kickoff_q1', 'kickoff_q2', 'kickoff_q3', 'period_end', 'timeout',
  'goal', 'penalty_2', 'penalty_5', 'match_penalty', 'game_end',
];

router.get   ('/', [validateGameId, validate], getEvents);
router.post  ('/', [
  validateGameId,
  body('eventType').isIn(EVENT_TYPES).withMessage('Ungültiger Ereignistyp'),
  body('rosterPlayerId').optional({ nullable: true }).isUUID().withMessage('Ungültige Kader-Spieler-ID'),
  body('isOpponent').optional().isBoolean().withMessage('Ungültiger Wert für isOpponent'),
  validate,
], addEvent);
router.delete('/:eventId', [validateGameId, validateEventId, validate], deleteEvent);

export default router;
