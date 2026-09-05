/**
 * auditLogger – append-only Audit-Log (CLAUDE.md §19.5 Auditierbarkeit)
 *
 * Zentrale Schreibfunktion für das generische audit_log-Feld (siehe
 * migrate.js). Erfasst wer (actor_id) wann an welcher Ressource was
 * geändert hat, inkl. Vorher/Nachher-Delta und freier Metadaten.
 * Fehler beim Audit-Schreiben dürfen die eigentliche Aktion NIEMALS
 * beeinflussen – deshalb wird jede Exception intern geloggt statt
 * nach oben geworfen (Aufrufer können await oder void verwenden).
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';

/**
 * @param {object} opts
 * @param {string} opts.actorId     – UUID des ausführenden Nutzers
 * @param {string} opts.action      – z.B. 'team.member.role.update'
 * @param {string} opts.resourceType– z.B. 'user', 'team', 'board', 'export'
 * @param {string|null} [opts.resourceId] – UUID der Ressource (FK-frei)
 * @param {object} [opts.before]    – Zustand VOR der Änderung (Relevanz nur)
 * @param {object} [opts.after]     – Zustand NACH der Änderung (Relevanz nur)
 * @param {object} [opts.metadata]  – freie Metadaten (NIE Secrets)
 */
export async function logAudit({
  actorId,
  action,
  resourceType,
  resourceId = null,
  before = {},
  after = {},
  metadata = {},
}) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, resource_type, resource_id, before_json, after_json, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
      [
        actorId,
        action,
        resourceType,
        resourceId,
        JSON.stringify(before),
        JSON.stringify(after),
        JSON.stringify(metadata),
      ]
    );
  } catch (err) {
    logger.error(`[auditLogger] Schreiben fehlgeschlagen für "${action}":`, err);
  }
}