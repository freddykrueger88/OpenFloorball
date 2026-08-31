/**
 * SeasonalOverlay – rein dekorative Halloween-Deko (Spinnweben in den
 * Ecken, treibende Fledermäuse), automatisch nur am 31. Oktober aktiv
 * (siehe useSeasonalThemeActive/isHalloweenActive) und in den
 * Einstellungen abschaltbar (PreferencesSection.jsx). Rendert nichts,
 * solange nicht beides zutrifft – kein Server-Request, kein Tracking.
 *
 * `aria-hidden` + `pointer-events: none`: reine Optik, blockiert nie
 * Klicks/Tastatur und wird von Screenreadern übersprungen (CLAUDE.md §16
 * Accessibility First) – die eigentliche, zugängliche Spieler-Liste bleibt
 * unverändert (PlayerAccessibleList.jsx).
 */
import { useSeasonalThemeActive } from '../../store/seasonalThemeStore.js';
import styles from './SeasonalOverlay.module.css';

export default function SeasonalOverlay() {
  const active = useSeasonalThemeActive();
  if (!active) return null;

  return (
    <div className={styles.overlay} aria-hidden="true">
      <svg className={`${styles.cobweb} ${styles.cobwebLeft}`} viewBox="0 0 120 120" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M0,0 L120,0" />
          <path d="M0,0 L0,120" />
          <path d="M0,0 L40,10" />
          <path d="M0,0 L70,25" />
          <path d="M0,0 L95,45" />
          <path d="M0,0 L110,75" />
          <path d="M0,0 L10,40" />
          <path d="M0,0 L25,70" />
          <path d="M0,0 L45,95" />
          <path d="M0,0 L75,110" />
          <path d="M5,5 Q15,2 25,10 Q35,20 30,30 Q45,25 55,35 Q65,48 55,58 Q75,55 82,68 Q88,82 74,88" />
        </g>
      </svg>
      <svg className={`${styles.cobweb} ${styles.cobwebRight}`} viewBox="0 0 120 120" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M120,0 L0,0" />
          <path d="M120,0 L120,120" />
          <path d="M120,0 L80,10" />
          <path d="M120,0 L50,25" />
          <path d="M120,0 L25,45" />
          <path d="M120,0 L10,75" />
          <path d="M120,0 L110,40" />
          <path d="M120,0 L95,70" />
          <path d="M120,0 L75,95" />
          <path d="M120,0 L45,110" />
          <path d="M115,5 Q105,2 95,10 Q85,20 90,30 Q75,25 65,35 Q55,48 65,58 Q45,55 38,68 Q32,82 46,88" />
        </g>
      </svg>

      <span className={`${styles.bat} ${styles.bat1}`}>🦇</span>
      <span className={`${styles.bat} ${styles.bat2}`}>🦇</span>
      <span className={`${styles.bat} ${styles.bat3}`}>🦇</span>
    </div>
  );
}
