/**
 * /api/opponents – gelesen, rein aggregiert (Bilanz je Gegner). Kein
 * Anlegen/Ändern hier: Gegner entstehen automatisch über
 * resolveOpponentId beim Anlegen/Ändern eines Spiels (siehe
 * gamesController.js).
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getOpponents } from '../controllers/opponentsController.js';

const router = Router();

router.use(authenticate);

router.get('/', getOpponents);

export default router;
