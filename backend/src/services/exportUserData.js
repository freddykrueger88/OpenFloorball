/**
 * exportUserData – Baut das vollständige Backup-JSON eines Users
 * (Issue #21). Wird sowohl vom manuellen Export (routes/user.js) als
 * auch vom automatischen Backup-Cron (services/backupCron.js) genutzt.
 */
import pool from '../db/pool.js';
import { toApiFrame } from '../controllers/framesController.js';

export const BACKUP_FORMAT = 'openfloorball-backup-v1';

export async function buildUserExport(userId) {
  const userResult = await pool.query(
    'SELECT email, display_name AS name, role, created_at FROM users WHERE id = $1',
    [userId]
  );
  if (userResult.rows.length === 0) {
    throw new Error('Benutzer nicht gefunden');
  }
  const account = userResult.rows[0];

  const settingsResult = await pool.query(
    'SELECT preferences_json FROM settings WHERE user_id = $1',
    [userId]
  );
  const settings = settingsResult.rows[0]?.preferences_json ?? {};

  const boardsResult = await pool.query(
    `SELECT * FROM boards WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
    [userId]
  );

  const boards = [];
  for (const b of boardsResult.rows) {
    const framesResult = await pool.query(
      'SELECT * FROM frames WHERE board_id = $1 ORDER BY order_index ASC',
      [b.id]
    );

    boards.push({
      name:         b.name,
      notes:        b.notes,
      fieldType:    b.field_type,
      theme:        b.theme,
      homeColor:    b.home_color,
      awayColor:    b.away_color,
      ballColor:    b.ball_color,
      showGrid:     b.show_grid,
      showNames:    b.show_names,
      namePosition: b.name_position,
      createdAt:    b.created_at,
      frames:       framesResult.rows.map(toApiFrame),
    });
  }

  // Kader + Lines sind nutzer-, nicht board-gebunden (fachlicher Umbau:
  // Lines sind taktische Zusammenstellungen echter Kader-Spieler, siehe
  // linesController.js) – deshalb Top-Level statt pro Board. Nur eigene
  // Einträge (WHERE user_id = userId), keine team-geteilten Einträge
  // anderer Nutzer – der Export enthält ausschließlich Daten, die diesem
  // Account gehören. team_id wird bewusst NICHT exportiert/wiederhergestellt:
  // ein Re-Import (ggf. in einen anderen Account) kann keine sinnvolle
  // Team-Zuordnung herstellen, importierte Einträge sind daher immer
  // persönlich.
  const rosterResult = await pool.query(
    'SELECT * FROM roster_players WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  const rosterPlayers = rosterResult.rows.map((r) => ({
    name: r.name,
    jerseyNumber: r.jersey_number,
    role: r.role,
  }));

  const linesResult = await pool.query(
    'SELECT * FROM lines WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  const lines = [];
  for (const l of linesResult.rows) {
    const playersResult = await pool.query(
      `SELECT r.name, r.jersey_number, r.role, lp.order_index
       FROM line_players lp JOIN roster_players r ON r.id = lp.roster_player_id
       WHERE lp.line_id = $1 ORDER BY lp.order_index ASC`,
      [l.id]
    );
    lines.push({
      name: l.name,
      color: l.color,
      type: l.type,
      // Spieler werden über Name+Nummer+Rolle referenziert statt über die
      // alte DB-ID, da roster_players beim Re-Import ohnehin frische IDs
      // bekommt (siehe userController.importAccount).
      players: playersResult.rows.map((p) => ({
        name: p.name, jerseyNumber: p.jersey_number, role: p.role, order: p.order_index,
      })),
    });
  }

  return {
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    account: {
      email: account.email,
      name: account.name,
      role: account.role,
      createdAt: account.created_at,
    },
    settings,
    boards,
    rosterPlayers,
    lines,
  };
}
