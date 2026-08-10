/**
 * /api/trainings – Trainingsplaner: Sessions + geordnete Items
 * (Issue #45, authentifiziert, nutzer-gebunden statt board-gebunden)
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getSessions, createSession, getSession, updateSession, deleteSession,
  addItem, updateItem, deleteItem, reorderItems, repeatSession,
} from '../controllers/trainingSessionsController.js';

const router = Router();

router.use(authenticate);

const idParam     = param('id').isUUID().withMessage('Ungültige Trainingseinheit-ID');
const itemIdParam = param('itemId').isUUID().withMessage('Ungültige Übungs-ID');

router.get   ('/',     getSessions);
router.post  ('/',     [
  body('name').trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 80 }),
  body('teamId').optional({ nullable: true }).isUUID().withMessage('Ungültige Team-ID'),
  body('scheduledDate').optional({ nullable: true }).isISO8601().withMessage('Ungültiges Datum').bail().isLength({ max: 10 }),
  body('goal').optional().isLength({ max: 200 }).withMessage('Ziel max. 200 Zeichen'),
  // EPIC 010 – KI-Trainingsassistent: erlaubt, den generierten Plantext
  // direkt beim Anlegen zu setzen, statt Create+Update nacheinander.
  body('notes').optional().isLength({ max: 4000 }).withMessage('Notizen max. 4000 Zeichen'),
  validate,
], createSession);
router.get   ('/:id',  [idParam, validate], getSession);
router.put   ('/:id',  [
  idParam,
  body('name').optional().trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 80 }),
  // EPIC 010 – KI-Trainingsassistent: ein vollständiger 5-Phasen-Plan
  // (Warm-up/Technik/Taktik/Spielform/Cool-down mit Übungen und
  // Coachingpunkten) sprengt das vorherige 1000-Zeichen-Limit leicht.
  body('notes').optional().isLength({ max: 4000 }).withMessage('Notizen max. 4000 Zeichen'),
  body('scheduledDate').optional({ nullable: true }).isISO8601().withMessage('Ungültiges Datum').bail().isLength({ max: 10 }),
  body('goal').optional().isLength({ max: 200 }).withMessage('Ziel max. 200 Zeichen'),
  validate,
], updateSession);
router.delete('/:id',  [idParam, validate], deleteSession);

router.post  ('/:id/repeat', [
  idParam,
  body('repeat').isIn(['daily', 'weekly', 'biweekly']).withMessage('Ungültiges Wiederholungsmuster'),
  body('until').isISO8601().withMessage('Ungültiges Datum').bail().isLength({ max: 10 }),
  validate,
], repeatSession);

router.post  ('/:id/items', [
  idParam,
  body('boardId').isUUID().withMessage('Ungültige Board-ID'),
  body('durationMinutes').optional().isInt({ min: 1, max: 240 }).withMessage('Dauer muss zwischen 1 und 240 Minuten liegen'),
  body('note').optional().isLength({ max: 300 }).withMessage('Notiz max. 300 Zeichen'),
  validate,
], addItem);

router.put   ('/:id/items/reorder', [
  idParam,
  body('order').isArray().withMessage('"order" muss ein Array sein'),
  body('order.*').isUUID().withMessage('Ungültige Übungs-ID in "order"'),
  validate,
], reorderItems);

router.put   ('/:id/items/:itemId', [
  idParam, itemIdParam,
  body('durationMinutes').optional().isInt({ min: 1, max: 240 }).withMessage('Dauer muss zwischen 1 und 240 Minuten liegen'),
  body('note').optional().isLength({ max: 300 }).withMessage('Notiz max. 300 Zeichen'),
  validate,
], updateItem);

router.delete('/:id/items/:itemId', [idParam, itemIdParam, validate], deleteItem);

export default router;
