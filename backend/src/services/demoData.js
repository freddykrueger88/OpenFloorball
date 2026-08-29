/**
 * demoData – Erzeugt/löscht eine in sich geschlossene Demo-Testumgebung pro
 * Account (Onboarding-Ausbau: Lexikon/Demo-Daten/Tour). Komplett additiv und
 * unabhängig von echten, selbst angelegten Ressourcen des Nutzers – siehe
 * migrate.js ("Demo-Daten") für das is_demo/demo_seeded_at-Schema.
 *
 * Bewusst KEINE eigene "Saison"-Entität (es gibt im Schema kein
 * seasons-Konzept) – die Saison wird nur über die Trainings-/Spieldaten und
 * den Teamnamen ausgedrückt, siehe Plan/ADR im Abschlussbericht.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const DEMO_TEAM_NAME = 'Demo: Floorball Tigers';
const DEMO_OPPONENT_NAME = 'Demo: Farmteam Lions';

// Deckt alle vier Floorball-Positionen ab (CLAUDE.md §9.2), plausible statt
// generische Namen ("Spieler 1"), damit die Demo-Umgebung sich nicht wie ein
// Datenbank-Dump anfühlt.
const DEMO_PLAYERS = [
  { name: 'Elias Berger', role: 'TW', jerseyNumber: 1 },
  { name: 'Matteo Rossi', role: 'V', jerseyNumber: 4 },
  { name: 'Jonas Keller', role: 'V', jerseyNumber: 5 },
  { name: 'Luca Meier', role: 'C', jerseyNumber: 8 },
  { name: 'Finn Weber', role: 'C', jerseyNumber: 10 },
  { name: 'Noah Schmid', role: 'S', jerseyNumber: 11 },
  { name: 'Leon Huber', role: 'S', jerseyNumber: 14 },
  { name: 'Yannick Roth', role: 'S', jerseyNumber: 17 },
];

function isoDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getDemoDataStatus(userId) {
  const result = await pool.query('SELECT demo_seeded_at FROM users WHERE id = $1', [userId]);
  const seededAt = result.rows[0]?.demo_seeded_at ?? null;
  return { hasDemoData: seededAt !== null, seededAt };
}

// Idempotent: ein zweiter Aufruf für denselben Account erzeugt nichts
// Zusätzliches, sondern gibt nur den bestehenden Status zurück. Wird sowohl
// vom manuellen "Demo-Daten erstellen"-Button als auch (best-effort, siehe
// RegisterPage.jsx) direkt nach der Registrierung aufgerufen.
export async function createDemoDataForUser(userId) {
  const existing = await pool.query('SELECT demo_seeded_at FROM users WHERE id = $1', [userId]);
  if (existing.rows[0]?.demo_seeded_at) {
    return getDemoDataStatus(userId);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const teamResult = await client.query(
      `INSERT INTO teams (name, created_by, is_demo) VALUES ($1, $2, true) RETURNING id`,
      [DEMO_TEAM_NAME, userId]
    );
    const teamId = teamResult.rows[0].id;

    await client.query(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [teamId, userId]
    );

    const opponentResult = await client.query(
      `INSERT INTO opponents (user_id, team_id, name, is_demo) VALUES ($1, $2, $3, true) RETURNING id`,
      [userId, teamId, DEMO_OPPONENT_NAME]
    );
    const opponentId = opponentResult.rows[0].id;

    const playerIds = {};
    for (const player of DEMO_PLAYERS) {
      const result = await client.query(
        `INSERT INTO roster_players (user_id, team_id, name, jersey_number, role, is_demo)
         VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
        [userId, teamId, player.name, player.jerseyNumber, player.role]
      );
      playerIds[player.name] = result.rows[0].id;
    }
    const allPlayerIds = Object.values(playerIds);

    // Trainings: eine vergangene Einheit MIT erfasster Anwesenheit (zeigt
    // die Anwesenheits-Funktion sofort mit echten Daten), eine künftige ohne
    // (realistisch – Anwesenheit wird erst nach der Einheit erfasst).
    const pastSessionResult = await client.query(
      `INSERT INTO training_sessions (user_id, team_id, name, notes, scheduled_date, goal, is_demo)
       VALUES ($1, $2, $3, '', $4, $5, true) RETURNING id`,
      [userId, teamId, 'Demo-Training: Passspiel & Kondition', isoDateOffset(-7), 'Passgenauigkeit und Grundkondition verbessern']
    );
    const pastSessionId = pastSessionResult.rows[0].id;
    for (let i = 0; i < allPlayerIds.length; i += 1) {
      const status = i === allPlayerIds.length - 1 ? 'excused' : 'present';
      await client.query(
        `INSERT INTO training_attendance (session_id, roster_player_id, status) VALUES ($1, $2, $3)`,
        [pastSessionId, allPlayerIds[i], status]
      );
    }

    await client.query(
      `INSERT INTO training_sessions (user_id, team_id, name, notes, scheduled_date, goal, is_demo)
       VALUES ($1, $2, $3, '', $4, $5, true)`,
      [userId, teamId, 'Demo-Training: Powerplay-Einstudierung', isoDateOffset(7), '5-gegen-4-Überzahl einstudieren']
    );

    // Spiele: ein vergangenes MIT Match-Kader/Ereignissen (füllt Statistiken
    // mit echten, ungleich verteilten Zahlen statt lauter Nullen), ein
    // künftiges nur als Termin für Kalender/Spielplan.
    const pastGameResult = await client.query(
      `INSERT INTO games (user_id, team_id, opponent, opponent_id, played_at, notes, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
      [userId, teamId, DEMO_OPPONENT_NAME, opponentId, isoDateOffset(-14), 'Demo-Spiel zur Saisoneröffnung']
    );
    const pastGameId = pastGameResult.rows[0].id;
    for (const playerId of allPlayerIds) {
      await client.query(
        `INSERT INTO game_squad (game_id, roster_player_id, status) VALUES ($1, $2, 'playing')`,
        [pastGameId, playerId]
      );
    }
    await client.query(
      `INSERT INTO game_events (game_id, event_type, roster_player_id, secondary_roster_player_id, is_opponent, created_by)
       VALUES ($1, 'goal', $2, $3, false, $4)`,
      [pastGameId, playerIds['Finn Weber'], playerIds['Noah Schmid'], userId]
    );
    await client.query(
      `INSERT INTO game_events (game_id, event_type, roster_player_id, is_opponent, created_by)
       VALUES ($1, 'goal', $2, false, $3)`,
      [pastGameId, playerIds['Finn Weber'], userId]
    );
    await client.query(
      `INSERT INTO game_events (game_id, event_type, roster_player_id, is_opponent, created_by)
       VALUES ($1, 'goal', $2, false, $3)`,
      [pastGameId, playerIds['Yannick Roth'], userId]
    );
    await client.query(
      `INSERT INTO game_events (game_id, event_type, roster_player_id, is_opponent, created_by)
       VALUES ($1, 'penalty_2', $2, false, $3)`,
      [pastGameId, playerIds['Matteo Rossi'], userId]
    );

    await client.query(
      `INSERT INTO games (user_id, team_id, opponent, opponent_id, played_at, notes, is_demo)
       VALUES ($1, $2, $3, $4, $5, '', true)`,
      [userId, teamId, DEMO_OPPONENT_NAME, opponentId, isoDateOffset(14)]
    );

    await client.query('UPDATE users SET demo_seeded_at = NOW() WHERE id = $1', [userId]);

    await client.query('COMMIT');
    logger.info(`[demoData] Demo-Daten erzeugt für User ${userId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[demoData] createDemoDataForUser fehlgeschlagen:', err);
    throw err;
  } finally {
    client.release();
  }

  return getDemoDataStatus(userId);
}

// Löscht ausschließlich is_demo=true-Zeilen DIESES Accounts. user_id/
// created_by wird auf jeder Zeile zusätzlich zu is_demo gefiltert – das ist
// die Sicherheitsgarantie gegen versehentliches Löschen fremder oder
// selbst angelegter echter Daten, nicht nur die is_demo-Markierung allein.
export async function deleteDemoDataForUser(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Reihenfolge ist dank ON DELETE CASCADE unkritisch (games/
    // training_sessions/teams räumen game_squad/game_events/
    // training_attendance/team_members automatisch mit ab).
    await client.query('DELETE FROM games WHERE user_id = $1 AND is_demo = true', [userId]);
    await client.query('DELETE FROM training_sessions WHERE user_id = $1 AND is_demo = true', [userId]);
    await client.query('DELETE FROM roster_players WHERE user_id = $1 AND is_demo = true', [userId]);
    await client.query('DELETE FROM opponents WHERE user_id = $1 AND is_demo = true', [userId]);
    await client.query('DELETE FROM teams WHERE created_by = $1 AND is_demo = true', [userId]);
    await client.query('UPDATE users SET demo_seeded_at = NULL WHERE id = $1', [userId]);
    await client.query('COMMIT');
    logger.info(`[demoData] Demo-Daten gelöscht für User ${userId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[demoData] deleteDemoDataForUser fehlgeschlagen:', err);
    throw err;
  } finally {
    client.release();
  }

  return getDemoDataStatus(userId);
}
