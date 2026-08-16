/**
 * useShotStats – Schuss- und Torhüter-Statistiken für EIN Spiel
 * (Statistik-Architektur Phase 3). Berechnung läuft zentral im Backend
 * (statisticsEngine.calculateShotStats/calculateGoalkeeperStats) –
 * bewusst kein Frontend-Duplikat der Gruppierungslogik.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useShotStats(gameId) {
  const [shotStats, setShotStats] = useState(null);
  const [goalkeeperStats, setGoalkeeperStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const basePath = `/api/games/${gameId}/events`;

  const fetchShotStats = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    try {
      const [shots, keepers] = await Promise.all([
        apiFetch(`${basePath}/shot-stats`),
        apiFetch(`${basePath}/goalkeeper-stats`),
      ]);
      setShotStats(shots);
      setGoalkeeperStats(keepers);
      return { shots, keepers };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [basePath, gameId]);

  return { shotStats, goalkeeperStats, loading, error, fetchShotStats };
}
