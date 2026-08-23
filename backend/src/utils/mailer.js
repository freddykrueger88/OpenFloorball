/**
 * mailer – optionaler SMTP-Versand (Issue #51 Folge-Feature)
 *
 * Ohne SMTP_HOST bleibt die App voll funktionsfähig, es wird nur keine
 * Mail verschickt (self-hosted – nicht jede Instanz braucht/will einen
 * konfigurierten Mailserver). sendMail() wirft nie, ein Versandfehler
 * darf den eigentlichen API-Aufruf (z.B. Kollaborator hinzufügen) nicht
 * zum Scheitern bringen.
 */
import nodemailer from 'nodemailer';
import pool from '../db/pool.js';
import logger from './logger.js';
import { resolveEmailLanguage } from './emailLanguage.js';

let transporter;
let transporterConfigured = false;

function getTransporter() {
  if (transporterConfigured) return transporter;
  transporterConfigured = true;
  if (!process.env.SMTP_HOST) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return transporter;
}

// Vom Betreiber gewünscht: Benachrichtigung an alle Admins bei jeder
// Neuregistrierung, mit variierendem, augenzwinkerndem Text statt immer
// derselben trockenen Formulierung – rein kosmetisch, kein Datenschutz-
// oder Sicherheitsaspekt. Jeder Admin bekommt die Mail in seiner
// eigenen Sprachpräferenz (settings.preferences_json.language).
const NEW_USER_TEMPLATES = {
  de: [
    (who) => ({
      subject: '🎉 Neuzugang im Kader!',
      text: `${who} hat sich gerade bei OpenFloorball registriert. Vielleicht der nächste Meistertrainer, vielleicht jemand, der nur mal reinschnuppert – so oder so: ein neues Gesicht auf der Taktiktafel.`,
    }),
    (who) => ({
      subject: '🥍 Frischfleisch registriert',
      text: `${who} ist ab sofort bei OpenFloorball dabei. Die Kreide kann eingemottet werden, die digitale Taktiktafel hat wieder Zuwachs.`,
    }),
    (who) => ({
      subject: '🚨 Ein wilder Nutzer erscheint!',
      text: `${who} hat sich soeben registriert. Kein Grund zur Sorge – vermutlich nur ein Coach, kein Hacker. Vermutlich.`,
    }),
    (who) => ({
      subject: '⚡ Zack, neuer Account!',
      text: `${who} ist jetzt Teil der OpenFloorball-Familie. Die Taktiktafel wartet schon ungeduldig auf die ersten Spielzüge.`,
    }),
    (who) => ({
      subject: '📋 Neue Anmeldung',
      text: `Willkommen an Bord, ${who}! Noch ein Coach mehr, der jetzt Spielzüge zeichnen kann, statt sie mit wild fuchtelnden Armen zu erklären.`,
    }),
    (who) => ({
      subject: '🏑 Ping! Neuer Trainer im Anmarsch',
      text: `${who} hat sich gerade bei OpenFloorball angemeldet. Die Statistik von "Trainer, die Taktikbesprechungen am Whiteboard vergeigen" sinkt hoffentlich gleich um eins.`,
    }),
  ],
  en: [
    (who) => ({
      subject: '🎉 New face on the roster!',
      text: `${who} just signed up for OpenFloorball. Maybe the next championship coach, maybe just someone poking around – either way: a new face on the tactics board.`,
    }),
    (who) => ({
      subject: '🥍 Fresh blood registered',
      text: `${who} is officially on OpenFloorball now. The chalkboard can be retired, the digital tactics board just got some new company.`,
    }),
    (who) => ({
      subject: '🚨 A wild user appears!',
      text: `${who} just registered. Nothing to worry about – probably just a coach, not a hacker. Probably.`,
    }),
    (who) => ({
      subject: '⚡ Boom, new account!',
      text: `${who} is now part of the OpenFloorball family. The tactics board is already impatiently waiting for the first plays.`,
    }),
    (who) => ({
      subject: '📋 New sign-up',
      text: `Welcome aboard, ${who}! One more coach who can now draw up plays instead of explaining them with wildly waving arms.`,
    }),
    (who) => ({
      subject: '🏑 Ping! New coach incoming',
      text: `${who} just signed up for OpenFloorball. Hopefully the stat for "coaches who fumble tactics talks at the whiteboard" just went down by one.`,
    }),
  ],
};

// Benachrichtigt alle Admins per Mail über eine Neuregistrierung – außer
// beim allerersten Nutzer (der wird selbst automatisch Admin, sich
// selbst über die eigene Registrierung zu benachrichtigen wäre unnötig).
export async function notifyAdminsOfNewUser({ email, name }, { isFirstUser }) {
  if (isFirstUser) return;
  try {
    const admins = await pool.query(
      `SELECT u.email, s.preferences_json->>'language' AS language
       FROM users u
       LEFT JOIN settings s ON s.user_id = u.id
       WHERE u.role = 'admin'`
    );
    if (admins.rows.length === 0) return;

    const who = name ? `${name} (${email})` : email;

    await Promise.all(admins.rows.map((admin) => {
      const templates = NEW_USER_TEMPLATES[resolveEmailLanguage(admin.language)];
      const template = templates[Math.floor(Math.random() * templates.length)](who);
      return sendMail({ to: admin.email, ...template });
    }));
  } catch (err) {
    // Darf eine Registrierung nie zum Scheitern bringen (analog sendMail selbst).
    logger.error('[notifyAdminsOfNewUser]', err);
  }
}

export async function sendMail({ to, subject, text }) {
  const t = getTransporter();
  if (!t) return;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
  } catch (err) {
    // Datensparsamkeit: Empfänger-E-Mail nicht mitloggen, der Fehler
    // selbst (z.B. Auth-/Verbindungsproblem) reicht zur Diagnose.
    logger.error('E-Mail-Versand fehlgeschlagen:', err);
  }
}
