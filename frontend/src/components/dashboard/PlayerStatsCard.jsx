/**
 * PlayerStatsCard – persönliche Saison-Statistiken des eingeloggten
 * Spielers (Spieler-Dashboard-Ausbau). Nutzt den bestehenden
 * `GET /api/roster/stats`-Eintrag des verknüpften Kader-Spielers
 * (siehe rosterController.js::fetchRosterStats – bereits positions-
 * abhängig berechnet, keine eigene Logik nötig) und GameLogBars.jsx für
 * die letzten 5 Spiele (kein neues Chart-Framework).
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { POSITION_HINTS } from '../../constants/positionHints.js';
import GameLogBars from '../stats/GameLogBars.jsx';
import styles from './PlayerStatsCard.module.css';

export default function PlayerStatsCard({ myRosterPlayer, myStats, myGameLog }) {
  const { t, i18n } = useTranslation();

  if (!myRosterPlayer) {
    return (
      <section className={styles.card} aria-labelledby="player-stats-title">
        <h2 id="player-stats-title" className={styles.title}>{t('dashboard.playerStats.title')}</h2>
        <p className={styles.emptyHint}>{t('dashboard.playerStats.notLinked')}</p>
        <Link to="/roster" className={styles.emptyLink}>{t('dashboard.playerStats.notLinkedLink')}</Link>
      </section>
    );
  }

  if (!myStats) {
    return (
      <section className={styles.card} aria-labelledby="player-stats-title">
        <h2 id="player-stats-title" className={styles.title}>{t('dashboard.playerStats.title')}</h2>
        <p className={styles.emptyHint}>{t('dashboard.playerStats.noData')}</p>
      </section>
    );
  }

  const isGoalkeeper = myRosterPlayer.role === 'TW';

  return (
    <section className={styles.card} aria-labelledby="player-stats-title">
      <div className={styles.header}>
        <h2 id="player-stats-title" className={styles.title}>{t('dashboard.playerStats.title')}</h2>
        <span className={styles.identity}>
          {myRosterPlayer.jerseyNumber != null && `#${myRosterPlayer.jerseyNumber} · `}
          {myRosterPlayer.role ? (POSITION_HINTS[i18n.language]?.[myRosterPlayer.role] ?? POSITION_HINTS.de[myRosterPlayer.role])?.name : ''}
        </span>
      </div>

      <dl className={styles.grid}>
        <div className={styles.stat}>
          <dt>{t('dashboard.playerStats.games')}</dt>
          <dd>{myStats.appearances}</dd>
        </div>
        {isGoalkeeper ? (
          <>
            <div className={styles.stat}>
              <dt>{t('dashboard.playerStats.goalsAgainst')}</dt>
              <dd>{myStats.goalsAgainst ?? '–'}</dd>
            </div>
            <div className={styles.stat}>
              <dt>{t('dashboard.playerStats.savePercentage')}</dt>
              <dd>{myStats.savePercentage != null ? `${myStats.savePercentage}%` : '–'}</dd>
            </div>
          </>
        ) : (
          <>
            <div className={styles.stat}>
              <dt>{t('dashboard.playerStats.goals')}</dt>
              <dd>{myStats.goals}</dd>
            </div>
            <div className={styles.stat}>
              <dt>{t('dashboard.playerStats.assists')}</dt>
              <dd>{myStats.assists}</dd>
            </div>
            <div className={styles.stat}>
              <dt>{t('dashboard.playerStats.points')}</dt>
              <dd>{myStats.points}</dd>
            </div>
            <div className={styles.stat}>
              <dt>{t('dashboard.playerStats.penaltyMinutes')}</dt>
              <dd>{myStats.penaltyMinutes}</dd>
            </div>
          </>
        )}
      </dl>

      {myGameLog?.length > 0 && (
        <div className={styles.trend}>
          <p className={styles.trendLabel}>{t('dashboard.playerStats.recentGames')}</p>
          <GameLogBars games={myGameLog.slice(-5)} />
        </div>
      )}

      <Link to="/stats" className={styles.link}>{t('dashboard.playerStats.viewAll')}</Link>
    </section>
  );
}
