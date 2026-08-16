/**
 * /api/games/:id/match-lines – Match-Line/Shift-Tracking (Statistik-
 * Architektur Phase 2). Gemountet in routes/index.js.
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getMatchLines, getLineStats, activateMatchLine } from '../controllers/matchLinesController.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

const validateGameId = param('id').isUUID().withMessage('Ungültige Spiel-ID');

router.get ('/',      [validateGameId, validate], getMatchLines);
router.get ('/stats', [validateGameId, validate], getLineStats);
router.post('/',      [
  validateGameId,
  body('lineId').isUUID().withMessage('Ungültige Line-ID'),
  validate,
], activateMatchLine);

export default router;
