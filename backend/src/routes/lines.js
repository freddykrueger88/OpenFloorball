/**
 * /api/lines – Lines: taktische Zusammenstellungen echter Kader-Spieler
 * (fachlicher Umbau, siehe linesController.js) – nicht mehr board-gescoped.
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getLines, createLine, updateLine, deleteLine,
  addPlayerToLine, removePlayerFromLine, setLineActive,
} from '../controllers/linesController.js';

const router = Router();

router.use(authenticate);

const idParam = param('id').isUUID().withMessage('Ungültige Line-ID');
const rosterPlayerIdParam = param('rosterPlayerId').isUUID().withMessage('Ungültige Spieler-ID');

router.get   ('/',    getLines);
router.post  ('/',    [
  body('name').trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 40 }),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Farbe muss ein Hex-Code sein'),
  body('type').optional().isIn(['offense', 'defense', 'special']),
  body('teamId').optional({ nullable: true }).isUUID().withMessage('Ungültige Team-ID'),
  validate,
], createLine);
router.put   ('/:id', [
  idParam,
  body('name').optional().trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 40 }),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Farbe muss ein Hex-Code sein'),
  body('type').optional().isIn(['offense', 'defense', 'special']),
  validate,
], updateLine);
router.delete('/:id', [idParam, validate], deleteLine);

router.post  ('/:id/players', [
  idParam,
  body('rosterPlayerId').isUUID().withMessage('Ungültige Spieler-ID'),
  validate,
], addPlayerToLine);
router.delete('/:id/players/:rosterPlayerId', [idParam, rosterPlayerIdParam, validate], removePlayerFromLine);

router.put   ('/:id/active', [
  idParam,
  body('active').isBoolean().withMessage('active muss boolean sein'),
  validate,
], setLineActive);

export default router;
