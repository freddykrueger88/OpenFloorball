/**
 * /api/boards – Spielfeld-Routen (authentifiziert, user-scoped)
 */
import { Router } from 'express';
import express from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getBoards, getBoard, createBoard, updateBoard, deleteBoard,
} from '../controllers/boardsController.js';
import { createShareLink } from '../controllers/shareController.js';
import { publishToLibrary } from '../controllers/libraryController.js';

const router = Router();

router.use(authenticate);

// Board-/Frame-Saves dürfen deutlich größer als 10 KB sein (viele Freihand-
// Punkte). Der Parser läuft bewusst erst nach authenticate; der globale
// 10-KB-Parser in server.js überspringt genau diese Pfade.
const BOARD_JSON_LIMIT = process.env.BOARD_JSON_LIMIT || '4mb';
router.use(express.json({ limit: BOARD_JSON_LIMIT }));

const validateBoard = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name ist erforderlich')
    .isLength({ max: 80 }).withMessage('Name max. 80 Zeichen'),
  body('fieldType')
    .optional()
    .isIn(['large', 'small', 'street', '3v3'])
    .withMessage('Ungültiger Spielfeld-Typ'),
  body('theme')
    .optional()
    .isIn(['dark', 'light', 'vikings', 'iff']),
  // EPIC 010 – KI-Taktik-/Analyseassistent: generierter Text (Varianten
  // mit Vor-/Nachteilen bzw. Analyse-Zusammenfassung) sprengt das
  // vorherige 500-Zeichen-Limit leicht; 4000 analog zu
  // training_sessions.notes (routes/trainings.js).
  body('notes').optional().isLength({ max: 4000 }).withMessage('Notizen max. 4000 Zeichen'),
  body('opponent').optional().trim().isLength({ max: 80 }).withMessage('Gegner max. 80 Zeichen'),
  body('category')
    .optional()
    .isIn(['', 'technik', 'taktik', 'kondition', 'spielverstaendnis', 'nachwuchs'])
    .withMessage('Ungültige Kategorie'),
  body('ageGroup').optional().trim().isLength({ max: 40 }).withMessage('Altersklasse max. 40 Zeichen'),
  body('goal').optional().trim().isLength({ max: 160 }).withMessage('Ziel max. 160 Zeichen'),
  body('material').optional().trim().isLength({ max: 160 }).withMessage('Material max. 160 Zeichen'),
  body('homeColor').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Heimfarbe muss ein Hex-Code sein'),
  body('awayColor').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Auswärtsfarbe muss ein Hex-Code sein'),
  body('ballColor').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Ballfarbe muss ein Hex-Code sein'),
  body('playbookId').optional({ nullable: true }).isUUID().withMessage('Ungültige Playbook-ID'),
];

const validateCreateBoard = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name ist erforderlich')
    .isLength({ max: 80 }).withMessage('Name max. 80 Zeichen'),
  ...validateBoard.slice(1),
];

router.get   ('/',     getBoards);
router.get   ('/:id',  [param('id').isUUID().withMessage('Ungültige Board-ID'), validate], getBoard);
router.post  ('/',     [validateCreateBoard, validate], createBoard);
router.put   ('/:id',  [param('id').isUUID(), ...validateBoard, validate], updateBoard);
router.delete('/:id',  [param('id').isUUID().withMessage('Ungültige Board-ID'), validate], deleteBoard);
router.post  ('/:id/share', [param('id').isUUID().withMessage('Ungültige Board-ID'), validate], createShareLink);
router.post  ('/:id/publish', [
  param('id').isUUID().withMessage('Ungültige Board-ID'),
  body('frameId').optional().isUUID().withMessage('Ungültige Frame-ID'),
  body('name').optional().trim().isLength({ max: 80 }).withMessage('Name max. 80 Zeichen'),
  validate,
], publishToLibrary);

export default router;
