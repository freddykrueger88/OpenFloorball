/**
 * Registrierungs-Konfiguration (Paket A)
 *
 * Bewusst zur Laufzeit gelesen (nicht beim Modul-Import): Tests können die
 * Modi so gezielt setzen/zurücksetzen, und ein Neustart ist für Änderungen
 * ohnehin nötig (Docker-Env).
 *
 * Modi:
 *   open     – jeder darf sich registrieren
 *   invite   – nur mit REGISTRATION_INVITE_CODE (gemeinsamer Einladungscode)
 *   approval – Registrierung möglich, Account wartet auf Admin-Freigabe
 *   closed   – keine Registrierung
 */
import { timingSafeEqual } from 'crypto';
import logger from './logger.js';

export const REGISTRATION_MODES = ['open', 'invite', 'approval', 'closed'];

export function getRegistrationMode() {
  const raw = String(process.env.REGISTRATION_MODE ?? 'open').trim().toLowerCase();
  if (!REGISTRATION_MODES.includes(raw)) {
    logger.warn(`Ungültiger REGISTRATION_MODE "${raw}" – Registrierung wird vorsichtshalber geschlossen.`);
    return 'closed';
  }
  return raw;
}

export function getInviteCode() {
  return String(process.env.REGISTRATION_INVITE_CODE ?? '');
}

/**
 * Konstantzeit-Vergleich für den gemeinsamen Einladungscode. Längenunterschiede
 * werden vorab abgefangen (timingSafeEqual wirft sonst); die Länge eines
 * Betreiber-Codes ist kein schützenswertes Geheimnis.
 */
export function inviteCodeMatches(provided, expected) {
  const a = Buffer.from(String(provided ?? ''));
  const b = Buffer.from(String(expected ?? ''));
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isBootstrapConfigured() {
  return Boolean(process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD);
}

/**
 * In Produktion gibt es keinen automatischen Erst-User-Admin mehr (P0:
 * Race um den ersten Account). Der Betreiber muss den Admin explizit über
 * BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD anlegen. In Test/Dev bleibt
 * der alte Komfortpfad, damit lokale Setups und die bestehenden Tests ohne
 * Bootstrap-Env funktionieren.
 */
export function allowsFirstUserAdmin(mode) {
  return process.env.NODE_ENV !== 'production' && mode !== 'approval';
}
