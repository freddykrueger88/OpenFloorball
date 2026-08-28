/**
 * userController – Account-Selbstverwaltung (Issue #22)
 * DELETE /api/user/account – Löscht den eigenen Account inkl. aller Daten.
 * Cascade-Deletes (settings/boards/frames/lines/exports → users) übernehmen
 * das Aufräumen, siehe backend/src/db/migrate.js.
 */
import jwt from 'jsonwebtoken';
import { ZipArchive } from 'archiver';
import AdmZip from 'adm-zip';
import pool from '../db/pool.js';
import redisClient from '../db/redis.js';
import logger from '../utils/logger.js';
import { success, error } from '../utils/apiResponse.js';
import { COOKIE_OPTS } from '../utils/cookies.js';
import { buildUserExport, BACKUP_FORMAT } from '../services/exportUserData.js';
import { deleteCommentsForUser } from './commentsController.js';
import { deleteRsvpsForUser } from './rsvpsController.js';
import { resolveOpponentId } from './opponentsController.js';

const MAX_FRAMES_PER_BOARD = 50;
const MAX_ROSTER_PLAYERS = 40;
const MAX_LINES = 20;
const MAX_PLAYBOOKS = 15;
const MAX_FORMATIONS = 20;
const MAX_TRAINING_SESSIONS = 20;
const MAX_TRAINING_ITEMS_PER_SESSION = 30;
const MAX_ATTENDANCE_PER_SESSION = 40;
const MAX_DEV_NOTES_PER_PLAYER = 200;
const MAX_GAMES = 30;
const MAX_GAME_EVENTS_PER_GAME = 500;
const MAX_GAME_SQUAD_PER_GAME = 40;
const MAX_MATCH_LINES_PER_GAME = 200;

export async function deleteAccount(req, res) {
  try {
    const userResult = await pool.query('SELECT email, role FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json(error('Benutzer nicht gefunden'));
    }
    const user = userResult.rows[0];

    if ((req.body.email ?? '').trim().toLowerCase() !== user.email.toLowerCase()) {
      return res.status(400).json(error('E-Mail-Bestätigung stimmt nicht überein'));
    }

    if (user.role === 'admin') {
      const adminCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
      if (parseInt(adminCount.rows[0].count, 10) <= 1) {
        return res.status(403).json(error('Letzter Admin-Account kann nicht gelöscht werden'));
      }
    }

    // Aktuelles Token blacklisten (analog Logout)
    const token = req.cookies?.token;
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) await redisClient.setEx(`blacklist:${token}`, ttl, '1');
      }
    }

    // Boards/Trainingseinheiten dieses Nutzers werden gleich per CASCADE
    // hart gelöscht, ohne über deleteBoard/deleteSession zu laufen – dort
    // sitzt die Kommentar-Aufräumung sonst. Vorher explizit anstoßen, sonst
    // blieben Kommentare anderer Nutzer als verwaiste Zeilen zurück.
    await deleteCommentsForUser(req.user.id);
    await deleteRsvpsForUser(req.user.id);
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.clearCookie('token', { ...COOKIE_OPTS, maxAge: 0 });

    logger.info(`User deleted own account: ${req.user.id}`);
    return res.json(success({ message: 'Account gelöscht' }));
  } catch (err) {
    logger.error('[deleteAccount]', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/user/data – Auskunftsrecht Art. 15 DSGVO: Daten einsehen,
// ohne ZIP-Download (Issue #20)
export async function getUserData(req, res) {
  try {
    const data = await buildUserExport(req.user.id);
    return res.json(success(data));
  } catch (err) {
    logger.error('[getUserData]', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/user/export – ZIP-Export aller eigenen Daten (Issue #21)
export async function exportAccount(req, res) {
  try {
    const data = await buildUserExport(req.user.id);
    const dateStr = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="openfloorball-backup-${dateStr}.zip"`);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);
    archive.append(JSON.stringify(data, null, 2), { name: 'backup.json' });
    await archive.finalize();
  } catch (err) {
    logger.error('[exportAccount]', err);
    if (!res.headersSent) res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/user/import – ZIP-Import (Issue #21)
// Duplikate (gleicher Name + Feldtyp + Erstellungszeitpunkt für diesen User)
// werden übersprungen, alles andere wird als neues Board angelegt.
export async function importAccount(req, res) {
  if (!req.file) {
    return res.status(400).json(error('Keine Datei hochgeladen'));
  }

  let data;
  try {
    const zip = new AdmZip(req.file.buffer);
    const entry = zip.getEntry('backup.json');
    if (!entry) {
      return res.status(400).json(error('ZIP enthält keine backup.json'));
    }
    data = JSON.parse(entry.getData().toString('utf8'));
  } catch {
    return res.status(400).json(error('Ungültige oder beschädigte ZIP-Datei'));
  }

  if (data?.format !== BACKUP_FORMAT) {
    return res.status(400).json(error('Unbekanntes Backup-Format'));
  }
  if (!Array.isArray(data.boards)) {
    return res.status(400).json(error('Backup enthält keine Boards'));
  }

  const client = await pool.connect();
  let imported = 0;
  let skipped = 0;
  try {
    await client.query('BEGIN');

    // Playbooks VOR den Boards importieren, damit deren neue IDs beim
    // Board-Insert für playbook_id zur Verfügung stehen (siehe
    // exportUserData.js – Boards referenzieren ein Playbook per Name).
    const playbookIdByKey = new Map();
    const playbooks = (data.playbooks ?? []).slice(0, MAX_PLAYBOOKS);
    for (const pb of playbooks) {
      const existing = await client.query(
        'SELECT id FROM playbooks WHERE user_id = $1 AND name = $2',
        [req.user.id, pb.name]
      );
      if (existing.rows.length > 0) {
        playbookIdByKey.set(pb.name, existing.rows[0].id);
        continue;
      }
      const inserted = await client.query(
        'INSERT INTO playbooks (user_id, name) VALUES ($1, $2) RETURNING id',
        [req.user.id, pb.name]
      );
      playbookIdByKey.set(pb.name, inserted.rows[0].id);
    }

    // Für Trainingsplan-Items (Schritt weiter unten): Boards referenzieren
    // sich selbst per Name+Feldtyp+createdAt (derselbe Schlüssel wie die
    // Duplikaterkennung direkt darunter) – in BEIDEN Zweigen befüllen,
    // damit auch übersprungene (bereits vorhandene) Boards auflösbar bleiben.
    const boardIdByKey = new Map();

    for (const board of data.boards) {
      const boardKey = `${board.name}|${board.fieldType}|${board.createdAt}`;

      // date_trunc auf Millisekunden, da JS Date/JSON beim Export/Import
      // die Mikrosekunden-Präzision von Postgres' created_at kappt – ohne
      // das würde die Duplikat-Erkennung für real erzeugte Boards nie greifen.
      const existing = await client.query(
        `SELECT id FROM boards WHERE user_id = $1 AND name = $2 AND field_type = $3
         AND date_trunc('milliseconds', created_at) = date_trunc('milliseconds', $4::timestamptz)`,
        [req.user.id, board.name, board.fieldType, board.createdAt]
      );
      if (existing.rows.length > 0) {
        boardIdByKey.set(boardKey, existing.rows[0].id);
        skipped++;
        continue;
      }

      const playbookId = board.playbookName ? (playbookIdByKey.get(board.playbookName) ?? null) : null;
      const boardResult = await client.query(
        `INSERT INTO boards (user_id, name, notes, field_type, theme, home_color, away_color, ball_color, show_grid, show_names, name_position, created_at, playbook_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          req.user.id, board.name, board.notes ?? '', board.fieldType ?? 'large', board.theme ?? 'dark',
          board.homeColor ?? '#1d4ed8', board.awayColor ?? '#dc2626', board.ballColor ?? '#ffffff',
          board.showGrid ?? false, board.showNames ?? true, board.namePosition ?? 'below',
          board.createdAt ?? new Date().toISOString(), playbookId,
        ]
      );
      const newBoardId = boardResult.rows[0].id;
      boardIdByKey.set(boardKey, newBoardId);

      const frames = (board.frames ?? []).slice(0, MAX_FRAMES_PER_BOARD);
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        await client.query(
          `INSERT INTO frames (board_id, order_index, data_json, duration_ms)
           VALUES ($1, $2, $3::jsonb, $4)`,
          [
            newBoardId, i,
            JSON.stringify({ label: frame.label ?? '', players: frame.players ?? [], elements: frame.elements ?? [] }),
            frame.duration ?? 1000,
          ]
        );
      }

      imported++;
    }

    // Kader + Lines sind nutzer-, nicht board-gebunden (siehe
    // exportUserData.js) – Duplikat-Erkennung analog zu Boards: exakte
    // Übereinstimmung aller Felder für denselben Nutzer wird übersprungen.
    const rosterIdByKey = new Map();
    const rosterPlayers = (data.rosterPlayers ?? []).slice(0, MAX_ROSTER_PLAYERS);
    for (const p of rosterPlayers) {
      const existing = await client.query(
        `SELECT id FROM roster_players WHERE user_id = $1 AND name = $2
         AND jersey_number IS NOT DISTINCT FROM $3 AND role IS NOT DISTINCT FROM $4`,
        [req.user.id, p.name, p.jerseyNumber ?? null, p.role ?? null]
      );
      const key = `${p.name}|${p.jerseyNumber ?? ''}|${p.role ?? ''}`;
      if (existing.rows.length > 0) {
        rosterIdByKey.set(key, existing.rows[0].id);
        continue;
      }
      const inserted = await client.query(
        `INSERT INTO roster_players (user_id, name, jersey_number, role) VALUES ($1, $2, $3, $4) RETURNING id`,
        [req.user.id, p.name, p.jerseyNumber ?? null, p.role ?? null]
      );
      rosterIdByKey.set(key, inserted.rows[0].id);
    }

    // Für match_lines (Spiele-Import weiter unten): Lines referenzieren sich
    // selbst über ihren Namen (match_lines.line_name ist bereits als
    // denormalisierter Text gespeichert, line_id ist nullable) – in BEIDEN
    // Zweigen befüllen, analog boardIdByKey oben.
    const lineIdByKey = new Map();

    const lines = (data.lines ?? []).slice(0, MAX_LINES);
    for (const line of lines) {
      const existingLine = await client.query(
        `SELECT id FROM lines WHERE user_id = $1 AND name = $2 AND color = $3 AND type = $4`,
        [req.user.id, line.name, line.color ?? '#3B82F6', line.type ?? 'offense']
      );
      if (existingLine.rows.length > 0) {
        lineIdByKey.set(line.name, existingLine.rows[0].id);
        continue;
      }

      const lineResult = await client.query(
        `INSERT INTO lines (user_id, name, color, type) VALUES ($1, $2, $3, $4) RETURNING id`,
        [req.user.id, line.name, line.color ?? '#3B82F6', line.type ?? 'offense']
      );
      const newLineId = lineResult.rows[0].id;
      lineIdByKey.set(line.name, newLineId);

      const players = (line.players ?? []);
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const rosterPlayerId = rosterIdByKey.get(`${p.name}|${p.jerseyNumber ?? ''}|${p.role ?? ''}`);
        if (!rosterPlayerId) continue; // Spieler war nicht im Kader-Export enthalten
        await client.query(
          `INSERT INTO line_players (line_id, roster_player_id, order_index) VALUES ($1, $2, $3)
           ON CONFLICT (line_id, roster_player_id) DO NOTHING`,
          [newLineId, rosterPlayerId, i]
        );
      }
    }

    // Spiele (EPIC 012 Phase 1-4, Issue 026): eigene Spiele mit
    // verschachtelten game_events/game_squad/match_lines. Muss NACH
    // Kader+Lines stehen (rosterIdByKey/lineIdByKey werden zur Auflösung
    // gebraucht). Dedup wie bei Boards/Trainingsplänen: exakte
    // Übereinstimmung von Gegner+Datum+Erstellungszeitpunkt wird
    // übersprungen – inkl. der verschachtelten Daten, da ein Duplikat
    // dieselben enthalten haben sollte.
    const games = (data.games ?? []).slice(0, MAX_GAMES);
    for (const game of games) {
      const existingGame = await client.query(
        `SELECT id FROM games WHERE user_id = $1 AND opponent = $2
         AND played_at IS NOT DISTINCT FROM $3::date
         AND date_trunc('milliseconds', created_at) = date_trunc('milliseconds', $4::timestamptz)`,
        [req.user.id, game.opponent ?? '', game.playedAt, game.createdAt]
      );
      if (existingGame.rows.length > 0) {
        skipped++;
        continue;
      }

      // team_id bewusst NULL (siehe exportUserData.js) – resolveOpponentId
      // ordnet den Freitext-Namen wie bei einer normalen Spielanlage einem
      // persönlichen opponents-Eintrag zu (legt bei Bedarf einen neuen an).
      const opponentId = await resolveOpponentId(game.opponent ?? '', req.user.id, null);
      const gameResult = await client.query(
        `INSERT INTO games (user_id, opponent, opponent_id, played_at, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          req.user.id, game.opponent ?? '', opponentId, game.playedAt ?? null,
          game.notes ?? '', game.createdAt ?? new Date().toISOString(),
        ]
      );
      const newGameId = gameResult.rows[0].id;
      imported++;

      const events = (game.events ?? []).slice(0, MAX_GAME_EVENTS_PER_GAME);
      for (const evt of events) {
        // event_type ist ein FK auf event_type_definitions.key – eingebaute
        // Typen existieren in jeder Instanz, ein persönlicher/team-eigener
        // Custom-Typ (Phase 7) aber ggf. nicht in der Zielinstanz. Ohne
        // passende Definition würde der INSERT die FK verletzen – das
        // Ereignis wird dann übersprungen statt den gesamten Import
        // abzubrechen (analog fehlender Kader-/Board-Referenzen oben).
        const typeExists = await client.query(
          'SELECT 1 FROM event_type_definitions WHERE key = $1',
          [evt.eventType]
        );
        if (typeExists.rows.length === 0) continue;

        const rosterPlayerId = evt.player
          ? rosterIdByKey.get(`${evt.player.name}|${evt.player.jerseyNumber ?? ''}|${evt.player.role ?? ''}`) ?? null
          : null;
        const secondaryRosterPlayerId = evt.secondaryPlayer
          ? rosterIdByKey.get(`${evt.secondaryPlayer.name}|${evt.secondaryPlayer.jerseyNumber ?? ''}|${evt.secondaryPlayer.role ?? ''}`) ?? null
          : null;

        await client.query(
          `INSERT INTO game_events (
             game_id, event_type, roster_player_id, is_opponent,
             secondary_roster_player_id, period, clock_seconds_at_event,
             outcome, shot_type, strength_state, x, y, zone, metadata,
             created_at, created_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16)`,
          [
            newGameId, evt.eventType, rosterPlayerId, evt.isOpponent ?? false,
            secondaryRosterPlayerId, evt.period ?? null, evt.clockSecondsAtEvent ?? null,
            evt.outcome ?? null, evt.shotType ?? null, evt.strengthState ?? null,
            evt.x ?? null, evt.y ?? null, evt.zone ?? null, JSON.stringify(evt.metadata ?? {}),
            evt.createdAt ?? new Date().toISOString(), req.user.id,
          ]
        );
      }

      const squad = (game.squad ?? []).slice(0, MAX_GAME_SQUAD_PER_GAME);
      for (const s of squad) {
        const rosterPlayerId = rosterIdByKey.get(`${s.name}|${s.jerseyNumber ?? ''}|${s.role ?? ''}`);
        if (!rosterPlayerId) continue; // Spieler war nicht im Kader-Export enthalten
        await client.query(
          `INSERT INTO game_squad (game_id, roster_player_id, status, note) VALUES ($1, $2, $3, $4)
           ON CONFLICT (game_id, roster_player_id) DO NOTHING`,
          [newGameId, rosterPlayerId, s.status, s.note ?? '']
        );
      }

      const matchLines = (game.matchLines ?? []).slice(0, MAX_MATCH_LINES_PER_GAME);
      for (const ml of matchLines) {
        // line_id bleibt NULL, wenn die Line nicht (mehr) Teil des Imports
        // ist – dieselbe Situation wie im Original, wenn eine Line nach dem
        // Spiel gelöscht wurde (Spalte ist ON DELETE SET NULL, siehe migrate.js).
        const lineId = lineIdByKey.get(ml.lineName) ?? null;
        await client.query(
          `INSERT INTO match_lines (game_id, line_id, line_name, period, started_at, ended_at, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [newGameId, lineId, ml.lineName, ml.period ?? null, ml.startedAt ?? new Date().toISOString(), ml.endedAt ?? null, req.user.id]
        );
      }
    }

    // Formationsvorlagen: kein Cross-Reference zu anderen Ressourcen,
    // analog Lines-Dedup (Feld-Gleichheit statt Zeitstempel).
    const formations = (data.formations ?? []).slice(0, MAX_FORMATIONS);
    for (const f of formations) {
      const existing = await client.query(
        'SELECT id FROM formation_templates WHERE user_id = $1 AND name = $2 AND field_type = $3',
        [req.user.id, f.name, f.fieldType ?? 'large']
      );
      if (existing.rows.length > 0) continue;

      await client.query(
        `INSERT INTO formation_templates (user_id, name, field_type, players_json)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [req.user.id, f.name, f.fieldType ?? 'large', JSON.stringify(f.players ?? [])]
      );
    }

    // Trainingspläne: date_trunc auf Millisekunden aus demselben Grund wie
    // bei Boards oben. Items referenzieren ein Board über boardIdByKey
    // (siehe Board-Import-Schleife) – fehlt der Verweis (Board war nicht
    // Teil des Exports), wird das Item übersprungen statt einen Fehler zu
    // werfen (analog line_players bei fehlendem Kader-Spieler).
    // Für Spielerentwicklungsnotizen (weiter unten): Trainingseinheiten
    // referenzieren sich selbst über Name+Erstellungszeitpunkt (derselbe
    // Schlüssel wie player_development_notes.sessionName/sessionCreatedAt
    // in exportUserData.js) – in BEIDEN Zweigen befüllen, analog boardIdByKey.
    const sessionIdByKey = new Map();

    const trainingSessions = (data.trainingSessions ?? []).slice(0, MAX_TRAINING_SESSIONS);
    for (const session of trainingSessions) {
      const sessionKey = `${session.name}|${session.createdAt}`;
      const existingSession = await client.query(
        `SELECT id FROM training_sessions WHERE user_id = $1 AND name = $2
         AND date_trunc('milliseconds', created_at) = date_trunc('milliseconds', $3::timestamptz)`,
        [req.user.id, session.name, session.createdAt]
      );
      if (existingSession.rows.length > 0) {
        sessionIdByKey.set(sessionKey, existingSession.rows[0].id);
        continue;
      }

      const sessionResult = await client.query(
        `INSERT INTO training_sessions (user_id, name, notes, scheduled_date, goal, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          req.user.id, session.name, session.notes ?? '', session.scheduledDate ?? null,
          session.goal ?? null, session.createdAt ?? new Date().toISOString(),
        ]
      );
      const newSessionId = sessionResult.rows[0].id;
      sessionIdByKey.set(sessionKey, newSessionId);

      const items = (session.items ?? []).slice(0, MAX_TRAINING_ITEMS_PER_SESSION);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const boardId = boardIdByKey.get(`${item.boardName}|${item.boardFieldType}|${item.boardCreatedAt}`);
        if (!boardId) continue; // Board war nicht Teil des Exports/Imports
        await client.query(
          `INSERT INTO training_session_items (session_id, board_id, order_index, duration_minutes, note)
           VALUES ($1, $2, $3, $4, $5)`,
          [newSessionId, boardId, i, item.durationMinutes ?? 15, item.note ?? '']
        );
      }

      // Trainings-Anwesenheit (Statistik-Architektur Phase 5, Issue 026) –
      // nur für frisch angelegte Sessions (wie items oben), Kader-Referenz
      // per rosterIdByKey wie überall sonst in diesem Import.
      const attendance = (session.attendance ?? []).slice(0, MAX_ATTENDANCE_PER_SESSION);
      for (const a of attendance) {
        const rosterPlayerId = rosterIdByKey.get(`${a.name}|${a.jerseyNumber ?? ''}|${a.role ?? ''}`);
        if (!rosterPlayerId) continue; // Spieler war nicht im Kader-Export enthalten
        await client.query(
          `INSERT INTO training_attendance (session_id, roster_player_id, status, note) VALUES ($1, $2, $3, $4)
           ON CONFLICT (session_id, roster_player_id) DO NOTHING`,
          [newSessionId, rosterPlayerId, a.status, a.note ?? '']
        );
      }
    }

    // Spielerentwicklungsnotizen (Statistik-Architektur Phase 5, Issue 026)
    // – NACH Kader UND Trainingsplänen, da beide Referenzen
    // (rosterIdByKey/sessionIdByKey) erst dann vollständig befüllt sind.
    // Autor ist immer der importierende Nutzer selbst (siehe
    // exportUserData.js – nur selbst verfasste Notizen werden exportiert).
    for (const p of (data.rosterPlayers ?? []).slice(0, MAX_ROSTER_PLAYERS)) {
      const rosterPlayerId = rosterIdByKey.get(`${p.name}|${p.jerseyNumber ?? ''}|${p.role ?? ''}`);
      if (!rosterPlayerId) continue;
      const notes = (p.developmentNotes ?? []).slice(0, MAX_DEV_NOTES_PER_PLAYER);
      for (const n of notes) {
        const sessionId = n.sessionName ? sessionIdByKey.get(`${n.sessionName}|${n.sessionCreatedAt}`) ?? null : null;
        const existingNote = await client.query(
          `SELECT id FROM player_development_notes WHERE roster_player_id = $1 AND author_user_id = $2
           AND note = $3 AND date_trunc('milliseconds', created_at) = date_trunc('milliseconds', $4::timestamptz)`,
          [rosterPlayerId, req.user.id, n.note, n.createdAt]
        );
        if (existingNote.rows.length > 0) continue;
        await client.query(
          `INSERT INTO player_development_notes (roster_player_id, author_user_id, training_session_id, note, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [rosterPlayerId, req.user.id, sessionId, n.note, n.createdAt ?? new Date().toISOString()]
        );
      }
    }

    await client.query('COMMIT');
    logger.info(`User ${req.user.id} imported backup: ${imported} imported, ${skipped} skipped`);
    return res.json(success({ imported, skipped }));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[importAccount]', err);
    return res.status(500).json(error('Interner Serverfehler beim Import'));
  } finally {
    client.release();
  }
}
