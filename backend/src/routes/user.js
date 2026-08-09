/**
 * /api/user – Account-Selbstverwaltung (Issue #22) + Backup/Export (Issue #21)
 */
import { Router } from 'express';
import multer from 'multer';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { deleteAccount, exportAccount, importAccount, getUserData } from '../controllers/userController.js';
import { getFeedStatus, generateFeedToken, revokeFeedToken } from '../controllers/calendarFeedController.js';
import { error } from '../utils/apiResponse.js';

const router = Router();

router.use(authenticate);

router.delete('/account', [
  body('email').isEmail().withMessage('E-Mail-Bestätigung erforderlich'),
  validate,
], deleteAccount);

router.get('/data', getUserData);
router.get('/export', exportAccount);

router.get('/calendar-feed', getFeedStatus);
router.post('/calendar-feed', generateFeedToken);
router.delete('/calendar-feed', revokeFeedToken);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const isZip = file.mimetype === 'application/zip' || file.originalname?.toLowerCase().endsWith('.zip');
    cb(isZip ? null : new Error('Nur ZIP-Dateien erlaubt'), isZip);
  },
});

router.post('/import', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json(error(err.message || 'Datei-Upload fehlgeschlagen'));
    next();
  });
}, importAccount);

export default router;
