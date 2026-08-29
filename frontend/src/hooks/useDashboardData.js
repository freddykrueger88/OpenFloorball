/**
 * useDashboardData – orchestriert alle Datenquellen für das Spieler-
 * Dashboard (DashboardPage.jsx). Nutzt ausschließlich bestehende Hooks/
 * Endpunkte (useGames/useTrainingSessions/useMyRosterPlayer) statt eines
 * neuen aggregierenden Backend-Endpoints – vermeidet doppelte Datenabrufe
 * über Promise.all, bleibt aber bei den etablierten, einzeln getesteten
 * API-Clients (siehe Plan: "nutze bestehende API-/Datenzugriffsmechanismen").
 *
 * "Mein Team" für die optionale Saisonmanager-Anbindung wird ausschließlich
 * aus dem verknüpften Kader-Eintrag abgeleitet (myRosterPlayer.teamId) –
 * bewusst KEINE willkürliche Wahl aus mehreren Teams, wenn (noch) keine
 * Verknüpfung existiert (siehe Plan "Daten- und Zustandslogik").
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';
import { useGames } from './useGames.js';
import { useTrainingSessions } from './useTrainingSessions.js';
import { useMyRosterPlayer } from './useMyRosterPlayer.js';
import {
  selectNextMatch, selectNextTraining, selectLastMatch, selectUpcomingEvents, selectSeasonRecord,
} from '../utils/dashboardSelectors.js';

export function useDashboardData() {
  const { games, fetchGames } = useGames();
  const { sessions, fetchSessions } = useTrainingSessions();
  const { myRosterPlayer, fetchMyRosterPlayer } = useMyRosterPlayer();

  const [myStats, setMyStats] = useState(null);
  const [myGameLog, setMyGameLog] = useState([]);
  const [saisonmanagerNextMatch, setSaisonmanagerNextMatch] = useState(null);
  const [saisonmanagerTable, setSaisonmanagerTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [, , myPlayer] = await Promise.all([
        fetchGames(),
        fetchSessions(),
        fetchMyRosterPlayer().catch(() => null),
      ]);

      if (myPlayer) {
        const [statsList, gameLog] = await Promise.all([
          apiFetch('/api/roster/stats'),
          apiFetch(`/api/roster/${myPlayer._id}/game-log`),
        ]);
        setMyStats(statsList.find((s) => s._id === myPlayer._id) ?? null);
        setMyGameLog(gameLog);
      } else {
        setMyStats(null);
        setMyGameLog([]);
      }

      // Saisonmanager ist rein optional und pro Team – ohne verknüpften
      // Kader-Eintrag (also ohne bekanntes "eigenes Team") wird es gar nicht
      // erst versucht. Ein Netzwerk-/Konfigurationsfehler dort darf das
      // restliche Dashboard nie beeinträchtigen, daher der eigene try/catch.
      const teamId = myPlayer?.teamId ?? null;
      if (teamId) {
        try {
          const [nextMatch, table] = await Promise.all([
            apiFetch(`/api/teams/${teamId}/saisonmanager/next-match`),
            apiFetch(`/api/teams/${teamId}/saisonmanager/table`),
          ]);
          setSaisonmanagerNextMatch(nextMatch);
          setSaisonmanagerTable(table);
        } catch {
          setSaisonmanagerNextMatch(null);
          setSaisonmanagerTable(null);
        }
      } else {
        setSaisonmanagerNextMatch(null);
        setSaisonmanagerTable(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchGames, fetchSessions, fetchMyRosterPlayer]);

  // Saisonmanager-Daten haben Vorrang, sobald verbunden (echte Anstoßzeit/
  // Halle/Tabelle) – sonst lokale games/abgeleiteter Saisonüberblick.
  const nextMatch = saisonmanagerNextMatch ?? selectNextMatch(games);
  const nextTraining = selectNextTraining(sessions);
  const lastMatch = selectLastMatch(games);
  const upcomingEvents = selectUpcomingEvents(games, sessions, { limit: 5 });
  const seasonOverview = saisonmanagerTable ?? (() => {
    const record = selectSeasonRecord(games);
    return record ? { source: 'derived', record } : null;
  })();

  return {
    loading, error, load,
    nextMatch: nextMatch ? { ...nextMatch, source: nextMatch.source ?? 'local' } : null,
    nextTraining,
    lastMatch,
    upcomingEvents,
    myRosterPlayer,
    myStats,
    myGameLog,
    seasonOverview,
  };
}
