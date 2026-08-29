/**
 * LastMatchCard – Rückblick auf das letzte absolvierte Spiel inkl.
 * persönlicher Leistung (Spieler-Dashboard-Ausbau). Persönliche Werte
 * kommen aus demselben Game-Log wie PlayerStatsCard.jsx (kein zweiter
 * Request) – wird nur angezeigt, wenn der Account einen verknüpften
 * Kader-Eintrag hat.
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatDateOnly } from '../../utils/formatDate.js';
import styles from './LastMatchCard.module.css';

export default function LastMatchCard({ match, myGameLog }) {
  const { t } = useTranslation();

  if (!match) {
    return (
      <section className={styles.card} aria-labelledby="last-match-title">
        <h2 id="last-match-title" className={styles.title}>{t('dashboard.lastMatch.title')}</h2>
        <p className={styles.emptyHint}>{t('dashboard.lastMatch.empty')}</p>
      </section>
    );
  }

  const myPerformance = myGameLog?.find((g) => g.gameId === match._id);
  const ownGoals = match.ownGoals ?? 0;
  const opponentGoals = match.opponentGoals ?? 0;

  return (
    <section className={styles.card} aria-labelledby="last-match-title">
      <h2 id="last-match-title" className={styles.title}>{t('dashboard.lastMatch.title')}</h2>

      <p className={styles.result}>
        {match.isHome === false
          ? `${match.opponent} ${opponentGoals}:${ownGoals}`
          : `${t('dashboard.nextMatch.ownTeam')} ${ownGoals}:${opponentGoals} ${match.opponent}`}
      </p>
      <p className={styles.meta}>{formatDateOnly(match.playedAt)}</p>

      {myPerformance && (
        <p className={styles.performance}>
          {t('dashboard.lastMatch.performance', { goals: myPerformance.goals, assists: myPerformance.assists })}
        </p>
      )}

      <Link to={`/games/${match._id}`} className={styles.link}>{t('dashboard.lastMatch.openDetails')}</Link>
    </section>
  );
}
