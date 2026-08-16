/**
 * useMatchLines – Match-Line/Shift-Tracking-Aktionen für EIN Spiel
 * (Statistik-Architektur Phase 2). Struktur analog useGameEvents.js.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useMatchLines(gameId) {
  const [lineStats, setLineStats] = useState([]);
  const [loading,   setLoading  ] = useState(false);
  const [error,     setError    ] = useState(null);

  const basePath = `/api/games/${gameId}/match-lines`;

  const fetchLineStats = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`${basePath}/stats`);
      setLineStats(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [basePath, gameId]);

  const activateMatchLine = useCallback(async (lineId) => {
    try {
      return await apiFetch(basePath, { method: 'POST', body: JSON.stringify({ lineId }) });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  return { lineStats, loading, error, fetchLineStats, activateMatchLine };
}
