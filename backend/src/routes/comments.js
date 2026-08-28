/**
 * Routen-Factory für Kommentare (ROADMAP Phase 2) – wird von
 * routes/index.js einmal für Boards und einmal für Trainingseinheiten
 * mit der jeweils passenden Zugriffsprüfung instanziiert.
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { makeCommentHandlers } from '../controllers/commentsController.js';

export function createCommentRoutes(resourceType, { assertRead, assertWrite }) {
  const router = Router({ mergeParams: true });
  const { getComments, addComment, updateComment, deleteComment } = makeCommentHandlers(resourceType, { assertRead, assertWrite });

  router.use(authenticate);

  const validateResourceId = param('id').isUUID().withMessage('Ungültige ID');
  const validateCommentId  = param('commentId').isUUID().withMessage('Ungültige Kommentar-ID');
  const validateText = body('text').trim().notEmpty().withMessage('Text ist erforderlich').isLength({ max: 2000 }).withMessage('Kommentar max. 2000 Zeichen');
  // Layer-System (CLAUDE.md §10.2): optionale Feld-Position, macht den
  // Kommentar zu einem "Pin" auf dem Taktikboard – nur beim Anlegen
  // entgegennehmbar (siehe commentsController.updateComment), daher nur
  // auf der POST-Route validiert, nicht auf PUT.
  const validatePosition = [
    body('x').optional({ nullable: true }).isFloat().withMessage('Ungültige x-Position'),
    body('y').optional({ nullable: true }).isFloat().withMessage('Ungültige y-Position'),
  ];

  router.get   ('/',           [validateResourceId, validate], getComments);
  router.post  ('/',           [validateResourceId, validateText, ...validatePosition, validate], addComment);
  router.put   ('/:commentId', [validateResourceId, validateCommentId, validateText, validate], updateComment);
  router.delete('/:commentId', [validateResourceId, validateCommentId, validate], deleteComment);

  return router;
}
