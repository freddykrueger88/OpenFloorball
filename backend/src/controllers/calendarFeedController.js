/**
 * calendarFeedController – ICS-Kalender-Abo (Roadmap-Audit).
 *
 * Zwei Zugriffsarten: die Verwaltung des Tokens (GET/POST/DELETE unter
 * /api/user/calendar-feed) läuft authentifiziert wie jede andere
 * Account-Einstellung; der eigentliche Feed (GET /api/calendar-feed/
 * :token.ics) ist bewusst ÖFFENTLICH (kein `authenticate`), da
 * Kalender-Clients (Google/Apple/Outlook) die URL wiederholt ohne
 * Login abfragen müssen – exakt wie shareController.js/
 * inviteController.js, siehe deren Modul-Kommentare.
 */
import { randomUUID } from 'crypto';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, error } from '../utils/apiResponse.js';
import { getUserTeamIds } from '../utils/teamAccess.js';
import { buildIcsFeed } from '../utils/ics.js';

function feedUrlFor(req, token) {
  return `${req.protocol}://${req.get('host')}/api/calendar-feed/${token}.ics`;
}

// GET /api/user/calendar-feed
export async function getFeedStatus(req, res) {
  try {
    const result = await pool.query('SELECT calendar_feed_token FROM users WHERE id = $1', [req.user.id]);
    const token = result.rows[0]?.calendar_feed_token ?? null;
    res.json(success({ feedUrl: token ? feedUrlFor(req, token) : null }));
  } catch (err) {
    logger.error('[getFeedStatus]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/user/calendar-feed – erzeugt einen neuen Token oder
// ersetzt einen bestehenden vollständig (macht die alte URL sofort
// ungültig, siehe Modul-Kommentar in migrate.js).
export async function generateFeedToken(req, res) {
  try {
    const token = randomUUID();
    await pool.query('UPDATE users SET calendar_feed_token = $1 WHERE id = $2', [token, req.user.id]);
    res.json(success({ feedUrl: feedUrlFor(req, token) }));
  } catch (err) {
    logger.error('[generateFeedToken]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/user/calendar-feed – widerruft den Feed vollständig.
export async function revokeFeedToken(req, res) {
  try {
    await pool.query('UPDATE users SET calendar_feed_token = NULL WHERE id = $1', [req.user.id]);
    res.json(success({ feedUrl: null }));
  } catch (err) {
    logger.error('[revokeFeedToken]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/calendar-feed/:token.ics – ÖFFENTLICH.
export async function getIcsFeed(req, res) {
  try {
    const userResult = await pool.query('SELECT id FROM users WHERE calendar_feed_token = $1', [req.params.token]);
    const userId = userResult.rows[0]?.id;
    if (!userId) {
      return res.status(404).json(error('Kalender-Feed nicht gefunden'));
    }

    const teamIds = await getUserTeamIds(userId);
    const gamesResult = await pool.query(
      `SELECT id, opponent, played_at FROM games
       WHERE (user_id = $1 OR team_id = ANY($2::uuid[])) AND played_at IS NOT NULL`,
      [userId, teamIds]
    );
    const sessionsResult = await pool.query(
      `SELECT id, name, scheduled_date FROM training_sessions
       WHERE (user_id = $1 OR team_id = ANY($2::uuid[])) AND scheduled_date IS NOT NULL`,
      [userId, teamIds]
    );

    const events = [
      ...gamesResult.rows.map((g) => ({
        uid: `game-${g.id}@openfloorball`,
        dateStr: g.played_at.toISOString().slice(0, 10),
        summary: g.opponent || 'Spiel',
      })),
      ...sessionsResult.rows.map((s) => ({
        uid: `session-${s.id}@openfloorball`,
        dateStr: s.scheduled_date.toISOString().slice(0, 10),
        summary: s.name,
      })),
    ];

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.send(buildIcsFeed(events));
  } catch (err) {
    logger.error('[getIcsFeed]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
