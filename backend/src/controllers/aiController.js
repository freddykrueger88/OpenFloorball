/**
 * aiController – KI-Trainingsassistent (EPIC 010, AI_SYSTEM.md §5.1 MVP)
 *
 * Erzeugt nur einen Textentwurf, speichert nichts selbst – der Trainer
 * entscheidet separat über den bestehenden Trainingseinheiten-Flow
 * (POST /api/trainings), ob/wie der Vorschlag übernommen wird
 * (AI_STRATEGY.md §19: KI erstellt, Trainer prüft, dann Speichern).
 */
import { getAiProvider } from '../services/ai/aiProvider.js';
import {
  renderTrainingPrompt, renderTacticsPrompt, renderAnalysisPrompt, renderKnowledgePrompt, renderInsightsPrompt,
} from '../services/ai/promptLoader.js';
import { findRelevantItems } from '../services/ai/knowledgeRetrieval.js';
import { success, error } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';
import pool from '../db/pool.js';
import { assertGameRead } from './gamesController.js';
import {
  calculateMatchScore, calculateShotStats, calculateSpecialTeamsStats, calculateSituationalStats,
} from '../services/statisticsEngine.js';

const SYSTEM_PROMPT = 'Du folgst den Anweisungen und Regeln aus der folgenden Vorlage exakt.';
const AI_DISCLAIMER = 'Von KI generiert – bitte vor dem Einsatz prüfen und anpassen.';

const KNOWLEDGE_TYPE_LABELS = { board: 'Board', training: 'Trainingseinheit', library: 'Bibliothekseintrag' };

function buildKnowledgeContext(matches) {
  return [...matches.boards, ...matches.trainings, ...matches.libraryEntries]
    .map((item) => `- ${KNOWLEDGE_TYPE_LABELS[item.type]} "${item.name}"${item.excerpt ? ` – ${item.excerpt}` : ''}`)
    .join('\n');
}

// GET /api/ai/status – Transparenz (AI_SYSTEM.md §2 "der Nutzer muss
// erkennen, wann KI verwendet wird") + steuert im Frontend, ob der
// "Mit KI planen"-Button überhaupt angezeigt wird.
export async function getAiStatus(req, res) {
  try {
    const provider = await getAiProvider();
    res.json(success({
      configured: provider !== null,
      model: provider?.model || null,
    }));
  } catch (err) {
    logger.error('[getAiStatus]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/ai/training-plan
export async function generateTrainingPlan(req, res) {
  try {
    const provider = await getAiProvider();
    if (!provider) {
      return res.status(503).json(error('KI-Assistent ist auf dieser Instanz nicht konfiguriert'));
    }

    const { ageGroup, goal, durationMinutes, playerCount, focus } = req.body;
    const userPrompt = renderTrainingPrompt({ ageGroup, goal, durationMinutes, playerCount, focus });

    const { text, model } = await provider.generate({ systemPrompt: SYSTEM_PROMPT, userPrompt });
    res.json(success({
      planText: text,
      model,
      generatedAt: new Date().toISOString(),
      disclaimer: 'Von KI generiert – bitte vor dem Einsatz prüfen und anpassen.',
    }));
  } catch (err) {
    logger.error('[generateTrainingPlan]', err);
    res.status(502).json(error('KI-Anbieter konnte keinen Vorschlag liefern, bitte später erneut versuchen'));
  }
}

// POST /api/ai/tactic-suggestion
export async function generateTacticSuggestion(req, res) {
  try {
    const provider = await getAiProvider();
    if (!provider) {
      return res.status(503).json(error('KI-Assistent ist auf dieser Instanz nicht konfiguriert'));
    }

    const { category, question } = req.body;
    const userPrompt = renderTacticsPrompt({ category, question });

    const { text, model } = await provider.generate({ systemPrompt: SYSTEM_PROMPT, userPrompt });
    res.json(success({
      suggestionText: text,
      model,
      generatedAt: new Date().toISOString(),
      disclaimer: 'Von KI generiert – bitte vor dem Einsatz prüfen und anpassen.',
    }));
  } catch (err) {
    logger.error('[generateTacticSuggestion]', err);
    res.status(502).json(error('KI-Anbieter konnte keinen Vorschlag liefern, bitte später erneut versuchen'));
  }
}

// POST /api/ai/analysis
export async function generateAnalysis(req, res) {
  try {
    const provider = await getAiProvider();
    if (!provider) {
      return res.status(503).json(error('KI-Assistent ist auf dieser Instanz nicht konfiguriert'));
    }

    const { observations, focus = '' } = req.body;
    const userPrompt = renderAnalysisPrompt({ observations, focus });

    const { text, model } = await provider.generate({ systemPrompt: SYSTEM_PROMPT, userPrompt });
    res.json(success({
      analysisText: text,
      model,
      generatedAt: new Date().toISOString(),
      disclaimer: 'Von KI generiert – bitte vor dem Einsatz prüfen und anpassen.',
    }));
  } catch (err) {
    logger.error('[generateAnalysis]', err);
    res.status(502).json(error('KI-Anbieter konnte keinen Vorschlag liefern, bitte später erneut versuchen'));
  }
}

// formatStatsSummary – wandelt die bereits an anderer Stelle berechneten,
// zentralen Kennzahlen (statisticsEngine.js, dieselben Funktionen wie
// ShotStatsSection/SpecialTeamsStatsSection/SituationalStatsSection im
// Frontend) in einen lesbaren deutschen Textblock für den Prompt um.
// Bewusst NUR Team-Aggregate, keine roster_player_id/Namen – siehe
// prompts/insights.md Sicherheitsregeln. "Unbekannt ≠ 0": eine Sektion
// ohne Datengrundlage wird explizit als solche benannt statt 0%/leere
// Werte zu zeigen, die die KI sonst als echtes Muster fehldeuten könnte.
export function formatStatsSummary(events, periodMinutes) {
  const shot = calculateShotStats(events);
  const special = calculateSpecialTeamsStats(events, { periodMinutes });
  const situational = calculateSituationalStats(events);

  const lines = [];

  lines.push('Schuss-Statistiken:');
  if (shot.shots === 0) {
    lines.push('- Kein Schuss-Tracking für dieses Spiel erfasst.');
  } else {
    lines.push(`- Schüsse gesamt: ${shot.shots} (${shot.shotsOnGoal} aufs Tor, ${shot.goals} Tore, ${shot.saves} gehalten, ${shot.misses} verfehlt, ${shot.blocks} geblockt)`);
    lines.push(`- Schuss-%: ${shot.shotPercentage ?? 'unbekannt (keine Schüsse aufs Tor)'}`);
    if (shot.byZone.length > 0) {
      const zoneText = shot.byZone.map((z) => `${z.zone ?? 'unbekannte Zone'} (${z.shots} Schüsse, ${z.goals} Tore)`).join(', ');
      lines.push(`- Nach Zone: ${zoneText}`);
    }
  }

  lines.push('');
  lines.push('Special Teams:');
  if (special.powerPlay.opportunities === 0 && special.penaltyKill.opportunities === 0) {
    lines.push('- Keine Powerplay-/Unterzahl-Situationen in diesem Spiel.');
  } else {
    lines.push(`- Powerplay: ${special.powerPlay.opportunities} Gelegenheiten, ${special.powerPlay.goals} Tore (${special.powerPlay.percentage ?? 'unbekannt'}%)`);
    lines.push(`- Penalty Kill: ${special.penaltyKill.opportunities} Gelegenheiten, ${special.penaltyKill.goalsAgainst} Gegentore (${special.penaltyKill.percentage ?? 'unbekannt'}% gehalten)`);
  }

  lines.push('');
  lines.push('Nach Spielstand (Ereignisse, während dieser Zustand galt):');
  for (const bucket of situational.byScoreState) {
    const stateLabel = { leading: 'In Führung', trailing: 'Im Rückstand', tied: 'Unentschieden' }[bucket.scoreState];
    lines.push(`- ${stateLabel}: ${bucket.ownGoals} eigene Tore, ${bucket.opponentGoals} Gegentore, ${bucket.shots} Schüsse (Schuss-% ${bucket.shotPercentage ?? 'unbekannt'})`);
  }

  return lines.join('\n');
}

// POST /api/ai/game-insights – Statistik-Architektur Phase 9 (KI/ML-
// Grundlagen, "Pattern Detection, automatische Spiel-Insights").
// Wiederverwendet bewusst dieselbe KI-Provider-Abstraktion wie die
// anderen drei Entwurfs-Assistenten (EPIC 010) statt einer neuen
// KI-Anbindung – siehe Phasenplanungs-Review 2026-08-21 in
// docs/planning/BACKLOG.md. Eingabe sind ausschließlich bereits
// berechnete Team-Aggregate aus statisticsEngine.js, keine Rohereignisse
// und keine Personendaten (siehe formatStatsSummary/prompts/insights.md).
export async function generateGameInsights(req, res) {
  try {
    const provider = await getAiProvider();
    if (!provider) {
      return res.status(503).json(error('KI-Assistent ist auf dieser Instanz nicht konfiguriert'));
    }

    const { gameId } = req.body;
    if (!(await assertGameRead(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }

    const gameResult = await pool.query('SELECT opponent, clock_period_minutes FROM games WHERE id = $1', [gameId]);
    const game = gameResult.rows[0];
    const eventsResult = await pool.query('SELECT * FROM game_events WHERE game_id = $1', [gameId]);
    const events = eventsResult.rows;

    const { ownGoals, opponentGoals } = calculateMatchScore(events);
    const statsSummary = formatStatsSummary(events, game.clock_period_minutes ?? 20);
    const userPrompt = renderInsightsPrompt({
      opponent: game.opponent?.trim() || 'unbekannt',
      finalScore: `${ownGoals} : ${opponentGoals}`,
      statsSummary,
    });

    const { text, model } = await provider.generate({ systemPrompt: SYSTEM_PROMPT, userPrompt });
    res.json(success({
      insightsText: text,
      statsSummary,
      model,
      generatedAt: new Date().toISOString(),
      disclaimer: 'Von KI generiert – bitte vor dem Einsatz prüfen und anpassen.',
    }));
  } catch (err) {
    logger.error('[generateGameInsights]', err);
    res.status(502).json(error('KI-Anbieter konnte keinen Vorschlag liefern, bitte später erneut versuchen'));
  }
}

// POST /api/ai/knowledge-query – AI_SYSTEM.md §5.4. Anders als die drei
// anderen Assistenten: kein Entwurf zum Übernehmen, sondern eine reine
// Frage-Antwort mit Quellenangaben aus den eigenen Daten dieser Instanz.
// Ohne Treffer wird die KI gar nicht erst aufgerufen (kein Risiko einer
// erfundenen Antwort, siehe AI_SYSTEM.md §2 Explainable AI).
export async function generateKnowledgeAnswer(req, res) {
  try {
    const provider = await getAiProvider();
    if (!provider) {
      return res.status(503).json(error('KI-Assistent ist auf dieser Instanz nicht konfiguriert'));
    }

    const { question } = req.body;
    const matches = await findRelevantItems(req.user.id, question);
    const sources = [...matches.boards, ...matches.trainings, ...matches.libraryEntries]
      .map(({ type, id, name }) => ({ type, id, name }));

    if (sources.length === 0) {
      return res.json(success({
        hasMatches: false,
        answerText: null,
        sources: [],
        model: null,
        generatedAt: new Date().toISOString(),
        disclaimer: AI_DISCLAIMER,
      }));
    }

    const userPrompt = renderKnowledgePrompt({ question, context: buildKnowledgeContext(matches) });
    const { text, model } = await provider.generate({ systemPrompt: SYSTEM_PROMPT, userPrompt });

    res.json(success({
      hasMatches: true,
      answerText: text,
      model,
      sources,
      generatedAt: new Date().toISOString(),
      disclaimer: AI_DISCLAIMER,
    }));
  } catch (err) {
    logger.error('[generateKnowledgeAnswer]', err);
    res.status(502).json(error('KI-Anbieter konnte keine Antwort liefern, bitte später erneut versuchen'));
  }
}
