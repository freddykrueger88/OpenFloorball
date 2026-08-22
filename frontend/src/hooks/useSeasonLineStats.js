/**
 * useSeasonLineStats – Line-Chemie über die gesamte Saison (Statistik-
 * Architektur Phase 8, Advanced Analytics). Anders als useMatchLines.js
 * (ein Spiel) aggregiert dieser Endpunkt über ALLE Spiele des Nutzers.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useSeasonLineStats() {
  const [seasonLineStats, setSeasonLineStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const fetchSeasonLineStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/lines/season-stats');
      setSeasonLineStats(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { seasonLineStats, loading, error, fetchSeasonLineStats };
}
