/**
 * Routen-Factory für Fahrgemeinschaften (ISSUE 028) – wird von
 * routes/index.js einmal für Spiele und einmal für Trainingseinheiten mit
 * der jeweils passenden Zugriffsprüfung instanziiert, analog
 * routes/rsvps.js/routes/comments.js.
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { makeCarpoolHandlers } from '../controllers/carpoolsController.js';

export function createCarpoolRoutes(resourceType, { assertRead, assertWrite }) {
  const router = Router({ mergeParams: true });
  const { getOffers, createOffer, deleteOffer, claimSeat, deleteClaim } = makeCarpoolHandlers(resourceType, { assertRead, assertWrite });

  router.use(authenticate);

  const validateResourceId = param('id').isUUID().withMessage('Ungültige ID');
  const validateOfferId = param('offerId').isUUID().withMessage('Ungültige Angebots-ID');
  const validateClaimId = param('claimId').isUUID().withMessage('Ungültige Eintrags-ID');
  const validateMeetingPoint = body('meetingPoint').trim().isLength({ min: 1, max: 200 }).withMessage('Treffpunkt 1-200 Zeichen');
  const validateTotalSeats = body('totalSeats').isInt({ min: 1, max: 8 }).withMessage('Freie Plätze 1-8').toInt();
  const validateNote = body('note').optional().trim().isLength({ max: 500 }).withMessage('Notiz max. 500 Zeichen');

  router.get('/', [validateResourceId, validate], getOffers);
  router.post('/', [validateResourceId, validateMeetingPoint, validateTotalSeats, validateNote, validate], createOffer);
  router.delete('/:offerId', [validateResourceId, validateOfferId, validate], deleteOffer);
  router.post('/:offerId/claims', [validateResourceId, validateOfferId, validate], claimSeat);
  router.delete('/:offerId/claims/:claimId', [validateResourceId, validateOfferId, validateClaimId, validate], deleteClaim);

  return router;
}
