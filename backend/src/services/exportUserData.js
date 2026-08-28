/**
 * exportUserData – Baut das vollständige Backup-JSON eines Users
 * (Issue #21). Wird sowohl vom manuellen Export (routes/user.js) als
 * auch vom automatischen Backup-Cron (services/backupCron.js) genutzt.
 *
 * Issue 026 (2026-08-28): games/game_events/game_squad/match_lines
 * (EPIC 012 Phase 1-4) sowie training_attendance/player_development_notes
 * (EPIC 012 Phase 5) ergänzt – vorher deckte der Export weder die
 * Spiel-Domäne noch diese beiden neueren Trainings-Tabellen ab
 * (Art. 15-Auskunft war dadurch unvollständig). Bewusst additiv, KEINE
 * neue BACKUP_FORMAT-Version: alle neuen Felder sind optionale
 * Top-Level-/verschachtelte Arrays, `importAccount` behandelt ihr Fehlen
 * (alte Backups) bereits über `?? []`-Fallbacks wie bei allen bisherigen
 * additiven Feldern (formations/playbooks/trainingSessions).
 */
import pool from '../db/pool.js';
import { toApiFrame } from '../controllers/framesController.js';

export const BACKUP_FORMAT = 'openfloorball-backup-v1';

// DATE-Spalten (games.played_at) liefert node-postgres als Date-Objekt in
// der lokalen Zeitzone des Prozesses – über die lokalen Getter statt
// toISOString() in "YYYY-MM-DD" wandeln, sonst kann JSON.stringify beim
// Export je nach Zeitzone auf den Vor-/Folgetag verschieben (identisches
// Problem/Lösung wie gamesController.toDateString, hier separat gehalten,
// da dort nicht exportiert).
function toDateString(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
  const rosterPlayers = [];
  for (const r of rosterResult.rows) {
    // Nur vom exportierenden Nutzer selbst verfasste Notizen (Issue 026) –
    // Notizen sind personenbezogene Beobachtungen ÜBER einen Spieler, ihr
    // Autor entscheidet über deren Export, nicht der Kader-Besitzer.
    // Referenz auf eine Trainingseinheit per Name+Erstellungszeitpunkt
    // (derselbe Schlüssel wie bei trainingSessions/boardName oben), da
    // training_session_id beim Re-Import ohnehin eine neue ID bekäme.
    const notesResult = await pool.query(
      `SELECT n.note, n.created_at, ts.name AS session_name, ts.created_at AS session_created_at
       FROM player_development_notes n
       LEFT JOIN training_sessions ts ON ts.id = n.training_session_id
       WHERE n.roster_player_id = $1 AND n.author_user_id = $2
       ORDER BY n.created_at ASC`,
      [r.id, userId]
    );
    rosterPlayers.push({
      name: r.name,
      jerseyNumber: r.jersey_number,
      role: r.role,
      developmentNotes: notesResult.rows.map((n) => ({
        note: n.note,
        createdAt: n.created_at,
        sessionName: n.session_name ?? null,
        sessionCreatedAt: n.session_created_at ?? null,
      })),
    });
  }

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
    // Trainings-Anwesenheit (Statistik-Architektur Phase 5, Issue 026) –
    // Kader-Spieler-Referenz per Name+Nummer+Rolle, analog dem
    // `lines`-Export oben statt der DB-ID.
    const attendanceResult = await pool.query(
      `SELECT ta.status, ta.note, r.name, r.jersey_number, r.role
       FROM training_attendance ta JOIN roster_players r ON r.id = ta.roster_player_id
       WHERE ta.session_id = $1`,
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
      attendance: attendanceResult.rows.map((a) => ({
        name: a.name, jerseyNumber: a.jersey_number, role: a.role, status: a.status, note: a.note,
      })),
    });
  }

  // Spiele (EPIC 012 Phase 1-4, Issue 026): eigene Spiele mit verschachtelten
  // game_events/game_squad/match_lines, analog trainingSessions oben.
  // Nur eigene Spiele (user_id = userId, wie überall sonst in diesem Export)
  // – team-geteilte Spiele anderer Trainer sind nicht Teil dieses Accounts.
  // team_id/opponent_id/Spieluhr-Zustand werden bewusst NICHT exportiert:
  // team_id ist beim Re-Import ohnehin nicht sinnvoll wiederherstellbar
  // (siehe Kader/Lines oben), opponent_id wird beim Import über
  // resolveOpponentId() aus dem Freitext-Namen neu aufgelöst/angelegt, und
  // die Spieluhr ist flüchtiger Live-Zustand eines evtl. noch laufenden
  // Spiels, kein für ein Backup relevanter historischer Fakt.
  const gamesResult = await pool.query(
    'SELECT * FROM games WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  const games = [];
  for (const g of gamesResult.rows) {
    const eventsResult = await pool.query(
      `SELECT ge.*,
              rp1.name AS player_name, rp1.jersey_number AS player_number, rp1.role AS player_role,
              rp2.name AS secondary_name, rp2.jersey_number AS secondary_number, rp2.role AS secondary_role
       FROM game_events ge
       LEFT JOIN roster_players rp1 ON rp1.id = ge.roster_player_id
       LEFT JOIN roster_players rp2 ON rp2.id = ge.secondary_roster_player_id
       WHERE ge.game_id = $1 ORDER BY ge.created_at ASC`,
      [g.id]
    );
    const squadResult = await pool.query(
      `SELECT gs.status, gs.note, r.name, r.jersey_number, r.role
       FROM game_squad gs JOIN roster_players r ON r.id = gs.roster_player_id
       WHERE gs.game_id = $1`,
      [g.id]
    );
    const matchLinesResult = await pool.query(
      'SELECT * FROM match_lines WHERE game_id = $1 ORDER BY started_at ASC',
      [g.id]
    );

    games.push({
      opponent: g.opponent,
      playedAt: toDateString(g.played_at),
      notes: g.notes,
      createdAt: g.created_at,
      events: eventsResult.rows.map((e) => ({
        eventType: e.event_type,
        isOpponent: e.is_opponent,
        player: e.roster_player_id ? { name: e.player_name, jerseyNumber: e.player_number, role: e.player_role } : null,
        secondaryPlayer: e.secondary_roster_player_id
          ? { name: e.secondary_name, jerseyNumber: e.secondary_number, role: e.secondary_role }
          : null,
        period: e.period,
        clockSecondsAtEvent: e.clock_seconds_at_event,
        outcome: e.outcome,
        shotType: e.shot_type,
        strengthState: e.strength_state,
        x: e.x,
        y: e.y,
        zone: e.zone,
        // companionGoalEventId in metadata verweist auf eine DB-ID, die nach
        // einem Re-Import nicht mehr existiert – bewusst herausgefiltert
        // statt einer stillen "Karteileiche"-Referenz (video_id/
        // videoTimestampSeconds aus demselben Grund weggelassen: Videos
        // selbst sind nicht Teil dieses Backups).
        metadata: Object.fromEntries(
          Object.entries(e.metadata ?? {}).filter(([key]) => key !== 'companionGoalEventId')
        ),
        createdAt: e.created_at,
      })),
      squad: squadResult.rows.map((s) => ({
        name: s.name, jerseyNumber: s.jersey_number, role: s.role, status: s.status, note: s.note,
      })),
      matchLines: matchLinesResult.rows.map((m) => ({
        lineName: m.line_name, period: m.period, startedAt: m.started_at, endedAt: m.ended_at,
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
    games,
  };
}
