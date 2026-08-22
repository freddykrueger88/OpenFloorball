/**
 * PlayerTrendsPage – Spiel-für-Spiel-Verlauf eines Kader-Spielers
 * (Trends, Statistik-Architektur Phase 4). Eigene Detailseite (Muster
 * wie GamePage.jsx/OrganizationPage.jsx), da Trends inhärent
 * spielerbezogen sind, nicht als Tab/Modal in StatsPage.jsx.
 */
import { useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useRoster } from '../hooks/useRoster.js';
import { useGameLog } from '../hooks/useGameLog.js';
import { useTrainingLog } from '../hooks/useTrainingLog.js';
import GameLogBars from '../components/stats/GameLogBars.jsx';
import PlayerDevelopmentNotesSection from '../components/playerNotes/PlayerDevelopmentNotesSection.jsx';
import styles from './PlayerTrendsPage.module.css';

// aggregateWindow – summiert Rohzahlen ZUERST, dividiert danach. Ein
// Fenster-Durchschnitt aus bereits pro Spiel berechneten Prozentwerten
// wäre mathematisch falsch (Summe der Zähler/Nenner muss vor der
// Division gebildet werden).
function aggregateWindow(games) {
  const totals = games.reduce((acc, g) => ({
    goals: acc.goals + g.goals,
    assists: acc.assists + g.assists,
    shots: acc.shots + g.shots,
    shotsOnGoal: acc.shotsOnGoal + g.shotsOnGoal,
    shotGoals: acc.shotGoals + g.shotGoals,
    penaltyMinutes: acc.penaltyMinutes + g.penaltyMinutes,
  }), { goals: 0, assists: 0, shots: 0, shotsOnGoal: 0, shotGoals: 0, penaltyMinutes: 0 });

  return {
    games: games.length,
    goals: totals.goals,
    assists: totals.assists,
    points: totals.goals + totals.assists,
    goalsPerGame: games.length > 0 ? Math.round((totals.goals / games.length) * 100) / 100 : null,
    shots: totals.shots,
    shotPercentage: totals.shotsOnGoal > 0 ? Math.round((totals.shotGoals / totals.shotsOnGoal) * 1000) / 10 : null,
    penaltyMinutes: totals.penaltyMinutes,
  };
}

// aggregateAttendanceWindow – analog aggregateWindow oben, aber für den
// Trainings-Anwesenheitsverlauf (Statistik-Architektur Phase 5): jeder
// erfasste Status zählt zum Fenster, nur 'present' zählt als Anwesenheit.
function aggregateAttendanceWindow(entries) {
  const recorded = entries.length;
  const present = entries.filter((e) => e.status === 'present').length;
  return {
    recorded,
    present,
    rate: recorded > 0 ? Math.round((present / recorded) * 1000) / 10 : null,
  };
}

export default function PlayerTrendsPage() {
  const { t } = useTranslation();
  const { playerId } = useParams();
  const { rosterPlayers, fetchRoster } = useRoster();
  const { gameLog, loading, error, fetchGameLog } = useGameLog(playerId);
  const { trainingLog, fetchTrainingLog } = useTrainingLog(playerId);

  const load = useCallback(async () => {
    try { await fetchGameLog(); } catch { /* error via hook */ }
  }, [fetchGameLog]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchRoster().catch(() => {}); }, [fetchRoster]);
  useEffect(() => { fetchTrainingLog().catch(() => {}); }, [fetchTrainingLog]);

  const player = rosterPlayers.find((p) => p._id === playerId);

  const last5 = aggregateWindow(gameLog.slice(-5));
  const last10 = aggregateWindow(gameLog.slice(-10));
  const season = aggregateWindow(gameLog);

  const attendanceLast5 = aggregateAttendanceWindow(trainingLog.slice(-5));
  const attendanceLast10 = aggregateAttendanceWindow(trainingLog.slice(-10));
  const attendanceSeason = aggregateAttendanceWindow(trainingLog);

  const percentageOrUnknown = (value) => value ?? t('shotStats.percentageUnknown');

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <Link to="/stats" className={styles.backLink} aria-label={t('stats.trends.backLink')}>←</Link>
        <h1 className={styles.title}>
          {player ? player.name : t('stats.trends.title')}
        </h1>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</div>
      )}

      {loading && gameLog.length === 0 ? (
        <p className={styles.hint}>{t('stats.loading')}</p>
      ) : gameLog.length === 0 ? (
        <p className={styles.hint}>{t('stats.trends.noGamesYet')}</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th />
                  <th>{t('stats.trends.last5')}</th>
                  <th>{t('stats.trends.last10')}</th>
                  <th>{t('stats.trends.season')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('stats.trends.games')}</td>
                  <td>{last5.games}</td><td>{last10.games}</td><td>{season.games}</td>
                </tr>
                <tr>
                  <td>{t('stats.colGoals')}</td>
                  <td>{last5.goals}</td><td>{last10.goals}</td><td>{season.goals}</td>
                </tr>
                <tr>
                  <td>{t('stats.colAssists')}</td>
                  <td>{last5.assists}</td><td>{last10.assists}</td><td>{season.assists}</td>
                </tr>
                <tr>
                  <td>{t('stats.colPoints')}</td>
                  <td>{last5.points}</td><td>{last10.points}</td><td>{season.points}</td>
                </tr>
                <tr>
                  <td>{t('stats.trends.goalsPerGame')}</td>
                  <td>{last5.goalsPerGame ?? '–'}</td><td>{last10.goalsPerGame ?? '–'}</td><td>{season.goalsPerGame ?? '–'}</td>
                </tr>
                <tr>
                  <td>{t('stats.colShots')}</td>
                  <td>{last5.shots}</td><td>{last10.shots}</td><td>{season.shots}</td>
                </tr>
                <tr>
                  <td>{t('stats.colShotPercentage')}</td>
                  <td>{percentageOrUnknown(last5.shotPercentage)}</td>
                  <td>{percentageOrUnknown(last10.shotPercentage)}</td>
                  <td>{percentageOrUnknown(season.shotPercentage)}</td>
                </tr>
                <tr>
                  <td>{t('stats.colPenaltyMinutes')}</td>
                  <td>{last5.penaltyMinutes}</td><td>{last10.penaltyMinutes}</td><td>{season.penaltyMinutes}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <section aria-label={t('stats.trends.goalsPerGame')}>
            <h2 className={styles.subheading}>{t('stats.trends.goalsPerGame')}</h2>
            <GameLogBars games={gameLog} />
          </section>
        </>
      )}

      {trainingLog.length > 0 && (
        <section aria-label={t('stats.trends.attendanceTitle')}>
          <h2 className={styles.subheading}>{t('stats.trends.attendanceTitle')}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th />
                  <th>{t('stats.trends.last5')}</th>
                  <th>{t('stats.trends.last10')}</th>
                  <th>{t('stats.trends.season')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('stats.trends.trainingsRecorded')}</td>
                  <td>{attendanceLast5.recorded}</td><td>{attendanceLast10.recorded}</td><td>{attendanceSeason.recorded}</td>
                </tr>
                <tr>
                  <td>{t('stats.trends.attendanceRate')}</td>
                  <td>{percentageOrUnknown(attendanceLast5.rate)}</td>
                  <td>{percentageOrUnknown(attendanceLast10.rate)}</td>
                  <td>{percentageOrUnknown(attendanceSeason.rate)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {playerId && <PlayerDevelopmentNotesSection playerId={playerId} />}
    </main>
  );
}
