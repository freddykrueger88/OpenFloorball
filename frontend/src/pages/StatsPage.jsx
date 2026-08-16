/**
 * StatsPage – Spieler-Statistiken (Roadmap-Audit, Fortsetzung Phase C).
 * Rein lesende Übersicht, abgeleitet aus den bereits strukturierten
 * game_events (Tore/Strafen) und game_squad (Einsätze) – kein eigenes
 * Datenmodell, siehe rosterController.getRosterStats.
 */
import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, BarChart3 } from 'lucide-react';
import { useTeams } from '../hooks/useTeams.js';
import { useRosterStats } from '../hooks/useRosterStats.js';
import styles from './StatsPage.module.css';

export default function StatsPage() {
  const { t } = useTranslation();
  const { teams, fetchTeams } = useTeams();
  const { stats, loading, error, fetchStats } = useRosterStats();

  const load = useCallback(async () => {
    try { await fetchStats(); } catch { /* error via hook */ }
  }, [fetchStats]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchTeams().catch(() => {}); }, [fetchTeams]);

  const teamName = (id) => teams.find((tm) => tm._id === id)?.name ?? '';

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <h1 className={styles.title}>{t('stats.title')}</h1>
        <p className={styles.subtitle}>
          {stats.length > 0 ? t('stats.count', { count: stats.length }) : t('stats.noPlayersYet')}
        </p>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</div>
      )}

      {loading && stats.length === 0 ? (
        <p className={styles.hint}>{t('stats.loading')}</p>
      ) : stats.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <BarChart3 size={32} aria-hidden="true" />
          <p>{t('stats.emptyStateDesc')}</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.statsTable}>
            <thead>
              <tr>
                <th>{t('stats.colName')}</th>
                <th>{t('stats.colNumber')}</th>
                <th>{t('stats.colTeam')}</th>
                <th>{t('stats.colGoals')}</th>
                <th>{t('stats.colPenaltyMinutes')}</th>
                <th>{t('stats.colMatchPenalties')}</th>
                <th>{t('stats.colAppearances')}</th>
                <th>{t('stats.colShots')}</th>
                <th>{t('stats.colShotPercentage')}</th>
                <th>{t('stats.colGoalsAgainst')}</th>
                <th>{t('stats.colSavePercentage')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((player) => (
                <tr key={player._id}>
                  <td>{player.name}</td>
                  <td>{player.jerseyNumber ?? '–'}</td>
                  <td>{player.teamId ? teamName(player.teamId) : t('stats.personal')}</td>
                  <td>{player.goals}</td>
                  <td>{player.penaltyMinutes}</td>
                  <td>{player.matchPenalties}</td>
                  <td>{player.appearances}</td>
                  <td>{player.shots}</td>
                  <td>{player.shotPercentage ?? '–'}</td>
                  <td>{player.goalsAgainst ?? '–'}</td>
                  <td>{player.savePercentage ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
