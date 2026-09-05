/**
 * csvExportController – CSV-Export (Statistik-Architektur Phase 7,
 * Phasenplanungs-Review 2026-08-21): ersetzt das ursprünglich vage
 * "Report Builder"-Ziel durch einen konkret abgegrenzten Export.
 *
 * JSON-Datenportabilität existiert für dieselben Daten bereits über
 * GET /api/roster/stats bzw. GET /api/games (CLAUDE.md §5.3, keine
 * zusätzliche parallele JSON-Route nötig) – der eigentliche, bisher
 * fehlende Mehrwert ist CSV (direkt in Excel/Sheets nutzbar), siehe
 * "Export ausbauen" in der Wettbewerbs-Analyse,
 * STATISTICS_ANALYTICS_ARCHITECTURE.md Abschnitt 7.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { logAudit } from '../services/auditLogger.js';
import { error } from '../utils/apiResponse.js';
import { getUserTeamIds } from '../utils/teamAccess.js';
import { toCsv } from '../utils/csv.js';
import { fetchRosterStats } from './rosterController.js';
import { calculateMatchScore } from '../services/statisticsEngine.js';

// node-postgres liefert DATE-Spalten als Date-Objekt in der lokalen
// Zeitzone – lokale Getter statt toISOString() (gleiches Muster wie
// gamesController.js/rosterController.js).
function toDateString(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ROSTER_STATS_COLUMNS = [
  { key: 'name',            header: 'Name' },
  { key: 'jerseyNumber',    header: 'Nummer' },
  { key: 'team',            header: 'Team' },
  { key: 'goals',           header: 'Tore' },
  { key: 'assists',         header: 'Vorlagen' },
  { key: 'points',          header: 'Punkte' },
  { key: 'penaltyMinutes',  header: 'Strafminuten' },
  { key: 'matchPenalties',  header: 'Matchstrafen' },
  { key: 'appearances',     header: 'Einsätze' },
  { key: 'shots',           header: 'Schüsse' },
  { key: 'shotPercentage',  header: 'Schuss-%' },
  { key: 'goalsAgainst',    header: 'Gegentore' },
  { key: 'savePercentage',  header: 'Fangquote-%' },
  { key: 'attendanceRate',  header: 'Trainings-%' },
];

// GET /api/export/roster-stats.csv – dieselben Kennzahlen wie /stats,
// als Datei statt Bildschirm-Tabelle. Team-Name statt team_id (roher
// UUID-Wert wäre in einer Tabellenkalkulation nutzlos).
export async function exportRosterStatsCsv(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const rows = await fetchRosterStats(req.user.id, teamIds);

    let teamNames = new Map();
    if (teamIds.length > 0) {
      const teamsResult = await pool.query('SELECT id, name FROM teams WHERE id = ANY($1::uuid[])', [teamIds]);
      teamNames = new Map(teamsResult.rows.map((t) => [t.id, t.name]));
    }

    const csvRows = rows.map((r) => ({
      ...r,
      team: r.teamId ? (teamNames.get(r.teamId) ?? '') : '',
    }));

    const csv = toCsv(csvRows, ROSTER_STATS_COLUMNS);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="openfloorball-statistik.csv"');
    // BOM, damit Excel die Datei zuverlässig als UTF-8 statt Latin-1 erkennt
    // (Umlaute in Spielernamen sonst falsch dargestellt).
    res.send(`\uFEFF${csv}`);
    await logAudit({ actorId: req.user.id, action: 'export.roster-stats.csv', resourceType: 'export' });
  } catch (err) {
    logger.error('[exportRosterStatsCsv]', err);
    if (!res.headersSent) res.status(500).json(error('Interner Serverfehler'));
  }
}

const GAMES_COLUMNS = [
  { key: 'playedAt',       header: 'Datum' },
  { key: 'opponent',       header: 'Gegner' },
  { key: 'team',           header: 'Team' },
  { key: 'ownGoals',       header: 'Tore eigen' },
  { key: 'opponentGoals',  header: 'Tore Gegner' },
];

// GET /api/export/games.csv – ein Spiel pro Zeile inkl. Endstand
// (calculateMatchScore, dieselbe zentrale Formel wie überall sonst,
// ADR-0001/Statistics Engine). Ein Query für alle Events aller Spiele
// statt N Einzelabfragen (Statistik-Architektur, Performance-Prinzip
// §24 – naheliegende Vermeidung von N+1, ohne verfrühte Optimierung).
export async function exportGamesCsv(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const gamesResult = await pool.query(
      `SELECT g.id, g.opponent, g.played_at, g.team_id, t.name AS team_name
       FROM games g LEFT JOIN teams t ON t.id = g.team_id
       WHERE g.user_id = $1 OR g.team_id = ANY($2::uuid[])
       ORDER BY g.played_at DESC NULLS FIRST, g.updated_at DESC`,
      [req.user.id, teamIds]
    );
    const gameIds = gamesResult.rows.map((g) => g.id);
    const eventsResult = gameIds.length > 0
      ? await pool.query('SELECT * FROM game_events WHERE game_id = ANY($1::uuid[])', [gameIds])
      : { rows: [] };

    const eventsByGame = new Map();
    for (const row of eventsResult.rows) {
      if (!eventsByGame.has(row.game_id)) eventsByGame.set(row.game_id, []);
      eventsByGame.get(row.game_id).push(row);
    }

    const csvRows = gamesResult.rows.map((g) => {
      const { ownGoals, opponentGoals } = calculateMatchScore(eventsByGame.get(g.id) ?? []);
      return {
        playedAt: toDateString(g.played_at) ?? '',
        opponent: g.opponent || '',
        team: g.team_name ?? '',
        ownGoals,
        opponentGoals,
      };
    });

    const csv = toCsv(csvRows, GAMES_COLUMNS);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="openfloorball-spiele.csv"');
    res.send(`\uFEFF${csv}`);
    await logAudit({ actorId: req.user.id, action: 'export.games.csv', resourceType: 'export' });
  } catch (err) {
    logger.error('[exportGamesCsv]', err);
    if (!res.headersSent) res.status(500).json(error('Interner Serverfehler'));
  }
}
