/**
 * GameLogBars – einfache CSS-Breiten-Balken für Tore je Spiel
 * (Statistik-Architektur Phase 4, Trends). Bewusst kein Chart-Framework
 * (keine neue Abhängigkeit) – der Zahlenwert steht immer als Text neben
 * dem Balken, nicht nur visuell codiert.
 */
import { useTranslation } from 'react-i18next';
import { formatDateOnly } from '../../utils/formatDate.js';
import styles from './GameLogBars.module.css';

export default function GameLogBars({ games }) {
  const { t } = useTranslation();
  if (games.length === 0) return null;

  const maxGoals = Math.max(1, ...games.map((g) => g.goals));

  return (
    <ul className={styles.list} role="list">
      {games.map((g) => (
        <li key={g.gameId} className={styles.item}>
          <span className={styles.label}>
            {formatDateOnly(g.playedAt)} · {g.opponent?.trim() || t('games.noOpponent')}
          </span>
          <span className={styles.barTrack}>
            <span className={styles.barFill} style={{ width: `${(g.goals / maxGoals) * 100}%` }} />
          </span>
          <span className={styles.value}>{g.goals}</span>
        </li>
      ))}
    </ul>
  );
}
