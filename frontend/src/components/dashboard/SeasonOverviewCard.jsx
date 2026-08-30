/**
 * SeasonOverviewCard – kompakter Saisonüberblick (Spieler-Dashboard-
 * Ausbau). Zeigt echten Tabellenplatz/Punkte, sobald eine Saisonmanager-
 * Anbindung besteht (`overview.source === 'saisonmanager'`) – sonst nur,
 * was aus eigenen Spielen ehrlich ableitbar ist (Siege/Unentschieden/
 * Niederlagen/Tordifferenz, KEIN erfundener Tabellenplatz, siehe Plan-ADR).
 * Rendert nichts, wenn weder das eine noch das andere verfügbar ist.
 */
import { useTranslation } from 'react-i18next';
import styles from './SeasonOverviewCard.module.css';

export default function SeasonOverviewCard({ overview }) {
  const { t } = useTranslation();

  if (!overview) return null;

  if (overview.source === 'saisonmanager') {
    const own = overview.standings.find((row) => row.isOwnTeam);
    if (!own) return null;
    return (
      <section className={styles.card} aria-labelledby="season-overview-title">
        <div className={styles.header}>
          <h2 id="season-overview-title" className={styles.title}>{t('dashboard.seasonOverview.title')}</h2>
          <span className={styles.sourceBadge} title={t('dashboard.sourceSaisonmanagerTooltip')}>
            {t('dashboard.sourceSaisonmanager')}
          </span>
        </div>
        <dl className={styles.grid}>
          <div className={styles.stat}><dt>{t('dashboard.seasonOverview.position')}</dt><dd>{own.position}</dd></div>
          <div className={styles.stat}><dt>{t('dashboard.seasonOverview.points')}</dt><dd>{own.points}</dd></div>
          <div className={styles.stat}><dt>{t('dashboard.seasonOverview.record')}</dt><dd>{own.won}-{own.draw}-{own.lost}</dd></div>
          <div className={styles.stat}><dt>{t('dashboard.seasonOverview.goalDiff')}</dt><dd>{own.goalsDiff > 0 ? `+${own.goalsDiff}` : own.goalsDiff}</dd></div>
        </dl>
      </section>
    );
  }

  const { record } = overview;
  return (
    <section className={styles.card} aria-labelledby="season-overview-title">
      <h2 id="season-overview-title" className={styles.title}>{t('dashboard.seasonOverview.title')}</h2>
      <dl className={styles.grid}>
        <div className={styles.stat}><dt>{t('dashboard.seasonOverview.games')}</dt><dd>{record.games}</dd></div>
        <div className={styles.stat}><dt>{t('dashboard.seasonOverview.record')}</dt><dd>{record.won}-{record.draw}-{record.lost}</dd></div>
        <div className={styles.stat}><dt>{t('dashboard.seasonOverview.goalDiff')}</dt><dd>{record.goalDiff > 0 ? `+${record.goalDiff}` : record.goalDiff}</dd></div>
      </dl>
    </section>
  );
}
