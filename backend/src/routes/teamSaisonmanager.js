/**
 * /api/teams/:id/saisonmanager – optionale Saisonmanager-Anbindung
 * (Spieler-Dashboard-Ausbau). `mergeParams: true`, damit `:id` aus dem
 * Eltern-Mount (routes/index.js) hier verfügbar ist, analog frames.js.
 */
import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getSaisonmanagerLink, setSaisonmanagerLink, deleteSaisonmanagerLink, getNextMatch, getTable,
} from '../controllers/teamSaisonmanagerController.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get   ('/',            getSaisonmanagerLink);
router.put   ('/',    [
  body('apiKey').trim().notEmpty().withMessage('API-Key ist erforderlich').isLength({ max: 200 }),
  body('leagueId').isInt({ min: 1 }).withMessage('Ungültige Liga-ID'),
  body('smTeamId').isInt({ min: 1 }).withMessage('Ungültige Saisonmanager-Team-ID'),
  validate,
], setSaisonmanagerLink);
router.delete('/',            deleteSaisonmanagerLink);
router.get   ('/next-match',  getNextMatch);
router.get   ('/table',       getTable);

export default router;
