import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import de from './locales/de.json';
import en from './locales/en.json';
import sv from './locales/sv.json';
import fi from './locales/fi.json';
import cs from './locales/cs.json';
import sk from './locales/sk.json';

// Einzige Quelle für die unterstützten Sprachen: neue Sprache = neuer
// Eintrag hier (+ Import oben) statt an mehreren Stellen im Code
// (Sprachauswahl in PreferencesSection.jsx wird daraus generiert, siehe
// docs/TRANSLATING.md Schritt 4).
export const SUPPORTED_LANGUAGES = ['de', 'en', 'sv', 'fi', 'cs', 'sk'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { de: { translation: de }, en: { translation: en }, sv: { translation: sv }, fi: { translation: fi }, cs: { translation: cs }, sk: { translation: sk } },
    fallbackLng: 'de',
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

// WCAG 3.1.1 (Language of Page): <html lang> muss die tatsächlich
// angezeigte Sprache widerspiegeln, sonst liest ein Screenreader
// englischen Text mit deutschen Ausspracheregeln vor (und umgekehrt)
const syncHtmlLang = (lng) => { document.documentElement.lang = lng; };
i18n.on('languageChanged', syncHtmlLang);
if (i18n.language) syncHtmlLang(i18n.language);

export default i18n;
