/**
 * Routen-Factory für RSVP/Anwesenheit – wird von routes/index.js einmal
 * für Spiele und einmal für Trainingseinheiten mit der jeweils passenden
 * Zugriffsprüfung instanziiert, analog routes/comments.js.
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { makeRsvpHandlers } from '../controllers/rsvpsController.js';

export function createRsvpRoutes(resourceType, { assertRead }) {
  const router = Router({ mergeParams: true });
  const { getRsvps, setMyRsvp } = makeRsvpHandlers(resourceType, { assertRead });

  router.use(authenticate);

  const validateResourceId = param('id').isUUID().withMessage('Ungültige ID');
  const validateStatus = body('status').isIn(['yes', 'no', 'maybe']).withMessage('Status muss yes, no oder maybe sein');
  const validateReason = body('reason').optional().isLength({ max: 200 }).withMessage('Grund max. 200 Zeichen');

  router.get('/',    [validateResourceId, validate], getRsvps);
  router.put('/me',  [validateResourceId, validateStatus, validateReason, validate], setMyRsvp);

  return router;
}
