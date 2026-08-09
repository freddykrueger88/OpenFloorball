/**
 * linesController – Lines: taktische Zusammenstellungen echter
 * Kader-Spieler, wiederverwendbar über Boards/Spiele hinweg
 * (fachlicher Umbau, siehe CHANGELOG – ersetzt die alte, board-gescopte
 * Version, die nur anonyme Platzhalter-Tokens EINES Board-Frames
 * gruppierte, ohne Bezug zum echten Kader).
 *
 * Nutzer-/team-gebunden wie roster_players/games – NICHT board-gebunden.
 * Spieler-Zuordnung läuft über die Junction-Tabelle line_players
 * (many-to-many): ein Kader-Spieler darf in beliebig vielen Lines
 * stehen, eine Line enthält beliebig viele Kader-Spieler. Zugriff
 * analog assertGameRead/-Write (gamesController.js): lesen dürfen alle
 * Team-Mitglieder, ändern nur owner/coach.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { getUserTeamIds, assertTeamAccess } from '../utils/teamAccess.js';

const MAX_LINES = 20;

function toApiLine(row, players = []) {
  return {
    _id:       row.id,
    name:      row.name,
    color:     row.color,
    type:      row.type,
    teamId:    row.team_id,
    isActive:  row.is_active,
    players,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toApiLinePlayer(row) {
  return {
    _id:          row.roster_player_id,
    name:         row.name,
    jerseyNumber: row.jersey_number,
    role:         row.role,
    order:        row.order_index,
  };
}

async function getLineRow(lineId) {
  const result = await pool.query('SELECT * FROM lines WHERE id = $1', [lineId]);
  return result.rows[0] ?? null;
}

async function fetchPlayersForLine(lineId) {
  const result = await pool.query(
    `SELECT lp.roster_player_id, lp.order_index, r.name, r.jersey_number, r.role
     FROM line_players lp
     JOIN roster_players r ON r.id = lp.roster_player_id
     WHERE lp.line_id = $1
     ORDER BY lp.order_index ASC`,
    [lineId]
  );
  return result.rows.map(toApiLinePlayer);
}

export async function assertLineRead(lineId, userId) {
  const line = await getLineRow(lineId);
  if (!line) return false;
  if (line.user_id === userId) return true;
  if (!line.team_id) return false;
  return assertTeamAccess(line.team_id, userId, 'member');
}

export async function assertLineWrite(lineId, userId) {
  const line = await getLineRow(lineId);
  if (!line) return false;
  if (line.user_id === userId) return true;
  if (!line.team_id) return false;
  return assertTeamAccess(line.team_id, userId, 'coach');
}

// GET /api/lines
export async function getLines(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const result = await pool.query(
      `SELECT * FROM lines WHERE user_id = $1 OR team_id = ANY($2::uuid[])
       ORDER BY created_at ASC`,
      [req.user.id, teamIds]
    );
    const lines = await Promise.all(
      result.rows.map(async (row) => toApiLine(row, await fetchPlayersForLine(row.id)))
    );
    res.json(success(lines));
  } catch (err) {
    logger.error('[getLines]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/lines
export async function createLine(req, res) {
  try {
    const { name, color = '#3B82F6', type = 'offense', teamId = null } = req.body;

    if (teamId && !(await assertTeamAccess(teamId, req.user.id, 'coach'))) {
      return res.status(404).json(error('Team nicht gefunden'));
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM lines WHERE user_id = $1',
      [req.user.id]
    );
    if (countResult.rows[0].count >= MAX_LINES) {
      return res.status(400).json(error(`Maximal ${MAX_LINES} Lines`));
    }

    const result = await pool.query(
      `INSERT INTO lines (user_id, name, color, type, team_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, name, color, type, teamId]
    );
    res.status(201).json(created(toApiLine(result.rows[0], [])));
  } catch (err) {
    logger.error('[createLine]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/lines/:id
export async function updateLine(req, res) {
  try {
    if (!(await assertLineWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Line nicht gefunden'));
    }

    const sets = [];
    const values = [];
    let i = 1;
    if (req.body.name !== undefined)  { sets.push(`name = $${i}`);  values.push(req.body.name);  i += 1; }
    if (req.body.color !== undefined) { sets.push(`color = $${i}`); values.push(req.body.color); i += 1; }
    if (req.body.type !== undefined)  { sets.push(`type = $${i}`);  values.push(req.body.type);  i += 1; }

    if (sets.length === 0) {
      return res.status(400).json(error('Keine gültigen Felder zum Aktualisieren'));
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE lines SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    res.json(success(toApiLine(result.rows[0], await fetchPlayersForLine(req.params.id))));
  } catch (err) {
    logger.error('[updateLine]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/lines/:id – löscht nur die Line + ihre Zuordnungen
// (line_players, per CASCADE), Kader-Spieler bleiben unberührt.
export async function deleteLine(req, res) {
  try {
    if (!(await assertLineWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Line nicht gefunden'));
    }
    await pool.query('DELETE FROM lines WHERE id = $1', [req.params.id]);
    res.json(success({ message: 'Line gelöscht' }));
  } catch (err) {
    logger.error('[deleteLine]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/lines/:id/players   Body: { rosterPlayerId }
export async function addPlayerToLine(req, res) {
  try {
    const line = await getLineRow(req.params.id);
    if (!line || !(await assertLineWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Line nicht gefunden'));
    }

    const { rosterPlayerId } = req.body;
    const rosterResult = await pool.query(
      'SELECT user_id, team_id FROM roster_players WHERE id = $1',
      [rosterPlayerId]
    );
    const rosterRow = rosterResult.rows[0];
    if (!rosterRow) {
      return res.status(404).json(error('Spieler nicht gefunden'));
    }
    // Der Spieler muss zur selben Sichtbarkeits-Gruppe gehören wie die Line
    // (team-geteilte Line -> Kader dieses Teams, persönliche Line -> eigener
    // persönlicher Kader) – verhindert, dass fremde/unpassende Spieler-IDs
    // einer Line zugeordnet werden.
    const sameScope = line.team_id
      ? rosterRow.team_id === line.team_id
      : rosterRow.user_id === req.user.id && !rosterRow.team_id;
    if (!sameScope) {
      return res.status(400).json(error('Spieler gehört nicht zum Kader dieser Line'));
    }

    const existing = await pool.query(
      'SELECT id FROM line_players WHERE line_id = $1 AND roster_player_id = $2',
      [req.params.id, rosterPlayerId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json(error('Spieler ist bereits in dieser Line'));
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM line_players WHERE line_id = $1',
      [req.params.id]
    );
    await pool.query(
      'INSERT INTO line_players (line_id, roster_player_id, order_index) VALUES ($1, $2, $3)',
      [req.params.id, rosterPlayerId, countResult.rows[0].count]
    );

    res.status(201).json(success(await fetchPlayersForLine(req.params.id)));
  } catch (err) {
    logger.error('[addPlayerToLine]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/lines/:id/players/:rosterPlayerId – entfernt nur die
// Zuordnung, der Kader-Spieler selbst bleibt erhalten (§13 des Auftrags).
export async function removePlayerFromLine(req, res) {
  try {
    if (!(await assertLineWrite(req.params.id, req.user.id))) {
      return res.status(404).json(error('Line nicht gefunden'));
    }
    await pool.query(
      'DELETE FROM line_players WHERE line_id = $1 AND roster_player_id = $2',
      [req.params.id, req.params.rosterPlayerId]
    );
    res.json(success(await fetchPlayersForLine(req.params.id)));
  } catch (err) {
    logger.error('[removePlayerFromLine]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/lines/:id/active   Body: { active: boolean }
// Aktivieren deaktiviert zuerst alle anderen Lines derselben
// Sichtbarkeits-Gruppe (gleiches team_id, sonst alle persönlichen Lines
// desselben Nutzers) – immer nur eine aktive Line pro Gruppe, wie beim
// alten board-gescopten Modell, nur jetzt gruppen- statt board-weit.
export async function setLineActive(req, res) {
  const client = await pool.connect();
  try {
    if (!(await assertLineWrite(req.params.id, req.user.id))) {
      client.release();
      return res.status(404).json(error('Line nicht gefunden'));
    }
    const line = await getLineRow(req.params.id);
    const { active } = req.body;

    await client.query('BEGIN');
    if (active) {
      if (line.team_id) {
        await client.query('UPDATE lines SET is_active = false WHERE team_id = $1 AND id != $2', [line.team_id, req.params.id]);
      } else {
        await client.query(
          'UPDATE lines SET is_active = false WHERE user_id = $1 AND team_id IS NULL AND id != $2',
          [line.user_id, req.params.id]
        );
      }
    }
    const result = await client.query(
      'UPDATE lines SET is_active = $1 WHERE id = $2 RETURNING *',
      [!!active, req.params.id]
    );
    await client.query('COMMIT');
    res.json(success(toApiLine(result.rows[0], await fetchPlayersForLine(req.params.id))));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[setLineActive]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}
