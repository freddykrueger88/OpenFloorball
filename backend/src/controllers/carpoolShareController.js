/**
 * carpoolShareController – öffentliche, tokenbasierte Ansicht/Teilnahme an
 * EINEM Fahrangebot ohne Login (ISSUE 028). Vorbild shareController.js,
 * aber mit einem entscheidenden Unterschied: das ist die ERSTE anonyme
 * SCHREIB-Route der App (POST/DELETE .../claims). Jeder bisherige
 * Token-Pfad (shareController, inviteController, calendarFeedController)
 * ist rein lesend.
 *
 * Datensparsamkeit: die Response gibt NIE eine E-Mail-Adresse preis (auch
 * nicht für authentifizierte Mitfahrer:innen) – nur claimantName bzw. "ein
 * Team-Mitglied", da diese Seite für Personen ganz ohne Account gedacht
 * ist und keine internen Nutzerdaten nach außen tragen soll.
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';

async function fetchResourceLabel(resourceType, resourceId) {
  if (resourceType === 'game') {
    const result = await pool.query(
      `SELECT played_at AS date, opponent AS label FROM games WHERE id = $1`, [resourceId]
    );
    return result.rows[0] ?? null;
  }
  const result = await pool.query(
    `SELECT scheduled_date AS date, name AS label FROM training_sessions WHERE id = $1`, [resourceId]
  );
  return result.rows[0] ?? null;
}

function toApiSharedOffer(row, claims) {
  return {
    meetingPoint: row.meeting_point,
    totalSeats:   row.total_seats,
    note:         row.note,
    freeSeats:    row.total_seats - claims.length,
    resource:     row.resourceLabel,
    riders: claims.map((c) => ({
      // Bewusst kein user_id/E-Mail nach außen – nur ein Anzeigename.
      name: c.claimant_name ?? 'Team-Mitglied',
    })),
  };
}

// GET /api/carpools/:token (öffentlich, kein Auth)
export async function getSharedCarpoolOffer(req, res) {
  try {
    const offerResult = await pool.query(
      `SELECT * FROM carpool_offers WHERE share_token = $1`, [req.params.token]
    );
    if (offerResult.rows.length === 0) {
      return res.status(404).json(error('Link ungültig oder das Angebot wurde entfernt'));
    }
    const offer = offerResult.rows[0];
    const claimsResult = await pool.query(
      `SELECT claimant_name FROM carpool_claims WHERE offer_id = $1 ORDER BY created_at ASC`, [offer.id]
    );
    offer.resourceLabel = await fetchResourceLabel(offer.resource_type, offer.resource_id);
    res.json(success(toApiSharedOffer(offer, claimsResult.rows)));
  } catch (err) {
    logger.error('[getSharedCarpoolOffer]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/carpools/:token/claims (öffentlich, kein Auth)  Body: { claimantName }
// SELECT ... FOR UPDATE sperrt die Angebot-Zeile für die Dauer der
// Transaktion – identische Race-Condition-Absicherung wie
// carpoolsController.claimSeat (siehe dort für die ausführliche Begründung).
export async function claimSharedCarpoolSeat(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const offerResult = await client.query(
      `SELECT id, total_seats FROM carpool_offers WHERE share_token = $1 FOR UPDATE`, [req.params.token]
    );
    if (offerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error('Link ungültig oder das Angebot wurde entfernt'));
    }
    const offerId = offerResult.rows[0].id;
    const { count } = (await client.query(
      'SELECT COUNT(*)::int AS count FROM carpool_claims WHERE offer_id = $1', [offerId]
    )).rows[0];
    if (count >= offerResult.rows[0].total_seats) {
      await client.query('ROLLBACK');
      return res.status(400).json(error('Keine freien Plätze mehr'));
    }

    let claimRow;
    try {
      claimRow = (await client.query(
        `INSERT INTO carpool_claims (offer_id, claimant_name) VALUES ($1, $2) RETURNING id, cancel_token`,
        [offerId, req.body.claimantName]
      )).rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    await client.query('COMMIT');
    // cancelToken wird EINMALIG zurückgegeben – es gibt keinen Weg, ihn
    // später erneut abzurufen (kein Login, über das man "meinen Claim"
    // sonst identifizieren könnte). Das Frontend muss ihn lokal speichern.
    res.status(201).json(created({ claimId: claimRow.id, cancelToken: claimRow.cancel_token }));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('[claimSharedCarpoolSeat]', err);
    res.status(500).json(error('Interner Serverfehler'));
  } finally {
    client.release();
  }
}

// DELETE /api/carpools/:token/claims/:claimId (öffentlich, kein Auth)
// Body: { cancelToken } – falsch/fehlend -> 403 (der Claim EXISTIERT ja,
// die Person kann nur nicht beweisen, dass es ihrer ist), nicht 404.
export async function cancelSharedCarpoolClaim(req, res) {
  try {
    const offerResult = await pool.query(
      `SELECT id FROM carpool_offers WHERE share_token = $1`, [req.params.token]
    );
    if (offerResult.rows.length === 0) {
      return res.status(404).json(error('Link ungültig oder das Angebot wurde entfernt'));
    }
    const claimResult = await pool.query(
      `SELECT id, cancel_token FROM carpool_claims WHERE id = $1 AND offer_id = $2`,
      [req.params.claimId, offerResult.rows[0].id]
    );
    if (claimResult.rows.length === 0) {
      return res.status(404).json(error('Eintrag nicht gefunden'));
    }
    if (claimResult.rows[0].cancel_token !== req.body.cancelToken) {
      return res.status(403).json(error('Ungültiger Bestätigungscode'));
    }
    await pool.query('DELETE FROM carpool_claims WHERE id = $1', [req.params.claimId]);
    res.json(success({ message: 'Zurückgezogen' }));
  } catch (err) {
    logger.error('[cancelSharedCarpoolClaim]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
