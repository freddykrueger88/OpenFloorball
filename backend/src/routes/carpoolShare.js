/**
 * Öffentliche Fahrgemeinschafts-Ansicht (ISSUE 028) – bewusst NICHT hinter
 * authenticate, analog routes/shareView.js. Erster anonymer SCHREIB-Pfad
 * der App (siehe carpoolShareController.js), daher ein eigenes, engeres
 * Rate-Limit in server.js.
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { getSharedCarpoolOffer, claimSharedCarpoolSeat, cancelSharedCarpoolClaim } from '../controllers/carpoolShareController.js';

const router = Router();

const validateToken = param('token').isUUID().withMessage('Ungültiger Link');
const validateClaimId = param('claimId').isUUID().withMessage('Ungültige Eintrags-ID');
const validateClaimantName = body('claimantName').trim().isLength({ min: 1, max: 100 }).withMessage('Name 1-100 Zeichen');
const validateCancelToken = body('cancelToken').isUUID().withMessage('Ungültiger Bestätigungscode');

router.get('/:token', [validateToken, validate], getSharedCarpoolOffer);
router.post('/:token/claims', [validateToken, validateClaimantName, validate], claimSharedCarpoolSeat);
router.delete('/:token/claims/:claimId', [validateToken, validateClaimId, validateCancelToken, validate], cancelSharedCarpoolClaim);

export default router;
