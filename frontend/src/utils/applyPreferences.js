/**
 * applyPreferences – Wendet geladene User-Settings global als
 * document-Attribute an (Issue #18: Darstellung & Barrierefreiheit)
 */
import useThemeStore from '../store/themeStore.js';
import useSeasonalThemeStore from '../store/seasonalThemeStore.js';
import i18n from '../i18n/i18n.js';

export function applyGlobalPreferences(prefs = {}) {
  const root = document.documentElement;

  if (prefs.theme) {
    // customTheme muss VOR setTheme('custom') im Store liegen, damit
    // setTheme beim Anwenden die richtigen Farben ableitet (siehe
    // themeStore.js).
    if (prefs.theme === 'custom' && prefs.customTheme) {
      useThemeStore.getState().setCustomColors(prefs.customTheme);
    }
    useThemeStore.getState().setTheme(prefs.theme);
  }
  if (prefs.language) i18n.changeLanguage(prefs.language);

  root.setAttribute('data-font-size', prefs.fontSize || 'mittel');
  root.setAttribute('data-reduced-motion', String(!!prefs.reducedMotion));
  root.setAttribute('data-high-contrast', String(!!prefs.highContrast));
  root.setAttribute('data-adhd-mode', String(!!prefs.adhdMode));
  root.setAttribute('data-dyslexia-font', String(!!prefs.dyslexiaFont));

  if (prefs.colorBlindMode && prefs.colorBlindMode !== 'keine') {
    root.setAttribute('data-colorblind-mode', prefs.colorBlindMode);
  } else {
    root.removeAttribute('data-colorblind-mode');
  }

  // Saisonale Deko-Themes (Halloween): Store-Default ist bereits AN, hier
  // nur übernehmen, wenn der Nutzer aktiv abgeschaltet hat – ein fehlendes
  // Feld (nie gespeichert) darf nicht versehentlich als "aus" gelten.
  if (typeof prefs.seasonalThemesEnabled === 'boolean') {
    useSeasonalThemeStore.getState().setEnabled(prefs.seasonalThemesEnabled);
  }
}
