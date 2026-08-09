/**
 * /api/calendar-feed – Öffentlicher ICS-Kalender-Abo-Feed (kein Auth!),
 * analog shareView.js/invite.js. Kalender-Clients (Google/Apple/Outlook)
 * fragen diese URL wiederholt ohne Login ab.
 */
import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { getIcsFeed } from '../controllers/calendarFeedController.js';

const router = Router();

router.get('/:token.ics', [param('token').isUUID().withMessage('Ungültiger Link'), validate], getIcsFeed);

export default router;
