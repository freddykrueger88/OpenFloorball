/**
 * pollsController – Umfragen/Polls (Roadmap-Audit, Phase D
 * "Kommunikation – minimal", schließt die Phase neben announcements
 * ab). Ein Coach/Owner stellt eine Frage mit mehreren Optionen, alle
 * Team-Mitglieder stimmen ab, Ergebnisse sind immer für alle sichtbar.
 * Kein Kommentieren/Diskutieren (gleiche Philosophie wie announcements).
 *
 * Wie announcements keine polymorphe Tabelle (nur Teams als Publikum)
 * und team_id NOT NULL (kein persönlicher Fall) – siehe migrate.js.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { getUserTeamIds, assertTeamAccess } from '../utils/teamAccess.js';

const MAX_POLLS_PER_TEAM = 100;

function toApiOption(row) {
  return {
    _id:        row.id,
    text:       row.text,
    order:      row.order_index,
    voteCount:  Number(row.vote_count ?? 0),
    votedByMe:  row.voted_by_me === true,
  };
}

function toApiPoll(row, options) {
  return {
    _id:            row.id,
    teamId:         row.team_id,
    email:          row.email,
    question:       row.question,
    multipleChoice: row.multiple_choice,
    closedAt:       row.closed_at,
    createdAt:      row.created_at,
    options,
  };
}

async function fetchOptionsByPollId(pollIds, userId) {
  const optionsByPoll = new Map();
  if (pollIds.length === 0) return optionsByPoll;
  const result = await pool.query(
    `SELECT po.id, po.poll_id, po.text, po.order_index,
            COUNT(pv.id)::int AS vote_count,
            COALESCE(BOOL_OR(pv.user_id = $2), false) AS voted_by_me
     FROM poll_options po
     LEFT JOIN poll_votes pv ON pv.poll_option_id = po.id
     WHERE po.poll_id = ANY($1::uuid[])
     GROUP BY po.id
     ORDER BY po.order_index ASC`,
    [pollIds, userId]
  );
  for (const row of result.rows) {
    if (!optionsByPoll.has(row.poll_id)) optionsByPoll.set(row.poll_id, []);
    optionsByPoll.get(row.poll_id).push(toApiOption(row));
  }
  return optionsByPoll;
}

async function getPollRow(pollId) {
  const result = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
  return result.rows[0] ?? null;
}

// GET /api/polls – flache Liste über alle Teams des Nutzers.
export async function getPolls(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const pollsResult = await pool.query(
      `SELECT p.*, u.email FROM polls p
       JOIN users u ON u.id = p.user_id
       WHERE p.team_id = ANY($1::uuid[])
       ORDER BY p.created_at DESC`,
      [teamIds]
    );
    const optionsByPoll = await fetchOptionsByPollId(pollsResult.rows.map((r) => r.id), req.user.id);
    res.json(success(pollsResult.rows.map((row) => toApiPoll(row, optionsByPoll.get(row.id) ?? []))));
  } catch (err) {
    logger.error('[getPolls]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/polls – Coach-Entscheidung, wer eine Umfrage anlegen darf.
export async function createPoll(req, res) {
  const { teamId, question, multipleChoice = false, options } = req.body;
  try {
    if (!(await assertTeamAccess(teamId, req.user.id, 'coach'))) {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM polls WHERE team_id = $1', [teamId]);
    if (countResult.rows[0].count >= MAX_POLLS_PER_TEAM) {
      return res.status(400).json(error(`Maximal ${MAX_POLLS_PER_TEAM} Umfragen pro Team`));
    }
  } catch (err) {
    logger.error('[createPoll]', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pollResult = await client.query(
      'INSERT INTO polls (team_id, user_id, question, multiple_choice) VALUES ($1, $2, $3, $4) RETURNING id',
      [teamId, req.user.id, question, multipleChoice]
    );
    const pollId = pollResult.rows[0].id;
    for (let i = 0; i < options.length; i += 1) {
      await client.query(
        'INSERT INTO poll_options (poll_id, text, order_index) VALUES ($1, $2, $3)',
        [pollId, options[i], i]
      );
    }
    await client.query('COMMIT');

    const pollRow = await pool.query('SELECT p.*, u.email FROM polls p JOIN users u ON u.id = p.user_id WHERE p.id = $1', [pollId]);
    const optionsByPoll = await fetchOptionsByPollId([pollId], req.user.id);
    res.status(201).json(created(toApiPoll(pollRow.rows[0], optionsByPoll.get(pollId) ?? [])));
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[createPoll]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// POST /api/polls/:id/vote – Lesezugriff reicht zum Abstimmen (wie RSVP).
export async function votePoll(req, res) {
  const pollId = req.params.id;
  const { optionId } = req.body;

  try {
    const poll = await getPollRow(pollId);
    if (!poll) {
      return res.status(404).json(error('Umfrage nicht gefunden'));
    }
    if (!(await assertTeamAccess(poll.team_id, req.user.id, 'member'))) {
      return res.status(404).json(error('Umfrage nicht gefunden'));
    }
    if (poll.closed_at) {
      return res.status(400).json(error('Umfrage ist geschlossen'));
    }
    const optionCheck = await pool.query('SELECT id FROM poll_options WHERE id = $1 AND poll_id = $2', [optionId, pollId]);
    if (optionCheck.rows.length === 0) {
      return res.status(404).json(error('Option nicht gefunden'));
    }

    if (poll.multiple_choice) {
      const existing = await pool.query('SELECT id FROM poll_votes WHERE poll_option_id = $1 AND user_id = $2', [optionId, req.user.id]);
      if (existing.rows.length > 0) {
        await pool.query('DELETE FROM poll_votes WHERE id = $1', [existing.rows[0].id]);
      } else {
        await pool.query('INSERT INTO poll_votes (poll_option_id, user_id) VALUES ($1, $2)', [optionId, req.user.id]);
      }
    } else {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query(
          `SELECT pv.poll_option_id FROM poll_votes pv
           JOIN poll_options po ON po.id = pv.poll_option_id
           WHERE po.poll_id = $1 AND pv.user_id = $2`,
          [pollId, req.user.id]
        );
        const alreadyVotedThisOption = existing.rows.some((r) => r.poll_option_id === optionId);
        await client.query(
          'DELETE FROM poll_votes WHERE user_id = $1 AND poll_option_id IN (SELECT id FROM poll_options WHERE poll_id = $2)',
          [req.user.id, pollId]
        );
        if (!alreadyVotedThisOption) {
          await client.query('INSERT INTO poll_votes (poll_option_id, user_id) VALUES ($1, $2)', [optionId, req.user.id]);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const pollRow = await pool.query('SELECT p.*, u.email FROM polls p JOIN users u ON u.id = p.user_id WHERE p.id = $1', [pollId]);
    const optionsByPoll = await fetchOptionsByPollId([pollId], req.user.id);
    res.json(success(toApiPoll(pollRow.rows[0], optionsByPoll.get(pollId) ?? [])));
  } catch (err) {
    logger.error('[votePoll]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/polls/:id/close
export async function closePoll(req, res) {
  try {
    const poll = await getPollRow(req.params.id);
    if (!poll) {
      return res.status(404).json(error('Umfrage nicht gefunden'));
    }
    if (!(await assertTeamAccess(poll.team_id, req.user.id, 'coach'))) {
      return res.status(404).json(error('Umfrage nicht gefunden'));
    }
    await pool.query('UPDATE polls SET closed_at = NOW() WHERE id = $1', [req.params.id]);
    res.json(success({ message: 'Umfrage geschlossen' }));
  } catch (err) {
    logger.error('[closePoll]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/polls/:id – jeder Coach/Owner des Teams darf löschen,
// nicht nur der Ersteller (konsistent mit announcementsController).
export async function deletePoll(req, res) {
  try {
    const poll = await getPollRow(req.params.id);
    if (!poll) {
      return res.status(404).json(error('Umfrage nicht gefunden'));
    }
    if (!(await assertTeamAccess(poll.team_id, req.user.id, 'coach'))) {
      return res.status(404).json(error('Umfrage nicht gefunden'));
    }
    await pool.query('DELETE FROM polls WHERE id = $1', [req.params.id]);
    res.json(success({ message: 'Umfrage gelöscht' }));
  } catch (err) {
    logger.error('[deletePoll]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
