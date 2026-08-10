/**
 * /api/organizations – Vereins-Ebene (ROADMAP Phase 2, authentifiziert)
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getOrganizations, getOrganization, createOrganization, updateOrganization, deleteOrganization,
  getMembers, inviteMember, updateMemberRole, removeMember, getSchedule,
} from '../controllers/organizationsController.js';

const router = Router();

router.use(authenticate);

const validateOrgId    = param('id').isUUID().withMessage('Ungültige Vereins-ID');
const validateMemberId = param('memberId').isUUID().withMessage('Ungültige Mitglieds-ID');
const validateRole     = body('role').isIn(['admin', 'member']).withMessage('Ungültige Rolle');
const validateName     = body('name').trim().notEmpty().withMessage('Name ist erforderlich').isLength({ max: 80 }).withMessage('Name max. 80 Zeichen');

router.get   ('/',      getOrganizations);
router.post  ('/',      [validateName, validate], createOrganization);
router.get   ('/:id',    [validateOrgId, validate], getOrganization);
router.put   ('/:id',    [validateOrgId, validateName, validate], updateOrganization);
router.delete('/:id',    [validateOrgId, validate], deleteOrganization);

router.get   ('/:id/members',              [validateOrgId, validate], getMembers);
router.post  ('/:id/members',              [
  validateOrgId,
  body('email').trim().isEmail().withMessage('Ungültige E-Mail-Adresse'),
  body('role').optional().isIn(['admin', 'member']).withMessage('Ungültige Rolle'),
  validate,
], inviteMember);
router.put   ('/:id/members/:memberId',    [validateOrgId, validateMemberId, validateRole, validate], updateMemberRole);
router.delete('/:id/members/:memberId',    [validateOrgId, validateMemberId, validate], removeMember);

router.get   ('/:id/schedule',             [validateOrgId, validate], getSchedule);

export default router;
