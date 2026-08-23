import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import de from './locales/de.json';
import en from './locales/en.json';
import sv from './locales/sv.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { de: { translation: de }, en: { translation: en }, sv: { translation: sv } },
    fallbackLng: 'de',
    supportedLngs: ['de', 'en', 'sv'],
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
