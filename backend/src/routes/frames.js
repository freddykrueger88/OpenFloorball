/**
 * /api/boards/:id/frames – Frame-Routen (authentifiziert, user-scoped)
 */
import { Router } from 'express';
import express from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getFrames, addFrame, updateFrame, deleteFrame, reorderFrames } from '../controllers/framesController.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Erst nach authenticate und mit größerem Limit als der globale 10-KB-Parser
// (der diese Pfade in server.js überspringt). Der Parser in routes/boards.js
// läuft für dieselben Requests ggf. zuerst; express.json erkennt den bereits
// geparsten Body und ist dann ein No-op.
const BOARD_JSON_LIMIT = process.env.BOARD_JSON_LIMIT || '4mb';
router.use(express.json({ limit: BOARD_JSON_LIMIT }));

const validateBoardId = param('id').isUUID().withMessage('Ungültige Board-ID');
const validateFrameId = param('frameId').isUUID().withMessage('Ungültige Frame-ID');

router.get   ('/',             [validateBoardId, validate], getFrames);
router.post  ('/',             [
  validateBoardId,
  body('label').optional().isString().isLength({ max: 60 }),
  body('duration').optional().isInt({ min: 100, max: 10000 }),
  validate,
], addFrame);
router.put   ('/reorder',      [validateBoardId, validate], reorderFrames);
router.put   ('/:frameId',     [validateBoardId, validateFrameId, validate], updateFrame);
router.delete('/:frameId',     [validateBoardId, validateFrameId, validate], deleteFrame);

export default router;
