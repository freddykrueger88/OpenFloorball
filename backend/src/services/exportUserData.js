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

  // Playbooks werden VOR den Boards geladen, damit jedes Board seinen
  // Playbook-NAMEN (statt der ID, die beim Re-Import ohnehin verworfen
  // wird) mitbekommen kann – team_id bewusst nicht exportiert, siehe
  // Begründung bei Kader/Lines unten.
  const playbooksResult = await pool.query(
    'SELECT * FROM playbooks WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  const playbookNameById = new Map(playbooksResult.rows.map((p) => [p.id, p.name]));
  const playbooks = playbooksResult.rows.map((p) => ({
    name: p.name,
    createdAt: p.created_at,
  }));

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
      // Referenz per Name statt playbook_id (siehe playbookNameById oben) –
      // das importierte Playbook bekommt beim Re-Import ohnehin eine neue ID.
      playbookName: playbookNameById.get(b.playbook_id) ?? null,
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

  // Formationsvorlagen: nutzer-gebunden wie Kader/Lines, kein Cross-Reference
  // zu anderen Ressourcen (players_json ist ein reiner Snapshot).
  const formationsResult = await pool.query(
    'SELECT * FROM formation_templates WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  const formations = formationsResult.rows.map((f) => ({
    name: f.name,
    fieldType: f.field_type,
    players: f.players_json ?? [],
    createdAt: f.created_at,
  }));

  // Trainingspläne referenzieren Boards live per FK (training_session_items.
  // board_id, kein Snapshot) – beim Export wird das Board deshalb über
  // Name+Feldtyp+createdAt referenziert, genau der Schlüssel, den
  // importAccount schon für die Board-Duplikaterkennung nutzt (siehe unten).
  const sessionsResult = await pool.query(
    'SELECT * FROM training_sessions WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  const trainingSessions = [];
  for (const s of sessionsResult.rows) {
    const itemsResult = await pool.query(
      `SELECT i.order_index, i.duration_minutes, i.note,
              b.name AS board_name, b.field_type AS board_field_type, b.created_at AS board_created_at
       FROM training_session_items i
       JOIN boards b ON b.id = i.board_id
       WHERE i.session_id = $1 ORDER BY i.order_index ASC`,
      [s.id]
    );
    trainingSessions.push({
      name: s.name,
      notes: s.notes,
      scheduledDate: s.scheduled_date,
      goal: s.goal,
      createdAt: s.created_at,
      items: itemsResult.rows.map((i) => ({
        boardName: i.board_name,
        boardFieldType: i.board_field_type,
        boardCreatedAt: i.board_created_at,
        orderIndex: i.order_index,
        durationMinutes: i.duration_minutes,
        note: i.note,
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
    playbooks,
    formations,
    trainingSessions,
  };
}
