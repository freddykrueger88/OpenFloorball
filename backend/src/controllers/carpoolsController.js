/**
 * carpoolsController – Fahrgemeinschaften für Spiele und Trainingseinheiten
 * (ISSUE 028). Polymorphe `carpool_offers`-Tabelle mit resource_type als
 * Diskriminator, exakt nach dem Muster von commentsController/
 * rsvpsController – makeCarpoolHandlers() wird von routes/carpools.js
 * einmal für Spiele und einmal für Trainingseinheiten mit der jeweils
 * passenden assertRead/assertWrite-Funktion instanziiert.
 *
 * `carpool_claims` ist dagegen eine echte Junction-Tabelle (wie
 * game_squad/training_attendance) auf carpool_offers – Löschen eines
 * Angebots räumt Claims per ON DELETE CASCADE automatisch ab, kein
 * manueller Cleanup-Helper dafür nötig.
 *
 * Erster anonymer Schreib-Pfad der App (siehe carpoolShareController.js) –
 * die Kapazitätsprüfung hier UND dort muss daher unter Nebenläufigkeit
 * korrekt sein (SELECT ... FOR UPDATE auf das Angebot, siehe claimSeat).
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';

function toApiOffer(row) {
  return {
    _id:          row.id,
    userId:       row.user_id,
    meetingPoint: row.meeting_point,
    totalSeats:   row.total_seats,
    note:         row.note,
    shareToken:   row.share_token,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
    claims: (row.claims ?? []).map((c) => ({
      _id:          c.id,
      userId:       c.user_id ?? null,
      // Für authentifizierte Claims die E-Mail als Anzeigename (wie beim
      // RSVP-Roster) – für anonyme (Token-Pfad) claimant_name. Team-
      // Mitglieder dürfen sich untereinander sehen, das ist keine
      // öffentliche Ausgabe (siehe carpoolShareController.js für den
      // Datensparsamkeits-Unterschied auf der ÖFFENTLICHEN Seite).
      claimantName: c.claimant_name ?? c.email ?? null,
      isMine:       Boolean(c.is_mine),
      createdAt:    c.created_at,
    })),
  };
}

async function fetchOffersForResource(resourceType, resourceId, currentUserId) {
  const result = await pool.query(
    `SELECT o.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', c.id, 'user_id', c.user_id, 'claimant_name', c.claimant_name,
                  'email', u.email, 'is_mine', (c.user_id = $3), 'created_at', c.created_at
                ) ORDER BY c.created_at ASC
              ) FILTER (WHERE c.id IS NOT NULL), '[]'
            ) AS claims
     FROM carpool_offers o
     LEFT JOIN carpool_claims c ON c.offer_id = o.id
     LEFT JOIN users u ON u.id = c.user_id
     WHERE o.resource_type = $1 AND o.resource_id = $2
     GROUP BY o.id
     ORDER BY o.created_at ASC`,
    [resourceType, resourceId, currentUserId]
  );
  return result.rows.map(toApiOffer);
}

export function makeCarpoolHandlers(resourceType, { assertRead, assertWrite }) {
  // GET /api/games/:id/carpools bzw. /api/trainings/:id/carpools
  async function getOffers(req, res) {
    try {
      const resourceId = req.params.id;
      if (!(await assertRead(resourceId, req.user.id))) {
        return res.status(404).json(error('Nicht gefunden'));
      }
      res.json(success(await fetchOffersForResource(resourceType, resourceId, req.user.id)));
    } catch (err) {
      logger.error('[getOffers]', err);
      res.status(500).json(error('Interner Serverfehler'));
    }
  }

  // POST /api/games/:id/carpools bzw. .../trainings/:id/carpools – bewusst
  // assertRead statt assertWrite: eine Fahrt anzubieten braucht kein
  // Bearbeitungsrecht an der Ressource selbst, jedes Team-Mitglied (auch
  // Rang "member") darf ein Angebot anlegen (wie bei RSVP).
  async function createOffer(req, res) {
    try {
      const resourceId = req.params.id;
      if (!(await assertRead(resourceId, req.user.id))) {
        return res.status(404).json(error('Nicht gefunden'));
      }
      const { meetingPoint, totalSeats, note = '' } = req.body;
      const result = await pool.query(
        `INSERT INTO carpool_offers (resource_type, resource_id, user_id, meeting_point, total_seats, note)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [resourceType, resourceId, req.user.id, meetingPoint, totalSeats, note]
      );
      res.status(201).json(created(toApiOffer({ ...result.rows[0], claims: [] })));
    } catch (err) {
      logger.error('[createOffer]', err);
      res.status(500).json(error('Interner Serverfehler'));
    }
  }

  // DELETE /api/games/:id/carpools/:offerId – Autor ODER Schreibrecht
  // (Moderation durch Coach), analog commentsController.deleteComment.
  async function deleteOffer(req, res) {
    try {
      const resourceId = req.params.id;
      if (!(await assertRead(resourceId, req.user.id))) {
        return res.status(404).json(error('Nicht gefunden'));
      }
      const existing = await pool.query(
        `SELECT user_id FROM carpool_offers WHERE id = $1 AND resource_type = $2 AND resource_id = $3`,
        [req.params.offerId, resourceType, resourceId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json(error('Angebot nicht gefunden'));
      }
      const isAuthor = existing.rows[0].user_id === req.user.id;
      const hasWriteAccess = await assertWrite(resourceId, req.user.id);
      if (!isAuthor && !hasWriteAccess) {
        return res.status(403).json(error('Keine Berechtigung'));
      }
      await pool.query('DELETE FROM carpool_offers WHERE id = $1', [req.params.offerId]);
      res.json(success({ message: 'Angebot gelöscht' }));
    } catch (err) {
      logger.error('[deleteOffer]', err);
      res.status(500).json(error('Interner Serverfehler'));
    }
  }

  // POST /api/games/:id/carpools/:offerId/claims – Platz beanspruchen.
  // SELECT ... FOR UPDATE sperrt die Angebot-Zeile für die Dauer der
  // Transaktion, damit die Kapazitätsprüfung unter Nebenläufigkeit korrekt
  // bleibt (kein "zählen, dann einfügen" – siehe Plan-Notiz zu ISSUE 028:
  // ohne diesen Lock könnten zwei gleichzeitige Anfragen beide den letzten
  // freien Platz sehen und beide einfügen).
  async function claimSeat(req, res) {
    const resourceId = req.params.id;
    if (!(await assertRead(resourceId, req.user.id))) {
      return res.status(404).json(error('Nicht gefunden'));
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const offerResult = await client.query(
        `SELECT id, total_seats FROM carpool_offers WHERE id = $1 AND resource_type = $2 AND resource_id = $3 FOR UPDATE`,
        [req.params.offerId, resourceType, resourceId]
      );
      if (offerResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json(error('Angebot nicht gefunden'));
      }
      const { count } = (await client.query(
        'SELECT COUNT(*)::int AS count FROM carpool_claims WHERE offer_id = $1', [req.params.offerId]
      )).rows[0];
      if (count >= offerResult.rows[0].total_seats) {
        await client.query('ROLLBACK');
        return res.status(400).json(error('Keine freien Plätze mehr'));
      }

      let claimRow;
      try {
        claimRow = (await client.query(
          `INSERT INTO carpool_claims (offer_id, user_id) VALUES ($1, $2) RETURNING *`,
          [req.params.offerId, req.user.id]
        )).rows[0];
      } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
          return res.status(400).json(error('Du hast für dieses Angebot bereits einen Platz beansprucht'));
        }
        throw err;
      }
      await client.query('COMMIT');
      res.status(201).json(created({
        _id: claimRow.id, userId: claimRow.user_id, claimantName: null, isMine: true, createdAt: claimRow.created_at,
      }));
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error('[claimSeat]', err);
      res.status(500).json(error('Interner Serverfehler'));
    } finally {
      client.release();
    }
  }

  // DELETE /api/games/:id/carpools/:offerId/claims/:claimId – eigener
  // Claim, ODER Angebots-Owner, ODER Schreibrecht (Coach-Moderation) –
  // das ist auch die einzige Möglichkeit, einen verwaisten ANONYMEN Claim
  // (kein user_id, nur claimant_name) von authentifizierter Seite zu
  // entfernen, falls die betroffene Person ihren cancel_token verloren hat.
  async function deleteClaim(req, res) {
    try {
      const resourceId = req.params.id;
      if (!(await assertRead(resourceId, req.user.id))) {
        return res.status(404).json(error('Nicht gefunden'));
      }
      const existing = await pool.query(
        `SELECT c.id, c.user_id AS claim_user_id, o.user_id AS offer_user_id
         FROM carpool_claims c
         JOIN carpool_offers o ON o.id = c.offer_id
         WHERE c.id = $1 AND c.offer_id = $2 AND o.resource_type = $3 AND o.resource_id = $4`,
        [req.params.claimId, req.params.offerId, resourceType, resourceId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json(error('Eintrag nicht gefunden'));
      }
      const row = existing.rows[0];
      const isOwnClaim = row.claim_user_id === req.user.id;
      const isOfferOwner = row.offer_user_id === req.user.id;
      const hasWriteAccess = await assertWrite(resourceId, req.user.id);
      if (!isOwnClaim && !isOfferOwner && !hasWriteAccess) {
        return res.status(403).json(error('Keine Berechtigung'));
      }
      await pool.query('DELETE FROM carpool_claims WHERE id = $1', [req.params.claimId]);
      res.json(success({ message: 'Zurückgezogen' }));
    } catch (err) {
      logger.error('[deleteClaim]', err);
      res.status(500).json(error('Interner Serverfehler'));
    }
  }

  return { getOffers, createOffer, deleteOffer, claimSeat, deleteClaim };
}

// Aufräumen beim Löschen der Ursprungsressource (kein DB-seitiges FK über
// zwei Zieltabellen hinweg möglich) – aufgerufen aus
// gamesController.deleteGame/trainingSessionsController.deleteSession.
// Zugehörige carpool_claims räumt ON DELETE CASCADE auf carpool_offers.id
// automatisch mit ab.
export async function deleteCarpoolOffersForResource(resourceType, resourceId) {
  await pool.query('DELETE FROM carpool_offers WHERE resource_type = $1 AND resource_id = $2', [resourceType, resourceId]);
}

// Aufräumen VOR dem Löschen eines Nutzer-Accounts (userController.deleteAccount,
// adminController.deleteUser): games.user_id/training_sessions.user_id haben
// ON DELETE CASCADE auf users, löschen also beim Account-Löschen alle eigenen
// Spiele/Trainingseinheiten hart – ohne über deleteGame/deleteSession zu
// laufen, wo die Fahrgemeinschafts-Aufräumung normalerweise sitzt. Ohne
// diesen Aufruf blieben Angebote ANDERER Nutzer auf den gelöschten
// Ressourcen als verwaiste Zeilen zurück (carpool_offers hat bewusst kein
// DB-FK auf resource_id, siehe oben). Eigene Angebote/Claims des gelöschten
// Users räumt ON DELETE CASCADE auf carpool_offers.user_id/
// carpool_claims.user_id automatisch ab.
export async function deleteCarpoolOffersForUser(userId) {
  await pool.query(
    `DELETE FROM carpool_offers WHERE resource_type = 'game'
     AND resource_id IN (SELECT id FROM games WHERE user_id = $1)`,
    [userId]
  );
  await pool.query(
    `DELETE FROM carpool_offers WHERE resource_type = 'training_session'
     AND resource_id IN (SELECT id FROM training_sessions WHERE user_id = $1)`,
    [userId]
  );
}
