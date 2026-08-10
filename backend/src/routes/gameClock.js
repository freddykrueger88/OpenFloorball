/**
 * /api/games/:id/clock – Spieluhr (Roadmap-Audit). Gemountet in
 * routes/index.js.
 */
import { Router } from 'express';
import { param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { startClock, pauseClock, nextPeriod, resetClock } from '../controllers/gameClockController.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

const validateGameId = param('id').isUUID().withMessage('Ungültige Spiel-ID');

router.post('/start',       [validateGameId, validate], startClock);
router.post('/pause',       [validateGameId, validate], pauseClock);
router.post('/next-period', [validateGameId, validate], nextPeriod);
router.post('/reset',       [validateGameId, validate], resetClock);

export default router;
