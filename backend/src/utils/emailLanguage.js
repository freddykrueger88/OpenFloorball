/**
 * emailLanguage – Sprachwahl für Transaktionsmails (Issue 027 Folge:
 * Backend-Mails waren bisher hart auf Deutsch codiert, obwohl die
 * Sprachpräferenz pro Nutzer bereits in `settings.preferences_json`
 * liegt, siehe settingsController.js / PreferencesSection.jsx).
 *
 * Fallback 'de' analog zum Frontend-Fallback (frontend/src/i18n/i18n.js:
 * fallbackLng: 'de') – Deutsch bleibt die Standardsprache.
 */

// `language` kommt roh aus preferences_json (kann fehlen, leer oder
// z.B. 'sv' sein) – Mails gibt es aktuell nur auf Deutsch/Englisch,
// alles außer 'en' fällt auf 'de' zurück.
export function resolveEmailLanguage(language) {
  return language === 'en' ? 'en' : 'de';
}
