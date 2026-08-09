/**
 * /api/games/:id/squad – Match-Kader für ein konkretes Spiel
 * (Roadmap-Audit). Gemountet in routes/index.js.
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getSquad, setSquadStatus, clearSquadStatus } from '../controllers/matchSquadController.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

const validateGameId         = param('id').isUUID().withMessage('Ungültige Spiel-ID');
const validateRosterPlayerId = param('rosterPlayerId').isUUID().withMessage('Ungültige Kader-Spieler-ID');
const validateStatus = body('status').isIn(['playing', 'reserve', 'injured', 'absent']).withMessage('Ungültiger Status');
const validateNote   = body('note').optional().isLength({ max: 200 }).withMessage('Notiz max. 200 Zeichen');

router.get   ('/',                   [validateGameId, validate], getSquad);
router.put   ('/:rosterPlayerId',    [validateGameId, validateRosterPlayerId, validateStatus, validateNote, validate], setSquadStatus);
router.delete('/:rosterPlayerId',    [validateGameId, validateRosterPlayerId, validate], clearSquadStatus);

export default router;
