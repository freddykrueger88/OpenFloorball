/**
 * FieldSettingsPanel – Namen, Positions-Hinweise, Spielfeld-Typ, Board
 * teilen gebündelt im "Einstellungen"-Tab des unteren Menüs. Farben und
 * Tastaturkürzel bleiben bewusst im Header (schnell erreichbar, ohne das
 * Menü aufklappen zu müssen). Gegner + Übungsbibliothek-Metadaten leben
 * seit der Tab-Neuordnung in BoardDetailsPanel.jsx (Info-Tab) – gehören
 * inhaltlich zu "worum geht's bei diesem Board", nicht zu Anzeige-/
 * Verhaltens-Einstellungen.
 */
import { useTranslation } from 'react-i18next';
import { Lightbulb, Handshake, Eye } from 'lucide-react';
import FieldNamesBar from './FieldNamesBar.jsx';
import Button from '../common/Button.jsx';
import styles from './FieldSettingsPanel.module.css';

export default function FieldSettingsPanel({
  showNames,
  onToggleShowNames,
  namePosition,
  onSetNamePosition,
  showHints,
  onToggleShowHints,
  fieldType,
  availableFields,
  onRequestFieldTypeChange,
  onOpenShare,
  showShareButton,
  players = [],
  onToggleVisibility,
}) {
  const { t } = useTranslation();
  // Issue 025: Übersicht zum gezielten Wiedereinblenden – nur sichtbar,
  // wenn es überhaupt ausgeblendete Spieler gibt (kein leerer Abschnitt).
  const hiddenPlayers = players.filter((p) => p.team !== 'ball' && p.visible === false);

  return (
    <section className={styles.panel} aria-label={t('boardEditor.tabs.settings')}>
      <FieldNamesBar
        showNames={showNames}
        onToggleShowNames={onToggleShowNames}
        namePosition={namePosition}
        onSetNamePosition={onSetNamePosition}
      />

      <button
        type="button"
        className={`${styles.toggleBtn} ${showHints ? styles.active : ''}`}
        onClick={onToggleShowHints}
        aria-pressed={showHints}
        aria-label={t('field.toggleHints')}
        title={t('field.showHints')}
      >
        <Lightbulb size={16} aria-hidden="true" />
        <span>{t('field.hintsLabel')}</span>
      </button>

      {availableFields && onRequestFieldTypeChange && (
        <label className={styles.fieldTypeRow}>
          <span>{t('settings.fieldType')}</span>
          <select
            className={styles.fieldTypeSelect}
            value={fieldType}
            onChange={(e) => onRequestFieldTypeChange(e.target.value)}
            aria-label={t('settings.fieldType')}
            title={t('field.changeFieldType')}
          >
            {availableFields.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </label>
      )}

      {showShareButton && (
        <Button variant="secondary" size="md" onClick={onOpenShare}>
          <Handshake size={16} aria-hidden="true" />
          <span>{t('boardShare.openLabel')}</span>
        </Button>
      )}

      {hiddenPlayers.length > 0 && (
        <div className={styles.positionGroup} role="group" aria-label={t('field.hiddenPlayersLabel')}>
          <span className={styles.positionLabel}>{t('field.hiddenPlayersLabel')}:</span>
          {hiddenPlayers.map((p) => {
            const label = `${p.role}${p.name ? ` – ${p.name}` : ''} (${p.team === 'home' ? t('teams.home') : t('teams.away')})`;
            return (
              <button
                key={p.id}
                type="button"
                className={styles.toggleBtn}
                onClick={() => onToggleVisibility?.(p.id)}
                aria-label={t('field.showPlayerAriaLabel', { name: label })}
                title={t('field.showPlayerTitle')}
              >
                <Eye size={16} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
