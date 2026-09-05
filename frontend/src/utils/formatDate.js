/**
 * formatDate – Lokalisierte Datumsformatierung (Issue #25)
 * Nutzt die aktuelle i18next-Sprache statt eines hartkodierten Locales.
 */
import i18n from '../i18n/i18n.js';

// Mapping der unterstützten UI-Sprachen (i18n-Iso-Code) auf Intl-BCP-47-
// Locales. Neue Sprache in i18n.js => hier passenden Eintrag ergänzen,
// sonst fällt die Formatierung auf de-DE zurück (bisheriges Verhalten).
const INTL_LOCALES = {
  de: 'de-DE',
  en: 'en-US',
  sv: 'sv-SE',
  fi: 'fi-FI',
  cs: 'cs-CZ',
  sk: 'sk-SK',
};

export function getIntlLocale(lng = i18n.language) {
  return INTL_LOCALES[lng] || 'de-DE';
}

export function formatDate(iso, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(getIntlLocale(), options);
}

// formatDateOnly – für reine Datumswerte ohne Uhrzeit (z.B. das geplante
// Datum einer Trainingseinheit, DATE-Spalte als "YYYY-MM-DD"). Bewusst
// KEIN new Date(str) + toLocaleDateString() wie oben – das würde den
// String als UTC-Mitternacht interpretieren und in Zeitzonen westlich
// von UTC einen Tag zu früh anzeigen. Stattdessen die Teile direkt aus
// dem String lesen, ganz ohne Zeitzonen-Umrechnung.
export function formatDateOnly(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return '';
  if (i18n.language === 'en') return `${month}/${day}/${year}`;
  if (i18n.language === 'sv') return `${year}-${month}-${day}`;
  return `${day}.${month}.${year}`;
}
