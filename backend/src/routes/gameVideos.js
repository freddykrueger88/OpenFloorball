/**
 * /api/games/:id/videos – Video-Integration Phase 6 (Statistik-Architektur)
 */
import { Router } from 'express';
import { param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getVideos, uploadVideo, streamVideo, updateVideo, deleteVideo, uploadMiddleware } from '../controllers/gameVideosController.js';
import { error } from '../utils/apiResponse.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

const validateGameId = param('id').isUUID().withMessage('Ungültige Spiel-ID');
const validateVideoId = param('videoId').isUUID().withMessage('Ungültige Video-ID');

router.get('/', [validateGameId, validate], getVideos);

// Spiel-ID zuerst prüfen (billig), bevor Multer den u.U. großen
// Datei-Body überhaupt verarbeitet – siehe routes/videos.js, identisches
// Muster.
router.post('/', [validateGameId, validate], (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) return res.status(400).json(error(err.message));
    next();
  });
}, uploadVideo);

router.get('/:videoId/stream', [validateGameId, validateVideoId, validate], streamVideo);
router.put('/:videoId', [validateGameId, validateVideoId, validate], updateVideo);
router.delete('/:videoId', [validateGameId, validateVideoId, validate], deleteVideo);

export default router;
