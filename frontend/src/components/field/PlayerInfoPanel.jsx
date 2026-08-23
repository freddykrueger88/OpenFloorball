/**
 * PlayerInfoPanel – Zeigt Positions-Hinweise für den ausgewählten Spieler
 * Erscheint rechts/unten neben dem Feld
 */
import { useTranslation } from 'react-i18next';
import { RefreshCw, Eye, EyeOff } from 'lucide-react';
import { POSITION_HINTS } from '../../constants/positionHints.js';
import Button from '../common/Button.jsx';
import styles from './PlayerInfoPanel.module.css';

export default function PlayerInfoPanel({
  player, onClose, onReset, onNameChange, onToggleVisibility, rosterPlayers, onAssignRoster,
}) {
  const { t, i18n } = useTranslation();

  if (!player) return null;

  const lang  = i18n.language?.startsWith('en') ? 'en' : 'de';
  const hints = POSITION_HINTS[lang] ?? POSITION_HINTS.de;
  const info  = hints[player.role] ?? hints['M'];

  return (
    <aside
      className={styles.panel}
      role="complementary"
      aria-label={t('field.playerInfoLabel', { name: info.name })}
    >
      <header className={styles.header}>
        <div className={styles.badge}>{player.role}</div>
        <h3 className={styles.title}>{info.name}</h3>
        <Button
          variant="secondary"
          size="sm"
          iconOnly
          onClick={onClose}
          aria-label={t('playerInfoPanel.closeLabel')}
        >
          ×
        </Button>
      </header>

      {/* Spielername (Issue #29) */}
      <label className={styles.nameLabel} htmlFor="player-name-input">
        {t('field.playerName')}
        <input
          id="player-name-input"
          type="text"
          maxLength={20}
          className={styles.nameInput}
          value={player.name ?? ''}
          placeholder={t('field.namePlaceholder')}
          onChange={(e) => onNameChange?.(player.id, e.target.value)}
        />
      </label>

      {/* Issue #53 – optionale Zuweisung aus dem zentralen Kader */}
      {rosterPlayers?.length > 0 && (
        <label className={styles.nameLabel} htmlFor="player-roster-select">
          {t('roster.assignFromRoster')}
          <select
            id="player-roster-select"
            className={styles.nameInput}
            value=""
            onChange={(e) => {
              const rosterPlayer = rosterPlayers.find((p) => p._id === e.target.value);
              if (rosterPlayer) onAssignRoster?.(player.id, rosterPlayer);
            }}
            aria-label={t('roster.assignFromRosterAriaLabel')}
          >
            <option value="">{t('roster.assignFromRosterNone')}</option>
            {rosterPlayers.map((p) => (
              <option key={p._id} value={p._id}>
                {p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ''}{p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <p className={styles.hint}>{info.hint}</p>

      <ul className={styles.tips} role="list">
        {info.tips.map((tip, i) => (
          <li key={i} className={styles.tip}>
            <span className={styles.tipIcon} aria-hidden="true">→</span>
            {tip}
          </li>
        ))}
      </ul>

      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="md"
          className={styles.resetBtn}
          onClick={() => onReset?.(player.id)}
          title={t('field.resetPositionTitle')}
        >
          <RefreshCw size={16} aria-hidden="true" /> {t('field.resetPosition')}
        </Button>
        {/* Issue 025: Sichtbarkeit pro Spieler statt nur pauschal "Gegner an/aus" */}
        <Button
          variant="secondary"
          size="md"
          className={styles.resetBtn}
          onClick={() => onToggleVisibility?.(player.id)}
          title={player.visible === false ? t('field.showPlayerTitle') : t('field.hidePlayerTitle')}
        >
          {player.visible === false
            ? <><Eye size={16} aria-hidden="true" /> {t('field.showPlayer')}</>
            : <><EyeOff size={16} aria-hidden="true" /> {t('field.hidePlayer')}</>}
        </Button>
      </div>
    </aside>
  );
}
