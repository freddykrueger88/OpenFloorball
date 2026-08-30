/**
 * /api/teams – Teams + Mitgliederverwaltung (ROADMAP Phase 2,
 * authentifiziert)
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getTeams, getTeam, createTeam, updateTeam, deleteTeam,
  getMembers, inviteMember, updateMemberRole, removeMember,
  getMyBirthdays,
} from '../controllers/teamsController.js';

const router = Router();

router.use(authenticate);

const validateTeamId   = param('id').isUUID().withMessage('Ungültige Team-ID');
const validateMemberId = param('memberId').isUUID().withMessage('Ungültige Mitglieds-ID');
const validateRole     = body('role').isIn(['owner', 'coach', 'member']).withMessage('Ungültige Rolle');
const validateName     = body('name').trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 80 }).withMessage('Name max. 80 Zeichen');

router.get   ('/',      getTeams);
router.post  ('/',      [
  validateName,
  body('organizationId').optional({ nullable: true }).isUUID().withMessage('Ungültige Vereins-ID'),
  validate,
], createTeam);
router.get   ('/birthdays', getMyBirthdays);
router.get   ('/:id',    [validateTeamId, validate], getTeam);
router.put   ('/:id',    [validateTeamId, validateName, validate], updateTeam);
router.delete('/:id',    [validateTeamId, validate], deleteTeam);

router.get   ('/:id/members',              [validateTeamId, validate], getMembers);
router.post  ('/:id/members',              [
  validateTeamId,
  body('email').trim().isEmail().withMessage('Ungültige E-Mail-Adresse'),
  body('role').optional().isIn(['owner', 'coach', 'member']).withMessage('Ungültige Rolle'),
  validate,
], inviteMember);
router.put   ('/:id/members/:memberId',    [validateTeamId, validateMemberId, validateRole, validate], updateMemberRole);
router.delete('/:id/members/:memberId',    [validateTeamId, validateMemberId, validate], removeMember);

export default router;
