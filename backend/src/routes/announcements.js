/**
 * /api/announcements – News/Ankündigungen (Roadmap-Audit, Phase D),
 * authentifiziert, Top-Level-Ressource wie teams.js/games.js.
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getAnnouncements, createAnnouncement, deleteAnnouncement } from '../controllers/announcementsController.js';

const router = Router();

router.use(authenticate);

router.get('/', getAnnouncements);
router.post('/', [
  body('teamId').isUUID().withMessage('Ungültige Team-ID'),
  body('text').trim().notEmpty().withMessage('Text ist erforderlich').isLength({ max: 2000 }).withMessage('Text max. 2000 Zeichen'),
  validate,
], createAnnouncement);
router.delete('/:id', [param('id').isUUID().withMessage('Ungültige Ankündigungs-ID'), validate], deleteAnnouncement);

export default router;
