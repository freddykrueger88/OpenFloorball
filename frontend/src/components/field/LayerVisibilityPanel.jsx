/**
 * LayerVisibilityPanel – Sichtbarkeits-Panel (CLAUDE.md §10.2, vormals
 * "Ebenen/Layers" benannt – Nutzer-Feedback: das Wording passte nicht zu
 * einer reinen Ein-/Ausblenden-Funktion, siehe boardEditor.tabs.layers):
 * ein dediziertes Panel zum Ein-/Ausblenden von Spieler/Gegner/Laufwege/
 * Passwege/Schüsse/Freihand/Trainingszonen/Kommentar-Pins auf dem
 * Taktikboard.
 *
 * Bewusst reiner Sicht-Filter, kein gespeicherter Board-Zustand: anders
 * als in Photoshop/Figma sind diese "Layer" keine eigenständigen
 * Kompositions-Ebenen, sondern Sichtfilter über eine einzige flache
 * Zeichnung – näher an einem Solo/Isolate-Viewer-Toggle. `visibility`
 * lebt daher als reiner React-State in BoardEditorPage.jsx (kein
 * Backend-Feld, kein localStorage) und setzt sich bei jedem
 * Editor-Öffnen zurück auf "alles sichtbar".
 */
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import styles from './LayerVisibilityPanel.module.css';

const LAYERS = [
  { key: 'home',     labelKey: 'layers.home' },
  { key: 'away',     labelKey: 'layers.away' },
  { key: 'move',     labelKey: 'layers.move' },
  { key: 'pass',     labelKey: 'layers.pass' },
  { key: 'shot',     labelKey: 'layers.shot' },
  { key: 'freehand', labelKey: 'layers.freehand' },
  { key: 'zone',     labelKey: 'layers.zone' },
  { key: 'winkel',   labelKey: 'layers.winkel' },
  { key: 'rebound',  labelKey: 'layers.rebound' },
  { key: 'konter',   labelKey: 'layers.konter' },
  { key: 'komm',     labelKey: 'layers.komm' },
  { key: 'comments', labelKey: 'layers.comments' },
];

export default function LayerVisibilityPanel({ visibility, onToggle, hasAwayPlayers = true, onAddOpponents }) {
  const { t } = useTranslation();

  return (
    <section className={styles.panel} aria-label={t('boardEditor.tabs.layers')}>
      <p className={styles.hint}>{t('layers.hint')}</p>

      {/* ISSUE 025: neue Boards platzieren keine Gegner mehr automatisch –
          ohne diesen Hinweis + Aktion würde der "Gegner"-Schalter unten
          folgenlos wirken, weil es schlicht keine Gegner-Spieler gibt. */}
      {!hasAwayPlayers && onAddOpponents && (
        <button type="button" className={styles.addOpponentsBtn} onClick={onAddOpponents}>
          <UserPlus size={16} aria-hidden="true" />
          <span>{t('layers.addOpponents')}</span>
        </button>
      )}

      <div className={styles.grid} role="group" aria-label={t('boardEditor.tabs.layers')}>
        {LAYERS.map((layer) => {
          const isVisible = visibility[layer.key] !== false;
          return (
            <button
              key={layer.key}
              type="button"
              className={`${styles.toggleBtn} ${isVisible ? styles.active : ''}`}
              onClick={() => onToggle(layer.key)}
              aria-pressed={isVisible}
              aria-label={t(isVisible ? 'layers.hideAriaLabel' : 'layers.showAriaLabel', { layer: t(layer.labelKey) })}
            >
              {isVisible ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
              <span>{t(layer.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
