/**
 * boardsController – CRUD für Spielfelder (Boards)
 *
 * Persistenz: PostgreSQL (siehe db/migrate.js), NICHT Mongoose/MongoDB.
 * Alle Boards sind an req.user.id (JWT, via authenticate-Middleware) gebunden –
 * ein User sieht/bearbeitet ausschließlich eigene Boards.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { buildDefaultPlayers } from '../constants/defaultPositions.js';
import { getBoardAccessLevel } from '../utils/boardAccess.js';
import { assertTeamAccess } from '../utils/teamAccess.js';
import { deleteVideosForBoard } from './videoController.js';

// snake_case (DB) → camelCase (API/Frontend)
function toApiBoard(row) {
  return {
    _id:          row.id,
    name:         row.name,
    notes:        row.notes,
    fieldType:    row.field_type,
    theme:        row.theme,
    homeColor:    row.home_color,
    awayColor:    row.away_color,
    ballColor:    row.ball_color,
    showGrid:     row.show_grid,
    showNames:    row.show_names,
    namePosition: row.name_position,
    players:      row.players_json,
    elements:     row.elements_json,
    playbookId:   row.playbook_id,
    opponent:     row.opponent,
    category:     row.category,
    ageGroup:     row.age_group,
    goal:         row.goal,
    material:     row.material,
    // Issue #51 MVP – 'owner' | 'write' | 'read', fehlt die Spalte (z.B.
    // direkt nach createBoard/updateBoard) ist der Requester immer Owner.
    accessLevel:  row.access_level ?? 'owner',
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  };
}

// Issue #52: verhindert Zuordnung eines Boards zu einem fremden Playbook.
// ROADMAP Phase 2: auch team-geteilte Playbooks erlaubt – Zuordnen eines
// eigenen Boards ändert das Playbook selbst nicht, daher reicht bloße
// Team-Mitgliedschaft (keine coach/owner-Rolle nötig wie beim Anlegen).
async function assertPlaybookOwnership(playbookId, userId) {
  const result = await pool.query(
    'SELECT id, user_id, team_id FROM playbooks WHERE id = $1',
    [playbookId]
  );
  const playbook = result.rows[0];
  if (!playbook) return false;
  if (playbook.user_id === userId) return true;
  if (!playbook.team_id) return false;
  return assertTeamAccess(playbook.team_id, userId, 'member');
}

// GET /api/boards – Metadaten + players_json (für die Postkarten-Galerie-
// Miniatur, siehe FieldMiniature), aber bewusst OHNE elements_json (Freihand-
// Zeichnungen können groß werden, für die reine Übersicht nicht nötig).
// Issue #51 MVP: neben eigenen Boards auch mit dem Nutzer geteilte Boards.
export async function getBoards(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM (
         SELECT id, name, notes, field_type, theme, home_color, away_color, ball_color,
                show_grid, show_names, name_position, playbook_id, opponent,
                category, age_group, goal, material, players_json, created_at, updated_at,
                'owner'::text AS access_level
         FROM boards
         WHERE user_id = $1 AND deleted_at IS NULL
         UNION ALL
         SELECT b.id, b.name, b.notes, b.field_type, b.theme, b.home_color, b.away_color, b.ball_color,
                b.show_grid, b.show_names, b.name_position, b.playbook_id, b.opponent,
                b.category, b.age_group, b.goal, b.material, b.players_json, b.created_at, b.updated_at,
                bc.permission AS access_level
         FROM boards b
         JOIN board_collaborators bc ON bc.board_id = b.id
         WHERE bc.user_id = $1 AND b.deleted_at IS NULL
       ) combined
       ORDER BY updated_at DESC
       LIMIT 200`,
      [req.user.id]
    );
    res.json(success(result.rows.map(toApiBoard)));
  } catch (err) {
    logger.error('[getBoards]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/boards/:id
export async function getBoard(req, res) {
  try {
    const accessLevel = await getBoardAccessLevel(req.params.id, req.user.id);
    if (!accessLevel) {
      return res.status(404).json(error('Spielfeld nicht gefunden'));
    }
    const result = await pool.query(
      `SELECT * FROM boards WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Spielfeld nicht gefunden'));
    }
    res.json(success(toApiBoard({ ...result.rows[0], access_level: accessLevel })));
  } catch (err) {
    logger.error('[getBoard]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/boards
// Legt Board + ersten Frame mit Standard-Aufstellung atomar in einer
// Transaktion an – Spieler stehen dadurch garantiert ab dem ersten
// Laden auf dem Feld, unabhängig von Client-seitigem Timing.
export async function createBoard(req, res) {
  const {
    name, fieldType = 'large', theme = 'dark',
    homeColor = '#1d4ed8', awayColor = '#dc2626', ballColor = '#ffffff',
    playbookId = null, opponent = '',
    category = '', ageGroup = '', goal = '', material = '',
    // EPIC 010 – KI-Taktik-/Analyseassistent: optional direkt beim Anlegen
    // setzbar, damit "Übernehmen" ein einzelner Request ist (analog
    // trainingSessionsController.js createSession).
    notes = '',
  } = req.body;

  try {
    if (playbookId && !(await assertPlaybookOwnership(playbookId, req.user.id))) {
      return res.status(404).json(error('Playbook nicht gefunden'));
    }
  } catch (err) {
    logger.error('[createBoard]', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO boards (user_id, name, field_type, theme, home_color, away_color, ball_color, playbook_id, opponent,
                            category, age_group, goal, material, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [req.user.id, name, fieldType, theme, homeColor, awayColor, ballColor, playbookId, opponent,
       category, ageGroup, goal, material, notes]
    );
    const board = result.rows[0];

    // Issue 025: neue Boards zeigen standardmäßig nur die eigene
    // Mannschaft – die meisten Taktiken (Spielaufbau, Systeme,
    // Trainingsformen) betreffen zunächst nur das eigene Team, eine
    // volle gegnerische Aufstellung war unnötiges Rauschen.
    const dataJson = { label: '', players: buildDefaultPlayers(fieldType, { includeAway: false }), elements: [] };
    await client.query(
      `INSERT INTO frames (board_id, order_index, data_json, duration_ms)
       VALUES ($1, 0, $2::jsonb, 1000)`,
      [board.id, JSON.stringify(dataJson)]
    );

    await client.query('COMMIT');
    res.status(201).json(created(toApiBoard(board)));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[createBoard]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// PUT /api/boards/:id
const UPDATABLE_COLUMNS = {
  name:         'name',
  notes:        'notes',
  fieldType:    'field_type',
  theme:        'theme',
  homeColor:    'home_color',
  awayColor:    'away_color',
  ballColor:    'ball_color',
  showGrid:     'show_grid',
  showNames:    'show_names',
  namePosition: 'name_position',
  players:      'players_json',
  elements:     'elements_json',
  playbookId:   'playbook_id',
  opponent:     'opponent',
  category:     'category',
  ageGroup:     'age_group',
  goal:         'goal',
  material:     'material',
};

export async function updateBoard(req, res) {
  try {
    // Issue #51 MVP: Owner ODER write-Kollaborator darf ändern (Löschen/
    // Sharing bleiben separat strikt Owner-only, siehe deleteBoard unten
    // und boardCollaboratorsController.js).
    const accessLevel = await getBoardAccessLevel(req.params.id, req.user.id);
    if (accessLevel !== 'owner' && accessLevel !== 'write') {
      return res.status(404).json(error('Spielfeld nicht gefunden'));
    }

    if (req.body.playbookId && !(await assertPlaybookOwnership(req.body.playbookId, req.user.id))) {
      return res.status(404).json(error('Playbook nicht gefunden'));
    }

    const sets = [];
    const values = [];
    let i = 1;

    for (const [apiKey, column] of Object.entries(UPDATABLE_COLUMNS)) {
      if (req.body[apiKey] !== undefined) {
        const isJson = column.endsWith('_json');
        sets.push(`${column} = $${i}${isJson ? '::jsonb' : ''}`);
        values.push(isJson ? JSON.stringify(req.body[apiKey]) : req.body[apiKey]);
        i += 1;
      }
    }

    if (sets.length === 0) {
      return res.status(400).json(error('Keine gültigen Felder zum Aktualisieren'));
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE boards SET ${sets.join(', ')}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error('Spielfeld nicht gefunden'));
    }
    res.json(success(toApiBoard({ ...result.rows[0], access_level: accessLevel })));
  } catch (err) {
    logger.error('[updateBoard]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/boards/:id (Soft-Delete)
export async function deleteBoard(req, res) {
  try {
    const result = await pool.query(
      `UPDATE boards SET deleted_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Spielfeld nicht gefunden'));
    }
    // Boards werden nur soft-deleted – der ON DELETE CASCADE von
    // board_videos greift daher nie von selbst. Video-Dateien explizit
    // mitlöschen, sonst bleiben u.U. große Dateien für immer auf Platte.
    await deleteVideosForBoard(req.params.id);
    res.json(success({ message: 'Spielfeld gelöscht' }));
  } catch (err) {
    logger.error('[deleteBoard]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
