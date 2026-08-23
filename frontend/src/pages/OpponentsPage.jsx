/**
 * OpponentsPage – Bilanz je Gegner (strukturierte Gegner-Entität,
 * ADR-0007 in DECISIONS.md). Rein lesend: Gegner entstehen automatisch
 * beim Anlegen/Ändern eines Spiels (siehe GamesPage.jsx/useGames.js),
 * hier nur die aggregierte Übersicht mit Verlinkung zu den einzelnen
 * Spielen.
 */
import { useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Shield } from 'lucide-react';
import { useOpponents } from '../hooks/useOpponents.js';
import { formatDateOnly } from '../utils/formatDate.js';
import styles from './OpponentsPage.module.css';

export default function OpponentsPage() {
  const { t } = useTranslation();
  const { opponents, loading, error, fetchOpponents } = useOpponents();

  const load = useCallback(async () => {
    try { await fetchOpponents(); } catch { /* error via hook */ }
  }, [fetchOpponents]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('nav.opponents')}</h1>
          <p className={styles.subtitle}>
            {opponents.length > 0 ? t('opponents.count', { count: opponents.length }) : t('opponents.noOpponentsYet')}
          </p>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {error}
        </div>
      )}

      {loading && opponents.length === 0 ? (
        <div className={styles.skeletonGrid} aria-busy="true" aria-label={t('opponents.loading')}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : opponents.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <div className={styles.emptyIcon}><Shield size={16} aria-hidden="true" /></div>
          <h2>{t('opponents.noOpponentsYet')}</h2>
          <p>{t('opponents.emptyStateDesc')}</p>
        </div>
      ) : (
        <ul className={styles.list} role="list" aria-label={t('nav.opponents')}>
          {opponents.map((opponent) => (
            <li key={opponent.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.opponentName}>{opponent.name}</h2>
                <span className={styles.record}>
                  {t('opponents.record', { wins: opponent.wins, draws: opponent.draws, losses: opponent.losses })}
                  {' · '}
                  {opponent.goalsFor}:{opponent.goalsAgainst}
                </span>
              </div>

              {opponent.games.length === 0 ? (
                <p className={styles.noGames}>{t('opponents.noGamesYet')}</p>
              ) : (
                <ul className={styles.gamesList} role="list">
                  {opponent.games.map((game) => (
                    <li key={game.id}>
                      <Link to={`/games/${game.id}`} className={`${styles.gameRow} ${styles[game.result]}`}>
                        <span className={styles.gameDate}>{formatDateOnly(game.playedAt)}</span>
                        <span className={styles.gameScore}>{game.ownGoals}:{game.opponentGoals}</span>
                        <span className={styles.gameResult}>{t(`opponents.result.${game.result}`)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
