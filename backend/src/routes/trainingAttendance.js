/**
 * /api/trainings/:id/attendance – tatsächliche Anwesenheit bei einem
 * Training (Statistik-Architektur Phase 5). Gemountet in routes/index.js.
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getAttendance, setAttendanceStatus, clearAttendanceStatus } from '../controllers/trainingAttendanceController.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

const validateSessionId      = param('id').isUUID().withMessage('Ungültige Trainingseinheit-ID');
const validateRosterPlayerId = param('rosterPlayerId').isUUID().withMessage('Ungültige Kader-Spieler-ID');
const validateStatus = body('status').isIn(['present', 'excused', 'absent', 'injured']).withMessage('Ungültiger Status');
const validateNote   = body('note').optional().isLength({ max: 200 }).withMessage('Notiz max. 200 Zeichen');

router.get   ('/',                [validateSessionId, validate], getAttendance);
router.put   ('/:rosterPlayerId', [validateSessionId, validateRosterPlayerId, validateStatus, validateNote, validate], setAttendanceStatus);
router.delete('/:rosterPlayerId', [validateSessionId, validateRosterPlayerId, validate], clearAttendanceStatus);

export default router;
