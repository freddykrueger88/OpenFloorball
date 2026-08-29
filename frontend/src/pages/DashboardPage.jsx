/**
 * DashboardPage – Spieler-Dashboard: Startseite für Spieltag, Trainings-
 * alltag und persönliche Saisonübersicht (Spieler-Dashboard-Ausbau).
 *
 * Bewusst eine ZUSÄTZLICHE Route (`/dashboard`), ersetzt NICHT den
 * bestehenden `/`-Redirect nach `/boards` – Umstellung der Standard-
 * Startseite ist ein separater, späterer Schritt (siehe Plan).
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { useTeams } from '../hooks/useTeams.js';
import { toLocalDate } from '../utils/countdown.js';
import { normalizeNextMatch } from '../utils/dashboardSelectors.js';
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton.jsx';
import NextMatchCard from '../components/dashboard/NextMatchCard.jsx';
import NextTrainingCard from '../components/dashboard/NextTrainingCard.jsx';
import PlayerStatsCard from '../components/dashboard/PlayerStatsCard.jsx';
import LastMatchCard from '../components/dashboard/LastMatchCard.jsx';
import SeasonOverviewCard from '../components/dashboard/SeasonOverviewCard.jsx';
import UpcomingEventsCard from '../components/dashboard/UpcomingEventsCard.jsx';
import QuickLinksCard from '../components/dashboard/QuickLinksCard.jsx';
import VenueMapCard from '../components/dashboard/VenueMapCard.jsx';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const { t } = useTranslation();
  const {
    loading, error, load,
    nextMatch, nextTraining, lastMatch, upcomingEvents,
    myRosterPlayer, myStats, myGameLog, seasonOverview,
  } = useDashboardData();
  const { teams, fetchTeams } = useTeams();

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchTeams().catch(() => {}); }, [fetchTeams]);

  const myTeam = teams.find((tm) => tm._id === myRosterPlayer?.teamId);
  const normalizedMatch = normalizeNextMatch(nextMatch);
  const nextMatchDate = normalizedMatch ? toLocalDate(normalizedMatch.date, normalizedMatch.time) : null;

  return (
    <main className={styles.page} id="main-content">
      <DashboardHeader teamName={myTeam?.name} nextMatchDate={nextMatchDate} />

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {t('dashboard.loadError')}
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className={styles.grid}>
          <div className={styles.hero}>
            <NextMatchCard match={nextMatch} />
          </div>

          <NextTrainingCard session={nextTraining} />
          <PlayerStatsCard myRosterPlayer={myRosterPlayer} myStats={myStats} myGameLog={myGameLog} />
          <LastMatchCard match={lastMatch} myGameLog={myGameLog} />
          <SeasonOverviewCard overview={seasonOverview} />
          <UpcomingEventsCard events={upcomingEvents} />
          <VenueMapCard match={nextMatch} />
          <QuickLinksCard />
        </div>
      )}
    </main>
  );
}
