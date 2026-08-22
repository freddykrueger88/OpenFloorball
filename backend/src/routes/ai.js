/**
 * /api/ai – KI-Assistenten (EPIC 010, AI_SYSTEM.md §5.1-5.4)
 * Authentifiziert, kein Admin-Zwang – jeder eingeloggte Trainer dieser
 * Instanz darf die Assistenten nutzen.
 */
import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getAiStatus, generateTrainingPlan, generateTacticSuggestion, generateAnalysis, generateKnowledgeAnswer,
  generateGameInsights,
} from '../controllers/aiController.js';

const router = Router();

router.use(authenticate);

router.get('/status', getAiStatus);

router.post('/training-plan', [
  // Feste Liste statt Freitext – verhindert schon auf Validierungsebene,
  // dass hier versehentlich Personendaten landen (AI_SYSTEM.md §8).
  body('ageGroup').isIn(['U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Erwachsene'])
    .withMessage('Ungültige Altersgruppe'),
  body('goal').trim().notEmpty().isLength({ max: 150 }).withMessage('Ziel max. 150 Zeichen'),
  body('focus').trim().notEmpty().isLength({ max: 150 }).withMessage('Schwerpunkt max. 150 Zeichen'),
  body('durationMinutes').isInt({ min: 15, max: 180 }).withMessage('Dauer 15-180 Minuten'),
  body('playerCount').isInt({ min: 1, max: 40 }).withMessage('Spieleranzahl 1-40'),
  validate,
], generateTrainingPlan);

// AI_SYSTEM.md §5.2 Taktikassistent
router.post('/tactic-suggestion', [
  body('category').isIn(['Forechecking', 'Powerplay', 'Boxplay', 'Allgemein'])
    .withMessage('Ungültige Kategorie'),
  body('question').trim().notEmpty().isLength({ max: 300 }).withMessage('Frage max. 300 Zeichen'),
  validate,
], generateTacticSuggestion);

// AI_SYSTEM.md §5.3 Analyseassistent – "observations" bleibt bewusst
// Freitext (keine feste Liste möglich für Beobachtungen); der Schutz vor
// Personendaten kommt hier aus dem UI-Hinweis + der expliziten
// Anonymisierungs-Anweisung im Prompt (prompts/analysis.md), nicht aus
// der Validierung.
router.post('/analysis', [
  body('observations').trim().notEmpty().isLength({ max: 2000 }).withMessage('Beobachtungen max. 2000 Zeichen'),
  body('focus').optional().trim().isLength({ max: 150 }).withMessage('Fokus max. 150 Zeichen'),
  validate,
], generateAnalysis);

// AI_SYSTEM.md §5.4 Wissensassistent – Frage bleibt kurz (max. 300 Zeichen,
// wie beim Taktikassistenten), die eigentliche Suche in den eigenen Daten
// übernimmt findRelevantItems() in aiController.js.
router.post('/knowledge-query', [
  body('question').trim().notEmpty().isLength({ max: 300 }).withMessage('Frage max. 300 Zeichen'),
  validate,
], generateKnowledgeAnswer);

// Statistik-Architektur Phase 9 (KI/ML-Grundlagen, Spiel-Insights) –
// nimmt bewusst nur eine gameId entgegen, keine Freitext-Eingabe: die
// eigentlichen Daten kommen serverseitig aus bereits berechneten
// Statistiken (siehe aiController.generateGameInsights).
router.post('/game-insights', [
  body('gameId').isUUID().withMessage('Ungültige Spiel-ID'),
  validate,
], generateGameInsights);

export default router;
