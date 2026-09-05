import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import de from './locales/de.json';
import en from './locales/en.json';
import sv from './locales/sv.json';
import fi from './locales/fi.json';
import cs from './locales/cs.json';
import sk from './locales/sk.json';
import nb from './locales/nb.json';
import lv from './locales/lv.json';
import pl from './locales/pl.json';
import fr from './locales/fr.json';

// Einzige Quelle für die unterstützten Sprachen: neue Sprache = neuer
// Eintrag hier (+ Import oben) statt an mehreren Stellen im Code
// (Sprachauswahl in PreferencesSection.jsx wird daraus generiert, siehe
// docs/TRANSLATING.md Schritt 4). Tipp: Norwegisch wird von Browsern als
// "no" geliefert, i18next mappt das NICHT automatisch auf "nb" – deshalb
// ist "no" zusätzlich in supportedLngs registriert (gleiches Resource-
// Objekt, damit keine Pflege-Zweigstelle entsteht).
export const SUPPORTED_LANGUAGES = ['de', 'en', 'sv', 'fi', 'cs', 'sk', 'nb', 'lv', 'pl', 'fr'];

// Norwegisch-Alias: "no" → "nb" (gleiches Resource-Objekt, nur für die
// Browser-Spracherkennung, nicht in der Auswahl sichtbar).
const NB_RESOURCE = { translation: nb };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { de: { translation: de }, en: { translation: en }, sv: { translation: sv }, fi: { translation: fi }, cs: { translation: cs }, sk: { translation: sk }, nb: NB_RESOURCE, no: NB_RESOURCE, lv: { translation: lv }, pl: { translation: pl }, fr: { translation: fr } },
    fallbackLng: 'de',
    supportedLngs: [...SUPPORTED_LANGUAGES, 'no'],
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
