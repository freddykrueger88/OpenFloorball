/**
 * gameClockController – Spieluhr (Roadmap-Audit, letzter größerer
 * Baustein Phase C). Fünf Spalten direkt auf `games` (1:1-Beziehung,
 * keine eigene Tabelle nötig, siehe migrate.js). Pause-Resume-Modell
 * ohne Server-Tick: clock_elapsed_seconds ist die bereits
 * "eingesammelte" Zeit dieser Periode, clock_started_at (nur bei
 * status='running' gesetzt) + (NOW() - clock_started_at) ergibt die
 * zusätzliche laufende Zeit – die Restzeit wird rein clientseitig
 * berechnet (GamePage.jsx), der Server kennt nur Start-/Pausepunkte.
 *
 * Nutzer-Entscheidung: bewusst mit den bestehenden Ereignis-Presets
 * verknüpft – Start protokolliert automatisch einen Anstoß, ein
 * Drittel-Wechsel automatisch ein Drittelende, als ganz normale
 * game_events-Zeile (identisch zu einem manuellen Tap auf den
 * jeweiligen Preset-Button in GamePage.jsx).
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, error } from '../utils/apiResponse.js';
import { assertGameWrite } from './gamesController.js';

function toApiClockState(row, createdEvent = null) {
  return {
    clockPeriod:         row.clock_period,
    clockStatus:         row.clock_status,
    clockElapsedSeconds: row.clock_elapsed_seconds,
    clockStartedAt:      row.clock_started_at,
    createdEvent,
  };
}

async function getClockRow(gameId) {
  const result = await pool.query(
    'SELECT clock_period, clock_status, clock_elapsed_seconds, clock_started_at FROM games WHERE id = $1',
    [gameId]
  );
  return result.rows[0] ?? null;
}

// POST /api/games/:id/clock/start
export async function startClock(req, res) {
  const gameId = req.params.id;
  try {
    if (!(await assertGameWrite(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const clock = await getClockRow(gameId);
    if (clock.clock_status === 'running') {
      return res.json(success(toApiClockState(clock)));
    }

    const nextPeriodNum = clock.clock_period === 0 ? 1 : clock.clock_period;
    const kickoffType = `kickoff_q${nextPeriodNum}`;
    // Nur beim ALLERERSTEN Start dieser Periode einen Anstoß-Event
    // protokollieren, nicht beim Fortsetzen nach einer Pause. Bewusst
    // anhand von game_events selbst geprüft (statt z.B. anhand von
    // clock_elapsed_seconds === 0 – das würde bei Start+Pause innerhalb
    // derselben Sekunde durch die Integer-Rundung in EXTRACT(EPOCH...)
    // fälschlich wieder wie "noch nie gestartet" aussehen).
    const existingKickoff = await pool.query(
      'SELECT 1 FROM game_events WHERE game_id = $1 AND event_type = $2 LIMIT 1',
      [gameId, kickoffType]
    );
    const eventType = existingKickoff.rows.length === 0 ? kickoffType : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (eventType) {
        await client.query(
          'INSERT INTO game_events (game_id, event_type, created_by) VALUES ($1, $2, $3)',
          [gameId, eventType, req.user.id]
        );
      }
      const result = await client.query(
        `UPDATE games SET clock_period = $2, clock_status = 'running', clock_started_at = NOW()
         WHERE id = $1
         RETURNING clock_period, clock_status, clock_elapsed_seconds, clock_started_at`,
        [gameId, nextPeriodNum]
      );
      await client.query('COMMIT');
      res.json(success(toApiClockState(result.rows[0], eventType)));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('[startClock]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/games/:id/clock/pause
export async function pauseClock(req, res) {
  const gameId = req.params.id;
  try {
    if (!(await assertGameWrite(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const clock = await getClockRow(gameId);
    if (clock.clock_status !== 'running') {
      return res.json(success(toApiClockState(clock)));
    }

    const result = await pool.query(
      `UPDATE games SET
         clock_elapsed_seconds = clock_elapsed_seconds + EXTRACT(EPOCH FROM (NOW() - clock_started_at))::int,
         clock_status = 'stopped',
         clock_started_at = NULL
       WHERE id = $1
       RETURNING clock_period, clock_status, clock_elapsed_seconds, clock_started_at`,
      [gameId]
    );
    res.json(success(toApiClockState(result.rows[0])));
  } catch (err) {
    logger.error('[pauseClock]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/games/:id/clock/next-period
export async function nextPeriod(req, res) {
  const gameId = req.params.id;
  try {
    if (!(await assertGameWrite(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const clock = await getClockRow(gameId);
    // Drittelende betrifft die AKTUELLE (auslaufende) Periode – nur
    // protokollieren, wenn diese Periode überhaupt schon begonnen hat.
    const outgoingPeriod = clock.clock_period;
    const eventType = outgoingPeriod > 0 ? 'period_end' : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (eventType) {
        await client.query(
          'INSERT INTO game_events (game_id, event_type, created_by) VALUES ($1, $2, $3)',
          [gameId, eventType, req.user.id]
        );
      }
      const result = await client.query(
        `UPDATE games SET clock_period = clock_period + 1, clock_status = 'stopped',
                clock_elapsed_seconds = 0, clock_started_at = NULL
         WHERE id = $1
         RETURNING clock_period, clock_status, clock_elapsed_seconds, clock_started_at`,
        [gameId]
      );
      await client.query('COMMIT');
      res.json(success(toApiClockState(result.rows[0], eventType)));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('[nextPeriod]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/games/:id/clock/reset – setzt nur die Uhr-Anzeige zurück,
// rührt game_events NICHT an (kein Datenverlust ohne explizite Aktion).
export async function resetClock(req, res) {
  const gameId = req.params.id;
  try {
    if (!(await assertGameWrite(gameId, req.user.id))) {
      return res.status(404).json(error('Spiel nicht gefunden'));
    }
    const result = await pool.query(
      `UPDATE games SET clock_period = 0, clock_status = 'stopped',
              clock_elapsed_seconds = 0, clock_started_at = NULL
       WHERE id = $1
       RETURNING clock_period, clock_status, clock_elapsed_seconds, clock_started_at`,
      [gameId]
    );
    res.json(success(toApiClockState(result.rows[0])));
  } catch (err) {
    logger.error('[resetClock]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
