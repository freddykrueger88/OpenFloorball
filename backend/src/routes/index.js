/**
 * OpenFloorball – Route Index
 */
import { Router } from 'express';
import express from 'express';
import authRoutes from './auth.js';
import boardRoutes from './boards.js';
import frameRoutes from './frames.js';
import linesRoutes from './lines.js';
import boardCollaboratorRoutes from './boardCollaborators.js';
import boardVersionRoutes from './boardVersions.js';
import videoRoutes from './videos.js';
import exportRoutes from './exports.js';
import shareViewRoutes from './shareView.js';
import inviteRoutes from './invite.js';
import calendarFeedRoutes from './calendarFeed.js';
import settingsRoutes from './settings.js';
import userRoutes from './user.js';
import adminRoutes from './admin.js';
import formationRoutes from './formations.js';
import playbookRoutes from './playbooks.js';
import trainingRoutes from './trainings.js';
import rosterRoutes from './roster.js';
import gamesRoutes from './games.js';
import teamRoutes from './teams.js';
import announcementRoutes from './announcements.js';
import pollRoutes from './polls.js';
import organizationRoutes from './organizations.js';
import libraryRoutes from './library.js';
import aiRoutes from './ai.js';
import { createCommentRoutes } from './comments.js';
import { createRsvpRoutes } from './rsvps.js';
import gameSquadRoutes from './gameSquad.js';
import trainingAttendanceRoutes from './trainingAttendance.js';
import gameEventsRoutes from './gameEvents.js';
import gameClockRoutes from './gameClock.js';
import matchLinesRoutes from './matchLines.js';
import { assertBoardAccess } from '../utils/boardAccess.js';
import { assertSessionRead, assertSessionWrite } from '../controllers/trainingSessionsController.js';
import { assertGameRead, assertGameWrite } from '../controllers/gamesController.js';
// import tacticsRoutes from './tactics.js'; // Issue #7

const boardCommentRoutes = createCommentRoutes('board', {
  assertRead:  (id, userId) => assertBoardAccess(id, userId, 'read'),
  assertWrite: (id, userId) => assertBoardAccess(id, userId, 'write'),
});
const sessionCommentRoutes = createCommentRoutes('training_session', {
  assertRead:  assertSessionRead,
  assertWrite: assertSessionWrite,
});
const gameCommentRoutes = createCommentRoutes('game', {
  assertRead:  assertGameRead,
  assertWrite: assertGameWrite,
});
const sessionRsvpRoutes = createRsvpRoutes('training_session', { assertRead: assertSessionRead });
const gameRsvpRoutes = createRsvpRoutes('game', { assertRead: assertGameRead });

const router = Router();

router.use('/auth',               authRoutes);
router.use('/boards',             boardRoutes);
router.use('/boards/:id/frames',  frameRoutes);
router.use('/boards/:id/collaborators', boardCollaboratorRoutes);
router.use('/boards/:id/comments', boardCommentRoutes);
router.use('/boards/:id/versions', boardVersionRoutes);
router.use('/boards/:id/videos',  videoRoutes);
router.use('/trainings/:id/comments', sessionCommentRoutes);
router.use('/games/:id/comments', gameCommentRoutes);
router.use('/trainings/:id/rsvps', sessionRsvpRoutes);
router.use('/trainings/:id/attendance', trainingAttendanceRoutes);
router.use('/games/:id/rsvps', gameRsvpRoutes);
router.use('/games/:id/squad', gameSquadRoutes);
router.use('/games/:id/events', gameEventsRoutes);
router.use('/games/:id/clock', gameClockRoutes);
router.use('/games/:id/match-lines', matchLinesRoutes);
// GIF-Export braucht großes JSON-Limit (Base64-PNGs) – nur auf diesem Sub-Router
router.use('/export', express.json({ limit: '50mb' }), exportRoutes);
// Öffentliche Share-Link-Ansicht – bewusst NICHT hinter authenticate (Issue #16)
router.use('/share', shareViewRoutes);
// Öffentliche Einladungs-Vorschau – bewusst NICHT hinter authenticate
router.use('/invite', inviteRoutes);
// Öffentlicher ICS-Kalender-Feed – bewusst NICHT hinter authenticate
router.use('/calendar-feed', calendarFeedRoutes);
router.use('/settings', settingsRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);
router.use('/formations', formationRoutes);
router.use('/playbooks', playbookRoutes);
router.use('/trainings', trainingRoutes);
router.use('/roster', rosterRoutes);
router.use('/games', gamesRoutes);
router.use('/lines', linesRoutes);
router.use('/teams', teamRoutes);
router.use('/announcements', announcementRoutes);
router.use('/polls', pollRoutes);
router.use('/organizations', organizationRoutes);
router.use('/library', libraryRoutes);
router.use('/ai', aiRoutes);
// router.use('/tactics', tacticsRoutes);

export default router;
