/**
 * teamSaisonmanagerController – optionale, rein lesende Anbindung eines
 * Teams an die externe Saisonmanager-Liga-Verwaltung (Spieler-Dashboard-
 * Ausbau, siehe backend/src/services/saisonmanagerClient.js für die
 * Recherche-Grundlage/Quellenlage).
 *
 * Verbindung verwalten (setzen/lesen/trennen) ist owner-only, exakt wie
 * teamsController.js::updateTeam/deleteTeam. Die abgeleiteten Daten
 * (nächstes Spiel/Tabelle) darf jedes Team-Mitglied lesen (wie der
 * restliche team-geteilte Inhalt).
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, error } from '../utils/apiResponse.js';
import { getTeamRole } from '../utils/teamAccess.js';
import { fetchNextMatch, fetchTable, SaisonmanagerError } from '../services/saisonmanagerClient.js';

async function getLinkRow(teamId) {
  const result = await pool.query('SELECT * FROM team_saisonmanager_links WHERE team_id = $1', [teamId]);
  return result.rows[0] ?? null;
}

// GET /api/teams/:id/saisonmanager – owner-only, api_key bleibt serverseitig
export async function getSaisonmanagerLink(req, res) {
  try {
    const role = await getTeamRole(req.params.id, req.user.id);
    if (role !== 'owner') {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    const link = await getLinkRow(req.params.id);
    res.json(success(link
      ? { connected: true, leagueId: link.league_id, smTeamId: link.sm_team_id }
      : { connected: false }));
  } catch (err) {
    logger.error('[getSaisonmanagerLink]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/teams/:id/saisonmanager – owner-only, Upsert
export async function setSaisonmanagerLink(req, res) {
  try {
    const role = await getTeamRole(req.params.id, req.user.id);
    if (role !== 'owner') {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    const { apiKey, leagueId, smTeamId } = req.body;
    await pool.query(
      `INSERT INTO team_saisonmanager_links (team_id, api_key, league_id, sm_team_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (team_id) DO UPDATE SET api_key = $2, league_id = $3, sm_team_id = $4`,
      [req.params.id, apiKey, leagueId, smTeamId, req.user.id]
    );
    res.json(success({ connected: true, leagueId, smTeamId }));
  } catch (err) {
    logger.error('[setSaisonmanagerLink]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/teams/:id/saisonmanager – owner-only
export async function deleteSaisonmanagerLink(req, res) {
  try {
    const role = await getTeamRole(req.params.id, req.user.id);
    if (role !== 'owner') {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    await pool.query('DELETE FROM team_saisonmanager_links WHERE team_id = $1', [req.params.id]);
    res.json(success({ connected: false }));
  } catch (err) {
    logger.error('[deleteSaisonmanagerLink]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/teams/:id/saisonmanager/next-match – jedes Team-Mitglied.
// Liefert `null` statt eines Fehlers, wenn nicht verbunden ODER wenn
// Saisonmanager gerade nicht erreichbar ist – ein Netzwerkfehler bei einem
// rein optionalen Zusatzfeature darf das Dashboard nie kaputt machen,
// lokale Daten bleiben in diesem Fall der Fallback (siehe useDashboardData.js).
export async function getNextMatch(req, res) {
  try {
    const role = await getTeamRole(req.params.id, req.user.id);
    if (!role) {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    const link = await getLinkRow(req.params.id);
    if (!link) {
      return res.json(success(null));
    }
    try {
      const nextMatch = await fetchNextMatch({ apiKey: link.api_key, leagueId: link.league_id, smTeamId: link.sm_team_id });
      res.json(success(nextMatch));
    } catch (err) {
      if (err instanceof SaisonmanagerError) {
        logger.error('[getNextMatch] Saisonmanager nicht erreichbar/fehlerhaft:', err);
        return res.json(success(null));
      }
      throw err;
    }
  } catch (err) {
    logger.error('[getNextMatch]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/teams/:id/saisonmanager/table – jedes Team-Mitglied, gleicher
// Fallback wie getNextMatch bei Nichterreichbarkeit.
export async function getTable(req, res) {
  try {
    const role = await getTeamRole(req.params.id, req.user.id);
    if (!role) {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    const link = await getLinkRow(req.params.id);
    if (!link) {
      return res.json(success(null));
    }
    try {
      const table = await fetchTable({ apiKey: link.api_key, leagueId: link.league_id, smTeamId: link.sm_team_id });
      res.json(success(table));
    } catch (err) {
      if (err instanceof SaisonmanagerError) {
        logger.error('[getTable] Saisonmanager nicht erreichbar/fehlerhaft:', err);
        return res.json(success(null));
      }
      throw err;
    }
  } catch (err) {
    logger.error('[getTable]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
