/**
 * PreferencesSection – Darstellung, Barrierefreiheit, Spielfeld-Standards
 * (UI/UX-Audit, Stufe 3 – aus der vormals 1011-Zeilen-SettingsPage.jsx
 * ausgelagert, reines Verschieben ohne Logik-Änderung) + Custom-Theme-
 * Farbwähler (Stufe 5 – neu).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useThemeStore from '../../store/themeStore.js';
import useTourStore from '../../store/tourStore.js';
import useAnnounceStore from '../../store/announceStore.js';
import { useSettings } from '../../hooks/useSettings.js';
import { applyGlobalPreferences } from '../../utils/applyPreferences.js';
import { IFF_FIELDS, IFF_BALL_COLORS, DEFAULT_TEAM_COLORS } from '../../constants/fieldConfig.js';
import Button from '../common/Button.jsx';
import styles from '../../pages/SettingsPage.module.css';

export default function PreferencesSection() {
  const { t, i18n } = useTranslation();
  const { theme, themes, setTheme, customColors, setCustomColors } = useThemeStore();
  const { settings, updateSettings } = useSettings();
  // Anders als die Nav-Tour ist die Editor-Tour-Overlay-Komponente nur im
  // Board-Editor selbst gemountet (BoardEditorPage.jsx), nicht global in
  // App.jsx – ein Klick hier setzt den Store-Zustand also nur "vorgemerkt",
  // sichtbar wird die Tour erst beim nächsten Öffnen eines Boards. Ohne
  // dieses Feedback wäre der Klick scheinbar wirkungslos.
  const [editorTourQueued, setEditorTourQueued] = useState(false);

  const THEME_LABELS = {
    dark: t('settings.dark'), light: t('settings.light'),
    vikings: t('settings.vikings'), iff: t('settings.iff'), custom: t('settings.custom'),
  };
  const COLORBLIND_OPTIONS = [
    { value: 'keine',        label: t('settings.colorblindNone') },
    { value: 'deuteranopie', label: t('settings.colorblindDeuteranopia') },
    { value: 'protanopie',   label: t('settings.colorblindProtanopia') },
    { value: 'tritanopie',   label: t('settings.colorblindTritanopia') },
    { value: 'monochromie',  label: t('settings.colorblindMonochrome') },
  ];

  const patch = async (fields) => {
    const updated = await updateSettings(fields);
    applyGlobalPreferences(updated);
  };

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    patch({ language: lang });
  };

  const handleCustomColorChange = (key, value) => {
    setCustomColors({ [key]: value });
    patch({ customTheme: { ...customColors, [key]: value } });
  };

  return (
    <>
      <section className={styles.section}>
        <h2>{t('settings.nav.appearance')}</h2>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('settings.theme')}</label>
          <div className={styles.themeGrid}>
            {themes.map((th) => (
              <button
                key={th}
                className={`${styles.themeTile} ${theme === th ? styles.themeTileActive : ''}`}
                onClick={() => { setTheme(th); patch({ theme: th }); }}
                aria-pressed={theme === th}
              >
                {THEME_LABELS[th] ?? th}
              </button>
            ))}
          </div>

          {theme === 'custom' && (
            <div className={styles.colorRow}>
              <label className={styles.colorField}>
                {t('settings.customThemePrimary')}
                <input
                  type="color"
                  value={customColors.primary}
                  onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                  aria-label={t('settings.customThemePrimary')}
                />
              </label>
              <label className={styles.colorField}>
                {t('settings.customThemeBg')}
                <input
                  type="color"
                  value={customColors.bg}
                  onChange={(e) => handleCustomColorChange('bg', e.target.value)}
                  aria-label={t('settings.customThemeBg')}
                />
              </label>
              <label className={styles.colorField}>
                {t('settings.customThemeSurface')}
                <input
                  type="color"
                  value={customColors.surface}
                  onChange={(e) => handleCustomColorChange('surface', e.target.value)}
                  aria-label={t('settings.customThemeSurface')}
                />
              </label>
              <label className={styles.colorField}>
                {t('settings.customThemeText')}
                <input
                  type="color"
                  value={customColors.text}
                  onChange={(e) => handleCustomColorChange('text', e.target.value)}
                  aria-label={t('settings.customThemeText')}
                />
              </label>
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="language-select">{t('settings.language')}</label>
          <select
            id="language-select"
            className={styles.select}
            value={i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
          >
            <option value="de">{t('settings.languageDe')}</option>
            <option value="en">{t('settings.languageEn')}</option>
            <option value="sv">{t('settings.languageSv')}</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="font-size">{t('settings.fontSize')}</label>
          <select
            id="font-size"
            className={styles.select}
            value={settings?.fontSize ?? 'mittel'}
            onChange={(e) => patch({ fontSize: e.target.value })}
          >
            <option value="klein">{t('settings.fontSizeSmall')}</option>
            <option value="mittel">{t('settings.fontSizeMedium')}</option>
            <option value="gross">{t('settings.fontSizeLarge')}</option>
          </select>
        </div>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={!!settings?.reducedMotion}
            onChange={(e) => patch({ reducedMotion: e.target.checked })}
          />
          {t('settings.reducedMotion')}
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={!!settings?.dyslexiaFont}
            onChange={(e) => patch({ dyslexiaFont: e.target.checked })}
          />
          {t('settings.dyslexiaFont')}
        </label>

        {/* Halloween & Co. (SeasonalOverlay.jsx/seasonalThemeStore.js):
            Default AN (Opt-out), fehlendes Feld darf nicht als "aus"
            gelten – daher `!== false` statt `!!`. */}
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={settings?.seasonalThemesEnabled !== false}
            onChange={(e) => patch({ seasonalThemesEnabled: e.target.checked })}
          />
          {t('settings.seasonalThemes')}
        </label>
      </section>

      <section className={styles.section}>
        <h2>{t('settings.nav.fieldStandards')}</h2>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="default-field-type">{t('settings.defaultFieldType')}</label>
          <select
            id="default-field-type"
            className={styles.select}
            value={settings?.defaultFieldType ?? 'large'}
            onChange={(e) => patch({ defaultFieldType: e.target.value })}
          >
            {Object.values(IFF_FIELDS).map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.colorRow}>
          <label className={styles.colorField}>
            {t('settings.homeColor')}
            <input
              type="color"
              value={settings?.defaultHomeColor ?? DEFAULT_TEAM_COLORS.home.fill}
              onChange={(e) => patch({ defaultHomeColor: e.target.value })}
            />
          </label>
          <label className={styles.colorField}>
            {t('settings.awayColor')}
            <input
              type="color"
              value={settings?.defaultAwayColor ?? DEFAULT_TEAM_COLORS.away.fill}
              onChange={(e) => patch({ defaultAwayColor: e.target.value })}
            />
          </label>
          <label className={styles.colorField}>
            {t('settings.ballColor')}
            <select
              className={styles.select}
              value={settings?.defaultBallColor ?? '#ffffff'}
              onChange={(e) => patch({ defaultBallColor: e.target.value })}
            >
              {IFF_BALL_COLORS.map((bc) => (
                <option key={bc.id} value={bc.hex}>{bc.label}{bc.official ? ' (IFF)' : ''}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{t('settings.nav.accessibility')}</h2>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="colorblind-mode">{t('settings.colorblindMode')}</label>
          <select
            id="colorblind-mode"
            className={styles.select}
            value={settings?.colorBlindMode ?? 'keine'}
            onChange={(e) => patch({ colorBlindMode: e.target.value })}
          >
            {COLORBLIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={!!settings?.highContrast}
            onChange={(e) => patch({ highContrast: e.target.checked })}
          />
          {t('settings.highContrast')}
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={!!settings?.adhdMode}
            onChange={(e) => patch({ adhdMode: e.target.checked })}
          />
          {t('settings.adhdMode')}
        </label>
      </section>

      <section className={styles.section}>
        <h2>{t('settings.tourSectionTitle')}</h2>
        <p className={styles.fieldLabel}>{t('settings.restartTourDesc')}</p>
        <Button variant="secondary" size="md" onClick={() => useTourStore.getState().start('nav')}>
          {t('settings.restartTour')}
        </Button>
      </section>

      {/* Symmetrie zur Nav-Tour oben (ISSUE 024-Ausbau): bisher war die
          Editor-Tour nur über das Hilfe-Symbol im Editor selbst erneut
          aufrufbar, ohne Pendant hier – wer den Editor gerade nicht offen
          hat, konnte sie nicht neu starten. */}
      <section className={styles.section}>
        <h2>{t('settings.editorTourSectionTitle')}</h2>
        <p className={styles.fieldLabel}>{t('settings.restartEditorTourDesc')}</p>
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            useTourStore.getState().start('editor');
            setEditorTourQueued(true);
            useAnnounceStore.getState().announce(t('settings.restartEditorTourQueued'));
          }}
        >
          {t('settings.restartEditorTour')}
        </Button>
        {editorTourQueued && <p className={styles.fieldLabel}>{t('settings.restartEditorTourQueued')}</p>}
      </section>
    </>
  );
}
