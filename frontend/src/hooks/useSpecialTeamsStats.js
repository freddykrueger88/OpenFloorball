/**
 * useSpecialTeamsStats – Powerplay/Penalty-Kill-Statistiken für EIN
 * Spiel (Statistik-Architektur Phase 4). Berechnung läuft zentral im
 * Backend (statisticsEngine.calculateSpecialTeamsStats).
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useSpecialTeamsStats(gameId) {
  const [specialTeamsStats, setSpecialTeamsStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSpecialTeamsStats = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/games/${gameId}/events/special-teams-stats`);
      setSpecialTeamsStats(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  return { specialTeamsStats, loading, error, fetchSpecialTeamsStats };
}
