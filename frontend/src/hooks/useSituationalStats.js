/**
 * useSituationalStats – Aufschlüsselung nach Periode und Spielstand für
 * EIN Spiel (Statistik-Architektur Phase 4). Berechnung läuft zentral
 * im Backend (statisticsEngine.calculateSituationalStats).
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useSituationalStats(gameId) {
  const [situationalStats, setSituationalStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSituationalStats = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/games/${gameId}/events/situational-stats`);
      setSituationalStats(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  return { situationalStats, loading, error, fetchSituationalStats };
}
