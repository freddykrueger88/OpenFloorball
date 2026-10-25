/**
 * Bootstrap-Admin (Paket A)
 *
 * Produktion legt keinen automatischen Admin mehr an, nur weil sich zufällig
 * jemand zuerst registriert. Stattdessen erzeugt der Betreiber den ersten
 * Admin explizit beim Start:
 *
 *   BOOTSTRAP_ADMIN_EMAIL=admin@example.com
 *   BOOTSTRAP_ADMIN_PASSWORD=<starkes Passwort>
 *
 * Das passiert nur, solange noch kein einziger User existiert. Ein späteres
 * Ändern der Env-Variablen setzt kein Passwort zurück (bewusst, damit ein
 * versehentlich stehengebliebener Wert keinen bestehenden Admin überschreibt).
 */
import bcrypt from 'bcrypt';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { isBootstrapConfigured } from '../utils/registration.js';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export async function ensureBootstrapAdmin() {
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '');

  const countResult = await pool.query('SELECT COUNT(*) FROM users');
  const userCount = parseInt(countResult.rows[0].count, 10);

  if (userCount > 0) {
    // Kein stilles Überschreiben/Reset eines bestehenden Admin-Passworts.
    const adminResult = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'");
    if (parseInt(adminResult.rows[0].count, 10) === 0) {
      logger.warn('Es existieren Nutzer, aber kein aktiver Admin – bitte Admin-Zugang manuell wiederherstellen.');
    }
    if (isBootstrapConfigured()) {
      logger.info('Bootstrap-Admin übersprungen: Es existieren bereits Nutzer.');
    }
    return { created: false, reason: 'users_exist' };
  }

  if (!email && !password) {
    logger.warn(
      'Instanz hat noch keinen Admin und keine Bootstrap-Zugangsdaten. '
      + 'Registrierungen bleiben gesperrt, bis BOOTSTRAP_ADMIN_EMAIL und '
      + 'BOOTSTRAP_ADMIN_PASSWORD gesetzt und der Server neu gestartet wurde.'
    );
    return { created: false, reason: 'not_configured' };
  }

  if (!email || !password) {
    logger.error(
      'Bootstrap-Admin unvollständig konfiguriert – BOOTSTRAP_ADMIN_EMAIL und '
      + 'BOOTSTRAP_ADMIN_PASSWORD müssen gemeinsam gesetzt sein.'
    );
    return { created: false, reason: 'incomplete_config' };
  }

  if (!EMAIL_RE.test(email)) {
    logger.error('BOOTSTRAP_ADMIN_EMAIL ist keine gültige E-Mail-Adresse.');
    return { created: false, reason: 'invalid_email' };
  }

  if (password.length < 8 || !PASSWORD_RE.test(password)) {
    logger.error(
      'BOOTSTRAP_ADMIN_PASSWORD zu schwach: mindestens 8 Zeichen, Groß-/'
      + 'Kleinbuchstaben und eine Zahl erforderlich.'
    );
    return { created: false, reason: 'weak_password' };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, role, status)
     VALUES ($1, $2, 'admin', 'active')
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [email, passwordHash]
  );

  if (result.rows.length === 0) {
    logger.warn('Bootstrap-Admin nicht angelegt: E-Mail existiert bereits.');
    return { created: false, reason: 'email_exists' };
  }

  logger.info(`Bootstrap-Admin angelegt: ${email}`);
  return { created: true, email };
}
