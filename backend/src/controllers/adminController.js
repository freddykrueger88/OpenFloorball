/**
 * adminController – Benutzerverwaltung für Admins (Issue #26)
 * Alle Routen liegen hinter authenticate + requireAdmin (routes/admin.js).
 */
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, error } from '../utils/apiResponse.js';
import { rescheduleBackupCron, runBackupNow } from '../services/backupCron.js';
import { logAudit } from '../services/auditLogger.js';
import { deleteCommentsForUser } from './commentsController.js';
import { deleteRsvpsForUser } from './rsvpsController.js';
import { deleteCarpoolOffersForUser } from './carpoolsController.js';

async function adminCount() {
  const result = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
  return parseInt(result.rows[0].count, 10);
}

// GET /api/admin/users
export async function listUsers(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, email, role, display_name AS name, created_at FROM users ORDER BY created_at ASC'
    );
    res.json(success(result.rows));
  } catch (err) {
    logger.error('[listUsers]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/admin/users/:id
export async function deleteUser(req, res) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json(error('Du kannst dich nicht selbst löschen'));
    }

    const target = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (target.rows.length === 0) {
      return res.status(404).json(error('Benutzer nicht gefunden'));
    }
    if (target.rows[0].role === 'admin' && (await adminCount()) <= 1) {
      return res.status(400).json(error('Letzter Admin kann nicht gelöscht werden'));
    }

    // Siehe userController.deleteAccount: Boards/Trainingseinheiten werden
    // per CASCADE hart gelöscht, ohne die dortige Kommentar-/RSVP-/
    // Fahrgemeinschafts-Aufräumung zu durchlaufen – vorher explizit
    // anstoßen, sonst blieben Zeilen anderer Nutzer verwaist zurück.
    // Bugfix (ISSUE 028): deleteRsvpsForUser fehlte hier bisher, obwohl
    // userController.deleteAccount es schon aufruft – admin-initiiertes
    // Löschen ließ RSVP-Zeilen verwaist zurück.
    await deleteCommentsForUser(req.params.id);
    await deleteRsvpsForUser(req.params.id);
    await deleteCarpoolOffersForUser(req.params.id);
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    logger.info(`Admin ${req.user.id} deleted user ${req.params.id}`);
    await logAudit({ actorId: req.user.id, action: 'user.delete', resourceType: 'user', resourceId: req.params.id, metadata: { adminInitiated: true } });
    res.json(success({ message: 'Benutzer gelöscht' }));
  } catch (err) {
    logger.error('[deleteUser]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/admin/users/:id/role   Body: { role: 'admin' | 'user' }
export async function updateUserRole(req, res) {
  try {
    const { role } = req.body;

    const target = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (target.rows.length === 0) {
      return res.status(404).json(error('Benutzer nicht gefunden'));
    }
    if (target.rows[0].role === 'admin' && role === 'user' && (await adminCount()) <= 1) {
      return res.status(400).json(error('Letzter Admin kann nicht degradiert werden'));
    }

    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role, display_name AS name, created_at',
      [role, req.params.id]
    );
    logger.info(`Admin ${req.user.id} set role of ${req.params.id} to ${role}`);
    await logAudit({
      actorId: req.user.id,
      action: 'user.role.update',
      resourceType: 'user',
      resourceId: req.params.id,
      before: { role: target.rows[0].role },
      after: { role: result.rows[0].role },
    });
    res.json(success(result.rows[0]));
  } catch (err) {
    logger.error('[updateUserRole]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/admin/backup-config (Issue #21)
export async function getBackupConfig(req, res) {
  try {
    const result = await pool.query('SELECT * FROM app_config LIMIT 1');
    const row = result.rows[0];
    res.json(success({
      enabled: row.backup_enabled,
      schedule: row.backup_schedule,
      retention: row.backup_retention,
    }));
  } catch (err) {
    logger.error('[getBackupConfig]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/admin/backup-config   Body: { enabled, schedule, retention }
export async function updateBackupConfig(req, res) {
  try {
    const { enabled, schedule, retention } = req.body;
    const result = await pool.query(
      `UPDATE app_config SET backup_enabled = $1, backup_schedule = $2, backup_retention = $3
       RETURNING *`,
      [enabled, schedule, retention]
    );
    await rescheduleBackupCron();
    const row = result.rows[0];
    logger.info(`Admin ${req.user.id} updated backup config`);
    await logAudit({
      actorId: req.user.id,
      action: 'admin.backup-config.update',
      resourceType: 'app_config',
      metadata: { enabled, schedule, retention },
    });
    res.json(success({
      enabled: row.backup_enabled,
      schedule: row.backup_schedule,
      retention: row.backup_retention,
    }));
  } catch (err) {
    logger.error('[updateBackupConfig]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/admin/backup-run – manueller Sofort-Trigger (Backlog: "kein
// manueller Backup jetzt ausführen-Endpunkt"), nutzt dieselbe Funktion wie
// der geplante Cron-Lauf. Läuft synchron im Request (wie der Cron-Lauf
// selbst auch) – für die self-hosted Zielgruppe (einzelner Verein, keine
// tausenden Nutzer) unnötig, dafür eine eigene Job-Queue einzuführen.
export async function triggerBackupNow(req, res) {
  try {
    const result = await runBackupNow();
    logger.info(`Admin ${req.user.id} manually triggered backup run (${result.count} user(s))`);
    await logAudit({ actorId: req.user.id, action: 'admin.backup.run', resourceType: 'app_config', metadata: { count: result.count } });
    res.json(success(result));
  } catch (err) {
    logger.error('[triggerBackupNow]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// GET /api/admin/ai-config – EPIC 010: KI-Anbieter über die Admin-UI
// konfigurierbar statt nur per .env/Neustart. Der API-Key wird nie
// zurückgegeben (nur ob einer gesetzt ist) – Schreiben ja, Lesen nie.
export async function getAiConfig(req, res) {
  try {
    const result = await pool.query(
      `SELECT ai_provider_base_url, ai_provider_api_key, ai_provider_model, ai_provider_timeout_ms
       FROM app_config LIMIT 1`
    );
    const row = result.rows[0];
    res.json(success({
      baseUrl: row.ai_provider_base_url,
      model: row.ai_provider_model,
      timeoutMs: row.ai_provider_timeout_ms,
      apiKeySet: row.ai_provider_api_key.length > 0,
    }));
  } catch (err) {
    logger.error('[getAiConfig]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/admin/ai-config   Body: { baseUrl, model, timeoutMs, apiKey? }
// apiKey ist optional: fehlt es im Body, bleibt der bisherige Key
// unverändert (Frontend zeigt den Key nie an, ein leer gelassenes Feld
// darf einen bereits gesetzten Key also nicht versehentlich löschen).
// Um einen Key gezielt zu entfernen, wird explizit apiKey: '' gesendet.
export async function updateAiConfig(req, res) {
  try {
    const { baseUrl, model, timeoutMs, apiKey } = req.body;

    const sets = ['ai_provider_base_url = $1', 'ai_provider_model = $2', 'ai_provider_timeout_ms = $3'];
    const values = [baseUrl, model, timeoutMs];
    if (apiKey !== undefined) {
      sets.push(`ai_provider_api_key = $${values.length + 1}`);
      values.push(apiKey);
    }

    const result = await pool.query(
      `UPDATE app_config SET ${sets.join(', ')} RETURNING *`,
      values
    );
    const row = result.rows[0];
    logger.info(`Admin ${req.user.id} updated AI provider config`);
    // Bewusst KEIN apiKey in before/after/metadata – der Key bleibt nur in
    // der app_config-Ebene, das Audit dokumentiert lediglich, dass/ob
    // geändert wurde. Bei einer Änderung wird apiKeyChanged gesetzt.
    await logAudit({
      actorId: req.user.id,
      action: 'admin.ai-config.update',
      resourceType: 'app_config',
      before: {},
      after: { baseUrl, model, timeoutMs },
      metadata: { apiKeyChanged: apiKey !== undefined },
    });
    res.json(success({
      baseUrl: row.ai_provider_base_url,
      model: row.ai_provider_model,
      timeoutMs: row.ai_provider_timeout_ms,
      apiKeySet: row.ai_provider_api_key.length > 0,
    }));
  } catch (err) {
    logger.error('[updateAiConfig]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
