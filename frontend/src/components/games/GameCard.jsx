/**
 * GameCard – Kachel für ein Spiel in der Übersicht (Live-Spielnotizen),
 * analog TrainingSessionCard.jsx: Gegner editierbar per Doppelklick.
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Volleyball, Calendar, Trash2 } from 'lucide-react';
import { formatDateOnly } from '../../utils/formatDate.js';
import Button from '../common/Button.jsx';
import styles from './GameCard.module.css';

export default function GameCard({ game, teamName, onClick, onRename, onDelete }) {
  const { t } = useTranslation();
  const [editing,  setEditing ] = useState(false);
  const [opponent, setOpponent] = useState(game.opponent);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = opponent.trim();
    if (trimmed === game.opponent) return;
    onRename(trimmed);
  };

  const displayName = game.opponent || t('games.noOpponent');

  return (
    <article className={styles.card} aria-label={t('games.cardAriaLabel', { opponent: displayName })}>
      <button
        className={styles.openBtn}
        onClick={onClick}
        aria-label={t('games.openAriaLabel', { opponent: displayName })}
      >
        <span className={styles.icon}><Volleyball size={16} aria-hidden="true" /></span>
        {game.playedAt && (
          <span className={styles.dateBadge}><Calendar size={16} aria-hidden="true" /> {formatDateOnly(game.playedAt)}</span>
        )}
        {teamName && <span className={styles.teamBadge}>{teamName}</span>}
      </button>

      <div className={styles.nameRow}>
        {editing ? (
          <input
            ref={inputRef}
            className={styles.nameInput}
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  commitRename();
              if (e.key === 'Escape') { setOpponent(game.opponent); setEditing(false); }
            }}
            maxLength={100}
            aria-label={t('games.renameAriaLabel')}
          />
        ) : (
          <button
            className={styles.nameBtn}
            onDoubleClick={() => setEditing(true)}
            onClick={(e) => e.detail === 2 && setEditing(true)}
            title={t('games.renameTitle')}
            aria-label={t('games.renameNameAriaLabel', { opponent: displayName })}
          >
            {displayName}
          </button>
        )}

        <Button
          variant="danger"
          size="sm"
          iconOnly
          className={styles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={t('games.deleteAriaLabel')}
          title={t('games.deleteTitle')}
        >
          <Trash2 size={16} aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}
